/* ============ LOCAL ASSET CACHE ============
   Caches the big static images (loading/home/lobby/victory backgrounds) in IndexedDB as blobs.
   First visit: fetch over network, report progress, store in IDB. Later visits: read straight
   from IDB (no network), so the splash + every screen render instantly.
   Exposes window.CSKAssets.preload(onProgress) -> Promise, resolved once all are ready; each
   asset's <img src> is swapped to a local blob: URL as soon as it's available. */
(function(){
'use strict';
var ASSETS=['loading-bg.jpg','home-art.jpg','lobby-bg.jpg','victory-bg.png'];
var DB='csk-assets',STORE='files',VER=1;
function openDB(){return new Promise(function(res,rej){
 var r=indexedDB.open(DB,VER);
 r.onupgradeneeded=function(){r.result.createObjectStore(STORE)};
 r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function idbGet(db,key){return new Promise(function(res){
 var tx=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
 tx.onsuccess=function(){res(tx.result||null)};tx.onerror=function(){res(null)}})}
function idbSet(db,key,blob){return new Promise(function(res){
 var tx=db.transaction(STORE,'readwrite').objectStore(STORE).put(blob,key);
 tx.onsuccess=function(){res(1)};tx.onerror=function(){res(0)}})}
function applySrc(name,url){
 var els=document.querySelectorAll('img[src="'+name+'"]');
 for(var i=0;i<els.length;i++)els[i].src=url}

window.CSKAssets={
 preload:function(onProgress){
  var done=0,total=ASSETS.length;
  function tick(){done++;onProgress&&onProgress(done,total)}
  var dbP;
  try{dbP=openDB()}catch(e){dbP=Promise.reject(e)}
  return dbP.then(function(db){
   return Promise.all(ASSETS.map(function(name){
    return idbGet(db,name).then(function(blob){
     if(blob){applySrc(name,URL.createObjectURL(blob));tick();return}
     return fetch(name).then(function(r){return r.blob()}).then(function(blob){
      applySrc(name,URL.createObjectURL(blob));
      idbSet(db,name,blob);tick()
     }).catch(function(){tick()})})}))
  },function(){
   /* IndexedDB unavailable (private mode etc.) — just let the <img> tags load normally */
   return Promise.all(ASSETS.map(function(){return new Promise(function(r){setTimeout(function(){tick();r()},0)})}))
  })}
};
})();
