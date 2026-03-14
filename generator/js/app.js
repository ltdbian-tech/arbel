/* ═══════════════════════════════════════════════
   APP — Wizard Controller
   
   Wires together Auth, Compiler, Preview, Deploy,
   and AI modules into the 5-step wizard flow.
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ─── State ─── */
    var state = {
        step: 0,
        style: 'obsidian',
        styleMode: 'preset',
        authenticated: false,
        compiledFiles: null,
        editorOverrides: null
    };

    /* ─── DOM Refs ─── */
    var $ = function (id) { return document.getElementById(id); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    var els = {
        wizard: $('wizard'),
        progressFill: $('progressFill'),
        stepsNav: $('stepsNav'),
        // Auth — OAuth
        githubSignIn: $('githubSignIn'),
        authStatus: $('authStatus'),
        // Auth — PAT
        patToggle: $('patToggle'),
        patBody: $('patBody'),
        tokenInput: $('tokenInput'),
        tokenToggle: $('tokenToggle'),
        connectBtn: $('connectBtn'),
        // User display
        genUser: $('genUser'),
        genUserAvatar: $('genUserAvatar'),
        genUserName: $('genUserName'),
        // Style
        styleGrid: $('styleGrid'),
        styleModeToggle: $('styleModeToggle'),
        presetsPanel: $('presetsPanel'),
        builderPanel: $('builderPanel'),
        styleCatTabs: $('styleCatTabs'),
        builderCatSelect: $('builderCatSelect'),
        builderCanvas: $('builderCanvas'),
        builderParams: $('builderParams'),
        builderColor1: $('builderColor1'),
        builderColor2: $('builderColor2'),
        builderColor3: $('builderColor3'),
        backToAuth: $('backToAuth'),
        toConfig: $('toConfig'),
        // Config
        brandName: $('brandName'),
        tagline: $('tagline'),
        industry: $('industry'),
        contactEmail: $('contactEmail'),
        accentColor: $('accentColor'),
        accentVal: $('accentVal'),
        bgColor: $('bgColor'),
        bgVal: $('bgVal'),
        sectionToggles: $('sectionToggles'),
        contentEditor: $('contentEditor'),
        particleConfig: $('particleConfig'),
        particleCount: $('particleCount'),
        particleCountVal: $('particleCountVal'),
        particleSpeed: $('particleSpeed'),
        particleSpeedVal: $('particleSpeedVal'),
        particleGlow: $('particleGlow'),
        particleGlowVal: $('particleGlowVal'),
        particleConnect: $('particleConnect'),
        particleInteract: $('particleInteract'),
        backToStyle: $('backToStyle'),
        toPreview: $('toPreview'),
        // AI
        aiToggle: $('aiToggle'),
        aiBody: $('aiBody'),
        aiProvider: $('aiProvider'),
        aiKeyInput: $('aiKeyInput'),
        aiKeyRemove: $('aiKeyRemove'),
        aiKeyStatus: $('aiKeyStatus'),
        aiGenerate: $('aiGenerate'),
        aiPrompt: $('aiPrompt'),
        aiGenerateBtn: $('aiGenerateBtn'),
        aiStatus: $('aiStatus'),
        // Preview
        previewIframe: $('previewIframe'),
        previewFrame: $('previewFrame'),
        backToConfig: $('backToConfig'),
        toDeploy: $('toDeploy'),
        // Editor
        editorLayout: $('editorLayout'),
        editorPanel: $('editorPanel'),
        editModeBtn: $('editModeBtn'),
        // Deploy
        deployUsername: $('deployUsername'),
        repoName: $('repoName'),
        deployUrl: $('deployUrl'),
        deployBtn: $('deployBtn'),
        deployProgress: $('deployProgress'),
        deploySuccess: $('deploySuccess'),
        deployError: $('deployError'),
        deployErrorMsg: $('deployErrorMsg'),
        siteLink: $('siteLink'),
        repoLink: $('repoLink'),
        retryDeploy: $('retryDeploy')
    };

    var editorActive = false;

    /* ─── Step Navigation ─── */
    function goToStep(n) {
        if (n < 0 || n > 4) return;
        if (n > 0 && !state.authenticated) return;
        state.step = n;

        // Update step visibility
        $$('.gen-step').forEach(function (el) {
            el.classList.toggle('active', parseInt(el.dataset.step) === n);
        });

        // Update progress bar (0-100%)
        els.progressFill.style.width = (n / 4 * 100) + '%';

        // Update step dots
        $$('.step-dot').forEach(function (dot) {
            var s = parseInt(dot.dataset.step);
            dot.classList.toggle('active', s === n);
            dot.classList.toggle('done', s < n);
        });

        // Scroll to top
        window.scrollTo(0, 0);

        // Step-specific actions on enter
        if (n === 1) initStylePreviews();
        if (n === 3) generatePreview();
    }

    // Step dot navigation (only backwards or to current)
    $$('.step-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
            var target = parseInt(dot.dataset.step);
            if (target <= state.step) goToStep(target);
        });
    });

    /* ─── AUTH ─── */

    /** Handle successful auth for both OAuth and PAT */
    function onAuthSuccess(user) {
        state.authenticated = true;

        // Show user info in header
        els.genUser.style.display = 'flex';
        els.genUserAvatar.src = user.avatar;
        els.genUserName.textContent = user.login;

        // Pre-fill deploy username
        els.deployUsername.textContent = user.login;
        updateDeployUrl();

        showAuthStatus('Connected as ' + user.login, 'success');

        // Auto-advance after brief delay
        setTimeout(function () { goToStep(1); }, 600);
    }

    // OAuth: Sign in with GitHub button
    els.githubSignIn.addEventListener('click', function () {
        els.githubSignIn.disabled = true;
        els.githubSignIn.textContent = 'Redirecting to GitHub...';
        ArbelAuth.startOAuth();
    });

    // OAuth: Handle callback on page load (if returning from GitHub)
    (function checkOAuthCallback() {
        var params = new URLSearchParams(window.location.search);
        if (params.has('code')) {
            showAuthStatus('Completing sign in...', 'info');
            els.githubSignIn.disabled = true;
            els.githubSignIn.textContent = 'Connecting...';

            ArbelAuth.handleOAuthCallback().then(function (result) {
                if (!result.handled) return;
                if (result.success) {
                    onAuthSuccess(result.user);
                } else {
                    showAuthStatus(result.error || 'Sign in failed.', 'error');
                    els.githubSignIn.disabled = false;
                    els.githubSignIn.innerHTML = '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg> Sign in with GitHub';
                }
            });
        }
    })();

    // PAT: Toggle advanced section
    els.patToggle.addEventListener('click', function () {
        var body = els.patBody;
        var arrow = els.patToggle.querySelector('.auth-toggle-arrow');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            body.style.display = 'none';
            arrow.style.transform = '';
        }
    });

    // PAT: Toggle visibility
    els.tokenToggle.addEventListener('click', function () {
        var isPassword = els.tokenInput.type === 'password';
        els.tokenInput.type = isPassword ? 'text' : 'password';
        els.tokenToggle.textContent = isPassword ? 'HIDE' : 'SHOW';
    });

    // PAT: Connect with token
    els.connectBtn.addEventListener('click', function () {
        var token = els.tokenInput.value.trim();
        if (!token) {
            showAuthStatus('Please enter a token.', 'error');
            return;
        }

        els.connectBtn.disabled = true;
        els.connectBtn.textContent = 'CONNECTING...';
        showAuthStatus('Validating token...', 'info');

        ArbelAuth.saveToken(token);
        ArbelAuth.validateToken(token)
            .then(function (result) {
                if (result.valid) {
                    onAuthSuccess(result.user);
                } else {
                    showAuthStatus(result.error || 'Invalid token.', 'error');
                    els.connectBtn.disabled = false;
                    els.connectBtn.textContent = 'Connect with Token';
                }
            })
            .catch(function () {
                showAuthStatus('Connection failed. Try again.', 'error');
                els.connectBtn.disabled = false;
                els.connectBtn.textContent = 'Connect with Token';
            });
    });

    function showAuthStatus(msg, type) {
        els.authStatus.textContent = msg;
        els.authStatus.className = 'auth-status auth-status--' + type;
    }

    /* ─── STYLE PICKER ─── */
    var styleCanvasesInit = false;
    var allStyles = [];
    var styleMode = 'presets'; // 'presets' or 'builder'
    var builderCat = 'particle';
    var builderAnim = null; // requestAnimationFrame id

    /** Render style cards dynamically from compiler */
    function renderStyleGrid(filterCat) {
        allStyles = ArbelCompiler.getStyles();
        var grid = els.styleGrid;
        // Stop any running card animations
        grid.querySelectorAll('canvas').forEach(function (c) {
            if (c._raf) cancelAnimationFrame(c._raf);
        });
        grid.innerHTML = '';

        var catLabels = { shader: 'WEBGL SHADERS', particle: 'PARTICLES', blob: 'BLOBS', gradient: 'GRADIENTS', wave: 'WAVES' };
        var lastType = '';

        allStyles.forEach(function (s) {
            if (filterCat && filterCat !== 'all' && s.type !== filterCat) return;

            // Add category divider when type changes (only in "all" view)
            if ((!filterCat || filterCat === 'all') && s.type !== lastType) {
                lastType = s.type;
                var divider = document.createElement('div');
                divider.className = 'style-divider';
                divider.innerHTML = '<span class="mono">' + (catLabels[s.type] || s.type.toUpperCase()) + '</span>';
                grid.appendChild(divider);
            }

            var btn = document.createElement('button');
            btn.className = 'style-card' + (s.id === state.style ? ' selected' : '');
            btn.dataset.style = s.id;
            btn.dataset.type = s.type;

            var tags = (s.tags || []).map(function (t) { return '<span>' + t + '</span>'; }).join('');
            btn.innerHTML =
                '<div class="style-preview"><canvas class="style-canvas" data-anim-type="' + s.type + '" data-anim-id="' + s.id + '"></canvas></div>' +
                '<div class="style-info">' +
                '<h3 class="style-name">' + (s.label || s.id) + '</h3>' +
                '<span class="style-desc mono">' + (s.desc || s.type.toUpperCase()) + '</span>' +
                (tags ? '<div class="style-tags">' + tags + '</div>' : '') +
                '</div>';

            grid.appendChild(btn);
        });

        // Animate visible canvases
        initCardCanvases();
    }

    /** Initialize mini-preview canvases on cards */
    function initCardCanvases() {
        els.styleGrid.querySelectorAll('.style-canvas').forEach(function (canvas) {
            var type = canvas.dataset.animType;
            var id = canvas.dataset.animId;
            if (type === 'shader') {
                var frag = ArbelCompiler.getShaderFragment(id);
                _drawMiniShader(canvas, frag);
            } else {
                var cfg = ArbelCompiler.getAnimConfig(id);
                if (!cfg) return;
                switch (type) {
                    case 'particle': _drawMiniParticles(canvas, cfg); break;
                    case 'blob': _drawMiniBlobs(canvas, cfg); break;
                    case 'gradient': _drawMiniGradient(canvas, cfg); break;
                    case 'wave': _drawMiniWaves(canvas, cfg); break;
                }
            }
        });
    }

    function initStylePreviews() {
        renderStyleGrid('all');
        styleCanvasesInit = true;
    }

    function _drawMiniShader(canvas, frag) {
        var w = canvas.parentElement.offsetWidth || 200;
        var h = canvas.parentElement.offsetHeight || 120;
        canvas.width = w;
        canvas.height = h;

        // Simple 2D noise approximation for canvas preview
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var t = 0;
        function draw() {
            t += 0.007;
            var imgData = ctx.createImageData(w, h);
            var d = imgData.data;
            for (var y = 0; y < h; y += 2) {
                for (var x = 0; x < w; x += 2) {
                    var nx = x / w, ny = y / h;
                    var n = Math.sin(nx * 6 + t) * Math.cos(ny * 4 + t * 0.7) * 0.5;
                    n += Math.sin(nx * 12 + ny * 8 + t * 1.3) * 0.25;
                    var v = (n * 0.5 + 0.5);

                    // Use the style's fragment to approximate colors
                    var r, g, b;
                    var styleId = canvas.dataset.shader;
                    switch (styleId) {
                        case 'aurora':
                            r = v * 20; g = v * 200; b = v * 170; break;
                        case 'ember':
                            r = v * 230; g = v * 90; b = v * 15; break;
                        case 'frost':
                            r = v * 80; g = v * 150; b = v * 230; break;
                        case 'neon':
                            r = v * 200; g = v * 20; b = v * 130; break;
                        case 'silk':
                            r = v * 150; g = v * 140; b = v * 200; break;
                        default: // obsidian
                            r = v * 60; g = v * 40; b = v * 140;
                    }

                    for (var dy = 0; dy < 2 && y + dy < h; dy++) {
                        for (var dx = 0; dx < 2 && x + dx < w; dx++) {
                            var i = ((y + dy) * w + (x + dx)) * 4;
                            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
                        }
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
            canvas._raf = requestAnimationFrame(draw);
        }
        draw();
    }

    function _drawMiniParticles(canvas, pCfg) {
        var w = canvas.parentElement.offsetWidth || 200;
        var h = canvas.parentElement.offsetHeight || 120;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var cfg = pCfg.config;
        var baseColor = cfg.baseColor;
        var grad = cfg.bgGrad;
        var isMatrix = cfg.shape === 'char' || cfg.shape === 'text';
        var count = 40;
        var pts = [];
        for (var i = 0; i < count; i++) {
            pts.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: isMatrix ? Math.random() * 1.5 + 0.5 : (Math.random() - 0.5) * 0.5,
                r: isMatrix ? 0 : Math.random() * 2 + 1,
                ch: isMatrix ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)) : null
            });
        }

        function draw() {
            var grd = ctx.createLinearGradient(0, 0, 0, h);
            grd.addColorStop(0, grad[0]);
            grd.addColorStop(1, grad[1]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);

            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                if (isMatrix) {
                    ctx.fillStyle = baseColor;
                    ctx.font = '10px monospace';
                    ctx.globalAlpha = Math.random() * 0.5 + 0.3;
                    ctx.fillText(p.ch, p.x, p.y);
                    ctx.globalAlpha = 1;
                } else {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fillStyle = baseColor;
                    ctx.globalAlpha = 0.7;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                if (cfg.connectDist > 0 && !isMatrix) {
                    for (var j = i + 1; j < pts.length; j++) {
                        var dx = pts[j].x - p.x, dy = pts[j].y - p.y;
                        var dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 40) {
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(pts[j].x, pts[j].y);
                            ctx.strokeStyle = baseColor;
                            ctx.globalAlpha = 0.2;
                            ctx.stroke();
                            ctx.globalAlpha = 1;
                        }
                    }
                }
            }
            canvas._raf = requestAnimationFrame(draw);
        }
        draw();
    }

    function _drawMiniBlobs(canvas, bCfg) {
        var w = canvas.parentElement.offsetWidth || 200;
        var h = canvas.parentElement.offsetHeight || 120;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var cfg = bCfg.config;
        var colors = cfg.baseColors || ['#6C5CE7', '#00CEC9', '#FD79A8'];
        var count = Math.min(cfg.count || 4, 5);
        var blobs = [];
        for (var i = 0; i < count; i++) {
            blobs.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: 30 + Math.random() * 30,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                color: colors[i % colors.length],
                phase: Math.random() * Math.PI * 2
            });
        }
        var t = 0;

        function draw() {
            t += 0.02;
            var grd = ctx.createLinearGradient(0, 0, 0, h);
            var bg = cfg.bgGrad || ['#0a0a1a', '#1a0a2a'];
            grd.addColorStop(0, bg[0]);
            grd.addColorStop(1, bg[1]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);
            ctx.filter = 'blur(12px)';

            blobs.forEach(function (b) {
                b.x += b.vx + Math.sin(t + b.phase) * 0.3;
                b.y += b.vy + Math.cos(t + b.phase) * 0.3;
                if (b.x < -b.r) b.x = w + b.r;
                if (b.x > w + b.r) b.x = -b.r;
                if (b.y < -b.r) b.y = h + b.r;
                if (b.y > h + b.r) b.y = -b.r;

                var grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
                grad.addColorStop(0, b.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            canvas._raf = requestAnimationFrame(draw);
        }
        draw();
    }

    function _drawMiniGradient(canvas, gCfg) {
        var w = canvas.parentElement.offsetWidth || 200;
        var h = canvas.parentElement.offsetHeight || 120;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var cfg = gCfg.config;
        var stops = cfg.stops || ['#6C5CE7', '#00CEC9', '#FD79A8'];
        var orbCount = stops.length;
        var orbs = [];
        for (var i = 0; i < orbCount; i++) {
            orbs.push({
                angle: (i / orbCount) * Math.PI * 2,
                speed: 0.008 + Math.random() * 0.005,
                rx: w * 0.3 + Math.random() * w * 0.1,
                ry: h * 0.3 + Math.random() * h * 0.1,
                color: stops[i]
            });
        }

        function draw() {
            var bg = cfg.bgGrad || ['#0a0a1a', '#1a0a2a'];
            var grd = ctx.createLinearGradient(0, 0, 0, h);
            grd.addColorStop(0, bg[0]);
            grd.addColorStop(1, bg[1]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);
            ctx.filter = 'blur(20px)';

            orbs.forEach(function (o) {
                o.angle += o.speed;
                var ox = w / 2 + Math.cos(o.angle) * o.rx;
                var oy = h / 2 + Math.sin(o.angle) * o.ry;
                var r = Math.min(w, h) * 0.35;
                var grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
                grad.addColorStop(0, o.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(0, 0, w, h);
            });

            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            canvas._raf = requestAnimationFrame(draw);
        }
        draw();
    }

    function _drawMiniWaves(canvas, wCfg) {
        var w = canvas.parentElement.offsetWidth || 200;
        var h = canvas.parentElement.offsetHeight || 120;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var cfg = wCfg.config;
        var colors = cfg.colors || ['#6C5CE7', '#00CEC9', '#FD79A8'];
        var layers = Math.min(cfg.layers || 3, 4);
        var t = 0;

        function draw() {
            t += 0.02;
            var bg = cfg.bgGrad || ['#0a0a1a', '#1a0a2a'];
            var grd = ctx.createLinearGradient(0, 0, 0, h);
            grd.addColorStop(0, bg[0]);
            grd.addColorStop(1, bg[1]);
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);

            for (var l = 0; l < layers; l++) {
                var amp = (cfg.amplitude || 20) * (0.5 + l * 0.3) * (h / 200);
                var baseY = h * 0.4 + l * (h * 0.15);
                ctx.beginPath();
                ctx.moveTo(0, h);
                for (var x = 0; x <= w; x += 3) {
                    var y = baseY + Math.sin(x * 0.02 + t + l * 1.5) * amp + Math.sin(x * 0.01 + t * 0.7) * amp * 0.5;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.fillStyle = colors[l % colors.length];
                ctx.globalAlpha = 0.3;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            canvas._raf = requestAnimationFrame(draw);
        }
        draw();
    }

    /* ─── Style card click handler ─── */
    els.styleGrid.addEventListener('click', function (e) {
        var card = e.target.closest('.style-card');
        if (!card) return;

        els.styleGrid.querySelectorAll('.style-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        state.style = card.dataset.style;
        state.styleMode = 'preset';

        // Update color pickers to match new style
        var match = allStyles.find(function (s) { return s.id === state.style; });
        if (match) {
            els.accentColor.value = match.colors.accent;
            els.accentVal.textContent = match.colors.accent;
            els.bgColor.value = match.colors.bg;
            els.bgVal.textContent = match.colors.bg;
        }

        // Show/hide particle config panel (works for all canvas-based animations)
        var cat = ArbelCompiler.getAnimCategory(state.style);
        els.particleConfig.style.display = (cat !== 'shader') ? '' : 'none';
    });

    /* ─── Mode Toggle: Presets / Builder ─── */
    els.styleModeToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.mode-btn');
        if (!btn) return;
        var mode = btn.dataset.mode;
        els.styleModeToggle.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        styleMode = mode;

        if (mode === 'presets') {
            els.presetsPanel.style.display = '';
            els.builderPanel.style.display = 'none';
            stopBuilder();
        } else {
            els.presetsPanel.style.display = 'none';
            els.builderPanel.style.display = '';
            startBuilder();
        }
    });

    /* ─── Category Filter Tabs ─── */
    els.styleCatTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.cat-tab');
        if (!tab) return;
        els.styleCatTabs.querySelectorAll('.cat-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderStyleGrid(tab.dataset.cat);
    });

    /* ─── Builder ─── */
    var builderState = {
        cat: 'particle',
        params: { count: 80, speed: 1, size: 3, glow: 0.6, connect: true, layers: 3, amplitude: 30, blur: 40 },
        colors: ['#6C5CE7', '#00CEC9', '#0a0a0f']
    };

    function startBuilder() {
        renderBuilderParams();
        runBuilderPreview();
    }

    function stopBuilder() {
        if (builderAnim) cancelAnimationFrame(builderAnim);
        builderAnim = null;
    }

    function renderBuilderParams() {
        var cat = builderState.cat;
        var html = '';

        if (cat === 'particle') {
            html =
                '<div class="field"><label class="field-label mono">COUNT — <span id="bp_count">' + builderState.params.count + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="count" min="20" max="300" value="' + builderState.params.count + '" step="10"></div>' +
                '<div class="field"><label class="field-label mono">SPEED — <span id="bp_speed">' + builderState.params.speed + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="speed" min="0.2" max="3" value="' + builderState.params.speed + '" step="0.1"></div>' +
                '<div class="field"><label class="field-label mono">SIZE — <span id="bp_size">' + builderState.params.size + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="size" min="1" max="8" value="' + builderState.params.size + '" step="0.5"></div>' +
                '<div class="field"><label class="field-label mono">GLOW — <span id="bp_glow">' + builderState.params.glow + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="glow" min="0" max="1" value="' + builderState.params.glow + '" step="0.05"></div>' +
                '<div class="toggle-row"><label class="toggle-item"><input type="checkbox" class="bp-check" data-param="connect"' + (builderState.params.connect ? ' checked' : '') + '><span class="toggle-label">Connections</span></label></div>';
        } else if (cat === 'blob') {
            html =
                '<div class="field"><label class="field-label mono">BLOB COUNT — <span id="bp_count">' + builderState.params.count + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="count" min="2" max="8" value="' + Math.min(builderState.params.count, 8) + '" step="1"></div>' +
                '<div class="field"><label class="field-label mono">SPEED — <span id="bp_speed">' + builderState.params.speed + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="speed" min="0.3" max="2" value="' + builderState.params.speed + '" step="0.1"></div>' +
                '<div class="field"><label class="field-label mono">BLUR — <span id="bp_blur">' + builderState.params.blur + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="blur" min="10" max="80" value="' + builderState.params.blur + '" step="5"></div>';
        } else if (cat === 'gradient') {
            html =
                '<div class="field"><label class="field-label mono">SPEED — <span id="bp_speed">' + builderState.params.speed + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="speed" min="0.2" max="2" value="' + builderState.params.speed + '" step="0.1"></div>' +
                '<div class="field"><label class="field-label mono">GLOW — <span id="bp_glow">' + builderState.params.glow + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="glow" min="0" max="1" value="' + builderState.params.glow + '" step="0.05"></div>';
        } else if (cat === 'wave') {
            html =
                '<div class="field"><label class="field-label mono">LAYERS — <span id="bp_layers">' + builderState.params.layers + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="layers" min="2" max="8" value="' + builderState.params.layers + '" step="1"></div>' +
                '<div class="field"><label class="field-label mono">AMPLITUDE — <span id="bp_amplitude">' + builderState.params.amplitude + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="amplitude" min="10" max="80" value="' + builderState.params.amplitude + '" step="5"></div>' +
                '<div class="field"><label class="field-label mono">SPEED — <span id="bp_speed">' + builderState.params.speed + '</span></label>' +
                '<input type="range" class="gen-range bp-range" data-param="speed" min="0.5" max="3" value="' + builderState.params.speed + '" step="0.1"></div>';
        }

        els.builderParams.innerHTML = html;

        // Bind range inputs
        els.builderParams.querySelectorAll('.bp-range').forEach(function (inp) {
            inp.addEventListener('input', function () {
                var param = inp.dataset.param;
                var val = parseFloat(inp.value);
                builderState.params[param] = val;
                var label = document.getElementById('bp_' + param);
                if (label) label.textContent = val;
            });
        });
        els.builderParams.querySelectorAll('.bp-check').forEach(function (inp) {
            inp.addEventListener('change', function () {
                builderState.params[inp.dataset.param] = inp.checked;
            });
        });
    }

    /** Builder category tabs */
    els.builderCatSelect.addEventListener('click', function (e) {
        var btn = e.target.closest('.builder-cat');
        if (!btn) return;
        els.builderCatSelect.querySelectorAll('.builder-cat').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        builderState.cat = btn.dataset.cat;
        renderBuilderParams();
        // Restart preview with new category
        if (builderAnim) cancelAnimationFrame(builderAnim);
        runBuilderPreview();
    });

    /** Builder color inputs */
    [els.builderColor1, els.builderColor2, els.builderColor3].forEach(function (inp, i) {
        if (inp) inp.addEventListener('input', function () { builderState.colors[i] = inp.value; });
    });

    /** Run the live builder preview canvas */
    function runBuilderPreview() {
        var canvas = els.builderCanvas;
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width;
        var h = canvas.height;
        var bp = builderState;
        var t = 0;

        // Create particles/blobs for the preview
        var entities = [];
        var maxCount = 200;
        for (var i = 0; i < maxCount; i++) {
            entities.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
                r: 2 + Math.random() * 4, phase: Math.random() * Math.PI * 2,
                angle: (i / maxCount) * Math.PI * 2,
                ch: String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
            });
        }

        function draw() {
            t += 0.016;
            var params = bp.params;
            var colors = bp.colors;
            var bgColor = colors[2] || '#0a0a0f';

            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, w, h);

            if (bp.cat === 'particle') {
                var pCount = Math.min(params.count || 80, maxCount);
                for (var i = 0; i < pCount; i++) {
                    var p = entities[i];
                    p.x += p.vx * (params.speed || 1);
                    p.y += p.vy * (params.speed || 1);
                    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, params.size || 3, 0, Math.PI * 2);
                    ctx.fillStyle = colors[0];
                    ctx.globalAlpha = params.glow || 0.6;
                    ctx.fill();
                    ctx.globalAlpha = 1;

                    if (params.connect) {
                        for (var j = i + 1; j < pCount; j++) {
                            var dx = entities[j].x - p.x, dy = entities[j].y - p.y;
                            if (Math.sqrt(dx * dx + dy * dy) < 60) {
                                ctx.beginPath();
                                ctx.moveTo(p.x, p.y);
                                ctx.lineTo(entities[j].x, entities[j].y);
                                ctx.strokeStyle = colors[1] || colors[0];
                                ctx.globalAlpha = 0.15;
                                ctx.stroke();
                                ctx.globalAlpha = 1;
                            }
                        }
                    }
                }
            } else if (bp.cat === 'blob') {
                var bCount = Math.min(params.count || 4, 8);
                ctx.filter = 'blur(' + (params.blur || 40) + 'px)';
                for (var i = 0; i < bCount; i++) {
                    var b = entities[i];
                    var bx = w / 2 + Math.sin(t * (params.speed || 1) + b.phase) * w * 0.3;
                    var by = h / 2 + Math.cos(t * (params.speed || 1) * 0.7 + b.phase) * h * 0.3;
                    var br = 40 + i * 15;
                    var grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
                    grad.addColorStop(0, colors[i % 2]);
                    grad.addColorStop(1, 'transparent');
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.arc(bx, by, br, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
            } else if (bp.cat === 'gradient') {
                ctx.filter = 'blur(30px)';
                for (var i = 0; i < 3; i++) {
                    var angle = t * (params.speed || 0.5) + (i / 3) * Math.PI * 2;
                    var ox = w / 2 + Math.cos(angle) * w * 0.3;
                    var oy = h / 2 + Math.sin(angle) * h * 0.3;
                    var r = Math.min(w, h) * 0.4;
                    var grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
                    grad.addColorStop(0, colors[i % colors.length]);
                    grad.addColorStop(1, 'transparent');
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = (params.glow || 0.5) * 0.8;
                    ctx.fillRect(0, 0, w, h);
                }
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
            } else if (bp.cat === 'wave') {
                var layers = params.layers || 3;
                for (var l = 0; l < layers; l++) {
                    var amp = (params.amplitude || 30) * (0.5 + l * 0.3);
                    var baseY = h * 0.35 + l * (h * 0.12);
                    ctx.beginPath();
                    ctx.moveTo(0, h);
                    for (var x = 0; x <= w; x += 3) {
                        var y = baseY + Math.sin(x * 0.015 + t * (params.speed || 1) + l * 1.5) * amp;
                        ctx.lineTo(x, y);
                    }
                    ctx.lineTo(w, h);
                    ctx.closePath();
                    ctx.fillStyle = colors[l % colors.length];
                    ctx.globalAlpha = 0.25;
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            builderAnim = requestAnimationFrame(draw);
        }
        draw();
    }

    // Navigation
    els.backToAuth.addEventListener('click', function () { goToStep(0); });
    els.toConfig.addEventListener('click', function () { goToStep(2); });
    els.backToStyle.addEventListener('click', function () { goToStep(1); });
    els.toPreview.addEventListener('click', function () { goToStep(3); });
    els.backToConfig.addEventListener('click', function () { goToStep(2); });
    els.toDeploy.addEventListener('click', function () { goToStep(4); });

    /* ─── COLOR PICKERS ─── */
    els.accentColor.addEventListener('input', function () {
        els.accentVal.textContent = els.accentColor.value;
    });
    els.bgColor.addEventListener('input', function () {
        els.bgVal.textContent = els.bgColor.value;
    });

    /* ─── PARTICLE SLIDERS ─── */
    els.particleCount.addEventListener('input', function () {
        els.particleCountVal.textContent = els.particleCount.value;
    });
    els.particleSpeed.addEventListener('input', function () {
        els.particleSpeedVal.textContent = parseFloat(els.particleSpeed.value).toFixed(1);
    });
    els.particleGlow.addEventListener('input', function () {
        els.particleGlowVal.textContent = parseFloat(els.particleGlow.value).toFixed(2);
    });

    /* ─── SECTION TOGGLES ─── */
    els.sectionToggles.addEventListener('change', function (e) {
        if (!e.target.matches('input[data-section]')) return;
        var section = e.target.dataset.section;
        var on = e.target.checked;
        var contentEl = document.querySelector('.content-section[data-for="' + section + '"]');
        if (contentEl) contentEl.style.display = on ? '' : 'none';
    });

    /* ─── AI PANEL ─── */
    els.aiToggle.addEventListener('change', function () {
        els.aiBody.style.display = els.aiToggle.checked ? '' : 'none';
        if (els.aiToggle.checked) refreshAIKeyState();
    });

    function refreshAIKeyState() {
        if (ArbelKeyManager.hasKey()) {
            els.aiKeyInput.value = '';
            els.aiKeyInput.placeholder = ArbelKeyManager.getMaskedKey();
            els.aiKeyRemove.style.display = '';
            els.aiGenerate.style.display = '';
            els.aiKeyStatus.textContent = 'Key saved securely.';
            els.aiKeyStatus.className = 'ai-key-status ai-key-status--ok';
        } else {
            els.aiKeyInput.placeholder = 'Paste your API key...';
            els.aiKeyRemove.style.display = 'none';
            els.aiGenerate.style.display = 'none';
            els.aiKeyStatus.textContent = '';
        }
    }

    els.aiKeyInput.addEventListener('change', function () {
        var key = els.aiKeyInput.value.trim();
        if (!key) return;
        var provider = els.aiProvider.value;
        ArbelKeyManager.saveKey(provider, key);
        els.aiKeyInput.value = '';
        refreshAIKeyState();
    });

    els.aiKeyRemove.addEventListener('click', function () {
        ArbelKeyManager.removeKey();
        refreshAIKeyState();
    });

    els.aiProvider.addEventListener('change', function () {
        // When switching provider, clear the stored key
        ArbelKeyManager.removeKey();
        refreshAIKeyState();
    });

    els.aiGenerateBtn.addEventListener('click', function () {
        var desc = els.aiPrompt.value.trim();
        if (!desc) {
            els.aiStatus.textContent = 'Please describe your business first.';
            els.aiStatus.className = 'ai-status ai-status--error';
            return;
        }

        els.aiGenerateBtn.disabled = true;
        els.aiGenerateBtn.textContent = 'GENERATING...';
        els.aiStatus.textContent = 'Calling AI...';
        els.aiStatus.className = 'ai-status ai-status--info';

        var activeSections = getActiveSections();

        ArbelAI.generateCopy(desc, els.industry.value, els.brandName.value, activeSections)
            .then(function (copy) {
                // Fill content inputs with AI-generated copy
                Object.keys(copy).forEach(function (key) {
                    var input = document.querySelector('.content-input[data-key="' + key + '"]');
                    if (input) {
                        if (input.tagName === 'TEXTAREA') {
                            input.value = copy[key];
                        } else {
                            input.value = copy[key];
                        }
                    }
                });
                els.aiStatus.textContent = 'Content generated! Review and edit above.';
                els.aiStatus.className = 'ai-status ai-status--success';
            })
            .catch(function (err) {
                els.aiStatus.textContent = 'Error: ' + err.message;
                els.aiStatus.className = 'ai-status ai-status--error';
            })
            .finally(function () {
                els.aiGenerateBtn.disabled = false;
                els.aiGenerateBtn.textContent = 'GENERATE ALL COPY';
            });
    });

    /* ─── Build Config Object ─── */
    function getActiveSections() {
        var sections = [];
        $$('[data-section]').forEach(function (cb) {
            if (cb.checked || cb.disabled) sections.push(cb.dataset.section);
        });
        return sections;
    }

    function buildConfig() {
        var content = {};
        $$('.content-input').forEach(function (el) {
            var key = el.dataset.key;
            if (key && el.value.trim()) content[key] = el.value.trim();
        });

        var cfg = {
            brandName: els.brandName.value.trim() || 'My Site',
            tagline: els.tagline.value.trim(),
            style: state.style,
            accent: els.accentColor.value,
            bgColor: els.bgColor.value,
            contactEmail: els.contactEmail.value.trim(),
            industry: els.industry.value,
            sections: getActiveSections(),
            content: content
        };

        // If builder mode was used, override style to use the builder's first category preset
        // and override animation params from builder controls
        if (styleMode === 'builder') {
            var catStyles = { particle: 'constellation', blob: 'morphBlob', gradient: 'meshGrad', wave: 'sineWaves' };
            cfg.style = catStyles[builderState.cat] || 'constellation';
            state.style = cfg.style;
        }

        // Include animation settings for non-shader styles
        var cat = ArbelCompiler.getAnimCategory(cfg.style);
        if (cat !== 'shader') {
            if (styleMode === 'builder') {
                cfg.particles = {
                    count: builderState.params.count || 80,
                    speed: builderState.params.speed || 1,
                    glow: builderState.params.glow || 0.6,
                    interact: true,
                    connect: builderState.params.connect !== false
                };
            } else {
                cfg.particles = {
                    count: parseInt(els.particleCount.value, 10),
                    speed: parseFloat(els.particleSpeed.value),
                    glow: parseFloat(els.particleGlow.value),
                    interact: els.particleInteract.checked,
                    connect: els.particleConnect.checked
                };
            }
        }

        // Store element-level edits from visual editor
        if (state.editorOverrides) {
            cfg.editorOverrides = state.editorOverrides;
        }

        return cfg;
    }

    /* ─── PREVIEW ─── */
    function generatePreview() {
        var config = buildConfig();
        state.compiledFiles = ArbelCompiler.compile(config);
        // Always inject editor overlay so it's ready when user enables edit mode
        var editorScript = ArbelEditor.getOverlayScript();
        ArbelPreview.render(els.previewIframe, state.compiledFiles, editorScript);

        // Initialize editor module
        ArbelEditor.destroy();
        ArbelEditor.init(els.previewIframe, els.editorPanel, function (overrides) {
            state.editorOverrides = overrides;
        });
        if (state.editorOverrides) {
            ArbelEditor.setOverrides(state.editorOverrides);
        }
    }

    // Edit mode toggle
    if (els.editModeBtn) {
        els.editModeBtn.addEventListener('click', function () {
            editorActive = !editorActive;
            els.editModeBtn.classList.toggle('active', editorActive);
            els.editorLayout.classList.toggle('editor-active', editorActive);
        });
    }

    // Device toggle
    $$('.device-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            $$('.device-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            ArbelPreview.setDevice(btn.dataset.device);
        });
    });

    /* ─── DEPLOY ─── */
    function sanitizeRepoName(name) {
        return name.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    function updateDeployUrl() {
        var user = els.deployUsername.textContent;
        var repo = sanitizeRepoName(els.repoName.value || 'my-site');
        els.deployUrl.textContent = user + '.github.io/' + repo;
    }

    els.repoName.addEventListener('input', function () {
        els.repoName.value = sanitizeRepoName(els.repoName.value);
        updateDeployUrl();
    });

    els.deployBtn.addEventListener('click', function () {
        var repoName = sanitizeRepoName(els.repoName.value);
        if (!repoName) {
            showDeployError('Please enter a repository name.');
            return;
        }

        var token = ArbelAuth.getToken();
        if (!token) {
            showDeployError('Not authenticated. Please go back and connect GitHub.');
            return;
        }

        if (!state.compiledFiles) {
            state.compiledFiles = ArbelCompiler.compile(buildConfig());
        }
        // Re-compile with latest editor overrides for deploy
        var deployConfig = buildConfig();
        var latestOverrides = ArbelEditor.getOverrides();
        if (latestOverrides && Object.keys(latestOverrides).length > 0) {
            deployConfig.editorOverrides = latestOverrides;
            state.compiledFiles = ArbelCompiler.compile(deployConfig);
        }

        els.deployBtn.style.display = 'none';
        els.deployProgress.style.display = '';
        els.deployError.style.display = 'none';

        // Deploy progress UI
        var steps = ['ds1', 'ds2', 'ds3', 'ds4'];

        ArbelDeploy.deploy({
            repoName: repoName,
            token: token,
            files: state.compiledFiles,
            description: buildConfig().tagline || 'Built with Arbel Generator',
            onProgress: function (step, total, msg) {
                for (var i = 0; i < steps.length; i++) {
                    var el = $(steps[i]);
                    if (!el) continue;
                    var icon = el.querySelector('.deploy-icon');
                    if (i < step - 1) {
                        icon.innerHTML = '&#10003;';
                        el.classList.add('done');
                    } else if (i === step - 1) {
                        icon.innerHTML = '&#9899;';
                        el.classList.add('active');
                    }
                }
            }
        })
        .then(function (result) {
            // Mark all steps done
            steps.forEach(function (id) {
                var el = $(id);
                if (el) {
                    el.querySelector('.deploy-icon').innerHTML = '&#10003;';
                    el.classList.add('done');
                }
            });

            // Show success
            setTimeout(function () {
                els.deployProgress.style.display = 'none';
                els.deploySuccess.style.display = '';
                els.siteLink.href = result.siteUrl;
                els.repoLink.href = result.repoUrl;
            }, 800);
        })
        .catch(function (err) {
            els.deployProgress.style.display = 'none';
            showDeployError(err.message || 'Deployment failed. Please try again.');
        });
    });

    function showDeployError(msg) {
        els.deployError.style.display = '';
        els.deployErrorMsg.textContent = msg;
        els.deployBtn.style.display = '';
    }

    if (els.retryDeploy) {
        els.retryDeploy.addEventListener('click', function () {
            els.deployError.style.display = 'none';
            els.deployBtn.style.display = '';
            // Reset progress steps
            $$('.deploy-step').forEach(function (el) {
                el.classList.remove('done', 'active');
                el.querySelector('.deploy-icon').innerHTML = '&#9675;';
            });
        });
    }

    /* ─── INIT ─── */
    // Check for existing session
    var existingToken = ArbelAuth.getToken();
    if (existingToken) {
        ArbelAuth.validateToken(existingToken)
            .then(function (user) {
                state.authenticated = true;
                els.genUser.style.display = 'flex';
                els.genUserAvatar.src = user.avatar_url;
                els.genUserName.textContent = user.login;
                els.deployUsername.textContent = user.login;
                showAuthStatus('Connected as ' + user.login, 'success');
            })
            .catch(function () {
                ArbelAuth.logout();
            });
    }

    // Check for existing AI key
    if (ArbelKeyManager.hasKey()) {
        refreshAIKeyState();
    }

    // Pre-fill accent color from selected style
    allStyles = ArbelCompiler.getStyles();
    var defaultMatch = allStyles.find(function (s) { return s.id === state.style; });
    if (defaultMatch) {
        els.accentColor.value = defaultMatch.colors.accent;
        els.accentVal.textContent = defaultMatch.colors.accent;
    }

    // Start at step 0
    goToStep(0);

})();
