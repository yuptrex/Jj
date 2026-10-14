/* ============ lan.js - serverless LAN play (WebRTC data channels, manual pairing) ============
 No Firebase, no relay, no STUN: players on the same Wi-Fi (or one phone's hotspot) connect directly.
 Pairing = two copy/paste codes (host code -> friend, friend's reply code -> host). After that the
 traffic is device-to-device on the local network (typically 1-5 ms).
 Plugs into game.js through makeNet(): same interface as FirebaseNet/HybridNet. */
(function(){
'use strict';
const RTCP=window.RTCPeerConnection||window.webkitRTCPeerConnection;
const BUF_MAX=64e3,now=()=>performance.now();
const jp=s=>{try{return JSON.parse(s)}catch(e){return null}};
const enc=s=>btoa(String.fromCharCode.apply(null,new TextEncoder().encode(s)));
const dec=t=>new TextDecoder().decode(Uint8Array.from(atob(String(t).replace(/\s+/g,'')),c=>c.charCodeAt(0)));
const mkPC=()=>new RTCP({iceServers:[],bundlePolicy:'max-bundle'});          /* no STUN: LAN candidates only, so gathering is instant */
const gathered=pc=>new Promise(res=>{if(pc.iceGatheringState==='complete')return res();
 const t=setTimeout(res,2500);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);res()}})});

class LanNet{
 constructor(isHost){
  this.host=!!isHost;this.code='LAN';this.onmsg=null;this.onstate=null;this.resend=0;
  this.peers=[];this.pc=null;this.ch={};this.up=0;this.lastRx=now();this.gone=0;this.dead=0;
  this.fast=true;this.path='LAN';this.root=null;
  this.ka=setInterval(()=>{
   if(this.host)this.hsend('r','{"t":"ka"}');
   else if(this.up&&!this.gone&&now()-this.lastRx>2500){this.gone=1;this.onmsg&&this.onmsg({t:'gone'})}},500)}
 get link(){return this.host?true:!!this.up}
 get snapDt(){return this.peersUp()<=3?1/60:1/30}
 peersUp(){let n=0;for(const p of this.peers)if(p.up)n++;return n}
 /* ---- shared ---- */
 bind(ch,P){
  ch.onopen=ch.onclose=()=>this.state(P);ch.onerror=()=>{};
  ch.onmessage=e=>{const t=now();this.lastRx=t;if(P)P.lastRx=t;if(typeof e.data!=='string')return;
   const m=jp(e.data);if(!m||m.t==='ka'){if(!P&&this.gone){this.gone=0;this.onmsg&&this.onmsg({t:'hostup'})}return}
   if(!P&&this.gone){this.gone=0;this.onmsg&&this.onmsg({t:'hostup'})}
   if(P&&m.t==='in'&&m.id&&P.pid!==m.id){P.pid=m.id;this.resend=1}   /* peer just started playing: push world data again */
   this.onmsg&&this.onmsg(m)}}
 state(P){
  const C=P?P.ch:this.ch,up=!!(C.r&&C.u&&C.r.readyState==='open'&&C.u.readyState==='open');
  const o=P?P:this;
  if(up&&!o.up){o.up=1;this.lastRx=now();this.resend=1;this.onstate&&this.onstate(P||null,1)}
  else if(!up&&o.up){o.up=0;this.drop(P)}}
 drop(P){
  if(P){if(P.pid&&this.onmsg)this.onmsg({t:'bye',id:P.pid});this.onstate&&this.onstate(P,0)}
  else if(!this.gone){this.gone=1;this.onmsg&&this.onmsg({t:'gone'});this.onstate&&this.onstate(null,0)}}
 watch(pc,P){pc.onconnectionstatechange=()=>{const s=pc.connectionState;
   if(s==='failed'||s==='closed'){const o=P||this;if(o.up){o.up=0;this.drop(P)}}
   else if(s==='disconnected')setTimeout(()=>{if(pc.connectionState!=='connected'){const o=P||this;if(o.up){o.up=0;this.drop(P)}}},3000)}}
 /* ---- host: one offer per friend ---- */
 async offer(){
  const P={pc:mkPC(),ch:{},up:0,pid:'',lastRx:0,code:''};
  P.ch.r=P.pc.createDataChannel('r',{ordered:true});
  P.ch.u=P.pc.createDataChannel('u',{ordered:false,maxRetransmits:0});
  this.bind(P.ch.r,P);this.bind(P.ch.u,P);this.watch(P.pc,P);
  await P.pc.setLocalDescription(await P.pc.createOffer());await gathered(P.pc);
  P.code=enc(P.pc.localDescription.sdp);this.peers.push(P);return P}
 async accept(P,text){await P.pc.setRemoteDescription({type:'answer',sdp:dec(text)})}
 discard(P){try{P.pc.close()}catch(e){}this.peers=this.peers.filter(x=>x!==P)}
 hsend(label,s){
  for(const P of this.peers){if(!P.up)continue;const c=P.ch[label];if(!c||c.readyState!=='open')continue;
   if(label==='u'&&c.bufferedAmount>BUF_MAX)continue;try{c.send(s)}catch(e){}}}
 /* ---- client: answer the host's code ---- */
 async answer(text){
  const pc=this.pc=mkPC();this.watch(pc,null);
  pc.ondatachannel=e=>{this.ch[e.channel.label]=e.channel;this.bind(e.channel,null);this.state(null)};
  await pc.setRemoteDescription({type:'offer',sdp:dec(text)});
  await pc.setLocalDescription(await pc.createAnswer());await gathered(pc);
  return enc(pc.localDescription.sdp)}
 send(m,str){
  const s=str||JSON.stringify(m);
  if(this.host){this.hsend(m.t==='st'?'u':'r',s);return}
  const c=this.ch[m.t==='in'?'u':'r'];if(!c||c.readyState!=='open')return;
  if(m.t==='in'&&c.bufferedAmount>BUF_MAX)return;try{c.send(s)}catch(e){}}
 close(){this.dead=1;clearInterval(this.ka);for(const P of this.peers)try{P.pc.close()}catch(e){}try{this.pc&&this.pc.close()}catch(e){}this.peers=[];window.CSK_LAN=null}}

/* hook into game.js: room 'LAN' uses LanNet, everything else is unchanged */
const _mk=window.makeNet;
window.makeNet=function(room,mode){return(room==='LAN'&&window.CSK_LAN)?window.CSK_LAN:_mk(room,mode)};

/* ---------------- UI ---------------- */
const css=document.createElement('style');
css.textContent='#lanb{position:fixed;left:10px;top:calc(10px + env(safe-area-inset-top,0px));z-index:9998;padding:8px 12px;border:1px solid #ffb02e;border-radius:10px;background:#0c1118e6;color:#ffd27a;font:700 13px system-ui,sans-serif;letter-spacing:.5px}'+
'#lanm{position:fixed;inset:0;z-index:9999;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px}#lanm[hidden]{display:none}'+
'#lanm .bx{width:min(440px,100%);max-height:92vh;overflow:auto;background:#101822;border:1px solid #2f4252;border-radius:14px;padding:16px;color:#dfe8ef;font:14px/1.4 system-ui,sans-serif}'+
'#lanm h3{margin:0 0 6px;color:#ffb02e}#lanm p{margin:6px 0;color:#9fb1bf;font-size:12.5px}'+
'#lanm textarea{width:100%;height:70px;box-sizing:border-box;background:#0a0f15;color:#cfe;border:1px solid #2f4252;border-radius:8px;font:11px monospace;margin:4px 0}'+
'#lanm button{padding:9px 12px;margin:3px 4px 3px 0;border:0;border-radius:8px;background:#ffb02e;color:#1a1200;font-weight:800}#lanm button.s{background:#27384a;color:#dfe8ef}'+
'#lanm .st{color:#7dffa6;font-weight:700;min-height:18px}';
document.head.appendChild(css);
const el=(h)=>{const d=document.createElement('div');d.innerHTML=h;return d.firstElementChild};
const btn=el('<button id="lanb" hidden>LAN PLAY</button>'),mod=el('<div id="lanm" hidden><div class="bx"></div></div>');
const bx=mod.firstChild;
document.addEventListener('DOMContentLoaded',()=>{document.body.append(btn,mod)});
if(document.body)document.body.append(btn,mod);
const $q=id=>bx.querySelector('#'+id);
const copy=async(t,b)=>{try{await navigator.clipboard.writeText(t)}catch(e){const a=$q('lan-a')||$q('lan-r');if(a){a.select();document.execCommand('copy')}}
 if(b){const o=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=o,1200)}};
const share=t=>{if(navigator.share)navigator.share({text:t}).catch(()=>{})};
const close=()=>{mod.hidden=true};
const head='<h3>LAN Play \u2014 no server</h3><p>Both devices on the same Wi\u2011Fi (or one phone\u2019s hotspot). Direct device-to-device link, no internet needed once the game is loaded.</p>';

function home(){
 if(!RTCP){bx.innerHTML=head+'<p>This browser has no WebRTC. Use Chrome, Edge, Firefox or Safari.</p><button class="s" id="lan-x">Close</button>';$q('lan-x').onclick=close;return}
 bx.innerHTML=head+'<button id="lan-h">Host a game</button><button id="lan-j">Join a game</button><button class="s" id="lan-x">Close</button>';
 $q('lan-x').onclick=close;$q('lan-h').onclick=()=>{
  window.CSK_LAN=new LanNet(true);window.CSK_LAN.onstate=(P,up)=>{const s=$q('lan-st');if(s)s.textContent=up?'\u2714 A player connected!':'A player disconnected'};
  try{start('host','LAN')}catch(e){}hostPanel()};
 $q('lan-j').onclick=joinPanel}

function hostPanel(){
 bx.innerHTML=head+'<p><b>Host:</b> tap Add player, send the code to your friend, paste their reply below.</p><button id="lan-add">Add player</button><div id="lan-w" hidden>'+
  '<p>1) Send this code to your friend:</p><textarea id="lan-a" readonly></textarea><button id="lan-c">Copy</button><button class="s" id="lan-sh">Share</button>'+
  '<p>2) Paste their reply code:</p><textarea id="lan-b" placeholder="reply code"></textarea><button id="lan-ok">Connect</button></div><div class="st" id="lan-st"></div><button class="s" id="lan-x">Close</button>';
 $q('lan-x').onclick=close;let P=null;
 $q('lan-add').onclick=async()=>{const n=window.CSK_LAN;if(!n)return;if(P&&!P.up)n.discard(P);$q('lan-st').textContent='Creating code\u2026';
  try{P=await n.offer();$q('lan-w').hidden=false;$q('lan-a').value=P.code;$q('lan-b').value='';$q('lan-st').textContent='';
   $q('lan-c').onclick=e=>copy(P.code,e.target);$q('lan-sh').onclick=()=>share(P.code)}catch(e){$q('lan-st').textContent='Error: '+(e.message||e)}};
 $q('lan-ok').onclick=async()=>{try{await window.CSK_LAN.accept(P,$q('lan-b').value);$q('lan-st').textContent='Connecting\u2026'}catch(e){$q('lan-st').textContent='That reply code is invalid \u2014 copy it again.'}}}

function joinPanel(){
 bx.innerHTML=head+'<p><b>Join:</b> paste the host\u2019s code, then send your reply code back.</p><textarea id="lan-in" placeholder="host code"></textarea><button id="lan-go">Create reply</button>'+
  '<div id="lan-w" hidden><p>Send this reply code to the host:</p><textarea id="lan-r" readonly></textarea><button id="lan-c">Copy</button><button class="s" id="lan-sh">Share</button></div><div class="st" id="lan-st"></div><button class="s" id="lan-x">Close</button>';
 $q('lan-x').onclick=()=>{close();if(window.CSK_LAN&&!window.CSK_INMATCH)window.CSK_LAN.close()};
 $q('lan-go').onclick=async()=>{
  try{if(window.CSK_LAN)window.CSK_LAN.close();const n=window.CSK_LAN=new LanNet(false);
   n.onstate=(P,up)=>{if(up&&!window.CSK_INMATCH){close();try{start('join','LAN')}catch(e){}}};
   const r=await n.answer($q('lan-in').value);$q('lan-w').hidden=false;$q('lan-r').value=r;
   $q('lan-c').onclick=e=>copy(r,e.target);$q('lan-sh').onclick=()=>share(r);$q('lan-st').textContent='Waiting for the host to paste your reply\u2026'}
  catch(e){$q('lan-st').textContent='That host code is invalid \u2014 copy it again.'}}}

btn.onclick=()=>{mod.hidden=false;(window.CSK_LAN&&window.CSK_LAN.host&&window.CSK_INMATCH)?hostPanel():home()};
setInterval(()=>{
 const m=document.getElementById('menu'),inM=!!window.CSK_INMATCH,hostLan=!!(window.CSK_LAN&&window.CSK_LAN.host&&inM);
 const menuOn=m&&getComputedStyle(m).display!=='none'&&!window.CSK_PRE&&!inM;
 btn.hidden=!(menuOn||hostLan);btn.textContent=hostLan?'+ ADD PLAYER':'LAN PLAY'},600);
})();
