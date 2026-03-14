/* ═══════════════════════════════════════════════
   AUTH — GitHub Authentication
   
   Two methods:
   1. OAuth (primary) — User clicks "Sign in with GitHub",
      redirected to GitHub, token exchanged via Cloudflare Worker
   2. PAT (advanced) — User pastes a personal access token
   
   Token stored in sessionStorage (cleared on tab close).
   Never sent to any server except GitHub API.
   ═══════════════════════════════════════════════ */

window.ArbelAuth = (function () {
    'use strict';

    var TOKEN_KEY = 'arbel_gh_token';
    var OAUTH_STATE_KEY = 'arbel_oauth_state';
    var _cachedUser = null;

    // OAuth config — update CLIENT_ID after registering your GitHub OAuth App
    var OAUTH_CONFIG = {
        clientId: 'YOUR_GITHUB_CLIENT_ID',  // Replace after creating GitHub OAuth App
        workerUrl: 'https://arbel-auth.workers.dev',
        redirectUri: window.location.origin + '/generator/',
        scope: 'public_repo'
    };

    /** Generate a random state string for CSRF protection */
    function _generateState() {
        var array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    /** Start OAuth flow — redirect to GitHub */
    function startOAuth() {
        var state = _generateState();
        try {
            sessionStorage.setItem(OAUTH_STATE_KEY, state);
        } catch (e) { /* silent */ }

        var url = 'https://github.com/login/oauth/authorize' +
            '?client_id=' + encodeURIComponent(OAUTH_CONFIG.clientId) +
            '&redirect_uri=' + encodeURIComponent(OAUTH_CONFIG.redirectUri) +
            '&scope=' + encodeURIComponent(OAUTH_CONFIG.scope) +
            '&state=' + encodeURIComponent(state);

        window.location.href = url;
    }

    /** Handle OAuth callback — exchange code for token via Worker */
    async function handleOAuthCallback() {
        var params = new URLSearchParams(window.location.search);
        var code = params.get('code');
        var state = params.get('state');

        if (!code) return { handled: false };

        // Verify state to prevent CSRF
        var savedState;
        try {
            savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
            sessionStorage.removeItem(OAUTH_STATE_KEY);
        } catch (e) { /* silent */ }

        if (!state || state !== savedState) {
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            return { handled: true, success: false, error: 'Security check failed. Please try again.' };
        }

        // Exchange code for token via Cloudflare Worker
        try {
            var resp = await fetch(OAUTH_CONFIG.workerUrl + '/api/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });

            if (!resp.ok) {
                var errData = await resp.json().catch(function() { return {}; });
                window.history.replaceState({}, '', window.location.pathname);
                return { handled: true, success: false, error: errData.error || 'Authentication failed.' };
            }

            var data = await resp.json();
            if (!data.access_token) {
                window.history.replaceState({}, '', window.location.pathname);
                return { handled: true, success: false, error: 'No token received.' };
            }

            // Save token and validate
            saveToken(data.access_token);
            var validation = await validateToken(data.access_token);

            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);

            if (validation.valid) {
                return { handled: true, success: true, user: validation.user };
            } else {
                logout();
                return { handled: true, success: false, error: validation.error };
            }
        } catch (e) {
            window.history.replaceState({}, '', window.location.pathname);
            return { handled: true, success: false, error: 'Network error. Please try again.' };
        }
    }

    /** Store the GitHub token in sessionStorage */
    function saveToken(token) {
        if (!token || typeof token !== 'string') return false;
        var t = token.trim();
        if (t.length < 10) return false;
        try {
            sessionStorage.setItem(TOKEN_KEY, t);
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Retrieve the stored token */
    function getToken() {
        try {
            return sessionStorage.getItem(TOKEN_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    /** Check if authenticated */
    function isAuthenticated() {
        return !!getToken();
    }

    /** Clear the token */
    function logout() {
        try {
            sessionStorage.removeItem(TOKEN_KEY);
            _cachedUser = null;
        } catch (e) {
            // silent
        }
    }

    /** Validate token by calling GitHub API and return user info */
    async function validateToken(token) {
        var t = token || getToken();
        if (!t) return { valid: false, error: 'No token provided' };

        try {
            var resp = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': 'Bearer ' + t,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!resp.ok) {
                if (resp.status === 401) return { valid: false, error: 'Invalid token. Please check and try again.' };
                return { valid: false, error: 'GitHub API error (' + resp.status + ')' };
            }

            var user = await resp.json();
            _cachedUser = {
                login: user.login,
                name: user.name || user.login,
                avatar: user.avatar_url,
                url: user.html_url
            };

            return { valid: true, user: _cachedUser };
        } catch (e) {
            return { valid: false, error: 'Network error. Check your connection.' };
        }
    }

    /** Get cached user info */
    function getUser() {
        return _cachedUser;
    }

    return {
        startOAuth: startOAuth,
        handleOAuthCallback: handleOAuthCallback,
        saveToken: saveToken,
        getToken: getToken,
        isAuthenticated: isAuthenticated,
        logout: logout,
        validateToken: validateToken,
        getUser: getUser
    };
})();
})();
