/* Theme background music. Plays on every screen (login, home, lobby, settings, victory)
   and stays silent on the battle ground. Respects the game's SOUND ON/OFF toggle. */
(function(){
'use strict';
var a=new Audio('theme-music.mp3');a.loop=true;a.preload='auto';a.volume=0;
var MAXV=.5,FADE=700,vol=0,last=0,unlocked=false;
function $(i){return document.getElementById(i)}
function inBattle(){
 var m=$('menu');
 if(!m||m.style.display!=='none')return false;      /* menu still showing = not in a match */
 var v=$('vs');if(v&&v.classList.contains('on'))return false;   /* results screen = music again */
 return true}
function muted(){try{return typeof mute!=='undefined'&&!!mute}catch(e){return false}}
function want(){return unlocked&&!document.hidden&&!inBattle()&&!muted()}
function tick(t){
 var dt=Math.min(100,t-(last||t));last=t;
 var target=want()?MAXV:0;
 if(vol<target)vol=Math.min(target,vol+MAXV*dt/FADE);
 else if(vol>target)vol=Math.max(target,vol-MAXV*dt/(FADE/2));
 try{a.volume=vol}catch(e){}
 if(vol>0&&a.paused){var p=a.play();if(p&&p.catch)p.catch(function(){})}
 else if(vol===0&&!a.paused&&target===0)a.pause();
 requestAnimationFrame(tick)}
function unlock(){
 if(unlocked)return;unlocked=true;
 ['pointerdown','keydown','touchend','click'].forEach(function(e){removeEventListener(e,unlock,true)})}
['pointerdown','keydown','touchend','click'].forEach(function(e){addEventListener(e,unlock,true)});
document.addEventListener('visibilitychange',function(){if(document.hidden)a.pause()});
window.CSKMusic={el:a,setMax:function(v){MAXV=Math.max(0,Math.min(1,v))}};
requestAnimationFrame(tick)})();
