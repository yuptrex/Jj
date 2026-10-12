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
/* Graphics quality tier, chosen in Settings: 0 = Low, 1 = Medium, 2 = High (default), 3 = Ultra HD (massive FX, dense ambience, extra map-asset detail). */
const gfx=()=>window.GFXQ==null?2:window.GFXQ;
const GLOW=()=>gfx()>=1;   // skip the small decorative glow sprites (crystals/bush/pond/sigils) below Medium
const CLOUDS=()=>gfx()>=2; // drifting cloud shadows are a High-only flourish
const UQ=()=>gfx()>=3; // Ultra HD: photoreal baked textures + detailed map assets (no glow / floating particles)
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
  grassA:'#1f9a4c',grassB:'#8cffaa',rock:'#6f86a6',rockHi:'#c9dbf2',water1:'#46d2ff',water2:'#1b69c0',
  crys:['#59e8ff','#b07bff','#ff7ad1'],bar:'#ffc24d',cloud:.15,vig:[6,10,22]},
 2:{ // VIOLET WASTES: plum stone, magma glow, magenta trim
  fh:276,fs:30,fl:26,groove:'#0f0718',
  patch:[['#c24ee8',.46],['#ff8a3c',.38],['#3fd4cc',.32]],
  wh:290,ws:22,wl:36,faceTop:'#3a2850',faceBot:'#150c22',edgeHi:'#e0c4ff',edgeLo:'#0e0716',
  trim:'#ff6fb1',trim2:'#ffd0e6',flame:'#ff7a3a',
  zones:['#ff6fb1','#ffb347','#8f7bff','#4fe0d0','#ffd84a'],
  fly:'#ffb066',flyN:54,rise:1,
  grassA:'#b8561e',grassB:'#ffb066',rock:'#5a4a73',rockHi:'#c3a9ec',water1:'#ffd04a',water2:'#ff4a1a',
  crys:['#ff6fb1','#ffb347','#8f7bff'],bar:'#ff6fb1',cloud:.18,vig:[10,4,16]}
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
let TEX={lv:0,px:0,u:0,floor:null,wall:null,fp:null,wp:null,torches:null,tl:0,map:null};
const MS=8; // colour map is baked at 1/8 resolution (soft blobs only, so it stays smooth)
function bakeFloor(P,px){
 const N=8,T=64,s=T*px,W=N*s,c=mk(W,W),g=c.getContext('2d'),r=R32(7771+P.fh);
 g.fillStyle=P.groove;g.fillRect(0,0,W,W);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=i*s,y=j*s,l=P.fl+(r()-.5)*8,h=P.fh+(r()-.5)*14;
  const gr=g.createLinearGradient(x,y,x+s,y+s);
  gr.addColorStop(0,`hsl(${h} ${P.fs}% ${l+3.5}%)`);gr.addColorStop(1,`hsl(${h} ${P.fs}% ${l-3}%)`);
  g.fillStyle=gr;g.beginPath();g.roundRect(x+2*px,y+2*px,s-4*px,s-4*px,7*px);g.fill();
  g.lineWidth=1.6*px;g.lineJoin='round';
  g.strokeStyle='rgba(255,255,255,.15)';g.beginPath();g.moveTo(x+4*px,y+s-8*px);g.lineTo(x+4*px,y+6*px);g.lineTo(x+s-8*px,y+4*px);g.stroke();
  g.strokeStyle='rgba(0,0,0,.30)';g.beginPath();g.moveTo(x+s-4*px,y+8*px);g.lineTo(x+s-4*px,y+s-4*px);g.lineTo(x+8*px,y+s-4*px);g.stroke();
  for(let k=0;k<26;k++){g.fillStyle=r()<.5?'rgba(255,255,255,.055)':'rgba(0,0,0,.09)';g.fillRect(x+6*px+r()*(s-12*px),y+6*px+r()*(s-12*px),(1+r()*3)*px,(1+r()*3)*px)}
  if(r()<.24){g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=1.2*px;g.beginPath();let cx0=x+s*(.25+r()*.5),cy0=y+s*(.2+r()*.2);g.moveTo(cx0,cy0);for(let k=0;k<4;k++){cx0+=(r()-.5)*22*px;cy0+=(6+r()*10)*px;g.lineTo(clamp(cx0,x+8*px,x+s-8*px),clamp(cy0,y+8*px,y+s-8*px))}g.stroke()}
  if(r()<.13){g.strokeStyle=P.trim;g.globalAlpha=.20;g.lineWidth=1.6*px;const m=s/2;g.beginPath();g.moveTo(x+m,y+14*px);g.lineTo(x+s-14*px,y+m);g.lineTo(x+m,y+s-14*px);g.lineTo(x+14*px,y+m);g.closePath();g.stroke();g.globalAlpha=1}
 }
 return c}
function bakeWall(P,px){
 const BW=32,BH=16,cols=4,rows=4,W=BW*cols*px,H=BH*rows*px,c=mk(W,H),g=c.getContext('2d'),r=R32(991+P.wh);
 g.fillStyle='#0a0d18';g.fillRect(0,0,W,H);
 for(let j=0;j<rows;j++)for(let i=-1;i<=cols;i++){
  const off=(j%2)?BW/2:0,x=(i*BW+off)*px,y=j*BH*px,l=P.wl+(r()-.5)*9,h=P.wh+(r()-.5)*10;
  const gr=g.createLinearGradient(x,y,x,y+BH*px);
  gr.addColorStop(0,`hsl(${h} ${P.ws}% ${l+5}%)`);gr.addColorStop(1,`hsl(${h} ${P.ws}% ${l-4}%)`);
  g.fillStyle=gr;g.beginPath();g.roundRect(x+px,y+px,BW*px-2*px,BH*px-2*px,2.5*px);g.fill();
  g.fillStyle='rgba(255,255,255,.13)';g.fillRect(x+1.5*px,y+px,BW*px-3*px,1.4*px);
  g.fillStyle='rgba(0,0,0,.22)';g.fillRect(x+1.5*px,y+BH*px-2.4*px,BW*px-3*px,1.4*px);
  for(let k=0;k<5;k++){g.fillStyle=r()<.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.12)';g.fillRect(x+3*px+r()*(BW-8)*px,y+3*px+r()*(BH-7)*px,(1+r()*2.4)*px,(1+r()*2)*px)}
 }
 return c}
function ensure(){
 const P=pal(),lv=LV==2?2:1,U=UQ(),px=U?2:((S*dpr>1.5)?2:1);
 if(TEX.lv===lv&&TEX.px===px&&TEX.u===U&&TEX.floor)return;
 TEX.lv=lv;TEX.px=px;TEX.u=U;USPR.clear();
 TEX.floor=U?bakeFloorU(P,px):bakeFloor(P,px);TEX.wall=U?bakeWallU(P,px):bakeWall(P,px);
 TEX.fp=cx.createPattern(TEX.floor,'repeat');TEX.wp=cx.createPattern(TEX.wall,'repeat');
 const m=new DOMMatrix().scale(1/px);
 try{TEX.fp.setTransform(m);TEX.wp.setTransform(m)}catch(e){}
 // torch positions (cached per level from the wall list)
 const T=[];let n=0;
 for(const[x,y,w,h]of WALLS){if(Math.max(w,h)<170)continue;
  if(w>=h){T.push([x+16,y+h/2,n++],[x+w-16,y+h/2,n++])}else{T.push([x+w/2,y+16,n++],[x+w/2,y+h-16,n++])}}
 TEX.torches=T;TEX.tl=WALLS.length;
 // bake grass/sand/water patches + zone light pools once per level into a small map
 const cm=mk(Math.ceil(MW/MS),Math.ceil(MH/MS)),g=cm.getContext('2d');
 for(const q of PAT){const pc=P.patch[q.k%3];g.globalAlpha=pc[1]*.72;const r=q.r/MS;g.drawImage(glowSpr(pc[0]),q.x/MS-r,q.y/MS-r,r*2,r*2)}
 g.globalCompositeOperation='lighter';g.globalAlpha=U?0:.085;
 ZN.forEach((z,i)=>{const r=640/MS;g.drawImage(glowSpr(P.zones[i%5]),z[1]/MS-r,z[2]/MS-r,r*2,r*2)});
 TEX.map=cm}

/* -------------------------------------------------------------- state */
const flashes=[],decals=[],amb=[];
let punchZ=0,vigC=null,vigKey='',hurtT=0,LITE=0,emaDt=1/60,slowT=0;
const pulse=(now,sp,ph)=>Math.sin(now/sp+(ph||0))*.5+.5;

/* --------------------------------------------------------------- FLOOR */
function floor(now,dt,hw,hh){
 const P=pal();ensure();
 if(TEX.tl!==WALLS.length){TEX.lv=0;ensure()}
 const x0=Math.max(0,cam.x-hw-30),y0=Math.max(0,cam.y-hh-30),x1=Math.min(MW,cam.x+hw+30),y1=Math.min(MH,cam.y+hh+30);
 cx.fillStyle='#04070b';cx.fillRect(0,0,MW,MH);
 cx.fillStyle=TEX.fp;cx.fillRect(x0,y0,x1-x0,y1-y0);
 const vis=(x,y,r)=>x+r>x0&&x-r<x1&&y+r>y0&&y-r<y1;
 // baked colour patches + zone light pools (one cheap draw)
 {const sx=x0/MS,sy=y0/MS,sw=(x1-x0)/MS,sh=(y1-y0)/MS;cx.globalAlpha=1;cx.drawImage(TEX.map,sx,sy,sw,sh,x0,y0,x1-x0,y1-y0)}
 // zone names, painted into the ground
 cx.save();cx.textAlign='center';cx.font='bold 150px "Trebuchet MS",sans-serif';try{cx.letterSpacing='22px'}catch(e){}
 ZN.forEach((z,i)=>{if(!vis(z[1],z[2],700))return;cx.fillStyle='rgba(255,255,255,.055)';cx.strokeStyle=P.zones[i%5];cx.globalAlpha=.20;cx.lineWidth=3;cx.strokeText(z[0],z[1],z[2]);cx.globalAlpha=1;cx.fillText(z[0],z[1],z[2])});
 cx.restore();
 // rune rings under every zone + the big royal emblem in the middle (skipped on Low: several strokes each, every frame)
 if(UQ())engrave(P,vis);else if(gfx()>0){
  cx.save();cx.globalCompositeOperation='lighter';cx.lineCap='round';
  ZN.forEach((z,i)=>{if(!vis(z[1],z[2],200))return;rune(z[1],z[2],i==4?150:120,P.zones[i%5],now,i)});
  if(vis(MW/2,MH/2,300))emblem(MW/2,MH/2,now,P);
  cx.restore()}
 // decor
 if(UQ())decorU(now,P,vis);else decor(now,P,hw,hh,vis);
 // scorch marks / decals
 for(let i=decals.length-1;i>=0;i--){const d=decals[i];d.l-=dt;if(d.l<=0){decals.splice(i,1);continue}
  if(!vis(d.x,d.y,d.r))continue;const k=Math.min(1,d.l/d.m*1.6),hot=Math.max(0,d.l-(d.m-.9))/.9;
  cx.globalAlpha=.55*k;cx.drawImage(glowSpr('#000'),d.x-d.r,d.y-d.r,d.r*2,d.r*2);
  if(hot>0){cx.globalCompositeOperation='lighter';cx.globalAlpha=.7*hot;cx.drawImage(glowSpr(d.c),d.x-d.r*.8,d.y-d.r*.8,d.r*1.6,d.r*1.6);cx.globalCompositeOperation='source-over'}}
 cx.globalAlpha=1;
 // drifting cloud shadows
 const rr=R32(LV*77+5);cx.fillStyle='#000';
 for(let i=0;i<(LITE||!CLOUDS()||UQ()?0:3);i++){const bx=rr()*MW,by=rr()*MH,sp=14+rr()*20,rad=330+rr()*220,x=((bx+now/1000*sp)%(MW+1400))-700,y=by+Math.sin(now/9000+i)*60;
  if(!vis(x,y,rad))continue;cx.globalAlpha=P.cloud;cx.drawImage(glowSpr('#000'),x-rad,y-rad*.7,rad*2,rad*1.4)}
 cx.globalAlpha=1;
 barrier(now,P);
 return 1}

function rune(x,y,r,col,now,i){
 cx.strokeStyle=col;cx.lineWidth=3;
 cx.globalAlpha=.22+.12*pulse(now,1600,i);cx.setLineDash([26,18]);cx.lineDashOffset=-now/60*(i%2?-1:1);cx.beginPath();cx.arc(x,y,r,0,TAU);cx.stroke();
 cx.setLineDash([]);cx.globalAlpha=.14;cx.lineWidth=2;cx.beginPath();cx.arc(x,y,r*.72,0,TAU);cx.stroke();
 cx.globalAlpha=.3;cx.lineWidth=3;const a0=now/1400*(i%2?-1:1);
 for(let k=0;k<6;k++){const a=a0+k*TAU/6;cx.beginPath();cx.moveTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82);cx.lineTo(x+Math.cos(a)*r*1.1,y+Math.sin(a)*r*1.1);cx.stroke()}
 cx.globalAlpha=1}
function emblem(x,y,now,P){
 const c=P.trim;cx.strokeStyle=c;cx.lineCap='round';
 for(const[r,a,w,sp]of[[230,.26,4,1],[176,.2,2.5,-1.4],[120,.3,3,2.1]]){cx.globalAlpha=a+.08*pulse(now,1800,r);cx.lineWidth=w;cx.setLineDash(r==176?[]:[40,22]);cx.lineDashOffset=-now/50*sp;cx.beginPath();cx.arc(x,y,r,0,TAU);cx.stroke()}
 cx.setLineDash([]);cx.globalAlpha=.34;cx.lineWidth=3;cx.beginPath();
 const a0=now/2600;for(let k=0;k<8;k++){const a=a0+k*TAU/8,rr=k%2?92:140;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;k?cx.lineTo(px,py):cx.moveTo(px,py)}cx.closePath();cx.stroke();
 cx.globalAlpha=.22+.12*pulse(now,1300);cx.drawImage(glowSpr(c),x-190,y-190,380,380);cx.globalAlpha=1}


/* ===================== ULTRA HD: photoreal baked textures + detailed map assets ===================== */
const USPR=new Map();let NZ=null;
function noiseTex(){if(NZ)return NZ;const r=R32(424242);NZ=[];for(const[n,sm]of[[24,1],[64,1],[256,0]]){const c=mk(n,n),g=c.getContext('2d'),im=g.createImageData(n,n);for(let i=0;i<n*n;i++){const v=(r()*255)|0;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v;im.data[i*4+3]=255}g.putImageData(im,0,0);NZ.push(c)}return NZ}
function grain(g,x,y,w,h,r,a){const N=noiseTex();g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.globalCompositeOperation='overlay';g.imageSmoothingEnabled=true;
 for(let i=0;i<3;i++){const n=N[i],s=n.width,sw=Math.min(s,Math.max(8,s*(i==2?.5:.8)));g.globalAlpha=a*(i==0?1:i==1?.8:.55);g.drawImage(n,r()*(s-sw),r()*(s-sw),sw,sw,x,y,w,h)}g.restore()}
function crack(g,r,x,y,len,px,col){g.strokeStyle=col;g.lineWidth=1.3*px;g.lineCap='round';g.beginPath();g.moveTo(x,y);let cx0=x,cy0=y,a=r()*TAU;
 for(let k=0;k<7;k++){a+=(r()-.5)*1.1;cx0+=Math.cos(a)*len/7;cy0+=Math.sin(a)*len/7;g.lineTo(cx0,cy0);if(r()<.3){const bx=cx0,by=cy0,ba=a+(r()<.5?1:-1)*.9;g.moveTo(bx,by);g.lineTo(bx+Math.cos(ba)*len*.25,by+Math.sin(ba)*len*.25);g.moveTo(cx0,cy0)}}g.stroke()}
function bakeFloorU(P,px){
 const N=8,T=64,s=T*px,W=N*s,c=mk(W,W),g=c.getContext('2d'),r=R32(9191+P.fh),L2=P.fh>250;
 g.fillStyle=P.groove;g.fillRect(0,0,W,W);grain(g,0,0,W,W,r,.9);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=i*s,y=j*s,m=3*px,l=P.fl+(r()-.5)*9,h=P.fh+(r()-.5)*16,rad=(5+r()*5)*px;
  // slab drop-shadow into the groove, then body
  g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.roundRect(x+m+px*1.5,y+m+px*1.5,s-2*m,s-2*m,rad);g.fill();
  const gr=g.createLinearGradient(x,y,x+s,y+s);gr.addColorStop(0,`hsl(${h} ${P.fs}% ${l+5}%)`);gr.addColorStop(.55,`hsl(${h} ${P.fs}% ${l}%)`);gr.addColorStop(1,`hsl(${h} ${P.fs}% ${l-5}%)`);
  g.fillStyle=gr;g.beginPath();g.roundRect(x+m,y+m,s-2*m,s-2*m,rad);g.fill();
  g.save();g.beginPath();g.roundRect(x+m,y+m,s-2*m,s-2*m,rad);g.clip();
  grain(g,x,y,s,s,r,.85);
  // veins / strata
  for(let k=0;k<3;k++){g.strokeStyle=r()<.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.12)';g.lineWidth=(1+r()*2)*px;g.beginPath();const yy=y+s*r();g.moveTo(x,yy);g.bezierCurveTo(x+s*.3,yy+(r()-.5)*s*.4,x+s*.6,yy+(r()-.5)*s*.4,x+s,yy+(r()-.5)*s*.3);g.stroke()}
  // pits & speckle
  for(let k=0;k<70;k++){const px2=x+m+r()*(s-2*m),py2=y+m+r()*(s-2*m),q=(.5+r()*1.6)*px;g.fillStyle=r()<.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.20)';g.beginPath();g.arc(px2,py2,q,0,TAU);g.fill()}
  // weathering: moss (courtyard) / scorch (wastes) creeping from edges
  for(let k=0;k<3;k++){if(r()<.55){const ex=r()<.5?x+m:x+s-m,ey=y+m+r()*(s-2*m),rr=(8+r()*18)*px;const mg=g.createRadialGradient(ex,ey,0,ex,ey,rr);
    if(L2){mg.addColorStop(0,'rgba(8,2,12,.55)');mg.addColorStop(1,'rgba(8,2,12,0)')}else{mg.addColorStop(0,'rgba(54,120,50,.55)');mg.addColorStop(1,'rgba(54,120,50,0)')}g.fillStyle=mg;g.fillRect(ex-rr,ey-rr,rr*2,rr*2);
    for(let q=0;q<9;q++){g.fillStyle=L2?'rgba(20,8,26,.5)':'rgba(96,170,70,.5)';g.beginPath();g.arc(ex+(r()-.5)*rr*1.4,ey+(r()-.5)*rr*1.4,(.6+r()*1.4)*px,0,TAU);g.fill()}}}
  // chipped corners
  for(let k=0;k<2;k++)if(r()<.5){const cxn=r()<.5?x+m:x+s-m,cyn=r()<.5?y+m:y+s-m,sx=cxn==x+m?1:-1,sy=cyn==y+m?1:-1,q=(4+r()*8)*px;g.fillStyle=P.groove;g.beginPath();g.moveTo(cxn,cyn);g.lineTo(cxn+sx*q,cyn);g.lineTo(cxn+sx*q*.4,cyn+sy*q*.5);g.lineTo(cxn,cyn+sy*q);g.fill()}
  if(r()<.4)crack(g,r,x+s*(.2+r()*.6),y+s*(.15+r()*.3),s*(.4+r()*.4),px,'rgba(0,0,0,.45)');
  // inner bevel: light top-left, dark bottom-right
  let bg=g.createLinearGradient(x,y,x,y+s*.22);bg.addColorStop(0,'rgba(255,255,255,.22)');bg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=bg;g.fillRect(x,y,s,s*.22);
  bg=g.createLinearGradient(x,y+s,x,y+s*.78);bg.addColorStop(0,'rgba(0,0,0,.38)');bg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=bg;g.fillRect(x,y+s*.78,s,s*.22);
  bg=g.createLinearGradient(x,y,x+s*.16,y);bg.addColorStop(0,'rgba(255,255,255,.14)');bg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=bg;g.fillRect(x,y,s*.16,s);
  bg=g.createLinearGradient(x+s,y,x+s*.84,y);bg.addColorStop(0,'rgba(0,0,0,.28)');bg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=bg;g.fillRect(x+s*.84,y,s*.16,s);
  g.restore();
  g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=1.2*px;g.beginPath();g.moveTo(x+m+rad,y+m+.6*px);g.lineTo(x+s-m-rad,y+m+.6*px);g.stroke();
  // dirt & pebbles packed in the joints
  for(let k=0;k<5;k++){g.fillStyle=`hsl(${h} 12% ${l-6+r()*14}%)`;g.beginPath();g.ellipse(x+(r()<.5?r()*m:s-r()*m),y+r()*s,(.8+r()*1.4)*px,(.6+r())*px,r()*3,0,TAU);g.fill()}
 }
 return c}
function bakeWallU(P,px){
 const BW=32,BH=16,cols=8,rows=8,W=BW*cols*px,H=BH*rows*px,c=mk(W,H),g=c.getContext('2d'),r=R32(5151+P.wh),L2=P.wh>250;
 g.fillStyle='#05070d';g.fillRect(0,0,W,H);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const off=(j%2)?BW/2:0,bw=BW*(.85+r()*.3),x=(i*BW+off)*px,y=j*BH*px,w=BW*px,hh=BH*px,l=P.wl+(r()-.5)*11,hu=P.wh+(r()-.5)*12;
  for(const dx of[0,-W]){const X=x+dx;if(X>W||X+w<0)continue;
   g.fillStyle='rgba(0,0,0,.5)';g.beginPath();g.roundRect(X+px*1.4,y+px*1.4,w-2*px,hh-2*px,3*px);g.fill();
   const gr=g.createLinearGradient(X,y,X+w*.3,y+hh);gr.addColorStop(0,`hsl(${hu} ${P.ws}% ${l+8}%)`);gr.addColorStop(1,`hsl(${hu} ${P.ws}% ${l-6}%)`);
   g.fillStyle=gr;g.beginPath();g.roundRect(X+px,y+px,w-3*px,hh-3*px,3*px);g.fill();
   g.save();g.beginPath();g.roundRect(X+px,y+px,w-3*px,hh-3*px,3*px);g.clip();
   grain(g,X,y,w,hh,r,.9);
   for(let k=0;k<26;k++){g.fillStyle=r()<.5?'rgba(255,255,255,.12)':'rgba(0,0,0,.22)';g.beginPath();g.arc(X+r()*w,y+r()*hh,(.4+r()*1.1)*px,0,TAU);g.fill()}
   if(r()<.5)crack(g,r,X+w*r(),y+hh*.2,hh*(.5+r()*.6),px,'rgba(0,0,0,.45)');
   if(r()<.45){const mx=X+r()*w,rr=(6+r()*10)*px,mg=g.createRadialGradient(mx,y+hh,0,mx,y+hh,rr);mg.addColorStop(0,L2?'rgba(10,3,14,.6)':'rgba(60,128,55,.6)');mg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=mg;g.fillRect(mx-rr,y+hh-rr,rr*2,rr)}
   let bg=g.createLinearGradient(X,y,X,y+hh*.3);bg.addColorStop(0,'rgba(255,255,255,.3)');bg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=bg;g.fillRect(X,y,w,hh*.3);
   bg=g.createLinearGradient(X,y+hh,X,y+hh*.62);bg.addColorStop(0,'rgba(0,0,0,.45)');bg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=bg;g.fillRect(X,y+hh*.62,w,hh*.38);
   g.restore()}}
 return c}
/* engraved floor emblem + zone names (carved into the stone, no glow) */
function engrave(P,vis){
 cx.save();cx.lineCap='round';
 const ring=(x,y,r,w)=>{cx.lineWidth=w;cx.strokeStyle='rgba(0,0,0,.55)';cx.beginPath();cx.arc(x+1.5,y+2,r,0,TAU);cx.stroke();cx.strokeStyle='rgba(255,255,255,.18)';cx.beginPath();cx.arc(x-1,y-1.5,r,0,TAU);cx.stroke();cx.strokeStyle='rgba(8,8,12,.5)';cx.beginPath();cx.arc(x,y,r,0,TAU);cx.stroke()};
 ZN.forEach((z,i)=>{if(!vis(z[1],z[2],220))return;ring(z[1],z[2],i==4?150:120,5);ring(z[1],z[2],(i==4?150:120)*.72,3)});
 if(vis(MW/2,MH/2,300)){const x=MW/2,y=MH/2;for(const[r,w]of[[230,7],[176,4],[120,5],[60,3]])ring(x,y,r,w);
  for(let k=0;k<8;k++){const a=k*TAU/8;cx.lineWidth=5;cx.strokeStyle='rgba(8,8,12,.5)';cx.beginPath();cx.moveTo(x+Math.cos(a)*120,y+Math.sin(a)*120);cx.lineTo(x+Math.cos(a)*230,y+Math.sin(a)*230);cx.stroke();cx.strokeStyle='rgba(255,255,255,.14)';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(x+Math.cos(a)*120-1,y+Math.sin(a)*120-1);cx.lineTo(x+Math.cos(a)*230-1,y+Math.sin(a)*230-1);cx.stroke()}}
 cx.restore()}
/* detailed map assets, pre-rendered once at 2x into sprites (cheap per frame) */
function uSprite(k,v,P){
 const key=k+'|'+v+'|'+(LV==2?2:1);let s=USPR.get(key);if(s)return s;
 const Z=2,SZ=104,c=mk(SZ*Z,SZ*Z),g=c.getContext('2d'),r=R32(k*977+v*131+(LV==2?7:3)),L2=LV==2;
 g.scale(Z,Z);g.translate(SZ/2,SZ/2);g.lineJoin='round';g.lineCap='round';
 const shade=(col,a)=>{g.fillStyle=col;g.globalAlpha=a;g.fill();g.globalAlpha=1};
 const facet=(pts,col,hi,lo)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=col;g.fill();shade(hi,1);g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1;g.stroke()};
 if(k==0){ // grass tuft: dense layered blades
  for(let i=0;i<22;i++){const x=(r()-.5)*20,h=10+r()*14,b=(r()-.5)*12,gr=g.createLinearGradient(x,4,x+b,-h);gr.addColorStop(0,P.grassA);gr.addColorStop(1,P.grassB);
   g.strokeStyle=gr;g.lineWidth=1.3+r()*1.2;g.beginPath();g.moveTo(x,5);g.quadraticCurveTo(x+b*.3,-h*.4,x+b,-h);g.stroke()}
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(0,5,10,2.6,0,0,TAU);g.fill()}
 else if(k==1){ // rock cluster: faceted, shaded, cracked, mossy
  const rocks=[[-7,2,13,1],[9,4,9,.8],[1,-5,10,.9]];
  for(const[ox,oy,R0,sc]of rocks){const n=7,pts=[];for(let i=0;i<n;i++){const a=i/n*TAU+r()*.4,rr=R0*(.75+r()*.3);pts.push([ox+Math.cos(a)*rr,oy+Math.sin(a)*rr*.78])}
   const base=L2?'#3b2d4c':'#6c7f96';
   g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();const gr=g.createLinearGradient(ox-R0,oy-R0,ox+R0,oy+R0);gr.addColorStop(0,P.rockHi);gr.addColorStop(.45,P.rock);gr.addColorStop(1,L2?'#150b20':'#27323f');g.fillStyle=gr;g.fill();
   for(let i=0;i<n;i++){const a=pts[i],b2=pts[(i+1)%n],lit=(a[0]+b2[0])/2<ox+(a[1]+b2[1])/2-oy-R0*.2;g.beginPath();g.moveTo(ox,oy-1);g.lineTo(a[0],a[1]);g.lineTo(b2[0],b2[1]);g.closePath();g.fillStyle=lit?'rgba(255,255,255,.15)':'rgba(0,0,0,.2)';g.fill()}
   g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=1.2;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.stroke();
   g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;g.beginPath();g.moveTo(pts[n-1][0],pts[n-1][1]);g.lineTo(pts[0][0],pts[0][1]);g.lineTo(pts[1][0],pts[1][1]);g.stroke();
   g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=.8;g.beginPath();g.moveTo(ox-R0*.3,oy-R0*.2);g.lineTo(ox,oy+R0*.1);g.lineTo(ox+R0*.2,oy+R0*.4);g.stroke();
   if(!L2){for(let q=0;q<10;q++){g.fillStyle=`rgba(${70+r()*40|0},${150+r()*50|0},${60+r()*30|0},.8)`;g.beginPath();g.arc(ox-R0*.2+(r()-.5)*R0*1.1,oy+R0*.35+(r()-.5)*R0*.35,1+r()*1.8,0,TAU);g.fill()}}
   else{g.strokeStyle='#5a1a10';g.lineWidth=1;g.beginPath();g.moveTo(ox-R0*.5,oy+R0*.1);g.lineTo(ox-R0*.1,oy);g.lineTo(ox+R0*.2,oy+R0*.3);g.stroke()}}}
 else if(k==2){ // pond / magma pool with stone rim, depth, reeds
  const rim=g.createLinearGradient(-30,-18,30,18);rim.addColorStop(0,L2?'#4a3a5c':'#8d9aa8');rim.addColorStop(1,L2?'#150b20':'#38424e');
  g.fillStyle='#0b0f14';g.beginPath();g.ellipse(0,1.5,32,19,0,0,TAU);g.fill();
  for(let i=0;i<22;i++){const a=i/22*TAU,x=Math.cos(a)*29,y=Math.sin(a)*16.5,rr=3.4+r()*2.6;g.fillStyle=rim;g.beginPath();g.ellipse(x,y,rr,rr*.78,a,0,TAU);g.fill();g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=.8;g.stroke();g.fillStyle='rgba(255,255,255,.22)';g.beginPath();g.ellipse(x-1,y-1.2,rr*.5,rr*.28,a,0,TAU);g.fill()}
  const wg=g.createRadialGradient(-4,-3,2,0,0,28);wg.addColorStop(0,P.water1);wg.addColorStop(.6,P.water2);wg.addColorStop(1,L2?'#3a0a02':'#0a2a50');
  g.fillStyle=wg;g.beginPath();g.ellipse(0,0,25,13.5,0,0,TAU);g.fill();
  const ig=g.createLinearGradient(0,-14,0,14);ig.addColorStop(0,'rgba(0,0,0,.45)');ig.addColorStop(.35,'rgba(0,0,0,0)');ig.addColorStop(1,'rgba(255,255,255,.12)');g.fillStyle=ig;g.fill();
  g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.ellipse(-8,-5,8,1.5,-.15,0,TAU);g.fill();g.beginPath();g.ellipse(6,3,5,1,-.1,0,TAU);g.fill();
  if(!L2){for(const[x,y,q]of[[10,2,4],[-12,3,3.2],[15,-3,2.6]]){g.fillStyle='#2c8a45';g.beginPath();g.ellipse(x,y,q*1.5,q*.8,0,.3,TAU-.3);g.lineTo(x,y);g.fill();g.strokeStyle='#145a2a';g.lineWidth=.6;g.stroke()}
   for(let i=0;i<9;i++){const x=-27+r()*10,y=-5+r()*12;g.strokeStyle=i%2?'#2f9a4a':'#1d6a34';g.lineWidth=1.3;g.beginPath();g.moveTo(x,y+5);g.quadraticCurveTo(x+(r()-.5)*5,y-3,x+(r()-.5)*8,y-12-r()*5);g.stroke()}}}
 else if(k==3){ // bush: many shaded leaf clusters / giant mushrooms
  if(!L2){const cs=['#0f4a24','#1d7a3e','#2ea055','#5fd884'];
   for(let layer=0;layer<4;layer++)for(let i=0;i<9;i++){const a=r()*TAU,d=r()*(16-layer*3),x=Math.cos(a)*d,y=Math.sin(a)*d*.7-layer*2.2,rr=5+r()*3.5;
    const gr=g.createRadialGradient(x-rr*.3,y-rr*.4,.5,x,y,rr);gr.addColorStop(0,cs[Math.min(3,layer+1)]);gr.addColorStop(1,cs[Math.max(0,layer-1)]);g.fillStyle=gr;g.beginPath();g.arc(x,y,rr,0,TAU);g.fill()}
   for(let i=0;i<7;i++){const a=r()*TAU,d=r()*13;g.fillStyle=['#ff7ab8','#ffe066','#fff'][i%3];g.beginPath();g.arc(Math.cos(a)*d,Math.sin(a)*d*.7-4,1.6,0,TAU);g.fill();g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.arc(Math.cos(a)*d+.5,Math.sin(a)*d*.7-3.4,.8,0,TAU);g.fill()}}
  else{for(const[x,y,rr,hh]of[[-8,3,9,9],[7,2,7,7],[0,-4,6,5]]){g.fillStyle='#2a1838';g.fillRect(x-2.2,y,4.4,hh);g.fillStyle='#4b2c63';g.fillRect(x-2.2,y,1.6,hh);
    const gr=g.createRadialGradient(x-rr*.3,y-hh-rr*.3,1,x,y-hh,rr*1.2);gr.addColorStop(0,'#d98cff');gr.addColorStop(.6,'#8d3fb0');gr.addColorStop(1,'#3d1654');g.fillStyle=gr;g.beginPath();g.ellipse(x,y-hh*.7,rr,rr*.62,0,Math.PI,TAU);g.lineTo(x+rr,y-hh*.7);g.fill();g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=.8;g.stroke();
    g.fillStyle='rgba(255,230,255,.7)';for(let q=0;q<4;q++){g.beginPath();g.arc(x+(r()-.5)*rr*1.2,y-hh*.7-r()*rr*.35,.9+r(),0,TAU);g.fill()}}}}
 else if(k==4){ // crystal cluster: faceted gems with specular edges
  const c1=P.crys[v%3];
  g.fillStyle='#2b2f38';for(let i=0;i<6;i++){g.beginPath();g.ellipse(-12+i*5,5+r()*2,5,3.4,0,0,TAU);g.fill();g.fillStyle=i%2?'#3a404c':'#262a33'}
  for(const[x,y,w,h,rot]of[[-9,4,6,19,-.3],[9,5,6,16,.32],[0,3,8.5,28,0],[-3,5,4.5,13,-.1]]){g.save();g.translate(x,y);g.rotate(rot);
   const body=g.createLinearGradient(-w,0,w,0);body.addColorStop(0,'rgba(255,255,255,.85)');body.addColorStop(.3,c1);body.addColorStop(1,'rgba(0,0,0,.6)');
   g.beginPath();g.moveTo(0,-h);g.lineTo(w,-h*.3);g.lineTo(w*.78,3);g.lineTo(-w*.78,3);g.lineTo(-w,-h*.3);g.closePath();g.fillStyle=c1;g.fill();g.fillStyle=body;g.globalAlpha=.9;g.fill();g.globalAlpha=1;
   g.beginPath();g.moveTo(0,-h);g.lineTo(-w,-h*.3);g.lineTo(-w*.78,3);g.lineTo(0,3);g.closePath();g.fillStyle='rgba(255,255,255,.28)';g.fill();
   g.beginPath();g.moveTo(0,-h);g.lineTo(w,-h*.3);g.lineTo(w*.78,3);g.lineTo(0,3);g.closePath();g.fillStyle='rgba(0,0,0,.28)';g.fill();
   g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=.9;g.beginPath();g.moveTo(-w,-h*.3);g.lineTo(0,-h);g.lineTo(w,-h*.3);g.stroke();g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=.9;g.beginPath();g.moveTo(w,-h*.3);g.lineTo(w*.78,3);g.moveTo(0,-h*.3);g.lineTo(0,3);g.stroke();
   g.fillStyle='#fff';g.beginPath();g.arc(-w*.35,-h*.62,1.2,0,TAU);g.fill();g.restore()}}
 else{ // floor sigil, carved
  for(const[ox,oy,col,a]of[[1.4,1.8,'rgba(0,0,0,.6)',1],[-1,-1.4,'rgba(255,255,255,.2)',1],[0,0,'rgba(10,10,14,.55)',1]]){g.strokeStyle=col;g.lineWidth=2.2;g.beginPath();g.arc(ox,oy,15,0,TAU);g.stroke();g.beginPath();for(let i=0;i<5;i++){const an=i*TAU*.4-Math.PI/2,x=ox+Math.cos(an)*15,y=oy+Math.sin(an)*15;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.stroke()}}
 s={c,Z,SZ};USPR.set(key,s);return s}
function decorU(now,P,vis){
 const sw=now/1000,SH=[0,[22,10],[40,18],[26,12],[24,12],0];
 for(const d of DEC){if(!vis(d.x,d.y,60))continue;
  const k=d.k>5?5:d.k,v=((d.x*7+d.y*13)|0)&3,sh=SH[k];
  if(sh&&!LITE){cx.globalAlpha=.45;cx.drawImage(glowSpr('#000'),d.x+d.s*6-sh[0]*d.s,d.y+d.s*7-sh[1]*d.s,sh[0]*2*d.s,sh[1]*2*d.s);cx.globalAlpha=1}
  const s=uSprite(k,v,P),w=s.SZ*d.s;
  cx.save();cx.translate(d.x,d.y);cx.rotate(k==2||k==5?d.r:d.r*.25);
  if(k==0||k==3){const ph=d.x*.013+d.y*.007;cx.transform(1,0,Math.sin(sw*1.6+ph)*(k?.02:.07),1,0,0)}
  cx.drawImage(s.c,-w/2,-w/2,w,w);
  if(k==2){const q=(sw*.7+d.x*.01)%1;cx.globalAlpha=(1-q)*.35;cx.strokeStyle='#fff';cx.lineWidth=1.2;cx.beginPath();cx.ellipse(0,0,(5+q*17)*d.s,(3+q*9)*d.s,0,0,TAU);cx.stroke();cx.globalAlpha=1}
  cx.restore()}}

function decor(now,P,hw,hh,vis){
 const L2=LV==2,sw=now/1000;
 for(const d of DEC){if(!vis(d.x,d.y,50))continue;
  cx.save();cx.translate(d.x,d.y);cx.rotate(d.r);cx.scale(d.s,d.s);
  const k=d.k,ph=d.x*.013+d.y*.007;
  if(k==0){ // grass tufts / ember weeds, swaying in the wind
   cx.lineCap='round';
   for(let i=-2;i<=2;i++){const s=Math.sin(sw*1.8+ph+i*.7)*3.2,h=11+((i*7+d.x)%5+5)%5;
    cx.strokeStyle=P.grassA;cx.lineWidth=3;cx.beginPath();cx.moveTo(i*3.4,5);cx.quadraticCurveTo(i*5,-2,i*7+s,-h);cx.stroke();
    cx.strokeStyle=P.grassB;cx.lineWidth=1.4;cx.beginPath();cx.moveTo(i*3.4,3);cx.quadraticCurveTo(i*5,-3,i*7+s,-h);cx.stroke()}}
  else if(k==1){ // rocks
   cx.fillStyle='rgba(0,0,0,.35)';cx.beginPath();cx.ellipse(3,5,13,8,0,0,TAU);cx.fill();
   cx.fillStyle=P.rock;cx.beginPath();cx.ellipse(0,0,12,9,0,0,TAU);cx.fill();
   cx.fillStyle='rgba(255,255,255,.22)';cx.beginPath();cx.ellipse(-3,-3,7,4.5,-.3,0,TAU);cx.fill();
   cx.fillStyle=P.rockHi;cx.globalAlpha=.55;cx.beginPath();cx.ellipse(-4,-4,3.2,1.8,-.3,0,TAU);cx.fill();cx.globalAlpha=1;
   if(L2){cx.strokeStyle='#ff8a3c';cx.lineWidth=1.4;cx.globalAlpha=.55+.4*pulse(now,900,ph);cx.beginPath();cx.moveTo(-6,2);cx.lineTo(-1,0);cx.lineTo(3,4);cx.lineTo(8,1);cx.stroke();cx.globalAlpha=1}
   else{cx.fillStyle='#3fc46a';cx.beginPath();cx.ellipse(4,2,5,3,.4,0,TAU);cx.fill()}}
  else if(k==2){ // pond (water) / magma pool
   const g=cx.createRadialGradient(0,-2,2,0,0,28);g.addColorStop(0,P.water1);g.addColorStop(1,P.water2);
   if(L2&&!LQ()){cx.globalCompositeOperation='lighter';cx.globalAlpha=.45+.2*pulse(now,700,ph);cx.drawImage(glowSpr('#ff6a22'),-62,-48,124,96);cx.globalCompositeOperation='source-over';cx.globalAlpha=1}
   cx.fillStyle=g;cx.beginPath();cx.ellipse(0,0,27,15,0,0,TAU);cx.fill();
   cx.strokeStyle=L2?'#2a0a05':'rgba(210,245,255,.55)';cx.lineWidth=2.4;cx.stroke();
   const q=(sw*.7+ph)%1;cx.globalAlpha=(1-q)*.6;cx.strokeStyle=L2?'#ffe08a':'#fff';cx.lineWidth=1.4;cx.beginPath();cx.ellipse(0,0,6+q*18,3.5+q*9,0,0,TAU);cx.stroke();cx.globalAlpha=1;
   cx.fillStyle='rgba(255,255,255,.55)';cx.beginPath();cx.ellipse(-8+Math.sin(sw+ph)*3,-4,6,1.6,0,0,TAU);cx.fill();
   if(L2){cx.fillStyle='#fff2a8';const b=(sw*1.3+ph)%1;cx.globalAlpha=1-b;cx.beginPath();cx.arc(Math.sin(ph*9)*10,4-b*8,2+b*3,0,TAU);cx.fill();cx.globalAlpha=1}}
  else if(k==3){ // bush with blossoms / glow-fungus
   const cs=L2?['#6b2d86','#a252c4','#d98cff']:['#1d7a3e','#2ea055','#55d27a'];
   cx.fillStyle='rgba(0,0,0,.3)';cx.beginPath();cx.ellipse(3,6,18,8,0,0,TAU);cx.fill();
   [[0,0,13,0],[11,4,9,1],[-10,5,8,1],[-1,-4,7,2]].forEach(([x,y,r,c])=>{cx.fillStyle=cs[c];cx.beginPath();cx.arc(x,y,r,0,TAU);cx.fill()});
   const fc=L2?['#7dfff0','#ffe27a','#ff9ad8']:['#ff7ab8','#ffe066','#ffffff'],f=fc[((d.x|0)%3+3)%3];
   cx.fillStyle=f;for(const[x,y]of[[-5,-4],[6,1],[-9,6],[2,-8],[10,7]]){cx.beginPath();cx.arc(x,y,1.9,0,TAU);cx.fill()}
   if(L2&&!LQ()){cx.globalCompositeOperation='lighter';cx.globalAlpha=.3+.2*pulse(now,1100,ph);cx.drawImage(glowSpr('#7dfff0'),-30,-28,60,56);cx.globalCompositeOperation='source-over';cx.globalAlpha=1}}
  else if(k==4){ // crystal cluster
   const c=P.crys[((d.y|0)%3+3)%3];
   if(!LQ()){cx.globalCompositeOperation='lighter';cx.globalAlpha=.35+.25*pulse(now,1200,ph);cx.drawImage(glowSpr(c),-46,-46,92,92);cx.globalCompositeOperation='source-over';cx.globalAlpha=1}
   for(const[x,y,w,h,r]of[[-7,2,6,20,-.25],[0,0,8,28,0],[8,3,6,17,.3]]){cx.save();cx.translate(x,y);cx.rotate(r);
    cx.fillStyle=c;cx.beginPath();cx.moveTo(0,-h);cx.lineTo(w,-h*.25);cx.lineTo(w*.7,4);cx.lineTo(-w*.7,4);cx.lineTo(-w,-h*.25);cx.closePath();cx.fill();
    cx.fillStyle='rgba(255,255,255,.45)';cx.beginPath();cx.moveTo(0,-h);cx.lineTo(-w,-h*.25);cx.lineTo(-w*.7,4);cx.lineTo(-w*.1,2);cx.closePath();cx.fill();
    cx.strokeStyle='rgba(0,0,0,.45)';cx.lineWidth=1.2;cx.stroke();cx.restore()}}
  else{ // floor sigil
   cx.globalCompositeOperation='lighter';cx.strokeStyle=P.trim;cx.lineWidth=2.4;cx.globalAlpha=.16+.14*pulse(now,1500,ph);
   cx.beginPath();cx.arc(0,0,15,0,TAU);cx.stroke();cx.rotate(sw*.4);cx.beginPath();for(let i=0;i<5;i++){const a=i*TAU*.4,x=Math.cos(a)*15,y=Math.sin(a)*15;i?cx.lineTo(x,y):cx.moveTo(x,y)}cx.closePath();cx.stroke();
   cx.globalCompositeOperation='source-over';cx.globalAlpha=1}
  cx.restore()}}

function barrier(now,P){
 if(UQ()){const bw=170;cx.save();const sides=[[0,0,MW,bw,0,0,0,bw],[0,MH-bw,MW,bw,0,MH,0,MH-bw],[0,0,bw,MH,0,0,bw,0],[MW-bw,0,bw,MH,MW,0,MW-bw,0]];
  for(const[x,y,w,h,ax,ay,bx,by]of sides){const g=cx.createLinearGradient(ax,ay,bx,by);g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(x,y,w,h)}
  cx.strokeStyle='#15110d';cx.lineWidth=18;cx.strokeRect(9,9,MW-18,MH-18);cx.strokeStyle=P.trim;cx.globalAlpha=.85;cx.lineWidth=5;cx.setLineDash([60,26]);cx.strokeRect(9,9,MW-18,MH-18);cx.restore();return}
 const bw=170,c=P.bar;cx.save();cx.globalCompositeOperation='lighter';
 const sides=[[0,0,MW,bw,0,0,0,bw],[0,MH-bw,MW,bw,0,MH,0,MH-bw],[0,0,bw,MH,0,0,bw,0],[MW-bw,0,bw,MH,MW,0,MW-bw,0]];
 cx.globalAlpha=.30+.10*pulse(now,1400);
 for(const[x,y,w,h,ax,ay,bx,by]of sides){if(x>cam.x+3000||x+w<cam.x-3000)continue;const g=cx.createLinearGradient(ax,ay,bx,by);g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');cx.fillStyle=g;cx.fillRect(x,y,w,h)}
 cx.globalAlpha=.35;cx.strokeStyle=c;cx.lineWidth=16;cx.strokeRect(6,6,MW-12,MH-12);
 cx.globalAlpha=.95;cx.lineWidth=5;cx.setLineDash([36,22]);cx.lineDashOffset=-now/35;cx.strokeRect(6,6,MW-12,MH-12);
 cx.restore()}

/* --------------------------------------------------------------- WALLS */
function walls(now,hw,hh){
 const P=pal();ensure();
 const x0=cam.x-hw-90,x1=cam.x+hw+90,y0=cam.y-hh-90,y1=cam.y+hh+90,U=UQ(),FH=U?18:12;
 const L=[];for(const w of WALLS){if(w[0]>x1||w[0]+w[2]<x0||w[1]>y1||w[1]+w[3]<y0)continue;L.push(w)}
 // soft contact shadows
 if(U){for(let i=0;i<5;i++){cx.fillStyle='rgba(0,0,10,.085)';const o=6+i*7;for(const[x,y,w,h]of L)cx.fillRect(x+o*.7,y+o,w+i*2,h+FH+i*2)}}
 else{cx.fillStyle='rgba(0,0,10,.30)';for(const[x,y,w,h]of L)cx.fillRect(x+7,y+11,w+3,h+FH+3)}
 const tp=pulse(now,900);
 for(const[x,y,w,h]of L){
  // vertical face (gives the wall real height)
  let g=cx.createLinearGradient(0,y+h,0,y+h+FH);g.addColorStop(0,P.faceTop);g.addColorStop(1,P.faceBot);
  if(U){cx.save();cx.translate(x,y+h);cx.fillStyle=TEX.wp;cx.fillRect(0,0,w,FH);cx.restore();cx.fillStyle=g;cx.globalAlpha=.62;cx.fillRect(x,y+h,w,FH);cx.globalAlpha=1;cx.fillStyle='rgba(0,0,0,.35)';cx.fillRect(x,y+h,w,2.5);cx.fillStyle='rgba(0,0,0,.4)';for(let xx=x+16;xx<x+w-4;xx+=32)cx.fillRect(xx,y+h,1.6,FH)}
  else{cx.fillStyle=g;cx.fillRect(x,y+h,w,FH);
  cx.fillStyle='rgba(0,0,0,.28)';for(let xx=x+20;xx<x+w-4;xx+=40)cx.fillRect(xx,y+h,1.6,FH)}
  // brick top
  cx.save();cx.translate(x,y);cx.fillStyle=TEX.wp;cx.fillRect(0,0,w,h);cx.restore();
  g=cx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'rgba(255,255,255,.26)');g.addColorStop(.35,'rgba(255,255,255,.04)');g.addColorStop(1,'rgba(0,0,12,.30)');
  cx.fillStyle=g;cx.fillRect(x,y,w,h);
  // lit edges
  cx.fillStyle=P.edgeHi;cx.globalAlpha=.85;cx.fillRect(x,y,w,2.5);cx.globalAlpha=.5;cx.fillRect(x,y,2.5,h);
  cx.fillStyle=P.edgeLo;cx.globalAlpha=.7;cx.fillRect(x+w-2.5,y,2.5,h);cx.globalAlpha=1;
  // corner pillars with rivets
  for(const[a,b]of[[x,y],[x+w-11,y],[x,y+h-11],[x+w-11,y+h-11]]){const pg=cx.createLinearGradient(a,b,a+11,b+11);pg.addColorStop(0,'rgba(255,255,255,.34)');pg.addColorStop(1,'rgba(0,0,0,.30)');cx.fillStyle=pg;cx.fillRect(a,b,11,11);cx.fillStyle=P.trim2;cx.globalAlpha=.9;cx.beginPath();cx.arc(a+5.5,b+5.5,1.7,0,TAU);cx.fill();cx.globalAlpha=1}
  if(U){cx.fillStyle='rgba(0,0,0,.55)';cx.fillRect(x+2,y+h+FH-4,w-4,4);cx.fillStyle=P.trim;cx.globalAlpha=.8;cx.fillRect(x+3,y+h+FH-8,w-6,2);cx.globalAlpha=1;continue}
  // glowing trim along the base of the face
  cx.save();cx.globalCompositeOperation='lighter';
  cx.fillStyle=P.trim;cx.globalAlpha=.55+.25*tp;cx.fillRect(x+3,y+h+1,w-6,2.6);
  cx.globalAlpha=.9;cx.fillStyle=P.trim2;const off=(now/26)%46;for(let xx=x+3-46+off;xx<x+w-9;xx+=46){const a=Math.max(x+3,xx),b=Math.min(x+w-3,xx+16);if(b>a)cx.fillRect(a,y+h+1,b-a,2.6)}
  cx.globalAlpha=.06+.03*tp;cx.strokeStyle=P.trim;cx.lineWidth=9;cx.strokeRect(x-4,y-4,w+8,h+FH+8);
  cx.restore();cx.globalAlpha=1}
 // braziers
 cx.save();
 for(const[tx,ty,sd]of TEX.torches){if(tx<x0||tx>x1||ty<y0||ty>y1)continue;brazier(tx,ty,now,sd,P)}
 cx.restore()}

function brazier(x,y,now,sd,P){
 const f=Math.sin(now/90+sd*3.1)*.5+Math.sin(now/53+sd*1.7)*.5;
 cx.save();cx.translate(x,y);
 cx.fillStyle='#0c0a10';cx.beginPath();cx.arc(0,1,8.5,0,TAU);cx.fill();
 cx.strokeStyle=P.trim;cx.lineWidth=1.8;cx.beginPath();cx.arc(0,1,8.5,0,TAU);cx.stroke();
 cx.globalCompositeOperation='lighter';
 for(const[r,h,col,a]of[[8.5,25,P.flame,.7],[5.8,18,'#ff9a3a',.55],[3,11,'#ffe9b0',.7]]){
  cx.globalAlpha=a;cx.fillStyle=col;cx.beginPath();cx.moveTo(-r,2);
  cx.quadraticCurveTo(-r*.9,-h*.5+f*2,f*3.2,-h-f*2);cx.quadraticCurveTo(r*.9,-h*.5-f*2,r,2);cx.arc(0,2,r,0,Math.PI);cx.fill()}
 if(!UQ()){cx.globalAlpha=.30+.10*f;if(!LQ())cx.drawImage(glowSpr(P.flame),-125,-125,250,250);
 cx.globalAlpha=.35;cx.drawImage(glowSpr(P.flame),-24,-28,48,48)}
 if(!Q()&&Math.random()<.05)parts.push({x:x+(Math.random()-.5)*8,y:y-10,vx:(Math.random()-.5)*20,vy:-40-Math.random()*40,l:.9,m:.9,c:P.flame,s:3,g:1,sh:1});
 cx.restore()}

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
 const cap=LITE?220:[220,320,450,900][gfx()];if(list.length>cap)list.splice(0,list.length-cap);
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

/* ambient motes: fireflies in the courtyard, rising embers in the wastes */
function ambient(now,dt,hw,hh){
 const P=pal(),n=Q()?Math.floor(P.flyN/2):P.flyN;
 while(amb.length<n)amb.push({x:cam.x+(Math.random()-.5)*hw*2.4,y:cam.y+(Math.random()-.5)*hh*2.4,ph:Math.random()*9,sp:.5+Math.random(),z:.5+Math.random()});
 amb.length=n;
 cx.save();cx.globalCompositeOperation='lighter';
 for(const a of amb){
  if(P.rise){a.y-=(16+a.z*30)*dt;a.x+=Math.sin(now/900+a.ph)*14*dt}else{a.x+=Math.cos(now/1500*a.sp+a.ph)*18*dt;a.y+=Math.sin(now/1300*a.sp+a.ph*1.3)*14*dt}
  if(a.x<cam.x-hw*1.25||a.x>cam.x+hw*1.25||a.y<cam.y-hh*1.25||a.y>cam.y+hh*1.25){a.x=cam.x+(Math.random()-.5)*hw*2.4;a.y=P.rise?cam.y+hh*1.2:cam.y+(Math.random()-.5)*hh*2.4}
  const tw=.25+.75*pulse(now,500/a.sp,a.ph),r=(2.6+a.z*3);
  cx.globalAlpha=tw*.85;cx.drawImage(glowSpr(P.fly,64),a.x-r*2,a.y-r*2,r*4,r*4)}
 cx.restore()}
function flashesDraw(dt){
 cx.save();cx.globalCompositeOperation='lighter';
 for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.l-=dt;if(f.l<=0){flashes.splice(i,1);continue}
  const k=f.l/f.m;cx.globalAlpha=Math.min(1,k*1.3);const r=f.r*(1.15-.3*k);cx.drawImage(glowSpr(f.c),f.x-r,f.y-r,r*2,r*2)}
 cx.restore()}

/* screen-space finish: vignette, player spotlight, low-health pulse */
function post(now,dt,m,hw,hh){
 if(dt>0){emaDt+=(Math.min(dt,.1)-emaDt)*.05;if(emaDt>1/38&&!window.BFX_NOLITE){slowT+=dt;if(slowT>2.5)LITE=1}else slowT=Math.max(0,slowT-dt)}
 try{flashesDraw(dt);if(!LITE&&gfx()>0&&!UQ())ambient(now,dt,hw,hh)}catch(e){}
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
 reset(){LITE=0;slowT=0;flashes.length=0;decals.length=0;amb.length=0;punchZ=0;hurtT=0}};
})();
