/* ═══════════════════════════════════════════════
   EDITOR — Visual Click-to-Edit System
   
   Injects an editor overlay into the preview iframe,
   enabling Wix-like click-to-edit, per-element
   animations, hover effects, and background effects.
   ═══════════════════════════════════════════════ */

window.ArbelEditor = (function () {
    'use strict';

    var _iframe = null;
    var _panel = null;
    var _active = false;
    var _selectedId = null;
    var _overrides = {};
    var _onUpdate = null;

    /* ─── Overlay script injected into the iframe ─── */
    function _getOverlayScript() {
        return [
            '(function(){',
            'var selected=null,editing=false;',

            /* Overlay styles */
            'var s=document.createElement("style");',
            's.textContent="' +
                '[data-arbel-id]{cursor:pointer;transition:outline .15s,outline-offset .15s}' +
                '[data-arbel-id]:hover:not(.arbel-sel){outline:2px dashed rgba(100,108,255,.5);outline-offset:2px}' +
                '.arbel-sel{outline:2px solid #646cff!important;outline-offset:3px!important}' +
                '.arbel-editing{outline-color:#0bda51!important;min-height:1em}' +
                '.arbel-lbl{position:fixed;top:8px;left:8px;z-index:99999;background:#646cff;color:#fff;' +
                'font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;' +
                'opacity:0;transition:opacity .2s}.arbel-lbl.vis{opacity:1}' +
                '.arbel-fx-cv{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0}' +
            '";document.head.appendChild(s);',

            /* Label element */
            'var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);',

            /* Click handler */
            'document.addEventListener("click",function(e){',
            '  if(editing)return;',
            '  var el=e.target.closest("[data-arbel-id]");',
            '  if(!el){desel();return}',
            '  e.preventDefault();e.stopPropagation();sel(el);',
            '},true);',

            /* Double-click for text editing */
            'document.addEventListener("dblclick",function(e){',
            '  var el=e.target.closest("[data-arbel-edit=\\"text\\"]");',
            '  if(!el)return;e.preventDefault();startEdit(el);',
            '},true);',

            /* Hover label */
            'document.addEventListener("mouseover",function(e){',
            '  var el=e.target.closest("[data-arbel-id]");',
            '  if(el&&el!==selected){lbl.textContent=el.getAttribute("data-arbel-id");lbl.classList.add("vis")}',
            '});',
            'document.addEventListener("mouseout",function(){lbl.classList.remove("vis")});',

            /* Select / deselect */
            'function sel(el){',
            '  desel();selected=el;el.classList.add("arbel-sel");',
            '  var r=el.getBoundingClientRect();',
            '  window.parent.postMessage({type:"arbel-select",id:el.getAttribute("data-arbel-id"),',
            '    tag:el.tagName.toLowerCase(),',
            '    text:el.getAttribute("data-arbel-edit")==="text"?el.textContent:null,',
            '    editable:el.hasAttribute("data-arbel-edit"),',
            '    rect:{top:r.top,left:r.left,width:r.width,height:r.height},',
            '    currentAnimation:el.getAttribute("data-arbel-anim")||"none",',
            '    currentHover:el.getAttribute("data-arbel-hover")||"none",',
            '    currentEffect:el.getAttribute("data-arbel-effect")||"none"',
            '  },"*");',
            '}',

            'function desel(){',
            '  if(editing)stopEdit();',
            '  if(selected){selected.classList.remove("arbel-sel");selected=null}',
            '  window.parent.postMessage({type:"arbel-deselect"},"*");',
            '}',

            /* Inline text editing */
            'function startEdit(el){',
            '  if(editing)stopEdit();sel(el);editing=true;',
            '  el.classList.add("arbel-editing");el.contentEditable=true;el.focus();',
            '  var rng=document.createRange();rng.selectNodeContents(el);',
            '  var s=window.getSelection();s.removeAllRanges();s.addRange(rng);',
            '  el.addEventListener("blur",function onB(){el.removeEventListener("blur",onB);stopEdit()});',
            '  el.addEventListener("keydown",function onK(e){',
            '    if(e.key==="Escape"||e.key==="Enter"){e.preventDefault();el.removeEventListener("keydown",onK);el.blur()}',
            '  });',
            '}',

            'function stopEdit(){',
            '  if(!selected)return;editing=false;',
            '  selected.classList.remove("arbel-editing");selected.contentEditable=false;',
            '  window.parent.postMessage({type:"arbel-text-update",id:selected.getAttribute("data-arbel-id"),text:selected.textContent},"*");',
            '}',

            /* Messages from parent */
            'window.addEventListener("message",function(e){',
            '  var d=e.data;if(!d||!d.type)return;',

            '  if(d.type==="arbel-set-text"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");if(el)el.textContent=d.text;',
            '  }',

            '  if(d.type==="arbel-set-animation"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");',
            '    if(el){el.setAttribute("data-arbel-anim",d.animation);prevAnim(el,d.animation)}',
            '  }',

            '  if(d.type==="arbel-set-hover"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");',
            '    if(el){el.setAttribute("data-arbel-hover",d.hover);applyHover(el,d.hover)}',
            '  }',

            '  if(d.type==="arbel-set-effect"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");',
            '    if(el){el.setAttribute("data-arbel-effect",d.effect);applyFx(el,d.effect)}',
            '  }',

            '  if(d.type==="arbel-preview-animation"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");',
            '    if(el)prevAnim(el,d.animation);',
            '  }',

            '  if(d.type==="arbel-select-by-id"){',
            '    var el=document.querySelector("[data-arbel-id=\\""+d.id+"\\"]");',
            '    if(el){el.scrollIntoView({behavior:"smooth",block:"center"});sel(el)}',
            '  }',
            '});',

            /* Animation preview */
            'var ANIMS={',
            '  fadeIn:{from:"opacity:0",to:"opacity:1"},',
            '  slideUp:{from:"opacity:0;transform:translateY(40px)",to:"opacity:1;transform:translateY(0)"},',
            '  slideDown:{from:"opacity:0;transform:translateY(-40px)",to:"opacity:1;transform:translateY(0)"},',
            '  slideLeft:{from:"opacity:0;transform:translateX(40px)",to:"opacity:1;transform:translateX(0)"},',
            '  slideRight:{from:"opacity:0;transform:translateX(-40px)",to:"opacity:1;transform:translateX(0)"},',
            '  scaleUp:{from:"opacity:0;transform:scale(0.8)",to:"opacity:1;transform:scale(1)"},',
            '  rotateIn:{from:"opacity:0;transform:rotate(-10deg)",to:"opacity:1;transform:rotate(0)"},',
            '  bounceIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},',
            '  flipIn:{from:"opacity:0;transform:perspective(400px) rotateY(90deg)",to:"opacity:1;transform:perspective(400px) rotateY(0)"},',
            '  blurIn:{from:"opacity:0;filter:blur(10px)",to:"opacity:1;filter:blur(0)"}',
            '};',

            'function prevAnim(el,name){',
            '  var a=ANIMS[name];if(!a){el.style.opacity="";el.style.transform="";el.style.filter="";return}',
            '  el.style.transition="none";',
            '  a.from.split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});',
            '  void el.offsetWidth;',
            '  el.style.transition="all .8s cubic-bezier(.16,1,.3,1)";',
            '  a.to.split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});',
            '}',

            /* Hover application */
            'var HOVERS={lift:"transform:translateY(-5px);box-shadow:0 10px 30px rgba(0,0,0,.2)",',
            '  scale:"transform:scale(1.05)",glow:"box-shadow:0 0 20px #646cff",tilt:"transform:rotate(-2deg)"};',

            'function applyHover(el,name){',
            '  el.onmouseenter=null;el.onmouseleave=null;',
            '  if(name==="none"||!HOVERS[name])return;',
            '  el.style.transition="all .3s ease";',
            '  el.onmouseenter=function(){',
            '    el._ph=el.style.cssText;',
            '    HOVERS[name].split(";").forEach(function(p){var kv=p.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});',
            '  };',
            '  el.onmouseleave=function(){if(el._ph!==undefined)el.style.cssText=el._ph};',
            '}',

            /* Background effects */
            'var fxMap={};',
            'function applyFx(el,name){',
            '  var id=el.getAttribute("data-arbel-id"),old=fxMap[id];',
            '  if(old){cancelAnimationFrame(old.raf);if(old.cv.parentNode)old.cv.parentNode.removeChild(old.cv);delete fxMap[id]}',
            '  if(name==="none")return;',
            '  var pos=getComputedStyle(el).position;if(pos==="static")el.style.position="relative";',
            '  var cv=document.createElement("canvas");cv.className="arbel-fx-cv";el.insertBefore(cv,el.firstChild);',
            '  var ctx=cv.getContext("2d");',
            '  function rsz(){cv.width=el.offsetWidth;cv.height=el.offsetHeight}rsz();',
            '  var ps=[];',
            '  for(var i=0;i<(name==="fireflies"?20:30);i++){ps.push({',
            '    x:Math.random()*cv.width,y:Math.random()*cv.height,',
            '    vx:(Math.random()-.5)*.5,',
            '    vy:name==="bubbles"?-(Math.random()+.3):name==="snow"?(Math.random()*.5+.2):(Math.random()-.5)*.5,',
            '    sz:Math.random()*3+1,a:Math.random()*.5+.2,p:Math.random()*6.28',
            '  })}',
            '  var raf;',
            '  function draw(){',
            '    ctx.clearRect(0,0,cv.width,cv.height);var t=Date.now()*.001;',
            '    if(name==="gradient"){',
            '      var g=ctx.createLinearGradient(cv.width*(.5+.5*Math.sin(t*.5)),0,cv.width*(.5+.5*Math.cos(t*.3)),cv.height);',
            '      g.addColorStop(0,"rgba(100,108,255,.1)");g.addColorStop(.5,"rgba(100,108,255,.05)");g.addColorStop(1,"rgba(100,108,255,.1)");',
            '      ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);raf=requestAnimationFrame(draw);return',
            '    }',
            '    if(name==="waves"){',
            '      ctx.strokeStyle="rgba(100,108,255,.15)";ctx.lineWidth=1;',
            '      for(var w=0;w<3;w++){ctx.beginPath();for(var x=0;x<=cv.width;x+=5){',
            '        var y=cv.height*.5+Math.sin(x*.01+t+w)*20*(w+1);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);',
            '      }ctx.stroke()}raf=requestAnimationFrame(draw);return',
            '    }',
            '    ps.forEach(function(p){',
            '      p.x+=p.vx;p.y+=p.vy;p.p+=.02;',
            '      if(p.x<-5)p.x=cv.width+5;if(p.x>cv.width+5)p.x=-5;',
            '      if(p.y<-5)p.y=cv.height+5;if(p.y>cv.height+5)p.y=-5;',
            '      var al=p.a;if(name==="stars"||name==="fireflies")al=p.a*(.5+.5*Math.sin(p.p));',
            '      ctx.beginPath();',
            '      if(name==="fireflies"){ctx.shadowBlur=10;ctx.shadowColor="rgba(100,255,100,"+al+")";ctx.fillStyle="rgba(100,255,100,"+al+")"}',
            '      else if(name==="snow"){ctx.fillStyle="rgba(255,255,255,"+al+")";p.x+=Math.sin(p.p)*.5}',
            '      else{ctx.fillStyle="rgba(100,108,255,"+al+")"}',
            '      ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0;',
            '    });raf=requestAnimationFrame(draw)',
            '  }draw();',
            '  fxMap[id]={cv:cv,raf:raf};window.addEventListener("resize",rsz);',
            '}',

            /* Send element tree on load */
            'var tree=[];',
            'document.querySelectorAll("[data-arbel-id]").forEach(function(el){',
            '  tree.push({id:el.getAttribute("data-arbel-id"),tag:el.tagName.toLowerCase(),',
            '    editable:el.hasAttribute("data-arbel-edit"),',
            '    text:el.getAttribute("data-arbel-edit")==="text"?el.textContent.substring(0,50):null});',
            '});',
            'window.parent.postMessage({type:"arbel-tree",tree:tree},"*");',

            '})();'
        ].join('\n');
    }

    /* ─── Initialize editor ─── */
    function init(iframe, panelEl, onUpdateCb) {
        _iframe = iframe;
        _panel = panelEl;
        _onUpdate = onUpdateCb;
        _active = true;
        _setupPanelListeners();
        window.addEventListener('message', _handleMessage);
    }

    /* ─── Message handler ─── */
    function _handleMessage(e) {
        var d = e.data;
        if (!d || !d.type || !_active) return;

        if (d.type === 'arbel-tree') {
            _renderElementTree(d.tree);
        }
        if (d.type === 'arbel-select') {
            _selectedId = d.id;
            _showPanel(d);
        }
        if (d.type === 'arbel-deselect') {
            _selectedId = null;
            _hidePanel();
        }
        if (d.type === 'arbel-text-update') {
            if (!_overrides[d.id]) _overrides[d.id] = {};
            _overrides[d.id].text = d.text;
            if (_onUpdate) _onUpdate(_overrides);
            // Update text input if panel is showing this element
            var ti = _panel ? _panel.querySelector('.editor-text-input') : null;
            if (ti && _selectedId === d.id) ti.value = d.text;
        }
    }

    /* ─── Show / hide properties panel ─── */
    function _showPanel(info) {
        if (!_panel) return;
        _panel.classList.add('editor-panel--active');

        var idLabel = _panel.querySelector('.editor-el-id');
        var tagLabel = _panel.querySelector('.editor-el-tag');
        var textGroup = _panel.querySelector('.editor-text-group');
        var textInput = _panel.querySelector('.editor-text-input');
        var animSelect = _panel.querySelector('.editor-anim-select');
        var hoverSelect = _panel.querySelector('.editor-hover-select');
        var effectSelect = _panel.querySelector('.editor-effect-select');

        if (idLabel) idLabel.textContent = info.id;
        if (tagLabel) tagLabel.textContent = '<' + info.tag + '>';

        if (textGroup) {
            textGroup.style.display = info.editable ? '' : 'none';
            if (textInput && info.text !== null) textInput.value = info.text;
        }

        if (animSelect) animSelect.value = info.currentAnimation || 'none';
        if (hoverSelect) hoverSelect.value = info.currentHover || 'none';
        if (effectSelect) effectSelect.value = info.currentEffect || 'none';

        // Highlight tree item
        if (_panel) {
            var items = _panel.querySelectorAll('.editor-tree-item');
            items.forEach(function (it) {
                it.classList.toggle('active', it.getAttribute('data-tree-id') === info.id);
            });
        }
    }

    function _hidePanel() {
        if (!_panel) return;
        var idLabel = _panel.querySelector('.editor-el-id');
        if (idLabel) idLabel.textContent = 'Click an element';
    }

    /* ─── Panel event listeners ─── */
    function _setupPanelListeners() {
        if (!_panel) return;

        var textInput = _panel.querySelector('.editor-text-input');
        if (textInput) {
            textInput.addEventListener('input', function () {
                if (!_selectedId || !_iframe) return;
                _iframe.contentWindow.postMessage({
                    type: 'arbel-set-text', id: _selectedId, text: textInput.value
                }, '*');
                if (!_overrides[_selectedId]) _overrides[_selectedId] = {};
                _overrides[_selectedId].text = textInput.value;
                if (_onUpdate) _onUpdate(_overrides);
            });
        }

        var animSelect = _panel.querySelector('.editor-anim-select');
        if (animSelect) {
            animSelect.addEventListener('change', function () {
                if (!_selectedId || !_iframe) return;
                _iframe.contentWindow.postMessage({
                    type: 'arbel-set-animation', id: _selectedId, animation: animSelect.value
                }, '*');
                if (!_overrides[_selectedId]) _overrides[_selectedId] = {};
                _overrides[_selectedId].animation = animSelect.value;
                if (_onUpdate) _onUpdate(_overrides);
            });
        }

        var previewBtn = _panel.querySelector('.editor-preview-anim');
        if (previewBtn) {
            previewBtn.addEventListener('click', function () {
                if (!_selectedId || !_iframe) return;
                var anim = animSelect ? animSelect.value : 'none';
                _iframe.contentWindow.postMessage({
                    type: 'arbel-preview-animation', id: _selectedId, animation: anim
                }, '*');
            });
        }

        var hoverSelect = _panel.querySelector('.editor-hover-select');
        if (hoverSelect) {
            hoverSelect.addEventListener('change', function () {
                if (!_selectedId || !_iframe) return;
                _iframe.contentWindow.postMessage({
                    type: 'arbel-set-hover', id: _selectedId, hover: hoverSelect.value
                }, '*');
                if (!_overrides[_selectedId]) _overrides[_selectedId] = {};
                _overrides[_selectedId].hover = hoverSelect.value;
                if (_onUpdate) _onUpdate(_overrides);
            });
        }

        var effectSelect = _panel.querySelector('.editor-effect-select');
        if (effectSelect) {
            effectSelect.addEventListener('change', function () {
                if (!_selectedId || !_iframe) return;
                _iframe.contentWindow.postMessage({
                    type: 'arbel-set-effect', id: _selectedId, effect: effectSelect.value
                }, '*');
                if (!_overrides[_selectedId]) _overrides[_selectedId] = {};
                _overrides[_selectedId].effect = effectSelect.value;
                if (_onUpdate) _onUpdate(_overrides);
            });
        }
    }

    /* ─── Element tree ─── */
    function _renderElementTree(tree) {
        var treeEl = _panel ? _panel.querySelector('.editor-tree') : null;
        if (!treeEl) return;
        treeEl.innerHTML = '';
        tree.forEach(function (item) {
            var div = document.createElement('div');
            div.className = 'editor-tree-item';
            div.setAttribute('data-tree-id', item.id);
            var preview = item.text ? ' <span class="tree-text">' + item.text + '</span>' : '';
            div.innerHTML = '<span class="tree-tag">&lt;' + item.tag + '&gt;</span>' +
                '<span class="tree-id">' + item.id + '</span>' + preview;
            div.addEventListener('click', function () {
                if (!_iframe) return;
                _iframe.contentWindow.postMessage({ type: 'arbel-select-by-id', id: item.id }, '*');
            });
            treeEl.appendChild(div);
        });
    }

    /* ─── Public API ─── */
    function getOverlayScript() { return _getOverlayScript(); }
    function getOverrides() { return _overrides; }
    function setOverrides(o) { _overrides = o || {}; }

    function destroy() {
        _active = false;
        _selectedId = null;
        window.removeEventListener('message', _handleMessage);
    }

    return {
        init: init,
        getOverlayScript: getOverlayScript,
        getOverrides: getOverrides,
        setOverrides: setOverrides,
        destroy: destroy
    };
})();
