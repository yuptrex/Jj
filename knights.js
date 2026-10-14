/* Knight sprite renderer (8 knights + physics cape). Replaces game.js drawChar's body once KNT.ready. Knights are assigned automatically per player id - no selection screen. */
/* Knight sprite renderer: replaces the game's drawChar body. All game animation state (v.rc recoil, v.fl muzzle flash, v.hf hit flash, v.ph walk phase, shield, speed) is preserved. */
(function(){
const S=window.__KN_SPR,IMG={};let pend=0;const sprDone=()=>{if(--pend<=0)KNT.ready=true};
for(const k in S){const i=new Image();pend++;i.onload=i.onerror=sprDone;i.src=S[k];IMG[k]=i}
const K=.46;
const CH=[];[['A',['Silver Knight','White Paladin','Black Knight','Royal Guard'],[0,2,1,3]],['B',['Gilded Silver','Gilded White','Gilded Black','Gilded Royal'],[0,2,1,3]]].forEach(([s,nm,hs])=>nm.forEach((l,i)=>CH.push({s,l,h:hs[i],t:i,a:i,c:i,hs:s=='A'?8:10})));
const WMAP={rifle:['Wsniper',46],smg:['Wsmg',38],shotgun:['Wshotgun',40],pistol:['Wsmg',34],blaster:['Wblaster',42]};
const KNT=window.KNT={CH,ready:false,cape:true};
/* automatic knight: every player / bot gets one of the 8 from their id, so all screens in a room show the same knight for the same player */
KNT.pick=(p)=>CH[(String(p.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0))%CH.length];
const dr=(c,im,x,y,rot,s)=>{c.save();c.translate(x,y);if(rot)c.rotate(rot);if(s)c.scale(s,s);c.drawImage(im,-im.width/2,-im.height/2);c.restore()};
/* local frame: forward = +y. o:{mv,sw,rcl,w,ph} */
function layers(c,ch,o){
 const d2=(im,x,y,rot,sc)=>dr(c,im,x,y,rot,sc),I=n=>IMG[ch.s+n],T=I('t'+ch.t),A=I('a'+ch.a),C=I('c'+ch.c),H=I('h'+ch.h),th=T.height,bob=Math.sin((o.ph||0)*2)*1.4*(o.mv||0);
 const ay=-th/2-2+A.height/2,hands=ay+A.height/2-30,wm=WMAP[o.w]||WMAP.rifle,WI=IMG[wm[0]],Tt=wm[1]/K;
 if(KNT.cape&&!o.nocape){if(window.__CAPE&&catOK){const r=crow(ch),cs=DS/K;c.save();c.translate(0,-th/2+12+bob);c.rotate(Math.PI);c.scale(cs*CWS,cs*CLS);c.drawImage(SRC,0,r*CM.ch,CM.cw,CM.ch,-CM.ax,-CM.ay,CM.cw,CM.ch);c.restore()}else{const cs=.75;d2(C,0,-th/2+12-C.height*cs/2+bob,Math.PI,cs)}}
 d2(T,0,bob);
 let L=Tt-(hands-10);let ws=Math.min(1.1,L/WI.height);if(o.w=='pistol')ws*=1;L=WI.height*ws;
 d2(WI,0,Tt-L/2-(o.rcl||0),Math.PI,ws);
 const sw=Math.sin(o.ph||0)*.06*(o.mv||0);
 c.save();c.translate(0,ay-(o.rcl||0)*.5);c.rotate(sw);c.drawImage(A,-A.width/2,-A.height/2);c.restore();
 d2(H,0,-6+bob);
}

/* ---- cape physics v3 (fast): sprite-sheet cape (12 wind frames x 6 colourways) on a real verlet cloth spine.
   Time-corrected single step per rendered frame (smooth at any refresh rate), few strips, pre-rasterised atlas,
   off-screen culling, no per-draw filters. ---- */
const CP=window.__CAPE,CM=CP.meta,CAT=new Image();let catOK=false,SRC=CAT;
CAT.onload=()=>{try{const w=CAT.naturalWidth,h=CAT.naturalHeight,cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(CAT,0,0);SRC=cv}catch(e){SRC=CAT}
 catOK=true};CAT.src=CP.img;
const CROW={A:[0,1,2,3],B:[3,4,5,0]},CS=KNT.CS={},NSEG=6,DS=K*1.06/CM.rs,NSTRIP=6,RS=CM.rs,QP=[],CLS=.68,CWS=.88;   /* cape length / width scale */
for(let i=0;i<NSTRIP;i++)QP[i]=Math.pow((i+.5)/NSTRIP,1.5);
const crow=ch=>(CROW[ch.s]||CROW.A)[ch.c|0]||0;
function capeState(p,v,len,a){let c=CS[p.id];const ax=v.x-Math.cos(a)*10.5,ay=v.y-Math.sin(a)*10.5;
 if(!c||Math.hypot(c.x[0]-ax,c.y[0]-ay)>220){c=CS[p.id]={x:[],y:[],px:[],py:[],t:0,fp:1,fs:0,rs:0,amp:2,ph:Math.random()*6.28,ph2:0,tt:Math.random()*50,hv:0,sp:0,rat:1};
  for(let i=0;i<=NSEG;i++){const d=i*len/NSEG;c.x[i]=c.px[i]=ax-Math.cos(a)*d;c.y[i]=c.py[i]=ay-Math.sin(a)*d}}
 return c}
function capeStep(c,v,a,len,now){
 const seg=len/NSEG,ca=Math.cos(a),sa=Math.sin(a),ax=v.x-ca*10.5,ay=v.y-sa*10.5;
 let dt=c.t?(now-c.t)/1000:1/60;c.t=now;if(!(dt>0))return;if(dt>.05)dt=.05;
 const sp=Math.hypot(v.x-(c.lx==null?v.x:c.lx),v.y-(c.ly==null?v.y:c.ly))/dt;c.lx=v.x;c.ly=v.y;c.sp+=(sp-c.sp)*Math.min(1,dt*15);
 /* fixed 120 Hz physics step (identical result at 30/60/90/144 fps); the collar anchor is interpolated across the sub-steps */
 const h=1/120,f=.5,damp=Math.pow(.975,f),sm=1-Math.pow(.73,f*dt*120);
 c.acc=(c.acc||0)+dt;let n=Math.min(4,Math.floor(c.acc/h));c.acc-=n*h;if(c.acc>h)c.acc=0;
 if(c.pax==null){c.pax=ax;c.pay=ay}
 const bx=c.pax,by=c.pay;c.pax=ax;c.pay=ay;
 for(let s=1;s<=n;s++){const tt=c.tt+=h,fq=s/n,ax=bx+(c.pax-bx)*fq,ay=by+(c.pay-by)*fq;
  const wx=Math.sin(tt*.63+c.ph)*.32+Math.sin(tt*1.7+c.ph*2)*.18,wy=Math.cos(tt*.51+c.ph*1.3)*.32+Math.sin(tt*2.3)*.14,
   ix=1/f;
  c.x[0]=c.px[0]=ax;c.y[0]=c.py[0]=ay;
  for(let i=1;i<=NSEG;i++){
   const fr=i/NSEG;let vx=(c.x[i]-c.px[i])*ix*damp,vy=(c.y[i]-c.py[i])*ix*damp;c.px[i]=c.x[i];c.py[i]=c.y[i];
   const dx=c.x[i]-c.x[i-1],dy=c.y[i]-c.y[i-1],d=Math.hypot(dx,dy)||1e-4,nx=-dy/d,ny=dx/d;
   /* aerodynamic drag on the cloth plate: resists velocity normal to the segment, relative to the wind */
   const rel=vx*nx+vy*ny-(wx*nx+wy*ny),cn=Math.min(.6,(.035+.13*fr)*f);vx-=nx*rel*cn;vy-=ny*rel*cn;
   /* drape: stiff at the collar, loose at the hem; turbulence grows with speed and toward the hem */
   const k=Math.min(.5,(.07*(1-fr)+.010)*f),fl=Math.sin(tt*10.5+i*.9+c.ph)*Math.min(c.sp,240)*.0006*fr*f;
   c.x[i]+=vx*f+(ax-ca*seg*i-c.x[i])*k+nx*fl;c.y[i]+=vy*f+(ay-sa*seg*i-c.y[i])*k+ny*fl}
  for(let it=0;it<4;it++){
   for(let i=1;i<=NSEG;i++){const dx=c.x[i]-c.x[i-1],dy=c.y[i]-c.y[i-1],d=Math.hypot(dx,dy)||1e-4,df=(d-seg)/d;
    if(i==1){c.x[i]-=dx*df;c.y[i]-=dy*df}else{c.x[i]-=dx*df*.5;c.y[i]-=dy*df*.5;c.x[i-1]+=dx*df*.5;c.y[i-1]+=dy*df*.5}}
   c.x[0]=ax;c.y[0]=ay}
  c.ph2+=(8+Math.min(c.sp,240)/28)*h}
 /* read the spine: hem vector in the knight's frame (u = backwards, l = to the cape's right) */
 const hx=c.x[NSEG]-c.x[0],hy=c.y[NSEG]-c.y[0],u=-(hx*ca+hy*sa),l=-hx*sa+hy*ca,ang=Math.atan2(l,Math.max(u,1e-3)),A=Math.abs(ang),sg=l<0?-1:1;
 let fq,res=0;
 if(A<=.5)fq=10*Math.tan(A)/.5463;else if(A<=1)fq=10+(A-.5)/.5;else{fq=11;res=A-1}
 c.fs+=(sg*fq-c.fs)*sm;c.rs+=(sg*Math.min(res,2.2)-c.rs)*sm;
 c.rat=Math.hypot(hx,hy)/len;
 c.hv=Math.hypot(c.x[NSEG]-c.px[NSEG],c.y[NSEG]-c.py[NSEG])/f;
 c.amp+=((1.2+Math.min(7,c.hv*4.5+c.sp/90))*RS-c.amp)*Math.min(1,dt*7);
}
function capeFrame(cx,row,fi,c){
 const sx=fi*CM.cw,sy=row*CM.ch,sh=CM.ch/NSTRIP;
 if(c.amp<.7){cx.drawImage(SRC,sx,sy,CM.cw,CM.ch,-CM.ax,-CM.ay,CM.cw,CM.ch);return}
 for(let i=0;i<NSTRIP;i++){const off=c.amp*QP[i]*Math.sin(c.ph2-(i+.5)/NSTRIP*5.5),y0=i*sh,h=Math.min(sh+1,CM.ch-y0);
  cx.drawImage(SRC,sx,sy+y0,CM.cw,h,-CM.ax+off,-CM.ay+y0,CM.cw,h)}}
function capeDraw(cx,p,v,ch,now,a,hf){
 if(!catOK)return;
 const row=crow(ch),Lw=CM.frames[row][0][0]*DS*CLS,m=cx.getTransform(),r=(Lw+60)*Math.hypot(m.a,m.b),W=cx.canvas.width,H=cx.canvas.height;
 if(m.e<-r||m.f<-r||m.e>W+r||m.f>H+r){const o=CS[p.id];if(o)o.t=0;return}   /* off-screen: skip physics + drawing */
 const c=capeState(p,v,Lw,a);
 capeStep(c,v,a,Lw,now);
 const F=Math.min(11,Math.abs(c.fs)),sg=c.fs<0?-1:1,f0=Math.min(11,Math.floor(F)),f1=Math.min(11,f0+1),t=F-f0,
  sy=1+Math.max(-.25,Math.min(.08,(c.rat-.93)*.6));
 cx.save();cx.translate(-v.x,-v.y);
 cx.translate(v.x-Math.cos(a)*10.5,v.y-Math.sin(a)*10.5);cx.rotate(a+Math.PI/2);cx.rotate(-c.rs);cx.scale(sg*DS*CWS,DS*CLS*sy);
 capeFrame(cx,row,f0,c);
 if(t>.06&&f1!==f0){cx.globalAlpha=t;capeFrame(cx,row,f1,c)}
 cx.restore()}
KNT.capePhys=true;
KNT.draw=function(cx,p,v,now,R,myId,TIP){
 const ch=KNT.pick(p,myId),mv=Math.min(1,Math.hypot(p.vx,p.vy)/180),rc=(v.rc||0)*5,hf=v.hf>0;
 cx.save();cx.translate(v.x,v.y);
 cx.fillStyle='#0007';cx.beginPath();cx.ellipse(4,8,R*1.05,R*.85,0,0,6.28);cx.fill();
 
 if(KNT.cape&&KNT.capePhys)capeDraw(cx,p,v,ch,now,v.a,hf);
 cx.rotate(v.a);
 if(p.sp>0){cx.strokeStyle='#ffd24a99';cx.lineWidth=2;for(let i=0;i<3;i++){cx.beginPath();cx.moveTo(-R-10-i*7,-8+i*8);cx.lineTo(-R-24-i*7,-8+i*8);cx.stroke()}}
 cx.save();cx.rotate(-Math.PI/2);cx.scale(K,K);
 if(hf){try{cx.filter='brightness(3) saturate(0)'}catch(e){}}
 layers(cx,ch,{mv,ph:v.ph,rcl:rc/K,w:p.w,nocape:KNT.capePhys});
 if(hf)cx.filter='none';cx.restore();
 if(v.fl>0){const t=R-4-rc+TIP[p.w];cx.fillStyle='#ffb02e';cx.beginPath();cx.moveTo(t,-9);cx.lineTo(t+22,0);cx.lineTo(t,9);cx.closePath();cx.fill();cx.fillStyle='#fff6c8';cx.beginPath();cx.arc(t+2,0,6,0,6.28);cx.fill()}
 if(p.sh>0){cx.rotate(-v.a);cx.fillStyle='#59b8ff22';cx.beginPath();cx.arc(0,0,R+7,0,6.28);cx.fill();cx.strokeStyle='#59b8ffdd';cx.lineWidth=3;cx.beginPath();cx.arc(0,0,R+7,0,6.28*p.sh/50);cx.stroke();cx.rotate(v.a)}
 cx.restore()};
/* KNT.ready flips to true once every knight sprite has decoded (see sprDone); until then game.js draws its original character. */
if(pend===0)KNT.ready=true;
})();
