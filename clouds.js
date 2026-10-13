/* Home screen: drifting clouds (overlay canvas; home-art2.jpg untouched).
   'sp' clouds (open sky): the cloud is lifted off a rebuilt clean-sky plate as a residual layer and glides sideways
   as a rigid shape - no stretching. 'wp' clouds (partly behind scenery): rigid inside a feathered region that
   fades to zero at the edges, so castle/trees/UI never move. */
(function(){
  var bg=document.querySelector('.hs-bg'); if(!bg) return;
  var C=[
   {k:'sp',p:[1040,4,1418,4,1418,112,1214,112,1214,97,1134,97,1134,112,1040,112],PL:1044,PR:1416,c:-70,a:70,T:34,f:0,r:5},
   {k:'sp',p:[735,82,1010,82,1010,172,735,172],PL:738,PR:1006,c:42,a:62,T:28,f:2,r:5},
   {k:'wp',p:[1315,232,1340,208,1380,200,1410,215,1405,240,1370,252,1330,250],c:0,a:10,T:19,f:2.4,r:4},
   {k:'wp',p:[1445,200,1470,170,1500,155,1545,150,1575,160,1570,185,1545,200,1500,206],c:0,a:14,T:24,f:.8,r:5},
   {k:'wp',p:[451,175,481,154,515,158,546,135,588,115,635,108,665,122,700,145,711,191,746,214,758,256,815,262,815,285,650,285,451,285],c:0,a:20,T:30,f:3,r:8}
  ];
  function blur(a,w,h,r){var t=new Float32Array(w*h),x,y,s,k,n=2*r+1;
    for(y=0;y<h;y++){s=0;for(k=-r;k<=r;k++)s+=a[y*w+Math.min(w-1,Math.max(0,k))];
      for(x=0;x<w;x++){t[y*w+x]=s/n;s+=a[y*w+Math.min(w-1,x+r+1)]-a[y*w+Math.max(0,x-r)]}}
    for(x=0;x<w;x++){s=0;for(k=-r;k<=r;k++)s+=t[Math.min(h-1,Math.max(0,k))*w+x];
      for(y=0;y<h;y++){a[y*w+x]=s/n;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}}
  function start(){
    var img=new Image();img.onload=function(){
      var W=img.naturalWidth,H=img.naturalHeight,sc=document.createElement('canvas');sc.width=W;sc.height=H;
      var sx=sc.getContext('2d');sx.drawImage(img,0,0);var S;try{S=sx.getImageData(0,0,W,H).data}catch(e){return}
      var cv=document.createElement('canvas');cv.width=W;cv.height=H;
      cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      bg.parentNode.insertBefore(cv,bg.nextSibling);var ctx=cv.getContext('2d');
      C.forEach(function(c){
        var xs=c.p.filter(function(_,i){return i%2==0}),ys=c.p.filter(function(_,i){return i%2==1}),m=c.r*3;
        c.x0=Math.max(0,Math.min.apply(0,xs)-m|0);c.y0=Math.max(0,Math.min.apply(0,ys)-m|0);
        c.w=Math.min(W,Math.max.apply(0,xs)+m|0)-c.x0;c.h=Math.min(H,Math.max.apply(0,ys)+m|0)-c.y0;
        var mc=document.createElement('canvas');mc.width=c.w;mc.height=c.h;var mx=mc.getContext('2d');
        mx.fillStyle='#fff';mx.beginPath();
        for(var i=0;i<c.p.length;i+=2){var px=c.p[i]-c.x0,py=c.p[i+1]-c.y0;i?mx.lineTo(px,py):mx.moveTo(px,py)}
        mx.fill();var d=mx.getImageData(0,0,c.w,c.h).data,wt=new Float32Array(c.w*c.h),j;
        for(j=0;j<wt.length;j++)wt[j]=d[j*4+3]/255;
        for(var k=0;k<3;k++)blur(wt,c.w,c.h,c.r);
        for(j=0;j<wt.length;j++){var v=Math.min(1,Math.max(0,(wt[j]-.04)/.9));wt[j]=v*v*(3-2*v)}
        c.wt=wt;c.o=ctx.createImageData(c.w,c.h);
        if(c.k=='sp'){ /* clean-sky plate P (per-row blend of two sky columns) + cloud residual R = S - P */
          var n=c.w*c.h;c.P=new Uint8ClampedArray(n*3);c.R=new Int16Array(n*3);
          for(var y=0;y<c.h;y++){var gy=c.y0+y,L=[0,0,0],Rr=[0,0,0];
            for(var q=0;q<3;q++)for(var u=0;u<3;u++){
              L[u]+=S[(gy*W+c.PL+q)*4+u]/3;Rr[u]+=S[(gy*W+c.PR-q)*4+u]/3}
            for(var x=0;x<c.w;x++){var gx=c.x0+x,t=(gx-c.PL)/(c.PR-c.PL),i3=(y*c.w+x)*3,si=(gy*W+gx)*4;
              t=t<0?0:t>1?1:t;
              for(u=0;u<3;u++){var pv=L[u]+(Rr[u]-L[u])*t;c.P[i3+u]=pv;c.R[i3+u]=(S[si+u]-pv)*(wt[y*c.w+x]>.5?1:0)}}}
        }
      });
      var mq=matchMedia('(prefers-reduced-motion:reduce)'),last=0;
      function frame(ms){requestAnimationFrame(frame);
        if(ms-last<33||document.hidden||mq.matches||!cv.offsetParent)return;last=ms;var t=ms/1000;
        for(var n=0;n<C.length;n++){var c=C[n],o=c.o.data,w=c.w,h=c.h,dx=c.c+c.a*Math.sin(6.2832*t/c.T+c.f),ix=Math.round(dx);
          for(var y=0;y<h;y++){var gy=c.y0+y;
            for(var x=0;x<w;x++){var q=c.wt[y*w+x],oi=(y*w+x)*4;
              if(q<.02){o[oi+3]=0;continue}
              if(c.k=='sp'){var xx=x-ix,i3=(y*w+x)*3,r0,g0,b0;
                if(xx>=0&&xx<w){var j3=(y*w+xx)*3;r0=c.P[i3]+c.R[j3];g0=c.P[i3+1]+c.R[j3+1];b0=c.P[i3+2]+c.R[j3+2]}
                else{r0=c.P[i3];g0=c.P[i3+1];b0=c.P[i3+2]}
                var si=((gy)*W+c.x0+x)*4;
                o[oi]=S[si]+(r0-S[si])*q;o[oi+1]=S[si+1]+(g0-S[si+1])*q;o[oi+2]=S[si+2]+(b0-S[si+2])*q;o[oi+3]=255}
              else{var o2=Math.round(dx*q);if(!o2){o[oi+3]=0;continue}
                var X=c.x0+x-o2;if(X<0)X=0;else if(X>=W)X=W-1;var s2=(gy*W+X)*4;
                o[oi]=S[s2];o[oi+1]=S[s2+1];o[oi+2]=S[s2+2];o[oi+3]=255}}}
          ctx.putImageData(c.o,c.x0,c.y0)}
      }
      requestAnimationFrame(frame)};
    img.src=bg.getAttribute('src');
  }
  if(document.readyState==='complete')start();else addEventListener('load',start);
})();
