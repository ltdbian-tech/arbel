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
    var _selectedElementIds = [];
    var _overrides = {};
    var _zoom = 100;
    var _dragState = null;
    var _activeDevice = 'desktop';  // 'desktop' | 'tablet' | 'mobile'
    var _timelineOpen = false;
    var _uiBound = false;          // guard against duplicate listener binding
    var _clipboard = null;           // copy/paste: deep-cloned element object

    /* ─── Undo / Redo ─── */
    var _undoStack = [];
    var _redoStack = [];
    var _MAX_UNDO = 40;
    var _undoLocked = false;     // suppress snapshots during undo/redo apply
    var _dragUndoPushed = false; // guard: snapshot only on first drag move
    var _resizeUndoPushed = false; // guard: snapshot only on first resize move

    /* Per-category pending snapshots for debounced edits.
       Each category (e.g. 'text', 'style', 'imgSrc', 'scene') gets its own
       pre-mutation snapshot + timer so mixed edits never cross-contaminate. */
    var _burstSnapshots = {};    // { category: { snapshot, timer } }
    var _iframeTextUndoPushed = false; // guard for inline iframe text edits

    /* ─── Design Tokens ─── */
    var _designTokens = {
        headingFont: "'Instrument Serif', Georgia, serif",
        bodyFont: "'Inter', system-ui, sans-serif",
        baseSize: 16,
        scale: 1.25,
        primary: '#6C5CE7',
        secondary: '#00cec9',
        text: '#f0f0f0',
        textMuted: '#888888',
        bg: '#0a0a0f',
        surface: '#1a1a2e',
        spaceUnit: 8,
        radius: 8
    };

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
            _iframeTextUndoPushed = false; // reset on element switch
            _selectedElementId = d.id || null;
            _selectedElementIds = d.ids || (d.id ? [d.id] : []);
            // Auto-expand: include group members
            var scene = _scenes[_currentSceneIdx];
            if (scene && _selectedElementIds.length > 0) {
                var groups = {};
                for (var i = 0; i < scene.elements.length; i++) {
                    var se = scene.elements[i];
                    if (se.group && _selectedElementIds.indexOf(se.id) >= 0) {
                        groups[se.group] = true;
                    }
                }
                if (Object.keys(groups).length > 0) {
                    for (var j = 0; j < scene.elements.length; j++) {
                        var je = scene.elements[j];
                        if (je.group && groups[je.group] && _selectedElementIds.indexOf(je.id) < 0) {
                            _selectedElementIds.push(je.id);
                        }
                    }
                }
            }
            _updatePropertiesPanel(d);
        }
        if (d.type === 'arbel-text-update' && d.id) {
            // Snapshot BEFORE the first inline text mutation from iframe
            if (!_iframeTextUndoPushed && !_undoLocked) {
                _pushUndo();
                _iframeTextUndoPushed = true;
            }
            _applyOverride(d.id, { text: d.text });
        }
        if (d.type === 'arbel-move' && d.id) {
            // Snapshot BEFORE the first drag mutation
            if (!_dragUndoPushed) {
                _pushUndo();
                _dragUndoPushed = true;
            }
            // Element dragged on canvas — update model + position inputs
            var scene = _scenes[_currentSceneIdx];
            if (scene) {
                for (var i = 0; i < scene.elements.length; i++) {
                    if (scene.elements[i].id === d.id) {
                        scene.elements[i].style.top = d.top;
                        scene.elements[i].style.left = d.left;
                        break;
                    }
                }
            }
            var posTop = _qs('#cnePosTop');
            var posLeft = _qs('#cnePosLeft');
            if (posTop) posTop.value = d.top;
            if (posLeft) posLeft.value = d.left;
            _notifyUpdate();
        }
        if (d.type === 'arbel-multi-move' && d.moves) {
            if (!_dragUndoPushed) {
                _pushUndo();
                _dragUndoPushed = true;
            }
            var scene = _scenes[_currentSceneIdx];
            if (scene) {
                for (var m = 0; m < d.moves.length; m++) {
                    var mv = d.moves[m];
                    for (var i = 0; i < scene.elements.length; i++) {
                        if (scene.elements[i].id === mv.id) {
                            scene.elements[i].style.top = mv.top;
                            scene.elements[i].style.left = mv.left;
                            break;
                        }
                    }
                }
            }
            // Update position inputs for primary element
            if (d.moves.length > 0) {
                var pm = d.moves[0];
                var posTop = _qs('#cnePosTop');
                var posLeft = _qs('#cnePosLeft');
                if (posTop) posTop.value = pm.top;
                if (posLeft) posLeft.value = pm.left;
            }
            _notifyUpdate();
        }
        if (d.type === 'arbel-move-end') {
            _dragUndoPushed = false;
        }
        if (d.type === 'arbel-resize-start') {
            if (!_resizeUndoPushed) {
                _pushUndo();
                _resizeUndoPushed = true;
            }
        }
        if (d.type === 'arbel-resize' && d.id) {
            var scene = _scenes[_currentSceneIdx];
            if (scene) {
                for (var i = 0; i < scene.elements.length; i++) {
                    if (scene.elements[i].id === d.id) {
                        scene.elements[i].style.width = d.width;
                        scene.elements[i].style.height = d.height;
                        scene.elements[i].style.top = d.top;
                        scene.elements[i].style.left = d.left;
                        break;
                    }
                }
            }
            var posW = _qs('#cnePosWidth');
            var posH = _qs('#cnePosHeight');
            var posT = _qs('#cnePosTop');
            var posL = _qs('#cnePosLeft');
            if (posW) posW.value = d.width;
            if (posH) posH.value = d.height;
            if (posT) posT.value = d.top;
            if (posL) posL.value = d.left;
            _notifyUpdate();
        }
        if (d.type === 'arbel-resize-end') {
            _resizeUndoPushed = false;
        }
        if (d.type === 'arbel-deselect') {
            _iframeTextUndoPushed = false; // reset on deselect
            _selectedElementId = null;
            _selectedElementIds = [];
            _clearProperties();
            _renderElementList();
        }
        if (d.type === 'arbel-tree') {
            // element tree from iframe overlay — not used in cinematic (we have scene-based tree)
        }
        if (d.type === 'arbel-contextmenu') {
            _showContextMenu(d.x, d.y, d);
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

        // Design tokens
        _setupTokensPanel();

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
        _selectedElementIds = [];
        _renderSceneList();
        _renderElementList();
        _clearProperties();
        _updateTimeline();
        // Sync scene panel fields
        var scene = _scenes[_currentSceneIdx];
        if (scene) {
            var pin = _qs('#cneScenePin'); if (pin) pin.checked = scene.pin !== false;
            var dur = _qs('#cneSceneDuration'); if (dur) dur.value = scene.duration || 100;
            var bg = _qs('#cneSceneBg'); if (bg) bg.value = scene.bgColor || '#0a0a0f';
            var bgImg = _qs('#cneSceneBgImage'); if (bgImg) bgImg.value = scene.bgImage || '';
        }
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
            _pushUndo();
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
        _pushUndo();
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
        _pushUndo();
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
            row.className = 'cne-el-item' + (_selectedElementIds.indexOf(el.id) >= 0 ? ' active' : '');

            var tagBadge = document.createElement('span');
            tagBadge.className = 'cne-el-tag mono';
            var tagIcon = el.tag === 'img' ? '&#128247;' : el.tag === 'video' ? '&#127909;' : el.tag === 'a' ? '&#128279;' : el.tag;
            tagBadge.innerHTML = tagIcon;

            var nameSpan = document.createElement('span');
            nameSpan.className = 'cne-el-name';
            if (el.group) {
                var grpHash = 0;
                for (var g = 0; g < el.group.length; g++) grpHash = (grpHash * 31 + el.group.charCodeAt(g)) & 0xffffff;
                var grpDot = document.createElement('span');
                grpDot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#' + ('000000' + grpHash.toString(16)).slice(-6) + ';margin-right:4px;vertical-align:middle';
                nameSpan.appendChild(grpDot);
            }
            nameSpan.appendChild(document.createTextNode(el.text ? el.text.substr(0, 30) : (el.tag === 'img' ? 'Image' : el.tag === 'video' ? 'Video' : el.id)));

            var actions = document.createElement('span');
            actions.className = 'cne-el-actions';

            // Move up
            if (i > 0) {
                var upBtn = document.createElement('button');
                upBtn.className = 'cne-el-action-btn';
                upBtn.innerHTML = '&#9650;';
                upBtn.title = 'Move up';
                upBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    _pushUndo();
                    var tmp = scene.elements[i];
                    scene.elements[i] = scene.elements[i - 1];
                    scene.elements[i - 1] = tmp;
                    _renderElementList();
                    _notifyUpdate(true);
                });
                actions.appendChild(upBtn);
            }

            // Move down
            if (i < scene.elements.length - 1) {
                var downBtn = document.createElement('button');
                downBtn.className = 'cne-el-action-btn';
                downBtn.innerHTML = '&#9660;';
                downBtn.title = 'Move down';
                downBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    _pushUndo();
                    var tmp = scene.elements[i];
                    scene.elements[i] = scene.elements[i + 1];
                    scene.elements[i + 1] = tmp;
                    _renderElementList();
                    _notifyUpdate(true);
                });
                actions.appendChild(downBtn);
            }

            // Duplicate
            var dupBtn = document.createElement('button');
            dupBtn.className = 'cne-el-action-btn';
            dupBtn.innerHTML = '&#9851;';
            dupBtn.title = 'Duplicate';
            dupBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                _pushUndo();
                var clone = JSON.parse(JSON.stringify(el));
                clone.id = el.tag + '-' + Date.now().toString(36);
                scene.elements.splice(i + 1, 0, clone);
                _selectedElementId = clone.id;
                _selectedElementIds = [clone.id];
                _renderElementList();
                _updatePropertiesFromScene(clone);
                _notifyUpdate(true);
            });
            actions.appendChild(dupBtn);

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
            row.appendChild(actions);
            row.appendChild(vis);

            row.addEventListener('click', function (ev) {
                if (ev.shiftKey) {
                    var idx = _selectedElementIds.indexOf(el.id);
                    if (idx >= 0) {
                        _selectedElementIds.splice(idx, 1);
                        if (_selectedElementId === el.id) {
                            _selectedElementId = _selectedElementIds.length > 0 ? _selectedElementIds[_selectedElementIds.length - 1] : null;
                        }
                    } else {
                        _selectedElementIds.push(el.id);
                        _selectedElementId = el.id;
                    }
                } else {
                    _selectedElementId = el.id;
                    _selectedElementIds = [el.id];
                    // Expand to include group members
                    if (el.group) {
                        scene.elements.forEach(function (ge) {
                            if (ge.group === el.group && _selectedElementIds.indexOf(ge.id) < 0) {
                                _selectedElementIds.push(ge.id);
                            }
                        });
                    }
                }
                _renderElementList();
                if (_selectedElementIds.length === 1) {
                    _updatePropertiesFromScene(el);
                    _updateTimeline();
                } else {
                    _updateMultiSelectPanel();
                }
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

    /* ─── Stock Photos Dialog ─── */
    function _showStockPhotosDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog';
        dialog.style.maxWidth = '680px';
        dialog.style.maxHeight = '80vh';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.textContent = 'Stock Photos';

        // Provider + API key row
        var keyRow = document.createElement('div');
        keyRow.className = 'arbel-dialog-field';
        var keyLabel = document.createElement('label');
        keyLabel.className = 'arbel-dialog-label mono';
        keyLabel.textContent = 'UNSPLASH ACCESS KEY';
        var keyInput = document.createElement('input');
        keyInput.className = 'gen-input';
        keyInput.type = 'password';
        keyInput.placeholder = 'Paste your free Unsplash API key...';
        keyInput.setAttribute('autocomplete', 'off');
        keyInput.value = sessionStorage.getItem('arbel-unsplash-key') || '';
        var keyHint = document.createElement('div');
        keyHint.style.cssText = 'font-size:10px;color:rgba(255,255,255,.4);margin-top:4px';
        keyHint.textContent = 'Free at unsplash.com/developers. Key stored in this tab only.';
        keyRow.appendChild(keyLabel);
        keyRow.appendChild(keyInput);
        keyRow.appendChild(keyHint);

        // Search row
        var searchRow = document.createElement('div');
        searchRow.className = 'arbel-dialog-field';
        searchRow.style.display = 'flex';
        searchRow.style.gap = '8px';
        var searchInput = document.createElement('input');
        searchInput.className = 'gen-input';
        searchInput.placeholder = 'Search photos...';
        searchInput.style.flex = '1';
        var searchBtn = document.createElement('button');
        searchBtn.className = 'gen-btn gen-btn--primary';
        searchBtn.textContent = 'Search';
        searchRow.appendChild(searchInput);
        searchRow.appendChild(searchBtn);

        // Results grid
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:400px;overflow-y:auto;margin-top:12px;padding:4px';

        // Status
        var status = document.createElement('div');
        status.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);margin-top:8px;text-align:center';

        // Close button
        var closeRow = document.createElement('div');
        closeRow.className = 'arbel-dialog-btns';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'gen-btn';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
        closeRow.appendChild(closeBtn);

        dialog.appendChild(title);
        dialog.appendChild(keyRow);
        dialog.appendChild(searchRow);
        dialog.appendChild(grid);
        dialog.appendChild(status);
        dialog.appendChild(closeRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        function doSearch() {
            var apiKey = keyInput.value.trim();
            var query = searchInput.value.trim();
            if (!apiKey) { status.textContent = 'Please enter an Unsplash API key.'; return; }
            if (!query) { status.textContent = 'Please enter a search term.'; return; }
            sessionStorage.setItem('arbel-unsplash-key', apiKey);
            grid.innerHTML = '';
            status.textContent = 'Searching...';
            var url = 'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(query) + '&per_page=24&orientation=landscape';
            fetch(url, { headers: { Authorization: 'Client-ID ' + apiKey } })
                .then(function (r) {
                    if (!r.ok) throw new Error('API error ' + r.status);
                    return r.json();
                })
                .then(function (data) {
                    if (!data.results || data.results.length === 0) {
                        status.textContent = 'No results found.';
                        return;
                    }
                    status.textContent = data.total + ' results — click to use';
                    data.results.forEach(function (photo) {
                        var card = document.createElement('div');
                        card.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;cursor:pointer;aspect-ratio:4/3;background:#1a1a2e';
                        var img = document.createElement('img');
                        img.src = photo.urls.small;
                        img.alt = photo.alt_description || '';
                        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
                        img.loading = 'lazy';
                        var credit = document.createElement('div');
                        credit.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:2px 6px;background:rgba(0,0,0,.6);font-size:9px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
                        credit.textContent = photo.user.name;
                        card.appendChild(img);
                        card.appendChild(credit);
                        card.addEventListener('click', function () {
                            var fullUrl = photo.urls.regular;
                            _applyStockPhoto(fullUrl, photo.user.name, photo.links.html);
                            document.body.removeChild(overlay);
                        });
                        grid.appendChild(card);
                    });
                })
                .catch(function (err) {
                    status.textContent = 'Error: ' + err.message;
                });
        }

        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doSearch();
        });
        searchInput.focus();
    }

    function _applyStockPhoto(url, photographer, photoLink) {
        var el = _getSelectedElement();
        if (el && el.tag === 'img') {
            _pushUndo();
            el.src = url;
            var srcInput = _qs('#cneImgSrc');
            if (srcInput) srcInput.value = url;
            _notifyUpdate(true);
        } else {
            // No img element selected — create one
            var scene = _scenes[_currentSceneIdx];
            if (!scene) return;
            _pushUndo();
            var newEl = {
                id: 'img-' + Date.now().toString(36),
                tag: 'img',
                src: url,
                text: 'Photo by ' + photographer,
                visible: true,
                style: {
                    position: 'absolute',
                    top: '30%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '500px',
                    height: '350px',
                    objectFit: 'cover',
                    borderRadius: '12px'
                },
                scroll: { opacity: [0, 1], y: [40, 0], start: 0, end: 0.5 }
            };
            scene.elements.push(newEl);
            _selectedElementId = newEl.id;
            _selectedElementIds = [newEl.id];
            _renderElementList();
            _updatePropertiesFromScene(newEl);
            _notifyUpdate(true);
        }
    }

    /* ─── SVG / Icon Picker ─── */
    var _ICONS = [
        { name: 'arrow-right', cat: 'arrows', d: 'M5 12h14M12 5l7 7-7 7' },
        { name: 'arrow-left', cat: 'arrows', d: 'M19 12H5M12 19l-7-7 7-7' },
        { name: 'arrow-up', cat: 'arrows', d: 'M12 19V5M5 12l7-7 7 7' },
        { name: 'arrow-down', cat: 'arrows', d: 'M12 5v14M19 12l-7 7-7-7' },
        { name: 'chevron-right', cat: 'arrows', d: 'M9 18l6-6-6-6' },
        { name: 'chevron-left', cat: 'arrows', d: 'M15 18l-6-6 6-6' },
        { name: 'chevron-up', cat: 'arrows', d: 'M18 15l-6-6-6 6' },
        { name: 'chevron-down', cat: 'arrows', d: 'M6 9l6 6 6-6' },
        { name: 'home', cat: 'general', d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
        { name: 'search', cat: 'general', d: 'M11 3a8 8 0 100 16 8 8 0 000-16zM21 21l-4.35-4.35' },
        { name: 'settings', cat: 'general', d: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z' },
        { name: 'user', cat: 'general', d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z' },
        { name: 'users', cat: 'general', d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
        { name: 'mail', cat: 'general', d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
        { name: 'phone', cat: 'general', d: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z' },
        { name: 'map-pin', cat: 'general', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7a3 3 0 100 6 3 3 0 000-6z' },
        { name: 'calendar', cat: 'general', d: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18' },
        { name: 'clock', cat: 'general', d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2' },
        { name: 'heart', cat: 'general', d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
        { name: 'star', cat: 'general', d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
        { name: 'check', cat: 'general', d: 'M20 6L9 17l-5-5' },
        { name: 'x', cat: 'general', d: 'M18 6L6 18M6 6l12 12' },
        { name: 'plus', cat: 'general', d: 'M12 5v14M5 12h14' },
        { name: 'minus', cat: 'general', d: 'M5 12h14' },
        { name: 'menu', cat: 'general', d: 'M3 12h18M3 6h18M3 18h18' },
        { name: 'external-link', cat: 'general', d: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3' },
        { name: 'download', cat: 'general', d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
        { name: 'upload', cat: 'general', d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
        { name: 'eye', cat: 'general', d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z' },
        { name: 'lock', cat: 'general', d: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4' },
        { name: 'globe', cat: 'general', d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z' },
        { name: 'play', cat: 'media', d: 'M5 3l14 9-14 9V3z' },
        { name: 'pause', cat: 'media', d: 'M6 4h4v16H6zM14 4h4v16h-4z' },
        { name: 'volume', cat: 'media', d: 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07' },
        { name: 'camera', cat: 'media', d: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 13a4 4 0 100-8 4 4 0 000 8z' },
        { name: 'image', cat: 'media', d: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21' },
        { name: 'film', cat: 'media', d: 'M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5' },
        { name: 'mic', cat: 'media', d: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8' },
        { name: 'shopping-cart', cat: 'commerce', d: 'M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z' },
        { name: 'credit-card', cat: 'commerce', d: 'M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM1 10h22' },
        { name: 'tag', cat: 'commerce', d: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01' },
        { name: 'gift', cat: 'commerce', d: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z' },
        { name: 'code', cat: 'dev', d: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
        { name: 'terminal', cat: 'dev', d: 'M4 17l6-5-6-5M12 19h8' },
        { name: 'database', cat: 'dev', d: 'M12 2C6.48 2 2 4.01 2 6.5V17.5C2 19.99 6.48 22 12 22c5.52 0 10-2.01 10-4.5V6.5C22 4.01 17.52 2 12 2zM2 6.5C2 8.99 6.48 11 12 11c5.52 0 10-2.01 10-4.5M2 12c0 2.49 4.48 4.5 10 4.5 5.52 0 10-2.01 10-4.5' },
        { name: 'cpu', cat: 'dev', d: 'M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3' },
        { name: 'wifi', cat: 'dev', d: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01' },
        { name: 'cloud', cat: 'dev', d: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z' },
        { name: 'zap', cat: 'shapes', d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
        { name: 'sun', cat: 'shapes', d: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' },
        { name: 'moon', cat: 'shapes', d: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z' },
        { name: 'circle', cat: 'shapes', d: 'M12 2a10 10 0 100 20 10 10 0 000-20z' },
        { name: 'square', cat: 'shapes', d: 'M3 3h18v18H3z' },
        { name: 'triangle', cat: 'shapes', d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
        { name: 'hexagon', cat: 'shapes', d: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
        { name: 'award', cat: 'shapes', d: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12' },
        { name: 'shield', cat: 'shapes', d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
        { name: 'send', cat: 'general', d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' },
        { name: 'share', cat: 'general', d: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98' },
        { name: 'bookmark', cat: 'general', d: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z' },
        { name: 'flag', cat: 'general', d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7' },
        { name: 'bell', cat: 'general', d: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
        { name: 'compass', cat: 'general', d: 'M12 2a10 10 0 100 20 10 10 0 000-20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z' }
    ];

    function _showIconPickerDialog() {
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog';
        dialog.style.maxWidth = '560px';
        dialog.style.maxHeight = '80vh';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.textContent = 'SVG Icons';

        // Search
        var searchRow = document.createElement('div');
        searchRow.className = 'arbel-dialog-field';
        var searchInput = document.createElement('input');
        searchInput.className = 'gen-input';
        searchInput.placeholder = 'Filter icons...';
        searchRow.appendChild(searchInput);

        // Size + color row
        var optRow = document.createElement('div');
        optRow.className = 'arbel-dialog-field';
        optRow.style.display = 'flex';
        optRow.style.gap = '12px';
        optRow.style.alignItems = 'center';
        var sizeLabel = document.createElement('span');
        sizeLabel.style.cssText = 'font-size:11px;color:rgba(255,255,255,.5)';
        sizeLabel.textContent = 'Size';
        var sizeInput = document.createElement('input');
        sizeInput.className = 'gen-input';
        sizeInput.type = 'number';
        sizeInput.value = '48';
        sizeInput.min = '16';
        sizeInput.max = '256';
        sizeInput.style.width = '64px';
        var colorLabel = document.createElement('span');
        colorLabel.style.cssText = 'font-size:11px;color:rgba(255,255,255,.5)';
        colorLabel.textContent = 'Color';
        var colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#ffffff';
        colorInput.style.width = '32px';
        colorInput.style.height = '28px';
        colorInput.style.border = 'none';
        colorInput.style.background = 'transparent';
        optRow.appendChild(sizeLabel);
        optRow.appendChild(sizeInput);
        optRow.appendChild(colorLabel);
        optRow.appendChild(colorInput);

        // Grid
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:6px;max-height:320px;overflow-y:auto;margin-top:8px;padding:4px';

        function renderIcons(filter) {
            grid.innerHTML = '';
            var f = (filter || '').toLowerCase();
            _ICONS.forEach(function (ic) {
                if (f && ic.name.indexOf(f) < 0 && ic.cat.indexOf(f) < 0) return;
                var cell = document.createElement('div');
                cell.style.cssText = 'display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:6px;background:rgba(255,255,255,.05);cursor:pointer;padding:8px;transition:background .15s';
                cell.title = ic.name;
                cell.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + ic.d + '"/></svg>';
                cell.addEventListener('mouseenter', function () { cell.style.background = 'rgba(100,108,255,.25)'; });
                cell.addEventListener('mouseleave', function () { cell.style.background = 'rgba(255,255,255,.05)'; });
                cell.addEventListener('click', function () {
                    var sz = parseInt(sizeInput.value) || 48;
                    var clr = colorInput.value || '#ffffff';
                    _insertIcon(ic.d, sz, clr, ic.name);
                    document.body.removeChild(overlay);
                });
                grid.appendChild(cell);
            });
        }

        searchInput.addEventListener('input', function () { renderIcons(searchInput.value); });

        // Custom SVG section
        var customRow = document.createElement('div');
        customRow.className = 'arbel-dialog-field';
        customRow.style.marginTop = '12px';
        var customLabel = document.createElement('label');
        customLabel.className = 'arbel-dialog-label mono';
        customLabel.textContent = 'PASTE CUSTOM SVG';
        var customInput = document.createElement('textarea');
        customInput.className = 'gen-input';
        customInput.rows = 3;
        customInput.placeholder = '<svg viewBox="0 0 24 24">...</svg>';
        customInput.style.cssText = 'resize:vertical;width:100%;font-family:monospace;font-size:11px';
        var customBtn = document.createElement('button');
        customBtn.className = 'gen-btn gen-btn--primary';
        customBtn.textContent = 'Insert Custom SVG';
        customBtn.style.marginTop = '6px';
        customBtn.addEventListener('click', function () {
            var raw = customInput.value.trim();
            if (!raw) return;
            _insertCustomSvg(raw);
            document.body.removeChild(overlay);
        });
        customRow.appendChild(customLabel);
        customRow.appendChild(customInput);
        customRow.appendChild(customBtn);

        // Buttons
        var btns = document.createElement('div');
        btns.className = 'arbel-dialog-btns';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'gen-btn';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
        btns.appendChild(closeBtn);

        dialog.appendChild(title);
        dialog.appendChild(searchRow);
        dialog.appendChild(optRow);
        dialog.appendChild(grid);
        dialog.appendChild(customRow);
        dialog.appendChild(btns);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        renderIcons('');
        searchInput.focus();
    }

    function _insertIcon(pathD, size, color, name) {
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var svgHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + pathD + '"/></svg>';
        var newEl = {
            id: 'div-' + Date.now().toString(36),
            tag: 'div',
            text: svgHtml,
            visible: true,
            style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                width: size + 'px',
                height: size + 'px',
                lineHeight: '0'
            },
            scroll: { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4 }
        };
        scene.elements.push(newEl);
        _selectedElementId = newEl.id;
        _selectedElementIds = [newEl.id];
        _renderElementList();
        _updatePropertiesFromScene(newEl);
        _notifyUpdate(true);
    }

    function _insertCustomSvg(raw) {
        // Sanitize: only allow SVG content, strip dangerous elements/attributes
        if (raw.indexOf('<svg') < 0) return;
        raw = raw.replace(/<script[\s\S]*?<\/script>/gi, '');
        raw = raw.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
        raw = raw.replace(/<object[\s\S]*?<\/object>/gi, '');
        raw = raw.replace(/<embed[\s\S]*?<\/embed>/gi, '');
        raw = raw.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
        raw = raw.replace(/on\w+\s*=/gi, 'data-removed=');
        raw = raw.replace(/javascript\s*:/gi, '');
        raw = raw.replace(/xlink:href\s*=\s*["']javascript/gi, 'xlink:href="');
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var newEl = {
            id: 'div-' + Date.now().toString(36),
            tag: 'div',
            text: raw,
            visible: true,
            style: {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                width: '64px',
                height: '64px',
                lineHeight: '0'
            },
            scroll: { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4 }
        };
        scene.elements.push(newEl);
        _selectedElementId = newEl.id;
        _selectedElementIds = [newEl.id];
        _renderElementList();
        _updatePropertiesFromScene(newEl);
        _notifyUpdate(true);
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
            { tag: 'h1', label: 'Heading 1', text: 'Heading', cat: 'Text' },
            { tag: 'h2', label: 'Heading 2', text: 'Subheading', cat: 'Text' },
            { tag: 'h3', label: 'Heading 3', text: 'Section Title', cat: 'Text' },
            { tag: 'p', label: 'Paragraph', text: 'Your text here', cat: 'Text' },
            { tag: 'span', label: 'Label / Tag', text: 'LABEL', cat: 'Text' },
            { tag: 'a', label: 'Link', text: 'Learn More', cat: 'Text' },
            { tag: 'img', label: 'Image', text: '', cat: 'Media' },
            { tag: 'video', label: 'Video', text: '', cat: 'Media' },
            { tag: 'div', label: 'Box / Container', text: '', cat: 'Layout' },
            { tag: 'div', label: 'Glass Card', text: '', variant: 'glass', cat: 'Layout' },
            { tag: 'div', label: 'Gradient Orb', text: '', variant: 'orb', cat: 'Decorative' },
            { tag: 'div', label: 'Divider Line', text: '', variant: 'divider', cat: 'Decorative' },
            { tag: 'div', label: 'Button', text: 'Click Me', variant: 'button', cat: 'Interactive' }
        ];

        var list = document.createElement('div');
        list.className = 'cne-el-type-list';

        // Group by category
        var categories = {};
        types.forEach(function (t) {
            if (!categories[t.cat]) categories[t.cat] = [];
            categories[t.cat].push(t);
        });

        Object.keys(categories).forEach(function (cat) {
            var catLabel = document.createElement('div');
            catLabel.className = 'cne-el-type-cat';
            catLabel.textContent = cat;
            list.appendChild(catLabel);

            categories[cat].forEach(function (t) {
                var btn = document.createElement('button');
                btn.className = 'cne-el-type-btn';
                var icon = t.tag === 'img' ? '&#128247;' : t.tag === 'video' ? '&#127909;' : t.tag === 'a' ? '&#128279;' : '';
                btn.innerHTML = (icon ? '<span>' + icon + '</span> ' : '<span class="mono">&lt;' + t.tag + '&gt;</span> ') + t.label;
                btn.addEventListener('click', function () {
                    _addElementFromType(t);
                    document.body.removeChild(overlay);
                });
                list.appendChild(btn);
            });
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

    function _addElementFromType(t) {
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

        if (t.tag === 'img') {
            newEl.src = '';
            newEl.style = {
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: '400px', height: '300px', objectFit: 'cover', borderRadius: '12px'
            };
        } else if (t.tag === 'video') {
            newEl.src = '';
            newEl.videoAutoplay = true;
            newEl.videoLoop = true;
            newEl.videoMuted = true;
            newEl.style = {
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: '500px', height: '300px', objectFit: 'cover', borderRadius: '12px'
            };
        } else if (t.tag === 'a') {
            newEl.href = '#';
            newEl.linkNewTab = true;
            newEl.style.color = '#a78bfa';
            newEl.style.textDecoration = 'underline';
        } else if (t.tag === 'div' && t.variant === 'glass') {
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
            newEl.href = '#';
            newEl.linkNewTab = false;
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

        _pushUndo();
        scene.elements.push(newEl);
        _selectedElementId = newEl.id;
        _selectedElementIds = [newEl.id];
        _renderElementList();
        _updatePropertiesFromScene(newEl);
        _notifyUpdate(true);
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
        // Hover state inputs
        _setupHoverInputs();
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
                    _beginBurst('text');
                    el.text = textInput.value;
                    _applyOverride(el.id, { text: el.text });
                    _renderElementList();
                    _postIframe('arbel-update-text', { id: el.id, text: el.text });
                    _commitBurst('text', 600);
                    _notifyUpdate();
                }
            });
        }

        // Image src
        var imgSrc = _qs('#cneImgSrc');
        if (imgSrc) {
            imgSrc.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('imgSrc');
                    el.src = imgSrc.value;
                    _commitBurst('imgSrc', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // Image upload
        var imgUpload = _qs('#cneImgUpload');
        if (imgUpload) {
            imgUpload.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el || !imgUpload.files || !imgUpload.files[0]) return;
                var file = imgUpload.files[0];
                if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
                _pushUndo();
                var reader = new FileReader();
                reader.onload = function (e) {
                    el.src = e.target.result;
                    var srcInput = _qs('#cneImgSrc');
                    if (srcInput) srcInput.value = '(uploaded)';
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Image object-fit
        var imgFit = _qs('#cneImgFit');
        if (imgFit) {
            imgFit.addEventListener('change', function () {
                _setElStyle('objectFit', imgFit.value);
            });
        }

        // Video src
        var videoSrc = _qs('#cneVideoSrc');
        if (videoSrc) {
            videoSrc.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('videoSrc');
                    el.src = videoSrc.value;
                    _commitBurst('videoSrc', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // Video options
        ['Autoplay', 'Loop', 'Muted'].forEach(function (opt) {
            var cb = _qs('#cneVideo' + opt);
            if (cb) {
                cb.addEventListener('change', function () {
                    var el = _getSelectedElement();
                    if (el) { _pushUndo(); el['video' + opt] = cb.checked; _notifyUpdate(true); }
                });
            }
        });

        // Stock Photos button
        var stockBtn = _qs('#cneStockBtn');
        if (stockBtn) {
            stockBtn.addEventListener('click', function () {
                _showStockPhotosDialog();
            });
        }
        var stockToolbar = _qs('#cneStockToolbar');
        if (stockToolbar) {
            stockToolbar.addEventListener('click', function () {
                _showStockPhotosDialog();
            });
        }
        var iconToolbar = _qs('#cneIconToolbar');
        if (iconToolbar) {
            iconToolbar.addEventListener('click', function () {
                _showIconPickerDialog();
            });
        }

        // Link href
        var linkHref = _qs('#cneLinkHref');
        if (linkHref) {
            linkHref.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('linkHref');
                    el.href = linkHref.value;
                    _commitBurst('linkHref', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // Link new tab
        var linkNewTab = _qs('#cneLinkNewTab');
        if (linkNewTab) {
            linkNewTab.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (el) { _pushUndo(); el.linkNewTab = linkNewTab.checked; _notifyUpdate(true); }
            });
        }

        // Font family
        var fontFamily = _qs('#cneFontFamily');
        if (fontFamily) {
            fontFamily.addEventListener('change', function () {
                _setElStyle('fontFamily', fontFamily.value);
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

        // Line height
        var lineHeight = _qs('#cneLineHeight');
        if (lineHeight) {
            lineHeight.addEventListener('input', function () {
                _setElStyle('lineHeight', lineHeight.value || '');
            });
        }

        // Letter spacing
        var letterSpacing = _qs('#cneLetterSpacing');
        if (letterSpacing) {
            letterSpacing.addEventListener('input', function () {
                var val = letterSpacing.value;
                if (val && /^[\d.]+$/.test(val)) val += 'em';
                _setElStyle('letterSpacing', val);
            });
        }

        // Text alignment
        var alignBtns = _qsa('#cneTextAlign .cne-icon-btn');
        alignBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                alignBtns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                _setElStyle('textAlign', btn.getAttribute('data-val'));
            });
        });

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

        // Gradient toggle + picker
        var _cneGradActive = false;
        var gradToggle = _qs('#cneGradToggle');
        if (gradToggle) {
            gradToggle.addEventListener('click', function () {
                _cneGradActive = !_cneGradActive;
                var panel = _qs('#cneGradPanel');
                if (panel) panel.style.display = _cneGradActive ? '' : 'none';
                gradToggle.classList.toggle('active', _cneGradActive);
                if (_cneGradActive) _applyCneGradient();
            });
        }
        function _applyCneGradient() {
            if (!_cneGradActive) return;
            var c1 = (_qs('#cneGradC1') || {}).value || '#646cff';
            var c2 = (_qs('#cneGradC2') || {}).value || '#000000';
            var type = (_qs('#cneGradType') || {}).value || 'linear';
            var angle = (_qs('#cneGradAngle') || {}).value || '135';
            var val = type === 'radial' ? 'radial-gradient(circle, ' + c1 + ', ' + c2 + ')'
                : 'linear-gradient(' + angle + 'deg, ' + c1 + ', ' + c2 + ')';
            _setElStyle('background', val);
        }
        var gradC1 = _qs('#cneGradC1');
        var gradC2 = _qs('#cneGradC2');
        var gradType = _qs('#cneGradType');
        var gradAngle = _qs('#cneGradAngle');
        if (gradC1) gradC1.addEventListener('input', _applyCneGradient);
        if (gradC2) gradC2.addEventListener('input', _applyCneGradient);
        if (gradType) gradType.addEventListener('change', _applyCneGradient);
        if (gradAngle) gradAngle.addEventListener('input', function () {
            var lbl = _qs('#cneGradAngleVal');
            if (lbl) lbl.textContent = gradAngle.value + '°';
            _applyCneGradient();
        });

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

        // Z-Index
        var zIndex = _qs('#cneZIndex');
        if (zIndex) {
            zIndex.addEventListener('input', function () {
                _setElStyle('zIndex', zIndex.value || '');
            });
        }

        // Box Shadow
        var boxShadow = _qs('#cneBoxShadow');
        if (boxShadow) {
            boxShadow.addEventListener('change', function () {
                _setElStyle('boxShadow', boxShadow.value);
            });
        }

        // Backdrop Filter
        var backdrop = _qs('#cneBackdrop');
        if (backdrop) {
            backdrop.addEventListener('change', function () {
                _setElStyle('backdropFilter', backdrop.value);
            });
        }

        // Border
        var borderWidth = _qs('#cneBorderWidth');
        var borderColor = _qs('#cneBorderColor');
        function updateBorder() {
            var w = borderWidth ? borderWidth.value : '';
            var c = borderColor ? borderColor.value : '#ffffff';
            if (w && parseInt(w) > 0) {
                _setElStyle('border', w + 'px solid ' + c);
            } else {
                _setElStyle('border', '');
            }
        }
        if (borderWidth) borderWidth.addEventListener('input', updateBorder);
        if (borderColor) borderColor.addEventListener('input', updateBorder);

        // Padding
        ['Top', 'Right', 'Bottom', 'Left'].forEach(function (side) {
            var input = _qs('#cnePad' + side);
            if (input) {
                input.addEventListener('input', function () {
                    var val = input.value;
                    if (val && /^\d+(\.\d+)?$/.test(val)) val += 'px';
                    _setElStyle('padding' + side, val);
                });
            }
        });

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

        // Scroll property rows (opacity, y, x, scale, rotation, blur, clipPath, rotateX, rotateY, skewX, skewY)
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

        // String-valued scroll properties (clipPath)
        ['clipPath'].forEach(function (prop) {
            var fromInput = _qs('#cneScroll_' + prop + '_from');
            var toInput = _qs('#cneScroll_' + prop + '_to');
            if (fromInput) {
                fromInput.addEventListener('input', function () {
                    _setScrollStringValues(prop, fromInput, toInput);
                });
            }
            if (toInput) {
                toInput.addEventListener('input', function () {
                    _setScrollStringValues(prop, fromInput, toInput);
                });
            }
        });

        // Numeric special scroll properties (rotateX, rotateY, skewX, skewY)
        ['rotateX', 'rotateY', 'skewX', 'skewY'].forEach(function (prop) {
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

        // Easing curve
        _setupEasingInputs();
    }

    /* ─── Easing Curve Controls ─── */
    var _EASE_BEZIER_MAP = {
        'none':             [0, 0, 1, 1],
        'power1.out':       [0.25, 0.46, 0.45, 0.94],
        'power2.out':       [0.22, 0.61, 0.36, 1],
        'power3.out':       [0.16, 0.73, 0.3,  0.99],
        'power4.out':       [0.08, 0.82, 0.17, 1],
        'power1.in':        [0.55, 0.06, 0.68, 0.19],
        'power2.in':        [0.55, 0.09, 0.68, 0.19],
        'power3.in':        [0.64, 0,    0.78, 0],
        'power4.in':        [0.76, 0,    0.86, 0],
        'power1.inOut':     [0.42, 0,    0.58, 1],
        'power2.inOut':     [0.42, 0,    0.58, 1],
        'power3.inOut':     [0.65, 0,    0.35, 1],
        'expo.out':         [0.16, 1,    0.3,  1],
        'circ.out':         [0.08, 0.82, 0.17, 1],
        'sine.out':         [0.39, 0.58, 0.57, 1],
        'back.out(1.7)':    [0.18, 0.89, 0.32, 1.28],
        'elastic.out(1,0.3)': [0.32, 1.28, 0.68, 1],
        'bounce.out':       [0.28, 0.84, 0.42, 1]
    };

    function _drawEaseCurve(bezier) {
        var canvas = _qs('#cneEaseCurve');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var pad = 6;
        ctx.clearRect(0, 0, w, h);

        // Grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, pad); ctx.lineTo(w - pad, h - pad);
        ctx.stroke();

        // Curve
        ctx.strokeStyle = '#6c63ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        var steps = 60;
        for (var i = 0; i <= steps; i++) {
            var t = i / steps;
            var u = 1 - t;
            var x = 3 * u * u * t * bezier[0] + 3 * u * t * t * bezier[2] + t * t * t;
            var y = 3 * u * u * t * bezier[1] + 3 * u * t * t * bezier[3] + t * t * t;
            var px = pad + x * (w - 2 * pad);
            var py = (h - pad) - y * (h - 2 * pad);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Endpoints
        ctx.fillStyle = '#6c63ff';
        ctx.beginPath(); ctx.arc(pad, h - pad, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w - pad, pad, 3, 0, Math.PI * 2); ctx.fill();
    }

    function _setupEasingInputs() {
        var easeSelect = _qs('#cneScrollEase');
        var customPanel = _qs('#cneEaseCustom');

        if (easeSelect) {
            easeSelect.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el || !el.scroll) return;
                var val = easeSelect.value;
                if (customPanel) customPanel.style.display = val === 'custom' ? '' : 'none';
                if (val === 'custom') {
                    var x1 = parseFloat(_qs('#cneEaseX1').value) || 0.25;
                    var y1 = parseFloat(_qs('#cneEaseY1').value) || 0.1;
                    var x2 = parseFloat(_qs('#cneEaseX2').value) || 0.25;
                    var y2 = parseFloat(_qs('#cneEaseY2').value) || 1;
                    el.scroll.ease = 'cubic-bezier(' + x1 + ',' + y1 + ',' + x2 + ',' + y2 + ')';
                    _drawEaseCurve([x1, y1, x2, y2]);
                } else {
                    el.scroll.ease = val;
                    _drawEaseCurve(_EASE_BEZIER_MAP[val] || [0, 0, 1, 1]);
                }
                _notifyUpdate(true);
            });
        }

        ['cneEaseX1', 'cneEaseY1', 'cneEaseX2', 'cneEaseY2'].forEach(function (id) {
            var inp = _qs('#' + id);
            if (inp) {
                inp.addEventListener('input', function () {
                    var el = _getSelectedElement();
                    if (!el || !el.scroll) return;
                    var x1 = parseFloat(_qs('#cneEaseX1').value) || 0;
                    var y1 = parseFloat(_qs('#cneEaseY1').value) || 0;
                    var x2 = parseFloat(_qs('#cneEaseX2').value) || 0;
                    var y2 = parseFloat(_qs('#cneEaseY2').value) || 0;
                    el.scroll.ease = 'cubic-bezier(' + x1 + ',' + y1 + ',' + x2 + ',' + y2 + ')';
                    _drawEaseCurve([x1, y1, x2, y2]);
                    _notifyUpdate(true);
                });
            }
        });
    }

    function _updateEasingPanel(el) {
        var easeSelect = _qs('#cneScrollEase');
        var customPanel = _qs('#cneEaseCustom');
        if (!easeSelect) return;

        var ease = (el.scroll && el.scroll.ease) ? el.scroll.ease : 'none';

        if (ease.indexOf('cubic-bezier') === 0) {
            easeSelect.value = 'custom';
            if (customPanel) customPanel.style.display = '';
            var parts = ease.replace('cubic-bezier(', '').replace(')', '').split(',');
            var x1 = parseFloat(parts[0]) || 0;
            var y1 = parseFloat(parts[1]) || 0;
            var x2 = parseFloat(parts[2]) || 0;
            var y2 = parseFloat(parts[3]) || 0;
            var inp;
            inp = _qs('#cneEaseX1'); if (inp) inp.value = x1;
            inp = _qs('#cneEaseY1'); if (inp) inp.value = y1;
            inp = _qs('#cneEaseX2'); if (inp) inp.value = x2;
            inp = _qs('#cneEaseY2'); if (inp) inp.value = y2;
            _drawEaseCurve([x1, y1, x2, y2]);
        } else {
            easeSelect.value = ease;
            if (customPanel) customPanel.style.display = 'none';
            _drawEaseCurve(_EASE_BEZIER_MAP[ease] || [0, 0, 1, 1]);
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

    function _setScrollStringValues(prop, fromInput, toInput) {
        var el = _getSelectedElement();
        if (!el || !el.scroll) return;
        var from = fromInput ? fromInput.value.trim() : '';
        var to = toInput ? toInput.value.trim() : '';
        if (!from && !to) {
            delete el.scroll[prop];
        } else {
            el.scroll[prop] = [from || '', to || ''];
        }
        _notifyUpdate(true);
    }

    function _setScrollProp(prop, val) {
        var el = _getSelectedElement();
        if (!el || !el.scroll) return;
        el.scroll[prop] = val;
        _notifyUpdate(true);
    }

    /* ─── Timeline (Bottom, Collapsible + Interactive) ─── */
    function _setupTimeline() {
        var toggle = _qs('#cneTimelineToggle');
        var panel = _qs('#cneTimeline');
        if (toggle && panel) {
            toggle.addEventListener('click', function () {
                _timelineOpen = !_timelineOpen;
                panel.classList.toggle('open', _timelineOpen);
                toggle.classList.toggle('active', _timelineOpen);
                if (_timelineOpen) _updateTimeline();
            });
        }
        // Build ruler marks once
        var ruler = _qs('#cneTlRuler');
        if (ruler) {
            ruler.innerHTML = '';
            for (var p = 0; p <= 100; p += 10) {
                var mark = document.createElement('span');
                mark.className = 'cne-tl-ruler-mark';
                mark.textContent = p + '%';
                ruler.appendChild(mark);
            }
        }
    }

    function _updateTimeline() {
        var tracks = _qs('#cneTlTracks');
        if (!tracks || !_timelineOpen) return;

        var scene = _scenes[_currentSceneIdx];
        if (!scene || !scene.elements.length) {
            tracks.innerHTML = '<div class="cne-tl-empty">No elements with scroll data</div>';
            return;
        }

        var elements = scene.elements.filter(function (e) { return e.scroll; });
        if (!elements.length) {
            tracks.innerHTML = '<div class="cne-tl-empty">No elements with scroll data</div>';
            return;
        }

        // Scroll properties that get colored dots
        var scrollProps = ['opacity', 'x', 'y', 'scale', 'rotation', 'blur', 'clipPath', 'rotateX', 'rotateY'];

        tracks.innerHTML = '';
        elements.forEach(function (el) {
            var start = Math.max(0, Math.min(1, el.scroll.start || 0));
            var end = Math.max(0, Math.min(1, el.scroll.end || 1));
            if (end < start) end = start;

            var track = document.createElement('div');
            track.className = 'cne-tl-track' + (el.id === _selectedElementId ? ' selected' : '');
            track.setAttribute('data-el-id', el.id);

            // Label
            var label = document.createElement('div');
            label.className = 'cne-tl-label';
            label.textContent = el.text ? el.text.substr(0, 16) : el.id;
            label.title = el.text || el.id;

            // Bar area
            var barArea = document.createElement('div');
            barArea.className = 'cne-tl-bar-area';

            // The bar itself
            var bar = document.createElement('div');
            bar.className = 'cne-tl-bar';
            bar.style.left = (start * 100) + '%';
            bar.style.width = ((end - start) * 100) + '%';

            // Left handle
            var handleL = document.createElement('div');
            handleL.className = 'cne-tl-handle cne-tl-handle-l';

            // Right handle
            var handleR = document.createElement('div');
            handleR.className = 'cne-tl-handle cne-tl-handle-r';

            // Property dots
            var propsDiv = document.createElement('div');
            propsDiv.className = 'cne-tl-props';
            scrollProps.forEach(function (prop) {
                if (el.scroll[prop] !== undefined) {
                    var dot = document.createElement('span');
                    dot.className = 'cne-tl-prop-dot';
                    dot.setAttribute('data-prop', prop);
                    dot.title = prop;
                    propsDiv.appendChild(dot);
                }
            });

            bar.appendChild(handleL);
            bar.appendChild(propsDiv);
            bar.appendChild(handleR);
            barArea.appendChild(bar);
            track.appendChild(label);
            track.appendChild(barArea);
            tracks.appendChild(track);

            // Click track to select element
            track.addEventListener('click', function (e) {
                if (e.target.classList.contains('cne-tl-handle')) return;
                _selectedElementId = el.id;
                _selectedElementIds = [el.id];
                _renderElementList();
                _updatePropertiesFromScene(el);
                _updateTimeline();
                _postIframe('arbel-select-by-id', { id: el.id });
            });

            // Drag: left handle (adjust start)
            _tlDrag(handleL, barArea, function (pct) {
                var newStart = Math.max(0, Math.min(pct, (el.scroll.end || 1) - 0.01));
                newStart = Math.round(newStart * 100) / 100;
                el.scroll.start = newStart;
                bar.style.left = (newStart * 100) + '%';
                bar.style.width = (((el.scroll.end || 1) - newStart) * 100) + '%';
            }, function () {
                _syncScrollInputs(el);
                _notifyUpdate(true);
            });

            // Drag: right handle (adjust end)
            _tlDrag(handleR, barArea, function (pct) {
                var newEnd = Math.max((el.scroll.start || 0) + 0.01, Math.min(1, pct));
                newEnd = Math.round(newEnd * 100) / 100;
                el.scroll.end = newEnd;
                bar.style.left = ((el.scroll.start || 0) * 100) + '%';
                bar.style.width = ((newEnd - (el.scroll.start || 0)) * 100) + '%';
            }, function () {
                _syncScrollInputs(el);
                _notifyUpdate(true);
            });

            // Drag: bar body (move whole range)
            _tlDragBar(bar, barArea, el, function () {
                _syncScrollInputs(el);
                _notifyUpdate(true);
            });
        });
    }

    /* Timeline drag helper: individual handle */
    function _tlDrag(handle, barArea, onMove, onEnd) {
        handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var rect = barArea.getBoundingClientRect();
            function move(ev) {
                var pct = (ev.clientX - rect.left) / rect.width;
                pct = Math.max(0, Math.min(1, pct));
                onMove(pct);
            }
            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                onEnd();
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    /* Timeline drag helper: whole bar */
    function _tlDragBar(bar, barArea, el, onEnd) {
        bar.addEventListener('mousedown', function (e) {
            if (e.target.classList.contains('cne-tl-handle')) return;
            e.preventDefault();
            var rect = barArea.getBoundingClientRect();
            var startPct = (e.clientX - rect.left) / rect.width;
            var origStart = el.scroll.start || 0;
            var origEnd = el.scroll.end || 1;
            var range = origEnd - origStart;

            function move(ev) {
                var curPct = (ev.clientX - rect.left) / rect.width;
                var delta = curPct - startPct;
                var newStart = origStart + delta;
                var newEnd = origEnd + delta;
                // Clamp
                if (newStart < 0) { newStart = 0; newEnd = range; }
                if (newEnd > 1) { newEnd = 1; newStart = 1 - range; }
                newStart = Math.round(newStart * 100) / 100;
                newEnd = Math.round(newEnd * 100) / 100;
                el.scroll.start = newStart;
                el.scroll.end = newEnd;
                bar.style.left = (newStart * 100) + '%';
                bar.style.width = ((newEnd - newStart) * 100) + '%';
            }
            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                onEnd();
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    /* Sync scroll start/end inputs in the properties panel after timeline drag */
    function _syncScrollInputs(el) {
        var startInput = _qs('#cneScrollStart');
        var endInput = _qs('#cneScrollEnd');
        if (startInput) startInput.value = el.scroll.start || 0;
        if (endInput) endInput.value = el.scroll.end || 1;
    }

    /* ─── Hover State Inputs ─── */
    function _setupHoverInputs() {
        function _setHover(prop, value) {
            var el = _getSelectedElement();
            if (!el) return;
            if (!el.hoverStyle) el.hoverStyle = {};
            _beginBurst('hover');
            if (value === '' || value === undefined || value === null) {
                delete el.hoverStyle[prop];
            } else {
                el.hoverStyle[prop] = value;
            }
            _commitBurst('hover', 600);
            _notifyUpdate();
        }

        var hOpacity = _qs('#cneHoverOpacity');
        if (hOpacity) hOpacity.addEventListener('input', function () { _setHover('opacity', hOpacity.value); });

        var hScale = _qs('#cneHoverScale');
        if (hScale) hScale.addEventListener('input', function () { _setHover('scale', hScale.value); });

        var hColorEn = _qs('#cneHoverColorEnable');
        var hColor = _qs('#cneHoverColor');
        if (hColor && hColorEn) {
            hColor.addEventListener('input', function () { if (hColorEn.checked) _setHover('color', hColor.value); });
            hColorEn.addEventListener('change', function () { _setHover('color', hColorEn.checked ? hColor.value : ''); });
        }

        var hBgEn = _qs('#cneHoverBgEnable');
        var hBg = _qs('#cneHoverBg');
        if (hBg && hBgEn) {
            hBg.addEventListener('input', function () { if (hBgEn.checked) _setHover('background', hBg.value); });
            hBgEn.addEventListener('change', function () { _setHover('background', hBgEn.checked ? hBg.value : ''); });
        }

        var hY = _qs('#cneHoverY');
        if (hY) hY.addEventListener('input', function () { _setHover('translateY', hY.value); });

        var hRotate = _qs('#cneHoverRotate');
        if (hRotate) hRotate.addEventListener('input', function () { _setHover('rotate', hRotate.value); });

        var hShadow = _qs('#cneHoverShadow');
        if (hShadow) hShadow.addEventListener('change', function () { _setHover('boxShadow', hShadow.value); });

        var hDuration = _qs('#cneHoverDuration');
        if (hDuration) hDuration.addEventListener('input', function () { _setHover('_duration', hDuration.value); });

        var hClear = _qs('#cneHoverClear');
        if (hClear) {
            hClear.addEventListener('click', function () {
                var el = _getSelectedElement();
                if (!el) return;
                _pushUndo();
                el.hoverStyle = {};
                _updateHoverPanel(el);
                _notifyUpdate();
            });
        }
    }

    function _updateHoverPanel(el) {
        if (!el) return;
        var hs = el.hoverStyle || {};
        var hOpacity = _qs('#cneHoverOpacity'); if (hOpacity) hOpacity.value = hs.opacity !== undefined ? hs.opacity : '';
        var hScale = _qs('#cneHoverScale'); if (hScale) hScale.value = hs.scale !== undefined ? hs.scale : '';
        var hColorEn = _qs('#cneHoverColorEnable'); if (hColorEn) hColorEn.checked = !!hs.color;
        var hColor = _qs('#cneHoverColor'); if (hColor) hColor.value = hs.color || '#ffffff';
        var hBgEn = _qs('#cneHoverBgEnable'); if (hBgEn) hBgEn.checked = !!hs.background;
        var hBg = _qs('#cneHoverBg'); if (hBg) hBg.value = hs.background || '#6C5CE7';
        var hY = _qs('#cneHoverY'); if (hY) hY.value = hs.translateY !== undefined ? hs.translateY : '';
        var hRotate = _qs('#cneHoverRotate'); if (hRotate) hRotate.value = hs.rotate !== undefined ? hs.rotate : '';
        var hShadow = _qs('#cneHoverShadow'); if (hShadow) hShadow.value = hs.boxShadow || '';
        var hDuration = _qs('#cneHoverDuration'); if (hDuration) hDuration.value = hs._duration || '0.3';
    }

    /* ─── Design Tokens Panel ─── */
    function _setupTokensPanel() {
        var fields = {
            headingFont: _qs('#cneTokenHeadingFont'),
            bodyFont: _qs('#cneTokenBodyFont'),
            baseSize: _qs('#cneTokenBaseSize'),
            scale: _qs('#cneTokenScale'),
            primary: _qs('#cneTokenPrimary'),
            secondary: _qs('#cneTokenSecondary'),
            text: _qs('#cneTokenText'),
            textMuted: _qs('#cneTokenTextMuted'),
            bg: _qs('#cneTokenBg'),
            surface: _qs('#cneTokenSurface'),
            spaceUnit: _qs('#cneTokenSpaceUnit'),
            radius: _qs('#cneTokenRadius')
        };

        // Populate from current state
        function _syncUI() {
            if (fields.headingFont) fields.headingFont.value = _designTokens.headingFont;
            if (fields.bodyFont) fields.bodyFont.value = _designTokens.bodyFont;
            if (fields.baseSize) fields.baseSize.value = _designTokens.baseSize;
            if (fields.scale) fields.scale.value = _designTokens.scale;
            if (fields.primary) fields.primary.value = _designTokens.primary;
            if (fields.secondary) fields.secondary.value = _designTokens.secondary;
            if (fields.text) fields.text.value = _designTokens.text;
            if (fields.textMuted) fields.textMuted.value = _designTokens.textMuted;
            if (fields.bg) fields.bg.value = _designTokens.bg;
            if (fields.surface) fields.surface.value = _designTokens.surface;
            if (fields.spaceUnit) fields.spaceUnit.value = _designTokens.spaceUnit;
            if (fields.radius) fields.radius.value = _designTokens.radius;
        }
        _syncUI();

        // Wire up change listeners
        Object.keys(fields).forEach(function (key) {
            var el = fields[key];
            if (!el) return;
            el.addEventListener('input', function () {
                var v = el.value;
                if (key === 'baseSize' || key === 'spaceUnit' || key === 'radius') v = parseInt(v, 10) || _designTokens[key];
                if (key === 'scale') v = parseFloat(v) || _designTokens[key];
                _designTokens[key] = v;
                _notifyUpdate(true);
            });
        });

        // Apply tokens to all elements button
        var applyBtn = _qs('#cneTokenApply');
        if (applyBtn) {
            applyBtn.addEventListener('click', function () {
                _applyTokensToAll();
            });
        }

        // Tokens toolbar shortcut — switch to tokens tab
        var tokensToolbar = _qs('#cneTokensToolbar');
        if (tokensToolbar) {
            tokensToolbar.addEventListener('click', function () {
                var tabs = _qsa('.cne-prop-tab');
                var panels = _qsa('.cne-prop-panel');
                tabs.forEach(function (t) { t.classList.remove('active'); });
                panels.forEach(function (p) { p.classList.remove('active'); });
                var tokTab = _qs('.cne-prop-tab[data-tab="tokens"]');
                var tokPanel = _qs('.cne-prop-panel[data-panel="tokens"]');
                if (tokTab) tokTab.classList.add('active');
                if (tokPanel) tokPanel.classList.add('active');
            });
        }
    }

    function _applyTokensToAll() {
        _pushUndo();
        _scenes.forEach(function (scene) {
            // Apply scene bg from token
            scene.bgColor = _designTokens.bg;
            (scene.elements || []).forEach(function (el) {
                if (!el.style) return;
                var tag = el.tag || '';
                // Apply heading font to heading tags
                if (/^h[1-6]$/.test(tag)) {
                    el.style.fontFamily = _designTokens.headingFont;
                }
                // Apply body font to p, span, li, div-with-text
                if (/^(p|span|li|a|label)$/.test(tag) || (tag === 'div' && el.text)) {
                    el.style.fontFamily = _designTokens.bodyFont;
                }
                // Apply text color if currently a light/white color
                if (el.style.color) {
                    var c = el.style.color.toLowerCase();
                    if (c === '#ffffff' || c === '#fff' || c === '#f0f0f0' || c === 'white' || c === 'rgb(255,255,255)') {
                        el.style.color = _designTokens.text;
                    }
                }
                // Apply border radius from token
                if (el.style.borderRadius && el.style.borderRadius !== '0px' && el.style.borderRadius !== '0') {
                    el.style.borderRadius = _designTokens.radius + 'px';
                }
            });
        });
        _refreshPreview();
        _notifyUpdate(true);
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

        // Undo / Redo buttons
        var undoBtn = _qs('#cneUndo');
        var redoBtn = _qs('#cneRedo');
        if (undoBtn) undoBtn.addEventListener('click', function () { _undo(); });
        if (redoBtn) redoBtn.addEventListener('click', function () { _redo(); });

        // Export / Import buttons
        var exportBtn = _qs('#cneExportJSON');
        var importBtn = _qs('#cneImportJSON');
        if (exportBtn) exportBtn.addEventListener('click', function () { _exportJSON(); });
        if (importBtn) importBtn.addEventListener('click', function () { _importJSON(); });

        // Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A)
        document.addEventListener('keydown', function (e) {
            if (!_active) return;
            var tag = document.activeElement.tagName;
            var inInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); _undo(); }
                if (e.key === 'z' && e.shiftKey) { e.preventDefault(); _redo(); }
                if (e.key === 'y') { e.preventDefault(); _redo(); }
                if (e.key === 'c' && !inInput && _selectedElementIds.length > 0) { e.preventDefault(); _copyElement(); }
                if (e.key === 'v' && !inInput && _clipboard) { e.preventDefault(); _pasteElement(); }
                if (e.key === 'd' && _selectedElementIds.length > 0) { e.preventDefault(); _duplicateElement(); }
                if (e.key === 'a' && !inInput) { e.preventDefault(); _selectAll(); }
                if (e.key === 'g' && !e.shiftKey && _selectedElementIds.length > 1) { e.preventDefault(); _groupSelection(); }
                if (e.key === 'g' && e.shiftKey && _selectedElementIds.length > 0) { e.preventDefault(); _ungroupSelection(); }
            }
            // Delete key deletes selected elements (only when not editing text)
            if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedElementIds.length > 0 && !inInput) {
                e.preventDefault();
                _deleteSelectedElement();
            }
        });

        // Set initial disabled state
        _updateUndoButtons();
    }

    /* ─── Device Toggle (desktop/tablet/mobile) ─── */
    function _setupDeviceToggle() {
        if (!_container) return;
        _container.querySelectorAll('.device-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _container.querySelectorAll('.device-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var device = btn.getAttribute('data-device');
                _activeDevice = device || 'desktop';
                var frame = _qs('#cnePreviewFrame');
                if (frame) {
                    frame.classList.remove('preview-desktop', 'preview-tablet', 'preview-mobile');
                    frame.classList.add('preview-' + _activeDevice);
                }
                // Show device badge on props panel
                var badge = _qs('#cneDeviceBadge');
                if (badge) {
                    badge.textContent = _activeDevice === 'desktop' ? '' : _activeDevice.toUpperCase();
                    badge.style.display = _activeDevice === 'desktop' ? 'none' : '';
                }
                // Refresh properties panel for new device
                var el = _getSelectedElement();
                if (el) _updatePropertiesFromScene(el);
            });
        });
    }

    /**
     * Get a style value for the selected element with cascade fallback.
     * mobile -> tabletStyle -> style(desktop)
     * tablet -> tabletStyle -> style(desktop)
     * desktop -> style(desktop)
     */
    function _getElStyleValue(el, prop) {
        if (!el) return '';
        if (_activeDevice === 'mobile') {
            if (el.mobileStyle && el.mobileStyle[prop] !== undefined) return el.mobileStyle[prop];
            if (el.tabletStyle && el.tabletStyle[prop] !== undefined) return el.tabletStyle[prop];
        } else if (_activeDevice === 'tablet') {
            if (el.tabletStyle && el.tabletStyle[prop] !== undefined) return el.tabletStyle[prop];
        }
        return (el.style && el.style[prop] !== undefined) ? el.style[prop] : '';
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
                if (scene) { _pushUndo(); scene.pin = pinToggle.checked; _notifyUpdate(true); }
            });
        }
        if (durationInput) {
            durationInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) {
                    _beginBurst('scene');
                    scene.duration = parseInt(durationInput.value) || 100;
                    _commitBurst('scene', 600);
                    _notifyUpdate(true);
                }
            });
        }
        if (bgColorInput) {
            bgColorInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) {
                    _beginBurst('scene');
                    scene.bgColor = bgColorInput.value;
                    _commitBurst('scene', 600);
                    _notifyUpdate(true);
                }
            });
        }

        var bgImageInput = _qs('#cneSceneBgImage');
        if (bgImageInput) {
            bgImageInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (scene) {
                    _beginBurst('scene');
                    scene.bgImage = bgImageInput.value;
                    _commitBurst('scene', 600);
                    _notifyUpdate(true);
                }
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
        _beginBurst('style');

        if (_activeDevice === 'tablet') {
            if (!el.tabletStyle) el.tabletStyle = {};
            if (value === '' || value === undefined) {
                delete el.tabletStyle[prop];
            } else {
                el.tabletStyle[prop] = value;
            }
        } else if (_activeDevice === 'mobile') {
            if (!el.mobileStyle) el.mobileStyle = {};
            if (value === '' || value === undefined) {
                delete el.mobileStyle[prop];
            } else {
                el.mobileStyle[prop] = value;
            }
        } else {
            if (!el.style) el.style = {};
            if (value === '' || value === undefined) {
                delete el.style[prop];
            } else {
                el.style[prop] = value;
            }
        }

        _postIframe('arbel-update-style', { id: el.id, prop: prop, value: value || '' });
        _commitBurst('style', 600);
        _notifyUpdate();
    }

    /* ─── Copy / Paste / Duplicate ─── */
    function _copyElement() {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || _selectedElementIds.length === 0) return;
        _clipboard = [];
        for (var i = 0; i < scene.elements.length; i++) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                _clipboard.push(JSON.parse(JSON.stringify(scene.elements[i])));
            }
        }
        if (_clipboard.length === 0) _clipboard = null;
    }

    function _pasteElement() {
        if (!_clipboard || _clipboard.length === 0) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var newIds = [];
        for (var c = 0; c < _clipboard.length; c++) {
            var clone = JSON.parse(JSON.stringify(_clipboard[c]));
            clone.id = clone.tag + '-' + Date.now().toString(36) + c;
            if (clone.style) {
                var t = parseInt(clone.style.top) || 0;
                var l = parseInt(clone.style.left) || 0;
                clone.style.top = (t + 20) + (clone.style.top && clone.style.top.indexOf('%') >= 0 ? '%' : 'px');
                clone.style.left = (l + 20) + (clone.style.left && clone.style.left.indexOf('%') >= 0 ? '%' : 'px');
            }
            scene.elements.push(clone);
            newIds.push(clone.id);
        }
        _selectedElementIds = newIds;
        _selectedElementId = newIds[newIds.length - 1];
        _renderElementList();
        var el = _getSelectedElement();
        if (el) _updatePropertiesFromScene(el);
        _notifyUpdate(true);
    }

    function _duplicateElement() {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || _selectedElementIds.length === 0) return;
        _pushUndo();
        var newIds = [];
        // Iterate in reverse insertion order to maintain relative positions
        for (var i = scene.elements.length - 1; i >= 0; i--) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                var clone = JSON.parse(JSON.stringify(scene.elements[i]));
                clone.id = scene.elements[i].tag + '-' + Date.now().toString(36) + i;
                if (clone.style) {
                    var t = parseInt(clone.style.top) || 0;
                    var l = parseInt(clone.style.left) || 0;
                    clone.style.top = (t + 20) + (clone.style.top && clone.style.top.indexOf('%') >= 0 ? '%' : 'px');
                    clone.style.left = (l + 20) + (clone.style.left && clone.style.left.indexOf('%') >= 0 ? '%' : 'px');
                }
                scene.elements.splice(i + 1, 0, clone);
                newIds.push(clone.id);
            }
        }
        _selectedElementIds = newIds;
        _selectedElementId = newIds[newIds.length - 1] || null;
        _renderElementList();
        var el = _getSelectedElement();
        if (el) _updatePropertiesFromScene(el);
        _notifyUpdate(true);
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

        var n = data.count || 1;
        var multi = n > 1;
        addItem(multi ? 'Copy ' + n : 'Copy', 'Ctrl+C', _selectedElementIds.length > 0 ? _copyElement : null);
        addItem('Paste', 'Ctrl+V', _clipboard ? _pasteElement : null);
        addItem(multi ? 'Duplicate ' + n : 'Duplicate', 'Ctrl+D', _selectedElementIds.length > 0 ? _duplicateElement : null);
        addSep();
        if (!multi && data.editable) { addItem('Edit Text', 'Dbl-click', function () { _postIframe('arbel-edit-text', { id: data.id }); }); }
        if (!multi) {
            addItem('Move Up', '', function () { _moveElement(-1); });
            addItem('Move Down', '', function () { _moveElement(1); });
        }
        addSep();
        if (multi) {
            addItem('Group', 'Ctrl+G', function () { _groupSelection(); });
        }
        var hasGroup = _selectedElementIds.some(function (id) {
            var scene = _scenes[_currentSceneIdx];
            if (!scene) return false;
            for (var i = 0; i < scene.elements.length; i++) {
                if (scene.elements[i].id === id && scene.elements[i].group) return true;
            }
            return false;
        });
        if (hasGroup) {
            addItem('Ungroup', 'Ctrl+Shift+G', function () { _ungroupSelection(); });
        }
        addSep();
        addItem(multi ? 'Delete ' + n : 'Delete', 'Del', _selectedElementIds.length > 0 ? _deleteSelectedElement : null, 'arbel-ctx-item--danger');

        // Position: keep on-screen
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        document.body.appendChild(menu);
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
        _ctxMenu = menu;

        // Close on click elsewhere or Escape
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

    function _moveElement(dir) {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || _selectedElementIds.length !== 1) return;
        for (var i = 0; i < scene.elements.length; i++) {
            if (scene.elements[i].id === _selectedElementId) {
                var ni = i + dir;
                if (ni < 0 || ni >= scene.elements.length) return;
                _pushUndo();
                var tmp = scene.elements[i];
                scene.elements[i] = scene.elements[ni];
                scene.elements[ni] = tmp;
                _renderElementList();
                _notifyUpdate(true);
                return;
            }
        }
    }

    function _deleteSelectedElement() {
        if (_selectedElementIds.length === 0) return;
        _pushUndo();
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        var ids = _selectedElementIds;
        scene.elements = scene.elements.filter(function (e) { return ids.indexOf(e.id) < 0; });
        _selectedElementId = null;
        _selectedElementIds = [];
        _renderElementList();
        _clearProperties();
        _notifyUpdate(true);
    }

    function _selectAll() {
        _postIframe('arbel-select-all', {});
    }

    function _groupSelection() {
        if (_selectedElementIds.length < 2) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var groupId = 'grp-' + Date.now().toString(36);
        for (var i = 0; i < scene.elements.length; i++) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                scene.elements[i].group = groupId;
            }
        }
        _renderElementList();
        _notifyUpdate(true);
    }

    function _ungroupSelection() {
        if (_selectedElementIds.length === 0) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        for (var i = 0; i < scene.elements.length; i++) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                delete scene.elements[i].group;
            }
        }
        _renderElementList();
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
        if (_selectedElementIds.length > 1) {
            _updateMultiSelectPanel();
        } else {
            var el = _getSelectedElement();
            if (el) {
                _updatePropertiesFromScene(el);
            }
        }
    }

    function _updateMultiSelectPanel() {
        var elHeader = _qs('#cneElHeader');
        if (elHeader) elHeader.textContent = _selectedElementIds.length + ' elements selected';
        var propsContainer = _qs('#cnePropsContainer');
        if (propsContainer) propsContainer.style.display = 'none';
    }

    function _updatePropertiesFromScene(el) {
        if (!el) return;

        // Show/hide media section
        var mediaSection = _qs('#cneMediaSection');
        var imgRow = _qs('#cneImgRow');
        var imgUploadRow = _qs('#cneImgUploadRow');
        var imgFitRow = _qs('#cneImgFitRow');
        var videoRow = _qs('#cneVideoRow');
        var videoOptsRow = _qs('#cneVideoOptsRow');
        if (mediaSection) {
            var isImg = el.tag === 'img';
            var isVideo = el.tag === 'video';
            mediaSection.style.display = (isImg || isVideo) ? '' : 'none';
            if (imgRow) imgRow.style.display = isImg ? '' : 'none';
            if (imgUploadRow) imgUploadRow.style.display = isImg ? '' : 'none';
            if (imgFitRow) imgFitRow.style.display = isImg ? '' : 'none';
            if (videoRow) videoRow.style.display = isVideo ? '' : 'none';
            if (videoOptsRow) videoOptsRow.style.display = isVideo ? '' : 'none';
        }

        // Populate media fields
        if (el.tag === 'img') {
            var imgSrc = _qs('#cneImgSrc');
            if (imgSrc) imgSrc.value = (el.src && el.src.indexOf('data:') === 0) ? '(uploaded)' : (el.src || '');
            var imgFit = _qs('#cneImgFit');
            if (imgFit) imgFit.value = _getElStyleValue(el, 'objectFit') || 'cover';
        } else if (el.tag === 'video') {
            var videoSrc = _qs('#cneVideoSrc');
            if (videoSrc) videoSrc.value = el.src || '';
            var va = _qs('#cneVideoAutoplay'); if (va) va.checked = el.videoAutoplay !== false;
            var vl = _qs('#cneVideoLoop'); if (vl) vl.checked = el.videoLoop !== false;
            var vm = _qs('#cneVideoMuted'); if (vm) vm.checked = el.videoMuted !== false;
        }

        // Show/hide link section
        var linkSection = _qs('#cneLinkSection');
        if (linkSection) {
            var hasLink = (el.tag === 'a' || el.href !== undefined);
            linkSection.style.display = hasLink ? '' : 'none';
            if (hasLink) {
                var lh = _qs('#cneLinkHref'); if (lh) lh.value = el.href || '';
                var lt = _qs('#cneLinkNewTab'); if (lt) lt.checked = el.linkNewTab !== false;
            }
        }

        // Style tab
        var textInput = _qs('#cneTextInput');
        if (textInput) textInput.value = el.text || '';

        var fontSize = _qs('#cneFontSize');
        if (fontSize) fontSize.value = parseInt(_getElStyleValue(el, 'fontSize')) || '';

        var fontWeight = _qs('#cneFontWeight');
        if (fontWeight) fontWeight.value = _getElStyleValue(el, 'fontWeight');

        var fontFamily = _qs('#cneFontFamily');
        if (fontFamily) fontFamily.value = _getElStyleValue(el, 'fontFamily');

        var lineHeight = _qs('#cneLineHeight');
        if (lineHeight) lineHeight.value = _getElStyleValue(el, 'lineHeight');

        var letterSpacing = _qs('#cneLetterSpacing');
        if (letterSpacing) letterSpacing.value = _getElStyleValue(el, 'letterSpacing');

        // Text alignment buttons
        var alignBtns = _qsa('#cneTextAlign .cne-icon-btn');
        alignBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-val') === (_getElStyleValue(el, 'textAlign') || ''));
        });

        var color = _qs('#cneColor');
        if (color) color.value = _toHex(_getElStyleValue(el, 'color')) || '#ffffff';

        var bgColor = _qs('#cneBgColor');
        if (bgColor) bgColor.value = _toHex(_getElStyleValue(el, 'background')) || '#000000';

        var opacity = _qs('#cneOpacity');
        if (opacity) {
            var opRaw = _getElStyleValue(el, 'opacity');
            var opVal = opRaw !== '' && opRaw !== undefined ? Math.round(parseFloat(opRaw) * 100) : 100;
            opacity.value = opVal;
            var opDisp = _qs('#cneOpacityVal');
            if (opDisp) opDisp.textContent = opVal + '%';
        }

        var radius = _qs('#cneRadius');
        if (radius) {
            radius.value = parseInt(_getElStyleValue(el, 'borderRadius')) || 0;
            var rVal = _qs('#cneRadiusVal');
            if (rVal) rVal.textContent = (parseInt(_getElStyleValue(el, 'borderRadius')) || 0) + 'px';
        }

        // Z-Index
        var zIndex = _qs('#cneZIndex');
        if (zIndex) zIndex.value = _getElStyleValue(el, 'zIndex');

        // Box Shadow
        var boxShadow = _qs('#cneBoxShadow');
        if (boxShadow) boxShadow.value = _getElStyleValue(el, 'boxShadow');

        // Backdrop Filter
        var backdrop = _qs('#cneBackdrop');
        if (backdrop) backdrop.value = _getElStyleValue(el, 'backdropFilter');

        // Border
        var borderWidth = _qs('#cneBorderWidth');
        var borderColor = _qs('#cneBorderColor');
        if (borderWidth || borderColor) {
            var borderParts = (_getElStyleValue(el, 'border') || '').match(/^(\d+)px\s+\S+\s+(.+)$/);
            if (borderWidth) borderWidth.value = borderParts ? borderParts[1] : '';
            if (borderColor) borderColor.value = (borderParts ? _toHex(borderParts[2]) : '') || '#ffffff';
        }

        // Padding
        var padTop = _qs('#cnePadTop'); if (padTop) padTop.value = _getElStyleValue(el, 'paddingTop');
        var padRight = _qs('#cnePadRight'); if (padRight) padRight.value = _getElStyleValue(el, 'paddingRight');
        var padBottom = _qs('#cnePadBottom'); if (padBottom) padBottom.value = _getElStyleValue(el, 'paddingBottom');
        var padLeft = _qs('#cnePadLeft'); if (padLeft) padLeft.value = _getElStyleValue(el, 'paddingLeft');

        // Position
        var posTop = _qs('#cnePosTop');
        if (posTop) posTop.value = _getElStyleValue(el, 'top');
        var posLeft = _qs('#cnePosLeft');
        if (posLeft) posLeft.value = _getElStyleValue(el, 'left');
        var posW = _qs('#cnePosWidth');
        if (posW) posW.value = _getElStyleValue(el, 'width');
        var posH = _qs('#cnePosHeight');
        if (posH) posH.value = _getElStyleValue(el, 'height');

        // Scroll tab
        _updateScrollPanel();

        // Hover state
        _updateHoverPanel(el);

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

            // Populate from/to for each numeric property
            ['opacity', 'y', 'x', 'scale', 'rotation', 'blur', 'rotateX', 'rotateY', 'skewX', 'skewY'].forEach(function (prop) {
                var vals = el.scroll[prop];
                var fromInput = _qs('#cneScroll_' + prop + '_from');
                var toInput = _qs('#cneScroll_' + prop + '_to');
                if (fromInput) fromInput.value = (Array.isArray(vals) && vals[0] !== undefined) ? vals[0] : '';
                if (toInput) toInput.value = (Array.isArray(vals) && vals[1] !== undefined) ? vals[1] : '';
            });

            // Populate clipPath (string values)
            var clipVals = el.scroll.clipPath;
            var clipFrom = _qs('#cneScroll_clipPath_from');
            var clipTo = _qs('#cneScroll_clipPath_to');
            if (clipFrom) clipFrom.value = (Array.isArray(clipVals) && clipVals[0]) ? clipVals[0] : '';
            if (clipTo) clipTo.value = (Array.isArray(clipVals) && clipVals[1]) ? clipVals[1] : '';
        }

        // Easing curve
        _updateEasingPanel(el);

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
        _updateTimeline();
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

    /* ─── Undo / Redo ─── */
    function _snapshotState() {
        return {
            scenes: JSON.parse(JSON.stringify(_scenes)),
            overrides: JSON.parse(JSON.stringify(_overrides))
        };
    }

    /* Check if two state snapshots are identical (dirty-state guard) */
    function _stateEqual(a, b) {
        if (!a || !b) return false;
        return JSON.stringify(a.scenes) === JSON.stringify(b.scenes) &&
               JSON.stringify(a.overrides) === JSON.stringify(b.overrides);
    }

    function _pushUndo() {
        if (_undoLocked) return;
        var snap = _snapshotState();
        // Dirty-state guard: skip if snapshot matches top of undo stack
        if (_undoStack.length > 0 && _stateEqual(snap, _undoStack[_undoStack.length - 1])) return;
        _undoStack.push(snap);
        if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
        _redoStack = [];
        _updateUndoButtons();
    }

    /* Push an already-captured snapshot (pre-change state) onto the undo stack */
    function _commitSnapshot(snapshot) {
        if (_undoLocked) return;
        // Dirty-state guard: skip if state hasn't changed since the snapshot
        if (JSON.stringify(snapshot.scenes) === JSON.stringify(_scenes) &&
            JSON.stringify(snapshot.overrides) === JSON.stringify(_overrides)) return;
        _undoStack.push(snapshot);
        if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
        _redoStack = [];
        _updateUndoButtons();
    }

    /* ─── Transaction helpers (per-category debounce) ─── */
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
    /* Flush all pending bursts immediately (called before import, etc.) */
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
        _scenes = state.scenes;
        _overrides = state.overrides;
        _renderSceneList();
        _selectScene(Math.min(_currentSceneIdx, _scenes.length - 1), true);
        _undoLocked = false;
        _updateUndoButtons();
    }
    function _redo() {
        if (_redoStack.length === 0) return;
        _flushBursts();
        _undoStack.push(_snapshotState());
        _undoLocked = true;
        var state = _redoStack.pop();
        _scenes = state.scenes;
        _overrides = state.overrides;
        _renderSceneList();
        _selectScene(Math.min(_currentSceneIdx, _scenes.length - 1), true);
        _undoLocked = false;
        _updateUndoButtons();
    }

    /* ─── Toolbar undo/redo button states ─── */
    function _updateUndoButtons() {
        var undoBtn = _qs('#cneUndo');
        var redoBtn = _qs('#cneRedo');
        if (undoBtn) undoBtn.disabled = _undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = _redoStack.length === 0;
    }

    /* ─── Export / Import Scene JSON ─── */
    function _exportJSON() {
        var data = JSON.stringify({ scenes: _scenes, overrides: _overrides }, null, 2);
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cinematic-scenes.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    function _importJSON() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', function () {
            if (!input.files || !input.files[0]) return;
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var parsed = JSON.parse(e.target.result);
                    if (!parsed || !Array.isArray(parsed.scenes)) {
                        alert('Invalid scene JSON file.');
                        return;
                    }
                    _flushBursts();
                    _pushUndo();
                    _scenes = parsed.scenes;
                    if (parsed.overrides) _overrides = parsed.overrides;
                    _renderSceneList();
                    _selectScene(0);
                    _notifyUpdate(true);
                } catch (ex) {
                    alert('Failed to parse JSON: ' + ex.message);
                }
            };
            reader.readAsText(input.files[0]);
        });
        input.click();
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
        'var selected=[],primary=null,editing=false,drag=null,resize=null,marquee=null;' +
        'var s=document.createElement("style");' +
        's.textContent="' +
          '[data-arbel-id]{cursor:pointer;transition:outline .15s,outline-offset .15s}' +
          '[data-arbel-id]:hover:not(.arbel-sel){outline:2px dashed rgba(100,108,255,.5);outline-offset:2px}' +
          '.arbel-sel{outline:2px solid #646cff!important;outline-offset:3px!important}' +
          '.arbel-dragging{outline-color:#ff6b35!important;cursor:grabbing!important}' +
          '.arbel-editing{outline-color:#0bda51!important;min-height:1em}' +
          '.arbel-lbl{position:fixed;top:8px;left:8px;z-index:99999;background:#646cff;color:#fff;' +
          'font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;' +
          'opacity:0;transition:opacity .2s}.arbel-lbl.vis{opacity:1}' +
          '.arbel-pos-lbl{position:fixed;bottom:8px;right:8px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;' +
          'font-family:monospace;font-size:11px;padding:4px 8px;border-radius:4px;pointer-events:none;' +
          'opacity:0;transition:opacity .15s}.arbel-pos-lbl.vis{opacity:1}' +
          '.arbel-rh{position:fixed;width:8px;height:8px;background:#646cff;border:1px solid #fff;' +
          'border-radius:1px;z-index:100000;display:none;box-sizing:border-box}' +
          '.arbel-rh-nw{cursor:nw-resize}.arbel-rh-n{cursor:n-resize}.arbel-rh-ne{cursor:ne-resize}' +
          '.arbel-rh-w{cursor:w-resize}.arbel-rh-e{cursor:e-resize}' +
          '.arbel-rh-sw{cursor:sw-resize}.arbel-rh-s{cursor:s-resize}.arbel-rh-se{cursor:se-resize}' +
          '.arbel-snap{position:fixed;background:#ff6b35;z-index:99998;pointer-events:none;display:none}' +
          '.arbel-snap-h{height:1px;left:0;right:0}.arbel-snap-v{width:1px;top:0;bottom:0}' +
          '.arbel-marquee{position:fixed;border:1px dashed #646cff;background:rgba(100,108,255,.08);z-index:99997;pointer-events:none}' +
        '";document.head.appendChild(s);' +
        'var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);' +
        'var posLbl=document.createElement("div");posLbl.className="arbel-pos-lbl";document.body.appendChild(posLbl);' +

        /* ── Resize handles ── */
        'var rHandles=[];' +
        '["nw","n","ne","w","e","sw","s","se"].forEach(function(p){' +
          'var h=document.createElement("div");h.className="arbel-rh arbel-rh-"+p;' +
          'h.setAttribute("data-rh",p);document.body.appendChild(h);rHandles.push(h);' +
        '});' +
        'function posHandles(el){' +
          'if(!el){rHandles.forEach(function(h){h.style.display="none"});return}' +
          'var r=el.getBoundingClientRect(),hs=4;' +
          'rHandles.forEach(function(h){' +
            'var p=h.getAttribute("data-rh"),t,l;' +
            'if(p.indexOf("n")>=0)t=r.top-hs;else if(p.indexOf("s")>=0)t=r.bottom-hs;else t=r.top+r.height/2-hs;' +
            'if(p.indexOf("w")>=0)l=r.left-hs;else if(p.indexOf("e")>=0)l=r.right-hs;else l=r.left+r.width/2-hs;' +
            'h.style.top=t+"px";h.style.left=l+"px";h.style.display="";' +
          '});' +
        '}' +
        'rHandles.forEach(function(h){' +
          'h.addEventListener("mousedown",function(e){' +
            'if(selected.length!==1||editing)return;e.stopPropagation();e.preventDefault();' +
            'resize={el:primary,handle:h.getAttribute("data-rh"),' +
              'startX:e.clientX,startY:e.clientY,' +
              'origW:primary.offsetWidth,origH:primary.offsetHeight,' +
              'origT:primary.offsetTop,origL:primary.offsetLeft};' +
            'window.parent.postMessage({type:"arbel-resize-start"},"*");' +
          '});' +
        '});' +

        /* ── Click → select ── */
        'document.addEventListener("click",function(e){' +
          'if(editing||drag||marquee)return;' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(!el){desel();return}' +
          'e.preventDefault();e.stopPropagation();sel(el,e.shiftKey);' +
        '},true);' +

        /* ── Double-click → inline text edit ── */
        'document.addEventListener("dblclick",function(e){' +
          'var el=e.target.closest("[data-arbel-edit=\\"text\\"]");' +
          'if(!el)return;e.preventDefault();startEdit(el);' +
        '},true);' +

        /* ── Snap guides ── */
        'var snapH=document.createElement("div");snapH.className="arbel-snap arbel-snap-h";document.body.appendChild(snapH);' +
        'var snapV=document.createElement("div");snapV.className="arbel-snap arbel-snap-v";document.body.appendChild(snapV);' +
        'var SNAP_DIST=6;' +
        'function computeSnap(el,newT,newL){' +
          'var w=el.offsetWidth,h=el.offsetHeight;' +
          'var pr=el.offsetParent?el.offsetParent.getBoundingClientRect():{top:0,left:0};' +
          'var vt=newT+pr.top,vl=newL+pr.left;' +
          'var edges={top:vt,mid:vt+h/2,bot:vt+h,left:vl,ctr:vl+w/2,right:vl+w};' +
          'var targets=[];' +
          'document.querySelectorAll("[data-arbel-id]").forEach(function(o){' +
            'if(o===el||selected.indexOf(o)>=0)return;var r=o.getBoundingClientRect();' +
            'targets.push({t:r.top,m:r.top+r.height/2,b:r.top+r.height,l:r.left,c:r.left+r.width/2,r:r.left+r.width});' +
          '});' +
          'var vw=window.innerWidth,vh=window.innerHeight;' +
          'targets.push({t:vh/2,m:vh/2,b:vh/2,l:vw/2,c:vw/2,r:vw/2});' +
          'var sh=null,sv=null,sny=newT,snx=newL;' +
          'var bestDy=SNAP_DIST+1,bestDx=SNAP_DIST+1;' +
          'for(var i=0;i<targets.length;i++){var o=targets[i];' +
            'var pairs=[[edges.top,o.t],[edges.top,o.m],[edges.top,o.b],[edges.mid,o.t],[edges.mid,o.m],[edges.mid,o.b],[edges.bot,o.t],[edges.bot,o.m],[edges.bot,o.b]];' +
            'for(var j=0;j<pairs.length;j++){var dy=Math.abs(pairs[j][0]-pairs[j][1]);' +
              'if(dy<bestDy){bestDy=dy;sh=pairs[j][1];sny=newT+(pairs[j][1]-pairs[j][0]);}' +
            '}' +
            'var pairsX=[[edges.left,o.l],[edges.left,o.c],[edges.left,o.r],[edges.ctr,o.l],[edges.ctr,o.c],[edges.ctr,o.r],[edges.right,o.l],[edges.right,o.c],[edges.right,o.r]];' +
            'for(var k=0;k<pairsX.length;k++){var dx=Math.abs(pairsX[k][0]-pairsX[k][1]);' +
              'if(dx<bestDx){bestDx=dx;sv=pairsX[k][1];snx=newL+(pairsX[k][1]-pairsX[k][0]);}' +
            '}' +
          '}' +
          'if(bestDy<=SNAP_DIST){snapH.style.top=sh+"px";snapH.style.display="";}else{snapH.style.display="none";}' +
          'if(bestDx<=SNAP_DIST){snapV.style.left=sv+"px";snapV.style.display="";}else{snapV.style.display="none";}' +
          'return{top:bestDy<=SNAP_DIST?sny:newT,left:bestDx<=SNAP_DIST?snx:newL};' +
        '}' +
        'function hideSnap(){snapH.style.display="none";snapV.style.display="none";}' +

        /* ── Mousedown → start drag or marquee ── */
        'document.addEventListener("mousedown",function(e){' +
          'if(editing||resize)return;' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(el&&e.button===0){' +
            'if(selected.indexOf(el)<0){sel(el,e.shiftKey);}' +
            'var origins=[];' +
            'for(var i=0;i<selected.length;i++){origins.push({el:selected[i],origTop:selected[i].offsetTop,origLeft:selected[i].offsetLeft});}' +
            'drag={el:el,startX:e.clientX,startY:e.clientY,origins:origins,moved:false};' +
            'e.preventDefault();' +
          '}else if(!el&&e.button===0){' +
            'marquee={startX:e.clientX,startY:e.clientY,div:null};' +
          '}' +
        '},true);' +

        /* ── Mousemove → drag elements, resize, or marquee ── */
        'document.addEventListener("mousemove",function(e){' +
          'if(resize){' +
            'var dx=e.clientX-resize.startX,dy=e.clientY-resize.startY;' +
            'var h=resize.handle,nw=resize.origW,nh=resize.origH,nt=resize.origT,nl=resize.origL;' +
            'if(h.indexOf("e")>=0)nw=Math.max(20,resize.origW+dx);' +
            'if(h.indexOf("w")>=0){nw=Math.max(20,resize.origW-dx);nl=resize.origL+dx;}' +
            'if(h.indexOf("s")>=0)nh=Math.max(20,resize.origH+dy);' +
            'if(h.indexOf("n")>=0){nh=Math.max(20,resize.origH-dy);nt=resize.origT+dy;}' +
            'resize.el.style.width=nw+"px";resize.el.style.height=nh+"px";' +
            'resize.el.style.top=nt+"px";resize.el.style.left=nl+"px";' +
            'posHandles(resize.el);' +
            'posLbl.textContent=nw+" \u00D7 "+nh;posLbl.classList.add("vis");' +
            'window.parent.postMessage({type:"arbel-resize",' +
              'id:resize.el.getAttribute("data-arbel-id"),' +
              'width:nw+"px",height:nh+"px",top:nt+"px",left:nl+"px"},"*");' +
            'return;' +
          '}' +
          'if(marquee){' +
            'if(!marquee.div){marquee.div=document.createElement("div");marquee.div.className="arbel-marquee";document.body.appendChild(marquee.div);}' +
            'var x1=Math.min(marquee.startX,e.clientX),y1=Math.min(marquee.startY,e.clientY);' +
            'var x2=Math.max(marquee.startX,e.clientX),y2=Math.max(marquee.startY,e.clientY);' +
            'marquee.div.style.left=x1+"px";marquee.div.style.top=y1+"px";' +
            'marquee.div.style.width=(x2-x1)+"px";marquee.div.style.height=(y2-y1)+"px";' +
            'return;' +
          '}' +
          'if(!drag)return;' +
          'var dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;' +
          'if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<4)return;' +
          'drag.moved=true;' +
          'for(var i=0;i<drag.origins.length;i++){drag.origins[i].el.classList.add("arbel-dragging");}' +
          'posHandles(null);' +
          'var pri=drag.origins[0];' +
          'var nt=pri.origTop+dy,nl=pri.origLeft+dx;' +
          'var sn=computeSnap(pri.el,nt,nl);' +
          'var snapDy=sn.top-nt,snapDx=sn.left-nl;' +
          'var moves=[];' +
          'for(var j=0;j<drag.origins.length;j++){' +
            'var oj=drag.origins[j];' +
            'var ft=oj.origTop+dy+snapDy,fl=oj.origLeft+dx+snapDx;' +
            'oj.el.style.top=ft+"px";oj.el.style.left=fl+"px";' +
            'moves.push({id:oj.el.getAttribute("data-arbel-id"),top:ft+"px",left:fl+"px"});' +
          '}' +
          'posLbl.textContent="top: "+moves[0].top+"  left: "+moves[0].left;posLbl.classList.add("vis");' +
          'window.parent.postMessage({type:"arbel-multi-move",moves:moves},"*");' +
        '});' +

        /* ── Mouseup → end drag, resize, or marquee ── */
        'document.addEventListener("mouseup",function(e){' +
          'if(resize){' +
            'posLbl.classList.remove("vis");hideSnap();' +
            'window.parent.postMessage({type:"arbel-resize-end",id:resize.el.getAttribute("data-arbel-id")},"*");' +
            'resize=null;return;' +
          '}' +
          'if(marquee){' +
            'if(marquee.div){' +
              'var mr=marquee.div.getBoundingClientRect();' +
              'marquee.div.parentNode.removeChild(marquee.div);' +
              'desel();' +
              'document.querySelectorAll("[data-arbel-id]").forEach(function(el){' +
                'var r=el.getBoundingClientRect();' +
                'if(r.right>mr.left&&r.left<mr.right&&r.bottom>mr.top&&r.top<mr.bottom){' +
                  'selected.push(el);el.classList.add("arbel-sel");' +
                '}' +
              '});' +
              'if(selected.length>0){primary=selected[selected.length-1];posHandles(selected.length===1?primary:null);sendSel();}' +
            '}' +
            'marquee=null;return;' +
          '}' +
          'if(!drag)return;' +
          'var wasDrag=drag.moved;' +
          'for(var i=0;i<drag.origins.length;i++){drag.origins[i].el.classList.remove("arbel-dragging");}' +
          'posLbl.classList.remove("vis");hideSnap();' +
          'if(wasDrag){' +
            'posHandles(selected.length===1?primary:null);' +
            'window.parent.postMessage({type:"arbel-move-end"},"*");' +
          '}' +
          'drag=null;' +
          'if(wasDrag){e.preventDefault();e.stopPropagation()}' +
        '});' +

        /* ── Hover → show label ── */
        'document.addEventListener("mouseover",function(e){' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(el&&selected.indexOf(el)<0){lbl.textContent=el.getAttribute("data-arbel-id");lbl.classList.add("vis")}' +
        '});' +
        'document.addEventListener("mouseout",function(){lbl.classList.remove("vis")});' +

        /* ── Right-click context menu ── */
        'document.addEventListener("contextmenu",function(e){' +
          'var el=e.target.closest("[data-arbel-id]");' +
          'if(!el)return;e.preventDefault();' +
          'if(selected.indexOf(el)<0)sel(el,false);' +
          'var fr=window.frameElement?window.frameElement.getBoundingClientRect():{top:0,left:0};' +
          'window.parent.postMessage({type:"arbel-contextmenu",' +
            'id:el.getAttribute("data-arbel-id"),' +
            'tag:el.tagName.toLowerCase(),' +
            'editable:el.hasAttribute("data-arbel-edit"),' +
            'count:selected.length,' +
            'x:e.clientX+fr.left,y:e.clientY+fr.top},"*");' +
        '});' +

        /* ── Selection helpers ── */
        'function sendSel(){' +
          'var ids=[];for(var i=0;i<selected.length;i++)ids.push(selected[i].getAttribute("data-arbel-id"));' +
          'window.parent.postMessage({type:"arbel-select",id:primary?primary.getAttribute("data-arbel-id"):null,' +
            'ids:ids,' +
            'tag:primary?primary.tagName.toLowerCase():null,' +
            'text:primary&&primary.getAttribute("data-arbel-edit")==="text"?primary.textContent:null,' +
            'editable:primary?primary.hasAttribute("data-arbel-edit"):false},"*");' +
        '}' +
        'function sel(el,shift){' +
          'if(shift){' +
            'var idx=selected.indexOf(el);' +
            'if(idx>=0){el.classList.remove("arbel-sel");selected.splice(idx,1);' +
              'primary=selected.length>0?selected[selected.length-1]:null;' +
            '}else{selected.push(el);el.classList.add("arbel-sel");primary=el;}' +
          '}else{' +
            'for(var i=0;i<selected.length;i++)selected[i].classList.remove("arbel-sel");' +
            'selected=[el];el.classList.add("arbel-sel");primary=el;' +
            'var grp=el.getAttribute("data-arbel-group");' +
            'if(grp){document.querySelectorAll("[data-arbel-group=\\""+grp+"\\"]").forEach(function(g){' +
              'if(selected.indexOf(g)<0){selected.push(g);g.classList.add("arbel-sel");}' +
            '});}' +
          '}' +
          'posHandles(selected.length===1?primary:null);' +
          'if(selected.length===0){window.parent.postMessage({type:"arbel-deselect"},"*");return;}' +
          'sendSel();' +
        '}' +
        'function desel(){' +
          'if(editing)stopEdit();' +
          'for(var i=0;i<selected.length;i++)selected[i].classList.remove("arbel-sel");' +
          'selected=[];primary=null;' +
          'posHandles(null);' +
          'window.parent.postMessage({type:"arbel-deselect"},"*");' +
        '}' +

        /* ── Inline text editing ── */
        'function startEdit(el){' +
          'if(editing)stopEdit();' +
          'for(var i=0;i<selected.length;i++)selected[i].classList.remove("arbel-sel");' +
          'selected=[el];primary=el;el.classList.add("arbel-sel");posHandles(el);' +
          'editing=true;' +
          'el.classList.add("arbel-editing");el.contentEditable=true;el.focus();' +
          'var rng=document.createRange();rng.selectNodeContents(el);' +
          'var s2=window.getSelection();s2.removeAllRanges();s2.addRange(rng);' +
          'el.addEventListener("blur",function onB(){el.removeEventListener("blur",onB);stopEdit()});' +
          'el.addEventListener("keydown",function onK(e){' +
            'if(e.key==="Escape"||(e.key==="Enter"&&!e.shiftKey)){e.preventDefault();el.removeEventListener("keydown",onK);el.blur()}' +
          '});' +
        '}' +
        'function stopEdit(){' +
          'if(!primary)return;editing=false;' +
          'primary.classList.remove("arbel-editing");primary.contentEditable=false;' +
          'window.parent.postMessage({type:"arbel-text-update",id:primary.getAttribute("data-arbel-id"),text:primary.textContent},"*");' +
        '}' +

        /* ── Listen for messages from editor ── */
        'window.addEventListener("message",function(e){' +
          'var d;try{d=typeof e.data==="string"?JSON.parse(e.data):e.data}catch(x){return}' +
          'if(!d||!d.type)return;' +
          'if(d.type==="arbel-select-by-id"){var el=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el){el.scrollIntoView({behavior:"smooth",block:"center"});sel(el,false)}}' +
          'if(d.type==="arbel-select-all"){' +
            'desel();' +
            'document.querySelectorAll("[data-arbel-id]").forEach(function(el){selected.push(el);el.classList.add("arbel-sel");});' +
            'if(selected.length>0){primary=selected[selected.length-1];posHandles(selected.length===1?primary:null);sendSel();}' +
          '}' +
          'if(d.type==="arbel-update-style"){var el2=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el2){el2.style[d.prop]=d.value;if(primary===el2&&selected.length===1)posHandles(el2)}}' +
          'if(d.type==="arbel-update-text"){var el3=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el3)el3.textContent=d.text}' +
          'if(d.type==="arbel-edit-text"){var el4=document.querySelector(\'[data-arbel-id="\'+d.id+\'"]\');if(el4&&el4.hasAttribute("data-arbel-edit"))startEdit(el4)}' +
        '});' +
        /* ── Reposition handles on scroll ── */
        'window.addEventListener("scroll",function(){if(selected.length===1&&primary&&!resize)posHandles(primary)},true);' +
        'window.addEventListener("resize",function(){if(selected.length===1&&primary)posHandles(primary)});' +
        '})();';
    }

    /* ─── AI Scene Generation ─── */

    /* Allowlisted CSS properties for AI-generated styles */
    var _ALLOWED_STYLE_PROPS = {
        fontSize: true, fontWeight: true, fontStyle: true, fontFamily: true,
        color: true, background: true, backgroundColor: true,
        position: true, top: true, left: true, right: true, bottom: true,
        width: true, height: true, minWidth: true, minHeight: true, maxWidth: true, maxHeight: true,
        margin: true, marginTop: true, marginLeft: true, marginRight: true, marginBottom: true,
        padding: true, paddingTop: true, paddingLeft: true, paddingRight: true, paddingBottom: true,
        borderRadius: true, border: true, borderColor: true, borderWidth: true,
        textAlign: true, lineHeight: true, letterSpacing: true, textTransform: true, textDecoration: true,
        transform: true, opacity: true, overflow: true, zIndex: true,
        display: true, whiteSpace: true, cursor: true,
        backdropFilter: true, filter: true, boxShadow: true,
        backgroundImage: true, backgroundSize: true, backgroundPosition: true,
        objectFit: true
    };

    /* Allowlisted scroll animation properties */
    var _ALLOWED_SCROLL_PROPS = {
        opacity: true, x: true, y: true, scale: true, rotation: true,
        blur: true, clipPath: true, rotateX: true, rotateY: true,
        skewX: true, skewY: true, start: true, end: true
    };

    /* Validate a single CSS value — reject anything that looks like injection */
    function _isSafeCSSValue(val) {
        if (typeof val !== 'string' && typeof val !== 'number') return false;
        var s = String(val);
        if (s.length > 200) return false;
        // Block script injection patterns
        if (/[<>"'`]/.test(s)) return false;
        if (/javascript\s*:/i.test(s)) return false;
        if (/expression\s*\(/i.test(s)) return false;
        if (/url\s*\(/i.test(s) && !/url\s*\(\s*data:image\//i.test(s)) return false;
        if (/-moz-binding/i.test(s)) return false;
        if (/behavior\s*:/i.test(s)) return false;
        return true;
    }

    /* Validate a clipPath value */
    function _isSafeClipPath(val) {
        if (typeof val !== 'string') return false;
        // Only allow inset(), circle(), ellipse(), polygon()
        return /^(inset|circle|ellipse|polygon)\([^)]*\)$/.test(val.trim());
    }

    /* Sanitize AI-generated style object */
    function _sanitizeStyle(style) {
        if (!style || typeof style !== 'object') return { position: 'absolute', top: '50%', left: '50%', color: '#ffffff' };
        var clean = {};
        Object.keys(style).forEach(function (prop) {
            if (!_ALLOWED_STYLE_PROPS[prop]) return;
            var val = style[prop];
            if (_isSafeCSSValue(val)) clean[prop] = val;
        });
        if (!clean.position) clean.position = 'absolute';
        return clean;
    }

    /* Sanitize AI-generated scroll object */
    function _sanitizeScroll(scroll) {
        if (!scroll || typeof scroll !== 'object') return null;
        var clean = {};
        Object.keys(scroll).forEach(function (prop) {
            if (!_ALLOWED_SCROLL_PROPS[prop]) return;
            var val = scroll[prop];
            if (prop === 'start' || prop === 'end') {
                var n = parseFloat(val);
                if (!isNaN(n)) clean[prop] = Math.max(0, Math.min(1, n));
            } else if (prop === 'clipPath') {
                if (Array.isArray(val)) {
                    var safe = val.filter(_isSafeClipPath).slice(0, 4);
                    if (safe.length >= 2) clean[prop] = safe;
                }
            } else if (prop === 'opacity') {
                if (Array.isArray(val)) {
                    clean[prop] = val.slice(0, 4).map(function (v) { return Math.max(0, Math.min(1, parseFloat(v) || 0)); });
                }
            } else if (prop === 'scale') {
                if (Array.isArray(val)) {
                    clean[prop] = val.slice(0, 4).map(function (v) { return Math.max(0, Math.min(3, parseFloat(v) || 1)); });
                }
            } else if (prop === 'blur') {
                if (Array.isArray(val)) {
                    clean[prop] = val.slice(0, 4).map(function (v) { return Math.max(0, Math.min(50, parseFloat(v) || 0)); });
                }
            } else if (prop === 'x' || prop === 'y') {
                if (Array.isArray(val)) {
                    clean[prop] = val.slice(0, 4).map(function (v) { return Math.max(-2000, Math.min(2000, parseFloat(v) || 0)); });
                }
            } else if (prop === 'rotation' || prop === 'rotateX' || prop === 'rotateY' || prop === 'skewX' || prop === 'skewY') {
                if (Array.isArray(val)) {
                    clean[prop] = val.slice(0, 4).map(function (v) { return Math.max(-360, Math.min(360, parseFloat(v) || 0)); });
                }
            }
        });
        return Object.keys(clean).length > 0 ? clean : null;
    }

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
        var savedProv = sessionStorage.getItem('arbel-ai-provider');
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
        keyInput.setAttribute('autocomplete', 'off');
        // Load from sessionStorage only — keys never persist beyond this tab
        var savedKey = sessionStorage.getItem('arbel-ai-key-' + provSelect.value) || '';
        if (savedKey) keyInput.value = savedKey;
        provSelect.addEventListener('change', function () {
            keyInput.value = sessionStorage.getItem('arbel-ai-key-' + provSelect.value) || '';
        });

        // Clear any legacy localStorage keys from older versions
        localStorage.removeItem('arbel-ai-key-gemini');
        localStorage.removeItem('arbel-ai-key-openai');
        localStorage.removeItem('arbel-ai-remember');

        var keyHint = document.createElement('div');
        keyHint.className = 'cne-ai-hint';
        keyHint.textContent = 'Your key is sent directly from your browser to the AI provider. It is only stored in this tab and is automatically cleared when you close the tab.';
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

            // Save to sessionStorage only — cleared when tab closes
            sessionStorage.setItem('arbel-ai-provider', provSelect.value);
            sessionStorage.setItem('arbel-ai-key-' + provSelect.value, apiKey);

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
                _pushUndo();
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
            url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
            body = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
            });
            xhr.open('POST', url);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('x-goog-api-key', apiKey);
        }

        xhr.timeout = 30000;
        xhr.onload = function () {
            if (xhr.status !== 200) {
                cb('API returned status ' + xhr.status + '. Check your API key.');
                return;
            }
            try {
                // Reject oversized responses (>100KB)
                if (xhr.responseText.length > 102400) {
                    cb('Response too large. Try a simpler description.');
                    return;
                }
                var resp = JSON.parse(xhr.responseText);
                var text;
                if (provider === 'openai') {
                    if (!resp.choices || !resp.choices[0] || !resp.choices[0].message) {
                        cb('Unexpected OpenAI response format.');
                        return;
                    }
                    // Check for safety refusal
                    if (resp.choices[0].finish_reason === 'content_filter') {
                        cb('The AI declined to generate this content.');
                        return;
                    }
                    text = resp.choices[0].message.content;
                } else {
                    if (!resp.candidates || !resp.candidates[0]) {
                        // Gemini safety block
                        if (resp.promptFeedback && resp.promptFeedback.blockReason) {
                            cb('Content blocked by AI safety filter: ' + resp.promptFeedback.blockReason);
                            return;
                        }
                        cb('Unexpected Gemini response format.');
                        return;
                    }
                    if (!resp.candidates[0].content || !resp.candidates[0].content.parts || !resp.candidates[0].content.parts[0]) {
                        cb('Gemini returned an empty response.');
                        return;
                    }
                    text = resp.candidates[0].content.parts[0].text;
                }
                // Extract first balanced JSON object (not greedy regex)
                if (typeof text !== 'string' || text.length > 50000) {
                    cb('Response content too large or invalid.');
                    return;
                }
                var jsonStr = _extractBalancedJSON(text);
                if (jsonStr) {
                    var sceneData = JSON.parse(jsonStr);
                    cb(null, sceneData);
                } else {
                    cb('Could not parse AI response as JSON.');
                }
            } catch (e) {
                cb('Parse error: ' + e.message);
            }
        };
        xhr.ontimeout = function () { cb('Request timed out. Try again.'); };
        xhr.onerror = function () { cb('Network error. Check your connection.'); };
        xhr.send(body);
    }

    /* Extract first balanced { } block from a string.
       Walks the string tracking brace depth, respecting
       double-quoted strings (with backslash escapes).
       Returns the substring or null. */
    function _extractBalancedJSON(text) {
        var start = text.indexOf('{');
        if (start === -1) return null;
        var depth = 0;
        var inStr = false;
        var esc = false;
        for (var i = start; i < text.length; i++) {
            var ch = text[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return text.substring(start, i + 1);
            }
        }
        return null; // unbalanced
    }

    var _MAX_ELEMENTS = 15;
    var _MAX_TEXT_LENGTH = 300;
    var _MAX_DURATION = 500;

    function _aiResponseToScene(data) {
        if (!data || typeof data !== 'object') data = {};
        var sceneId = 'scene-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        var elements = [];
        var rawElements = Array.isArray(data.elements) ? data.elements.slice(0, _MAX_ELEMENTS) : [];
        rawElements.forEach(function (el) {
            if (!el || typeof el !== 'object') return;
            var validTags = ['h1', 'h2', 'h3', 'p', 'span', 'div'];
            var tag = validTags.indexOf(el.tag) >= 0 ? el.tag : 'div';
            var text = (typeof el.text === 'string') ? el.text.substring(0, _MAX_TEXT_LENGTH) : '';
            // Sanitize id to alphanumeric + dashes only
            var rawId = (typeof el.id === 'string') ? el.id.replace(/[^a-zA-Z0-9-_]/g, '') : '';
            var elId = (rawId || tag + '-' + Math.random().toString(36).substr(2, 4)) + '-' + sceneId.substr(-4);
            elements.push({
                id: elId,
                tag: tag,
                text: text,
                style: _sanitizeStyle(el.style),
                scroll: _sanitizeScroll(el.scroll),
                splitText: !!el.splitText,
                parallax: Math.max(0.5, Math.min(2, parseFloat(el.parallax) || 1)),
                visible: true,
                locked: false
            });
        });
        var duration = parseInt(data.duration) || 100;
        duration = Math.max(50, Math.min(_MAX_DURATION, duration));
        return {
            id: sceneId,
            name: (typeof data.name === 'string') ? data.name.substring(0, 60) : 'AI Scene',
            template: 'custom',
            duration: duration,
            pin: data.pin !== false,
            bgColor: (typeof data.bgColor === 'string' && _isSafeCSSValue(data.bgColor)) ? data.bgColor : '',
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
        getDesignTokens: function () { return _designTokens; },
        setDesignTokens: function (t) { if (t && typeof t === 'object') { Object.keys(t).forEach(function (k) { if (_designTokens.hasOwnProperty(k)) _designTokens[k] = t[k]; }); } },
        getCurrentSceneIdx: function () { return _currentSceneIdx; },
        getOverlayScript: _getOverlayScript,
        showAIDialog: _showAIGenerateDialog,
        destroy: function () {
            _active = false;
            _selectedElementId = null;
            _selectedElementIds = [];
            window.removeEventListener('message', _handleMessage);
        }
    };
})();
