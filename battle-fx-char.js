/* ==========================================================================
   battle-fx-char.js  -  High-fidelity knight renderer (BFX.char)
   Additive, draw-only extension of battle-fx.js. Reads the same p/v state
   drawChar() in game.js already reads (p.hue, p.vx, p.vy, p.w, p.ul, p.sh,
   p.sp, v.x, v.y, v.a, v.ph, v.rc, v.hf, v.fl) and paints a richer knight
   in its place: layered gradient-shaded armor, rim lighting, a cloth-sim
   cape, a glowing visor, animated joint/rank lighting, soft contact shadow
   and ambient occlusion, and weapon-tier glow. It never reads or writes
   any gameplay/network state and never changes hitbox size (still R).
   game.js calls BFX.char(p,v,now) only when the High-fidelity battlefield
   layer (bf) is active, and falls back to the original drawChar() if this
   throws or isn't present - see render() in game.js.
   ========================================================================== */
(function(){
'use strict';
const TAU=6.2832;
const gfx=()=>window.GFXQ==null?2:window.GFXQ;           // 0 Low / 1 Medium / 2 High
const RICH=()=>gfx()>=2;                                  // extra plating/cape detail: High only
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

function rr(x,y,w,h,r){cx.beginPath();cx.roundRect(x,y,w,h,r)}

/* soft multi-stop metal gradient along a shape's own bounding box */
function metal(pts,top,mid,bot){
 let a=1e9,b=-1e9;for(const p of pts){a=Math.min(a,p[1]);b=Math.max(b,p[1])}
 const g=cx.createLinearGradient(0,a,0,b);
 g.addColorStop(0,top);g.addColorStop(.55,mid);g.addColorStop(1,bot);
 cx.beginPath();pts.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1]));cx.closePath();
 cx.fillStyle=g;cx.fill();cx.lineWidth=1.2;cx.strokeStyle='#05070a';cx.lineJoin='round';cx.stroke()}

function charShape(id,R){
 let s=CACHE.get(id);if(s)return s;
 s={};CACHE.set(id,s);return s}
const CACHE=new Map();

function drawChar(p,v,now){
 const H=p.hue,R18=(typeof R==='number')?R:18,
  c=`hsl(${H} 78% 50%)`,cd=`hsl(${H} 62% 28%)`,cL=`hsl(${H} 92% 74%)`,cHi=`hsl(${H} 100% 86%)`,
  hf=v.hf>0,Wt='#fff',K=a=>hf?Wt:a,
  sw=Math.sin(v.ph||0),mv=Math.min(1,Math.hypot(p.vx,p.vy)/180),rc=(v.rc||0)*5,
  br=Math.sin(now/380+H)*.7,hb=Math.sin(now/300+H)*.7*(1-mv),rich=RICH();

 cx.save();cx.translate(v.x,v.y);

 /* grounded AO: a soft double-layer contact shadow instead of one flat blob */
 cx.fillStyle='#00000055';cx.beginPath();cx.ellipse(4,9,R18*1.15,R18*.9,0,0,TAU);cx.fill();
 cx.fillStyle='#00000030';cx.beginPath();cx.ellipse(4,8,R18*1.5,R18*1.05,0,0,TAU);cx.fill();

 if(p.id==myId){cx.strokeStyle='#fff8';cx.lineWidth=2;cx.setLineDash([6,6]);cx.lineDashOffset=-now/50;cx.beginPath();cx.arc(0,0,R18+10,0,TAU);cx.stroke();cx.setLineDash([])}

 cx.rotate(v.a);

 /* ---- cape/scarf: wider, layered cloth with an inner highlight strip ---- */
 const SL=15+mv*20,segs=6;
 cx.lineCap='round';cx.lineJoin='round';
 cx.strokeStyle=K(cd);cx.lineWidth=7.5;cx.beginPath();cx.moveTo(-4,0);
 for(let i=1;i<=segs;i++){const t=i/segs;cx.lineTo(-4-t*SL*1.15,Math.sin(now/110+i*1.15+H)*(1.6+mv*4.4)*t*1.15)}
 cx.stroke();
 cx.strokeStyle=K(cL);cx.lineWidth=4.5;cx.beginPath();cx.moveTo(-4,0);
 for(let i=1;i<=segs;i++){const t=i/segs;cx.lineTo(-4-t*SL,Math.sin(now/110+i*1.2+H)*(1.5+mv*4)*t)}
 cx.stroke();
 if(rich){cx.strokeStyle=K(cHi)+'99';cx.lineWidth=1.4;cx.beginPath();cx.moveTo(-4,0);
  for(let i=1;i<=segs;i++){const t=i/segs;cx.lineTo(-4-t*SL*.9,Math.sin(now/110+i*1.2+H)*(1.3+mv*3.5)*t)}cx.stroke()}

 /* ---- legs: gradient-shaded thighs, knee pads, segmented armored boots ---- */
 for(const q of[-1,1]){const lx=-2+q*sw*8*mv;
  metal([[lx-4,q*2.5],[lx+9,q*2.5],[lx+10,q*10],[lx-5,q*10]],K(`hsl(${H} 55% 42%)`),K(cd),'#0e1116');
  cx.fillStyle='#10151b';cx.beginPath();cx.ellipse(lx+6,q*7,7.6,4.9,0,0,TAU);cx.fill();
  cx.fillStyle='#232d37';cx.beginPath();cx.ellipse(lx+9.5,q*7,3.3,3.5,0,0,TAU);cx.fill();
  cx.fillStyle='#000a';cx.beginPath();cx.ellipse(lx+6,q*8.6,6.8,2,0,0,TAU);cx.fill();
  cx.fillStyle=K(cL);cx.beginPath();cx.arc(lx+2,q*6.5,2.4,0,TAU);cx.fill();
  if(rich){cx.fillStyle='#ffffff30';cx.beginPath();cx.ellipse(lx+4,q*5.3,1.6,.9,.3,0,TAU);cx.fill()}
  cx.strokeStyle='#000a';cx.lineWidth=1.2;cx.beginPath();cx.ellipse(lx+6,q*7,7.6,4.9,0,0,TAU);cx.stroke()}

 /* ---- backpack: layered plates, fuel cell glow, antenna ---- */
 metal([[-R18-5,-10],[-R18+6,-10],[-R18+6,9],[-R18-5,9]],K(`hsl(${H} 50% 38%)`),K(cd),'#0b0d11');
 cx.fillStyle='#0007';cx.fillRect(-R18-1,-9,2,18);
 cx.fillStyle=`hsl(${H} 100% 70%)`;cx.globalAlpha=.55+.35*Math.sin(now/220+H);cx.fillRect(-R18-4,-2.5,2.4,5);cx.globalAlpha=1;
 cx.fillStyle='#2a343e';rr(-R18-6,-12,7,4,2);cx.fill();rr(-R18-6,8,7,4,2);cx.fill();
 cx.strokeStyle='#9fb2c0';cx.lineWidth=1.3;cx.beginPath();cx.moveTo(-R18-3,6);cx.lineTo(-R18-13,11);cx.stroke();
 cx.fillStyle=(now/400|0)%2?'#ff4a3a':'#5a1a14';cx.beginPath();cx.arc(-R18-13,11,1.7,0,TAU);cx.fill();

 /* ---- torso: gradient-shaded chest plate, rig, belt, pouches, insignia ---- */
 {const pts=[];for(let i=0;i<=16;i++){const a=i/16*TAU;pts.push([Math.cos(a)*R18*.78,Math.sin(a)*(R18+br)])}
  metal(pts,K(cHi),K(c),K(cd))}
 cx.strokeStyle='#18202a';cx.lineWidth=3;cx.beginPath();cx.ellipse(-6,0,R18*.45,R18*.8,0,-1.5,1.5);cx.stroke();
 cx.fillStyle='#ffc83a';cx.fillRect(-3,-2,3,4);
 cx.fillStyle='#2a343e';for(const q of[-1,1]){rr(-10,q*(R18-5)-3,7,6,2);cx.fill()}
 cx.fillStyle='#4a5a2a';cx.beginPath();cx.arc(-8,-R18+7,2.6,0,TAU);cx.fill();
 {const pts=[];for(let i=0;i<=12;i++){const a=i/12*TAU;pts.push([2+Math.cos(a)*R18*.4,Math.sin(a)*R18*.62])}
  metal(pts,K(cL),K(cd),'#0b0d11')}
 cx.fillStyle=cL;cx.fillRect(1,-1.5,7,3);
 cx.fillStyle='#232c35';for(let i=0;i<3;i++)cx.fillRect(8,-6+i*4.5,3.2,3);
 cx.fillStyle='#0004';cx.fillRect(-6,-R18*.6,2,R18*1.2);
 if(rich){cx.fillStyle='#ffffff22';cx.beginPath();cx.ellipse(-4,-R18*.4,R18*.26,R18*.4,-.3,0,TAU);cx.fill()}

 /* ---- arms: shaded limbs, shoulder pads with charge-tier rank glow, gloves ---- */
 cx.strokeStyle=K(cd);cx.lineWidth=6.5;cx.lineCap='round';
 cx.beginPath();cx.moveTo(2,-R18*.88);cx.lineTo(R18+3-rc,-3);cx.moveTo(2,R18*.88);cx.lineTo(R18+13-rc,2);cx.stroke();
 cx.strokeStyle=K(cL)+'55';cx.lineWidth=2;
 cx.beginPath();cx.moveTo(2,-R18*.88);cx.lineTo(R18+3-rc,-3);cx.moveTo(2,R18*.88);cx.lineTo(R18+13-rc,2);cx.stroke();
 const tl=(p.ul||[0]).reduce((a,b)=>a+b,0);
 for(const q of[-1,1]){
  const g=cx.createRadialGradient(1,q*R18*.9,0,2,q*R18*.9,7);g.addColorStop(0,K(cHi));g.addColorStop(1,K(cL));
  cx.fillStyle=g;cx.beginPath();cx.arc(2,q*R18*.9,6.3,0,TAU);cx.fill();
  cx.strokeStyle='#0009';cx.lineWidth=1.5;cx.stroke();
  cx.fillStyle=K(cd);cx.fillRect(-1,q*R18*.9-1,6,2);
  if(tl>=4){cx.fillStyle='#ffc83a';cx.globalAlpha=.6+.4*Math.sin(now/160+q);cx.beginPath();cx.arc(2,q*R18*.9,3.1,0,TAU);cx.fill();cx.globalAlpha=1;
   cx.fillStyle='#fff6d0';cx.beginPath();cx.arc(2,q*R18*.9,1.6,0,TAU);cx.fill()}}

 if(typeof weapon==='function')weapon(p.w,-rc,p.ul);
 cx.fillStyle='#232c35';for(const[x,y]of[[R18+3-rc,-3],[R18+13-rc,2]]){cx.beginPath();cx.arc(x,y,4,0,TAU);cx.fill();cx.strokeStyle='#0009';cx.lineWidth=1;cx.stroke()}

 if(v.fl>0 && typeof TIP==='object'){
  const t=R18-4-rc+(TIP[p.w]||20);
  const fg=cx.createRadialGradient(t+4,0,0,t+4,0,24);fg.addColorStop(0,'#fff8d8');fg.addColorStop(.4,'#ffd24a');fg.addColorStop(1,'#ffb02e00');
  cx.fillStyle=fg;cx.beginPath();cx.moveTo(t,-11);cx.lineTo(t+26,0);cx.lineTo(t,11);cx.closePath();cx.fill();
  cx.fillStyle='#fff';cx.beginPath();cx.arc(t+2,0,6.5,0,TAU);cx.fill()}

 /* ---- helmet: gradient shell, glowing visor with scanline, antenna, ear cups ---- */
 cx.save();cx.translate(0,hb*.5);
 cx.fillStyle='#1d2630';for(const q of[-1,1]){cx.beginPath();cx.arc(2,q*10,3.4,0,TAU);cx.fill()}
 cx.strokeStyle='#9fb2c0';cx.lineWidth=1.2;cx.beginPath();cx.moveTo(2,9.5);cx.quadraticCurveTo(7,9,9,5);cx.stroke();
 cx.fillStyle='#9fb2c0';cx.beginPath();cx.arc(9,5,1.4,0,TAU);cx.fill();

 const hg=cx.createRadialGradient(-2,-4,1,3,2,13);
 hg.addColorStop(0,K(`hsl(${H} 85% 58%)`));hg.addColorStop(.6,K(`hsl(${H} 75% 44%)`));hg.addColorStop(1,K(`hsl(${H} 65% 30%)`));
 cx.fillStyle=hg;cx.beginPath();cx.arc(3,0,10.3,0,TAU);cx.fill();cx.strokeStyle='#000c';cx.lineWidth=2;cx.stroke();
 cx.fillStyle=K(`hsl(${H} 70% 34%)`);for(const[x,y,r]of[[-2,4,2.4],[1,-5,2],[-3,-3,1.6],[5,6,1.6]]){cx.beginPath();cx.arc(x,y,r,0,TAU);cx.fill()}
 cx.strokeStyle='#0007';cx.lineWidth=1.2;cx.beginPath();for(const y of[-3,0,3]){cx.moveTo(-6,y);cx.lineTo(-1,y)}cx.stroke();

 cx.fillStyle='#0e1d28';cx.beginPath();cx.ellipse(8,0,3.8,6.4,0,0,TAU);cx.fill();
 const vg=cx.createLinearGradient(5,-6,11,6);
 vg.addColorStop(0,`rgba(127,232,255,${.85+.15*Math.sin(now/260)})`);vg.addColorStop(1,`rgba(70,160,255,${.4+.2*Math.sin(now/260)})`);
 cx.fillStyle=vg;cx.fillRect(6.6,-5,2.2,10);
 cx.fillStyle=`rgba(255,255,255,${.5+.5*Math.sin(now/180)})`;cx.fillRect(7,-4.5+((now/90)%10)-5,3,1);

 cx.fillStyle='#fff4';cx.beginPath();cx.ellipse(0,-3.5,5.2,2.5,-.5,0,TAU);cx.fill();
 cx.fillStyle=K(cd);cx.fillRect(-5,-1,4,2);
 cx.restore();

 if(p.sh>0){cx.rotate(-v.a);
  const sg=cx.createRadialGradient(0,0,R18*.6,0,0,R18+9);sg.addColorStop(0,'#59b8ff00');sg.addColorStop(1,'#59b8ff2e');
  cx.fillStyle=sg;cx.beginPath();cx.arc(0,0,R18+9,0,TAU);cx.fill();
  cx.strokeStyle='#59b8ffee';cx.lineWidth=3;cx.beginPath();cx.arc(0,0,R18+9,0,TAU*p.sh/50);cx.stroke();
  cx.rotate(v.a)}
 if(p.sp>0){cx.strokeStyle='#ffd24aaa';cx.lineWidth=2;for(let i=0;i<3;i++){cx.beginPath();cx.moveTo(-R18-10-i*7,-8+i*8);cx.lineTo(-R18-26-i*7,-8+i*8);cx.stroke()}}
 cx.restore()}

window.BFX=window.BFX||{};
window.BFX.char=drawChar;
})();
