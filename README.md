# LAN Chat — Offline Hotspot Chat

Peer-to-peer chat between two phones over a WiFi hotspot. No internet,
no server, no manual IP entry. Messages save locally in SQLite.

## How it actually works (read this first)

Android hotspots don't let two phones "just find each other" with zero
setup — one unavoidable step exists on real hardware:

1. **Phone A** taps "Host Chat" → turns on their mobile hotspot (in Android
   WiFi settings, not in this app — Android doesn't let third-party apps
   toggle the hotspot for security reasons).
2. **Phone B** connects to Phone A's hotspot WiFi network (normal Android
   WiFi settings, one-time, same as joining any WiFi).
3. **Phone B** opens the app, taps "Join Chat" → the app broadcasts on the
   local network and finds Phone A automatically. No IP typing.
4. Chat works exactly like a messaging app from here. Everything is saved
   to a local `.db` file on each phone, so history is there even after
   closing the app, with zero internet at any point.

Steps 1–2 are one-time WiFi setup, identical to connecting to any hotspot.
Step 3 onward is fully automatic — that's the part this app replaces.

## Files

- `main.py` — the whole app (UI + networking + local storage)
- `buildozer.spec` — Android build configuration
- `README.md` — this file

## Building the APK

Buildozer only runs on Linux (or WSL on Windows — not native Windows/Mac).
If you're on Windows, install WSL2 + Ubuntu first; if you're on Mac,
easiest path is a free Linux VM or GitHub Codespaces.

```bash
# One-time setup on a fresh Ubuntu/WSL machine
sudo apt update
sudo apt install -y python3-pip build-essential git python3-dev \
    ffmpeg libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev \
    libportmidi-dev libswscale-dev libavformat-dev libavcodec-dev \
    zlib1g-dev openjdk-17-jdk unzip

pip3 install --user buildozer cython

# Go into the project folder (where main.py and buildozer.spec live)
cd lanchat

# First build — this downloads the Android SDK/NDK automatically,
# takes 15-30 minutes and needs a decent internet connection
# (only for this one-time build step, not for using the app after)
buildozer android debug
```

The finished APK appears at `bin/lanchat-1.0-armeabi-v7a-debug.apk`.

Transfer it to both phones (USB cable, or a file-sharing app) and install
it. You'll need to allow "install from unknown sources" in Android
settings since it's not from the Play Store.

## Testing without building an APK first

You can run and test the chat logic right on a laptop/desktop before
building for Android:

```bash
pip install kivy
python3 main.py
```

Run it on two laptops on the same WiFi network (or the same laptop twice
in two terminals, using `127.0.0.1` — note: same-machine testing needs a
small tweak since both instances would try to bind the same port; see
"Local testing note" below) to confirm the host/join/discovery flow works
before spending time on an Android build.

**Local testing note:** to test both roles on one machine, run the host
copy normally, then temporarily edit `CHAT_PORT` in the second copy to a
different number and connect manually — full LAN discovery needs two
separate devices to work as designed.

## Troubleshooting

- **"Couldn't find host"** — confirm Phone B is actually connected to
  Phone A's hotspot WiFi (not still on mobile data), and that Phone A
  tapped "Host Chat" first.
- **Build fails on `android.ndk`** — buildozer sometimes needs the exact
  NDK version pinned in the spec file downloaded manually if your
  connection drops mid-download; rerun `buildozer android debug` and it
  resumes.
- **Firewall blocks discovery on desktop testing** — if testing on
  laptops, allow the app through your OS firewall for UDP port 50000
  and TCP port 50001.
