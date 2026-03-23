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
    var _menuBgColor = '';
    var _menuBgEnabled = true;
    var _draggingId = null;  // element being dragged/resized — skip responsive during drag
    var _pages = [{ id: 'home', name: 'Home', path: '/', isHome: true, showInNav: false }];
    var _currentPage = 'home';
    var _zoom = 100;
    var _lastTree = [];
    var _keydownHandler = null;
    var _activeDevice = 'desktop'; // 'desktop' | 'tablet' | 'mobile'
    var _navOpenState = false; // tracked via iframe message

    /* ─── Undo / Redo state ─── */
    var _MAX_UNDO = 40;
    var _undoStack = [];
    var _redoStack = [];
    var _undoLocked = false;
    /* Per-category pending snapshots for debounced edits.
       Each category gets its own pre-mutation snapshot + timer
       so mixed edits never cross-contaminate. */
    var _burstSnapshots = {};   // { category: { snapshot, timer } }
    var _iframeTextUndoPushed = false; // guard for inline iframe text edits
    var _resizeUndoPushed = false; // guard for iframe resize
    var _moveUndoPushed = false;   // guard for iframe drag-move
    var _rotateUndoPushed = false; // guard for iframe rotate
    var _clipboard = null;           // copy/paste styles: { overrides, tag }
    var _addedCount = 0;             // counter for dynamically added elements
    var _addedElements = [];         // track added element IDs for export

    /* ─── Shape & Frame Definitions (matches cinematic) ─── */
    var SHAPE_PATHS = {
        'circle':         { svg: '<ellipse cx="50" cy="50" rx="48" ry="48"/>', clip: 'circle(50% at 50% 50%)' },
        'square':         { svg: '<rect x="2" y="2" width="96" height="96"/>', clip: 'inset(0)' },
        'rounded-square': { svg: '<rect x="2" y="2" width="96" height="96" rx="16"/>', clip: 'inset(0 round 16%)' },
        'triangle':       { svg: '<polygon points="50,2 98,98 2,98"/>', clip: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
        'diamond':        { svg: '<polygon points="50,2 98,50 50,98 2,50"/>', clip: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
        'pentagon':       { svg: '<polygon points="50,2 97,36 79,96 21,96 3,36"/>', clip: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
        'hexagon':        { svg: '<polygon points="50,2 93,27 93,73 50,98 7,73 7,27"/>', clip: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
        'octagon':        { svg: '<polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"/>', clip: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' },
        'star':           { svg: '<polygon points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38"/>', clip: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
        'heart':          { svg: '<path d="M50,90 C20,60 2,40 2,25 A22,22,0,0,1,50,20 A22,22,0,0,1,98,25 C98,40 80,60 50,90Z"/>', clip: 'polygon(50% 0%, 61% 0%, 72% 4%, 81% 12%, 88% 22%, 93% 34%, 95% 46%, 93% 58%, 86% 70%, 75% 80%, 60% 90%, 50% 100%, 40% 90%, 25% 80%, 14% 70%, 7% 58%, 5% 46%, 7% 34%, 12% 22%, 19% 12%, 28% 4%, 39% 0%)' },
        'cross':          { svg: '<polygon points="35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35"/>', clip: 'polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)' },
        'arrow-right':    { svg: '<polygon points="2,20 65,20 65,2 98,50 65,98 65,80 2,80"/>', clip: 'polygon(0% 20%, 65% 20%, 65% 0%, 100% 50%, 65% 100%, 65% 80%, 0% 80%)' },
        'ring':           { svg: '<circle cx="50" cy="50" r="46" stroke-width="8" fill="none"/>', clip: null, isStroke: true },
        'semicircle':     { svg: '<path d="M2,98 A48,48,0,0,1,98,98Z"/>', clip: 'ellipse(50% 50% at 50% 100%)' },
        'pill':           { svg: '<rect x="2" y="20" width="96" height="60" rx="30"/>', clip: 'inset(20% 0 20% 0 round 50%)' },
        'parallelogram':  { svg: '<polygon points="20,2 98,2 80,98 2,98"/>', clip: 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)' },
        'arch':           { svg: '<path d="M2,98 L2,50 A48,48,0,0,1,98,50 L98,98Z"/>', clip: 'polygon(0% 100%, 0% 50%, 5% 35%, 15% 20%, 28% 9%, 43% 3%, 57% 3%, 72% 9%, 85% 20%, 95% 35%, 100% 50%, 100% 100%)' }
    };

    function _buildShapeSvg(shapeName, fillColor, strokeColor, strokeWidth) {
        var def = SHAPE_PATHS[shapeName] || SHAPE_PATHS['circle'];
        var fc = fillColor || 'none';
        var sc = strokeColor || 'none';
        var sw = parseFloat(strokeWidth) || 0;
        var attrs = ' fill="' + fc + '"';
        if (sc !== 'none' && sw > 0) attrs += ' stroke="' + sc + '" stroke-width="' + sw + '"';
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' + def.svg.replace('/>', attrs + '/>') + '</svg>';
    }
    function _getOverlayScript() {
        return `(function(){
/* Dismiss preloader & reveal hidden content so editor is interactive immediately */
var _pre=document.getElementById("preloader");if(_pre)_pre.classList.add("done");
document.querySelectorAll(".line-inner").forEach(function(el){el.style.transform="translateY(0)";});
document.querySelectorAll(".hero-sub,.hero-actions,.reveal-up").forEach(function(el){el.style.opacity="1";el.style.transform="translateY(0)";});
var selected=null,editing=false,resize=null;
var s=document.createElement("style");
s.textContent=\`
[data-arbel-id]{cursor:pointer;transition:outline .15s,outline-offset .15s}
[data-arbel-id]:hover:not(.arbel-sel){outline:2px dashed rgba(100,108,255,.5);outline-offset:2px}
.arbel-sel{outline:2px solid #646cff!important;outline-offset:3px!important}
.arbel-editing{outline-color:#0bda51!important;min-height:1em}
.arbel-lbl{position:fixed;top:8px;left:8px;z-index:99999;background:#646cff;color:#fff;
font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;
opacity:0;transition:opacity .2s}.arbel-lbl.vis{opacity:1}
.arbel-sz-lbl{position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;
font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;
opacity:0;transition:opacity .15s}.arbel-sz-lbl.vis{opacity:1}
.arbel-rh{position:fixed;width:8px;height:8px;background:#646cff;border:1px solid #fff;
border-radius:1px;z-index:100000;display:none;box-sizing:border-box}
.arbel-rh-nw{cursor:nw-resize}.arbel-rh-n{cursor:n-resize}.arbel-rh-ne{cursor:ne-resize}
.arbel-rh-w{cursor:w-resize}.arbel-rh-e{cursor:e-resize}
.arbel-rh-sw{cursor:sw-resize}.arbel-rh-s{cursor:s-resize}.arbel-rh-se{cursor:se-resize}
.arbel-rot{position:fixed;width:16px;height:16px;border-radius:50%;background:#646cff;border:2px solid #fff;
z-index:100001;cursor:grab;display:none;box-sizing:border-box;transform:translate(-50%,-50%)}
.arbel-rot:hover{background:#8b5cf6}
.arbel-rot-line{position:fixed;width:1px;background:rgba(100,108,255,.5);z-index:100000;display:none;pointer-events:none}
.arbel-dragging{outline:2px solid #ff6b35!important;outline-offset:3px!important}
.arbel-grid-active{background-image:linear-gradient(rgba(100,108,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(100,108,255,0.06) 1px,transparent 1px)!important;background-size:20px 20px!important;background-position:0 0!important}
.arbel-snap-line{position:fixed;z-index:99998;display:none;pointer-events:none}
.arbel-snap-line-h{left:0;height:1px;width:100%;background:linear-gradient(90deg,transparent,#ff6b35 10%,#ff6b35 90%,transparent)}
.arbel-snap-line-v{top:0;width:1px;height:100%;background:linear-gradient(transparent,#ff6b35 10%,#ff6b35 90%,transparent)}
.arbel-guide-line{position:fixed;z-index:99997;display:none;pointer-events:none}
.arbel-guide-line-h{left:0;height:1px;width:100%;border-top:1px dashed rgba(100,108,255,.5)}
.arbel-guide-line-v{top:0;width:1px;height:100%;border-left:1px dashed rgba(100,108,255,.5)}
.arbel-dist-lbl{position:fixed;z-index:99999;background:#ff6b35;color:#fff;font-family:monospace;font-size:9px;padding:1px 4px;border-radius:2px;pointer-events:none;display:none;white-space:nowrap}
.arbel-pos-lbl{position:fixed;bottom:8px;left:8px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;
font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;
opacity:0;transition:opacity .15s}.arbel-pos-lbl.vis{opacity:1}
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
@keyframes arbel-wobble{0%{transform:rotate(0)}15%{transform:rotate(-5deg)}30%{transform:rotate(3deg)}45%{transform:rotate(-3deg)}60%{transform:rotate(2deg)}75%{transform:rotate(-1deg)}100%{transform:rotate(0)}}
@keyframes arbel-flash{0%,50%,100%{opacity:1}25%,75%{opacity:0}}
@keyframes arbel-headShake{0%{transform:translateX(0)}6.5%{transform:translateX(-6px) rotateY(-9deg)}18.5%{transform:translateX(5px) rotateY(7deg)}31.5%{transform:translateX(-3px) rotateY(-5deg)}43.5%{transform:translateX(2px) rotateY(3deg)}50%{transform:translateX(0)}}
@keyframes arbel-wave-text{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes arbel-drift{0%{transform:translate(0,0)}25%{transform:translate(10px,-5px)}50%{transform:translate(-5px,10px)}75%{transform:translate(-10px,-5px)}100%{transform:translate(0,0)}}
@keyframes arbel-sway{0%,100%{transform:rotate(0) translateX(0)}25%{transform:rotate(2deg) translateX(6px)}75%{transform:rotate(-2deg) translateX(-6px)}}
\`;document.head.appendChild(s);

var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);
var szLbl=document.createElement("div");szLbl.className="arbel-sz-lbl";document.body.appendChild(szLbl);
var posLbl=document.createElement("div");posLbl.className="arbel-pos-lbl";document.body.appendChild(posLbl);

/* ── Rotate handle ── */
var rotHandle=document.createElement("div");rotHandle.className="arbel-rot";document.body.appendChild(rotHandle);
var rotLine=document.createElement("div");rotLine.className="arbel-rot-line";document.body.appendChild(rotLine);

/* ── Snap guide lines (multiple) ── */
var GUIDE_POOL_H=[],GUIDE_POOL_V=[],SNAP_POOL_H=[],SNAP_POOL_V=[],DIST_POOL=[];
function mkLine(cls,pool,n){for(var i=0;i<n;i++){var d=document.createElement('div');d.className=cls;document.body.appendChild(d);pool.push(d)}}
mkLine('arbel-guide-line arbel-guide-line-h',GUIDE_POOL_H,3);
mkLine('arbel-guide-line arbel-guide-line-v',GUIDE_POOL_V,3);
mkLine('arbel-snap-line arbel-snap-line-h',SNAP_POOL_H,4);
mkLine('arbel-snap-line arbel-snap-line-v',SNAP_POOL_V,4);
for(var _di=0;_di<4;_di++){var dl=document.createElement('div');dl.className='arbel-dist-lbl';document.body.appendChild(dl);DIST_POOL.push(dl)}
var _guideHUsed=0,_guideVUsed=0,_snapHUsed=0,_snapVUsed=0,_distUsed=0;
function resetGuides(){
_guideHUsed=0;_guideVUsed=0;_snapHUsed=0;_snapVUsed=0;_distUsed=0;
GUIDE_POOL_H.forEach(function(g){g.style.display='none'});
GUIDE_POOL_V.forEach(function(g){g.style.display='none'});
SNAP_POOL_H.forEach(function(s){s.style.display='none'});
SNAP_POOL_V.forEach(function(s){s.style.display='none'});
DIST_POOL.forEach(function(d){d.style.display='none'});
}
function showGuideH(y){if(_guideHUsed<GUIDE_POOL_H.length){var g=GUIDE_POOL_H[_guideHUsed++];g.style.top=y+'px';g.style.display='block'}}
function showGuideV(x){if(_guideVUsed<GUIDE_POOL_V.length){var g=GUIDE_POOL_V[_guideVUsed++];g.style.left=x+'px';g.style.display='block'}}
function showSnapH(y){if(_snapHUsed<SNAP_POOL_H.length){var s=SNAP_POOL_H[_snapHUsed++];s.style.top=y+'px';s.style.display='block'}}
function showSnapV(x){if(_snapVUsed<SNAP_POOL_V.length){var s=SNAP_POOL_V[_snapVUsed++];s.style.left=x+'px';s.style.display='block'}}
function showDist(x,y,text){if(_distUsed<DIST_POOL.length){var d=DIST_POOL[_distUsed++];d.style.left=x+'px';d.style.top=y+'px';d.textContent=text;d.style.display='block'}}
function hideAllGuides(){
GUIDE_POOL_H.forEach(function(g){g.style.display='none'});
GUIDE_POOL_V.forEach(function(g){g.style.display='none'});
SNAP_POOL_H.forEach(function(s){s.style.display='none'});
SNAP_POOL_V.forEach(function(s){s.style.display='none'});
DIST_POOL.forEach(function(d){d.style.display='none'});
document.body.classList.remove('arbel-grid-active');
}

/* ── Resize handles ── */
var rHandles=[];
["nw","n","ne","w","e","sw","s","se"].forEach(function(p){
  var h=document.createElement("div");h.className="arbel-rh arbel-rh-"+p;
  h.setAttribute("data-rh",p);document.body.appendChild(h);rHandles.push(h);
});
function posHandles(el){
  if(!el){rHandles.forEach(function(h){h.style.display="none"});rotHandle.style.display="none";rotLine.style.display="none";return}
  var r=el.getBoundingClientRect(),hs=4;
  rHandles.forEach(function(h){
    var p=h.getAttribute("data-rh"),t,l;
    if(p.indexOf("n")>=0)t=r.top-hs;else if(p.indexOf("s")>=0)t=r.bottom-hs;else t=r.top+r.height/2-hs;
    if(p.indexOf("w")>=0)l=r.left-hs;else if(p.indexOf("e")>=0)l=r.right-hs;else l=r.left+r.width/2-hs;
    h.style.top=t+"px";h.style.left=l+"px";h.style.display="";
  });
  /* Rotate handle: 30px above center top */
  var rcx=r.left+r.width/2,rcy=r.top-30;
  rotHandle.style.left=rcx+"px";rotHandle.style.top=rcy+"px";rotHandle.style.display="";
  rotLine.style.left=(rcx-0.5)+"px";rotLine.style.top=rcy+"px";rotLine.style.height=(r.top-rcy)+"px";rotLine.style.display="";
}
rHandles.forEach(function(h){
  h.addEventListener("mousedown",function(e){
    if(!selected||editing)return;e.stopPropagation();e.preventDefault();
    resize={el:selected,handle:h.getAttribute("data-rh"),
      startX:e.clientX,startY:e.clientY,
      origW:selected.offsetWidth,origH:selected.offsetHeight};
    window.parent.postMessage({type:"arbel-resize-start"},"*");
  });
});
document.addEventListener("mousemove",function(e){
  if(!resize)return;
  var dx=e.clientX-resize.startX,dy=e.clientY-resize.startY;
  var h=resize.handle,nw=resize.origW,nh=resize.origH;
  if(h.indexOf("e")>=0)nw=Math.max(20,resize.origW+dx);
  if(h.indexOf("w")>=0)nw=Math.max(20,resize.origW-dx);
  if(h.indexOf("s")>=0)nh=Math.max(20,resize.origH+dy);
  if(h.indexOf("n")>=0)nh=Math.max(20,resize.origH-dy);
  resize.el.style.setProperty('width',nw+'px','important');resize.el.style.setProperty('height',nh+'px','important');
  posHandles(resize.el);
  szLbl.textContent=nw+" \\u00D7 "+nh;szLbl.classList.add("vis");
  window.parent.postMessage({type:"arbel-resize",
    id:resize.el.getAttribute("data-arbel-id"),
    width:nw+"px",height:nh+"px"},"*");
});
document.addEventListener("mouseup",function(e){
  if(!resize)return;
  szLbl.classList.remove("vis");
  window.parent.postMessage({type:"arbel-resize-end",id:resize.el.getAttribute("data-arbel-id")},"*");
  resize=null;
});
window.addEventListener("scroll",function(){if(selected&&!resize&&!drag&&!rotating)posHandles(selected)},true);
window.addEventListener("resize",function(){if(selected)posHandles(selected)});

/* ── Snap guide computation (Canva-style) ── */
var SNAP_DIST=12;
function hideSnap(){hideAllGuides()}
function computeSnap(elRect){
  resetGuides();
  var sx=null,sy=null;
  var vw=window.innerWidth,vh=window.innerHeight;
  var cx=elRect.left+elRect.width/2,cy=elRect.top+elRect.height/2;
  /* viewport center */
  if(Math.abs(cx-vw/2)<SNAP_DIST){sx=vw/2-elRect.width/2;showGuideV(vw/2)}
  if(Math.abs(cy-vh/2)<SNAP_DIST){sy=vh/2-elRect.height/2;showGuideH(vh/2)}
  /* viewport thirds */
  if(sx===null&&Math.abs(cx-vw/3)<SNAP_DIST){sx=vw/3-elRect.width/2;showGuideV(Math.round(vw/3))}
  if(sx===null&&Math.abs(cx-vw*2/3)<SNAP_DIST){sx=vw*2/3-elRect.width/2;showGuideV(Math.round(vw*2/3))}
  /* parent section alignment */
  var parent=selected?selected.closest('section'):null;
  if(parent){
    var pr=parent.getBoundingClientRect();
    var pcx=pr.left+pr.width/2,pcy=pr.top+pr.height/2;
    /* section center */
    if(sx===null&&Math.abs(cx-pcx)<SNAP_DIST){sx=pcx-elRect.width/2;showGuideV(Math.round(pcx))}
    if(sy===null&&Math.abs(cy-pcy)<SNAP_DIST){sy=pcy-elRect.height/2;showGuideH(Math.round(pcy))}
    /* section edges (with padding) */
    var pad=16;
    if(sx===null&&Math.abs(elRect.left-(pr.left+pad))<SNAP_DIST){sx=pr.left+pad;showSnapV(Math.round(pr.left+pad));showDist(pr.left+pad+4,elRect.top-14,pad+'px')}
    if(sx===null&&Math.abs(elRect.right-(pr.right-pad))<SNAP_DIST){sx=pr.right-pad-elRect.width;showSnapV(Math.round(pr.right-pad));showDist(pr.right-pad+4,elRect.top-14,pad+'px')}
    if(sy===null&&Math.abs(elRect.top-(pr.top+pad))<SNAP_DIST){sy=pr.top+pad;showSnapH(Math.round(pr.top+pad));showDist(elRect.left-28,pr.top+pad+2,pad+'px')}
    if(sy===null&&Math.abs(elRect.bottom-(pr.bottom-pad))<SNAP_DIST){sy=pr.bottom-pad-elRect.height;showSnapH(Math.round(pr.bottom-pad));showDist(elRect.left-28,pr.bottom-pad+2,pad+'px')}
  }
  /* other elements */
  var others=document.querySelectorAll('[data-arbel-id]');
  others.forEach(function(o){
    if(o===selected)return;
    var or=o.getBoundingClientRect();
    var ocx=or.left+or.width/2,ocy=or.top+or.height/2;
    /* horizontal alignment (center, top-top, bottom-bottom, top-bottom, bottom-top) */
    if(sy===null&&Math.abs(cy-ocy)<SNAP_DIST){sy=ocy-elRect.height/2;showSnapH(Math.round(ocy))}
    if(sy===null&&Math.abs(elRect.top-or.top)<SNAP_DIST){sy=or.top;showSnapH(Math.round(or.top))}
    if(sy===null&&Math.abs(elRect.bottom-or.bottom)<SNAP_DIST){sy=or.bottom-elRect.height;showSnapH(Math.round(or.bottom))}
    if(sy===null&&Math.abs(elRect.top-or.bottom)<SNAP_DIST){sy=or.bottom;showSnapH(Math.round(or.bottom));showDist(Math.max(elRect.left,or.left),or.bottom+2,'0px')}
    if(sy===null&&Math.abs(elRect.bottom-or.top)<SNAP_DIST){sy=or.top-elRect.height;showSnapH(Math.round(or.top));showDist(Math.max(elRect.left,or.left),or.top+2,'0px')}
    /* vertical alignment (center, left-left, right-right, left-right, right-left) */
    if(sx===null&&Math.abs(cx-ocx)<SNAP_DIST){sx=ocx-elRect.width/2;showSnapV(Math.round(ocx))}
    if(sx===null&&Math.abs(elRect.left-or.left)<SNAP_DIST){sx=or.left;showSnapV(Math.round(or.left))}
    if(sx===null&&Math.abs(elRect.right-or.right)<SNAP_DIST){sx=or.right-elRect.width;showSnapV(Math.round(or.right))}
    if(sx===null&&Math.abs(elRect.left-or.right)<SNAP_DIST){sx=or.right;showSnapV(Math.round(or.right));showDist(or.right+2,Math.max(elRect.top,or.top),'0px')}
    if(sx===null&&Math.abs(elRect.right-or.left)<SNAP_DIST){sx=or.left-elRect.width;showSnapV(Math.round(or.left));showDist(or.left+2,Math.max(elRect.top,or.top),'0px')}
    /* Show distance when vertically aligned but not snapped */
    if(sx!==null&&Math.abs(cx-ocx)<SNAP_DIST){
      var gap=0;
      if(elRect.bottom<or.top)gap=Math.round(or.top-elRect.bottom);
      else if(elRect.top>or.bottom)gap=Math.round(elRect.top-or.bottom);
      if(gap>0)showDist(Math.round(cx),Math.round(Math.min(elRect.bottom,or.bottom)+gap/2-6),gap+'px');
    }
  });
  return{x:sx,y:sy}
}

/* ── Drag to move ── */
var drag=null,dragThreshold=4,didDrag=false;
function initDrag(el,e){
  var pos=getComputedStyle(el).position;
  if(pos==="static"||pos==="")el.style.position="relative";
  drag={el:el,startX:e.clientX,startY:e.clientY,
    origLeft:parseInt(el.style.left)||0,origTop:parseInt(el.style.top)||0,
    started:false};
  didDrag=false;
}
document.addEventListener("mousemove",function(e){
  if(drag&&!resize&&!rotating){
    var dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.started){if(Math.abs(dx)<dragThreshold&&Math.abs(dy)<dragThreshold)return;drag.started=true;drag.el.classList.add('arbel-dragging');document.body.classList.add('arbel-grid-active')}
    var newLeft=drag.origLeft+dx,newTop=drag.origTop+dy;
    drag.el.style.setProperty('left',newLeft+'px','important');drag.el.style.setProperty('top',newTop+'px','important');
    posHandles(drag.el);
    /* snap */
    var r2=drag.el.getBoundingClientRect();
    var snap=computeSnap(r2);
    if(snap.x!==null){var snapDx=snap.x-r2.left;drag.el.style.setProperty('left',(newLeft+snapDx)+'px','important')}
    if(snap.y!==null){var snapDy=snap.y-r2.top;drag.el.style.setProperty('top',(newTop+snapDy)+'px','important')}
    if(snap.x!==null||snap.y!==null)posHandles(drag.el);
    posLbl.textContent="x:"+parseInt(drag.el.style.left)+" y:"+parseInt(drag.el.style.top);posLbl.classList.add("vis");
    window.parent.postMessage({type:"arbel-move",id:drag.el.getAttribute("data-arbel-id"),
      left:drag.el.style.left,top:drag.el.style.top},"*");
  }
});
document.addEventListener("mouseup",function(e){
  if(drag){
    if(drag.started){drag.el.classList.remove("arbel-dragging");didDrag=true;
      window.parent.postMessage({type:"arbel-move-end",id:drag.el.getAttribute("data-arbel-id"),
        left:drag.el.style.left,top:drag.el.style.top},"*")}
    hideSnap();posLbl.classList.remove("vis");drag=null;
  }
});

/* ── Rotation ── */
var rotating=null;
rotHandle.addEventListener("mousedown",function(e){
  if(!selected||editing)return;e.stopPropagation();e.preventDefault();
  var r=selected.getBoundingClientRect();
  var cx=r.left+r.width/2,cy=r.top+r.height/2;
  var cur=selected.style.transform||"";
  var m=cur.match(/rotate\\(([\\d.\\-]+)deg\\)/);
  var startDeg=m?parseFloat(m[1]):0;
  var startAngle=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI;
  rotating={el:selected,cx:cx,cy:cy,startDeg:startDeg,startAngle:startAngle,curTransform:cur.replace(/rotate\\([^)]*\\)/,"").trim()};
});
document.addEventListener("mousemove",function(e){
  if(!rotating)return;
  var angle=Math.atan2(e.clientY-rotating.cy,e.clientX-rotating.cx)*180/Math.PI;
  var deg=rotating.startDeg+(angle-rotating.startAngle);
  if(e.shiftKey)deg=Math.round(deg/15)*15;
  var tf=rotating.curTransform;
  rotating.el.style.transform=(tf?tf+" ":"")+"rotate("+deg.toFixed(1)+"deg)";
  posHandles(rotating.el);
  posLbl.textContent=deg.toFixed(1)+"\\u00B0";posLbl.classList.add("vis");
  window.parent.postMessage({type:"arbel-rotate",id:rotating.el.getAttribute("data-arbel-id"),
    deg:deg,transform:rotating.el.style.transform},"*");
});
document.addEventListener("mouseup",function(e){
  if(rotating){posLbl.classList.remove("vis");
    window.parent.postMessage({type:"arbel-rotate-end",id:rotating.el.getAttribute("data-arbel-id"),
      transform:rotating.el.style.transform},"*");
    rotating=null}
});

/* ── Click: select element ── */
document.addEventListener("mousedown",function(e){
  if(editing)return;
  /* Check menu-btn FIRST — before resize handle guard, so handles don't block toggle */
  var mbEl=e.target.closest('.menu-btn');
  if(!mbEl){
    var arbelEl=e.target.closest('[data-arbel-id="menu-btn"]');
    if(arbelEl&&arbelEl.classList.contains('menu-btn'))mbEl=arbelEl;
  }
  if(mbEl){
    var navEl=document.getElementById('nav');
    if(navEl){
      var isOpen=navEl.classList.toggle('open');
      mbEl.classList.toggle('is-active');
      document.body.classList.toggle('nav-open',isOpen);
      window.parent.postMessage({type:'arbel-nav-state',isOpen:isOpen},'*');
    }
    e.preventDefault();e.stopPropagation();
    /* Swallow the subsequent click so the compiled main.js handler doesn't double-toggle */
    document.addEventListener('click',function _eatClick(ce){ce.stopImmediatePropagation();ce.preventDefault();document.removeEventListener('click',_eatClick,true)},true);
    sel(mbEl);
    return;
  }
  if(e.target.classList&&(e.target.classList.contains("arbel-rh")||e.target.classList.contains("arbel-rot")))return;
  var el=e.target.closest("[data-arbel-id]");
  if(!el){return}
  e.preventDefault();e.stopPropagation();
  if(selected!==el)sel(el);
  initDrag(el,e);
},true);
document.addEventListener("click",function(e){
  if(editing)return;
  /* Always block link navigation, even after drag */
  var a=e.target.closest("a");
  if(a)e.preventDefault();
  if(didDrag){didDrag=false;return}
  var el=e.target.closest("[data-arbel-id]");
  if(!el){desel();return}
},true);

document.addEventListener("dblclick",function(e){
  var el=e.target.closest('[data-arbel-edit="text"]');
  if(!el)return;e.preventDefault();startEdit(el);
},true);

document.addEventListener("mouseover",function(e){
  var el=e.target.closest("[data-arbel-id]");
  if(el&&el!==selected){lbl.textContent=el.getAttribute("data-arbel-id");lbl.classList.add("vis")}
});
document.addEventListener("mouseout",function(){lbl.classList.remove("vis")});\n\n/* ── Right-click context menu ── */\ndocument.addEventListener("contextmenu",function(e){\n  var el=e.target.closest("[data-arbel-id]");\n  if(!el)return;e.preventDefault();\n  if(selected!==el)sel(el);\n  var fr=window.frameElement?window.frameElement.getBoundingClientRect():{top:0,left:0};\n  window.parent.postMessage({type:"arbel-contextmenu",\n    id:el.getAttribute("data-arbel-id"),\n    tag:el.tagName.toLowerCase(),\n    editable:el.hasAttribute("data-arbel-edit"),\n    parentId:(el.parentElement?el.parentElement.closest("[data-arbel-id]"):null)?(el.parentElement.closest("[data-arbel-id]")).getAttribute("data-arbel-id"):null,\n    x:e.clientX+fr.left,y:e.clientY+fr.top},"*");\n});

function sel(el){
  desel();selected=el;el.classList.add("arbel-sel");
  /* Skip resize handles for menu-btn — element is too small, handles overlap and block toggle */
  if(el.classList&&el.classList.contains('menu-btn')){posHandles(null)}else{posHandles(el)}
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
  posHandles(null);
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
  fadeInLeft:{from:"opacity:0;transform:translateX(-30px)",to:"opacity:1;transform:translateX(0)"},
  fadeInRight:{from:"opacity:0;transform:translateX(30px)",to:"opacity:1;transform:translateX(0)"},
  fadeOut:{from:"opacity:1",to:"opacity:0"},
  fadeOutUp:{from:"opacity:1;transform:translateY(0)",to:"opacity:0;transform:translateY(-30px)"},
  fadeOutDown:{from:"opacity:1;transform:translateY(0)",to:"opacity:0;transform:translateY(30px)"},
  slideUp:{from:"opacity:0;transform:translateY(60px)",to:"opacity:1;transform:translateY(0)"},
  slideDown:{from:"opacity:0;transform:translateY(-60px)",to:"opacity:1;transform:translateY(0)"},
  slideLeft:{from:"opacity:0;transform:translateX(60px)",to:"opacity:1;transform:translateX(0)"},
  slideRight:{from:"opacity:0;transform:translateX(-60px)",to:"opacity:1;transform:translateX(0)"},
  scaleUp:{from:"opacity:0;transform:scale(0.7)",to:"opacity:1;transform:scale(1)"},
  scaleDown:{from:"opacity:0;transform:scale(1.3)",to:"opacity:1;transform:scale(1)"},
  scaleOut:{from:"opacity:1;transform:scale(1)",to:"opacity:0;transform:scale(0.5)"},
  zoomIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},
  zoomOut:{from:"opacity:1;transform:scale(1)",to:"opacity:0;transform:scale(0.3)"},
  bounceIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},
  bounceInUp:{from:"opacity:0;transform:translateY(50px) scale(0.9)",to:"opacity:1;transform:translateY(0) scale(1)"},
  bounceInDown:{from:"opacity:0;transform:translateY(-50px) scale(0.9)",to:"opacity:1;transform:translateY(0) scale(1)"},
  bounceInLeft:{from:"opacity:0;transform:translateX(-50px) scale(0.9)",to:"opacity:1;transform:translateX(0) scale(1)"},
  bounceInRight:{from:"opacity:0;transform:translateX(50px) scale(0.9)",to:"opacity:1;transform:translateX(0) scale(1)"},
  elasticIn:{from:"opacity:0;transform:scale(0.5)",to:"opacity:1;transform:scale(1)"},
  rotateIn:{from:"opacity:0;transform:rotate(-15deg) scale(0.9)",to:"opacity:1;transform:rotate(0) scale(1)"},
  rotateInLeft:{from:"opacity:0;transform:rotate(-90deg)",to:"opacity:1;transform:rotate(0)"},
  rotateInRight:{from:"opacity:0;transform:rotate(90deg)",to:"opacity:1;transform:rotate(0)"},
  flipIn:{from:"opacity:0;transform:perspective(400px) rotateX(90deg)",to:"opacity:1;transform:perspective(400px) rotateX(0)"},
  flipInY:{from:"opacity:0;transform:perspective(400px) rotateY(90deg)",to:"opacity:1;transform:perspective(400px) rotateY(0)"},
  flipOutX:{from:"opacity:1;transform:perspective(400px) rotateX(0)",to:"opacity:0;transform:perspective(400px) rotateX(90deg)"},
  flipOutY:{from:"opacity:1;transform:perspective(400px) rotateY(0)",to:"opacity:0;transform:perspective(400px) rotateY(90deg)"},
  blurIn:{from:"opacity:0;filter:blur(12px)",to:"opacity:1;filter:blur(0)"},
  blurInUp:{from:"opacity:0;filter:blur(12px);transform:translateY(20px)",to:"opacity:1;filter:blur(0);transform:translateY(0)"},
  blurOut:{from:"opacity:1;filter:blur(0)",to:"opacity:0;filter:blur(12px)"},
  glitchIn:{from:"opacity:0;transform:skewX(-20deg) translateX(-30px)",to:"opacity:1;transform:skewX(0) translateX(0)"},
  clipIn:{from:"clip-path:inset(0 100% 0 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  clipRevealUp:{from:"clip-path:inset(100% 0 0 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  clipRevealDown:{from:"clip-path:inset(0 0 100% 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  clipRevealLeft:{from:"clip-path:inset(0 100% 0 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  clipRevealRight:{from:"clip-path:inset(0 0 0 100%);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},
  dropIn:{from:"opacity:0;transform:translateY(-100px)",to:"opacity:1;transform:translateY(0)"},
  unfold:{from:"opacity:0;transform:scaleY(0);transform-origin:top",to:"opacity:1;transform:scaleY(1)"},
  backInUp:{from:"opacity:0;transform:translateY(100px) scale(0.7)",to:"opacity:1;transform:translateY(0) scale(1)"},
  backInDown:{from:"opacity:0;transform:translateY(-100px) scale(0.7)",to:"opacity:1;transform:translateY(0) scale(1)"},
  backInLeft:{from:"opacity:0;transform:translateX(-100px) scale(0.7)",to:"opacity:1;transform:translateX(0) scale(1)"},
  backInRight:{from:"opacity:0;transform:translateX(100px) scale(0.7)",to:"opacity:1;transform:translateX(0) scale(1)"},
  rollIn:{from:"opacity:0;transform:translateX(-100%) rotate(-120deg)",to:"opacity:1;transform:translateX(0) rotate(0)"},
  jackInTheBox:{from:"opacity:0;transform:scale(0.1) rotate(30deg);transform-origin:center bottom",to:"opacity:1;transform:scale(1) rotate(0)"},
  swingIn:{from:"opacity:0;transform:rotateX(-90deg);transform-origin:top center",to:"opacity:1;transform:rotateX(0)"},
  doorOpen:{from:"opacity:0;transform:perspective(400px) rotateY(-90deg);transform-origin:left center",to:"opacity:1;transform:perspective(400px) rotateY(0)"},
  hinge:{from:"opacity:1;transform-origin:top left",to:"opacity:0;transform:rotate(80deg) translateY(100px)"},
  lightSpeedIn:{from:"opacity:0;transform:translateX(100%) skewX(-30deg)",to:"opacity:1;transform:translateX(0) skewX(0)"},
  lightSpeedOut:{from:"opacity:1;transform:translateX(0) skewX(0)",to:"opacity:0;transform:translateX(100%) skewX(30deg)"},
  rubberBand:{from:"transform:scaleX(1)",to:"transform:scaleX(1.25) scaleY(0.75)"},
  tada:{from:"transform:scale(1) rotate(0)",to:"transform:scale(1.1) rotate(3deg)"},
  jello:{from:"transform:skewX(0) skewY(0)",to:"transform:skewX(-12.5deg) skewY(-12.5deg)"},
  perspectiveIn:{from:"opacity:0;transform:perspective(800px) translateZ(-200px)",to:"opacity:1;transform:perspective(800px) translateZ(0)"}
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
    "glow-pulse":"arbel-glow-pulse 2s ease-in-out infinite",
    wobble:"arbel-wobble 1s ease-in-out infinite",
    flash:"arbel-flash 2s ease-in-out infinite",
    headShake:"arbel-headShake 2s ease-in-out infinite",
    "wave-text":"arbel-wave-text 1.5s ease-in-out infinite",
    drift:"arbel-drift 6s ease-in-out infinite",
    sway:"arbel-sway 3s ease-in-out infinite"
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
  var count=Math.min(intensity||50,80);
  var entry={cv:null,raf:0};fxMap[id]=entry;
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
  function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);var t=Date.now()*.001;
    if(name==="gradient"){
      var g=ctx.createLinearGradient(cv.width*(.5+.5*Math.sin(t*.5)),0,cv.width*(.5+.5*Math.cos(t*.3)),cv.height);
      g.addColorStop(0,"rgba("+col1+",.12)");g.addColorStop(.5,"rgba("+col2+",.06)");g.addColorStop(1,"rgba("+col1+",.12)");
      ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);entry.raf=requestAnimationFrame(draw);return}
    if(name==="waves"){
      for(var w=0;w<3;w++){ctx.strokeStyle="rgba("+col1+","+(0.15-w*0.03)+")";ctx.lineWidth=1.5-w*0.3;ctx.beginPath();
      for(var x=0;x<=cv.width;x+=4){var y=cv.height*.5+Math.sin(x*.01+t+w)*20*(w+1);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="aurora"){
      for(var ab=0;ab<3;ab++){ctx.fillStyle="rgba("+(ab%2===0?col1:col2)+",0.04)";ctx.beginPath();
      for(var ax=0;ax<=cv.width;ax+=6){var ay=cv.height*.3+Math.sin(ax*.005+t*.5+ab*2)*cv.height*.15;
      ax===0?ctx.moveTo(ax,ay):ctx.lineTo(ax,ay)}ctx.lineTo(cv.width,cv.height);ctx.lineTo(0,cv.height);ctx.fill()}
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="noise"){
      var imd=ctx.createImageData(cv.width,cv.height);var d=imd.data;
      for(var j=0;j<d.length;j+=4){var v=Math.random()*30;d[j]=v;d[j+1]=v;d[j+2]=v;d[j+3]=12}
      ctx.putImageData(imd,0,0);entry.raf=requestAnimationFrame(draw);return}
    if(name==="blobs"){
      for(var b=0;b<3;b++){ctx.fillStyle="rgba("+(b%2===0?col1:col2)+",0.06)";ctx.beginPath();
      var bx=cv.width*(.3+b*.2)+Math.sin(t*.5+b)*50,by=cv.height*(.3+b*.2)+Math.cos(t*.4+b)*40,br=60+Math.sin(t+b)*20;
      for(var ba=0;ba<6.28;ba+=.1){var rr=br+Math.sin(ba*3+t+b)*15;
      ba===0?ctx.moveTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr):ctx.lineTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr)}
      ctx.closePath();ctx.fill()}entry.raf=requestAnimationFrame(draw);return}
    if(name==="geometric"){
      ctx.strokeStyle="rgba("+col1+",0.15)";ctx.lineWidth=0.5;
      for(var gi=0;gi<15;gi++){var gx=cv.width*.1+gi*cv.width/15+Math.sin(t+gi)*10,gy=cv.height*.5+Math.cos(t*.7+gi)*cv.height*.3,gsz=15+Math.sin(t+gi)*5;
      ctx.beginPath();for(var gs=0;gs<6;gs++){var ga=gs*Math.PI/3+t*.2;ctx.lineTo(gx+Math.cos(ga)*gsz,gy+Math.sin(ga)*gsz)}ctx.closePath();ctx.stroke()}
      entry.raf=requestAnimationFrame(draw);return}
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
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="orbits"){
      for(var oi=0;oi<8;oi++){var oa=t*.5+oi*Math.PI/4,or2=50+oi*15,ox=cv.width/2+Math.cos(oa)*or2,oy=cv.height/2+Math.sin(oa)*or2;
      ctx.fillStyle="rgba("+col1+","+(0.4-oi*0.04)+")";ctx.beginPath();ctx.arc(ox,oy,3,0,6.28);ctx.fill()}
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="dna"){
      for(var di=0;di<20;di++){var dx=cv.width*.2+di*(cv.width*.6/20),dy1=cv.height/2+Math.sin(di*.5+t)*30,dy2=cv.height/2-Math.sin(di*.5+t)*30;
      ctx.fillStyle="rgba("+col1+",0.5)";ctx.beginPath();ctx.arc(dx,dy1,3,0,6.28);ctx.fill();
      ctx.fillStyle="rgba("+col2+",0.5)";ctx.beginPath();ctx.arc(dx,dy2,3,0,6.28);ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.beginPath();ctx.moveTo(dx,dy1);ctx.lineTo(dx,dy2);ctx.stroke()}
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="confetti"){
      ps.forEach(function(p){p.y+=p.vy+1;p.x+=Math.sin(p.p)*0.5;p.rot+=2;p.p+=0.03;
      if(p.y>cv.height+10){p.y=-10;p.x=Math.random()*cv.width}
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle="rgba("+p.col+","+p.a+")";ctx.fillRect(-3,-1.5,6,3);ctx.restore()});
      entry.raf=requestAnimationFrame(draw);return}
    if(name==="matrix"){
      ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,cv.width,cv.height);
      ctx.fillStyle="rgba(0,255,65,0.6)";ctx.font="12px monospace";
      ps.forEach(function(p){var ch=String.fromCharCode(0x30A0+Math.random()*96);
      ctx.fillText(ch,p.x,p.y);p.y+=12;if(p.y>cv.height){p.y=0;p.x=Math.random()*cv.width}});
      entry.raf=requestAnimationFrame(draw);return}
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
    if(doConnect&&name==="particles"&&ps.length<=40){ctx.strokeStyle="rgba("+col1+",0.06)";ctx.lineWidth=0.5;
      for(var ci=0;ci<ps.length;ci++)for(var cj=ci+1;cj<ps.length;cj++){var dx=ps[ci].x-ps[cj].x,dy=ps[ci].y-ps[cj].y;if(dx*dx+dy*dy<8000){ctx.beginPath();ctx.moveTo(ps[ci].x,ps[ci].y);ctx.lineTo(ps[cj].x,ps[cj].y);ctx.stroke()}}}
    entry.raf=requestAnimationFrame(draw)
  }draw();
  entry.cv=cv;window.addEventListener("resize",rsz);
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
  if(d.type==="arbel-set-text"){var _sy=window.scrollY;var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.textContent=d.text;window.scrollTo(0,_sy)}
  if(d.type==="arbel-set-style"){var _sy=window.scrollY;var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el&&d.prop){el.style[d.prop]=d.value;if(selected===el)posHandles(el)};window.scrollTo(0,_sy)}
  if(d.type==="arbel-set-text"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.textContent=d.text}
  if(d.type==="arbel-set-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-anim",d.animation);prevAnim(el,d.animation)}}
  if(d.type==="arbel-set-continuous"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-continuous",d.animation);applyContinuous(el,d.animation)}}
  if(d.type==="arbel-set-hover"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-hover",d.hover);applyHover(el,d.hover)}}
  if(d.type==="arbel-set-effect"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.setAttribute("data-arbel-effect",d.effect);applyFx(el,d.effect,d.intensity,d.color1,d.color2,{color3:d.color3,size:d.size,speed:d.speed,glow:d.glow,connect:d.connect,interact:d.interact})}}
  if(d.type==="arbel-preview-animation"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)prevAnim(el,d.animation)}
  if(d.type==="arbel-select-by-id"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el){el.scrollIntoView({behavior:"smooth",block:"nearest"});sel(el)}}
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
  if(d.type==="arbel-set-menu-bg"||d.type==="arbel-toggle-menu-bg"){/* handled via arbel-inject-responsive */}
  if(d.type==="arbel-edit-text"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el&&el.hasAttribute("data-arbel-edit"))startEdit(el)}
  if(d.type==="arbel-add-element"){
    var tag=d.tag||"div";var newEl=document.createElement(tag);
    newEl.setAttribute("data-arbel-id",d.id);
    if(d.editable)newEl.setAttribute("data-arbel-edit","text");
    if(d.text)newEl.textContent=d.text;
    if(d.html)newEl.innerHTML=d.html;
    if(d.src)newEl.setAttribute("src",d.src);
    if(d.style){for(var sk in d.style)newEl.style[sk]=d.style[sk]}
    if(d.attrs){for(var ak in d.attrs)newEl.setAttribute(ak,d.attrs[ak])}
    /* Place: if nav overlay is open, place inside .nav-extra; otherwise in nearest section */
    var anchor=null;
    if(d.navOverlay){
      anchor=document.querySelector('.nav-extra');
    }
    if(!anchor){
      var secs=document.querySelectorAll("section");
      if(secs.length>0){
        var viewMid=window.innerHeight/2;var bestDist=Infinity;
        secs.forEach(function(sec){var sr=sec.getBoundingClientRect();
          var secMid=sr.top+sr.height/2;var dist=Math.abs(secMid-viewMid);
          if(dist<bestDist){bestDist=dist;anchor=sec}});
      }
    }
    if(!anchor)anchor=document.querySelector("main")||document.body;
    /* Ensure added element is positionable */
    if(!d.style||(!d.style.position)){newEl.style.position="relative"}
    anchor.appendChild(newEl);
    sel(newEl);
    // Rebuild tree
    var tree2=[];
    document.querySelectorAll("[data-arbel-id]").forEach(function(el2){
      var cs3=getComputedStyle(el2);
      tree2.push({id:el2.getAttribute("data-arbel-id"),tag:el2.tagName.toLowerCase(),
        editable:el2.hasAttribute("data-arbel-edit"),
        text:el2.getAttribute("data-arbel-edit")==="text"?el2.textContent.substring(0,50):null,
        visible:cs3.visibility!=="hidden",locked:false,
        zIndex:cs3.zIndex==="auto"?0:parseInt(cs3.zIndex)||0});
    });
    window.parent.postMessage({type:"arbel-tree",tree:tree2},"*");
  }
  if(d.type==="arbel-delete-element"){
    var el=document.querySelector('[data-arbel-id="'+d.id+'"]');
    if(el){if(selected===el)desel();el.parentNode.removeChild(el);
    var tree3=[];document.querySelectorAll("[data-arbel-id]").forEach(function(el3){
      var cs4=getComputedStyle(el3);
      tree3.push({id:el3.getAttribute("data-arbel-id"),tag:el3.tagName.toLowerCase(),
        editable:el3.hasAttribute("data-arbel-edit"),
        text:el3.getAttribute("data-arbel-edit")==="text"?el3.textContent.substring(0,50):null,
        visible:cs4.visibility!=="hidden",locked:false,
        zIndex:cs4.zIndex==="auto"?0:parseInt(cs4.zIndex)||0});
    });window.parent.postMessage({type:"arbel-tree",tree:tree3},"*")}
  }
  if(d.type==="arbel-set-hover-custom"){
    var el=document.querySelector('[data-arbel-id="'+d.id+'"]');
    if(el){
      el.setAttribute("data-arbel-hover","custom");
      el.onmouseenter=null;el.onmouseleave=null;
      var dur=d.duration||0.3;
      el.style.transition="all "+dur+"s ease";
      el.onmouseenter=function(){
        el._ph=el.style.cssText;
        if(d.props.opacity!==undefined)el.style.opacity=d.props.opacity/100;
        if(d.props.scale!==undefined)el.style.transform="scale("+d.props.scale+")";
        if(d.props.translateY!==undefined)el.style.transform=(el.style.transform||"")+" translateY("+d.props.translateY+"px)";
        if(d.props.rotate!==undefined)el.style.transform=(el.style.transform||"")+" rotate("+d.props.rotate+"deg)";
        if(d.props.color)el.style.color=d.props.color;
        if(d.props.background)el.style.backgroundColor=d.props.background;
        if(d.props.shadow){var shm={sm:"0 2px 8px rgba(0,0,0,.15)",md:"0 4px 16px rgba(0,0,0,.2)",lg:"0 8px 32px rgba(0,0,0,.25)",xl:"0 16px 64px rgba(0,0,0,.3)",glow:"0 0 30px rgba(100,108,255,.4)",neon:"0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)"};el.style.boxShadow=shm[d.props.shadow]||""}
      };
      el.onmouseleave=function(){if(el._ph!==undefined)el.style.cssText=el._ph};
    }
  }
  if(d.type==="arbel-set-html"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.innerHTML=d.html}
  if(d.type==="arbel-set-src"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.setAttribute("src",d.src)}
  if(d.type==="arbel-set-attr"){var el=document.querySelector('[data-arbel-id="'+d.id+'"]');if(el)el.setAttribute(d.attr,d.value)}
  if(d.type==="arbel-deselect-all"){desel()}
  if(d.type==="arbel-clear-inlines"){
    var _clrProps=['left','top','width','height','transform','position','maxWidth','minWidth','maxHeight','minHeight','fontSize','padding','paddingLeft','paddingRight','paddingTop','paddingBottom','margin','marginLeft','marginRight','marginTop','marginBottom','borderRadius','opacity','gap','flexDirection','alignItems','justifyContent','textAlign','lineHeight','letterSpacing','color','backgroundColor','border','borderWidth','borderColor','borderStyle','backgroundSize','backgroundPosition','display','flexWrap','gridTemplateColumns'];
    document.querySelectorAll('[data-arbel-id]').forEach(function(el){
      _clrProps.forEach(function(p){el.style.removeProperty(p);el.style.removeProperty(p.replace(/[A-Z]/g,function(m){return '-'+m.toLowerCase()}))});
    });
  }
  if(d.type==="arbel-inject-responsive"){
    var old=document.getElementById("arbel-responsive-css");
    if(old)old.parentNode.removeChild(old);
    if(d.css){
      var rs=document.createElement("style");rs.id="arbel-responsive-css";
      rs.textContent=d.css;document.head.appendChild(rs);
    }
  }
  if(d.type==="arbel-set-viewport-meta"){
    var vm=document.querySelector('meta[name="viewport"]');
    if(!vm){vm=document.createElement("meta");vm.name="viewport";document.head.appendChild(vm)}
    vm.setAttribute("content",d.content);
  }
  if(d.type==="arbel-set-bg-video"){
    var el=document.querySelector('[data-arbel-id="'+d.id+'"]');
    if(el){
      var old=el.querySelector(".arbel-bg-video");if(old)old.remove();
      if(d.src){
        el.style.position=el.style.position||"relative";el.style.overflow="hidden";
        var v=document.createElement("video");v.className="arbel-bg-video";
        v.src=d.src;v.autoplay=true;v.loop=true;v.muted=true;v.playsInline=true;
        v.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none";
        el.insertBefore(v,el.firstChild);
        Array.from(el.children).forEach(function(c){if(c!==v&&!c.style.position)c.style.position="relative";if(c!==v)c.style.zIndex=c.style.zIndex||"1"});
      }
    }
  }
  if(d.type==="arbel-remove-bg-video"){
    var el=document.querySelector('[data-arbel-id="'+d.id+'"]');
    if(el){var old=el.querySelector(".arbel-bg-video");if(old)old.remove()}
  }
  if(d.type==="arbel-clone-element"){
    var el=document.querySelector('[data-arbel-id="'+d.id+'"]');
    if(el){
      var clone=el.cloneNode(true);
      clone.setAttribute("data-arbel-id",d.newId);
      if(clone.hasAttribute("data-arbel-edit"))clone.setAttribute("data-arbel-edit","text");
      clone.style.position=clone.style.position||"relative";
      clone.style.left=(parseInt(clone.style.left)||0)+20+"px";
      clone.style.top=(parseInt(clone.style.top)||0)+20+"px";
      el.parentNode.insertBefore(clone,el.nextSibling);
      desel();sel(clone);
      /* rebuild tree */
      var tree4=[];document.querySelectorAll("[data-arbel-id]").forEach(function(el4){
        var cs5=getComputedStyle(el4);
        tree4.push({id:el4.getAttribute("data-arbel-id"),tag:el4.tagName.toLowerCase(),
          editable:el4.hasAttribute("data-arbel-edit"),
          text:el4.getAttribute("data-arbel-edit")==="text"?el4.textContent.substring(0,50):null,
          visible:cs5.visibility!=="hidden",locked:false,
          zIndex:cs5.zIndex==="auto"?0:parseInt(cs5.zIndex)||0});
      });window.parent.postMessage({type:"arbel-tree",tree:tree4},"*")
    }
  }
});

/* ── Keyboard forwarding ── */
document.addEventListener("keydown",function(e){
  if(editing)return;
  var k=e.key;var ctrl=e.ctrlKey||e.metaKey;
  if(k==="Delete"||k==="Backspace"||k==="Escape"||(ctrl&&(k==="z"||k==="y"||k==="c"||k==="v"||k==="d"||k==="a"))){e.preventDefault();
    window.parent.postMessage({type:"arbel-key",key:k,ctrl:!!ctrl,shift:!!e.shiftKey,alt:!!e.altKey},"*");
  }
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
        _setupUndoRedo();
        _setupNewFeatures();
        window.addEventListener('message', _handleMessage);
    }

    /* ─── Copy / Paste Styles ─── */
    function _copyStyles() {
        if (!_selectedId || !_overrides[_selectedId]) return;
        _clipboard = {
            overrides: JSON.parse(JSON.stringify(_overrides[_selectedId])),
            sourceId: _selectedId
        };
    }

    function _pasteStyles() {
        if (!_clipboard || !_selectedId) return;
        _pushUndo();
        if (!_overrides[_selectedId]) _overrides[_selectedId] = {};
        var src = _clipboard.overrides;
        // Copy style properties, skip text (user can paste text separately)
        var styleKeys = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign',
            'color','backgroundColor','borderRadius','borderWidth','borderStyle','borderColor',
            'opacity','shadow','backdrop','filter','fontStyle','textDecoration',
            'animation','continuous','hover','width','height'];
        for (var i = 0; i < styleKeys.length; i++) {
            var k = styleKeys[i];
            if (src[k] !== undefined) {
                _setOv(_selectedId, k, src[k]);
                _setStyle(_selectedId, k, src[k]);
            }
        }
        // Also copy device-specific sub-objects
        ['_mobile', '_tablet'].forEach(function (dk) {
            if (src[dk]) {
                if (!_overrides[_selectedId][dk]) _overrides[_selectedId][dk] = {};
                Object.keys(src[dk]).forEach(function (k) {
                    _overrides[_selectedId][dk][k] = src[dk][k];
                });
            }
        });
        _applyDeviceResponsive();
    }

    function _duplicateStyles() {
        // Duplicate = copy current + immediately available for paste
        _copyStyles();
    }

    /* ─── Duplicate Element (clone in iframe) ─── */
    function _duplicateElement() {
        if (!_selectedId) return;
        _pushUndo();
        _addedCount++;
        var newId = 'dup-' + Date.now().toString(36) + '-' + _addedCount;
        // Clone overrides from source
        if (_overrides[_selectedId]) {
            _overrides[newId] = JSON.parse(JSON.stringify(_overrides[_selectedId]));
        } else {
            _overrides[newId] = {};
        }
        _overrides[newId]._added = true;
        _addedElements.push(newId);
        _postIframe('arbel-clone-element', { id: _selectedId, newId: newId });
        _selectedId = newId;
        if (_onUpdate) _onUpdate(_overrides);
    }

    /* ─── Context Menu ─── */
    var _ctxMenu = null;

    function _hideContextMenu() {
        if (_ctxMenu && _ctxMenu.parentNode) _ctxMenu.parentNode.removeChild(_ctxMenu);
        _ctxMenu = null;
    }

    function _showContextMenu(x, y, data) {
        _hideContextMenu();
        var menu = document.createElement('div');
        menu.className = 'arbel-ctx-menu';

        function addItem(label, kbd, action, cls) {
            var item = document.createElement('div');
            item.className = 'arbel-ctx-item' + (cls ? ' ' + cls : '');
            item.innerHTML = '<span>' + label + '</span>' + (kbd ? '<span class="arbel-ctx-kbd">' + kbd + '</span>' : '');
            if (action) item.addEventListener('click', function () { _hideContextMenu(); action(); });
            else item.setAttribute('data-disabled', '');
            menu.appendChild(item);
        }
        function addSep() { var s = document.createElement('div'); s.className = 'arbel-ctx-sep'; menu.appendChild(s); }

        addItem('Copy Styles', 'Ctrl+C', _selectedId ? _copyStyles : null);
        addItem('Paste Styles', 'Ctrl+V', _clipboard ? _pasteStyles : null);
        addSep();
        addItem('Duplicate', 'Ctrl+D', _selectedId ? _duplicateElement : null);
        addSep();
        if (data.editable) { addItem('Edit Text', 'Dbl-click', function () { _postIframe('arbel-edit-text', { id: data.id }); }); }
        addItem('Bring to Front', '', _selectedId ? function () { _pushUndo(); _postIframe('arbel-set-zindex', { id: data.id, value: 9999 }); _setOv(data.id, 'zIndex', 9999); } : null);
        addItem('Send to Back', '', _selectedId ? function () { _pushUndo(); _postIframe('arbel-set-zindex', { id: data.id, value: -1 }); _setOv(data.id, 'zIndex', -1); } : null);
        addSep();
        var isLocked = _overrides[data.id] && _overrides[data.id].locked;
        addItem(isLocked ? 'Unlock' : 'Lock', '', _selectedId ? function () {
            _setOvB(data.id, 'locked', !isLocked, 'layer');
            _postIframe('arbel-set-pointer-events', { id: data.id, value: !isLocked ? 'none' : '' });
        } : null);
        if (data.parentId) {
            addSep();
            addItem('Select Parent', '', function () { _postIframe('arbel-select-by-id', { id: data.parentId }); });
        }
        addSep();
        addItem('Delete', 'Del', _selectedId ? _deleteElement : null, 'arbel-ctx-danger');

        // Position on-screen
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        document.body.appendChild(menu);
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
        _ctxMenu = menu;

        setTimeout(function () {
            document.addEventListener('mousedown', _ctxAutoClose);
            document.addEventListener('keydown', _ctxEscClose);
        }, 0);
    }

    function _ctxAutoClose(e) {
        if (_ctxMenu && !_ctxMenu.contains(e.target)) {
            _hideContextMenu();
            document.removeEventListener('mousedown', _ctxAutoClose);
            document.removeEventListener('keydown', _ctxEscClose);
        }
    }
    function _ctxEscClose(e) {
        if (e.key === 'Escape') {
            _hideContextMenu();
            document.removeEventListener('mousedown', _ctxAutoClose);
            document.removeEventListener('keydown', _ctxEscClose);
        }
    }

    /* ─── Undo/Redo toolbar + keyboard shortcuts ─── */
    function _setupUndoRedo() {
        _on('#editorUndo', 'click', function () { _undo(); });
        _on('#editorRedo', 'click', function () { _redo(); });
        _keydownHandler = function (e) {
            if (!_active) return;
            var tag = document.activeElement ? document.activeElement.tagName : '';
            var inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); _undo(); }
                if (e.key === 'z' && e.shiftKey) { e.preventDefault(); _redo(); }
                if (e.key === 'y') { e.preventDefault(); _redo(); }
                if (e.key === 'c' && !inInput && _selectedId) { e.preventDefault(); _copyStyles(); }
                if (e.key === 'v' && !inInput && _clipboard) { e.preventDefault(); _pasteStyles(); }
                if (e.key === 'd' && _selectedId) { e.preventDefault(); _duplicateElement(); }
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedId && !inInput) {
                e.preventDefault(); _deleteElement();
            }
        };
        document.addEventListener('keydown', _keydownHandler);
        _updateUndoButtons();
    }

    /* ─── Message handler ─── */
    function _handleMessage(e) {
        if (_iframe && e.source !== _iframe.contentWindow) return;
        var d = e.data;
        if (!d || !d.type || !_active) return;
        if (d.type === 'arbel-tree') {
            _renderElementTree(d.tree);
            // Re-apply device responsive CSS after iframe reload (ensures nav-extra hidden on desktop etc.)
            _applyDeviceResponsive();
            // Re-apply video layer after iframe reload
            if (_videoConfig.active && _videoFrames.length && _iframe) {
                _postIframe('arbel-set-video-layer', { frames: _videoFrames, config: _videoConfig });
            }
        }
        if (d.type === 'arbel-select') { _selectedId = d.id; _iframeTextUndoPushed = false; _showPanel(d); _updateStatus(d); }
        if (d.type === 'arbel-deselect') { _selectedId = null; _iframeTextUndoPushed = false; _hidePanel(); _updateStatus(null); }
        if (d.type === 'arbel-text-update') {
            // Snapshot BEFORE the first inline text mutation from iframe
            if (!_iframeTextUndoPushed && !_undoLocked) {
                _pushUndo();
                _iframeTextUndoPushed = true;
            }
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _overrides[d.id].text = d.text;
            if (_onUpdate) _onUpdate(_overrides);
            var ti = _qs('.editor-text-input');
            if (ti && _selectedId === d.id) ti.value = d.text;
        }
        if (d.type === 'arbel-resize-start') {
            if (!_resizeUndoPushed && !_undoLocked) {
                _pushUndo();
                _resizeUndoPushed = true;
            }
        }
        if (d.type === 'arbel-resize' && d.id) {
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _draggingId = d.id;
            _setOvBatch(d.id, { width: d.width, height: d.height });
        }
        if (d.type === 'arbel-resize-end') {
            _draggingId = null;
            _resizeUndoPushed = false;
            _applyDeviceResponsive();
        }
        if (d.type === 'arbel-move' && d.id) {
            if (!_moveUndoPushed && !_undoLocked) {
                _pushUndo();
                _moveUndoPushed = true;
            }
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _draggingId = d.id;
            _setOvBatch(d.id, { left: d.left, top: d.top, position: 'relative' });
        }
        if (d.type === 'arbel-move-end') {
            _draggingId = null;
            _moveUndoPushed = false;
            _applyDeviceResponsive();
        }
        if (d.type === 'arbel-rotate' && d.id) {
            if (!_rotateUndoPushed && !_undoLocked) {
                _pushUndo();
                _rotateUndoPushed = true;
            }
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _setOv(d.id, 'transform', d.transform);
        }
        if (d.type === 'arbel-rotate-end') {
            _rotateUndoPushed = false;
        }
        if (d.type === 'arbel-contextmenu') {
            _showContextMenu(d.x, d.y, d);
        }
        if (d.type === 'arbel-nav-state') {
            _navOpenState = !!d.isOpen;
        }
        /* ── Keyboard forwarded from iframe ── */
        if (d.type === 'arbel-key') {
            if ((d.key === 'Delete' || d.key === 'Backspace') && _selectedId) {
                _deleteElement();
                return;
            }
            if (d.key === 'Escape') {
                _selectedId = null;
                _hidePanel();
                _updateStatus(null);
                _postIframe('arbel-deselect-all', {});
                return;
            }
            // Forward to parent keyboard handler for Ctrl+shortcuts
            if (_keydownHandler) {
                _keydownHandler({ key: d.key, ctrlKey: !!d.ctrl, metaKey: !!d.ctrl, shiftKey: !!d.shift, altKey: !!d.alt, preventDefault: function () {} });
            }
            return;
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
                var device = btn.getAttribute('data-device');
                _activeDevice = device || 'desktop';
                var frame = _container.querySelector('.preview-frame');
                if (frame) {
                    frame.classList.remove('preview-desktop', 'preview-tablet', 'preview-mobile');
                    frame.classList.add('preview-' + _activeDevice);
                }
                // Clear inline styles from previous device to prevent cross-device contamination
                _postIframe('arbel-clear-inlines', {});
                // Inject responsive CSS + viewport into iframe
                _applyDeviceResponsive();
                // On desktop switch, restore inline styles
                if (_activeDevice === 'desktop') _restoreDesktopInlines();
                // Refresh the panel to show device-appropriate values
                if (_selectedId && _iframe) _postIframe('arbel-select-by-id', { id: _selectedId });
            });
        });
        var zoomVal = _qs('#zoomVal');
        _on('#zoomIn', 'click', function () { _zoom = Math.min(_zoom + 10, 200); _applyZoom(); if (zoomVal) zoomVal.textContent = _zoom + '%'; });
        _on('#zoomOut', 'click', function () { _zoom = Math.max(_zoom - 10, 50); _applyZoom(); if (zoomVal) zoomVal.textContent = _zoom + '%'; });
        _on('#bfsFullscreen', 'click', function () {
            if (!document.fullscreenElement) _container.requestFullscreen().catch(function () {});
            else document.exitFullscreen();
        });

        /* Brand name rename — click to edit inline */
        var _brandEl = _qs('#bfsBrand');
        if (_brandEl) {
            _brandEl.title = 'Click to rename site';
            _brandEl.style.cursor = 'pointer';
            _brandEl.addEventListener('click', function () {
                if (_brandEl.contentEditable === 'true') return;
                _brandEl.contentEditable = 'true';
                _brandEl.style.outline = '1px solid #646cff';
                _brandEl.style.borderRadius = '4px';
                _brandEl.style.padding = '2px 6px';
                _brandEl.focus();
                // Select all text
                var range = document.createRange();
                range.selectNodeContents(_brandEl);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });
            function _commitBrandRename() {
                if (_brandEl.contentEditable !== 'true') return;
                _brandEl.contentEditable = 'false';
                _brandEl.style.outline = '';
                _brandEl.style.padding = '';
                var newName = _brandEl.textContent.trim() || 'My Site';
                _brandEl.textContent = newName;
                // Update the config input so recompile picks it up
                var cfgInput = document.getElementById('brandName');
                if (cfgInput) cfgInput.value = newName;
                // Update logo text in the iframe
                _postIframe('arbel-set-text', { id: 'site-logo', text: newName });
            }
            _brandEl.addEventListener('blur', _commitBrandRename);
            _brandEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); _commitBrandRename(); _brandEl.blur(); }
                if (e.key === 'Escape') { _brandEl.contentEditable = 'false'; _brandEl.style.outline = ''; _brandEl.style.padding = ''; }
            });
        }
    }

    function _applyZoom() {
        var frame = _container ? _container.querySelector('.preview-frame') : null;
        if (frame) { frame.style.transform = 'scale(' + (_zoom / 100) + ')'; frame.style.transformOrigin = 'top center'; }
    }

    /* ─── Device Responsive ─── */
    function _applyDeviceResponsive() {
        if (_activeDevice === 'desktop') {
            _navOpenState = false;
            _postIframe('arbel-inject-responsive', { css: '.nav-extra { display: none !important; }' });
            _postIframe('arbel-set-viewport-meta', { content: 'width=device-width, initial-scale=1' });
            return;
        }
        var isMobile = _activeDevice === 'mobile';
        var vw = isMobile ? 390 : 768;
        // Set viewport meta so content thinks it's on that device width
        _postIframe('arbel-set-viewport-meta', { content: 'width=' + vw + ', initial-scale=1' });

        var css = '';
        // Generic responsive rules (exclude overlay elements)
        var NOT_OV = ':not(.arbel-rh):not(.arbel-rot):not(.arbel-rot-line):not(.arbel-lbl):not(.arbel-sz-lbl):not(.arbel-pos-lbl):not(.arbel-snap-h):not(.arbel-snap-v):not(.arbel-guide-h):not(.arbel-guide-v):not(.arbel-video-layer)';
        css += '/* Arbel responsive override */\n';
        css += 'html { overflow-x: hidden; overflow-anchor: none; }\n';
        css += 'body { overflow-x: hidden; overflow-anchor: none; }\n';
        css += 'img' + NOT_OV + ', video' + NOT_OV + ', embed, object, svg' + NOT_OV + ' { max-width: 100%; height: auto; }\n';
        css += 'pre, code, table { max-width: 100%; overflow-x: auto; }\n';

        if (isMobile) {
            css += 'body { font-size: 14px !important; }\n';
            // Stack flex/grid containers vertically (only data-arbel elements, not overlay)
            css += '[data-arbel-id][style*="display: flex"], [data-arbel-id][style*="display:flex"] { flex-wrap: wrap !important; }\n';
            css += 'section' + NOT_OV + ' { padding-left: 12px !important; padding-right: 12px !important; box-sizing: border-box !important; }\n';
            // Scale down headings
            css += 'h1' + NOT_OV + ' { font-size: clamp(1.5rem, 8vw, 3rem) !important; }\n';
            css += 'h2' + NOT_OV + ' { font-size: clamp(1.25rem, 6vw, 2.25rem) !important; }\n';
            css += 'h3' + NOT_OV + ' { font-size: clamp(1.1rem, 5vw, 1.75rem) !important; }\n';
            // Nav: hide desktop nav links on mobile, keep hamburger
            css += 'nav' + NOT_OV + ' ul, nav' + NOT_OV + ' ol { flex-direction: column !important; gap: 4px !important; align-items: center !important; }\n';
            css += 'nav' + NOT_OV + ' a { font-size: 0.9rem !important; padding: 6px 0 !important; }\n';
            // Grid: single column on mobile
            css += '[style*="grid-template-columns"]' + NOT_OV + ' { grid-template-columns: 1fr !important; }\n';
            // Wide elements: constrain to viewport
            css += '[data-arbel-id][style*="width:"] { max-width: 100% !important; box-sizing: border-box !important; }\n';
        } else {
            // Tablet
            css += 'body { font-size: 15px !important; }\n';
            css += '[data-arbel-id][style*="display: flex"], [data-arbel-id][style*="display:flex"] { flex-wrap: wrap !important; }\n';
            css += 'h1' + NOT_OV + ' { font-size: clamp(1.75rem, 5vw, 3.5rem) !important; }\n';
            css += 'h2' + NOT_OV + ' { font-size: clamp(1.5rem, 4vw, 2.5rem) !important; }\n';
            // Grid: 2 columns max on tablet
            css += '[style*="grid-template-columns"]' + NOT_OV + ' { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important; }\n';
        }

        // Menu overlay background — full-page overlay
        // The .header has backdrop-filter which creates a containing block for position:fixed children.
        // So when nav is open, we expand the header itself to cover the viewport and drop its backdrop-filter.
        var _navBg = (_menuBgEnabled && _menuBgColor) ? _menuBgColor : 'rgba(10,10,15,0.95)';
        // Ensure header layout stays correct on mobile (logo left, hamburger right)
        css += '.header-inner { display: flex !important; align-items: center !important; justify-content: space-between !important; }\n';
        css += '.logo { display: block !important; color: inherit !important; }\n';
        css += '.nav { display: none !important; }\n';
        css += '.nav.open { display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; gap: 2rem !important; margin: auto 0 !important; width: 100% !important; padding: 2rem 0 !important; }\n';
        css += '.nav a, .nav-link { color: #fff !important; font-size: 1.5rem !important; text-decoration: none !important; padding: 0.5rem 1rem !important; transition: opacity 0.2s !important; }\n';
        css += '.nav a:hover, .nav-link:hover { opacity: 0.7 !important; }\n';
        css += '.menu-btn { display: block !important; z-index: 10000 !important; }\n';
        css += '.menu-btn.is-active span:first-child { transform: translateY(9px) rotate(45deg) !important; }\n';
        css += '.menu-btn.is-active span:last-child { transform: translateY(-9px) rotate(-45deg) !important; }\n';
        css += 'body.nav-open { overflow: hidden !important; }\n';
        // When nav is open, expand the header to be a full-page overlay
        css += 'body.nav-open .header { position: fixed !important; inset: 0 !important; z-index: 9999 !important; background: ' + _navBg + ' !important; backdrop-filter: none !important; border-bottom: none !important; display: flex !important; flex-direction: column !important; padding: 1rem 2rem !important; overflow-y: auto !important; }\n';
        css += 'body.nav-open .header-inner { flex: 1 !important; width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; max-width: none !important; position: relative !important; }\n';
        css += 'body.nav-open .logo { align-self: flex-start !important; }\n';
        css += 'body.nav-open .menu-btn { position: absolute !important; top: 0 !important; right: 0 !important; }\n';
        css += '.nav-extra { display: none !important; }\n';
        css += 'body.nav-open .nav-extra { display: flex !important; flex-direction: column !important; align-items: center !important; gap: 1rem !important; padding: 1rem 2rem !important; width: 100% !important; flex-shrink: 0 !important; }\n';

        // Per-element overrides for elements with responsive data
        var _bdMap = { 'blur-sm': 'blur(4px)', 'blur-md': 'blur(8px)', 'blur-lg': 'blur(16px)', saturate: 'saturate(2)', grayscale: 'grayscale(1)', sepia: 'sepia(1)' };
        var _shMap = { sm: '0 2px 8px rgba(0,0,0,.15)', md: '0 4px 16px rgba(0,0,0,.2)', lg: '0 8px 32px rgba(0,0,0,.25)', xl: '0 16px 64px rgba(0,0,0,.3)', glow: '0 0 30px rgba(100,108,255,.4)', neon: '0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)', inner: 'inset 0 2px 10px rgba(0,0,0,.3)' };
        var ids = Object.keys(_overrides);
        ids.forEach(function (id) {
            var ov = _overrides[id];
            if (!ov) return;
            var deviceKey = isMobile ? '_mobile' : '_tablet';
            var rsp = ov[deviceKey];
            if (rsp) {
                css += '[data-arbel-id="' + id.replace(/["\\]/g, '') + '"] {';
                Object.keys(rsp).forEach(function (prop) {
                    var val = String(rsp[prop]).replace(/[<>"'`]/g, '');
                    if (!/javascript\s*:/i.test(val) && !/expression\s*\(/i.test(val)) {
                        if (prop === 'backdrop' && val !== 'none' && _bdMap[val]) {
                            css += ' backdrop-filter: ' + _bdMap[val] + ' !important;';
                        } else if (prop === 'shadow' && val !== 'none' && _shMap[val]) {
                            css += ' box-shadow: ' + _shMap[val] + ' !important;';
                        } else if (prop === 'zIndex') {
                            css += ' z-index: ' + val + ' !important; position: relative !important;';
                        } else if (prop !== 'backdrop' && prop !== 'shadow') {
                            css += ' ' + _camelToDash(prop) + ': ' + val + ' !important;';
                        }
                    }
                });
                css += ' }\n';
            }

            // Hide nav overlay elements that belong to a different device
            if (ov._navOverlay && ov._navDevice) {
                var currentDevice = isMobile ? 'mobile' : 'tablet';
                if (ov._navDevice !== currentDevice) {
                    css += '[data-arbel-id="' + id.replace(/["\\]/g, '') + '"] { display: none !important; }\n';
                }
            }
        });

        _postIframe('arbel-inject-responsive', { css: css });
    }

    function _camelToDash(str) {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    /* ─── Style listeners ─── */
    function _setupStyleListeners() {
        if (!_container) return;
        /* Menu overlay background */
        var _menuBgPicker = _qs('#editorMenuBgColor');
        var _menuBgToggle = _qs('#editorMenuBgEnabled');
        var _menuBgRow = _qs('#editorMenuBgRow');
        if (_menuBgPicker) {
            var cfgBg = document.getElementById('bgColor');
            if (cfgBg) { _menuBgPicker.value = cfgBg.value; _menuBgColor = cfgBg.value; }
            _menuBgPicker.addEventListener('input', function () {
                _menuBgColor = this.value;
                _applyDeviceResponsive();
            });
        }
        if (_menuBgToggle) {
            _menuBgToggle.addEventListener('change', function () {
                _menuBgEnabled = this.checked;
                if (_menuBgRow) _menuBgRow.style.display = this.checked ? '' : 'none';
                _applyDeviceResponsive();
            });
        }
        _on('.editor-text-input', 'input', function () {
            if (!_selectedId) return;
            _postIframe('arbel-set-text', { id: _selectedId, text: this.value });
            _setOvB(_selectedId, 'text', this.value, 'text');
        });
        _on('#editorFontSelect', 'change', function () {
            if (!_selectedId) return;
            var font = this.value;
            if (font) {
                _postIframe('arbel-load-font', { font: font });
                _setStyle(_selectedId, 'fontFamily', '"' + font + '", sans-serif');
            } else {
                _setStyle(_selectedId, 'fontFamily', '');
            }
            _setOvB(_selectedId, 'fontFamily', font ? '"' + font + '", sans-serif' : '', 'style');
        });
        _on('#editorFontSize', 'input', function () { if (_selectedId) { _setStyle(_selectedId, 'fontSize', this.value + 'px'); _setOvB(_selectedId, 'fontSize', this.value + 'px', 'style'); } });
        _on('#editorFontWeight', 'change', function () { if (_selectedId) { _setStyle(_selectedId, 'fontWeight', this.value); _setOvB(_selectedId, 'fontWeight', this.value, 'style'); } });
        _on('#editorLineHeight', 'input', function () { if (_selectedId) { _setStyle(_selectedId, 'lineHeight', this.value); _setOvB(_selectedId, 'lineHeight', this.value, 'style'); } });
        _on('#editorLetterSpacing', 'input', function () { if (_selectedId) { _setStyle(_selectedId, 'letterSpacing', this.value + 'px'); _setOvB(_selectedId, 'letterSpacing', this.value + 'px', 'style'); } });
        _container.querySelectorAll('.editor-align-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!_selectedId) return;
                _container.querySelectorAll('.editor-align-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _setStyle(_selectedId, 'textAlign', btn.getAttribute('data-align'));
                _setOvB(_selectedId, 'textAlign', btn.getAttribute('data-align'), 'style');
            });
        });
        _on('#editorTextColor', 'input', function () { if (_selectedId) { _setStyle(_selectedId, 'color', this.value); _setOvB(_selectedId, 'color', this.value, 'style'); } });
        _on('#editorBgColor', 'input', function () { if (_selectedId) { _setStyle(_selectedId, 'backgroundColor', this.value); _setOvB(_selectedId, 'backgroundColor', this.value, 'style'); } });

        /* ── Gradient toggle + picker ── */
        var _gradActive = false;
        _on('#editorGradToggle', 'click', function () {
            _gradActive = !_gradActive;
            var panel = _qs('#editorGradPanel');
            var btn = _qs('#editorGradToggle');
            if (panel) panel.style.display = _gradActive ? '' : 'none';
            if (btn) btn.classList.toggle('active', _gradActive);
            if (_gradActive) _applyGradient();
        });
        function _applyGradient() {
            if (!_selectedId || !_gradActive) return;
            var c1 = (_qs('#editorGradC1') || {}).value || '#646cff';
            var c2 = (_qs('#editorGradC2') || {}).value || '#0a0a0f';
            var type = (_qs('#editorGradType') || {}).value || 'linear';
            var angle = (_qs('#editorGradAngle') || {}).value || '135';
            var val = type === 'radial' ? 'radial-gradient(circle, ' + c1 + ', ' + c2 + ')'
                : 'linear-gradient(' + angle + 'deg, ' + c1 + ', ' + c2 + ')';
            _setStyle(_selectedId, 'background', val);
            _setOvB(_selectedId, 'background', val, 'style');
        }
        _on('#editorGradC1', 'input', _applyGradient);
        _on('#editorGradC2', 'input', _applyGradient);
        _on('#editorGradType', 'change', _applyGradient);
        _on('#editorGradAngle', 'input', function () {
            var lbl = _qs('#editorGradAngleVal');
            if (lbl) lbl.textContent = this.value + '°';
            _applyGradient();
        });
        _container.querySelectorAll('.editor-spacing').forEach(function (inp) {
            inp.addEventListener('input', function () {
                if (!_selectedId) return;
                var prop = inp.getAttribute('data-prop');
                _setStyle(_selectedId, prop, inp.value + 'px');
                _setOvB(_selectedId, prop, inp.value + 'px', 'style');
            });
        });
        _on('#editorRadius', 'input', function () { if (_selectedId) { _qs('#editorRadiusVal').textContent = this.value + 'px'; _setStyle(_selectedId, 'borderRadius', this.value + 'px'); _setOvB(_selectedId, 'borderRadius', this.value + 'px', 'style'); } });
        _on('#editorOpacity', 'input', function () { if (_selectedId) { _qs('#editorOpacityVal').textContent = this.value + '%'; _setStyle(_selectedId, 'opacity', (this.value / 100).toString()); _setOvB(_selectedId, 'opacity', (this.value / 100).toString(), 'style'); } });
        _on('#editorBackdrop', 'change', function () { if (_selectedId) { if (_activeDevice === 'desktop') _postIframe('arbel-set-backdrop', { id: _selectedId, value: this.value }); _setOvB(_selectedId, 'backdrop', this.value, 'style'); } });
        _on('#editorShadow', 'change', function () { if (_selectedId) { if (_activeDevice === 'desktop') _postIframe('arbel-set-shadow', { id: _selectedId, value: this.value }); _setOvB(_selectedId, 'shadow', this.value, 'style'); } });

        /* ─── Background image / video upload ─── */
        function _updateBgUI() {
            var ov = _selectedId && _overrides[_selectedId];
            var hasImg = ov && ov.backgroundImage;
            var hasVid = ov && ov.bgVideo;
            var removeBtn = _qs('#editorBgRemove');
            var status = _qs('#editorBgStatus');
            var sizeRow = _qs('#editorBgSizeRow');
            if (removeBtn) removeBtn.style.display = (hasImg || hasVid) ? '' : 'none';
            if (status) {
                status.style.display = (hasImg || hasVid) ? '' : 'none';
                status.textContent = hasVid ? 'Video background set' : hasImg ? 'Image background set' : '';
            }
            if (sizeRow) sizeRow.style.display = hasImg ? '' : 'none';
        }
        _on('#editorBgImgUpload', 'change', function () {
            if (!_selectedId || !this.files || !this.files[0]) return;
            var file = this.files[0];
            if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); this.value = ''; return; }
            var reader = new FileReader();
            var selId = _selectedId;
            reader.onload = function (e) {
                var dataUrl = e.target.result;
                // Remove any video bg first
                if (_overrides[selId] && _overrides[selId].bgVideo) {
                    _postIframe('arbel-remove-bg-video', { id: selId });
                    delete _overrides[selId].bgVideo;
                }
                _setStyle(selId, 'backgroundImage', 'url(' + dataUrl + ')');
                _setStyle(selId, 'backgroundSize', 'cover');
                _setStyle(selId, 'backgroundPosition', 'center');
                _setOvB(selId, 'backgroundImage', 'url(' + dataUrl + ')', 'style');
                _setOvB(selId, 'backgroundSize', 'cover', 'style');
                _setOvB(selId, 'backgroundPosition', 'center', 'style');
                var sz = _qs('#editorBgSize'); if (sz) sz.value = 'cover';
                var pos = _qs('#editorBgPosition'); if (pos) pos.value = 'center';
                _updateBgUI();
            };
            reader.readAsDataURL(file);
            this.value = '';
        });
        _on('#editorBgVidUpload', 'change', function () {
            if (!_selectedId || !this.files || !this.files[0]) return;
            var file = this.files[0];
            if (file.size > 15 * 1024 * 1024) { alert('Video must be under 15 MB'); this.value = ''; return; }
            var reader = new FileReader();
            var selId = _selectedId;
            reader.onload = function (e) {
                var dataUrl = e.target.result;
                // Remove image bg
                _setStyle(selId, 'backgroundImage', '');
                if (_overrides[selId]) delete _overrides[selId].backgroundImage;
                _postIframe('arbel-set-bg-video', { id: selId, src: dataUrl });
                _setOvB(selId, 'bgVideo', dataUrl, 'style');
                _updateBgUI();
            };
            reader.readAsDataURL(file);
            this.value = '';
        });
        _on('#editorBgRemove', 'click', function () {
            if (!_selectedId) return;
            _setStyle(_selectedId, 'backgroundImage', '');
            _postIframe('arbel-remove-bg-video', { id: _selectedId });
            if (_overrides[_selectedId]) {
                delete _overrides[_selectedId].backgroundImage;
                delete _overrides[_selectedId].backgroundSize;
                delete _overrides[_selectedId].backgroundPosition;
                delete _overrides[_selectedId].bgVideo;
            }
            if (_onUpdate) _onUpdate(_overrides);
            _updateBgUI();
        });
        _on('#editorBgSize', 'change', function () {
            if (_selectedId) { _setStyle(_selectedId, 'backgroundSize', this.value); _setOvB(_selectedId, 'backgroundSize', this.value, 'style'); }
        });
        _on('#editorBgPosition', 'change', function () {
            if (_selectedId) { _setStyle(_selectedId, 'backgroundPosition', this.value); _setOvB(_selectedId, 'backgroundPosition', this.value, 'style'); }
        });
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
            _setOvB(_selectedId, 'visibility', next, 'layer');
        });
        _on('#layerToggleLock', 'click', function () {
            if (!_selectedId) return;
            var cur = (_overrides[_selectedId] && _overrides[_selectedId].locked);
            _setOvB(_selectedId, 'locked', !cur, 'layer');
            _postIframe('arbel-set-pointer-events', { id: _selectedId, value: !cur ? 'none' : '' });
        });
        _on('#editorZIndex', 'input', function () {
            if (!_selectedId) return;
            var val = parseInt(this.value);
            if (!isNaN(val)) { _postIframe('arbel-set-zindex', { id: _selectedId, value: val }); _setOvB(_selectedId, 'zIndex', val, 'layer'); }
        });
        _on('#editorZFront', 'click', function () { _setZIndex(9999); });
        _on('#editorZBack', 'click', function () { _setZIndex(-1); });
    }
    function _setZIndex(val) {
        if (!_selectedId) return;
        _postIframe('arbel-set-zindex', { id: _selectedId, value: val });
        _setOvB(_selectedId, 'zIndex', val, 'layer');
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
                if (fmt === 'bold') { _setStyle(_selectedId, 'fontWeight', active ? '700' : ''); _setOvB(_selectedId, 'fontWeight', active ? '700' : '', 'format'); }
                if (fmt === 'italic') { _setStyle(_selectedId, 'fontStyle', active ? 'italic' : ''); _setOvB(_selectedId, 'fontStyle', active ? 'italic' : '', 'format'); }
                if (fmt === 'underline') { _setStyle(_selectedId, 'textDecoration', active ? 'underline' : ''); _setOvB(_selectedId, 'textDecoration', active ? 'underline' : '', 'format'); }
                if (fmt === 'strikethrough') { _setStyle(_selectedId, 'textDecoration', active ? 'line-through' : ''); _setOvB(_selectedId, 'textDecoration', active ? 'line-through' : '', 'format'); }
                if (fmt === 'uppercase') { _setStyle(_selectedId, 'textTransform', active ? 'uppercase' : ''); _setOvB(_selectedId, 'textTransform', active ? 'uppercase' : '', 'format'); }
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
            _setStyle(_selectedId, 'border', val);
            _setOvB(_selectedId, 'border', val, 'border');
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
            _setStyle(_selectedId, 'transform', 'rotate(' + this.value + 'deg)');
            _setOvB(_selectedId, 'transform', 'rotate(' + this.value + 'deg)', 'transform');
        });
    }

    /* ─── Link listeners ─── */
    function _setupLinkListeners() {
        if (!_container) return;
        _on('#editorLinkSet', 'click', function () {
            if (!_selectedId) return;
            var url = _qs('#editorLinkUrl'); if (!url || !url.value) return;
            _postIframe('arbel-set-link', { id: _selectedId, href: url.value });
            _setOvB(_selectedId, 'href', url.value, 'link');
        });
        _on('#editorLinkRemove', 'click', function () {
            if (!_selectedId) return;
            _postIframe('arbel-remove-link', { id: _selectedId });
            _setOvB(_selectedId, 'href', '', 'link');
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
            if (_activeDevice === 'desktop') _postIframe('arbel-set-filter', { id: _selectedId, value: val });
            _setOvB(_selectedId, 'filter', val, 'filter');
        }
        _on('#editorFilterBrightness', 'input', function () { _qs('#editorFilterBrightnessVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterContrast', 'input', function () { _qs('#editorFilterContrastVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterSaturate', 'input', function () { _qs('#editorFilterSaturateVal').textContent = this.value + '%'; applyFilters(); });
        _on('#editorFilterBlur', 'input', function () { _qs('#editorFilterBlurVal').textContent = this.value + 'px'; applyFilters(); });
        _on('#editorObjectFit', 'change', function () {
            if (!_selectedId) return;
            _setStyle(_selectedId, 'objectFit', this.value);
            _setOvB(_selectedId, 'objectFit', this.value, 'style');
        });
    }

    /* ─── Animation listeners ─── */
    function _setupAnimationListeners() {
        if (!_container) return;
        _on('.editor-anim-select', 'change', function () { if (_selectedId) { _postIframe('arbel-set-animation', { id: _selectedId, animation: this.value }); _setOvB(_selectedId, 'animation', this.value, 'anim'); } });
        _on('.editor-preview-anim', 'click', function () { if (_selectedId) { var sel = _qs('.editor-anim-select'); _postIframe('arbel-preview-animation', { id: _selectedId, animation: sel ? sel.value : 'none' }); } });
        _on('#editorContinuous', 'change', function () { if (_selectedId) { _postIframe('arbel-set-continuous', { id: _selectedId, animation: this.value }); _setOvB(_selectedId, 'continuous', this.value, 'anim'); } });
        // Hover is handled by _setupHoverControls
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
        // Scale intensity: slider 10-100 maps to reasonable particle count
        var rawInt = int ? parseInt(int.value) : 50;
        var scaledInt = Math.round(rawInt * 1.5);
        _postIframe('arbel-set-effect', {
            id: targetId, effect: effect,
            intensity: scaledInt,
            color1: c1 ? _hexToRgb(c1.value) : '100,108,255',
            color2: c2 ? _hexToRgb(c2.value) : '11,218,81'
        });
        _setOvB(targetId, 'effect', effect, 'effect');
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
            if (video.src) URL.revokeObjectURL(video.src);
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
                ctx.beginPath(); ctx.arc(spx, spy, 1 + ((spi * 7 + idx * 13) % 17) / 17, 0, 6.28); ctx.fill(); }
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
            _pushUndo();
            _setOv(_selectedId, 'effect', cfg.type); _setOv(_selectedId, 'effectConfig', cfg);
        });
        _on('#pbuilderGlobal', 'click', function () {
            if (!_iframe) return;
            var cfg = getCfg(), tree = _qs('#editorTree');
            if (tree && tree.children[0]) {
                var firstId = tree.children[0].getAttribute('data-tree-id');
                if (firstId) {
                    _postIframe('arbel-set-effect', { id: firstId, effect: cfg.type, intensity: cfg.count, color1: _hexToRgb(cfg.color1), color2: _hexToRgb(cfg.color2), color3: _hexToRgb(cfg.color3), size: cfg.size, speed: cfg.speed, glow: cfg.glow, connect: cfg.connect, interact: cfg.interact });
                    _pushUndo();
                    _setOv(firstId, 'effect', cfg.type); _setOv(firstId, 'effectConfig', cfg);
                }
            }
        });
    }

    /* ─── Page management ─── */
    function _setupPageManagement() {
        if (!_container) return;
        _on('#addPageBtn', 'click', function () { _showAddPageDialog(); });
        _on('#delPageBtn', 'click', function () { _deleteCurrentPage(); });
        _on('#pageSelect', 'change', function () { _currentPage = this.value; _renderPageList(); });
        _on('#addPageBtn2', 'click', function () { _showAddPageDialog(); });
        _renderPageList();
    }

    function _slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function _isPathUnique(path, excludeId) {
        var norm = path.replace(/^\//, '').replace(/\/$/, '');
        for (var i = 0; i < _pages.length; i++) {
            if (_pages[i].id === excludeId) continue;
            var pp = (_pages[i].path || '').replace(/^\//, '').replace(/\/$/, '');
            if (pp === norm) return false;
        }
        return true;
    }

    function _showAddPageDialog() {
        var old = _qs('#arbelPageDialog'); if (old) old.remove();
        var overlay = document.createElement('div');
        overlay.id = 'arbelPageDialog';
        overlay.className = 'arbel-dialog-overlay';
        overlay.innerHTML =
            '<div class="arbel-dialog">' +
                '<div class="arbel-dialog-title">Add New Page</div>' +
                '<label class="arbel-dialog-label">Page Name</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgPageName" placeholder="About Us">' +
                '<label class="arbel-dialog-label">URL Path</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgPagePath" placeholder="/about">' +
                '<label class="arbel-dialog-label">SEO Title (optional)</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgPageSeoTitle" placeholder="About Our Company">' +
                '<label class="arbel-dialog-label">SEO Description (optional)</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgPageSeoDesc" placeholder="Learn more about our team...">' +
                '<label class="arbel-dialog-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
                    '<input type="checkbox" id="dlgPageNav" checked> Show in navigation' +
                '</label>' +
                '<div class="arbel-dialog-actions">' +
                    '<button class="arbel-dialog-btn arbel-dialog-cancel">Cancel</button>' +
                    '<button class="arbel-dialog-btn arbel-dialog-confirm">Add Page</button>' +
                '</div>' +
            '</div>';
        _container.appendChild(overlay);

        var nameIn = overlay.querySelector('#dlgPageName');
        var pathIn = overlay.querySelector('#dlgPagePath');
        nameIn.addEventListener('input', function () {
            nameIn.setCustomValidity('');
            pathIn.value = '/' + _slugify(this.value.trim());
        });
        pathIn.addEventListener('input', function () { nameIn.setCustomValidity(''); });
        overlay.querySelector('.arbel-dialog-cancel').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.arbel-dialog-confirm').addEventListener('click', function () {
            var name = nameIn.value.trim();
            if (!name) { nameIn.focus(); return; }
            var path = pathIn.value.trim() || '/' + _slugify(name);
            if (!path.match(/^\//)) path = '/' + path;
            var id = 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
            var showNav = overlay.querySelector('#dlgPageNav').checked;
            var seoTitle = overlay.querySelector('#dlgPageSeoTitle').value.trim();
            var seoDesc = overlay.querySelector('#dlgPageSeoDesc').value.trim();
            if (!_isPathUnique(path)) {
                nameIn.setCustomValidity('A page with this path already exists');
                nameIn.reportValidity();
                return;
            }
            var pg = { id: id, name: name, path: path, isHome: false, showInNav: showNav };
            if (seoTitle) pg.seoTitle = seoTitle;
            if (seoDesc) pg.seoDesc = seoDesc;
            _pushUndo();
            _pages.push(pg);
            _currentPage = id;
            _updatePageSelect();
            _renderPageList();
            overlay.remove();
        });
        nameIn.focus();
    }

    function _deleteCurrentPage() {
        if (_pages.length <= 1) return;
        var sel = _qs('#pageSelect'); if (!sel) return;
        var page = null;
        for (var i = 0; i < _pages.length; i++) { if (_pages[i].id === sel.value) { page = _pages[i]; break; } }
        if (!page || page.isHome) { alert('Cannot delete the home page.'); return; }
        if (!confirm('Delete "' + page.name + '"?')) return;
        _pushUndo();
        _pages = _pages.filter(function (p) { return p.id !== page.id; });
        _currentPage = 'home';
        _updatePageSelect();
        _renderPageList();
    }

    function _showPageSettings(page) {
        var old = _qs('#arbelPageDialog'); if (old) old.remove();
        var overlay = document.createElement('div');
        overlay.id = 'arbelPageDialog';
        overlay.className = 'arbel-dialog-overlay';
        overlay.innerHTML =
            '<div class="arbel-dialog">' +
                '<div class="arbel-dialog-title">Page Settings — ' + _escHtml(page.name) + '</div>' +
                '<label class="arbel-dialog-label">Page Name</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgEditName" value="' + _escHtml(page.name).replace(/"/g, '&quot;') + '">' +
                '<label class="arbel-dialog-label">URL Path</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgEditPath" value="' + _escHtml(page.path || '/').replace(/"/g, '&quot;') + '">' +
                '<label class="arbel-dialog-label">SEO Title</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgEditSeoTitle" value="' + _escHtml(page.seoTitle || '').replace(/"/g, '&quot;') + '" placeholder="Page title for search engines">' +
                '<label class="arbel-dialog-label">SEO Description</label>' +
                '<input type="text" class="arbel-dialog-input" id="dlgEditSeoDesc" value="' + _escHtml(page.seoDesc || '').replace(/"/g, '&quot;') + '" placeholder="Short description for search engines">' +
                '<label class="arbel-dialog-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
                    '<input type="checkbox" id="dlgEditNav"' + (page.showInNav ? ' checked' : '') + '> Show in navigation' +
                '</label>' +
                '<div class="arbel-dialog-actions">' +
                    '<button class="arbel-dialog-btn arbel-dialog-cancel">Cancel</button>' +
                    '<button class="arbel-dialog-btn arbel-dialog-confirm">Save</button>' +
                '</div>' +
            '</div>';
        _container.appendChild(overlay);

        var nameIn = overlay.querySelector('#dlgEditName');
        var pathIn = overlay.querySelector('#dlgEditPath');
        pathIn.addEventListener('input', function () { pathIn.setCustomValidity(''); });
        nameIn.addEventListener('input', function () { pathIn.setCustomValidity(''); });
        overlay.querySelector('.arbel-dialog-cancel').addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.arbel-dialog-confirm').addEventListener('click', function () {
            var newName = nameIn.value.trim();
            if (!newName) { nameIn.focus(); return; }
            var newPath = pathIn.value.trim();
            if (!newPath.match(/^\//)) newPath = '/' + newPath;
            if (!_isPathUnique(newPath, page.id)) {
                pathIn.setCustomValidity('A page with this path already exists');
                pathIn.reportValidity();
                return;
            }
            _pushUndo();
            page.name = newName;
            page.path = newPath;
            page._pathCustomized = true;
            page.seoTitle = overlay.querySelector('#dlgEditSeoTitle').value.trim() || '';
            page.seoDesc = overlay.querySelector('#dlgEditSeoDesc').value.trim() || '';
            page.showInNav = overlay.querySelector('#dlgEditNav').checked;
            _updatePageSelect();
            _renderPageList();
            overlay.remove();
        });
        nameIn.focus();
    }

    function _renderPageList() {
        var list = _qs('#pageList'); if (!list) return;
        list.innerHTML = '';
        _pages.forEach(function (page) {
            var row = document.createElement('div');
            row.className = 'page-item' + (page.id === _currentPage ? ' active' : '');
            var homeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
            var pageIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
            var settingsIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
            row.innerHTML =
                '<div class="page-item-icon">' + (page.isHome ? homeIcon : pageIcon) + '</div>' +
                '<div class="page-item-info">' +
                    '<span class="page-item-name">' + _escHtml(page.name) + '</span>' +
                    '<span class="page-item-path">' + _escHtml(page.path || '/') + '</span>' +
                '</div>' +
                '<div class="page-item-actions">' +
                    (page.showInNav && !page.isHome ? '<span class="page-item-nav-badge" title="In navigation">NAV</span>' : '') +
                    (!page.isHome ? '<button class="page-item-btn page-settings-btn" title="Page Settings">' + settingsIcon + '</button>' : '') +
                    (!page.isHome ? '<button class="page-item-btn page-dup-btn" title="Duplicate">&#128464;</button>' : '') +
                    (!page.isHome ? '<button class="page-item-btn page-del-btn" title="Delete">&times;</button>' : '') +
                '</div>';

            /* Click to select */
            row.querySelector('.page-item-info').addEventListener('click', function () {
                _currentPage = page.id;
                _updatePageSelect();
                _renderPageList();
            });

            /* Double-click name to inline rename (name only, id stays stable) */
            var nameEl = row.querySelector('.page-item-name');
            nameEl.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                var input = document.createElement('input');
                input.type = 'text';
                input.className = 'page-item-rename';
                input.value = page.name;
                nameEl.replaceWith(input);
                input.focus();
                input.select();
                var committed = false;
                function commit() {
                    if (committed) return;
                    committed = true;
                    var v = input.value.trim();
                    if (v && v !== page.name) {
                        _pushUndo();
                        page.name = v;
                        /* Update path only if user hasn't customised it via settings */
                        if (!page.isHome && !page._pathCustomized) {
                            var newPath = '/' + _slugify(v);
                            if (_isPathUnique(newPath, page.id)) {
                                page.path = newPath;
                            }
                        }
                    }
                    _updatePageSelect();
                    _renderPageList();
                }
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', function (e2) {
                    if (e2.key === 'Enter') { e2.preventDefault(); commit(); }
                    if (e2.key === 'Escape') { committed = true; _renderPageList(); }
                });
            });

            /* Settings dialog */
            var settingsBtn = row.querySelector('.page-settings-btn');
            if (settingsBtn) settingsBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _showPageSettings(page);
            });

            /* Duplicate */
            var dupBtn = row.querySelector('.page-dup-btn');
            if (dupBtn) dupBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var basePath = (page.path || '/' + page.name.toLowerCase()) + '-copy';
                var newPath = basePath, n = 1;
                while (!_isPathUnique(newPath)) { newPath = basePath + '-' + (++n); }
                var newId = 'page-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
                var dup = { id: newId, name: page.name + ' (copy)', path: newPath, isHome: false, showInNav: page.showInNav };
                if (page.seoTitle) dup.seoTitle = page.seoTitle;
                if (page.seoDesc) dup.seoDesc = page.seoDesc;
                _pages.push(dup);
                _updatePageSelect();
                _renderPageList();
            });

            /* Delete */
            var delBtn = row.querySelector('.page-del-btn');
            if (delBtn) delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!confirm('Delete "' + page.name + '"?')) return;
                _pages = _pages.filter(function (p) { return p.id !== page.id; });
                if (_currentPage === page.id) _currentPage = 'home';
                _updatePageSelect();
                _renderPageList();
            });

            list.appendChild(row);
        });
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
        // Update background image/video UI
        var ov = info.id && _overrides[info.id];
        var hasImg = ov && ov.backgroundImage;
        var hasVid = ov && ov.bgVideo;
        var bgRemove = _qs('#editorBgRemove'), bgStatus = _qs('#editorBgStatus'), bgSizeRow = _qs('#editorBgSizeRow');
        if (bgRemove) bgRemove.style.display = (hasImg || hasVid) ? '' : 'none';
        if (bgStatus) { bgStatus.style.display = (hasImg || hasVid) ? '' : 'none'; bgStatus.textContent = hasVid ? 'Video background set' : hasImg ? 'Image background set' : ''; }
        if (bgSizeRow) bgSizeRow.style.display = hasImg ? '' : 'none';
        if (hasImg) {
            var bsz = _qs('#editorBgSize'), bpos = _qs('#editorBgPosition');
            if (bsz && ov.backgroundSize) bsz.value = ov.backgroundSize;
            if (bpos && ov.backgroundPosition) bpos.value = ov.backgroundPosition;
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
        _lastTree = tree.map(function (item) { return JSON.parse(JSON.stringify(item)); });
        var treeEl = _qs('#editorTree'); if (!treeEl) return;
        var searchEl = _qs('#layerSearch');
        var filter = searchEl ? searchEl.value.toLowerCase() : '';
        treeEl.innerHTML = '';
        // Apply overrides to deep copies, sort by z-index descending (highest = top of list)
        _lastTree.forEach(function (item) {
            var ov = _overrides[item.id];
            if (ov) {
                if (ov.visibility !== undefined) item.visible = ov.visibility !== 'hidden';
                if (ov.locked !== undefined) item.locked = ov.locked;
                if (ov.zIndex !== undefined) item.zIndex = ov.zIndex;
            }
        });
        var sorted = _lastTree.slice().sort(function (a, b) { return _getItemZ(b) - _getItemZ(a); });
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
                _setOvB(item.id, 'visibility', next, 'layer');
                this.innerHTML = next === 'visible' ? '&#128065;' : '&#128683;';
                this.classList.toggle('is-hidden', next === 'hidden');
            });
            // Lock toggle
            div.querySelector('.tree-lock-btn').addEventListener('click', function (e) {
                e.stopPropagation();
                var cur = (_overrides[item.id] && _overrides[item.id].locked);
                _setOvB(item.id, 'locked', !cur, 'layer');
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
                _pushUndo();
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

    /** Send arbel-set-style ONLY on desktop to avoid inline contamination.
     *  On tablet/mobile the responsive CSS injection handles the visual. */
    function _setStyle(id, prop, value) {
        if (_activeDevice === 'desktop') {
            _postIframe('arbel-set-style', { id: id, prop: prop, value: value });
        }
    }

    /** After switching to desktop, reapply root override values as inline
     *  styles so any contamination from mobile/tablet edits is fixed. */
    function _restoreDesktopInlines() {
        var SKIP = { text:1, animation:1, hover:1, continuous:1, effect:1,
            visibility:1, locked:1, href:1, bgVideo:1, src:1,
            _mobile:1, _tablet:1, _frameHtml:1, shapeSvg:1 };
        var _bdMap = { 'blur-sm':'blur(4px)', 'blur-md':'blur(8px)', 'blur-lg':'blur(16px)',
            saturate:'saturate(2)', grayscale:'grayscale(1)', sepia:'sepia(1)' };
        var _shMap = { sm:'0 2px 8px rgba(0,0,0,.15)', md:'0 4px 16px rgba(0,0,0,.2)',
            lg:'0 8px 32px rgba(0,0,0,.25)', xl:'0 16px 64px rgba(0,0,0,.3)',
            glow:'0 0 30px rgba(100,108,255,.4)',
            neon:'0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)',
            inner:'inset 0 2px 10px rgba(0,0,0,.3)' };
        var ids = Object.keys(_overrides);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i]; var ov = _overrides[id]; if (!ov) continue;
            var keys = Object.keys(ov);
            for (var j = 0; j < keys.length; j++) {
                var k = keys[j];
                if (SKIP[k] || k.charAt(0) === '_') continue;
                if (k === 'backdrop') {
                    _postIframe('arbel-set-backdrop', { id: id, value: ov[k] });
                } else if (k === 'shadow') {
                    _postIframe('arbel-set-shadow', { id: id, value: ov[k] });
                } else if (k === 'filter') {
                    _postIframe('arbel-set-filter', { id: id, value: ov[k] });
                } else {
                    _postIframe('arbel-set-style', { id: id, prop: k, value: ov[k] });
                }
            }
        }
    }

    /* Properties that are always stored on the root override (same across all devices) */
    var _GLOBAL_PROPS = { text: 1, animation: 1, hover: 1, continuous: 1, effect: 1,
        visibility: 1, locked: 1, zIndex: 1, href: 1, bgVideo: 1,
        backgroundImage: 1, backgroundSize: 1, backgroundPosition: 1,
        shape: 1, shapeFill: 1, shapeStroke: 1, shapeSvg: 1, shapeStrokeWidth: 1 };

    function _setOv(id, k, v) {
        if (!_overrides[id]) _overrides[id] = {};
        if (_activeDevice === 'desktop' || _GLOBAL_PROPS[k]) {
            _overrides[id][k] = v;
        } else {
            var dk = '_' + _activeDevice;
            if (!_overrides[id][dk]) _overrides[id][dk] = {};
            _overrides[id][dk][k] = v;
            _applyDeviceResponsive();
        }
        if (_onUpdate) _onUpdate(_overrides);
    }

    /** Read an override value, checking device sub-object first, then root */
    function _getOv(id, k) {
        if (!_overrides[id]) return undefined;
        if (_activeDevice !== 'desktop' && !_GLOBAL_PROPS[k]) {
            var dk = '_' + _activeDevice;
            if (_overrides[id][dk] && _overrides[id][dk][k] !== undefined) {
                return _overrides[id][dk][k];
            }
        }
        return _overrides[id][k];
    }

    /** Set multiple properties at once, single _applyDeviceResponsive call */
    function _setOvBatch(id, pairs) {
        if (!_overrides[id]) _overrides[id] = {};
        var needResponsive = false;
        Object.keys(pairs).forEach(function (k) {
            var v = pairs[k];
            if (_activeDevice === 'desktop' || _GLOBAL_PROPS[k]) {
                _overrides[id][k] = v;
            } else {
                var dk = '_' + _activeDevice;
                if (!_overrides[id][dk]) _overrides[id][dk] = {};
                _overrides[id][dk][k] = v;
                needResponsive = true;
            }
        });
        // Skip expensive CSS re-injection during active drag/resize
        if (needResponsive && !_draggingId) _applyDeviceResponsive();
        if (_onUpdate) _onUpdate(_overrides);
    }
    /** _setOv + auto burst snapshot in one call. Category determines debounce grouping. */
    function _setOvB(id, k, v, category) {
        _beginBurst(category);
        _setOv(id, k, v);
        _commitBurst(category);
    }

    /* ─── Undo / Redo engine ─── */
    function _snapshotState() {
        return {
            overrides: JSON.parse(JSON.stringify(_overrides)),
            pages: JSON.parse(JSON.stringify(_pages)),
            videoConfig: JSON.parse(JSON.stringify(_videoConfig))
        };
    }
    function _stateEqual(a, b) {
        if (!a || !b) return false;
        return JSON.stringify(a.overrides) === JSON.stringify(b.overrides) &&
               JSON.stringify(a.pages) === JSON.stringify(b.pages) &&
               JSON.stringify(a.videoConfig) === JSON.stringify(b.videoConfig);
    }
    function _pushUndo() {
        if (_undoLocked) return;
        var snap = _snapshotState();
        if (_undoStack.length > 0 && _stateEqual(snap, _undoStack[_undoStack.length - 1])) return;
        _undoStack.push(snap);
        if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
        _redoStack = [];
        _updateUndoButtons();
    }
    function _commitSnapshot(snapshot) {
        if (_undoLocked) return;
        if (JSON.stringify(snapshot.overrides) === JSON.stringify(_overrides) &&
            JSON.stringify(snapshot.pages) === JSON.stringify(_pages) &&
            JSON.stringify(snapshot.videoConfig) === JSON.stringify(_videoConfig)) return;
        _undoStack.push(snapshot);
        if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
        _redoStack = [];
        _updateUndoButtons();
    }
    function _beginBurst(category) {
        if (_undoLocked) return;
        if (!_burstSnapshots[category]) {
            _burstSnapshots[category] = { snapshot: _snapshotState(), timer: null };
        }
    }
    function _commitBurst(category, delay) {
        if (_undoLocked) return;
        var entry = _burstSnapshots[category];
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.timer = setTimeout(function () {
            if (_burstSnapshots[category]) {
                _commitSnapshot(_burstSnapshots[category].snapshot);
                delete _burstSnapshots[category];
            }
        }, delay || 600);
    }
    function _flushBursts() {
        Object.keys(_burstSnapshots).forEach(function (cat) {
            clearTimeout(_burstSnapshots[cat].timer);
            _commitSnapshot(_burstSnapshots[cat].snapshot);
        });
        _burstSnapshots = {};
    }
    function _undo() {
        if (_undoStack.length === 0) return;
        _flushBursts();
        _redoStack.push(_snapshotState());
        _undoLocked = true;
        var state = _undoStack.pop();
        _overrides = state.overrides;
        _pages = state.pages;
        _videoConfig = state.videoConfig;
        _undoLocked = false;
        // Notify parent to recompile
        if (_onUpdate) _onUpdate(_overrides);
        _updatePageSelect();
        _renderPageList();
        _updateUndoButtons();
        _applyDeviceResponsive();
        if (_lastTree.length) _renderElementTree(_lastTree);
        if (_selectedId && _iframe) _postIframe('arbel-select-by-id', { id: _selectedId });
    }
    function _redo() {
        if (_redoStack.length === 0) return;
        _flushBursts();
        _undoStack.push(_snapshotState());
        _undoLocked = true;
        var state = _redoStack.pop();
        _overrides = state.overrides;
        _pages = state.pages;
        _videoConfig = state.videoConfig;
        _undoLocked = false;
        if (_onUpdate) _onUpdate(_overrides);
        _updatePageSelect();
        _renderPageList();
        _updateUndoButtons();
        _applyDeviceResponsive();
        if (_lastTree.length) _renderElementTree(_lastTree);
        if (_selectedId && _iframe) _postIframe('arbel-select-by-id', { id: _selectedId });
    }
    function _updateUndoButtons() {
        var undoBtn = _qs('#editorUndo');
        var redoBtn = _qs('#editorRedo');
        if (undoBtn) undoBtn.disabled = _undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = _redoStack.length === 0;
    }
    function _hexToRgb(hex) { return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16); }
    function _rgbToHex(rgb) {
        if (!rgb || rgb.charAt(0) === '#') return rgb || '#000000';
        var m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return '#000000';
        return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1);
    }

    /* ═══════════════════════════════════════════════════
       ADD ELEMENT DIALOG  (matches cinematic mode)
       ═══════════════════════════════════════════════════ */

    function _showAddElementDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay aed-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog arbel-dialog--add-el aed-dialog';

        // ── Header ──
        var header = document.createElement('div');
        header.className = 'aed-header';
        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title aed-title';
        title.textContent = 'Add Element';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'aed-close';
        closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        closeBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
        header.appendChild(title);
        header.appendChild(closeBtn);

        // ── Search ──
        var searchWrap = document.createElement('div');
        searchWrap.className = 'aed-search-wrap';
        searchWrap.innerHTML = '<svg class="aed-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
        var searchInput = document.createElement('input');
        searchInput.className = 'aed-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Search elements...';
        searchWrap.appendChild(searchInput);

        // ── Category Tabs ──
        var catOrder = ['All', 'Text', 'Media', 'Layout', 'Shapes', 'Frames', 'Decorative', 'Interactive', '3D Effects'];
        var tabBar = document.createElement('div');
        tabBar.className = 'aed-tabs';
        var activeCat = 'All';

        // ── Element Type Definitions ──
        var types = [
            { tag: 'h1', label: 'Heading 1', text: 'Heading', cat: 'Text', icon: 'H1' },
            { tag: 'h2', label: 'Heading 2', text: 'Subheading', cat: 'Text', icon: 'H2' },
            { tag: 'h3', label: 'Heading 3', text: 'Section Title', cat: 'Text', icon: 'H3' },
            { tag: 'p', label: 'Paragraph', text: 'Your text here', cat: 'Text', icon: 'P' },
            { tag: 'span', label: 'Label / Tag', text: 'LABEL', cat: 'Text', icon: 'Aa' },
            { tag: 'a', label: 'Link', text: 'Learn More', cat: 'Text', icon: 'link' },
            { tag: 'img', label: 'Image', text: '', cat: 'Media', icon: 'image' },
            { tag: 'video', label: 'Video', text: '', cat: 'Media', icon: 'video' },
            { tag: 'div', label: 'Lottie Animation', text: '', variant: 'lottie', cat: 'Media', icon: 'lottie' },
            { tag: 'div', label: 'SVG Illustration', text: '', variant: 'svg', cat: 'Media', icon: 'svg' },
            { tag: 'div', label: 'Embed / iFrame', text: '', variant: 'embed', cat: 'Media', icon: 'embed' },
            { tag: 'div', label: 'Box / Container', text: '', cat: 'Layout', icon: 'box' },
            { tag: 'div', label: 'Glass Card', text: '', variant: 'glass', cat: 'Layout', icon: 'glass' },
            { tag: 'div', label: 'Circle', text: '', variant: 'shape', shapeName: 'circle', cat: 'Shapes' },
            { tag: 'div', label: 'Square', text: '', variant: 'shape', shapeName: 'square', cat: 'Shapes' },
            { tag: 'div', label: 'Rounded Square', text: '', variant: 'shape', shapeName: 'rounded-square', cat: 'Shapes' },
            { tag: 'div', label: 'Triangle', text: '', variant: 'shape', shapeName: 'triangle', cat: 'Shapes' },
            { tag: 'div', label: 'Diamond', text: '', variant: 'shape', shapeName: 'diamond', cat: 'Shapes' },
            { tag: 'div', label: 'Pentagon', text: '', variant: 'shape', shapeName: 'pentagon', cat: 'Shapes' },
            { tag: 'div', label: 'Hexagon', text: '', variant: 'shape', shapeName: 'hexagon', cat: 'Shapes' },
            { tag: 'div', label: 'Octagon', text: '', variant: 'shape', shapeName: 'octagon', cat: 'Shapes' },
            { tag: 'div', label: 'Star', text: '', variant: 'shape', shapeName: 'star', cat: 'Shapes' },
            { tag: 'div', label: 'Heart', text: '', variant: 'shape', shapeName: 'heart', cat: 'Shapes' },
            { tag: 'div', label: 'Cross', text: '', variant: 'shape', shapeName: 'cross', cat: 'Shapes' },
            { tag: 'div', label: 'Arrow Right', text: '', variant: 'shape', shapeName: 'arrow-right', cat: 'Shapes' },
            { tag: 'div', label: 'Ring', text: '', variant: 'shape', shapeName: 'ring', cat: 'Shapes' },
            { tag: 'div', label: 'Semicircle', text: '', variant: 'shape', shapeName: 'semicircle', cat: 'Shapes' },
            { tag: 'div', label: 'Pill', text: '', variant: 'shape', shapeName: 'pill', cat: 'Shapes' },
            { tag: 'div', label: 'Parallelogram', text: '', variant: 'shape', shapeName: 'parallelogram', cat: 'Shapes' },
            { tag: 'div', label: 'Circle Frame', text: '', variant: 'frame', frameName: 'circle', cat: 'Frames' },
            { tag: 'div', label: 'Square Frame', text: '', variant: 'frame', frameName: 'square', cat: 'Frames' },
            { tag: 'div', label: 'Rounded Frame', text: '', variant: 'frame', frameName: 'rounded-square', cat: 'Frames' },
            { tag: 'div', label: 'Triangle Frame', text: '', variant: 'frame', frameName: 'triangle', cat: 'Frames' },
            { tag: 'div', label: 'Diamond Frame', text: '', variant: 'frame', frameName: 'diamond', cat: 'Frames' },
            { tag: 'div', label: 'Hexagon Frame', text: '', variant: 'frame', frameName: 'hexagon', cat: 'Frames' },
            { tag: 'div', label: 'Star Frame', text: '', variant: 'frame', frameName: 'star', cat: 'Frames' },
            { tag: 'div', label: 'Heart Frame', text: '', variant: 'frame', frameName: 'heart', cat: 'Frames' },
            { tag: 'div', label: 'Octagon Frame', text: '', variant: 'frame', frameName: 'octagon', cat: 'Frames' },
            { tag: 'div', label: 'Pentagon Frame', text: '', variant: 'frame', frameName: 'pentagon', cat: 'Frames' },
            { tag: 'div', label: 'Arch Frame', text: '', variant: 'frame', frameName: 'arch', cat: 'Frames' },
            { tag: 'div', label: 'Cross Frame', text: '', variant: 'frame', frameName: 'cross', cat: 'Frames' },
            { tag: 'div', label: 'Gradient Orb', text: '', variant: 'orb', cat: 'Decorative', icon: 'orb' },
            { tag: 'div', label: 'Divider Line', text: '', variant: 'divider', cat: 'Decorative', icon: 'divider' },
            { tag: 'div', label: 'Button', text: 'Click Me', variant: 'button', cat: 'Interactive', icon: 'button' },
            { tag: 'form', label: 'Contact Form', text: '', variant: 'form', cat: 'Interactive', icon: 'form' },
            { tag: 'div', label: '3D Card Flip', text: '', variant: '3d-card', cat: '3D Effects', icon: '3d' },
            { tag: 'div', label: '3D Rotate Box', text: '', variant: '3d-rotate', cat: '3D Effects', icon: '3d' },
            { tag: 'div', label: '3D Float Layer', text: '', variant: '3d-float', cat: '3D Effects', icon: '3d' },
            { tag: 'div', label: '3D Tilt Plane', text: '', variant: '3d-tilt', cat: '3D Effects', icon: '3d' },
            { tag: 'canvas', label: 'WebGL Canvas', text: '', variant: 'webgl', cat: '3D Effects', icon: 'webgl' }
        ];

        // SVG icons for non-shape element types
        var ICONS = {
            'H1':      '<svg viewBox="0 0 40 40"><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" font-weight="800" font-size="22">H1</text></svg>',
            'H2':      '<svg viewBox="0 0 40 40"><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" font-weight="800" font-size="22">H2</text></svg>',
            'H3':      '<svg viewBox="0 0 40 40"><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" font-weight="800" font-size="22">H3</text></svg>',
            'P':       '<svg viewBox="0 0 40 40"><rect x="4" y="8" width="32" height="3" rx="1.5" fill="currentColor" opacity="0.9"/><rect x="4" y="15" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.6"/><rect x="4" y="22" width="32" height="3" rx="1.5" fill="currentColor" opacity="0.4"/><rect x="4" y="29" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.3"/></svg>',
            'Aa':      '<svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="2"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" font-size="12" font-weight="600">TAG</text></svg>',
            'link':    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 21a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5"/><path d="M25 19a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5"/></svg>',
            'image':   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="7" width="30" height="26" rx="3"/><circle cx="14" cy="16" r="3"/><path d="M5 28l8-8 5 5 4-4 13 10" stroke-linejoin="round"/></svg>',
            'video':   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="9" width="24" height="22" rx="3"/><path d="M28 16l8-5v18l-8-5V16z" fill="currentColor" opacity="0.3" stroke="currentColor"/></svg>',
            'lottie':  '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><circle cx="20" cy="20" r="14"/><path d="M14 20c2-6 4-6 6 0s4 6 6 0" stroke-linecap="round"/></svg>',
            'svg':     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6l14 10-14 10L6 16z"/><circle cx="20" cy="16" r="4" fill="currentColor" opacity="0.3"/></svg>',
            'embed':   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 12l-8 8 8 8M26 12l8 8-8 8"/></svg>',
            'box':     '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="30" height="30" rx="4" stroke-dasharray="4 3"/></svg>',
            'glass':   '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.3"/><rect x="9" y="15" width="22" height="2" rx="1" fill="currentColor" opacity="0.15"/><rect x="9" y="20" width="18" height="2" rx="1" fill="currentColor" opacity="0.15"/></svg>',
            'orb':     '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="url(#aed-orb)"/><defs><radialGradient id="aed-orb"><stop offset="0%" stop-color="#a78bfa" stop-opacity="0.6"/><stop offset="100%" stop-color="#6C5CE7" stop-opacity="0"/></radialGradient></defs></svg>',
            'divider': '<svg viewBox="0 0 40 40"><rect x="4" y="19" width="32" height="2" rx="1" fill="currentColor" opacity="0.4"/></svg>',
            'button':  '<svg viewBox="0 0 40 40"><rect x="4" y="12" width="32" height="16" rx="8" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="currentColor" font-size="9" font-weight="600">BTN</text></svg>',
            'form':    '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="28" height="28" rx="4"/><rect x="10" y="11" width="20" height="5" rx="2"/><rect x="10" y="20" width="20" height="5" rx="2"/><rect x="14" y="28" width="12" height="4" rx="2" fill="currentColor" opacity="0.3"/></svg>',
            '3d':      '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 14l12-7 12 7v12l-12 7-12-7z"/><path d="M8 14l12 7 12-7M20 21v13" opacity="0.4"/></svg>',
            'webgl':   '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"><polygon points="20,4 36,30 4,30"/><circle cx="20" cy="22" r="5" fill="currentColor" opacity="0.2"/></svg>'
        };

        // ── Build element icon HTML ──
        function makeIcon(t) {
            var shapKey = t.shapeName || t.frameName;
            if (shapKey && SHAPE_PATHS[shapKey]) {
                var sDef = SHAPE_PATHS[shapKey];
                var sFill = t.variant === 'frame' ? 'none' : (sDef.isStroke ? 'none' : 'currentColor');
                var sStroke = t.variant === 'frame' || sDef.isStroke ? 'currentColor' : 'none';
                return '<svg viewBox="0 0 100 100">' + sDef.svg.replace('/>', ' fill="' + sFill + '" stroke="' + sStroke + '" stroke-width="4"/>') + '</svg>';
            }
            return ICONS[t.icon] || ICONS['box'];
        }

        // ── Render grid ──
        var grid = document.createElement('div');
        grid.className = 'aed-grid';

        function renderItems(filter, query) {
            grid.innerHTML = '';
            var matchingCats = {};
            types.forEach(function (t) {
                if (filter !== 'All' && t.cat !== filter) return;
                if (query && t.label.toLowerCase().indexOf(query) === -1 && t.cat.toLowerCase().indexOf(query) === -1) return;
                if (!matchingCats[t.cat]) matchingCats[t.cat] = [];
                matchingCats[t.cat].push(t);
            });

            var catKeys = Object.keys(matchingCats);
            if (catKeys.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'aed-empty';
                empty.textContent = 'No elements found';
                grid.appendChild(empty);
                return;
            }

            catKeys.forEach(function (cat) {
                if (filter === 'All' || query) {
                    var catHead = document.createElement('div');
                    catHead.className = 'aed-cat-head';
                    catHead.textContent = cat;
                    grid.appendChild(catHead);
                }

                var isVisual = (cat === 'Shapes' || cat === 'Frames');
                var section = document.createElement('div');
                section.className = isVisual ? 'aed-section aed-section--grid' : 'aed-section aed-section--list';

                matchingCats[cat].forEach(function (t) {
                    var card = document.createElement('button');
                    card.className = isVisual ? 'aed-card aed-card--visual' : 'aed-card aed-card--row';
                    card.title = t.label;

                    var iconEl = document.createElement('div');
                    iconEl.className = 'aed-card-icon';
                    iconEl.innerHTML = makeIcon(t);

                    var labelEl = document.createElement('span');
                    labelEl.className = 'aed-card-label';
                    labelEl.textContent = t.label;

                    if (isVisual) {
                        card.appendChild(iconEl);
                        card.appendChild(labelEl);
                    } else {
                        card.appendChild(iconEl);
                        var info = document.createElement('div');
                        info.className = 'aed-card-info';
                        var mainLabel = document.createElement('span');
                        mainLabel.className = 'aed-card-label';
                        mainLabel.textContent = t.label;
                        var subLabel = document.createElement('span');
                        subLabel.className = 'aed-card-sub';
                        subLabel.textContent = t.variant ? t.variant : '<' + t.tag + '>';
                        info.appendChild(mainLabel);
                        info.appendChild(subLabel);
                        card.appendChild(info);
                    }

                    card.addEventListener('click', function () {
                        _addElementFromType(t);
                        document.body.removeChild(overlay);
                    });
                    section.appendChild(card);
                });
                grid.appendChild(section);
            });
        }

        // ── Build tabs ──
        function buildTabs() {
            tabBar.innerHTML = '';
            catOrder.forEach(function (cat) {
                if (cat !== 'All') {
                    var hasItems = types.some(function (t) { return t.cat === cat; });
                    if (!hasItems) return;
                }
                var tab = document.createElement('button');
                tab.className = 'aed-tab' + (cat === activeCat ? ' aed-tab--active' : '');
                tab.textContent = cat;
                tab.addEventListener('click', function () {
                    activeCat = cat;
                    buildTabs();
                    renderItems(activeCat, searchInput.value.toLowerCase().trim());
                });
                tabBar.appendChild(tab);
            });
        }
        buildTabs();
        renderItems('All', '');

        // ── Search listener ──
        searchInput.addEventListener('input', function () {
            var q = searchInput.value.toLowerCase().trim();
            if (q) { activeCat = 'All'; buildTabs(); }
            renderItems(activeCat, q);
        });

        // ── Assemble dialog ──
        dialog.appendChild(header);
        dialog.appendChild(searchWrap);
        dialog.appendChild(tabBar);
        dialog.appendChild(grid);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        setTimeout(function () { searchInput.focus(); }, 60);

        function onKey(e) { if (e.key === 'Escape') { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); } }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
        });
    }

    /* ─── File upload helper: returns base64 dataURL ─── */
    function _promptFileUpload(accept, cb) {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = accept;
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', function () {
            var file = inp.files && inp.files[0];
            if (!file) { document.body.removeChild(inp); return; }
            var reader = new FileReader();
            reader.onload = function () { cb(reader.result); document.body.removeChild(inp); };
            reader.readAsDataURL(file);
        });
        inp.click();
    }

    function _addElementFromType(t) {
        _pushUndo();
        _addedCount++;
        var id = t.tag + '-' + Date.now().toString(36) + '-' + _addedCount;
        _addedElements.push(id);

        var fontSize = t.tag === 'h1' ? '5vw' : t.tag === 'h2' ? '3vw' : t.tag === 'h3' ? '2vw' : t.tag === 'span' ? '0.75rem' : '1.1rem';
        var fontWeight = (t.tag === 'h1' || t.tag === 'h2' || t.tag === 'h3') ? '700' : '400';

        var msg = {
            id: id,
            tag: t.tag,
            editable: !!(t.text),
            text: t.text || '',
            style: {
                fontSize: fontSize,
                fontWeight: fontWeight,
                color: '#ffffff'
            },
            attrs: {}
        };

        // Variant‑specific style overrides
        if (t.tag === 'span') {
            msg.style.letterSpacing = '0.2em';
            msg.style.textTransform = 'uppercase';
            msg.style.color = 'rgba(255,255,255,0.4)';
            msg.style.display = 'inline-block';
        }

        if (t.tag === 'img') {
            msg.style = { width: '100%', maxWidth: '500px', borderRadius: '12px', objectFit: 'cover' };
            msg.editable = false;
            // Prompt file upload
            _promptFileUpload('image/*', function (dataUrl) {
                _postIframe('arbel-set-src', { id: id, src: dataUrl });
                if (!_overrides[id]) _overrides[id] = {};
                _overrides[id].src = dataUrl;
                if (_onUpdate) _onUpdate(_overrides);
            });
        } else if (t.tag === 'video') {
            msg.style = { width: '100%', maxWidth: '640px', borderRadius: '12px', objectFit: 'cover' };
            msg.attrs = { controls: '', autoplay: '', muted: '', loop: '' };
            msg.editable = false;
            _promptFileUpload('video/*', function (dataUrl) {
                _postIframe('arbel-set-src', { id: id, src: dataUrl });
                if (!_overrides[id]) _overrides[id] = {};
                _overrides[id].src = dataUrl;
                if (_onUpdate) _onUpdate(_overrides);
            });
        } else if (t.tag === 'a' && !t.variant) {
            msg.style.color = '#a78bfa';
            msg.style.textDecoration = 'underline';
            msg.attrs = { href: '#', target: '_blank' };
        } else if (t.tag === 'div' && t.variant === 'glass') {
            msg.style = {
                width: '300px', height: '200px', padding: '32px',
                borderRadius: '16px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)'
            };
        } else if (t.tag === 'div' && t.variant === 'shape') {
            var shapeDef = SHAPE_PATHS[t.shapeName] || SHAPE_PATHS['circle'];
            var shapeColor = '#ffffff';
            var shapeStroke = 'none';
            var shapeSW = 0;
            if (shapeDef.isStroke) { shapeColor = 'none'; shapeStroke = '#ffffff'; shapeSW = 8; }
            msg.html = _buildShapeSvg(t.shapeName, shapeColor, shapeStroke, shapeSW);
            msg.style = {
                width: '200px', height: '200px', overflow: 'hidden'
            };
            if (shapeDef.clip) msg.style.clipPath = shapeDef.clip;
        } else if (t.tag === 'div' && t.variant === 'frame') {
            var frameDef = SHAPE_PATHS[t.frameName] || SHAPE_PATHS['circle'];
            msg.style = {
                width: '300px', height: '300px', overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
            };
            if (frameDef.clip) msg.style.clipPath = frameDef.clip;
            // Prompt file upload for frame media
            _promptFileUpload('image/*,video/*', function (dataUrl) {
                var isVideo = dataUrl.indexOf('data:video') === 0;
                var innerHtml = isVideo
                    ? '<video src="' + dataUrl + '" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover"></video>'
                    : '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover" />';
                _postIframe('arbel-set-html', { id: id, html: innerHtml });
                if (!_overrides[id]) _overrides[id] = {};
                _overrides[id]._frameHtml = innerHtml;
                if (_onUpdate) _onUpdate(_overrides);
            });
        } else if (t.tag === 'div' && t.variant === 'orb') {
            msg.style = {
                width: '300px', height: '300px',
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,92,231,0.4), transparent 70%)',
                filter: 'blur(60px)', pointerEvents: 'none'
            };
        } else if (t.tag === 'div' && t.variant === 'divider') {
            msg.tag = 'hr';
            msg.style = {
                border: 'none', height: '2px', width: '80px',
                background: 'rgba(255,255,255,0.2)', margin: '32px auto'
            };
        } else if (t.tag === 'div' && t.variant === 'button') {
            msg.tag = 'a';
            msg.editable = true;
            msg.text = t.text || 'Click Me';
            msg.attrs = { href: '#' };
            msg.style = {
                display: 'inline-block', padding: '14px 36px', borderRadius: '50px',
                background: 'linear-gradient(135deg, #6C5CE7, #a855f7)',
                fontSize: '1rem', fontWeight: '600', color: '#ffffff',
                cursor: 'pointer', textDecoration: 'none', textAlign: 'center'
            };
        } else if (t.tag === 'div' && t.variant === '3d-card') {
            msg.style = {
                width: '280px', height: '360px', borderRadius: '16px',
                background: 'linear-gradient(145deg, rgba(108,92,231,0.15), rgba(0,0,0,0.3))',
                border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                transformStyle: 'preserve-3d', perspective: '800px'
            };
        } else if (t.tag === 'div' && t.variant === '3d-rotate') {
            msg.style = {
                width: '200px', height: '200px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #6C5CE7, #a855f7)',
                transformStyle: 'preserve-3d', perspective: '600px'
            };
        } else if (t.tag === 'div' && t.variant === '3d-float') {
            msg.style = {
                width: '320px', height: '220px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(16px)', transformStyle: 'preserve-3d', perspective: '1000px'
            };
        } else if (t.tag === 'div' && t.variant === '3d-tilt') {
            msg.style = {
                width: '400px', height: '300px', borderRadius: '8px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.06)',
                transformStyle: 'preserve-3d', perspective: '800px'
            };
        } else if (t.tag === 'canvas' && t.variant === 'webgl') {
            msg.style = {
                width: '600px', height: '400px', borderRadius: '12px', background: '#0a0a0f'
            };
        } else if (t.tag === 'div' && t.variant === 'lottie') {
            msg.style = { width: '300px', height: '300px' };
            msg.html = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:0.85rem">Lottie placeholder</div>';
        } else if (t.tag === 'div' && t.variant === 'svg') {
            msg.html = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" stroke="#6C5CE7" stroke-width="3" fill="none"/></svg>';
            msg.style = { width: '200px', height: '200px' };
        } else if (t.tag === 'div' && t.variant === 'embed') {
            msg.html = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:0.85rem;border:1px dashed rgba(255,255,255,0.15);border-radius:12px">Embed / iFrame</div>';
            msg.style = { width: '560px', height: '315px', borderRadius: '12px', overflow: 'hidden' };
        } else if (t.tag === 'form' && t.variant === 'form') {
            msg.html = '<div style="display:flex;flex-direction:column;gap:12px;padding:32px"><input placeholder="Your name" style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:0.9rem"><input placeholder="your@email.com" style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:0.9rem"><textarea placeholder="Your message..." style="padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:0.9rem;min-height:80px;resize:vertical"></textarea><button style="padding:12px 24px;background:linear-gradient(135deg,#6C5CE7,#a855f7);color:#fff;border:none;border-radius:50px;font-weight:600;cursor:pointer">Send Message</button></div>';
            msg.style = {
                width: '400px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)'
            };
            msg.editable = false;
        } else if (t.tag === 'div' && !t.variant) {
            msg.style = {
                width: '300px', height: '200px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
            };
        }

        // Check if nav overlay is open — dual detection: message state + direct iframe check
        var _isNavOpen = _navOpenState;
        if (!_isNavOpen && _activeDevice !== 'desktop' && _iframe) {
            try {
                var _ifrDoc = _iframe.contentDocument || (_iframe.contentWindow && _iframe.contentWindow.document);
                if (_ifrDoc && _ifrDoc.body) _isNavOpen = _ifrDoc.body.classList.contains('nav-open');
            } catch (e) {}
        }
        if (_isNavOpen) msg.navOverlay = true;

        _postIframe('arbel-add-element', msg);

        // Store in overrides
        if (!_overrides[id]) _overrides[id] = {};
        _overrides[id]._added = true;
        _overrides[id]._def = { tag: msg.tag, cat: t.cat, label: t.label, variant: t.variant, shapeName: t.shapeName, frameName: t.frameName };
        if (_isNavOpen) {
            _overrides[id]._navOverlay = true;
            // Per-device: store which device this overlay element belongs to
            if (_activeDevice !== 'desktop') {
                _overrides[id]._navDevice = _activeDevice;
            }
        }
        if (msg.style) _overrides[id]._initStyle = msg.style;
        if (msg.attrs) _overrides[id]._attrs = msg.attrs;
        if (msg.text) _overrides[id].text = msg.text;
        if (msg.html) _overrides[id]._html = msg.html;
        if (_onUpdate) _onUpdate(_overrides);
    }

    function _deleteElement() {
        if (!_selectedId) return;
        _pushUndo();
        _postIframe('arbel-delete-element', { id: _selectedId });
        if (_overrides[_selectedId]) delete _overrides[_selectedId];
        _addedElements = _addedElements.filter(function (aid) { return aid !== _selectedId; });
        _selectedId = null;
        if (_onUpdate) _onUpdate(_overrides);
    }

    /* ═══════════════════════════════════════════════════
       GRANULAR HOVER CONTROLS
       ═══════════════════════════════════════════════════ */
    function _setupHoverControls() {
        if (!_container) return;
        // When switching from preset to "custom", show granular controls
        _on('.editor-hover-select', 'change', function () {
            if (!_selectedId) return;
            var val = this.value;
            var granular = _qs('#editorHoverGranular');
            if (val === 'custom') {
                if (granular) granular.style.display = '';
                _applyGranularHover();
            } else {
                if (granular) granular.style.display = 'none';
                _postIframe('arbel-set-hover', { id: _selectedId, hover: val });
                _setOvB(_selectedId, 'hover', val, 'anim');
            }
        });

        // Wire all granular inputs
        var hoverInputs = ['#hoverOpacity','#hoverScale','#hoverTranslateY','#hoverRotate','#hoverDuration'];
        var hoverColors = ['#hoverColor','#hoverBg'];
        var hoverSel = ['#hoverShadow'];

        hoverInputs.concat(hoverColors).concat(hoverSel).forEach(function (sel) {
            _on(sel, 'input', function () { _applyGranularHover(); });
            _on(sel, 'change', function () { _applyGranularHover(); });
        });
    }

    function _applyGranularHover() {
        if (!_selectedId) return;
        var props = {};
        var op = _qs('#hoverOpacity'); if (op && op.value !== '100') props.opacity = parseInt(op.value);
        var sc = _qs('#hoverScale'); if (sc && sc.value !== '1') props.scale = parseFloat(sc.value);
        var ty = _qs('#hoverTranslateY'); if (ty && ty.value !== '0') props.translateY = parseInt(ty.value);
        var ro = _qs('#hoverRotate'); if (ro && ro.value !== '0') props.rotate = parseInt(ro.value);
        var co = _qs('#hoverColor'); if (co && co.value !== '#ffffff') props.color = co.value;
        var bg = _qs('#hoverBg'); if (bg && bg.value !== '#000000') props.background = bg.value;
        var sh = _qs('#hoverShadow'); if (sh && sh.value !== 'none') props.shadow = sh.value;
        var dur = _qs('#hoverDuration'); var duration = dur ? parseFloat(dur.value) || 0.3 : 0.3;

        _postIframe('arbel-set-hover-custom', { id: _selectedId, props: props, duration: duration });
        _setOvB(_selectedId, 'hover', 'custom', 'anim');
        _setOv(_selectedId, 'hoverProps', props);
        _setOv(_selectedId, 'hoverDuration', duration);
    }

    /* ═══════════════════════════════════════════════════
       IMPORT / EXPORT JSON
       ═══════════════════════════════════════════════════ */
    function _exportJSON() {
        var data = {
            version: 1,
            overrides: _overrides,
            pages: _pages,
            videoConfig: _videoConfig,
            addedElements: _addedElements
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'arbel-project-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function _importJSON() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', function () {
            var file = input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (!data || !data.overrides) throw new Error('Invalid project file');
                    _pushUndo();
                    _overrides = data.overrides;
                    if (data.pages) _pages = data.pages;
                    if (data.videoConfig) _videoConfig = data.videoConfig;
                    if (data.addedElements) _addedElements = data.addedElements;
                    if (_onUpdate) _onUpdate(_overrides);
                } catch (err) {
                    alert('Failed to import: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    /* ═══════════════════════════════════════════════════
       SETUP NEW FEATURES
       ═══════════════════════════════════════════════════ */
    function _setupNewFeatures() {
        // Add Element button
        _on('#addElementBtn', 'click', _showAddElementDialog);
        // Delete Element button
        _on('#deleteElementBtn', 'click', _deleteElement);
        // Import / Export
        _on('#editorExport', 'click', _exportJSON);
        _on('#editorImport', 'click', _importJSON);
        // Granular hover
        _setupHoverControls();
    }

    /* ─── Public API ─── */
    return {
        init: init,
        getOverlayScript: function () { return _getOverlayScript(); },
        getOverrides: function () { return _overrides; },
        setOverrides: function (o) { _overrides = o || {}; },
        getMenuBgColor: function () { return _menuBgColor; },
        getMenuBgEnabled: function () { return _menuBgEnabled; },
        setMenuBgColor: function (c) { _menuBgColor = c || ''; },
        setMenuBgEnabled: function (v) { _menuBgEnabled = !!v; },
        getVideoConfig: function () { return { frames: _videoFrames, config: _videoConfig }; },
        setVideoConfig: function (vc) { if (vc) { _videoConfig = vc.config || _videoConfig; _videoFrames = vc.frames || _videoFrames; } },
        getPages: function () { return _pages; },
        setPages: function (p) { if (Array.isArray(p)) _pages = p; },
        getAddedElements: function () { return _addedElements; },
        setAddedElements: function (a) { if (Array.isArray(a)) _addedElements = a; },
        exportJSON: _exportJSON,
        importJSON: _importJSON,
        showAddElement: _showAddElementDialog,
        deleteElement: _deleteElement,
        destroy: function () { _active = false; _selectedId = null; window.removeEventListener('message', _handleMessage); if (_keydownHandler) { document.removeEventListener('keydown', _keydownHandler); _keydownHandler = null; } }
    };
})();
