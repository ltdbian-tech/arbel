/* ══════════════════════════════════════════════════════════════════
   Arbel Worker  ·  arbel-auth.ltdb.workers.dev
   --------------------------------------------------------------
   Routes
     POST /api/auth/callback   GitHub OAuth code exchange (public)
     POST /api/track           Anonymous analytics (rate-limited)
     GET  /admin               Admin dashboard HTML  (CF Access gated)
     GET  /api/admin/stats     Admin analytics JSON  (CF Access gated)

   Security
     · CORS origin allow-list
     · /api/track is rate-limited per hashed-IP (KV bucket)
     · /admin and /api/admin/* require a valid Cloudflare Access JWT
       (verified against team JWKS, audience and issuer checked)
     · Admin endpoints also have a per-IP rate limit as defence-in-depth
     · No raw IPs stored anywhere; only 16-char salted SHA-256 prefixes
   ══════════════════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
    'https://arbel.live',
    'https://www.arbel.live',
    'https://arbeltechnologies.github.io'
];

const TRACK_LIMIT_PER_MIN = 30;   // max /api/track per minute per IP
const ADMIN_LIMIT_PER_MIN = 60;   // max /api/admin/* per minute per IP

/* ─── CORS / response helpers ─────────────────────────────────── */

function corsHeaders(origin, methods) {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': methods || 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
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

/* ─── Router ──────────────────────────────────────────────────── */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            const m = url.pathname.startsWith('/api/admin') ? 'GET, OPTIONS' : 'POST, OPTIONS';
            return new Response(null, { status: 204, headers: corsHeaders(origin, m) });
        }

        try {
            if (url.pathname === '/api/auth/callback' && request.method === 'POST') {
                return await handleCallback(request, env, origin);
            }
            if (url.pathname === '/api/track' && request.method === 'POST') {
                return await handleTrack(request, env, origin);
            }
            if (url.pathname === '/admin' && request.method === 'GET') {
                return await handleAdminPage(request, env);
            }
            if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
                return await handleAdminStats(request, env, origin);
            }
            return jsonResponse({ error: 'Not found' }, 404, origin);
        } catch (e) {
            return jsonResponse({ error: 'Internal error' }, 500, origin);
        }
    }
};

/* ══════════════════════════════════════════════════════════════════
   GitHub OAuth callback (unchanged behaviour)
   ══════════════════════════════════════════════════════════════════ */

async function handleCallback(request, env, origin) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'Invalid body' }, 400, origin); }

    const code = body.code;
    if (!code || typeof code !== 'string' || code.length > 200 || !/^[a-f0-9]+$/.test(code)) {
        return jsonResponse({ error: 'Invalid authorization code' }, 400, origin);
    }

    try {
        const r = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code
            })
        });
        if (!r.ok) return jsonResponse({ error: 'GitHub token exchange failed' }, 502, origin);
        const data = await r.json();
        if (data.error) return jsonResponse({ error: data.error_description || data.error }, 400, origin);
        if (!data.access_token) return jsonResponse({ error: 'Invalid token response' }, 502, origin);
        return jsonResponse({ access_token: data.access_token }, 200, origin);
    } catch {
        return jsonResponse({ error: 'Failed to contact GitHub' }, 502, origin);
    }
}

/* ══════════════════════════════════════════════════════════════════
   Rate limiting (KV sliding-minute bucket, per hashed IP)
   Returns true if the request should be allowed.
   ══════════════════════════════════════════════════════════════════ */

async function rateLimit(env, scope, ipHash, limit) {
    if (!env.ANALYTICS) return true; // KV not bound yet — don't block
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${scope}:${ipHash}:${minute}`;
    const cur = await env.ANALYTICS.get(key);
    const n = cur ? (parseInt(cur, 10) || 0) : 0;
    if (n >= limit) return false;
    await env.ANALYTICS.put(key, String(n + 1), { expirationTtl: 120 });
    return true;
}

/* ══════════════════════════════════════════════════════════════════
   Anonymous analytics
   ══════════════════════════════════════════════════════════════════ */

async function handleTrack(request, env, origin) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }
    if (!env.ANALYTICS) return jsonResponse({ ok: true, stored: false }, 200, origin);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';
    const salt = env.ANALYTICS_SALT || 'arbel-default-salt';
    const ipHash = (await sha256Hex(ip + '|' + salt)).slice(0, 16);

    // Rate limit BEFORE any body read / heavy work
    const allowed = await rateLimit(env, 't', ipHash, TRACK_LIMIT_PER_MIN);
    if (!allowed) return jsonResponse({ error: 'Rate limit' }, 429, origin);

    let body = {};
    try { body = await request.json(); } catch { }

    const country = request.cf && request.cf.country
        ? String(request.cf.country).slice(0, 2).toUpperCase()
        : 'XX';
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const shortHash = (await sha256Hex(day + '|' + ip + '|' + ua + '|' + salt)).slice(0, 16);

    const dk = 'd:' + day;
    const ops = [
        incrKV(env.ANALYTICS, dk, 1),
        incrKV(env.ANALYTICS, dk + ':c:' + country, 1),
        incrKV(env.ANALYTICS, 'total:pv', 1)
    ];
    if (body && body.dev === 1) ops.push(incrKV(env.ANALYTICS, dk + ':dev', 1));

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

async function sha256Hex(s) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ══════════════════════════════════════════════════════════════════
   Cloudflare Access JWT verification
   --------------------------------------------------------------
   Requires env vars (set via wrangler secret put):
     CF_ACCESS_TEAM_DOMAIN   e.g.  mycompany  (the bit before .cloudflareaccess.com)
     CF_ACCESS_AUD           application audience tag from CF Access UI
   ══════════════════════════════════════════════════════════════════ */

let _jwks = null;
let _jwksFetchedAt = 0;
const JWKS_TTL_MS = 30 * 60 * 1000; // 30 min

async function getJwks(teamDomain) {
    const now = Date.now();
    if (_jwks && (now - _jwksFetchedAt) < JWKS_TTL_MS) return _jwks;
    const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
    const r = await fetch(url, { cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!r.ok) throw new Error('JWKS fetch failed');
    _jwks = await r.json();
    _jwksFetchedAt = now;
    return _jwks;
}

function b64urlToUint8(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function b64urlToJson(s) {
    return JSON.parse(new TextDecoder().decode(b64urlToUint8(s)));
}

async function verifyAccessJwt(token, env) {
    if (!token || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let header, payload;
    try {
        header = b64urlToJson(parts[0]);
        payload = b64urlToJson(parts[1]);
    } catch { return null; }

    // Standard checks
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now) return null;
    const expectedIss = `https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`;
    if (payload.iss !== expectedIss) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(env.CF_ACCESS_AUD)) return null;

    // Find key by kid
    const jwks = await getJwks(env.CF_ACCESS_TEAM_DOMAIN);
    const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const sig = b64urlToUint8(parts[2]);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
    return ok ? payload : null;
}

async function requireAdmin(request, env) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion')
        || getCookie(request, 'CF_Authorization');
    const payload = await verifyAccessJwt(token, env);
    return payload; // null if not authorised
}

function getCookie(request, name) {
    const c = request.headers.get('Cookie') || '';
    const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
}

/* ══════════════════════════════════════════════════════════════════
   Admin page (CF Access protected)
   ══════════════════════════════════════════════════════════════════ */

async function handleAdminPage(request, env) {
    // Cloudflare Access will usually intercept before the request reaches the
    // Worker. This JWT check is a belt-and-braces defence in case Access is
    // mis-configured or someone reaches the raw worker URL.
    const payload = await requireAdmin(request, env);
    if (!payload) {
        const teamDomain = env.CF_ACCESS_TEAM_DOMAIN || '';
        const msg = teamDomain
            ? 'Access required. Please sign in at your Cloudflare Access login.'
            : 'Admin not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.';
        return new Response(`<!doctype html><meta charset=utf-8><title>Forbidden</title>
<style>body{background:#06070f;color:#e6e7ee;font-family:system-ui;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
h1{font-size:72px;margin:0;color:#ff5d6c}p{color:#8a8fa8;max-width:480px;line-height:1.6}</style>
<h1>403</h1><p>${msg}</p>`,
            { status: 403, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }
    return new Response(ADMIN_HTML(payload), {
        status: 200,
        headers: {
            'Content-Type': 'text/html;charset=utf-8',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Cache-Control': 'no-store',
            'Content-Security-Policy':
                "default-src 'self'; " +
                "connect-src 'self'; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src https://fonts.gstatic.com; " +
                "script-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        }
    });
}

/* ══════════════════════════════════════════════════════════════════
   Admin stats JSON  (CF Access protected + rate-limited)
   ══════════════════════════════════════════════════════════════════ */

async function handleAdminStats(request, env, origin) {
    const payload = await requireAdmin(request, env);
    if (!payload) return jsonResponse({ error: 'Unauthorized' }, 401, origin, 'GET, OPTIONS');
    if (!env.ANALYTICS) return jsonResponse({ error: 'Analytics KV not bound' }, 503, origin, 'GET, OPTIONS');

    // Belt-and-braces rate limit even for authed admins
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const salt = env.ANALYTICS_SALT || 'arbel-default-salt';
    const ipHash = (await sha256Hex(ip + '|' + salt)).slice(0, 16);
    const ok = await rateLimit(env, 'a', ipHash, ADMIN_LIMIT_PER_MIN);
    if (!ok) return jsonResponse({ error: 'Rate limit' }, 429, origin, 'GET, OPTIONS');

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

    return jsonResponse({
        generatedAt: new Date().toISOString(),
        signedInAs: payload.email || payload.sub || null,
        totals: { pageviews: totalPv, uniqueVisitors: totalU },
        daily,
        today: {
            date: today.toISOString().slice(0, 10),
            byCountryPageviews: byCountryPv,
            byCountryUnique: byCountryU
        },
        activeNow: { count: activeList.keys.length, byCountry: activeByCountry }
    }, 200, origin, 'GET, OPTIONS');
}

/* ══════════════════════════════════════════════════════════════════
   Embedded Admin HTML  (same look as the old page, minus login form)
   ══════════════════════════════════════════════════════════════════ */

function ADMIN_HTML(payload) {
    const who = (payload && (payload.email || payload.sub)) || 'admin';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arbel · Admin</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
.head .who{font-family:'Space Mono',monospace;font-size:11px;color:var(--fg2);letter-spacing:.1em}
.head .pill{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.14em;color:var(--green);border:1px solid rgba(0,212,126,.3);padding:5px 10px;border-radius:99px;background:rgba(0,212,126,.08)}
.logout{background:none;border:1px solid var(--border);color:var(--fg2);padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;letter-spacing:.12em;font-family:'Space Mono',monospace;text-decoration:none;display:inline-block}
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
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>arbel · <span>admin</span></h1>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="who">${escapeHtml(who)}</span>
      <span class="pill">CF ACCESS · SECURED</span>
      <a class="logout" href="/cdn-cgi/access/logout">LOG OUT</a>
    </div>
  </div>

  <div class="grid">
    <div class="card"><h3>Active now</h3><b id="active">—</b><div class="live">LIVE</div></div>
    <div class="card"><h3>Today · visitors</h3><b id="todayU">—</b></div>
    <div class="card"><h3>Today · views</h3><b id="todayPv">—</b></div>
    <div class="card"><h3>Lifetime · uniques</h3><b id="totalU">—</b><div id="totalPv" class="live" style="color:var(--fg2)"></div></div>
  </div>

  <div class="block" style="margin-bottom:24px;padding-bottom:32px">
    <h3>Last 14 days <span class="tag">pageviews</span></h3>
    <div class="chart" id="chart"></div>
  </div>

  <div class="two">
    <div class="block">
      <h3>Currently online · by country <span class="tag" id="activeTotal">0</span></h3>
      <div id="activeByC"><p style="color:var(--fg2);font-size:13px">No active sessions.</p></div>
    </div>
    <div class="block">
      <h3>Today · by country <span class="tag">visitors</span></h3>
      <div id="todayByC"><p style="color:var(--fg2);font-size:13px">No visits yet today.</p></div>
    </div>
  </div>

  <div class="block" style="margin-top:16px">
    <h3>Daily breakdown <span class="tag">UTC</span></h3>
    <table id="dailyTbl">
      <thead><tr><th>Date</th><th>Visitors</th><th>Pageviews</th><th>Dev views</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div class="ftr">
    <span id="refreshedAt">—</span>
    <span>Auto-refresh every 30s</span>
  </div>
</div>

<script>
(function(){
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function fetchStats(){
    fetch('/api/admin/stats?days=14',{credentials:'include'})
      .then(function(r){if(r.status===401||r.status===403){location.reload();return null}if(!r.ok)throw new Error('http '+r.status);return r.json()})
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
  fetchStats();
  setInterval(fetchStats,30000);
})();
</script>
</body>
</html>`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
var ALLOWED_ORIGINS = [
    'https://arbel.live',
    'https://www.arbel.live',
    'https://arbeltechnologies.github.io'
];

function corsHeaders(origin, methods) {
    var allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

export default {
    async fetch(request, env) {
        var url = new URL(request.url);
        var origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            var allowMethods = url.pathname.indexOf('/api/admin') === 0 ? 'GET, OPTIONS' : 'POST, OPTIONS';
            return new Response(null, { status: 204, headers: corsHeaders(origin, allowMethods) });
        }

        if (url.pathname === '/api/auth/callback' && request.method === 'POST') {
            return handleCallback(request, env, origin);
        }

        if (url.pathname === '/api/track' && request.method === 'POST') {
            return handleTrack(request, env, origin);
        }

        if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
            return handleAdminStats(request, env, origin);
        }

        return jsonResponse({ error: 'Not found' }, 404, origin);
    }
};

/* ═══════════════════════════════════════════
   GitHub OAuth callback (unchanged)
   ═══════════════════════════════════════════ */
async function handleCallback(request, env, origin) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }

    var body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonResponse({ error: 'Invalid request body' }, 400, origin);
    }

    var code = body.code;
    if (!code || typeof code !== 'string' || code.length > 200 || !/^[a-f0-9]+$/.test(code)) {
        return jsonResponse({ error: 'Invalid authorization code' }, 400, origin);
    }

    try {
        var resp = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: code
            })
        });

        if (!resp.ok) {
            return jsonResponse({ error: 'GitHub token exchange failed' }, 502, origin);
        }

        var data = await resp.json();

        if (data.error) {
            return jsonResponse({ error: data.error_description || data.error }, 400, origin);
        }

        if (!data.access_token || typeof data.access_token !== 'string') {
            return jsonResponse({ error: 'Invalid token response from GitHub' }, 502, origin);
        }

        return jsonResponse({ access_token: data.access_token }, 200, origin);
    } catch (e) {
        return jsonResponse({ error: 'Failed to contact GitHub' }, 502, origin);
    }
}

/* ═══════════════════════════════════════════
   Anonymous analytics — stored in Cloudflare KV
   Namespace binding expected: env.ANALYTICS
   ═══════════════════════════════════════════ */
async function handleTrack(request, env, origin) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }
    if (!env.ANALYTICS) {
        // KV not bound yet — succeed silently so client never sees an error
        return jsonResponse({ ok: true, stored: false }, 200, origin);
    }

    var body = {};
    try { body = await request.json(); } catch (e) { }

    var country = request.cf && request.cf.country ? String(request.cf.country).slice(0, 2).toUpperCase() : 'XX';
    var ip = request.headers.get('CF-Connecting-IP') || '';
    var ua = request.headers.get('User-Agent') || '';
    var now = new Date();
    var day = now.toISOString().slice(0, 10);
    var salt = env.ANALYTICS_SALT || 'arbel-default-salt';
    var hash = await sha256Hex(day + '|' + ip + '|' + ua + '|' + salt);
    var shortHash = hash.slice(0, 16);

    var dk = 'd:' + day;
    var ops = [];

    ops.push(incrKV(env.ANALYTICS, dk, 1));
    ops.push(incrKV(env.ANALYTICS, dk + ':c:' + country, 1));
    ops.push(incrKV(env.ANALYTICS, 'total:pv', 1));
    if (body && body.dev === 1) ops.push(incrKV(env.ANALYTICS, dk + ':dev', 1));

    var vKey = dk + ':v:' + shortHash;
    var seen = await env.ANALYTICS.get(vKey);
    if (!seen) {
        ops.push(env.ANALYTICS.put(vKey, '1', { expirationTtl: 60 * 60 * 48 }));
        ops.push(incrKV(env.ANALYTICS, dk + ':u', 1));
        ops.push(incrKV(env.ANALYTICS, dk + ':u:c:' + country, 1));
        ops.push(incrKV(env.ANALYTICS, 'total:u', 1));
    }

    // Currently-online marker (5-minute TTL)
    ops.push(env.ANALYTICS.put('active:' + shortHash, country, { expirationTtl: 300 }));

    await Promise.all(ops);
    return jsonResponse({ ok: true }, 200, origin);
}

async function incrKV(kv, key, by) {
    var cur = await kv.get(key);
    var n = cur ? parseInt(cur, 10) || 0 : 0;
    return kv.put(key, String(n + by));
}

async function sha256Hex(s) {
    var buf = new TextEncoder().encode(s);
    var d = await crypto.subtle.digest('SHA-256', buf);
    var arr = Array.from(new Uint8Array(d));
    return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/* ═══════════════════════════════════════════
   Admin stats — gated by bearer token
   Set secret: wrangler secret put ADMIN_TOKEN
   Call: GET /api/admin/stats?days=14
     Header: Authorization: Bearer <ADMIN_TOKEN>
   ═══════════════════════════════════════════ */
async function handleAdminStats(request, env, origin) {
    var auth = request.headers.get('Authorization') || '';
    var token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, 'GET, OPTIONS');
    }
    if (!env.ANALYTICS) {
        return jsonResponse({ error: 'Analytics KV not bound' }, 503, origin, 'GET, OPTIONS');
    }

    var url = new URL(request.url);
    var days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') || '14', 10) || 14));

    var today = new Date();
    var daily = [];
    for (var i = 0; i < days; i++) {
        var d = new Date(today.getTime() - i * 86400000);
        var key = 'd:' + d.toISOString().slice(0, 10);
        var pv = parseInt((await env.ANALYTICS.get(key)) || '0', 10);
        var u = parseInt((await env.ANALYTICS.get(key + ':u')) || '0', 10);
        var dev = parseInt((await env.ANALYTICS.get(key + ':dev')) || '0', 10);
        daily.push({ date: d.toISOString().slice(0, 10), pageviews: pv, uniques: u, devViews: dev });
    }

    var todayKey = 'd:' + today.toISOString().slice(0, 10);
    var countryToday = {};
    var listCtr = await env.ANALYTICS.list({ prefix: todayKey + ':c:' });
    for (var j = 0; j < listCtr.keys.length; j++) {
        var k = listCtr.keys[j].name;
        var cc = k.split(':c:')[1];
        countryToday[cc] = parseInt((await env.ANALYTICS.get(k)) || '0', 10);
    }
    var countryTodayUnique = {};
    var listCtrU = await env.ANALYTICS.list({ prefix: todayKey + ':u:c:' });
    for (var jj = 0; jj < listCtrU.keys.length; jj++) {
        var kk = listCtrU.keys[jj].name;
        var ccu = kk.split(':u:c:')[1];
        countryTodayUnique[ccu] = parseInt((await env.ANALYTICS.get(kk)) || '0', 10);
    }

    var activeList = await env.ANALYTICS.list({ prefix: 'active:' });
    var activeCountries = {};
    for (var a = 0; a < activeList.keys.length; a++) {
        var cCode = await env.ANALYTICS.get(activeList.keys[a].name);
        if (cCode) activeCountries[cCode] = (activeCountries[cCode] || 0) + 1;
    }

    var totalPv = parseInt((await env.ANALYTICS.get('total:pv')) || '0', 10);
    var totalU = parseInt((await env.ANALYTICS.get('total:u')) || '0', 10);

    return jsonResponse({
        generatedAt: new Date().toISOString(),
        totals: { pageviews: totalPv, uniqueVisitors: totalU },
        daily: daily,
        today: {
            date: today.toISOString().slice(0, 10),
            byCountryPageviews: countryToday,
            byCountryUnique: countryTodayUnique
        },
        activeNow: {
            count: activeList.keys.length,
            byCountry: activeCountries
        }
    }, 200, origin, 'GET, OPTIONS');
}
var ALLOWED_ORIGINS = [
    'https://arbel.live',
    'https://www.arbel.live',
    'https://arbeltechnologies.github.io'
];

function corsHeaders(origin) {
    var allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function jsonResponse(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
    });
}

export default {
    async fetch(request, env) {
        var url = new URL(request.url);
        var origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (url.pathname === '/api/auth/callback' && request.method === 'POST') {
            return handleCallback(request, env, origin);
        }

        return jsonResponse({ error: 'Not found' }, 404, origin);
    }
};

async function handleCallback(request, env, origin) {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }

    var body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonResponse({ error: 'Invalid request body' }, 400, origin);
    }

    var code = body.code;
    if (!code || typeof code !== 'string' || code.length > 200 || !/^[a-f0-9]+$/.test(code)) {
        return jsonResponse({ error: 'Invalid authorization code' }, 400, origin);
    }

    try {
        var resp = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code: code
            })
        });

        if (!resp.ok) {
            return jsonResponse({ error: 'GitHub token exchange failed' }, 502, origin);
        }

        var data = await resp.json();

        if (data.error) {
            return jsonResponse({ error: data.error_description || data.error }, 400, origin);
        }

        if (!data.access_token || typeof data.access_token !== 'string') {
            return jsonResponse({ error: 'Invalid token response from GitHub' }, 502, origin);
        }

        // Only return the token — never forward scope, token_type, or other metadata
        return jsonResponse({ access_token: data.access_token }, 200, origin);
    } catch (e) {
        return jsonResponse({ error: 'Failed to contact GitHub' }, 502, origin);
    }
}
