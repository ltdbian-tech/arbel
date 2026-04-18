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
