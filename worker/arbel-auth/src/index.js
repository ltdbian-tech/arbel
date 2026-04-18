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
