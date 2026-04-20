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

    /** Revoke all previously created blob URLs */
    function _cleanup() {
        _blobUrls.forEach(function (url) {
            URL.revokeObjectURL(url);
        });
        _blobUrls = [];
    }

    /** Convert a data:video URL to a blob URL for reliable iframe playback */
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

    /** Replace inline data:video URLs with blob URLs for preview */
    function _convertVideoUrls(html) {
        return html.replace(/src="(data:video\/[^"]+)"/g, function (match, dataUrl) {
            var blob = _dataUrlToBlob(dataUrl);
            if (!blob) return match;
            var blobUrl = URL.createObjectURL(blob);
            _blobUrls.push(blobUrl);
            return 'src="' + blobUrl + '"';
        });
    }

    /**
     * Build an inline HTML document from compiled files.
     * Instead of creating separate blob URLs for CSS/JS,
     * we inline everything into a single HTML string so
     * the iframe works without needing to fetch resources.
     */
    function _buildInlineHTML(files) {
        var html = files['index.html'] || '';

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
     */
    function render(iframe, files, editorScript) {
        if (!iframe) return;
        _iframe = iframe;

        // Save scroll position before re-render
        var savedScrollY = 0;
        try {
            if (iframe.contentWindow) savedScrollY = iframe.contentWindow.scrollY || 0;
        } catch (e) { /* cross-origin or blank — ignore */ }

        _cleanup();

        var inlinedHTML = _buildInlineHTML(files);

        // Convert data:video URLs to blob URLs for reliable playback in iframe
        inlinedHTML = _convertVideoUrls(inlinedHTML);

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

        // Restore scroll position after iframe loads
        var onLoad = function () {
            iframe.removeEventListener('load', onLoad);
            if (savedScrollY > 0) {
                // Small delay to let GSAP/ScrollTrigger initialize before restoring
                setTimeout(function () {
                    try { iframe.contentWindow.scrollTo(0, savedScrollY); } catch (e) {}
                }, 80);
            }
            // Run self-audit once the preview paints (non-fatal)
            setTimeout(function () {
                try {
                    var report = _audit(iframe);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('arbel:audit', { detail: report }));
                    }
                } catch (e) { /* ignore */ }
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
    function _parseColor(str) {
        if (!str) return null;
        var m = str.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        var parts = m[1].split(',').map(function (s) { return parseFloat(s.trim()); });
        if (parts.length < 3 || parts.some(isNaN)) return null;
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    function _relLum(c) {
        function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    }
    function _contrast(fg, bg) {
        if (!fg || !bg) return null;
        var L1 = _relLum(fg), L2 = _relLum(bg);
        var hi = Math.max(L1, L2), lo = Math.min(L1, L2);
        return (hi + 0.05) / (lo + 0.05);
    }
    /** Walk up ancestors to find first opaque background color */
    function _effectiveBg(el, win) {
        var cur = el;
        while (cur && cur.nodeType === 1) {
            var s = win.getComputedStyle(cur);
            var c = _parseColor(s.backgroundColor);
            if (c && c.a > 0.5) return c;
            cur = cur.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
    }
    function _audit(iframe) {
        var issues = [];
        var doc, win;
        try { doc = iframe.contentDocument; win = iframe.contentWindow; }
        catch (e) { return { issues: issues, error: 'cross-origin' }; }
        if (!doc || !doc.body) return { issues: issues, error: 'no-doc' };

        // Attach a stable per-element id so the banner can jump back to it
        var _auditSeq = 0;
        function _tag(el) {
            if (!el) return null;
            var id = el.getAttribute('data-arbel-audit');
            if (!id) {
                id = 'aud-' + (++_auditSeq);
                el.setAttribute('data-arbel-audit', id);
            }
            return id;
        }

        // 1. Contrast — sample visible text-bearing elements (cap at 200 for perf)
        var textSel = 'h1,h2,h3,h4,p,a,button,span,li,.btn';
        var nodes = Array.prototype.slice.call(doc.querySelectorAll(textSel), 0, 200);
        var seenPairs = {};
        var fixedCount = 0;
        nodes.forEach(function (el) {
            if (!el.textContent || !el.textContent.trim()) return;
            var s = win.getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.3) return;
            var fg = _parseColor(s.color);
            var bg = _effectiveBg(el, win);
            var ratio = _contrast(fg, bg);
            if (ratio == null) return;
            var fontSize = parseFloat(s.fontSize) || 16;
            var fontWeight = parseInt(s.fontWeight, 10) || 400;
            var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            var required = isLarge ? 3.0 : 4.5;
            if (ratio < required) {
                var key = s.color + '|' + s.backgroundColor + '|' + el.tagName;
                if (seenPairs[key]) return;
                seenPairs[key] = true;

                // ─── AUTO-FIX: nudge foreground color until AA passes ──────
                var fixedColor = _findAAColor(fg, bg, required);
                var fixed = false;
                if (fixedColor) {
                    el.style.color = 'rgb(' + fixedColor.r + ',' + fixedColor.g + ',' + fixedColor.b + ')';
                    fixed = true;
                    fixedCount++;
                }

                issues.push({
                    level: fixed ? 'warn' : (ratio < required * 0.7 ? 'error' : 'warn'),
                    type: 'contrast',
                    fixed: fixed,
                    targetId: _tag(el),
                    msg: (fixed ? 'Auto-fixed: ' : '') +
                         'Low contrast ' + ratio.toFixed(2) + ':1 (needs ' + required + ':1) on <' +
                         el.tagName.toLowerCase() + '> "' +
                         el.textContent.trim().slice(0, 40) + '"'
                });
            }
        });

        // 2. Headings too long (>120 chars)
        doc.querySelectorAll('h1,h2,h3').forEach(function (h) {
            var t = (h.textContent || '').trim();
            if (t.length > 120) {
                issues.push({
                    level: 'warn', type: 'heading-length',
                    targetId: _tag(h),
                    msg: '<' + h.tagName.toLowerCase() + '> is ' + t.length + ' chars (>120) — "' + t.slice(0, 50) + '…"'
                });
            }
        });

        // 3. Duplicate CTA text
        var ctaTexts = {};
        var ctaFirstEl = {};
        doc.querySelectorAll('a.btn, button.btn, .btn').forEach(function (el) {
            var t = (el.textContent || '').trim().toLowerCase();
            if (!t || t.length < 2) return;
            ctaTexts[t] = (ctaTexts[t] || 0) + 1;
            if (!ctaFirstEl[t]) ctaFirstEl[t] = el;
        });
        Object.keys(ctaTexts).forEach(function (t) {
            if (ctaTexts[t] >= 3) {
                issues.push({
                    level: 'warn', type: 'cta-duplicate',
                    targetId: _tag(ctaFirstEl[t]),
                    msg: 'CTA text "' + t + '" appears ' + ctaTexts[t] + '× — consider varying'
                });
            }
        });

        // 4. Images missing alt
        var imgsNoAlt = 0;
        var firstImgNoAlt = null;
        doc.querySelectorAll('img').forEach(function (img) {
            if (!img.hasAttribute('alt')) { imgsNoAlt++; if (!firstImgNoAlt) firstImgNoAlt = img; }
        });
        if (imgsNoAlt > 0) {
            issues.push({
                level: 'warn', type: 'alt',
                targetId: firstImgNoAlt ? _tag(firstImgNoAlt) : null,
                msg: imgsNoAlt + ' image(s) missing alt attribute'
            });
        }

        // 5. Heading hierarchy — skipped levels (h1→h3, h2→h4, etc)
        var headingEls = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
        var levels = [];
        headingEls.forEach(function (h) { levels.push(parseInt(h.tagName.charAt(1), 10)); });
        for (var i = 1; i < levels.length; i++) {
            if (levels[i] - levels[i - 1] > 1) {
                issues.push({
                    level: 'warn', type: 'heading-skip',
                    targetId: _tag(headingEls[i]),
                    msg: 'Heading jumps from h' + levels[i - 1] + ' to h' + levels[i] + ' (skip)'
                });
                break;
            }
        }

        // 6. h1 count
        var h1s = doc.querySelectorAll('h1');
        if (h1s.length === 0) issues.push({ level: 'warn', type: 'h1', msg: 'No <h1> found on page' });
        else if (h1s.length > 1) issues.push({
            level: 'warn', type: 'h1',
            targetId: _tag(h1s[1]),
            msg: h1s.length + ' <h1> elements — use one per page'
        });

        return {
            issues: issues,
            errors: issues.filter(function (i) { return i.level === 'error'; }).length,
            warnings: issues.filter(function (i) { return i.level === 'warn'; }).length,
            fixed: fixedCount,
            ok: issues.length === 0
        };
    }

    /** Given an fg color + bg color, walk fg toward darker or lighter until
     *  the required AA ratio is met. Returns null if impossible. */
    function _findAAColor(fg, bg, required) {
        if (!fg || !bg) return null;
        var bgLum = _relLum(bg);
        // Bg is light → darken fg toward black; Bg is dark → lighten fg toward white.
        var targetDir = bgLum > 0.5 ? -1 : 1;
        var r = fg.r, g = fg.g, b = fg.b;
        for (var step = 0; step < 30; step++) {
            r = Math.max(0, Math.min(255, r + targetDir * 9));
            g = Math.max(0, Math.min(255, g + targetDir * 9));
            b = Math.max(0, Math.min(255, b + targetDir * 9));
            var test = { r: r, g: g, b: b, a: 1 };
            var ratio = _contrast(test, bg);
            if (ratio != null && ratio >= required) return test;
            if ((targetDir > 0 && r === 255 && g === 255 && b === 255) ||
                (targetDir < 0 && r === 0   && g === 0   && b === 0))   break;
        }
        return null;
    }

    /** Scroll to an audit-tagged element in the iframe and flash an outline. */
    function _jumpToAuditTarget(targetId) {
        if (!_iframe || !targetId) return;
        var doc, win;
        try { doc = _iframe.contentDocument; win = _iframe.contentWindow; }
        catch (e) { return; }
        if (!doc) return;
        var el = doc.querySelector('[data-arbel-audit="' + targetId + '"]');
        if (!el) return;
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        var prev = el.style.outline;
        var prevT = el.style.transition;
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

    return {
        render: render,
        setDevice: setDevice,
        destroy: destroy,
        audit: function () { return _iframe ? _audit(_iframe) : null; },
        jumpToAudit: _jumpToAuditTarget
    };
})();
