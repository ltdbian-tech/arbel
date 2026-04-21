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
        // Design Options (classic-mode manual overrides for AI axes)
        optHeroLayout: $('optHeroLayout'),
        optHeroArt: $('optHeroArt'),
        optHeroEyebrow: $('optHeroEyebrow'),
        optTypeScale: $('optTypeScale'),
        optHeadingAlign: $('optHeadingAlign'),
        optContainerWidth: $('optContainerWidth'),
        optFontPair: $('optFontPair'),
        optCardTreatment: $('optCardTreatment'),
        optButtonStyle: $('optButtonStyle'),
        optNavStyle: $('optNavStyle'),
        optFooterStyle: $('optFooterStyle'),
        optSectionRhythm: $('optSectionRhythm'),
        optDividerStyle: $('optDividerStyle'),
        optLabelStyle: $('optLabelStyle'),
        optServicesLayout: $('optServicesLayout'),
        optPortfolioLayout: $('optPortfolioLayout'),
        optAboutFlip: $('optAboutFlip'),
        optToneOfVoice: $('optToneOfVoice'),
        optLogoStyle: $('optLogoStyle'),
        optCursorStyle: $('optCursorStyle'),
        optPricingAccent: $('optPricingAccent'),
        // Advanced Design (JSON) editor — designer-facing manual control over
        // every complex axis the AI can set (sectionTones, elementOverrides,
        // pages, navExtra, footerRecipe, etc.).
        advDesignJson: $('advDesignJson'),
        advDesignApplyBtn: $('advDesignApplyBtn'),
        advDesignResetBtn: $('advDesignResetBtn'),
        advDesignFormatBtn: $('advDesignFormatBtn'),
        advDesignStatus: $('advDesignStatus'),
        advDesignDetails: $('advDesignDetails'),
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
        aiRedesignBtn: $('aiRedesignBtn'),
        aiUndoBtn: $('aiUndoBtn'),
        aiStatus: $('aiStatus'),
        // Randomizer
        randomizeBtn: $('randomizeBtn'),
        randomizeUseAI: $('randomizeUseAI'),
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

    /* ─── Self-Audit Banner Wiring ─── */
    (function initAuditBanner() {
        var banner = $('auditBanner');
        var summary = $('auditSummary');
        var list = $('auditList');
        var iconEl = $('auditIcon');
        var labelEl = $('auditLabel');
        if (!banner || !summary) return;

        summary.addEventListener('click', function () {
            var open = banner.getAttribute('data-open') === 'true';
            banner.setAttribute('data-open', open ? 'false' : 'true');
            summary.setAttribute('aria-expanded', open ? 'false' : 'true');
            list.hidden = open;
        });

        window.addEventListener('arbel:audit', function (e) {
            var r = e.detail || {};
            if (r.error) { banner.hidden = true; return; }
            banner.hidden = false;
            banner.classList.remove('audit-ok', 'audit-warn', 'audit-error');
            var fixedSuffix = r.fixed ? ' (auto-fixed ' + r.fixed + ')' : '';
            if (r.ok) {
                banner.classList.add('audit-ok');
                iconEl.textContent = '\u2713';
                labelEl.textContent = 'Audit: all clean';
            } else if (r.errors > 0) {
                banner.classList.add('audit-error');
                iconEl.textContent = '!';
                labelEl.textContent = 'Audit: ' + r.errors + ' error' + (r.errors > 1 ? 's' : '') +
                    (r.warnings ? ', ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') : '') + fixedSuffix;
            } else {
                banner.classList.add('audit-warn');
                iconEl.textContent = '!';
                labelEl.textContent = 'Audit: ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') + fixedSuffix;
            }
            // Populate list
            list.innerHTML = '';
            (r.issues || []).forEach(function (issue) {
                var row = document.createElement('div');
                row.className = 'audit-item';
                if (issue.fixed) row.classList.add('fixed-it');
                if (issue.targetId) row.classList.add('jumpable');
                row.innerHTML = '<span class="audit-item-level ' + issue.level + '">' +
                    (issue.fixed ? 'fixed' : issue.level) + '</span>' +
                    '<span class="audit-item-msg"></span>' +
                    (issue.targetId ? '<span class="audit-fixed-chip" style="background:transparent;color:var(--accent,#6C5CE7);border:1px solid rgba(108,92,231,0.3)">jump \u2192</span>' : '');
                row.querySelector('.audit-item-msg').textContent = issue.msg;
                if (issue.targetId) {
                    row.addEventListener('click', function () {
                        if (window.ArbelPreview && ArbelPreview.jumpToAudit) {
                            ArbelPreview.jumpToAudit(issue.targetId);
                        }
                    });
                }
                list.appendChild(row);
            });
        });
    })();

    /* ─── Page change → refresh preview iframe ─── */
    (function initPageSwitch() {
        // When the user clicks a page in the Pages tab, re-render the iframe
        // with that page's compiled HTML. We do not recompile (faster) and
        // keep any editor overrides intact.
        window.addEventListener('arbel:pageChange', function () {
            if (!state.compiledFiles) return;
            try { reloadPreview(); } catch (e) { /* ignore */ }
        });
        // When a page's sections/name/path/seo are edited in the Pages tab
        // dialog, recompile so the preview shows the new structure.
        window.addEventListener('arbel:pagesUpdated', function () {
            try {
                if (typeof generatePreview === 'function') generatePreview();
                _markDirty && _markDirty();
            } catch (e) { /* ignore */ }
        });
    })();

    /* ─── Per-Section Regen Buttons ─── */
    (function initSectionRegen() {
        // Decorate each .content-section[data-for] header with a "regen" button.
        // Safe: only touches the CONTENT editor sidebar, never the live iframe or editor overlay.
        document.querySelectorAll('.content-section[data-for]').forEach(function (sec) {
            var sid = sec.getAttribute('data-for');
            if (!sid) return;
            var title = sec.querySelector('.content-section-title, h4');
            if (!title || title.querySelector('.section-regen-btn')) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'section-regen-btn';
            btn.title = 'Regenerate this section with AI';
            btn.setAttribute('data-section', sid);
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg><span>Regen</span>';
            title.appendChild(btn);
        });

        // Click handler — delegated once
        document.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.section-regen-btn');
            if (!btn) return;
            e.preventDefault();
            var sid = btn.getAttribute('data-section');
            if (!sid || btn.classList.contains('loading')) return;

            if (!window.ArbelAI || !ArbelAI.generateSectionCopy) {
                _setStatus && _setStatus('AI not available', 'error');
                return;
            }

            var desc     = (els.description && els.description.value) || '';
            var industry = (els.industry && els.industry.value) || '';
            var brand    = (els.brandName && els.brandName.value) || '';

            if (!desc.trim()) {
                alert('Add a business description on Step 1 first — AI needs context to regen.');
                return;
            }

            btn.classList.add('loading');
            var origHTML = btn.innerHTML;
            btn.innerHTML = '<span>…</span>';

            ArbelAI.generateSectionCopy(sid, desc, industry, brand)
                .then(function (partial) {
                    if (!partial || typeof partial !== 'object') throw new Error('Empty response');
                    var filled = _applyCopy(partial);
                    if (typeof _markDirty === 'function') try { _markDirty(); } catch (e) {}
                    btn.classList.remove('loading');
                    btn.innerHTML = origHTML;
                    // Flash success
                    btn.classList.add('ok');
                    setTimeout(function () { btn.classList.remove('ok'); }, 1200);
                })
                .catch(function (err) {
                    btn.classList.remove('loading');
                    btn.innerHTML = origHTML;
                    btn.classList.add('err');
                    setTimeout(function () { btn.classList.remove('err'); }, 1800);
                    console.warn('[arbel] section regen failed:', err);
                    alert('Section regen failed: ' + (err && err.message || err));
                });
        });
    })();

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
        snap.aiHeroLayout   = state.aiHeroLayout || null;
        snap.aiSectionOrder = state.aiSectionOrder ? state.aiSectionOrder.slice() : null;
        snap.aiSectionCounts = state.aiSectionCounts ? Object.assign({}, state.aiSectionCounts) : null;
        snap.aiSectionLayouts = state.aiSectionLayouts ? Object.assign({}, state.aiSectionLayouts) : null;
        snap.aiAboutFlip    = typeof state.aiAboutFlip === 'boolean' ? state.aiAboutFlip : null;
        snap.aiPricingAccent = state.aiPricingAccent || null;
        snap.aiHeadingAlign = state.aiHeadingAlign || null;
        snap.aiContainerWidth = state.aiContainerWidth || null;
        snap.aiCardTreatment = state.aiCardTreatment || null;
        snap.aiNavStyle = state.aiNavStyle || null;
        snap.aiSectionRhythm = state.aiSectionRhythm || null;
        snap.aiHeroEyebrow = state.aiHeroEyebrow || null;
        snap.aiButtonStyle = state.aiButtonStyle || null;
        snap.aiTypeScale = state.aiTypeScale || null;
        snap.aiDividerStyle = state.aiDividerStyle || null;
        snap.aiFooterStyle = state.aiFooterStyle || null;
        snap.aiLabelStyle = state.aiLabelStyle || null;
        snap.aiHeroArt = state.aiHeroArt || null;
        snap.editorOverrides = state.editorOverrides ? JSON.parse(JSON.stringify(state.editorOverrides)) : null;
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
        state.aiHeroLayout   = snap.aiHeroLayout || null;
        state.aiSectionOrder = snap.aiSectionOrder || null;
        state.aiSectionCounts = snap.aiSectionCounts || null;
        state.aiSectionLayouts = snap.aiSectionLayouts || null;
        state.aiAboutFlip    = typeof snap.aiAboutFlip === 'boolean' ? snap.aiAboutFlip : null;
        state.aiPricingAccent = snap.aiPricingAccent || null;
        state.aiHeadingAlign = snap.aiHeadingAlign || null;
        state.aiContainerWidth = snap.aiContainerWidth || null;
        state.aiCardTreatment = snap.aiCardTreatment || null;
        state.aiNavStyle = snap.aiNavStyle || null;
        state.aiSectionRhythm = snap.aiSectionRhythm || null;
        state.aiHeroEyebrow = snap.aiHeroEyebrow || null;
        state.aiButtonStyle = snap.aiButtonStyle || null;
        state.aiTypeScale = snap.aiTypeScale || null;
        state.aiDividerStyle = snap.aiDividerStyle || null;
        state.aiFooterStyle = snap.aiFooterStyle || null;
        state.aiLabelStyle = snap.aiLabelStyle || null;
        state.aiHeroArt = snap.aiHeroArt || null;
        state.editorOverrides = snap.editorOverrides || null;
        if (typeof renderStyleGrid === 'function') { try { renderStyleGrid('all'); } catch (e) { } }
    }

    function _applyCopy(copy, replace) {
        var filled = 0, firstFilled = null;
        // On a full fresh generation (replace=true), wipe every content input first
        // so stale values from a previous topic can't bleed through into keys the
        // new AI response didn't happen to emit (e.g. grocery category chips left
        // over when regenerating a CPU-company site).
        if (replace) {
            document.querySelectorAll('.content-input').forEach(function (el) {
                if (el.value) {
                    el.value = '';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
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
    var _aiLastHeroLayout = null;

    function _pickRandom(arr, exclude) {
        var pool = arr.filter(function (v) { return v !== exclude; });
        return pool[Math.floor(Math.random() * pool.length)] || arr[0];
    }

    function _applyDesign(design) {
        if (!design || typeof design !== 'object') return;

        // ─── AXIS LOCKS ─── If user ticked lock boxes, strip those axes from
        // the AI's response so the current values survive this regen.
        var locked = {};
        document.querySelectorAll('.ai-lock').forEach(function (el) {
            if (el.checked && el.dataset.lock) locked[el.dataset.lock] = true;
        });
        if (locked.preset)       { delete design.presetId; delete design.category; delete design.colors; delete design.params; }
        if (locked.colors)       { delete design.accentOverride; delete design.bgOverride; if (design.colors) delete design.colors; }
        if (locked.fontPair)     delete design.fontPair;
        if (locked.sectionOrder) { delete design.sectionOrder; delete design.sectionCounts; delete design.sectionLayouts; }
        if (locked.heroLayout)   delete design.heroLayout;
        if (locked.cardTreatment) delete design.cardTreatment;
        if (locked.density)      delete design.density;
        if (locked.corners)      delete design.corners;
        // toneOfVoice lock: forcibly pin via ArbelAI.setTone (no design-level key)
        if (locked.toneOfVoice && window.ArbelAI && ArbelAI.setTone && els.optToneOfVoice) {
            ArbelAI.setTone(els.optToneOfVoice.value || '');
        }
        // When colors are locked, preserve the current preset-derived palette:
        // _applyPreset would overwrite els.accentColor/els.bgColor. Snapshot now,
        // restore after preset application below.
        var lockedAccent = locked.colors ? els.accentColor.value : null;
        var lockedBg     = locked.colors ? els.bgColor.value     : null;
        var lockedStyle  = locked.preset ? state.style            : null;

        // ─── SITE-TYPE PROFILE BIAS ─── Resolve siteType early so we can
        // nudge random axes toward the profile's personality when the AI
        // (or user) didn't pin a value. A gaming profile will bias preset
        // toward neon/matrix/plasma + tech fonts + sharp corners + neon
        // palette; a restaurant profile will bias toward warm blob presets
        // + serif fonts + soft corners + warm palette. Axis locks always
        // beat profile bias.
        var _stType = window.ArbelSiteType ? ArbelSiteType.infer(
            (state.aiLastDesc || (els.aiPrompt && els.aiPrompt.value) || (els.description && els.description.value) || ''),
            (els.industry && els.industry.value) || ''
        ) : 'generic';
        state.aiSiteType = _stType;
        var _stProf = window.ArbelSiteType ? ArbelSiteType.profile(_stType) : null;
        var _stPick = window.ArbelSiteType ? ArbelSiteType.pickFrom : function (a) { return Array.isArray(a) && a.length ? a[Math.floor(Math.random() * a.length)] : undefined; };

        // ─── WITHIN-CATEGORY VARIETY ─── Pick one of N pre-bundled design
        // variants for this type. Each variant is a coherent package
        // (preset + palette + font + corners + cards + typeScale + buttons +
        // nav + logo) so that, within the same category, two randomize
        // clicks can produce radically different-looking sites
        // (walmart-like vs amazon-like vs boutique, etc.). Axis locks and
        // explicit AI overrides still win. We rotate variants with an
        // anti-repeat pointer so consecutive randomizes never match.
        var _stVar = window.ArbelSiteType && typeof ArbelSiteType.variant === 'function'
            ? ArbelSiteType.variant(_stType) : null;
        if (_stVar) {
            // Anti-repeat: reroll once if same as last
            if (state._lastVariantId && _stVar.id === state._lastVariantId) {
                var _stVar2 = ArbelSiteType.variant(_stType);
                if (_stVar2 && _stVar2.id !== state._lastVariantId) _stVar = _stVar2;
            }
            state._lastVariantId = _stVar.id;
            state.aiVariantId = _stVar.id;

            // Apply variant overrides (each axis only if not locked + not AI-supplied)
            if (!locked.preset && !design.presetId && _stVar.presetId) design.presetId = _stVar.presetId;
            if (!locked.colors && !design.accentOverride && !design.bgOverride && Array.isArray(_stVar.palette) && _stVar.palette.length >= 2) {
                design.accentOverride = _stVar.palette[0];
                design.bgOverride     = _stVar.palette[1];
            }
            if (!locked.fontPair && !design.fontPair && _stVar.font) design.fontPair = _stVar.font;
            if (!locked.corners  && !design.corners  && _stVar.corners) design.corners = _stVar.corners;
            if (!locked.cardTreatment && !design.cardTreatment && _stVar.cardTreatment) design.cardTreatment = _stVar.cardTreatment;
            var _varAxes = ['typeScale','buttonStyle','navStyle','logoStyle'];
            _varAxes.forEach(function (k) {
                if (!design[k] && _stVar[k]) design[k] = _stVar[k];
            });
        }

        if (_stProf) {
            // Preset pool — if AI didn't choose one (or we're randomizing),
            // pick from the profile's preferred preset IDs.
            if (!locked.preset && !design.presetId && !design.category && _stProf.presetIds) {
                var _pp = _stPick(_stProf.presetIds);
                if (_pp) design.presetId = _pp;
            }
            // Palette — if AI didn't override colors, seed with a profile
            // palette pair on ~60% of runs so the type actually reads visually.
            if (!locked.colors && !design.accentOverride && !design.bgOverride && _stProf.palettes && Math.random() < 0.6) {
                var pair = _stPick(_stProf.palettes);
                if (Array.isArray(pair) && pair.length >= 2) {
                    design.accentOverride = pair[0];
                    design.bgOverride = pair[1];
                }
            }
            // Font — bias toward profile font pool when AI was silent.
            if (!locked.fontPair && !design.fontPair && _stProf.fonts) {
                design.fontPair = _stPick(_stProf.fonts);
            }
            // Corners — bias toward profile corner pool.
            if (!locked.corners && !design.corners && _stProf.corners) {
                design.corners = _stPick(_stProf.corners);
            }
            // Card treatment — bias per profile.
            if (!locked.cardTreatment && !design.cardTreatment && _stProf.cardTreatment) {
                design.cardTreatment = _stPick(_stProf.cardTreatment);
            }
            // Other structural axes — only bias when the AI was silent and
            // the axis isn't locked. These rarely conflict so we set them
            // optimistically.
            var _stAxes = ['navStyle','heroLayout','heroArt','buttonStyle','typeScale','labelStyle','dividerStyle','logoStyle','cursorStyle','headingAlign','containerWidth'];
            _stAxes.forEach(function (k) {
                if (!design[k] && _stProf[k]) {
                    var v = _stPick(_stProf[k]);
                    if (v !== undefined) design[k] = v;
                }
            });
        }

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
        var allFonts     = ['editorial', 'tech', 'humanist', 'display', 'mono', 'luxe', 'brutalist', 'terminal', 'futurist', 'soft', 'classical', 'modern', 'boutique', 'journal', 'retail', 'chef', 'arena', 'vinyl', 'runway', 'streetwear', 'athletic', 'magazine'];
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
            // Per-site-type motion profiles — keep the rhythm on-brand
            // instead of fully random. Fashion floats slowly, gaming snaps,
            // shops pop, portfolios blur-in, restaurants drift.
            var motionByType = {
                gaming:      ['slideLeft', 'slideRight', 'stagger', 'scale'],
                esports:     ['slideLeft', 'slideRight', 'stagger', 'scale'],
                shop:        ['fadeUp', 'stagger', 'scale', 'fadeUp'],
                fashion:     ['fade', 'fadeUp', 'blur', 'fade'],
                restaurant:  ['fade', 'fadeUp', 'fade'],
                music:       ['slideLeft', 'scale', 'stagger', 'slideRight'],
                podcast:     ['fadeUp', 'stagger', 'fade'],
                portfolio:   ['blur', 'fadeUp', 'fade'],
                photography: ['fade', 'blur', 'fadeUp'],
                event:       ['slideLeft', 'scale', 'stagger'],
                saas:        ['fadeUp', 'slideLeft', 'stagger'],
                app:         ['fadeUp', 'slideLeft', 'stagger'],
                blog:        ['fadeUp', 'fade', 'blur']
            };
            var anims = motionByType[state.aiSiteType] || ['fadeUp', 'slideLeft', 'slideRight', 'scale', 'stagger', 'blur'];
            design.sectionAnims = {};
            sectionIds.forEach(function (id) {
                design.sectionAnims[id] = anims[Math.floor(Math.random() * anims.length)];
            });
        }

        // ─── STRUCTURAL VARIATION ─── random hero layout + shuffled section order
        // so each regen changes the page architecture, not just the colors.
        var layouts = ['centered', 'left', 'split', 'minimal', 'name-lockup', 'product-feature', 'dish-photo', 'search-first'];
        if (['centered','left','split','minimal','name-lockup','product-feature','dish-photo','search-first'].indexOf(design.heroLayout) === -1) {
            design.heroLayout = layouts[Math.floor(Math.random() * layouts.length)];
        }
        // Force anti-repeat: if AI picked the same hero layout as last run, rotate.
        if (_aiLastHeroLayout && design.heroLayout === _aiLastHeroLayout) {
            var others = layouts.filter(function (l) { return l !== _aiLastHeroLayout; });
            design.heroLayout = others[Math.floor(Math.random() * others.length)];
        }
        // Valid section IDs in the compiler. Hero must stay first, contact last.
        var validSections = ['services','portfolio','about','process','testimonials','pricing','faq','stats','statsStrip','logoCloud','ctaBanner','team',
            // Type-native sections (Week-1 cut)
            'productGrid','categoryChips','dealBanner','agentRoster','cinematicReel','gameModes','statWall','raceTimeline','menuSections','lookbookHorizontal','releaseGrid'];

        // ─── SITE-TYPE AWARE SECTION PICKING ─── siteType was resolved
        // at the top of this function; reuse it here to pick a matching
        // section recipe when the AI didn't supply one.
        var siteType = state.aiSiteType || 'generic';

        // ─── TYPE DENYLIST + REQUIRED CORE ───
        // Per-type "generic agency" sections that should NOT appear on
        // type-native sites, plus a minimum set of signature sections the
        // final sectionOrder MUST contain so the result actually looks
        // like a gaming/shop/restaurant/etc page regardless of what the
        // AI suggested.
        var TYPE_DENY = {
            gaming:      ['services','pricing','portfolio','process','faq','team'],
            shop:        ['services','process','about'],
            ecommerce:   ['services','process','about'],
            restaurant:  ['services','portfolio','process','pricing','faq'],
            portfolio:   ['services','pricing','faq'],
            photography: ['services','pricing','faq','process'],
            fashion:     ['services','pricing','portfolio','process','faq'],
            music:       ['services','pricing','portfolio','process','faq'],
            podcast:     ['services','pricing','portfolio','process','faq'],
            event:       ['services','process','faq'],
            blog:        ['services','pricing','process']
        };
        var TYPE_CORE = {
            gaming:      ['cinematicReel','agentRoster','gameModes'],
            shop:        ['productGrid','categoryChips'],
            ecommerce:   ['productGrid','categoryChips'],
            restaurant:  ['menuSections'],
            portfolio:   ['statWall','raceTimeline'],
            fashion:     ['lookbookHorizontal'],
            music:       ['releaseGrid'],
            podcast:     ['releaseGrid']
        };
        var deny = TYPE_DENY[siteType] || [];
        var core = TYPE_CORE[siteType] || [];

        if (!Array.isArray(design.sectionOrder) || !design.sectionOrder.length) {
            // Recipe-driven random pick — see ArbelSiteType.recipe()
            var recipe = window.ArbelSiteType ? ArbelSiteType.recipe(siteType) : null;
            if (recipe) {
                design.sectionOrder = recipe;
            } else {
                // Fallback: old random shuffle
                var shuffled = validSections.slice().sort(function () { return Math.random() - 0.5; });
                var n = 3 + Math.floor(Math.random() * 3);
                design.sectionOrder = ['hero'].concat(shuffled.slice(0, n)).concat(['contact']);
            }
        } else {
            // Sanitize AI-supplied order; filter denylist for this type
            var clean = ['hero'];
            design.sectionOrder.forEach(function (s) {
                if (typeof s === 'string'
                    && validSections.indexOf(s) !== -1
                    && deny.indexOf(s) === -1
                    && clean.indexOf(s) === -1) {
                    clean.push(s);
                }
            });
            // Force-inject any missing required core sections (after hero, before contact)
            core.forEach(function (s) {
                if (clean.indexOf(s) === -1) clean.push(s);
            });
            // ─── MINIMUM-SECTIONS GUARD ─── prevent "2-page" outputs when
            // the AI hands us a laconic list (e.g. just hero+contact or
            // hero+portfolio). Pad up to at least 5 total using type-recipe
            // picks, then generic fallbacks, skipping anything on the deny
            // list. This is the difference between a hollow placeholder and
            // a believable full site.
            var MIN_SECTIONS = 5;
            if (clean.length < MIN_SECTIONS) {
                var padPool = [];
                var recipePool = window.ArbelSiteType ? (ArbelSiteType.recipe(siteType) || []) : [];
                recipePool.forEach(function (s) {
                    if (typeof s === 'string' && s !== 'hero' && s !== 'contact'
                        && validSections.indexOf(s) !== -1
                        && deny.indexOf(s) === -1
                        && clean.indexOf(s) === -1
                        && padPool.indexOf(s) === -1) padPool.push(s);
                });
                // Generic fallbacks after recipe-specific ones
                ['services','about','portfolio','testimonials','process','stats','faq','ctaBanner'].forEach(function (s) {
                    if (validSections.indexOf(s) !== -1
                        && deny.indexOf(s) === -1
                        && clean.indexOf(s) === -1
                        && padPool.indexOf(s) === -1) padPool.push(s);
                });
                while (clean.length < MIN_SECTIONS && padPool.length) {
                    clean.push(padPool.shift());
                }
            }
            clean.push('contact');
            design.sectionOrder = clean;
        }

        // ─── CARD COUNTS ─── randomize how many cards render per section
        // (compiler clamps to populated copy slots).
        var countRanges = { services: [2,4], portfolio: [2,4], process: [3,4] };
        if (!design.sectionCounts || typeof design.sectionCounts !== 'object') design.sectionCounts = {};
        Object.keys(countRanges).forEach(function (k) {
            var v = parseInt(design.sectionCounts[k], 10);
            var r = countRanges[k];
            if (isNaN(v) || v < r[0] || v > r[1]) {
                design.sectionCounts[k] = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1));
            }
        });

        // ─── MICRO-STRUCTURAL FLIPS ─── about column flip + pricing accent tier
        if (typeof design.aboutFlip !== 'boolean') design.aboutFlip = Math.random() < 0.5;
        var pa = parseInt(design.pricingAccent, 10);
        if (isNaN(pa) || pa < 1 || pa > 3) design.pricingAccent = 1 + Math.floor(Math.random() * 3);

        // ─── PAGE-WIDE RHYTHM ─── heading alignment + container width
        var aligns = ['left', 'center', 'right'];
        if (aligns.indexOf(design.headingAlign) === -1) {
            // weight toward left (safe default) but allow center/right
            var pool = ['left', 'left', 'center', 'right'];
            design.headingAlign = pool[Math.floor(Math.random() * pool.length)];
        }
        var widths = ['narrow', 'normal', 'wide'];
        if (widths.indexOf(design.containerWidth) === -1) {
            design.containerWidth = widths[Math.floor(Math.random() * widths.length)];
        }

        // ─── CARD TREATMENT ─── completely reskins every card in the page.
        // 11 options — six legacy + five new designer shapes (neon/gradient/
        // outline-accent/brutalist/split) for richer variation.
        var treatments = ['default', 'bordered', 'filled', 'floating', 'minimal', 'glass',
            'neon', 'gradient', 'outline-accent', 'brutalist', 'split'];
        if (treatments.indexOf(design.cardTreatment) === -1) {
            design.cardTreatment = treatments[Math.floor(Math.random() * treatments.length)];
        }

        // ─── NAV STYLE ─── pill / minimal / ghost / default + new variants
        var navStyles = ['default', 'pill', 'minimal', 'ghost', 'floating', 'bordered'];
        if (navStyles.indexOf(design.navStyle) === -1) {
            design.navStyle = navStyles[Math.floor(Math.random() * navStyles.length)];
        }

        // ─── SECTION RHYTHM ─── padding cadence between sections
        var rhythms = ['normal', 'compact', 'roomy', 'alternating'];
        if (rhythms.indexOf(design.sectionRhythm) === -1) {
            design.sectionRhythm = rhythms[Math.floor(Math.random() * rhythms.length)];
        }

        // ─── HERO EYEBROW ─── 40% chance of a small badge above the heading
        if (typeof design.heroEyebrow !== 'string') {
            if (Math.random() < 0.4) {
                var bn = (els.brandName && els.brandName.value) || 'STUDIO';
                var ind = (els.industry && els.industry.value) || 'WEB';
                var eyebrowPool = [
                    'EST. ' + (new Date().getFullYear() - Math.floor(Math.random() * 15)),
                    'NEW \u00b7 ' + new Date().getFullYear(),
                    'INTRODUCING',
                    'v' + (new Date().getFullYear()),
                    '// ' + bn.toUpperCase().slice(0, 16),
                    ind.toUpperCase().slice(0, 12) + ' STUDIO',
                    'LIMITED SERIES',
                    'AWARD \u00b7 2025'
                ];
                design.heroEyebrow = eyebrowPool[Math.floor(Math.random() * eyebrowPool.length)];
            } else {
                design.heroEyebrow = '';
            }
        }

        // ─── BUTTON STYLE ─── 10 options now (6 legacy + 4 new: pill, glow,
        // underline, ghost). Each maps to a `.btn-<name>` body class.
        var btnStyles = ['default', 'solid', 'outline', 'gradient', 'sharp', 'lifted',
            'pill', 'glow', 'underline', 'ghost'];
        if (btnStyles.indexOf(design.buttonStyle) === -1) {
            design.buttonStyle = btnStyles[Math.floor(Math.random() * btnStyles.length)];
        }

        // ─── TYPE SCALE ─── tight / normal / dramatic — drastically changes heading sizes
        var typeScales = ['tight', 'normal', 'dramatic'];
        if (typeScales.indexOf(design.typeScale) === -1) {
            // lean slightly toward normal so variety isn't jarring
            var tsPool = ['tight', 'normal', 'normal', 'dramatic'];
            design.typeScale = tsPool[Math.floor(Math.random() * tsPool.length)];
        }

        // ─── DIVIDER STYLE ─── visual separator between sections
        var divs = ['none', 'line', 'gradient', 'numbered', 'dotline'];
        if (divs.indexOf(design.dividerStyle) === -1) {
            design.dividerStyle = divs[Math.floor(Math.random() * divs.length)];
        }

        // ─── FOOTER STYLE ─── how the page signs off
        var footers = ['default', 'minimal', 'columns', 'centered', 'bigLogo', 'stripe'];
        if (footers.indexOf(design.footerStyle) === -1) {
            design.footerStyle = footers[Math.floor(Math.random() * footers.length)];
        }

        // ─── SECTION LABEL STYLE ─── prefix/adornment on every section mono
        // label. Three new: tag (pill chip), arrow (→), bracket ([]).
        var labels = ['default', 'bar', 'dot', 'number', 'stripe', 'tag', 'arrow', 'bracket'];
        if (labels.indexOf(design.labelStyle) === -1) {
            design.labelStyle = labels[Math.floor(Math.random() * labels.length)];
        }

        // ─── HERO ART ─── decorative overlay — 15 options, all rendered by
        // the compiler's `.heroart-<name>` CSS (blob, wave, triangle, zigzag,
        // arc, rings, stripes, scribble, checker in addition to the basics).
        var arts = ['none', 'grid', 'lines', 'circle', 'dots', 'cross',
            'blob', 'wave', 'triangle', 'zigzag', 'arc', 'rings', 'stripes', 'scribble', 'checker'];
        if (arts.indexOf(design.heroArt) === -1) {
            design.heroArt = arts[Math.floor(Math.random() * arts.length)];
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
            editorial:  { headingFont: '"Instrument Serif", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            tech:       { headingFont: '"Space Grotesk", -apple-system, sans-serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            humanist:   { headingFont: '"Fraunces", Georgia, serif', bodyFont: '"Work Sans", -apple-system, sans-serif' },
            display:    { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            mono:       { headingFont: '"Space Mono", monospace', bodyFont: '"IBM Plex Mono", monospace' },
            // Added pairings — extended catalogue
            luxe:       { headingFont: '"DM Serif Display", Georgia, serif', bodyFont: '"DM Sans", -apple-system, sans-serif' },
            brutalist:  { headingFont: '"Archivo Black", Impact, sans-serif', bodyFont: '"Archivo", -apple-system, sans-serif' },
            terminal:   { headingFont: '"JetBrains Mono", monospace', bodyFont: '"JetBrains Mono", monospace' },
            futurist:   { headingFont: '"Syne", -apple-system, sans-serif', bodyFont: '"Manrope", -apple-system, sans-serif' },
            soft:       { headingFont: '"Bricolage Grotesque", -apple-system, sans-serif', bodyFont: '"Manrope", -apple-system, sans-serif' },
            classical:  { headingFont: '"Crimson Pro", Georgia, serif', bodyFont: '"Lora", Georgia, serif' },
            modern:     { headingFont: '"Plus Jakarta Sans", -apple-system, sans-serif', bodyFont: '"Plus Jakarta Sans", -apple-system, sans-serif' },
            boutique:   { headingFont: '"Cormorant Garamond", Georgia, serif', bodyFont: '"Raleway", -apple-system, sans-serif' },
            journal:    { headingFont: '"Libre Baskerville", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            // Category-distinctive pairs
            retail:     { headingFont: '"Fraunces", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            chef:       { headingFont: '"Cormorant Garamond", Georgia, serif', bodyFont: '"Work Sans", -apple-system, sans-serif' },
            arena:      { headingFont: '"Syne", -apple-system, sans-serif', bodyFont: '"JetBrains Mono", monospace' },
            vinyl:      { headingFont: '"Archivo Black", Impact, sans-serif', bodyFont: '"Space Mono", monospace' },
            runway:     { headingFont: '"DM Serif Display", Georgia, serif', bodyFont: '"Jost", -apple-system, sans-serif' },
            streetwear: { headingFont: '"Archivo", -apple-system, sans-serif', bodyFont: '"Space Grotesk", -apple-system, sans-serif' },
            athletic:   { headingFont: '"Bebas Neue","Archivo Black",sans-serif', bodyFont: '"Inter", -apple-system, sans-serif' },
            magazine:   { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Lora", Georgia, serif' }
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
        state.aiHeroLayout   = design.heroLayout;
        state.aiSectionOrder = design.sectionOrder;
        state.aiSectionCounts = design.sectionCounts;
        // Validate sectionLayouts — only allow known section IDs + known layout values
        if (design.sectionLayouts && typeof design.sectionLayouts === 'object') {
            var validSec = { services: 1, portfolio: 1 };
            var validLay = { list: 1, alternating: 1, bento: 1, numbered: 1, grid: 1 };
            var sl = {};
            Object.keys(design.sectionLayouts).forEach(function (k) {
                if (validSec[k] && validLay[design.sectionLayouts[k]]) sl[k] = design.sectionLayouts[k];
            });
            state.aiSectionLayouts = Object.keys(sl).length ? sl : null;
        }
        state.aiAboutFlip    = design.aboutFlip;
        state.aiPricingAccent = design.pricingAccent;
        state.aiHeadingAlign  = design.headingAlign;
        state.aiContainerWidth = design.containerWidth;
        state.aiCardTreatment = design.cardTreatment;
        state.aiNavStyle      = design.navStyle;
        state.aiSectionRhythm = design.sectionRhythm;
        state.aiHeroEyebrow   = design.heroEyebrow;
        state.aiButtonStyle   = design.buttonStyle;
        state.aiTypeScale     = design.typeScale;
        state.aiDividerStyle  = design.dividerStyle;
        state.aiFooterStyle   = design.footerStyle;
        state.aiLabelStyle    = design.labelStyle;
        state.aiHeroArt       = design.heroArt;
        state.aiLogoStyle     = design.logoStyle;
        state.aiCursorStyle   = design.cursorStyle;
        // New category-aware axes — pages + per-type chrome overrides.
        state.aiPages         = Array.isArray(design.pages) ? design.pages : null;
        state.aiNavExtra      = (design.navExtra && typeof design.navExtra === 'object') ? design.navExtra : null;
        state.aiNavExtraDisabled = design.navExtraDisabled === true;
        state.aiFooterRecipe  = (design.footerRecipe && typeof design.footerRecipe === 'object') ? design.footerRecipe : null;

        // Apply AI-proposed pages to the Pages-tab editor so the designer
        // can see/edit them. AI payload entries look like
        //   { id, name, path, sections, seoTitle?, seoDesc? }
        // We merge with the existing editor _pages[] — keep the user's
        // home page intact, accept new non-home pages the AI invented.
        if (state.aiPages && window.ArbelEditor && typeof ArbelEditor.setPages === 'function') {
            try {
                var existing = ArbelEditor.getPages() || [];
                var home = existing.find(function (p) { return p.isHome; }) ||
                    { id: 'home', name: 'Home', path: '/', isHome: true, showInNav: false };
                var cleaned = [home];
                var seenPaths = { '/': 1, '': 1 };
                state.aiPages.forEach(function (p) {
                    if (!p || typeof p !== 'object') return;
                    if (p.isHome) return; // home handled
                    var name = (typeof p.name === 'string' && p.name.trim()) ? p.name.trim().slice(0, 40) : null;
                    if (!name) return;
                    var path = (typeof p.path === 'string' && p.path.trim()) ? p.path.trim() : '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    if (!path.match(/^\//)) path = '/' + path;
                    var norm = path.replace(/^\//, '').replace(/\/$/, '');
                    if (seenPaths[norm]) return;
                    seenPaths[norm] = 1;
                    var id = (typeof p.id === 'string' && p.id) ? p.id : 'page-ai-' + Math.random().toString(36).slice(2, 8);
                    var entry = {
                        id: id,
                        name: name,
                        path: path,
                        isHome: false,
                        showInNav: p.showInNav !== false, // default true — AI pages are meant to be navigable
                        _pathCustomized: true
                    };
                    if (typeof p.seoTitle === 'string' && p.seoTitle.trim()) entry.seoTitle = p.seoTitle.trim().slice(0, 80);
                    if (typeof p.seoDesc === 'string' && p.seoDesc.trim()) entry.seoDesc = p.seoDesc.trim().slice(0, 200);
                    if (Array.isArray(p.sections)) entry.sections = p.sections.slice(0, 12);
                    cleaned.push(entry);
                });
                ArbelEditor.setPages(cleaned);
            } catch (err) { console.warn('AI pages merge failed:', err); }
        }

        // ─── UI SYNC ─── reflect everything the AI picked in the Style-panel
        // controls so the user can SEE what was chosen and tweak it by hand.
        // Without this, effects like `cursorStyle: "spotlight"` appear in the
        // preview with no matching dropdown state — and the user can't turn
        // them off manually.
        // Suppress the per-control "refresh preview" listener while we batch
        // 18+ updates here; the AI flow rebuilds the preview itself once.
        state._suppressDesignOptRefresh = true;
        var _syncSel = function (el, v) {
            if (!el || v == null) return;
            // Only assign if the option exists; otherwise leave the user's prior pick alone.
            if (typeof v === 'string' && el.tagName === 'SELECT') {
                for (var i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === v) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
                }
            } else if (typeof v === 'string') {
                el.value = v;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        _syncSel(els.optHeroLayout,      design.heroLayout);
        _syncSel(els.optDensity,         design.density);
        _syncSel(els.optCorners,         design.corners);
        _syncSel(els.optHeroArt,         design.heroArt);
        _syncSel(els.optHeroEyebrow,     design.heroEyebrow);
        _syncSel(els.optTypeScale,       design.typeScale);
        _syncSel(els.optHeadingAlign,    design.headingAlign);
        _syncSel(els.optContainerWidth,  design.containerWidth);
        _syncSel(els.optFontPair,        design.fontPair);
        _syncSel(els.optCardTreatment,   design.cardTreatment);
        _syncSel(els.optButtonStyle,     design.buttonStyle);
        _syncSel(els.optNavStyle,        design.navStyle);
        _syncSel(els.optFooterStyle,     design.footerStyle);
        _syncSel(els.optSectionRhythm,   design.sectionRhythm);
        _syncSel(els.optDividerStyle,    design.dividerStyle);
        _syncSel(els.optLabelStyle,      design.labelStyle);
        _syncSel(els.optLogoStyle,       design.logoStyle);
        _syncSel(els.optCursorStyle,     design.cursorStyle);
        if (design.sectionLayouts) {
            _syncSel(els.optServicesLayout,  design.sectionLayouts.services);
            _syncSel(els.optPortfolioLayout, design.sectionLayouts.portfolio);
        }
        if (els.optAboutFlip) els.optAboutFlip.checked = !!design.aboutFlip;
        // Pricing accent is numeric (1|2|3) in state but the SELECT stores it as a string
        if (els.optPricingAccent) {
            var pav = design.pricingAccent != null ? String(design.pricingAccent) : '';
            _syncSel(els.optPricingAccent, pav);
        }

        // ─── ADVANCED JSON ─── stash the full design payload and mirror it
        // into the designer-facing JSON editor so every axis — even ones
        // without a dedicated dropdown (sectionTones, sectionAnims,
        // elementOverrides, pages, navExtra, footerRecipe, sectionCounts,
        // designTokens) — can be read and tweaked by hand.
        try {
            state.lastAiDesign = JSON.parse(JSON.stringify(design));
        } catch (e) { state.lastAiDesign = null; }
        _populateAdvDesignEditor(state.lastAiDesign);
        if (typeof _renderAdvAll === 'function') _renderAdvAll();
        state._suppressDesignOptRefresh = false;

        // Remember choices so the next regen picks something different
        _aiLastPresetId = state.style;
        _aiLastDensity  = design.density || _aiLastDensity;
        _aiLastCorners  = design.corners || _aiLastCorners;
        _aiLastFont     = design.fontPair || _aiLastFont;
        _aiLastHeroLayout = design.heroLayout || _aiLastHeroLayout;

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

        // ─── RESTORE LOCKED AXES ─── some downstream code paths (preset apply,
        // tokens) may have overwritten locked values; put them back now.
        if (lockedAccent) els.accentColor.value = lockedAccent;
        if (lockedBg)     els.bgColor.value     = lockedBg;
        if (lockedStyle && lockedStyle !== state.style) {
            state.style = lockedStyle;
            // Reflect the locked style selection in the UI
            document.querySelectorAll('.style-card').forEach(function (c) {
                c.classList.toggle('selected', c.dataset.style === lockedStyle);
            });
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
        /^contact-heading$/,
        // Chrome elements the AI is allowed to reposition / restyle
        /^(site-header|site-logo|site-nav|menu-btn|nav-extra)$/
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
        // Positioning: keyword enum
        if (prop === 'position') {
            return ['static','relative','absolute','fixed','sticky'].indexOf(val) !== -1 ? val : null;
        }
        // Offsets / sizes: accept a CSS length token or "auto" or a bare unitless number (→ px)
        if (prop === 'top' || prop === 'right' || prop === 'bottom' || prop === 'left' ||
            prop === 'width' || prop === 'height' ||
            prop === 'maxWidth' || prop === 'maxHeight' || prop === 'minWidth' || prop === 'minHeight' ||
            prop === 'marginTop' || prop === 'marginRight' || prop === 'marginBottom' || prop === 'marginLeft') {
            if (val === 'auto' || val === '0') return val;
            if (typeof val === 'number' && isFinite(val)) return val + 'px';
            if (typeof val === 'string' && /^-?\d{1,4}(\.\d+)?(px|rem|em|%|vw|vh|svh|dvh)$/.test(val)) return val;
            return null;
        }
        // zIndex: bounded integer
        if (prop === 'zIndex') {
            var z = parseInt(val, 10);
            if (!isFinite(z)) return null;
            return String(Math.max(-100, Math.min(10002, z)));
        }
        // transform: conservative whitelist — only translate/rotate/scale with simple args
        if (prop === 'transform') {
            if (typeof val !== 'string') return null;
            // Allow strings composed only of translate()/translateX()/translateY()/rotate()/scale()/scaleX()/scaleY() calls.
            if (/^(\s*(translate[XY]?|rotate|scale[XY]?)\(\s*-?\d{1,4}(\.\d+)?(px|deg|rad|%)?\s*(,\s*-?\d{1,4}(\.\d+)?(px|deg|rad|%)?\s*)?\)\s*){1,3}$/.test(val)) return val;
            return null;
        }
        return null;
    }

    function _applyElementOverrides(map) {
        if (!map || typeof map !== 'object') return;
        var ov = state.editorOverrides || {};
        var props = ['animation','hover','continuous','color','backgroundColor','borderRadius','opacity',
            // Positioning / layout props the AI can set on allowed elements
            'position','top','right','bottom','left','zIndex',
            'width','height','maxWidth','maxHeight','minWidth','minHeight',
            'marginTop','marginRight','marginBottom','marginLeft',
            'transform'];
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
            els.seoTitle.dispatchEvent(new Event('input', { bubbles: true }));
            count++;
        }
        if (typeof brand.seoDescription === 'string' && brand.seoDescription.trim() && els.seoDescription) {
            els.seoDescription.value = brand.seoDescription.trim().slice(0, 160);
            els.seoDescription.dispatchEvent(new Event('input', { bubbles: true }));
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
                var filled = _applyCopy(copy, true);
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
                    var filled = _applyCopy(result.copy, true);
                    var note = result.design && result.design.rationale
                        ? (' \u2014 ' + String(result.design.rationale).slice(0, 120))
                        : '';
                    els.aiStatus.textContent = 'Designed: ' + brandCount + ' brand fields, palette, ' +
                        (Array.isArray(result.design && result.design.sections) ? result.design.sections.length : 0) +
                        ' sections, ' + filled + ' copy fields' + note;
                    els.aiStatus.className = 'ai-status ai-status--success';
                    // Remember this run so the cheap REDESIGN button becomes available
                    state.aiLastDesc     = desc;
                    state.aiLastIndustry = els.industry.value;
                    state.aiLastBrand    = els.brandName.value;
                    if (els.aiRedesignBtn) els.aiRedesignBtn.style.display = '';
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

    // Redesign-only: reuse existing copy, ask AI for a fresh look.
    // Much smaller prompt/response — saves ~75% tokens vs full auto-design.
    if (els.aiRedesignBtn) {
        els.aiRedesignBtn.addEventListener('click', function () {
            var desc = (state.aiLastDesc || els.aiPrompt.value || '').trim();
            if (!desc) {
                els.aiStatus.textContent = 'Run Generate Website first so I know your business.';
                els.aiStatus.className = 'ai-status ai-status--error';
                return;
            }

            aiLastSnapshot = _snapshotForUndo();
            var orig = els.aiRedesignBtn.innerHTML;
            els.aiRedesignBtn.disabled = true;
            els.aiAutoDesignBtn.disabled = true;
            els.aiRedesignBtn.textContent = 'REDESIGNING...';
            els.aiStatus.textContent = 'Picking a fresh design (keeping your copy)...';
            els.aiStatus.className = 'ai-status ai-status--info';

            // Clear previous per-element overrides so the new design starts clean
            state.editorOverrides = {};

            ArbelAI.generateDesignOnly(desc, state.aiLastIndustry || els.industry.value, state.aiLastBrand || els.brandName.value)
                .then(function (result) {
                    _applyDesign(result.design);
                    var note = result.design && result.design.rationale
                        ? (' \u2014 ' + String(result.design.rationale).slice(0, 120))
                        : '';
                    els.aiStatus.textContent = 'Redesigned (copy preserved)' + note;
                    els.aiStatus.className = 'ai-status ai-status--success';
                    _showUndo();
                })
                .catch(function (err) {
                    els.aiStatus.textContent = 'Error: ' + err.message;
                    els.aiStatus.className = 'ai-status ai-status--error';
                })
                .finally(function () {
                    els.aiRedesignBtn.disabled = false;
                    els.aiAutoDesignBtn.disabled = false;
                    els.aiRedesignBtn.innerHTML = orig;
                });
        });
    }

    /* ─── Randomize Button (preview toolbar) ─── */
    // Non-destructive: picks a fresh preset + palette + axes and re-renders the
    // preview. Respects axis locks. Toggling "AI" on routes the click through
    // ArbelAI.generateDesignOnly (same as the sidebar redesign button) so users
    // with a key get LLM-driven variety; toggling off runs locally with zero
    // token cost.
    if (els.randomizeBtn) {
        // Remember user's AI toggle preference across sessions
        try {
            var savedAI = localStorage.getItem('arbel-randomize-ai');
            if (savedAI === '1' && els.randomizeUseAI) els.randomizeUseAI.checked = true;
        } catch (e) {}
        if (els.randomizeUseAI) {
            els.randomizeUseAI.addEventListener('change', function () {
                try { localStorage.setItem('arbel-randomize-ai', els.randomizeUseAI.checked ? '1' : '0'); } catch (e) {}
            });
        }

        els.randomizeBtn.addEventListener('click', function () {
            _runRandomize(false);
        });

        // Shift+R shortcut
        document.addEventListener('keydown', function (e) {
            if (e.shiftKey && (e.key === 'R' || e.key === 'r') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                var t = e.target;
                if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
                e.preventDefault();
                _runRandomize(false);
            }
        });
    }

    /** Run a randomize pass. When useAI=true OR toggle is on + key present,
     *  route through ArbelAI.generateDesignOnly so the LLM drives the remix.
     *  Otherwise shuffle locally — random preset, random palette, random axes. */
    function _runRandomize(force) {
        var btn = els.randomizeBtn;
        if (!btn || btn.classList.contains('spinning')) return;

        var wantsAI = !!(els.randomizeUseAI && els.randomizeUseAI.checked);
        var keyAvailable = !!(window.ArbelKeyManager &&
            (ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey()));
        var useAI = wantsAI && keyAvailable &&
            !!(window.ArbelAI && ArbelAI.generateDesignOnly);

        aiLastSnapshot = _snapshotForUndo();
        btn.classList.add('spinning');
        btn.disabled = true;

        var done = function (msg, ok) {
            btn.classList.remove('spinning');
            btn.disabled = false;
            if (els.aiStatus) {
                els.aiStatus.textContent = msg;
                els.aiStatus.className = 'ai-status ai-status--' + (ok ? 'success' : 'info');
            }
            _showUndo && _showUndo();
        };

        if (useAI) {
            var desc = (state.aiLastDesc || (els.aiPrompt && els.aiPrompt.value) || els.description && els.description.value || '').trim();
            if (!desc) {
                // Fall back to local if no description context
                _runLocalRandomize();
                done('Randomized locally (add a description to use AI)', true);
                return;
            }
            state.editorOverrides = {};
            ArbelAI.generateDesignOnly(desc,
                state.aiLastIndustry || (els.industry && els.industry.value) || '',
                state.aiLastBrand || (els.brandName && els.brandName.value) || '')
                .then(function (result) {
                    _applyDesign(result.design);
                    if (state.step >= 3) generatePreview();
                    done('Randomized with AI', true);
                })
                .catch(function (err) {
                    // Fallback: run local if AI fails
                    _runLocalRandomize();
                    done('AI failed, randomized locally: ' + (err && err.message || err), false);
                });
        } else {
            _runLocalRandomize();
            var note = wantsAI && !keyAvailable
                ? 'Randomized locally (no API key — add one in AI panel for LLM remix)'
                : 'Randomized locally';
            done(note, true);
        }
    }

    /** Local randomizer: random preset + accent + bg + hand off to _applyDesign
     *  which will fill the rest (fontPair, cardTreatment, hero layout, etc)
     *  from its built-in variety logic. Zero API calls, instant.
     *  Tracks last-run choices so sequential clicks feel genuinely distinct. */
    var _localLastPresetId = null;
    var _localLastPaletteIdx = -1;
    var _localLastHero = null;
    var _localLastCard = null;
    var _localLastButton = null;
    var _localLastFont = null;
    var _localLastFooter = null;
    var _localLastTypeScale = null;
    var _localLastRhythm = null;
    var _localLastDivider = null;
    var _localLastHeroArt = null;
    var _localLastLabel = null;

    function _pickDiff(arr, last) {
        var pool = arr.filter(function (v) { return v !== last; });
        if (!pool.length) pool = arr;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function _runLocalRandomize() {
        var styles = ArbelCompiler.getStyles();

        // ─── Preset anti-repeat ──
        var styleIds = styles.map(function (s) { return s.id; });
        var pickId = _pickDiff(styleIds, _localLastPresetId);
        var pick = styles.find(function (s) { return s.id === pickId; }) || styles[0];

        // ─── 30-entry palette pool covering dark/light, neon, pastel,
        // brutalist, editorial, luxe, mono, high-contrast. Anti-repeat by idx.
        var palettes = [
            // Dark + vivid
            { accent: '#6C5CE7', bg: '#0f0f14' }, // violet / ink
            { accent: '#FF6B6B', bg: '#1a0f0f' }, // coral / espresso
            { accent: '#4ECDC4', bg: '#0a1817' }, // teal / deep green
            { accent: '#F59E0B', bg: '#18140c' }, // amber / warm black
            { accent: '#EC4899', bg: '#1a0f17' }, // magenta / plum
            { accent: '#10B981', bg: '#0b1411' }, // emerald / forest
            { accent: '#3B82F6', bg: '#0a1020' }, // cobalt / navy
            { accent: '#F97316', bg: '#1a110a' }, // tangerine / bronze
            { accent: '#A855F7', bg: '#120a1a' }, // violet / midnight
            // Neon / cyber
            { accent: '#00FFB2', bg: '#05070d' }, // mint neon / void
            { accent: '#FF00AA', bg: '#07050d' }, // hot pink / void
            { accent: '#00D4FF', bg: '#06101a' }, // cyan / deep navy
            { accent: '#FAFF00', bg: '#0a0a0a' }, // yellow / jet
            // Luxe / editorial dark
            { accent: '#D4AF37', bg: '#0f0c08' }, // gold / onyx
            { accent: '#E8E4D9', bg: '#141410' }, // ivory / charcoal
            { accent: '#C9A961', bg: '#1a1612' }, // champagne / bronze
            // Light / eggshell
            { accent: '#E11D48', bg: '#fef6f2' }, // crimson / eggshell
            { accent: '#0EA5E9', bg: '#f5f9fc' }, // azure / snow
            { accent: '#65A30D', bg: '#f8faf3' }, // lime / linen
            { accent: '#D97706', bg: '#fdf8ee' }, // honey / cream
            { accent: '#be3144', bg: '#f1e8dc' }, // cherry / sand
            { accent: '#1E293B', bg: '#FAF8F2' }, // slate / bone
            { accent: '#7c3aed', bg: '#f8f5ff' }, // violet / mist
            // Pastel
            { accent: '#ff8fa3', bg: '#fff5f7' }, // rose / blush
            { accent: '#7dd3fc', bg: '#f0faff' }, // sky / ice
            { accent: '#c4b5fd', bg: '#faf7ff' }, // lavender / frost
            // Brutalist / mono
            { accent: '#FF4500', bg: '#ffffff' }, // orange / white
            { accent: '#0000FF', bg: '#ffff00' }, // blue / yellow (bold)
            { accent: '#ffffff', bg: '#000000' }, // white / black (mono)
            { accent: '#ff0040', bg: '#111111' }  // red / near-black
        ];
        var palIdx;
        do { palIdx = Math.floor(Math.random() * palettes.length); }
        while (palIdx === _localLastPaletteIdx && palettes.length > 1);
        var pal = palettes[palIdx];

        // ─── Force-rotate key visual axes so the page architecture shifts
        // every click — not just the palette. _applyDesign respects any
        // explicit axis value we pass (and falls back to random if null).
        var heroLayouts = ['centered', 'left', 'split', 'minimal'];
        var cardTreats  = ['default', 'bordered', 'filled', 'floating', 'minimal', 'glass', 'neon', 'gradient', 'outline-accent', 'brutalist', 'split'];
        var buttonStyles = ['default', 'solid', 'outline', 'gradient', 'sharp', 'lifted', 'pill', 'glow', 'underline', 'ghost'];
        var fontPairs = ['editorial', 'tech', 'humanist', 'display', 'mono', 'luxe', 'brutalist', 'terminal', 'futurist', 'soft', 'classical', 'modern', 'boutique', 'journal'];
        var footers  = ['default', 'minimal', 'columns', 'centered', 'bigLogo', 'stripe'];
        var typeScales = ['tight', 'normal', 'dramatic'];
        var rhythms = ['normal', 'compact', 'roomy', 'alternating'];
        var dividers = ['none', 'line', 'gradient', 'numbered', 'dotline'];
        var heroArts = ['none', 'grid', 'lines', 'circle', 'dots', 'cross', 'blob', 'wave', 'triangle', 'zigzag', 'arc', 'rings', 'stripes', 'scribble', 'checker'];
        var labels   = ['default', 'bar', 'dot', 'number', 'stripe', 'tag', 'arrow', 'bracket'];

        var heroLayout   = _pickDiff(heroLayouts, _localLastHero);
        var cardTreat    = _pickDiff(cardTreats,  _localLastCard);
        var buttonStyle  = _pickDiff(buttonStyles, _localLastButton);
        var fontPair     = _pickDiff(fontPairs,   _localLastFont);
        var footerStyle  = _pickDiff(footers,     _localLastFooter);
        var typeScale    = _pickDiff(typeScales,  _localLastTypeScale);
        var sectionRhythm= _pickDiff(rhythms,     _localLastRhythm);
        var dividerStyle = _pickDiff(dividers,    _localLastDivider);
        var heroArt      = _pickDiff(heroArts,    _localLastHeroArt);
        var labelStyle   = _pickDiff(labels,      _localLastLabel);

        _localLastPresetId   = pickId;
        _localLastPaletteIdx = palIdx;
        _localLastHero       = heroLayout;
        _localLastCard       = cardTreat;
        _localLastButton     = buttonStyle;
        _localLastFont       = fontPair;
        _localLastFooter     = footerStyle;
        _localLastTypeScale  = typeScale;
        _localLastRhythm     = sectionRhythm;
        _localLastDivider    = dividerStyle;
        _localLastHeroArt    = heroArt;
        _localLastLabel      = labelStyle;

        // Density / corners / heading-align / container-width also rotated
        // through _applyDesign's built-in random-fill (we pass nothing so it
        // picks fresh each time and its anti-repeat guarantees change).
        var design = {
            presetId:      pickId,
            accentOverride: pal.accent,
            bgOverride:     pal.bg,
            heroLayout:     heroLayout,
            cardTreatment:  cardTreat,
            buttonStyle:    buttonStyle,
            fontPair:       fontPair,
            footerStyle:    footerStyle,
            typeScale:      typeScale,
            sectionRhythm:  sectionRhythm,
            dividerStyle:   dividerStyle,
            heroArt:        heroArt,
            labelStyle:     labelStyle,
            rationale: 'Local randomize \u2014 ' + pick.name
        };
        state.editorOverrides = {};
        _applyDesign(design);
        if (state.step >= 3) generatePreview();
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

    /* ─── ADVANCED DESIGN JSON EDITOR ─────────────────────────────────────
     * Designer-facing manual control over every complex axis the AI can set
     * (sectionTones, sectionAnims, elementOverrides, pages, navExtra,
     * footerRecipe, etc.). Exposes the full design payload in a textarea so
     * users can read what the AI picked and override anything by hand.
     * The Apply button feeds edited JSON right back through `_applyDesign`,
     * which re-validates every axis and re-syncs the simple dropdowns. */
    function _populateAdvDesignEditor(design) {
        if (!els.advDesignJson) return;
        try {
            els.advDesignJson.value = design
                ? JSON.stringify(design, null, 2)
                : '';
            if (els.advDesignStatus) els.advDesignStatus.textContent = '';
        } catch (e) {
            els.advDesignJson.value = '';
        }
    }

    function _wireAdvancedDesign() {
        if (!els.advDesignApplyBtn) return;
        var showStatus = function (msg, kind) {
            if (!els.advDesignStatus) return;
            els.advDesignStatus.textContent = msg || '';
            els.advDesignStatus.className = 'ai-status' + (kind ? ' ai-status--' + kind : '');
        };
        els.advDesignApplyBtn.addEventListener('click', function () {
            var txt = (els.advDesignJson && els.advDesignJson.value || '').trim();
            if (!txt) { showStatus('Paste or generate a design JSON first.', 'error'); return; }
            var parsed;
            try { parsed = JSON.parse(txt); }
            catch (err) { showStatus('JSON parse error: ' + err.message, 'error'); return; }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                showStatus('Design JSON must be a plain object.', 'error'); return;
            }
            try {
                _applyDesign(parsed);
                _markDirty();
                // Re-compile + re-render preview so changes show immediately.
                if (typeof generatePreview === 'function') generatePreview();
                showStatus('Applied. Preview updated.', 'success');
            } catch (err) {
                showStatus('Apply failed: ' + err.message, 'error');
            }
        });
        els.advDesignResetBtn.addEventListener('click', function () {
            if (!state.lastAiDesign) {
                showStatus('No AI design captured yet.', 'error'); return;
            }
            _populateAdvDesignEditor(state.lastAiDesign);
            try {
                _applyDesign(JSON.parse(JSON.stringify(state.lastAiDesign)));
                _markDirty();
                if (typeof generatePreview === 'function') generatePreview();
                showStatus('Reset to last AI design.', 'success');
            } catch (err) {
                showStatus('Reset failed: ' + err.message, 'error');
            }
        });
        els.advDesignFormatBtn.addEventListener('click', function () {
            var txt = (els.advDesignJson.value || '').trim();
            if (!txt) return;
            try {
                els.advDesignJson.value = JSON.stringify(JSON.parse(txt), null, 2);
                showStatus('Formatted.', 'success');
            } catch (err) {
                showStatus('Cannot format — invalid JSON: ' + err.message, 'error');
            }
        });

        // ─── Manual advanced-form controls ─── sync form widgets ↔ state
        _wireAdvancedForms();
        _renderAdvAll();
    }

    /* ─── ADVANCED FORMS ─── designer-friendly manual controls for the
     * complex axes the AI sets (section tones/anims, card counts, nav CTA,
     * footer recipe). Each widget edits a single property on
     * state.lastAiDesign, then re-runs _applyDesign + generatePreview so the
     * preview updates instantly. The JSON textarea stays in sync too. */
    var ADV_SECTION_IDS = ['hero','services','portfolio','about','process','testimonials','pricing','faq','team','contact'];
    var ADV_TONES = [
        { v: '',         label: 'Default' },
        { v: 'dark',     label: 'Dark' },
        { v: 'light',    label: 'Light' },
        { v: 'accent',   label: 'Accent tint' }
    ];
    var ADV_ANIMS = [
        { v: '',           label: 'Default' },
        { v: 'fade',       label: 'Fade' },
        { v: 'fadeUp',     label: 'Fade up' },
        { v: 'slideLeft',  label: 'Slide left' },
        { v: 'slideRight', label: 'Slide right' },
        { v: 'scale',      label: 'Scale' },
        { v: 'stagger',    label: 'Stagger' },
        { v: 'blur',       label: 'Blur' },
        { v: 'none',       label: 'No animation' }
    ];

    function _getAdvDesign() {
        // Mirror current state.ai* into a shallow object so form edits map 1:1
        // onto design keys. We prefer state.lastAiDesign (the full AI payload)
        // if present so we don't lose AI-picked nested things.
        if (state.lastAiDesign && typeof state.lastAiDesign === 'object') {
            return state.lastAiDesign;
        }
        // Fallback: synthesize from state.ai* so manual-only users can still
        // edit these axes before the first AI run.
        return (state.lastAiDesign = {
            sectionTones:   state.aiSectionTones || {},
            sectionAnims:   state.aiSectionAnims || {},
            sectionCounts:  state.aiSectionCounts || {},
            navExtra:       state.aiNavExtra || null,
            navExtraDisabled: !!state.aiNavExtraDisabled,
            footerRecipe:   state.aiFooterRecipe || null
        });
    }

    /** Re-apply the current state.lastAiDesign to the preview. */
    function _advCommit() {
        if (!state.lastAiDesign) return;
        try {
            state._suppressDesignOptRefresh = true;
            _applyDesign(JSON.parse(JSON.stringify(state.lastAiDesign)));
            state._suppressDesignOptRefresh = false;
            _markDirty();
            if (state.step >= 3 && typeof generatePreview === 'function') generatePreview();
        } catch (err) {
            state._suppressDesignOptRefresh = false;
            console.warn('Advanced apply failed:', err);
        }
    }

    /** Rebuild the section-tones/anims list based on currently-enabled sections. */
    function _renderAdvSectionList() {
        var list = document.getElementById('advSectionList');
        if (!list) return;
        // Enabled sections = hero + any section checkbox that's on + contact (required)
        var enabled = { hero: 1, contact: 1 };
        document.querySelectorAll('[data-section]').forEach(function (cb) {
            if (cb.checked || cb.disabled) enabled[cb.dataset.section] = 1;
        });
        var design = _getAdvDesign();
        var tones = design.sectionTones || {};
        var anims = design.sectionAnims || {};
        var html = '';
        ADV_SECTION_IDS.forEach(function (sid) {
            if (!enabled[sid]) return;
            var toneOpts = ADV_TONES.map(function (t) {
                return '<option value="' + t.v + '"' + (tones[sid] === t.v ? ' selected' : '') + '>' + t.label + '</option>';
            }).join('');
            var animOpts = ADV_ANIMS.map(function (a) {
                return '<option value="' + a.v + '"' + (anims[sid] === a.v ? ' selected' : '') + '>' + a.label + '</option>';
            }).join('');
            html += '<div class="adv-section-row" data-sid="' + sid + '">' +
                '<span class="adv-section-row-label">' + sid + '</span>' +
                '<select class="gen-input adv-tone">' + toneOpts + '</select>' +
                '<select class="gen-input adv-anim">' + animOpts + '</select>' +
                '</div>';
        });
        list.innerHTML = html;
    }

    function _renderAdvCounts() {
        var design = _getAdvDesign();
        var counts = design.sectionCounts || {};
        [
            ['advCountServices', 'services'],
            ['advCountPortfolio', 'portfolio'],
            ['advCountProcess', 'process'],
            ['advCountTeam', 'team'],
            ['advCountPricing', 'pricing'],
            ['advCountTestimonials', 'testimonials'],
            ['advCountFaq', 'faq']
        ].forEach(function (pair) {
            var el = document.getElementById(pair[0]);
            if (el) el.value = counts[pair[1]] != null ? counts[pair[1]] : '';
        });
    }

    function _renderAdvNavExtra() {
        var design = _getAdvDesign();
        var ne = design.navExtra || {};
        var k = document.getElementById('advNavExtraKind');
        var l = document.getElementById('advNavExtraLabel');
        var h = document.getElementById('advNavExtraHref');
        var d = document.getElementById('advNavExtraDisabled');
        if (k) k.value = ne.kind || '';
        if (l) l.value = ne.label || '';
        if (h) h.value = ne.href || '';
        if (d) d.checked = !!design.navExtraDisabled;
    }

    function _renderAdvFooterRecipe() {
        var design = _getAdvDesign();
        var fr = design.footerRecipe || {};
        var tagEl = document.getElementById('advFooterTagline');
        if (tagEl) tagEl.value = fr.tagline || '';
        var container = document.getElementById('advFooterCols');
        if (!container) return;
        var cols = Array.isArray(fr.columns) ? fr.columns : [];
        var html = '';
        cols.forEach(function (col, i) {
            var heading = col && col.heading ? String(col.heading) : '';
            // Items can be strings or { label, href } — display as "label | href" lines.
            var items = (col && Array.isArray(col.items)) ? col.items.map(function (it) {
                if (typeof it === 'string') return it;
                if (it && it.label && it.href) return it.label + ' | ' + it.href;
                if (it && it.label) return it.label;
                return '';
            }).filter(Boolean).join('\n') : '';
            html += '<div class="adv-footer-col" data-col="' + i + '">' +
                '<div class="adv-footer-col-head"><span class="mono">COLUMN ' + (i+1) + '</span>' +
                '<button class="adv-footer-col-remove" type="button" data-remove="' + i + '">REMOVE</button></div>' +
                '<input type="text" class="gen-input adv-footer-col-heading" placeholder="Heading (e.g. Company)" value="' + _esc(heading) + '">' +
                '<textarea class="gen-textarea adv-footer-col-items" placeholder="One item per line. For links use: Label | https://example.com">' + _esc(items) + '</textarea>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function _renderAdvAll() {
        _renderAdvSectionList();
        _renderAdvCounts();
        _renderAdvNavExtra();
        _renderAdvFooterRecipe();
    }

    function _wireAdvancedForms() {
        // Section tones / anims (delegated — list is dynamic)
        var list = document.getElementById('advSectionList');
        if (list) {
            list.addEventListener('change', function (e) {
                var row = e.target.closest('.adv-section-row');
                if (!row) return;
                var sid = row.getAttribute('data-sid');
                var design = _getAdvDesign();
                design.sectionTones = design.sectionTones || {};
                design.sectionAnims = design.sectionAnims || {};
                var toneEl = row.querySelector('.adv-tone');
                var animEl = row.querySelector('.adv-anim');
                if (toneEl) {
                    if (toneEl.value) design.sectionTones[sid] = toneEl.value;
                    else delete design.sectionTones[sid];
                }
                if (animEl) {
                    if (animEl.value) design.sectionAnims[sid] = animEl.value;
                    else delete design.sectionAnims[sid];
                }
                _populateAdvDesignEditor(design);
                _advCommit();
            });
        }

        // Card counts
        var countMap = [
            ['advCountServices', 'services'],
            ['advCountPortfolio', 'portfolio'],
            ['advCountProcess', 'process'],
            ['advCountTeam', 'team'],
            ['advCountPricing', 'pricing'],
            ['advCountTestimonials', 'testimonials'],
            ['advCountFaq', 'faq']
        ];
        countMap.forEach(function (pair) {
            var el = document.getElementById(pair[0]);
            if (!el) return;
            el.addEventListener('change', function () {
                var design = _getAdvDesign();
                design.sectionCounts = design.sectionCounts || {};
                var n = parseInt(el.value, 10);
                if (isFinite(n) && n >= 0 && n <= 12) design.sectionCounts[pair[1]] = n;
                else delete design.sectionCounts[pair[1]];
                _populateAdvDesignEditor(design);
                _advCommit();
            });
        });

        // Nav extra
        ['advNavExtraKind', 'advNavExtraLabel', 'advNavExtraHref'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', _onAdvNavExtraChange);
            if (el.tagName === 'INPUT') el.addEventListener('blur', _onAdvNavExtraChange);
        });
        var neDisabled = document.getElementById('advNavExtraDisabled');
        if (neDisabled) neDisabled.addEventListener('change', _onAdvNavExtraChange);

        // Footer recipe
        var tagEl = document.getElementById('advFooterTagline');
        if (tagEl) tagEl.addEventListener('change', _onAdvFooterChange);
        var footerContainer = document.getElementById('advFooterCols');
        if (footerContainer) {
            footerContainer.addEventListener('change', _onAdvFooterChange);
            footerContainer.addEventListener('click', function (e) {
                var rm = e.target.closest('.adv-footer-col-remove');
                if (!rm) return;
                var idx = parseInt(rm.getAttribute('data-remove'), 10);
                var design = _getAdvDesign();
                if (!design.footerRecipe || !Array.isArray(design.footerRecipe.columns)) return;
                design.footerRecipe.columns.splice(idx, 1);
                if (!design.footerRecipe.columns.length) design.footerRecipe = null;
                _renderAdvFooterRecipe();
                _populateAdvDesignEditor(design);
                _advCommit();
            });
        }
        var addBtn = document.getElementById('advFooterAddCol');
        if (addBtn) addBtn.addEventListener('click', function () {
            var design = _getAdvDesign();
            design.footerRecipe = design.footerRecipe && typeof design.footerRecipe === 'object'
                ? design.footerRecipe : {};
            design.footerRecipe.columns = Array.isArray(design.footerRecipe.columns) ? design.footerRecipe.columns : [];
            design.footerRecipe.columns.push({ heading: 'Column ' + (design.footerRecipe.columns.length + 1), items: [] });
            _renderAdvFooterRecipe();
            _populateAdvDesignEditor(design);
            _advCommit();
        });

        // Rebuild section list when the user toggles a section in the sidebar
        var sectionToggles = document.getElementById('sectionToggles');
        if (sectionToggles) sectionToggles.addEventListener('change', function () {
            _renderAdvSectionList();
        });
    }

    function _onAdvNavExtraChange() {
        var design = _getAdvDesign();
        var kind = (document.getElementById('advNavExtraKind') || {}).value || '';
        var label = (document.getElementById('advNavExtraLabel') || {}).value || '';
        var href  = (document.getElementById('advNavExtraHref')  || {}).value || '';
        var disabled = !!(document.getElementById('advNavExtraDisabled') || {}).checked;
        if (kind || label || href) {
            design.navExtra = { kind: kind || 'button' };
            if (label) design.navExtra.label = label.slice(0, 40);
            if (href)  design.navExtra.href  = href.slice(0, 200);
        } else {
            design.navExtra = null;
        }
        design.navExtraDisabled = disabled;
        _populateAdvDesignEditor(design);
        _advCommit();
    }

    function _onAdvFooterChange() {
        var design = _getAdvDesign();
        var tagline = (document.getElementById('advFooterTagline') || {}).value || '';
        var cols = [];
        document.querySelectorAll('#advFooterCols .adv-footer-col').forEach(function (card) {
            var heading = (card.querySelector('.adv-footer-col-heading') || {}).value || '';
            var itemsText = (card.querySelector('.adv-footer-col-items') || {}).value || '';
            var items = itemsText.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
                var pipe = line.indexOf('|');
                if (pipe > -1) {
                    var lab = line.slice(0, pipe).trim();
                    var href = line.slice(pipe + 1).trim();
                    if (lab && href) return { label: lab.slice(0, 40), href: href.slice(0, 200) };
                }
                return line.slice(0, 60);
            });
            if (heading || items.length) cols.push({ heading: heading.slice(0, 40), items: items });
        });
        if (cols.length || tagline) {
            design.footerRecipe = { columns: cols };
            if (tagline) design.footerRecipe.tagline = tagline.slice(0, 160);
        } else {
            design.footerRecipe = null;
        }
        _populateAdvDesignEditor(design);
        _advCommit();
    }

    /** Merge manual design-option dropdowns from the classic wizard onto a cfg.
     *  Any non-empty value overrides the AI-chosen / default value. This lets
     *  manual users get the exact same variation capabilities as AI mode. */
    function _applyManualDesignOpts(cfg) {
        function v(el) { return (el && typeof el.value === 'string') ? el.value.trim() : ''; }
        var hero = v(els.optHeroLayout);       if (hero) cfg.heroLayout = hero;
        var art  = v(els.optHeroArt);          if (art)  cfg.heroArt = art;
        var eye  = v(els.optHeroEyebrow);      if (eye)  cfg.heroEyebrow = eye;
        var ts   = v(els.optTypeScale);        if (ts)   cfg.typeScale = ts;
        var ha   = v(els.optHeadingAlign);     if (ha)   cfg.headingAlign = ha;
        var cw   = v(els.optContainerWidth);   if (cw)   cfg.containerWidth = cw;
        var ct   = v(els.optCardTreatment);    if (ct)   cfg.cardTreatment = ct;
        var bs   = v(els.optButtonStyle);      if (bs)   cfg.buttonStyle = bs;
        var ns   = v(els.optNavStyle);         if (ns)   cfg.navStyle = ns;
        var fs   = v(els.optFooterStyle);      if (fs)   cfg.footerStyle = fs;
        var rh   = v(els.optSectionRhythm);    if (rh)   cfg.sectionRhythm = rh;
        var ds   = v(els.optDividerStyle);     if (ds)   cfg.dividerStyle = ds;
        var ls   = v(els.optLabelStyle);       if (ls)   cfg.labelStyle = ls;
        var sl   = v(els.optServicesLayout);
        var pl   = v(els.optPortfolioLayout);
        if (sl || pl) {
            cfg.sectionLayouts = Object.assign({}, cfg.sectionLayouts || {});
            if (sl) cfg.sectionLayouts.services = sl;
            if (pl) cfg.sectionLayouts.portfolio = pl;
        }
        if (els.optAboutFlip && els.optAboutFlip.checked) cfg.aboutFlip = true;
        var lg = v(els.optLogoStyle);          if (lg)   cfg.logoStyle = lg;
        var cu = v(els.optCursorStyle);        if (cu)   cfg.cursorStyle = cu;
        var pa = v(els.optPricingAccent);
        if (pa) {
            var paN = parseInt(pa, 10);
            if (paN >= 1 && paN <= 3) cfg.pricingAccent = paN;
        }
        // Font pair — translate semantic ID → concrete headingFont/bodyFont tokens
        var fp = v(els.optFontPair);
        if (fp) {
            var manualFontPairs = {
                editorial:  { headingFont: '"Instrument Serif", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
                tech:       { headingFont: '"Space Grotesk", -apple-system, sans-serif', bodyFont: '"Inter", -apple-system, sans-serif' },
                humanist:   { headingFont: '"Fraunces", Georgia, serif', bodyFont: '"Work Sans", -apple-system, sans-serif' },
                display:    { headingFont: '"Playfair Display", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' },
                mono:       { headingFont: '"Space Mono", monospace', bodyFont: '"IBM Plex Mono", monospace' },
                luxe:       { headingFont: '"DM Serif Display", Georgia, serif', bodyFont: '"DM Sans", -apple-system, sans-serif' },
                brutalist:  { headingFont: '"Archivo Black", Impact, sans-serif', bodyFont: '"Archivo", -apple-system, sans-serif' },
                terminal:   { headingFont: '"JetBrains Mono", monospace', bodyFont: '"JetBrains Mono", monospace' },
                futurist:   { headingFont: '"Syne", -apple-system, sans-serif', bodyFont: '"Manrope", -apple-system, sans-serif' },
                soft:       { headingFont: '"Bricolage Grotesque", -apple-system, sans-serif', bodyFont: '"Manrope", -apple-system, sans-serif' },
                classical:  { headingFont: '"Crimson Pro", Georgia, serif', bodyFont: '"Lora", Georgia, serif' },
                modern:     { headingFont: '"Plus Jakarta Sans", -apple-system, sans-serif', bodyFont: '"Plus Jakarta Sans", -apple-system, sans-serif' },
                boutique:   { headingFont: '"Cormorant Garamond", Georgia, serif', bodyFont: '"Raleway", -apple-system, sans-serif' },
                journal:    { headingFont: '"Libre Baskerville", Georgia, serif', bodyFont: '"Inter", -apple-system, sans-serif' }
            };
            if (manualFontPairs[fp]) {
                cfg.designTokens = Object.assign({}, cfg.designTokens || {}, manualFontPairs[fp]);
            }
        }
        return cfg;
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

        // ─── SITE TYPE ─── Always infer from description + industry so the
        // compiler can apply site-type-specific visual identity CSS, content
        // defaults (stats/logoCloud/team) and section-label overrides. Reuse
        // the one stashed by the last AI run if present; otherwise infer now.
        if (state.aiSiteType) {
            cfg.siteType = state.aiSiteType;
        } else if (window.ArbelSiteType) {
            var desc = (state.aiLastDesc || (els.aiPrompt && els.aiPrompt.value) || (els.description && els.description.value) || '');
            cfg.siteType = ArbelSiteType.infer(desc, els.industry.value || '');
        }

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
        if (state.aiHeroLayout)   cfg.heroLayout   = state.aiHeroLayout;
        if (state.aiSectionOrder && state.aiSectionOrder.length) cfg.sections = state.aiSectionOrder;
        if (state.aiSectionCounts) cfg.sectionCounts = state.aiSectionCounts;
        if (state.aiSectionLayouts) cfg.sectionLayouts = state.aiSectionLayouts;
        if (typeof state.aiAboutFlip === 'boolean') cfg.aboutFlip = state.aiAboutFlip;
        if (state.aiPricingAccent) cfg.pricingAccent = state.aiPricingAccent;
        if (state.aiHeadingAlign) cfg.headingAlign = state.aiHeadingAlign;
        if (state.aiContainerWidth) cfg.containerWidth = state.aiContainerWidth;
        if (state.aiCardTreatment) cfg.cardTreatment = state.aiCardTreatment;
        if (state.aiNavStyle) cfg.navStyle = state.aiNavStyle;
        if (state.aiSectionRhythm) cfg.sectionRhythm = state.aiSectionRhythm;
        if (state.aiHeroEyebrow) cfg.heroEyebrow = state.aiHeroEyebrow;
        if (state.aiButtonStyle) cfg.buttonStyle = state.aiButtonStyle;
        if (state.aiTypeScale) cfg.typeScale = state.aiTypeScale;
        if (state.aiDividerStyle) cfg.dividerStyle = state.aiDividerStyle;
        if (state.aiFooterStyle) cfg.footerStyle = state.aiFooterStyle;
        if (state.aiLabelStyle) cfg.labelStyle = state.aiLabelStyle;
        if (state.aiHeroArt) cfg.heroArt = state.aiHeroArt;
        if (state.aiLogoStyle) cfg.logoStyle = state.aiLogoStyle;
        if (state.aiCursorStyle) cfg.cursorStyle = state.aiCursorStyle;
        // Pass new category-aware overrides into the compiler config.
        if (state.aiNavExtra) cfg.navExtraHtml = null; // let compiler use stProfile or cfg.navExtra
        if (state.aiNavExtra) cfg.navExtra = state.aiNavExtra;
        if (state.aiNavExtraDisabled) cfg.navExtraDisabled = true;
        if (state.aiFooterRecipe) cfg.footerRecipe = state.aiFooterRecipe;
        if (state.aiPages) cfg.pages = state.aiPages;

        // Manual design-option overrides (classic-wizard dropdowns)
        // Applied AFTER AI so the user can override any axis by hand.
        _applyManualDesignOpts(cfg);

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
    /** Resolve the compiled-file path for the page currently selected in
     * the Pages tab. Returns "about/index.html", "about-us/index.html",
     * etc., or undefined when the home page is active. */
    function _currentPagePath() {
        try {
            var id = ArbelEditor.getCurrentPage ? ArbelEditor.getCurrentPage() : 'home';
            if (!id || id === 'home') return undefined;
            var pages = ArbelEditor.getPages() || [];
            for (var i = 0; i < pages.length; i++) {
                if (pages[i].id === id && !pages[i].isHome) {
                    var slug = (pages[i].path || '/' + pages[i].id).replace(/^\//, '').replace(/\/$/, '');
                    return slug ? slug + '/index.html' : undefined;
                }
            }
        } catch (e) { /* fall through to home */ }
        return undefined;
    }

    function generatePreview() {
        var config = buildConfig();
        try {
            state.compiledFiles = ArbelCompiler.compile(config);
        } catch (compileErr) {
            console.error('Arbel compile error:', compileErr);
            return;
        }
        var editorScript = ArbelEditor.getOverlayScript();
        ArbelPreview.render(els.previewIframe, state.compiledFiles, editorScript, _currentPagePath());

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
        ArbelPreview.render(els.previewIframe, state.compiledFiles, editorScript, _currentPagePath());
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

        // Emit portable design-tokens manifest alongside the built site (if available)
        try {
            if (ArbelCompiler.buildTokensJSON && state.compiledFiles) {
                var _tokCfg = buildConfig();
                state.compiledFiles['tokens.json'] = ArbelCompiler.buildTokensJSON(_tokCfg);
                if (ArbelCompiler.buildTokensCSS) {
                    state.compiledFiles['tokens.css'] = ArbelCompiler.buildTokensCSS(_tokCfg);
                }
            }
        } catch (e) { /* non-fatal */ }

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
                },
                designOpts: {
                    heroLayout: els.optHeroLayout ? els.optHeroLayout.value : '',
                    heroArt: els.optHeroArt ? els.optHeroArt.value : '',
                    heroEyebrow: els.optHeroEyebrow ? els.optHeroEyebrow.value : '',
                    typeScale: els.optTypeScale ? els.optTypeScale.value : '',
                    headingAlign: els.optHeadingAlign ? els.optHeadingAlign.value : '',
                    containerWidth: els.optContainerWidth ? els.optContainerWidth.value : '',
                    fontPair: els.optFontPair ? els.optFontPair.value : '',
                    cardTreatment: els.optCardTreatment ? els.optCardTreatment.value : '',
                    buttonStyle: els.optButtonStyle ? els.optButtonStyle.value : '',
                    navStyle: els.optNavStyle ? els.optNavStyle.value : '',
                    footerStyle: els.optFooterStyle ? els.optFooterStyle.value : '',
                    sectionRhythm: els.optSectionRhythm ? els.optSectionRhythm.value : '',
                    dividerStyle: els.optDividerStyle ? els.optDividerStyle.value : '',
                    labelStyle: els.optLabelStyle ? els.optLabelStyle.value : '',
                    servicesLayout: els.optServicesLayout ? els.optServicesLayout.value : '',
                    portfolioLayout: els.optPortfolioLayout ? els.optPortfolioLayout.value : '',
                    aboutFlip: els.optAboutFlip ? !!els.optAboutFlip.checked : false,
                    toneOfVoice: els.optToneOfVoice ? els.optToneOfVoice.value : '',
                    logoStyle: els.optLogoStyle ? els.optLogoStyle.value : '',
                    cursorStyle: els.optCursorStyle ? els.optCursorStyle.value : ''
                },
                aiLocks: (function () {
                    var out = {};
                    document.querySelectorAll('.ai-lock').forEach(function (el) {
                        if (el.checked && el.dataset.lock) out[el.dataset.lock] = true;
                    });
                    return out;
                })()
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

        // Manual design-option dropdowns (classic-mode overrides)
        if (c.designOpts) {
            var d = c.designOpts;
            function _set(el, v) { if (el && typeof v === 'string') el.value = v; }
            _set(els.optHeroLayout, d.heroLayout);
            _set(els.optHeroArt, d.heroArt);
            _set(els.optHeroEyebrow, d.heroEyebrow);
            _set(els.optTypeScale, d.typeScale);
            _set(els.optHeadingAlign, d.headingAlign);
            _set(els.optContainerWidth, d.containerWidth);
            _set(els.optFontPair, d.fontPair);
            _set(els.optCardTreatment, d.cardTreatment);
            _set(els.optButtonStyle, d.buttonStyle);
            _set(els.optNavStyle, d.navStyle);
            _set(els.optFooterStyle, d.footerStyle);
            _set(els.optSectionRhythm, d.sectionRhythm);
            _set(els.optDividerStyle, d.dividerStyle);
            _set(els.optLabelStyle, d.labelStyle);
            _set(els.optServicesLayout, d.servicesLayout);
            _set(els.optPortfolioLayout, d.portfolioLayout);
            if (els.optAboutFlip) els.optAboutFlip.checked = !!d.aboutFlip;
            _set(els.optToneOfVoice, d.toneOfVoice);
            _set(els.optLogoStyle, d.logoStyle);
            _set(els.optCursorStyle, d.cursorStyle);
            if (window.ArbelAI && ArbelAI.setTone) ArbelAI.setTone(d.toneOfVoice || '');
        }
        // AI axis locks
        if (c.aiLocks && typeof c.aiLocks === 'object') {
            document.querySelectorAll('.ai-lock').forEach(function (el) {
                el.checked = !!c.aiLocks[el.dataset.lock];
            });
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
    // Design-option dropdowns (classic-mode manual overrides) — refresh preview
    // immediately when the user is on Step 3+ (builder / preview) so changes
    // made via the builder's Site Design tab show in real time.
    var _designOptRefresh = function () {
        if (state._suppressDesignOptRefresh) return;
        _markDirty();
        if (state.step >= 3 && typeof generatePreview === 'function') generatePreview();
    };
    document.querySelectorAll('.design-opt').forEach(function (el) {
        el.addEventListener('change', _designOptRefresh);
    });
    if (els.optAboutFlip) els.optAboutFlip.addEventListener('change', _designOptRefresh);
    if (els.optToneOfVoice) els.optToneOfVoice.addEventListener('change', function () {
        if (window.ArbelAI && ArbelAI.setTone) ArbelAI.setTone(els.optToneOfVoice.value || '');
        _designOptRefresh();
    });
    // Advanced Design (JSON) editor — Apply / Reset / Format buttons
    _wireAdvancedDesign();
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
