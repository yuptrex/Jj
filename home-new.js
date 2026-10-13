(function(){
var $=function(i){return document.getElementById(i)},mode='room';
function sel(m){mode=m;$('mroom').classList.toggle('sel',m==='room');$('msolo').classList.toggle('sel',m==='solo')}
sel('solo');
/* press ripple + haptic on every home button */
document.querySelector('.hs').addEventListener('pointerdown',function(e){
 var b=e.target.closest&&e.target.closest('.hb');if(!b)return;
 var r=b.getBoundingClientRect(),w=document.createElement('span');w.className='rip';
 var s=document.createElement('b');s.style.left=(e.clientX-r.left)/r.width*100+'%';s.style.top=(e.clientY-r.top)/r.height*100+'%';
 w.appendChild(s);b.appendChild(w);setTimeout(function(){w.remove()},600);
 try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}});
$('mroom').onclick=function(){sel('room')};
$('msolo').onclick=function(){sel('solo')};
/* START */
function openPop(){$('pmain').hidden=false;$('pcode').hidden=true;$('pop').hidden=false}
$('mstart').onclick=function(){if(mode==='solo')$('solo').click();else openPop()};
function closePop(){$('pop').hidden=true}
$('pclose').onclick=closePop;
$('pop').addEventListener('pointerdown',function(e){if(e.target===$('pop'))closePop()});
$('pcreate').onclick=function(){closePop();$('host').click()};
$('pjoin').onclick=function(){$('pmain').hidden=true;$('pcode').hidden=false;setTimeout(function(){$('rm').focus()},50)};
$('pback').onclick=function(){$('pmain').hidden=false;$('pcode').hidden=true};
$('pgo').onclick=function(){var r=$('rm');if(r.value.length<5){r.classList.remove('bad');void r.offsetWidth;r.classList.add('bad');r.focus();return}closePop();$('join').click()};
$('rm').addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();$('pgo').click()}if(e.key==='Escape')closePop()},true);
/* profile: tap avatar to sign in with Google (when signed out) */
$('pav').onclick=function(){if($('acc').dataset.s==='guest')$('acbtn').click()};
function photo(){var a=window.ARA&&ARA.account&&ARA.account(),ph=document.querySelector('#pav .ph'),acc=$('acc');
 if(a&&a.photo){ph.style.backgroundImage='url("'+a.photo+'")';acc.dataset.photo='1'}else acc.dataset.photo='0'}
var mo=new MutationObserver(photo);mo.observe($('acc'),{attributes:true,attributeFilter:['data-s']});mo.observe($('acn'),{childList:true,characterData:true,subtree:true});
var nm=$('nm'),nv=$('nmv'),nt=$('nmt'),last=null;
function name(){var v=(nm.value||'').trim()||'Player';if(v===last)return;last=v;nt.textContent=v;nv.classList.remove('mq');
 requestAnimationFrame(function(){var o=nt.offsetWidth-nv.clientWidth;if(o>2){nv.style.setProperty('--s',-(o+8)+'px');nv.style.setProperty('--d',Math.max(4,o/25)+'s');nv.classList.add('mq')}})}
setInterval(function(){photo();name()},500);photo();name();
})();
