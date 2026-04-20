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
   AI MODULE — BYOK Copy Generation
   
   Calls Groq or Gemini API directly from user's browser
   using their own API key (from key-manager.js).
   
   SAFETY:
   - API key comes from ArbelKeyManager.getKey()
   - Calls go directly from browser → API provider
   - No middleman, no server, no logging
   ═══════════════════════════════════════════════ */

window.ArbelAI = (function () {
    'use strict';

    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

    // Tone-of-voice catalogue (shared between design + copy prompts)
    var TONES = [
        'confident-direct (Apple-like, short declarative sentences, zero fluff)',
        'warm-friendly (conversational, uses "you", approachable, human)',
        'bold-provocative (punchy, a little edgy, takes a stance)',
        'technical-precise (specific numbers, technical terms, no hype)',
        'editorial-literary (evocative, sensory, reads like a magazine)',
        'playful-witty (clever wordplay, light humor, never corny)',
        'minimalist-zen (few words, lots of space, koan-like)',
        'luxurious-refined (elegant, heritage language, sparse adjectives)'
    ];
    var _forcedTone = ''; // set by classic-mode manual dropdown; empty = random
    function setTone(t) { _forcedTone = t || ''; }
    function _pickTone() {
        if (_forcedTone) {
            // Match prefix (e.g. "confident-direct") to full descriptor
            for (var i = 0; i < TONES.length; i++) {
                if (TONES[i].indexOf(_forcedTone) === 0) return TONES[i];
            }
            return _forcedTone;
        }
        return TONES[Math.floor(Math.random() * TONES.length)];
    }

    /** Build the prompt for copy generation */
    function _buildPrompt(description, industry, brandName, sections) {
        var sectionList = sections.join(', ');
        var tone = _pickTone();
        // ─── SITE-TYPE PERSONA ─── Same persona lever as the full design
        // prompt — tells the copywriter what KIND of site this is so
        // "gaming portfolio" stops getting generic agency services copy.
        var personaBlock = '';
        if (typeof ArbelSiteType !== 'undefined') {
            try {
                var st = ArbelSiteType.infer(description, industry);
                var prof = ArbelSiteType.profile(st);
                if (prof && prof.persona) {
                    var exStats = Array.isArray(prof.statsStrip)
                        ? prof.statsStrip.slice(0, 4).map(function (s) { return s.v + ' ' + s.l; }).join(' · ') : '';
                    personaBlock = 'SITE TYPE: ' + st + '\nPERSONA: ' + prof.persona + '\n' +
                        (exStats ? 'Example stats tone: ' + exStats + '\n' : '') +
                        'Every copy field MUST match this persona — do NOT default to generic agency/services language.\n\n';
                }
            } catch (e) { /* non-fatal */ }
        }
        return 'You are a professional website copywriter. Generate all website copy for this business:\n\n' +
            'Business: ' + brandName + '\n' +
            'Industry: ' + industry + '\n' +
            'Description: ' + description + '\n' +
            'Sections needed: ' + sectionList + '\n' +
            'TONE OF VOICE (commit fully): ' + tone + '\n\n' +
            personaBlock +
            'Return a valid JSON object (no markdown, no code blocks, only raw JSON) with these exact keys:\n' +
            '{\n' +
            '  "heroLine1": "short punchy first line (2-4 words)",\n' +
            '  "heroLine2": "second line (1-2 words)",\n' +
            '  "heroLine3": "third line italic (1-2 words with period)",\n' +
            '  "heroSub": "subtitle under 150 chars",\n' +
            '  "heroCta": "CTA button text (2-3 words uppercase)",\n' +
            '  "servicesHeading": "section heading",\n' +
            '  "service1Title": "service name", "service1Desc": "one sentence",\n' +
            '  "service2Title": "service name", "service2Desc": "one sentence",\n' +
            '  "service3Title": "service name", "service3Desc": "one sentence",\n' +
            '  "portfolioHeading": "section heading",\n' +
            '  "project1Title": "project name", "project1Tag": "category", "project1Desc": "one sentence",\n' +
            '  "project2Title": "project name", "project2Tag": "category", "project2Desc": "one sentence",\n' +
            '  "project3Title": "project name", "project3Tag": "category", "project3Desc": "one sentence",\n' +
            '  "aboutHeading": "heading",\n' +
            '  "aboutDesc": "about paragraph under 300 chars",\n' +
            '  "stat1Val": "number/value", "stat1Label": "label",\n' +
            '  "stat2Val": "number/value", "stat2Label": "label",\n' +
            '  "stat3Val": "number/value", "stat3Label": "label",\n' +
            '  "processHeading": "heading",\n' +
            '  "step1Title": "step name", "step1Desc": "one sentence",\n' +
            '  "step2Title": "step name", "step2Desc": "one sentence",\n' +
            '  "step3Title": "step name", "step3Desc": "one sentence",\n' +
            '  "testimonial1Quote": "testimonial", "testimonial1Name": "name", "testimonial1Role": "role",\n' +
            '  "testimonial2Quote": "testimonial", "testimonial2Name": "name", "testimonial2Role": "role",\n' +
            '  "pricingHeading": "heading",\n' +
            '  "tier1Name": "name", "tier1Price": "price", "tier1Features": "feature1\\nfeature2\\nfeature3",\n' +
            '  "tier2Name": "name", "tier2Price": "price", "tier2Features": "feature1\\nfeature2\\nfeature3",\n' +
            '  "tier3Name": "name", "tier3Price": "price", "tier3Features": "feature1\\nfeature2\\nfeature3",\n' +
            '  "faq1Q": "question", "faq1A": "answer",\n' +
            '  "faq2Q": "question", "faq2A": "answer",\n' +
            '  "faq3Q": "question", "faq3A": "answer",\n' +
            '  "contactHeading": "heading",\n' +
            '  "contactCta": "CTA text"\n' +
            '}\n\n' +
            'Make the copy professional, concise, and compelling. Match the tone to the industry.\n' +
            'CRITICAL: Every line of copy must reflect the TONE OF VOICE above — voice, rhythm, vocabulary. Avoid generic marketing-speak.';
    }

    /** Sleep helper */
    function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    /** Parse a retry delay (in ms) from a 429 response. Tries Retry-After header
     *  first, then provider-specific hints in the error body. Caps at 60s. */
    function _parseRetryMs(resp, errData) {
        var h = resp.headers && resp.headers.get && resp.headers.get('Retry-After');
        if (h) {
            var n = parseFloat(h);
            if (isFinite(n) && n > 0) return Math.min(n * 1000, 60000);
        }
        var msg = (errData && errData.error && errData.error.message) || '';
        // Groq: "Please try again in 2.384s"
        var m = msg.match(/try again in\s+([\d.]+)s/i);
        if (m) return Math.min(parseFloat(m[1]) * 1000, 60000);
        // Gemini: "Please retry in 47.86s."
        m = msg.match(/retry in\s+([\d.]+)s/i);
        if (m) return Math.min(parseFloat(m[1]) * 1000, 60000);
        return 0;
    }

    /** Call Groq API with auto-retry on 429 and model fallback */
    async function _callGroq(prompt, apiKey) {
        // Larger model first, smaller as fallback if the big one is rate-limited
        var models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        var lastErr = null;

        for (var mi = 0; mi < models.length; mi++) {
            var model = models[mi];
            var attempts = mi === 0 ? 3 : 1; // retry the primary, single-shot on fallback

            for (var attempt = 0; attempt < attempts; attempt++) {
                var resp = await fetch(GROQ_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: 'You are a website copywriter. Return only valid JSON, no markdown.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 1.0,
                        top_p: 0.95,
                        max_tokens: 2200,
                        seed: Math.floor(Math.random() * 2147483647),
                        response_format: { type: 'json_object' }
                    })
                });

                if (resp.ok) {
                    var data = await resp.json();
                    var text = data.choices[0].message.content;
                    return JSON.parse(text);
                }

                var errData = await resp.json().catch(function () { return {}; });
                var errMsg = (errData.error && errData.error.message) || 'Groq API error (' + resp.status + ')';
                lastErr = new Error(errMsg);

                // 429 → wait and retry (or break to fall back to smaller model)
                if (resp.status === 429) {
                    var waitMs = _parseRetryMs(resp, errData);
                    if (attempt < attempts - 1 && waitMs > 0 && waitMs <= 15000) {
                        await _sleep(waitMs + 250);
                        continue;
                    }
                    // Too long or out of retries on this model — fall back
                    break;
                }

                // Non-retryable error
                throw lastErr;
            }
        }

        throw lastErr || new Error('Groq API rate-limited. Wait a minute and try again.');
    }

    /** Call Gemini API with auto-retry on 429 */
    async function _callGemini(prompt, apiKey) {
        var lastErr = null;
        for (var attempt = 0; attempt < 3; attempt++) {
            var resp = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 1.0,
                        topP: 0.95,
                        maxOutputTokens: 2200,
                        seed: Math.floor(Math.random() * 2147483647),
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (resp.ok) {
                var data = await resp.json();
                if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
                    throw new Error('Gemini returned an unexpected response format.');
                }
                var text = data.candidates[0].content.parts[0].text;
                return JSON.parse(text);
            }

            var errData = await resp.json().catch(function () { return {}; });
            var errMsg = (errData.error && errData.error.message) || 'Gemini API error (' + resp.status + ')';
            lastErr = new Error(errMsg);

            if (resp.status === 429 && attempt < 2) {
                var waitMs = _parseRetryMs(resp, errData);
                if (waitMs > 0 && waitMs <= 15000) {
                    await _sleep(waitMs + 250);
                    continue;
                }
                // Daily quota or long wait — surface a clearer message
                throw new Error('Gemini rate-limited. Either wait, switch to Groq in the key panel, or use a different API key.');
            }

            throw lastErr;
        }
        throw lastErr || new Error('Gemini API error.');
    }

    /** Call OpenRouter (OpenAI-compatible). Tries a free model first, then a
     *  paid/premium fallback if the free one is rate-limited. */
    async function _callOpenRouter(prompt, apiKey) {
        // Free models with strong JSON output support. Ordered cheap→premium.
        var models = [
            'deepseek/deepseek-chat-v3.1:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'google/gemini-2.0-flash-exp:free'
        ];
        var lastErr = null;

        for (var mi = 0; mi < models.length; mi++) {
            var model = models[mi];
            var attempts = mi === 0 ? 2 : 1;

            for (var attempt = 0; attempt < attempts; attempt++) {
                var resp = await fetch(OPENROUTER_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + apiKey,
                        'Content-Type': 'application/json',
                        // Referer + Title help OpenRouter attribute requests
                        'HTTP-Referer': 'https://arbel.live',
                        'X-Title': 'Arbel Generator'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: 'You are a website copywriter. Return only valid JSON, no markdown.' },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 1.0,
                        top_p: 0.95,
                        max_tokens: 2200,
                        seed: Math.floor(Math.random() * 2147483647),
                        response_format: { type: 'json_object' }
                    })
                });

                if (resp.ok) {
                    var data = await resp.json();
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        throw new Error('OpenRouter returned an unexpected response.');
                    }
                    var text = data.choices[0].message.content;
                    return JSON.parse(text);
                }

                var errData = await resp.json().catch(function () { return {}; });
                var errMsg = (errData.error && errData.error.message) || 'OpenRouter API error (' + resp.status + ')';
                lastErr = new Error(errMsg);

                if (resp.status === 429) {
                    var waitMs = _parseRetryMs(resp, errData);
                    if (attempt < attempts - 1 && waitMs > 0 && waitMs <= 15000) {
                        await _sleep(waitMs + 250);
                        continue;
                    }
                    break; // Fall back to next model
                }
                throw lastErr;
            }
        }
        throw lastErr || new Error('OpenRouter rate-limited on all fallback models.');
    }

    /** Pick the right call function for the configured provider */
    function _callForProvider(provider, prompt, apiKey) {
        if (provider === 'gemini') return _callGemini(prompt, apiKey);
        if (provider === 'openrouter') return _callOpenRouter(prompt, apiKey);
        return _callGroq(prompt, apiKey);
    }

    /** Generate copy using the configured provider */
    async function generateCopy(description, industry, brandName, sections) {
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();

        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');
        if (!description || !description.trim()) throw new Error('Please describe your business first.');

        var prompt = _buildPrompt(description, industry, brandName, sections);
        return await _callForProvider(provider, prompt, apiKey);
    }

    /** Build the full auto-design prompt (design + copy) */
    function _buildDesignPrompt(description, industry, brandName) {
        // Inject a random "style brief" seed so repeated runs on the same
        // description produce genuinely different looks instead of the same output.
        var moods = [
            'editorial / high-fashion', 'brutalist / raw', 'neo-minimal / clean',
            'vaporwave / retro-futurist', 'organic / botanical', 'industrial / monochrome',
            'playful / maximalist', 'cinematic / moody', 'scandi / warm-neutral',
            'cyberpunk / neon', 'art-deco / luxe', 'handcrafted / zine'
        ];
        var paletteHints = [
            'warm terracotta + sand + ink', 'deep emerald + gold + cream',
            'electric magenta + charcoal + white', 'dusty rose + taupe + bone',
            'cobalt + amber + off-white', 'forest + bronze + parchment',
            'blush + plum + ivory', 'citrus + navy + snow', 'lilac + sage + midnight',
            'crimson + black + eggshell', 'turquoise + rust + linen', 'violet + lemon + slate'
        ];
        var mood = moods[Math.floor(Math.random() * moods.length)];
        var palette = paletteHints[Math.floor(Math.random() * paletteHints.length)];
        var tone = _pickTone();
        var seed = Math.random().toString(36).slice(2, 10);

        // ─── SITE TYPE ─── Let the local inference engine detect what KIND
        // of site this is (gaming / shop / portfolio / blog / event / app /
        // restaurant / …) and suggest a section architecture that fits.
        // The AI is free to override sectionOrder, but we give it a strong
        // hint so "valorant gaming page" stops getting agency/services
        // templates.
        var siteType = 'generic';
        var recipeHint = '';
        if (typeof ArbelSiteType !== 'undefined') {
            siteType = ArbelSiteType.infer(description, industry);
            var suggested = ArbelSiteType.recipe(siteType);
            recipeHint = '\n\nDETECTED SITE TYPE: "' + siteType + '". Suggested section architecture for this type: ' +
                JSON.stringify(suggested) + '. Follow this shape unless the description clearly calls for different sections. For gaming sites, prefer statsStrip (player counts / awards) + portfolio (game modes / characters / maps) + ctaBanner (download/play). For shops, prefer portfolio (as product grid) + pricing (as product tiers) + testimonials (reviews). For portfolios, prefer portfolio (projects) + about + process. For blogs, prefer portfolio (as posts) + about + ctaBanner (subscribe). For events, prefer statsStrip (dates/venue) + team (speakers) + pricing (tickets). For apps, prefer services (features) + pricing (plans) + statsStrip (downloads/rating). Do NOT blindly copy the "services + portfolio + pricing" agency template onto every site.\n';

            // ─── PROFILE HINT ─── Inject the type's persona + a few example
            // content fragments so the AI generates copy that actually fits
            // (gaming → K/D, WINS, RANK; restaurant → tasting menus; fashion
            // → collection names; nonprofit → impact numbers). This is the
            // single biggest lever for breaking the "every site looks like a
            // generic agency" problem.
            try {
                var prof = ArbelSiteType.profile(siteType);
                if (prof) {
                    var exStats = Array.isArray(prof.statsStrip)
                        ? prof.statsStrip.slice(0, 4).map(function (s) { return s.v + ' ' + s.l; }).join(' · ')
                        : '';
                    var exLogos = Array.isArray(prof.logoCloud) ? prof.logoCloud.slice(0, 6).join(', ') : '';
                    var exLabels = prof.labels && typeof prof.labels === 'object'
                        ? Object.keys(prof.labels).map(function (k) { return k + '→"' + prof.labels[k] + '"'; }).join(', ')
                        : '';
                    recipeHint += 'PERSONA: ' + (prof.persona || 'generic business site') + '\n';
                    if (exStats) recipeHint += 'EXAMPLE STATS for this type (tone reference — invent your own similar): ' + exStats + '\n';
                    if (exLogos) recipeHint += 'EXAMPLE LOGOCLOUD brands (press/partners/platforms relevant to this type): ' + exLogos + '\n';
                    if (exLabels) recipeHint += 'SECTION-LABEL OVERRIDES for this type (use these instead of the defaults): ' + exLabels + '\n';
                    recipeHint += 'Every copy field MUST match the persona above — do NOT default to generic agency/services language.\n';

                    // ─── TYPE-NATIVE SECTION SCHEMAS ───
                    // If the suggested recipe includes any of the new
                    // type-native sections, tell the AI exactly which
                    // copy keys to produce so it fills product grids /
                    // agent rosters / menu rows / etc. with specific,
                    // on-persona copy rather than generic filler.
                    var nativeSchemas = {
                        productGrid: 'productGrid: for i=1..6 produce product<i>Name (short SKU-like product name), product<i>Price (e.g. "$4.99"), product<i>Category (e.g. "Produce"), product<i>Badge (optional short tag like "NEW", "-20%", "BEST SELLER"). Also set productGridHeading + productGridLabel.',
                        categoryChips: 'categoryChips: produce 6–8 strings as category1..category8 (short taxonomy names: "Produce", "Bakery", etc.).',
                        dealBanner: 'dealBanner: set dealBannerTag (short uppercase), dealBannerHeading (offer headline), dealBannerSub (supporting line), dealBannerCta (button text).',
                        agentRoster: 'agentRoster: for i=1..4 produce agent<i>Name (codename), agent<i>Role (ROLE in uppercase e.g. DUELIST/SENTINEL/INITIATOR/CONTROLLER/TANK/SUPPORT), agent<i>Ability (one sentence describing their signature mechanic). Also set agentRosterHeading.',
                        cinematicReel: 'cinematicReel: set cinematicReelLabel (short uppercase tag), cinematicReelHeading (bold cinematic tagline), cinematicReelSub (one-sentence hook), cinematicReelCta (e.g. "Play Free", "Watch Trailer").',
                        gameModes: 'gameModes: for i=1..4 produce mode<i>Name, mode<i>Desc (one sentence), mode<i>Tag (short uppercase category like RANKED/CASUAL/EVENT).',
                        statWall: 'statWall: for i=1..4 produce wall<i>Val (big number or status — e.g. "2.1M+", "RADIANT", "1.78") and wall<i>Label (short sentence-case label under it).',
                        raceTimeline: 'raceTimeline: for i=1..5 produce race<i>Date (e.g. "2026 · Q2"), race<i>Event (event/client/track name), race<i>Result (outcome — "Shipped", "P2", "Winner", etc.), race<i>Points (optional metric / dash).',
                        menuSections: 'menuSections: for i=1..8 produce dish<i>Name, dish<i>Desc (ingredients, one sentence max), dish<i>Price (e.g. "$18"), dish<i>Category (group name like "Antipasti", "Primi", "Dolci" — items with same Category group together), dish<i>Tags (optional comma list like "V,Spicy").',
                        lookbookHorizontal: 'lookbookHorizontal: for i=1..6 produce look<i>Title (garment / outfit name), look<i>Tag (e.g. "SS26 · 01"). Also lookbookHorizontalHeading.',
                        releaseGrid: 'releaseGrid: for i=1..6 produce release<i>Title, release<i>Year (YYYY), release<i>Type ("LP" | "EP" | "Single" | "Episode"). Also releaseGridHeading.'
                    };
                    var usedNatives = suggested.filter(function (s) { return nativeSchemas[s]; });
                    if (usedNatives.length) {
                        recipeHint += '\nSCHEMAS for the type-native sections in this recipe (use these EXACT copy keys in the copy JSON):\n';
                        usedNatives.forEach(function (s) { recipeHint += '  - ' + nativeSchemas[s] + '\n'; });
                    }
                }
            } catch (e) { /* non-fatal */ }
        }

        var presetCatalogue =
            'SHADERS: obsidian (luxury/mysterious), aurora (tech/vibrant), ember (food/bold), frost (finance/clinical), neon (gaming/edgy), silk (fashion/elegant).\n' +
            '  PARTICLES: constellation (tech), fireflies (warm/organic), snow (seasonal), nebula (space/premium), matrix (hacker/dev), bokeh (photography/romantic), spark (energy), plasma (sci-fi), stardust (dreamy), rain (moody), vortex (abstract), circuits (hardware), confetti (events), galaxy (epic).\n' +
            '  BLOBS: morphBlob (startup), lavaLamp (retro/playful), auroraBlob (nature/elegant), sunsetBlob (fashion/lifestyle), oceanBlob (corporate/saas), cosmicBlob (creative/dark).\n' +
            '  GRADIENTS: meshGrad (apple/saas), noiseGrad (minimal/art), prism (colorful/portfolio), iridescent (luxury/fashion), northern (nature/premium).\n' +
            '  WAVES: sineWaves (music/elegant), topology (minimal/cartography), ripple (zen/wellness), liquidWave (bold/creative).';

        return 'You are a senior brand designer and copywriter. Design a complete website for:\n\n' +
            'Business: ' + (brandName || '(infer a name from the description)') + '\n' +
            'Industry hint: ' + (industry || '(pick one from the list below)') + '\n' +
            'Description: ' + description + '\n\n' +
            'STYLE DIRECTION FOR THIS RUN (use as inspiration, not quoted text):\n' +
            '  Mood: ' + mood + '\n' +
            '  Palette direction: ' + palette + '\n' +
            '  Tone of voice (commit fully in every copy field): ' + tone + '\n' +
            '  Variation seed: ' + seed + '\n' +
            recipeHint +
            'IMPORTANT: Do NOT default to generic tech-blue or purple. Match the palette to the industry and mood (beauty=rose/gold/ivory, food=warm tones, finance=muted/serious, nonprofit=earthy, music=bold/saturated, gaming=neon/dark/saturated, event=bold/hi-contrast, etc.). Be adventurous.\n\n' +
            'Return a valid JSON object (no markdown, no code blocks, raw JSON only) with THREE top-level keys: "brand", "design", and "copy".\n\n' +
            'The "brand" key must be:\n' +
            '{\n' +
            '  "name": "the actual brand name — extract from description if mentioned, otherwise invent a fitting one",\n' +
            '  "tagline": "short memorable tagline (3-8 words) — specific, not generic",\n' +
            '  "industry": one of "agency"|"saas"|"app"|"ecommerce"|"restaurant"|"healthcare"|"portfolio"|"fashion"|"realestate"|"fitness"|"education"|"finance"|"legal"|"nonprofit"|"music"|"photography"|"gaming"|"blog"|"podcast"|"event"|"startup"|"other",\n' +
            '  "siteType": "' + siteType + '" (echo the detected site type so downstream code knows what kind of site this is),\n' +
            '  "email": "a placeholder contact email using the brand name (e.g. hello@arres.co)",\n' +
            '  "seoTitle": "<=70 char SEO title",\n' +
            '  "seoDescription": "<=160 char meta description"\n' +
            '}\n\n' +
            'The "design" key MUST use ONE of these two shapes:\n\n' +
            '[A] PRESET MODE (PREFERRED — use this ~80% of runs for maximum variety):\n' +
            '{\n' +
            '  "presetId": "<one of the catalogue IDs below — match mood + industry>",\n' +
            '  "accentOverride": "#RRGGBB (optional — tweak preset accent to match palette hint)",\n' +
            '  "bgOverride":     "#RRGGBB (optional — tweak preset background)",\n' +
            '  "sections": array of 3-6 from ["services","portfolio","about","process","testimonials","pricing","faq"],\n' +
            '  "rationale": "one sentence on why this preset fits"\n' +
            '}\n' +
            'PRESET CATALOGUE:\n  ' + presetCatalogue + '\n\n' +
            '[B] BUILDER MODE (only when no preset fits):\n' +
            '{\n' +
            '  "category": "particle"|"blob"|"gradient"|"wave",\n' +
            '  "colors": ["#RRGGBB accent","#RRGGBB secondary","#RRGGBB background"],\n' +
            '  "params": { "count":20-300, "speed":0.2-3, "size":1-8, "glow":0-1, "connect":bool, "blur":10-80, "layers":2-8, "amplitude":10-80 },\n' +
            '  "sections": array of 3-6 from the same list,\n' +
            '  "rationale": "one sentence"\n' +
            '}\n\n' +
            'BOTH SHAPES MAY ALSO INCLUDE these optional top-level design keys:\n' +
            '  "density":  "compact"|"cozy"|"spacious" — overall vertical spacing,\n' +
            '  "corners":  "sharp"|"soft"|"pill" — button & card roundness,\n' +
            '  "fontPair": "editorial"|"tech"|"humanist"|"display"|"mono" — typographic personality,\n' +
            '  "sectionTones": object keyed by section id (services/portfolio/about/process/testimonials/pricing/faq/contact) with value "dark"|"light"|"accent" — use this to alternate section backgrounds for rhythm; don\'t make every section the same tone,\n' +
            '  "sectionAnims": object keyed by the same section ids with value "fade"|"fadeUp"|"slideLeft"|"slideRight"|"scale"|"stagger"|"blur"|"none" — entrance animation per section.\n' +
            'CONTRAST RULE: text must remain readable. If you override bg to a LIGHT color, do not pair it with a pale accent for headings — pick a deep, saturated accent so contrast ratio stays ≥ 4.5.\n' +
            '"mode": "classic" — always use classic, do NOT return cinematic.\n\n' +
            'STRUCTURE VARIATION — vary these between regens:\n' +
            '"heroLayout": one of "centered" | "left" | "split" | "minimal". Pick the one that best fits the mood (split for agency/product, left for editorial, minimal for portfolio, centered as safe default).\n' +
            '"sectionOrder": ordered array of section IDs from ["services","portfolio","about","process","testimonials","pricing","faq","stats","statsStrip","logoCloud","ctaBanner","team"]. Pick 3-6 that fit the business. hero and contact are added automatically. statsStrip is a big-numbers band, logoCloud is a client marquee, ctaBanner is a full-width accent banner, team shows headshots. Mix 1-2 of these extras in for a less template-y shape.\n' +
            '"sectionLayouts": optional object like {"services":"list|alternating|bento|numbered","portfolio":"list|bento"} — pick different card layouts per section for structural variety. Empty/omitted means use the default grid.\n' +
            '"sectionCounts": optional object like {"services":2..4,"portfolio":2..4,"process":3..4} — vary card counts between regens.\n' +
            '"aboutFlip": boolean — flip the about section columns left/right.\n' +
            '"pricingAccent": 1|2|3 — which pricing tier is highlighted as popular.\n' +
            '"headingAlign": "left"|"center"|"right" — section heading alignment for the whole page.\n' +
            '"containerWidth": "narrow"|"normal"|"wide" — narrow (editorial) | normal | wide (agency).\n' +
            '"cardTreatment": "default"|"bordered"|"filled"|"floating"|"minimal"|"glass" — visual style applied to ALL cards (services / portfolio / process / pricing / testimonials).\n' +
            '"navStyle": "default"|"pill"|"minimal"|"ghost" — navigation bar treatment.\n' +
            '"sectionRhythm": "normal"|"compact"|"roomy"|"alternating" — vertical padding cadence between sections.\n' +
            '"heroEyebrow": optional short string (max 24 chars, UPPERCASE, mono feel) shown as a small badge above the hero heading, or empty string. Examples: "EST. 2019", "NEW · 2025", "INTRODUCING", "// STUDIO".\n' +
            '"buttonStyle": "default"|"solid"|"outline"|"gradient"|"sharp"|"lifted" — shape + fill of every CTA. solid is chunky flat, outline is stroked, gradient is vibrant, sharp is zero-radius editorial, lifted has a drop-shadow that compresses on press.\n' +
            '"typeScale": "tight"|"normal"|"dramatic" — heading-size profile. tight = editorial, normal = default, dramatic = big brutal display (7rem+ hero).\n' +
            '"dividerStyle": "none"|"line"|"gradient"|"numbered"|"dotline" — what appears between sections. numbered shows 01, 02, 03 monospace counters in the corner.\n' +
            '"footerStyle": "default"|"minimal"|"columns"|"centered"|"bigLogo"|"stripe" — footer treatment. bigLogo puts a giant faded brand watermark behind the footer.\n' +
            '"labelStyle": "default"|"bar"|"dot"|"number"|"stripe" — adornment on every section mono label. number prefixes /01, /02 etc. bar adds a 32px accent line prefix.\n' +
            '"heroArt": "none"|"grid"|"lines"|"circle"|"dots"|"cross" — decorative overlay added to the hero on top of the bg animation.\n' +
            '"logoStyle": ""|"monogram"|"mark-left"|"dot"|"bracket"|"underline"|"slash" — how the site logo renders. Empty = plain wordmark. monogram = initials-in-box, mark-left = geometric svg mark beside wordmark, dot = accent dot prefix, bracket = [ wordmark ], underline = animated accent underline on hover, slash = // mono prefix. Pick something that fits the mood.\n' +
            '"cursorStyle": ""|"ring-only"|"dot-only"|"crosshair"|"magnetic"|"spotlight"|"none" — custom cursor treatment. Empty = default dot-and-ring. ring-only = just the accent ring, dot-only = just an accent dot, crosshair = editorial precision cross, magnetic = tinted accent halo, spotlight = darkens the page around the cursor (drama!), none = hide the custom cursor. Use spotlight sparingly.\n\n' +
            'OPTIONAL "elementOverrides" — apply per-element flair to specific elements by ID. Use sparingly (5-15 entries max). Allowed IDs match patterns: hero-cta, hero-line1/2/3, hero-sub, service-card-1/2/3, service-N-title/desc, portfolio-card-1/2/3, project-N-title/tag/desc, about, about-heading, about-desc, stat-1/2/3, step-N-title/desc, testimonial-card-1/2/3, testimonial-N-quote/name/role, pricing-card-1/2/3, tier-N-name/price/features, faq-item-1/2/3, faq-N-q/a, *-heading.\n' +
            'Each entry can include: { "animation": one of "fadeIn|fadeInUp|fadeInDown|fadeInLeft|fadeInRight|slideUp|slideDown|slideLeft|slideRight|scaleUp|scaleDown|zoomIn|bounceIn|bounceInUp", "hover": one of "lift|scale|glow|tilt|skew|border-glow|brightness|color-shift", "continuous": one of "pulse|float|spin|bounce|shake|swing|breathe|glow-pulse|wobble|flash|headShake|wave-text|drift|sway", "color": "#RRGGBB", "backgroundColor": "#RRGGBB", "borderRadius": "Npx" or "N%" (0-100), "opacity": 0-1 }.\n' +
            'Vary these between regens to give each generation a distinct feel.\n\n' +
            'The "copy" key must contain all of these exact keys (every value non-empty, original, punchy, industry-specific — NO generic phrases like "welcome to our site" or "we build the future"):\n' +
            '{\n' +
            '  "heroLine1":"2-4 words","heroLine2":"1-2 words","heroLine3":"1-2 words italic with period",\n' +
            '  "heroSub":"<150 chars — specific value prop","heroCta":"2-3 words uppercase",\n' +
            '  "servicesHeading":"",\n' +
            '  "service1Title":"","service1Desc":"","service2Title":"","service2Desc":"","service3Title":"","service3Desc":"",\n' +
            '  "portfolioHeading":"",\n' +
            '  "project1Title":"","project1Tag":"","project1Desc":"",\n' +
            '  "project2Title":"","project2Tag":"","project2Desc":"",\n' +
            '  "project3Title":"","project3Tag":"","project3Desc":"",\n' +
            '  "aboutHeading":"","aboutDesc":"<300 chars — tell a real story",\n' +
            '  "stat1Val":"","stat1Label":"","stat2Val":"","stat2Label":"","stat3Val":"","stat3Label":"",\n' +
            '  "processHeading":"","step1Title":"","step1Desc":"","step2Title":"","step2Desc":"","step3Title":"","step3Desc":"",\n' +
            '  "testimonial1Quote":"","testimonial1Name":"","testimonial1Role":"",\n' +
            '  "testimonial2Quote":"","testimonial2Name":"","testimonial2Role":"",\n' +
            '  "pricingHeading":"",\n' +
            '  "tier1Name":"","tier1Price":"","tier1Features":"f1\\nf2\\nf3",\n' +
            '  "tier2Name":"","tier2Price":"","tier2Features":"f1\\nf2\\nf3",\n' +
            '  "tier3Name":"","tier3Price":"","tier3Features":"f1\\nf2\\nf3",\n' +
            '  "faq1Q":"","faq1A":"","faq2Q":"","faq2A":"","faq3Q":"","faq3A":"",\n' +
            '  "contactHeading":"","contactCta":""\n' +
            '}\n\n' +
            'Every single copy field MUST be filled with original, industry-appropriate text — no empty strings, no placeholders.';
    }

    /** Auto-design the full website: brand + palette + sections + mode + copy */
    async function generateDesign(description, industry, brandName) {
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();

        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');
        if (!description || !description.trim()) throw new Error('Please describe your business first.');

        var prompt = _buildDesignPrompt(description, industry, brandName);
        var raw = await _callForProvider(provider, prompt, apiKey);

        // Validate shape — brand is new/required
        if (!raw || typeof raw !== 'object' || !raw.design || !raw.copy || !raw.brand) {
            throw new Error('AI returned an unexpected shape. Try again.');
        }
        return raw;
    }

    /** Build a slim prompt: design-only, reusing existing brand + copy.
     *  ~75% fewer output tokens than generateDesign. */
    function _buildDesignOnlyPrompt(description, industry, brandName) {
        var moods = [
            'editorial / high-fashion', 'brutalist / raw', 'neo-minimal / clean',
            'vaporwave / retro-futurist', 'organic / botanical', 'industrial / monochrome',
            'playful / maximalist', 'cinematic / moody', 'scandi / warm-neutral',
            'cyberpunk / neon', 'art-deco / luxe', 'handcrafted / zine'
        ];
        var paletteHints = [
            'warm terracotta + sand + ink', 'deep emerald + gold + cream',
            'electric magenta + charcoal + white', 'dusty rose + taupe + bone',
            'cobalt + amber + off-white', 'forest + bronze + parchment',
            'blush + plum + ivory', 'citrus + navy + snow', 'lilac + sage + midnight',
            'crimson + black + eggshell', 'turquoise + rust + linen', 'violet + lemon + slate'
        ];
        var mood = moods[Math.floor(Math.random() * moods.length)];
        var palette = paletteHints[Math.floor(Math.random() * paletteHints.length)];
        var seed = Math.random().toString(36).slice(2, 10);

        var presetCatalogue =
            'SHADERS: obsidian, aurora, ember, frost, neon, silk. ' +
            'PARTICLES: constellation, fireflies, snow, nebula, matrix, bokeh, spark, plasma, stardust, rain, vortex, circuits, confetti, galaxy. ' +
            'BLOBS: morphBlob, lavaLamp, auroraBlob, sunsetBlob, oceanBlob, cosmicBlob. ' +
            'GRADIENTS: meshGrad, noiseGrad, prism, iridescent, northern. ' +
            'WAVES: sineWaves, topology, ripple, liquidWave.';

        return 'You are a senior brand designer. Pick a FRESH visual design for this business. Do NOT write copy.\n\n' +
            'Business: ' + (brandName || '(from description)') + '\n' +
            'Industry: ' + (industry || '') + '\n' +
            'Description: ' + description + '\n\n' +
            'Mood: ' + mood + '\n' +
            'Palette direction: ' + palette + '\n' +
            'Variation seed: ' + seed + '\n\n' +
            'Return ONLY this JSON shape (no markdown):\n' +
            '{\n' +
            '  "design": {\n' +
            '    "presetId": "<one preset id from catalogue>",\n' +
            '    "accentOverride": "#RRGGBB (optional)",\n' +
            '    "bgOverride": "#RRGGBB (optional)",\n' +
            '    "density": "compact|cozy|spacious",\n' +
            '    "corners": "sharp|soft|pill",\n' +
            '    "fontPair": "editorial|tech|humanist|display|mono|luxe|brutalist|terminal|futurist|soft|classical|modern|boutique|journal",\n' +
            '    "heroLayout": "centered|left|split|minimal",\n' +
            '    "sectionOrder": ["services","portfolio","about","process","testimonials","pricing","faq","statsStrip","logoCloud","ctaBanner","team"] pick 3-6,\n' +
            '    "sectionLayouts": {"services":"list|alternating|bento|numbered","portfolio":"list|bento"} optional,\n' +
            '    "sectionCounts": {"services":2-4,"portfolio":2-4,"process":3-4},\n' +
            '    "aboutFlip": true|false,\n' +
            '    "pricingAccent": 1|2|3,\n' +
            '    "headingAlign": "left|center|right",\n' +
            '    "containerWidth": "narrow|normal|wide",\n' +
            '    "cardTreatment": "default|bordered|filled|floating|minimal|glass",\n' +
            '    "navStyle": "default|pill|minimal|ghost",\n' +
            '    "sectionRhythm": "normal|compact|roomy|alternating",\n' +
            '    "heroEyebrow": "short uppercase badge or empty",\n' +
            '    "buttonStyle": "default|solid|outline|gradient|sharp|lifted",\n' +
            '    "typeScale": "tight|normal|dramatic",\n' +
            '    "dividerStyle": "none|line|gradient|numbered|dotline",\n' +
            '    "footerStyle": "default|minimal|columns|centered|bigLogo|stripe",\n' +
            '    "labelStyle": "default|bar|dot|number|stripe",\n' +
            '    "heroArt": "none|grid|lines|circle|dots|cross",\n' +
            '    "logoStyle": "|monogram|mark-left|dot|bracket|underline|slash",\n' +
            '    "cursorStyle": "|ring-only|dot-only|crosshair|magnetic|spotlight|none",\n' +
            '    "sectionTones": {"services":"dark|light|accent",...},\n' +
            '    "sectionAnims": {"services":"fadeUp|slideLeft|...",...},\n' +
            '    "rationale": "one sentence"\n' +
            '  }\n' +
            '}\n\n' +
            'PRESET CATALOGUE: ' + presetCatalogue + '\n' +
            'Contrast: if bg is light, pick a deep saturated accent (ratio ≥ 4.5). Pick something DIFFERENT from a typical default.';
    }

    /** Generate ONLY a fresh design — reuses existing copy.
     *  ~75% fewer output tokens than generateDesign. */
    async function generateDesignOnly(description, industry, brandName) {
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();

        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');

        var prompt = _buildDesignOnlyPrompt(description || '', industry || '', brandName || '');

        // Smaller expected output — request less to speed up + save tokens
        var raw = await _callForProvider(provider, prompt, apiKey);
        if (!raw || typeof raw !== 'object' || !raw.design) {
            throw new Error('AI returned an unexpected shape. Try again.');
        }
        return raw;
    }

    /** Infer provider from an API key prefix — used for the provider auto-detect UX */
    function detectProvider(key) {
        if (!key || typeof key !== 'string') return null;
        var k = key.trim();
        if (/^gsk_[A-Za-z0-9]{20,}$/.test(k)) return 'groq';
        if (/^AIza[0-9A-Za-z_-]{30,}$/.test(k)) return 'gemini';
        if (/^sk-or-(v1-)?[A-Za-z0-9_-]{20,}$/.test(k)) return 'openrouter';
        return null;
    }

    // ─── Per-section regen ────────────────────────────────────────
    // Keys owned by each section — must match data-key values in index.html
    var SECTION_KEYS = {
        hero: ['heroLine1', 'heroLine2', 'heroLine3', 'heroSub', 'heroCta', 'heroCtaSecondary'],
        services: ['servicesHeading', 'servicesLabel',
            'service1Title', 'service1Desc', 'service2Title', 'service2Desc',
            'service3Title', 'service3Desc', 'service4Title', 'service4Desc'],
        portfolio: ['portfolioHeading', 'portfolioLabel',
            'project1Title', 'project1Tag', 'project1Desc',
            'project2Title', 'project2Tag', 'project2Desc',
            'project3Title', 'project3Tag', 'project3Desc'],
        about: ['aboutHeading', 'aboutLabel', 'aboutDesc', 'aboutDesc2',
            'stat1Value', 'stat1Label', 'stat2Value', 'stat2Label', 'stat3Value', 'stat3Label'],
        process: ['processHeading', 'processLabel',
            'step1Title', 'step1Desc', 'step2Title', 'step2Desc',
            'step3Title', 'step3Desc', 'step4Title', 'step4Desc'],
        testimonials: ['testimonialsHeading', 'testimonialsLabel',
            'testimonial1Quote', 'testimonial1Name', 'testimonial1Role',
            'testimonial2Quote', 'testimonial2Name', 'testimonial2Role',
            'testimonial3Quote', 'testimonial3Name', 'testimonial3Role'],
        pricing: ['pricingHeading', 'pricingLabel',
            'tier1Name', 'tier1Price', 'tier1Features',
            'tier2Name', 'tier2Price', 'tier2Features',
            'tier3Name', 'tier3Price', 'tier3Features'],
        faq: ['faqHeading', 'faqLabel',
            'faq1Q', 'faq1A', 'faq2Q', 'faq2A', 'faq3Q', 'faq3A', 'faq4Q', 'faq4A'],
        contact: ['contactHeading', 'contactLabel', 'contactDesc', 'contactCta']
    };

    /**
     * Regenerate copy for a single section only. Returns an object with
     * the same shape as a slice of generateCopy's output — caller pipes it
     * through the existing _applyCopy pipeline so editor state stays intact.
     */
    async function generateSectionCopy(sectionId, description, industry, brandName) {
        var keys = SECTION_KEYS[sectionId];
        if (!keys) throw new Error('Unknown section: ' + sectionId);
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();
        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');
        if (!description || !description.trim()) throw new Error('Add a business description first.');

        var tone = _pickTone();
        var seed = Math.random().toString(36).slice(2, 8);

        var shape = '{\n' + keys.map(function (k) {
            return '  "' + k + '": "fresh copy for this field"';
        }).join(',\n') + '\n}';

        var prompt =
            'You are a senior copywriter regenerating ONE section of a website.\n\n' +
            'Business: ' + (brandName || '(infer)') + '\n' +
            'Industry: ' + (industry || '(infer)') + '\n' +
            'Description: ' + description + '\n' +
            'Tone of voice (commit fully): ' + tone + '\n' +
            'Variation seed (ignore but use for entropy): ' + seed + '\n\n' +
            'Section to regenerate: "' + sectionId + '"\n\n' +
            'Return a valid JSON object (no markdown, no code blocks, raw JSON only) with EXACTLY these keys — every value non-empty, punchy, industry-specific, NEW and different from common defaults. No generic phrases.\n\n' +
            'Shape:\n' + shape + '\n\n' +
            'Rules:\n' +
            '- Headings: 2-6 words, specific, memorable\n' +
            '- Descriptions: 1-2 sentences, concrete, no fluff\n' +
            '- Price fields (tier*Price): format like "$49/mo" or "Free"\n' +
            '- Features fields (tier*Features): newline-separated list, 3-5 items\n' +
            '- Stat values (stat*Value): a number or short phrase like "12+", "98%"\n' +
            '- Tags (project*Tag): one short label like "Branding", "Web Design"\n' +
            '- Keep it punchy and on-brand for the tone above.\n';

        return await _callForProvider(provider, prompt, apiKey);
    }

    return {
        generateCopy: generateCopy,
        generateDesign: generateDesign,
        generateDesignOnly: generateDesignOnly,
        generateSectionCopy: generateSectionCopy,
        detectProvider: detectProvider,
        setTone: setTone
    };
})();
