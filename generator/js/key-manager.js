/* ═══════════════════════════════════════════════
   KEY MANAGER — Secure BYOK API Key Storage
   
   SAFETY RULES:
   - Key stored in localStorage (browser-only)
   - Never logged to console
   - Never sent to analytics
   - Never included in generated site code
   - Displayed masked in UI
   - Removable with one click
   ═══════════════════════════════════════════════ */

window.ArbelKeyManager = (function () {
    'use strict';

    const STORAGE_PREFIX = 'arbel_ai_';

    function _getStorageKey(name) {
        return STORAGE_PREFIX + name;
    }

    /** Save an API key to localStorage */
    function saveKey(provider, key) {
        if (!key || typeof key !== 'string' || key.trim().length < 10) return false;
        try {
            localStorage.setItem(_getStorageKey('provider'), provider);
            localStorage.setItem(_getStorageKey('key'), key.trim());
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Retrieve the raw key — ONLY call this from ai.js for API requests */
    function getKey() {
        try {
            return localStorage.getItem(_getStorageKey('key')) || null;
        } catch (e) {
            return null;
        }
    }

    /** Get the provider name */
    function getProvider() {
        try {
            return localStorage.getItem(_getStorageKey('provider')) || 'groq';
        } catch (e) {
            return 'groq';
        }
    }

    /** Get a masked version of the key for display in UI */
    function getMaskedKey() {
        var key = getKey();
        if (!key) return '';
        if (key.length <= 12) return '••••••••••••';
        return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
    }

    /** Check if a key exists */
    function hasKey() {
        return !!getKey();
    }

    /** Remove the key from storage */
    function removeKey() {
        try {
            localStorage.removeItem(_getStorageKey('key'));
            localStorage.removeItem(_getStorageKey('provider'));
        } catch (e) {
            // silent fail
        }
    }

    // Public API — deliberately minimal to limit exposure
    return {
        saveKey: saveKey,
        getKey: getKey,
        getProvider: getProvider,
        getMaskedKey: getMaskedKey,
        hasKey: hasKey,
        removeKey: removeKey
    };
})();
