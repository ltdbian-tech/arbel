/* ────────────────────────────────────────────────────────────────
   Arbel Maintenance Gate
   ────────────────────────────────────────────────────────────────
   Must be loaded in <head> as the FIRST script on the page.
   Fetches maintenance.json and either:
     • does nothing                          (maintenance OFF)
     • unhides page + shows small corner pill(maintenance ON, bypass present)
     • replaces the page with a maintenance wall (maintenance ON, no bypass)

   Bypass: one of
     • URL has ?mb=<BYPASS_TOKEN>   → persists for BYPASS_TTL_MS, reloads clean
     • localStorage 'arbel.maintBypass' holds a valid non-expired entry

   Security notes:
   - The bypass token is a 16-char opaque random string.  It IS visible in
     the public JS source, so a determined attacker who views-source can
     find it.  That is acceptable: bypass only grants the same access a
     user would have when maintenance is OFF — no privilege escalation,
     no data exposure.  The token exists to prevent drive-by guessing
     like ?bypass=1 / ?admin=1 / ?preview=1.
   - Bypass entries auto-expire (see BYPASS_TTL_MS) so leaving the flag
     on a shared computer is not permanent.
   - Wall rendering uses createElement + textContent only — never
     innerHTML — so CSP stays intact and there is zero XSS surface even
     if maintenance.json is ever tampered with.
   - Fails open: any network / parse error lets the page load normally.

   To enable maintenance: edit generator/maintenance.json, set enabled=true,
   commit, push. Takes ~30s to propagate via GitHub Pages CDN.

   To rotate the bypass token (do this if you ever leak it):
     change BYPASS_TOKEN below, bump the cache-buster, push.
   ──────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    // 16 opaque chars. Rotate by editing this constant and bumping cache-buster.
    var BYPASS_TOKEN = 'a7f3e9c2b8d14f06';
    var BYPASS_QS_KEY = 'mb';
    var BYPASS_LS_KEY = 'arbel.maintBypass';
    var BYPASS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    var FETCH_TIMEOUT_MS = 3000;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

    // 1. Honor ?mb=<token> URL param: validate, persist bypass with expiry,
    //    then strip from URL so the token never leaks via Referer / share.
    try {
        var qp = new URLSearchParams(location.search);
        var supplied = qp.get(BYPASS_QS_KEY);
        if (supplied !== null) {
            if (supplied === BYPASS_TOKEN) {
                lsSet(BYPASS_LS_KEY, String(Date.now() + BYPASS_TTL_MS));
            }
            // Always strip — whether valid or not — so the URL doesn't echo
            // the user's guess and so the valid token doesn't leak.
            qp.delete(BYPASS_QS_KEY);
            var newSearch = qp.toString();
            var cleaned = location.pathname + (newSearch ? '?' + newSearch : '') + location.hash;
            history.replaceState(null, '', cleaned);
        }
    } catch (e) { /* ignore */ }

    // 2. Check for a valid, non-expired bypass entry.
    var hasBypass = false;
    var entry = lsGet(BYPASS_LS_KEY);
    if (entry) {
        var expiry = parseInt(entry, 10);
        if (isFinite(expiry) && expiry > Date.now()) {
            hasBypass = true;
        } else {
            lsDel(BYPASS_LS_KEY); // expired / malformed → clear
        }
    }

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

    // Build the maintenance wall WITHOUT innerHTML so we preserve CSP and
    // have zero XSS surface even if maintenance.json is ever tampered with.
    function renderMaintWall(data) {
        var msg = (data && typeof data.message === 'string') ? data.message
            : 'Arbel is temporarily unavailable for maintenance.';
        var until = (data && typeof data.until === 'string') ? data.until : '';

        function build() {
            if (!document.body) { setTimeout(build, 20); return; }

            // Wipe body contents
            while (document.body.firstChild) document.body.removeChild(document.body.firstChild);

            // Scoped style (CSP-clean, no inline JS)
            var style = document.createElement('style');
            style.textContent = [
                'html,body{margin:0;padding:0;height:100%;background:#0a0a0a;color:#e5e5e5;',
                'font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;}',
                '#arbelMaintWall{display:flex;flex-direction:column;align-items:center;justify-content:center;',
                'min-height:100vh;padding:24px;text-align:center;}',
                '#arbelMaintWall .logo{font-size:42px;font-weight:700;letter-spacing:-0.02em;margin-bottom:8px;}',
                '#arbelMaintWall .logo .dot{color:#f59e0b;}',
                '#arbelMaintWall .tag{font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.2em;',
                'color:#f59e0b;margin-bottom:32px;}',
                '#arbelMaintWall .msg{font-size:18px;max-width:520px;line-height:1.5;color:#d4d4d4;margin-bottom:12px;}',
                '#arbelMaintWall .until{font:500 13px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#737373;margin-bottom:32px;}',
                '#arbelMaintWall .mail{color:#f59e0b;text-decoration:none;border-bottom:1px solid rgba(245,158,11,0.25);padding-bottom:2px;font-size:14px;}',
                '#arbelMaintWall .mail:hover{border-bottom-color:#f59e0b;}'
            ].join('');
            document.body.appendChild(style);

            var wrap = document.createElement('div');
            wrap.id = 'arbelMaintWall';

            var logo = document.createElement('div');
            logo.className = 'logo';
            logo.appendChild(document.createTextNode('arbel'));
            var dot = document.createElement('span');
            dot.className = 'dot';
            dot.textContent = '.';
            logo.appendChild(dot);
            wrap.appendChild(logo);

            var tag = document.createElement('div');
            tag.className = 'tag';
            tag.textContent = 'MAINTENANCE';
            wrap.appendChild(tag);

            var msgEl = document.createElement('div');
            msgEl.className = 'msg';
            msgEl.textContent = msg; // textContent = zero XSS risk
            wrap.appendChild(msgEl);

            if (until) {
                var untilEl = document.createElement('div');
                untilEl.className = 'until';
                untilEl.textContent = 'Expected back: ' + until;
                wrap.appendChild(untilEl);
            }

            var mail = document.createElement('a');
            mail.className = 'mail';
            mail.href = 'mailto:arbeltechnologies@gmail.com?subject=Arbel%20Question';
            mail.textContent = 'arbeltechnologies@gmail.com';
            wrap.appendChild(mail);

            document.body.appendChild(wrap);

            try { document.title = 'Arbel — Maintenance'; } catch (e) { /* ignore */ }

            document.documentElement.style.visibility = '';
        }
        build();
    }

    // 4. Fetch maintenance.json with cache-buster + timeout. Fail-open: if
    //    we can't reach the flag, assume maintenance OFF and let the page load.
    var url = 'maintenance.json?t=' + Date.now();
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () {
        if (controller) { try { controller.abort(); } catch (e) { /* ignore */ } }
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
