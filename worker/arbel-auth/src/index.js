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
