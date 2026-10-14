/* Settings > RANK: leaderboard of coins collected. Reads leaderboard/<uid> {n,p,cn,t} through ARA.leaderboard(). */
(function(){
var st=document.getElementById('st'),L=document.getElementById('rk-l'),ME=document.getElementById('rk-me'),busy=0;
if(!st||!L)return;
function coins(){try{return window.AR_ST.get().cn||0}catch(e){return 0}}
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function av(p,n){var c=(n||'?').trim().charAt(0).toUpperCase()||'?';
 return p?'<span class="rk-a"><img src="'+p.replace(/"/g,'&quot;')+'" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><i>'+esc(c)+'</i></span>':'<span class="rk-a"><i>'+esc(c)+'</i></span>'}
function row(r,n,p,name,cn,me){var b=n>0&&n<4?' t'+n:'';
 return '<div class="rk-r'+(me?' me':'')+'"><b class="rk-n'+b+'">'+(n>0?'#'+n:'\u2013')+'</b><div class="rk-p">'+av(p,name)+'<em>'+esc(name)+(me?' <small>YOU</small>':'')+'</em></div><span class="rk-c2"><i></i>'+(+cn||0).toLocaleString()+'</span></div>'}
function msg(t){L.innerHTML='<div class="rk-m">'+t+'</div>';ME.innerHTML=''}
function load(){
 if(busy)return;
 var A=window.ARA;
 if(!A||!A.hint()){msg('Sign in with Google to join the ranking.');return}
 busy=1;msg('Loading ranking\u2026');
 var to=new Promise(function(r){setTimeout(r,2500)});
 Promise.race([Promise.resolve(A.flush()).catch(function(){}),to]).then(function(){return A.leaderboard()}).then(function(list){
  busy=0;var uid=A.uid(),me=A.account()||{},mine=coins(),rank=0,top=[],last=-1,pos=0;
  list=list.filter(function(x){return x.uid===uid||x.cn>0});
  list.forEach(function(x,i){if(x.uid===uid&&mine>x.cn)x.cn=mine;});
  list.sort(function(a,b){return b.cn-a.cn});
  list.forEach(function(x,i){if(x.cn!==last){pos=i+1;last=x.cn}x.r=pos;if(x.uid===uid)rank=pos});
  L.innerHTML=list.length?list.map(function(x){return row(x,x.cn>0?x.r:0,x.photo,x.name,x.cn,x.uid===uid)}).join(''):'<div class="rk-m">No players ranked yet. Collect coins to be first!</div>';
  var self=L.querySelector('.me');if(self)self.scrollIntoView({block:'nearest'});
  var shown=rank&&mine>0?'#'+rank:(mine>0?'#100+':'\u2013');
  ME.innerHTML='<div class="rk-r me"><b class="rk-n">'+shown+'</b><div class="rk-p">'+av(me.photo,me.name)+'<em>'+esc(me.name||'Player')+' <small>YOUR RANK</small></em></div><span class="rk-c2"><i></i>'+mine.toLocaleString()+'</span></div>';
 }).catch(function(e){busy=0;var d=e&&(String(e.code||'')+String(e.message||'')).toUpperCase().indexOf('PERMISSION')>=0;
  msg(d?'Ranking is not enabled yet (database rules for <b>leaderboard</b>).':'Could not load the ranking. Check your connection and try again.')})}
st.addEventListener('click',function(e){var b=e.target.closest('[data-t]');if(b&&b.dataset.t==='r')load()});
})();
