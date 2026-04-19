/*!
 * © 2026 Arbel Live Technologies. All rights reserved.
 *
 * This source file is proprietary and confidential. It is part of
 * the Arbel platform (https://arbel.live) and is protected by
 * copyright and international intellectual-property treaties.
 *
 * NO LICENSE is granted to copy, modify, distribute, sublicense,
 * rehost, mirror, fork, sell, or create derivative works of this
 * code, in whole or in part, without prior written permission
 * from Arbel Live Technologies.
 *
 * Reverse engineering, scraping, or automated extraction is
 * expressly prohibited.
 *
 * Unauthorized use will be pursued under applicable copyright,
 * computer-misuse, and unfair-competition laws.
 *
 * Contact: arbeltechnologies@gmail.com
 */
/* ═══════════════════════════════════════════════
   APP — Wizard Controller
   
   Wires together Auth, Compiler, Preview, Deploy,
   and AI modules into the 5-step wizard flow.
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    // Set copyright year
    var yearEl = document.getElementById('copyrightYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* ─── Dev Unlock (for internal testing of locked features) ───
       Activate by visiting: /generator/?unlock=arbel-dev-2026
       Deactivate by visiting: /generator/?unlock=off
       Flag is stored in localStorage so it persists across visits. */
    var DEV_UNLOCK_KEY = 'arbel.devUnlock';
    var DEV_UNLOCK_SECRET = 'arbel-dev-2026'; // change to rotate access
    try {
        var usp = new URLSearchParams(location.search);
        if (usp.has('unlock')) {
            var v = usp.get('unlock');
            if (v === 'off') {
                localStorage.removeItem(DEV_UNLOCK_KEY);
            } else if (v === DEV_UNLOCK_SECRET) {
                localStorage.setItem(DEV_UNLOCK_KEY, '1');
            }
            // Scrub the query param from URL so it isn't shared / logged
            usp.delete('unlock');
            var newQs = usp.toString();
            history.replaceState(null, '', location.pathname + (newQs ? '?' + newQs : '') + location.hash);
        }
        if (localStorage.getItem(DEV_UNLOCK_KEY) === '1') {
            document.body.classList.add('dev-unlocked');
        }
    } catch (e) { /* storage disabled — ignore */ }

    /* ─── Anonymous analytics ping (fire-and-forget) ───
       Sends a single pageview to our Cloudflare Worker which stores
       only: UTC date, country (from CF header), and a hashed daily
       visitor ID (no IPs, no cookies, no PII). Failures are silent. */
    (function pingAnalytics() {
        try {
            if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
            var payload = {
                p: location.pathname,
                r: document.referrer ? new URL(document.referrer).hostname : '',
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
                dev: document.body.classList.contains('dev-unlocked') ? 1 : 0
            };
            fetch('https://arbel-admin.realskullmusic.workers.dev/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true,
                credentials: 'omit'
            }).catch(function () { });
        } catch (e) { }
    })();

    /* ─── State ─── */
    var state = {
        step: 0,
        style: 'obsidian',
        styleMode: 'preset',
        mode: 'classic',
        authenticated: false,
        compiledFiles: null,
        editorOverrides: null,
        cinematicEditorOverrides: null,
        templateContent: null,
        cinematicScenes: null
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
        // SEO
        seoTitle: $('seoTitle'),
        seoDescription: $('seoDescription'),
        seoCanonical: $('seoCanonical'),
        seoOgImage: $('seoOgImage'),
        seoFavicon: $('seoFavicon'),
        seoIndex: $('seoIndex'),
        // Integrations
        intGaId: $('intGaId'),
        intFormEndpoint: $('intFormEndpoint'),
        intCustomHead: $('intCustomHead'),
        navToggle: $('navToggle'),
        editorNavToggle: $('editorNavToggle'),
        navDropdown: $('navDropdown'),
        editorNavEnabled: $('editorNavEnabled'),
        navModeDesktop: $('navModeDesktop'),
        navModeTablet: $('navModeTablet'),
        navModeMobile: $('navModeMobile'),
        backToStyle: $('backToStyle'),
        toPreview: $('toPreview'),
        // AI
        aiToggle: $('aiToggle'),
        aiBody: $('aiBody'),
        aiProvider: $('aiProvider'),
        aiKeyInput: $('aiKeyInput'),
        aiKeyToggle: $('aiKeyToggle'),
        aiKeyRemove: $('aiKeyRemove'),
        aiKeyStatus: $('aiKeyStatus'),
        aiGenerate: $('aiGenerate'),
        aiPrompt: $('aiPrompt'),
        aiGenerateBtn: $('aiGenerateBtn'),
        aiPreviewBtn: $('aiPreviewBtn'),
        aiAutoDesignBtn: $('aiAutoDesignBtn'),
        aiUndoBtn: $('aiUndoBtn'),
        aiStatus: $('aiStatus'),
        // Preview
        previewIframe: $('previewIframe'),
        previewFrame: $('previewFrame'),
        backToConfig: $('backToConfig'),
        toDeploy: $('toDeploy'),
        // Builder
        builderFS: $('builderFS'),
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

    /* ─── Consent Gate ─── */
    (function initConsent() {
        var overlay = $('consentOverlay');
        var agree   = $('consentAgree');
        var accept  = $('consentAccept');
        var remember = $('consentRemember');

        if (!overlay) return;

        // Already consented — hide immediately
        if (localStorage.getItem('arbel-consent') === '1') {
            overlay.style.display = 'none';
            return;
        }

        // Show overlay
        overlay.classList.remove('hidden');

        // Enable/disable accept button based on checkbox
        agree.addEventListener('change', function () {
            accept.disabled = !agree.checked;
        });

        // Accept click
        accept.addEventListener('click', function () {
            if (!agree.checked) return;
            if (remember.checked) {
                localStorage.setItem('arbel-consent', '1');
            }
            overlay.classList.add('hidden');
            setTimeout(function () { overlay.style.display = 'none'; }, 400);
        });
    })();

    /* ─── Step Navigation ─── */
    function goToStep(n) {
        if (n < 0 || n > 4) return;
        if (n > 0 && !state.authenticated) return;
        state.step = n;

        // Hide cinematic editor when leaving step 3
        var cineEd = document.getElementById('cinematicEditor');
        if (cineEd && n !== 3) cineEd.classList.remove('active');

        // Update step visibility
        $$('.gen-step').forEach(function (el) {
            el.classList.toggle('active', parseInt(el.dataset.step) === n);
        });

        // In cinematic mode, hide classic step 3 when going to step 3
        if (n === 3 && state.mode === 'cinematic') {
            var classicStep = document.querySelector('.gen-step[data-step="3"]');
            if (classicStep) classicStep.classList.remove('active');
        }

        // Update progress bar (0-100%)
        els.progressFill.style.width = (n / 4 * 100) + '%';

        // Update step dots
        $$('.step-dot').forEach(function (dot) {
            var s = parseInt(dot.dataset.step);
            dot.classList.toggle('active', s === n);
            dot.classList.toggle('done', s < n);
            if (s === n) dot.setAttribute('aria-current', 'step');
            else dot.removeAttribute('aria-current');
        });

        // Scroll to top
        window.scrollTo(0, 0);

        // Step-specific actions on enter
        if (n === 1) initStylePreviews();
        if (n === 3) {
            if (state.mode === 'cinematic') {
                generateCinematicPreview();
            } else {
                generatePreview();
            }
        }
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
            els.patToggle.setAttribute('aria-expanded', 'true');
        } else {
            body.style.display = 'none';
            arrow.style.transform = '';
            els.patToggle.setAttribute('aria-expanded', 'false');
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
                    var styleId = canvas.dataset.animId || canvas.dataset.shader;
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
        var bc = cfg.baseColor;
        var baseColor = Array.isArray(bc) ? 'rgb(' + bc[0] + ',' + bc[1] + ',' + bc[2] + ')' : (bc || '#646cff');
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
        els.particleConfig.style.display = (cat === 'particle') ? '' : 'none';
    });

    /* ─── Template Apply (from editor sidebar) ─── */
    window.addEventListener('arbel-apply-template', function (e) {
        var d = e.detail;
        if (!d || !d.style) return;

        // 1. Set visual style
        state.style = d.style;
        state.styleMode = 'preset';

        // 2. Set colors
        if (d.accent) {
            els.accentColor.value = d.accent;
            els.accentVal.textContent = d.accent;
        }
        if (d.bg) {
            els.bgColor.value = d.bg;
            els.bgVal.textContent = d.bg;
        }

        // 3. Set industry
        if (d.industry && els.industry) {
            els.industry.value = d.industry;
        }

        // 4. Set sections (check/uncheck toggles)
        if (d.sections && d.sections.length) {
            document.querySelectorAll('[data-section]').forEach(function (cb) {
                if (cb.disabled) return; // hero & contact are locked
                var sec = cb.dataset.section;
                cb.checked = d.sections.indexOf(sec) !== -1;
            });
        }

        // 5. Fill content inputs from template
        if (d.content) {
            state.templateContent = d.content;
            document.querySelectorAll('.content-input').forEach(function (el) {
                var key = el.dataset.key;
                if (key && d.content[key] !== undefined) {
                    el.value = d.content[key];
                }
            });
        }

        // 6. Show/hide particle config
        var animCat = ArbelCompiler.getAnimCategory(state.style);
        els.particleConfig.style.display = (animCat === 'particle') ? '' : 'none';

        // 7. Re-generate preview (only if already on/past preview step)
        if (state.step >= 3) generatePreview();
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
    var sidebarPreview = $('sidebarPreview');
    if (sidebarPreview) sidebarPreview.addEventListener('click', function () { goToStep(3); });
    els.backToConfig.addEventListener('click', function () { goToStep(2); });
    els.toDeploy.addEventListener('click', function () { goToStep(4); });

    // GENERATOR badge in header: if on Publish step, go back to Edit (step 3); else go to latest reachable step
    var genBadge = $('genBadge');
    if (genBadge) {
        var goHome = function () {
            // If on Publish (step 4), step back to Edit; otherwise go to first reachable step
            if (state.step === 4) { goToStep(3); }
            else if (state.step === 0) { return; }
            else { goToStep(state.step - 1); }
        };
        genBadge.addEventListener('click', goHome);
        genBadge.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
        });
    }

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
        if (ArbelKeyManager.hasKey('text')) {
            els.aiKeyInput.value = '';
            els.aiKeyInput.placeholder = ArbelKeyManager.getMaskedKey('text');
            els.aiKeyRemove.style.display = '';
            els.aiGenerate.style.display = '';
            els.aiKeyStatus.textContent = 'Key saved securely.';
            els.aiKeyStatus.className = 'ai-key-status ai-key-status--ok';
        } else {
            els.aiKeyInput.placeholder = 'Paste your API key...';
            els.aiKeyRemove.style.display = 'none';
            els.aiGenerate.style.display = 'none';
            els.aiKeyStatus.textContent = '';
            els.aiKeyStatus.className = 'ai-key-status';
        }
    }

    els.aiKeyInput.addEventListener('change', saveAiKey);
    els.aiKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveAiKey(); }
    });

    // Auto-detect provider from pasted key so the user never has to pick
    els.aiKeyInput.addEventListener('input', function () {
        var detected = (window.ArbelAI && ArbelAI.detectProvider)
            ? ArbelAI.detectProvider(els.aiKeyInput.value)
            : null;
        if (detected && els.aiProvider.value !== detected) {
            els.aiProvider.value = detected;
        }
    });

    function saveAiKey() {
        var key = els.aiKeyInput.value.trim();
        if (!key) return;
        // Final auto-detect on save
        var detected = (window.ArbelAI && ArbelAI.detectProvider) ? ArbelAI.detectProvider(key) : null;
        if (detected) els.aiProvider.value = detected;
        var provider = els.aiProvider.value;
        var ok = ArbelKeyManager.saveKey('text', provider, key);
        if (!ok) {
            els.aiKeyStatus.textContent = 'Key rejected \u2014 check that it\'s at least 8 characters and matches the selected provider.';
            els.aiKeyStatus.className = 'ai-key-status ai-key-status--error';
            return;
        }
        els.aiKeyInput.value = '';
        refreshAIKeyState();
    }

    // Eye toggle: works in two modes
    //  (a) while typing a new key  -> just flip input type between password/text
    //  (b) after a key is saved (input is empty) -> temporarily inject the stored
    //      key into the input so the user can visually verify it, then wipe on HIDE.
    if (els.aiKeyToggle) {
        els.aiKeyToggle.addEventListener('click', function () {
            var saved = ArbelKeyManager.hasKey('text');
            var input = els.aiKeyInput;
            // Currently hidden -> reveal
            if (input.type === 'password') {
                if (!input.value && saved) {
                    // Populate from storage so SHOW actually shows something
                    var real = ArbelKeyManager.getKey('text');
                    if (real) input.value = real;
                }
                input.type = 'text';
                els.aiKeyToggle.textContent = 'HIDE';
            } else {
                // Currently visible -> hide, and if the shown value came from storage, wipe it
                if (saved) input.value = '';
                input.type = 'password';
                els.aiKeyToggle.textContent = 'SHOW';
            }
        });
    }

    els.aiKeyRemove.addEventListener('click', function () {
        ArbelKeyManager.removeKey('text');
        refreshAIKeyState();
    });

    els.aiProvider.addEventListener('change', function () {
        // When switching provider, clear the stored key
        ArbelKeyManager.removeKey('text');
        refreshAIKeyState();
    });

    // Remember the last AI description across refreshes (local to this browser only)
    var AI_PROMPT_STORAGE = 'arbel_ai_last_prompt';
    try {
        var savedPrompt = localStorage.getItem(AI_PROMPT_STORAGE);
        if (savedPrompt && els.aiPrompt && !els.aiPrompt.value) {
            els.aiPrompt.value = savedPrompt;
        }
    } catch (e) { /* localStorage may be disabled */ }
    if (els.aiPrompt) {
        els.aiPrompt.addEventListener('input', function () {
            try { localStorage.setItem(AI_PROMPT_STORAGE, els.aiPrompt.value); } catch (e) { }
        });
        // Prefill from Brand + Industry when the user focuses an empty prompt
        els.aiPrompt.addEventListener('focus', function () {
            if (els.aiPrompt.value.trim()) return;
            var brand = (els.brandName && els.brandName.value.trim()) || '';
            var industry = (els.industry && els.industry.value.trim()) || '';
            if (brand || industry) {
                var seed = brand
                    ? (brand + ' is a ' + (industry || 'business') + ' that...')
                    : ('A ' + industry + ' that...');
                els.aiPrompt.value = seed;
                // Put the cursor at the end so the user can continue typing
                els.aiPrompt.setSelectionRange(seed.length, seed.length);
            }
        });
    }

    if (els.aiPreviewBtn) {
        els.aiPreviewBtn.addEventListener('click', function () {
            // Jump to the Edit/Preview step so the user sees the generated copy applied live
            try { goToStep(3); } catch (e) { }
        });
    }

    // Snapshot used for UNDO — captures the last state before AI writes anything
    var aiLastSnapshot = null;

    function _snapshotForUndo() {
        var snap = { content: {}, sections: {}, colors: null, cat: null, params: null, brand: {} };
        document.querySelectorAll('.content-input').forEach(function (inp) {
            var k = inp.dataset.key;
            if (k) snap.content[k] = inp.value;
        });
        document.querySelectorAll('[data-section]').forEach(function (cb) {
            if (!cb.disabled) snap.sections[cb.dataset.section] = cb.checked;
        });
        if (builderState && builderState.colors) snap.colors = builderState.colors.slice();
        if (builderState) {
            snap.cat = builderState.cat;
            snap.params = Object.assign({}, builderState.params);
        }
        // Brand / SEO fields so Undo fully restores everything
        snap.brand = {
            brandName:       els.brandName       ? els.brandName.value       : '',
            tagline:         els.tagline         ? els.tagline.value         : '',
            industry:        els.industry        ? els.industry.value        : '',
            contactEmail:    els.contactEmail    ? els.contactEmail.value    : '',
            seoTitle:        els.seoTitle        ? els.seoTitle.value        : '',
            seoDescription:  els.seoDescription  ? els.seoDescription.value  : ''
        };
        snap.mode = state.mode;
        snap.style = state.style;
        snap.styleMode = state.styleMode;
        snap.accent = els.accentColor ? els.accentColor.value : null;
        snap.bg = els.bgColor ? els.bgColor.value : null;
        snap.aiDesignTokens = state.aiDesignTokens ? Object.assign({}, state.aiDesignTokens) : null;
        snap.aiSectionTones = state.aiSectionTones ? Object.assign({}, state.aiSectionTones) : null;
        snap.aiSectionAnims = state.aiSectionAnims ? Object.assign({}, state.aiSectionAnims) : null;
        return snap;
    }

    function _restoreSnapshot(snap) {
        if (!snap) return;
        Object.keys(snap.content).forEach(function (k) {
            var input = document.querySelector('.content-input[data-key="' + k + '"]');
            if (input) {
                input.value = snap.content[k];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        Object.keys(snap.sections).forEach(function (s) {
            var cb = document.querySelector('[data-section="' + s + '"]');
            if (cb && !cb.disabled) {
                cb.checked = snap.sections[s];
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        if (snap.colors && builderState) {
            builderState.colors = snap.colors.slice();
            [els.builderColor1, els.builderColor2, els.builderColor3].forEach(function (inp, i) {
                if (inp && snap.colors[i]) inp.value = snap.colors[i];
            });
        }
        if (builderState) {
            if (snap.cat) builderState.cat = snap.cat;
            if (snap.params) builderState.params = Object.assign({}, snap.params);
            if (typeof renderBuilderParams === 'function') try { renderBuilderParams(); } catch (e) { }
        }
        if (snap.brand) {
            if (els.brandName)      els.brandName.value      = snap.brand.brandName || '';
            if (els.tagline)        els.tagline.value        = snap.brand.tagline || '';
            if (els.industry)       els.industry.value       = snap.brand.industry || '';
            if (els.contactEmail)   els.contactEmail.value   = snap.brand.contactEmail || '';
            if (els.seoTitle)       els.seoTitle.value       = snap.brand.seoTitle || '';
            if (els.seoDescription) els.seoDescription.value = snap.brand.seoDescription || '';
        }
        if (snap.mode && (snap.mode === 'classic' || snap.mode === 'cinematic')) {
            state.mode = snap.mode;
            document.querySelectorAll('.mode-card').forEach(function (c) {
                c.classList.toggle('selected', c.dataset.mode === state.mode);
            });
        }
        if (snap.style) state.style = snap.style;
        if (snap.styleMode) { state.styleMode = snap.styleMode; styleMode = snap.styleMode === 'builder' ? 'builder' : 'presets'; }
        if (snap.accent && els.accentColor) { els.accentColor.value = snap.accent; if (els.accentVal) els.accentVal.textContent = snap.accent; }
        if (snap.bg && els.bgColor) { els.bgColor.value = snap.bg; if (els.bgVal) els.bgVal.textContent = snap.bg; }
        state.aiDesignTokens = snap.aiDesignTokens || null;
        state.aiSectionTones = snap.aiSectionTones || null;
        state.aiSectionAnims = snap.aiSectionAnims || null;
        if (typeof renderStyleGrid === 'function') { try { renderStyleGrid('all'); } catch (e) { } }
    }

    function _applyCopy(copy) {
        var filled = 0, firstFilled = null;
        Object.keys(copy).forEach(function (key) {
            var input = document.querySelector('.content-input[data-key="' + key + '"]');
            if (input) {
                input.value = copy[key];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
                if (!firstFilled) firstFilled = input;
            }
        });
        if (firstFilled) {
            try { firstFilled.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
            document.querySelectorAll('.content-input').forEach(function (el) {
                if (el.value) {
                    el.classList.add('ai-filled');
                    setTimeout(function () { el.classList.remove('ai-filled'); }, 2400);
                }
            });
        }
        if (state.mode === 'cinematic' && typeof ArbelCinematicEditor !== 'undefined' && ArbelCinematicEditor.updateContentFromCopy) {
            ArbelCinematicEditor.updateContentFromCopy(copy);
        }
        return filled;
    }

    // Validate that a string is a well-formed hex color — prevents CSS/DOM injection
    // from the AI response since we write these values straight into color inputs.
    function _isHexColor(s) {
        return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.trim());
    }

    // Relative luminance per WCAG (0–1) for a #RRGGBB hex string
    function _luminance(hex) {
        if (!_isHexColor(hex)) return 0.5;
        var h = hex.slice(1);
        var rgb = [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
        rgb = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    // WCAG contrast ratio (1–21) between two hex colors
    function _contrast(a, b) {
        var la = _luminance(a), lb = _luminance(b);
        var hi = Math.max(la, lb), lo = Math.min(la, lb);
        return (hi + 0.05) / (lo + 0.05);
    }

    // Track previous AI run so we can guarantee variety across regens
    var _aiLastPresetId = null;
    var _aiLastDensity = null;
    var _aiLastCorners = null;
    var _aiLastFont = null;

    function _pickRandom(arr, exclude) {
        var pool = arr.filter(function (v) { return v !== exclude; });
        return pool[Math.floor(Math.random() * pool.length)] || arr[0];
    }

    function _applyDesign(design) {
        if (!design || typeof design !== 'object') return;

        // ─── VARIETY GUARANTEE ─── If the AI returns the same preset two
        // runs in a row (LLMs love their favourites), force a different one
        // from the same family so each click feels new.
        if (typeof design.presetId === 'string' && design.presetId === _aiLastPresetId) {
            var allIds = ArbelCompiler.getStyles().map(function (s) { return s.id; });
            design.presetId = _pickRandom(allIds, _aiLastPresetId);
        }
        // If AI didn't supply optional design knobs, randomly inject some
        // so two runs on the same prompt feel distinct even if the AI is lazy.
        var allDensities = ['compact', 'cozy', 'spacious'];
        var allCorners   = ['sharp', 'soft', 'pill'];
        var allFonts     = ['editorial', 'tech', 'humanist', 'display', 'mono'];
        if (!design.density) design.density = _pickRandom(allDensities, _aiLastDensity);
        if (!design.corners) design.corners = _pickRandom(allCorners, _aiLastCorners);
        if (!design.fontPair) design.fontPair = _pickRandom(allFonts, _aiLastFont);

        // Same for sectionTones / sectionAnims — produce a randomized rhythm
        // so every regen reshuffles the visual cadence.
        var sectionIds = ['services','portfolio','about','process','testimonials','pricing','faq','contact'];
        if (!design.sectionTones || typeof design.sectionTones !== 'object') {
            var tones = ['dark', 'light', 'accent', 'dark']; // weighted toward dark
            design.sectionTones = {};
            sectionIds.forEach(function (id, i) {
                design.sectionTones[id] = tones[(i + Math.floor(Math.random() * tones.length)) % tones.length];
            });
        }
        if (!design.sectionAnims || typeof design.sectionAnims !== 'object') {
            var anims = ['fadeUp', 'slideLeft', 'slideRight', 'scale', 'stagger', 'blur'];
            design.sectionAnims = {};
            sectionIds.forEach(function (id) {
                design.sectionAnims[id] = anims[Math.floor(Math.random() * anims.length)];
            });
        }

        // ─── PRESET PATH ─── If the AI picked a named preset, use it.
        // This dramatically increases visual variety because each preset
        // ships curated colors, shaders/particles, and motion.
        var usedPreset = false;
        if (typeof design.presetId === 'string') {
            var knownStyles = ArbelCompiler.getStyles();
            var match = knownStyles.find(function (s) { return s.id === design.presetId; });
            if (match) {
                state.style = match.id;
                state.styleMode = 'preset';
                styleMode = 'presets';
                // Sync accent/bg inputs from the preset (so the rest of the
                // pipeline picks up the curated colors).
                if (els.accentColor) { els.accentColor.value = match.colors.accent; if (els.accentVal) els.accentVal.textContent = match.colors.accent; }
                if (els.bgColor)     { els.bgColor.value     = match.colors.bg;     if (els.bgVal)     els.bgVal.textContent     = match.colors.bg; }
                // Allow AI to tweak accent / bg
                if (_isHexColor(design.accentOverride) && els.accentColor) {
                    els.accentColor.value = design.accentOverride;
                    if (els.accentVal) els.accentVal.textContent = design.accentOverride;
                }
                if (_isHexColor(design.bgOverride) && els.bgColor) {
                    els.bgColor.value = design.bgOverride;
                    if (els.bgVal) els.bgVal.textContent = design.bgOverride;
                }
                // Re-render the style grid so the selected card gets highlighted
                if (typeof renderStyleGrid === 'function') { try { renderStyleGrid('all'); } catch (e) { } }
                usedPreset = true;
            }
        }

        // ─── BUILDER PATH ─── Only used when no preset picked.
        var validCats = ['particle', 'blob', 'gradient', 'wave'];
        if (!usedPreset && design.category && validCats.indexOf(design.category) !== -1 && builderState) {
            builderState.cat = design.category;
            state.styleMode = 'builder';
            styleMode = 'builder';
        }
        // Colors — strictly validate as hex before applying
        if (!usedPreset && Array.isArray(design.colors) && design.colors.length >= 3) {
            var clean = design.colors.slice(0, 3).filter(_isHexColor);
            if (clean.length === 3 && builderState) {
                builderState.colors = clean;
                [els.builderColor1, els.builderColor2, els.builderColor3].forEach(function (inp, i) {
                    if (inp) inp.value = clean[i];
                });
            }
        }
        // Builder params — clamp each to its documented range and ignore anything unknown
        if (design.params && typeof design.params === 'object' && builderState && builderState.params) {
            var P = design.params;
            var clamp = function (n, lo, hi) { n = +n; return (isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null); };
            var next = Object.assign({}, builderState.params);
            if (P.count     != null) { var c = clamp(P.count, 2, 300);   if (c != null) next.count = c; }
            if (P.speed     != null) { var s = clamp(P.speed, 0.2, 3);   if (s != null) next.speed = s; }
            if (P.size      != null) { var sz = clamp(P.size, 1, 8);     if (sz != null) next.size = sz; }
            if (P.glow      != null) { var g = clamp(P.glow, 0, 1);      if (g != null) next.glow = g; }
            if (P.blur      != null) { var b = clamp(P.blur, 10, 80);    if (b != null) next.blur = b; }
            if (P.layers    != null) { var l = clamp(P.layers, 2, 8);    if (l != null) next.layers = Math.round(l); }
            if (P.amplitude != null) { var a = clamp(P.amplitude, 10, 80); if (a != null) next.amplitude = a; }
            if (typeof P.connect === 'boolean') next.connect = P.connect;
            builderState.params = next;
            // Re-render the controls if the user is currently on the Style step
            if (typeof renderBuilderParams === 'function') try { renderBuilderParams(); } catch (e) { }
        }
        // Sections — only allow known section names; never touch disabled/required ones
        var allowedSections = ['services', 'portfolio', 'about', 'process', 'testimonials', 'pricing', 'faq'];
        if (Array.isArray(design.sections)) {
            var wanted = {};
            design.sections.forEach(function (s) {
                if (allowedSections.indexOf(s) !== -1) wanted[s] = true;
            });
            document.querySelectorAll('[data-section]').forEach(function (cb) {
                if (cb.disabled) return;
                if (allowedSections.indexOf(cb.dataset.section) === -1) return;
                cb.checked = !!wanted[cb.dataset.section];
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        // Mode — cinematic isn't production-ready for AI auto-design yet, so
        // lock the AI to classic mode even if it returns otherwise. Users can
        // still switch manually on the Style step.
        if (state.mode !== 'classic') {
            state.mode = 'classic';
            var modeCards = document.querySelectorAll('.mode-card');
            modeCards.forEach(function (c) {
                c.classList.toggle('selected', c.dataset.mode === 'classic');
            });
        }

        // ─── DESIGN TOKENS ─── density / corners / fontPair
        // Translate semantic AI choices into concrete CSS tokens that the
        // compiler already understands (see _buildCSS → cfg.designTokens).
        var densityMap = {
            compact:  { spaceUnit: 6,  baseSize: 15, scale: 1.2 },
            cozy:     { spaceUnit: 8,  baseSize: 16, scale: 1.25 },
            spacious: { spaceUnit: 11, baseSize: 17, scale: 1.333 }
        };
        var cornersMap = { sharp: 2, soft: 10, pill: 24 };
        var fontPairs = {
            editorial: { headingFont: '"Instrument Serif", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            tech:      { headingFont: '"Space Grotesk", -apple-system, sans-serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            humanist:  { headingFont: '"Fraunces", Georgia, serif', bodyFont: '"Work Sans", -apple-system, sans-serif' },
            display:   { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            mono:      { headingFont: '"Space Mono", monospace', bodyFont: '"IBM Plex Mono", monospace' }
        };
        var tokens = {};
        if (design.density && densityMap[design.density]) Object.assign(tokens, densityMap[design.density]);
        if (design.corners && cornersMap[design.corners] != null) tokens.radius = cornersMap[design.corners];
        if (design.fontPair && fontPairs[design.fontPair]) Object.assign(tokens, fontPairs[design.fontPair]);

        // ─── CONTRAST GUARD ─── Figure out the final background and make
        // sure text sits on it readably. If the preset's fg fails WCAG AA
        // against the (possibly overridden) bg, force a safe fg/surface pair
        // derived from the bg's luminance. This stops scenarios like a cream
        // bgOverride + Obsidian's pale-lavender fg producing invisible text.
        var finalBg = (els.bgColor && els.bgColor.value) || '#0a0a0f';
        var presetStyle = ArbelCompiler.getStyles().find(function (s) { return s.id === state.style; });
        var presetFg = presetStyle && presetStyle.colors ? presetStyle.colors.fg : '#f0f0f0';
        if (_isHexColor(finalBg) && _isHexColor(presetFg) && _contrast(presetFg, finalBg) < 4.5) {
            var bgLight = _luminance(finalBg) > 0.5;
            if (bgLight) {
                tokens.text       = '#101014';
                tokens.textMuted  = '#55586a';
                tokens.surface    = '#ffffff';
            } else {
                tokens.text       = '#f4f4f8';
                tokens.textMuted  = '#a8acbb';
                tokens.surface    = '#18181f';
            }
        }

        // ─── SECTION TONES ─── per-section background + text swaps.
        // AI returns { services:"dark"|"light"|"accent", ... } keyed by section id.
        var allowedSectionIds = ['services','portfolio','about','process','testimonials','pricing','faq','contact'];
        var allowedTones = ['dark','light','accent'];
        var sectionTones = null;
        if (design.sectionTones && typeof design.sectionTones === 'object') {
            sectionTones = {};
            Object.keys(design.sectionTones).forEach(function (k) {
                if (allowedSectionIds.indexOf(k) !== -1 && allowedTones.indexOf(design.sectionTones[k]) !== -1) {
                    sectionTones[k] = design.sectionTones[k];
                }
            });
            if (!Object.keys(sectionTones).length) sectionTones = null;
        }

        // ─── SECTION ANIMS ─── per-section entrance animation variant.
        var allowedAnims = ['fade','fadeUp','slideLeft','slideRight','scale','stagger','blur','none'];
        var sectionAnims = null;
        if (design.sectionAnims && typeof design.sectionAnims === 'object') {
            sectionAnims = {};
            Object.keys(design.sectionAnims).forEach(function (k) {
                if (allowedSectionIds.indexOf(k) !== -1 && allowedAnims.indexOf(design.sectionAnims[k]) !== -1) {
                    sectionAnims[k] = design.sectionAnims[k];
                }
            });
            if (!Object.keys(sectionAnims).length) sectionAnims = null;
        }

        state.aiDesignTokens = Object.keys(tokens).length ? tokens : null;
        state.aiSectionTones = sectionTones;
        state.aiSectionAnims = sectionAnims;

        // Remember choices so the next regen picks something different
        _aiLastPresetId = state.style;
        _aiLastDensity  = design.density || _aiLastDensity;
        _aiLastCorners  = design.corners || _aiLastCorners;
        _aiLastFont     = design.fontPair || _aiLastFont;

        // ─── PER-ELEMENT OVERRIDES ─── AI can target specific elements
        // (hero-cta, service-card-1, project-1-tag, faq-item-2 ...) and apply
        // animations, hover effects, colors, radius, etc. Everything is
        // strictly whitelisted — IDs against a regex of known patterns,
        // properties against a known set, values against type/range.
        if (design.elementOverrides && typeof design.elementOverrides === 'object') {
            _applyElementOverrides(design.elementOverrides);
        } else {
            // Even when AI didn't return any, sprinkle a few random hover/anim
            // effects on key elements so each generation has subtle motion variety.
            _applyElementOverrides(_randomElementSprinkle());
        }
    }

    /** Strict whitelist of element IDs the AI is allowed to target.
     *  Anything else is silently dropped. */
    var _ELEMENT_ID_PATTERNS = [
        /^hero-(line[1-3]|sub|cta|content|heading)$/,
        /^services?-heading$/,
        /^service-card-[1-3]$/,
        /^service-[1-3]-(title|desc)$/,
        /^portfolio-heading$/,
        /^portfolio-card-[1-3]$/,
        /^project-[1-3]-(title|tag|desc)$/,
        /^about(-heading|-desc)?$/,
        /^stat-[1-3](-val|-label)?$/,
        /^process-heading$/,
        /^process-card-[1-3]$/,
        /^step-[1-3]-(title|desc)$/,
        /^testimonials-heading$/,
        /^testimonial-card-[1-3]$/,
        /^testimonial-[1-3]-(quote|name|role)$/,
        /^pricing-heading$/,
        /^pricing-card-[1-3]$/,
        /^tier-[1-3]-(name|price|features)$/,
        /^faq-item-[1-3]$/,
        /^faq-[1-3]-(q|a)$/,
        /^contact-heading$/
    ];
    var _VALID_ANIMATIONS = ['fadeIn','fadeInUp','fadeInDown','fadeInLeft','fadeInRight',
        'slideUp','slideDown','slideLeft','slideRight','scaleUp','scaleDown',
        'zoomIn','bounceIn','bounceInUp'];
    var _VALID_HOVERS = ['lift','scale','glow','tilt','skew','border-glow','brightness','color-shift'];
    var _VALID_CONTINUOUS = ['none','pulse','float','spin','bounce','shake','swing','breathe',
        'glow-pulse','wobble','flash','headShake','wave-text','drift','sway'];

    function _isAllowedElementId(id) {
        if (typeof id !== 'string') return false;
        for (var i = 0; i < _ELEMENT_ID_PATTERNS.length; i++) {
            if (_ELEMENT_ID_PATTERNS[i].test(id)) return true;
        }
        return false;
    }

    function _sanitizeOverrideValue(prop, val) {
        if (val == null) return null;
        if (prop === 'animation') return _VALID_ANIMATIONS.indexOf(val) !== -1 ? val : null;
        if (prop === 'hover')     return _VALID_HOVERS.indexOf(val) !== -1 ? val : null;
        if (prop === 'continuous')return _VALID_CONTINUOUS.indexOf(val) !== -1 ? val : null;
        if (prop === 'color' || prop === 'backgroundColor') {
            return _isHexColor(val) ? val : null;
        }
        if (prop === 'borderRadius') {
            // Accept "Npx" or a bare number 0-100
            if (typeof val === 'number') return Math.max(0, Math.min(100, val)) + 'px';
            if (typeof val === 'string' && /^\d{1,3}(px|%)?$/.test(val)) return val;
            return null;
        }
        if (prop === 'opacity') {
            var n = +val;
            return (isFinite(n) && n >= 0 && n <= 1) ? String(n) : null;
        }
        return null;
    }

    function _applyElementOverrides(map) {
        if (!map || typeof map !== 'object') return;
        var ov = state.editorOverrides || {};
        var props = ['animation','hover','continuous','color','backgroundColor','borderRadius','opacity'];
        Object.keys(map).forEach(function (id) {
            if (!_isAllowedElementId(id)) return;
            var entry = map[id];
            if (!entry || typeof entry !== 'object') return;
            if (!ov[id]) ov[id] = {};
            props.forEach(function (p) {
                if (entry[p] != null) {
                    var clean = _sanitizeOverrideValue(p, entry[p]);
                    if (clean != null) ov[id][p] = clean;
                }
            });
        });
        state.editorOverrides = ov;
    }

    /** Generate a tiny random set of safe element overrides (used when the AI
     *  doesn't supply any). Keeps every regen visually distinct. */
    function _randomElementSprinkle() {
        var hovers = ['lift','scale','glow','border-glow'];
        var anims  = ['fadeInUp','slideUp','zoomIn','scaleUp'];
        var conts  = ['float','breathe','sway'];
        var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
        var out = {
            'hero-cta':       { hover: pick(hovers), animation: pick(anims) },
            'service-card-1': { hover: pick(hovers), animation: pick(anims) },
            'service-card-2': { hover: pick(hovers), animation: pick(anims) },
            'service-card-3': { hover: pick(hovers), animation: pick(anims) },
            'portfolio-card-1': { hover: pick(hovers) },
            'portfolio-card-2': { hover: pick(hovers) },
            'portfolio-card-3': { hover: pick(hovers) }
        };
        // 50% chance to add a continuous animation to one stat block
        if (Math.random() > 0.5) out['stat-1'] = { continuous: pick(conts) };
        return out;
    }

    // Strict validators for brand/SEO fields before they touch the DOM
    var _validIndustries = ['agency','saas','ecommerce','restaurant','healthcare','portfolio',
        'fashion','realestate','fitness','education','finance','legal','nonprofit','music',
        'photography','startup','other'];

    function _applyBrand(brand) {
        if (!brand || typeof brand !== 'object') return 0;
        var count = 0;
        // All of these are user-owned text fields — we only write to .value (never innerHTML)
        if (typeof brand.name === 'string' && brand.name.trim() && els.brandName) {
            els.brandName.value = brand.name.trim().slice(0, 40);
            els.brandName.dispatchEvent(new Event('input', { bubbles: true }));
            els.brandName.classList.add('ai-filled');
            setTimeout(function () { els.brandName.classList.remove('ai-filled'); }, 2400);
            // Push the new brand name into cinematic scenes so the live nav-logo updates too
            if (typeof ArbelCinematicEditor !== 'undefined' && ArbelCinematicEditor.syncBrandToScenes) {
                try { ArbelCinematicEditor.syncBrandToScenes(els.brandName.value); } catch (e) { }
            }
            count++;
        }
        if (typeof brand.tagline === 'string' && brand.tagline.trim() && els.tagline) {
            els.tagline.value = brand.tagline.trim().slice(0, 80);
            els.tagline.dispatchEvent(new Event('input', { bubbles: true }));
            els.tagline.classList.add('ai-filled');
            setTimeout(function () { els.tagline.classList.remove('ai-filled'); }, 2400);
            count++;
        }
        if (typeof brand.industry === 'string' && _validIndustries.indexOf(brand.industry) !== -1 && els.industry) {
            els.industry.value = brand.industry;
            els.industry.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
        }
        if (typeof brand.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.email) && els.contactEmail) {
            els.contactEmail.value = brand.email.slice(0, 120);
            els.contactEmail.dispatchEvent(new Event('input', { bubbles: true }));
            els.contactEmail.classList.add('ai-filled');
            setTimeout(function () { els.contactEmail.classList.remove('ai-filled'); }, 2400);
            count++;
        }
        if (typeof brand.seoTitle === 'string' && brand.seoTitle.trim() && els.seoTitle) {
            els.seoTitle.value = brand.seoTitle.trim().slice(0, 70);
            count++;
        }
        if (typeof brand.seoDescription === 'string' && brand.seoDescription.trim() && els.seoDescription) {
            els.seoDescription.value = brand.seoDescription.trim().slice(0, 160);
            count++;
        }
        return count;
    }

    function _showUndo() {
        if (els.aiUndoBtn) els.aiUndoBtn.style.display = '';
    }

    if (els.aiUndoBtn) {
        els.aiUndoBtn.addEventListener('click', function () {
            if (!aiLastSnapshot) return;
            _restoreSnapshot(aiLastSnapshot);
            aiLastSnapshot = null;
            els.aiUndoBtn.style.display = 'none';
            els.aiStatus.textContent = 'Reverted to previous state.';
            els.aiStatus.className = 'ai-status ai-status--info';
        });
    }

    els.aiGenerateBtn.addEventListener('click', function () {
        var desc = els.aiPrompt.value.trim();
        if (!desc) {
            els.aiStatus.textContent = 'Please describe your business first.';
            els.aiStatus.className = 'ai-status ai-status--error';
            return;
        }

        aiLastSnapshot = _snapshotForUndo();
        els.aiGenerateBtn.disabled = true;
        els.aiGenerateBtn.textContent = 'WRITING...';
        els.aiStatus.textContent = 'Calling AI...';
        els.aiStatus.className = 'ai-status ai-status--info';

        var activeSections = getActiveSections();

        ArbelAI.generateCopy(desc, els.industry.value, els.brandName.value, activeSections)
            .then(function (copy) {
                var filled = _applyCopy(copy);
                els.aiStatus.textContent = 'Filled ' + filled + ' fields \u2014 scroll up to review, or click Preview.';
                els.aiStatus.className = 'ai-status ai-status--success';
                _showUndo();
            })
            .catch(function (err) {
                els.aiStatus.textContent = 'Error: ' + err.message;
                els.aiStatus.className = 'ai-status ai-status--error';
            })
            .finally(function () {
                els.aiGenerateBtn.disabled = false;
                els.aiGenerateBtn.textContent = 'COPY ONLY';
            });
    });

    // Full auto-design: AI picks palette + sections + mode + writes all copy in one call
    if (els.aiAutoDesignBtn) {
        els.aiAutoDesignBtn.addEventListener('click', function () {
            var desc = els.aiPrompt.value.trim();
            if (!desc) {
                els.aiStatus.textContent = 'Please describe your business first.';
                els.aiStatus.className = 'ai-status ai-status--error';
                return;
            }

            aiLastSnapshot = _snapshotForUndo();
            els.aiAutoDesignBtn.disabled = true;
            els.aiGenerateBtn.disabled = true;
            var originalLabel = els.aiAutoDesignBtn.innerHTML;
            els.aiAutoDesignBtn.textContent = 'DESIGNING...';
            els.aiStatus.textContent = 'AI is designing your site (brand, palette, sections, copy)...';
            els.aiStatus.className = 'ai-status ai-status--info';

            // Wipe per-element overrides so each fresh design starts clean
            // (snapshot already captured the previous state for Undo)
            state.editorOverrides = {};

            ArbelAI.generateDesign(desc, els.industry.value, els.brandName.value)
                .then(function (result) {
                    var brandCount = _applyBrand(result.brand);
                    _applyDesign(result.design);
                    var filled = _applyCopy(result.copy);
                    var note = result.design && result.design.rationale
                        ? (' \u2014 ' + String(result.design.rationale).slice(0, 120))
                        : '';
                    els.aiStatus.textContent = 'Designed: ' + brandCount + ' brand fields, palette, ' +
                        (Array.isArray(result.design && result.design.sections) ? result.design.sections.length : 0) +
                        ' sections, ' + filled + ' copy fields' + note;
                    els.aiStatus.className = 'ai-status ai-status--success';
                    _showUndo();
                })
                .catch(function (err) {
                    els.aiStatus.textContent = 'Error: ' + err.message;
                    els.aiStatus.className = 'ai-status ai-status--error';
                })
                .finally(function () {
                    els.aiAutoDesignBtn.disabled = false;
                    els.aiGenerateBtn.disabled = false;
                    els.aiAutoDesignBtn.innerHTML = originalLabel;
                });
        });
    }

    /* ─── Build Config Object ─── */
    function getActiveSections() {
        var sections = [];
        $$('[data-section]').forEach(function (cb) {
            if (cb.checked || cb.disabled) sections.push(cb.dataset.section);
        });
        return sections;
    }

    function _isValidUrl(str) {
        if (!str) return true; // empty is fine (optional field)
        if (/^\s*javascript\s*:/i.test(str)) return false;
        // Reject values with unencoded spaces or HTML-unsafe characters
        if (/[\s<>"{}|\\^`]/.test(str)) return false;
        // Block any scheme other than http(s) and data (e.g. mailto:, ftp:, foo:)
        if (/^[a-z][a-z0-9+.-]*:/i.test(str) && !/^(https?:|data:image\/)/i.test(str)) return false;
        // Accept http(s), protocol-relative, root-relative, and standard relative paths
        return /^(https?:\/\/|\/\/|\/|\.\/|\.\.\/)/.test(str) || /^[\w]/.test(str);
    }

    function _collectSeo() {
        var canonical = els.seoCanonical ? els.seoCanonical.value.trim() : '';
        var ogImage   = els.seoOgImage   ? els.seoOgImage.value.trim()   : '';
        var favicon   = els.seoFavicon   ? els.seoFavicon.value.trim()   : '';
        return {
            title: els.seoTitle ? els.seoTitle.value.trim() : '',
            description: els.seoDescription ? els.seoDescription.value.trim() : '',
            canonical: _isValidUrl(canonical) ? canonical : '',
            ogImage:   _isValidUrl(ogImage)   ? ogImage   : '',
            favicon:   _isValidUrl(favicon)   ? favicon   : '',
            index: els.seoIndex ? els.seoIndex.checked : true
        };
    }

    function _collectIntegrations() {
        var ga = els.intGaId ? els.intGaId.value.trim() : '';
        var form = els.intFormEndpoint ? els.intFormEndpoint.value.trim() : '';
        var custom = els.intCustomHead ? els.intCustomHead.value : '';
        // GA ID sanity check: must start with G- / UA- / AW- and be alphanumeric
        if (ga && !/^(G-|UA-|AW-)[A-Z0-9-]{4,20}$/i.test(ga)) ga = '';
        if (form && !_isValidUrl(form)) form = '';
        // Strip obvious script-injection risks from custom head (block inline <script> executing arbitrary JS is desired
        // for user-provided snippets, so we allow it but sanitize null bytes + frame-escape attempts)
        custom = String(custom).replace(/\u0000/g, '').slice(0, 4000);
        return { gaId: ga, formEndpoint: form, customHead: custom };
    }

    function buildConfig() {
        var content = {};
        // Merge template content first (labels, nav, non-input keys)
        if (state.templateContent) {
            Object.keys(state.templateContent).forEach(function (k) {
                content[k] = state.templateContent[k];
            });
        }
        // User input values override template defaults
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
            menuBgColor: window.ArbelEditor && window.ArbelEditor.getMenuBgColor() || '',
            menuBgEnabled: window.ArbelEditor ? window.ArbelEditor.getMenuBgEnabled() : true,
            contactEmail: els.contactEmail.value.trim(),
            industry: els.industry.value,
            navEnabled: els.navToggle ? els.navToggle.checked : true,
            navMode: {
                desktop: els.navModeDesktop ? els.navModeDesktop.value : 'links',
                tablet: els.navModeTablet ? els.navModeTablet.value : 'hamburger',
                mobile: els.navModeMobile ? els.navModeMobile.value : 'hamburger'
            },
            sections: getActiveSections(),
            content: content,
            seo: _collectSeo(),
            integrations: _collectIntegrations()
        };

        // If builder mode was used, override style to use the builder's first category preset
        // and override animation params from builder controls
        if (styleMode === 'builder') {
            var catStyles = { particle: 'constellation', blob: 'morphBlob', gradient: 'meshGrad', wave: 'sineWaves' };
            cfg.style = catStyles[builderState.cat] || 'constellation';
            state.style = cfg.style;
            // Apply builder color pickers
            if (builderState.colors && builderState.colors.length >= 3) {
                cfg.accent = builderState.colors[0];
                cfg.bgColor = builderState.colors[2];
            }
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

        // AI-chosen design tokens (density / corners / typography)
        if (state.aiDesignTokens) {
            cfg.designTokens = Object.assign({}, cfg.designTokens || {}, state.aiDesignTokens);
        }
        if (state.aiSectionTones) cfg.sectionTones = state.aiSectionTones;
        if (state.aiSectionAnims) cfg.sectionAnims = state.aiSectionAnims;

        // Include pages from editor
        var editorPages = ArbelEditor.getPages();
        if (editorPages && editorPages.length > 1) {
            cfg.pages = editorPages;
        }

        // Include video layer config from editor
        var vc = ArbelEditor.getVideoConfig();
        if (vc && vc.config && vc.config.active && vc.frames && vc.frames.length) {
            cfg.videoLayer = {
                preset: vc.config.preset || null,
                fps: vc.config.fps || 24,
                speed: vc.config.speed || 1,
                loop: vc.config.loop || false,
                frames: vc.config.preset ? null : vc.frames
            };
        }

        return cfg;
    }

    /* ─── PREVIEW ─── */
    function generatePreview() {
        var config = buildConfig();
        try {
            state.compiledFiles = ArbelCompiler.compile(config);
        } catch (compileErr) {
            console.error('Arbel compile error:', compileErr);
            return;
        }
        var editorScript = ArbelEditor.getOverlayScript();
        ArbelPreview.render(els.previewIframe, state.compiledFiles, editorScript);

        // Destroy cinematic editor if active (L1: prevent both editors running)
        ArbelCinematicEditor.destroy();

        // Initialize editor in the full-screen builder container
        ArbelEditor.destroy();
        ArbelEditor.init(els.previewIframe, els.builderFS, function (overrides) {
            state.editorOverrides = overrides;
            try { localStorage.setItem('arbel_editor_overrides', JSON.stringify(overrides)); } catch (e) {}
            _markDirty();
        });
        if (state.editorOverrides) {
            ArbelEditor.setOverrides(state.editorOverrides);
        }
        ArbelEditor.setNavMode({
            desktop: els.navModeDesktop ? els.navModeDesktop.value : 'links',
            tablet: els.navModeTablet ? els.navModeTablet.value : 'hamburger',
            mobile: els.navModeMobile ? els.navModeMobile.value : 'hamburger'
        });

        // Set brand name in classic editor toolbar
        var bfsBrand = $('bfsBrand');
        if (bfsBrand) bfsBrand.textContent = els.brandName.value.trim() || 'My Site';
    }

    // Restore overrides from localStorage on load
    (function () {
        try {
            // Try full project restore first
            var projStr = localStorage.getItem('arbel_project');
            if (projStr) {
                var proj = JSON.parse(projStr);
                if (proj && proj.config) {
                    _restoreFullState(proj);
                    return;
                }
            }
            // Fallback: legacy overrides-only
            var saved = localStorage.getItem('arbel_editor_overrides');
            if (saved) state.editorOverrides = JSON.parse(saved);
        } catch (e) {}
    })();

    /** Reload preview iframe without recompiling — re-renders compiled files and restores editor */
    function reloadPreview() {
        if (!state.compiledFiles) return;
        var editorScript = ArbelEditor.getOverlayScript();
        var savedOverrides = ArbelEditor.getOverrides();
        ArbelEditor.destroy();
        ArbelPreview.render(els.previewIframe, state.compiledFiles, editorScript);
        ArbelEditor.init(els.previewIframe, els.builderFS, function (overrides) {
            state.editorOverrides = overrides;
            try { localStorage.setItem('arbel_editor_overrides', JSON.stringify(overrides)); } catch (e) {}
            _markDirty();
        });
        if (savedOverrides) {
            ArbelEditor.setOverrides(savedOverrides);
        }
        ArbelEditor.setNavMode({
            desktop: els.navModeDesktop ? els.navModeDesktop.value : 'links',
            tablet: els.navModeTablet ? els.navModeTablet.value : 'hamburger',
            mobile: els.navModeMobile ? els.navModeMobile.value : 'hamburger'
        });
    }

    // Reload preview button
    var reloadBtn = $('editorReload');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', function () { reloadPreview(); });
    }

    /* ─── DEPLOY ─── */
    function sanitizeRepoName(name) {
        var sanitized = name.toLowerCase().replace(/[^a-z0-9\-_.]/g, '-').replace(/-+/g, '-').replace(/^[-.]|[-.]$/g, '');
        return sanitized.slice(0, 100) || 'my-portfolio';
    }

    function updateDeployUrl() {
        var user = els.deployUsername.textContent;
        var repo = sanitizeRepoName(els.repoName.value || 'my-portfolio');
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
            if (state.mode === 'cinematic') {
                state.compiledFiles = ArbelCinematicCompiler.compile(buildCinematicConfig());
                ArbelCinematicCompiler.extractAssets(state.compiledFiles);
            } else {
                state.compiledFiles = ArbelCompiler.compile(buildConfig());
            }
        }
        // Re-compile with latest editor overrides for deploy
        if (state.mode === 'cinematic') {
            var cineCfg = buildCinematicConfig();
            var cineScenes = ArbelCinematicEditor.getScenes();
            if (cineScenes && cineScenes.length) cineCfg.scenes = cineScenes;
            var cineOvr = ArbelCinematicEditor.getOverrides();
            if (cineOvr && Object.keys(cineOvr).length > 0) cineCfg.editorOverrides = cineOvr;
            state.compiledFiles = ArbelCinematicCompiler.compile(cineCfg);
            ArbelCinematicCompiler.extractAssets(state.compiledFiles);
        } else {
            var deployConfig = buildConfig();
            var latestOverrides = ArbelEditor.getOverrides();
            if (latestOverrides && Object.keys(latestOverrides).length > 0) {
                deployConfig.editorOverrides = latestOverrides;
                state.compiledFiles = ArbelCompiler.compile(deployConfig);
            }
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

                // Populate custom domain guide with actual values
                var cnameEl = document.getElementById('dnsCnameTarget');
                var pathEl = document.getElementById('domainRepoPath');
                var user = els.deployUsername.textContent;
                var repo = sanitizeRepoName(els.repoName.value || 'my-site');
                if (cnameEl) cnameEl.textContent = user + '.github.io';
                if (pathEl) pathEl.textContent = user + '/' + repo;
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

    // Custom domain guide toggle
    var domainToggle = $('customDomainToggle'), domainBody = $('customDomainBody');
    if (domainToggle && domainBody) {
        domainToggle.addEventListener('click', function () {
            var isOpen = domainBody.classList.contains('open');
            domainBody.classList.toggle('open', !isOpen);
            domainToggle.classList.toggle('open', !isOpen);
        });
    }

    /* ═══════════════════════════════════════════
       PROJECT SAVE / OPEN SYSTEM
       ═══════════════════════════════════════════ */

    var _fileHandle = null;       // File System Access API handle (persistent Save target)
    var _projectDirty = false;    // unsaved changes flag
    var _autoSaveTimer = null;
    var _PROJECT_KEY = 'arbel_project';

    /** Collect entire project state into a serializable object */
    function _collectFullState() {
        // Gather content inputs
        var content = {};
        if (state.templateContent) {
            Object.keys(state.templateContent).forEach(function (k) {
                content[k] = state.templateContent[k];
            });
        }
        $$('.content-input').forEach(function (el) {
            var key = el.dataset.key;
            if (key && el.value.trim()) content[key] = el.value.trim();
        });

        // Gather active sections
        var sections = [];
        $$('[data-section]').forEach(function (cb) {
            if (cb.checked || cb.disabled) sections.push(cb.dataset.section);
        });

        // Build project data
        var proj = {
            version: 2,
            meta: {
                name: els.brandName.value.trim() || 'My Site',
                savedAt: new Date().toISOString()
            },
            config: {
                brandName: els.brandName.value.trim() || '',
                tagline: els.tagline.value.trim() || '',
                industry: els.industry.value || '',
                contactEmail: els.contactEmail.value.trim() || '',
                style: state.style,
                styleMode: styleMode,
                mode: state.mode,
                accent: els.accentColor.value,
                bgColor: els.bgColor.value,
                sections: sections,
                navEnabled: els.navToggle ? els.navToggle.checked : true,
                navMode: {
                    desktop: els.navModeDesktop ? els.navModeDesktop.value : 'links',
                    tablet: els.navModeTablet ? els.navModeTablet.value : 'hamburger',
                    mobile: els.navModeMobile ? els.navModeMobile.value : 'hamburger'
                },
                content: content,
                templateContent: state.templateContent || null,
                seo: _collectSeo(),
                integrations: _collectIntegrations(),
                particles: {
                    count: parseInt(els.particleCount.value, 10),
                    speed: parseFloat(els.particleSpeed.value),
                    glow: parseFloat(els.particleGlow.value),
                    interact: els.particleInteract.checked,
                    connect: els.particleConnect.checked
                }
            },
            editor: {
                overrides: (window.ArbelEditor && ArbelEditor.getOverrides()) || state.editorOverrides || {},
                pages: (window.ArbelEditor && ArbelEditor.getPages()) || [],
                videoConfig: (window.ArbelEditor && ArbelEditor.getVideoConfig()) || null,
                addedElements: (window.ArbelEditor && ArbelEditor.getAddedElements()) || [],
                menuBgColor: (window.ArbelEditor && ArbelEditor.getMenuBgColor()) || '',
                menuBgEnabled: (window.ArbelEditor) ? ArbelEditor.getMenuBgEnabled() : true
            }
        };

        // Builder state (if using custom builder)
        if (styleMode === 'builder') {
            proj.config.builderState = {
                cat: builderState.cat,
                params: Object.assign({}, builderState.params),
                colors: builderState.colors.slice()
            };
        }

        return proj;
    }

    /** Restore project state from a saved object */
    function _restoreFullState(proj) {
        if (!proj || !proj.config) return;
        var c = proj.config;
        var ed = proj.editor || {};

        // Config form inputs
        if (c.brandName !== undefined) els.brandName.value = c.brandName;
        if (c.tagline !== undefined) els.tagline.value = c.tagline;
        if (c.industry !== undefined) els.industry.value = c.industry;
        if (c.contactEmail !== undefined) els.contactEmail.value = c.contactEmail;

        // Style
        if (c.style) state.style = c.style;
        if (c.mode) state.mode = c.mode;

        // Mode selector cards
        $$('.mode-card').forEach(function (card) {
            card.classList.toggle('selected', card.dataset.mode === state.mode);
        });

        // Colors
        if (c.accent) { els.accentColor.value = c.accent; els.accentVal.textContent = c.accent; }
        if (c.bgColor) { els.bgColor.value = c.bgColor; els.bgVal.textContent = c.bgColor; }

        // Sections
        if (c.sections && c.sections.length) {
            $$('[data-section]').forEach(function (cb) {
                if (cb.disabled) return; // hero & contact locked
                cb.checked = c.sections.indexOf(cb.dataset.section) !== -1;
                // Toggle content visibility
                var contentEl = document.querySelector('.content-section[data-for="' + cb.dataset.section + '"]');
                if (contentEl) contentEl.style.display = cb.checked ? '' : 'none';
            });
        }

        // Content inputs
        if (c.templateContent) state.templateContent = c.templateContent;
        if (c.content) {
            $$('.content-input').forEach(function (el) {
                var key = el.dataset.key;
                if (key && c.content[key] !== undefined) el.value = c.content[key];
            });
        }

        // SEO
        if (c.seo) {
            if (els.seoTitle && c.seo.title !== undefined) els.seoTitle.value = c.seo.title;
            if (els.seoDescription && c.seo.description !== undefined) els.seoDescription.value = c.seo.description;
            if (els.seoCanonical && c.seo.canonical !== undefined) els.seoCanonical.value = c.seo.canonical;
            if (els.seoOgImage && c.seo.ogImage !== undefined) els.seoOgImage.value = c.seo.ogImage;
            if (els.seoFavicon && c.seo.favicon !== undefined) els.seoFavicon.value = c.seo.favicon;
            if (els.seoIndex && c.seo.index !== undefined) els.seoIndex.checked = c.seo.index;
        }

        // Integrations
        if (c.integrations) {
            if (els.intGaId && c.integrations.gaId !== undefined) els.intGaId.value = c.integrations.gaId;
            if (els.intFormEndpoint && c.integrations.formEndpoint !== undefined) els.intFormEndpoint.value = c.integrations.formEndpoint;
            if (els.intCustomHead && c.integrations.customHead !== undefined) els.intCustomHead.value = c.integrations.customHead;
        }

        // Particles
        if (c.particles) {
            els.particleCount.value = c.particles.count || 80;
            els.particleCountVal.textContent = c.particles.count || 80;
            els.particleSpeed.value = c.particles.speed || 1;
            els.particleSpeedVal.textContent = parseFloat(c.particles.speed || 1).toFixed(1);
            els.particleGlow.value = c.particles.glow || 0.6;
            els.particleGlowVal.textContent = parseFloat(c.particles.glow || 0.6).toFixed(2);
            if (c.particles.interact !== undefined) els.particleInteract.checked = c.particles.interact;
            if (c.particles.connect !== undefined) els.particleConnect.checked = c.particles.connect;
        }

        // Show/hide particle config
        var cat = ArbelCompiler.getAnimCategory(state.style);
        els.particleConfig.style.display = (cat === 'particle') ? '' : 'none';

        // Nav toggle
        if (c.navEnabled !== undefined && els.navToggle) els.navToggle.checked = c.navEnabled;
        if (els.editorNavToggle) els.editorNavToggle.classList.toggle('active', els.navToggle ? els.navToggle.checked : true);
        if (els.editorNavEnabled) els.editorNavEnabled.checked = els.navToggle ? els.navToggle.checked : true;
        // Nav mode per device
        if (c.navMode) {
            if (els.navModeDesktop) els.navModeDesktop.value = c.navMode.desktop || 'links';
            if (els.navModeTablet) els.navModeTablet.value = c.navMode.tablet || 'hamburger';
            if (els.navModeMobile) els.navModeMobile.value = c.navMode.mobile || 'hamburger';
            if (window.ArbelEditor) ArbelEditor.setNavMode(c.navMode);
        }

        // Builder state
        if (c.styleMode === 'builder' && c.builderState) {
            styleMode = 'builder';
            builderState.cat = c.builderState.cat || 'particle';
            if (c.builderState.params) Object.assign(builderState.params, c.builderState.params);
            if (c.builderState.colors) builderState.colors = c.builderState.colors.slice();
        }

        // Editor overrides
        if (ed.overrides && Object.keys(ed.overrides).length) {
            state.editorOverrides = ed.overrides;
            if (window.ArbelEditor) ArbelEditor.setOverrides(ed.overrides);
        }
        if (ed.pages && ed.pages.length) {
            if (window.ArbelEditor && ArbelEditor.setPages) ArbelEditor.setPages(ed.pages);
        }
        if (ed.videoConfig) {
            if (window.ArbelEditor && ArbelEditor.setVideoConfig) ArbelEditor.setVideoConfig(ed.videoConfig);
        }
        if (ed.addedElements && ed.addedElements.length) {
            if (window.ArbelEditor && ArbelEditor.setAddedElements) ArbelEditor.setAddedElements(ed.addedElements);
        }
        if (ed.menuBgColor !== undefined) {
            if (window.ArbelEditor && ArbelEditor.setMenuBgColor) ArbelEditor.setMenuBgColor(ed.menuBgColor);
        }
        if (ed.menuBgEnabled !== undefined) {
            if (window.ArbelEditor && ArbelEditor.setMenuBgEnabled) ArbelEditor.setMenuBgEnabled(ed.menuBgEnabled);
        }

        _projectDirty = false;
        _updateUnsavedIndicator();
    }

    /** Mark project as having unsaved changes */
    function _markDirty() {
        if (!_projectDirty) {
            _projectDirty = true;
            _updateUnsavedIndicator();
        }
        _scheduleAutoSave();
    }

    /** Update the visual unsaved indicator */
    function _updateUnsavedIndicator() {
        var dot = $('unsavedDot');
        if (dot) dot.style.display = _projectDirty ? '' : 'none';
        var bfsBrand = $('bfsBrand');
        if (bfsBrand) {
            var name = els.brandName.value.trim() || 'My Site';
            bfsBrand.textContent = _projectDirty ? name + ' •' : name;
        }
    }

    /** Auto-save to localStorage (debounced) */
    function _scheduleAutoSave() {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(function () {
            try {
                var proj = _collectFullState();
                localStorage.setItem(_PROJECT_KEY, JSON.stringify(proj));
            } catch (e) { /* quota exceeded — ignore */ }
        }, 2000);
    }

    /** Save to current file handle (or trigger Save As) */
    function _saveProject() {
        if (_fileHandle) {
            _writeToHandle(_fileHandle);
        } else {
            _saveProjectAs();
        }
    }

    /** Save As — always prompts for new file location */
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
            _updateUnsavedIndicator();
        }
    }

    /** Write project data to a file handle */
    function _writeToHandle(handle) {
        var proj = _collectFullState();
        var json = JSON.stringify(proj, null, 2);
        return handle.createWritable().then(function (writable) {
            return writable.write(json).then(function () {
                return writable.close();
            });
        }).then(function () {
            _projectDirty = false;
            _updateUnsavedIndicator();
        });
    }

    /** Open project from file */
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
                if (!proj || (!proj.config && !proj.overrides)) throw new Error('Invalid project file');
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
                        if (!proj || (!proj.config && !proj.overrides)) throw new Error('Invalid project file');
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

    /** Handle loading a project (either v1 editor-only or v2 full state) */
    function _loadProjectData(proj) {
        if (proj.version === 1 || (!proj.config && proj.overrides)) {
            // Legacy v1 format — editor overrides only
            state.editorOverrides = proj.overrides || {};
            if (window.ArbelEditor) {
                ArbelEditor.setOverrides(proj.overrides || {});
                if (proj.pages && ArbelEditor.setPages) ArbelEditor.setPages(proj.pages);
                if (proj.videoConfig && ArbelEditor.setVideoConfig) ArbelEditor.setVideoConfig(proj.videoConfig);
                if (proj.addedElements && ArbelEditor.setAddedElements) ArbelEditor.setAddedElements(proj.addedElements);
            }
            _projectDirty = false;
            _updateUnsavedIndicator();
            // Re-generate preview if on step 3
            if (state.step >= 3) generatePreview();
        } else {
            // v2 full project
            _restoreFullState(proj);
            // Re-generate preview if on step 3
            if (state.step >= 3) generatePreview();
        }
    }

    /** Start a brand new project */
    function _newProject() {
        if (_projectDirty) {
            if (!confirm('You have unsaved changes. Start a new project anyway?')) return;
        }
        _fileHandle = null;
        _projectDirty = false;

        // Reset form inputs
        els.brandName.value = '';
        els.tagline.value = '';
        els.industry.value = '';
        els.contactEmail.value = '';

        // Reset colors to default style
        var defaultStyle = allStyles.find(function (s) { return s.id === 'obsidian'; });
        if (defaultStyle) {
            els.accentColor.value = defaultStyle.colors.accent;
            els.accentVal.textContent = defaultStyle.colors.accent;
            els.bgColor.value = defaultStyle.colors.bg;
            els.bgVal.textContent = defaultStyle.colors.bg;
        }

        // Reset style
        state.style = 'obsidian';
        state.styleMode = 'preset';
        state.mode = 'classic';
        state.editorOverrides = null;
        state.templateContent = null;

        // Reset sections to default
        $$('[data-section]').forEach(function (cb) {
            if (!cb.disabled) cb.checked = true;
            var contentEl = document.querySelector('.content-section[data-for="' + cb.dataset.section + '"]');
            if (contentEl) contentEl.style.display = '';
        });

        // Clear content inputs
        $$('.content-input').forEach(function (el) { el.value = ''; });

        // Clear SEO
        if (els.seoTitle) els.seoTitle.value = '';
        if (els.seoDescription) els.seoDescription.value = '';
        if (els.seoCanonical) els.seoCanonical.value = '';
        if (els.seoOgImage) els.seoOgImage.value = '';
        if (els.seoFavicon) els.seoFavicon.value = '';
        if (els.seoIndex) els.seoIndex.checked = true;
        if (els.intGaId) els.intGaId.value = '';
        if (els.intFormEndpoint) els.intFormEndpoint.value = '';
        if (els.intCustomHead) els.intCustomHead.value = '';

        // Reset particles
        els.particleCount.value = 80;
        els.particleCountVal.textContent = '80';
        els.particleSpeed.value = 1;
        els.particleSpeedVal.textContent = '1.0';
        els.particleGlow.value = 0.6;
        els.particleGlowVal.textContent = '0.60';
        els.particleInteract.checked = true;
        els.particleConnect.checked = true;

        // Reset editor
        if (window.ArbelEditor) {
            ArbelEditor.setOverrides({});
            if (ArbelEditor.setPages) ArbelEditor.setPages([]);
            if (ArbelEditor.setAddedElements) ArbelEditor.setAddedElements([]);
        }

        // Clear auto-save
        try { localStorage.removeItem(_PROJECT_KEY); } catch (e) {}

        _updateUnsavedIndicator();
    }

    /* ─── Wire dirty tracking to form inputs ─── */
    // Text inputs
    ['brandName', 'tagline', 'contactEmail', 'seoTitle', 'seoDescription', 'seoCanonical', 'seoOgImage', 'seoFavicon', 'intGaId', 'intFormEndpoint', 'intCustomHead'].forEach(function (id) {
        var el = els[id];
        if (el) el.addEventListener('input', _markDirty);
    });
    // Keep cinematic scene nav-logo in sync with the brand input in real time
    if (els.brandName) {
        els.brandName.addEventListener('input', function () {
            if (typeof ArbelCinematicEditor !== 'undefined' && ArbelCinematicEditor.syncBrandToScenes) {
                try { ArbelCinematicEditor.syncBrandToScenes(els.brandName.value); } catch (e) { }
            }
        });
    }
    // Selects
    if (els.industry) els.industry.addEventListener('change', _markDirty);
    // Color pickers
    els.accentColor.addEventListener('input', _markDirty);
    els.bgColor.addEventListener('input', _markDirty);
    // Checkboxes
    if (els.seoIndex) els.seoIndex.addEventListener('change', _markDirty);
    if (els.navToggle) els.navToggle.addEventListener('change', function () {
        _markDirty();
        // Sync builder toolbar button + dropdown state
        var isOn = els.navToggle.checked;
        if (els.editorNavToggle) els.editorNavToggle.classList.toggle('active', isOn);
        if (els.editorNavEnabled) els.editorNavEnabled.checked = isOn;
        if (state.step >= 3) generatePreview();
    });
    // Builder toolbar nav toggle — opens dropdown
    if (els.editorNavToggle) els.editorNavToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (els.navDropdown) {
            var vis = els.navDropdown.style.display !== 'none';
            if (vis) {
                els.navDropdown.style.display = 'none';
            } else {
                // Position fixed dropdown below the toggle button
                var btnRect = els.editorNavToggle.getBoundingClientRect();
                els.navDropdown.style.top = (btnRect.bottom + 6) + 'px';
                els.navDropdown.style.left = (btnRect.left + btnRect.width / 2) + 'px';
                els.navDropdown.style.transform = 'translateX(-50%)';
                els.navDropdown.style.display = '';
            }
        }
    });
    // Close dropdown on outside click
    document.addEventListener('click', function (e) {
        if (els.navDropdown && els.navDropdown.style.display !== 'none') {
            if (!e.target.closest('.bfs-nav-wrap')) els.navDropdown.style.display = 'none';
        }
    });
    // Nav enable/disable toggle inside dropdown
    if (els.editorNavEnabled) els.editorNavEnabled.addEventListener('change', function () {
        if (els.navToggle) els.navToggle.checked = this.checked;
        if (els.editorNavToggle) els.editorNavToggle.classList.toggle('active', this.checked);
        _markDirty();
        if (state.step >= 3) generatePreview();
    });
    // Nav mode selectors
    function _onNavModeChange() {
        _markDirty();
        if (window.ArbelEditor) {
            ArbelEditor.setNavMode({
                desktop: els.navModeDesktop ? els.navModeDesktop.value : 'links',
                tablet: els.navModeTablet ? els.navModeTablet.value : 'hamburger',
                mobile: els.navModeMobile ? els.navModeMobile.value : 'hamburger'
            });
        }
        if (state.step >= 3) generatePreview();
    }
    if (els.navModeDesktop) els.navModeDesktop.addEventListener('change', _onNavModeChange);
    if (els.navModeTablet) els.navModeTablet.addEventListener('change', _onNavModeChange);
    if (els.navModeMobile) els.navModeMobile.addEventListener('change', _onNavModeChange);
    els.particleConnect.addEventListener('change', _markDirty);
    els.particleInteract.addEventListener('change', _markDirty);
    // Ranges
    els.particleCount.addEventListener('input', _markDirty);
    els.particleSpeed.addEventListener('input', _markDirty);
    els.particleGlow.addEventListener('input', _markDirty);
    // Section toggles
    els.sectionToggles.addEventListener('change', _markDirty);
    // Content inputs (delegated)
    if (els.contentEditor) els.contentEditor.addEventListener('input', function (e) {
        if (e.target.classList.contains('content-input')) _markDirty();
    });

    /* ─── Keyboard Shortcuts ─── */
    document.addEventListener('keydown', function (e) {
        var isCtrl = e.ctrlKey || e.metaKey;
        if (!isCtrl) return;

        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            if (e.shiftKey) {
                _saveProjectAs();
            } else {
                _saveProject();
            }
        } else if (e.key === 'o' || e.key === 'O') {
            if (!e.shiftKey) {
                e.preventDefault();
                _openProject();
            }
        } else if (e.key === 'n' || e.key === 'N') {
            if (!e.shiftKey) {
                e.preventDefault();
                _newProject();
            }
        }
    });

    /* ─── Wire file menu buttons ─── */
    var _fileNewBtn = $('fileNew');
    var _fileOpenBtn = $('fileOpen');
    var _fileSaveBtn = $('fileSave');
    var _fileSaveAsBtn = $('fileSaveAs');
    if (_fileNewBtn) _fileNewBtn.addEventListener('click', _newProject);
    if (_fileOpenBtn) _fileOpenBtn.addEventListener('click', _openProject);
    if (_fileSaveBtn) _fileSaveBtn.addEventListener('click', _saveProject);
    if (_fileSaveAsBtn) _fileSaveAsBtn.addEventListener('click', _saveProjectAs);

    /* ─── Warn on unsaved changes ─── */
    window.addEventListener('beforeunload', function (e) {
        if (_projectDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /* ─── INIT ─── */
    // Check for existing session
    var existingToken = ArbelAuth.getToken();
    if (existingToken) {
        ArbelAuth.validateToken(existingToken)
            .then(function (result) {
                if (!result.valid || !result.user) return;
                state.authenticated = true;
                els.genUser.style.display = 'flex';
                els.genUserAvatar.src = result.user.avatar;
                els.genUserName.textContent = result.user.login;
                els.deployUsername.textContent = result.user.login;
                showAuthStatus('Connected as ' + result.user.login, 'success');
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

    /* ═══════════════════════════════════════════
       CINEMATIC MODE — Wiring
       ═══════════════════════════════════════════ */

    /* Mode selector cards */
    var modeCards = $$('.mode-card');
    modeCards.forEach(function (card) {
        card.addEventListener('click', function () {
            // Gate locked modes unless dev-unlocked
            if (card.classList.contains('locked') && !document.body.classList.contains('dev-unlocked')) {
                _showLockedToast();
                return;
            }
            state.mode = card.dataset.mode;
            modeCards.forEach(function (c) { c.classList.toggle('selected', c.dataset.mode === state.mode); });
        });
    });

    function _showLockedToast() {
        var existing = document.getElementById('arbelLockedToast');
        if (existing) { existing.remove(); }
        var t = document.createElement('div');
        t.id = 'arbelLockedToast';
        t.textContent = 'Cinematic mode is coming soon \u2014 stay tuned.';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 20px;border-radius:8px;border:1px solid rgba(255,180,60,0.4);font-family:monospace;font-size:13px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.5)';
        document.body.appendChild(t);
        setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 2600);
    }

    /* Cinematic step handling — when going to step 3 in cinematic mode,
       show the cinematic editor instead of the classic builder */
    var cinematicEditor = $('cinematicEditor');

    function generateCinematicPreview() {
        var cfg = buildCinematicConfig();
        state.compiledFiles = ArbelCinematicCompiler.compile(cfg);

        // Show cinematic editor layout
        if (cinematicEditor) cinematicEditor.classList.add('active');

        // Hide classic step 3
        var classicPreview = $('stepPreview');
        if (classicPreview) classicPreview.classList.remove('active');

        // Render preview in cinematic iframe (with editor overlay)
        var cneIframe = $('cnePreviewIframe');
        if (cneIframe) {
            var cneOverlay = ArbelCinematicEditor.getOverlayScript();
            ArbelPreview.render(cneIframe, state.compiledFiles, cneOverlay);
        }

        // Set brand name in toolbar
        var cneBrand = $('cneBrand');
        if (cneBrand) cneBrand.textContent = els.brandName.value.trim() || 'My Site';

        // Init cinematic editor (destroy classic editor first — L1)
        ArbelEditor.destroy();
        var savedTokens = ArbelCinematicEditor.getDesignTokens ? ArbelCinematicEditor.getDesignTokens() : null;
        ArbelCinematicEditor.destroy();
        ArbelCinematicEditor.init(cneIframe, cinematicEditor, function (data) {
            state.cinematicScenes = data.scenes;
            state.cinematicEditorOverrides = data.overrides;
            if (data.rerender) {
                clearTimeout(state._cneRerenderTimer);
                state._cneRerenderTimer = setTimeout(function () {
                    var cfg = buildCinematicConfig();
                    state.compiledFiles = ArbelCinematicCompiler.compile(cfg);
                    var overlay = ArbelCinematicEditor.getOverlayScript();
                    ArbelPreview.render(cneIframe, state.compiledFiles, overlay);
                }, 500);
            }
        });
        if (savedTokens) ArbelCinematicEditor.setDesignTokens(savedTokens);
    }

    function buildCinematicConfig() {
        // P2: Assemble content the same way buildConfig() does
        var content = {};
        if (state.templateContent) {
            Object.keys(state.templateContent).forEach(function (k) {
                content[k] = state.templateContent[k];
            });
        }
        document.querySelectorAll('.content-input').forEach(function (el) {
            var key = el.dataset.key;
            if (key && el.value.trim()) content[key] = el.value.trim();
        });

        var cfg = {
            brandName: els.brandName.value.trim() || 'My Site',
            tagline: els.tagline.value.trim(),
            style: state.style,
            accent: els.accentColor.value,
            bgColor: els.bgColor.value,
            industry: els.industry.value,
            contactEmail: els.contactEmail.value.trim(),
            content: content,
            scenes: state.cinematicScenes || undefined,
            nav: { logo: els.brandName.value.trim() || 'My Site', links: [] },
            seo: _collectSeo()
        };

        // P1: Include particle config for non-shader styles
        var _animCat = typeof ArbelCompiler !== 'undefined' ? ArbelCompiler.getAnimCategory(cfg.style) : 'particle';
        if (_animCat !== 'shader') {
            cfg.particles = {
                count: parseInt(els.particleCount.value, 10) || 80,
                speed: parseFloat(els.particleSpeed.value) || 1,
                glow: parseFloat(els.particleGlow.value) || 0.6,
                interact: els.particleInteract ? els.particleInteract.checked : true,
                connect: els.particleConnect ? els.particleConnect.checked : true
            };
        }

        if (state.cinematicEditorOverrides) {
            cfg.editorOverrides = state.cinematicEditorOverrides;
        }

        // Include design tokens from cinematic editor
        if (typeof ArbelCinematicEditor !== 'undefined' && ArbelCinematicEditor.getDesignTokens) {
            cfg.designTokens = ArbelCinematicEditor.getDesignTokens();
        }

        return cfg;
    }

    /* Cinematic back button */
    var cneBackBtn = $('cneBackBtn');
    if (cneBackBtn) {
        cneBackBtn.addEventListener('click', function () {
            if (cinematicEditor) cinematicEditor.classList.remove('active');
            goToStep(1);
        });
    }

    /* Cinematic deploy button */
    var cneDeploy = $('cneDeploy');
    if (cneDeploy) {
        cneDeploy.addEventListener('click', function () {
            // Refresh compiled files with latest scene data
            var cfg = buildCinematicConfig();
            var scenes = ArbelCinematicEditor.getScenes();
            if (scenes && scenes.length) cfg.scenes = scenes;
            var overrides = ArbelCinematicEditor.getOverrides();
            if (overrides && Object.keys(overrides).length > 0) cfg.editorOverrides = overrides;
            state.compiledFiles = ArbelCinematicCompiler.compile(cfg);
            ArbelCinematicCompiler.extractAssets(state.compiledFiles);

            // Hide cinematic editor, show deploy step
            if (cinematicEditor) cinematicEditor.classList.remove('active');
            goToStep(4);
        });
    }

    /* Cinematic AI generate button */
    var cneAIBtn = $('cneAIBtn');
    if (cneAIBtn) {
        cneAIBtn.addEventListener('click', function () {
            ArbelCinematicEditor.showAIDialog();
        });
    }

    /* Cinematic preview button (full-page scroll preview) */
    var cnePreviewBtn = $('cnePreviewBtn');
    if (cnePreviewBtn) {
        cnePreviewBtn.addEventListener('click', function () {
            var cfg = buildCinematicConfig();
            var scenes = ArbelCinematicEditor.getScenes();
            if (scenes && scenes.length) cfg.scenes = scenes;
            state.compiledFiles = ArbelCinematicCompiler.compile(cfg);
            var cneIframe = $('cnePreviewIframe');
            if (cneIframe) {
                var cneOverlay = ArbelCinematicEditor.getOverlayScript();
                ArbelPreview.render(cneIframe, state.compiledFiles, cneOverlay);
            }
        });
    }

    /* When navigating back from deploy to step 3 in cinematic mode */

})();
