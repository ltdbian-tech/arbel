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

    /** fetch() with an abort timeout so a hung provider can never freeze the UI. */
    function _fetchWithTimeout(url, opts, ms) {
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 45000);
        var o = Object.assign({}, opts || {});
        if (ctrl) o.signal = ctrl.signal;
        return fetch(url, o).finally(function () { clearTimeout(timer); });
    }

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
        // Fast 8B first (1-3s responses, 6k TPM), larger 70B as fallback if rate-limited.
        // Swapping the order makes the UI feel instant on free tier.
        var models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
        var lastErr = null;

        for (var mi = 0; mi < models.length; mi++) {
            var model = models[mi];
            var attempts = mi === 0 ? 2 : 1; // one retry on primary, single-shot on fallback

            for (var attempt = 0; attempt < attempts; attempt++) {
                var resp = await _fetchWithTimeout(GROQ_URL, {
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
                        max_tokens: 1800,
                        seed: Math.floor(Math.random() * 2147483647),
                        response_format: { type: 'json_object' }
                    })
                }, 45000);

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
                    if (attempt < attempts - 1 && waitMs > 0 && waitMs <= 8000) {
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
            var resp = await _fetchWithTimeout(GEMINI_URL, {
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
                        maxOutputTokens: 1800,
                        seed: Math.floor(Math.random() * 2147483647),
                        responseMimeType: 'application/json'
                    }
                })
            }, 60000);

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
                var resp = await _fetchWithTimeout(OPENROUTER_URL, {
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
                        max_tokens: 1800,
                        seed: Math.floor(Math.random() * 2147483647),
                        response_format: { type: 'json_object' }
                    })
                }, 60000);

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

        // ─── SITE TYPE ─── infer + emit a compact per-type brief.
        var siteType = 'generic';
        var recipeHint = '';
        var usedNatives = [];
        if (typeof ArbelSiteType !== 'undefined') {
            siteType = ArbelSiteType.infer(description, industry);
            var suggested = ArbelSiteType.recipe(siteType);
            recipeHint = '\nTYPE: ' + siteType + '. Sections: ' + JSON.stringify(suggested) + '.\n';

            try {
                var prof = ArbelSiteType.profile(siteType);
                if (prof) {
                    if (prof.persona) recipeHint += 'Persona: ' + prof.persona + '\n';
                    if (Array.isArray(prof.statsStrip)) {
                        recipeHint += 'Stats voice: ' + prof.statsStrip.slice(0,3).map(function(s){return s.v+' '+s.l;}).join(' · ') + '\n';
                    }
                    if (prof.labels) {
                        recipeHint += 'Labels: ' + Object.keys(prof.labels).map(function(k){return k+'→"'+prof.labels[k]+'"';}).join(', ') + '\n';
                    }
                    // Compact native-section schemas (only emit those used).
                    var nativeSchemas = {
                        productGrid: 'productGrid[i=1..6]: product<i>Name, product<i>Price ("$4.99"), product<i>Category, product<i>Badge (opt). +productGridHeading, productGridLabel.',
                        categoryChips: 'categoryChips: category1..category8 (short taxonomy names).',
                        dealBanner: 'dealBanner: dealBannerTag, dealBannerHeading, dealBannerSub, dealBannerCta.',
                        agentRoster: 'agentRoster[i=1..4]: agent<i>Name, agent<i>Role (UPPERCASE role like DUELIST), agent<i>Ability. +agentRosterHeading.',
                        cinematicReel: 'cinematicReel: cinematicReelLabel, cinematicReelHeading, cinematicReelSub, cinematicReelCta.',
                        gameModes: 'gameModes[i=1..4]: mode<i>Name, mode<i>Desc, mode<i>Tag (UPPERCASE).',
                        statWall: 'statWall[i=1..4]: wall<i>Val (big number/status), wall<i>Label.',
                        raceTimeline: 'raceTimeline[i=1..5]: race<i>Date, race<i>Event, race<i>Result, race<i>Points.',
                        menuSections: 'menuSections[i=1..8]: dish<i>Name, dish<i>Desc, dish<i>Price, dish<i>Category (group name), dish<i>Tags (opt).',
                        lookbookHorizontal: 'lookbookHorizontal[i=1..6]: look<i>Title, look<i>Tag ("SS26 · 01"). +lookbookHorizontalHeading.',
                        releaseGrid: 'releaseGrid[i=1..6]: release<i>Title, release<i>Year (YYYY), release<i>Type (LP/EP/Single/Episode). +releaseGridHeading.'
                    };
                    usedNatives = suggested.filter(function (s) { return nativeSchemas[s]; });
                    if (usedNatives.length) {
                        recipeHint += 'Native schemas:\n';
                        usedNatives.forEach(function (s) { recipeHint += '  ' + nativeSchemas[s] + '\n'; });
                    }
                    // Compact defaults: pages, nav-extra, footer, cta voice.
                    if (Array.isArray(prof.pageRecipes) && prof.pageRecipes.length) {
                        recipeHint += 'Default pages: ' + prof.pageRecipes.map(function(p){return p.name+'('+p.path+')';}).join(', ') + ' (auto; override via design.pages).\n';
                    }
                    if (prof.navExtra && prof.navExtra.label) {
                        recipeHint += 'Default navExtra: "' + prof.navExtra.label + '" (' + (prof.navExtra.kind||'button') + ').\n';
                    }
                    if (prof.cta) {
                        var cex = [];
                        if (prof.cta.heroCta && prof.cta.heroCta[0]) cex.push('hero="'+prof.cta.heroCta[0]+'"');
                        if (prof.cta.ctaBannerCta && prof.cta.ctaBannerCta[0]) cex.push('ctaBanner="'+prof.cta.ctaBannerCta[0]+'"');
                        if (cex.length) recipeHint += 'CTA voice: ' + cex.join(', ') + ' (stay in this register).\n';
                    }
                }
            } catch (e) {}
        }

        var presetIds = 'obsidian, aurora, ember, frost, neon, silk, constellation, fireflies, snow, nebula, matrix, bokeh, spark, plasma, stardust, rain, vortex, circuits, confetti, galaxy, morphBlob, lavaLamp, auroraBlob, sunsetBlob, oceanBlob, cosmicBlob, meshGrad, noiseGrad, prism, iridescent, northern, sineWaves, topology, ripple, liquidWave';

        return 'You are a senior brand designer + copywriter. Return raw JSON only (no markdown).\n\n' +
            'Business: ' + (brandName || '(invent a fitting name)') + '\n' +
            'Industry: ' + (industry || '(pick best)') + '\n' +
            'Description: ' + description + '\n\n' +
            'Run brief — Mood: ' + mood + ' · Palette: ' + palette + ' · Tone: ' + tone + ' · Seed: ' + seed + '\n' +
            recipeHint +
            '\nMatch palette to industry+mood; avoid defaulting to tech-blue/purple. Contrast ≥ 4.5.\n\n' +
            'Shape: { "brand":{...}, "design":{...}, "copy":{...} }\n\n' +
            'brand = { name, tagline (3-8 words), industry: one of agency|saas|app|ecommerce|restaurant|healthcare|portfolio|fashion|realestate|fitness|education|finance|legal|nonprofit|music|photography|gaming|blog|podcast|event|startup|other, siteType:"' + siteType + '", email (hello@brand.co style), seoTitle (≤70), seoDescription (≤160) }\n\n' +
            'design — pick ONE:\n' +
            '[A Preset] { presetId: one of [' + presetIds + '], accentOverride?:#RRGGBB, bgOverride?:#RRGGBB, rationale }\n' +
            '[B Builder] { category:"particle"|"blob"|"gradient"|"wave", colors:[accent,secondary,bg], params:{count:20-300,speed:0.2-3,size:1-8,glow:0-1,connect:bool,blur:10-80,layers:2-8,amplitude:10-80}, rationale }\n\n' +
            'Plus optional design keys (pick what fits; omit rest):\n' +
            '  sections: 4-7 from [services,portfolio,about,process,testimonials,pricing,faq,stats,statsStrip,logoCloud,ctaBanner,team] (hero+contact auto; MIN 4 middle sections so page feels complete)\n' +
            '  heroLayout: centered|left|split|minimal|name-lockup|product-feature|dish-photo|search-first\n' +
            '  density: compact|cozy|spacious · corners: sharp|soft|pill · typeScale: tight|normal|dramatic · containerWidth: narrow|normal|wide\n' +
            '  fontPair: editorial|tech|humanist|display|mono|luxe|brutalist|futurist|classical|modern|boutique|retail|chef|arena|vinyl|runway|streetwear|athletic|magazine\n' +
            '  cardTreatment: default|bordered|filled|floating|minimal|glass|neon|gradient|outline-accent|brutalist|split · navStyle: default|pill|minimal|ghost|floating|bordered · buttonStyle: default|solid|outline|gradient|sharp|lifted|pill|glow|underline|ghost\n' +
            '  sectionRhythm: normal|compact|roomy|alternating · dividerStyle: none|line|gradient|numbered|dotline · footerStyle: default|minimal|columns|centered|bigLogo|stripe · labelStyle: default|bar|dot|number|stripe|tag|arrow|bracket\n' +
            '  heroArt: none|grid|lines|circle|dots|cross|blob|wave|triangle|zigzag|arc|rings|stripes|scribble|checker\n' +
            '  logoStyle: ""|monogram|mark-left|dot|bracket|underline|slash · cursorStyle: ""|ring-only|dot-only|crosshair|magnetic|spotlight|none\n' +
            '  sectionTones: {id:"dark"|"light"|"accent"} · sectionAnims: {id:"fade|fadeUp|slideLeft|slideRight|scale|stagger|blur|none"}\n' +
            '  sectionLayouts: {services:"list|alternating|bento|numbered", portfolio:"list|bento"} · sectionCounts: {services:2-4,portfolio:2-4,process:3-4}\n' +
            '  aboutFlip:bool · pricingAccent:1|2|3 · headingAlign:left|center|right · heroEyebrow:"≤24 char uppercase"\n' +
            '  pages: [{id,name,path,sections[]}] (omit = use type defaults) · navExtra:{label,href,kind:"button|icon-cart|text"} · navExtraDisabled:bool · footerRecipe:{tagline,columns:[{heading,items:[{label,href}|string]}]}\n' +
            '  elementOverrides: {id:{animation,hover,continuous,color,backgroundColor,borderRadius,opacity,position,top/right/bottom/left,zIndex,width/height,transform}} — 5-15 entries max, use for flair only (not layout)\n\n' +
            'copy = fill ALL these keys with original, on-persona text (no generics like "welcome"):\n' +
            '{ heroLine1 (2-4w), heroLine2 (1-2w), heroLine3 (1-2w italic with period), heroSub (<150ch), heroCta (2-3w UPPER),\n' +
            '  servicesHeading, service1Title, service1Desc, service2Title, service2Desc, service3Title, service3Desc,\n' +
            '  portfolioHeading, project1Title, project1Tag, project1Desc, project2Title, project2Tag, project2Desc, project3Title, project3Tag, project3Desc,\n' +
            '  aboutHeading, aboutDesc (<300ch real story),\n' +
            '  stat1Val, stat1Label, stat2Val, stat2Label, stat3Val, stat3Label,\n' +
            '  processHeading, step1Title, step1Desc, step2Title, step2Desc, step3Title, step3Desc,\n' +
            '  testimonial1Quote, testimonial1Name, testimonial1Role, testimonial2Quote, testimonial2Name, testimonial2Role,\n' +
            '  pricingHeading, tier1Name, tier1Price, tier1Features ("f1\\nf2\\nf3"), tier2Name, tier2Price, tier2Features, tier3Name, tier3Price, tier3Features,\n' +
            '  faq1Q, faq1A, faq2Q, faq2A, faq3Q, faq3A,\n' +
            '  contactHeading, contactCta }' +
            (usedNatives.length ? '\nAlso include all keys from the native schemas listed above.' : '') +
            '\nmode:"classic".';
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

    /** Slim prompt: design-only, reuses existing copy (~75% fewer output tokens). */
    function _buildDesignOnlyPrompt(description, industry, brandName) {
        var moods = ['editorial','brutalist','neo-minimal','vaporwave','organic','industrial','playful','cinematic','scandi','cyberpunk','art-deco','handcrafted'];
        var palettes = ['terracotta+sand+ink','emerald+gold+cream','magenta+charcoal+white','rose+taupe+bone','cobalt+amber+off-white','forest+bronze+parchment','blush+plum+ivory','citrus+navy+snow','lilac+sage+midnight','crimson+black+eggshell','turquoise+rust+linen','violet+lemon+slate'];
        var mood = moods[Math.floor(Math.random()*moods.length)];
        var palette = palettes[Math.floor(Math.random()*palettes.length)];
        var seed = Math.random().toString(36).slice(2,10);
        var presetIds = 'obsidian, aurora, ember, frost, neon, silk, constellation, fireflies, snow, nebula, matrix, bokeh, spark, plasma, stardust, rain, vortex, circuits, confetti, galaxy, morphBlob, lavaLamp, auroraBlob, sunsetBlob, oceanBlob, cosmicBlob, meshGrad, noiseGrad, prism, iridescent, northern, sineWaves, topology, ripple, liquidWave';
        return 'You are a brand designer. Pick a FRESH visual design. No copy. Return raw JSON only.\n\n' +
            'Business: ' + (brandName||'(from description)') + '\nIndustry: ' + (industry||'') + '\nDescription: ' + description + '\n' +
            'Mood: ' + mood + ' · Palette: ' + palette + ' · Seed: ' + seed + '\n\n' +
            'Shape: { "design": {\n' +
            '  presetId: one of [' + presetIds + '], accentOverride?:#RRGGBB, bgOverride?:#RRGGBB,\n' +
            '  density:"compact|cozy|spacious", corners:"sharp|soft|pill", containerWidth:"narrow|normal|wide", typeScale:"tight|normal|dramatic",\n' +
            '  fontPair:"editorial|tech|humanist|display|mono|luxe|brutalist|futurist|classical|modern|boutique|retail|chef|arena|vinyl|runway|streetwear|athletic|magazine",\n' +
            '  heroLayout:"centered|left|split|minimal|name-lockup|product-feature|dish-photo|search-first",\n' +
            '  sectionOrder: 4-7 from [services,portfolio,about,process,testimonials,pricing,faq,statsStrip,logoCloud,ctaBanner,team] (keep page feeling full — min 4 middle sections),\n' +
            '  cardTreatment:"default|bordered|filled|floating|minimal|glass|neon|gradient|outline-accent|brutalist|split", navStyle:"default|pill|minimal|ghost|floating|bordered", buttonStyle:"default|solid|outline|gradient|sharp|lifted|pill|glow|underline|ghost",\n' +
            '  sectionRhythm:"normal|compact|roomy|alternating", dividerStyle:"none|line|gradient|numbered|dotline", footerStyle:"default|minimal|columns|centered|bigLogo|stripe", labelStyle:"default|bar|dot|number|stripe|tag|arrow|bracket",\n' +
            '  heroArt:"none|grid|lines|circle|dots|cross|blob|wave|triangle|zigzag|arc|rings|stripes|scribble|checker",\n' +
            '  logoStyle:""|"monogram|mark-left|dot|bracket|underline|slash", cursorStyle:""|"ring-only|dot-only|crosshair|magnetic|spotlight|none",\n' +
            '  sectionTones:{id:"dark|light|accent"}, sectionAnims:{id:"fade|fadeUp|slideLeft|slideRight|scale|stagger|blur|none"},\n' +
            '  aboutFlip:bool, pricingAccent:1|2|3, headingAlign:"left|center|right", heroEyebrow:"≤24ch uppercase or empty",\n' +
            '  rationale:"one sentence"\n' +
            '} }\nContrast ≥ 4.5. Pick something distinct from a default.';
    }

    /** Generate ONLY a fresh design — reuses existing copy. */
    async function generateDesignOnly(description, industry, brandName) {
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();
        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');
        var prompt = _buildDesignOnlyPrompt(description || '', industry || '', brandName || '');
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
