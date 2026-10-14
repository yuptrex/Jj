/* ==========================================================================
   battle-fx.js  -  Battleground visual upgrade (v8)
   Draw-only layer. It never touches gameplay state: it only paints the arena
   and adds extra particles / flashes. game.js calls into window.BFX from
   render() and falls back to the original drawing if anything here throws.
   ========================================================================== */
(function(){
'use strict';
const TAU=6.2832;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function R32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
/* Graphics quality tier, chosen in Settings: 0 = Low, 1 = Medium, 2 = High (default, original look). */
const gfx=()=>window.GFXQ==null?2:window.GFXQ;
const GLOW=()=>gfx()>=1;   // skip the small decorative glow sprites (crystals/bush/pond/sigils) below Medium
const CLOUDS=()=>gfx()>=2; // drifting cloud shadows are a High-only flourish
const Q=()=>!!(window.PFQ&&window.PFQ.lq)||LITE||gfx()===0;   // low-quality flag used by the game's own perf code
const LQ=()=>LITE||!GLOW();   // drop the small decorative glow sprites: auto "lite" mode, or Graphics Quality below Medium

/* ---------------------------------------------------------------- palettes */
const PAL={
 1:{ // EMERALD COURTYARD: teal flagstone, lush grass, warm stone walls, gold trim
  fh:198,fs:36,fl:25,groove:'#07151d',
  patch:[['#2fd06b',.50],['#e3b24a',.30],['#3a8cff',.34]],
  wh:222,ws:24,wl:40,faceTop:'#2c3650',faceBot:'#121827',edgeHi:'#b9c9ea',edgeLo:'#0d1220',
  trim:'#ffc24d',trim2:'#fff0b8',flame:'#ffa63a',
  zones:['#ffb347','#5be37a','#58b8ff','#ff6b8a','#ffd84a'],
  fly:'#d9ff7a',flyN:46,rise:0,
  grassA:'#1f9a4c',grassB:'#8cffaa',rock:'#6f86a6',rockHi:'#c9dbf2',water1:'#46d2ff',water2:'#1b69c0',water3:'#d8f6ff',
  crys:['#59e8ff','#b07bff','#ff7ad1'],bar:'#ffc24d',cloud:.15,vig:[6,10,22],
  pole:'#6b5a3a',flag:['#ffc24d','#ff6b8a','#58b8ff'],flagHi:'#fff6d8'},
 2:{ // VIOLET WASTES: plum stone, magma glow, magenta trim
  fh:276,fs:30,fl:26,groove:'#0f0718',
  patch:[['#c24ee8',.46],['#ff8a3c',.38],['#3fd4cc',.32]],
  wh:290,ws:22,wl:36,faceTop:'#3a2850',faceBot:'#150c22',edgeHi:'#e0c4ff',edgeLo:'#0e0716',
  trim:'#ff6fb1',trim2:'#ffd0e6',flame:'#ff7a3a',
  zones:['#ff6fb1','#ffb347','#8f7bff','#4fe0d0','#ffd84a'],
  fly:'#ffb066',flyN:54,rise:1,
  grassA:'#b8561e',grassB:'#ffb066',rock:'#5a4a73',rockHi:'#c3a9ec',water1:'#ffd04a',water2:'#ff4a1a',water3:'#fff0c0',
  crys:['#ff6fb1','#ffb347','#8f7bff'],bar:'#ff6fb1',cloud:.18,vig:[10,4,16],
  pole:'#3a2a30',flag:['#ff6fb1','#8f7bff','#4fe0d0'],flagHi:'#ffe0f0'}
};
const pal=()=>PAL[LV==2?2:1];

/* ------------------------------------------------------------- sprite cache */
const SPR=new Map();
function glowSpr(col,sz){ // soft radial glow of any CSS colour (white-hot core)
 sz=sz||128;const key=col+'|'+sz;let c=SPR.get(key);if(c)return c;
 c=mk(sz,sz);const g=c.getContext('2d'),h=sz/2;
 g.fillStyle=col;g.fillRect(0,0,sz,sz);
 g.globalCompositeOperation='destination-in';
 const m=g.createRadialGradient(h,h,0,h,h,h);
 m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(.25,'rgba(0,0,0,.62)');m.addColorStop(.55,'rgba(0,0,0,.22)');m.addColorStop(1,'rgba(0,0,0,0)');
 g.fillStyle=m;g.fillRect(0,0,sz,sz);
 if(SPR.size>160)SPR.clear();
 SPR.set(key,c);return c}
const hueSpr=h=>glowSpr(`hsl(${((h|0)+360)%360} 100% 62%)`);
function glowAt(c,x,y,r,a,col){if(a<=0.003)return;cx.globalAlpha=a;cx.drawImage(glowSpr(col),x-r,y-r,r*2,r*2)}

/* ------------------------------------------------------------ texture build */
/* ------------------------------------------------ map art (v44)
   Floor = map-floor.jpg tiled over the whole arena. Props / pillars come from the map-objs.webp atlas.
   Until both images have loaded the floor is a flat dark fill; nothing else in the game depends on them. */
const ATL={"corner": [0, 0, 156, 256], "dragon": [158, 0, 223, 256], "banner1": [383, 0, 134, 256], "tent": [519, 0, 245, 250], "banner2": [766, 0, 143, 249], "well": [911, 0, 215, 229], "bush": [1128, 0, 241, 213], "block": [0, 258, 150, 211], "rockL": [152, 258, 206, 202], "bushW": [360, 258, 188, 185], "bushB": [550, 258, 166, 162], "cross": [718, 258, 179, 161], "barrels": [899, 258, 256, 151], "rockS": [1157, 258, 142, 145], "spikes": [0, 471, 256, 142], "rockC": [258, 471, 256, 141], "pillar": [516, 471, 98, 139], "crateL": [616, 471, 124, 139], "wallM": [742, 471, 256, 125], "banner3": [1000, 471, 256, 119], "sandbags": [0, 615, 256, 113], "crateS": [258, 615, 91, 107], "wallL": [351, 615, 256, 69]};
const ART={floor:null,atlas:null,fp:null,ready:0,cell:96};
(function(){const f=new Image(),a=new Image();let n=0;const ok=()=>{if(++n==2)ART.ready=1};
 f.onload=()=>{ART.floor=f;ok()};a.onload=()=>{ART.atlas=a;ok()};
 f.src='map-floor.jpg?v=44';a.src='map-objs.webp?v=44'})();
/* on-screen width (world units) of every prop; height follows the sprite's aspect ratio */
const PW={bush:88,bushW:76,bushB:66,rockL:86,rockS:56,rockC:104,crateL:56,crateS:40,barrels:92,sandbags:124,spikes:124,cross:62,banner1:44,banner2:40,banner3:104,tent:132,well:98,dragon:156};
function sprite(n,x,y,w,flip){ // draws atlas sprite n with its feet centred on (x,y)
 const a=ATL[n],h=w*a[3]/a[2];
 if(flip){cx.save();cx.translate(x,0);cx.scale(-1,1);cx.drawImage(ART.atlas,a[0],a[1],a[2],a[3],-w/2,y-h+w*.08,w,h);cx.restore()}
 else cx.drawImage(ART.atlas,a[0],a[1],a[2],a[3],x-w/2,y-h+w*.08,w,h)}
/* -------------------------------------------------------------- state */
const flashes=[],decals=[];
let punchZ=0,vigC=null,vigKey='',hurtT=0,LITE=0,emaDt=1/60,slowT=0;
const pulse=(now,sp,ph)=>Math.sin(now/sp+(ph||0))*.5+.5;

/* --------------------------------------------------------------- FLOOR */
function floor(now,dt,hw,hh){
 const x0=Math.max(0,cam.x-hw-30),y0=Math.max(0,cam.y-hh-30),x1=Math.min(MW,cam.x+hw+30),y1=Math.min(MH,cam.y+hh+30);
 const vis=(x,y,r)=>x+r>x0&&x-r<x1&&y+r>y0&&y-r<y1;
 cx.fillStyle='#0a1424';cx.fillRect(x0,y0,x1-x0,y1-y0);
 if(ART.ready){
  if(!ART.fp){ART.fp=cx.createPattern(ART.floor,'repeat');try{ART.fp.setTransform(new DOMMatrix().scale(ART.cell/126.9))}catch(e){}}
  cx.fillStyle=ART.fp;cx.fillRect(x0,y0,x1-x0,y1-y0)}
 // map props (bushes, rocks, crates, banners, statues ...) sit on the floor, y-sorted
 if(ART.ready)for(const d of DEC){if(!vis(d.x,d.y,110))continue;
  const w=PW[d.n]*d.s;
  cx.globalAlpha=.30;cx.fillStyle='#000';cx.beginPath();cx.ellipse(d.x+w*.05,d.y+w*.02,w*.42,w*.13,0,0,TAU);cx.fill();cx.globalAlpha=1;
  sprite(d.n,d.x,d.y,w,d.f)}
 // scorch marks / decals
 for(let i=decals.length-1;i>=0;i--){const d=decals[i];d.l-=dt;if(d.l<=0){decals.splice(i,1);continue}
  if(!vis(d.x,d.y,d.r))continue;const k=Math.min(1,d.l/d.m*1.6),hot=Math.max(0,d.l-(d.m-.9))/.9;
  cx.globalAlpha=.55*k;cx.drawImage(glowSpr('#000'),d.x-d.r,d.y-d.r,d.r*2,d.r*2);
  if(hot>0){cx.globalCompositeOperation='lighter';cx.globalAlpha=.7*hot;cx.drawImage(glowSpr(d.c),d.x-d.r*.8,d.y-d.r*.8,d.r*1.6,d.r*1.6);cx.globalCompositeOperation='source-over'}}
 cx.globalAlpha=1;
 // arena rim: dark inner shadow so the edge of the map reads clearly
 cx.fillStyle='rgba(0,0,0,.55)';
 if(x0<40)cx.fillRect(0,y0,40,y1-y0);if(x1>MW-40)cx.fillRect(MW-40,y0,40,y1-y0);
 if(y0<40)cx.fillRect(x0,0,x1-x0,40);if(y1>MH-40)cx.fillRect(x0,MH-40,x1-x0,40);
 return 1}

/* --------------------------------------------------------------- WALLS
   Top face = the floor tile darkened + a metal frame; stone pillars (atlas) stand along every wall,
   big tower blocks on the short square walls. */
function walls(now,hw,hh){
 const x0=cam.x-hw-120,x1=cam.x+hw+120,y0=cam.y-hh-120,y1=cam.y+hh+120,FH=14;
 const L=[];for(const w of WALLS){if(w[0]>x1||w[0]+w[2]<x0||w[1]>y1||w[1]+w[3]<y0)continue;L.push(w)}
 cx.fillStyle='rgba(0,0,10,.34)';for(const[x,y,w,h]of L)cx.fillRect(x+8,y+12,w+3,h+FH+3);
 for(const[x,y,w,h]of L){
  let g=cx.createLinearGradient(0,y+h,0,y+h+FH);g.addColorStop(0,'#26324d');g.addColorStop(1,'#0c1220');
  cx.fillStyle=g;cx.fillRect(x,y+h,w,FH);
  g=cx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#2b3858');g.addColorStop(1,'#111a2e');cx.fillStyle=g;cx.fillRect(x,y,w,h);
  cx.fillStyle='rgba(170,190,235,.10)';for(let xx=x+22;xx<x+w-10;xx+=44)cx.fillRect(xx,y+4,1.5,h-8);
  for(let yy=y+22;yy<y+h-10&&h>60;yy+=44)cx.fillRect(x+4,yy,w-8,1.5);
  cx.lineJoin='round';cx.strokeStyle='#a9b2c6';cx.lineWidth=3;cx.strokeRect(x+1.5,y+1.5,w-3,h-3);
  cx.strokeStyle='rgba(225,235,255,.55)';cx.lineWidth=1.2;cx.beginPath();cx.moveTo(x+3,y+h-3);cx.lineTo(x+3,y+3);cx.lineTo(x+w-3,y+3);cx.stroke()}
 if(!ART.ready)return;
 const Pl=[];
 for(const[x,y,w,h]of L){
  const mn=Math.min(w,h),mx=Math.max(w,h);
  if(mn>=70&&mx<=170){ // short thick walls -> tower blocks
   const n=Math.max(1,Math.round(mx/mn)),bw=Math.min(mn*1.2,mx/n*1.25);
   for(let i=0;i<n;i++){const px=w>=h?x+mx/n*(i+.5):x+w/2,py=w>=h?y+h/2:y+mx/n*(i+.5);Pl.push([py+mn/2*.8,'block',px,py+mn/2*.8+10,bw])}
  }else{
   const hor=w>=h,cnt=Math.max(2,Math.round(mx/150)+1);
   for(let i=0;i<cnt;i++){const t=8+(mx-16)*i/(cnt-1),px=hor?x+t:x+w/2,py=hor?y+h/2:y+t;Pl.push([py,'pillar',px,py+16,hor?46:46]);}
  }}
 Pl.sort((a,b)=>a[0]-b[0]);
 for(const p of Pl)sprite(p[1],p[2],p[3],p[4]);
 cx.globalAlpha=1}



/* --------------------------------------------------------- pads & coins */
function pads(list,tm){
 if(!list)return;cx.save();cx.globalCompositeOperation='lighter';
 for(const k of list){if(!k.on)continue;if(Math.abs(k.x-cam.x)>innerWidth/2/S+130||Math.abs(k.y-cam.y)>innerHeight/2/S+130)continue;
  const c=PKC[k.t]||'#ffe066',p=Math.sin(tm*3+k.x)*.5+.5;
  cx.globalAlpha=.30+.18*p;cx.drawImage(glowSpr(c),k.x-96,k.y-96,192,192);
  if(GN[k.t]){const g=cx.createLinearGradient(0,k.y-150,0,k.y);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,c);cx.globalAlpha=.20+.10*p;cx.fillStyle=g;cx.fillRect(k.x-20,k.y-150,40,150)}}
 cx.restore()}
function coin(x,y,now,id,big){
 cx.save();cx.globalCompositeOperation='lighter';
 cx.globalAlpha=.55;cx.drawImage(glowSpr('#ffc83a'),x-(big?34:24),y-(big?34:24),big?68:48,big?68:48);
 const t=((now/1700)+id*.37)%1;if(t<.3){const a=Math.sin(t/.3*Math.PI);cx.globalAlpha=a;cx.strokeStyle='#fff6c8';cx.lineWidth=1.6;cx.beginPath();cx.moveTo(x-9*a,y-5);cx.lineTo(x+9*a,y-5);cx.moveTo(x,y-14*a-5);cx.lineTo(x,y+14*a-5);cx.stroke()}
 cx.restore()}

/* ------------------------------------------------------------- bullets */
function bullet(b,x,y,l){
 const h=b.h,nx=b.vx/l,ny=b.vy/l,len=54;
 cx.save();cx.globalCompositeOperation='lighter';cx.lineCap='round';
 let g=cx.createLinearGradient(x,y,x-nx*len,y-ny*len);
 g.addColorStop(0,`hsla(${h},100%,68%,.85)`);g.addColorStop(.45,`hsla(${h},100%,55%,.30)`);g.addColorStop(1,`hsla(${h},100%,50%,0)`);
 cx.strokeStyle=g;cx.lineWidth=9;cx.beginPath();cx.moveTo(x,y);cx.lineTo(x-nx*len,y-ny*len);cx.stroke();
 g=cx.createLinearGradient(x,y,x-nx*len*.7,y-ny*len*.7);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,`hsla(${h},100%,80%,0)`);
 cx.strokeStyle=g;cx.lineWidth=3.2;cx.beginPath();cx.moveTo(x,y);cx.lineTo(x-nx*len*.7,y-ny*len*.7);cx.stroke();
 cx.globalAlpha=.9;cx.drawImage(hueSpr(h),x-19,y-19,38,38);
 cx.restore();cx.fillStyle='#fff';cx.beginPath();cx.arc(x,y,3.2,0,TAU);cx.fill()}

/* ------------------------------------------------------------- players */
function under(p,v,now){
 cx.save();cx.globalCompositeOperation='lighter';
 const me=p.id==myId;
 cx.globalAlpha=me?.5:.34;cx.drawImage(hueSpr(p.hue),v.x-56,v.y-56,112,112);
 if(p.inv>0){cx.globalAlpha=.6;cx.strokeStyle=`hsl(${p.hue} 100% 75%)`;cx.lineWidth=3;cx.beginPath();cx.arc(v.x,v.y,R+12+Math.sin(now/90)*2,0,TAU);cx.stroke()}
 cx.restore()}
function tag(p,v,now,dt){
 const w=50,h=7,x=v.x-w/2,y=v.y-R-20,hp=Math.max(0,v.hs),k=hp/100;
 v.hl=v.hl==null?hp:Math.max(hp,v.hl-55*(dt||.016));
 cx.save();
 cx.fillStyle='rgba(5,9,15,.82)';cx.beginPath();cx.roundRect(x-2,y-2,w+4,h+4,5);cx.fill();
 cx.strokeStyle='rgba(255,255,255,.2)';cx.lineWidth=1;cx.stroke();
 if(v.hl>hp){cx.fillStyle='#ffeeee';cx.globalAlpha=.85;cx.beginPath();cx.roundRect(x,y,w*v.hl/100,h,3);cx.fill();cx.globalAlpha=1}
 const g=cx.createLinearGradient(0,y,0,y+h),lo=k<=.25;
 if(lo){g.addColorStop(0,'#ff8a7a');g.addColorStop(1,'#d8321f')}else if(k<=.5){g.addColorStop(0,'#ffe27a');g.addColorStop(1,'#e8a41c')}else{g.addColorStop(0,'#8bffae');g.addColorStop(1,'#25b85c')}
 cx.fillStyle=g;if(lo)cx.globalAlpha=.75+.25*Math.sin(now/110);cx.beginPath();cx.roundRect(x,y,Math.max(2,w*k),h,3);cx.fill();cx.globalAlpha=1;
 cx.fillStyle='rgba(255,255,255,.35)';cx.fillRect(x+1,y+1,Math.max(0,w*k-2),1.8);
 cx.fillStyle='rgba(0,0,0,.4)';for(let i=1;i<4;i++)cx.fillRect(x+w*i/4-.5,y,1,h);
 cx.font='bold 12px "Trebuchet MS",sans-serif';cx.textAlign='center';cx.textBaseline='alphabetic';cx.lineJoin='round';
 cx.lineWidth=3.5;cx.strokeStyle='rgba(0,0,0,.8)';cx.strokeText(p.name,v.x,y-6);
 cx.fillStyle=p.id==myId?'#ffd25a':'#f2f7fb';cx.fillText(p.name,v.x,y-6);
 cx.restore()}

/* --------------------------------------------------- particles & effects */
function partsDraw(list,dt){
 const cap=LITE?220:[220,320,450][gfx()];if(list.length>cap)list.splice(0,list.length-cap);
 const fd=Math.pow(.93,dt*60);
 for(const q of list){
  q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=fd;q.vy*=fd;
  if(q.vr)q.rot=(q.rot||0)+q.vr*dt;
  const k=Math.max(0,q.l/q.m);let s=q.s;
  if(q.gr)s+=q.gr*(1-k);if(q.sh)s*=k;
  if(q.g){cx.globalCompositeOperation='lighter';cx.globalAlpha=k;const r=s*2.6;cx.drawImage(glowSpr(q.c,64),q.x-r,q.y-r,r*2,r*2);cx.globalCompositeOperation='source-over'}
  else if(q.cas){cx.save();cx.translate(q.x,q.y);cx.rotate(q.rot||0);cx.globalAlpha=Math.min(1,k*2);cx.fillStyle=q.c;cx.fillRect(-q.s,-q.s*.45,q.s*2,q.s*.9);cx.fillStyle='rgba(255,255,255,.55)';cx.fillRect(-q.s,-q.s*.45,q.s*2,q.s*.3);cx.restore()}
  else if(q.rd){cx.globalAlpha=k*(q.a0==null?.5:q.a0);cx.fillStyle=q.c;cx.beginPath();cx.arc(q.x,q.y,s,0,TAU);cx.fill()}
  else{cx.globalAlpha=k;cx.fillStyle=q.c;cx.fillRect(q.x-s/2,q.y-s/2,s,s)}}
 cx.globalAlpha=1}
function ringsDraw(list,dt){
 cx.save();cx.globalCompositeOperation='lighter';
 for(const r of list){r.l-=dt;r.r+=(r.g||160)*dt;const k=Math.max(0,r.l/r.m);if(r.r<=0)continue;
  cx.strokeStyle=r.c;cx.globalAlpha=k*.28;cx.lineWidth=10*k+4;cx.beginPath();cx.arc(r.x,r.y,r.r,0,TAU);cx.stroke();
  cx.globalAlpha=k;cx.lineWidth=2+3*k;cx.beginPath();cx.arc(r.x,r.y,r.r,0,TAU);cx.stroke()}
 cx.restore()}
function textsDraw(list,dt){
 for(const q of list){q.l-=dt;q.y-=38*dt;if(q.m==null)q.m=q.l;
  const age=q.m-q.l,pop=age<.14?1+.9*(1-age/.14):1;
  cx.save();cx.translate(q.x,q.y);cx.scale(pop,pop);cx.globalAlpha=Math.min(1,q.l*2.5);
  cx.font='bold 18px "Trebuchet MS",sans-serif';cx.textAlign='center';cx.lineJoin='round';
  cx.lineWidth=4;cx.strokeStyle='rgba(0,0,0,.85)';cx.strokeText(q.t,0,0);
  cx.shadowColor=q.c;cx.shadowBlur=Q()?0:10;cx.fillStyle=q.c;cx.fillText(q.t,0,0);cx.restore()}
 cx.globalAlpha=1}

function flashesDraw(dt){
 cx.save();cx.globalCompositeOperation='lighter';
 for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.l-=dt;if(f.l<=0){flashes.splice(i,1);continue}
  const k=f.l/f.m;cx.globalAlpha=Math.min(1,k*1.3);const r=f.r*(1.15-.3*k);cx.drawImage(glowSpr(f.c),f.x-r,f.y-r,r*2,r*2)}
 cx.restore()}

/* screen-space finish: vignette, player spotlight, low-health pulse */
function post(now,dt,m,hw,hh){
 if(dt>0){emaDt+=(Math.min(dt,.1)-emaDt)*.05;if(emaDt>1/38&&!window.BFX_NOLITE){slowT+=dt;if(slowT>2.5)LITE=1}else slowT=Math.max(0,slowT-dt)}
 try{flashesDraw(dt)}catch(e){}
 const W=cv.width,H=cv.height,P=pal(),key=W+'x'+H+'|'+LV;
 if(vigKey!==key){
  const w=Math.max(8,W>>2),h=Math.max(8,H>>2);vigC=mk(w,h);const g=vigC.getContext('2d'),rg=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.30,w/2,h/2,Math.hypot(w,h)*.55);
  const c=P.vig;rg.addColorStop(0,`rgba(${c},0)`);rg.addColorStop(.6,`rgba(${c},.20)`);rg.addColorStop(1,`rgba(${c},.78)`);g.fillStyle=rg;g.fillRect(0,0,w,h);vigKey=key}
 cx.save();cx.setTransform(1,0,0,1,0,0);
 cx.globalAlpha=1;cx.drawImage(vigC,0,0,W,H);
 if(m&&m.al&&m.hp<40){const k=(40-m.hp)/40,pl=.5+.5*Math.sin(now/(150+m.hp*6));const g=cx.createRadialGradient(W/2,H/2,Math.min(W,H)*.32,W/2,H/2,Math.hypot(W,H)*.6);g.addColorStop(0,'rgba(255,30,20,0)');g.addColorStop(1,`rgba(255,30,20,${(.20+.34*pl)*k})`);cx.fillStyle=g;cx.fillRect(0,0,W,H)}
 if(hurtT>0){hurtT=Math.max(0,hurtT-dt*2.4);const g=cx.createRadialGradient(W/2,H/2,Math.min(W,H)*.38,W/2,H/2,Math.hypot(W,H)*.6);g.addColorStop(0,'rgba(255,40,30,0)');g.addColorStop(1,`rgba(255,40,30,${.22*hurtT})`);cx.fillStyle=g;cx.fillRect(0,0,W,H)}
 cx.restore()}

function zoom(dt){punchZ*=Math.pow(.015,dt);if(punchZ<.0004)punchZ=0;return punchZ}

/* ------------------------------------------------------------- events */
const rnd=(a,b)=>a+Math.random()*(b-a);
function sparks(x,y,col,n,sp,l,s,up){
 const f=Q()?.5:1;n=Math.ceil(n*f);
 for(let i=0;i<n;i++){const a=Math.random()*TAU,v=sp*(.3+Math.random()*.9);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(up||0),l:l*(.6+Math.random()*.6),m:l,c:col,s:s*(.6+Math.random()*.8),g:1,sh:1})}}
function ev(e){
 const hue=e.h!=null?e.h:40,hc=`hsl(${hue} 100% 62%)`;
 switch(e.k){
 case 'shot':{
  const a=e.a,cs=Math.cos(a),sn=Math.sin(a),mx=e.x+cs*36,my=e.y+sn*36,big=e.w=='shotgun'||e.w=='rifle';
  flashes.push({x:mx,y:my,r:big?125:80,l:.10,m:.10,c:'#ffcf7a'});
  flashes.push({x:mx,y:my,r:big?60:38,l:.06,m:.06,c:'#ffffff'});
  const sh=e.w=='shotgun';
  parts.push({x:e.x+cs*8-sn*6,y:e.y+sn*8+cs*6,vx:-sn*rnd(110,200)+cs*rnd(-30,30),vy:cs*rnd(110,200)+sn*rnd(-30,30),l:.9,m:.9,c:sh?'#ff5a4a':'#ffcf6a',s:sh?4:3,cas:1,rot:rnd(0,6),vr:rnd(-22,22)});
  parts.push({x:mx,y:my,vx:cs*50+rnd(-14,14),vy:sn*50+rnd(-14,14),l:.55,m:.55,c:'#cfd8e3',s:5,gr:15,rd:1,a0:.22});
  sparks(mx,my,'#ffb54a',big?7:4,300,.22,3.2);
  if(e.id==myId)punchZ=Math.min(.06,punchZ+(sh?.012:e.w=='rifle'?.01:.0025));
  break}
 case 'hit':{
  flashes.push({x:e.x,y:e.y,r:56,l:.12,m:.12,c:hc});
  sparks(e.x,e.y,hc,7,300,.38,3.4);sparks(e.x,e.y,'#ffffff',3,380,.22,2.6);
  if(e.id==myId){hurtT=Math.min(1,hurtT+.45);punchZ=Math.min(.06,punchZ+.014)}
  break}
 case 'spark':sparks(e.x,e.y,'#ffe0a0',4,260,.22,2.6);break;
 case 'kill':{
  flashes.push({x:e.x,y:e.y,r:300,l:.28,m:.28,c:hc},{x:e.x,y:e.y,r:150,l:.18,m:.18,c:'#ffffff'});
  decals.push({x:e.x,y:e.y,r:74,l:14,m:14,c:hc});if(decals.length>34)decals.shift();
  sparks(e.x,e.y,hc,24,560,.9,4.4);sparks(e.x,e.y,'#ffffff',10,420,.5,3);
  for(let i=0;i<10;i++)parts.push({x:e.x+rnd(-12,12),y:e.y+rnd(-12,12),vx:rnd(-34,34),vy:rnd(-110,-40),l:1.3,m:1.3,c:hc,s:4,g:1,sh:1});
  parts.push({x:e.x,y:e.y,vx:0,vy:-12,l:.9,m:.9,c:'#8e99a8',s:10,gr:34,rd:1,a0:.3});
  rings.push({x:e.x,y:e.y,r:6,l:.42,m:.42,c:'#ffffff',g:760});
  if(e.ai==myId||e.bi==myId)punchZ=Math.min(.06,punchZ+.05);
  break}
 case 'pick':{
  const c=(typeof PKC!='undefined'&&PKC[e.t])||'#ffe066';
  flashes.push({x:e.x,y:e.y,r:110,l:.25,m:.25,c});
  for(let i=0;i<12;i++)parts.push({x:e.x+rnd(-18,18),y:e.y+rnd(-4,10),vx:rnd(-28,28),vy:rnd(-190,-70),l:.85,m:.85,c,s:3.6,g:1,sh:1});
  rings.push({x:e.x,y:e.y,r:10,l:.4,m:.4,c,g:230});
  break}
 case 'dash':{
  flashes.push({x:e.x,y:e.y,r:90,l:.16,m:.16,c:hc});sparks(e.x,e.y,hc,10,380,.3,3.2);
  parts.push({x:e.x,y:e.y,vx:0,vy:0,l:.45,m:.45,c:'#c9d6e6',s:9,gr:30,rd:1,a0:.2});break}
 case 'spawn':{
  flashes.push({x:e.x,y:e.y,r:200,l:.45,m:.45,c:hc});
  for(let i=0;i<10;i++){const a=i/10*TAU;parts.push({x:e.x+Math.cos(a)*50,y:e.y+Math.sin(a)*50,vx:-Math.cos(a)*90,vy:-Math.sin(a)*90,l:.5,m:.5,c:hc,s:3.4,g:1,sh:1})}
  break}
 case 'boom':{
  flashes.push({x:e.x,y:e.y,r:480,l:.4,m:.4,c:'#ffb23a'},{x:e.x,y:e.y,r:240,l:.22,m:.22,c:'#ffffff'});
  decals.push({x:e.x,y:e.y,r:150,l:20,m:20,c:'#ff7a2a'});if(decals.length>34)decals.shift();
  sparks(e.x,e.y,'#ffa23a',34,640,1,5,0);
  for(let i=0;i<9;i++)parts.push({x:e.x+rnd(-26,26),y:e.y+rnd(-26,26),vx:rnd(-60,60),vy:rnd(-80,20),l:1.4,m:1.4,c:'#59606c',s:12,gr:46,rd:1,a0:.34});
  rings.push({x:e.x,y:e.y,r:8,l:.5,m:.5,c:'#ffffff',g:900});
  break}
 case 'chest':case 'upg':{
  const c='#ffc83a';flashes.push({x:e.x,y:e.y,r:200,l:.35,m:.35,c});
  for(let i=0;i<(e.k=='chest'?26:14);i++)parts.push({x:e.x+rnd(-16,16),y:e.y,vx:rnd(-90,90),vy:rnd(-300,-90),l:1,m:1,c,s:4,g:1,sh:1});
  break}
 case 'thit':case 'rhit':sparks(e.x,e.y,hc,6,260,.3,3);break;
 case 'tdie':flashes.push({x:e.x,y:e.y,r:200,l:.22,m:.22,c:hc});sparks(e.x,e.y,hc,18,480,.7,4);break;
 }}

window.BFX={floor,walls,pads,coin,bullet,under,tag,parts:partsDraw,rings:ringsDraw,texts:textsDraw,post,zoom,ev,
 reset(){LITE=0;slowT=0;flashes.length=0;decals.length=0;punchZ=0;hurtT=0}};
})();
