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

    return {
        render: render,
        setDevice: setDevice,
        destroy: destroy
    };
})();
