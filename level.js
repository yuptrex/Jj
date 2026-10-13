/* Player level: XP = coins collected + 30 per knight killed. Level L -> L+1 costs 100 + 50*(L-1) XP (cap 50).
   Reads the same stats object the profile uses (AR_ST), shows level + progress bar on the home screen,
   and pops a LEVEL UP banner when you level up during a match. */
(function(){
  var KILL_XP=30,MAXL=50,box=document.querySelector('.hs .lvl');if(!box)return;
  box.title='';box.innerHTML='<i class="lvf"></i><span class="lvt">LV 1</span>';
  var f=box.querySelector('.lvf'),t=box.querySelector('.lvt'),base=null,menu=document.getElementById('menu');
  function calc(xp){var L=1,need=100;while(L<MAXL&&xp>=need){xp-=need;L++;need=100+50*(L-1)}
    return {L:L,cur:L>=MAXL?need:xp,need:need}}
  function tick(){
    var s;try{s=window.AR_ST&&AR_ST.get()}catch(e){}if(!s)return;
    var xp=(+s.cn||0)+(+s.k||0)*KILL_XP,r=calc(xp);
    f.style.width=(r.L>=MAXL?100:Math.min(100,r.cur/r.need*100))+'%';
    t.textContent='LV '+r.L+(r.L>=MAXL?' MAX':'  '+r.cur+'/'+r.need);
    var inMatch=menu&&menu.offsetParent===null;
    if(base!==null&&r.L>base&&inMatch){try{cast('LEVEL UP','You reached level '+r.L,45,1)}catch(e){}}
    if(base===null||!inMatch||r.L<base)base=r.L; else if(r.L>base)base=r.L;
  }
  setInterval(tick,400);tick();
})();
