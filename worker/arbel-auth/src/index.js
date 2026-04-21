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
var ALLOWED_ORIGINS = [
    'https://arbel.live',
    'https://www.arbel.live',
    'https://arbeltechnologies.github.io'
];

/* ─── Per-IP rate limit ───────────────────────────────────────────
 * Cloudflare Workers persist module-scope state within a single isolate,
 * so this map acts as a "best-effort" rate limit across warm invocations
 * on the same edge node.  It is NOT cluster-wide — an attacker hitting
 * many PoPs can still get more attempts — but it bounds the damage a
 * single botnet node can do to our GitHub OAuth app's rate limits without
 * requiring a KV binding (which would need a separate deploy step).
 *
 * Limits: 20 callback attempts per IP per minute.  A legitimate user
 * completes OAuth in 1 request; 20 is plenty of slack for retries. */
var RL_WINDOW_MS = 60 * 1000;
var RL_MAX = 20;
var _rlMap = new Map(); // ip -> { count, resetAt }

function _rlCheck(ip) {
    if (!ip) return true; // no IP header → fail open (extremely rare on CF)
    var now = Date.now();
    // Opportunistic GC — keep the map bounded.
    if (_rlMap.size > 10000) {
        for (var k of _rlMap.keys()) {
            if (_rlMap.get(k).resetAt < now) _rlMap.delete(k);
            if (_rlMap.size < 5000) break;
        }
    }
    var entry = _rlMap.get(ip);
    if (!entry || entry.resetAt < now) {
        _rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
        return true;
    }
    if (entry.count >= RL_MAX) return false;
    entry.count++;
    return true;
}

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
    // Require a known origin (no anonymous bots; prevents code-replay from
    // attacker-controlled domains that don't send Origin).
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
    }

    // Per-IP rate limit — stops a single attacker from burning our GitHub
    // OAuth app's rate budget with bogus codes (would cause outage for real
    // users).  Check the IP BEFORE doing any work.
    var ip = request.headers.get('CF-Connecting-IP') || '';
    if (!_rlCheck(ip)) {
        return jsonResponse({ error: 'Too many requests' }, 429, origin);
    }

    // Strict 4 KB body cap (defense vs. memory abuse / log spam).
    var lenHeader = request.headers.get('Content-Length');
    if (lenHeader && parseInt(lenHeader, 10) > 4096) {
        return jsonResponse({ error: 'Body too large' }, 413, origin);
    }

    var body;
    try {
        var text = await request.text();
        if (text.length > 4096) {
            return jsonResponse({ error: 'Body too large' }, 413, origin);
        }
        body = JSON.parse(text);
    } catch (e) {
        return jsonResponse({ error: 'Invalid request body' }, 400, origin);
    }

    var code = body.code;
    if (!code || typeof code !== 'string' || code.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(code)) {
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
