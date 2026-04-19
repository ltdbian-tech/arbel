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

    /** Build the prompt for copy generation */
    function _buildPrompt(description, industry, brandName, sections) {
        var sectionList = sections.join(', ');
        return 'You are a professional website copywriter. Generate all website copy for this business:\n\n' +
            'Business: ' + brandName + '\n' +
            'Industry: ' + industry + '\n' +
            'Description: ' + description + '\n' +
            'Sections needed: ' + sectionList + '\n\n' +
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
            'Make the copy professional, concise, and compelling. Match the tone to the industry.';
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
        var seed = Math.random().toString(36).slice(2, 10);

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
            '  Variation seed: ' + seed + '\n\n' +
            'IMPORTANT: Do NOT default to generic tech-blue or purple. Match the palette to the industry and mood (beauty=rose/gold/ivory, food=warm tones, finance=muted/serious, nonprofit=earthy, music=bold/saturated, etc.). Be adventurous.\n\n' +
            'Return a valid JSON object (no markdown, no code blocks, raw JSON only) with THREE top-level keys: "brand", "design", and "copy".\n\n' +
            'The "brand" key must be:\n' +
            '{\n' +
            '  "name": "the actual brand name — extract from description if mentioned, otherwise invent a fitting one",\n' +
            '  "tagline": "short memorable tagline (3-8 words) — specific, not generic",\n' +
            '  "industry": one of "agency"|"saas"|"ecommerce"|"restaurant"|"healthcare"|"portfolio"|"fashion"|"realestate"|"fitness"|"education"|"finance"|"legal"|"nonprofit"|"music"|"photography"|"startup"|"other",\n' +
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
            '"sectionOrder": ordered array of section IDs from ["services","portfolio","about","process","testimonials","pricing","faq","stats"]. Pick 3-5 that fit the business. hero and contact are added automatically.\n\n' +
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
            '    "fontPair": "editorial|tech|humanist|display|mono",\n' +
            '    "heroLayout": "centered|left|split|minimal",\n' +
            '    "sectionOrder": ["services","portfolio","about","process","testimonials","pricing","faq","stats"] pick 3-5,\n' +
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

    return {
        generateCopy: generateCopy,
        generateDesign: generateDesign,
        generateDesignOnly: generateDesignOnly,
        detectProvider: detectProvider
    };
})();
