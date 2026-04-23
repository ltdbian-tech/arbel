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
   PREVIEW — iframe Preview Manager
   
   Takes compiled files from ArbelCompiler and
   renders them in an iframe for live preview.
   ═══════════════════════════════════════════════ */

window.ArbelPreview = (function () {
    'use strict';

    var _iframe = null;
    var _blobUrls = [];
    // Latest scroll position reported by the iframe via postMessage.
    // Used to restore scroll across re-renders without reading the iframe
    // DOM directly (which is blocked now that the preview is null-origin).
    var _lastScrollY = 0;
    // Queue of audit resolvers keyed by request id.  Each _runAudit() posts
    // an 'arbel-audit-run' message to the iframe and waits for its reply.
    var _auditPending = {};
    var _auditSeq = 0;
    var _messageHandlerAttached = false;

    /* ─── Cross-iframe message bus ─────────────────────────────
     * The preview iframe runs null-origin (sandbox without
     * allow-same-origin) so we cannot touch its DOM.  Everything
     * the parent used to do synchronously \u2014 read scrollY, run the
     * WCAG audit, scroll to an audit target \u2014 now goes through the
     * message bus below.  The iframe-side companion script
     * (IFRAME_HELPER_SCRIPT, injected by _buildInlineHTML) handles
     * the other half of each call.
     */
    function _ensureMessageHandler() {
        if (_messageHandlerAttached) return;
        _messageHandlerAttached = true;
        window.addEventListener('message', function (e) {
            if (!_iframe || e.source !== _iframe.contentWindow) return;
            // Defence-in-depth: a sandboxed iframe without allow-same-origin
            // always reports origin === 'null'.  Rejecting anything else
            // catches future regressions where sandbox flags change.
            if (e.origin !== 'null' && e.origin !== '') return;
            var d = e.data;
            if (!d || typeof d !== 'object') return;
            if (d.type === 'arbel-preview-scroll' && typeof d.y === 'number') {
                _lastScrollY = d.y;
            } else if (d.type === 'arbel-audit-result' && d.rid && _auditPending[d.rid]) {
                var resolve = _auditPending[d.rid];
                delete _auditPending[d.rid];
                resolve(d.report || { issues: [], error: 'no-report' });
            }
        });
    }

    function _postToIframe(msg) {
        try { if (_iframe && _iframe.contentWindow) _iframe.contentWindow.postMessage(msg, '*'); }
        catch (e) { /* iframe gone \u2014 ignore */ }
    }

    /** Request a WCAG audit from the iframe.  Returns a Promise that resolves
     *  with the report, or a soft error after 2s. */
    function _runAudit() {
        return new Promise(function (resolve) {
            if (!_iframe) { resolve({ issues: [], error: 'no-iframe' }); return; }
            var rid = 'a' + (++_auditSeq);
            _auditPending[rid] = resolve;
            _postToIframe({ type: 'arbel-audit-run', rid: rid });
            setTimeout(function () {
                if (_auditPending[rid]) {
                    delete _auditPending[rid];
                    resolve({ issues: [], error: 'timeout' });
                }
            }, 2000);
        });
    }

    /** Revoke all previously created blob URLs */
    function _cleanup() {
        _blobUrls.forEach(function (url) {
            URL.revokeObjectURL(url);
        });
        _blobUrls = [];
    }

    /** Convert a data:video URL to a blob URL for reliable iframe playback.
     *  Kept for backwards compatibility; the actual conversion now happens
     *  INSIDE the iframe (see IFRAME_HELPER_SCRIPT) because a null-origin
     *  sandboxed iframe cannot load blob: URLs created by the parent window. */
    function _dataUrlToBlob(dataUrl) {
        try {
            var parts = dataUrl.split(',');
            var mimeMatch = parts[0].match(/:(.*?);/);
            var mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
            var b64 = parts[1];
            var binary = atob(b64);
            var arr = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
            return new Blob([arr], { type: mime });
        } catch (ex) { return null; }
    }

    /**
     * Build an inline HTML document from compiled files.
     * Instead of creating separate blob URLs for CSS/JS,
     * we inline everything into a single HTML string so
     * the iframe works without needing to fetch resources.
     *
     * @param {Object} files compiled files from ArbelCompiler.compile()
     * @param {string} [pagePath] optional relative path of the page HTML
     *   inside `files` (e.g. "about/index.html"). Defaults to the home page.
     */
    function _buildInlineHTML(files, pagePath) {
        // Resolve which HTML file to render. The compiler emits non-home
        // pages under `<slug>/index.html`, so falling back to index.html is
        // always safe.
        var key = pagePath && files[pagePath] ? pagePath : 'index.html';
        var html = files[key] || files['index.html'] || '';
        // Sub-pages reference assets with "../css/…" / "../js/…". Normalise
        // those to the flat paths that exist in the `files` map so the
        // inline replacements below hit every link/script tag.
        if (key !== 'index.html') {
            html = html.replace(/(?:\.\.\/)+(css\/[^"']+)/g, '$1')
                       .replace(/(?:\.\.\/)+(js\/[^"']+)/g, '$1')
                       .replace(/href="(?:\.\.\/)+"/g, 'href="./"')
                       .replace(/href="(?:\.\.\/)+(#[^"]+)"/g, 'href="$1"');
        }

        // Replace external CSS link with inline <style>
        var css = files['css/style.css'] || '';
        html = html.replace(
            '<link rel="stylesheet" href="css/style.css">',
            '<style>' + css + '</style>'
        );

        // Replace external JS script tags with inline <script>
        var jsFiles = ['js/shader.js', 'js/video-layer.js', 'js/particles.js', 'js/blobs.js', 'js/gradient.js', 'js/waves.js', 'js/animations.js', 'js/cinema.js', 'js/main.js'];
        jsFiles.forEach(function (path) {
            var content = files[path];
            if (content) {
                html = html.replace(
                    '<script src="' + path + '"><\/script>',
                    '<script>' + content + '<\/script>'
                );
            } else {
                // Remove script tags for files that don't exist in this build
                html = html.replace('<script src="' + path + '"><\/script>', '');
            }
        });

        return html;
    }

    /**
     * Render compiled files in the preview iframe.
     * @param {HTMLIFrameElement} iframe — target iframe element
     * @param {Object} files — { filename: content } from ArbelCompiler.compile()
     * @param {string} [editorScript] — optional editor overlay script to inject
     * @param {string} [pagePath] — optional page file to render (e.g. "about/index.html"). Defaults to home.
     */
    function render(iframe, files, editorScript, pagePath) {
        if (!iframe) return;
        _iframe = iframe;
        _ensureMessageHandler();

        // Use the scroll position reported by the iframe's last scroll event
        // (cross-origin safe) instead of reading iframe.contentWindow.scrollY.
        var savedScrollY = _lastScrollY || 0;

        _cleanup();

        var inlinedHTML = _buildInlineHTML(files, pagePath);

        // NOTE: data:video URL -> blob URL conversion used to happen here in
        // the parent, but null-origin iframes cannot load parent-origin
        // blob URLs.  The same conversion now runs INSIDE the iframe via
        // IFRAME_HELPER_SCRIPT, where the blob belongs to the iframe's own
        // (null) origin and loads cleanly.

        // Inject the parent<->iframe helper script FIRST so it's available
        // even if the editor overlay is disabled.  It runs the WCAG audit,
        // tracks scroll, and handles jump-to-issue \u2014 everything the parent
        // used to do via direct DOM access.
        inlinedHTML = inlinedHTML.replace(
            '</body>',
            '<script>' + IFRAME_HELPER_SCRIPT + '<\/script>\n</body>'
        );

        // Inject editor overlay script if provided
        if (editorScript) {
            inlinedHTML = inlinedHTML.replace(
                '</body>',
                '<script>' + editorScript + '<\/script>\n</body>'
            );
        }

        var blob = new Blob([inlinedHTML], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        _blobUrls.push(url);

        // Restore scroll position after iframe loads \u2014 via postMessage since
        // we can no longer call iframe.contentWindow.scrollTo() directly.
        var onLoad = function () {
            iframe.removeEventListener('load', onLoad);
            if (savedScrollY > 0) {
                setTimeout(function () {
                    _postToIframe({ type: 'arbel-preview-scroll-to', y: savedScrollY });
                }, 80);
            }
            // Run self-audit once the preview paints (non-fatal)
            setTimeout(function () {
                _runAudit().then(function (report) {
                    try {
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('arbel:audit', { detail: report }));
                        }
                    } catch (e) { /* ignore */ }
                });
            }, 400);
        };
        iframe.addEventListener('load', onLoad);

        iframe.src = url;
    }

    /**
     * Set the viewport size of the iframe container for responsive preview.
     * @param {string} device — 'desktop' | 'tablet' | 'mobile'
     */
    function setDevice(device) {
        if (!_iframe) return;
        var container = _iframe.parentElement;
        if (!container) return;

        container.className = 'preview-frame';
        switch (device) {
            case 'tablet':
                container.classList.add('preview-tablet');
                break;
            case 'mobile':
                container.classList.add('preview-mobile');
                break;
            default:
                container.classList.add('preview-desktop');
        }
    }

    /** Clean up blob URLs when done */
    function destroy() {
        _cleanup();
        if (_iframe) _iframe.src = 'about:blank';
        _iframe = null;
    }

    // ─────────────────────────────────────────────────────────────
    // SELF-AUDIT — WCAG contrast, heading length, CTA dup, alt, h-hierarchy
    // ─────────────────────────────────────────────────────────────
    // The audit used to read the iframe DOM directly from the parent.  That
    // required sandbox="allow-same-origin", which also gave any stored-XSS
    // payload inside the preview full access to parent.sessionStorage (GitHub
    // PAT) and parent.localStorage (AI API keys).  We now inject this helper
    // script INTO the iframe and run the audit there, returning a plain JSON
    // report via postMessage.  The preview iframe can then be null-origin.
    var IFRAME_HELPER_SCRIPT = (function () {
        // Keep this function body self-contained — it is stringified and
        // injected into every preview iframe, so it cannot reference any
        // parent-side variables or helpers.
        function helper() {
            'use strict';
            function parseColor(str) {
                if (!str) return null;
                var m = str.match(/rgba?\(([^)]+)\)/);
                if (!m) return null;
                var parts = m[1].split(',').map(function (s) { return parseFloat(s.trim()); });
                if (parts.length < 3 || parts.some(isNaN)) return null;
                return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
            }
            function relLum(c) {
                function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
                return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
            }
            function contrast(fg, bg) {
                if (!fg || !bg) return null;
                var L1 = relLum(fg), L2 = relLum(bg);
                var hi = Math.max(L1, L2), lo = Math.min(L1, L2);
                return (hi + 0.05) / (lo + 0.05);
            }
            function effectiveBg(el, win) {
                var cur = el;
                while (cur && cur.nodeType === 1) {
                    var s = win.getComputedStyle(cur);
                    var c = parseColor(s.backgroundColor);
                    if (c && c.a > 0.5) return c;
                    cur = cur.parentElement;
                }
                return { r: 255, g: 255, b: 255, a: 1 };
            }
            function findAAColor(fg, bg, required) {
                if (!fg || !bg) return null;
                var bgLum = relLum(bg);
                var targetDir = bgLum > 0.5 ? -1 : 1;
                var r = fg.r, g = fg.g, b = fg.b;
                for (var step = 0; step < 30; step++) {
                    r = Math.max(0, Math.min(255, r + targetDir * 9));
                    g = Math.max(0, Math.min(255, g + targetDir * 9));
                    b = Math.max(0, Math.min(255, b + targetDir * 9));
                    var test = { r: r, g: g, b: b, a: 1 };
                    var ratio = contrast(test, bg);
                    if (ratio != null && ratio >= required) return test;
                    if ((targetDir > 0 && r === 255 && g === 255 && b === 255) ||
                        (targetDir < 0 && r === 0 && g === 0 && b === 0)) break;
                }
                return null;
            }
            function runAudit() {
                var issues = [];
                var doc = document, win = window;
                if (!doc.body) return { issues: issues, error: 'no-doc' };
                var auditSeq = 0;
                function tag(el) {
                    if (!el) return null;
                    var id = el.getAttribute('data-arbel-audit');
                    if (!id) { id = 'aud-' + (++auditSeq); el.setAttribute('data-arbel-audit', id); }
                    return id;
                }
                var textSel = 'h1,h2,h3,h4,p,a,button,span,li,.btn';
                var nodes = Array.prototype.slice.call(doc.querySelectorAll(textSel), 0, 200);
                var seenPairs = {};
                var fixedCount = 0;
                nodes.forEach(function (el) {
                    if (!el.textContent || !el.textContent.trim()) return;
                    var s = win.getComputedStyle(el);
                    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.3) return;
                    var fg = parseColor(s.color);
                    var bg = effectiveBg(el, win);
                    var ratio = contrast(fg, bg);
                    if (ratio == null) return;
                    var fontSize = parseFloat(s.fontSize) || 16;
                    var fontWeight = parseInt(s.fontWeight, 10) || 400;
                    var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
                    var required = isLarge ? 3.0 : 4.5;
                    if (ratio < required) {
                        var key = s.color + '|' + s.backgroundColor + '|' + el.tagName;
                        if (seenPairs[key]) return;
                        seenPairs[key] = true;
                        var fixedColor = findAAColor(fg, bg, required);
                        var fixed = false;
                        if (fixedColor) {
                            el.style.color = 'rgb(' + fixedColor.r + ',' + fixedColor.g + ',' + fixedColor.b + ')';
                            fixed = true; fixedCount++;
                        }
                        issues.push({
                            level: fixed ? 'warn' : (ratio < required * 0.7 ? 'error' : 'warn'),
                            type: 'contrast', fixed: fixed, targetId: tag(el),
                            msg: (fixed ? 'Auto-fixed: ' : '') +
                                'Low contrast ' + ratio.toFixed(2) + ':1 (needs ' + required + ':1) on <' +
                                el.tagName.toLowerCase() + '> "' +
                                el.textContent.trim().slice(0, 40) + '"'
                        });
                    }
                });
                doc.querySelectorAll('h1,h2,h3').forEach(function (h) {
                    var t = (h.textContent || '').trim();
                    if (t.length > 120) {
                        issues.push({
                            level: 'warn', type: 'heading-length', targetId: tag(h),
                            msg: '<' + h.tagName.toLowerCase() + '> is ' + t.length + ' chars (>120) \u2014 "' + t.slice(0, 50) + '\u2026"'
                        });
                    }
                });
                var ctaTexts = {}, ctaFirstEl = {};
                doc.querySelectorAll('a.btn, button.btn, .btn').forEach(function (el) {
                    var t = (el.textContent || '').trim().toLowerCase();
                    if (!t || t.length < 2) return;
                    ctaTexts[t] = (ctaTexts[t] || 0) + 1;
                    if (!ctaFirstEl[t]) ctaFirstEl[t] = el;
                });
                Object.keys(ctaTexts).forEach(function (t) {
                    if (ctaTexts[t] >= 3) {
                        issues.push({
                            level: 'warn', type: 'cta-duplicate', targetId: tag(ctaFirstEl[t]),
                            msg: 'CTA text "' + t + '" appears ' + ctaTexts[t] + '\u00d7 \u2014 consider varying'
                        });
                    }
                });
                var imgsNoAlt = 0, firstImgNoAlt = null;
                doc.querySelectorAll('img').forEach(function (img) {
                    if (!img.hasAttribute('alt')) { imgsNoAlt++; if (!firstImgNoAlt) firstImgNoAlt = img; }
                });
                if (imgsNoAlt > 0) {
                    issues.push({
                        level: 'warn', type: 'alt',
                        targetId: firstImgNoAlt ? tag(firstImgNoAlt) : null,
                        msg: imgsNoAlt + ' image(s) missing alt attribute'
                    });
                }
                var headingEls = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
                var levels = [];
                headingEls.forEach(function (h) { levels.push(parseInt(h.tagName.charAt(1), 10)); });
                for (var i = 1; i < levels.length; i++) {
                    if (levels[i] - levels[i - 1] > 1) {
                        issues.push({
                            level: 'warn', type: 'heading-skip', targetId: tag(headingEls[i]),
                            msg: 'Heading jumps from h' + levels[i - 1] + ' to h' + levels[i] + ' (skip)'
                        });
                        break;
                    }
                }
                var h1s = doc.querySelectorAll('h1');
                if (h1s.length === 0) issues.push({ level: 'warn', type: 'h1', msg: 'No <h1> found on page' });
                else if (h1s.length > 1) issues.push({
                    level: 'warn', type: 'h1', targetId: tag(h1s[1]),
                    msg: h1s.length + ' <h1> elements \u2014 use one per page'
                });
                return {
                    issues: issues,
                    errors: issues.filter(function (i) { return i.level === 'error'; }).length,
                    warnings: issues.filter(function (i) { return i.level === 'warn'; }).length,
                    fixed: fixedCount,
                    ok: issues.length === 0
                };
            }
            function jumpTo(targetId) {
                if (!targetId) return;
                var el = document.querySelector('[data-arbel-audit="' + targetId + '"]');
                if (!el) return;
                try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
                var prev = el.style.outline, prevT = el.style.transition;
                el.style.transition = 'outline 1.4s ease-out, outline-offset 1.4s ease-out';
                el.style.outline = '3px solid rgba(108,92,231,0.95)';
                el.style.outlineOffset = '4px';
                setTimeout(function () {
                    el.style.outline = '3px solid rgba(108,92,231,0)';
                    el.style.outlineOffset = '12px';
                }, 40);
                setTimeout(function () {
                    el.style.outline = prev || '';
                    el.style.outlineOffset = '';
                    el.style.transition = prevT || '';
                }, 1500);
            }
            // Throttled scroll reporter \u2014 parent uses this to save/restore
            // scroll position across re-renders.
            var _scrollRaf = 0;
            window.addEventListener('scroll', function () {
                if (_scrollRaf) return;
                _scrollRaf = requestAnimationFrame(function () {
                    _scrollRaf = 0;
                    try { window.parent.postMessage({ type: 'arbel-preview-scroll', y: window.scrollY || 0 }, '*'); }
                    catch (e) { }
                });
            }, { passive: true });            // Convert any inline data:video URLs into iframe-local blob URLs.
            // Has to happen inside the iframe because a null-origin sandbox
            // cannot load blob: URLs owned by the parent document.
            function convertVideos() {
                try {
                    var nodes = document.querySelectorAll('video source[src^="data:video/"], video[src^="data:video/"]');
                    for (var i = 0; i < nodes.length; i++) {
                        var n = nodes[i];
                        var src = n.getAttribute('src') || '';
                        var parts = src.split(',');
                        if (parts.length < 2) continue;
                        var mimeMatch = parts[0].match(/:(.*?);/);
                        var mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
                        try {
                            var bin = atob(parts[1]);
                            var arr = new Uint8Array(bin.length);
                            for (var j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
                            var blob = new Blob([arr], { type: mime });
                            n.setAttribute('src', URL.createObjectURL(blob));
                            var parentV = n.tagName === 'SOURCE' ? n.parentElement : n;
                            if (parentV && parentV.load) { try { parentV.load(); } catch (ex) { } }
                        } catch (ex) { }
                    }
                } catch (ex) { }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', convertVideos);
            } else {
                convertVideos();
            }            // Handle parent \u2192 iframe commands.
            window.addEventListener('message', function (e) {
                var d = e.data;
                if (!d || typeof d !== 'object') return;
                if (d.type === 'arbel-preview-scroll-to' && typeof d.y === 'number') {
                    try { window.scrollTo(0, d.y); } catch (ex) { }
                } else if (d.type === 'arbel-audit-run') {
                    var report;
                    try { report = runAudit(); } catch (ex) { report = { issues: [], error: 'exception' }; }
                    try { window.parent.postMessage({ type: 'arbel-audit-result', rid: d.rid, report: report }, '*'); } catch (ex) { }
                } else if (d.type === 'arbel-audit-jump') {
                    try { jumpTo(d.targetId); } catch (ex) { }
                }
            });
        }
        return '(' + helper.toString() + ')();';
    })();

    /** Ask the iframe to scroll to an audit-tagged element and flash it. */
    function _jumpToAuditTarget(targetId) {
        if (!_iframe || !targetId) return;
        _postToIframe({ type: 'arbel-audit-jump', targetId: targetId });
    }

    return {
        render: render,
        setDevice: setDevice,
        destroy: destroy,
        audit: function () { return _runAudit(); },
        jumpToAudit: _jumpToAuditTarget
    };
})();
