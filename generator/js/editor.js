/* ═══════════════════════════════════════════════
   EDITOR — Full-Screen Visual Builder
   
   Click-to-edit, style properties, video scroll
   layer, particle builder, page management.
   ═══════════════════════════════════════════════ */

window.ArbelEditor = (function () {
    'use strict';

    var _iframe = null;
    var _container = null;
    var _active = false;
    var _selectedId = null;
    var _overrides = {};
    var _onUpdate = null;
    var _videoFrames = [];
    var _videoConfig = { fps: 24, speed: 1, loop: false, active: false, preset: null };
    var _pages = [{ id: 'home', name: 'Home' }];
    var _currentPage = 'home';
    var _zoom = 100;
    var _lastTree = [];

    /* ─── Overlay script injected into iframe ─── */
    function _getOverlayScript() {
        return `(function(){
var selected=null,editing=false;
var s=document.createElement("style");
s.textContent=\`
[data-arbel-id]{cursor:pointer;transition:outline .15s,outline-offset .15s}
[data-arbel-id]:hover:not(.arbel-sel){outline:2px dashed rgba(100,108,255,.5);outline-offset:2px}
.arbel-sel{outline:2px solid #646cff!important;outline-offset:3px!important}
.arbel-editing{outline-color:#0bda51!important;min-height:1em}
.arbel-lbl{position:fixed;top:8px;left:8px;z-index:99999;background:#646cff;color:#fff;
font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;
opacity:0;transition:opacity .2s}.arbel-lbl.vis{opacity:1}
.arbel-fx-cv{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}
.arbel-video-layer{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none}
.arbel-video-layer canvas{width:100%;height:100%;object-fit:cover}
@keyframes arbel-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes arbel-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes arbel-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes arbel-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
@keyframes arbel-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes arbel-swing{0%,100%{transform:rotate(0)}25%{transform:rotate(5deg)}75%{transform:rotate(-5deg)}}
@keyframes arbel-breathe{0%,100%{opacity:1}50%{opacity:.6}}
@keyframes arbel-glow-pulse{0%,100%{box-shadow:0 0 5px rgba(100,108,255,.3)}50%{box-shadow:0 0 25px rgba(100,108,255,.6)}}
\`;document.head.appendChild(s);

var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);

document.addEventListener("click",function(e){
  if(editing)return;
  var el=e.target.closest("[data-arbel-id]");
  if(!el){desel();return}
  e.preventDefault();e.stopPropagation();sel(el);
},true);

document.addEventListener("dblclick",function(e){
  var el=e.target.closest('[data-arbel-edit="text"]');
  if(!el)return;e.preventDefault();startEdit(el);
},true);

document.addEventListener("mouseover",function(e){
  var el=e.target.closest("[data-arbel-id]");
  if(el&&el!==selected){lbl.textContent=el.getAttribute("data-arbel-id");lbl.classList.add("vis")}
});
document.addEventListener("mouseout",function(){lbl.classList.remove("vis")});

function sel(el){
  desel();selected=el;el.classList.add("arbel-sel");
  var r=el.getBoundingClientRect();
  var cs=getComputedStyle(el);
  window.parent.postMessage({type:"arbel-select",id:el.getAttribute("data-arbel-id"),
    tag:el.tagName.toLowerCase(),
    text:el.getAttribute("data-arbel-edit")==="text"?el.textContent:null,
    editable:el.hasAttribute("data-arbel-edit"),
    rect:{top:r.top,left:r.left,width:r.width,height:r.height},
    currentAnimation:el.getAttribute("data-arbel-anim")||"none",
    currentHover:el.getAttribute("data-arbel-hover")||"none",
    currentEffect:el.getAttribute("data-arbel-effect")||"none",
    currentContinuous:el.getAttribute("data-arbel-continuous")||"none",
    styles:{
      fontFamily:cs.fontFamily,fontSize:parseInt(cs.fontSize)||16,
      fontWeight:cs.fontWeight||"400",
      lineHeight:parseFloat(cs.lineHeight/parseInt(cs.fontSize))||1.5,
      letterSpacing:parseFloat(cs.letterSpacing)||0,
      textAlign:cs.textAlign||"left",color:cs.color,backgroundColor:cs.backgroundColor,
      paddingTop:parseInt(cs.paddingTop)||0,paddingRight:parseInt(cs.paddingRight)||0,
      paddingBottom:parseInt(cs.paddingBottom)||0,paddingLeft:parseInt(cs.paddingLeft)||0,
      borderRadius:parseInt(cs.borderRadius)||0,
      borderWidth:parseInt(cs.borderWidth)||0,
      borderStyle:cs.borderStyle||"none",
      borderColor:cs.borderColor||"transparent",
      opacity:Math.round(parseFloat(cs.opacity)*100),
      zIndex:cs.zIndex==="auto"?"auto":parseInt(cs.zIndex)||0,
      transform:cs.transform||"none",
      filter:cs.filter||"none",
      objectFit:cs.objectFit||"cover",
      textDecoration:cs.textDecoration||"none",
      fontStyle:cs.fontStyle||"normal",
      visibility:cs.visibility||"visible",
      href:el.tagName==="A"?el.getAttribute("href"):el.closest("a")?el.closest("a").getAttribute("href"):""
    }
  },"*");
}

function desel(){
  if(editing)stopEdit();
  if(selected){selected.classList.remove("arbel-sel");selected=null}
  window.parent.postMessage({type:"arbel-deselect"},"*");
}

function startEdit(el){
  if(editing)stopEdit();sel(el);editing=true;
  el.classList.add("arbel-editing");el.contentEditable=true;el.focus();
  var rng=document.createRange();rng.selectNodeContents(el);
  var s2=window.getSelection();s2.removeAllRanges();s2.addRange(rng);
  el.addEventListener("blur",function onB(){el.removeEventListener("blur",onB);stopEdit()});
  el.addEventListener("keydown",function onK(e){
    if(e.key==="Escape"||(e.key==="Enter"&&!e.shiftKey)){e.preventDefault();el.removeEventListener("keydown",onK);el.blur()}
  });
}

function stopEdit(){
  if(!selected)return;editing=false;
  selected.classList.remove("arbel-editing");selected.contentEditable=false;
  window.parent.postMessage({type:"arbel-text-update",id:selected.getAttribute("data-arbel-id"),text:selected.textContent},"*");
}

var ANIMS={
  fadeIn:{from:"opacity:0",to:"opacity:1"},
  fadeInUp:{from:"opacity:0;transform:translateY(30px)",to:"opacity:1;transform:translateY(0)"},
  fadeInDown:{from:"opacity:0;transform:translateY(-30px)",to:"opacity:1;transform:translateY(0)"},
  slideUp:{from:"opacity:0;transform:translateY(60px)",to:"opacity:1;transform:translateY(0)"},
  slideDown:{from:"opacity:0;transform:translateY(-60px)",to:"opacity:1;transform:translateY(0)"},
  slideLeft:{from:"opacity:0;transform:translateX(60px)",to:"opacity:1;transform:translateX(0)"},
  slideRight:{from:"opacity:0;transform:translateX(-60px)",to:"opacity:1;transform:translateX(0)"},
  scaleUp:{from:"opacity:0;transform:scale(0.7)",to:"opacity:1;transform:scale(1)"},
  scaleDown:{from:"opacity:0;transform:scale(1.3)",to:"opacity:1;transform:scale(1)"},
  bounceIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},
  elasticIn:{from:"opacity:0;transform:scale(0.5)",to:"opacity:1;transform:scale(1)"},
  rotateIn:{from:"opacity:0;transform:rotate(-15deg) scale(0.9)",to:"opacity:1;transform:rotate(0) scale(1)"},
  rotateInLeft:{from:"opacity:0;transform:rotate(-90deg)",to:"opacity:1;transform:rotate(0)"},
  flipIn:{from:"opacity:0;transform:perspective(400px) rotateX(90deg)",to:"opacity:1;transform:perspective(400px) rotateX(0)"},
  flipInY:{from:"opacity:0;transform:perspective(400px) rotateY(90deg)",to:"opacity:1;transform:perspective(400px) rotateY(0)"},
  blurIn:{from:"opacity:0;filter:blur(12px)",to:"opacity:1;filter:blur(0)"},
  glitchIn:{from:"opacity:0;transform:skewX(-20deg) translateX(-30px)",to:"opacity:1;transform:skewX(0) translateX(0)"},
  clipIn:{from:"clip-path:inset(0 100% 0 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  dropIn:{from:"opacity:0;transform:translateY(-100px)",to:"opacity:1;transform:translateY(0)"},
  unfold:{from:"opacity:0;transform:scaleY(0);transform-origin:top",to:"opacity:1;transform:scaleY(1)"}
};

function prevAnim(el,name){
  var a=ANIMS[name];
  if(!a){el.style.opacity="";el.style.transform="";el.style.filter="";el.style.clipPath="";return}
  el.style.transition="none";
  a.from.split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});
  void el.offsetWidth;
  el.style.transition="all .8s cubic-bezier(.16,1,.3,1)";
  a.to.split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});
}

function applyContinuous(el,name){
  el.style.animation="";
  if(name==="none")return;
  var map={
    pulse:"arbel-pulse 2s ease-in-out infinite",
    float:"arbel-float 3s ease-in-out infinite",
    spin:"arbel-spin 4s linear infinite",
    bounce:"arbel-bounce 1.5s ease-in-out infinite",
    shake:"arbel-shake 0.5s ease-in-out infinite",
    swing:"arbel-swing 2s ease-in-out infinite",
    breathe:"arbel-breathe 3s ease-in-out infinite",
    "glow-pulse":"arbel-glow-pulse 2s ease-in-out infinite"
  };
  if(map[name])el.style.animation=map[name];
}

var HOVERS={
  lift:"transform:translateY(-6px);box-shadow:0 12px 40px rgba(0,0,0,.25)",
  scale:"transform:scale(1.06)",
  glow:"box-shadow:0 0 25px rgba(100,108,255,.5)",
  tilt:"transform:rotate(-2deg)",
  skew:"transform:skewX(-3deg)",
  "border-glow":"box-shadow:0 0 0 2px #646cff,0 0 20px rgba(100,108,255,.3)",
  brightness:"filter:brightness(1.3)",
  "color-shift":"filter:hue-rotate(30deg)"
};

function applyHover(el,name){
  el.onmouseenter=null;el.onmouseleave=null;
  if(name==="none"||!HOVERS[name])return;
  el.style.transition="all .3s ease";
  el.onmouseenter=function(){
    el._ph=el.style.cssText;
    HOVERS[name].split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});
  };
  el.onmouseleave=function(){if(el._ph!==undefined)el.style.cssText=el._ph};
}

var fxMap={};
function applyFx(el,name,intensity,c1,c2,opts){
  opts=opts||{};
  var id=el.getAttribute("data-arbel-id"),old=fxMap[id];
  if(old){cancelAnimationFrame(old.raf);if(old.cv&&old.cv.parentNode)old.cv.parentNode.removeChild(old.cv);delete fxMap[id]}
  if(name==="none")return;
  var count=intensity||50;
  var col1=c1||"100,108,255";var col2=c2||"11,218,81";var col3=opts.color3||col1;
  var pSize=opts.size||4;var spd=opts.speed||1;var glw=opts.glow||5;var doConnect=opts.connect!==false;var doInteract=opts.interact!==false;
  var pos=getComputedStyle(el).position;if(pos==="static")el.style.position="relative";
  var cv=document.createElement("canvas");cv.className="arbel-fx-cv";el.insertBefore(cv,el.firstChild);
  var ctx=cv.getContext("2d");
  function rsz(){cv.width=el.offsetWidth;cv.height=el.offsetHeight}rsz();
  var ps=[];
  for(var i=0;i<count;i++)ps.push({
    x:Math.random()*cv.width,y:Math.random()*cv.height,
    vx:(Math.random()-.5)*.8*spd,vy:(Math.random()-.5)*.8*spd,
    sz:Math.random()*(pSize*0.75)+pSize*0.25,a:Math.random()*.5+.2,p:Math.random()*6.28,
    rot:Math.random()*360,col:Math.random()>.33?(Math.random()>.5?col1:col2):col3
  });
  if(name==="bubbles")ps.forEach(function(p){p.vy=-(Math.random()+.3);p.sz=Math.random()*6+2});
  if(name==="snow")ps.forEach(function(p){p.vy=Math.random()*.5+.2;p.sz=Math.random()*3+1});
  if(name==="fireflies"){ps=ps.slice(0,Math.min(count,25))}
  var raf;
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);var t=Date.now()*.001;
    if(name==="gradient"){
      var g=ctx.createLinearGradient(cv.width*(.5+.5*Math.sin(t*.5)),0,cv.width*(.5+.5*Math.cos(t*.3)),cv.height);
      g.addColorStop(0,"rgba("+col1+",.12)");g.addColorStop(.5,"rgba("+col2+",.06)");g.addColorStop(1,"rgba("+col1+",.12)");
      ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);raf=requestAnimationFrame(draw);return}
    if(name==="waves"){
      for(var w=0;w<3;w++){ctx.strokeStyle="rgba("+col1+","+(0.15-w*0.03)+")";ctx.lineWidth=1.5-w*0.3;ctx.beginPath();
      for(var x=0;x<=cv.width;x+=4){var y=cv.height*.5+Math.sin(x*.01+t+w)*20*(w+1);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}
      raf=requestAnimationFrame(draw);return}
    if(name==="aurora"){
      for(var ab=0;ab<3;ab++){ctx.fillStyle="rgba("+(ab%2===0?col1:col2)+",0.04)";ctx.beginPath();
      for(var ax=0;ax<=cv.width;ax+=6){var ay=cv.height*.3+Math.sin(ax*.005+t*.5+ab*2)*cv.height*.15;
      ax===0?ctx.moveTo(ax,ay):ctx.lineTo(ax,ay)}ctx.lineTo(cv.width,cv.height);ctx.lineTo(0,cv.height);ctx.fill()}
      raf=requestAnimationFrame(draw);return}
    if(name==="noise"){
      var imd=ctx.createImageData(cv.width,cv.height);var d=imd.data;
      for(var j=0;j<d.length;j+=4){var v=Math.random()*30;d[j]=v;d[j+1]=v;d[j+2]=v;d[j+3]=12}
      ctx.putImageData(imd,0,0);raf=requestAnimationFrame(draw);return}
    if(name==="blobs"){
      for(var b=0;b<3;b++){ctx.fillStyle="rgba("+(b%2===0?col1:col2)+",0.06)";ctx.beginPath();
      var bx=cv.width*(.3+b*.2)+Math.sin(t*.5+b)*50,by=cv.height*(.3+b*.2)+Math.cos(t*.4+b)*40,br=60+Math.sin(t+b)*20;
      for(var ba=0;ba<6.28;ba+=.1){var rr=br+Math.sin(ba*3+t+b)*15;
      ba===0?ctx.moveTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr):ctx.lineTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr)}
      ctx.closePath();ctx.fill()}raf=requestAnimationFrame(draw);return}
    if(name==="geometric"){
      ctx.strokeStyle="rgba("+col1+",0.15)";ctx.lineWidth=0.5;
      for(var gi=0;gi<15;gi++){var gx=cv.width*.1+gi*cv.width/15+Math.sin(t+gi)*10,gy=cv.height*.5+Math.cos(t*.7+gi)*cv.height*.3,gsz=15+Math.sin(t+gi)*5;
      ctx.beginPath();for(var gs=0;gs<6;gs++){var ga=gs*Math.PI/3+t*.2;ctx.lineTo(gx+Math.cos(ga)*gsz,gy+Math.sin(ga)*gsz)}ctx.closePath();ctx.stroke()}
      raf=requestAnimationFrame(draw);return}
    if(name==="cube"||name==="sphere"||name==="pyramid"||name==="torus"||name==="cylinder"||name==="crystal"||name==="icosahedron"||name==="grid3d"){
      var cx3=cv.width/2,cy3=cv.height/2,sz3=Math.min(cv.width,cv.height)*0.35;
      var cosA=Math.cos(t*0.7),sinA=Math.sin(t*0.7),cosB=Math.cos(t*0.5),sinB=Math.sin(t*0.5);
      function proj(x,y,z){var x1=x*cosA-z*sinA,z1=x*sinA+z*cosA,y1=y*cosB-z1*sinB,z2=y*sinB+z1*cosB;var sc=1/(1+z2*0.003);return{x:cx3+x1*sc,y:cy3+y1*sc,z:z2}}
      function edg(p1,p2,c,a){ctx.strokeStyle="rgba("+c+","+a+")";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
      function dt(p,c,r){ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,r,0,6.28);ctx.fill()}
      if(name==="cube"){
        var s=sz3*0.4,vts=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];
        var pvv=vts.map(function(v){return proj(v[0],v[1],v[2])});
        [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(function(e){edg(pvv[e[0]],pvv[e[1]],col1,0.6)});
        pvv.forEach(function(p){dt(p,"rgba("+col2+",0.8)",3)})
      }else if(name==="sphere"){
        for(var sli=0;sli<60;sli++){var phi=Math.PI*sli/30,theta=2*Math.PI*((sli*7)%60)/60;
        var sx3=sz3*0.4*Math.sin(phi)*Math.cos(theta),sy3=sz3*0.4*Math.sin(phi)*Math.sin(theta),sz4=sz3*0.4*Math.cos(phi);
        var sp=proj(sx3,sy3,sz4);var bright=0.3+0.5*((sp.z+sz3)/(2*sz3));dt(sp,"rgba("+(sli%2===0?col1:col2)+","+bright+")",2+bright)}
      }else if(name==="pyramid"){
        var ph2=sz3*0.5,pb2=sz3*0.35;
        var pvt=[[0,-ph2,0],[-pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,pb2],[-pb2,ph2*0.5,pb2]];
        var ppv2=pvt.map(function(v){return proj(v[0],v[1],v[2])});
        [[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]].forEach(function(e){edg(ppv2[e[0]],ppv2[e[1]],col1,0.5)});
        ppv2.forEach(function(p){dt(p,"rgba("+col2+",0.8)",3)})
      }else if(name==="torus"){
        var R2=sz3*0.3,r3=sz3*0.12;
        for(var ti3=0;ti3<80;ti3++){var u=2*Math.PI*ti3/40,v3=2*Math.PI*((ti3*3)%80)/80;
        var tx=(R2+r3*Math.cos(v3))*Math.cos(u),ty=r3*Math.sin(v3),tz=(R2+r3*Math.cos(v3))*Math.sin(u);
        var tp=proj(tx,ty,tz);dt(tp,"rgba("+(ti3%2===0?col1:col2)+",0.5)",2)}
      }else if(name==="cylinder"){
        var cr2=sz3*0.25,ch3=sz3*0.5;
        for(var ci3=0;ci3<24;ci3++){var ca2=2*Math.PI*ci3/12;
        var ptop=proj(Math.cos(ca2)*cr2,-ch3*0.5,Math.sin(ca2)*cr2);var pbot=proj(Math.cos(ca2)*cr2,ch3*0.5,Math.sin(ca2)*cr2);
        dt(ptop,"rgba("+col1+",0.7)",2);dt(pbot,"rgba("+col2+",0.7)",2);if(ci3<12)edg(ptop,pbot,col1,0.3)}
      }else if(name==="crystal"){
        var cs3=sz3*0.2,ct2=sz3*0.5;var cvts=[];
        for(var cv2=0;cv2<6;cv2++){var ang=cv2*Math.PI/3;cvts.push([Math.cos(ang)*cs3,0,Math.sin(ang)*cs3])}
        cvts.push([0,-ct2,0]);cvts.push([0,ct2*0.5,0]);
        var cpv2=cvts.map(function(v){return proj(v[0],v[1],v[2])});
        for(var ce=0;ce<6;ce++){edg(cpv2[ce],cpv2[(ce+1)%6],col1,0.4);edg(cpv2[ce],cpv2[6],col2,0.5);edg(cpv2[ce],cpv2[7],col1,0.3)}
        cpv2.forEach(function(p){dt(p,"rgba("+col2+",0.9)",3)})
      }else if(name==="icosahedron"){
        var phi3=(1+Math.sqrt(5))/2,ir=sz3*0.3;
        var ivts=[[-1,phi3,0],[1,phi3,0],[-1,-phi3,0],[1,-phi3,0],[0,-1,phi3],[0,1,phi3],[0,-1,-phi3],[0,1,-phi3],[phi3,0,-1],[phi3,0,1],[-phi3,0,-1],[-phi3,0,1]];
        var ipv2=ivts.map(function(v){var l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return proj(v[0]/l*ir,v[1]/l*ir,v[2]/l*ir)});
        [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].forEach(function(f){
        edg(ipv2[f[0]],ipv2[f[1]],col1,0.3);edg(ipv2[f[1]],ipv2[f[2]],col1,0.3);edg(ipv2[f[2]],ipv2[f[0]],col1,0.3)});
        ipv2.forEach(function(p){dt(p,"rgba("+col2+",0.8)",2)})
      }else if(name==="grid3d"){
        var gs3=sz3*0.15,gc=4;
        for(var gxi=-gc;gxi<=gc;gxi+=2)for(var gyi=-gc;gyi<=gc;gyi+=2)for(var gzi=-gc;gzi<=gc;gzi+=2){
        var gp=proj(gxi*gs3,gyi*gs3,gzi*gs3);var ga2=0.15+0.3*((gp.z+sz3*2)/(sz3*4));
        dt(gp,"rgba("+((gxi+gyi+gzi)%2===0?col1:col2)+","+ga2+")",2)}
      }
      raf=requestAnimationFrame(draw);return}
    if(name==="orbits"){
      for(var oi=0;oi<8;oi++){var oa=t*.5+oi*Math.PI/4,or2=50+oi*15,ox=cv.width/2+Math.cos(oa)*or2,oy=cv.height/2+Math.sin(oa)*or2;
      ctx.fillStyle="rgba("+col1+","+(0.4-oi*0.04)+")";ctx.beginPath();ctx.arc(ox,oy,3,0,6.28);ctx.fill()}
      raf=requestAnimationFrame(draw);return}
    if(name==="dna"){
      for(var di=0;di<20;di++){var dx=cv.width*.2+di*(cv.width*.6/20),dy1=cv.height/2+Math.sin(di*.5+t)*30,dy2=cv.height/2-Math.sin(di*.5+t)*30;
      ctx.fillStyle="rgba("+col1+",0.5)";ctx.beginPath();ctx.arc(dx,dy1,3,0,6.28);ctx.fill();
      ctx.fillStyle="rgba("+col2+",0.5)";ctx.beginPath();ctx.arc(dx,dy2,3,0,6.28);ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.beginPath();ctx.moveTo(dx,dy1);ctx.lineTo(dx,dy2);ctx.stroke()}
      raf=requestAnimationFrame(draw);return}
    if(name==="confetti"){
      ps.forEach(function(p){p.y+=p.vy+1;p.x+=Math.sin(p.p)*0.5;p.rot+=2;p.p+=0.03;
      if(p.y>cv.height+10){p.y=-10;p.x=Math.random()*cv.width}
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle="rgba("+p.col+","+p.a+")";ctx.fillRect(-3,-1.5,6,3);ctx.restore()});
      raf=requestAnimationFrame(draw);return}
    if(name==="matrix"){
      ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle="rgba(0,255,65,0.6)";ctx.font="12px monospace";
      ps.forEach(function(p){var ch=String.fromCharCode(0x30A0+Math.random()*96);
      ctx.fillText(ch,p.x,p.y);p.y+=12;if(p.y>cv.height){p.y=0;p.x=Math.random()*cv.width}});
      raf=requestAnimationFrame(draw);return}
    ps.forEach(function(p){
      p.x+=p.vx;p.y+=p.vy;p.p+=.02;
      if(p.x<-5)p.x=cv.width+5;if(p.x>cv.width+5)p.x=-5;
      if(p.y<-5)p.y=cv.height+5;if(p.y>cv.height+5)p.y=-5;
      var al=p.a;if(name==="stars"||name==="fireflies")al=p.a*(.5+.5*Math.sin(p.p));
      ctx.beginPath();
      if(name==="fireflies"){ctx.shadowBlur=10;ctx.shadowColor="rgba(100,255,100,"+al+")";ctx.fillStyle="rgba(100,255,100,"+al+")"}
      else if(name==="snow"){ctx.fillStyle="rgba(255,255,255,"+al+")";p.x+=Math.sin(p.p)*.5}
      else{if(glw>0){ctx.shadowBlur=glw;ctx.shadowColor="rgba("+p.col+","+al+")"}ctx.fillStyle="rgba("+p.col+","+al+")"}
      ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0;
    });
    if(doConnect&&name==="particles"){ctx.strokeStyle="rgba("+col1+",0.06)";ctx.lineWidth=0.5;
      for(var ci=0;ci<ps.length;ci++)for(var cj=ci+1;cj<ps.length;cj++){var dx=ps[ci].x-ps[cj].x,dy=ps[ci].y-ps[cj].y;if(dx*dx+dy*dy<8000){ctx.beginPath();ctx.moveTo(ps[ci].x,ps[ci].y);ctx.lineTo(ps[cj].x,ps[cj].y);ctx.stroke()}}}
    raf=requestAnimationFrame(draw)
  }draw();
  fxMap[id]={cv:cv,raf:raf};window.addEventListener("resize",rsz);
}

var videoLayer=null;
function setupVideoLayer(frames,cfg){
  if(videoLayer){
    if(videoLayer.el.parentNode)videoLayer.el.parentNode.removeChild(videoLayer.el);
    cancelAnimationFrame(videoLayer.scrollRaf||0);
    if(videoLayer._rsz)window.removeEventListener("resize",videoLayer._rsz);
    if(videoLayer._scroll)window.removeEventListener("scroll",videoLayer._scroll);
    videoLayer=null;
  }
  if(!frames||!frames.length){
    document.body.style.position="";
    document.body.style.zIndex="";
    return;
  }
  /* Create stacking context on body so z-index:-1 video stays above root canvas paint */
  document.body.style.position="relative";
  document.body.style.zIndex="0";
  var div=document.createElement("div");div.className="arbel-video-layer";
  var cvl=document.createElement("canvas");div.appendChild(cvl);document.body.insertBefore(div,document.body.firstChild);
  var ctxl=cvl.getContext("2d");
  var imgs=[];var loadedCount=0;var allLoaded=false;
  var speed=cfg.speed||1;var loop2=cfg.loop||false;
  var lastFrame=-1;
  function rsz(){cvl.width=window.innerWidth;cvl.height=window.innerHeight;drawFrame(lastFrame<0?0:lastFrame,true)}
  function drawFrame(idx2,force){
    if(idx2<0||idx2>=imgs.length)return;
    if(!force&&idx2===lastFrame)return;
    var img=imgs[idx2];
    if(img&&img.complete&&img.naturalWidth>0){
      ctxl.clearRect(0,0,cvl.width,cvl.height);
      ctxl.drawImage(img,0,0,cvl.width,cvl.height);lastFrame=idx2;
    }
  }
  function onScroll(){
    var scrollMax=document.documentElement.scrollHeight-window.innerHeight;
    if(scrollMax<=0){drawFrame(0);return}
    var progress=window.scrollY/scrollMax*speed;
    if(loop2)progress=progress%1;else progress=Math.min(progress,1);
    var idx2=Math.min(Math.floor(progress*imgs.length),imgs.length-1);
    drawFrame(idx2);
  }
  /* Preload all images then start */
  frames.forEach(function(src,i){
    var im=new Image();
    im.onload=function(){loadedCount++;if(loadedCount>=frames.length){allLoaded=true;rsz();onScroll()}};
    im.onerror=function(){loadedCount++;if(loadedCount>=frames.length){allLoaded=true;rsz();onScroll()}};
    im.src=src;imgs[i]=im;
  });
  window.addEventListener("resize",rsz);
  window.addEventListener("scroll",onScroll,{passive:true});
  videoLayer={el:div,imgs:imgs,scrollRaf:0,_rsz:rsz,_scroll:onScroll};
}

window.addEventListener("message",function(e){
  var d=e.data;if(!d||!d.type)return;
  if(d.type==="arbel-set-text"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.textContent=d.text}
  if(d.type==="arbel-set-style"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el&&d.prop)el.style[d.prop]=d.value}
  if(d.type==="arbel-set-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-anim",d.animation);prevAnim(el,d.animation)}}
  if(d.type==="arbel-set-continuous"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-continuous",d.animation);applyContinuous(el,d.animation)}}
  if(d.type==="arbel-set-hover"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-hover",d.hover);applyHover(el,d.hover)}}
  if(d.type==="arbel-set-effect"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-effect",d.effect);applyFx(el,d.effect,d.intensity,d.color1,d.color2,{color3:d.color3,size:d.size,speed:d.speed,glow:d.glow,connect:d.connect,interact:d.interact})}}
  if(d.type==="arbel-preview-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)prevAnim(el,d.animation)}
  if(d.type==="arbel-select-by-id"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.scrollIntoView({behavior:"smooth",block:"center"});sel(el)}}
  if(d.type==="arbel-set-backdrop"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){var bm={"blur-sm":"blur(4px)","blur-md":"blur(8px)","blur-lg":"blur(16px)",saturate:"saturate(2)",grayscale:"grayscale(1)",sepia:"sepia(1)"};el.style.backdropFilter=bm[d.value]||"none"}}
  if(d.type==="arbel-set-shadow"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){var sm={sm:"0 2px 8px rgba(0,0,0,.15)",md:"0 4px 16px rgba(0,0,0,.2)",lg:"0 8px 32px rgba(0,0,0,.25)",xl:"0 16px 64px rgba(0,0,0,.3)",glow:"0 0 30px rgba(100,108,255,.4)",neon:"0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)",inner:"inset 0 2px 10px rgba(0,0,0,.3)"};el.style.boxShadow=sm[d.value]||"none"}}
  if(d.type==="arbel-set-video-layer"){setupVideoLayer(d.frames,d.config)}
  if(d.type==="arbel-load-font"){var link=document.createElement("link");link.rel="stylesheet";link.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(d.font)+":wght@300;400;500;600;700;800;900&display=swap";document.head.appendChild(link)}
  if(d.type==="arbel-set-zindex"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.style.zIndex=d.value;el.style.position=el.style.position||"relative"}}
  if(d.type==="arbel-set-visibility"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.style.visibility=d.value}
  if(d.type==="arbel-set-pointer-events"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.style.pointerEvents=d.value}
  if(d.type==="arbel-set-link"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){if(el.tagName==="A")el.setAttribute("href",d.href);else{var a=el.closest("a");if(a)a.setAttribute("href",d.href)}}}
  if(d.type==="arbel-remove-link"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){if(el.tagName==="A")el.removeAttribute("href");else{var a=el.closest("a");if(a)a.removeAttribute("href")}}}
  if(d.type==="arbel-set-filter"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.style.filter=d.value}
});

var tree=[];
document.querySelectorAll("[data-arbel-id]").forEach(function(el){
  var cs2=getComputedStyle(el);
  tree.push({id:el.getAttribute("data-arbel-id"),tag:el.tagName.toLowerCase(),
    editable:el.hasAttribute("data-arbel-edit"),
    text:el.getAttribute("data-arbel-edit")==="text"?el.textContent.substring(0,50):null,
    visible:cs2.visibility!=="hidden",
    locked:false,
    zIndex:cs2.zIndex==="auto"?0:parseInt(cs2.zIndex)||0
  });
});
window.parent.postMessage({type:"arbel-tree",tree:tree},"*");
})();`;
    }

    /* ─── Initialize ─── */
    function init(iframe, containerEl, onUpdateCb) {
        _iframe = iframe;
        _container = containerEl;
        _onUpdate = onUpdateCb;
        _active = true;
        _setupTabs();
        _setupToolbar();
        _setupStyleListeners();
        _setupLayerActions();
        _setupTextFormatting();
        _setupBorderListeners();
        _setupTransformListeners();
        _setupLinkListeners();
        _setupImageFilterListeners();
        _setupAnimationListeners();
        _setupEffectListeners();
        _setupVideoLayer();
        _setupParticleBuilder();
        _setupPageManagement();
        _setupAccordions();
        _setupTemplates();
        _setupLayerSearch();
        window.addEventListener('message', _handleMessage);
    }

    /* ─── Message handler ─── */
    function _handleMessage(e) {
        var d = e.data;
        if (!d || !d.type || !_active) return;
        if (d.type === 'arbel-tree') {
            _renderElementTree(d.tree);
            // Re-apply video layer after iframe reload
            if (_videoConfig.active && _videoFrames.length && _iframe) {
                _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig });
            }
        }
        if (d.type === 'arbel-select') { _selectedId = d.id; _showPanel(d); _updateStatus(d); }
        if (d.type === 'arbel-deselect') { _selectedId = null; _hidePanel(); _updateStatus(null); }
        if (d.type === 'arbel-text-update') {
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _overrides[d.id].text = d.text;
            if (_onUpdate) _onUpdate(_overrides);
            var ti = _qs('.editor-text-input');
            if (ti && _selectedId === d.id) ti.value = d.text;
        }
    }

    /* ─── Tab switching ─── */
    function _setupTabs() {
        if (!_container) return;
        _container.querySelectorAll('.bfs-panel-tabs').forEach(function (tabBar) {
            tabBar.querySelectorAll('.bfs-tab').forEach(function (tab) {
                tab.addEventListener('click', function () {
                    var panelName = tab.getAttribute('data-tab');
                    tabBar.querySelectorAll('.bfs-tab').forEach(function (t) { t.classList.remove('active'); });
                    tab.classList.add('active');
                    var parent = tabBar.closest('.bfs-left, .bfs-right');
                    if (parent) {
                        parent.querySelectorAll('.bfs-panel-content').forEach(function (p) { p.classList.remove('active'); });
                        var target = parent.querySelector('[data-panel="' + panelName + '"]');
                        if (target) target.classList.add('active');
                    }
                });
            });
        });
    }

    /* ─── Toolbar ─── */
    function _setupToolbar() {
        if (!_container) return;
        _container.querySelectorAll('.device-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _container.querySelectorAll('.device-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var frame = _container.querySelector('.preview-frame');
                if (frame) {
                    frame.classList.remove('preview-desktop', 'preview-tablet', 'preview-mobile');
                    frame.classList.add('preview-' + btn.getAttribute('data-device'));
                }
            });
        });
        var zoomVal = _qs('#zoomVal');
        _on('#zoomIn', 'click', function () { _zoom = Math.min(_zoom + 10, 200); _applyZoom(); if (zoomVal) zoomVal.textContent = _zoom + '%'; });
        _on('#zoomOut', 'click', function () { _zoom = Math.max(_zoom - 10, 50); _applyZoom(); if (zoomVal) zoomVal.textContent = _zoom + '%'; });
        _on('#bfsFullscreen', 'click', function () {
            if (!document.fullscreenElement) _container.requestFullscreen().catch(function () {});
            else document.exitFullscreen();
        });
    }

    function _applyZoom() {
        var frame = _container ? _container.querySelector('.preview-frame') : null;
        if (frame) { frame.style.transform = 'scale(' + (_zoom / 100) + ')'; frame.style.transformOrigin = 'top center'; }
    }

    /* ─── Style listeners ─── */
    function _setupStyleListeners() {
        if (!_container) return;
        _on('.editor-text-input', 'input', function () {
            if (!_selectedId) return;
            _postIframe('arbel-set-text', { id: _selectedId, text: this.value });
            _setOv(_selectedId, 'text', this.value);
        });
        _on('#editorFontSelect', 'change', function () {
            if (!_selectedId) return;
            var font = this.value;
            if (font) {
                _postIframe('arbel-load-font', { font: font });
                _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontFamily', value: '"' + font + '", sans-serif' });
            } else {
                _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontFamily', value: '' });
            }
            _setOv(_selectedId, 'fontFamily', font ? '"' + font + '", sans-serif' : '');
        });
        _on('#editorFontSize', 'input', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontSize', value: this.value + 'px' }); _setOv(_selectedId, 'fontSize', this.value + 'px'); } });
        _on('#editorFontWeight', 'change', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontWeight', value: this.value }); _setOv(_selectedId, 'fontWeight', this.value); } });
        _on('#editorLineHeight', 'input', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'lineHeight', value: this.value }); _setOv(_selectedId, 'lineHeight', this.value); } });
        _on('#editorLetterSpacing', 'input', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'letterSpacing', value: this.value + 'px' }); _setOv(_selectedId, 'letterSpacing', this.value + 'px'); } });
        _container.querySelectorAll('.editor-align-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!_selectedId) return;
                _container.querySelectorAll('.editor-align-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _postIframe('arbel-set-style', { id: _selectedId, prop: 'textAlign', value: btn.getAttribute('data-align') });
                _setOv(_selectedId, 'textAlign', btn.getAttribute('data-align'));
            });
        });
        _on('#editorTextColor', 'input', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'color', value: this.value }); _setOv(_selectedId, 'color', this.value); } });
        _on('#editorBgColor', 'input', function () { if (_selectedId) { _postIframe('arbel-set-style', { id: _selectedId, prop: 'backgroundColor', value: this.value }); _setOv(_selectedId, 'backgroundColor', this.value); } });
        _container.querySelectorAll('.editor-spacing').forEach(function (inp) {
            inp.addEventListener('input', function () {
                if (!_selectedId) return;
                var prop = inp.getAttribute('data-prop');
                _postIframe('arbel-set-style', { id: _selectedId, prop: prop, value: inp.value + 'px' });
                _setOv(_selectedId, prop, inp.value + 'px');
            });
        });
        _on('#editorRadius', 'input', function () { if (_selectedId) { _qs('#editorRadiusVal').textContent = this.value + 'px'; _postIframe('arbel-set-style', { id: _selectedId, prop: 'borderRadius', value: this.value + 'px' }); _setOv(_selectedId, 'borderRadius', this.value + 'px'); } });
        _on('#editorOpacity', 'input', function () { if (_selectedId) { _qs('#editorOpacityVal').textContent = this.value + '%'; _postIframe('arbel-set-style', { id: _selectedId, prop: 'opacity', value: (this.value / 100).toString() }); _setOv(_selectedId, 'opacity', (this.value / 100).toString()); } });
        _on('#editorBackdrop', 'change', function () { if (_selectedId) { _postIframe('arbel-set-backdrop', { id: _selectedId, value: this.value }); _setOv(_selectedId, 'backdrop', this.value); } });
        _on('#editorShadow', 'change', function () { if (_selectedId) { _postIframe('arbel-set-shadow', { id: _selectedId, value: this.value }); _setOv(_selectedId, 'shadow', this.value); } });
    }

    /* ─── Layer ordering actions ─── */
    function _setupLayerActions() {
        if (!_container) return;
        _on('#layerBringFront', 'click', function () { _setZIndex(9999); });
        _on('#layerForward', 'click', function () { _adjustZIndex(1); });
        _on('#layerBackward', 'click', function () { _adjustZIndex(-1); });
        _on('#layerSendBack', 'click', function () { _setZIndex(-1); });
        _on('#layerToggleVis', 'click', function () {
            if (!_selectedId) return;
            var cur = (_overrides[_selectedId] && _overrides[_selectedId].visibility) || 'visible';
            var next = cur === 'visible' ? 'hidden' : 'visible';
            _postIframe('arbel-set-visibility', { id: _selectedId, value: next });
            _setOv(_selectedId, 'visibility', next);
        });
        _on('#layerToggleLock', 'click', function () {
            if (!_selectedId) return;
            var cur = (_overrides[_selectedId] && _overrides[_selectedId].locked);
            _setOv(_selectedId, 'locked', !cur);
            _postIframe('arbel-set-pointer-events', { id: _selectedId, value: !cur ? 'none' : '' });
        });
        _on('#editorZIndex', 'input', function () {
            if (!_selectedId) return;
            var val = parseInt(this.value);
            if (!isNaN(val)) { _postIframe('arbel-set-zindex', { id: _selectedId, value: val }); _setOv(_selectedId, 'zIndex', val); }
        });
        _on('#editorZFront', 'click', function () { _setZIndex(9999); });
        _on('#editorZBack', 'click', function () { _setZIndex(-1); });
    }
    function _setZIndex(val) {
        if (!_selectedId) return;
        _postIframe('arbel-set-zindex', { id: _selectedId, value: val });
        _setOv(_selectedId, 'zIndex', val);
        var zi = _qs('#editorZIndex'); if (zi) zi.value = val;
    }
    function _adjustZIndex(delta) {
        if (!_selectedId) return;
        var cur;
        if (_overrides[_selectedId] && _overrides[_selectedId].zIndex !== undefined) {
            cur = _overrides[_selectedId].zIndex;
        } else {
            cur = 0;
            for (var i = 0; i < _lastTree.length; i++) {
                if (_lastTree[i].id === _selectedId) {
                    cur = _lastTree[i].zIndex === 'auto' ? 0 : (parseInt(_lastTree[i].zIndex) || 0);
                    break;
                }
            }
        }
        _setZIndex(cur + delta);
    }

    /* ─── Text formatting ─── */
    function _setupTextFormatting() {
        if (!_container) return;
        _container.querySelectorAll('.editor-format-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!_selectedId) return;
                var fmt = btn.getAttribute('data-format');
                btn.classList.toggle('active');
                var active = btn.classList.contains('active');
                if (fmt === 'bold') { _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontWeight', value: active ? '700' : '' }); _setOv(_selectedId, 'fontWeight', active ? '700' : ''); }
                if (fmt === 'italic') { _postIframe('arbel-set-style', { id: _selectedId, prop: 'fontStyle', value: active ? 'italic' : '' }); _setOv(_selectedId, 'fontStyle', active ? 'italic' : ''); }
                if (fmt === 'underline') { _postIframe('arbel-set-style', { id: _selectedId, prop: 'textDecoration', value: active ? 'underline' : '' }); _setOv(_selectedId, 'textDecoration', active ? 'underline' : ''); }
                if (fmt === 'strikethrough') { _postIframe('arbel-set-style', { id: _selectedId, prop: 'textDecoration', value: active ? 'line-through' : '' }); _setOv(_selectedId, 'textDecoration', active ? 'line-through' : ''); }
                if (fmt === 'uppercase') { _postIframe('arbel-set-style', { id: _selectedId, prop: 'textTransform', value: active ? 'uppercase' : '' }); _setOv(_selectedId, 'textTransform', active ? 'uppercase' : ''); }
            });
        });
    }

    /* ─── Border listeners ─── */
    function _setupBorderListeners() {
        if (!_container) return;
        function applyBorder() {
            if (!_selectedId) return;
            var w = _qs('#editorBorderWidth'), s = _qs('#editorBorderStyle'), c = _qs('#editorBorderColor');
            var val = (w ? w.value : '0') + 'px ' + (s ? s.value : 'none') + ' ' + (c ? c.value : '#646cff');
            _postIframe('arbel-set-style', { id: _selectedId, prop: 'border', value: val });
            _setOv(_selectedId, 'border', val);
        }
        _on('#editorBorderWidth', 'input', applyBorder);
        _on('#editorBorderStyle', 'change', applyBorder);
        _on('#editorBorderColor', 'input', applyBorder);
    }

    /* ─── Transform (rotate) listeners ─── */
    function _setupTransformListeners() {
        if (!_container) return;
        _on('#editorRotate', 'input', function () {
            if (!_selectedId) return;
            _qs('#editorRotateVal').textContent = this.value + '\u00B0';
            _postIframe('arbel-set-style', { id: _selectedId, prop: 'transform', value: 'rotate(' + this.value + 'deg)' });
            _setOv(_selectedId, 'transform', 'rotate(' + this.value + 'deg)');
        });
    }

    /* ─── Link listeners ─── */
    function _setupLinkListeners() {
        if (!_container) return;
        _on('#editorLinkSet', 'click', function () {
            if (!_selectedId) return;
            var url = _qs('#editorLinkUrl'); if (!url || !url.value) return;
            _postIframe('arbel-set-link', { id: _selectedId, href: url.value });
            _setOv(_selectedId, 'href', url.value);
        });
        _on('#editorLinkRemove', 'click', function () {
            if (!_selectedId) return;
            _postIframe('arbel-remove-link', { id: _selectedId });
            _setOv(_selectedId, 'href', '');
            var url = _qs('#editorLinkUrl'); if (url) url.value = '';
        });
    }

    /* ─── Image filter listeners ─── */
    function _setupImageFilterListeners() {
        if (!_container) return;
        function applyFilters() {
            if (!_selectedId) return;
            var b = _qs('#editorFilterBrightness'), c = _qs('#editorFilterContrast'), s = _qs('#editorFilterSaturate'), bl = _qs('#editorFilterBlur');
            var parts = [];
            if (b && b.value !== '100') parts.push('brightness(' + b.value + '%)');
            if (c && c.value !== '100') parts.push('contrast(' + c.value + '%)');
            if (s && s.value !== '100') parts.push('saturate(' + s.value + '%)');
            if (bl && bl.value !== '0') parts.push('blur(' + bl.value + 'px)');
            var val = parts.length ? parts.join(' ') : 'none';
            _postIframe('arbel-set-filter', { id: _selectedId, value: val });
            _setOv(_selectedId, 'filter', val);
        }
        _on('#editorFilterBrightness', 'input', function () { _qs('#editorFilterBrightnessVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterContrast', 'input', function () { _qs('#editorFilterContrastVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterSaturate', 'input', function () { _qs('#editorFilterSaturateVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterBlur', 'input', function () { _qs('#editorFilterBlurVal').textContent = this.value + 'px'; applyFilters(); });
        _on('#editorObjectFit', 'change', function () {
            if (!_selectedId) return;
            _postIframe('arbel-set-style', { id: _selectedId, prop: 'objectFit', value: this.value });
            _setOv(_selectedId, 'objectFit', this.value);
        });
    }

    /* ─── Animation listeners ─── */
    function _setupAnimationListeners() {
        if (!_container) return;
        _on('.editor-anim-select', 'change', function () { if (_selectedId) { _postIframe('arbel-set-animation', { id: _selectedId, animation: this.value }); _setOv(_selectedId, 'animation', this.value); } });
        _on('.editor-preview-anim', 'click', function () { if (_selectedId) { var sel = _qs('.editor-anim-select'); _postIframe('arbel-preview-animation', { id: _selectedId, animation: sel ? sel.value : 'none' }); } });
        _on('#editorContinuous', 'change', function () { if (_selectedId) { _postIframe('arbel-set-continuous', { id: _selectedId, animation: this.value }); _setOv(_selectedId, 'continuous', this.value); } });
        _on('.editor-hover-select', 'change', function () { if (_selectedId) { _postIframe('arbel-set-hover', { id: _selectedId, hover: this.value }); _setOv(_selectedId, 'hover', this.value); } });
    }

    /* ─── Effect listeners ─── */
    var _effectPreviewRaf = null;

    function _getEffectTarget() {
        if (_selectedId) return _selectedId;
        // Fallback: first section element in the tree
        var tree = _qs('#editorTree');
        if (tree && tree.children[0]) return tree.children[0].getAttribute('data-tree-id');
        return 'hero'; // last resort
    }

    function _reapplyEffect() {
        var targetId = _getEffectTarget();
        if (!targetId) return;
        var sel = _qs('.editor-effect-select');
        var int = _qs('#editorEffectIntensity');
        var c1 = _qs('#editorEffectColor1');
        var c2 = _qs('#editorEffectColor2');
        var effect = sel ? sel.value : 'none';
        // Scale intensity: slider 10-100 maps to 20-300 particles
        var rawInt = int ? parseInt(int.value) : 50;
        var scaledInt = Math.round(rawInt * 3);
        _postIframe('arbel-set-effect', {
            id: targetId, effect: effect,
            intensity: scaledInt,
            color1: c1 ? _hexToRgb(c1.value) : '100,108,255',
            color2: c2 ? _hexToRgb(c2.value) : '11,218,81'
        });
        _setOv(targetId, 'effect', effect);
        _updateEffectPreview();
    }

    function _updateEffectPreview() {
        var cv = _qs('#effectPreview'); if (!cv) return;
        var ctx = cv.getContext('2d');
        if (_effectPreviewRaf) cancelAnimationFrame(_effectPreviewRaf);
        var sel = _qs('.editor-effect-select');
        var intEl = _qs('#editorEffectIntensity');
        var c1El = _qs('#editorEffectColor1');
        var c2El = _qs('#editorEffectColor2');
        var effect = sel ? sel.value : 'none';
        if (effect === 'none') { ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
        var count = Math.min(Math.round((intEl ? parseInt(intEl.value) : 50) * 0.6), 80);
        var col1 = c1El ? _hexToRgb(c1El.value) : '100,108,255';
        var col2 = c2El ? _hexToRgb(c2El.value) : '11,218,81';
        var cw = cv.width, ch = cv.height;
        var ps = [];
        for (var i = 0; i < count; i++) ps.push({ x: Math.random() * cw, y: Math.random() * ch, vx: (Math.random() - .5) * .8, vy: (Math.random() - .5) * .8, sz: Math.random() * 3 + 1, a: Math.random() * .5 + .2, p: Math.random() * 6.28, rot: Math.random() * 360, col: Math.random() > .5 ? col1 : col2 });
        if (effect === 'bubbles') ps.forEach(function (p) { p.vy = -(Math.random() + .3); p.sz = Math.random() * 5 + 2; });
        if (effect === 'snow') ps.forEach(function (p) { p.vy = Math.random() * .4 + .15; p.sz = Math.random() * 2.5 + 1; });
        if (effect === 'fireflies') ps = ps.slice(0, Math.min(count, 15));
        if (effect === 'rain') ps.forEach(function (p) { p.vy = Math.random() * 3 + 2; p.sz = 1; });
        function draw() {
            var t = Date.now() * .001;
            ctx.clearRect(0, 0, cw, ch); ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, cw, ch);
            if (effect === 'gradient') { var g = ctx.createLinearGradient(cw * (.5 + .5 * Math.sin(t * .5)), 0, cw * (.5 + .5 * Math.cos(t * .3)), ch); g.addColorStop(0, 'rgba(' + col1 + ',.2)'); g.addColorStop(.5, 'rgba(' + col2 + ',.1)'); g.addColorStop(1, 'rgba(' + col1 + ',.2)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'waves' || effect === 'sineWaves') { for (var w = 0; w < 4; w++) { ctx.strokeStyle = 'rgba(' + col1 + ',' + (.2 - w * .04) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); for (var x = 0; x <= cw; x += 3) { var y = ch * .5 + Math.sin(x * .02 + t + w) * (10 + w * 5); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'aurora') { for (var ab = 0; ab < 4; ab++) { ctx.fillStyle = 'rgba(' + (ab % 2 === 0 ? col1 : col2) + ',0.06)'; ctx.beginPath(); for (var ax = 0; ax <= cw; ax += 4) { var ay = ch * .3 + Math.sin(ax * .008 + t * .5 + ab * 2) * ch * .15; ax === 0 ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay); } ctx.lineTo(cw, ch); ctx.lineTo(0, ch); ctx.fill(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'noise') { var imd = ctx.createImageData(cw, ch); var d = imd.data; for (var j = 0; j < d.length; j += 4) { var v = Math.random() * 40; d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 15; } ctx.putImageData(imd, 0, 0); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'blobs' || effect === 'morphBlob') { for (var b = 0; b < 3; b++) { ctx.fillStyle = 'rgba(' + (b % 2 === 0 ? col1 : col2) + ',0.08)'; ctx.beginPath(); var bx = cw * (.25 + b * .2) + Math.sin(t * .5 + b) * 20, by = ch * (.3 + b * .2) + Math.cos(t * .4 + b) * 15, br = 25 + Math.sin(t + b) * 8; for (var ba = 0; ba < 6.28; ba += .1) { var rr = br + Math.sin(ba * 3 + t + b) * 8; ba === 0 ? ctx.moveTo(bx + Math.cos(ba) * rr, by + Math.sin(ba) * rr) : ctx.lineTo(bx + Math.cos(ba) * rr, by + Math.sin(ba) * rr); } ctx.closePath(); ctx.fill(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'geometric') { ctx.strokeStyle = 'rgba(' + col1 + ',0.2)'; ctx.lineWidth = 0.5; for (var gi = 0; gi < 10; gi++) { var gx = cw * .1 + gi * cw / 10 + Math.sin(t + gi) * 5, gy = ch * .5 + Math.cos(t * .7 + gi) * ch * .25, gsz = 8 + Math.sin(t + gi) * 3; ctx.beginPath(); for (var gs = 0; gs < 6; gs++) { var ga = gs * Math.PI / 3 + t * .2; ctx.lineTo(gx + Math.cos(ga) * gsz, gy + Math.sin(ga) * gsz); } ctx.closePath(); ctx.stroke(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'cube' || effect === 'sphere' || effect === 'pyramid' || effect === 'torus' || effect === 'cylinder' || effect === 'crystal' || effect === 'icosahedron' || effect === 'grid3d') {
                var cx3 = cw / 2, cy3 = ch / 2, sz3 = Math.min(cw, ch) * 0.3;
                var cosA = Math.cos(t * 0.7), sinA = Math.sin(t * 0.7), cosB = Math.cos(t * 0.5), sinB = Math.sin(t * 0.5);
                function proj(x, y, z) { var x1 = x * cosA - z * sinA, z1 = x * sinA + z * cosA, y1 = y * cosB - z1 * sinB, z2 = y * sinB + z1 * cosB; var sc = 1 / (1 + z2 * 0.003); return { x: cx3 + x1 * sc, y: cy3 + y1 * sc, z: z2 }; }
                function edg(p1, p2, c, a) { ctx.strokeStyle = 'rgba(' + c + ',' + a + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
                function dt(p, c, r) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.28); ctx.fill(); }
                if (effect === 'cube') { var s = sz3 * .4, vts = [[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s], [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]]; var pv = vts.map(function (v) { return proj(v[0], v[1], v[2]); }); [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { edg(pv[e[0]], pv[e[1]], col1, 0.6); }); pv.forEach(function (p) { dt(p, 'rgba(' + col2 + ',0.8)', 2); }); }
                else if (effect === 'sphere') { for (var sli = 0; sli < 40; sli++) { var phi = Math.PI * sli / 20, theta = 2 * Math.PI * ((sli * 7) % 40) / 40; var sx = sz3 * 0.4 * Math.sin(phi) * Math.cos(theta), sy = sz3 * 0.4 * Math.sin(phi) * Math.sin(theta), sz4 = sz3 * 0.4 * Math.cos(phi); var sp = proj(sx, sy, sz4); var bright = 0.3 + 0.5 * ((sp.z + sz3) / (2 * sz3)); dt(sp, 'rgba(' + (sli % 2 === 0 ? col1 : col2) + ',' + bright + ')', 1.5 + bright); } }
                else if (effect === 'pyramid') { var ph = sz3 * 0.5, pb = sz3 * 0.35; var pvt = [[0, -ph, 0], [-pb, ph * 0.5, -pb], [pb, ph * 0.5, -pb], [pb, ph * 0.5, pb], [-pb, ph * 0.5, pb]]; var ppv = pvt.map(function (v) { return proj(v[0], v[1], v[2]); }); [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]].forEach(function (e) { edg(ppv[e[0]], ppv[e[1]], col1, 0.5); }); ppv.forEach(function (p) { dt(p, 'rgba(' + col2 + ',0.8)', 2); }); }
                else if (effect === 'torus') { var R = sz3 * 0.3, r3 = sz3 * 0.12; for (var ti = 0; ti < 60; ti++) { var u = 2 * Math.PI * ti / 30, v3 = 2 * Math.PI * ((ti * 3) % 60) / 60; var tx = (R + r3 * Math.cos(v3)) * Math.cos(u), ty = r3 * Math.sin(v3), tz = (R + r3 * Math.cos(v3)) * Math.sin(u); var tp = proj(tx, ty, tz); dt(tp, 'rgba(' + (ti % 2 === 0 ? col1 : col2) + ',0.6)', 1.5); } }
                else if (effect === 'cylinder') { var cr = sz3 * 0.25, ch2 = sz3 * 0.5; for (var ci = 0; ci < 24; ci++) { var ca = 2 * Math.PI * ci / 12; var ptop = proj(Math.cos(ca) * cr, -ch2 * 0.5, Math.sin(ca) * cr); var pbot = proj(Math.cos(ca) * cr, ch2 * 0.5, Math.sin(ca) * cr); dt(ptop, 'rgba(' + col1 + ',0.7)', 1.5); dt(pbot, 'rgba(' + col2 + ',0.7)', 1.5); if (ci < 12) edg(ptop, pbot, col1, 0.3); } }
                else if (effect === 'crystal') { var cs = sz3 * 0.2, ct = sz3 * 0.5; var cvts = []; for (var cv = 0; cv < 6; cv++) { var ang = cv * Math.PI / 3; cvts.push([Math.cos(ang) * cs, 0, Math.sin(ang) * cs]); } cvts.push([0, -ct, 0]); cvts.push([0, ct * 0.5, 0]); var cpv = cvts.map(function (v) { return proj(v[0], v[1], v[2]); }); for (var ce = 0; ce < 6; ce++) { edg(cpv[ce], cpv[(ce + 1) % 6], col1, 0.4); edg(cpv[ce], cpv[6], col2, 0.5); edg(cpv[ce], cpv[7], col1, 0.3); } cpv.forEach(function (p) { dt(p, 'rgba(' + col2 + ',0.9)', 2); }); }
                else if (effect === 'icosahedron') { var phi3 = (1 + Math.sqrt(5)) / 2, ir = sz3 * 0.25; var ivts = [[-1, phi3, 0], [1, phi3, 0], [-1, -phi3, 0], [1, -phi3, 0], [0, -1, phi3], [0, 1, phi3], [0, -1, -phi3], [0, 1, -phi3], [phi3, 0, -1], [phi3, 0, 1], [-phi3, 0, -1], [-phi3, 0, 1]]; var ipv = ivts.map(function (v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return proj(v[0] / l * ir, v[1] / l * ir, v[2] / l * ir); }); [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]].forEach(function (f) { edg(ipv[f[0]], ipv[f[1]], col1, 0.3); edg(ipv[f[1]], ipv[f[2]], col1, 0.3); edg(ipv[f[2]], ipv[f[0]], col1, 0.3); }); ipv.forEach(function (p) { dt(p, 'rgba(' + col2 + ',0.8)', 1.5); }); }
                else if (effect === 'grid3d') { var gs = sz3 * 0.15, gc = 4; for (var gx = -gc; gx <= gc; gx += 2) for (var gy = -gc; gy <= gc; gy += 2) for (var gz = -gc; gz <= gc; gz += 2) { var gp = proj(gx * gs, gy * gs, gz * gs); var ga = 0.15 + 0.3 * ((gp.z + sz3 * 2) / (sz3 * 4)); dt(gp, 'rgba(' + ((gx + gy + gz) % 2 === 0 ? col1 : col2) + ',' + ga + ')', 1.2); } }
                _effectPreviewRaf = requestAnimationFrame(draw); return;
            }
            if (effect === 'orbits') { for (var oi = 0; oi < 6; oi++) { var oa = t * .5 + oi * Math.PI / 3, or2 = 15 + oi * 8, ox = cw / 2 + Math.cos(oa) * or2, oy = ch / 2 + Math.sin(oa) * or2; ctx.fillStyle = 'rgba(' + col1 + ',' + (.5 - oi * .06) + ')'; ctx.beginPath(); ctx.arc(ox, oy, 2, 0, 6.28); ctx.fill(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'dna') { for (var di = 0; di < 12; di++) { var dx = cw * .15 + di * (cw * .7 / 12), dy1 = ch / 2 + Math.sin(di * .5 + t) * 15, dy2 = ch / 2 - Math.sin(di * .5 + t) * 15; ctx.fillStyle = 'rgba(' + col1 + ',0.5)'; ctx.beginPath(); ctx.arc(dx, dy1, 2, 0, 6.28); ctx.fill(); ctx.fillStyle = 'rgba(' + col2 + ',0.5)'; ctx.beginPath(); ctx.arc(dx, dy2, 2, 0, 6.28); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(dx, dy1); ctx.lineTo(dx, dy2); ctx.stroke(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'confetti') { ps.forEach(function (p) { p.y += 1; p.x += Math.sin(p.p) * .3; p.rot += 2; p.p += .03; if (p.y > ch + 5) { p.y = -5; p.x = Math.random() * cw; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180); ctx.fillStyle = 'rgba(' + p.col + ',' + p.a + ')'; ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'matrix') { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = 'rgba(0,255,65,0.6)'; ctx.font = '8px monospace'; ps.forEach(function (p) { ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), p.x, p.y); p.y += 8; if (p.y > ch) { p.y = 0; p.x = Math.random() * cw; } }); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'rain') { ctx.strokeStyle = 'rgba(140,180,255,0.4)'; ctx.lineWidth = 1; ps.forEach(function (p) { p.y += p.vy; if (p.y > ch + 5) { p.y = -5; p.x = Math.random() * cw; } ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - .5, p.y + 6); ctx.stroke(); }); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'bokeh') { ps.forEach(function (p) { p.y -= .15; p.x += Math.sin(p.p) * .2; p.p += .01; if (p.y < -10) { p.y = ch + 10; p.x = Math.random() * cw; } ctx.fillStyle = 'rgba(' + p.col + ',' + (p.a * .3) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 2, 0, 6.28); ctx.fill(); }); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'plasma') { for (var py = 0; py < ch; py += 4) { for (var px = 0; px < cw; px += 4) { var v = Math.sin(px * .03 + t) + Math.sin(py * .03 + t * .7) + Math.sin((px + py) * .02 + t * .5); v = (v + 3) / 6; ctx.fillStyle = 'rgba(' + col1 + ',' + (v * .15) + ')'; ctx.fillRect(px, py, 4, 4); } } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'vortex') { for (var vi = 0; vi < 40; vi++) { var va = vi * .3 + t * 2, vd = vi * 1.5; var vx = cw / 2 + Math.cos(va) * vd, vy2 = ch / 2 + Math.sin(va) * vd * .6; ctx.fillStyle = 'rgba(' + (vi % 2 === 0 ? col1 : col2) + ',' + (0.4 - vi * .008) + ')'; ctx.beginPath(); ctx.arc(vx, vy2, 1.5, 0, 6.28); ctx.fill(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'sparkle') { ps.forEach(function (p) { p.a = .1 + Math.abs(Math.sin(p.p)) * .6; p.p += .05 + Math.random() * .05; ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')'; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.p) * 2, p.y + Math.cos(p.p) * 2, p.sz * .8, 0, 6.28); ctx.fill(); }); _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'smoke') { for (var si = 0; si < 5; si++) { var sx = cw * (.2 + si * .15) + Math.sin(t + si) * 15, sy = ch - t * 10 % ch; var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 20 + si * 5); sg.addColorStop(0, 'rgba(180,180,180,0.06)'); sg.addColorStop(1, 'transparent'); ctx.fillStyle = sg; ctx.fillRect(0, 0, cw, ch); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            if (effect === 'ripple') { for (var ri2 = 0; ri2 < 5; ri2++) { var rr2 = ((t * 30 + ri2 * 20) % 60); ctx.strokeStyle = 'rgba(' + col1 + ',' + (.3 - rr2 / 200) + ')'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(cw / 2, ch / 2, rr2, 0, 6.28); ctx.stroke(); } _effectPreviewRaf = requestAnimationFrame(draw); return; }
            // Default: particles/stars/fireflies/bubbles
            ps.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.p += .02; if (p.x < -5) p.x = cw + 5; if (p.x > cw + 5) p.x = -5; if (p.y < -5) p.y = ch + 5; if (p.y > ch + 5) p.y = -5; var al = p.a; if (effect === 'stars' || effect === 'fireflies') al = p.a * (.5 + .5 * Math.sin(p.p)); if (effect === 'fireflies') { ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(100,255,100,' + al + ')'; ctx.fillStyle = 'rgba(100,255,100,' + al + ')'; } else if (effect === 'snow') { ctx.fillStyle = 'rgba(255,255,255,' + al + ')'; p.x += Math.sin(p.p) * .3; } else { ctx.fillStyle = 'rgba(' + p.col + ',' + al + ')'; } ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0; });
            _effectPreviewRaf = requestAnimationFrame(draw);
        }
        draw();
    }

    function _setupEffectListeners() {
        if (!_container) return;
        _on('.editor-effect-select', 'change', function () { _reapplyEffect(); });
        _on('#editorEffectIntensity', 'input', function () {
            var v = _qs('#editorEffectIntensityVal'); if (v) v.textContent = this.value + '%';
            _reapplyEffect();
        });
        _on('#editorEffectColor1', 'input', function () { _reapplyEffect(); });
        _on('#editorEffectColor2', 'input', function () { _reapplyEffect(); });
        // Initialize the preview
        setTimeout(function () { _updateEffectPreview(); }, 600);
    }

    /* ─── Video scroll layer ─── */
    function _setupVideoLayer() {
        if (!_container) return;
        var uploadZone = _qs('#videoUploadZone'), fileInput = _qs('#videoFileInput');
        var seqZone = _qs('#seqUploadZone'), seqInput = _qs('#seqFileInput');
        if (uploadZone && fileInput) {
            uploadZone.addEventListener('click', function () { fileInput.click(); });
            uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.style.borderColor = '#646cff'; });
            uploadZone.addEventListener('dragleave', function () { uploadZone.style.borderColor = ''; });
            uploadZone.addEventListener('drop', function (e) { e.preventDefault(); uploadZone.style.borderColor = ''; if (e.dataTransfer.files[0]) _extractVideoFrames(e.dataTransfer.files[0]); });
            fileInput.addEventListener('change', function () { if (fileInput.files[0]) _extractVideoFrames(fileInput.files[0]); });
        }
        if (seqZone && seqInput) {
            seqZone.addEventListener('click', function () { seqInput.click(); });
            seqZone.addEventListener('dragover', function (e) { e.preventDefault(); });
            seqZone.addEventListener('drop', function (e) { e.preventDefault(); _loadImageSequence(e.dataTransfer.files); });
            seqInput.addEventListener('change', function () { if (seqInput.files.length) _loadImageSequence(seqInput.files); });
        }
        _container.querySelectorAll('.video-preset-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _container.querySelectorAll('.video-preset-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _videoConfig.preset = btn.getAttribute('data-preset');
                _generatePresetFrames(btn.getAttribute('data-preset'));
            });
        });
        _on('#videoFps', 'input', function () {
            _videoConfig.fps = parseInt(this.value); _qs('#videoFpsVal').textContent = this.value;
            if (_videoConfig.active && _videoConfig.preset) {
                _generatePresetFrames(_videoConfig.preset);
            }
        });
        _on('#videoSpeed', 'input', function () {
            _videoConfig.speed = parseFloat(this.value); _qs('#videoSpeedVal').textContent = parseFloat(this.value).toFixed(1) + 'x';
            if (_videoConfig.active && _videoFrames.length && _iframe) _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig });
        });
        _on('#videoLoop', 'change', function () {
            _videoConfig.loop = this.checked;
            if (_videoConfig.active && _videoFrames.length && _iframe) _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig });
        });
        _on('#videoApplyBtn', 'click', function () {
            if (_videoFrames.length && _iframe) { _videoConfig.active = true; _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig }); }
        });
        _on('#videoRemove', 'click', function () {
            _videoFrames = []; _videoConfig.active = false;
            var p = _qs('#videoPreview'); if (p) p.style.display = 'none';
            if (_iframe) _postIframe('arbel-set-video-layer', { frames: [], config: _videoConfig });
        });
    }

    function _extractVideoFrames(file) {
        var video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        var progressEl = _qs('#videoProgress'), fillEl = _qs('#videoProgressFill'), textEl = _qs('#videoProgressText');
        if (progressEl) progressEl.style.display = '';
        if (textEl) textEl.textContent = 'Loading video...';
        video.addEventListener('error', function () {
            if (progressEl) progressEl.style.display = 'none';
            alert('Could not load video. Try a different MP4 or WebM file.');
        });
        video.addEventListener('loadedmetadata', function () {
            var duration = Math.min(video.duration, 30), fps = _videoConfig.fps, total = Math.floor(duration * fps);
            if (total <= 0) { if (progressEl) progressEl.style.display = 'none'; return; }
            var canvas = document.createElement('canvas');
            canvas.width = Math.min(video.videoWidth, 1280); canvas.height = Math.min(video.videoHeight, 720);
            var ctx = canvas.getContext('2d'), frames = [], idx = 0;
            function grabFrame() {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.75));
                idx++;
                if (fillEl) fillEl.style.width = Math.round((idx / total) * 100) + '%';
                if (textEl) textEl.textContent = 'Extracting: ' + idx + '/' + total;
                if (idx >= total) {
                    _videoFrames = frames; URL.revokeObjectURL(video.src);
                    if (progressEl) progressEl.style.display = 'none';
                    _showVideoPreview(frames, total, fps, duration);
                    _videoConfig.preset = null;
                    if (_iframe) { _videoConfig.active = true; _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig }); }
                    return;
                }
                video.currentTime = idx / fps;
            }
            video.addEventListener('seeked', grabFrame);
            /* Start extraction: seek to 0 or grab first frame directly */
            function beginExtract() {
                if (video.currentTime === 0) {
                    grabFrame();
                } else {
                    video.currentTime = 0;
                }
            }
            /* Wait for video to be playable before starting */
            if (video.readyState >= 2) { beginExtract(); }
            else { video.addEventListener('canplay', function onCanPlay() { video.removeEventListener('canplay', onCanPlay); beginExtract(); }); }
        });
        video.src = URL.createObjectURL(file);
        video.load();
    }

    function _loadImageSequence(files) {
        var sorted = Array.from(files).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
        var frames = [], loaded = 0;
        var progressEl = _qs('#videoProgress'), fillEl = _qs('#videoProgressFill'), textEl = _qs('#videoProgressText');
        if (progressEl) progressEl.style.display = '';
        sorted.forEach(function (file, i) {
            var reader = new FileReader();
            reader.onload = function (e) {
                frames[i] = e.target.result; loaded++;
                if (fillEl) fillEl.style.width = Math.round((loaded / sorted.length) * 100) + '%';
                if (textEl) textEl.textContent = 'Loading: ' + loaded + '/' + sorted.length;
                if (loaded === sorted.length) {
                    _videoFrames = frames.filter(Boolean);
                    _videoConfig.preset = null;
                    if (progressEl) progressEl.style.display = 'none';
                    _showVideoPreview(_videoFrames, _videoFrames.length, _videoConfig.fps, _videoFrames.length / _videoConfig.fps);
                    if (_iframe) { _videoConfig.active = true; _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig }); }
                }
            };
            reader.readAsDataURL(file);
        });
    }

    function _generatePresetFrames(preset) {
        var w = 640, h = 360, total = Math.max(30, Math.round((_videoConfig.fps || 24) * 5));
        var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d'), frames = [], idx = 0;
        var progressEl = _qs('#videoProgress'), fillEl = _qs('#videoProgressFill'), textEl = _qs('#videoProgressText');
        if (progressEl) progressEl.style.display = '';
        function gen() {
            if (idx >= total) {
            _videoFrames = frames; if (progressEl) progressEl.style.display = 'none';
            _showVideoPreview(frames, total, _videoConfig.fps, total / _videoConfig.fps);
            /* Auto-apply to preview */
            if (_iframe) { _videoConfig.active = true; _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig }); }
            return;
        }
            var t = idx / total;
            ctx.clearRect(0, 0, w, h);
            if (preset === 'cosmic') {
                ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, w, h);
                for (var i = 0; i < 80; i++) { var sx = (Math.sin(i * 47.3 + t * 2) * .5 + .5) * w, sy = (Math.cos(i * 31.7 + t * 1.5) * .5 + .5) * h;
                ctx.fillStyle = 'rgba(' + (150 + i % 100) + ',' + (100 + i % 50) + ',255,' + (.3 + Math.sin(i + t * 5) * .2) + ')';
                ctx.beginPath(); ctx.arc(sx, sy, 1 + Math.sin(i + t * 3) * .5, 0, 6.28); ctx.fill(); }
                var g = ctx.createRadialGradient(w * (.3 + t * .4), h * .5, 0, w * .5, h * .5, w * .6);
                g.addColorStop(0, 'rgba(100,50,200,0.08)'); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            } else if (preset === 'ocean') {
                ctx.fillStyle = '#020818'; ctx.fillRect(0, 0, w, h);
                for (var wv = 0; wv < 5; wv++) { ctx.strokeStyle = 'rgba(0,' + (100 + wv * 30) + ',255,' + (.1 - wv * .015) + ')'; ctx.lineWidth = 2; ctx.beginPath();
                for (var x = 0; x <= w; x += 4) { var y = h * (.3 + wv * .12) + Math.sin(x * .01 + t * 6.28 + wv) * 30; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
            } else if (preset === 'aurora') {
                ctx.fillStyle = '#050812'; ctx.fillRect(0, 0, w, h);
                for (var ab = 0; ab < 4; ab++) { ctx.fillStyle = 'rgba(' + (ab % 2 === 0 ? '0,200,100' : '100,0,200') + ',0.04)'; ctx.beginPath();
                for (var ax = 0; ax <= w; ax += 5) { var ay = h * .3 + Math.sin(ax * .006 + t * 6.28 + ab * 1.5) * h * .15; ax === 0 ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay); }
                ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill(); }
            } else if (preset === 'smoke') {
                ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);
                for (var si = 0; si < 8; si++) { var sx2 = w * (.2 + si * .08) + Math.sin(t * 6.28 + si) * 40, sy2 = h - h * t * .8 - si * 30;
                var g2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, 80 + si * 10); g2.addColorStop(0, 'rgba(150,150,150,0.05)'); g2.addColorStop(1, 'transparent'); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h); }
            } else if (preset === 'neon') {
                ctx.fillStyle = '#08080f'; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(100,108,255,0.15)'; ctx.lineWidth = .5;
                for (var gx = 0; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
                for (var gy = 0; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
                var ny = h * (1 - t); ctx.shadowBlur = 20; ctx.shadowColor = '#646cff'; ctx.strokeStyle = '#646cff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ny); ctx.lineTo(w, ny); ctx.stroke(); ctx.shadowBlur = 0;
            } else if (preset === 'nature') {
                ctx.fillStyle = '#051008'; ctx.fillRect(0, 0, w, h);
                for (var ni = 0; ni < 15; ni++) { var nx = (Math.sin(ni * 23.7 + t * 3) * .5 + .5) * w, ny2 = (ni * h / 15 + t * h) % (h + 20) - 10;
                ctx.fillStyle = 'rgba(30,' + (120 + ni * 8) + ',40,0.3)'; ctx.beginPath(); ctx.ellipse(nx, ny2, 5 + Math.sin(ni) * 2, 3, Math.sin(t * 6.28 + ni) * .5, 0, 6.28); ctx.fill(); }
            } else if (preset === 'glitch') {
                ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, w, h);
                for (var gi = 0; gi < 12; gi++) { var gy2 = Math.random() * h, gh2 = 2 + Math.random() * 8;
                ctx.fillStyle = 'rgba(' + (Math.random() > .5 ? '255,0,100' : '0,200,255') + ',' + (0.1 + Math.random() * 0.2) + ')';
                ctx.fillRect(Math.random() * w * .3, gy2, w * .4 + Math.random() * w * .3, gh2); }
                var gShift = Math.sin(t * 30) * 10;
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = 'rgba(255,0,80,0.05)'; ctx.fillRect(gShift, 0, w, h);
                ctx.fillStyle = 'rgba(0,200,255,0.05)'; ctx.fillRect(-gShift, 0, w, h);
                ctx.globalCompositeOperation = 'source-over';
            } else if (preset === 'fire') {
                ctx.fillStyle = '#0a0400'; ctx.fillRect(0, 0, w, h);
                for (var fi = 0; fi < 20; fi++) { var fx = w * (.2 + fi * 0.03) + Math.sin(t * 8 + fi * 2) * 20;
                var fy = h - (t * h * 0.7 + fi * 15 + Math.sin(fi * 3 + t * 5) * 20);
                var fr = 15 + fi * 2 + Math.sin(t * 6 + fi) * 8;
                var fGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
                fGrad.addColorStop(0, 'rgba(255,' + (100 + fi * 5) + ',0,0.15)');
                fGrad.addColorStop(1, 'transparent'); ctx.fillStyle = fGrad; ctx.fillRect(0, 0, w, h); }
            } else if (preset === 'rain') {
                ctx.fillStyle = '#060810'; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(140,180,255,0.3)'; ctx.lineWidth = 1;
                for (var ri = 0; ri < 60; ri++) { var rx = (ri * 17.3 + t * 50) % w;
                var ry = ((ri * 31.7 + t * 200) % (h + 40)) - 20;
                ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 1, ry + 12); ctx.stroke(); }
            } else if (preset === 'galaxy') {
                ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, w, h);
                for (var spi = 0; spi < 120; spi++) { var angle = spi * 0.15 + t * 3;
                var dist = spi * 1.5 + Math.sin(spi * 0.3) * 10;
                var spx = w / 2 + Math.cos(angle) * dist;
                var spy = h / 2 + Math.sin(angle) * dist * 0.6;
                var spBright = 0.2 + Math.sin(spi * 0.5 + t * 4) * 0.15;
                ctx.fillStyle = 'rgba(' + (180 + spi % 70) + ',' + (140 + spi % 80) + ',255,' + spBright + ')';
                ctx.beginPath(); ctx.arc(spx, spy, 1 + Math.random(), 0, 6.28); ctx.fill(); }
            }
            frames.push(canvas.toDataURL('image/jpeg', 0.7)); idx++;
            if (fillEl) fillEl.style.width = Math.round((idx / total) * 100) + '%';
            if (textEl) textEl.textContent = 'Generating: ' + idx + '/' + total;
            requestAnimationFrame(gen);
        }
        gen();
    }

    function _showVideoPreview(frames, count, fps, duration) {
        var preview = _qs('#videoPreview'), thumb = _qs('#videoThumb'), info = _qs('#videoInfo');
        if (!preview || !thumb) return;
        preview.style.display = '';
        var img = new Image();
        img.onload = function () { var ctx = thumb.getContext('2d'); ctx.drawImage(img, 0, 0, thumb.width, thumb.height); };
        img.src = frames[0];
        if (info) info.textContent = count + ' frames · ' + fps + 'fps · ' + duration.toFixed(1) + 's';
    }

    /* ─── Particle builder ─── */
    function _setupParticleBuilder() {
        if (!_container) return;
        var pCanvas = _qs('#pbuilderPreview'), pCtx = pCanvas ? pCanvas.getContext('2d') : null, pRaf = null;
        function getCfg() {
            return { type: (_qs('#pbuilderType') || {}).value || 'particles', count: parseInt((_qs('#pbuilderCount') || {}).value) || 50,
                size: parseInt((_qs('#pbuilderSize') || {}).value) || 4, speed: parseFloat((_qs('#pbuilderSpeed') || {}).value) || 1,
                glow: parseInt((_qs('#pbuilderGlow') || {}).value) || 5, color1: (_qs('#pbuilderColor1') || {}).value || '#646cff',
                color2: (_qs('#pbuilderColor2') || {}).value || '#0bda51', color3: (_qs('#pbuilderColor3') || {}).value || '#ff6b6b',
                connect: (_qs('#pbuilderConnect') || {}).checked !== false, interact: (_qs('#pbuilderInteract') || {}).checked !== false };
        }
        ['pbuilderCount', 'pbuilderSize', 'pbuilderSpeed', 'pbuilderGlow'].forEach(function (id) {
            _on('#' + id, 'input', function () { var v = _qs('#' + id + 'Val'); if (v) v.textContent = this.value; _updatePPreview(); });
        });
        _on('#pbuilderType', 'change', _updatePPreview);
        _on('#pbuilderColor1', 'input', _updatePPreview);
        _on('#pbuilderColor2', 'input', _updatePPreview);
        _on('#pbuilderColor3', 'input', _updatePPreview);

        function _updatePPreview() {
            if (!pCanvas || !pCtx) return;
            if (pRaf) cancelAnimationFrame(pRaf);
            var cfg = getCfg(), cw = pCanvas.width, ch = pCanvas.height, ps = [];
            var col1 = _hexToRgb(cfg.color1), col2 = _hexToRgb(cfg.color2), col3 = _hexToRgb(cfg.color3);
            var colArr = [col1, col2, col3];
            var hexArr = [cfg.color1, cfg.color2, cfg.color3];
            for (var i = 0; i < Math.min(cfg.count, 60); i++) ps.push({ x: Math.random() * cw, y: Math.random() * ch, vx: (Math.random() - .5) * cfg.speed, vy: (Math.random() - .5) * cfg.speed, sz: Math.random() * cfg.size + 1, col: colArr[i % 3], hexCol: hexArr[i % 3], rot: Math.random() * 360, p: Math.random() * 6.28, a: Math.random() * .5 + .2 });
            if (cfg.type === 'bubbles') ps.forEach(function (p) { p.vy = -(Math.random() + .3) * cfg.speed; p.sz = Math.random() * cfg.size + 3; });
            if (cfg.type === 'snow') ps.forEach(function (p) { p.vy = (Math.random() * .4 + .15) * cfg.speed; p.sz = Math.random() * cfg.size * .6 + 1; });
            if (cfg.type === 'fireflies') ps = ps.slice(0, Math.min(cfg.count, 20));
            if (cfg.type === 'rain') ps.forEach(function (p) { p.vy = (Math.random() * 3 + 2) * cfg.speed; p.sz = 1; });
            function draw() {
                var t = Date.now() * .001;
                pCtx.clearRect(0, 0, cw, ch); pCtx.fillStyle = '#0a0a0f'; pCtx.fillRect(0, 0, cw, ch);
                // Type-specific rendering
                if (cfg.type === 'gradient') { var g = pCtx.createLinearGradient(cw * (.5 + .5 * Math.sin(t * .5)), 0, cw * (.5 + .5 * Math.cos(t * .3)), ch); g.addColorStop(0, 'rgba(' + col1 + ',.2)'); g.addColorStop(.5, 'rgba(' + col2 + ',.1)'); g.addColorStop(1, 'rgba(' + col1 + ',.2)'); pCtx.fillStyle = g; pCtx.fillRect(0, 0, cw, ch); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'waves' || cfg.type === 'sineWaves') { for (var w = 0; w < 4; w++) { pCtx.strokeStyle = 'rgba(' + col1 + ',' + (.2 - w * .04) + ')'; pCtx.lineWidth = 1.5; pCtx.beginPath(); for (var x = 0; x <= cw; x += 3) { var y = ch * .5 + Math.sin(x * .02 + t + w) * (8 + w * 4); x === 0 ? pCtx.moveTo(x, y) : pCtx.lineTo(x, y); } pCtx.stroke(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'aurora') { for (var ab = 0; ab < 4; ab++) { pCtx.fillStyle = 'rgba(' + (ab % 2 === 0 ? col1 : col2) + ',0.06)'; pCtx.beginPath(); for (var ax = 0; ax <= cw; ax += 4) { var ay = ch * .3 + Math.sin(ax * .008 + t * .5 + ab * 2) * ch * .12; ax === 0 ? pCtx.moveTo(ax, ay) : pCtx.lineTo(ax, ay); } pCtx.lineTo(cw, ch); pCtx.lineTo(0, ch); pCtx.fill(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'noise') { var imd = pCtx.createImageData(cw, ch); var d = imd.data; for (var j = 0; j < d.length; j += 4) { var v = Math.random() * 40; d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 15; } pCtx.putImageData(imd, 0, 0); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'blobs' || cfg.type === 'morphBlob') { for (var b = 0; b < 3; b++) { pCtx.fillStyle = 'rgba(' + colArr[b % 3] + ',0.08)'; pCtx.beginPath(); var bx = cw * (.25 + b * .2) + Math.sin(t * .5 + b) * 15, by = ch * (.3 + b * .2) + Math.cos(t * .4 + b) * 10, br = 20 + Math.sin(t + b) * 6; for (var ba = 0; ba < 6.28; ba += .1) { var rr = br + Math.sin(ba * 3 + t + b) * 6; ba === 0 ? pCtx.moveTo(bx + Math.cos(ba) * rr, by + Math.sin(ba) * rr) : pCtx.lineTo(bx + Math.cos(ba) * rr, by + Math.sin(ba) * rr); } pCtx.closePath(); pCtx.fill(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'geometric') { pCtx.strokeStyle = 'rgba(' + col1 + ',0.2)'; pCtx.lineWidth = .5; for (var gi = 0; gi < 8; gi++) { var gx = cw * .1 + gi * cw / 8 + Math.sin(t + gi) * 5, gy = ch * .5 + Math.cos(t * .7 + gi) * ch * .2, gsz = 6 + Math.sin(t + gi) * 3; pCtx.beginPath(); for (var gs = 0; gs < 6; gs++) { var ga = gs * Math.PI / 3 + t * .2; pCtx.lineTo(gx + Math.cos(ga) * gsz, gy + Math.sin(ga) * gsz); } pCtx.closePath(); pCtx.stroke(); } pRaf = requestAnimationFrame(draw); return; }
                /* ── 3D Shapes (isometric projection) ── */
                if (cfg.type === 'cube' || cfg.type === 'sphere' || cfg.type === 'pyramid' || cfg.type === 'torus' || cfg.type === 'cylinder' || cfg.type === 'crystal' || cfg.type === 'icosahedron' || cfg.type === 'grid3d') {
                    var cx3 = cw / 2, cy3 = ch / 2, sz3 = Math.min(cw, ch) * 0.3;
                    var cosA = Math.cos(t * 0.7), sinA = Math.sin(t * 0.7), cosB = Math.cos(t * 0.5), sinB = Math.sin(t * 0.5);
                    function proj(x, y, z) {
                        var x1 = x * cosA - z * sinA, z1 = x * sinA + z * cosA;
                        var y1 = y * cosB - z1 * sinB, z2 = y * sinB + z1 * cosB;
                        var sc = 1 / (1 + z2 * 0.003);
                        return { x: cx3 + x1 * sc, y: cy3 + y1 * sc, z: z2 };
                    }
                    function edge(p1, p2, c, a) { pCtx.strokeStyle = 'rgba(' + c + ',' + a + ')'; pCtx.lineWidth = 0.8; pCtx.beginPath(); pCtx.moveTo(p1.x, p1.y); pCtx.lineTo(p2.x, p2.y); pCtx.stroke(); }
                    function dot(p, c, r) { pCtx.fillStyle = c; pCtx.beginPath(); pCtx.arc(p.x, p.y, r, 0, 6.28); pCtx.fill(); }
                    if (cfg.type === 'cube') {
                        var s = sz3 * 0.4, verts = [[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s], [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]];
                        var pv = verts.map(function (v) { return proj(v[0], v[1], v[2]); });
                        var edges3 = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
                        edges3.forEach(function (e2) { edge(pv[e2[0]], pv[e2[1]], col1, 0.6); });
                        pv.forEach(function (p) { dot(p, 'rgba(' + col2 + ',0.8)', 2); });
                    } else if (cfg.type === 'sphere') {
                        for (var sli = 0; sli < 40; sli++) {
                            var phi = Math.PI * sli / 20, theta = 2 * Math.PI * ((sli * 7) % 40) / 40;
                            var sx3 = sz3 * 0.4 * Math.sin(phi) * Math.cos(theta), sy3 = sz3 * 0.4 * Math.sin(phi) * Math.sin(theta), sz4 = sz3 * 0.4 * Math.cos(phi);
                            var sp = proj(sx3, sy3, sz4);
                            var bright = 0.3 + 0.5 * ((sp.z + sz3) / (2 * sz3));
                            dot(sp, 'rgba(' + (sli % 2 === 0 ? col1 : col2) + ',' + bright + ')', 1.5 + bright);
                        }
                    } else if (cfg.type === 'pyramid') {
                        var ph = sz3 * 0.5, pb = sz3 * 0.35;
                        var pverts = [[0, -ph, 0], [-pb, ph * 0.5, -pb], [pb, ph * 0.5, -pb], [pb, ph * 0.5, pb], [-pb, ph * 0.5, pb]];
                        var ppv = pverts.map(function (v) { return proj(v[0], v[1], v[2]); });
                        var pedges = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]];
                        pedges.forEach(function (e2) { edge(ppv[e2[0]], ppv[e2[1]], col1, 0.5); });
                        ppv.forEach(function (p) { dot(p, 'rgba(' + col2 + ',0.8)', 2); });
                    } else if (cfg.type === 'torus') {
                        var R = sz3 * 0.3, r3 = sz3 * 0.12;
                        for (var ti3 = 0; ti3 < 60; ti3++) {
                            var u = 2 * Math.PI * ti3 / 30, v3 = 2 * Math.PI * ((ti3 * 3) % 60) / 60;
                            var tx = (R + r3 * Math.cos(v3)) * Math.cos(u), ty = r3 * Math.sin(v3), tz = (R + r3 * Math.cos(v3)) * Math.sin(u);
                            var tp = proj(tx, ty, tz);
                            dot(tp, 'rgba(' + (ti3 % 3 === 0 ? col1 : ti3 % 3 === 1 ? col2 : col3) + ',0.6)', 1.5);
                        }
                    } else if (cfg.type === 'cylinder') {
                        var cr = sz3 * 0.25, ch3 = sz3 * 0.5;
                        for (var ci2 = 0; ci2 < 24; ci2++) {
                            var ca = 2 * Math.PI * ci2 / 12;
                            var ptop = proj(Math.cos(ca) * cr, -ch3 * 0.5, Math.sin(ca) * cr);
                            var pbot = proj(Math.cos(ca) * cr, ch3 * 0.5, Math.sin(ca) * cr);
                            dot(ptop, 'rgba(' + col1 + ',0.7)', 1.5);
                            dot(pbot, 'rgba(' + col2 + ',0.7)', 1.5);
                            if (ci2 < 12) edge(ptop, pbot, col1, 0.3);
                        }
                    } else if (cfg.type === 'crystal') {
                        var cs3 = sz3 * 0.2, ct = sz3 * 0.5;
                        var cverts = [];
                        for (var cv = 0; cv < 6; cv++) { var ang = cv * Math.PI / 3; cverts.push([Math.cos(ang) * cs3, 0, Math.sin(ang) * cs3]); }
                        cverts.push([0, -ct, 0]); cverts.push([0, ct * 0.5, 0]);
                        var cpv = cverts.map(function (v) { return proj(v[0], v[1], v[2]); });
                        for (var ce = 0; ce < 6; ce++) { edge(cpv[ce], cpv[(ce + 1) % 6], col1, 0.4); edge(cpv[ce], cpv[6], col2, 0.5); edge(cpv[ce], cpv[7], col1, 0.3); }
                        cpv.forEach(function (p) { dot(p, 'rgba(' + col2 + ',0.9)', 2); });
                    } else if (cfg.type === 'icosahedron') {
                        var phi3 = (1 + Math.sqrt(5)) / 2, ir = sz3 * 0.25;
                        var iverts = [[-1, phi3, 0], [1, phi3, 0], [-1, -phi3, 0], [1, -phi3, 0], [0, -1, phi3], [0, 1, phi3], [0, -1, -phi3], [0, 1, -phi3], [phi3, 0, -1], [phi3, 0, 1], [-phi3, 0, -1], [-phi3, 0, 1]];
                        var ipv = iverts.map(function (v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return proj(v[0] / l * ir, v[1] / l * ir, v[2] / l * ir); });
                        var ifaces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
                        ifaces.forEach(function (f) { edge(ipv[f[0]], ipv[f[1]], col1, 0.3); edge(ipv[f[1]], ipv[f[2]], col1, 0.3); edge(ipv[f[2]], ipv[f[0]], col1, 0.3); });
                        ipv.forEach(function (p) { dot(p, 'rgba(' + col2 + ',0.8)', 1.5); });
                    } else if (cfg.type === 'grid3d') {
                        var gs3 = sz3 * 0.15, gc = 4;
                        for (var gxi = -gc; gxi <= gc; gxi += 2) for (var gyi = -gc; gyi <= gc; gyi += 2) for (var gzi = -gc; gzi <= gc; gzi += 2) {
                            var gp = proj(gxi * gs3, gyi * gs3, gzi * gs3);
                            var ga2 = 0.15 + 0.3 * ((gp.z + sz3 * 2) / (sz3 * 4));
                            dot(gp, 'rgba(' + ((gxi + gyi + gzi) % 2 === 0 ? col1 : col2) + ',' + ga2 + ')', 1.2);
                        }
                    }
                    pRaf = requestAnimationFrame(draw); return;
                }
                if (cfg.type === 'orbits') { for (var oi = 0; oi < 6; oi++) { var oa = t * .5 + oi * Math.PI / 3, or2 = 12 + oi * 6, ox = cw / 2 + Math.cos(oa) * or2, oy = ch / 2 + Math.sin(oa) * or2; pCtx.fillStyle = 'rgba(' + col1 + ',' + (.5 - oi * .06) + ')'; pCtx.beginPath(); pCtx.arc(ox, oy, 2, 0, 6.28); pCtx.fill(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'dna') { for (var di = 0; di < 10; di++) { var dx = cw * .15 + di * (cw * .7 / 10), dy1 = ch / 2 + Math.sin(di * .5 + t) * 12, dy2 = ch / 2 - Math.sin(di * .5 + t) * 12; pCtx.fillStyle = 'rgba(' + col1 + ',0.5)'; pCtx.beginPath(); pCtx.arc(dx, dy1, 2, 0, 6.28); pCtx.fill(); pCtx.fillStyle = 'rgba(' + col2 + ',0.5)'; pCtx.beginPath(); pCtx.arc(dx, dy2, 2, 0, 6.28); pCtx.fill(); pCtx.strokeStyle = 'rgba(255,255,255,.08)'; pCtx.beginPath(); pCtx.moveTo(dx, dy1); pCtx.lineTo(dx, dy2); pCtx.stroke(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'confetti') { ps.forEach(function (p) { p.y += 1; p.x += Math.sin(p.p) * .3; p.rot += 2; p.p += .03; if (p.y > ch + 5) { p.y = -5; p.x = Math.random() * cw; } pCtx.save(); pCtx.translate(p.x, p.y); pCtx.rotate(p.rot * Math.PI / 180); pCtx.fillStyle = 'rgba(' + p.col + ',' + p.a + ')'; pCtx.fillRect(-2, -1, 4, 2); pCtx.restore(); }); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'matrix') { pCtx.fillStyle = 'rgba(0,0,0,.05)'; pCtx.fillRect(0, 0, cw, ch); pCtx.fillStyle = 'rgba(0,255,65,.6)'; pCtx.font = '8px monospace'; ps.forEach(function (p) { pCtx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), p.x, p.y); p.y += 8; if (p.y > ch) { p.y = 0; p.x = Math.random() * cw; } }); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'rain') { pCtx.strokeStyle = 'rgba(140,180,255,.4)'; pCtx.lineWidth = 1; ps.forEach(function (p) { p.y += p.vy; if (p.y > ch + 5) { p.y = -5; p.x = Math.random() * cw; } pCtx.beginPath(); pCtx.moveTo(p.x, p.y); pCtx.lineTo(p.x - .5, p.y + 6); pCtx.stroke(); }); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'bokeh') { ps.forEach(function (p) { p.y -= .15; p.x += Math.sin(p.p) * .2; p.p += .01; if (p.y < -10) { p.y = ch + 10; p.x = Math.random() * cw; } pCtx.fillStyle = 'rgba(' + p.col + ',' + (p.a * .3) + ')'; pCtx.beginPath(); pCtx.arc(p.x, p.y, p.sz * 2, 0, 6.28); pCtx.fill(); }); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'plasma') { for (var py = 0; py < ch; py += 4) { for (var px = 0; px < cw; px += 4) { var pv = Math.sin(px * .03 + t) + Math.sin(py * .03 + t * .7) + Math.sin((px + py) * .02 + t * .5); pv = (pv + 3) / 6; pCtx.fillStyle = 'rgba(' + col1 + ',' + (pv * .15) + ')'; pCtx.fillRect(px, py, 4, 4); } } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'vortex') { for (var vi = 0; vi < 30; vi++) { var va = vi * .3 + t * 2, vd = vi * 1.2; var vx = cw / 2 + Math.cos(va) * vd, vy2 = ch / 2 + Math.sin(va) * vd * .6; pCtx.fillStyle = 'rgba(' + (vi % 2 === 0 ? col1 : col2) + ',' + (.4 - vi * .01) + ')'; pCtx.beginPath(); pCtx.arc(vx, vy2, 1.5, 0, 6.28); pCtx.fill(); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'sparkle') { ps.forEach(function (p) { p.a = .1 + Math.abs(Math.sin(p.p)) * .6; p.p += .05; pCtx.fillStyle = 'rgba(255,255,255,' + p.a + ')'; pCtx.beginPath(); pCtx.arc(p.x + Math.sin(p.p) * 2, p.y + Math.cos(p.p) * 2, p.sz * .8, 0, 6.28); pCtx.fill(); }); pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'smoke') { for (var si = 0; si < 5; si++) { var sx = cw * (.15 + si * .15) + Math.sin(t + si) * 10; var sg = pCtx.createRadialGradient(sx, ch * .6, 0, sx, ch * .6, 15 + si * 5); sg.addColorStop(0, 'rgba(180,180,180,.06)'); sg.addColorStop(1, 'transparent'); pCtx.fillStyle = sg; pCtx.fillRect(0, 0, cw, ch); } pRaf = requestAnimationFrame(draw); return; }
                if (cfg.type === 'ripple') { for (var ri2 = 0; ri2 < 5; ri2++) { var rr2 = ((t * 30 + ri2 * 15) % 50); pCtx.strokeStyle = 'rgba(' + col1 + ',' + (.3 - rr2 / 170) + ')'; pCtx.lineWidth = .8; pCtx.beginPath(); pCtx.arc(cw / 2, ch / 2, rr2, 0, 6.28); pCtx.stroke(); } pRaf = requestAnimationFrame(draw); return; }
                // Default: particles/stars/fireflies/snow/bubbles
                ps.forEach(function (p) {
                    p.x += p.vx; p.y += p.vy; p.p += .02;
                    if (p.x < -5) p.x = cw + 5; if (p.x > cw + 5) p.x = -5; if (p.y < -5) p.y = ch + 5; if (p.y > ch + 5) p.y = -5;
                    var al = p.a; if (cfg.type === 'stars' || cfg.type === 'fireflies') al = p.a * (.5 + .5 * Math.sin(p.p));
                    if (cfg.type === 'fireflies') { pCtx.shadowBlur = cfg.glow; pCtx.shadowColor = 'rgba(100,255,100,' + al + ')'; pCtx.fillStyle = 'rgba(100,255,100,' + al + ')'; }
                    else if (cfg.type === 'snow') { pCtx.fillStyle = 'rgba(255,255,255,' + al + ')'; p.x += Math.sin(p.p) * .3; }
                    else { if (cfg.glow > 0) { pCtx.shadowBlur = cfg.glow; pCtx.shadowColor = p.hexCol; } pCtx.fillStyle = 'rgba(' + p.col + ',' + al + ')'; }
                    pCtx.beginPath(); pCtx.arc(p.x, p.y, p.sz, 0, 6.28); pCtx.fill(); pCtx.shadowBlur = 0;
                });
                if (cfg.connect) {
                    pCtx.strokeStyle = 'rgba(100,108,255,0.1)'; pCtx.lineWidth = .5;
                    for (var ci = 0; ci < ps.length; ci++) for (var cj = ci + 1; cj < ps.length; cj++) {
                        var cdx = ps[ci].x - ps[cj].x, cdy = ps[ci].y - ps[cj].y;
                        if (cdx * cdx + cdy * cdy < 3600) { pCtx.beginPath(); pCtx.moveTo(ps[ci].x, ps[ci].y); pCtx.lineTo(ps[cj].x, ps[cj].y); pCtx.stroke(); }
                    }
                }
                pRaf = requestAnimationFrame(draw);
            }
            draw();
        }
        setTimeout(_updatePPreview, 500);

        _on('#pbuilderApply', 'click', function () {
            if (!_selectedId || !_iframe) return;
            var cfg = getCfg();
            _postIframe('arbel-set-effect', { id: _selectedId, effect: cfg.type, intensity: cfg.count, color1: _hexToRgb(cfg.color1), color2: _hexToRgb(cfg.color2), color3: _hexToRgb(cfg.color3), size: cfg.size, speed: cfg.speed, glow: cfg.glow, connect: cfg.connect, interact: cfg.interact });
            _setOv(_selectedId, 'effect', cfg.type); _setOv(_selectedId, 'effectConfig', cfg);
        });
        _on('#pbuilderGlobal', 'click', function () {
            if (!_iframe) return;
            var cfg = getCfg(), tree = _qs('#editorTree');
            if (tree && tree.children[0]) {
                var firstId = tree.children[0].getAttribute('data-tree-id');
                if (firstId) {
                    _postIframe('arbel-set-effect', { id: firstId, effect: cfg.type, intensity: cfg.count, color1: _hexToRgb(cfg.color1), color2: _hexToRgb(cfg.color2), color3: _hexToRgb(cfg.color3), size: cfg.size, speed: cfg.speed, glow: cfg.glow, connect: cfg.connect, interact: cfg.interact });
                    _setOv(firstId, 'effect', cfg.type); _setOv(firstId, 'effectConfig', cfg);
                }
            }
        });
    }

    /* ─── Page management ─── */
    function _setupPageManagement() {
        if (!_container) return;
        _on('#addPageBtn', 'click', function () {
            var name = prompt('Page name:');
            if (!name || !name.trim()) return;
            _pages.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: name.trim() });
            _updatePageSelect();
        });
        _on('#delPageBtn', 'click', function () {
            if (_pages.length <= 1) return;
            var sel = _qs('#pageSelect'); if (!sel) return;
            if (sel.value === 'home') { alert('Cannot delete home page'); return; }
            if (!confirm('Delete page "' + sel.value + '"?')) return;
            _pages = _pages.filter(function (p) { return p.id !== sel.value; });
            _currentPage = 'home'; _updatePageSelect();
        });
        _on('#pageSelect', 'change', function () { _currentPage = this.value; });
    }

    function _updatePageSelect() {
        var sel = _qs('#pageSelect'); if (!sel) return;
        sel.innerHTML = '';
        _pages.forEach(function (p) { var opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; sel.appendChild(opt); });
        sel.value = _currentPage;
    }

    /* ─── Panel show/hide ─── */
    function _showPanel(info) {
        if (!_container) return;
        var idLabel = _qs('.editor-el-id'), tagLabel = _qs('.editor-el-tag');
        var textGroup = _qs('.editor-text-group'), textInput = _qs('.editor-text-input');
        var animSelect = _qs('.editor-anim-select'), hoverSelect = _qs('.editor-hover-select');
        var effectSelect = _qs('.editor-effect-select'), contSelect = _qs('#editorContinuous');
        if (idLabel) idLabel.textContent = info.id;
        if (tagLabel) tagLabel.textContent = '<' + info.tag + '>';
        if (textGroup) { textGroup.style.display = info.editable ? '' : 'none'; if (textInput && info.text !== null) textInput.value = info.text; }
        // Show image filter controls for img/video elements
        var imgGroup = _qs('#editorImgGroup');
        if (imgGroup) imgGroup.style.display = (info.tag === 'img' || info.tag === 'video') ? '' : 'none';
        if (animSelect) animSelect.value = info.currentAnimation || 'none';
        if (hoverSelect) hoverSelect.value = info.currentHover || 'none';
        if (effectSelect) effectSelect.value = info.currentEffect || 'none';
        if (contSelect) contSelect.value = info.currentContinuous || 'none';
        if (info.styles) {
            var st = info.styles;
            var fs = _qs('#editorFontSize'), fw = _qs('#editorFontWeight'), lh = _qs('#editorLineHeight'), ls = _qs('#editorLetterSpacing');
            var rad = _qs('#editorRadius'), radV = _qs('#editorRadiusVal'), opa = _qs('#editorOpacity'), opaV = _qs('#editorOpacityVal');
            if (fs) fs.value = st.fontSize; if (fw) fw.value = st.fontWeight;
            // Font family
            var ff = _qs('#editorFontSelect');
            if (ff && st.fontFamily) {
                var fam = st.fontFamily.replace(/["']/g, '').split(',')[0].trim();
                ff.value = fam; // Will silently fail if not in options, which is fine
            }
            if (lh) lh.value = typeof st.lineHeight === 'number' ? st.lineHeight.toFixed(1) : '';
            if (ls) ls.value = st.letterSpacing || '';
            if (rad) rad.value = st.borderRadius; if (radV) radV.textContent = st.borderRadius + 'px';
            if (opa) opa.value = st.opacity; if (opaV) opaV.textContent = st.opacity + '%';
            // Colors
            var tc = _qs('#editorTextColor'), bgc = _qs('#editorBgColor');
            if (tc && st.color) tc.value = _rgbToHex(st.color);
            if (bgc && st.backgroundColor) bgc.value = _rgbToHex(st.backgroundColor);
            // Border
            var bw = _qs('#editorBorderWidth'), bs = _qs('#editorBorderStyle'), bc = _qs('#editorBorderColor');
            if (bw) bw.value = st.borderWidth; if (bs) bs.value = st.borderStyle; if (bc && st.borderColor) bc.value = _rgbToHex(st.borderColor);
            // Z-index
            var zi = _qs('#editorZIndex');
            if (zi) zi.value = st.zIndex === 'auto' ? '' : st.zIndex;
            // Rotate
            var rot = _qs('#editorRotate'), rotV = _qs('#editorRotateVal');
            var rotVal = 0;
            if (st.transform && st.transform !== 'none') { var m = st.transform.match(/rotate\(([^)]+)deg\)/); if (m) rotVal = parseFloat(m[1]); }
            if (rot) rot.value = rotVal; if (rotV) rotV.textContent = rotVal + '\u00B0';
            // Link
            var linkUrl = _qs('#editorLinkUrl');
            if (linkUrl) linkUrl.value = st.href || '';
            // Text formatting buttons
            _container.querySelectorAll('.editor-format-btn').forEach(function (btn2) {
                var fmt = btn2.getAttribute('data-format');
                if (fmt === 'bold') btn2.classList.toggle('active', st.fontWeight === '700' || st.fontWeight === 'bold');
                if (fmt === 'italic') btn2.classList.toggle('active', st.fontStyle === 'italic');
                if (fmt === 'underline') btn2.classList.toggle('active', (st.textDecoration || '').indexOf('underline') >= 0);
                if (fmt === 'strikethrough') btn2.classList.toggle('active', (st.textDecoration || '').indexOf('line-through') >= 0);
            });
            _container.querySelectorAll('.editor-align-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-align') === st.textAlign); });
            _container.querySelectorAll('.editor-spacing').forEach(function (inp) { var pp = inp.getAttribute('data-prop'); if (st[pp] !== undefined) inp.value = st[pp]; });
        }
        _container.querySelectorAll('.editor-tree-item').forEach(function (it) { it.classList.toggle('active', it.getAttribute('data-tree-id') === info.id); });
    }

    function _hidePanel() { var l = _qs('.editor-el-id'); if (l) l.textContent = 'Click an element'; }

    function _updateStatus(info) {
        var el = _qs('#bfsStatusEl'), sz = _qs('#bfsStatusSize');
        if (!info) { if (el) el.textContent = 'No selection'; if (sz) sz.textContent = ''; return; }
        if (el) el.textContent = '<' + info.tag + '> ' + info.id;
        if (sz && info.rect) sz.textContent = Math.round(info.rect.width) + ' × ' + Math.round(info.rect.height);
    }

    /* ─── Element tree (Canva-style) ─── */
    var _currentTree = [];
    function _getItemZ(item) {
        var ov = _overrides[item.id];
        if (ov && ov.zIndex !== undefined) return ov.zIndex;
        return item.zIndex === 'auto' ? 0 : (parseInt(item.zIndex) || 0);
    }
    function _renderElementTree(tree) {
        _currentTree = tree;
        _lastTree = tree.slice();
        var treeEl = _qs('#editorTree'); if (!treeEl) return;
        var searchEl = _qs('#layerSearch');
        var filter = searchEl ? searchEl.value.toLowerCase() : '';
        treeEl.innerHTML = '';
        // Apply overrides and sort by z-index descending (highest = top of list)
        tree.forEach(function (item) {
            var ov = _overrides[item.id];
            if (ov) {
                if (ov.visibility !== undefined) item.visible = ov.visibility !== 'hidden';
                if (ov.locked !== undefined) item.locked = ov.locked;
                if (ov.zIndex !== undefined) item.zIndex = ov.zIndex;
            }
        });
        var sorted = tree.slice().sort(function (a, b) { return _getItemZ(b) - _getItemZ(a); });
        sorted.forEach(function (item) {
            var displayName = _getLayerName(item);
            var detail = item.id;
            if (filter && displayName.toLowerCase().indexOf(filter) < 0 && detail.toLowerCase().indexOf(filter) < 0) return;

            var div = document.createElement('div');
            div.className = 'editor-tree-item';
            if (item.id === _selectedId) div.classList.add('active');
            div.setAttribute('data-tree-id', item.id);
            div.draggable = true;

            var typeClass = _getTypeClass(item.tag);
            var typeLabel = _getTypeLabel(item.tag);

            div.innerHTML = '<span class="tree-drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="tree-type-icon ' + typeClass + '">' + typeLabel + '</span>' +
                '<span class="tree-info">' +
                    '<span class="tree-name">' + _escHtml(displayName) + '</span>' +
                    '<span class="tree-detail">' + _escHtml(detail) + '</span>' +
                '</span>' +
                '<span class="tree-icons">' +
                    '<button class="tree-icon-btn tree-vis-btn' + (!item.visible ? ' is-hidden' : '') + '" data-tree-action="vis" title="Toggle Visibility">' +
                        (item.visible ? '&#128065;' : '&#128683;') + '</button>' +
                    '<button class="tree-icon-btn tree-lock-btn' + (item.locked ? ' is-locked' : '') + '" data-tree-action="lock" title="Toggle Lock">' +
                        (item.locked ? '&#128274;' : '&#128275;') + '</button>' +
                '</span>';

            // Visibility toggle
            div.querySelector('.tree-vis-btn').addEventListener('click', function (e) {
                e.stopPropagation();
                var cur = (_overrides[item.id] && _overrides[item.id].visibility) || 'visible';
                var next = cur === 'visible' ? 'hidden' : 'visible';
                _postIframe('arbel-set-visibility', { id: item.id, value: next });
                _setOv(item.id, 'visibility', next);
                this.innerHTML = next === 'visible' ? '&#128065;' : '&#128683;';
                this.classList.toggle('is-hidden', next === 'hidden');
            });
            // Lock toggle
            div.querySelector('.tree-lock-btn').addEventListener('click', function (e) {
                e.stopPropagation();
                var cur = (_overrides[item.id] && _overrides[item.id].locked);
                _setOv(item.id, 'locked', !cur);
                _postIframe('arbel-set-pointer-events', { id: item.id, value: !cur ? 'none' : '' });
                this.innerHTML = !cur ? '&#128274;' : '&#128275;';
                this.classList.toggle('is-locked', !cur);
            });
            // Click = select element (set _selectedId immediately, then notify iframe)
            div.addEventListener('click', function () {
                _selectedId = item.id;
                treeEl.querySelectorAll('.editor-tree-item').forEach(function (it) { it.classList.toggle('active', it.getAttribute('data-tree-id') === item.id); });
                if (_iframe) _iframe.contentWindow.postMessage({ type: 'arbel-select-by-id', id: item.id }, '*');
            });

            // Drag & drop reorder
            div.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', item.id);
                div.classList.add('dragging');
            });
            div.addEventListener('dragend', function () { div.classList.remove('dragging'); });
            div.addEventListener('dragover', function (e) { e.preventDefault(); div.classList.add('drag-over'); });
            div.addEventListener('dragleave', function () { div.classList.remove('drag-over'); });
            div.addEventListener('drop', function (e) {
                e.preventDefault(); div.classList.remove('drag-over');
                var draggedId = e.dataTransfer.getData('text/plain');
                if (!draggedId || draggedId === item.id || !_lastTree.length) return;
                // Reorder: move dragged item to target's position, assign sequential z-index
                var arr = _lastTree.slice();
                // Apply current overrides to get latest z-index
                arr.forEach(function (it) {
                    var ov = _overrides[it.id];
                    if (ov && ov.zIndex !== undefined) it.zIndex = ov.zIndex;
                });
                arr.sort(function (a, b) { return _getItemZ(b) - _getItemZ(a); });
                var dragIdx = -1, targetIdx = -1;
                arr.forEach(function (it, i) { if (it.id === draggedId) dragIdx = i; if (it.id === item.id) targetIdx = i; });
                if (dragIdx < 0 || targetIdx < 0) return;
                var dragged = arr.splice(dragIdx, 1)[0];
                var newTarget = targetIdx > dragIdx ? targetIdx - 1 : targetIdx;
                arr.splice(newTarget, 0, dragged);
                // Assign sequential z-index: top of list = highest
                var total = arr.length;
                arr.forEach(function (it, i) {
                    var newZ = total - i;
                    _postIframe('arbel-set-zindex', { id: it.id, value: newZ });
                    _setOv(it.id, 'zIndex', newZ);
                    it.zIndex = newZ;
                });
                _lastTree = arr;
                _renderElementTree(arr);
            });

            treeEl.appendChild(div);
        });
    }

    function _getLayerName(item) {
        if (item.text) return item.text.substring(0, 40);
        var tag = item.tag.toLowerCase();
        var id = item.id || '';
        if (tag === 'section' || tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'nav') return id.replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
        if (tag === 'img') return 'Image — ' + id;
        if (tag === 'button' || tag === 'a') return 'Button — ' + id;
        if (tag === 'video') return 'Video — ' + id;
        if (tag === 'canvas') return 'Canvas — ' + id;
        return id || tag;
    }

    function _getTypeClass(tag) {
        tag = tag.toLowerCase();
        if (tag === 'section' || tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'article') return 'tree-type-section';
        if (tag === 'img' || tag === 'picture' || tag === 'video' || tag === 'canvas') return 'tree-type-img';
        if (tag === 'button' || tag === 'a') return 'tree-type-btn';
        if (tag === 'nav' || tag === 'ul' || tag === 'ol') return 'tree-type-nav';
        return '';
    }

    function _getTypeLabel(tag) {
        tag = tag.toLowerCase();
        if (tag === 'section') return 'S';
        if (tag === 'div') return 'D';
        if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return tag.toUpperCase();
        if (tag === 'p') return 'P';
        if (tag === 'span') return 'Sp';
        if (tag === 'img') return 'Img';
        if (tag === 'a') return 'A';
        if (tag === 'button') return 'Btn';
        if (tag === 'nav') return 'Nav';
        if (tag === 'header') return 'Hdr';
        if (tag === 'footer') return 'Ftr';
        if (tag === 'video') return 'Vid';
        if (tag === 'canvas') return 'Cv';
        if (tag === 'ul' || tag === 'ol') return 'Li';
        return tag.substring(0, 3);
    }

    function _escHtml(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

    /* ─── Accordion toggles (Insert tab) ─── */
    function _setupAccordions() {
        if (!_container) return;
        _container.querySelectorAll('.insert-section-header').forEach(function (header) {
            var bodyId = header.getAttribute('data-toggle');
            var body = _qs('#' + bodyId);
            if (!body) return;
            header.setAttribute('aria-expanded', body.classList.contains('active') ? 'true' : 'false');
            header.addEventListener('click', function () {
                var isOpen = body.classList.contains('active');
                body.classList.toggle('active', !isOpen);
                header.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
            });
        });
    }

    /* ─── Layer search ─── */
    function _setupLayerSearch() {
        if (!_container) return;
        _on('#layerSearch', 'input', function () {
            if (_currentTree.length) _renderElementTree(_currentTree);
        });
    }

    /* ─── Templates (industry-matched website presets) ─── */
    var _templates = [
        // ── Tech / SaaS ──
        { id: 'saas-landing', name: 'SaaS Platform', desc: 'Modern SaaS landing with gradient mesh backgrounds and pricing tiers', cat: 'tech', tags: ['saas', 'gradient', 'pricing'], style: 'meshGrad', industry: 'saas', accent: '#8b5cf6', bg: '#0a0a14',
          sections: ['hero', 'services', 'pricing', 'faq', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Scale your', heroLine2: 'business', heroLine3: 'smarter.',
            heroSub: 'All-in-one platform to automate workflows, track analytics, and grow your revenue — without the complexity.', heroCta: 'START FREE TRIAL',
            servicesLabel: 'FEATURES', servicesNav: 'Features', servicesHeading: 'Platform Features',
            service1Title: 'Smart Automation', service1Desc: 'Automate repetitive tasks with intelligent workflows that learn and adapt to your processes.',
            service2Title: 'Real-time Analytics', service2Desc: 'Track every metric that matters with live dashboards, custom reports, and predictive insights.',
            service3Title: 'Team Collaboration', service3Desc: 'Shared workspaces, inline comments, and real-time editing for your entire organization.',
            pricingHeading: 'Simple, Transparent Pricing',
            tier1Name: 'Starter', tier1Price: '$29/mo', tier1Features: '5 team members\n10 automated workflows\nBasic analytics\nEmail support',
            tier2Name: 'Professional', tier2Price: '$79/mo', tier2Features: 'Unlimited members\n100 workflows\nAdvanced analytics\nPriority support\nAPI access',
            tier3Name: 'Enterprise', tier3Price: 'Custom', tier3Features: 'Unlimited everything\nDedicated account manager\nCustom integrations\n99.99% SLA',
            faq1Q: 'How does the free trial work?', faq1A: 'Start with a full 14-day free trial on any plan. No credit card required. Cancel anytime.',
            faq2Q: 'Can I switch plans later?', faq2A: 'Absolutely. Upgrade or downgrade anytime — changes apply on your next billing cycle.',
            faq3Q: 'Is my data secure?', faq3A: 'We use bank-level 256-bit encryption and store data in SOC 2 Type II certified data centers.',
            testimonialsHeading: 'Trusted by Teams',
            testimonial1Quote: 'This platform cut our workflow time by 60%. The automation features are game-changing.', testimonial1Name: 'Sarah Chen', testimonial1Role: 'CTO, TechFlow',
            testimonial2Quote: 'Best investment we made this year. The analytics dashboards alone are worth it.', testimonial2Name: 'Marcus Rivera', testimonial2Role: 'Head of Growth, ScaleUp',
            contactHeading: 'Ready to Scale?', contactCta: 'START FREE TRIAL'
          }},

        { id: 'tech-startup', name: 'Tech Startup', desc: 'Bold aurora-lit startup site with feature showcase', cat: 'tech', tags: ['startup', 'aurora', 'bold'], style: 'aurora', industry: 'startup', accent: '#00d4ff', bg: '#080810',
          sections: ['hero', 'services', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Build the', heroLine2: 'future', heroLine3: 'today.',
            heroSub: 'We help startups turn bold ideas into market-ready products with cutting-edge technology.', heroCta: 'GET IN TOUCH',
            servicesLabel: 'WHAT WE DO', servicesNav: 'Services', servicesHeading: 'Our Expertise',
            service1Title: 'Product Strategy', service1Desc: 'From concept to launch — we map your product roadmap and validate market fit.',
            service2Title: 'Full-Stack Development', service2Desc: 'Scalable web and mobile applications built with modern frameworks and cloud infrastructure.',
            service3Title: 'Growth Engineering', service3Desc: 'Data-driven growth loops, A/B testing frameworks, and performance optimization.',
            aboutHeading: 'Our Story', aboutDesc: 'Founded by engineers who believe great technology should be accessible to every ambitious team. We have helped 50+ startups ship products that users love.',
            stat1Val: '50+', stat1Label: 'Startups Launched', stat2Val: '3Y', stat2Label: 'Track Record', stat3Val: '$12M+', stat3Label: 'Raised by Clients',
            testimonialsHeading: 'Founder Feedback',
            testimonial1Quote: 'They turned our napkin sketch into a working MVP in just 6 weeks. Incredible team.', testimonial1Name: 'Alex Park', testimonial1Role: 'CEO, NovaByte',
            testimonial2Quote: 'Not just developers — they are true product partners who care about outcomes.', testimonial2Name: 'Priya Sharma', testimonial2Role: 'Founder, LeapAI',
            contactHeading: 'Launch Your Vision', contactCta: 'BOOK A CALL'
          }},

        { id: 'dev-portfolio', name: 'Developer Portfolio', desc: 'Code-themed portfolio with matrix rain effects', cat: 'tech', tags: ['matrix', 'developer', 'code'], style: 'matrix', industry: 'portfolio', accent: '#00ff41', bg: '#050a05',
          sections: ['hero', 'portfolio', 'about', 'contact'],
          content: {
            heroLine1: 'Code.', heroLine2: 'Create.', heroLine3: 'Deploy.',
            heroSub: 'Full-stack developer building clean, performant applications that solve real problems.', heroCta: 'VIEW PROJECTS',
            portfolioLabel: 'PROJECTS', portfolioNav: 'Projects', portfolioHeading: 'Selected Work',
            project1Title: 'CloudSync Dashboard', project1Tag: 'React · Node.js', project1Desc: 'Real-time monitoring dashboard for cloud infrastructure with WebSocket feeds.',
            project2Title: 'CryptoTrack API', project2Tag: 'Python · FastAPI', project2Desc: 'High-performance REST API serving live cryptocurrency data to 10K+ daily users.',
            project3Title: 'TaskFlow Mobile', project3Tag: 'React Native', project3Desc: 'Cross-platform task management app with offline sync and team collaboration.',
            aboutHeading: 'About Me', aboutDesc: 'Self-taught developer with 5 years of experience shipping production code. I focus on performance, clean architecture, and great developer experience.',
            stat1Val: '200+', stat1Label: 'Commits/Month', stat2Val: '5Y', stat2Label: 'Experience', stat3Val: '30+', stat3Label: 'Projects Shipped',
            contactHeading: 'Let\'s Build Something', contactCta: 'HIRE ME'
          }},

        { id: 'cyber-security', name: 'Cyber Security', desc: 'Dark circuit-board aesthetic with neon accents', cat: 'tech', tags: ['cyber', 'circuits', 'neon'], style: 'circuits', industry: 'saas', accent: '#00e5ff', bg: '#060810',
          sections: ['hero', 'services', 'about', 'process', 'faq', 'contact'],
          content: {
            heroLine1: 'Protect your', heroLine2: 'digital', heroLine3: 'fortress.',
            heroSub: 'Enterprise-grade cybersecurity solutions that defend your data, infrastructure, and reputation.', heroCta: 'GET ASSESSMENT',
            servicesLabel: 'SOLUTIONS', servicesNav: 'Solutions', servicesHeading: 'Security Solutions',
            service1Title: 'Threat Detection', service1Desc: 'AI-powered 24/7 monitoring that identifies and neutralizes threats before they reach you.',
            service2Title: 'Data Encryption', service2Desc: 'End-to-end encryption for data at rest and in transit with zero-knowledge architecture.',
            service3Title: 'Compliance Audit', service3Desc: 'SOC 2, ISO 27001, and GDPR compliance readiness assessments and remediation.',
            aboutHeading: 'Why Us', aboutDesc: 'Our team of ex-NSA analysts and white-hat hackers has protected Fortune 500 companies for over a decade.',
            stat1Val: '0', stat1Label: 'Breaches on Watch', stat2Val: '99.99%', stat2Label: 'Uptime SLA', stat3Val: '500+', stat3Label: 'Clients Protected',
            processLabel: 'HOW IT WORKS', processHeading: 'Our Process',
            step1Title: 'Assess', step1Desc: 'Comprehensive vulnerability scan and risk assessment of your entire digital footprint.',
            step2Title: 'Fortify', step2Desc: 'Deploy layered defenses, encryption protocols, and real-time monitoring systems.',
            step3Title: 'Monitor', step3Desc: 'Continuous 24/7 threat intelligence and incident response with SLA guarantees.',
            faq1Q: 'How fast can you deploy?', faq1A: 'Initial protection is active within 24 hours. Full deployment takes 2-4 weeks depending on scope.',
            faq2Q: 'Do you handle incident response?', faq2A: 'Yes — our SOC team provides 24/7 incident response with guaranteed 15-minute acknowledgment time.',
            faq3Q: 'What compliance frameworks do you support?', faq3A: 'SOC 2 Type II, ISO 27001, GDPR, HIPAA, PCI DSS, and FedRAMP.',
            contactHeading: 'Secure Your Business', contactCta: 'REQUEST DEMO'
          }},

        // ── Shopping / E-Commerce ──
        { id: 'elegant-boutique', name: 'Elegant Boutique', desc: 'Luxurious fashion store with flowing silk textures', cat: 'shopping', tags: ['luxury', 'silk', 'fashion'], style: 'silk', industry: 'fashion', accent: '#e8a87c', bg: '#0a0a0f',
          sections: ['hero', 'services', 'portfolio', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Curated', heroLine2: 'luxury', heroLine3: 'fashion.',
            heroSub: 'Discover timeless pieces crafted for the discerning eye. New collection now available.', heroCta: 'SHOP NOW',
            servicesLabel: 'COLLECTIONS', servicesNav: 'Collections', servicesHeading: 'Our Collections',
            service1Title: 'Spring/Summer \'26', service1Desc: 'Light fabrics, pastel tones, and effortless silhouettes for the warmer months ahead.',
            service2Title: 'Evening Wear', service2Desc: 'Elegant gowns and tailored suits for galas, dinners, and unforgettable nights.',
            service3Title: 'Accessories', service3Desc: 'Handcrafted bags, scarves, and jewelry to complete every look with distinction.',
            portfolioLabel: 'LOOKBOOK', portfolioNav: 'Lookbook', portfolioHeading: 'Latest Lookbook',
            project1Title: 'Coastal Serenity', project1Tag: 'Resort Wear', project1Desc: 'Sun-washed linens and flowing silhouettes inspired by Mediterranean shores.',
            project2Title: 'Urban Edge', project2Tag: 'Streetwear', project2Desc: 'Bold cuts and modern textures that own the city from dawn to dusk.',
            project3Title: 'Black Tie', project3Tag: 'Formal', project3Desc: 'Timeless elegance reimagined with contemporary tailoring and luxurious fabrics.',
            testimonialsHeading: 'Client Love',
            testimonial1Quote: 'Every piece feels like it was made just for me. The quality is unmatched.', testimonial1Name: 'Isabella Moreau', testimonial1Role: 'Fashion Editor',
            testimonial2Quote: 'My go-to boutique for anything special. The curation is impeccable.', testimonial2Name: 'Sophia Laurent', testimonial2Role: 'Loyal Client',
            contactHeading: 'Visit Our Boutique', contactCta: 'BOOK APPOINTMENT'
          }},

        { id: 'modern-store', name: 'Modern Store', desc: 'Clean e-commerce layout with bokeh light effects', cat: 'shopping', tags: ['shop', 'bokeh', 'clean'], style: 'bokeh', industry: 'ecommerce', accent: '#f59e0b', bg: '#08080e',
          sections: ['hero', 'services', 'portfolio', 'pricing', 'faq', 'contact'],
          content: {
            heroLine1: 'Shop the', heroLine2: 'latest', heroLine3: 'trends.',
            heroSub: 'Premium products curated for your lifestyle. Free shipping on all orders over $50.', heroCta: 'BROWSE CATALOG',
            servicesLabel: 'CATEGORIES', servicesNav: 'Shop', servicesHeading: 'Browse Categories',
            service1Title: 'Electronics', service1Desc: 'Latest gadgets, audio gear, and smart home devices from top brands worldwide.',
            service2Title: 'Home & Living', service2Desc: 'Furniture, decor, and kitchen essentials that transform your space beautifully.',
            service3Title: 'Fashion & Style', service3Desc: 'Curated clothing, shoes, and accessories for every season and occasion.',
            portfolioLabel: 'FEATURED', portfolioNav: 'Featured', portfolioHeading: 'Featured Products',
            project1Title: 'Wireless Earbuds Pro', project1Tag: '$129', project1Desc: 'Active noise cancellation, 32-hour battery, and studio-quality sound.',
            project2Title: 'Smart Home Hub', project2Tag: '$249', project2Desc: 'Control all your devices from one sleek hub with voice and app control.',
            project3Title: 'Designer Watch', project3Tag: '$399', project3Desc: 'Swiss movement, sapphire crystal, and Italian leather — timeless craftsmanship.',
            pricingLabel: 'MEMBERSHIP', pricingNav: 'Membership', pricingHeading: 'Membership Perks',
            tier1Name: 'Free', tier1Price: '$0', tier1Features: 'Standard shipping\nBasic rewards points\nSale notifications\nEmail support',
            tier2Name: 'Premium', tier2Price: '$9.99/mo', tier2Features: 'Free express shipping\n2x reward points\nEarly access to sales\nPriority support\nExclusive deals',
            tier3Name: 'VIP', tier3Price: '$29.99/mo', tier3Features: 'Same-day delivery\n5x reward points\nPersonal shopper\nFree returns\nVIP events access',
            faqLabel: 'HELP', faqHeading: 'Shopping Help',
            faq1Q: 'What is your return policy?', faq1A: 'Free returns within 30 days, no questions asked. Premium and VIP members get 60 days.',
            faq2Q: 'How long does shipping take?', faq2A: 'Standard: 5-7 days. Express: 2-3 days. Same-day available for VIP members in select cities.',
            faq3Q: 'Do you ship internationally?', faq3A: 'Yes! We ship to 50+ countries. International orders over $100 qualify for free shipping.',
            contactHeading: 'Need Help?', contactCta: 'CONTACT SUPPORT'
          }},

        { id: 'product-launch', name: 'Product Launch', desc: 'Single product showcase with blob animations', cat: 'shopping', tags: ['product', 'blobs', 'launch'], style: 'morphBlob', industry: 'ecommerce', accent: '#ec4899', bg: '#0a0a12',
          sections: ['hero', 'services', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Introducing', heroLine2: 'the next', heroLine3: 'generation.',
            heroSub: 'Revolutionary design meets cutting-edge technology. Pre-order now and be the first to experience it.', heroCta: 'PRE-ORDER NOW',
            servicesLabel: 'FEATURES', servicesNav: 'Features', servicesHeading: 'Why You\'ll Love It',
            service1Title: 'Premium Build', service1Desc: 'Aerospace-grade materials and precision engineering for something you can feel.',
            service2Title: 'Smart Features', service2Desc: 'AI-powered intelligence that adapts to your habits and anticipates your needs.',
            service3Title: 'All-Day Battery', service3Desc: '48-hour battery life with fast wireless charging — go from 0 to 80% in 20 minutes.',
            aboutLabel: 'THE STORY', aboutHeading: 'Built Different', aboutDesc: 'Three years in the making. Our team of 40 engineers obsessed over every detail — from the tactile click of each button to the seamless software experience.',
            stat1Val: '3Y', stat1Label: 'In Development', stat2Val: '40+', stat2Label: 'Engineers', stat3Val: '200+', stat3Label: 'Prototypes Tested',
            testimonialsHeading: 'Early Reviews',
            testimonial1Quote: 'This changes everything. The build quality and attention to detail are on another level.', testimonial1Name: 'David Kim', testimonial1Role: 'Tech Reviewer, The Verge',
            testimonial2Quote: 'Used it for a week — I cannot go back. This is the future.', testimonial2Name: 'Emma Wilson', testimonial2Role: 'Beta Tester',
            contactHeading: 'Get Yours First', contactCta: 'PRE-ORDER'
          }},

        // ── Creative / Agency ──
        { id: 'dark-agency', name: 'Dark Agency', desc: 'Premium agency site with obsidian ink fluid background', cat: 'creative', tags: ['agency', 'dark', 'premium'], style: 'obsidian', industry: 'agency', accent: '#6C5CE7', bg: '#0a0a0f',
          sections: ['hero', 'services', 'portfolio', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'We craft', heroLine2: 'digital', heroLine3: 'experiences.',
            heroSub: 'Award-winning design studio creating brands, websites, and campaigns that resonate and convert.', heroCta: 'START A PROJECT',
            servicesHeading: 'Our Expertise',
            service1Title: 'Brand Identity', service1Desc: 'Logos, visual systems, and brand guidelines that capture your essence and stand the test of time.',
            service2Title: 'Web Design & Dev', service2Desc: 'Pixel-perfect responsive websites with immersive interactions and blazing performance.',
            service3Title: 'Motion & Video', service3Desc: 'Motion graphics, product videos, and animated content that brings your story to life.',
            portfolioHeading: 'Selected Work',
            project1Title: 'Nexus Rebrand', project1Tag: 'Branding', project1Desc: 'Complete visual identity overhaul for a Fortune 500 fintech company.',
            project2Title: 'Flux App', project2Tag: 'UI/UX Design', project2Desc: 'Mobile app design for a productivity tool now used by 2M+ people.',
            project3Title: 'Prism Campaign', project3Tag: 'Motion Design', project3Desc: 'Multi-platform video campaign that generated 50M+ impressions in 30 days.',
            aboutHeading: 'About Us', aboutDesc: 'A tight-knit team of strategists, designers, and developers who believe great design is great business.',
            stat1Val: '120+', stat1Label: 'Projects Delivered', stat2Val: '8Y', stat2Label: 'In Business', stat3Val: '15', stat3Label: 'Industry Awards',
            testimonialsHeading: 'Client Testimonials',
            testimonial1Quote: 'They completely transformed our digital presence. Revenue up 40% since the rebrand.', testimonial1Name: 'James Mitchell', testimonial1Role: 'CMO, Nexus Finance',
            testimonial2Quote: 'Best agency we have worked with. They treat every brief like it is their own product.', testimonial2Name: 'Lisa Nakamura', testimonial2Role: 'VP Marketing, Flux',
            contactHeading: 'Let\'s Create Together', contactCta: 'GET IN TOUCH'
          }},

        { id: 'neon-studio', name: 'Neon Studio', desc: 'Electric neon-glow creative showcase', cat: 'creative', tags: ['neon', 'electric', 'glow'], style: 'neon', industry: 'agency', accent: '#ff006e', bg: '#0a0a10',
          sections: ['hero', 'services', 'portfolio', 'process', 'contact'],
          content: {
            heroLine1: 'Creative', heroLine2: 'without', heroLine3: 'limits.',
            heroSub: 'We are a creative studio that turns wild ideas into stunning visual experiences.', heroCta: 'SEE OUR WORK',
            servicesHeading: 'What We Do',
            service1Title: '3D & CGI', service1Desc: 'Photorealistic 3D renders, product visualizations, and immersive virtual environments.',
            service2Title: 'Interactive Design', service2Desc: 'WebGL experiences, creative coding, and interactive installations that captivate.',
            service3Title: 'Art Direction', service3Desc: 'Visual storytelling, campaign concepts, and creative direction for bold brands.',
            portfolioHeading: 'Recent Projects',
            project1Title: 'Synthwave Festival', project1Tag: 'Event Design', project1Desc: 'Complete visual identity and immersive stage design for a 20K attendee music festival.',
            project2Title: 'NeoTech Product Film', project2Tag: 'Motion', project2Desc: 'Cinematic product launch video that hit 5M views in its first week.',
            project3Title: 'Arcadia VR', project3Tag: 'Interactive', project3Desc: 'Virtual reality art gallery exhibited at three international design conferences.',
            processHeading: 'Our Workflow',
            step1Title: 'Concept', step1Desc: 'We start with mood boards, references, and wild brainstorming to find the creative direction.',
            step2Title: 'Craft', step2Desc: 'Our team brings the concept to life through iterative design, prototyping, and refinement.',
            step3Title: 'Deliver', step3Desc: 'Final assets delivered on time in all formats, with ongoing support and optimization.',
            contactHeading: 'Start Something Bold', contactCta: 'REACH OUT'
          }},

        { id: 'nebula-creative', name: 'Nebula Creative', desc: 'Cosmic nebula particles with deep space atmosphere', cat: 'creative', tags: ['space', 'nebula', 'creative'], style: 'nebula', industry: 'agency', accent: '#a78bfa', bg: '#06060e',
          sections: ['hero', 'portfolio', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Imagine.', heroLine2: 'Create.', heroLine3: 'Inspire.',
            heroSub: 'Multidisciplinary creative studio specializing in visual storytelling and experiential design.', heroCta: 'EXPLORE WORK',
            portfolioHeading: 'Our Work',
            project1Title: 'Ethereal Collection', project1Tag: 'Photography', project1Desc: 'Fine art photography series exploring light, texture, and human connection.',
            project2Title: 'Pulse Magazine', project2Tag: 'Editorial', project2Desc: 'Complete editorial redesign of a leading culture and arts publication.',
            project3Title: 'Aurora Installation', project3Tag: 'Experiential', project3Desc: 'Large-scale light installation exhibited at the Museum of Contemporary Art.',
            aboutHeading: 'The Studio', aboutDesc: 'We are a collective of artists, designers, and technologists based in Brooklyn. We believe in work that makes people stop, look, and feel something.',
            stat1Val: '80+', stat1Label: 'Projects', stat2Val: '6Y', stat2Label: 'Creating', stat3Val: '12', stat3Label: 'Countries Exhibited',
            testimonialsHeading: 'Kind Words',
            testimonial1Quote: 'Their visual language is unlike anything else. Every collaboration has been extraordinary.', testimonial1Name: 'Ana Torres', testimonial1Role: 'Creative Director, Vogue',
            testimonial2Quote: 'They see what others cannot. Working with them elevated our entire brand vision.', testimonial2Name: 'Chris Lee', testimonial2Role: 'Founder, Pulse Media',
            contactHeading: 'Collaborate With Us', contactCta: 'SAY HELLO'
          }},

        { id: 'minimal-folio', name: 'Minimal Portfolio', desc: 'Clean portfolio with connected constellation dots', cat: 'creative', tags: ['minimal', 'constellation', 'clean'], style: 'constellation', industry: 'portfolio', accent: '#60a5fa', bg: '#06080f',
          sections: ['hero', 'portfolio', 'about', 'contact'],
          content: {
            heroLine1: 'Design &', heroLine2: 'development', heroLine3: 'portfolio.',
            heroSub: 'Crafting clean, user-centered digital experiences with modern technology and thoughtful design.', heroCta: 'SEE MY WORK',
            portfolioLabel: 'WORK', portfolioNav: 'Work', portfolioHeading: 'Featured Projects',
            project1Title: 'HealthTrack App', project1Tag: 'UI/UX · Mobile', project1Desc: 'Health and wellness tracking app with intuitive data visualization.',
            project2Title: 'Notion Redesign', project2Tag: 'Web Design', project2Desc: 'A concept redesign focused on accessibility and streamlined navigation.',
            project3Title: 'Finova Dashboard', project3Tag: 'SaaS · React', project3Desc: 'Financial analytics dashboard for startup founders and investors.',
            aboutHeading: 'About', aboutDesc: 'Product designer and front-end developer with a passion for clean interfaces and meaningful interactions. Currently open to freelance opportunities.',
            stat1Val: '50+', stat1Label: 'Projects', stat2Val: '7Y', stat2Label: 'Experience', stat3Val: '100%', stat3Label: 'Satisfaction',
            contactHeading: 'Work Together', contactCta: 'EMAIL ME'
          }},

        // ── Food / Restaurant ──
        { id: 'fine-dining', name: 'Fine Dining', desc: 'Warm ember-lit restaurant site with rich textures', cat: 'food', tags: ['restaurant', 'ember', 'warm'], style: 'ember', industry: 'restaurant', accent: '#f97316', bg: '#0f0a06',
          sections: ['hero', 'services', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Savor the', heroLine2: 'art of', heroLine3: 'cuisine.',
            heroSub: 'An unforgettable dining experience with locally sourced ingredients and world-class technique.', heroCta: 'RESERVE A TABLE',
            servicesLabel: 'OUR MENU', servicesNav: 'Menu', servicesHeading: 'Signature Dishes',
            service1Title: 'Wagyu Tartare', service1Desc: 'Hand-cut A5 wagyu with truffle aioli, microgreens, and gold leaf — a house signature.',
            service2Title: 'Pan-Seared Scallops', service2Desc: 'Fresh diver scallops on cauliflower purée with brown butter and crispy capers.',
            service3Title: 'Dark Chocolate Soufflé', service3Desc: 'Rich Valrhona chocolate soufflé with vanilla bean crème anglaise. Allow 20 minutes.',
            aboutLabel: 'OUR STORY', aboutHeading: 'A Culinary Journey', aboutDesc: 'Founded by Chef Laurent Dubois, we have spent 15 years perfecting the art of combining local ingredients with French technique. Every dish tells a story.',
            stat1Val: '15Y', stat1Label: 'Heritage', stat2Val: '3', stat2Label: 'Michelin Stars', stat3Val: '50+', stat3Label: 'Local Farm Partners',
            testimonialsHeading: 'Guest Reviews',
            testimonial1Quote: 'The best dining experience of my life. Every course was a work of art.', testimonial1Name: 'Robert Sterling', testimonial1Role: 'Food & Wine Magazine',
            testimonial2Quote: 'Chef Dubois creates magic. This restaurant is worth a trip from anywhere in the world.', testimonial2Name: 'Marie Kondo', testimonial2Role: 'Culinary Critic',
            contactHeading: 'Make a Reservation', contactLabel: 'RESERVATIONS', contactCta: 'BOOK A TABLE'
          }},

        { id: 'food-brand', name: 'Food Brand', desc: 'Sunset-toned food brand with organic blob shapes', cat: 'food', tags: ['food', 'sunset', 'organic'], style: 'sunsetBlob', industry: 'restaurant', accent: '#fb923c', bg: '#0e0a08',
          sections: ['hero', 'services', 'portfolio', 'contact'],
          content: {
            heroLine1: 'Fresh.', heroLine2: 'Organic.', heroLine3: 'Delicious.',
            heroSub: 'Farm-to-table ingredients for the modern kitchen. Sustainably sourced, beautifully crafted.', heroCta: 'SHOP NOW',
            servicesLabel: 'PRODUCTS', servicesNav: 'Products', servicesHeading: 'Our Products',
            service1Title: 'Cold-Pressed Juices', service1Desc: 'Raw, unpasteurized fruit and vegetable blends made fresh daily from organic farms.',
            service2Title: 'Artisan Granola', service2Desc: 'Small-batch granola with locally sourced honey, nuts, and dried fruits. No added sugar.',
            service3Title: 'Organic Honey', service3Desc: 'Single-origin raw honey harvested from our partner beekeepers across the Pacific Northwest.',
            portfolioLabel: 'OUR RANGE', portfolioNav: 'Range', portfolioHeading: 'Product Range',
            project1Title: 'Morning Collection', project1Tag: 'Breakfast', project1Desc: 'Start your day right with our cold-pressed juices, granola, and overnight oat kits.',
            project2Title: 'Snack Bar Series', project2Tag: 'On-the-Go', project2Desc: 'Nutrient-dense bars made with dates, nuts, and superfoods. No artificial anything.',
            project3Title: 'Pantry Essentials', project3Tag: 'Staples', project3Desc: 'Olive oils, vinegars, spice blends, and preserves for your everyday cooking.',
            contactHeading: 'Wholesale Inquiries', contactCta: 'PARTNER WITH US'
          }},

        { id: 'cafe-cozy', name: 'Cozy Café', desc: 'Warm firefly-lit ambiance for coffee shops and cafes', cat: 'food', tags: ['cafe', 'fireflies', 'cozy'], style: 'fireflies', industry: 'restaurant', accent: '#fbbf24', bg: '#0a0806',
          sections: ['hero', 'services', 'about', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Your daily', heroLine2: 'dose of', heroLine3: 'comfort.',
            heroSub: 'Specialty coffee, homemade pastries, and a warm atmosphere — your neighborhood escape.', heroCta: 'VIEW MENU',
            servicesLabel: 'MENU', servicesNav: 'Menu', servicesHeading: 'Today\'s Menu',
            service1Title: 'Signature Lattes', service1Desc: 'Lavender oat, caramel brûlée, and our famous honey cinnamon — all made with house-roasted beans.',
            service2Title: 'Fresh Pastries', service2Desc: 'Baked in-house every morning: croissants, scones, banana bread, and seasonal specials.',
            service3Title: 'Brunch Specials', service3Desc: 'Available weekends 9am-2pm. Avocado toast, eggs benedict, and our legendary pancake stack.',
            aboutLabel: 'OUR STORY', aboutHeading: 'Welcome Home', aboutDesc: 'What started as a small corner shop in 2019 has become the neighborhood living room. We source our beans directly from farmers and bake everything fresh, every single day.',
            stat1Val: '6Y', stat1Label: 'Brewing', stat2Val: '12', stat2Label: 'Bean Origins', stat3Val: '500+', stat3Label: 'Cups Daily',
            testimonialsHeading: 'What Regulars Say',
            testimonial1Quote: 'Best coffee in the city, hands down. And the banana bread is dangerously good.', testimonial1Name: 'Tom Richards', testimonial1Role: 'Daily Regular',
            testimonial2Quote: 'My remote office. Great WiFi, better coffee, and the warmest staff you will ever meet.', testimonial2Name: 'Ava Chen', testimonial2Role: 'Freelancer',
            contactHeading: 'Visit Us', contactCta: 'GET DIRECTIONS'
          }},

        // ── Health / Wellness ──
        { id: 'medical-clinic', name: 'Medical Clinic', desc: 'Clean frost-crystalline healthcare site with trust design', cat: 'health', tags: ['medical', 'frost', 'clean'], style: 'frost', industry: 'healthcare', accent: '#38bdf8', bg: '#060a0e',
          sections: ['hero', 'services', 'about', 'testimonials', 'faq', 'contact'],
          content: {
            heroLine1: 'Your health', heroLine2: 'our', heroLine3: 'priority.',
            heroSub: 'Comprehensive healthcare with compassion, expertise, and the latest medical technology.', heroCta: 'BOOK APPOINTMENT',
            servicesLabel: 'DEPARTMENTS', servicesNav: 'Departments', servicesHeading: 'Our Departments',
            service1Title: 'General Practice', service1Desc: 'Routine check-ups, preventive care, and chronic disease management with a personal touch.',
            service2Title: 'Cardiology', service2Desc: 'Advanced cardiac diagnostics, treatment, and rehabilitation with board-certified specialists.',
            service3Title: 'Orthopedics', service3Desc: 'Sports medicine, joint replacement, and physical therapy to get you back in motion.',
            aboutLabel: 'ABOUT US', aboutHeading: 'Trusted Care', aboutDesc: 'Serving our community for over 25 years with a patient-first approach. Our team of 50+ physicians and specialists is committed to your well-being.',
            stat1Val: '25Y', stat1Label: 'Serving Community', stat2Val: '50+', stat2Label: 'Specialists', stat3Val: '100K+', stat3Label: 'Patients Cared For',
            testimonialsHeading: 'Patient Stories',
            testimonial1Quote: 'Dr. Patel and her team saved my life. The care and attention here is beyond anything I have experienced.', testimonial1Name: 'Frank Gonzalez', testimonial1Role: 'Patient',
            testimonial2Quote: 'From reception to recovery, every step was handled with genuine kindness and expertise.', testimonial2Name: 'Dorothy Mills', testimonial2Role: 'Patient',
            faqLabel: 'PATIENT INFO', faqHeading: 'Patient Information',
            faq1Q: 'Do you accept insurance?', faq1A: 'We accept all major insurance providers including Aetna, Blue Cross, Cigna, and United Healthcare.',
            faq2Q: 'How do I book an appointment?', faq2A: 'Book online 24/7, call our reception at (555) 100-2000, or walk in during business hours.',
            faq3Q: 'Do you offer telehealth visits?', faq3A: 'Yes — video consultations are available for follow-ups and non-emergency consultations.',
            contactHeading: 'Schedule a Visit', contactCta: 'CALL NOW'
          }},

        { id: 'wellness-spa', name: 'Wellness Spa', desc: 'Tranquil ocean-wave spa with calming blue tones', cat: 'health', tags: ['spa', 'ocean', 'calm'], style: 'oceanBlob', industry: 'fitness', accent: '#22d3ee', bg: '#060a0e',
          sections: ['hero', 'services', 'about', 'pricing', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Restore.', heroLine2: 'Rejuvenate.', heroLine3: 'Renew.',
            heroSub: 'Luxury wellness treatments tailored to your body and mind. Your journey to balance starts here.', heroCta: 'BOOK SESSION',
            servicesLabel: 'TREATMENTS', servicesNav: 'Treatments', servicesHeading: 'Our Treatments',
            service1Title: 'Deep Tissue Massage', service1Desc: 'Targeted pressure therapy to release tension, improve circulation, and restore mobility.',
            service2Title: 'Aromatherapy Facial', service2Desc: 'Organic botanical extracts and essential oils for radiant, deeply nourished skin.',
            service3Title: 'Hot Stone Therapy', service3Desc: 'Heated basalt stones placed on key energy points to melt away stress and align your body.',
            aboutLabel: 'THE SPA', aboutHeading: 'Your Sanctuary', aboutDesc: 'Nestled in nature, our spa combines ancient healing traditions with modern wellness science. Every treatment is customized to your unique needs.',
            stat1Val: '10Y', stat1Label: 'Experience', stat2Val: '5K+', stat2Label: 'Happy Clients', stat3Val: '20+', stat3Label: 'Certified Therapists',
            pricingLabel: 'PACKAGES', pricingNav: 'Packages', pricingHeading: 'Spa Packages',
            tier1Name: 'Day Pass', tier1Price: '$89', tier1Features: '1 treatment of choice\nSauna & steam access\nHerbal tea service\nRelaxation lounge',
            tier2Name: 'Retreat', tier2Price: '$249', tier2Features: '3 treatments\nFull spa access all day\nOrganic lunch included\nAromatherapy gift set\nPriority booking',
            tier3Name: 'Annual', tier3Price: '$1,999/yr', tier3Features: 'Monthly treatment credits\nUnlimited spa access\nGuest passes (4/year)\nExclusive member events\n20% off all add-ons',
            testimonialsHeading: 'Guest Experiences',
            testimonial1Quote: 'I walked in stressed and walked out floating. The hot stone therapy was life-changing.', testimonial1Name: 'Hannah Brooks', testimonial1Role: 'Wellness Blogger',
            testimonial2Quote: 'The annual membership pays for itself. This spa is my sanctuary.', testimonial2Name: 'Michael Tanaka', testimonial2Role: 'Member since 2023',
            contactHeading: 'Book Your Escape', contactCta: 'RESERVE NOW'
          }},

        { id: 'fitness-gym', name: 'Fitness Studio', desc: 'High-energy spark particles with bold sports aesthetic', cat: 'health', tags: ['fitness', 'spark', 'energy'], style: 'spark', industry: 'fitness', accent: '#ef4444', bg: '#0a0608',
          sections: ['hero', 'services', 'about', 'pricing', 'contact'],
          content: {
            heroLine1: 'Push your', heroLine2: 'limits', heroLine3: 'further.',
            heroSub: 'High-intensity training programs designed to transform your body and mindset.', heroCta: 'JOIN NOW',
            servicesLabel: 'PROGRAMS', servicesNav: 'Programs', servicesHeading: 'Our Programs',
            service1Title: 'HIIT Training', service1Desc: '45-minute full-body sessions that burn fat, build muscle, and boost endurance.',
            service2Title: 'Strength & Conditioning', service2Desc: 'Progressive overload programs with certified coaches for serious strength gains.',
            service3Title: 'Yoga & Recovery', service3Desc: 'Active recovery, flexibility, and mindfulness classes to complement your training.',
            aboutLabel: 'THE GYM', aboutHeading: 'More Than a Gym', aboutDesc: 'State-of-the-art equipment, expert coaches, and a community that pushes each other to be better every day.',
            stat1Val: '5K+', stat1Label: 'Active Members', stat2Val: '20+', stat2Label: 'Expert Trainers', stat3Val: '50+', stat3Label: 'Classes per Week',
            pricingLabel: 'MEMBERSHIPS', pricingNav: 'Memberships', pricingHeading: 'Membership Plans',
            tier1Name: 'Basic', tier1Price: '$39/mo', tier1Features: 'Gym floor access\nGroup classes\nLocker room\nFitness assessment',
            tier2Name: 'Premium', tier2Price: '$79/mo', tier2Features: 'All Basic perks\n4 PT sessions/month\nNutrition plan\nSauna & recovery zone\nGuest pass (1/month)',
            tier3Name: 'Elite', tier3Price: '$149/mo', tier3Features: 'All Premium perks\nUnlimited personal training\nCustom meal prep plan\n24/7 gym access\nPriority class booking',
            contactHeading: 'Start Your Journey', contactCta: 'GET FREE TRIAL'
          }},

        // ── Landing Pages ──
        { id: 'aurora-launch', name: 'Aurora Landing', desc: 'Northern lights backdrop for stunning app launches', cat: 'landing', tags: ['aurora', 'launch', 'app'], style: 'northern', industry: 'startup', accent: '#34d399', bg: '#060810',
          sections: ['hero', 'services', 'pricing', 'faq', 'contact'],
          content: {
            heroLine1: 'Build apps', heroLine2: 'that', heroLine3: 'scale.',
            heroSub: 'The developer platform for shipping production-ready apps in days, not months. Start free.', heroCta: 'GET STARTED FREE',
            servicesLabel: 'FEATURES', servicesNav: 'Features', servicesHeading: 'Why Developers Choose Us',
            service1Title: 'One-Click Deploy', service1Desc: 'Push to production with zero configuration. Automatic SSL, CDN, and global edge caching.',
            service2Title: 'Built-in Database', service2Desc: 'Serverless Postgres with branching, instant rollbacks, and automatic scaling.',
            service3Title: 'Edge Functions', service3Desc: 'Run server-side code at the edge in 50+ regions. Sub-10ms response times globally.',
            pricingHeading: 'Start Free, Scale Up',
            tier1Name: 'Hobby', tier1Price: '$0/mo', tier1Features: '3 projects\n100K requests/month\n1GB database\nCommunity support',
            tier2Name: 'Pro', tier2Price: '$20/mo', tier2Features: 'Unlimited projects\n10M requests/month\n10GB database\nEmail support\nCustom domains',
            tier3Name: 'Team', tier3Price: '$50/seat/mo', tier3Features: 'Everything in Pro\nSSO & audit logs\n100GB database\nDedicated support\nSLA guarantee',
            faq1Q: 'Do I need a credit card to start?', faq1A: 'Nope. The Hobby plan is completely free with no credit card required. Upgrade when you are ready.',
            faq2Q: 'Can I migrate from another platform?', faq2A: 'Yes — we provide automated migration tools for Heroku, Vercel, Netlify, and Railway.',
            faq3Q: 'What languages do you support?', faq3A: 'Node.js, Python, Go, Rust, Ruby, and Deno. Bring your own Docker image for anything else.',
            contactHeading: 'Ready to Ship?', contactCta: 'START BUILDING'
          }},

        { id: 'galaxy-event', name: 'Galaxy Event', desc: 'Swirling galaxy particles for event or conference pages', cat: 'landing', tags: ['galaxy', 'event', 'swirl'], style: 'galaxy', industry: 'music', accent: '#c084fc', bg: '#08060e',
          sections: ['hero', 'about', 'services', 'contact'],
          content: {
            heroLine1: 'The biggest', heroLine2: 'event of', heroLine3: '2026.',
            heroSub: 'Join 10,000+ attendees for three days of keynotes, workshops, and unforgettable performances.', heroCta: 'GET TICKETS',
            aboutLabel: 'THE EVENT', aboutNav: 'Event', aboutHeading: 'What to Expect', aboutDesc: 'Three stages, 80+ speakers, live music, food trucks, and networking events — all in one extraordinary weekend at the Convention Center, March 20-22.',
            stat1Val: '10K+', stat1Label: 'Attendees', stat2Val: '80+', stat2Label: 'Speakers', stat3Val: '3', stat3Label: 'Days of Inspiration',
            servicesLabel: 'SPEAKERS', servicesNav: 'Speakers', servicesHeading: 'Featured Speakers',
            service1Title: 'Dr. Aisha Patel', service1Desc: 'AI researcher and bestselling author on the future of human-AI collaboration.',
            service2Title: 'Marcus Zhang', service2Desc: 'Ex-Google engineer turned startup founder. Building the next generation of dev tools.',
            service3Title: 'Elena Voss', service3Desc: 'Grammy-winning musician and creative technologist. Live performance + talk on art and code.',
            contactHeading: 'Don\'t Miss Out', contactCta: 'REGISTER NOW'
          }},

        { id: 'prism-app', name: 'Prism App', desc: 'Iridescent prism gradients for mobile app showcases', cat: 'landing', tags: ['prism', 'app', 'color'], style: 'prism', industry: 'saas', accent: '#f472b6', bg: '#0a0810',
          sections: ['hero', 'services', 'pricing', 'testimonials', 'contact'],
          content: {
            heroLine1: 'Your all-in-one', heroLine2: 'mobile', heroLine3: 'companion.',
            heroSub: 'Track habits, manage tasks, and achieve goals — all in one beautiful, intuitive app.', heroCta: 'DOWNLOAD FREE',
            servicesLabel: 'FEATURES', servicesNav: 'Features', servicesHeading: 'Powerful Features',
            service1Title: 'Smart Habits', service1Desc: 'AI-powered habit tracking that learns your patterns and sends gentle, well-timed reminders.',
            service2Title: 'Focus Timer', service2Desc: 'Pomodoro-style deep work sessions with ambient soundscapes and distraction blocking.',
            service3Title: 'Progress Insights', service3Desc: 'Beautiful charts and weekly reports showing your growth, streaks, and personal records.',
            pricingHeading: 'Choose Your Plan',
            tier1Name: 'Free', tier1Price: '$0', tier1Features: '3 habit trackers\nBasic focus timer\nDaily streaks\n7-day history',
            tier2Name: 'Pro', tier2Price: '$4.99/mo', tier2Features: 'Unlimited habits\nAll sounds & themes\nFull analytics\nCloud sync\nWidget support',
            tier3Name: 'Lifetime', tier3Price: '$49.99', tier3Features: 'Everything in Pro\nForever — one payment\nBeta feature access\nPriority support\nFamily sharing (5)',
            testimonialsHeading: 'User Love',
            testimonial1Quote: 'This app replaced 4 others for me. The habit tracking is incredibly smart.', testimonial1Name: 'Jordan Ellis', testimonial1Role: '★★★★★ App Store',
            testimonial2Quote: 'Focus timer + habit streaks = productivity superpower. Best $5/month I spend.', testimonial2Name: 'Megan Sharp', testimonial2Role: '★★★★★ Google Play',
            contactHeading: 'Join 2M+ Users', contactCta: 'DOWNLOAD NOW'
          }}
    ];

    function _setupTemplates() {
        if (!_container) return;
        _renderTemplateGrid('all');
        _container.querySelectorAll('.template-cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _container.querySelectorAll('.template-cat-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _renderTemplateGrid(btn.getAttribute('data-cat'));
            });
        });
    }

    function _renderTemplateGrid(cat) {
        var grid = _qs('#templateGrid'); if (!grid) return;
        grid.innerHTML = '';
        var filtered = cat === 'all' ? _templates : _templates.filter(function (t) { return t.cat === cat; });
        // Color map for template thumbnails based on accent
        var catIcons = {
            tech: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
            shopping: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
            creative: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
            food: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>',
            health: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
            landing: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/></svg>'
        };
        filtered.forEach(function (tpl) {
            var card = document.createElement('div');
            card.className = 'template-card';
            var accent = tpl.accent || '#646cff';
            var bg = tpl.bg || '#0a0a0f';
            // Create a gradient from the template's actual colors
            var thumbBg = 'linear-gradient(135deg, ' + bg + ' 0%, ' + _mixColor(bg, accent, 0.25) + ' 50%, ' + _mixColor(bg, accent, 0.5) + ' 100%)';
            var icon = catIcons[tpl.cat] || '';
            card.innerHTML = '<div class="template-thumb" style="background:' + thumbBg + ';display:flex;align-items:center;justify-content:center;position:relative">' +
                '<div style="color:' + accent + ';opacity:0.35;font-size:2.2rem;font-weight:700">' + tpl.name.charAt(0) + '</div>' +
                '<div style="position:absolute;top:8px;right:8px;color:' + accent + ';opacity:0.5">' + icon + '</div>' +
                '</div>' +
                '<div class="template-card-body">' +
                    '<div class="template-card-name">' + tpl.name + '</div>' +
                    '<div class="template-card-desc">' + tpl.desc + '</div>' +
                    '<div class="template-card-tags">' + tpl.tags.map(function (t) { return '<span class="template-tag">' + t + '</span>'; }).join('') + '</div>' +
                '</div>';
            card.addEventListener('click', function () {
                if (confirm('Apply "' + tpl.name + '" template? This will update your style, sections, and colors.')) {
                    _applyTemplate(tpl);
                }
            });
            grid.appendChild(card);
        });
    }

    function _applyTemplate(tpl) {
        // Dispatch a detailed event that app.js uses to reconfigure everything
        window.dispatchEvent(new CustomEvent('arbel-apply-template', { detail: {
            style: tpl.style,
            industry: tpl.industry,
            accent: tpl.accent,
            bg: tpl.bg,
            sections: tpl.sections,
            name: tpl.name,
            content: tpl.content || {}
        } }));
        _updateStatus({ tag: 'template', id: tpl.name, rect: null });
    }

    // Simple hex color mixer for thumbnail gradients
    function _mixColor(hex1, hex2, ratio) {
        var r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
        var r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
        var r = Math.round(r1 + (r2 - r1) * ratio), g = Math.round(g1 + (g2 - g1) * ratio), b = Math.round(b1 + (b2 - b1) * ratio);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    /* ─── Helpers ─── */
    function _qs(sel) { return _container ? _container.querySelector(sel) : document.querySelector(sel); }
    function _on(sel, evt, fn) { var el = typeof sel === 'string' ? _qs(sel) : sel; if (el) el.addEventListener(evt, fn); }
    function _postIframe(type, data) { if (_iframe && _iframe.contentWindow) { data.type = type; _iframe.contentWindow.postMessage(data, '*'); } }
    function _setOv(id, k, v) { if (!_overrides[id]) _overrides[id] = {}; _overrides[id][k] = v; if (_onUpdate) _onUpdate(_overrides); }
    function _hexToRgb(hex) { return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16); }
    function _rgbToHex(rgb) {
        if (!rgb || rgb.charAt(0) === '#') return rgb || '#000000';
        var m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return '#000000';
        return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1);
    }

    /* ─── Public API ─── */
    return {
        init: init,
        getOverlayScript: function () { return _getOverlayScript(); },
        getOverrides: function () { return _overrides; },
        setOverrides: function (o) { _overrides = o || {}; },
        getVideoConfig: function () { return { frames: _videoFrames, config: _videoConfig }; },
        getPages: function () { return _pages; },
        destroy: function () { _active = false; _selectedId = null; window.removeEventListener('message', _handleMessage); }
    };
})();
