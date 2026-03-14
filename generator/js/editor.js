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
    var _videoConfig = { fps: 24, speed: 1, loop: false, active: false };
    var _pages = [{ id: 'home', name: 'Home' }];
    var _currentPage = 'home';
    var _zoom = 100;

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
      opacity:Math.round(parseFloat(cs.opacity)*100)
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
function applyFx(el,name,intensity,c1,c2){
  var id=el.getAttribute("data-arbel-id"),old=fxMap[id];
  if(old){cancelAnimationFrame(old.raf);if(old.cv&&old.cv.parentNode)old.cv.parentNode.removeChild(old.cv);delete fxMap[id]}
  if(name==="none")return;
  var count=intensity||50;
  var col1=c1||"100,108,255";var col2=c2||"11,218,81";
  var pos=getComputedStyle(el).position;if(pos==="static")el.style.position="relative";
  var cv=document.createElement("canvas");cv.className="arbel-fx-cv";el.insertBefore(cv,el.firstChild);
  var ctx=cv.getContext("2d");
  function rsz(){cv.width=el.offsetWidth;cv.height=el.offsetHeight}rsz();
  var ps=[];
  for(var i=0;i<count;i++)ps.push({
    x:Math.random()*cv.width,y:Math.random()*cv.height,
    vx:(Math.random()-.5)*.8,vy:(Math.random()-.5)*.8,
    sz:Math.random()*3+1,a:Math.random()*.5+.2,p:Math.random()*6.28,
    rot:Math.random()*360,col:Math.random()>.5?col1:col2
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
      else{ctx.fillStyle="rgba("+p.col+","+al+")"}
      ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0;
    });raf=requestAnimationFrame(draw)
  }draw();
  fxMap[id]={cv:cv,raf:raf};window.addEventListener("resize",rsz);
}

var videoLayer=null;
function setupVideoLayer(frames,cfg){
  if(videoLayer){if(videoLayer.el.parentNode)videoLayer.el.parentNode.removeChild(videoLayer.el);videoLayer=null}
  if(!frames||!frames.length)return;
  var div=document.createElement("div");div.className="arbel-video-layer";
  var cvl=document.createElement("canvas");div.appendChild(cvl);document.body.insertBefore(div,document.body.firstChild);
  var ctxl=cvl.getContext("2d");
  var imgs=frames.map(function(src){var im=new Image();im.src=src;return im});
  var speed=cfg.speed||1;var loop2=cfg.loop||false;
  function rsz(){cvl.width=window.innerWidth;cvl.height=window.innerHeight}rsz();
  window.addEventListener("resize",rsz);
  var lastFrame=-1;
  function onScroll(){
    var scrollMax=document.documentElement.scrollHeight-window.innerHeight;
    if(scrollMax<=0)return;
    var progress=window.scrollY/scrollMax*speed;
    if(loop2)progress=progress%1;else progress=Math.min(progress,1);
    var idx2=Math.min(Math.floor(progress*imgs.length),imgs.length-1);
    if(idx2!==lastFrame&&imgs[idx2]&&imgs[idx2].complete){
      ctxl.clearRect(0,0,cvl.width,cvl.height);
      ctxl.drawImage(imgs[idx2],0,0,cvl.width,cvl.height);lastFrame=idx2}
  }
  window.addEventListener("scroll",onScroll,{passive:true});onScroll();
  videoLayer={el:div,imgs:imgs};
}

window.addEventListener("message",function(e){
  var d=e.data;if(!d||!d.type)return;
  if(d.type==="arbel-set-text"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.textContent=d.text}
  if(d.type==="arbel-set-style"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el&&d.prop)el.style[d.prop]=d.value}
  if(d.type==="arbel-set-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-anim",d.animation);prevAnim(el,d.animation)}}
  if(d.type==="arbel-set-continuous"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-continuous",d.animation);applyContinuous(el,d.animation)}}
  if(d.type==="arbel-set-hover"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-hover",d.hover);applyHover(el,d.hover)}}
  if(d.type==="arbel-set-effect"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-effect",d.effect);applyFx(el,d.effect,d.intensity,d.color1,d.color2)}}
  if(d.type==="arbel-preview-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)prevAnim(el,d.animation)}
  if(d.type==="arbel-select-by-id"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.scrollIntoView({behavior:"smooth",block:"center"});sel(el)}}
  if(d.type==="arbel-set-backdrop"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){var bm={"blur-sm":"blur(4px)","blur-md":"blur(8px)","blur-lg":"blur(16px)",saturate:"saturate(2)",grayscale:"grayscale(1)",sepia:"sepia(1)"};el.style.backdropFilter=bm[d.value]||"none"}}
  if(d.type==="arbel-set-shadow"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){var sm={sm:"0 2px 8px rgba(0,0,0,.15)",md:"0 4px 16px rgba(0,0,0,.2)",lg:"0 8px 32px rgba(0,0,0,.25)",xl:"0 16px 64px rgba(0,0,0,.3)",glow:"0 0 30px rgba(100,108,255,.4)",neon:"0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)",inner:"inset 0 2px 10px rgba(0,0,0,.3)"};el.style.boxShadow=sm[d.value]||"none"}}
  if(d.type==="arbel-set-video-layer"){setupVideoLayer(d.frames,d.config)}
  if(d.type==="arbel-load-font"){var link=document.createElement("link");link.rel="stylesheet";link.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(d.font)+":wght@300;400;500;600;700;800;900&display=swap";document.head.appendChild(link)}
});

var tree=[];
document.querySelectorAll("[data-arbel-id]").forEach(function(el){
  tree.push({id:el.getAttribute("data-arbel-id"),tag:el.tagName.toLowerCase(),
    editable:el.hasAttribute("data-arbel-edit"),
    text:el.getAttribute("data-arbel-edit")==="text"?el.textContent.substring(0,50):null});
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
        _setupAnimationListeners();
        _setupEffectListeners();
        _setupVideoLayer();
        _setupParticleBuilder();
        _setupPageManagement();
        window.addEventListener('message', _handleMessage);
    }

    /* ─── Message handler ─── */
    function _handleMessage(e) {
        var d = e.data;
        if (!d || !d.type || !_active) return;
        if (d.type === 'arbel-tree') _renderElementTree(d.tree);
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

    /* ─── Animation listeners ─── */
    function _setupAnimationListeners() {
        if (!_container) return;
        _on('.editor-anim-select', 'change', function () { if (_selectedId) { _postIframe('arbel-set-animation', { id: _selectedId, animation: this.value }); _setOv(_selectedId, 'animation', this.value); } });
        _on('.editor-preview-anim', 'click', function () { if (_selectedId) { var sel = _qs('.editor-anim-select'); _postIframe('arbel-preview-animation', { id: _selectedId, animation: sel ? sel.value : 'none' }); } });
        _on('#editorContinuous', 'change', function () { if (_selectedId) { _postIframe('arbel-set-continuous', { id: _selectedId, animation: this.value }); _setOv(_selectedId, 'continuous', this.value); } });
        _on('.editor-hover-select', 'change', function () { if (_selectedId) { _postIframe('arbel-set-hover', { id: _selectedId, hover: this.value }); _setOv(_selectedId, 'hover', this.value); } });
    }

    /* ─── Effect listeners ─── */
    function _setupEffectListeners() {
        if (!_container) return;
        _on('.editor-effect-select', 'change', function () {
            if (!_selectedId) return;
            var int = _qs('#editorEffectIntensity'), c1 = _qs('#editorEffectColor1'), c2 = _qs('#editorEffectColor2');
            _postIframe('arbel-set-effect', {
                id: _selectedId, effect: this.value,
                intensity: int ? parseInt(int.value) : 50,
                color1: c1 ? _hexToRgb(c1.value) : '100,108,255',
                color2: c2 ? _hexToRgb(c2.value) : '11,218,81'
            });
            _setOv(_selectedId, 'effect', this.value);
        });
        _on('#editorEffectIntensity', 'input', function () { var v = _qs('#editorEffectIntensityVal'); if (v) v.textContent = this.value + '%'; });
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
                _generatePresetFrames(btn.getAttribute('data-preset'));
            });
        });
        _on('#videoFps', 'input', function () { _videoConfig.fps = parseInt(this.value); _qs('#videoFpsVal').textContent = this.value; });
        _on('#videoSpeed', 'input', function () { _videoConfig.speed = parseFloat(this.value); _qs('#videoSpeedVal').textContent = parseFloat(this.value).toFixed(1) + 'x'; });
        _on('#videoLoop', 'change', function () { _videoConfig.loop = this.checked; });
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
        video.muted = true; video.playsInline = true;
        video.src = URL.createObjectURL(file);
        var progressEl = _qs('#videoProgress'), fillEl = _qs('#videoProgressFill'), textEl = _qs('#videoProgressText');
        if (progressEl) progressEl.style.display = '';
        video.addEventListener('loadedmetadata', function () {
            var duration = Math.min(video.duration, 30), fps = _videoConfig.fps, total = Math.floor(duration * fps);
            var canvas = document.createElement('canvas');
            canvas.width = Math.min(video.videoWidth, 1280); canvas.height = Math.min(video.videoHeight, 720);
            var ctx = canvas.getContext('2d'), frames = [], idx = 0;
            function next() {
                if (idx >= total) { _videoFrames = frames; URL.revokeObjectURL(video.src); if (progressEl) progressEl.style.display = 'none'; _showVideoPreview(frames, total, fps, duration); return; }
                video.currentTime = idx / fps;
            }
            video.addEventListener('seeked', function onSeek() {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.75));
                idx++;
                if (fillEl) fillEl.style.width = Math.round((idx / total) * 100) + '%';
                if (textEl) textEl.textContent = 'Extracting: ' + idx + '/' + total;
                next();
            });
            next();
        });
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
                if (loaded === sorted.length) { _videoFrames = frames.filter(Boolean); if (progressEl) progressEl.style.display = 'none'; _showVideoPreview(_videoFrames, _videoFrames.length, _videoConfig.fps, _videoFrames.length / _videoConfig.fps); }
            };
            reader.readAsDataURL(file);
        });
    }

    function _generatePresetFrames(preset) {
        var w = 640, h = 360, total = 120;
        var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d'), frames = [], idx = 0;
        var progressEl = _qs('#videoProgress'), fillEl = _qs('#videoProgressFill'), textEl = _qs('#videoProgressText');
        if (progressEl) progressEl.style.display = '';
        function gen() {
            if (idx >= total) { _videoFrames = frames; if (progressEl) progressEl.style.display = 'none'; _showVideoPreview(frames, total, _videoConfig.fps, total / _videoConfig.fps); return; }
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
            for (var i = 0; i < Math.min(cfg.count, 60); i++) ps.push({ x: Math.random() * cw, y: Math.random() * ch, vx: (Math.random() - .5) * cfg.speed, vy: (Math.random() - .5) * cfg.speed, sz: Math.random() * cfg.size + 1, col: [cfg.color1, cfg.color2, cfg.color3][i % 3], rot: Math.random() * 360, p: Math.random() * 6.28 });
            function draw() {
                pCtx.clearRect(0, 0, cw, ch); pCtx.fillStyle = '#0a0a0f'; pCtx.fillRect(0, 0, cw, ch);
                ps.forEach(function (p) {
                    p.x += p.vx; p.y += p.vy; p.p += .02;
                    if (p.x < 0) p.x = cw; if (p.x > cw) p.x = 0; if (p.y < 0) p.y = ch; if (p.y > ch) p.y = 0;
                    if (cfg.glow > 0) { pCtx.shadowBlur = cfg.glow; pCtx.shadowColor = p.col; }
                    pCtx.fillStyle = p.col; pCtx.beginPath(); pCtx.arc(p.x, p.y, p.sz, 0, 6.28); pCtx.fill(); pCtx.shadowBlur = 0;
                });
                if (cfg.connect) {
                    pCtx.strokeStyle = 'rgba(100,108,255,0.1)'; pCtx.lineWidth = .5;
                    for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) {
                        var dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
                        if (dx * dx + dy * dy < 3600) { pCtx.beginPath(); pCtx.moveTo(ps[i].x, ps[i].y); pCtx.lineTo(ps[j].x, ps[j].y); pCtx.stroke(); }
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
            _postIframe('arbel-set-effect', { id: _selectedId, effect: cfg.type, intensity: cfg.count, color1: _hexToRgb(cfg.color1), color2: _hexToRgb(cfg.color2) });
            _setOv(_selectedId, 'effect', cfg.type); _setOv(_selectedId, 'effectConfig', cfg);
        });
        _on('#pbuilderGlobal', 'click', function () {
            if (!_iframe) return;
            var cfg = getCfg(), tree = _qs('#editorTree');
            if (tree && tree.children[0]) {
                var firstId = tree.children[0].getAttribute('data-tree-id');
                if (firstId) {
                    _postIframe('arbel-set-effect', { id: firstId, effect: cfg.type, intensity: cfg.count, color1: _hexToRgb(cfg.color1), color2: _hexToRgb(cfg.color2) });
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
        if (animSelect) animSelect.value = info.currentAnimation || 'none';
        if (hoverSelect) hoverSelect.value = info.currentHover || 'none';
        if (effectSelect) effectSelect.value = info.currentEffect || 'none';
        if (contSelect) contSelect.value = info.currentContinuous || 'none';
        if (info.styles) {
            var st = info.styles;
            var fs = _qs('#editorFontSize'), fw = _qs('#editorFontWeight'), lh = _qs('#editorLineHeight'), ls = _qs('#editorLetterSpacing');
            var rad = _qs('#editorRadius'), radV = _qs('#editorRadiusVal'), opa = _qs('#editorOpacity'), opaV = _qs('#editorOpacityVal');
            if (fs) fs.value = st.fontSize; if (fw) fw.value = st.fontWeight;
            if (lh) lh.value = typeof st.lineHeight === 'number' ? st.lineHeight.toFixed(1) : '';
            if (ls) ls.value = st.letterSpacing || '';
            if (rad) rad.value = st.borderRadius; if (radV) radV.textContent = st.borderRadius + 'px';
            if (opa) opa.value = st.opacity; if (opaV) opaV.textContent = st.opacity + '%';
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

    /* ─── Element tree ─── */
    function _renderElementTree(tree) {
        var treeEl = _qs('#editorTree'); if (!treeEl) return;
        treeEl.innerHTML = '';
        tree.forEach(function (item) {
            var div = document.createElement('div');
            div.className = 'editor-tree-item'; div.setAttribute('data-tree-id', item.id);
            div.innerHTML = '<span class="tree-tag">&lt;' + item.tag + '&gt;</span><span class="tree-id">' + item.id + '</span>' + (item.text ? '<span class="tree-text">' + item.text + '</span>' : '');
            div.addEventListener('click', function () { if (_iframe) _iframe.contentWindow.postMessage({ type: 'arbel-select-by-id', id: item.id }, '*'); });
            treeEl.appendChild(div);
        });
    }

    /* ─── Helpers ─── */
    function _qs(sel) { return _container ? _container.querySelector(sel) : document.querySelector(sel); }
    function _on(sel, evt, fn) { var el = typeof sel === 'string' ? _qs(sel) : sel; if (el) el.addEventListener(evt, fn); }
    function _postIframe(type, data) { if (_iframe && _iframe.contentWindow) { data.type = type; _iframe.contentWindow.postMessage(data, '*'); } }
    function _setOv(id, k, v) { if (!_overrides[id]) _overrides[id] = {}; _overrides[id][k] = v; if (_onUpdate) _onUpdate(_overrides); }
    function _hexToRgb(hex) { return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16); }

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
