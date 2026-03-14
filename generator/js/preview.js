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
        var jsMap = {
            'js/shader.js': files['js/shader.js'] || '',
            'js/animations.js': files['js/animations.js'] || '',
            'js/main.js': files['js/main.js'] || ''
        };

        Object.keys(jsMap).forEach(function (path) {
            html = html.replace(
                '<script src="' + path + '"><\/script>',
                '<script>' + jsMap[path] + '<\/script>'
            );
        });

        return html;
    }

    /**
     * Render compiled files in the preview iframe.
     * @param {HTMLIFrameElement} iframe — target iframe element
     * @param {Object} files — { filename: content } from ArbelCompiler.compile()
     */
    function render(iframe, files) {
        if (!iframe) return;
        _iframe = iframe;
        _cleanup();

        var inlinedHTML = _buildInlineHTML(files);
        var blob = new Blob([inlinedHTML], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        _blobUrls.push(url);

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
