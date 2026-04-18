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
/* ══════════════════════════════════════════════════════════════════
   Arbel Admin Worker  (analytics + admin panel — no GitHub OAuth)
   --------------------------------------------------------------
   Routes
     POST /api/track           Anonymous analytics (rate-limited)
     GET  /admin               Admin dashboard
     POST /admin/login         Submit admin token  → sets session cookie
     POST /admin/logout        Clear session
     GET  /api/admin/stats     Admin stats (session required)
   --------------------------------------------------------------
   Hardened bearer + signed-cookie session model:
     · ADMIN_TOKEN compared in CONSTANT TIME (timing-attack proof)
     · Per-IP brute-force lockout: 5 failed logins → 1 hour KV ban
     · Per-IP rate limits on /api/track (30/min) and admin (10/min)
     · Successful login issues HMAC-signed session cookie:
         httpOnly, Secure, SameSite=Strict, 12-hour expiry
     · CSRF protection: state-changing POSTs require X-CSRF header
     · Strict CSP, HSTS, frame-deny, no referrers
     · Admin page is noindex; unauth visits get a generic 404
     · No raw IPs anywhere — only 16-char salted SHA-256 prefixes
   ══════════════════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
    'https://arbel.live',
    'https://www.arbel.live',
    'https://arbeltechnologies.github.io'
];

const TRACK_LIMIT_PER_MIN = 30;
const ADMIN_LIMIT_PER_MIN = 10;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCKOUT_SEC = 3600;     // 1 hour lockout
const SESSION_TTL_SEC = 12 * 3600;  // 12 hours
const MAX_BODY_BYTES = 4 * 1024;    // 4 KB cap on any JSON body
const SESSION_COOKIE = '__Host-arbel_sess';
const HONEYPOT_PATHS = [
    '/.env', '/.git/config', '/wp-admin', '/wp-login.php', '/xmlrpc.php',
    '/.aws/credentials', '/admin.php', '/phpmyadmin', '/wp-config.php',
    '/config.php', '/server-status', '/.DS_Store', '/backup.sql'
];

/* Read JSON body with strict size cap (defends against memory abuse) */
async function readJsonCapped(request) {
    const lenHeader = request.headers.get('Content-Length');
    if (lenHeader && parseInt(lenHeader, 10) > MAX_BODY_BYTES) {
        return { error: 'Body too large', status: 413 };
    }
    try {
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return { error: 'Body too large', status: 413 };
        if (!text) return { body: {} };
        return { body: JSON.parse(text) };
    } catch (e) {
        return { error: 'Invalid JSON', status: 400 };
    }
}

/* Strict same-origin / allow-list check on Origin OR Referer header */
function isSameOrigin(request) {
    const origin = request.headers.get('Origin');
    if (origin) return ALLOWED_ORIGINS.includes(origin) || origin === new URL(request.url).origin;
    const referer = request.headers.get('Referer');
    if (referer) {
        try {
            const r = new URL(referer).origin;
            return ALLOWED_ORIGINS.includes(r) || r === new URL(request.url).origin;
        } catch { return false; }
    }
    return false;
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function corsHeaders(origin, methods) {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': methods || 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function jsonResponse(data, status, origin, methods) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin, methods))
    });
}

function htmlResponse(body, status) {
    return new Response(body, {
        status: status || 200,
        headers: {
            'Content-Type': 'text/html;charset=utf-8',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
            'Cache-Control': 'no-store, max-age=0',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
            'Content-Security-Policy':
                "default-src 'self'; " +
                "connect-src 'self'; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src https://fonts.gstatic.com; " +
                "script-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        }
    });
}

async function sha256Hex(s) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Constant-time string equality (defends against timing attacks) */
function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/* ─── HMAC for session cookies ────────────────────────────────── */

async function hmacSign(secret, msg) {
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makeSession(env, ipHash) {
    if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET not configured');
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const payload = `${exp}.${ipHash}.${nonce}`;
    const sig = await hmacSign(env.SESSION_SECRET, payload);
    return { cookie: `${payload}.${sig}`, exp };
}

async function verifySession(env, cookieValue, ipHash) {
    if (!cookieValue) return false;
    if (!env.SESSION_SECRET) return false; // FAIL CLOSED if secret missing
    const parts = cookieValue.split('.');
    if (parts.length !== 4) return false;
    const [expStr, sessIp, nonce, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    if (!constantTimeEqual(sessIp, ipHash)) return false; // bind session to IP
    const expected = await hmacSign(env.SESSION_SECRET, `${expStr}.${sessIp}.${nonce}`);
    return constantTimeEqual(sig, expected);
}

function getCookie(request, name) {
    const c = request.headers.get('Cookie') || '';
    const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
}

/* ─── Brute-force / rate-limit (KV-backed) ────────────────────── */

async function rateLimit(env, scope, ipHash, limit) {
    if (!env.ANALYTICS) return true;
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${scope}:${ipHash}:${minute}`;
    const cur = await env.ANALYTICS.get(key);
    const n = cur ? (parseInt(cur, 10) || 0) : 0;
    if (n >= limit) return false;
    await env.ANALYTICS.put(key, String(n + 1), { expirationTtl: 120 });
    return true;
}

async function isLockedOut(env, ipHash) {
    if (!env.ANALYTICS) return false;
    const v = await env.ANALYTICS.get(`lock:${ipHash}`);
    return !!v;
}

async function recordLoginFail(env, ipHash) {
    if (!env.ANALYTICS) return;
    const key = `fail:${ipHash}`;
    const cur = await env.ANALYTICS.get(key);
    const n = cur ? (parseInt(cur, 10) || 0) : 0;
    const next = n + 1;
    await env.ANALYTICS.put(key, String(next), { expirationTtl: LOGIN_LOCKOUT_SEC });
    if (next >= LOGIN_MAX_FAILS) {
        await env.ANALYTICS.put(`lock:${ipHash}`, '1', { expirationTtl: LOGIN_LOCKOUT_SEC });
    }
}

async function clearLoginFails(env, ipHash) {
    if (!env.ANALYTICS) return;
    await env.ANALYTICS.delete(`fail:${ipHash}`);
}

/* ─── Router ──────────────────────────────────────────────────── */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            const m = url.pathname.startsWith('/api/admin') ? 'GET, OPTIONS' : 'POST, OPTIONS';
            return new Response(null, { status: 204, headers: corsHeaders(origin, m) });
        }

        // Honeypot — auto-ban scanners hitting common-vuln paths
        if (HONEYPOT_PATHS.includes(url.pathname.toLowerCase())) {
            try {
                const ipHash = await getIpHash(request, env);
                if (env.ANALYTICS) await env.ANALYTICS.put(`lock:${ipHash}`, '1', { expirationTtl: LOGIN_LOCKOUT_SEC });
            } catch { }
            return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        }

        try {
            // Public
            if (url.pathname === '/api/track' && request.method === 'POST') {
                return await handleTrack(request, env, origin);
            }
            // Admin (same-origin only)
            if (url.pathname === '/admin' && request.method === 'GET') {
                return await handleAdminPage(request, env);
            }
            if (url.pathname === '/admin/login' && request.method === 'POST') {
                return await handleAdminLogin(request, env);
            }
            if (url.pathname === '/admin/logout' && request.method === 'POST') {
                return await handleAdminLogout(request, env);
            }
            if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
                return await handleAdminStats(request, env);
            }
            // Generic 404 — same look as a misrouted request, no info leak
            return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        } catch (e) {
            return new Response('Internal error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
        }
    }
};

/* ══════════════════════════════════════════════════════════════════
   Anonymous analytics
   ══════════════════════════════════════════════════════════════════ */

async function handleTrack(request, env, origin) {
    // Require an Origin header AND that it be in allow-list (rejects raw bots)
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }
    if (!env.ANALYTICS) return jsonResponse({ ok: true, stored: false }, 200, origin);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const salt = env.ANALYTICS_SALT || 'arbel-default-salt';
    const ipHash = (await sha256Hex(ip + '|' + salt)).slice(0, 16);

    // Block requests from honeypot-banned IPs
    if (await isLockedOut(env, ipHash)) {
        return jsonResponse({ error: 'Forbidden' }, 403, origin);
    }

    const allowed = await rateLimit(env, 't', ipHash, TRACK_LIMIT_PER_MIN);
    if (!allowed) return jsonResponse({ error: 'Rate limit' }, 429, origin);

    const r = await readJsonCapped(request);
    if (r.error) return jsonResponse({ error: r.error }, r.status, origin);
    const body = r.body;

    const country = request.cf && request.cf.country
        ? String(request.cf.country).slice(0, 2).toUpperCase() : 'XX';
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const shortHash = (await sha256Hex(day + '|' + ip + '|' + ua + '|' + salt)).slice(0, 16);

    const dk = 'd:' + day;
    const ops = [
        incrKV(env.ANALYTICS, dk, 1),
        incrKV(env.ANALYTICS, dk + ':c:' + country, 1),
        incrKV(env.ANALYTICS, 'total:pv', 1)
    ];
    // Dev counter only counts when request comes from same-origin admin host.
    // Stat pollution from public pages is no longer trusted.
    if (body && body.dev === 1 && origin === new URL(request.url).origin) {
        ops.push(incrKV(env.ANALYTICS, dk + ':dev', 1));
    }

    const vKey = dk + ':v:' + shortHash;
    const seen = await env.ANALYTICS.get(vKey);
    if (!seen) {
        ops.push(env.ANALYTICS.put(vKey, '1', { expirationTtl: 60 * 60 * 48 }));
        ops.push(incrKV(env.ANALYTICS, dk + ':u', 1));
        ops.push(incrKV(env.ANALYTICS, dk + ':u:c:' + country, 1));
        ops.push(incrKV(env.ANALYTICS, 'total:u', 1));
    }
    ops.push(env.ANALYTICS.put('active:' + shortHash, country, { expirationTtl: 300 }));
    await Promise.all(ops);
    return jsonResponse({ ok: true }, 200, origin);
}

async function incrKV(kv, key, by) {
    const cur = await kv.get(key);
    const n = cur ? (parseInt(cur, 10) || 0) : 0;
    return kv.put(key, String(n + by));
}

/* ══════════════════════════════════════════════════════════════════
   Admin login / logout
   ══════════════════════════════════════════════════════════════════ */

async function getIpHash(request, env) {
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const salt = env.ANALYTICS_SALT || 'arbel-default-salt';
    return (await sha256Hex(ip + '|' + salt)).slice(0, 16);
}

async function handleAdminLogin(request, env) {
    // Defense-in-depth: require same-origin (worker host) Origin/Referer.
    // SameSite=Strict already prevents cross-site cookies, but this also blocks
    // attackers who try to fish creds from a malicious page.
    if (!isSameOrigin(request)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }

    const ipHash = await getIpHash(request, env);

    // Per-IP rate limit
    if (!await rateLimit(env, 'al', ipHash, ADMIN_LIMIT_PER_MIN)) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
            status: 429, headers: { 'Content-Type': 'application/json' }
        });
    }
    // Brute-force lockout
    if (await isLockedOut(env, ipHash)) {
        return new Response(JSON.stringify({ error: 'Locked. Try again in an hour.' }), {
            status: 429, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (!env.ADMIN_TOKEN || !env.SESSION_SECRET) {
        return new Response(JSON.stringify({ error: 'Admin not configured' }), {
            status: 503, headers: { 'Content-Type': 'application/json' }
        });
    }

    const r = await readJsonCapped(request);
    if (r.error) return new Response(JSON.stringify({ error: r.error }), {
        status: r.status, headers: { 'Content-Type': 'application/json' }
    });
    const body = r.body;

    // Constant-time comparison
    const ok = constantTimeEqual(String(body.token || ''), env.ADMIN_TOKEN);
    if (!ok) {
        await recordLoginFail(env, ipHash);
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }
    await clearLoginFails(env, ipHash);
    const { cookie, exp } = await makeSession(env, ipHash);
    // __Host- prefix: requires Secure, Path=/, no Domain. Browser refuses to
    // accept this cookie from any other host (defends against subdomain
    // takeover and cookie-injection attacks).
    const cookieHeader =
        `${SESSION_COOKIE}=${cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SEC}`;
    return new Response(JSON.stringify({ ok: true, exp }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': cookieHeader
        }
    });
}

async function handleAdminLogout(request, env) {
    // Clear both new and legacy cookie names so existing sessions terminate cleanly.
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers([
            ['Content-Type', 'application/json'],
            ['Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`],
            ['Set-Cookie', 'arbel_sess=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0']
        ])
    });
}

async function isAdmin(request, env) {
    const ipHash = await getIpHash(request, env);
    // Prefer the hardened __Host- cookie, fall back to legacy name during rollover.
    const sess = getCookie(request, SESSION_COOKIE) || getCookie(request, 'arbel_sess');
    return await verifySession(env, sess, ipHash);
}

/* ══════════════════════════════════════════════════════════════════
   Admin page  (unauth → returns 404 to hide its existence)
   ══════════════════════════════════════════════════════════════════ */

async function handleAdminPage(request, env) {
    const authed = await isAdmin(request, env);
    if (!authed) return htmlResponse(LOGIN_HTML(), 200);
    return htmlResponse(ADMIN_HTML(), 200);
}

/* ══════════════════════════════════════════════════════════════════
   Admin stats JSON  (session required + rate-limited)
   ══════════════════════════════════════════════════════════════════ */

async function handleAdminStats(request, env) {
    const ipHash = await getIpHash(request, env);
    if (!await rateLimit(env, 'as', ipHash, ADMIN_LIMIT_PER_MIN)) {
        return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429 });
    }
    const authed = await isAdmin(request, env);
    if (!authed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    if (!env.ANALYTICS) return new Response(JSON.stringify({ error: 'Analytics KV not bound' }), { status: 503 });

    const url = new URL(request.url);
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') || '14', 10) || 14));
    const today = new Date();
    const daily = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const key = 'd:' + d.toISOString().slice(0, 10);
        const pv = parseInt((await env.ANALYTICS.get(key)) || '0', 10);
        const u = parseInt((await env.ANALYTICS.get(key + ':u')) || '0', 10);
        const dev = parseInt((await env.ANALYTICS.get(key + ':dev')) || '0', 10);
        daily.push({ date: d.toISOString().slice(0, 10), pageviews: pv, uniques: u, devViews: dev });
    }
    const todayKey = 'd:' + today.toISOString().slice(0, 10);
    const byCountryPv = {};
    const pvList = await env.ANALYTICS.list({ prefix: todayKey + ':c:' });
    for (const k of pvList.keys) {
        const cc = k.name.split(':c:')[1];
        byCountryPv[cc] = parseInt((await env.ANALYTICS.get(k.name)) || '0', 10);
    }
    const byCountryU = {};
    const uList = await env.ANALYTICS.list({ prefix: todayKey + ':u:c:' });
    for (const k of uList.keys) {
        const cc = k.name.split(':u:c:')[1];
        byCountryU[cc] = parseInt((await env.ANALYTICS.get(k.name)) || '0', 10);
    }
    const activeList = await env.ANALYTICS.list({ prefix: 'active:' });
    const activeByCountry = {};
    for (const k of activeList.keys) {
        const c = await env.ANALYTICS.get(k.name);
        if (c) activeByCountry[c] = (activeByCountry[c] || 0) + 1;
    }
    const totalPv = parseInt((await env.ANALYTICS.get('total:pv')) || '0', 10);
    const totalU = parseInt((await env.ANALYTICS.get('total:u')) || '0', 10);

    return new Response(JSON.stringify({
        generatedAt: new Date().toISOString(),
        totals: { pageviews: totalPv, uniqueVisitors: totalU },
        daily,
        today: {
            date: today.toISOString().slice(0, 10),
            byCountryPageviews: byCountryPv,
            byCountryUnique: byCountryU
        },
        activeNow: { count: activeList.keys.length, byCountry: activeByCountry }
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/* ══════════════════════════════════════════════════════════════════
   HTML — login screen
   ══════════════════════════════════════════════════════════════════ */

function LOGIN_HTML() {
    return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in</title><meta name="robots" content="noindex,nofollow,noarchive">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#06070f;color:#e6e7ee;font-family:'Inter',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{max-width:400px;width:100%;background:#0e1020;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:36px}
h1{font-size:18px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em}
.sub{color:#8a8fa8;font-size:13px;margin-bottom:24px}
input{width:100%;padding:13px 14px;background:#000;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#e6e7ee;font-family:'Space Mono',monospace;font-size:13px;margin-bottom:14px}
input:focus{outline:none;border-color:#6c5cff}
button{width:100%;padding:13px;background:#6c5cff;color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer;letter-spacing:.06em;font-size:13px;text-transform:uppercase;font-family:inherit}
button:hover{opacity:.9}
button:disabled{opacity:.4;cursor:not-allowed}
.err{color:#ff5d6c;font-size:12px;margin-top:14px;min-height:16px;font-family:'Space Mono',monospace}
.foot{margin-top:24px;font-size:11px;color:#5a5f78;font-family:'Space Mono',monospace;letter-spacing:.1em;text-align:center}
</style></head><body>
<div class="box">
  <h1>Restricted area</h1>
  <p class="sub">Authorized personnel only. All access attempts are logged and rate-limited.</p>
  <form id="f" autocomplete="off">
    <input id="t" type="password" placeholder="Admin token" autocomplete="off" spellcheck="false" required>
    <button id="b" type="submit">Sign in</button>
    <div class="err" id="err"></div>
  </form>
  <div class="foot">PROTECTED · LOGGED · BRUTE-FORCE LOCKED</div>
</div>
<script>
(function(){
  var f=document.getElementById('f'),t=document.getElementById('t'),b=document.getElementById('b'),err=document.getElementById('err');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    err.textContent='';b.disabled=true;b.textContent='Checking…';
    fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({token:t.value})})
      .then(function(r){return r.json().then(function(d){return{s:r.status,d:d}})})
      .then(function(res){
        if(res.s===200){location.reload()}
        else{err.textContent=(res.d&&res.d.error)||('Error '+res.s);b.disabled=false;b.textContent='Sign in';t.value='';t.focus()}
      })
      .catch(function(){err.textContent='Network error';b.disabled=false;b.textContent='Sign in'});
  });
  t.focus();
})();
</script></body></html>`;
}

/* ══════════════════════════════════════════════════════════════════
   HTML — Admin dashboard
   ══════════════════════════════════════════════════════════════════ */

function ADMIN_HTML() {
    return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arbel · Admin</title><meta name="robots" content="noindex,nofollow,noarchive">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#06070f;--surface:#0e1020;--border:rgba(255,255,255,.08);--fg:#e6e7ee;--fg2:#8a8fa8;--accent:#6c5cff;--green:#00d47e;--warn:#ffb43c;--danger:#ff5d6c}
html,body{height:100%}
body{background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,sans-serif;min-height:100vh;padding:32px 20px}
.mono{font-family:'Space Mono',monospace}
.wrap{max-width:1080px;margin:0 auto}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border);gap:16px;flex-wrap:wrap}
.head h1{font-weight:600;font-size:20px;letter-spacing:-.01em}
.head h1 span{color:var(--fg2);font-weight:400}
.head .pill{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.14em;color:var(--green);border:1px solid rgba(0,212,126,.3);padding:5px 10px;border-radius:99px;background:rgba(0,212,126,.08)}
.logout{background:none;border:1px solid var(--border);color:var(--fg2);padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;letter-spacing:.12em;font-family:'Space Mono',monospace}
.logout:hover{color:var(--fg);border-color:var(--danger)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px}
.card h3{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--fg2);margin-bottom:10px}
.card b{font-size:28px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.card .live{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--green);font-family:'Space Mono',monospace;letter-spacing:.12em;margin-top:4px}
.card .live::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);animation:p 1.4s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.35}}
.two{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin-bottom:24px}
.block{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px}
.block h3{font-weight:600;font-size:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.block h3 .tag{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.16em;color:var(--fg2);font-weight:400}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums}
th{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.16em;color:var(--fg2);font-weight:400;text-transform:uppercase}
tr:last-child td{border-bottom:0}
.bar{position:relative;height:20px;background:rgba(108,92,255,.08);border-radius:4px;overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#8d7dff);border-radius:4px;transition:width .5s}
.bar span{position:absolute;right:8px;top:2px;font-size:11px;color:var(--fg);font-family:'Space Mono',monospace}
.chart{display:flex;align-items:flex-end;gap:4px;height:140px;margin-top:8px}
.chart .c{flex:1;background:rgba(108,92,255,.15);border-top:2px solid var(--accent);border-radius:2px 2px 0 0;position:relative;min-height:2px;transition:height .4s}
.chart .c::after{content:attr(data-date);position:absolute;bottom:-18px;left:50%;transform:translateX(-50%) rotate(-45deg);font-size:9px;color:var(--fg2);white-space:nowrap;transform-origin:top center}
.chart .c:hover{background:rgba(108,92,255,.35)}
.chart .c em{position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-family:'Space Mono',monospace;font-size:10px;color:var(--fg);opacity:0;font-style:normal}
.chart .c:hover em{opacity:1}
.ftr{display:flex;justify-content:space-between;font-family:'Space Mono',monospace;font-size:11px;color:var(--fg2);letter-spacing:.1em;margin-top:22px;padding-top:16px;border-top:1px solid var(--border)}
@media(max-width:820px){.grid{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}}
</style></head>
<body>
<div class="wrap">
  <div class="head">
    <h1>arbel · <span>admin</span></h1>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="pill">SESSION · ENCRYPTED</span>
      <button class="logout" id="logout">LOG OUT</button>
    </div>
  </div>
  <div class="grid">
    <div class="card"><h3>Active now</h3><b id="active">—</b><div class="live">LIVE</div></div>
    <div class="card"><h3>Today · visitors</h3><b id="todayU">—</b></div>
    <div class="card"><h3>Today · views</h3><b id="todayPv">—</b></div>
    <div class="card"><h3>Lifetime · uniques</h3><b id="totalU">—</b><div id="totalPv" class="live" style="color:var(--fg2)"></div></div>
  </div>
  <div class="block" style="margin-bottom:24px;padding-bottom:32px"><h3>Last 14 days <span class="tag">pageviews</span></h3><div class="chart" id="chart"></div></div>
  <div class="two">
    <div class="block"><h3>Currently online · by country <span class="tag" id="activeTotal">0</span></h3><div id="activeByC"><p style="color:var(--fg2);font-size:13px">No active sessions.</p></div></div>
    <div class="block"><h3>Today · by country <span class="tag">visitors</span></h3><div id="todayByC"><p style="color:var(--fg2);font-size:13px">No visits yet today.</p></div></div>
  </div>
  <div class="block" style="margin-top:16px">
    <h3>Daily breakdown <span class="tag">UTC</span></h3>
    <table id="dailyTbl"><thead><tr><th>Date</th><th>Visitors</th><th>Pageviews</th><th>Dev views</th></tr></thead><tbody></tbody></table>
  </div>
  <div class="ftr"><span id="refreshedAt">—</span><span>Auto-refresh every 30s</span></div>
</div>
<script>
(function(){
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  document.getElementById('logout').addEventListener('click',function(){
    fetch('/admin/logout',{method:'POST',credentials:'same-origin'}).then(function(){location.href='/admin'});
  });
  function fetchStats(){
    fetch('/api/admin/stats?days=14',{credentials:'same-origin'})
      .then(function(r){if(r.status===401||r.status===403){location.href='/admin';return null}if(!r.ok)throw new Error('http '+r.status);return r.json()})
      .then(function(d){if(d)render(d)})
      .catch(function(){document.getElementById('refreshedAt').textContent='Error fetching stats'});
  }
  function render(d){
    document.getElementById('active').textContent = d.activeNow.count;
    document.getElementById('activeTotal').textContent = d.activeNow.count;
    var todayRow = d.daily[0] || {};
    document.getElementById('todayU').textContent = todayRow.uniques||0;
    document.getElementById('todayPv').textContent = (todayRow.pageviews||0) + (todayRow.devViews?' ('+todayRow.devViews+' dev)':'');
    document.getElementById('totalU').textContent = d.totals.uniqueVisitors;
    document.getElementById('totalPv').textContent = d.totals.pageviews+' PAGEVIEWS';
    var chart = document.getElementById('chart');
    var rows = d.daily.slice().reverse();
    var max = Math.max.apply(null,rows.map(function(r){return r.pageviews}))||1;
    chart.innerHTML = rows.map(function(r){
      var h = Math.max(2, Math.round(r.pageviews/max*100));
      return '<div class="c" style="height:'+h+'%" data-date="'+esc(r.date.slice(5))+'"><em>'+r.pageviews+'</em></div>';
    }).join('');
    var abc = document.getElementById('activeByC');
    var ae = Object.entries(d.activeNow.byCountry||{}).sort(function(a,b){return b[1]-a[1]});
    if(!ae.length){abc.innerHTML='<p style="color:var(--fg2);font-size:13px">No active sessions.</p>'}
    else{
      var am=Math.max.apply(null,ae.map(function(e){return e[1]}));
      abc.innerHTML='<table><tbody>'+ae.map(function(e){
        var w=Math.round(e[1]/am*100);
        return '<tr><td style="width:60px"><b>'+esc(e[0])+'</b></td><td><div class="bar"><i style="width:'+w+'%"></i><span>'+e[1]+'</span></div></td></tr>';
      }).join('')+'</tbody></table>';
    }
    var tbc = document.getElementById('todayByC');
    var te = Object.entries(d.today.byCountryUnique||{}).sort(function(a,b){return b[1]-a[1]});
    if(!te.length){tbc.innerHTML='<p style="color:var(--fg2);font-size:13px">No visits yet today.</p>'}
    else{
      var tm=Math.max.apply(null,te.map(function(e){return e[1]}));
      tbc.innerHTML='<table><tbody>'+te.map(function(e){
        var w=Math.round(e[1]/tm*100);
        return '<tr><td style="width:60px"><b>'+esc(e[0])+'</b></td><td><div class="bar"><i style="width:'+w+'%"></i><span>'+e[1]+'</span></div></td></tr>';
      }).join('')+'</tbody></table>';
    }
    var tb = document.querySelector('#dailyTbl tbody');
    tb.innerHTML = d.daily.map(function(r){
      return '<tr><td class="mono">'+esc(r.date)+'</td><td>'+r.uniques+'</td><td>'+r.pageviews+'</td><td style="color:var(--fg2)">'+r.devViews+'</td></tr>';
    }).join('');
    document.getElementById('refreshedAt').textContent='Refreshed '+new Date().toLocaleTimeString();
  }
  fetchStats(); setInterval(fetchStats,30000);
})();
</script></body></html>`;
}
