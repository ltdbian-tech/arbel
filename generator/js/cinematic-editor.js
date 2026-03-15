/* ═══════════════════════════════════════════════
   CINEMATIC EDITOR — Scene-Based Visual Builder

   Scenes panel, free-form positioning, scroll
   animation, timeline, properties — all in one
   clean, progressive-disclosure UI.
   ═══════════════════════════════════════════════ */

window.ArbelCinematicEditor = (function () {
    'use strict';

    /* ─── Private State ─── */
    var _iframe = null;
    var _container = null;
    var _active = false;
    var _onUpdate = null;
    var _scenes = [];
    var _currentSceneIdx = 0;
    var _selectedElementId = null;
    var _overrides = {};
    var _zoom = 100;
    var _dragState = null;
    var _timelineOpen = false;
    var _uiBound = false;          // guard against duplicate listener binding

    /* ─── DOM Shorthand ─── */
    function _qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function _qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

    /* ─── Initialize ─── */
    function init(iframe, containerEl, onUpdateCb) {
        _iframe = iframe;
        _container = containerEl;
        _onUpdate = onUpdateCb;
        _active = true;

        // Start with one hero scene
        if (_scenes.length === 0) {
            _scenes.push(ArbelCinematicCompiler.createScene('hero', 0));
        }

        _setupUI();
        _renderSceneList();
        _selectScene(0);

        window.addEventListener('message', _handleMessage);
    }

    /* ─── Message handler from iframe ─── */
    function _handleMessage(e) {
        if (!_active) return;
        var d;
        try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
        if (!d || !d.type) return;

        if (d.type === 'arbel-select') {
            _selectedElementId = d.id || null;
            _updatePropertiesPanel(d);
        }
        if (d.type === 'arbel-text-update' && d.id) {
            _applyOverride(d.id, { text: d.text });
        }
        if (d.type === 'arbel-tree') {
            // element tree from iframe overlay — not used in cinematic (we have scene-based tree)
        }
    }

    /* ─── Setup the cinematic editor UI ─── */
    function _setupUI() {
        if (!_container) return;
        if (_uiBound) return;   // prevent duplicate listener binding
        _uiBound = true;

        // Scene list panel (left sidebar)
        _setupScenePanel();

        // Properties panel tabs (right sidebar)
        _setupPropertiesTabs();

        // Scene settings (pin, duration, bg)
        _setupSceneSettings();

        // Timeline toggle (bottom bar)
        _setupTimeline();

        // Toolbar actions
        _setupToolbar();

        // Device toggle
        _setupDeviceToggle();

        // Zoom
        _setupZoom();
    }

    /* ─── Scene Panel (Left) ─── */
    function _setupScenePanel() {
        var panel = _qs('#cneSceneList');
        if (!panel) return;

        // Add scene button
        var addBtn = _qs('#cneAddScene');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                _showAddSceneDialog();
            });
        }
    }

    function _renderSceneList() {
        var list = _qs('#cneSceneList');
        if (!list) return;

        list.innerHTML = '';
        _scenes.forEach(function (scene, i) {
            var item = document.createElement('div');
            item.className = 'cne-scene-item' + (i === _currentSceneIdx ? ' active' : '');
            item.dataset.idx = i;

            var thumb = document.createElement('div');
            thumb.className = 'cne-scene-thumb';
            thumb.textContent = (i + 1);

            var info = document.createElement('div');
            info.className = 'cne-scene-info';

            var name = document.createElement('span');
            name.className = 'cne-scene-name';
            name.textContent = scene.name;

            var meta = document.createElement('span');
            meta.className = 'cne-scene-meta mono';
            meta.textContent = scene.elements.length + ' elements';

            info.appendChild(name);
            info.appendChild(meta);
            item.appendChild(thumb);
            item.appendChild(info);

            // Actions
            var actions = document.createElement('div');
            actions.className = 'cne-scene-actions';

            // Duplicate
            var dupBtn = document.createElement('button');
            dupBtn.className = 'cne-scene-action-btn';
            dupBtn.title = 'Duplicate';
            dupBtn.innerHTML = '&#9851;';
            dupBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _duplicateScene(i);
            });

            // Delete (not first scene)
            var delBtn = document.createElement('button');
            delBtn.className = 'cne-scene-action-btn cne-scene-action-del';
            delBtn.title = 'Delete';
            delBtn.innerHTML = '&times;';
            delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _deleteScene(i);
            });

            actions.appendChild(dupBtn);
            if (_scenes.length > 1) actions.appendChild(delBtn);

            item.appendChild(actions);

            // Click to select
            item.addEventListener('click', function () {
                _selectScene(i);
            });

            list.appendChild(item);
        });
    }

    function _selectScene(idx, rerender) {
        if (idx < 0 || idx >= _scenes.length) return;
        _currentSceneIdx = idx;
        _selectedElementId = null;
        _renderSceneList();
        _renderElementList();
        _clearProperties();
        _updateTimeline();
        _notifyUpdate(!!rerender);
    }

    function _showAddSceneDialog() {
        var templates = ArbelCinematicCompiler.getSceneTemplates();

        // Build dialog
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog cne-add-scene-dialog';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.textContent = 'Add Scene';

        var grid = document.createElement('div');
        grid.className = 'cne-template-grid';

        var selectedTpl = 'blank';

        templates.forEach(function (tpl) {
            var card = document.createElement('div');
            card.className = 'cne-template-card' + (tpl.id === selectedTpl ? ' selected' : '');
            card.dataset.tpl = tpl.id;

            var label = document.createElement('div');
            label.className = 'cne-template-label';
            label.textContent = tpl.label;

            var desc = document.createElement('div');
            desc.className = 'cne-template-desc';
            desc.textContent = tpl.desc;

            card.appendChild(label);
            card.appendChild(desc);

            card.addEventListener('click', function () {
                selectedTpl = tpl.id;
                _qsa('.cne-template-card', grid).forEach(function (c) {
                    c.classList.toggle('selected', c.dataset.tpl === selectedTpl);
                });
            });

            grid.appendChild(card);
        });

        // Name input
        var nameRow = document.createElement('div');
        nameRow.className = 'arbel-dialog-field';
        var nameLabel = document.createElement('label');
        nameLabel.className = 'arbel-dialog-label mono';
        nameLabel.textContent = 'SCENE NAME';
        var nameInput = document.createElement('input');
        nameInput.className = 'gen-input';
        nameInput.placeholder = 'Scene ' + (_scenes.length + 1);
        nameRow.appendChild(nameLabel);
        nameRow.appendChild(nameInput);

        // Buttons
        var btns = document.createElement('div');
        btns.className = 'arbel-dialog-btns';

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'gen-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        var addBtn = document.createElement('button');
        addBtn.className = 'gen-btn gen-btn--primary';
        addBtn.textContent = 'Add Scene';
        addBtn.addEventListener('click', function () {
            var scene = ArbelCinematicCompiler.createScene(selectedTpl, _scenes.length);
            if (nameInput.value.trim()) scene.name = nameInput.value.trim();
            _scenes.push(scene);
            _selectScene(_scenes.length - 1, true);
            document.body.removeChild(overlay);
        });

        btns.appendChild(cancelBtn);
        btns.appendChild(addBtn);

        dialog.appendChild(title);
        dialog.appendChild(grid);
        dialog.appendChild(nameRow);
        dialog.appendChild(btns);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    function _duplicateScene(idx) {
        var src = _scenes[idx];
        var dupe = JSON.parse(JSON.stringify(src));
        dupe.id = 'scene-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        dupe.name = src.name + ' Copy';
        dupe.elements.forEach(function (el) {
            el.id = el.id.split('-').slice(0, -1).join('-') + '-' + dupe.id.substr(-4);
        });
        _scenes.splice(idx + 1, 0, dupe);
        _selectScene(idx + 1, true);
    }

    function _deleteScene(idx) {
        if (_scenes.length <= 1) return;
        _scenes.splice(idx, 1);
        if (_currentSceneIdx >= _scenes.length) _currentSceneIdx = _scenes.length - 1;
        _selectScene(_currentSceneIdx, true);
    }

    /* ─── Element List (inside scene panel) ─── */
    function _renderElementList() {
        var list = _qs('#cneElementList');
        if (!list) return;

        var scene = _scenes[_currentSceneIdx];
        if (!scene) { list.innerHTML = ''; return; }

        list.innerHTML = '';
        scene.elements.forEach(function (el, i) {
            var row = document.createElement('div');
            row.className = 'cne-el-item' + (el.id === _selectedElementId ? ' active' : '');

            var tagBadge = document.createElement('span');
            tagBadge.className = 'cne-el-tag mono';
            tagBadge.textContent = el.tag;

            var nameSpan = document.createElement('span');
            nameSpan.className = 'cne-el-name';
            nameSpan.textContent = el.text ? el.text.substr(0, 30) : el.id;

            var vis = document.createElement('button');
            vis.className = 'cne-el-vis' + (el.visible === false ? ' hidden-el' : '');
            vis.innerHTML = el.visible === false ? '&#128065;&#824;' : '&#128065;';
            vis.addEventListener('click', function (e) {
                e.stopPropagation();
                el.visible = !el.visible;
                _renderElementList();
                _notifyUpdate(true);
            });

            row.appendChild(tagBadge);
            row.appendChild(nameSpan);
            row.appendChild(vis);

            row.addEventListener('click', function () {
                _selectedElementId = el.id;
                _renderElementList();
                _updatePropertiesFromScene(el);
                _postIframe('arbel-select-by-id', { id: el.id });
            });

            list.appendChild(row);
        });

        // Add element button
        var addRow = document.createElement('button');
        addRow.className = 'cne-el-add';
        addRow.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Add Element';
        addRow.addEventListener('click', function () {
            _showAddElementDialog();
        });
        list.appendChild(addRow);
    }

    function _showAddElementDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.textContent = 'Add Element';

        var types = [
            { tag: 'h1', label: 'Heading 1', text: 'Heading' },
            { tag: 'h2', label: 'Heading 2', text: 'Subheading' },
            { tag: 'h3', label: 'Heading 3', text: 'Section Title' },
            { tag: 'p', label: 'Paragraph', text: 'Your text here' },
            { tag: 'span', label: 'Label / Tag', text: 'LABEL' },
            { tag: 'div', label: 'Box / Container', text: '' },
            { tag: 'div', label: 'Glass Card', text: '', variant: 'glass' },
            { tag: 'div', label: 'Gradient Orb', text: '', variant: 'orb' },
            { tag: 'div', label: 'Divider Line', text: '', variant: 'divider' },
            { tag: 'div', label: 'Button', text: 'Click Me', variant: 'button' },
            { tag: 'img', label: 'Image Placeholder', text: '' }
        ];

        var list = document.createElement('div');
        list.className = 'cne-el-type-list';

        types.forEach(function (t) {
            var btn = document.createElement('button');
            btn.className = 'cne-el-type-btn';
            btn.innerHTML = '<span class="mono">&lt;' + t.tag + '&gt;</span> ' + t.label;
            btn.addEventListener('click', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;

                var fontSize = t.tag === 'h1' ? '5vw' : t.tag === 'h2' ? '3vw' : t.tag === 'h3' ? '2vw' : t.tag === 'span' ? '0.75rem' : '1.1rem';
                var fontWeight = (t.tag === 'h1' || t.tag === 'h2' || t.tag === 'h3') ? '700' : '400';

                var newEl = {
                    id: t.tag + '-' + Date.now().toString(36),
                    tag: t.tag,
                    text: t.text,
                    style: {
                        fontSize: fontSize,
                        fontWeight: fontWeight,
                        color: '#ffffff',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%,-50%)'
                    },
                    scroll: null,
                    splitText: false,
                    parallax: 1,
                    visible: true,
                    locked: false
                };

                if (t.tag === 'span') {
                    newEl.style.letterSpacing = '0.2em';
                    newEl.style.textTransform = 'uppercase';
                    newEl.style.color = 'rgba(255,255,255,0.4)';
                }

                if (t.tag === 'div' && t.variant === 'glass') {
                    newEl.style = {
                        position: 'absolute', top: '20%', left: '20%', width: '300px', height: '200px',
                        borderRadius: '16px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)'
                    };
                } else if (t.tag === 'div' && t.variant === 'orb') {
                    newEl.style = {
                        position: 'absolute', top: '25%', left: '30%', width: '300px', height: '300px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,92,231,0.4), transparent 70%)',
                        filter: 'blur(60px)'
                    };
                } else if (t.tag === 'div' && t.variant === 'divider') {
                    newEl.style = {
                        position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)',
                        width: '80px', height: '2px', background: 'rgba(255,255,255,0.2)'
                    };
                } else if (t.tag === 'div' && t.variant === 'button') {
                    newEl.style = {
                        position: 'absolute', top: '60%', left: '50%', transform: 'translateX(-50%)',
                        padding: '14px 36px', borderRadius: '50px',
                        background: 'linear-gradient(135deg, #6C5CE7, #a855f7)',
                        fontSize: '1rem', fontWeight: '600', color: '#ffffff',
                        cursor: 'pointer', textAlign: 'center'
                    };
                } else if (t.tag === 'div') {
                    newEl.style = {
                        position: 'absolute',
                        top: '20%',
                        left: '20%',
                        width: '300px',
                        height: '200px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    };
                }

                scene.elements.push(newEl);
                _selectedElementId = newEl.id;
                _renderElementList();
                _updatePropertiesFromScene(newEl);
                _notifyUpdate(true);
                document.body.removeChild(overlay);
            });
            list.appendChild(btn);
        });

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'gen-btn';
        cancelBtn.style.marginTop = '12px';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        dialog.appendChild(title);
        dialog.appendChild(list);
        dialog.appendChild(cancelBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    /* ─── Properties Panel (Right Sidebar) ─── */
    function _setupPropertiesTabs() {
        var tabs = _qsa('.cne-prop-tab');
        var panels = _qsa('.cne-prop-panel');

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                var target = tab.dataset.tab;
                tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === target); });
                panels.forEach(function (p) { p.classList.toggle('active', p.dataset.panel === target); });
            });
        });

        // Style tab inputs
        _setupStyleInputs();
        // Scroll tab inputs
        _setupScrollInputs();
    }

    function _setupStyleInputs() {
        // Text content
        var textInput = _qs('#cneTextInput');
        if (textInput) {
            textInput.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    el.text = textInput.value;
                    _applyOverride(el.id, { text: el.text });
                    _renderElementList();
                    _postIframe('arbel-update-text', { id: el.id, text: el.text });
                    _notifyUpdate();
                }
            });
        }

        // Font size
        var fontSize = _qs('#cneFontSize');
        if (fontSize) {
            fontSize.addEventListener('input', function () {
                _setElStyle('fontSize', fontSize.value ? fontSize.value + 'px' : '');
            });
        }

        // Font weight
        var fontWeight = _qs('#cneFontWeight');
        if (fontWeight) {
            fontWeight.addEventListener('change', function () {
                _setElStyle('fontWeight', fontWeight.value);
            });
        }

        // Color
        var color = _qs('#cneColor');
        if (color) {
            color.addEventListener('input', function () {
                _setElStyle('color', color.value);
            });
        }

        // Background
        var bgColor = _qs('#cneBgColor');
        if (bgColor) {
            bgColor.addEventListener('input', function () {
                _setElStyle('background', bgColor.value);
            });
        }

        // Opacity
        var opacity = _qs('#cneOpacity');
        if (opacity) {
            opacity.addEventListener('input', function () {
                var val = _qs('#cneOpacityVal');
                if (val) val.textContent = opacity.value + '%';
                _setElStyle('opacity', parseInt(opacity.value) / 100);
            });
        }

        // Border radius
        var radius = _qs('#cneRadius');
        if (radius) {
            radius.addEventListener('input', function () {
                var val = _qs('#cneRadiusVal');
                if (val) val.textContent = radius.value + 'px';
                _setElStyle('borderRadius', radius.value + 'px');
            });
        }

        // Position inputs (top, left, width, height)
        ['Top', 'Left', 'Width', 'Height'].forEach(function (prop) {
            var input = _qs('#cnePos' + prop);
            if (input) {
                input.addEventListener('input', function () {
                    var cssProp = prop.toLowerCase();
                    var val = input.value;
                    // If numeric, add px; if already has unit, use as-is
                    if (val && /^\d+(\.\d+)?$/.test(val)) val += 'px';
                    _setElStyle(cssProp, val);
                });
            }
        });
    }

    function _setupScrollInputs() {
        // Animation preset dropdown
        var presetSelect = _qs('#cneAnimPreset');
        if (presetSelect) {
            presetSelect.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el) return;
                var presetId = presetSelect.value;
                if (presetId === 'none' || presetId === '') {
                    el.scroll = null;
                } else {
                    var preset = ArbelCinematicCompiler.getPreset(presetId);
                    if (preset) {
                        el.scroll = preset;
                    }
                }
                _updateScrollPanel();
                _notifyUpdate(true);
            });
        }

        // Scroll animation enable toggle
        var scrollToggle = _qs('#cneScrollEnable');
        if (scrollToggle) {
            scrollToggle.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el) return;
                if (scrollToggle.checked) {
                    el.scroll = el.scroll || { opacity: [0, 1], y: [40, 0], start: 0, end: 0.5 };
                } else {
                    el.scroll = null;
                }
                _updateScrollPanel();
                _notifyUpdate(true);
            });
        }

        // Scroll range (start/end)
        var startInput = _qs('#cneScrollStart');
        var endInput = _qs('#cneScrollEnd');
        if (startInput) {
            startInput.addEventListener('input', function () {
                _setScrollProp('start', parseFloat(startInput.value) / 100);
            });
        }
        if (endInput) {
            endInput.addEventListener('input', function () {
                _setScrollProp('end', parseFloat(endInput.value) / 100);
            });
        }

        // Scroll property rows (opacity, y, x, scale, rotation, blur)
        ['opacity', 'y', 'x', 'scale', 'rotation', 'blur'].forEach(function (prop) {
            var fromInput = _qs('#cneScroll_' + prop + '_from');
            var toInput = _qs('#cneScroll_' + prop + '_to');
            if (fromInput) {
                fromInput.addEventListener('input', function () {
                    _setScrollValues(prop, fromInput, toInput);
                });
            }
            if (toInput) {
                toInput.addEventListener('input', function () {
                    _setScrollValues(prop, fromInput, toInput);
                });
            }
        });

        // Split text toggle
        var splitToggle = _qs('#cneSplitText');
        if (splitToggle) {
            splitToggle.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (el) {
                    el.splitText = splitToggle.checked;
                    _notifyUpdate(true);
                }
            });
        }

        // Parallax depth
        var parallax = _qs('#cneParallax');
        if (parallax) {
            parallax.addEventListener('input', function () {
                var el = _getSelectedElement();
                var val = _qs('#cneParallaxVal');
                if (val) val.textContent = parallax.value + 'x';
                if (el) {
                    el.parallax = parseFloat(parallax.value);
                    _notifyUpdate(true);
                }
            });
        }
    }

    function _setScrollValues(prop, fromInput, toInput) {
        var el = _getSelectedElement();
        if (!el || !el.scroll) return;
        var from = fromInput ? parseFloat(fromInput.value) : 0;
        var to = toInput ? parseFloat(toInput.value) : 0;
        if (isNaN(from)) from = 0;
        if (isNaN(to)) to = 0;
        el.scroll[prop] = [from, to];
        _notifyUpdate(true);
    }

    function _setScrollProp(prop, val) {
        var el = _getSelectedElement();
        if (!el || !el.scroll) return;
        el.scroll[prop] = val;
        _notifyUpdate(true);
    }

    /* ─── Timeline (Bottom, Collapsible) ─── */
    function _setupTimeline() {
        var toggle = _qs('#cneTimelineToggle');
        var panel = _qs('#cneTimeline');
        if (toggle && panel) {
            toggle.addEventListener('click', function () {
                _timelineOpen = !_timelineOpen;
                panel.classList.toggle('open', _timelineOpen);
                toggle.classList.toggle('active', _timelineOpen);
            });
        }
    }

    function _updateTimeline() {
        var canvas = _qs('#cneTimelineCanvas');
        if (!canvas || !_timelineOpen) return;

        var ctx = canvas.getContext('2d');
        var w = canvas.width = canvas.offsetWidth;
        var h = canvas.height = canvas.offsetHeight;

        ctx.clearRect(0, 0, w, h);

        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;

        // Draw timeline tracks
        var trackH = 28;
        var padding = 10;
        var elements = scene.elements.filter(function (e) { return e.scroll; });

        // Background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (var x = 0; x <= 10; x++) {
            var px = padding + (x / 10) * (w - padding * 2);
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }

        // Percentage labels
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '10px "Space Mono", monospace';
        ctx.textAlign = 'center';
        for (var p = 0; p <= 100; p += 10) {
            var labelX = padding + (p / 100) * (w - padding * 2);
            ctx.fillText(p + '%', labelX, h - 4);
        }

        // Element tracks
        elements.forEach(function (el, i) {
            var y = padding + i * (trackH + 4);
            var start = (el.scroll.start || 0);
            var end = (el.scroll.end || 1);
            var x1 = padding + start * (w - padding * 2);
            var x2 = padding + end * (w - padding * 2);

            // Track bar
            ctx.fillStyle = el.id === _selectedElementId ? 'rgba(108,92,231,0.6)' : 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.roundRect(x1, y, x2 - x1, trackH, 4);
            ctx.fill();

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = '11px "Inter", sans-serif';
            ctx.textAlign = 'left';
            var label = el.text ? el.text.substr(0, 20) : el.id;
            ctx.fillText(label, x1 + 6, y + trackH / 2 + 4);
        });
    }

    /* ─── Toolbar ─── */
    function _setupToolbar() {
        // Delete element
        var delElBtn = _qs('#cneDeleteEl');
        if (delElBtn) {
            delElBtn.addEventListener('click', function () {
                _deleteSelectedElement();
            });
        }
    }

    /* ─── Device Toggle (desktop/tablet/mobile) ─── */
    function _setupDeviceToggle() {
        if (!_container) return;
        _container.querySelectorAll('.device-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _container.querySelectorAll('.device-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var frame = _qs('#cnePreviewFrame');
                if (frame) {
                    frame.classList.remove('preview-desktop', 'preview-tablet', 'preview-mobile');
                    frame.classList.add('preview-' + btn.getAttribute('data-device'));
                }
            });
        });
    }

    function _setupZoom() {
        var zoomIn = _qs('#cneZoomIn');
        var zoomOut = _qs('#cneZoomOut');
        var zoomVal = _qs('#cneZoomVal');

        if (zoomIn) {
            zoomIn.addEventListener('click', function () {
                _zoom = Math.min(200, _zoom + 10);
                _applyZoom();
                if (zoomVal) zoomVal.textContent = _zoom + '%';
            });
        }
        if (zoomOut) {
            zoomOut.addEventListener('click', function () {
                _zoom = Math.max(30, _zoom - 10);
                _applyZoom();
                if (zoomVal) zoomVal.textContent = _zoom + '%';
            });
        }
    }

    function _applyZoom() {
        var frame = _qs('#cnePreviewFrame');
        if (frame) {
            frame.style.transform = 'scale(' + (_zoom / 100) + ')';
            frame.style.transformOrigin = 'top center';
        }
    }

    /* ─── Scene Settings ─── */
    function _setupSceneSettings() {
        var pinToggle = _qs('#cneScenePin');
        var durationInput = _qs('#cneSceneDuration');
        var bgColorInput = _qs('#cneSceneBg');

        if (pinToggle) {
            pinToggle.addEventListener('change', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) { scene.pin = pinToggle.checked; _notifyUpdate(true); }
            });
        }
        if (durationInput) {
            durationInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) { scene.duration = parseInt(durationInput.value) || 100; _notifyUpdate(true); }
            });
        }
        if (bgColorInput) {
            bgColorInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) { scene.bgColor = bgColorInput.value; _notifyUpdate(true); }
            });
        }
    }

    /* ─── Helpers ─── */
    function _getSelectedElement() {
        if (!_selectedElementId) return null;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return null;
        for (var i = 0; i < scene.elements.length; i++) {
            if (scene.elements[i].id === _selectedElementId) return scene.elements[i];
        }
        return null;
    }

    function _setElStyle(prop, value) {
        var el = _getSelectedElement();
        if (!el) return;
        if (!el.style) el.style = {};
        if (value === '' || value === undefined) {
            delete el.style[prop];
        } else {
            el.style[prop] = value;
        }
        _postIframe('arbel-update-style', { id: el.id, prop: prop, value: value || '' });
        _notifyUpdate();
    }

    function _deleteSelectedElement() {
        if (!_selectedElementId) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        scene.elements = scene.elements.filter(function (e) { return e.id !== _selectedElementId; });
        _selectedElementId = null;
        _renderElementList();
        _clearProperties();
        _notifyUpdate(true);
    }

    function _applyOverride(id, data) {
        if (!_overrides[id]) _overrides[id] = {};
        Object.keys(data).forEach(function (k) { _overrides[id][k] = data[k]; });
        _notifyUpdate();
    }

    function _updatePropertiesPanel(data) {
        // from iframe selection event — update right panel + sync element list
        _renderElementList();
        var el = _getSelectedElement();
        if (el) {
            _updatePropertiesFromScene(el);
        }
    }

    function _updatePropertiesFromScene(el) {
        if (!el) return;

        // Style tab
        var textInput = _qs('#cneTextInput');
        if (textInput) textInput.value = el.text || '';

        var fontSize = _qs('#cneFontSize');
        if (fontSize) fontSize.value = parseInt(el.style.fontSize) || '';

        var fontWeight = _qs('#cneFontWeight');
        if (fontWeight) fontWeight.value = el.style.fontWeight || '';

        var color = _qs('#cneColor');
        if (color) color.value = _toHex(el.style.color) || '#ffffff';

        var bgColor = _qs('#cneBgColor');
        if (bgColor) bgColor.value = _toHex(el.style.background) || '#000000';

        var opacity = _qs('#cneOpacity');
        if (opacity) {
            var opVal = el.style.opacity !== undefined ? Math.round(parseFloat(el.style.opacity) * 100) : 100;
            opacity.value = opVal;
            var opDisp = _qs('#cneOpacityVal');
            if (opDisp) opDisp.textContent = opVal + '%';
        }

        var radius = _qs('#cneRadius');
        if (radius) {
            radius.value = parseInt(el.style.borderRadius) || 0;
            var rVal = _qs('#cneRadiusVal');
            if (rVal) rVal.textContent = (parseInt(el.style.borderRadius) || 0) + 'px';
        }

        // Position
        var posTop = _qs('#cnePosTop');
        if (posTop) posTop.value = el.style.top || '';
        var posLeft = _qs('#cnePosLeft');
        if (posLeft) posLeft.value = el.style.left || '';
        var posW = _qs('#cnePosWidth');
        if (posW) posW.value = el.style.width || '';
        var posH = _qs('#cnePosHeight');
        if (posH) posH.value = el.style.height || '';

        // Scroll tab
        _updateScrollPanel();

        // Show properties panel
        var propsContainer = _qs('#cnePropsContainer');
        if (propsContainer) propsContainer.style.display = '';

        var elHeader = _qs('#cneElHeader');
        if (elHeader) elHeader.textContent = '<' + el.tag + '> ' + (el.text ? el.text.substr(0, 20) : el.id);
    }

    function _updateScrollPanel() {
        var el = _getSelectedElement();
        var scrollToggle = _qs('#cneScrollEnable');
        var scrollOpts = _qs('#cneScrollOpts');

        if (!el) return;

        if (scrollToggle) scrollToggle.checked = !!el.scroll;
        if (scrollOpts) scrollOpts.style.display = el.scroll ? '' : 'none';

        // Reset preset dropdown to Custom
        var presetSelect = _qs('#cneAnimPreset');
        if (presetSelect) presetSelect.value = '';

        if (el.scroll) {
            var startInput = _qs('#cneScrollStart');
            var endInput = _qs('#cneScrollEnd');
            if (startInput) startInput.value = Math.round((el.scroll.start || 0) * 100);
            if (endInput) endInput.value = Math.round((el.scroll.end || 1) * 100);

            // Populate from/to for each property
            ['opacity', 'y', 'x', 'scale', 'rotation', 'blur'].forEach(function (prop) {
                var vals = el.scroll[prop];
                var fromInput = _qs('#cneScroll_' + prop + '_from');
                var toInput = _qs('#cneScroll_' + prop + '_to');
                if (fromInput) fromInput.value = (Array.isArray(vals) && vals[0] !== undefined) ? vals[0] : '';
                if (toInput) toInput.value = (Array.isArray(vals) && vals[1] !== undefined) ? vals[1] : '';
            });
        }

        // Split text
        var splitToggle = _qs('#cneSplitText');
        if (splitToggle) splitToggle.checked = el.splitText || false;

        // Parallax
        var parallax = _qs('#cneParallax');
        if (parallax) {
            parallax.value = el.parallax || 1;
            var pVal = _qs('#cneParallaxVal');
            if (pVal) pVal.textContent = (el.parallax || 1) + 'x';
        }
    }

    function _clearProperties() {
        var propsContainer = _qs('#cnePropsContainer');
        if (propsContainer) propsContainer.style.display = 'none';

        var elHeader = _qs('#cneElHeader');
        if (elHeader) elHeader.textContent = 'Select an element';
    }

    function _notifyUpdate(rerender) {
        if (_onUpdate) {
            _onUpdate({
                scenes: _scenes,
                overrides: _overrides,
                rerender: !!rerender
            });
        }
    }

    /* ─── Hex helper ─── */
    function _toHex(val) {
        if (!val) return null;
        if (val.charAt(0) === '#') return val;
        var m = val.match(/\d+/g);
        if (!m || m.length < 3) return null;
        return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1);
    }

    /* ─── Send message to cinematic iframe ─── */
    function _postIframe(type, payload) {
        if (_iframe && _iframe.contentWindow) {
            payload.type = type;
            _iframe.contentWindow.postMessage(payload, '*');
        }
    }

    /* ─── Overlay script injected into cinematic iframe ─── */
    function _getOverlayScript() {
        return '(function(){' +
        'var selected=null,editing=false;' +
        'var s=document.createElement("style");' +
        's.textContent="' +
          '[data-arbel-id]{cursor:pointer;transition:outline .15s,outline-offset .15s}' +
          '[data-arbel-id]:hover:not(.arbel-sel){outline:2px dashed rgba(100,108,255,.5);outline-offset:2px}' +
          '.arbel-sel{outline:2px solid #646cff!important;outline-offset:3px!important}' +
          '.arbel-editing{outline-color:#0bda51!important;min-height:1em}' +
          '.arbel-lbl{position:fixed;top:8px;left:8px;z-index:99999;background:#646cff;color:#fff;' +
          'font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;' +
          'opacity:0;transition:opacity .2s}.arbel-lbl.vis{opacity:1}' +
        '";document.head.appendChild(s);' +
        'var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);' +
        'document.addEventListener("click",function(e){' +
          'if(editing)return;' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(!el){desel();return}' +
          'e.preventDefault();e.stopPropagation();sel(el);' +
        '},true);' +
        'document.addEventListener("dblclick",function(e){' +
          'var el=e.target.closest("[data-arbel-edit=\\"text\\"]");' +
          'if(!el)return;e.preventDefault();startEdit(el);' +
        '},true);' +
        'document.addEventListener("mouseover",function(e){' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(el&&el!==selected){lbl.textContent=el.getAttribute("data-arbel-id");lbl.classList.add("vis")}' +
        '});' +
        'document.addEventListener("mouseout",function(){lbl.classList.remove("vis")});' +
        'function sel(el){' +
          'desel();selected=el;el.classList.add("arbel-sel");' +
          'window.parent.postMessage({type:"arbel-select",id:el.getAttribute("data-arbel-id"),' +
            'tag:el.tagName.toLowerCase(),' +
            'text:el.getAttribute("data-arbel-edit")==="text"?el.textContent:null,' +
            'editable:el.hasAttribute("data-arbel-edit")},"*");' +
        '}' +
        'function desel(){' +
          'if(editing)stopEdit();' +
          'if(selected){selected.classList.remove("arbel-sel");selected=null}' +
          'window.parent.postMessage({type:"arbel-deselect"},"*");' +
        '}' +
        'function startEdit(el){' +
          'if(editing)stopEdit();sel(el);editing=true;' +
          'el.classList.add("arbel-editing");el.contentEditable=true;el.focus();' +
          'var rng=document.createRange();rng.selectNodeContents(el);' +
          'var s2=window.getSelection();s2.removeAllRanges();s2.addRange(rng);' +
          'el.addEventListener("blur",function onB(){el.removeEventListener("blur",onB);stopEdit()});' +
          'el.addEventListener("keydown",function onK(e){' +
            'if(e.key==="Escape"||(e.key==="Enter"&&!e.shiftKey)){e.preventDefault();el.removeEventListener("keydown",onK);el.blur()}' +
          '});' +
        '}' +
        'function stopEdit(){' +
          'if(!selected)return;editing=false;' +
          'selected.classList.remove("arbel-editing");selected.contentEditable=false;' +
          'window.parent.postMessage({type:"arbel-text-update",id:selected.getAttribute("data-arbel-id"),text:selected.textContent},"*");' +
        '}' +
        'window.addEventListener("message",function(e){' +
          'var d;try{d=typeof e.data==="string"?JSON.parse(e.data):e.data}catch(x){return}' +
          'if(!d||!d.type)return;' +
          'if(d.type==="arbel-select-by-id"){var el=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el){el.scrollIntoView({behavior:"smooth",block:"center"});sel(el)}}' +
          'if(d.type==="arbel-update-style"){var el2=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el2)el2.style[d.prop]=d.value}' +
          'if(d.type==="arbel-update-text"){var el3=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el3)el3.textContent=d.text}' +
        '});' +
        '})();';
    }

    /* ─── AI Scene Generation ─── */
    var _AI_PROMPT = 'You are a web animation designer. Generate a single cinematic scroll-animation scene for a website.\n\nReturn ONLY valid JSON in this exact format (no markdown, no explanation):\n{\n  "name": "Scene Name",\n  "elements": [\n    {\n      "id": "unique-id",\n      "tag": "h1",\n      "text": "content",\n      "style": {\n        "fontSize": "5vw",\n        "fontWeight": "700",\n        "color": "#ffffff",\n        "position": "absolute",\n        "top": "30%",\n        "left": "50%",\n        "transform": "translate(-50%,-50%)",\n        "textAlign": "center"\n      },\n      "scroll": {\n        "opacity": [0, 1],\n        "y": [40, 0],\n        "blur": [10, 0],\n        "start": 0,\n        "end": 0.5\n      },\n      "splitText": false,\n      "parallax": 1\n    }\n  ]\n}\n\nAvailable tags: h1, h2, h3, p, span, div.\nAvailable scroll properties (all arrays of [from, to]):\n- opacity: 0-1\n- y: pixels (vertical)\n- x: pixels (horizontal)\n- scale: 0-2\n- rotation: degrees\n- blur: 0-30 pixels\n- clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"] for reveal effects\n- start/end: 0-1 (when in scroll)\n\nDesign rules:\n- Dark theme with white text\n- Cinematic, high-end Framer-style animations\n- Mix blur reveals, clip-path wipes, parallax, scale\n- 3-8 elements including decorative (gradient orbs, glass panels, dividers)\n- Professional typography sizing\n\nUser description: ';

    function _showAIGenerateDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog cne-ai-dialog';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>AI Scene Generator';

        // Provider selector
        var provRow = document.createElement('div');
        provRow.className = 'arbel-dialog-field';
        var provLabel = document.createElement('label');
        provLabel.className = 'arbel-dialog-label mono';
        provLabel.textContent = 'AI PROVIDER';
        var provSelect = document.createElement('select');
        provSelect.className = 'gen-select';
        provSelect.innerHTML = '<option value="gemini">Google Gemini</option><option value="openai">OpenAI (GPT-4o-mini)</option>';
        var savedProv = localStorage.getItem('arbel-ai-provider');
        if (savedProv) provSelect.value = savedProv;
        provRow.appendChild(provLabel);
        provRow.appendChild(provSelect);

        // API Key
        var keyRow = document.createElement('div');
        keyRow.className = 'arbel-dialog-field';
        var keyLabel = document.createElement('label');
        keyLabel.className = 'arbel-dialog-label mono';
        keyLabel.textContent = 'API KEY';
        var keyInput = document.createElement('input');
        keyInput.className = 'gen-input';
        keyInput.type = 'password';
        keyInput.placeholder = 'Paste your API key...';
        var savedKey = localStorage.getItem('arbel-ai-key-' + provSelect.value);
        if (savedKey) keyInput.value = savedKey;
        provSelect.addEventListener('change', function () {
            var k = localStorage.getItem('arbel-ai-key-' + provSelect.value);
            keyInput.value = k || '';
        });
        var keyHint = document.createElement('div');
        keyHint.className = 'cne-ai-hint';
        keyHint.textContent = 'Your key is stored locally and never sent to our servers.';
        keyRow.appendChild(keyLabel);
        keyRow.appendChild(keyInput);
        keyRow.appendChild(keyHint);

        // Description
        var descRow = document.createElement('div');
        descRow.className = 'arbel-dialog-field';
        var descLabel = document.createElement('label');
        descLabel.className = 'arbel-dialog-label mono';
        descLabel.textContent = 'DESCRIBE YOUR SCENE';
        var descInput = document.createElement('textarea');
        descInput.className = 'gen-input';
        descInput.rows = 3;
        descInput.placeholder = 'e.g. A hero section with a large blurry gradient background, a headline that reveals with clip-path, and a CTA button that scales in...';
        descInput.style.resize = 'vertical';
        descInput.style.width = '100%';
        descRow.appendChild(descLabel);
        descRow.appendChild(descInput);

        // Status
        var status = document.createElement('div');
        status.className = 'cne-ai-status';
        status.style.display = 'none';

        // Buttons
        var btns = document.createElement('div');
        btns.className = 'arbel-dialog-btns';

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'gen-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        var genBtn = document.createElement('button');
        genBtn.className = 'gen-btn gen-btn--primary';
        genBtn.innerHTML = '\u2728 Generate Scene';
        genBtn.addEventListener('click', function () {
            var apiKey = keyInput.value.trim();
            var desc = descInput.value.trim();
            if (!apiKey) { status.textContent = 'Please enter an API key.'; status.style.display = ''; status.className = 'cne-ai-status error'; return; }
            if (!desc) { status.textContent = 'Please describe the scene you want.'; status.style.display = ''; status.className = 'cne-ai-status error'; return; }

            localStorage.setItem('arbel-ai-provider', provSelect.value);
            localStorage.setItem('arbel-ai-key-' + provSelect.value, apiKey);

            status.textContent = 'Generating scene...';
            status.style.display = '';
            status.className = 'cne-ai-status loading';
            genBtn.disabled = true;

            var prompt = _AI_PROMPT + desc;
            _callAI(provSelect.value, apiKey, prompt, function (err, sceneData) {
                genBtn.disabled = false;
                if (err) {
                    status.textContent = 'Error: ' + err;
                    status.className = 'cne-ai-status error';
                    return;
                }
                // Build a proper scene object from AI response
                var scene = _aiResponseToScene(sceneData);
                _scenes.push(scene);
                _selectScene(_scenes.length - 1, true);
                document.body.removeChild(overlay);
            });
        });

        btns.appendChild(cancelBtn);
        btns.appendChild(genBtn);

        dialog.appendChild(title);
        dialog.appendChild(provRow);
        dialog.appendChild(keyRow);
        dialog.appendChild(descRow);
        dialog.appendChild(status);
        dialog.appendChild(btns);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    function _callAI(provider, apiKey, prompt, cb) {
        var xhr = new XMLHttpRequest();
        var url, body;

        if (provider === 'openai') {
            url = 'https://api.openai.com/v1/chat/completions';
            body = JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a web animation designer. Return only valid JSON, no markdown code blocks.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 4096
            });
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', 'Bearer ' + apiKey);
        } else {
            url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(apiKey);
            body = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
            });
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
        }

        xhr.onload = function () {
            if (xhr.status !== 200) {
                cb('API returned status ' + xhr.status + '. Check your API key.');
                return;
            }
            try {
                var resp = JSON.parse(xhr.responseText);
                var text;
                if (provider === 'openai') {
                    text = resp.choices[0].message.content;
                } else {
                    text = resp.candidates[0].content.parts[0].text;
                }
                var jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    var sceneData = JSON.parse(jsonMatch[0]);
                    cb(null, sceneData);
                } else {
                    cb('Could not parse AI response as JSON.');
                }
            } catch (e) {
                cb('Parse error: ' + e.message);
            }
        };
        xhr.onerror = function () { cb('Network error. Check your connection.'); };
        xhr.send(body);
    }

    function _aiResponseToScene(data) {
        var sceneId = 'scene-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        var elements = [];
        (data.elements || []).forEach(function (el) {
            var validTags = ['h1', 'h2', 'h3', 'p', 'span', 'div', 'img'];
            var tag = validTags.indexOf(el.tag) >= 0 ? el.tag : 'div';
            elements.push({
                id: (el.id || tag + '-' + Math.random().toString(36).substr(2, 4)) + '-' + sceneId.substr(-4),
                tag: tag,
                text: (typeof el.text === 'string') ? el.text : '',
                style: (el.style && typeof el.style === 'object') ? el.style : { position: 'absolute', top: '50%', left: '50%', color: '#ffffff' },
                scroll: (el.scroll && typeof el.scroll === 'object') ? el.scroll : null,
                splitText: !!el.splitText,
                parallax: el.parallax || 1,
                visible: true,
                locked: false
            });
        });
        return {
            id: sceneId,
            name: data.name || 'AI Scene',
            template: 'custom',
            duration: data.duration || 100,
            pin: data.pin !== false,
            bgColor: data.bgColor || '',
            bgImage: '',
            elements: elements
        };
    }

    /* ─── Public API ─── */
    return {
        init: init,
        getScenes: function () { return _scenes; },
        setScenes: function (s) { if (Array.isArray(s)) { _scenes = s; _renderSceneList(); _selectScene(0); } },
        getOverrides: function () { return _overrides; },
        setOverrides: function (o) { _overrides = o || {}; },
        getCurrentSceneIdx: function () { return _currentSceneIdx; },
        getOverlayScript: _getOverlayScript,
        showAIDialog: _showAIGenerateDialog,
        destroy: function () {
            _active = false;
            _selectedElementId = null;
            window.removeEventListener('message', _handleMessage);
        }
    };
})();
