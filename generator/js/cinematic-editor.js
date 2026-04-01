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
    var _pages = [];         // [{id, name, path, scenes, seo:{title,description}}]
    var _currentPageIdx = 0; // active page
    var _selectedElementId = null;
    var _selectedElementIds = [];
    var _overrides = {};
    var _zoom = 100;
    var _dragState = null;
    var _activeDevice = 'desktop';  // 'desktop' | 'tablet' | 'mobile'
    var _timelineOpen = false;
    var _uiBound = false;          // guard against duplicate listener binding
    var _clipboard = null;           // copy/paste: deep-cloned element object
    var _styleClipboard = null;      // copy/paste style: cloned style + hoverStyle
    var _keydownHandler = null;      // stored for cleanup in destroy
    var _beforeUnloadHandler = null; // stored for cleanup in destroy

    // ─── Project File State ───
    var _fileHandle = null;           // File System Access API handle
    var _projectDirty = false;        // unsaved changes flag

    /* ─── P6: Content-key ↔ element-ID prefix mapping (for AI copy push) ─── */
    var _CONTENT_PREFIXES = {
        'hero-title':    'heroLine1',
        'hero-sub':      'heroLine2',
        'gh-title':      'heroLine1',
        'gh-sub':        'heroLine2',
        'reveal-line1':  'heroLine1',
        'reveal-line2':  'heroLine2',
        'cta-heading':   'ctaLine1',
        'cta-sub':       'ctaLine2',
        'fg-title':      'servicesHeading',
        'stats-heading': 'servicesHeading',
        'mrq-center':    'tagline'
    };

    function updateContentFromCopy(copy) {
        if (!copy || !_scenes || !_scenes.length) return;
        var changed = false;
        _scenes.forEach(function (scene) {
            (scene.elements || []).forEach(function (el) {
                // Strip the scene-id suffix (last segment after final dash) to get base template prefix
                var prefix = el.id.replace(/-[^-]+$/, '');
                var contentKey = _CONTENT_PREFIXES[prefix];
                if (contentKey && copy[contentKey]) {
                    el.text = copy[contentKey];
                    changed = true;
                }
            });
        });
        if (changed) {
            _renderSceneList();
            _selectScene(_currentSceneIdx);
            _notifyUpdate(true);
        }
    }

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

    /* ─── Shape & Frame Definitions ─── */
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

    /** Build SVG markup for a named shape with given colors. */
    function _buildShapeSvg(shapeName, fillColor, strokeColor, strokeWidth) {
        var def = SHAPE_PATHS[shapeName] || SHAPE_PATHS['circle'];
        var fc = fillColor || 'none';
        var sc = strokeColor || 'none';
        var sw = parseFloat(strokeWidth) || 0;
        var attrs = ' fill="' + fc + '"';
        if (sc !== 'none' && sw > 0) attrs += ' stroke="' + sc + '" stroke-width="' + sw + '"';
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' + def.svg.replace('/>', attrs + '/>') + '</svg>';
    }

    /* ─── DOM Shorthand ─── */
    function _qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function _qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

    /** Return the correct style bucket for the active breakpoint. */
    function _getStyleBucket(el) {
        if (_activeDevice === 'tablet') {
            if (!el.tabletStyle) el.tabletStyle = {};
            return el.tabletStyle;
        }
        if (_activeDevice === 'mobile') {
            if (!el.mobileStyle) el.mobileStyle = {};
            return el.mobileStyle;
        }
        return el.style;
    }

    /**
     * Auto-generate responsive overrides for elements — template-aware.
     * Knows how to stack multi-column layouts (stats, featureGrid, splitMedia)
     * vertically on mobile and adjust positioning/sizes for tablet.
     */
    function _autoResponsive(device) {
        var scenes = _scenes;
        var changed = false;
        var isMobile = (device === 'mobile');
        var scale = isMobile ? 0.6 : 0.85;

        scenes.forEach(function (scene) {
            var tplId = scene.template || '';
            (scene.elements || []).forEach(function (el) {
                if (!el.style) return;
                var bucket = (device === 'tablet') ? el.tabletStyle : el.mobileStyle;
                if (bucket && Object.keys(bucket).length > 0) return;

                var s = el.style;
                var overrides = {};
                var base = el.id.replace(/-[^-]+$/, '');

                // ─── Scale font sizes ───
                if (s.fontSize) {
                    var fs = String(s.fontSize);
                    var vwMatch = fs.match(/^([\d.]+)\s*vw$/);
                    var pxMatch = fs.match(/^([\d.]+)\s*px$/);
                    var remMatch = fs.match(/^([\d.]+)\s*rem$/);
                    if (vwMatch) {
                        overrides.fontSize = (parseFloat(vwMatch[1]) * (isMobile ? 1.8 : 1.15)).toFixed(1) + 'vw';
                    } else if (pxMatch) {
                        overrides.fontSize = Math.round(parseFloat(pxMatch[1]) * scale) + 'px';
                    } else if (remMatch) {
                        overrides.fontSize = (parseFloat(remMatch[1]) * scale).toFixed(2) + 'rem';
                    }
                }

                // ─── MOBILE: Template-specific stacking ───
                if (isMobile) {
                    if (tplId === 'stats') {
                        if (base === 'stats-heading') { overrides.fontSize = '6.5vw'; }
                        else if (base === 'stat-1') {
                            overrides.top = '28%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                            overrides.fontSize = '10vw';
                        } else if (base === 'stat-1-label') {
                            overrides.top = '38%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                        } else if (base === 'stat-2') {
                            overrides.top = '46%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                            overrides.fontSize = '10vw';
                        } else if (base === 'stat-2-label') {
                            overrides.top = '56%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                        } else if (base === 'stat-3') {
                            overrides.top = '64%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                            overrides.fontSize = '10vw';
                        } else if (base === 'stat-3-label') {
                            overrides.top = '74%'; overrides.left = '50%'; overrides.width = '80%';
                            overrides.transform = 'translateX(-50%)'; overrides.textAlign = 'center';
                        }
                    } else if (tplId === 'featureGrid') {
                        if (base === 'fg-title') { overrides.fontSize = '6.5vw'; }
                        else if (base === 'fg-card1') { overrides.top = '16%'; overrides.left = '6%'; overrides.width = '88%'; overrides.height = '20%'; }
                        else if (base === 'fg-c1-title') { overrides.top = '19%'; overrides.left = '10%'; overrides.width = '80%'; }
                        else if (base === 'fg-c1-desc') { overrides.top = '25%'; overrides.left = '10%'; overrides.width = '80%'; }
                        else if (base === 'fg-card2') { overrides.top = '40%'; overrides.left = '6%'; overrides.width = '88%'; overrides.height = '20%'; }
                        else if (base === 'fg-c2-title') { overrides.top = '43%'; overrides.left = '10%'; overrides.width = '80%'; }
                        else if (base === 'fg-c2-desc') { overrides.top = '49%'; overrides.left = '10%'; overrides.width = '80%'; }
                        else if (base === 'fg-card3') { overrides.top = '64%'; overrides.left = '6%'; overrides.width = '88%'; overrides.height = '20%'; }
                        else if (base === 'fg-c3-title') { overrides.top = '67%'; overrides.left = '10%'; overrides.width = '80%'; }
                        else if (base === 'fg-c3-desc') { overrides.top = '73%'; overrides.left = '10%'; overrides.width = '80%'; }
                    } else if (tplId === 'splitMedia') {
                        if (base === 'split-tag') { overrides.top = '4%'; overrides.left = '6%'; }
                        else if (base === 'split-title') { overrides.top = '8%'; overrides.left = '6%'; overrides.width = '88%'; overrides.fontSize = '7vw'; }
                        else if (base === 'split-desc') { overrides.top = '22%'; overrides.left = '6%'; overrides.width = '88%'; }
                        else if (base === 'split-media') { overrides.top = '42%'; overrides.left = '6%'; overrides.width = '88%'; overrides.right = 'auto'; overrides.height = '50%'; }
                    } else if (tplId === 'cardStack') {
                        if (base === 'cs-card1') { overrides.left = '6%'; overrides.width = '88%'; }
                        else if (base === 'cs-card2') { overrides.left = '4%'; overrides.width = '92%'; }
                        else if (base === 'cs-card3') { overrides.left = '2%'; overrides.width = '96%'; }
                        else if (base === 'cs-title') { overrides.width = '80%'; }
                        else if (base === 'cs-desc') { overrides.width = '75%'; }
                    } else if (tplId === 'hero' || tplId === 'gradientHero') {
                        if (base === 'hero-title' || base === 'gh-title') { overrides.width = '90%'; overrides.fontSize = '10vw'; }
                        else if (base === 'hero-sub' || base === 'gh-sub') { overrides.width = '85%'; overrides.fontSize = '1rem'; }
                        else if (base === 'hero-tag' || base === 'gh-tag') { overrides.fontSize = '2.5vw'; }
                        else if (base === 'hero-cta') { overrides.fontSize = '0.8rem'; overrides.padding = '12px 28px'; }
                    } else if (tplId === 'testimonial') {
                        if (base === 'tst-quote') { overrides.width = '85%'; overrides.left = '7.5%'; overrides.fontSize = '5vw'; }
                        else if (base === 'tst-quote-mark') { overrides.fontSize = '18vw'; }
                        else if (base === 'tst-bg') { overrides.width = '300px'; overrides.height = '300px'; }
                    } else if (tplId === 'ctaSection') {
                        if (base === 'cta-heading') { overrides.width = '90%'; overrides.fontSize = '7vw'; }
                        else if (base === 'cta-sub') { overrides.width = '85%'; }
                        else if (base === 'cta-glow') { overrides.width = '250px'; overrides.height = '250px'; }
                    } else if (tplId === 'marquee') {
                        if (base === 'mrq-line1' || base === 'mrq-line2') { overrides.fontSize = '12vw'; }
                        else if (base === 'mrq-center') { overrides.fontSize = '5vw'; overrides.width = '85%'; }
                    } else if (tplId === 'bigText') {
                        if (base === 'bt-word1' || base === 'bt-word2' || base === 'bt-word3') { overrides.fontSize = '16vw'; }
                        else if (base === 'bt-overlay') { overrides.fontSize = '5vw'; overrides.width = '85%'; }
                    } else if (tplId === 'imageReveal') {
                        if (base === 'imgr-frame') { overrides.left = '4%'; overrides.width = '92%'; }
                        else if (base === 'imgr-title') { overrides.fontSize = '6vw'; }
                    } else if (tplId === 'showcase') {
                        if (base === 'showcase-item') { overrides.left = '5%'; overrides.width = '90%'; }
                        else if (base === 'showcase-title') { overrides.fontSize = '5.5vw'; }
                    } else {
                        // Generic mobile: center and widen narrow elements
                        var wStr = String(s.width || '');
                        var wPct = wStr.match(/^([\d.]+)\s*%$/) ? parseFloat(wStr) : -1;
                        var wPx = wStr.match(/^([\d.]+)\s*px$/) ? parseFloat(wStr) : -1;
                        var leftStr = String(s.left || '');
                        var leftPct = leftStr.match(/^([\d.]+)\s*%$/) ? parseFloat(leftStr) : -1;

                        // Elements positioned past 40% left or with narrow width: center them
                        if (wPct > 0 && wPct < 80) {
                            overrides.width = '90%';
                            overrides.left = '5%';
                            overrides.right = 'auto';
                            // Remove translateX centering since we're repositioning
                            if (s.transform && s.transform.indexOf('translateX(-50%)') >= 0) {
                                overrides.transform = s.transform.replace(/translateX\(-50%\)/g, 'translateX(0)');
                            } else if (s.transform && s.transform.indexOf('translate(-50%') >= 0) {
                                overrides.transform = s.transform.replace(/translate\(-50%,/, 'translate(0,');
                            }
                        } else if (wPx > 200) {
                            overrides.width = '90%'; overrides.left = '5%'; overrides.right = 'auto';
                        }
                        // Right-positioned elements
                        if (s.right && !overrides.left) {
                            overrides.right = 'auto'; overrides.left = '5%'; overrides.width = '90%';
                        }
                        // Elements with high left% but no width override yet
                        if (leftPct >= 40 && !overrides.left) {
                            overrides.left = '5%'; overrides.width = '90%'; overrides.right = 'auto';
                            if (s.transform && s.transform.indexOf('-50%') >= 0) {
                                overrides.transform = s.transform.replace(/translateX?\(-50%[^)]*\)/g, 'translateX(0)');
                            }
                        }
                        var leftPx = leftStr.match(/^([\d.]+)\s*px$/);
                        if (leftPx && parseFloat(leftPx[1]) > 200) { overrides.left = '5%'; }
                        var topStr = String(s.top || '');
                        var topPx = topStr.match(/^([\d.]+)\s*px$/);
                        if (topPx && parseFloat(topPx[1]) > 600) { overrides.top = Math.round(parseFloat(topPx[1]) * 0.5) + 'px'; }
                    }
                    // Scale down large padding for mobile
                    if (s.padding) {
                        var pad = String(s.padding);
                        var padPx = pad.match(/^([\d.]+)\s*px$/);
                        if (padPx && parseFloat(padPx[1]) > 20) {
                            overrides.padding = Math.round(parseFloat(padPx[1]) * 0.6) + 'px';
                        }
                    }
                }
                // ─── TABLET handling ───
                else {
                    if (tplId === 'stats') {
                        if (base === 'stat-1') { overrides.left = '8%'; overrides.width = '25%'; }
                        else if (base === 'stat-3') { overrides.left = '60%'; overrides.width = '25%'; }
                    } else if (tplId === 'featureGrid') {
                        if (base === 'fg-card1') { overrides.width = '30%'; overrides.left = '2%'; }
                        else if (base === 'fg-c1-title') { overrides.left = '5%'; overrides.width = '24%'; }
                        else if (base === 'fg-c1-desc') { overrides.left = '5%'; overrides.width = '24%'; }
                        else if (base === 'fg-card2') { overrides.width = '30%'; overrides.left = '35%'; }
                        else if (base === 'fg-c2-title') { overrides.left = '38%'; overrides.width = '24%'; }
                        else if (base === 'fg-c2-desc') { overrides.left = '38%'; overrides.width = '24%'; }
                        else if (base === 'fg-card3') { overrides.width = '30%'; overrides.left = '68%'; }
                        else if (base === 'fg-c3-title') { overrides.left = '71%'; overrides.width = '24%'; }
                        else if (base === 'fg-c3-desc') { overrides.left = '71%'; overrides.width = '24%'; }
                    } else if (tplId === 'splitMedia') {
                        if (base === 'split-title') { overrides.width = '42%'; }
                        else if (base === 'split-desc') { overrides.width = '40%'; }
                        else if (base === 'split-media') { overrides.width = '38%'; }
                    } else {
                        var wStr = String(s.width || '');
                        var wPct = wStr.match(/^([\d.]+)\s*%$/) ? parseFloat(wStr) : -1;
                        var wPx = wStr.match(/^([\d.]+)\s*px$/) ? parseFloat(wStr) : -1;
                        if (wPct > 0 && wPct < 45) {
                            overrides.width = Math.min(wPct * 1.3, 80).toFixed(0) + '%';
                        } else if (wPx > 500) {
                            overrides.width = '75%';
                        }
                        var leftStr = String(s.left || '');
                        var leftPx = leftStr.match(/^([\d.]+)\s*px$/);
                        if (leftPx && parseFloat(leftPx[1]) > 500) {
                            overrides.left = Math.round(parseFloat(leftPx[1]) * 0.7) + 'px';
                        }
                    }
                }

                if (Object.keys(overrides).length > 0) {
                    if (device === 'tablet') {
                        if (!el.tabletStyle) el.tabletStyle = {};
                        Object.keys(overrides).forEach(function (k) { el.tabletStyle[k] = overrides[k]; });
                    } else {
                        if (!el.mobileStyle) el.mobileStyle = {};
                        Object.keys(overrides).forEach(function (k) { el.mobileStyle[k] = overrides[k]; });
                    }
                    changed = true;
                }
            });
        });
        return changed;
    }

    /* ─── Initialize ─── */
    function init(iframe, containerEl, onUpdateCb) {
        _iframe = iframe;
        _container = containerEl;
        _onUpdate = onUpdateCb;
        _active = true;

        // Try to restore autosaved state
        if (_scenes.length === 0) {
            var saved = _restoreAutosave();
            if (saved) {
                _scenes = saved.scenes;
                if (saved.overrides) _overrides = saved.overrides;
                if (saved.designTokens && typeof saved.designTokens === 'object') {
                    Object.keys(saved.designTokens).forEach(function (k) {
                        if (_designTokens.hasOwnProperty(k)) _designTokens[k] = saved.designTokens[k];
                    });
                }
                // Migrate: move SVG from .text to .svgContent for old elements
                _scenes.forEach(function (sc) {
                    sc.elements.forEach(function (el) {
                        if (el.text && el.text.indexOf('<svg') >= 0 && !el.svgContent) {
                            el.svgContent = el.text;
                            el.text = '';
                        }
                    });
                });
            }
        }

        // Always clear transient editing flags on init — they must never persist
        delete _overrides._editingMenuOverlay;
        // Remove any stale _nav-overlay scene left from a previous session
        _scenes = _scenes.filter(function (s) { return s.id !== '_nav-overlay'; });

        // Start with one hero scene if nothing restored
        if (_scenes.length === 0) {
            _scenes.push(ArbelCinematicCompiler.createScene('hero', 0));
        }

        // Ensure responsive overrides exist for all scenes
        _autoResponsive('tablet');
        _autoResponsive('mobile');

        _setupUI();
        _renderSceneList();
        _selectScene(0, true);

        window.addEventListener('message', _handleMessage);

        // Warn before closing with unsaved changes
        _beforeUnloadHandler = function (e) {
            if (_projectDirty) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', _beforeUnloadHandler);
    }

    /* ─── Message handler from iframe ─── */
    function _handleMessage(e) {
        if (!_active) return;
        // Only accept messages from our own iframe
        if (!_iframe || e.source !== _iframe.contentWindow) return;
        var d;
        try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
        if (!d || !d.type) return;

        // Forward keyboard events from iframe to the parent keydown handler
        if (d.type === 'arbel-key') {
            // Handle Delete/Backspace directly for reliability (no activeElement dependency)
            if ((d.key === 'Delete' || d.key === 'Backspace') && _selectedElementIds.length > 0) {
                _deleteSelectedElement();
                return;
            }
            if (d.key === 'Escape') {
                _selectedElementId = null;
                _selectedElementIds = [];
                _clearProperties();
                _postIframe('arbel-deselect-all', {});
                return;
            }
            if (_keydownHandler) {
                _keydownHandler({ key: d.key, ctrlKey: !!d.ctrl, metaKey: !!d.ctrl, shiftKey: !!d.shift, altKey: !!d.alt, preventDefault: function () {} });
            }
            return;
        }

        if (d.type === 'arbel-select') {
            _iframeTextUndoPushed = false; // reset on element switch
            // Auto-switch scene if clicked element is in a different scene
            if (typeof d.sceneIndex === 'number' && d.sceneIndex >= 0 && d.sceneIndex !== _currentSceneIdx && d.sceneIndex < _scenes.length) {
                _currentSceneIdx = d.sceneIndex;
                _renderSceneList();
                _renderElementList();
            }
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
            // Auto-switch to Style tab when selecting an element
            var styleTab = _container ? _container.querySelector('.cne-prop-tab[data-tab="style"]') : null;
            if (styleTab) styleTab.click();
        }
        if (d.type === 'arbel-text-update' && d.id) {
            // Snapshot BEFORE the first inline text mutation from iframe
            if (!_iframeTextUndoPushed && !_undoLocked) {
                _pushUndo();
                _iframeTextUndoPushed = true;
            }
            // Update scene element model directly so properties panel stays in sync
            var scene = _scenes[_currentSceneIdx];
            if (scene) {
                for (var ti = 0; ti < scene.elements.length; ti++) {
                    if (scene.elements[ti].id === d.id) {
                        scene.elements[ti].text = d.text;
                        break;
                    }
                }
            }
            // Update text input in properties panel
            var textInput = _qs('#cneTextInput');
            if (textInput && _selectedElementId === d.id) textInput.value = d.text;
            _notifyUpdate();
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
                        var bucket = _getStyleBucket(scene.elements[i]);
                        bucket.top = d.top;
                        bucket.left = d.left;
                        break;
                    }
                }
            }
            var posTop = _qs('#cnePosTop');
            var posLeft = _qs('#cnePosLeft');
            if (posTop) posTop.value = d.top;
            if (posLeft) posLeft.value = d.left;
            _notifyUpdate(_activeDevice !== 'desktop');
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
                            var bucket = _getStyleBucket(scene.elements[i]);
                            bucket.top = mv.top;
                            bucket.left = mv.left;
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
            _notifyUpdate(_activeDevice !== 'desktop');
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
                        var bucket = _getStyleBucket(scene.elements[i]);
                        bucket.width = d.width;
                        bucket.height = d.height;
                        bucket.top = d.top;
                        bucket.left = d.left;
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
            _notifyUpdate(_activeDevice !== 'desktop');
        }
        if (d.type === 'arbel-resize-end') {
            _resizeUndoPushed = false;
        }
        if (d.type === 'arbel-rotate' && d.id) {
            var scene = _scenes[_currentSceneIdx];
            if (scene) {
                for (var i = 0; i < scene.elements.length; i++) {
                    if (scene.elements[i].id === d.id) {
                        var bucket = _getStyleBucket(scene.elements[i]);
                        var cur = bucket.transform || '';
                        cur = cur.replace(/rotate\([^)]+\)/, '').trim();
                        bucket.transform = (cur + ' rotate(' + d.deg + 'deg)').trim();
                        break;
                    }
                }
            }
            _notifyUpdate(_activeDevice !== 'desktop');
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

        // Responsive panel toggles
        _setupPanelToggles();

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

        // Page management buttons
        var addPageBtn = _qs('#cneAddPage');
        if (addPageBtn) addPageBtn.addEventListener('click', function () { _addPage(); });
        var pageSettingsBtn = _qs('#cnePageSettings');
        if (pageSettingsBtn) pageSettingsBtn.addEventListener('click', function () {
            _ensurePages();
            _showPageSEO(_currentPageIdx);
        });

        _ensurePages();
        _renderPageList();
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
            if (_scenes.length > 1 && _scenes[i].id !== '_nav-overlay') actions.appendChild(delBtn);

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
        _iframeTextUndoPushed = false;
        _dragUndoPushed = false;
        _resizeUndoPushed = false;
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

            // 3D background fields
            var bg3d = _qs('#cneSceneBg3d'); if (bg3d) bg3d.value = scene.bg3dType || '';
            var bg3dc1 = _qs('#cneBg3dColor1'); if (bg3dc1) bg3dc1.value = scene.bg3dColor1 || '#6c5ce7';
            var bg3dc2 = _qs('#cneBg3dColor2'); if (bg3dc2) bg3dc2.value = scene.bg3dColor2 || '#00cec9';
            var bg3dInt = _qs('#cneBg3dIntensity'); if (bg3dInt) bg3dInt.value = scene.bg3dIntensity || '5';
            var bg3dSpd = _qs('#cneBg3dSpeed'); if (bg3dSpd) bg3dSpd.value = scene.bg3dSpeed || 'medium';
            var bg3dColRow = _qs('#cneBg3dColorRow');
            var bg3dIntRow = _qs('#cneBg3dIntensityRow');
            var bg3dSpdRow = _qs('#cneBg3dSpeedRow');
            var show3d = !!(scene.bg3dType);
            if (bg3dColRow) bg3dColRow.style.display = show3d ? '' : 'none';
            if (bg3dIntRow) bg3dIntRow.style.display = show3d ? '' : 'none';
            if (bg3dSpdRow) bg3dSpdRow.style.display = show3d ? '' : 'none';
            var bg3dWarn = _qs('#cneBg3dWarning'); if (bg3dWarn) bg3dWarn.style.display = show3d ? '' : 'none';

            // Enhanced particle controls
            var isParticleType = ['particles','bubbles','stars','snow','fireflies','confetti','matrix','star-field','particle-field'].indexOf(scene.bg3dType) >= 0;
            var bg3dCountRow = _qs('#cneBg3dCountRow'); if (bg3dCountRow) bg3dCountRow.style.display = isParticleType ? '' : 'none';
            var bg3dSizeRow = _qs('#cneBg3dSizeRow'); if (bg3dSizeRow) bg3dSizeRow.style.display = isParticleType ? '' : 'none';
            var bg3dGlowRow = _qs('#cneBg3dGlowRow'); if (bg3dGlowRow) bg3dGlowRow.style.display = isParticleType ? '' : 'none';
            var bg3dColor3Row = _qs('#cneBg3dColor3Row'); if (bg3dColor3Row) bg3dColor3Row.style.display = isParticleType ? '' : 'none';
            var bg3dInterRow = _qs('#cneBg3dInteractiveRow'); if (bg3dInterRow) bg3dInterRow.style.display = isParticleType ? '' : 'none';
            var bg3dCnt = _qs('#cneBg3dCount'); if (bg3dCnt) bg3dCnt.value = scene.bg3dCount || 60;
            var bg3dCntV = _qs('#cneBg3dCountVal'); if (bg3dCntV) bg3dCntV.textContent = scene.bg3dCount || 60;
            var bg3dSz = _qs('#cneBg3dSize'); if (bg3dSz) bg3dSz.value = scene.bg3dSize || 4;
            var bg3dSzV = _qs('#cneBg3dSizeVal'); if (bg3dSzV) bg3dSzV.textContent = (scene.bg3dSize || 4) + 'px';
            var bg3dGl = _qs('#cneBg3dGlow'); if (bg3dGl) bg3dGl.value = scene.bg3dGlow || 8;
            var bg3dGlV = _qs('#cneBg3dGlowVal'); if (bg3dGlV) bg3dGlV.textContent = (scene.bg3dGlow || 8) + 'px';
            var bg3dc3 = _qs('#cneBg3dColor3'); if (bg3dc3) bg3dc3.value = scene.bg3dColor3 || '#fd79a8';
            var bg3dInter = _qs('#cneBg3dInteractive'); if (bg3dInter) bg3dInter.checked = !!scene.bg3dInteractive;

            // Video scroll layer
            var vsPreset = _qs('#cneVideoScrollPreset'); if (vsPreset) vsPreset.value = scene.videoScrollPreset || '';
            var vsOpts = _qs('#cneVideoScrollOpts'); if (vsOpts) vsOpts.style.display = scene.videoScrollPreset ? '' : 'none';
            var vsSpeed = _qs('#cneVideoScrollSpeed'); if (vsSpeed) vsSpeed.value = scene.videoScrollSpeed || 1;
            var vsSpeedV = _qs('#cneVideoScrollSpeedVal'); if (vsSpeedV) vsSpeedV.textContent = (scene.videoScrollSpeed || 1) + 'x';
            var vsOpacity = _qs('#cneVideoScrollOpacity'); if (vsOpacity) vsOpacity.value = scene.videoScrollOpacity || 60;
            var vsOpacV = _qs('#cneVideoScrollOpacityVal'); if (vsOpacV) vsOpacV.textContent = (scene.videoScrollOpacity || 60) + '%';
            var vsc1 = _qs('#cneVideoScrollColor1'); if (vsc1) vsc1.value = scene.videoScrollColor1 || '#6c5ce7';
            var vsc2 = _qs('#cneVideoScrollColor2'); if (vsc2) vsc2.value = scene.videoScrollColor2 || '#00cec9';
            // Spline 3D embed
            var spline = _qs('#cneSceneSpline'); if (spline) spline.value = scene.splineUrl || '';
            var splineInfo = _qs('#cneSplineInfo'); if (splineInfo) splineInfo.style.display = scene.splineUrl ? '' : 'none';
            // Custom code fields (site-wide, stored in _overrides)
            var customHead = _qs('#cneCustomHead'); if (customHead) customHead.value = _overrides.customHead || '';
            var customCSS = _qs('#cneCustomCSS'); if (customCSS) customCSS.value = _overrides.customCSS || '';
            var customBodyEnd = _qs('#cneCustomBodyEnd'); if (customBodyEnd) customBodyEnd.value = _overrides.customBodyEnd || '';

            // Reset scene bg file inputs & update status indicators
            var _sbgU = _qs('#cneSceneBgUpload'); if (_sbgU) _sbgU.value = '';
            var _sbgV = _qs('#cneSceneBgVideoUpload'); if (_sbgV) _sbgV.value = '';
            var _sbgIS = _qs('#cneSceneBgImgStatus'); if (_sbgIS) _sbgIS.style.display = scene.bgImage ? '' : 'none';
            var _sbgIR = _qs('#cneSceneBgImgRemove'); if (_sbgIR) _sbgIR.style.display = scene.bgImage ? '' : 'none';
            var _sbgVS = _qs('#cneSceneBgVidStatus'); if (_sbgVS) _sbgVS.style.display = scene.bgVideo ? '' : 'none';
            var _sbgVR = _qs('#cneSceneBgVidRemove'); if (_sbgVR) _sbgVR.style.display = scene.bgVideo ? '' : 'none';

            // Sync reveal layer panel
            _syncRevealLayerUI();
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
        // Prevent deleting the overlay scene during overlay editing
        if (_scenes[idx] && _scenes[idx].id === '_nav-overlay') return;
        _pushUndo();
        _scenes.splice(idx, 1);
        if (_currentSceneIdx >= _scenes.length) _currentSceneIdx = _scenes.length - 1;
        _selectScene(_currentSceneIdx, true);
    }

    /* ─── Page Management (multi-page routing) ─── */
    function _ensurePages() {
        if (_pages.length === 0) {
            _pages = [{ id: 'page-' + Date.now().toString(36), name: 'Home', path: '/', scenes: _scenes, seo: { title: '', description: '' } }];
            _currentPageIdx = 0;
        }
    }

    function _renderPageList() {
        var list = _qs('#cnePageList');
        if (!list) return;
        _ensurePages();
        list.innerHTML = '';
        _pages.forEach(function (page, i) {
            var div = document.createElement('div');
            div.className = 'cne-page-item' + (i === _currentPageIdx ? ' active' : '');
            div.innerHTML = '<span class="cne-page-name">' + (page.name || 'Page') + '</span><span class="cne-page-path">' + (page.path || '/') + '</span>';
            div.addEventListener('click', function () { _selectPage(i); });
            // Right-click to rename/delete
            div.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                _showPageContextMenu(e.clientX, e.clientY, i);
            });
            list.appendChild(div);
        });
    }

    function _selectPage(idx) {
        _ensurePages();
        if (idx < 0 || idx >= _pages.length) return;
        // Save current scenes back to current page
        _pages[_currentPageIdx].scenes = _scenes;
        _currentPageIdx = idx;
        _scenes = _pages[idx].scenes || [];
        _currentSceneIdx = 0;
        _selectedElementId = null;
        _selectedElementIds = [];
        _renderPageList();
        _renderSceneList();
        if (_scenes.length > 0) _selectScene(0, true);
        _notifyUpdate(true);
    }

    function _addPage() {
        _ensurePages();
        _pages[_currentPageIdx].scenes = _scenes;
        var pageName = 'Page ' + (_pages.length + 1);
        var pagePath = '/' + pageName.toLowerCase().replace(/\s+/g, '-');
        var newPage = {
            id: 'page-' + Date.now().toString(36),
            name: pageName,
            path: pagePath,
            scenes: [{ id: 'scene-' + Date.now().toString(36), name: 'Hero', pin: true, duration: 100, bgColor: '#0a0a0f', elements: [] }],
            seo: { title: '', description: '' }
        };
        _pushUndo();
        _pages.push(newPage);
        _selectPage(_pages.length - 1);
    }

    function _deletePage(idx) {
        if (_pages.length <= 1) return;
        _pushUndo();
        _pages.splice(idx, 1);
        if (_currentPageIdx >= _pages.length) _currentPageIdx = _pages.length - 1;
        _scenes = _pages[_currentPageIdx].scenes || [];
        _currentSceneIdx = 0;
        _selectedElementId = null;
        _selectedElementIds = [];
        _renderPageList();
        _renderSceneList();
        if (_scenes.length > 0) _selectScene(0, true);
        _notifyUpdate(true);
    }

    function _renamePage(idx) {
        if (!_pages[idx]) return;
        var current = _pages[idx].name || '';
        var name = prompt('Page name:', current);
        if (name === null || name.trim() === '') return;
        _pushUndo();
        _pages[idx].name = name.trim();
        if (idx !== 0) {
            _pages[idx].path = '/' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        _renderPageList();
        _notifyUpdate();
    }

    function _showPageContextMenu(x, y, idx) {
        _hideContextMenu();
        var menu = document.createElement('div');
        menu.className = 'arbel-ctx-menu';
        function addItem(label, action, cls) {
            var item = document.createElement('div');
            item.className = 'arbel-ctx-item' + (cls ? ' ' + cls : '');
            item.innerHTML = '<span>' + label + '</span>';
            if (action) item.addEventListener('click', function () { _hideContextMenu(); action(); });
            else item.setAttribute('data-disabled', '');
            menu.appendChild(item);
        }
        addItem('Rename', function () { _renamePage(idx); });
        addItem('Duplicate', function () {
            _ensurePages();
            _pages[_currentPageIdx].scenes = _scenes;
            _pushUndo();
            var clone = JSON.parse(JSON.stringify(_pages[idx]));
            clone.id = 'page-' + Date.now().toString(36);
            clone.name = clone.name + ' Copy';
            clone.path = clone.path + '-copy';
            _pages.push(clone);
            _selectPage(_pages.length - 1);
        });
        if (_pages.length > 1) {
            addItem('Delete', function () { _deletePage(idx); }, 'arbel-ctx-item--danger');
        }
        addItem('SEO Settings', function () { _showPageSEO(idx); });
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

    function _showPageSEO(idx) {
        var page = _pages[idx];
        if (!page) return;
        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';
        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog';
        dialog.style.gap = '12px';
        dialog.innerHTML = '<h3 style="margin:0;font-size:1rem">Page SEO — ' + (page.name || 'Page') + '</h3>' +
            '<label class="cne-hint mono" style="display:block">URL Path</label>' +
            '<input type="text" class="gen-input" id="dlgPagePath" value="' + (page.path || '/').replace(/"/g, '&quot;') + '" placeholder="/">' +
            '<label class="cne-hint mono" style="display:block">Meta Title</label>' +
            '<input type="text" class="gen-input" id="dlgPageTitle" value="' + ((page.seo && page.seo.title) || '').replace(/"/g, '&quot;') + '" placeholder="Page Title">' +
            '<label class="cne-hint mono" style="display:block">Meta Description</label>' +
            '<textarea class="gen-input" id="dlgPageDesc" rows="3" placeholder="Page description for SEO">' + ((page.seo && page.seo.description) || '') + '</textarea>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="cne-toolbar-btn" id="dlgPageCancel">Cancel</button><button class="cne-toolbar-btn cne-toolbar-btn--accent" id="dlgPageSave">Save</button></div>';
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        dialog.querySelector('#dlgPageCancel').addEventListener('click', function () { overlay.remove(); });
        dialog.querySelector('#dlgPageSave').addEventListener('click', function () {
            _pushUndo();
            page.path = dialog.querySelector('#dlgPagePath').value.trim() || '/';
            if (!page.seo) page.seo = {};
            page.seo.title = dialog.querySelector('#dlgPageTitle').value.trim();
            page.seo.description = dialog.querySelector('#dlgPageDesc').value.trim();
            _renderPageList();
            overlay.remove();
        });
    }

    /* ─── Element List (inside scene panel) ─── */
    var _dragElIdx = -1; // track drag source index for layer reorder

    function _renderElementList() {
        var list = _qs('#cneElementList');
        if (!list) return;

        var scene = _scenes[_currentSceneIdx];
        if (!scene) { list.innerHTML = ''; return; }

        list.innerHTML = '';
        scene.elements.forEach(function (el, i) {
            var row = document.createElement('div');
            row.className = 'cne-el-item' + (_selectedElementIds.indexOf(el.id) >= 0 ? ' active' : '');
            row.draggable = true;
            row.dataset.elIdx = i;

            // Drag-to-reorder handlers
            row.addEventListener('dragstart', function (e) {
                _dragElIdx = i;
                row.classList.add('cne-el-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', function () {
                _dragElIdx = -1;
                row.classList.remove('cne-el-dragging');
                var all = list.querySelectorAll('.cne-el-item');
                for (var k = 0; k < all.length; k++) all[k].classList.remove('cne-el-dragover');
            });
            row.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var all = list.querySelectorAll('.cne-el-item');
                for (var k = 0; k < all.length; k++) all[k].classList.remove('cne-el-dragover');
                row.classList.add('cne-el-dragover');
            });
            row.addEventListener('dragleave', function () {
                row.classList.remove('cne-el-dragover');
            });
            row.addEventListener('drop', function (e) {
                e.preventDefault();
                row.classList.remove('cne-el-dragover');
                if (_dragElIdx < 0 || _dragElIdx === i) return;
                _pushUndo();
                var moved = scene.elements.splice(_dragElIdx, 1)[0];
                scene.elements.splice(i, 0, moved);
                _dragElIdx = -1;
                _renderElementList();
                _notifyUpdate(true);
            });

            // Z-index badge
            var zBadge = document.createElement('span');
            zBadge.className = 'cne-el-zbadge mono';
            var zVal = (el.style && el.style.zIndex) ? el.style.zIndex : String(i);
            zBadge.textContent = 'z' + zVal;
            zBadge.title = 'z-index: ' + zVal;

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
            nameSpan.appendChild(document.createTextNode(
                el.text ? el.text.substr(0, 30) :
                el.tag === 'img' ? 'Image' :
                el.tag === 'video' ? 'Video' :
                el.lottieUrl !== undefined ? 'Lottie' :
                el.frameShape ? (el.frameShape.charAt(0).toUpperCase() + el.frameShape.slice(1) + ' Frame') :
                el.shapeName ? (el.shapeName.charAt(0).toUpperCase() + el.shapeName.slice(1) + ' Shape') :
                el.svgContent !== undefined ? 'SVG' :
                el.embedUrl !== undefined ? 'Embed' :
                el.id
            ));

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
                if (clone.group) clone.group = 'grp-' + Date.now().toString(36) + '-dup';
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
            row.appendChild(zBadge);
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
                    // Auto-switch to Style tab
                    var stTab = _container ? _container.querySelector('.cne-prop-tab[data-tab="style"]') : null;
                    if (stTab) stTab.click();
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
        var svgHtml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + pathD + '"/></svg>';
        var newEl = {
            id: 'div-' + Date.now().toString(36),
            tag: 'div',
            text: '',
            svgContent: svgHtml,
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
        raw = raw.replace(/xlink:href\s*=\s*["'][^"'#][^"']*/gi, 'xlink:href="#"');  // strip non-fragment xlink:href (S9)
        raw = raw.replace(/<a[\s\S]*?<\/a>/gi, '');  // strip <a> elements in SVG (S9)
        raw = raw.replace(/\shref\s*=\s*["'][^"']*["']/gi, '');  // strip all href attributes (S9)
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var newEl = {
            id: 'div-' + Date.now().toString(36),
            tag: 'div',
            text: '',
            svgContent: raw,
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
        dialog.className = 'arbel-dialog arbel-dialog--add-el';

        // ── Header ──
        var header = document.createElement('div');
        header.className = 'aed-header';
        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
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
                // Category header (only in "All" tab or search)
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

        // Focus search
        setTimeout(function () { searchInput.focus(); }, 60);

        // Keyboard close
        function onKey(e) { if (e.key === 'Escape') { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); } }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
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
        } else if (t.tag === 'div' && t.variant === 'shape') {
            var shapeDef = SHAPE_PATHS[t.shapeName] || SHAPE_PATHS['circle'];
            newEl.shapeName = t.shapeName;
            newEl.shapeColor = '#ffffff';
            newEl.shapeStroke = 'none';
            newEl.shapeStrokeWidth = 0;
            if (shapeDef.isStroke) {
                newEl.shapeColor = 'none';
                newEl.shapeStroke = '#ffffff';
                newEl.shapeStrokeWidth = 8;
            }
            newEl.svgContent = _buildShapeSvg(newEl.shapeName, newEl.shapeColor, newEl.shapeStroke, newEl.shapeStrokeWidth);
            newEl.frameSrc = '';
            newEl.frameMediaType = 'image';
            newEl.frameObjectFit = 'cover';
            newEl.style = {
                position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
                width: '200px', height: '200px', overflow: 'hidden'
            };
            if (shapeDef.clip) {
                newEl.style.clipPath = shapeDef.clip;
            }
        } else if (t.tag === 'div' && t.variant === 'frame') {
            var frameDef = SHAPE_PATHS[t.frameName] || SHAPE_PATHS['circle'];
            newEl.frameShape = t.frameName;
            newEl.frameSrc = '';
            newEl.frameMediaType = 'image';
            newEl.frameObjectFit = 'cover';
            newEl.style = {
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: '300px', height: '300px', overflow: 'hidden'
            };
            if (frameDef.clip) {
                newEl.style.clipPath = frameDef.clip;
            }
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
        } else if (t.tag === 'div' && t.variant === '3d-card') {
            newEl.style = {
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: '280px', height: '360px', borderRadius: '16px',
                background: 'linear-gradient(145deg, rgba(108,92,231,0.15), rgba(0,0,0,0.3))',
                border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                transformStyle: 'preserve-3d', perspective: '800px'
            };
            newEl.scroll = { rotateY: [0, 180], opacity: [1, 1], start: 0, end: 0.5 };
        } else if (t.tag === 'div' && t.variant === '3d-rotate') {
            newEl.style = {
                position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)',
                width: '200px', height: '200px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #6C5CE7, #a855f7)',
                transformStyle: 'preserve-3d', perspective: '600px'
            };
            newEl.scroll = { rotateX: [0, 360], rotateY: [0, 360], scale: [0.8, 1], start: 0, end: 1 };
        } else if (t.tag === 'div' && t.variant === '3d-float') {
            newEl.style = {
                position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
                width: '320px', height: '220px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(16px)', transformStyle: 'preserve-3d', perspective: '1000px'
            };
            newEl.scroll = { y: [-40, 40], rotateX: [-5, 5], rotateY: [-5, 5], scale: [0.95, 1.05], start: 0, end: 1 };
            newEl.parallax = 1.4;
        } else if (t.tag === 'div' && t.variant === '3d-tilt') {
            newEl.style = {
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: '400px', height: '300px', borderRadius: '8px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.06)',
                transformStyle: 'preserve-3d', perspective: '800px'
            };
            newEl.scroll = { rotateX: [15, -15], rotateY: [-10, 10], opacity: [0.6, 1], start: 0, end: 0.6 };
        } else if (t.tag === 'canvas' && t.variant === 'webgl') {
            newEl.style = {
                position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                width: '600px', height: '400px', borderRadius: '12px',
                background: '#0a0a0f'
            };
            newEl.webgl = true;
            newEl.scroll = { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4 };
        } else if (t.tag === 'div' && t.variant === 'lottie') {
            newEl.lottieUrl = '';
            newEl.style = {
                position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
                width: '300px', height: '300px'
            };
            newEl.scroll = { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4 };
        } else if (t.tag === 'div' && t.variant === 'svg') {
            newEl.svgContent = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" stroke="#6C5CE7" stroke-width="3" fill="none"/></svg>';
            newEl.style = {
                position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
                width: '200px', height: '200px'
            };
        } else if (t.tag === 'div' && t.variant === 'embed') {
            newEl.embedUrl = '';
            newEl.style = {
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: '560px', height: '315px', borderRadius: '12px',
                overflow: 'hidden'
            };
        } else if (t.tag === 'form' && t.variant === 'form') {
            newEl.tag = 'form';
            newEl.formAction = '';
            newEl.formMethod = 'POST';
            newEl.formFields = [
                { name: 'name', type: 'text', label: 'Name', placeholder: 'Your name', required: true },
                { name: 'email', type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
                { name: 'message', type: 'textarea', label: 'Message', placeholder: 'Your message...', required: false }
            ];
            newEl.formSubmitText = 'Send Message';
            newEl.style = {
                position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: '400px', padding: '32px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)'
            };
            newEl.scroll = { opacity: [0, 1], y: [40, 0], start: 0, end: 0.4, ease: 'power2.out' };
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

        // Video upload
        var videoUpload = _qs('#cneVideoUpload');
        if (videoUpload) {
            videoUpload.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el || !videoUpload.files || !videoUpload.files[0]) return;
                var file = videoUpload.files[0];
                if (file.size > 10 * 1024 * 1024) { alert('Video must be under 10MB'); return; }
                _pushUndo();
                var reader = new FileReader();
                reader.onload = function (e) {
                    el.src = e.target.result;
                    var srcInput = _qs('#cneVideoSrc');
                    if (srcInput) srcInput.value = '(uploaded)';
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Stock Photos button
        var stockBtn = _qs('#cneStockBtn');
        if (stockBtn) {
            stockBtn.addEventListener('click', function () {
                _showStockPhotosDialog();
            });
        }

        // Lottie URL
        var lottieUrl = _qs('#cneLottieUrl');
        if (lottieUrl) {
            lottieUrl.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('lottie');
                    el.lottieUrl = lottieUrl.value;
                    _commitBurst('lottie', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // SVG content
        var svgContent = _qs('#cneSvgContent');
        if (svgContent) {
            svgContent.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('svg');
                    el.svgContent = svgContent.value;
                    _commitBurst('svg', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // ─── Shape color controls ───
        function _onShapeColorChange() {
            var el = _getSelectedElement();
            if (!el || !el.shapeName) return;
            _pushUndo();
            var scFill = _qs('#cneShapeColor');
            var scStroke = _qs('#cneShapeStroke');
            var scSW = _qs('#cneShapeStrokeWidth');
            el.shapeColor = scFill ? scFill.value : (el.shapeColor || '#ffffff');
            el.shapeStroke = scStroke ? scStroke.value : (el.shapeStroke || 'none');
            el.shapeStrokeWidth = scSW ? parseFloat(scSW.value) || 0 : (el.shapeStrokeWidth || 0);
            el.svgContent = _buildShapeSvg(el.shapeName, el.shapeColor, el.shapeStroke, el.shapeStrokeWidth);
            var svgInput = _qs('#cneSvgContent');
            if (svgInput) svgInput.value = el.svgContent;
            _notifyUpdate(true);
        }
        var shapeColorInput = _qs('#cneShapeColor');
        if (shapeColorInput) shapeColorInput.addEventListener('input', _onShapeColorChange);
        var shapeStrokeInput = _qs('#cneShapeStroke');
        if (shapeStrokeInput) shapeStrokeInput.addEventListener('input', _onShapeColorChange);
        var shapeStrokeWidth = _qs('#cneShapeStrokeWidth');
        if (shapeStrokeWidth) shapeStrokeWidth.addEventListener('input', _onShapeColorChange);

        // Embed URL
        var embedUrl = _qs('#cneEmbedUrl');
        if (embedUrl) {
            embedUrl.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el) {
                    _beginBurst('embed');
                    el.embedUrl = embedUrl.value;
                    _commitBurst('embed', 600);
                    _notifyUpdate(true);
                }
            });
        }

        // ─── Frame controls (also used by shapes with media) ───
        function _isFrameOrShape(el) { return el && (el.frameShape || el.shapeName); }
        var frameMediaType = _qs('#cneFrameMediaType');
        if (frameMediaType) {
            frameMediaType.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (_isFrameOrShape(el)) {
                    _pushUndo();
                    el.frameMediaType = frameMediaType.value;
                    el.frameSrc = '';
                    var fmImgRow = _qs('#cneFrameImgRow'); if (fmImgRow) fmImgRow.style.display = (frameMediaType.value !== 'video') ? '' : 'none';
                    var fmVideoRow = _qs('#cneFrameVideoRow'); if (fmVideoRow) fmVideoRow.style.display = (frameMediaType.value === 'video') ? '' : 'none';
                    _notifyUpdate(true);
                }
            });
        }
        var frameSrcInput = _qs('#cneFrameSrc');
        if (frameSrcInput) {
            frameSrcInput.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (_isFrameOrShape(el)) {
                    _beginBurst('frameSrc');
                    el.frameSrc = frameSrcInput.value;
                    _commitBurst('frameSrc', 600);
                    _notifyUpdate(true);
                }
            });
        }
        var frameVideoSrc = _qs('#cneFrameVideoSrc');
        if (frameVideoSrc) {
            frameVideoSrc.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (_isFrameOrShape(el)) {
                    _beginBurst('frameVid');
                    el.frameSrc = frameVideoSrc.value;
                    _commitBurst('frameVid', 600);
                    _notifyUpdate(true);
                }
            });
        }
        var frameUpload = _qs('#cneFrameUpload');
        if (frameUpload) {
            frameUpload.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!_isFrameOrShape(el) || !frameUpload.files || !frameUpload.files[0]) return;
                var file = frameUpload.files[0];
                var isVid = /^video\//.test(file.type);
                var maxSize = isVid ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
                if (file.size > maxSize) { alert(isVid ? 'Video must be under 10MB' : 'Image must be under 2MB'); return; }
                _pushUndo();
                el.frameMediaType = isVid ? 'video' : 'image';
                var fmType = _qs('#cneFrameMediaType'); if (fmType) fmType.value = el.frameMediaType;
                var reader = new FileReader();
                reader.onload = function (e) {
                    el.frameSrc = e.target.result;
                    var srcInput = _qs('#cneFrameSrc');
                    if (srcInput) srcInput.value = '(uploaded)';
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }
        var frameFit = _qs('#cneFrameFit');
        if (frameFit) {
            frameFit.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (_isFrameOrShape(el)) {
                    _pushUndo();
                    el.frameObjectFit = frameFit.value;
                    _notifyUpdate(true);
                }
            });
        }
        var frameShape = _qs('#cneFrameShape');
        if (frameShape) {
            frameShape.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (el && el.frameShape) {
                    _pushUndo();
                    el.frameShape = frameShape.value;
                    var shapeDef = SHAPE_PATHS[frameShape.value] || SHAPE_PATHS['circle'];
                    if (shapeDef.clip) {
                        var bucket = _getStyleBucket(el);
                        bucket.clipPath = shapeDef.clip;
                    }
                    _notifyUpdate(true);
                }
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

        // --- Element background status helpers ---
        function _updateElBgStatus() {
            var el = _getSelectedElement();
            var imgStatus = _qs('#cneElBgImgStatus');
            var imgRemove = _qs('#cneElBgImgRemove');
            var vidStatus = _qs('#cneElBgVidStatus');
            var vidRemove = _qs('#cneElBgVidRemove');
            var bgFitRow = _qs('#cneBgFitRow');
            var hasImg = el && _getElStyleValue(el, 'backgroundImage') && _getElStyleValue(el, 'backgroundImage') !== '';
            var hasVid = el && el.bgVideo;
            if (imgStatus) imgStatus.style.display = hasImg ? '' : 'none';
            if (imgRemove) imgRemove.style.display = hasImg ? '' : 'none';
            if (vidStatus) vidStatus.style.display = hasVid ? '' : 'none';
            if (vidRemove) vidRemove.style.display = hasVid ? '' : 'none';
            if (bgFitRow) bgFitRow.style.display = hasImg ? '' : 'none';
            if (hasImg && el) {
                var bgSizeEl = _qs('#cneBgSize');
                var bgPosEl = _qs('#cneBgPosition');
                if (bgSizeEl) bgSizeEl.value = _getElStyleValue(el, 'backgroundSize') || 'cover';
                if (bgPosEl) bgPosEl.value = _getElStyleValue(el, 'backgroundPosition') || 'center';
            }
        }

        // Element background-image upload
        var elBgUpload = _qs('#cneElBgUpload');
        if (elBgUpload) {
            elBgUpload.addEventListener('change', function () {
                if (!elBgUpload.files || !elBgUpload.files[0]) return;
                var file = elBgUpload.files[0];
                if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
                var el = _getSelectedElement();
                if (!el) return;
                _pushUndo();
                // Mutual exclusivity: clear video if setting image
                if (el.bgVideo) delete el.bgVideo;
                var reader = new FileReader();
                reader.onload = function (e) {
                    var dataUrl = e.target.result;
                    _setElStyle('backgroundImage', 'url(' + dataUrl + ')');
                    _setElStyle('backgroundSize', 'cover');
                    _setElStyle('backgroundPosition', 'center');
                    _updateElBgStatus();
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Element background-image remove
        var elBgImgRemove = _qs('#cneElBgImgRemove');
        if (elBgImgRemove) {
            elBgImgRemove.addEventListener('click', function () {
                _pushUndo();
                _setElStyle('backgroundImage', '');
                _setElStyle('backgroundSize', '');
                _setElStyle('backgroundPosition', '');
                if (elBgUpload) elBgUpload.value = '';
                _updateElBgStatus();
                _notifyUpdate(true);
            });
        }

        // Background size & position
        var bgSizeSelect = _qs('#cneBgSize');
        if (bgSizeSelect) {
            bgSizeSelect.addEventListener('change', function () {
                _setElStyle('backgroundSize', bgSizeSelect.value);
            });
        }
        var bgPosSelect = _qs('#cneBgPosition');
        if (bgPosSelect) {
            bgPosSelect.addEventListener('change', function () {
                _setElStyle('backgroundPosition', bgPosSelect.value);
            });
        }

        // Element background video upload
        var elBgVideoUpload = _qs('#cneElBgVideoUpload');
        if (elBgVideoUpload) {
            elBgVideoUpload.addEventListener('change', function () {
                if (!elBgVideoUpload.files || !elBgVideoUpload.files[0]) return;
                var file = elBgVideoUpload.files[0];
                if (file.size > 15 * 1024 * 1024) { alert('Video must be under 15MB'); return; }
                var el = _getSelectedElement();
                if (!el) return;
                _pushUndo();
                // Mutual exclusivity: clear bg image if setting video
                _setElStyle('backgroundImage', '');
                _setElStyle('backgroundSize', '');
                _setElStyle('backgroundPosition', '');
                var reader = new FileReader();
                reader.onload = function (e) {
                    el.bgVideo = e.target.result;
                    _updateElBgStatus();
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Element background video remove
        var elBgVidRemove = _qs('#cneElBgVidRemove');
        if (elBgVidRemove) {
            elBgVidRemove.addEventListener('click', function () {
                var el = _getSelectedElement();
                if (!el) return;
                _pushUndo();
                delete el.bgVideo;
                if (elBgVideoUpload) elBgVideoUpload.value = '';
                _updateElBgStatus();
                _notifyUpdate(true);
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

        // 3D Transform inputs
        ['RotateX', 'RotateY', 'RotateZ', 'TranslateZ'].forEach(function (prop) {
            var input = _qs('#cne3d' + prop);
            if (input) {
                input.addEventListener('input', function () {
                    _apply3DTransform();
                });
            }
        });
        var perspInput = _qs('#cne3dPerspective');
        if (perspInput) {
            perspInput.addEventListener('input', function () {
                var val = perspInput.value;
                _setElStyle('perspective', val ? val + 'px' : '');
            });
        }
        var backfaceSelect = _qs('#cne3dBackface');
        if (backfaceSelect) {
            backfaceSelect.addEventListener('change', function () {
                _setElStyle('backfaceVisibility', backfaceSelect.value || '');
            });
        }
        var preset3d = _qs('#cne3dPreset');
        if (preset3d) {
            preset3d.addEventListener('change', function () {
                var val = preset3d.value;
                if (!val) return;
                var presets = {
                    'card-flip':  { rotateY: 180, perspective: 800 },
                    'tilt-hover': { rotateX: 15, rotateY: -15, perspective: 1000 },
                    'float-3d':   { rotateX: 10, rotateY: 10, translateZ: 40, perspective: 800 },
                    'cube-face':  { rotateY: 45, translateZ: 100, perspective: 600 },
                    'barrel-roll':{ rotateX: 30, rotateZ: 5, perspective: 1000 }
                };
                var p = presets[val];
                if (!p) return;
                var rx = _qs('#cne3dRotateX'); if (rx) rx.value = p.rotateX || 0;
                var ry = _qs('#cne3dRotateY'); if (ry) ry.value = p.rotateY || 0;
                var rz = _qs('#cne3dRotateZ'); if (rz) rz.value = p.rotateZ || 0;
                var tz = _qs('#cne3dTranslateZ'); if (tz) tz.value = p.translateZ || 0;
                var pe = _qs('#cne3dPerspective'); if (pe) pe.value = p.perspective || 800;
                _setElStyle('perspective', (p.perspective || 800) + 'px');
                _apply3DTransform();
            });
        }

        // Border
        var borderWidth = _qs('#cneBorderWidth');
        var borderColor = _qs('#cneBorderColor');
        var borderStyle = _qs('#cneBorderStyle');
        function updateBorder() {
            var w = borderWidth ? borderWidth.value : '';
            var c = borderColor ? borderColor.value : '#ffffff';
            var s = borderStyle ? borderStyle.value : 'solid';
            if (w && parseInt(w) > 0) {
                _setElStyle('border', w + 'px ' + s + ' ' + c);
            } else {
                _setElStyle('border', '');
            }
        }
        if (borderWidth) borderWidth.addEventListener('input', updateBorder);
        if (borderColor) borderColor.addEventListener('input', updateBorder);
        if (borderStyle) borderStyle.addEventListener('change', updateBorder);

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

        // Position inputs (top, left, right, bottom, width, height)
        ['Top', 'Left', 'Right', 'Bottom', 'Width', 'Height'].forEach(function (prop) {
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

        // ─── Rich Text Formatting ───
        var richTextBar = _qs('#cneRichTextBar');
        if (richTextBar) {
            richTextBar.addEventListener('click', function (e) {
                var btn = e.target.closest('.cne-icon-btn');
                if (!btn) return;
                var prop = btn.getAttribute('data-prop');
                var val = btn.getAttribute('data-val');
                if (!prop) return;
                var el = _getSelectedElement();
                if (!el) return;
                var current = _getElStyleValue(el, prop);
                // Toggle: if already set to this value, clear it
                if (current === val) {
                    _setElStyle(prop, '');
                    btn.classList.remove('active');
                } else {
                    _setElStyle(prop, val);
                    btn.classList.add('active');
                }
            });
        }

        // Text transform
        var textTransform = _qs('#cneTextTransform');
        if (textTransform) {
            textTransform.addEventListener('change', function () {
                _setElStyle('textTransform', textTransform.value);
            });
        }

        // Word spacing
        var wordSpacing = _qs('#cneWordSpacing');
        if (wordSpacing) {
            wordSpacing.addEventListener('input', function () {
                var val = wordSpacing.value;
                if (val && /^\d+(\.\d+)?$/.test(val)) val += 'px';
                _setElStyle('wordSpacing', val);
            });
        }

        // Text shadow
        var textShadow = _qs('#cneTextShadow');
        if (textShadow) {
            textShadow.addEventListener('change', function () {
                _setElStyle('textShadow', textShadow.value);
            });
        }

        // Text stroke (e.g. "2px #fff")
        var textStroke = _qs('#cneTextStroke');
        if (textStroke) {
            textStroke.addEventListener('input', function () {
                _setElStyle('webkitTextStroke', textStroke.value);
            });
        }

        // ─── Image Filters ───
        var filterProps = [
            { id: 'cneFilterBrightness', fn: 'brightness', unit: '%', def: 100 },
            { id: 'cneFilterContrast', fn: 'contrast', unit: '%', def: 100 },
            { id: 'cneFilterSaturate', fn: 'saturate', unit: '%', def: 100 },
            { id: 'cneFilterBlur', fn: 'blur', unit: 'px', def: 0 },
            { id: 'cneFilterHue', fn: 'hue-rotate', unit: 'deg', def: 0 },
            { id: 'cneFilterGrayscale', fn: 'grayscale', unit: '%', def: 0 },
            { id: 'cneFilterSepia', fn: 'sepia', unit: '%', def: 0 },
            { id: 'cneFilterInvert', fn: 'invert', unit: '%', def: 0 }
        ];
        function _buildFilterString() {
            var parts = [];
            filterProps.forEach(function (fp) {
                var input = _qs('#' + fp.id);
                if (!input) return;
                var val = parseFloat(input.value);
                if (val !== fp.def) {
                    parts.push(fp.fn + '(' + val + fp.unit + ')');
                }
            });
            return parts.join(' ');
        }
        function _onFilterChange() {
            // Update value labels
            filterProps.forEach(function (fp) {
                var input = _qs('#' + fp.id);
                var label = _qs('#' + fp.id + 'Val');
                if (input && label) label.textContent = input.value + fp.unit;
            });
            _setElStyle('filter', _buildFilterString());
        }
        filterProps.forEach(function (fp) {
            var input = _qs('#' + fp.id);
            if (input) input.addEventListener('input', _onFilterChange);
        });

        // Clip path / mask shape
        var clipPath = _qs('#cneClipPath');
        if (clipPath) {
            clipPath.addEventListener('change', function () {
                _setElStyle('clipPath', clipPath.value);
            });
        }

        // ─── Layout (Flex) Section ───
        var flexDir = _qs('#cneFlexDir');
        if (flexDir) {
            flexDir.addEventListener('change', function () {
                if (flexDir.value) {
                    _setElStyle('display', 'flex');
                    _setElStyle('flexDirection', flexDir.value);
                } else {
                    _setElStyle('display', '');
                    _setElStyle('flexDirection', '');
                }
            });
        }
        var flexWrap = _qs('#cneFlexWrap');
        if (flexWrap) {
            flexWrap.addEventListener('change', function () {
                _setElStyle('flexWrap', flexWrap.value);
            });
        }
        var justify = _qs('#cneJustify');
        if (justify) {
            justify.addEventListener('change', function () {
                _setElStyle('justifyContent', justify.value);
            });
        }
        var alignItems = _qs('#cneAlignItems');
        if (alignItems) {
            alignItems.addEventListener('change', function () {
                _setElStyle('alignItems', alignItems.value);
            });
        }
        var flexGap = _qs('#cneFlexGap');
        if (flexGap) {
            flexGap.addEventListener('input', function () {
                var val = flexGap.value;
                if (val && /^\d+(\.\d+)?$/.test(val)) val += 'px';
                _setElStyle('gap', val);
            });
        }
        var overflow = _qs('#cneOverflow');
        if (overflow) {
            overflow.addEventListener('change', function () {
                _setElStyle('overflow', overflow.value);
            });
        }

        // ─── Advanced Section (Blend Mode + Cursor) ───
        var blendMode = _qs('#cneBlendMode');
        if (blendMode) {
            blendMode.addEventListener('change', function () {
                _setElStyle('mixBlendMode', blendMode.value);
            });
        }
        var cursor = _qs('#cneCursor');
        if (cursor) {
            cursor.addEventListener('change', function () {
                _setElStyle('cursor', cursor.value);
            });
        }

        // ─── Alignment Toolbar (single element position helpers) ───
        var alignToolbar = _qs('#cneAlignToolbar');
        if (alignToolbar) {
            alignToolbar.addEventListener('click', function (e) {
                var btn = e.target.closest('.cne-icon-btn');
                if (!btn) return;
                var align = btn.getAttribute('data-align');
                if (!align) return;
                var el = _getSelectedElement();
                if (!el) return;
                _pushUndo();
                switch (align) {
                    case 'left':    _setElStyle('left', '0%'); _setElStyle('right', ''); break;
                    case 'centerH': _setElStyle('left', '50%'); _setElStyle('right', ''); break;
                    case 'right':   _setElStyle('left', ''); _setElStyle('right', '0%'); break;
                    case 'top':     _setElStyle('top', '0%'); _setElStyle('bottom', ''); break;
                    case 'centerV': _setElStyle('top', '50%'); _setElStyle('bottom', ''); break;
                    case 'bottom':  _setElStyle('top', ''); _setElStyle('bottom', '0%'); break;
                }
                _updatePropertiesFromScene(el);
            });
        }
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
        var approxLabel = _qs('#cneEaseApprox');
        if (!easeSelect) return;

        var ease = (el.scroll && el.scroll.ease) ? el.scroll.ease : 'none';
        var isApprox = /^(back|elastic|bounce)/.test(ease);

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
            isApprox = false;
        } else {
            easeSelect.value = ease;
            if (customPanel) customPanel.style.display = 'none';
            _drawEaseCurve(_EASE_BEZIER_MAP[ease] || [0, 0, 1, 1]);
        }
        if (approxLabel) approxLabel.style.display = isApprox ? '' : 'none';
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
                mark.style.left = p + '%';
                var lbl = document.createElement('span');
                lbl.className = 'cne-tl-ruler-label';
                lbl.textContent = p + '%';
                mark.appendChild(lbl);
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
            label.className = 'cne-tl-track-label';
            label.textContent = el.text ? el.text.substr(0, 16) : el.id;
            label.title = el.text || el.id;

            // Bar area
            var barArea = document.createElement('div');
            barArea.className = 'cne-tl-bar-container';

            // The bar itself
            var bar = document.createElement('div');
            bar.className = 'cne-tl-bar';
            bar.style.left = (start * 100) + '%';
            bar.style.width = ((end - start) * 100) + '%';

            // Left handle
            var handleL = document.createElement('div');
            handleL.className = 'cne-tl-handle cne-tl-handle--left';

            // Right handle
            var handleR = document.createElement('div');
            handleR.className = 'cne-tl-handle cne-tl-handle--right';

            // Property dots
            var propsDiv = document.createElement('div');
            propsDiv.className = 'cne-tl-dot-container';
            scrollProps.forEach(function (prop) {
                if (el.scroll[prop] !== undefined) {
                    var dot = document.createElement('span');
                    dot.className = 'cne-tl-dot cne-tl-dot--' + prop;
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

        // Hover presets
        var _HOVER_PRESETS = {
            lift:       { translateY: '-6', scale: '1.02', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', _duration: '0.3' },
            liftMore:   { translateY: '-12', scale: '1.04', boxShadow: '0 16px 48px rgba(0,0,0,0.35)', _duration: '0.35' },
            float:      { translateY: '-10', _duration: '0.4' },
            grow:       { scale: '1.08', _duration: '0.25' },
            growMore:   { scale: '1.15', _duration: '0.3' },
            shrink:     { scale: '0.95', _duration: '0.25' },
            tiltLeft:   { rotate: '-5', _duration: '0.3' },
            tiltRight:  { rotate: '5', _duration: '0.3' },
            spin:       { rotate: '360', _duration: '0.6' },
            glow:       { boxShadow: '0 0 40px rgba(108,92,231,0.6)', _duration: '0.35' },
            glowBlue:   { boxShadow: '0 0 40px rgba(59,130,246,0.6)', _duration: '0.35' },
            glowGreen:  { boxShadow: '0 0 40px rgba(16,185,129,0.6)', _duration: '0.35' },
            neon:       { boxShadow: '0 0 20px #fff, 0 0 60px #6C5CE7, 0 0 100px #6C5CE7', _duration: '0.4' },
            shadowPop:  { boxShadow: '0 12px 40px rgba(0,0,0,0.5)', translateY: '-4', _duration: '0.3' },
            skewLeft:   { rotate: '-3', scale: '1.02', _duration: '0.3' },
            skewRight:  { rotate: '3', scale: '1.02', _duration: '0.3' },
            fadeHalf:   { opacity: '50', _duration: '0.3' },
            brighten:   { opacity: '100', scale: '1.03', _duration: '0.3' },
            dim:        { opacity: '60', _duration: '0.3' }
        };
        var hPreset = _qs('#cneHoverPreset');
        if (hPreset) {
            hPreset.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (!el) return;
                var key = hPreset.value;
                if (!key) return; // Custom / None selected
                var p = _HOVER_PRESETS[key];
                if (!p) return;
                _pushUndo();
                el.hoverStyle = JSON.parse(JSON.stringify(p));
                _updateHoverPanel(el);
                _notifyUpdate();
            });
        }

        var hOpacity = _qs('#cneHoverOpacity');
        if (hOpacity) hOpacity.addEventListener('input', function () {
            var raw = hOpacity.value.trim();
            if (raw === '') { _setHover('opacity', ''); return; }
            var v = Math.max(0, Math.min(100, Math.round(parseFloat(raw) || 0)));
            hOpacity.value = v;
            _setHover('opacity', String(v));
        });

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
        if (hDuration) hDuration.addEventListener('input', function () {
            var v = parseFloat(hDuration.value);
            var safe = (!isNaN(v) && v >= 0 && v <= 5) ? String(v) : '0.3';
            _setHover('_duration', safe);
        });

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
        var hPreset = _qs('#cneHoverPreset'); if (hPreset) hPreset.value = '';
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
    function _syncTokenUI() {
        var map = {
            '#cneTokenHeadingFont': 'headingFont', '#cneTokenBodyFont': 'bodyFont',
            '#cneTokenBaseSize': 'baseSize', '#cneTokenScale': 'scale',
            '#cneTokenPrimary': 'primary', '#cneTokenSecondary': 'secondary',
            '#cneTokenText': 'text', '#cneTokenTextMuted': 'textMuted',
            '#cneTokenBg': 'bg', '#cneTokenSurface': 'surface',
            '#cneTokenSpaceUnit': 'spaceUnit', '#cneTokenRadius': 'radius'
        };
        Object.keys(map).forEach(function (sel) {
            var el = _qs(sel);
            if (el) el.value = _designTokens[map[sel]];
        });
    }

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
                _beginBurst('tokens');
                var v = el.value;
                if (key === 'baseSize' || key === 'spaceUnit' || key === 'radius') v = parseInt(v, 10) || _designTokens[key];
                if (key === 'scale') v = parseFloat(v) || _designTokens[key];
                _designTokens[key] = v;
                _commitBurst('tokens', 600);
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
                // Apply type-scaled font sizes
                if (el.style.fontSize) {
                    var base = _designTokens.baseSize;
                    var sc = _designTokens.scale;
                    var headingMatch = /^h([1-6])$/.exec(tag);
                    if (headingMatch) {
                        var power = 7 - parseInt(headingMatch[1]); // h1→6, h2→5 … h6→1
                        el.style.fontSize = Math.round(base * Math.pow(sc, power)) + 'px';
                    } else {
                        el.style.fontSize = base + 'px';
                    }
                }
            });
        });
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

        // Refresh preview
        var refreshBtn = _qs('#cneRefreshPreview');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                _notifyUpdate(true);
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

        // New Project / Open Project / Save / Save As
        var newBtn = _qs('#cneNewProject');
        if (newBtn) newBtn.addEventListener('click', function () { _newProject(); });
        var openBtn = _qs('#cneOpenProject');
        if (openBtn) openBtn.addEventListener('click', function () { _openProject(); });
        var saveBtn = _qs('#cneSaveProject');
        if (saveBtn) saveBtn.addEventListener('click', function () { _saveProject(); });
        var saveAsBtn = _qs('#cneSaveProjectAs');
        if (saveAsBtn) saveAsBtn.addEventListener('click', function () { _saveProjectAs(); });

        // Export as ZIP
        var exportZipBtn = _qs('#cneExportZIP');
        if (exportZipBtn) exportZipBtn.addEventListener('click', function () { _exportZIP(); });

        // Crop tool
        var cropBtn = _qs('#cneCropBtn');
        if (cropBtn) cropBtn.addEventListener('click', function () { _showCropTool(); });

        // Alignment buttons
        var alignBtns = _qsa('.cne-align-btn');
        alignBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var mode = btn.getAttribute('data-align');
                if (mode) _alignElements(mode);
            });
        });

        // AI Studio open button (reuse existing AI button)
        var aiBtn = _qs('#cneAIBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', function () {
                _showAIStudio();
            });
        }

        // Auto-Generate button
        var autoGenBtn = _qs('#cneAutoGenerate');
        if (autoGenBtn) {
            autoGenBtn.addEventListener('click', function () {
                _showAutoGenerateDialog();
            });
        }

        // Effects Presets button
        var effectsBtn = _qs('#cneEffectsBtn');
        if (effectsBtn) {
            effectsBtn.addEventListener('click', function () {
                _showEffectsMenu(effectsBtn);
            });
        }

        // Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A)
        _keydownHandler = function (e) {
            if (!_active) return;
            var tag = document.activeElement.tagName;
            var inInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
            if ((e.ctrlKey || e.metaKey) && e.altKey && !inInput) {
                if (e.key === 'c' && _selectedElementIds.length > 0) { e.preventDefault(); _copyStyle(); return; }
                if (e.key === 'v' && _styleClipboard) { e.preventDefault(); _pasteStyle(); return; }
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                if ((e.key === 's' || e.key === 'S') && e.shiftKey) { e.preventDefault(); _saveProjectAs(); return; }
                if ((e.key === 's' || e.key === 'S') && !e.shiftKey) { e.preventDefault(); _saveProject(); return; }
                if ((e.key === 'o' || e.key === 'O') && !e.shiftKey) { e.preventDefault(); _openProject(); return; }
                if ((e.key === 'n' || e.key === 'N') && !e.shiftKey) { e.preventDefault(); _newProject(); return; }
                if (e.key === 'z' && !e.shiftKey && !inInput) { e.preventDefault(); _undo(); }
                if (e.key === 'z' && e.shiftKey && !inInput) { e.preventDefault(); _redo(); }
                if (e.key === 'y' && !inInput) { e.preventDefault(); _redo(); }
                if (e.key === 'c' && !inInput && _selectedElementIds.length > 0) { e.preventDefault(); _copyElement(); }
                if (e.key === 'v' && !inInput && _clipboard) { e.preventDefault(); _pasteElement(); }
                if (e.key === 'd' && !inInput && _selectedElementIds.length > 0) { e.preventDefault(); _duplicateElement(); }
                if (e.key === 'a' && !inInput) { e.preventDefault(); _selectAll(); }
                if (e.key === 'g' && !e.shiftKey && _selectedElementIds.length > 1) { e.preventDefault(); _groupSelection(); }
                if (e.key === 'g' && e.shiftKey && _selectedElementIds.length > 0) { e.preventDefault(); _ungroupSelection(); }
            }
            // Delete key deletes selected elements (only when not editing text)
            if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedElementIds.length > 0 && !inInput) {
                e.preventDefault();
                _deleteSelectedElement();
            }
        };
        document.addEventListener('keydown', _keydownHandler);

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
                // Auto-generate responsive overrides on first switch
                if (_activeDevice !== 'desktop') {
                    _autoResponsive(_activeDevice);
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
                // Re-render preview to apply responsive overrides
                _notifyUpdate(true);
            });
        });
    }

    /* ─── Responsive Panel Toggles (for narrow viewports) ─── */
    function _setupPanelToggles() {
        if (!_container) return;
        var scenesPanel = _container.querySelector('.cne-scenes-panel');
        var propsPanel = _container.querySelector('.cne-props-panel');
        var toggleScenes = _qs('#cneToggleScenes');
        var toggleProps = _qs('#cneToggleProps');

        if (toggleScenes && scenesPanel) {
            toggleScenes.addEventListener('click', function () {
                scenesPanel.classList.toggle('open');
                if (propsPanel) propsPanel.classList.remove('open');
            });
        }
        if (toggleProps && propsPanel) {
            toggleProps.addEventListener('click', function () {
                propsPanel.classList.toggle('open');
                if (scenesPanel) scenesPanel.classList.remove('open');
            });
        }
        // Close panels when clicking canvas area
        var canvasArea = _container.querySelector('.cne-canvas-area');
        if (canvasArea) {
            canvasArea.addEventListener('click', function () {
                if (scenesPanel) scenesPanel.classList.remove('open');
                if (propsPanel) propsPanel.classList.remove('open');
            });
        }
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

        // Ctrl + mouse wheel zoom on canvas
        var canvasArea = _container ? _container.querySelector('.cne-canvas-area') : null;
        if (canvasArea) {
            canvasArea.addEventListener('wheel', function (e) {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    var delta = e.deltaY > 0 ? -5 : 5;
                    _zoom = Math.max(30, Math.min(200, _zoom + delta));
                    _applyZoom();
                    if (zoomVal) zoomVal.textContent = _zoom + '%';
                }
            }, { passive: false });

            // Space + drag to pan
            var _panning = false;
            var _panStart = { x: 0, y: 0 };
            var _panOffset = { x: 0, y: 0 };

            document.addEventListener('keydown', function (e) {
                if (e.code === 'Space' && !_panning && _active) {
                    var tag = document.activeElement.tagName;
                    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                    e.preventDefault();
                    canvasArea.style.cursor = 'grab';
                }
            });
            document.addEventListener('keyup', function (e) {
                if (e.code === 'Space') {
                    canvasArea.style.cursor = '';
                    _panning = false;
                }
            });
            canvasArea.addEventListener('mousedown', function (e) {
                if (e.button === 1 || (canvasArea.style.cursor === 'grab' && e.button === 0)) {
                    _panning = true;
                    _panStart = { x: e.clientX - _panOffset.x, y: e.clientY - _panOffset.y };
                    canvasArea.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            });
            document.addEventListener('mousemove', function (e) {
                if (_panning) {
                    _panOffset.x = e.clientX - _panStart.x;
                    _panOffset.y = e.clientY - _panStart.y;
                    _applyZoom();
                }
            });
            document.addEventListener('mouseup', function () {
                if (_panning) {
                    _panning = false;
                    canvasArea.style.cursor = '';
                }
            });

            // Expose panOffset to _applyZoom via closure
            var _origApplyZoom = _applyZoom;
            _applyZoom = function () {
                var frame = _qs('#cnePreviewFrame');
                if (frame) {
                    frame.style.transform = 'scale(' + (_zoom / 100) + ') translate(' + _panOffset.x + 'px, ' + _panOffset.y + 'px)';
                    frame.style.transformOrigin = 'top center';
                }
            };
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
                    var val = parseInt(durationInput.value) || 100;
                    scene.duration = Math.max(50, Math.min(_MAX_DURATION, val));
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

        // --- Scene background status helpers ---
        function _updateSceneBgStatus() {
            var scene = _scenes[_currentSceneIdx];
            var imgStatus = _qs('#cneSceneBgImgStatus');
            var imgRemove = _qs('#cneSceneBgImgRemove');
            var vidStatus = _qs('#cneSceneBgVidStatus');
            var vidRemove = _qs('#cneSceneBgVidRemove');
            var hasImg = scene && scene.bgImage;
            var hasVid = scene && scene.bgVideo;
            if (imgStatus) imgStatus.style.display = hasImg ? '' : 'none';
            if (imgRemove) imgRemove.style.display = hasImg ? '' : 'none';
            if (vidStatus) vidStatus.style.display = hasVid ? '' : 'none';
            if (vidRemove) vidRemove.style.display = hasVid ? '' : 'none';
        }

        // Scene background image upload
        var sceneBgUpload = _qs('#cneSceneBgUpload');
        if (sceneBgUpload) {
            sceneBgUpload.addEventListener('change', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene || !sceneBgUpload.files || !sceneBgUpload.files[0]) return;
                var file = sceneBgUpload.files[0];
                if (file.size > 3 * 1024 * 1024) { alert('Image must be under 3MB'); return; }
                _pushUndo();
                // Mutual exclusivity: clear video if setting image
                if (scene.bgVideo) delete scene.bgVideo;
                var reader = new FileReader();
                reader.onload = function (e) {
                    scene.bgImage = e.target.result;
                    _updateSceneBgStatus();
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Scene background image remove
        var sceneBgImgRemove = _qs('#cneSceneBgImgRemove');
        if (sceneBgImgRemove) {
            sceneBgImgRemove.addEventListener('click', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                _pushUndo();
                delete scene.bgImage;
                if (sceneBgUpload) sceneBgUpload.value = '';
                _updateSceneBgStatus();
                _notifyUpdate(true);
            });
        }

        // Scene background video upload
        var sceneBgVideoUpload = _qs('#cneSceneBgVideoUpload');
        if (sceneBgVideoUpload) {
            sceneBgVideoUpload.addEventListener('change', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene || !sceneBgVideoUpload.files || !sceneBgVideoUpload.files[0]) return;
                var file = sceneBgVideoUpload.files[0];
                if (file.size > 15 * 1024 * 1024) { alert('Video must be under 15MB'); return; }
                _pushUndo();
                // Mutual exclusivity: clear bg image if setting video
                if (scene.bgImage) delete scene.bgImage;
                var reader = new FileReader();
                reader.onload = function (e) {
                    scene.bgVideo = e.target.result;
                    _updateSceneBgStatus();
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        // Scene background video remove
        var sceneBgVidRemove = _qs('#cneSceneBgVidRemove');
        if (sceneBgVidRemove) {
            sceneBgVidRemove.addEventListener('click', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                _pushUndo();
                delete scene.bgVideo;
                if (sceneBgVideoUpload) sceneBgVideoUpload.value = '';
                _updateSceneBgStatus();
                _notifyUpdate(true);
            });
        }

        // 3D background effect
        var bg3dSelect = _qs('#cneSceneBg3d');
        var bg3dColorRow = _qs('#cneBg3dColorRow');
        var bg3dIntRow = _qs('#cneBg3dIntensityRow');
        var bg3dSpeedRow = _qs('#cneBg3dSpeedRow');
        var bg3dWarning = _qs('#cneBg3dWarning');

        function _toggle3dRows() {
            var show = bg3dSelect && bg3dSelect.value !== '';
            if (bg3dColorRow) bg3dColorRow.style.display = show ? '' : 'none';
            if (bg3dIntRow) bg3dIntRow.style.display = show ? '' : 'none';
            if (bg3dSpeedRow) bg3dSpeedRow.style.display = show ? '' : 'none';
            if (bg3dWarning) bg3dWarning.style.display = show ? '' : 'none';
            var isParticle = bg3dSelect && ['particles','bubbles','stars','snow','fireflies','confetti','matrix','star-field','particle-field'].indexOf(bg3dSelect.value) >= 0;
            var rows = ['#cneBg3dCountRow','#cneBg3dSizeRow','#cneBg3dGlowRow','#cneBg3dColor3Row','#cneBg3dInteractiveRow'];
            rows.forEach(function(s){ var r = _qs(s); if (r) r.style.display = isParticle ? '' : 'none'; });
        }

        function _apply3dBg() {
            var scene = _scenes[_currentSceneIdx];
            if (!scene) return;
            _beginBurst('scene');
            scene.bg3dType = bg3dSelect ? bg3dSelect.value : '';
            scene.bg3dColor1 = (_qs('#cneBg3dColor1') || {}).value || '#6c5ce7';
            scene.bg3dColor2 = (_qs('#cneBg3dColor2') || {}).value || '#00cec9';
            scene.bg3dIntensity = (_qs('#cneBg3dIntensity') || {}).value || '5';
            scene.bg3dSpeed = (_qs('#cneBg3dSpeed') || {}).value || 'medium';
            scene.bg3dCount = (_qs('#cneBg3dCount') || {}).value || '60';
            scene.bg3dSize = (_qs('#cneBg3dSize') || {}).value || '4';
            scene.bg3dGlow = (_qs('#cneBg3dGlow') || {}).value || '8';
            scene.bg3dColor3 = (_qs('#cneBg3dColor3') || {}).value || '#fd79a8';
            scene.bg3dInteractive = !!(_qs('#cneBg3dInteractive') || {}).checked;
            var cntV = _qs('#cneBg3dCountVal'); if (cntV) cntV.textContent = scene.bg3dCount;
            var szV = _qs('#cneBg3dSizeVal'); if (szV) szV.textContent = scene.bg3dSize + 'px';
            var glV = _qs('#cneBg3dGlowVal'); if (glV) glV.textContent = scene.bg3dGlow + 'px';
            _commitBurst('scene', 600);
            _toggle3dRows();
            _notifyUpdate(true);
        }

        if (bg3dSelect) bg3dSelect.addEventListener('change', _apply3dBg);
        var bg3dc1 = _qs('#cneBg3dColor1'); if (bg3dc1) bg3dc1.addEventListener('input', _apply3dBg);
        var bg3dc2 = _qs('#cneBg3dColor2'); if (bg3dc2) bg3dc2.addEventListener('input', _apply3dBg);
        var bg3dInt = _qs('#cneBg3dIntensity'); if (bg3dInt) bg3dInt.addEventListener('input', _apply3dBg);
        var bg3dSpd = _qs('#cneBg3dSpeed'); if (bg3dSpd) bg3dSpd.addEventListener('change', _apply3dBg);
        var bg3dc3 = _qs('#cneBg3dColor3'); if (bg3dc3) bg3dc3.addEventListener('input', _apply3dBg);
        var bg3dCnt = _qs('#cneBg3dCount'); if (bg3dCnt) bg3dCnt.addEventListener('input', _apply3dBg);
        var bg3dSz = _qs('#cneBg3dSize'); if (bg3dSz) bg3dSz.addEventListener('input', _apply3dBg);
        var bg3dGl = _qs('#cneBg3dGlow'); if (bg3dGl) bg3dGl.addEventListener('input', _apply3dBg);
        var bg3dInter = _qs('#cneBg3dInteractive'); if (bg3dInter) bg3dInter.addEventListener('change', _apply3dBg);

        // Video Scroll Layer
        function _applyVideoScroll() {
            var scene = _scenes[_currentSceneIdx];
            if (!scene) return;
            _beginBurst('scene');
            scene.videoScrollPreset = (_qs('#cneVideoScrollPreset') || {}).value || '';
            scene.videoScrollSpeed = parseFloat((_qs('#cneVideoScrollSpeed') || {}).value) || 1;
            scene.videoScrollOpacity = parseInt((_qs('#cneVideoScrollOpacity') || {}).value) || 60;
            scene.videoScrollColor1 = (_qs('#cneVideoScrollColor1') || {}).value || '#6c5ce7';
            scene.videoScrollColor2 = (_qs('#cneVideoScrollColor2') || {}).value || '#00cec9';
            var vsOpts = _qs('#cneVideoScrollOpts');
            if (vsOpts) vsOpts.style.display = scene.videoScrollPreset ? '' : 'none';
            var vsSpeedV = _qs('#cneVideoScrollSpeedVal'); if (vsSpeedV) vsSpeedV.textContent = scene.videoScrollSpeed + 'x';
            var vsOpacV = _qs('#cneVideoScrollOpacityVal'); if (vsOpacV) vsOpacV.textContent = scene.videoScrollOpacity + '%';
            _commitBurst('scene', 600);
            _notifyUpdate(true);
        }
        var vsPreset = _qs('#cneVideoScrollPreset'); if (vsPreset) vsPreset.addEventListener('change', _applyVideoScroll);
        var vsSpeed = _qs('#cneVideoScrollSpeed'); if (vsSpeed) vsSpeed.addEventListener('input', _applyVideoScroll);
        var vsOpac = _qs('#cneVideoScrollOpacity'); if (vsOpac) vsOpac.addEventListener('input', _applyVideoScroll);
        var vsc1 = _qs('#cneVideoScrollColor1'); if (vsc1) vsc1.addEventListener('input', _applyVideoScroll);
        var vsc2 = _qs('#cneVideoScrollColor2'); if (vsc2) vsc2.addEventListener('input', _applyVideoScroll);

        // Spline 3D embed
        var splineInput = _qs('#cneSceneSpline');
        var splineInfo = _qs('#cneSplineInfo');
        if (splineInput) {
            splineInput.addEventListener('input', function () {
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                _beginBurst('scene');
                var raw = splineInput.value.trim();
                // Allow only Spline URLs
                if (raw && !/^https:\/\/(prod\.spline\.design|my\.spline\.design|viewer\.spline\.design)\//.test(raw)) {
                    raw = '';
                }
                scene.splineUrl = raw;
                if (splineInfo) splineInfo.style.display = raw ? '' : 'none';
                _commitBurst('scene', 600);
                _notifyUpdate(true);
            });
        }

        // Custom code injection fields (site-wide, stored in _overrides)
        ['customHead', 'customCSS', 'customBodyEnd'].forEach(function (key) {
            var el = _qs('#cne' + key.charAt(0).toUpperCase() + key.slice(1));
            if (el) {
                el.addEventListener('input', function () {
                    _beginBurst('customCode');
                    _overrides[key] = el.value;
                    _commitBurst('customCode', 800);
                });
            }
        });

        // Navigation toggle + link manager (site-wide, stored in _overrides)
        var navToggle = _qs('#cneShowNav');
        var navLinkSection = _qs('#cneNavLinkSection');
        var navLinkList = _qs('#cneNavLinkList');
        var addNavLinkBtn = _qs('#cneAddNavLink');

        if (!_overrides.hasOwnProperty('showNav')) _overrides.showNav = true;
        if (!_overrides.navLinks) _overrides.navLinks = [];

        function _renderNavLinks() {
            if (!navLinkList) return;
            navLinkList.innerHTML = '';
            _overrides.navLinks.forEach(function (link, i) {
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;gap:4px;align-items:center';
                var txtIn = document.createElement('input');
                txtIn.className = 'gen-input';
                txtIn.style.cssText = 'flex:1;font-size:0.7rem';
                txtIn.placeholder = 'Label';
                txtIn.value = link.text || '';
                txtIn.addEventListener('input', function () { _overrides.navLinks[i].text = txtIn.value; _notifyUpdate(true); });
                var targetIn = document.createElement('input');
                targetIn.className = 'gen-input';
                targetIn.style.cssText = 'flex:1;font-size:0.7rem';
                targetIn.placeholder = 'Scene name or URL';
                targetIn.value = link.href || '';
                targetIn.addEventListener('input', function () { _overrides.navLinks[i].href = targetIn.value; _notifyUpdate(true); });
                var varBtn = document.createElement('button');
                varBtn.className = 'cne-upload-btn';
                varBtn.style.cssText = 'padding:2px 6px;font-size:9px;letter-spacing:0.05em;white-space:nowrap;min-width:32px;text-align:center';
                varBtn.textContent = link.variant === 'button' ? 'BTN' : 'LINK';
                varBtn.title = 'Toggle link / button style';
                varBtn.addEventListener('click', function () {
                    _overrides.navLinks[i].variant = _overrides.navLinks[i].variant === 'button' ? 'link' : 'button';
                    varBtn.textContent = _overrides.navLinks[i].variant === 'button' ? 'BTN' : 'LINK';
                    _notifyUpdate(true);
                });
                var rmBtn = document.createElement('button');
                rmBtn.className = 'cne-upload-btn';
                rmBtn.style.cssText = 'color:#ff6b6b;padding:2px 6px;font-size:12px';
                rmBtn.textContent = '\u00D7';
                rmBtn.title = 'Remove link';
                rmBtn.addEventListener('click', function () { _pushUndo(); _overrides.navLinks.splice(i, 1); _renderNavLinks(); _notifyUpdate(true); });
                row.appendChild(txtIn);
                row.appendChild(targetIn);
                row.appendChild(varBtn);
                row.appendChild(rmBtn);
                navLinkList.appendChild(row);
            });
        }

        if (navToggle) {
            navToggle.checked = _overrides.showNav !== false;
            if (navLinkSection) navLinkSection.style.display = navToggle.checked ? '' : 'none';
            navToggle.addEventListener('change', function () {
                _overrides.showNav = navToggle.checked;
                if (navLinkSection) navLinkSection.style.display = navToggle.checked ? '' : 'none';
                _notifyUpdate(true);
            });
        }

        if (addNavLinkBtn) {
            addNavLinkBtn.addEventListener('click', function () {
                _pushUndo();
                _overrides.navLinks.push({ text: 'Link', href: '#' });
                _renderNavLinks();
                _notifyUpdate(true);
            });
        }

        _renderNavLinks();

        /* ── Menu / Hamburger Setup ── */

        // Per-device visibility defaults
        if (!_overrides.menuDevice) _overrides.menuDevice = { desktop: 'hidden', tablet: 'visible', mobile: 'visible' };
        // Keep backward compat: migrate old menuEnabled boolean
        if (_overrides.hasOwnProperty('menuEnabled') && !_overrides.menuDevice) {
            var wasOn = _overrides.menuEnabled !== false;
            _overrides.menuDevice = { desktop: wasOn ? 'hidden' : 'hidden', tablet: wasOn ? 'visible' : 'hidden', mobile: wasOn ? 'visible' : 'hidden' };
        }
        if (!_overrides.menuTrigger) _overrides.menuTrigger = { type: 'bars', color: '#ffffff', size: 28, svg: '', mediaSrc: '' };
        if (!_overrides.menuOverlay) _overrides.menuOverlay = {
            bgColor: '#0a0a0f', bgOpacity: 95,
            elements: [
                { id: 'menu-title-' + Date.now().toString(36), tag: 'h2', text: 'Menu', style: { position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', fontSize: '3vw', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }, scroll: null, visible: true, locked: false },
                { id: 'menu-close-' + Date.now().toString(36), tag: 'span', text: '\u2715', style: { position: 'absolute', top: '24px', right: '24px', left: 'auto', fontSize: '1.5rem', color: '#ffffff', cursor: 'pointer', zIndex: '10' }, scroll: null, visible: true, locked: false }
            ]
        };

        // Toolbar dropdown toggle
        var menuToolbarBtn = _qs('#cneMenuToolbarBtn');
        var menuToolbarDd = _qs('#cneMenuToolbarDd');

        if (menuToolbarBtn && menuToolbarDd) {
            menuToolbarBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                // If in overlay editing mode, clicking exits the overlay
                if (menuToolbarBtn._overlayMode) {
                    _exitMenuOverlay();
                    return;
                }
                var isOpen = menuToolbarDd.style.display !== 'none';
                if (isOpen) {
                    menuToolbarDd.style.display = 'none';
                } else {
                    menuToolbarDd.style.display = '';
                    var r = menuToolbarBtn.getBoundingClientRect();
                    menuToolbarDd.style.top = (r.bottom + 6) + 'px';
                    menuToolbarDd.style.left = (r.left + r.width / 2) + 'px';
                    menuToolbarDd.style.transform = 'translateX(-50%)';
                }
            });
            document.addEventListener('click', function (e) {
                if (menuToolbarDd.style.display !== 'none' && !menuToolbarDd.contains(e.target) && e.target !== menuToolbarBtn) {
                    menuToolbarDd.style.display = 'none';
                }
            });
        }

        // Per-device selects
        var menuDesktop = _qs('#cneMenuDesktop');
        var menuTablet = _qs('#cneMenuTablet');
        var menuMobile = _qs('#cneMenuMobile');

        var menuTriggerType = _qs('#cneMenuTriggerType');
        var menuTriggerCustom = _qs('#cneMenuTriggerCustom');
        var menuTriggerSvg = _qs('#cneMenuTriggerSvg');
        var menuTriggerUpload = _qs('#cneMenuTriggerUpload');
        var menuTriggerFile = _qs('#cneMenuTriggerFile');
        var menuTriggerColor = _qs('#cneMenuTriggerColor');
        var menuTriggerSize = _qs('#cneMenuTriggerSize');
        var menuTriggerSizeVal = _qs('#cneMenuTriggerSizeVal');
        var menuOverlayBg = _qs('#cneMenuOverlayBg');
        var menuOverlayOpacity = _qs('#cneMenuOverlayOpacity');
        var menuOverlayOpacityVal = _qs('#cneMenuOverlayOpacityVal');
        var editMenuOverlayBtn = _qs('#cneEditMenuOverlay');

        function _syncMenuUI() {
            var md = _overrides.menuDevice || {};
            var mt = _overrides.menuTrigger || {};
            var mo = _overrides.menuOverlay || {};
            if (menuDesktop) menuDesktop.value = md.desktop || 'hidden';
            if (menuTablet) menuTablet.value = md.tablet || 'visible';
            if (menuMobile) menuMobile.value = md.mobile || 'visible';
            if (menuTriggerType) menuTriggerType.value = mt.type || 'bars';
            if (menuTriggerColor) menuTriggerColor.value = mt.color || '#ffffff';
            if (menuTriggerSize) menuTriggerSize.value = mt.size || 28;
            if (menuTriggerSizeVal) menuTriggerSizeVal.textContent = (mt.size || 28);
            if (menuOverlayBg) menuOverlayBg.value = mo.bgColor || '#0a0a0f';
            if (menuOverlayOpacity) menuOverlayOpacity.value = mo.bgOpacity || 95;
            if (menuOverlayOpacityVal) menuOverlayOpacityVal.textContent = (mo.bgOpacity || 95) + '%';
            _showMenuCustomInputs(mt.type);
        }

        function _showMenuCustomInputs(type) {
            if (!menuTriggerCustom) return;
            var showCustom = type === 'svg' || type === 'image' || type === 'video';
            menuTriggerCustom.style.display = showCustom ? '' : 'none';
            if (menuTriggerSvg) menuTriggerSvg.style.display = type === 'svg' ? '' : 'none';
            if (menuTriggerUpload) menuTriggerUpload.style.display = (type === 'image' || type === 'video') ? '' : 'none';
        }

        // Per-device change handlers
        function _onMenuDeviceChange() {
            _overrides.menuDevice = {
                desktop: menuDesktop ? menuDesktop.value : 'hidden',
                tablet: menuTablet ? menuTablet.value : 'visible',
                mobile: menuMobile ? menuMobile.value : 'visible'
            };
            _notifyUpdate(true);
        }
        if (menuDesktop) menuDesktop.addEventListener('change', _onMenuDeviceChange);
        if (menuTablet) menuTablet.addEventListener('change', _onMenuDeviceChange);
        if (menuMobile) menuMobile.addEventListener('change', _onMenuDeviceChange);

        if (menuTriggerType) menuTriggerType.addEventListener('change', function () {
            _overrides.menuTrigger.type = menuTriggerType.value;
            _showMenuCustomInputs(menuTriggerType.value);
            _notifyUpdate(true);
        });

        if (menuTriggerSvg) menuTriggerSvg.addEventListener('input', function () {
            _overrides.menuTrigger.svg = menuTriggerSvg.value;
            _notifyUpdate(true);
        });

        if (menuTriggerUpload && menuTriggerFile) {
            menuTriggerUpload.addEventListener('click', function () { menuTriggerFile.click(); });
            menuTriggerFile.addEventListener('change', function () {
                var file = menuTriggerFile.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    _overrides.menuTrigger.mediaSrc = e.target.result;
                    _notifyUpdate(true);
                };
                reader.readAsDataURL(file);
            });
        }

        if (menuTriggerColor) menuTriggerColor.addEventListener('input', function () {
            _overrides.menuTrigger.color = menuTriggerColor.value;
            _notifyUpdate(true);
        });

        if (menuTriggerSize) menuTriggerSize.addEventListener('input', function () {
            _overrides.menuTrigger.size = parseInt(menuTriggerSize.value);
            if (menuTriggerSizeVal) menuTriggerSizeVal.textContent = menuTriggerSize.value;
            _notifyUpdate(true);
        });

        if (menuOverlayBg) menuOverlayBg.addEventListener('input', function () {
            _overrides.menuOverlay.bgColor = menuOverlayBg.value;
            _notifyUpdate(true);
        });

        if (menuOverlayOpacity) menuOverlayOpacity.addEventListener('input', function () {
            _overrides.menuOverlay.bgOpacity = parseInt(menuOverlayOpacity.value);
            if (menuOverlayOpacityVal) menuOverlayOpacityVal.textContent = menuOverlayOpacity.value + '%';
            _notifyUpdate(true);
        });

        // "Design Menu Overlay" button
        function _enterMenuOverlay() {
            _pushUndo();
            // Deep-copy elements so editing doesn't mutate _overrides directly
            var elsCopy = JSON.parse(JSON.stringify(_overrides.menuOverlay.elements || []));
            var ovScene = {
                id: '_nav-overlay',
                name: '\u2630 Menu Overlay',
                template: 'blank',
                duration: 100,
                pin: false,
                bgColor: _overrides.menuOverlay.bgColor || '#0a0a0f',
                bgImage: '',
                elements: elsCopy
            };
            _scenes.push(ovScene);
            var ovIdx = _scenes.length - 1;
            _overrides._editingMenuOverlay = true;
            _renderSceneList();
            _selectScene(ovIdx);
            if (editMenuOverlayBtn) {
                editMenuOverlayBtn.textContent = '\u2190 Exit Menu Overlay Editing';
                editMenuOverlayBtn.style.background = 'rgba(231,76,60,0.15)';
                editMenuOverlayBtn.style.borderColor = 'rgba(231,76,60,0.3)';
            }
            // Close the dropdown
            if (menuToolbarDd) menuToolbarDd.style.display = 'none';
            // Show exit banner on toolbar button
            if (menuToolbarBtn) {
                menuToolbarBtn.innerHTML = '<span style="color:#e74c3c;font-size:0.65rem;font-weight:700">\u2190 Exit Overlay</span>';
                menuToolbarBtn.style.background = 'rgba(231,76,60,0.2)';
                menuToolbarBtn.style.borderColor = 'rgba(231,76,60,0.4)';
                menuToolbarBtn.title = 'Click to exit Menu Overlay editing';
                menuToolbarBtn._overlayMode = true;
            }
            // Force rerender after all UI is set up
            _notifyUpdate(true);
        }
        function _exitMenuOverlay() {
            var ovIdx = -1;
            for (var si = 0; si < _scenes.length; si++) {
                if (_scenes[si].id === '_nav-overlay') { ovIdx = si; break; }
            }
            if (ovIdx >= 0) {
                _overrides.menuOverlay.elements = _scenes[ovIdx].elements;
                _overrides.menuOverlay.bgColor = _scenes[ovIdx].bgColor || _overrides.menuOverlay.bgColor;
                _scenes.splice(ovIdx, 1);
            }
            _overrides._editingMenuOverlay = false;
            _renderSceneList();
            _selectScene(Math.min(_currentSceneIdx, _scenes.length - 1), true);
            _notifyUpdate(true);
            if (editMenuOverlayBtn) {
                editMenuOverlayBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Design Menu Overlay';
                editMenuOverlayBtn.style.background = 'rgba(108,92,231,0.15)';
                editMenuOverlayBtn.style.borderColor = 'rgba(108,92,231,0.3)';
            }
            // Restore toolbar button
            if (menuToolbarBtn) {
                menuToolbarBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>';
                menuToolbarBtn.style.background = '';
                menuToolbarBtn.style.borderColor = '';
                menuToolbarBtn.title = 'Hamburger Menu Settings';
                menuToolbarBtn._overlayMode = false;
            }
        }
        if (editMenuOverlayBtn) editMenuOverlayBtn.addEventListener('click', function () {
            if (_overrides._editingMenuOverlay) {
                _exitMenuOverlay();
            } else {
                _enterMenuOverlay();
            }
        });

        _syncMenuUI();

        // Form element settings
        var formAction = _qs('#cneFormAction');
        if (formAction) {
            formAction.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el && el.tag === 'form') { _beginBurst('form'); el.formAction = formAction.value; _commitBurst('form', 600); _notifyUpdate(true); }
            });
        }
        var formMethod = _qs('#cneFormMethod');
        if (formMethod) {
            formMethod.addEventListener('change', function () {
                var el = _getSelectedElement();
                if (el && el.tag === 'form') { _pushUndo(); el.formMethod = formMethod.value; _notifyUpdate(true); }
            });
        }
        var formSubmitText = _qs('#cneFormSubmitText');
        if (formSubmitText) {
            formSubmitText.addEventListener('input', function () {
                var el = _getSelectedElement();
                if (el && el.tag === 'form') { _beginBurst('form'); el.formSubmitText = formSubmitText.value; _commitBurst('form', 600); _notifyUpdate(true); }
            });
        }
        var formAddField = _qs('#cneFormAddField');
        if (formAddField) {
            formAddField.addEventListener('click', function () {
                var el = _getSelectedElement();
                if (el && el.tag === 'form') {
                    _pushUndo();
                    if (!el.formFields) el.formFields = [];
                    el.formFields.push({ name: 'field' + el.formFields.length, type: 'text', label: 'New Field', placeholder: '', required: false });
                    _renderFormFieldsList(el);
                    _notifyUpdate(true);
                }
            });
        }

        // ─── Hover Reveal Layers ───
        _setupRevealLayers();
    }

    /* ─── Hover Reveal Layers System ─── */
    function _setupRevealLayers() {
        var fileInput = _qs('#cneRevealFileInput');
        var dropzone = _qs('#cneRevealDropzone');
        var layerList = _qs('#cneRevealLayerList');
        var settingsPanel = _qs('#cneRevealSettings');
        var layerHeader = _qs('#cneRevealLayerHeader');
        var emptyState = _qs('#cneRevealEmpty');
        var effectGrid = _qs('#cneRevealEffectGrid');
        if (!fileInput || !layerList) return;

        // ── File processing helper ──
        function _processFiles(files) {
            var scene = _scenes[_currentSceneIdx];
            if (!scene || !files || !files.length) return;
            _pushUndo();
            if (!scene.revealLayers) scene.revealLayers = [];
            if (!scene.revealEffect) {
                scene.revealEffect = { type: 'circle', radius: 120, feather: 40, speed: 0.15, invert: false };
            }
            var eff = scene.revealEffect;
            if (!eff.layerOrder) {
                eff.layerOrder = ['bg'];
                scene.revealLayers.forEach(function (l) { eff.layerOrder.push(l.id); });
                eff.layerOrder.push('content');
            }
            var pending = files.length;
            for (var i = 0; i < files.length; i++) {
                (function (file) {
                    var isVideo = /^video\//.test(file.type);
                    var mediaType = isVideo ? 'video' : 'image';
                    if (isVideo && file.size > 15 * 1024 * 1024) { alert('Video must be under 15MB'); pending--; return; }
                    if (!isVideo && file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); pending--; return; }
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var newId = 'rl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
                        scene.revealLayers.push({
                            id: newId,
                            dataUrl: e.target.result,
                            fileName: file.name,
                            mediaType: mediaType,
                            order: scene.revealLayers.length
                        });
                        // Insert new layer just before 'content' in layerOrder
                        var contentIdx = eff.layerOrder.indexOf('content');
                        if (contentIdx === -1) contentIdx = eff.layerOrder.length;
                        eff.layerOrder.splice(contentIdx, 0, newId);
                        pending--;
                        if (pending <= 0) {
                            _renderRevealLayerList();
                            _notifyUpdate(true);
                        }
                    };
                    reader.readAsDataURL(file);
                })(files[i]);
            }
        }

        // ── File input handler ──
        fileInput.addEventListener('change', function () {
            _processFiles(fileInput.files);
            fileInput.value = '';
        });

        // ── Drag & drop on dropzone ──
        if (dropzone) {
            ['dragenter', 'dragover'].forEach(function (evt) {
                dropzone.addEventListener(evt, function (e) {
                    e.preventDefault(); e.stopPropagation();
                    dropzone.classList.add('cne-reveal-dropzone--active');
                });
            });
            ['dragleave', 'drop'].forEach(function (evt) {
                dropzone.addEventListener(evt, function (e) {
                    e.preventDefault(); e.stopPropagation();
                    dropzone.classList.remove('cne-reveal-dropzone--active');
                });
            });
            dropzone.addEventListener('drop', function (e) {
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    _processFiles(e.dataTransfer.files);
                }
            });
        }

        // ── Effect type list buttons ──
        if (effectGrid) {
            var effectBtns = effectGrid.querySelectorAll('.cne-reveal-effect-opt');
            effectBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var scene = _scenes[_currentSceneIdx];
                    if (!scene || !scene.revealEffect) return;
                    _pushUndo();
                    effectBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    scene.revealEffect.type = btn.dataset.effect;
                    _postRevealSettings(scene);
                    _notifyUpdate(false);
                });
            });
        }

        // ── Effect settings listeners ──
        var revealRadius = _qs('#cneRevealRadius');
        var revealFeather = _qs('#cneRevealFeather');
        var revealSpeed = _qs('#cneRevealSpeed');
        var revealInvert = _qs('#cneRevealInvert');

        function _postRevealSettings(scene) {
            if (!scene || !scene.revealEffect || !_iframe) return;
            var eff = scene.revealEffect;
            _iframe.contentWindow.postMessage({
                type: 'arbel-update-reveal',
                revealType: eff.type || 'circle',
                revealRadius: String(eff.radius || 120),
                revealFeather: String(eff.feather || 40),
                revealSpeed: String(eff.speed || 0.15),
                revealInvert: String(!!eff.invert)
            }, '*');
        }

        function _syncRevealEffect() {
            var scene = _scenes[_currentSceneIdx];
            if (!scene || !scene.revealEffect) return;
            _beginBurst('reveal');
            scene.revealEffect.radius = revealRadius ? parseInt(revealRadius.value) : 120;
            scene.revealEffect.feather = revealFeather ? parseInt(revealFeather.value) : 40;
            scene.revealEffect.speed = revealSpeed ? parseInt(revealSpeed.value) / 100 : 0.15;
            scene.revealEffect.invert = revealInvert ? revealInvert.checked : false;
            var rv = _qs('#cneRevealRadiusVal'); if (rv) rv.textContent = scene.revealEffect.radius;
            var fv = _qs('#cneRevealFeatherVal'); if (fv) fv.textContent = scene.revealEffect.feather;
            var sv = _qs('#cneRevealSpeedVal'); if (sv) sv.textContent = scene.revealEffect.speed.toFixed(2);
            _commitBurst('reveal', 600);
            _postRevealSettings(scene);
            _notifyUpdate(false);
        }

        if (revealRadius) revealRadius.addEventListener('input', _syncRevealEffect);
        if (revealFeather) revealFeather.addEventListener('input', _syncRevealEffect);
        if (revealSpeed) revealSpeed.addEventListener('input', _syncRevealEffect);
        if (revealInvert) revealInvert.addEventListener('change', _syncRevealEffect);


    }

    /* ─── Drag & Drop state for layer reordering ─── */
    var _revealDragIdx = null;

    function _renderRevealLayerList() {
        var layerList = _qs('#cneRevealLayerList');
        var settingsPanel = _qs('#cneRevealSettings');
        var layerHeader = _qs('#cneRevealLayerHeader');
        var emptyState = _qs('#cneRevealEmpty');
        if (!layerList) return;

        var scene = _scenes[_currentSceneIdx];
        var layers = (scene && scene.revealLayers) || [];
        layerList.innerHTML = '';

        var hasLayers = layers.length >= 1;
        if (settingsPanel) settingsPanel.style.display = hasLayers ? '' : 'none';
        if (layerHeader) layerHeader.style.display = layers.length > 0 ? '' : 'none';
        if (emptyState) emptyState.style.display = hasLayers ? 'none' : '';

        if (layers.length === 0) return;

        var eff = scene.revealEffect;
        if (!eff) return;

        // Ensure layerOrder exists with all entries
        if (!eff.layerOrder) {
            eff.layerOrder = ['bg'];
            layers.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (l) { eff.layerOrder.push(l.id); });
            eff.layerOrder.push('content');
        }
        // Ensure all layers appear in layerOrder (handle stale data)
        var layerMap = {};
        layers.forEach(function (l) { layerMap[l.id] = l; });
        layers.forEach(function (l) {
            if (eff.layerOrder.indexOf(l.id) === -1) {
                var ci = eff.layerOrder.indexOf('content');
                if (ci === -1) ci = eff.layerOrder.length;
                eff.layerOrder.splice(ci, 0, l.id);
            }
        });
        // Remove stale IDs
        eff.layerOrder = eff.layerOrder.filter(function (id) {
            return id === 'bg' || id === 'content' || !!layerMap[id];
        });
        if (eff.layerOrder.indexOf('bg') === -1) eff.layerOrder.unshift('bg');
        if (eff.layerOrder.indexOf('content') === -1) eff.layerOrder.push('content');

        var order = eff.layerOrder;

        // Render all layers in order (index 0 = bottom, last = top).
        // Display list shows them top→bottom so the top-most layer appears first.
        for (var di = order.length - 1; di >= 0; di--) {
            (function (orderIdx) {
                var id = order[orderIdx];
                var isBg = id === 'bg';
                var isContent = id === 'content';
                var layer = layerMap[id] || null;

                // Determine visibility
                var isVisible;
                if (isBg) isVisible = eff.bgVisible !== false;
                else if (isContent) isVisible = eff.contentVisible !== false;
                else isVisible = layer && layer.visible !== false;

                var row = document.createElement('div');
                row.className = 'cne-reveal-layer-item' + (isVisible ? '' : ' cne-reveal-layer-item--hidden');
                row.draggable = true;
                row.dataset.orderIdx = String(orderIdx);

                // ── Drag handle ──
                var handle = document.createElement('div');
                handle.className = 'cne-reveal-drag-handle';
                handle.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" opacity="0.4"><circle cx="3" cy="2" r="1.2"/><circle cx="7" cy="2" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="12" r="1.2"/><circle cx="7" cy="12" r="1.2"/></svg>';

                // ── Drag events ──
                row.addEventListener('dragstart', function (e) {
                    _revealDragIdx = orderIdx;
                    row.classList.add('cne-reveal-layer-item--dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(orderIdx));
                });
                row.addEventListener('dragend', function () {
                    _revealDragIdx = null;
                    row.classList.remove('cne-reveal-layer-item--dragging');
                    layerList.querySelectorAll('.cne-reveal-layer-item').forEach(function (it) {
                        it.classList.remove('cne-reveal-layer-item--over');
                    });
                });
                row.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (_revealDragIdx !== null && _revealDragIdx !== orderIdx) {
                        row.classList.add('cne-reveal-layer-item--over');
                    }
                });
                row.addEventListener('dragleave', function () {
                    row.classList.remove('cne-reveal-layer-item--over');
                });
                row.addEventListener('drop', function (e) {
                    e.preventDefault();
                    row.classList.remove('cne-reveal-layer-item--over');
                    if (_revealDragIdx === null || _revealDragIdx === orderIdx) return;
                    _pushUndo();
                    // Move the dragged item to the dropped position in layerOrder
                    var moved = order.splice(_revealDragIdx, 1)[0];
                    order.splice(orderIdx, 0, moved);
                    // Sync .order field on media layers
                    order.forEach(function (lid, oi) {
                        if (layerMap[lid]) layerMap[lid].order = oi;
                    });
                    _revealDragIdx = null;
                    _renderRevealLayerList();
                    _notifyUpdate(true);
                });

                // ── Thumbnail ──
                var thumb = document.createElement('div');
                thumb.className = 'cne-reveal-layer-thumb';

                if (isBg) {
                    var bgSrc = scene.bgVideo || scene.bgImage || '';
                    if (bgSrc && /^data:video/.test(bgSrc)) {
                        var bgVid = document.createElement('video');
                        bgVid.src = bgSrc; bgVid.muted = true;
                        bgVid.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px';
                        thumb.appendChild(bgVid);
                    } else if (bgSrc) {
                        thumb.style.backgroundImage = 'url(' + bgSrc + ')';
                        thumb.style.backgroundSize = 'cover';
                        thumb.style.backgroundPosition = 'center';
                    } else {
                        thumb.style.background = scene.bgColor || 'var(--border)';
                    }
                } else if (isContent) {
                    thumb.style.cssText = 'display:flex;align-items:center;justify-content:center;background:rgba(108,92,231,0.15);font-size:0.6rem;color:var(--accent2);font-weight:600';
                    thumb.textContent = 'Aa';
                } else if (layer) {
                    if (layer.mediaType === 'video') {
                        var vid = document.createElement('video');
                        vid.src = layer.dataUrl; vid.muted = true;
                        vid.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px';
                        vid.addEventListener('mouseenter', function () { vid.play(); });
                        vid.addEventListener('mouseleave', function () { vid.pause(); vid.currentTime = 0; });
                        thumb.appendChild(vid);
                    } else {
                        thumb.style.backgroundImage = 'url(' + layer.dataUrl + ')';
                        thumb.style.backgroundSize = 'cover';
                        thumb.style.backgroundPosition = 'center';
                    }
                }

                // ── Info ──
                var info = document.createElement('div');
                info.className = 'cne-reveal-layer-info';
                var label = document.createElement('span');
                label.className = 'cne-reveal-layer-label';
                var meta = document.createElement('span');
                meta.className = 'cne-hint mono';
                meta.style.fontSize = '0.58rem';

                if (isBg) {
                    label.textContent = 'Scene Background';
                    var bgMeta = scene.bgVideo ? 'VIDEO' : scene.bgImage ? 'IMAGE' : 'COLOR';
                    meta.textContent = bgMeta + (eff.bgMasked ? ' · masked' : ' · base');
                } else if (isContent) {
                    label.textContent = 'Text & Elements';
                    meta.textContent = eff.contentMasked ? 'MASKED · hover effect' : 'ABOVE · always visible';
                } else if (layer) {
                    var layerNum = 0;
                    for (var li = 0; li < order.length; li++) {
                        if (order[li] !== 'bg' && order[li] !== 'content') {
                            layerNum++;
                            if (order[li] === id) break;
                        }
                    }
                    label.textContent = 'Reveal Layer ' + layerNum;
                    var fname = layer.fileName.length > 22 ? layer.fileName.substr(0, 19) + '...' : layer.fileName;
                    meta.textContent = layer.mediaType.toUpperCase() + ' · ' + fname;
                }
                info.appendChild(label);
                info.appendChild(meta);

                // ── Visibility toggle (eye) ──
                var eyeBtn = document.createElement('button');
                eyeBtn.className = 'cne-reveal-eye-btn' + (isVisible ? '' : ' cne-reveal-eye-btn--off');
                eyeBtn.title = isVisible ? 'Hide layer' : 'Show layer';
                eyeBtn.innerHTML = isVisible
                    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>'
                    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
                eyeBtn.addEventListener('click', function () {
                    _pushUndo();
                    if (isBg) eff.bgVisible = !isVisible;
                    else if (isContent) eff.contentVisible = !isVisible;
                    else if (layer) layer.visible = !isVisible;
                    _renderRevealLayerList();
                    _notifyUpdate(true);
                });

                // ── Mask toggle ──
                var isMasked;
                if (isBg) isMasked = eff.bgMasked === true;
                else if (isContent) isMasked = eff.contentMasked === true;
                else isMasked = !layer || layer.masked !== false;

                var maskBtn = document.createElement('button');
                maskBtn.className = 'cne-reveal-mask-btn' + (isMasked ? ' cne-reveal-mask-btn--on' : '');
                maskBtn.title = isMasked ? 'Remove hover mask from layer' : 'Apply hover mask to layer';
                maskBtn.innerHTML = isMasked
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>';
                maskBtn.addEventListener('click', function () {
                    _pushUndo();
                    if (isBg) eff.bgMasked = !isMasked;
                    else if (isContent) eff.contentMasked = !isMasked;
                    else if (layer) layer.masked = !isMasked;
                    _renderRevealLayerList();
                    _notifyUpdate(true);
                });

                // ── Delete button (only for uploaded layers) ──
                var actions = document.createElement('div');
                actions.className = 'cne-reveal-layer-actions';
                actions.appendChild(maskBtn);
                actions.appendChild(eyeBtn);

                if (!isBg && !isContent && layer) {
                    var delBtn = document.createElement('button');
                    delBtn.className = 'cne-reveal-layer-del';
                    delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
                    delBtn.title = 'Remove layer';
                    delBtn.addEventListener('click', function () {
                        _pushUndo();
                        var li2 = scene.revealLayers.indexOf(layer);
                        if (li2 !== -1) scene.revealLayers.splice(li2, 1);
                        var oi = eff.layerOrder.indexOf(id);
                        if (oi !== -1) eff.layerOrder.splice(oi, 1);
                        scene.revealLayers.forEach(function (l, ii) { l.order = ii; });
                        if (scene.revealLayers.length < 1) { delete scene.revealEffect; }
                        _renderRevealLayerList();
                        _notifyUpdate(true);
                    });
                    actions.appendChild(delBtn);
                }

                row.appendChild(handle);
                row.appendChild(thumb);
                row.appendChild(info);
                row.appendChild(actions);
                layerList.appendChild(row);
            })(di);
        }

        // Sync effect grid active state
        _syncRevealEffectGrid();
    }

    function _syncRevealEffectGrid() {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || !scene.revealEffect) return;
        var grid = _qs('#cneRevealEffectGrid');
        if (!grid) return;
        var btns = grid.querySelectorAll('.cne-reveal-effect-opt');
        btns.forEach(function (b) { b.classList.toggle('active', b.dataset.effect === scene.revealEffect.type); });
        // Scroll active item into view
        var activeBtn = grid.querySelector('.cne-reveal-effect-opt.active');
        if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest' });
    }

    function _syncRevealLayerUI() {
        var scene = _scenes[_currentSceneIdx];
        var settingsPanel = _qs('#cneRevealSettings');
        var layerHeader = _qs('#cneRevealLayerHeader');
        var emptyState = _qs('#cneRevealEmpty');
        var layerList = _qs('#cneRevealLayerList');

        var hasLayers = scene && scene.revealLayers && scene.revealLayers.length >= 1;

        if (!hasLayers) {
            if (settingsPanel) settingsPanel.style.display = 'none';
            if (layerHeader) layerHeader.style.display = 'none';
            if (emptyState) emptyState.style.display = '';
            if (layerList) layerList.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Sync effect settings
        var eff = scene.revealEffect || { type: 'circle', radius: 120, feather: 40, speed: 0.15, invert: false };
        var rr = _qs('#cneRevealRadius'); if (rr) rr.value = eff.radius;
        var rf = _qs('#cneRevealFeather'); if (rf) rf.value = eff.feather;
        var rs = _qs('#cneRevealSpeed'); if (rs) rs.value = Math.round(eff.speed * 100);
        var ri = _qs('#cneRevealInvert'); if (ri) ri.checked = eff.invert;
        var rv = _qs('#cneRevealRadiusVal'); if (rv) rv.textContent = eff.radius;
        var fv = _qs('#cneRevealFeatherVal'); if (fv) fv.textContent = eff.feather;
        var sv = _qs('#cneRevealSpeedVal'); if (sv) sv.textContent = eff.speed.toFixed(2);


        _renderRevealLayerList();
    }

    /* ─── Form Fields List Renderer ─── */
    function _renderFormFieldsList(el) {
        var container = _qs('#cneFormFieldsList');
        if (!container || !el || !el.formFields) return;
        container.innerHTML = '';
        el.formFields.forEach(function (field, idx) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;font-size:0.7rem';

            var nameInput = document.createElement('input');
            nameInput.className = 'gen-input';
            nameInput.value = field.label || field.name;
            nameInput.style.cssText = 'flex:1;font-size:0.7rem;padding:4px 6px';
            nameInput.addEventListener('input', function () { _pushUndo(); field.label = nameInput.value; field.name = nameInput.value.toLowerCase().replace(/[^a-z0-9]/g, '_'); _notifyUpdate(true); });

            var typeSelect = document.createElement('select');
            typeSelect.className = 'gen-select';
            typeSelect.style.cssText = 'width:80px;font-size:0.65rem;padding:4px';
            ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'].forEach(function (t) {
                var opt = document.createElement('option');
                opt.value = t; opt.textContent = t;
                if (field.type === t) opt.selected = true;
                typeSelect.appendChild(opt);
            });
            typeSelect.addEventListener('change', function () { _pushUndo(); field.type = typeSelect.value; _notifyUpdate(true); });

            var delBtn = document.createElement('button');
            delBtn.className = 'cne-toolbar-btn';
            delBtn.style.cssText = 'padding:2px 6px;font-size:0.6rem;min-height:auto';
            delBtn.textContent = '\u00d7';
            delBtn.addEventListener('click', function () { _pushUndo(); el.formFields.splice(idx, 1); _renderFormFieldsList(el); _notifyUpdate(true); });

            row.appendChild(nameInput);
            row.appendChild(typeSelect);
            row.appendChild(delBtn);
            container.appendChild(row);
        });
    }

    /* ─── Autosave System ─── */
    var _autosaveTimer = null;
    var _AUTOSAVE_KEY = 'arbel-cinematic-autosave';

    function _autosave() {
        try {
            // Strip transient state: _editingMenuOverlay flag and _nav-overlay scene
            var saveOverrides = Object.assign({}, _overrides);
            delete saveOverrides._editingMenuOverlay;
            var saveScenes = _scenes.filter(function (s) { return s.id !== '_nav-overlay'; });
            var data = {
                version: 2,
                meta: { name: _getBrandName(), savedAt: new Date().toISOString() },
                scenes: saveScenes,
                overrides: saveOverrides,
                designTokens: _designTokens,
                timestamp: Date.now()
            };
            localStorage.setItem(_AUTOSAVE_KEY, JSON.stringify(data));
        } catch (ex) { /* quota exceeded — silently ignore */ }
    }

    function _scheduleAutosave() {
        clearTimeout(_autosaveTimer);
        _autosaveTimer = setTimeout(_autosave, 2000);
    }

    function _restoreAutosave() {
        try {
            var raw = localStorage.getItem(_AUTOSAVE_KEY);
            if (!raw) return false;
            var data = JSON.parse(raw);
            if (!data || !Array.isArray(data.scenes) || data.scenes.length === 0) return false;
            // Only restore if less than 7 days old
            if (data.timestamp && Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
            return data;
        } catch (ex) { return false; }
    }

    function _clearAutosave() {
        try { localStorage.removeItem(_AUTOSAVE_KEY); } catch (ex) { /* ignore */ }
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

        if (_activeDevice === 'desktop') {
            _postIframe('arbel-update-style', { id: el.id, prop: prop, value: value || '' });
        }
        _commitBurst('style', 600);
        _notifyUpdate(_activeDevice !== 'desktop');
    }

    /** Build combined CSS transform from 3D inputs and apply */
    function _apply3DTransform() {
        var rx = parseInt((_qs('#cne3dRotateX') || {}).value) || 0;
        var ry = parseInt((_qs('#cne3dRotateY') || {}).value) || 0;
        var rz = parseInt((_qs('#cne3dRotateZ') || {}).value) || 0;
        var tz = parseInt((_qs('#cne3dTranslateZ') || {}).value) || 0;
        var parts = [];
        if (rx) parts.push('rotateX(' + rx + 'deg)');
        if (ry) parts.push('rotateY(' + ry + 'deg)');
        if (rz) parts.push('rotateZ(' + rz + 'deg)');
        if (tz) parts.push('translateZ(' + tz + 'px)');
        _setElStyle('transform', parts.length > 0 ? parts.join(' ') : '');
        _setElStyle('transformStyle', parts.length > 0 ? 'preserve-3d' : '');
    }

    /** Alignment — aligns selected elements */
    function _alignElements(mode) {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || _selectedElementIds.length < 2) return;
        _pushUndo();
        var els = scene.elements.filter(function (e) { return _selectedElementIds.indexOf(e.id) >= 0; });
        if (els.length < 2) return;

        var rects = els.map(function (el) {
            var bucket = _getStyleBucket(el);
            return {
                el: el,
                top: parseInt(bucket.top) || 0,
                left: parseInt(bucket.left) || 0,
                width: parseInt(bucket.width) || 100,
                height: parseInt(bucket.height) || 50
            };
        });

        switch (mode) {
            case 'left':
                var minL = Math.min.apply(null, rects.map(function (r) { return r.left; }));
                rects.forEach(function (r) { _getStyleBucket(r.el).left = minL + 'px'; });
                break;
            case 'center-h':
                var centers = rects.map(function (r) { return r.left + r.width / 2; });
                var avgC = centers.reduce(function (a, b) { return a + b; }, 0) / centers.length;
                rects.forEach(function (r) { _getStyleBucket(r.el).left = Math.round(avgC - r.width / 2) + 'px'; });
                break;
            case 'right':
                var maxR = Math.max.apply(null, rects.map(function (r) { return r.left + r.width; }));
                rects.forEach(function (r) { _getStyleBucket(r.el).left = (maxR - r.width) + 'px'; });
                break;
            case 'top':
                var minT = Math.min.apply(null, rects.map(function (r) { return r.top; }));
                rects.forEach(function (r) { _getStyleBucket(r.el).top = minT + 'px'; });
                break;
            case 'center-v':
                var middles = rects.map(function (r) { return r.top + r.height / 2; });
                var avgM = middles.reduce(function (a, b) { return a + b; }, 0) / middles.length;
                rects.forEach(function (r) { _getStyleBucket(r.el).top = Math.round(avgM - r.height / 2) + 'px'; });
                break;
            case 'bottom':
                var maxB = Math.max.apply(null, rects.map(function (r) { return r.top + r.height; }));
                rects.forEach(function (r) { _getStyleBucket(r.el).top = (maxB - r.height) + 'px'; });
                break;
            case 'dist-h':
                if (rects.length < 3) break;
                rects.sort(function (a, b) { return a.left - b.left; });
                var totalW = rects[rects.length - 1].left + rects[rects.length - 1].width - rects[0].left;
                var sumW = rects.reduce(function (a, r) { return a + r.width; }, 0);
                var gap = (totalW - sumW) / (rects.length - 1);
                var x = rects[0].left;
                rects.forEach(function (r, i) {
                    if (i > 0) { x += gap; }
                    _getStyleBucket(r.el).left = Math.round(x) + 'px';
                    x += r.width;
                });
                break;
            case 'dist-v':
                if (rects.length < 3) break;
                rects.sort(function (a, b) { return a.top - b.top; });
                var totalH = rects[rects.length - 1].top + rects[rects.length - 1].height - rects[0].top;
                var sumH = rects.reduce(function (a, r) { return a + r.height; }, 0);
                var gapV = (totalH - sumH) / (rects.length - 1);
                var y = rects[0].top;
                rects.forEach(function (r, i) {
                    if (i > 0) { y += gapV; }
                    _getStyleBucket(r.el).top = Math.round(y) + 'px';
                    y += r.height;
                });
                break;
        }
        _notifyUpdate(true);
    }

    /** Bring element to front (highest z-index in scene) */
    function _bringToFront() {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || !_selectedElementId) return;
        _pushUndo();
        var maxZ = 0;
        scene.elements.forEach(function (e) { var z = parseInt(e.style && e.style.zIndex) || 0; if (z > maxZ) maxZ = z; });
        var el = _getSelectedElement();
        if (el) {
            if (!el.style) el.style = {};
            el.style.zIndex = String(maxZ + 1);
            var zInput = _qs('#cneZIndex');
            if (zInput) zInput.value = el.style.zIndex;
            _notifyUpdate(true);
        }
    }

    /** Send element to back (lowest z-index in scene) */
    function _sendToBack() {
        var scene = _scenes[_currentSceneIdx];
        if (!scene || !_selectedElementId) return;
        _pushUndo();
        var minZ = 999;
        scene.elements.forEach(function (e) { var z = parseInt(e.style && e.style.zIndex) || 0; if (z < minZ) minZ = z; });
        var el = _getSelectedElement();
        if (el) {
            if (!el.style) el.style = {};
            el.style.zIndex = String(Math.max(0, minZ - 1));
            var zInput = _qs('#cneZIndex');
            if (zInput) zInput.value = el.style.zIndex;
            _notifyUpdate(true);
        }
    }

    /** Toggle lock flag on selected element */
    function _toggleLock() {
        var el = _getSelectedElement();
        if (!el) return;
        _pushUndo();
        el.locked = !el.locked;
        _postIframe('arbel-lock', { id: el.id, locked: el.locked });
        _renderElementList();
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

    function _offsetClonePosition(sty) {
        if (!sty) return;
        if (sty.top !== undefined) {
            var t = parseFloat(sty.top) || 0;
            var tUnit = String(sty.top).indexOf('%') >= 0 ? '%' : 'px';
            sty.top = (t + 20) + tUnit;
        }
        if (sty.bottom !== undefined) {
            var b = parseFloat(sty.bottom) || 0;
            var bUnit = String(sty.bottom).indexOf('%') >= 0 ? '%' : 'px';
            sty.bottom = (b - 20) + bUnit;
        }
        if (sty.left !== undefined) {
            var l = parseFloat(sty.left) || 0;
            var lUnit = String(sty.left).indexOf('%') >= 0 ? '%' : 'px';
            sty.left = (l + 20) + lUnit;
        }
        if (sty.right !== undefined) {
            var r = parseFloat(sty.right) || 0;
            var rUnit = String(sty.right).indexOf('%') >= 0 ? '%' : 'px';
            sty.right = (r - 20) + rUnit;
        }
    }

    function _pasteElement() {
        if (!_clipboard || _clipboard.length === 0) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        _pushUndo();
        var newIds = [];
        // Generate a new group ID mapping so pasted elements don't join original groups
        var groupMap = {};
        for (var c = 0; c < _clipboard.length; c++) {
            var clone = JSON.parse(JSON.stringify(_clipboard[c]));
            clone.id = clone.tag + '-' + Date.now().toString(36) + c;
            if (clone.group) {
                if (!groupMap[clone.group]) groupMap[clone.group] = 'grp-' + Date.now().toString(36) + '-' + c;
                clone.group = groupMap[clone.group];
            }
            _offsetClonePosition(clone.style);
            _offsetClonePosition(clone.tabletStyle);
            _offsetClonePosition(clone.mobileStyle);
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
        var groupMap = {};
        // Iterate in reverse insertion order to maintain relative positions
        for (var i = scene.elements.length - 1; i >= 0; i--) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                var clone = JSON.parse(JSON.stringify(scene.elements[i]));
                clone.id = scene.elements[i].tag + '-' + Date.now().toString(36) + i;
                if (clone.group) {
                    if (!groupMap[clone.group]) groupMap[clone.group] = 'grp-' + Date.now().toString(36) + '-' + i;
                    clone.group = groupMap[clone.group];
                }
                _offsetClonePosition(clone.style);
                _offsetClonePosition(clone.tabletStyle);
                _offsetClonePosition(clone.mobileStyle);
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

    /* ─── Copy / Paste Style ─── */
    function _copyStyle() {
        var el = _getSelectedElement();
        if (!el) return;
        _styleClipboard = {
            style: JSON.parse(JSON.stringify(el.style || {})),
            hoverStyle: JSON.parse(JSON.stringify(el.hoverStyle || {}))
        };
        // Remove positional props — we only want visual styling
        var positional = ['position','top','left','right','bottom','width','height','zIndex'];
        positional.forEach(function (p) { delete _styleClipboard.style[p]; });
    }

    function _pasteStyle() {
        if (!_styleClipboard) return;
        var scene = _scenes[_currentSceneIdx];
        if (!scene || _selectedElementIds.length === 0) return;
        _pushUndo();
        for (var i = 0; i < scene.elements.length; i++) {
            if (_selectedElementIds.indexOf(scene.elements[i].id) >= 0) {
                var el = scene.elements[i];
                var clip = JSON.parse(JSON.stringify(_styleClipboard));
                // Merge style: keep positional, overwrite visual
                Object.keys(clip.style).forEach(function (k) { el.style[k] = clip.style[k]; });
                // Overwrite hover style entirely
                el.hoverStyle = clip.hoverStyle;
            }
        }
        var sel = _getSelectedElement();
        if (sel) _updatePropertiesFromScene(sel);
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
        addItem('Copy Style', 'Ctrl+Alt+C', (!multi && _selectedElementIds.length === 1) ? _copyStyle : null);
        addItem('Paste Style', 'Ctrl+Alt+V', _styleClipboard && _selectedElementIds.length > 0 ? _pasteStyle : null);
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
        if (!multi) {
            addItem('Bring to Front', '', function () { _bringToFront(); });
            addItem('Send to Back', '', function () { _sendToBack(); });
            var el = _getSelectedElement();
            addItem(el && el.locked ? 'Unlock' : 'Lock', '', function () { _toggleLock(); });
            addSep();
        }
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
        // If nav bar is selected, hide it via the toggle instead of trying to remove from scene.elements
        var navIds = ['site-nav', 'site-logo'];
        var isNav = _selectedElementIds.some(function (id) { return navIds.indexOf(id) >= 0; });
        if (isNav) {
            _overrides.showNav = false;
            var navToggle = _qs('#cneShowNav');
            if (navToggle) navToggle.checked = false;
            var navLinkSection = _qs('#cneNavLinkSection');
            if (navLinkSection) navLinkSection.style.display = 'none';
            _selectedElementId = null;
            _selectedElementIds = [];
            _clearProperties();
            _notifyUpdate(true);
            return;
        }
        _pushUndo();
        var scene = _scenes[_currentSceneIdx];
        if (!scene) return;
        var ids = _selectedElementIds;
        scene.elements = scene.elements.filter(function (e) { return ids.indexOf(e.id) < 0; });
        // Clean up overrides for deleted elements
        ids.forEach(function (id) { if (_overrides[id]) delete _overrides[id]; });
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

        // Show/hide alignment toolbar based on multi-select
        var alignGroup = _qs('#cneAlignGroup');
        if (alignGroup) alignGroup.style.display = _selectedElementIds.length > 1 ? '' : 'none';

        // Special handling for nav structural elements (hamburger trigger / close button)
        if (_selectedElementId === 'menu-trigger' || _selectedElementId === 'menu-close') {
            var elHeader = _qs('#cneElHeader');
            if (elHeader) elHeader.textContent = _selectedElementId === 'menu-trigger' ? 'Menu Trigger' : 'Close Button';
            var propsContainer = _qs('#cnePropsContainer');
            if (propsContainer) propsContainer.style.display = 'none';
            // Open the hamburger menu settings dropdown
            var menuDd = _qs('#cneMenuToolbarDd');
            var menuBtn = _qs('#cneMenuToolbarBtn');
            if (menuDd && menuDd.style.display === 'none') {
                menuDd.style.display = '';
                if (menuBtn) {
                    var r = menuBtn.getBoundingClientRect();
                    menuDd.style.top = (r.bottom + 6) + 'px';
                    menuDd.style.left = (r.left + r.width / 2) + 'px';
                    menuDd.style.transform = 'translateX(-50%)';
                }
            }
            return;
        }

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
            var isLottie = el.lottieUrl !== undefined;
            var isSvg = el.svgContent !== undefined;
            var isEmbed = el.embedUrl !== undefined;
            mediaSection.style.display = (isImg || isVideo || isLottie || isSvg || isEmbed) ? '' : 'none';
            if (imgRow) imgRow.style.display = isImg ? '' : 'none';
            if (imgUploadRow) imgUploadRow.style.display = isImg ? '' : 'none';
            if (imgFitRow) imgFitRow.style.display = isImg ? '' : 'none';
            if (videoRow) videoRow.style.display = isVideo ? '' : 'none';
            if (videoOptsRow) videoOptsRow.style.display = isVideo ? '' : 'none';
            var videoUploadRow = _qs('#cneVideoUploadRow');
            if (videoUploadRow) videoUploadRow.style.display = isVideo ? '' : 'none';
            var cropBtn = _qs('#cneCropBtn');
            if (cropBtn) cropBtn.style.display = isImg ? '' : 'none';
            var lottieRow = _qs('#cneLottieRow');
            if (lottieRow) lottieRow.style.display = isLottie ? '' : 'none';
            var svgRow = _qs('#cneSvgRow');
            if (svgRow) svgRow.style.display = (isSvg && !el.shapeName) ? '' : 'none';
            var shapeColorRow = _qs('#cneShapeColorRow');
            if (shapeColorRow) shapeColorRow.style.display = el.shapeName ? '' : 'none';
            var embedRow = _qs('#cneEmbedRow');
            if (embedRow) embedRow.style.display = isEmbed ? '' : 'none';
        }

        // Populate media fields
        if (el.tag === 'img') {
            var imgSrc = _qs('#cneImgSrc');
            if (imgSrc) imgSrc.value = (el.src && el.src.indexOf('data:') === 0) ? '(uploaded)' : (el.src || '');
            var imgFit = _qs('#cneImgFit');
            if (imgFit) imgFit.value = _getElStyleValue(el, 'objectFit') || 'cover';
        } else if (el.tag === 'video') {
            var videoSrc = _qs('#cneVideoSrc');
            if (videoSrc) videoSrc.value = (el.src && el.src.indexOf('data:') === 0) ? '(uploaded)' : (el.src || '');
            var va = _qs('#cneVideoAutoplay'); if (va) va.checked = el.videoAutoplay !== false;
            var vl = _qs('#cneVideoLoop'); if (vl) vl.checked = el.videoLoop !== false;
            var vm = _qs('#cneVideoMuted'); if (vm) vm.checked = el.videoMuted !== false;
        }
        if (el.lottieUrl !== undefined) {
            var lottieInput = _qs('#cneLottieUrl');
            if (lottieInput) lottieInput.value = el.lottieUrl || '';
        }
        if (el.svgContent !== undefined) {
            var svgInput = _qs('#cneSvgContent');
            if (svgInput) svgInput.value = el.svgContent || '';
        }
        if (el.shapeName) {
            var scFill = _qs('#cneShapeColor'); if (scFill) scFill.value = el.shapeColor === 'none' ? '#000000' : (el.shapeColor || '#ffffff');
            var scStroke = _qs('#cneShapeStroke'); if (scStroke) scStroke.value = el.shapeStroke === 'none' ? '#000000' : (el.shapeStroke || '#ffffff');
            var scSW = _qs('#cneShapeStrokeWidth'); if (scSW) scSW.value = el.shapeStrokeWidth || 0;
        }
        if (el.embedUrl !== undefined) {
            var embedInput = _qs('#cneEmbedUrl');
            if (embedInput) embedInput.value = el.embedUrl || '';
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

        // Show/hide frame section (for frames AND shapes with media)
        var frameSection = _qs('#cneFrameSection');
        if (frameSection) {
            var isFrame = !!el.frameShape;
            var isShapeWithMedia = !!el.shapeName;
            var showFrameUI = isFrame || isShapeWithMedia;
            frameSection.style.display = showFrameUI ? '' : 'none';
            if (showFrameUI) {
                var fmType = _qs('#cneFrameMediaType'); if (fmType) fmType.value = el.frameMediaType || 'image';
                var fmSrc = _qs('#cneFrameSrc');
                if (fmSrc) fmSrc.value = (el.frameSrc && el.frameSrc.indexOf('data:') === 0) ? '(uploaded)' : (el.frameSrc || '');
                var fmVidSrc = _qs('#cneFrameVideoSrc');
                if (fmVidSrc) fmVidSrc.value = (el.frameMediaType === 'video' && el.frameSrc && el.frameSrc.indexOf('data:') === 0) ? '(uploaded)' : (el.frameMediaType === 'video' ? (el.frameSrc || '') : '');
                var fmFit = _qs('#cneFrameFit'); if (fmFit) fmFit.value = el.frameObjectFit || 'cover';
                var fmShape = _qs('#cneFrameShape'); if (fmShape) fmShape.value = el.frameShape || el.shapeName || 'circle';
                var fmImgRow = _qs('#cneFrameImgRow'); if (fmImgRow) fmImgRow.style.display = (el.frameMediaType !== 'video') ? '' : 'none';
                var fmVideoRow = _qs('#cneFrameVideoRow'); if (fmVideoRow) fmVideoRow.style.display = (el.frameMediaType === 'video') ? '' : 'none';
                // Hide Frame Shape selector for shapes (shape is already set)
                var fmShapeRow = _qs('#cneFrameShapeRow');
                if (fmShapeRow) fmShapeRow.style.display = isShapeWithMedia && !isFrame ? 'none' : '';
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

        // Reset element bg file inputs & update status indicators
        var _ebgU = _qs('#cneElBgUpload'); if (_ebgU) _ebgU.value = '';
        var _ebgV = _qs('#cneElBgVideoUpload'); if (_ebgV) _ebgV.value = '';
        var _hasElBgImg = _getElStyleValue(el, 'backgroundImage') && _getElStyleValue(el, 'backgroundImage') !== '';
        var _ebgIS = _qs('#cneElBgImgStatus'); if (_ebgIS) _ebgIS.style.display = _hasElBgImg ? '' : 'none';
        var _ebgIR = _qs('#cneElBgImgRemove'); if (_ebgIR) _ebgIR.style.display = _hasElBgImg ? '' : 'none';
        var _ebgVS = _qs('#cneElBgVidStatus'); if (_ebgVS) _ebgVS.style.display = el.bgVideo ? '' : 'none';
        var _ebgVR = _qs('#cneElBgVidRemove'); if (_ebgVR) _ebgVR.style.display = el.bgVideo ? '' : 'none';
        var _bgFitRow = _qs('#cneBgFitRow');
        if (_bgFitRow) {
            _bgFitRow.style.display = _hasElBgImg ? '' : 'none';
            if (_hasElBgImg) {
                var _bgSz = _qs('#cneBgSize'); if (_bgSz) _bgSz.value = _getElStyleValue(el, 'backgroundSize') || 'cover';
                var _bgPs = _qs('#cneBgPosition'); if (_bgPs) _bgPs.value = _getElStyleValue(el, 'backgroundPosition') || 'center';
            }
        }

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

        // 3D Transform — parse transform string to populate individual inputs
        var transform = _getElStyleValue(el, 'transform') || '';
        var rxMatch = transform.match(/rotateX\(([-\d.]+)deg\)/);
        var ryMatch = transform.match(/rotateY\(([-\d.]+)deg\)/);
        var rzMatch = transform.match(/rotateZ\(([-\d.]+)deg\)/);
        var tzMatch = transform.match(/translateZ\(([-\d.]+)px\)/);
        var rx3d = _qs('#cne3dRotateX');  if (rx3d) rx3d.value = rxMatch ? rxMatch[1] : '';
        var ry3d = _qs('#cne3dRotateY');  if (ry3d) ry3d.value = ryMatch ? ryMatch[1] : '';
        var rz3d = _qs('#cne3dRotateZ');  if (rz3d) rz3d.value = rzMatch ? rzMatch[1] : '';
        var tz3d = _qs('#cne3dTranslateZ'); if (tz3d) tz3d.value = tzMatch ? tzMatch[1] : '';
        var persp3d = _qs('#cne3dPerspective');
        if (persp3d) persp3d.value = parseInt(_getElStyleValue(el, 'perspective')) || '';
        var backface3d = _qs('#cne3dBackface');
        if (backface3d) backface3d.value = _getElStyleValue(el, 'backfaceVisibility') || '';
        var preset3d = _qs('#cne3dPreset');
        if (preset3d) preset3d.value = '';

        // Border
        var borderWidth = _qs('#cneBorderWidth');
        var borderColor = _qs('#cneBorderColor');
        var borderStyleSel = _qs('#cneBorderStyle');
        if (borderWidth || borderColor || borderStyleSel) {
            var borderParts = (_getElStyleValue(el, 'border') || '').match(/^(\d+)px\s+(\S+)\s+(.+)$/);
            if (borderWidth) borderWidth.value = borderParts ? borderParts[1] : '';
            if (borderStyleSel) borderStyleSel.value = borderParts ? borderParts[2] : 'solid';
            if (borderColor) borderColor.value = (borderParts ? _toHex(borderParts[3]) : '') || '#ffffff';
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
        var posRight = _qs('#cnePosRight');
        if (posRight) posRight.value = _getElStyleValue(el, 'right');
        var posBottom = _qs('#cnePosBottom');
        if (posBottom) posBottom.value = _getElStyleValue(el, 'bottom');
        var posW = _qs('#cnePosWidth');
        if (posW) posW.value = _getElStyleValue(el, 'width');
        var posH = _qs('#cnePosHeight');
        if (posH) posH.value = _getElStyleValue(el, 'height');

        // Scroll tab
        _updateScrollPanel();

        // Hover state
        _updateHoverPanel(el);

        // Form section
        var formSection = _qs('#cneFormSection');
        if (formSection) {
            var isForm = el.tag === 'form';
            formSection.style.display = isForm ? '' : 'none';
            if (isForm) {
                var fa = _qs('#cneFormAction'); if (fa) fa.value = el.formAction || '';
                var fm = _qs('#cneFormMethod'); if (fm) fm.value = el.formMethod || 'POST';
                var fs = _qs('#cneFormSubmitText'); if (fs) fs.value = el.formSubmitText || 'Send';
                _renderFormFieldsList(el);
            }
        }

        // ─── Rich Text Section (show for text-capable elements) ───
        var isTextEl = ['h1','h2','h3','p','span','a'].indexOf(el.tag) >= 0;
        var richTextSection = _qs('#cneRichTextSection');
        if (richTextSection) {
            richTextSection.style.display = isTextEl ? '' : 'none';
            if (isTextEl) {
                // Sync rich text button active states
                var richBtns = _qsa('#cneRichTextBar .cne-icon-btn');
                richBtns.forEach(function (btn) {
                    var prop = btn.getAttribute('data-prop');
                    var val = btn.getAttribute('data-val');
                    btn.classList.toggle('active', _getElStyleValue(el, prop) === val);
                });
                var tt = _qs('#cneTextTransform'); if (tt) tt.value = _getElStyleValue(el, 'textTransform') || '';
                var ws = _qs('#cneWordSpacing'); if (ws) ws.value = _getElStyleValue(el, 'wordSpacing') || '';
                var ts = _qs('#cneTextShadow'); if (ts) ts.value = _getElStyleValue(el, 'textShadow') || '';
                var tst = _qs('#cneTextStroke'); if (tst) tst.value = _getElStyleValue(el, 'webkitTextStroke') || '';
            }
        }

        // ─── Image Filters Section (show for img elements) ───
        var isImgEl = el.tag === 'img';
        var imgFiltersSection = _qs('#cneImageFiltersSection');
        if (imgFiltersSection) {
            imgFiltersSection.style.display = isImgEl ? '' : 'none';
            if (isImgEl) {
                // Parse existing filter string to populate sliders
                var filterStr = _getElStyleValue(el, 'filter') || '';
                var filterDefaults = {
                    'cneFilterBrightness': 100, 'cneFilterContrast': 100, 'cneFilterSaturate': 100,
                    'cneFilterBlur': 0, 'cneFilterHue': 0, 'cneFilterGrayscale': 0,
                    'cneFilterSepia': 0, 'cneFilterInvert': 0
                };
                var filterMap = {
                    'brightness': 'cneFilterBrightness', 'contrast': 'cneFilterContrast',
                    'saturate': 'cneFilterSaturate', 'blur': 'cneFilterBlur',
                    'hue-rotate': 'cneFilterHue', 'grayscale': 'cneFilterGrayscale',
                    'sepia': 'cneFilterSepia', 'invert': 'cneFilterInvert'
                };
                // Reset to defaults
                Object.keys(filterDefaults).forEach(function (id) {
                    var inp = _qs('#' + id);
                    if (inp) inp.value = filterDefaults[id];
                    var lbl = _qs('#' + id + 'Val');
                    if (lbl) lbl.textContent = filterDefaults[id] + (id === 'cneFilterBlur' ? 'px' : id === 'cneFilterHue' ? '°' : '%');
                });
                // Parse each filter function
                var filterRe = /([\w-]+)\(([^)]+)\)/g;
                var fMatch;
                while ((fMatch = filterRe.exec(filterStr))) {
                    var fId = filterMap[fMatch[1]];
                    if (fId) {
                        var fVal = parseFloat(fMatch[2]);
                        var fInp = _qs('#' + fId);
                        if (fInp) fInp.value = fVal;
                        var fLbl = _qs('#' + fId + 'Val');
                        if (fLbl) fLbl.textContent = fVal + (fId === 'cneFilterBlur' ? 'px' : fId === 'cneFilterHue' ? '°' : '%');
                    }
                }
                var cp = _qs('#cneClipPath'); if (cp) cp.value = _getElStyleValue(el, 'clipPath') || '';
            }
        }

        // ─── Layout Section (show for div/container elements) ───
        var isDivEl = el.tag === 'div' || el.tag === 'section' || el.tag === 'header' || el.tag === 'footer' || el.tag === 'nav';
        var layoutSection = _qs('#cneLayoutSection');
        if (layoutSection) {
            layoutSection.style.display = isDivEl ? '' : 'none';
            if (isDivEl) {
                var fd = _qs('#cneFlexDir'); if (fd) fd.value = _getElStyleValue(el, 'flexDirection') || '';
                var fw = _qs('#cneFlexWrap'); if (fw) fw.value = _getElStyleValue(el, 'flexWrap') || '';
                var jc = _qs('#cneJustify'); if (jc) jc.value = _getElStyleValue(el, 'justifyContent') || '';
                var ai = _qs('#cneAlignItems'); if (ai) ai.value = _getElStyleValue(el, 'alignItems') || '';
                var fg = _qs('#cneFlexGap'); if (fg) fg.value = _getElStyleValue(el, 'gap') || '';
                var ov = _qs('#cneOverflow'); if (ov) ov.value = _getElStyleValue(el, 'overflow') || '';
            }
        }

        // ─── Advanced Section (blend mode + cursor — all elements) ───
        var bm = _qs('#cneBlendMode'); if (bm) bm.value = _getElStyleValue(el, 'mixBlendMode') || '';
        var cr = _qs('#cneCursor'); if (cr) cr.value = _getElStyleValue(el, 'cursor') || '';

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

        // Auto-switch to Scene tab so user can edit background
        var sceneTab = _container ? _container.querySelector('.cne-prop-tab[data-tab="scene"]') : null;
        if (sceneTab) sceneTab.click();
    }

    function _notifyUpdate(rerender) {
        _updateTimeline();
        _markDirty();
        if (_onUpdate) {
            // Build overrides to send: include _editingMenuOverlay ONLY when
            // we are actively in overlay editing mode (so the compiler can
            // keep the overlay scene).  Outside that mode, strip the flag
            // so it never leaks into saved/persisted state.
            var outOverrides = _overrides;
            if (!_overrides._editingMenuOverlay) {
                outOverrides = Object.assign({}, _overrides);
                delete outOverrides._editingMenuOverlay;
            }
            _onUpdate({
                scenes: _scenes,
                overrides: outOverrides,
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
            overrides: JSON.parse(JSON.stringify(_overrides)),
            designTokens: JSON.parse(JSON.stringify(_designTokens))
        };
    }

    /* Check if two state snapshots are identical (dirty-state guard) */
    var _lastSnapshotHash = '';
    function _fastHash(obj) {
        var str = JSON.stringify(obj);
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
    }
    function _stateEqual(a, b) {
        if (!a || !b) return false;
        return _fastHash(a) === _fastHash(b);
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
        if (_stateEqual(snapshot, _snapshotState())) return;
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
        // If we're in overlay editing mode and the undo state doesn't have the overlay flag,
        // exit overlay mode first so UI stays consistent
        var wasInOverlay = _overrides._editingMenuOverlay;
        _scenes = state.scenes;
        _overrides = state.overrides;
        if (wasInOverlay && !_overrides._editingMenuOverlay) {
            // Restore toolbar button from overlay mode
            var menuToolbarBtn = _qs('#cneMenuToolbarBtn');
            if (menuToolbarBtn && menuToolbarBtn._overlayMode) {
                menuToolbarBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>';
                menuToolbarBtn.style.background = '';
                menuToolbarBtn.style.borderColor = '';
                menuToolbarBtn.title = 'Hamburger Menu Settings';
                menuToolbarBtn._overlayMode = false;
            }
            var editMenuOverlayBtn = _qs('#cneEditMenuOverlay');
            if (editMenuOverlayBtn) {
                editMenuOverlayBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Design Menu Overlay';
                editMenuOverlayBtn.style.background = 'rgba(108,92,231,0.15)';
                editMenuOverlayBtn.style.borderColor = 'rgba(108,92,231,0.3)';
            }
        }
        if (state.designTokens) {
            _designTokens = state.designTokens;
            _syncTokenUI();
        }
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
        var wasInOverlay = _overrides._editingMenuOverlay;
        _scenes = state.scenes;
        _overrides = state.overrides;
        if (wasInOverlay && !_overrides._editingMenuOverlay) {
            var menuToolbarBtn = _qs('#cneMenuToolbarBtn');
            if (menuToolbarBtn && menuToolbarBtn._overlayMode) {
                menuToolbarBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>';
                menuToolbarBtn.style.background = '';
                menuToolbarBtn.style.borderColor = '';
                menuToolbarBtn.title = 'Hamburger Menu Settings';
                menuToolbarBtn._overlayMode = false;
            }
            var editMenuOverlayBtn = _qs('#cneEditMenuOverlay');
            if (editMenuOverlayBtn) {
                editMenuOverlayBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg> Design Menu Overlay';
                editMenuOverlayBtn.style.background = 'rgba(108,92,231,0.15)';
                editMenuOverlayBtn.style.borderColor = 'rgba(108,92,231,0.3)';
            }
        }
        if (state.designTokens) {
            _designTokens = state.designTokens;
            _syncTokenUI();
        }
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

    /* ═══════════════════════════════════════════════════════════════
       AUTO-GENERATE / RANDOMIZER  — Smart algorithmic website
       builder. Creates a complete multi-scene cinematic website
       from brand info using design rules, curated palettes, and
       weighted random selection — no AI model needed.
       ═══════════════════════════════════════════════════════════════ */

    var _DESIGN_PALETTES = [
        /* ── Darks ── */
        { name: 'Midnight Luxe',   bg: '#08080f', primary: '#6C5CE7', secondary: '#a29bfe', text: '#f0f0f0', surface: '#13132a', accent2: '#c4b5fd' },
        { name: 'Obsidian',        bg: '#0a0a0f', primary: '#8b5cf6', secondary: '#c084fc', text: '#faf5ff', surface: '#1a1a2e', accent2: '#a78bfa' },
        { name: 'Ember Glow',      bg: '#0d0907', primary: '#e17055', secondary: '#fdcb6e', text: '#ffeaa7', surface: '#2d1f1a', accent2: '#fab1a0' },
        { name: 'Deep Ocean',      bg: '#060b14', primary: '#0984e3', secondary: '#74b9ff', text: '#dfe6e9', surface: '#0b1a2e', accent2: '#48dbfb' },
        { name: 'Aurora Night',    bg: '#040a12', primary: '#00cec9', secondary: '#55efc4', text: '#f0f0f0', surface: '#081828', accent2: '#81ecec' },
        { name: 'Rose Noir',       bg: '#0c0808', primary: '#e84393', secondary: '#fd79a8', text: '#ffeef5', surface: '#1f1218', accent2: '#f8a5c2' },
        { name: 'Forest Depths',   bg: '#060d08', primary: '#00b894', secondary: '#badc58', text: '#e8f8e8', surface: '#0d1f0f', accent2: '#7bed9f' },
        { name: 'Neon Cyber',      bg: '#080814', primary: '#a855f7', secondary: '#06ffa5', text: '#e0e0ff', surface: '#12122a', accent2: '#38ef7d' },
        { name: 'Amber Luxury',    bg: '#0d0a06', primary: '#f39c12', secondary: '#f1c40f', text: '#fdf6e3', surface: '#1f1a10', accent2: '#ffeaa7' },
        { name: 'Frost Blue',      bg: '#080c12', primary: '#74b9ff', secondary: '#a0d2ff', text: '#ecf0f1', surface: '#101a28', accent2: '#dff9fb' },
        { name: 'Crimson Edge',    bg: '#0a0606', primary: '#d63031', secondary: '#ff7675', text: '#ffeaea', surface: '#1a0c0c', accent2: '#fab1a0' },
        /* ── Rich / Premium ── */
        { name: 'Sapphire Gold',   bg: '#070a14', primary: '#2d3ae8', secondary: '#daa520', text: '#f0f0ff', surface: '#0e1428', accent2: '#ffd700' },
        { name: 'Noir Elegance',   bg: '#0a0a0a', primary: '#e0e0e0', secondary: '#888888', text: '#ffffff', surface: '#161616', accent2: '#c0c0c0' },
        { name: 'Royal Plum',      bg: '#0a060e', primary: '#9b59b6', secondary: '#d6a2e8', text: '#f5eef8', surface: '#1a1028', accent2: '#be2edd' },
        { name: 'Teal Pulse',      bg: '#060c0c', primary: '#1abc9c', secondary: '#00d2d3', text: '#e8fffe', surface: '#0c1e1e', accent2: '#48dbfb' },
        { name: 'Coral Sunset',    bg: '#0e0808', primary: '#ff6348', secondary: '#ffa502', text: '#fff5ee', surface: '#1e1212', accent2: '#ff7f50' },
        { name: 'Electric Indigo', bg: '#08061a', primary: '#5f27cd', secondary: '#341f97', text: '#e8e0ff', surface: '#140e30', accent2: '#706fd3' },
        { name: 'Mint Fresh',      bg: '#060e0c', primary: '#0be881', secondary: '#67e480', text: '#e8fff4', surface: '#0c201a', accent2: '#a3f7bf' },
        { name: 'Sunset Blaze',    bg: '#100808', primary: '#eb3b5a', secondary: '#f7b731', text: '#fff0e8', surface: '#1e0e10', accent2: '#fc5c65' },
        { name: 'Steel Modern',    bg: '#0c0c10', primary: '#576574', secondary: '#8395a7', text: '#f0f0f0', surface: '#161620', accent2: '#c8c8d4' }
    ];

    /* Which scene templates go well together in a flow */
    var _FLOW_RECIPES = [
        ['hero', 'featureGrid', 'showcase', 'stats', 'testimonial', 'ctaSection'],
        ['gradientHero', 'splitMedia', 'marquee', 'featureGrid', 'bigText', 'ctaSection'],
        ['hero', 'textReveal', 'imageReveal', 'stats', 'cardStack', 'ctaSection'],
        ['gradientHero', 'marquee', 'showcase', 'testimonial', 'featureGrid', 'ctaSection'],
        ['hero', 'splitMedia', 'stats', 'imageReveal', 'testimonial', 'ctaSection'],
        ['gradientHero', 'bigText', 'featureGrid', 'splitMedia', 'marquee', 'ctaSection'],
        ['hero', 'cardStack', 'textReveal', 'showcase', 'stats', 'ctaSection'],
        ['gradientHero', 'imageReveal', 'marquee', 'featureGrid', 'testimonial', 'ctaSection'],
        /* ── New: longer / more creative flows ── */
        ['gradientHero', 'textReveal', 'featureGrid', 'imageReveal', 'testimonial', 'stats', 'ctaSection'],
        ['hero', 'marquee', 'splitMedia', 'cardStack', 'stats', 'ctaSection'],
        ['gradientHero', 'showcase', 'bigText', 'featureGrid', 'testimonial', 'ctaSection'],
        ['hero', 'splitMedia', 'featureGrid', 'marquee', 'testimonial', 'cardStack', 'ctaSection'],
        ['hero', 'imageReveal', 'stats', 'textReveal', 'ctaSection'],
        ['gradientHero', 'featureGrid', 'testimonial', 'bigText', 'ctaSection'],
        ['hero', 'bigText', 'splitMedia', 'imageReveal', 'featureGrid', 'ctaSection'],
        ['gradientHero', 'cardStack', 'marquee', 'stats', 'testimonial', 'ctaSection']
    ];

    /* Curated entrance animation sets — each is a cohesive visual style */
    var _ENTRANCE_SETS = [
        /* Classic */
        ['fadeInUp', 'fadeInUp', 'fadeInLeft', 'fadeInRight', 'scaleIn'],
        ['blurIn', 'blurInUp', 'blurInScale', 'fadeInUp', 'scaleInUp'],
        ['slideInUp', 'clipRevealUp', 'clipRevealLeft', 'slideInLeft', 'slideInRight'],
        /* Cinematic */
        ['cinematicFade', 'cinematicSlide', 'cinematicReveal', 'cinematicRise', 'cinematicDrop'],
        ['cinematicFade', 'cinematicReveal', 'blurIn', 'clipRevealUp', 'fadeInUp'],
        /* 3D */
        ['flip3DX', 'cubeRotate', 'doorOpen', 'perspective3D', 'unfold'],
        ['perspective3D', 'swingDoor', 'flip3DY', 'cubeRotate', 'pivotIn'],
        /* Playful */
        ['bounceIn', 'bounceInUp', 'bounceInLeft', 'rubberBand', 'jackInTheBox'],
        ['bounceIn', 'tada', 'jello', 'heartBeat', 'swingIn'],
        /* Clean */
        ['scaleIn', 'scaleInUp', 'zoomIn', 'fadeInUp', 'blurInUp'],
        ['fadeInUp', 'fadeInLeft', 'fadeInRight', 'fadeInDown', 'scaleIn'],
        /* Rotate / Swing */
        ['rotateIn', 'rotateInLeft', 'swingIn', 'flipInX', 'flipInY'],
        /* Mixed Premium */
        ['cinematicFade', 'blurInUp', 'scaleInUp', 'clipRevealUp', 'fadeInUp'],
        ['blurInScale', 'cinematicReveal', 'perspective3D', 'fadeInUp', 'scaleIn']
    ];

    /* 3D background effect options with varied intensity/speed combos */
    var _BG3D_OPTIONS = [
        { type: 'gradient-orbs', intensity: '6', speed: 'medium' },
        { type: 'gradient-orbs', intensity: '8', speed: 'fast' },
        { type: 'particle-field', intensity: '5', speed: 'slow' },
        { type: 'particle-field', intensity: '7', speed: 'medium' },
        { type: 'aurora', intensity: '7', speed: 'medium' },
        { type: 'aurora', intensity: '5', speed: 'slow' },
        { type: 'mesh-gradient', intensity: '5', speed: 'slow' },
        { type: 'mesh-gradient', intensity: '7', speed: 'medium' },
        { type: 'noise-fog', intensity: '4', speed: 'slow' },
        { type: 'noise-fog', intensity: '6', speed: 'medium' },
        { type: 'starfield', intensity: '6', speed: 'medium' },
        { type: 'starfield', intensity: '8', speed: 'fast' },
        { type: 'wave-grid', intensity: '5', speed: 'medium' },
        { type: 'wave-grid', intensity: '7', speed: 'fast' }
    ];

    /* Content variations for template placeholder text */
    var _SECTION_COPY = {
        hero: [
            { title: '{brand}', sub: '{tagline}' },
            { title: 'Welcome to {brand}', sub: '{tagline}' },
            { title: '{brand}', sub: 'Something amazing is here' },
            { title: 'This is {brand}', sub: 'Where ideas come to life' },
            { title: '{brand}', sub: 'Redefining what is possible' }
        ],
        splitMedia: [
            { title: 'Our Story', sub: 'We craft experiences that inspire and delight — blending strategy, design, and technology.' },
            { title: 'Who We Are', sub: 'A team of creators, engineers, and strategists building for the future.' },
            { title: 'Our Vision', sub: 'Pushing boundaries, one project at a time. Innovation meets execution.' },
            { title: 'About Us', sub: 'We believe great design solves real problems. That has been our mission since day one.' },
            { title: 'The Approach', sub: 'Research-driven. Design-obsessed. Result-oriented. That is how we work.' }
        ],
        showcase: [
            { title: 'Featured Work', sub: 'A showcase of our finest creations.' },
            { title: 'Our Portfolio', sub: 'Explore what we have built for brands worldwide.' },
            { title: 'Highlights', sub: 'The work that defines us and moves industries.' },
            { title: 'Case Studies', sub: 'See the impact of thoughtful design in action.' },
            { title: 'Selected Projects', sub: 'Handpicked work that pushes boundaries.' }
        ],
        stats: [
            { title: 'By The Numbers', sub: '' },
            { title: 'Our Impact', sub: '' },
            { title: 'Results That Matter', sub: '' },
            { title: 'The Track Record', sub: '' },
            { title: 'Proven Results', sub: '' }
        ],
        textReveal: [
            { line1: 'Design', line2: 'Matters' },
            { line1: 'Build', line2: 'Better' },
            { line1: 'Create', line2: 'Impact' },
            { line1: 'Think', line2: 'Bigger' },
            { line1: 'Dream', line2: 'Forward' }
        ],
        marquee: [
            { text: '{brand} \u2022 Innovation \u2022 Design \u2022 Excellence \u2022' },
            { text: 'Creativity \u2022 Vision \u2022 {brand} \u2022 Craft \u2022' },
            { text: '{brand} \u2022 Premium \u2022 Quality \u2022 Design \u2022' },
            { text: '{brand} \u2022 Strategy \u2022 Build \u2022 Grow \u2022' },
            { text: 'Design \u2022 Develop \u2022 Deploy \u2022 {brand} \u2022' }
        ],
        featureGrid: [
            { title: 'What We Do', items: ['Strategy', 'Design', 'Development', 'Growth'] },
            { title: 'Services', items: ['Branding', 'Web Design', 'Marketing', 'Analytics'] },
            { title: 'Capabilities', items: ['UI/UX', 'Engineering', 'Consulting', 'Support'] },
            { title: 'Our Expertise', items: ['Research', 'Prototyping', 'Testing', 'Launch'] },
            { title: 'Solutions', items: ['Digital', 'Creative', 'Technical', 'Strategic'] }
        ],
        imageReveal: [
            { title: 'See It In Action', sub: '' },
            { title: 'Visual Story', sub: '' },
            { title: 'Behind The Scenes', sub: '' },
            { title: 'In The Details', sub: '' },
            { title: 'The Process', sub: '' }
        ],
        testimonial: [
            { quote: '\u201CWorking with {brand} was a game-changer. They delivered beyond every expectation.\u201D', author: '\u2014 Happy Client', role: 'CEO, Tech Corp' },
            { quote: '\u201CExceptional quality and attention to detail. The results speak for themselves.\u201D', author: '\u2014 Satisfied Partner', role: 'Head of Product, StartupXYZ' },
            { quote: '\u201CThe team at {brand} truly understands modern design and user experience.\u201D', author: '\u2014 Industry Expert', role: 'Design Director' },
            { quote: '\u201CFrom concept to launch, the process was seamless and the outcome was stunning.\u201D', author: '\u2014 Founding Team', role: 'COO, Innovation Labs' },
            { quote: '\u201CThey don\u2019t just build websites \u2014 they build experiences that convert.\u201D', author: '\u2014 Growth Lead', role: 'VP Marketing, ScaleUp' }
        ],
        ctaSection: [
            { title: 'Ready to Start?', sub: 'Build something incredible together.', btn: 'Get Started' },
            { title: 'Get in Touch', sub: 'Your next big project starts here.', btn: 'Contact Us' },
            { title: 'Join Us', sub: 'Be part of something extraordinary.', btn: 'Learn More' },
            { title: 'Start Today', sub: 'Transform your vision into reality.', btn: 'Book a Call' },
            { title: 'Take the Next Step', sub: 'We are ready when you are.', btn: 'Get in Touch' }
        ],
        bigText: [
            { text: '{brand}' },
            { text: 'THINK BIG' },
            { text: 'NEXT LEVEL' },
            { text: 'DREAM BOLD' },
            { text: 'CREATE NOW' }
        ],
        gradientHero: [
            { title: '{brand}', sub: '{tagline}' },
            { title: 'Welcome to the future', sub: '{tagline}' },
            { title: '{brand}', sub: 'Designed for tomorrow' },
            { title: 'The Next Chapter', sub: '{tagline}' },
            { title: '{brand}', sub: 'Where vision meets craft' }
        ],
        cardStack: [
            { title: 'Our Process', items: ['Research', 'Design', 'Develop', 'Launch'] },
            { title: 'How We Work', items: ['Discover', 'Create', 'Test', 'Ship'] },
            { title: 'Capabilities', items: ['Strategy', 'Build', 'Optimize', 'Scale'] },
            { title: 'The Journey', items: ['Listen', 'Ideate', 'Build', 'Deliver'] },
            { title: 'Our Method', items: ['Analyze', 'Design', 'Code', 'Deploy'] }
        ]
    };

    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function _shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function _getBrandInfo() {
        var brandEl = document.querySelector('#brandName');
        var tagEl = document.querySelector('#tagline');
        var brand = (brandEl && brandEl.value && brandEl.value.trim()) || 'My Site';
        var tagline = (tagEl && tagEl.value && tagEl.value.trim()) || 'Crafting digital experiences';
        return { brand: brand, tagline: tagline };
    }

    function _fillTemplate(str, info) {
        return str.replace(/\{brand\}/g, info.brand).replace(/\{tagline\}/g, info.tagline);
    }

    /* ─── Extract text/media from existing scenes for data preservation ─── */
    function _extractExistingData() {
        var data = { texts: {}, images: {}, bgImages: {} };
        _scenes.forEach(function (scene) {
            var tplId = scene.template || '';
            if (scene.bgImage) data.bgImages[tplId] = scene.bgImage;
            (scene.elements || []).forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                // Only capture user-modified text (non-empty, non-default)
                if (el.text && el.text.trim()) {
                    if (!data.texts[tplId]) data.texts[tplId] = {};
                    data.texts[tplId][base] = el.text;
                }
                // Capture images set as background-image or src in style
                if (el.style) {
                    var bgImg = el.style.backgroundImage || el.style.background || '';
                    if (bgImg && bgImg.indexOf('url(') !== -1) {
                        if (!data.images[tplId]) data.images[tplId] = {};
                        data.images[tplId][base] = bgImg;
                    }
                }
            });
        });
        return data;
    }

    /* ─── Restore existing data into a newly generated scene ─── */
    function _restoreExistingData(scene, tplId, existingData) {
        var texts = existingData.texts[tplId];
        if (texts) {
            scene.elements.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (texts[base] !== undefined) el.text = texts[base];
            });
        }
        var images = existingData.images[tplId];
        if (images) {
            scene.elements.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (images[base] !== undefined) {
                    if (el.style.backgroundImage !== undefined) {
                        el.style.backgroundImage = images[base];
                    } else {
                        el.style.background = images[base];
                    }
                }
            });
        }
        if (existingData.bgImages[tplId]) {
            scene.bgImage = existingData.bgImages[tplId];
        }
    }

    /* Apply curated content to a scene's elements based on template type */
    function _applyContent(scene, templateId, info) {
        var copies = _SECTION_COPY[templateId];
        if (!copies) return;
        var copy = _pick(copies);
        var els = scene.elements;

        if (templateId === 'hero' || templateId === 'gradientHero') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'hero-title' || base === 'gh-title') el.text = _fillTemplate(copy.title, info);
                if (base === 'hero-sub' || base === 'gh-sub') el.text = _fillTemplate(copy.sub, info);
            });
        } else if (templateId === 'textReveal') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'reveal-line1') el.text = copy.line1;
                if (base === 'reveal-line2') el.text = copy.line2;
            });
        } else if (templateId === 'testimonial') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'tst-quote') el.text = _fillTemplate(copy.quote, info);
                if (base === 'tst-author') el.text = copy.author;
                if (base === 'tst-role') el.text = copy.role || '';
            });
        } else if (templateId === 'ctaSection') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'cta-heading') el.text = copy.title;
                if (base === 'cta-sub') el.text = copy.sub;
                if (base === 'cta-btn') el.text = copy.btn;
            });
        } else if (templateId === 'marquee') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'mrq-center') el.text = _fillTemplate(copy.text, info);
            });
        } else if (templateId === 'bigText') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'bt-overlay') el.text = _fillTemplate(copy.text, info);
            });
        } else if (templateId === 'splitMedia' || templateId === 'showcase' || templateId === 'imageReveal') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base.indexOf('title') !== -1 || base.indexOf('heading') !== -1) el.text = copy.title;
                if (base.indexOf('sub') !== -1 || base.indexOf('caption') !== -1 || base.indexOf('desc') !== -1) el.text = copy.sub || '';
            });
        } else if (templateId === 'stats') {
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base === 'stats-heading') el.text = copy.title;
            });
        } else if (templateId === 'featureGrid' || templateId === 'cardStack') {
            var idx = 0;
            els.forEach(function (el) {
                var base = el.id.replace(/-[^-]+$/, '');
                if (base.indexOf('heading') !== -1 || base === 'fg-title' || base === 'cs-title') el.text = copy.title;
                if ((base.indexOf('card') !== -1 || base.indexOf('item') !== -1) && copy.items && idx < copy.items.length) {
                    el.text = copy.items[idx++];
                }
            });
        }
    }

    /* Apply random scroll animation to each element of a scene — per-scene variety.
       sceneIdx: when 0, apply exit-only animations (content starts visible on load). */
    function _applyRandomAnimations(scene, entranceSet, sceneIdx) {
        scene.elements.forEach(function (el, i) {
            if (sceneIdx === 0) {
                // First scene: content must be visible on page load.
                // Apply exit-only scroll animation (fade out + drift as user scrolls away).
                var exitDelay = 0.35 + i * 0.04;
                el.scroll = {
                    opacity: [1, 1, 0],
                    y: [0, 0, -60 - i * 15],
                    start: 0,
                    end: 0.9
                };
                // Add a subtle CSS on-load entrance animation
                if (!el.style) el.style = {};
                el.style.animation = 'cne-hero-entrance 0.8s cubic-bezier(0.16,1,0.3,1) ' + (i * 0.12) + 's both';
                return;
            }
            var preset = entranceSet[i % entranceSet.length];
            var presetData = ArbelCinematicCompiler.getPreset(preset);
            if (presetData) {
                el.scroll = JSON.parse(JSON.stringify(presetData));
                // Stagger the start/end slightly per element for natural sequencing
                el.scroll.start = Math.min(0.35, (el.scroll.start || 0) + i * 0.035);
                el.scroll.end = Math.min(0.85, (el.scroll.end || 0.4) + i * 0.035);
            }
        });
    }

    /* Apply a 3D background effect to a scene */
    function _apply3DBackground(scene, bg3d, palette) {
        scene.bg3dType = bg3d.type;
        scene.bg3dColor1 = palette.primary;
        scene.bg3dColor2 = palette.secondary;
        scene.bg3dIntensity = bg3d.intensity;
        scene.bg3dSpeed = bg3d.speed;
    }

    /* Apply accent color tinting, gradient text, glow effects for premium look */
    function _tintSceneElements(scene, palette) {
        scene.elements.forEach(function (el) {
            if (!el.style) return;
            var base = el.id.replace(/-[^-]+$/, '');

            // ─── Hero / gradient hero titles: solid white + accent glow for legibility ───
            if (base === 'hero-title' || base === 'gh-title') {
                el.style.color = '#ffffff';
                el.style.textShadow = '0 0 60px ' + palette.primary + '80, 0 0 120px ' + palette.primary + '40, 0 4px 20px rgba(0,0,0,0.5)';
            }
            // ─── Text-shadow glow on major headings (non-gradient) ───
            if (base === 'cta-heading' || base === 'reveal-line1') {
                el.style.textShadow = '0 0 40px ' + palette.primary + '40, 0 0 80px ' + palette.primary + '20';
            }
            // ─── Second reveal line: primary color + glow ───
            if (base === 'reveal-line2') {
                el.style.color = palette.primary;
                el.style.textShadow = '0 0 40px ' + palette.primary + '50';
            }
            // ─── Stat numbers with accent colors + glow ───
            if (base === 'stat-1') {
                el.style.color = palette.primary;
                el.style.textShadow = '0 0 30px ' + palette.primary + '60';
            } else if (base === 'stat-2') {
                el.style.color = palette.secondary;
                el.style.textShadow = '0 0 30px ' + palette.secondary + '60';
            } else if (base === 'stat-3') {
                el.style.color = palette.accent2 || palette.secondary;
                el.style.textShadow = '0 0 30px ' + (palette.accent2 || palette.secondary) + '60';
            }
            // ─── Stats heading subtle glow ───
            if (base === 'stats-heading') {
                el.style.textShadow = '0 0 20px ' + palette.primary + '20';
            }
            // ─── CTA button: gradient + glow shadow + border ───
            if (base === 'cta-btn') {
                el.style.background = 'linear-gradient(135deg, ' + palette.primary + ', ' + (palette.accent2 || palette.secondary) + ')';
                el.style.boxShadow = '0 8px 32px ' + palette.primary + '40, 0 0 60px ' + palette.primary + '15';
                el.style.border = '1px solid rgba(255,255,255,0.15)';
                el.style.letterSpacing = '0.02em';
            }
            // ─── Glow / ambient elements ───
            if (base === 'cta-glow' || base === 'tst-bg') {
                el.style.background = 'radial-gradient(circle, ' + palette.primary + '33, transparent 70%)';
            }
            // ─── Gradient orbs ───
            if (base === 'gh-grad1') {
                el.style.background = 'radial-gradient(circle, ' + palette.primary + '66, transparent 70%)';
            }
            if (base === 'gh-grad2') {
                el.style.background = 'radial-gradient(circle, ' + palette.secondary + '4d, transparent 70%)';
            }
            // ─── Enhanced glassmorphism on cards ───
            if (base.indexOf('fg-card') !== -1 || base.indexOf('cs-card') !== -1) {
                el.style.border = '1px solid ' + palette.primary + '22';
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.backdropFilter = 'blur(20px)';
                el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 ' + palette.primary + '10';
            }
            // ─── Front card gets richer gradient ───
            if (base === 'cs-card1') {
                el.style.background = 'linear-gradient(180deg, ' + palette.primary + '26, rgba(0,0,0,0.3))';
                el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 ' + palette.primary + '15';
            }
            // ─── Showcase / split / image reveal: accent + depth shadow ───
            if (base === 'showcase-item' || base === 'split-media' || base === 'imgr-frame') {
                el.style.background = 'linear-gradient(135deg, ' + palette.primary + '4d, ' + palette.secondary + '33)';
                el.style.border = '1px solid ' + palette.primary + '18';
                el.style.boxShadow = '0 20px 60px ' + palette.primary + '15';
            }
            // ─── Subtitles: legible white with subtle glow ───
            if (base === 'hero-sub' || base === 'gh-sub') {
                el.style.color = 'rgba(255,255,255,0.85)';
                el.style.textShadow = '0 0 30px ' + palette.primary + '40, 0 2px 10px rgba(0,0,0,0.4)';
            }
            if (base === 'cta-sub') {
                el.style.textShadow = '0 0 20px ' + palette.primary + '15';
            }
            // ─── Feature grid card headings get accent color ───
            if (base === 'fg-c1-title' || base === 'fg-c2-title' || base === 'fg-c3-title') {
                el.style.color = palette.primary;
            }
            // ─── Testimonial quote gets subtle accent ───
            if (base === 'tst-quote') {
                el.style.textShadow = '0 0 30px ' + palette.primary + '15';
            }
            // ─── Tags and small labels get accent color ───
            if (base === 'gh-tag' || base === 'imgr-tag' || base === 'showcase-tag' || base === 'imgr-cat') {
                el.style.color = palette.primary + 'aa';
            }
            // ─── All other headings: ensure readability with subtle text shadow ───
            if (base === 'bt-overlay' || base === 'showcase-title' || base === 'split-title' || base === 'cs-title') {
                el.style.textShadow = '0 2px 20px rgba(0,0,0,0.4)';
            }
        });
    }

    /* Apply subtle parallax depth to decorative / background elements */
    function _applyParallaxDepth(scene) {
        scene.elements.forEach(function (el) {
            var base = el.id.replace(/-[^-]+$/, '');
            if (base === 'gh-grad1' || base === 'gh-grad2' || base === 'cta-glow' || base === 'tst-bg') {
                el.parallax = 0.5 + Math.random() * 0.3;
            }
            if (base === 'mrq-line1') el.parallax = 0.7;
            if (base === 'mrq-line2') el.parallax = 1.3;
            if (base === 'bt-word1' || base === 'bt-word2' || base === 'bt-word3') {
                el.parallax = 0.6 + Math.random() * 0.3;
            }
        });
    }

    /* Apply hover effects to interactive elements */
    function _applyHoverEffects(scene, palette) {
        scene.elements.forEach(function (el) {
            var base = el.id.replace(/-[^-]+$/, '');

            // CTA buttons: scale up + lift + glow
            if (base === 'cta-btn' || base === 'hero-cta') {
                el.hoverStyle = {
                    scale: 1.05,
                    translateY: -3,
                    boxShadow: '0 12px 40px ' + palette.primary + '60, 0 0 80px ' + palette.primary + '25',
                    _duration: 0.3
                };
            }
            // Feature grid & card stack cards: lift + border glow
            if (base.indexOf('fg-card') !== -1 || base.indexOf('cs-card') !== -1) {
                el.hoverStyle = {
                    scale: 1.03,
                    translateY: -6,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.4), 0 0 30px ' + palette.primary + '20',
                    _duration: 0.35
                };
            }
            // Showcase / split-media / image-reveal frames
            if (base === 'showcase-item' || base === 'split-media' || base === 'imgr-frame') {
                el.hoverStyle = {
                    scale: 1.02,
                    boxShadow: '0 24px 64px ' + palette.primary + '25',
                    _duration: 0.4
                };
            }
            // Nav links: accent color on hover
            if (base === 'nav-link') {
                el.hoverStyle = {
                    color: palette.primary,
                    _duration: 0.25
                };
            }
            // Nav logo: subtle scale
            if (base === 'nav-logo') {
                el.hoverStyle = {
                    scale: 1.05,
                    _duration: 0.25
                };
            }
            // Stat numbers: glow up on hover
            if (base === 'stat-1' || base === 'stat-2' || base === 'stat-3') {
                el.hoverStyle = {
                    scale: 1.1,
                    _duration: 0.3
                };
            }
            // Testimonial card: lift
            if (base === 'tst-card' || base === 'tst-bg') {
                el.hoverStyle = {
                    scale: 1.02,
                    translateY: -4,
                    _duration: 0.35
                };
            }
        });
    }

    /* ─── Auto-Generate Dialog ─── */
    var _keepDataToggle = false;

    function _showAutoGenerateDialog() {
        // Remove existing if open
        var existing = document.getElementById('cneAutoGenDialog');
        if (existing) { existing.remove(); return; }

        var hasData = _scenes.length > 0 && _scenes.some(function (s) {
            return s.elements && s.elements.some(function (e) { return e.text && e.text.trim(); });
        });

        var dialog = document.createElement('div');
        dialog.id = 'cneAutoGenDialog';
        dialog.className = 'cne-autogen-dialog';
        dialog.innerHTML =
            '<div class="cne-autogen-content">' +
                '<div class="cne-autogen-header">' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 18l.75 2.25L8 21l-2.25.75L5 24l-.75-2.25L2 21l2.25-.75L5 18z"/></svg>' +
                    '<h3>Auto-Generate Website</h3>' +
                '</div>' +
                '<p class="cne-autogen-desc">Creates a complete multi-scene cinematic website using your brand info with randomized design, layout, 3D effects, and animations.</p>' +
                (hasData ?
                    '<label class="cne-autogen-toggle">' +
                        '<input type="checkbox" id="cneKeepData" ' + (_keepDataToggle ? 'checked' : '') + '>' +
                        '<span class="cne-autogen-toggle-slider"></span>' +
                        '<span class="cne-autogen-toggle-label">Keep my existing content</span>' +
                    '</label>' +
                    '<p class="cne-autogen-hint">When enabled, your text &amp; images from matching scene types will be preserved in the new layout.</p>'
                : '') +
                '<div class="cne-autogen-actions">' +
                    '<button class="cne-autogen-cancel" id="cneAutoGenCancel">Cancel</button>' +
                    '<button class="cne-autogen-go" id="cneAutoGenGo">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>' +
                        ' Generate' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(dialog);

        // Close on overlay click
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) dialog.remove();
        });

        document.getElementById('cneAutoGenCancel').addEventListener('click', function () {
            dialog.remove();
        });

        var keepDataCb = document.getElementById('cneKeepData');
        if (keepDataCb) {
            keepDataCb.addEventListener('change', function () {
                _keepDataToggle = keepDataCb.checked;
            });
        }

        document.getElementById('cneAutoGenGo').addEventListener('click', function () {
            var keepData = keepDataCb ? keepDataCb.checked : false;
            dialog.remove();
            _autoGenerate(keepData);
        });
    }

    function _autoGenerate(keepData) {
        var info = _getBrandInfo();

        // Capture existing data before overwrite if keeping it
        var existingData = keepData ? _extractExistingData() : null;

        // Pick palette
        var palette = _pick(_DESIGN_PALETTES);

        // When keeping data, preserve existing template sequence; otherwise pick random flow
        var templates;
        if (keepData && _scenes.length > 0) {
            templates = _scenes.map(function (s) { return s.template || 'hero'; });
        } else {
            var flow = _pick(_FLOW_RECIPES);
            var sceneCount = 4 + Math.floor(Math.random() * 4); // 4-7
            sceneCount = Math.min(sceneCount, flow.length);
            templates = flow.slice(0, sceneCount);
        }

        // Pick which scenes get 3D backgrounds (3-5 scenes for more cinematic feel)
        var bg3dCount = 3 + Math.floor(Math.random() * 3); // 3-5
        bg3dCount = Math.min(bg3dCount, templates.length);
        var bg3dIndices = [0]; // hero always gets one
        if (templates.length > 2) bg3dIndices.push(templates.length - 1);
        var otherIndices = _shuffle(templates.map(function (_, i) { return i; }).filter(function (i) { return bg3dIndices.indexOf(i) === -1; }));
        for (var b = 0; bg3dIndices.length < bg3dCount && b < otherIndices.length; b++) {
            bg3dIndices.push(otherIndices[b]);
        }

        // Shuffle available 3D effects
        var bg3dPool = _shuffle(_BG3D_OPTIONS);

        // Build the scenes with per-scene animation variety
        var newScenes = [];
        var usedEntranceSets = _shuffle(_ENTRANCE_SETS);
        templates.forEach(function (tplId, idx) {
            var scene = ArbelCinematicCompiler.createScene(tplId, idx);
            scene.bgColor = palette.bg;

            // Pick a different entrance set for every 2 scenes (natural variation)
            var entranceSet = usedEntranceSets[Math.floor(idx / 2) % usedEntranceSets.length];

            // Restore existing content for ALL matching templates when keeping data
            if (keepData && existingData) {
                _restoreExistingData(scene, tplId, existingData);
            } else {
                _applyContent(scene, tplId, info);
            }

            // Apply entrance animations (pass idx so scene 0 gets visible-by-default treatment)
            _applyRandomAnimations(scene, entranceSet, idx);

            // Apply accent tinting (glows, depth, hover effects)
            _tintSceneElements(scene, palette);

            // Apply parallax to decorative background elements
            _applyParallaxDepth(scene);

            // Apply hover effects to interactive elements
            _applyHoverEffects(scene, palette);

            // Apply 3D background to selected scenes
            if (bg3dIndices.indexOf(idx) !== -1) {
                _apply3DBackground(scene, bg3dPool[idx % bg3dPool.length], palette);
            }

            newScenes.push(scene);
        });

        // Apply design tokens from palette
        _designTokens.primary = palette.primary;
        _designTokens.secondary = palette.secondary;
        _designTokens.text = palette.text;
        _designTokens.bg = palette.bg;
        _designTokens.surface = palette.surface;
        _syncTokenUI();

        // Commit
        _flushBursts();
        _pushUndo();
        _scenes = newScenes;
        _overrides = {};
        _selectedElementId = null;
        _selectedElementIds = [];
        _currentSceneIdx = 0;
        _renderSceneList();
        _selectScene(0, true);

        // Force-generate responsive overrides for the new scenes
        _autoResponsive('tablet');
        _autoResponsive('mobile');
    }

    /* Shuffle just the effects/animations on existing scenes (keep content) */
    function _shuffleEffects() {
        if (_scenes.length === 0) return;
        _flushBursts();
        _pushUndo();

        var palette = _pick(_DESIGN_PALETTES);
        var bg3dPool = _shuffle(_BG3D_OPTIONS);
        var usedEntranceSets = _shuffle(_ENTRANCE_SETS);

        // Pick 3-5 scenes for 3D backgrounds (more cinematic)
        var bg3dCount = Math.min(3 + Math.floor(Math.random() * 3), _scenes.length);
        var indices = _shuffle(_scenes.map(function (_, i) { return i; }));
        var bg3dIndices = indices.slice(0, bg3dCount);
        // Always include first scene
        if (bg3dIndices.indexOf(0) === -1) { bg3dIndices[bg3dIndices.length - 1] = 0; }

        _scenes.forEach(function (scene, idx) {
            // Per-scene entrance set variety
            var entranceSet = usedEntranceSets[Math.floor(idx / 2) % usedEntranceSets.length];
            _applyRandomAnimations(scene, entranceSet, idx);

            // Apply accent tinting (gradient text, glows, depth)
            _tintSceneElements(scene, palette);

            // Apply parallax depth to decorative elements
            _applyParallaxDepth(scene);

            // Apply hover effects
            _applyHoverEffects(scene, palette);

            // Clear or apply 3D backgrounds
            if (bg3dIndices.indexOf(idx) !== -1) {
                _apply3DBackground(scene, bg3dPool[idx % bg3dPool.length], palette);
            } else {
                scene.bg3dType = '';
            }
        });

        // Update tokens
        _designTokens.primary = palette.primary;
        _designTokens.secondary = palette.secondary;
        _syncTokenUI();

        _renderSceneList();
        _selectScene(_currentSceneIdx, true);

        // Regenerate responsive overrides for new styles
        _autoResponsive('tablet');
        _autoResponsive('mobile');
    }

    /* ═══ Effects Presets — One-click lively combos ═══ */
    var _EFFECTS_PRESETS = [
        {
            name: '\u2728 Floating Orbs + Blur Reveals',
            bg3d: { type: 'gradient-orbs', intensity: '7', speed: 'medium' },
            animations: ['blurIn', 'blurInUp', 'blurInScale', 'fadeInUp', 'scaleInUp']
        },
        {
            name: '\u2728 Aurora + Cinematic Slides',
            bg3d: { type: 'aurora', intensity: '7', speed: 'medium' },
            animations: ['cinematicFade', 'cinematicSlide', 'cinematicReveal', 'cinematicRise', 'cinematicDrop']
        },
        {
            name: '\u2728 Starfield + 3D Flips',
            bg3d: { type: 'starfield', intensity: '7', speed: 'medium' },
            animations: ['flip3DX', 'cubeRotate', 'doorOpen', 'perspective3D', 'unfold']
        },
        {
            name: '\u2728 Wave Grid + Bouncy',
            bg3d: { type: 'wave-grid', intensity: '6', speed: 'medium' },
            animations: ['bounceIn', 'bounceInUp', 'bounceInLeft', 'rubberBand', 'jackInTheBox']
        },
        {
            name: '\u2728 Particles + Fade & Scale',
            bg3d: { type: 'particle-field', intensity: '6', speed: 'slow' },
            animations: ['fadeInUp', 'scaleIn', 'scaleInUp', 'fadeInLeft', 'fadeInRight']
        },
        {
            name: '\u2728 Mesh Gradient + Clip Reveals',
            bg3d: { type: 'mesh-gradient', intensity: '6', speed: 'slow' },
            animations: ['clipRevealUp', 'clipRevealLeft', 'slideInUp', 'slideInLeft', 'slideInRight']
        },
        {
            name: '\u2728 Fog + Rotate Entrances',
            bg3d: { type: 'noise-fog', intensity: '5', speed: 'slow' },
            animations: ['rotateIn', 'rotateInLeft', 'swingIn', 'pivotIn', 'swingDoor']
        },
        {
            name: '\u2728 Orbs + Cinematic Premium',
            bg3d: { type: 'gradient-orbs', intensity: '8', speed: 'fast' },
            animations: ['cinematicFade', 'blurInUp', 'scaleInUp', 'clipRevealUp', 'fadeInUp']
        },
        {
            name: '\u2728 Aurora + 3D Perspective',
            bg3d: { type: 'aurora', intensity: '5', speed: 'slow' },
            animations: ['perspective3D', 'swingDoor', 'flip3DY', 'cubeRotate', 'pivotIn']
        },
        {
            name: '\u2728 Starfield + Playful Pop',
            bg3d: { type: 'starfield', intensity: '8', speed: 'fast' },
            animations: ['bounceIn', 'tada', 'jello', 'heartBeat', 'swingIn']
        },
        {
            name: '\u2728 Mesh + Clean Fades',
            bg3d: { type: 'mesh-gradient', intensity: '7', speed: 'medium' },
            animations: ['fadeInUp', 'fadeInLeft', 'fadeInRight', 'fadeInDown', 'scaleIn']
        },
        {
            name: '\u2728 Particles + Mixed Cinematic',
            bg3d: { type: 'particle-field', intensity: '7', speed: 'medium' },
            animations: ['blurInScale', 'cinematicReveal', 'perspective3D', 'fadeInUp', 'scaleIn']
        }
    ];

    function _applyEffectsPreset(preset) {
        if (_scenes.length === 0) return;
        _flushBursts();
        _pushUndo();

        var palette = _DESIGN_PALETTES[0];
        for (var pi = 0; pi < _DESIGN_PALETTES.length; pi++) {
            if (_DESIGN_PALETTES[pi].primary === _designTokens.primary) {
                palette = _DESIGN_PALETTES[pi];
                break;
            }
        }

        _scenes.forEach(function (scene, idx) {
            _applyRandomAnimations(scene, preset.animations, idx);
            _tintSceneElements(scene, palette);
            _applyParallaxDepth(scene);
            _applyHoverEffects(scene, palette);
            // Apply 3D to first scene and every other scene
            if (idx === 0 || idx % 2 === 0) {
                _apply3DBackground(scene, preset.bg3d, palette);
            } else {
                scene.bg3dType = '';
            }
        });

        _renderSceneList();
        _selectScene(_currentSceneIdx, true);

        // Regenerate responsive overrides
        _autoResponsive('tablet');
        _autoResponsive('mobile');
    }

    function _showEffectsMenu(anchorEl) {
        // Remove any existing menu
        var existing = document.getElementById('cneEffectsMenu');
        if (existing) { existing.remove(); return; }

        var menu = document.createElement('div');
        menu.id = 'cneEffectsMenu';
        menu.className = 'cne-effects-menu';

        // Presets
        _EFFECTS_PRESETS.forEach(function (preset) {
            var item = document.createElement('button');
            item.className = 'cne-effects-menu-item';
            item.textContent = preset.name;
            item.addEventListener('click', function () {
                _applyEffectsPreset(preset);
                menu.remove();
            });
            menu.appendChild(item);
        });

        // Divider
        var divider = document.createElement('div');
        divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:4px 0;';
        menu.appendChild(divider);

        // Shuffle button
        var shuffleItem = document.createElement('button');
        shuffleItem.className = 'cne-effects-menu-item';
        shuffleItem.textContent = '\uD83C\uDFB2 Shuffle All Effects';
        shuffleItem.addEventListener('click', function () {
            _shuffleEffects();
            menu.remove();
        });
        menu.appendChild(shuffleItem);

        // Position below anchor
        var rect = anchorEl.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
        document.body.appendChild(menu);

        // Close on outside click
        setTimeout(function () {
            function close(e) {
                if (!menu.contains(e.target) && e.target !== anchorEl) {
                    menu.remove();
                    document.removeEventListener('click', close);
                }
            }
            document.addEventListener('click', close);
        }, 0);
    }

    /* ─── New Project (clear all) ─── */
    function _newProject() {
        if (_projectDirty) {
            if (!confirm('You have unsaved changes. Start a new project anyway?')) return;
        }
        _flushBursts();
        _pushUndo();
        _clearAutosave();
        _fileHandle = null;
        _projectDirty = false;
        _scenes = [ArbelCinematicCompiler.createScene('hero', 0)];
        _overrides = {};
        _designTokens = {
            headingFont: "'Inter', system-ui, sans-serif",
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
        _selectedElementId = null;
        _selectedElementIds = [];
        _currentSceneIdx = 0;
        _renderSceneList();
        _selectScene(0, true);
        _updateDirtyIndicator();
    }

    /* ─── Brand Name Helper ─── */
    function _getBrandName() {
        var brandEl = document.querySelector('#brandName');
        return (brandEl && brandEl.value && brandEl.value.trim()) || 'My Site';
    }

    /* ─── Dirty Tracking ─── */
    function _markDirty() {
        if (!_projectDirty) {
            _projectDirty = true;
            _updateDirtyIndicator();
        }
        _scheduleAutosave();
    }

    function _updateDirtyIndicator() {
        var brand = _qs('#cneBrand');
        if (brand) {
            var name = _getBrandName();
            brand.textContent = _projectDirty ? name + ' \u2022' : name;
        }
        var dot = _qs('#cneUnsavedDot');
        if (dot) dot.style.display = _projectDirty ? '' : 'none';
    }

    /* ─── Collect / Restore Full Project State ─── */
    function _collectFullState() {
        var saveOverrides = Object.assign({}, _overrides);
        delete saveOverrides._editingMenuOverlay;
        // Save current scenes back to current page
        _ensurePages();
        _pages[_currentPageIdx].scenes = _scenes;
        // Build save-able pages array (strip nav overlay from each page)
        var savePages = _pages.map(function (p) {
            return {
                id: p.id, name: p.name, path: p.path, seo: p.seo || {},
                scenes: (p.scenes || []).filter(function (s) { return s.id !== '_nav-overlay'; })
            };
        });
        var saveScenes = _scenes.filter(function (s) { return s.id !== '_nav-overlay'; });
        return {
            version: 2,
            format: 'cinematic',
            meta: {
                name: _getBrandName(),
                savedAt: new Date().toISOString()
            },
            scenes: saveScenes,
            pages: savePages,
            currentPageIdx: _currentPageIdx,
            overrides: saveOverrides,
            designTokens: Object.assign({}, _designTokens)
        };
    }

    function _restoreFullState(proj) {
        _flushBursts();
        _pushUndo();
        // Restore pages if present
        if (proj.pages && Array.isArray(proj.pages) && proj.pages.length > 0) {
            _pages = proj.pages;
            _currentPageIdx = proj.currentPageIdx || 0;
            if (_currentPageIdx >= _pages.length) _currentPageIdx = 0;
            _scenes = _pages[_currentPageIdx].scenes || [];
        } else if (proj.scenes && Array.isArray(proj.scenes)) {
            _scenes = proj.scenes;
            _pages = [{ id: 'page-' + Date.now().toString(36), name: 'Home', path: '/', scenes: _scenes, seo: { title: '', description: '' } }];
            _currentPageIdx = 0;
        }
        if (proj.overrides) _overrides = proj.overrides;
        delete _overrides._editingMenuOverlay;
        _scenes = _scenes.filter(function (s) { return s.id !== '_nav-overlay'; });
        if (proj.designTokens && typeof proj.designTokens === 'object') {
            Object.keys(proj.designTokens).forEach(function (k) {
                if (_designTokens.hasOwnProperty(k)) _designTokens[k] = proj.designTokens[k];
            });
            _syncTokenUI();
        }
        _selectedElementId = null;
        _selectedElementIds = [];
        _currentSceneIdx = 0;
        _undoStack = [];
        _redoStack = [];
        _renderPageList();
        _renderSceneList();
        _selectScene(0, true);
        _projectDirty = false;
        _updateDirtyIndicator();
        _updateUndoButtons();
    }

    /* ─── Save / Save As / Open ─── */
    function _saveProject() {
        if (_fileHandle) {
            _writeToHandle(_fileHandle);
        } else {
            _saveProjectAs();
        }
    }

    function _saveProjectAs() {
        var proj = _collectFullState();
        var json = JSON.stringify(proj, null, 2);
        var name = (proj.meta.name || 'my-site').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: name + '.arbel',
                types: [{
                    description: 'Arbel Project',
                    accept: { 'application/json': ['.arbel'] }
                }]
            }).then(function (handle) {
                _fileHandle = handle;
                return _writeToHandle(handle);
            }).catch(function () { /* user cancelled */ });
        } else {
            // Fallback: download
            var blob = new Blob([json], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name + '.arbel';
            a.click();
            URL.revokeObjectURL(a.href);
            _projectDirty = false;
            _updateDirtyIndicator();
        }
    }

    function _writeToHandle(handle) {
        var proj = _collectFullState();
        var json = JSON.stringify(proj, null, 2);
        var saveDirtyGen = _projectDirty;
        return handle.createWritable().then(function (writable) {
            return writable.write(json).then(function () {
                return writable.close();
            });
        }).then(function () {
            if (_projectDirty === saveDirtyGen) {
                _projectDirty = false;
                _updateDirtyIndicator();
            }
        }).catch(function (err) {
            alert('Failed to save: ' + err.message);
        });
    }

    function _openProject() {
        if (window.showOpenFilePicker) {
            window.showOpenFilePicker({
                types: [{
                    description: 'Arbel Project',
                    accept: { 'application/json': ['.arbel', '.json'] }
                }],
                multiple: false
            }).then(function (handles) {
                _fileHandle = handles[0];
                return _fileHandle.getFile();
            }).then(function (file) {
                return file.text();
            }).then(function (text) {
                var proj = JSON.parse(text);
                _loadProjectData(proj);
            }).catch(function (err) {
                if (err.name !== 'AbortError') alert('Failed to open: ' + err.message);
            });
        } else {
            // Fallback: file input
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.arbel,.json';
            input.addEventListener('change', function () {
                var file = input.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        var proj = JSON.parse(e.target.result);
                        _fileHandle = null;
                        _loadProjectData(proj);
                    } catch (err) {
                        alert('Failed to open: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        }
    }

    function _loadProjectData(proj) {
        if (!proj) { alert('Invalid project file.'); return; }
        // Support both v2 full format and legacy scene-only format
        if (proj.scenes && Array.isArray(proj.scenes)) {
            _restoreFullState(proj);
        } else {
            alert('Invalid project file — no scenes found.');
        }
    }

    /* ─── Export / Import Scene JSON (legacy) ─── */
    function _exportJSON() {
        var proj = _collectFullState();
        var json = JSON.stringify(proj, null, 2);
        var name = (proj.meta.name || 'my-site').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name + '.arbel';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    function _importJSON() {
        _openProject();
    }

    /* ─── Export as ZIP (HTML/CSS/JS bundle) ─── */
    function _exportZIP() {
        if (typeof JSZip === 'undefined') {
            alert('JSZip library not loaded. Please check your connection.');
            return;
        }

        // Build the cinematic config from current editor state
        var cfg = {
            brandName: 'My Site',
            tagline: '',
            style: 'obsidian',
            accent: '#6C5CE7',
            bgColor: '#0a0a0f',
            scenes: _scenes,
            nav: { logo: 'My Site', links: [], show: true },
            designTokens: _designTokens,
            editorOverrides: _overrides
        };

        // Try to read values from app state if available
        var brandEl = document.querySelector('#brandName');
        var tagEl = document.querySelector('#tagline');
        var accentEl = document.querySelector('#accentColor');
        var bgEl = document.querySelector('#bgColor');
        if (brandEl && brandEl.value) { cfg.brandName = brandEl.value.trim(); cfg.nav.logo = cfg.brandName; }
        if (tagEl && tagEl.value) cfg.tagline = tagEl.value.trim();
        if (accentEl && accentEl.value) cfg.accent = accentEl.value;
        if (bgEl && bgEl.value) cfg.bgColor = bgEl.value;
        cfg.nav.show = _overrides.showNav !== false;
        cfg.nav.links = _overrides.navLinks || [];

        var files = ArbelCinematicCompiler.compile(cfg);
        if (!files || !files['index.html']) {
            alert('Failed to compile. Please ensure you have at least one scene.');
            return;
        }

        // Compile additional pages if multi-page project
        _ensurePages();
        _pages[_currentPageIdx].scenes = _scenes;
        if (_pages.length > 1) {
            _pages.forEach(function (page, pageIdx) {
                if (pageIdx === 0) return; // first page is already compiled as index.html
                var pageCfg = JSON.parse(JSON.stringify(cfg));
                pageCfg.scenes = page.scenes || [];
                if (page.seo && page.seo.title) pageCfg.brandName = page.seo.title;
                var pageFiles = ArbelCinematicCompiler.compile(pageCfg);
                if (pageFiles && pageFiles['index.html']) {
                    var pathSlug = (page.path || '/' + page.name).replace(/^\//, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || page.name.toLowerCase().replace(/\s+/g, '-');
                    files[pathSlug + '/index.html'] = pageFiles['index.html'];
                }
            });
        }

        // Extract inline data URLs to separate asset files for ZIP
        ArbelCinematicCompiler.extractAssets(files);

        var zip = new JSZip();
        Object.keys(files).forEach(function (path) {
            var content = files[path];
            // Convert data URL strings to binary for asset files
            if (typeof content === 'string' && /^data:[^;]+;base64,/.test(content)) {
                var parts = content.split(',');
                var raw = atob(parts[1]);
                var arr = new Uint8Array(raw.length);
                for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                zip.file(path, arr, { binary: true });
            } else {
                zip.file(path, content);
            }
        });

        zip.generateAsync({ type: 'blob' }).then(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = (cfg.brandName || 'site').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            _clearAutosave();
        });
    }

    /* ─── Image Crop Tool ─── */
    function _showCropTool() {
        var el = _getSelectedElement();
        if (!el || el.tag !== 'img') return;

        var overlay = document.createElement('div');
        overlay.className = 'arbel-dialog-overlay';

        var dialog = document.createElement('div');
        dialog.className = 'arbel-dialog';
        dialog.style.maxWidth = '560px';

        var title = document.createElement('h3');
        title.className = 'arbel-dialog-title';
        title.textContent = 'Crop Image';

        // Crop preview area
        var previewWrap = document.createElement('div');
        previewWrap.style.cssText = 'position:relative;width:100%;max-height:320px;overflow:hidden;background:#111;border-radius:8px;margin-bottom:12px';

        var img = document.createElement('img');
        img.src = el.src || '';
        img.style.cssText = 'width:100%;max-height:320px;object-fit:contain;display:block';

        var cropOverlay = document.createElement('div');
        cropOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';

        previewWrap.appendChild(img);
        previewWrap.appendChild(cropOverlay);

        // Crop sliders: top / right / bottom / left (inset values)
        var current = { top: 0, right: 0, bottom: 0, left: 0 };
        // Parse existing clip-path if present
        if (el.style && el.style.clipPath) {
            var m = el.style.clipPath.match(/inset\(([^)]+)\)/);
            if (m) {
                var parts = m[1].split(/\s+/);
                if (parts.length >= 4) {
                    current.top = parseInt(parts[0]) || 0;
                    current.right = parseInt(parts[1]) || 0;
                    current.bottom = parseInt(parts[2]) || 0;
                    current.left = parseInt(parts[3]) || 0;
                }
            }
        }

        function updateCropPreview() {
            cropOverlay.style.boxShadow =
                'inset 0 ' + (current.top / 100 * previewWrap.offsetHeight) + 'px 0 rgba(0,0,0,0.6),' +
                'inset -' + (current.right / 100 * previewWrap.offsetWidth) + 'px 0 0 rgba(0,0,0,0.6),' +
                'inset 0 -' + (current.bottom / 100 * previewWrap.offsetHeight) + 'px 0 rgba(0,0,0,0.6),' +
                'inset ' + (current.left / 100 * previewWrap.offsetWidth) + 'px 0 0 rgba(0,0,0,0.6)';
        }

        function makeSlider(label, key) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.75rem;color:rgba(255,255,255,0.7)';
            var lbl = document.createElement('span');
            lbl.textContent = label;
            lbl.style.width = '48px';
            var slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '50';
            slider.value = current[key];
            slider.style.cssText = 'flex:1';
            var val = document.createElement('span');
            val.className = 'mono';
            val.textContent = current[key] + '%';
            val.style.width = '36px';
            slider.addEventListener('input', function () {
                current[key] = parseInt(slider.value);
                val.textContent = current[key] + '%';
                updateCropPreview();
            });
            row.appendChild(lbl);
            row.appendChild(slider);
            row.appendChild(val);
            return row;
        }

        var controls = document.createElement('div');
        controls.style.cssText = 'padding:12px 0';
        controls.appendChild(makeSlider('Top', 'top'));
        controls.appendChild(makeSlider('Right', 'right'));
        controls.appendChild(makeSlider('Bottom', 'bottom'));
        controls.appendChild(makeSlider('Left', 'left'));

        // Aspect ratio presets
        var presets = document.createElement('div');
        presets.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px';
        [{ label: 'Free', t: 0, r: 0, b: 0, l: 0 },
         { label: 'Square', t: 0, r: 12, b: 0, l: 12 },
         { label: '16:9', t: 10, r: 0, b: 10, l: 0 },
         { label: 'Circle', t: 0, r: 0, b: 0, l: 0, circle: true }
        ].forEach(function (p) {
            var btn = document.createElement('button');
            btn.className = 'gen-btn';
            btn.style.cssText = 'padding:4px 10px;font-size:0.7rem';
            btn.textContent = p.label;
            btn.addEventListener('click', function () {
                if (p.circle) {
                    // Use clip-path: circle instead
                    _pushUndo();
                    el.style.clipPath = 'circle(50% at 50% 50%)';
                    _notifyUpdate(true);
                    document.body.removeChild(overlay);
                    return;
                }
                current.top = p.t; current.right = p.r; current.bottom = p.b; current.left = p.l;
                controls.querySelectorAll('input[type=range]').forEach(function (s, i) {
                    var keys = ['top', 'right', 'bottom', 'left'];
                    s.value = current[keys[i]];
                    s.nextElementSibling.textContent = current[keys[i]] + '%';
                });
                updateCropPreview();
            });
            presets.appendChild(btn);
        });

        // Buttons
        var btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px';

        var resetBtn = document.createElement('button');
        resetBtn.className = 'gen-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.addEventListener('click', function () {
            _pushUndo();
            delete el.style.clipPath;
            _notifyUpdate(true);
            document.body.removeChild(overlay);
        });

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'gen-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        var applyBtn = document.createElement('button');
        applyBtn.className = 'gen-btn gen-btn-primary';
        applyBtn.textContent = 'Apply Crop';
        applyBtn.addEventListener('click', function () {
            _pushUndo();
            if (current.top === 0 && current.right === 0 && current.bottom === 0 && current.left === 0) {
                delete el.style.clipPath;
            } else {
                el.style.clipPath = 'inset(' + current.top + '% ' + current.right + '% ' + current.bottom + '% ' + current.left + '%)';
            }
            _notifyUpdate(true);
            document.body.removeChild(overlay);
        });

        btns.appendChild(resetBtn);
        btns.appendChild(cancelBtn);
        btns.appendChild(applyBtn);

        dialog.appendChild(title);
        dialog.appendChild(previewWrap);
        dialog.appendChild(presets);
        dialog.appendChild(controls);
        dialog.appendChild(btns);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) document.body.removeChild(overlay);
        });

        setTimeout(updateCropPreview, 50);
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
        'var selected=[],primary=null,editing=false,drag=null,resize=null,marquee=null,rotating=null,justDragged=false;' +
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
          '.arbel-rh{position:fixed;width:10px;height:10px;background:#fff;border:2px solid #646cff;' +
          'border-radius:2px;z-index:100000;display:none;box-sizing:border-box}' +
          '.arbel-rh-nw{cursor:nw-resize}.arbel-rh-n{cursor:n-resize}.arbel-rh-ne{cursor:ne-resize}' +
          '.arbel-rh-w{cursor:w-resize}.arbel-rh-e{cursor:e-resize}' +
          '.arbel-rh-sw{cursor:sw-resize}.arbel-rh-s{cursor:s-resize}.arbel-rh-se{cursor:se-resize}' +
          '.arbel-rot{position:fixed;width:16px;height:16px;background:#fff;border:2px solid #646cff;' +
          'border-radius:50%;z-index:100000;display:none;cursor:grab;box-sizing:border-box}' +
          '.arbel-rot-line{position:fixed;width:1px;background:#646cff;z-index:99999;display:none;pointer-events:none}' +
          '.arbel-snap{position:fixed;background:#ff6b35;z-index:99998;pointer-events:none;display:none}' +
          '.arbel-snap-h{height:1px;left:0;right:0}.arbel-snap-v{width:1px;top:0;bottom:0}' +
          '.arbel-guide{position:fixed;z-index:99997;pointer-events:none;display:none}' +
          '.arbel-guide-h{height:1px;left:0;right:0;border-top:1px dashed rgba(100,108,255,.35)}' +
          '.arbel-guide-v{width:1px;top:0;bottom:0;border-left:1px dashed rgba(100,108,255,.35)}' +
          '.arbel-marquee{position:fixed;border:1px dashed #646cff;background:rgba(100,108,255,.08);z-index:99997;pointer-events:none}' +
          '.cne-reveal-container,.cne-reveal-layer,.cne-reveal-top{pointer-events:none!important}' +
          '[data-arbel-id] iframe,[data-arbel-id] video,[data-arbel-id] dotlottie-player{pointer-events:none!important}' +
          '[data-arbel-id] .cne-form-input,[data-arbel-id] .cne-form-textarea,[data-arbel-id] .cne-form-label,[data-arbel-id] button[type=submit]{pointer-events:none!important}' +
          'a[data-arbel-id]{-webkit-user-drag:none}' +
        '";document.head.appendChild(s);' +
        'var lbl=document.createElement("div");lbl.className="arbel-lbl";document.body.appendChild(lbl);' +
        'var posLbl=document.createElement("div");posLbl.className="arbel-pos-lbl";document.body.appendChild(posLbl);' +

        /* ── Center alignment guides (persistent crosshair lines) ── */
        'var guideH=document.createElement("div");guideH.className="arbel-guide arbel-guide-h";document.body.appendChild(guideH);' +
        'var guideV=document.createElement("div");guideV.className="arbel-guide arbel-guide-v";document.body.appendChild(guideV);' +

        /* ── Resize handles ── */
        'var rHandles=[];' +
        '["nw","n","ne","w","e","sw","s","se"].forEach(function(p){' +
          'var h=document.createElement("div");h.className="arbel-rh arbel-rh-"+p;' +
          'h.setAttribute("data-rh",p);document.body.appendChild(h);rHandles.push(h);' +
        '});' +

        /* ── Rotation handle ── */
        'var rotHandle=document.createElement("div");rotHandle.className="arbel-rot";document.body.appendChild(rotHandle);' +
        'var rotLine=document.createElement("div");rotLine.className="arbel-rot-line";document.body.appendChild(rotLine);' +

        'function posHandles(el){' +
          'if(!el){rHandles.forEach(function(h){h.style.display="none"});rotHandle.style.display="none";rotLine.style.display="none";return}' +
          'var r=el.getBoundingClientRect(),hs=5;' +
          'rHandles.forEach(function(h){' +
            'var p=h.getAttribute("data-rh"),t,l;' +
            'if(p.indexOf("n")>=0)t=r.top-hs;else if(p.indexOf("s")>=0)t=r.bottom-hs;else t=r.top+r.height/2-hs;' +
            'if(p.indexOf("w")>=0)l=r.left-hs;else if(p.indexOf("e")>=0)l=r.right-hs;else l=r.left+r.width/2-hs;' +
            'h.style.top=t+"px";h.style.left=l+"px";h.style.display="block";' +
          '});' +
          'rotHandle.style.left=(r.left+r.width/2-8)+"px";' +
          'rotHandle.style.top=(r.top-30)+"px";' +
          'rotHandle.style.display="block";' +
          'rotLine.style.left=(r.left+r.width/2)+"px";' +
          'rotLine.style.top=(r.top-22)+"px";' +
          'rotLine.style.height="22px";' +
          'rotLine.style.display="block";' +
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

        /* ── Rotation handle mousedown ── */
        'rotHandle.addEventListener("mousedown",function(e){' +
          'if(selected.length!==1||editing)return;e.stopPropagation();e.preventDefault();' +
          'var r=primary.getBoundingClientRect();' +
          'rotating={el:primary,cx:r.left+r.width/2,cy:r.top+r.height/2,startAngle:0};' +
          'var cur=primary.style.transform||"";' +
          'var m=cur.match(/rotate\\(([\\-\\d.]+)deg\\)/);' +
          'rotating.startDeg=m?parseFloat(m[1]):0;' +
          'rotating.startAngle=Math.atan2(e.clientY-rotating.cy,e.clientX-rotating.cx);' +
          'window.parent.postMessage({type:"arbel-resize-start"},"*");' +
        '});' +

        /* ── Click → select (suppressed after drag) ── */
        'document.addEventListener("click",function(e){' +
          'if(editing||drag||marquee)return;' +
          'if(justDragged){justDragged=false;e.preventDefault();e.stopPropagation();return}' +
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
          /* Scene center */
          'targets.push({t:vh/2,m:vh/2,b:vh/2,l:vw/2,c:vw/2,r:vw/2});' +
          /* Scene edges */
          'targets.push({t:0,m:0,b:0,l:0,c:0,r:0});' +
          'targets.push({t:vh,m:vh,b:vh,l:vw,c:vw,r:vw});' +
          /* Scene quadrant lines */
          'targets.push({t:vh*0.25,m:vh*0.25,b:vh*0.25,l:vw*0.25,c:vw*0.25,r:vw*0.25});' +
          'targets.push({t:vh*0.75,m:vh*0.75,b:vh*0.75,l:vw*0.75,c:vw*0.75,r:vw*0.75});' +
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
          'if(bestDy<=SNAP_DIST){snapH.style.top=sh+"px";snapH.style.display="block";}else{snapH.style.display="none";}' +
          'if(bestDx<=SNAP_DIST){snapV.style.left=sv+"px";snapV.style.display="block";}else{snapV.style.display="none";}' +
          /* Show center crosshair guides when element center is near viewport center */
          'var cmidY=vt+h/2+(bestDy<=SNAP_DIST?(sny-newT):0);' +
          'var cmidX=vl+w/2+(bestDx<=SNAP_DIST?(snx-newL):0);' +
          'if(Math.abs(cmidY-vh/2)<=SNAP_DIST){guideH.style.top=(vh/2)+\"px\";guideH.style.display=\"block\";}else{guideH.style.display=\"none\";}' +
          'if(Math.abs(cmidX-vw/2)<=SNAP_DIST){guideV.style.left=(vw/2)+\"px\";guideV.style.display=\"block\";}else{guideV.style.display=\"none\";}' +
          'return{top:bestDy<=SNAP_DIST?sny:newT,left:bestDx<=SNAP_DIST?snx:newL};' +
        '}' +
        'function hideSnap(){snapH.style.display="none";snapV.style.display="none";guideH.style.display="none";guideV.style.display="none";}' +

        /* ── Mousedown → start drag or marquee ── */
        'document.addEventListener("mousedown",function(e){' +
          'if(editing||resize||rotating)return;' +
          'justDragged=false;' +
          'if(marquee&&marquee.div&&marquee.div.parentNode){marquee.div.parentNode.removeChild(marquee.div);}marquee=null;' +
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

        /* ── Mousemove → drag elements, resize, rotate, or marquee ── */
        'document.addEventListener("mousemove",function(e){' +
          'if(rotating){' +
            'var a=Math.atan2(e.clientY-rotating.cy,e.clientX-rotating.cx);' +
            'var deg=rotating.startDeg+(a-rotating.startAngle)*180/Math.PI;' +
            'if(e.shiftKey)deg=Math.round(deg/15)*15;' +
            'var cur=rotating.el.style.transform||"";' +
            'cur=cur.replace(/rotate\\([^)]+\\)/,"").trim();' +
            'rotating.el.style.transform=(cur+" rotate("+deg.toFixed(1)+"deg)").trim();' +
            'posHandles(rotating.el);' +
            'posLbl.textContent=deg.toFixed(1)+"\u00B0";posLbl.classList.add("vis");' +
            'window.parent.postMessage({type:"arbel-rotate",id:rotating.el.getAttribute("data-arbel-id"),deg:deg.toFixed(1)},"*");' +
            'return;' +
          '}' +
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

        /* ── Mouseup → end drag, resize, rotate, or marquee ── */
        'document.addEventListener("mouseup",function(e){' +
          'if(rotating){' +
            'posLbl.classList.remove("vis");' +
            'window.parent.postMessage({type:"arbel-resize-end",id:rotating.el.getAttribute("data-arbel-id")},"*");' +
            'rotating=null;return;' +
          '}' +
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
                  'var cs=window.getComputedStyle(el);if(cs.pointerEvents==="none"||cs.display==="none"||cs.visibility==="hidden")return;' +
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
            'justDragged=true;' +
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
          'var sceneEl=primary?primary.closest("[data-scene-index]"):null;' +
          'var sceneIdx=sceneEl?parseInt(sceneEl.getAttribute("data-scene-index"),10):-1;' +
          'window.parent.postMessage({type:"arbel-select",id:primary?primary.getAttribute("data-arbel-id"):null,' +
            'ids:ids,' +
            'sceneIndex:sceneIdx,' +
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
          'el._arbelAutoH=function(){el.style.height="auto";el.style.height=el.scrollHeight+"px";posHandles(el)};' +
          'el.addEventListener("input",el._arbelAutoH);' +
          'el._arbelBlurH=function(){el.removeEventListener("blur",el._arbelBlurH);delete el._arbelBlurH;stopEdit()};' +
          'el.addEventListener("blur",el._arbelBlurH);' +
          'el._arbelKeyK=function onK(e){' +
            'if(e.key==="Escape"||(e.key==="Enter"&&!e.shiftKey)){e.preventDefault();el.removeEventListener("keydown",el._arbelKeyK);delete el._arbelKeyK;el.blur()}' +
          '};' +
          'el.addEventListener("keydown",el._arbelKeyK);' +
        '}' +
        'function stopEdit(){' +
          'if(!primary)return;editing=false;' +
          'primary.classList.remove("arbel-editing");primary.contentEditable=false;' +
          'if(primary._arbelAutoH){primary.removeEventListener("input",primary._arbelAutoH);delete primary._arbelAutoH}' +
          'if(primary._arbelKeyK){primary.removeEventListener("keydown",primary._arbelKeyK);delete primary._arbelKeyK}' +
          'if(primary._arbelBlurH){primary.removeEventListener("blur",primary._arbelBlurH);delete primary._arbelBlurH}' +
          /* Auto-resize height to fit content after text edit */
          'var oldH=primary.style.height;' +
          'primary.style.height="auto";' +
          'var fitH=primary.scrollHeight;' +
          'primary.style.height=fitH+"px";' +
          'var fitW=primary.offsetWidth;' +
          'var fitT=primary.offsetTop;var fitL=primary.offsetLeft;' +
          'posHandles(primary);' +
          'window.parent.postMessage({type:"arbel-text-update",id:primary.getAttribute("data-arbel-id"),text:primary.textContent},"*");' +
          'window.parent.postMessage({type:"arbel-resize",' +
            'id:primary.getAttribute("data-arbel-id"),' +
            'width:fitW+"px",height:fitH+"px",top:fitT+"px",left:fitL+"px"},"*");' +
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
          'if(d.type==="arbel-update-reveal"){' +
            'document.querySelectorAll(".cne-reveal-container").forEach(function(c){' +
              'if(d.revealType)c.dataset.revealType=d.revealType;' +
              'if(d.revealRadius)c.dataset.revealRadius=d.revealRadius;' +
              'if(d.revealFeather)c.dataset.revealFeather=d.revealFeather;' +
              'if(d.revealSpeed)c.dataset.revealSpeed=d.revealSpeed;' +
              'if(d.revealInvert!==undefined)c.dataset.revealInvert=d.revealInvert;' +
            '});' +
          '}' +
        '});' +
        /* ── Reposition handles on scroll ── */
        'window.addEventListener("scroll",function(){if(selected.length===1&&primary&&!resize&&document.contains(primary))posHandles(primary)},true);' +
        'window.addEventListener("resize",function(){if(selected.length===1&&primary&&document.contains(primary))posHandles(primary)});' +
        /* ── Forward keyboard shortcuts to parent (iframe eats keydown) ── */
        'document.addEventListener("keydown",function(e){' +
          'if(editing)return;' +
          'var k=e.key;var ctrl=e.ctrlKey||e.metaKey;' +
          'if(k==="Delete"||k==="Backspace"||k==="Escape"||(ctrl&&(k==="z"||k==="y"||k==="c"||k==="v"||k==="d"||k==="a"||k==="g"||k==="s"||k==="S"||k==="o"||k==="O"||k==="n"||k==="N"))){' +
            'e.preventDefault();' +
            'window.parent.postMessage({type:"arbel-key",key:k,ctrl:!!ctrl,shift:!!e.shiftKey,alt:!!e.altKey},"*");' +
          '}' +
        '});' +
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
        objectFit: true,
        clipPath: true,
        transformStyle: true, perspective: true
    };

    /* Allowlisted scroll animation properties */
    var _ALLOWED_SCROLL_PROPS = {
        opacity: true, x: true, y: true, scale: true, rotation: true,
        blur: true, clipPath: true, rotateX: true, rotateY: true,
        skewX: true, skewY: true, start: true, end: true, ease: true
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
            } else if (prop === 'ease') {
                if (typeof val === 'string' && /^(none|power[1-4]\.(in|out|inOut)|expo\.(in|out|inOut)|circ\.(in|out|inOut)|sine\.(in|out|inOut)|back\.(in|out|inOut)\([0-9.]+\)|elastic\.(in|out|inOut)\([0-9.,]+\)|bounce\.(in|out|inOut)|cubic-bezier\(-?[0-9.]+,-?[0-9.]+,-?[0-9.]+,-?[0-9.]+\))$/.test(val)) {
                    clean[prop] = val;
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

    /* ─── AI Studio Dialog ─── */
    function _showAIStudio() {
        var dialog = _qs('#cneAIStudio');
        if (!dialog) return;
        dialog.style.display = '';
        _setupAIStudioOnce();
    }

    var _aiStudioBound = false;
    function _setupAIStudioOnce() {
        if (_aiStudioBound) return;
        _aiStudioBound = true;

        // Close
        var closeBtn = _qs('#cneAIStudioClose');
        var overlay = _qs('#cneAIStudio');
        if (closeBtn) closeBtn.addEventListener('click', function () { overlay.style.display = 'none'; });
        if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });

        // Tab switching
        _qsa('.cne-dialog-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                _qsa('.cne-dialog-tab').forEach(function (t) { t.classList.remove('active'); });
                _qsa('.cne-ai-panel').forEach(function (p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var panel = _qs('[data-aipanel="' + tab.getAttribute('data-aitab') + '"]');
                if (panel) panel.classList.add('active');
            });
        });

        // Populate provider dropdowns
        _populateProviderSelect('#cneAIVideoProvider', 'video');
        _populateProviderSelect('#cneAIImageProvider', 'image');

        // Video key save
        _setupKeySave('#cneAIVideoKeySave', '#cneAIVideoKey', '#cneAIVideoProvider', '#cneAIVideoKeyStatus', 'video');
        // Image key save
        _setupKeySave('#cneAIImageKeySave', '#cneAIImageKey', '#cneAIImageProvider', '#cneAIImageKeyStatus', 'image');

        // Video generate
        var videoGenBtn = _qs('#cneAIVideoGenerate');
        if (videoGenBtn) {
            videoGenBtn.addEventListener('click', async function () {
                var statusEl = _qs('#cneAIVideoStatus');
                var statusMsg = _qs('#cneAIVideoStatusMsg');
                var outputEl = _qs('#cneAIVideoOutput');
                var resultEl = _qs('#cneAIVideoResult');

                if (!window.ArbelAIMedia) { alert('AI Media module not loaded'); return; }
                if (!ArbelKeyManager.hasKey('video')) { alert('Please save a video API key first.'); return; }

                var prompt = (_qs('#cneAIVideoPrompt') || {}).value || '';
                if (!prompt.trim()) { alert('Please enter a prompt.'); return; }

                if (statusEl) { statusEl.style.display = ''; }
                if (statusMsg) statusMsg.textContent = 'Generating video...';
                if (outputEl) outputEl.style.display = 'none';
                videoGenBtn.disabled = true;

                try {
                    var result = await ArbelAIMedia.generateVideo({
                        prompt: prompt,
                        imageUrl: (_qs('#cneAIVideoImage') || {}).value || '',
                        resolution: (_qs('#cneAIVideoRes') || {}).value || 'landscape',
                        duration: parseInt((_qs('#cneAIVideoDuration') || {}).value) || 5
                    });

                    // If processing, poll
                    if (result.status === 'processing' && result.pollUrl) {
                        if (statusMsg) statusMsg.textContent = 'Processing... (polling)';
                        var maxPolls = 60;
                        for (var i = 0; i < maxPolls; i++) {
                            await new Promise(function (r) { setTimeout(r, 5000); });
                            result = await ArbelAIMedia.pollReplicate(result.pollUrl);
                            if (result.status === 'succeeded') break;
                            if (statusMsg) statusMsg.textContent = 'Processing... (' + (i + 1) + '/' + maxPolls + ')';
                        }
                    }

                    if (result.status === 'succeeded' && result.output) {
                        if (statusEl) statusEl.style.display = 'none';
                        if (resultEl) resultEl.src = result.output;
                        if (outputEl) outputEl.style.display = '';
                    } else {
                        if (statusMsg) statusMsg.textContent = 'Generation timed out. Try again.';
                    }
                } catch (err) {
                    if (statusMsg) statusMsg.textContent = 'Error: ' + err.message;
                }
                videoGenBtn.disabled = false;
            });
        }

        // Video insert
        var videoInsertBtn = _qs('#cneAIVideoInsert');
        if (videoInsertBtn) {
            videoInsertBtn.addEventListener('click', function () {
                var resultEl = _qs('#cneAIVideoResult');
                if (!resultEl || !resultEl.src) return;
                _pushUndo();
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                scene.elements.push({
                    id: 'vid-' + Date.now().toString(36),
                    tag: 'video',
                    src: resultEl.src,
                    videoAutoplay: true,
                    videoLoop: true,
                    videoMuted: true,
                    style: { position: 'absolute', top: '10%', left: '10%', width: '80%', height: '60%', objectFit: 'cover', borderRadius: '12px' }
                });
                _renderElementList();
                _notifyUpdate(true);
                _qs('#cneAIStudio').style.display = 'none';
            });
        }

        // Image generate
        var imageGenBtn = _qs('#cneAIImageGenerate');
        if (imageGenBtn) {
            imageGenBtn.addEventListener('click', async function () {
                var statusEl = _qs('#cneAIImageStatus');
                var statusMsg = _qs('#cneAIImageStatusMsg');
                var outputEl = _qs('#cneAIImageOutput');
                var resultEl = _qs('#cneAIImageResult');

                if (!window.ArbelAIMedia) { alert('AI Media module not loaded'); return; }
                if (!ArbelKeyManager.hasKey('image')) { alert('Please save an image API key first.'); return; }

                var prompt = (_qs('#cneAIImagePrompt') || {}).value || '';
                if (!prompt.trim()) { alert('Please enter a prompt.'); return; }

                if (statusEl) statusEl.style.display = '';
                if (statusMsg) statusMsg.textContent = 'Generating image...';
                if (outputEl) outputEl.style.display = 'none';
                imageGenBtn.disabled = true;

                try {
                    var result = await ArbelAIMedia.generateImage({
                        prompt: prompt,
                        resolution: (_qs('#cneAIImageRes') || {}).value || 'landscape',
                        model: (_qs('#cneAIImageModel') || {}).value || 'flux'
                    });

                    if (result.status === 'processing' && result.pollUrl) {
                        if (statusMsg) statusMsg.textContent = 'Processing...';
                        var maxPolls = 30;
                        for (var i = 0; i < maxPolls; i++) {
                            await new Promise(function (r) { setTimeout(r, 3000); });
                            result = await ArbelAIMedia.pollReplicate(result.pollUrl);
                            if (result.status === 'succeeded') break;
                        }
                    }

                    if (result.status === 'succeeded' && result.output) {
                        if (statusEl) statusEl.style.display = 'none';
                        if (resultEl) resultEl.src = result.output;
                        if (outputEl) outputEl.style.display = '';
                    } else {
                        if (statusMsg) statusMsg.textContent = 'Generation timed out.';
                    }
                } catch (err) {
                    if (statusMsg) statusMsg.textContent = 'Error: ' + err.message;
                }
                imageGenBtn.disabled = false;
            });
        }

        // Image insert
        var imageInsertBtn = _qs('#cneAIImageInsert');
        if (imageInsertBtn) {
            imageInsertBtn.addEventListener('click', function () {
                var resultEl = _qs('#cneAIImageResult');
                if (!resultEl || !resultEl.src) return;
                _pushUndo();
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                scene.elements.push({
                    id: 'img-' + Date.now().toString(36),
                    tag: 'img',
                    src: resultEl.src,
                    style: { position: 'absolute', top: '10%', left: '10%', width: '80%', height: 'auto', objectFit: 'cover', borderRadius: '12px' }
                });
                _renderElementList();
                _notifyUpdate(true);
                _qs('#cneAIStudio').style.display = 'none';
            });
        }

        // Photo → Animation apply
        var animApplyBtn = _qs('#cneAIAnimApply');
        if (animApplyBtn) {
            animApplyBtn.addEventListener('click', function () {
                if (!window.ArbelAIMedia) return;
                var imageUrl = (_qs('#cneAIAnimImage') || {}).value || '';
                var effect = (_qs('#cneAIAnimEffect') || {}).value || 'ken-burns';
                if (!imageUrl) { alert('Please enter an image URL.'); return; }

                var config = ArbelAIMedia.photoToAnimation(imageUrl, effect);
                _pushUndo();
                var scene = _scenes[_currentSceneIdx];
                if (!scene) return;
                var el = {
                    id: 'anim-' + Date.now().toString(36),
                    tag: 'div',
                    text: '',
                    style: Object.assign({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }, config.style)
                };
                if (config.scroll) el.scroll = config.scroll;
                scene.elements.unshift(el);  // behind other elements
                _renderElementList();
                _notifyUpdate(true);
                _qs('#cneAIStudio').style.display = 'none';
            });
        }
    }

    function _populateProviderSelect(selectSel, category) {
        var select = _qs(selectSel);
        if (!select) return;
        select.innerHTML = '';
        var providers = ArbelKeyManager.getProvidersByCategory(category);
        providers.forEach(function (p) {
            var opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.label;
            select.appendChild(opt);
        });
        // Pre-select saved provider
        var saved = ArbelKeyManager.getProvider(category);
        if (saved) select.value = saved;
    }

    function _setupKeySave(btnSel, inputSel, providerSel, statusSel, category) {
        var btn = _qs(btnSel);
        var input = _qs(inputSel);
        var provSelect = _qs(providerSel);
        var statusEl = _qs(statusSel);

        // Show existing key status
        if (statusEl && ArbelKeyManager.hasKey(category)) {
            statusEl.textContent = 'Key saved: ' + ArbelKeyManager.getMaskedKey(category);
        }

        if (btn && input && provSelect) {
            btn.addEventListener('click', function () {
                var key = input.value.trim();
                var provider = provSelect.value;
                if (!key || key.length < 8) {
                    if (statusEl) { statusEl.textContent = 'Key too short'; statusEl.style.color = '#ef4444'; }
                    return;
                }
                if (ArbelKeyManager.saveKey(category, provider, key)) {
                    if (statusEl) { statusEl.textContent = 'Saved: ' + ArbelKeyManager.getMaskedKey(category); statusEl.style.color = '#10b981'; }
                    input.value = '';
                } else {
                    if (statusEl) { statusEl.textContent = 'Failed to save'; statusEl.style.color = '#ef4444'; }
                }
            });
        }
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
        updateContentFromCopy: updateContentFromCopy,
        destroy: function () {
            _active = false;
            _selectedElementId = null;
            _selectedElementIds = [];
            _uiBound = false;
            window.removeEventListener('message', _handleMessage);
            if (_keydownHandler) { document.removeEventListener('keydown', _keydownHandler); _keydownHandler = null; }
            if (_beforeUnloadHandler) { window.removeEventListener('beforeunload', _beforeUnloadHandler); _beforeUnloadHandler = null; }
            if (_autosaveTimer) { clearTimeout(_autosaveTimer); _autosaveTimer = null; }
            _fileHandle = null;
            _projectDirty = false;
        }
    };
})();
