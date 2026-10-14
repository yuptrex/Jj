/* adaptive resolution: if frames run slower than the screen's refresh rate, drop render scale a little (never below 75%), and creep back up when there is headroom */
(function(){let ema=1/60,ref=1/50,slow=0,fast=0,lastCh=0,hold=10,lastUp=-1e9,MIN=window.CSK_LOWDEV?.6:.75;
window.AQ=function(dt,now){if(!(dt>0)||dt>.25||document.hidden)return;
 ema+=(dt-ema)*.06;if(ema<ref)ref=Math.max(1/165,ema);else ref+=(ema-ref)*.0002;
 if(ema>ref*1.22){slow+=dt;fast=0}else if(ema<ref*1.07){fast+=dt;slow=Math.max(0,slow-dt)}else{slow=Math.max(0,slow-dt*.5);fast=Math.max(0,fast-dt*.5)}
 if(slow>(window.CSK_LOWDEV?.8:1.2)&&rScale>MIN+.001&&now-lastCh>2000){if(now-lastUp<5000)hold=Math.min(80,hold*2);rScale=Math.max(MIN,rScale-.125);lastCh=now;slow=0;rs()}
 else if(fast>hold&&rScale<.999&&now-lastCh>2000){rScale=Math.min(1,rScale+.125);lastCh=now;lastUp=now;fast=0;rs()}}})();
