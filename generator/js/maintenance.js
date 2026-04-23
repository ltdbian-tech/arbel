/* ────────────────────────────────────────────────────────────────
   Arbel Maintenance Gate
   ────────────────────────────────────────────────────────────────
   Must be loaded in <head> as the FIRST script on the page.
   Fetches maintenance.json and either:
     • does nothing                          (maintenance OFF)
     • unhides page + shows small corner pill(maintenance ON, bypass present)
     • replaces the page with a maintenance wall (maintenance ON, no bypass)

   Bypass: one of
     • URL has ?bypass=1   → sets localStorage and reloads clean
     • localStorage.arbel.maintBypass === '1'

   To enable maintenance: edit generator/maintenance.json, set enabled=true,
   commit, push. Takes ~30s to propagate via GitHub Pages CDN.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var BYPASS_KEY = 'arbel.maintBypass';
    var FETCH_TIMEOUT_MS = 3000;

    // 1. Honor ?bypass=1 URL param: persist the flag, strip from URL, reload.
    try {
        var qp = new URLSearchParams(location.search);
        if (qp.get('bypass') === '1') {
            localStorage.setItem(BYPASS_KEY, '1');
            qp.delete('bypass');
            var newSearch = qp.toString();
            var cleaned = location.pathname + (newSearch ? '?' + newSearch : '') + location.hash;
            history.replaceState(null, '', cleaned);
        }
    } catch (e) { /* ignore */ }

    // 2. If bypass flag is set, we only need to know whether to show the
    //    "MAINT" pill. Check flag async, don't block rendering.
    var hasBypass = false;
    try { hasBypass = localStorage.getItem(BYPASS_KEY) === '1'; } catch (e) { /* ignore */ }

    // 3. Pre-hide the document root only if NO bypass, so a maintenance
    //    wall doesn't flash the real UI first. Bypassed devices see no flash.
    if (!hasBypass) {
        document.documentElement.style.visibility = 'hidden';
    }

    function showPage() {
        document.documentElement.style.visibility = '';
    }

    function renderMaintPill(msg) {
        function attach() {
            if (!document.body) { setTimeout(attach, 20); return; }
            if (document.getElementById('arbelMaintPill')) return;
            var pill = document.createElement('div');
            pill.id = 'arbelMaintPill';
            pill.textContent = 'MAINT';
            pill.title = (msg || 'Maintenance mode on') + ' — you are bypassed.';
            pill.style.cssText = [
                'position:fixed', 'bottom:12px', 'right:12px', 'z-index:99999',
                'padding:4px 10px', 'border-radius:12px',
                'background:linear-gradient(135deg,#f59e0b,#ef4444)',
                'color:#fff', 'font:600 10px/1 ui-monospace,Menlo,Consolas,monospace',
                'letter-spacing:0.14em', 'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
                'cursor:help', 'user-select:none'
            ].join(';');
            document.body.appendChild(pill);
        }
        attach();
    }

    function renderMaintWall(data) {
        var msg = (data && data.message) || 'Arbel is temporarily unavailable for maintenance.';
        var until = (data && data.until) ? String(data.until) : '';
        // Replace the entire document with a clean, self-contained wall.
        document.documentElement.innerHTML =
            '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Arbel — Maintenance</title>' +
            '<style>' +
            'html,body{margin:0;padding:0;height:100%;background:#0a0a0a;color:#e5e5e5;' +
            'font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;}' +
            '.wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'min-height:100vh;padding:24px;text-align:center;}' +
            '.logo{font-size:42px;font-weight:700;letter-spacing:-0.02em;margin-bottom:8px;}' +
            '.logo .dot{color:#f59e0b;}' +
            '.tag{font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.2em;' +
            'color:#f59e0b;margin-bottom:32px;}' +
            '.msg{font-size:18px;max-width:520px;line-height:1.5;color:#d4d4d4;margin-bottom:12px;}' +
            '.until{font:500 13px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#737373;margin-bottom:32px;}' +
            '.mail{color:#f59e0b;text-decoration:none;border-bottom:1px solid #f59e0b40;padding-bottom:2px;font-size:14px;}' +
            '.mail:hover{border-bottom-color:#f59e0b;}' +
            '</style></head>' +
            '<body><div class="wrap">' +
            '<div class="logo">arbel<span class="dot">.</span></div>' +
            '<div class="tag">MAINTENANCE</div>' +
            '<div class="msg">' + escapeHtml(msg) + '</div>' +
            (until ? '<div class="until">Expected back: ' + escapeHtml(until) + '</div>' : '') +
            '<a class="mail" href="mailto:arbeltechnologies@gmail.com?subject=Arbel%20Question">' +
            'arbeltechnologies@gmail.com</a>' +
            '</div></body>';
        document.documentElement.style.visibility = '';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // 4. Fetch maintenance.json with cache-buster + timeout. Fail-open: if
    //    we can't reach the flag, assume maintenance OFF and let the page load.
    var url = 'maintenance.json?t=' + Date.now();
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () {
        if (controller) controller.abort();
        showPage(); // fail-open
    }, FETCH_TIMEOUT_MS);

    fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            clearTimeout(timer);
            if (!data || !data.enabled) {
                showPage();
                return;
            }
            if (hasBypass) {
                showPage();
                renderMaintPill(data.message);
                return;
            }
            renderMaintWall(data);
        })
        .catch(function () {
            clearTimeout(timer);
            showPage(); // fail-open on network error
        });
})();
