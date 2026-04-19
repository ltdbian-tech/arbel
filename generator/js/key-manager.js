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
/* ═══════════════════════════════════════════════
   KEY MANAGER — Secure BYOK API Key Storage
   
   Supports multiple providers:
   - text:  Groq / Gemini (copy generation)
   - video: Replicate / Runway / Kling / Luma / OpenAI
   - image: Replicate / Stability / OpenAI
   
   SAFETY RULES:
   - Keys stored in localStorage (browser-only)
   - Never logged to console
   - Never sent to analytics
   - Never included in generated site code
   - Displayed masked in UI
   - Removable with one click
   ═══════════════════════════════════════════════ */

window.ArbelKeyManager = (function () {
    'use strict';

    var STORAGE_PREFIX = 'arbel_ai_';

    /* Provider registry — id, label, keyPrefix (for validation hint), getKeyUrl */
    var PROVIDERS = {
        /* Text providers */
        groq:       { label: 'Groq (Llama 3.3)',      category: 'text',  keyHint: 'gsk_',    url: 'https://console.groq.com/keys' },
        gemini:     { label: 'Google Gemini',          category: 'text',  keyHint: 'AI',      url: 'https://aistudio.google.com/apikey' },
        openrouter: { label: 'OpenRouter (multi-model)', category: 'text', keyHint: 'sk-or-', url: 'https://openrouter.ai/keys' },
        /* Video providers */
        replicate:  { label: 'Replicate',              category: 'video', keyHint: 'r8_',     url: 'https://replicate.com/account/api-tokens' },
        runway:     { label: 'Runway (Gen-4)',         category: 'video', keyHint: '',         url: 'https://app.runwayml.com/settings/api-keys' },
        kling:      { label: 'Kling 2.0',              category: 'video', keyHint: '',         url: 'https://klingai.com/' },
        luma:       { label: 'Luma Dream Machine',     category: 'video', keyHint: '',         url: 'https://lumalabs.ai/api' },
        openai_vid: { label: 'OpenAI (Sora)',          category: 'video', keyHint: 'sk-',     url: 'https://platform.openai.com/api-keys' },
        /* Image providers */
        replicate_img: { label: 'Replicate (Image)',   category: 'image', keyHint: 'r8_',     url: 'https://replicate.com/account/api-tokens' },
        stability:  { label: 'Stability AI',           category: 'image', keyHint: 'sk-',     url: 'https://platform.stability.ai/account/keys' },
        openai_img: { label: 'OpenAI (DALL-E)',        category: 'image', keyHint: 'sk-',     url: 'https://platform.openai.com/api-keys' },
        huggingface:{ label: 'Hugging Face',           category: 'image', keyHint: 'hf_',     url: 'https://huggingface.co/settings/tokens' }
    };

    function _storageKey(category, field) {
        return STORAGE_PREFIX + category + '_' + field;
    }

    /* ── Legacy compat: old single-key format ── */
    function _migrateLegacy() {
        try {
            var oldKey = localStorage.getItem(STORAGE_PREFIX + 'key');
            var oldProvider = localStorage.getItem(STORAGE_PREFIX + 'provider');
            if (oldKey) {
                localStorage.setItem(_storageKey('text', 'key'), oldKey);
                localStorage.setItem(_storageKey('text', 'provider'), oldProvider || 'groq');
                localStorage.removeItem(STORAGE_PREFIX + 'key');
                localStorage.removeItem(STORAGE_PREFIX + 'provider');
            }
        } catch (e) { /* silent */ }
    }
    _migrateLegacy();

    /** Save a key for a specific category */
    function saveKey(category, provider, key) {
        if (!key || typeof key !== 'string' || key.trim().length < 8) return false;
        if (!PROVIDERS[provider]) return false;
        try {
            localStorage.setItem(_storageKey(category, 'provider'), provider);
            localStorage.setItem(_storageKey(category, 'key'), key.trim());
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Get key for a category */
    function getKey(category) {
        category = category || 'text';
        try {
            return localStorage.getItem(_storageKey(category, 'key')) || null;
        } catch (e) {
            return null;
        }
    }

    /** Get provider for a category */
    function getProvider(category) {
        category = category || 'text';
        try {
            return localStorage.getItem(_storageKey(category, 'provider')) || null;
        } catch (e) {
            return null;
        }
    }

    /** Masked display key */
    function getMaskedKey(category) {
        var key = getKey(category || 'text');
        if (!key) return '';
        if (key.length <= 12) return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
        return key.slice(0, 4) + '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + key.slice(-4);
    }

    function hasKey(category) {
        return !!getKey(category || 'text');
    }

    function removeKey(category) {
        category = category || 'text';
        try {
            localStorage.removeItem(_storageKey(category, 'key'));
            localStorage.removeItem(_storageKey(category, 'provider'));
        } catch (e) { /* silent */ }
    }

    /** Get providers for a specific category */
    function getProvidersByCategory(category) {
        var result = [];
        Object.keys(PROVIDERS).forEach(function (id) {
            if (PROVIDERS[id].category === category) {
                result.push({ id: id, label: PROVIDERS[id].label, keyHint: PROVIDERS[id].keyHint, url: PROVIDERS[id].url });
            }
        });
        return result;
    }

    function getProviderInfo(id) {
        return PROVIDERS[id] || null;
    }

    return {
        saveKey: saveKey,
        getKey: getKey,
        getProvider: getProvider,
        getMaskedKey: getMaskedKey,
        hasKey: hasKey,
        removeKey: removeKey,
        getProvidersByCategory: getProvidersByCategory,
        getProviderInfo: getProviderInfo,
        PROVIDERS: PROVIDERS
    };
})();
