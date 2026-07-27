"""
Personal file storage/retrieval bot -- Render-friendly version.

Your camuz app posts files to a private Telegram channel. This bot watches
that channel, indexes every new file by its filename (extension stripped)
or caption, and lets you retrieve any file later by sending that code in a
private chat with the bot. Only your Telegram user ID gets a response.

This version is built to run on Render's free Web Service tier:

- It runs a tiny HTTP health endpoint (required so Render treats it as a
  web service and keeps it in rotation instead of a background worker,
  which is not free).
- Render's free tier has NO persistent disk -- any local file is wiped on
  every restart/redeploy/sleep-wake cycle. So instead of a local SQLite
  file, the index (code -> file_id) is stored as a JSON file in a small
  GitHub repo you control: read on startup, rewritten whenever a new file
  is indexed. That survives restarts because it never lives on Render's
  disk at all.

Setup
-----
1. Telegram side (same as before):
   - API_ID / API_HASH from https://my.telegram.org
   - BOT_TOKEN from @BotFather
   - Add the bot as ADMIN of your private channel
   - CHANNEL_ID: forward a channel message to @userinfobot to get it
   - OWNER_ID: message @userinfobot directly to get your own user id

2. GitHub side (for persistence):
   - Create a small private repo, e.g. "camuz-bot-index"
   - Create a Personal Access Token (fine-grained, scoped ONLY to that
     repo, with "Contents: Read and write" permission) at
     https://github.com/settings/tokens
   - GITHUB_TOKEN     = that token
   - GITHUB_REPO      = "yourusername/camuz-bot-index"
   - GITHUB_INDEX_PATH = "index.json"   (default, fine to leave as-is)

3. Set all of the above as environment variables on Render.
   See DEPLOY_RENDER.md for exact steps. Render also injects PORT
   automatically -- you don't set that one yourself.
"""

import os
import json
import base64
import asyncio
import logging

import requests
from aiohttp import web
from pyrogram import Client, filters, idle
from pyrogram.types import Message

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("camuz_storage_bot")

# ---- Telegram configuration ----
API_ID = int(os.environ["API_ID"])
API_HASH = os.environ["API_HASH"]
BOT_TOKEN = os.environ["BOT_TOKEN"]
CHANNEL_ID = int(os.environ["CHANNEL_ID"])
OWNER_ID = int(os.environ["OWNER_ID"])

# ---- GitHub-backed index configuration ----
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = os.environ["GITHUB_REPO"]  # "username/repo"
GITHUB_INDEX_PATH = os.environ.get("GITHUB_INDEX_PATH", "index.json")
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_INDEX_PATH}"
GITHUB_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
}

PORT = int(os.environ.get("PORT", 8080))

app = Client("camuz_storage_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

# In-memory index, loaded from / synced to GitHub.
INDEX = {}
INDEX_SHA = None


def _github_load():
    resp = requests.get(GITHUB_API_URL, headers=GITHUB_HEADERS, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        content = base64.b64decode(data["content"]).decode("utf-8")
        return json.loads(content or "{}"), data["sha"]
    if resp.status_code == 404:
        return {}, None
    resp.raise_for_status()
    return {}, None


def _github_save(index, sha):
    content_b64 = base64.b64encode(json.dumps(index, indent=2).encode("utf-8")).decode("ascii")
    payload = {"message": "update file index", "content": content_b64}
    if sha:
        payload["sha"] = sha
    resp = requests.put(GITHUB_API_URL, headers=GITHUB_HEADERS, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()["content"]["sha"]


async def load_index():
    global INDEX, INDEX_SHA
    INDEX, INDEX_SHA = await asyncio.to_thread(_github_load)
    logger.info("Loaded %d indexed files from GitHub", len(INDEX))


async def save_index():
    global INDEX_SHA
    INDEX_SHA = await asyncio.to_thread(_github_save, INDEX, INDEX_SHA)


def strip_extension(name: str) -> str:
    return os.path.splitext(name)[0].strip().lower()


def extract_file(message: Message):
    if message.document:
        return message.document.file_id, "document", message.document.file_name
    if message.video:
        return message.video.file_id, "video", message.video.file_name
    if message.audio:
        return message.audio.file_id, "audio", message.audio.file_name
    if message.photo:
        return message.photo.file_id, "photo", None
    if message.voice:
        return message.voice.file_id, "voice", None
    if message.animation:
        return message.animation.file_id, "animation", message.animation.file_name
    return None, None, None


@app.on_message(
    filters.chat(CHANNEL_ID)
    & (filters.document | filters.video | filters.audio | filters.photo | filters.voice | filters.animation)
)
async def index_new_file(client: Client, message: Message):
    file_id, file_type, file_name = extract_file(message)
    if not file_id:
        return

    raw_code = message.caption or file_name
    if not raw_code:
        logger.warning("Message %s has no filename or caption, skipping", message.id)
        return

    code = strip_extension(raw_code)
    INDEX[code] = {"file_id": file_id, "file_type": file_type, "message_id": message.id}
    try:
        await save_index()
        logger.info("Indexed '%s' -> message %s", code, message.id)
    except Exception:
        logger.exception("Failed to save index to GitHub after indexing '%s'", code)


@app.on_message(filters.private & filters.text & filters.user(OWNER_ID))
async def retrieve_file(client: Client, message: Message):
    code = message.text.strip().lower()
    entry = INDEX.get(code)
    if not entry:
        await message.reply(f"No file found for code: {message.text.strip()}")
        return

    senders = {
        "document": client.send_document,
        "video": client.send_video,
        "audio": client.send_audio,
        "photo": client.send_photo,
        "voice": client.send_voice,
        "animation": client.send_animation,
    }
    await senders[entry["file_type"]](message.chat.id, entry["file_id"])


# Silently ignore everyone who isn't you.
@app.on_message(filters.private & ~filters.user(OWNER_ID))
async def ignore_others(client: Client, message: Message):
    return


# ---- Minimal HTTP server so Render treats this as a healthy web service ----
async def health(request):
    return web.Response(text=f"ok, {len(INDEX)} files indexed")


async def start_web_server():
    webapp = web.Application()
    webapp.router.add_get("/", health)
    runner = web.AppRunner(webapp)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info("Health server listening on port %s", PORT)


async def main():
    await load_index()
    await app.start()
    await start_web_server()
    logger.info("Bot is running.")
    await idle()
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
