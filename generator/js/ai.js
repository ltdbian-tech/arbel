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

    /** Call Groq API */
    async function _callGroq(prompt, apiKey) {
        var resp = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a website copywriter. Return only valid JSON, no markdown.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 1.0,
                top_p: 0.95,
                max_tokens: 2800,
                response_format: { type: 'json_object' }
            })
        });

        if (!resp.ok) {
            var errData = await resp.json().catch(function () { return {}; });
            throw new Error(errData.error?.message || 'Groq API error (' + resp.status + ')');
        }

        var data = await resp.json();
        var text = data.choices[0].message.content;
        return JSON.parse(text);
    }

    /** Call Gemini API — key sent as header (not URL) to avoid log/referrer leaks */
    async function _callGemini(prompt, apiKey) {
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
                    maxOutputTokens: 2800,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!resp.ok) {
            var errData = await resp.json().catch(function () { return {}; });
            throw new Error(errData.error?.message || 'Gemini API error (' + resp.status + ')');
        }

        var data = await resp.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            throw new Error('Gemini returned an unexpected response format.');
        }
        var text = data.candidates[0].content.parts[0].text;
        return JSON.parse(text);
    }

    /** Generate copy using the configured provider */
    async function generateCopy(description, industry, brandName, sections) {
        var provider = ArbelKeyManager.getProvider('text') || ArbelKeyManager.getProvider();
        var apiKey = ArbelKeyManager.getKey('text') || ArbelKeyManager.getKey();

        if (!apiKey) throw new Error('No API key configured. Add your key in the AI panel.');
        if (!description || !description.trim()) throw new Error('Please describe your business first.');

        var prompt = _buildPrompt(description, industry, brandName, sections);

        if (provider === 'gemini') {
            return await _callGemini(prompt, apiKey);
        }
        return await _callGroq(prompt, apiKey);
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
        var raw = (provider === 'gemini')
            ? await _callGemini(prompt, apiKey)
            : await _callGroq(prompt, apiKey);

        // Validate shape — brand is new/required
        if (!raw || typeof raw !== 'object' || !raw.design || !raw.copy || !raw.brand) {
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
        return null;
    }

    return {
        generateCopy: generateCopy,
        generateDesign: generateDesign,
        detectProvider: detectProvider
    };
})();
