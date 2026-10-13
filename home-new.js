(function(){
var $=function(i){return document.getElementById(i)},mode='room';
function sel(m){mode=m;$('mroom').classList.toggle('sel',m==='room');$('msolo').classList.toggle('sel',m==='solo')}
sel('solo');
/* press ripple + haptic on every home button, and on the room-card / settings-tab buttons */
function ripple(b,e){
 var r=b.getBoundingClientRect(),w=document.createElement('span');w.className='rip';
 var x=(e.clientX!=null?e.clientX:r.left+r.width/2),y=(e.clientY!=null?e.clientY:r.top+r.height/2);
 var s=document.createElement('b');s.style.left=(x-r.left)/r.width*100+'%';s.style.top=(y-r.top)/r.height*100+'%';
 w.appendChild(s);b.appendChild(w);setTimeout(function(){w.remove()},600);
 try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}}
document.querySelector('.hs').addEventListener('pointerdown',function(e){
 var b=e.target.closest&&e.target.closest('.hb');if(!b)return;ripple(b,e)});
document.addEventListener('pointerdown',function(e){
 var b=e.target.closest&&e.target.closest('#pop .pb,#pop .px,#st .st-tab');if(!b)return;ripple(b,e)});
/* settings dialog: GENERAL / KEYBOARD tabs */
(function(){
 var tabs=document.querySelectorAll('#st .st-tab');
 function showTab(name){
  tabs.forEach(function(t){var on=t.dataset.tab===name;t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false')});
  document.querySelectorAll('#st .st-grid[data-tab]').forEach(function(g){g.hidden=g.dataset.tab!==name});
 }
 tabs.forEach(function(t){t.onclick=function(){showTab(t.dataset.tab)}});
 showTab('general');
})();
$('mroom').onclick=function(){sel('room')};
$('msolo').onclick=function(){sel('solo')};
/* START — room popup now shows CREATE ROOM and JOIN ROOM side by side at once */
function openPop(){$('pop').hidden=false}
$('mstart').onclick=function(){if(mode==='solo')$('solo').click();else openPop()};
function closePop(){$('pop').hidden=true}
$('pclose').onclick=closePop;
$('pop').addEventListener('pointerdown',function(e){if(e.target===$('pop'))closePop()});
$('pcreate').onclick=function(){closePop();$('host').click()};
$('pgo').onclick=function(){var r=$('rm');if(r.value.length<5){r.classList.remove('bad');void r.offsetWidth;r.classList.add('bad');r.focus();return}closePop();$('join').click()};
$('rm').addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();$('pgo').click()}if(e.key==='Escape')closePop()},true);
addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('pop').hidden)closePop()},true);
/* profile: tap avatar to sign in with Google (when signed out) */
$('pav').onclick=function(){if($('acc').dataset.s==='guest')$('acbtn').click()};
var phImg=document.querySelector('#pav .pho img'),phSrc='',phOrig='';
/* Google gives a tiny 96px avatar (...=s96-c); ask for a sharper square crop so it stays crisp when scaled up */
function hi(u){u=String(u||'');if(/googleusercontent\.com/.test(u))return u.replace(/=s\d+(-c)?(?=$|[?#])/,'=s256-c').replace(/([?&])sz=\d+/,'$1sz=256');return u}
phImg.addEventListener('error',function(){if(phOrig&&phOrig!==phSrc&&phImg.dataset.fb!=='1'){phImg.dataset.fb='1';phImg.src=phOrig;return}$('acc').dataset.photo='0'});
phImg.addEventListener('load',function(){if(phImg.naturalWidth>0)$('acc').dataset.photo='1'});
function photo(){var a=window.ARA&&ARA.account&&ARA.account(),u=a&&a.photo?hi(a.photo):'',acc=$('acc');
 if(!u){phSrc=phOrig='';if(phImg.getAttribute('src'))phImg.removeAttribute('src');acc.dataset.photo='0';return}
 if(u!==phSrc){phSrc=u;phOrig=a.photo;phImg.dataset.fb='';phImg.src=u}
 if(phImg.complete&&phImg.naturalWidth>0)acc.dataset.photo='1'}
var mo=new MutationObserver(photo);mo.observe($('acc'),{attributes:true,attributeFilter:['data-s']});mo.observe($('acn'),{childList:true,characterData:true,subtree:true});
var nm=$('nm'),nv=$('nmv'),nt=$('nmt'),last=null;
function name(){var v=(nm.value||'').trim()||'Player';if(v===last)return;last=v;nt.textContent=v;nv.classList.remove('mq');
 requestAnimationFrame(function(){var o=nt.offsetWidth-nv.clientWidth;if(o>2){nv.style.setProperty('--s',-(o+8)+'px');nv.style.setProperty('--d',Math.max(4,o/25)+'s');nv.classList.add('mq')}})}
setInterval(function(){photo();name()},500);photo();name();
})();
