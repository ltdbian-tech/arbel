/* Arbel Site-Type Inference
 * ────────────────────────────────────────────────────────────────
 * Given a free-form description ("valorant gaming page") + optional
 * industry hint, pick the site TYPE (gaming / shop / portfolio /
 * blog / event / app / restaurant / agency / …) and return a
 * section recipe whose architecture fits that type.
 *
 * Why: the 17-industry dropdown can't distinguish "gaming landing
 * page" from "gaming agency site" — and AI often picks the same
 * services/portfolio/pricing template for every prompt. This module
 * maps keywords → type → an appropriate sectionOrder pool so shops
 * get product-like structure, gaming pages get community/download
 * structure, blogs get post-listing structure, etc.
 *
 * Exposed on window.ArbelSiteType — consumed by app.js randomizer
 * and (via _buildDesignPrompt) the AI flow.
 */
(function (global) {
    'use strict';

    // ─── Keyword → type matcher. First match wins. Order matters:
    // more specific patterns first (e.g. "saas app" → app before saas).
    var KEYWORDS = [
        { t: 'gaming',      rx: /\b(gam(e|ing|er)s?|esport|valorant|fortnite|minecraft|league[- ]of[- ]legends|arcade|playable|game[- ]?studio|twitch|streamer|speedrun|raid|clan|guild|mmo|rpg|fps|moba|steam|xbox|playstation|nintendo)\b/i },
        { t: 'shop',        rx: /\b(shop|store|ecommerce|e-commerce|retail|merch|boutique|cart|checkout|product(s)?|sell(ing)?|buy( online)?|shopify|clothing line|apparel|jewelr(y|ies)|marketplace|bazaar)\b/i },
        { t: 'restaurant',  rx: /\b(restaurant|cafe|bistro|bakery|brewery|diner|bar|pub|menu|reservation|cuisine|chef|food truck|pizzeria|sushi|coffee shop|eater(y|ies))\b/i },
        { t: 'portfolio',   rx: /\b(portfolio|freelanc(e|er)|my work|case studies|showcase|personal site|designer|illustrator|photographer|art director|resume|cv|about me)\b/i },
        { t: 'photography', rx: /\b(photograph(y|er)|wedding photo|photo studio|shoots?|lookbook|editorial photo|gallery)\b/i },
        { t: 'blog',        rx: /\b(blog|journal|magazine|newsletter|substack|medium|editorial site|articles|posts|publication|reporter|writer)\b/i },
        { t: 'podcast',     rx: /\b(podcast|episode|listen|spotify|apple podcasts|audio show|radio show)\b/i },
        { t: 'event',       rx: /\b(event|conference|festival|summit|meetup|workshop|hackathon|expo|concert|tour|wedding|venue|ticket)\b/i },
        { t: 'app',         rx: /\b(mobile app|ios app|android app|native app|app store|download.*app|launch.*app|super app|pwa|react native|flutter)\b/i },
        { t: 'saas',        rx: /\b(saas|b2b|platform|dashboard|crm|analytics|api|plug[- ]and[- ]play|integration|subscription tool|enterprise software)\b/i },
        { t: 'course',      rx: /\b(course|bootcamp|masterclass|training|academy|learning|school of|curriculum|lesson|cohort|workshop series)\b/i },
        { t: 'fitness',     rx: /\b(gym|fitness|workout|yoga|pilates|crossfit|personal trainer|nutritionist|wellness|boxing|mma)\b/i },
        { t: 'realestate',  rx: /\b(real estate|realtor|property|listing|broker|mortgage|rental|apartments|condo|agent)\b/i },
        { t: 'healthcare',  rx: /\b(clinic|dental|dentist|doctor|medical|therapy|therapist|psycholog|dermatolog|mental health|wellness clinic)\b/i },
        { t: 'fashion',     rx: /\b(fashion|apparel|clothing|streetwear|couture|runway|label|luxury brand|lookbook)\b/i },
        { t: 'music',       rx: /\b(band|musician|album|single|tour|record label|dj|producer|ep release|spotify artist)\b/i },
        { t: 'nonprofit',   rx: /\b(nonprofit|non[- ]profit|charity|donation|fundrais|ngo|mission[- ]driven|foundation)\b/i },
        { t: 'finance',     rx: /\b(fintech|bank|investment|wealth|trading|crypto|hedge fund|advisor|accounting)\b/i },
        { t: 'legal',       rx: /\b(law( firm)?|lawyer|attorney|legal|litigation|counsel)\b/i },
        { t: 'agency',      rx: /\b(agency|studio|creative firm|brand agency|design studio|marketing agency|consultancy)\b/i }
    ];

    // ─── Industry dropdown value → default type (fallback when no
    // description match is found).
    var INDUSTRY_MAP = {
        agency: 'agency', saas: 'saas', ecommerce: 'shop',
        restaurant: 'restaurant', healthcare: 'healthcare',
        portfolio: 'portfolio', fashion: 'fashion',
        realestate: 'realestate', fitness: 'fitness',
        education: 'course', finance: 'finance', legal: 'legal',
        nonprofit: 'nonprofit', music: 'music',
        photography: 'photography', startup: 'saas',
        gaming: 'gaming', shop: 'shop', blog: 'blog',
        event: 'event', app: 'app', podcast: 'podcast',
        course: 'course', other: 'generic'
    };

    /**
     * Infer site type from a description + optional industry hint.
     * @returns one of the types above, or 'generic' when nothing matches.
     */
    function infer(description, industry) {
        var desc = String(description || '').trim();
        if (desc) {
            for (var i = 0; i < KEYWORDS.length; i++) {
                if (KEYWORDS[i].rx.test(desc)) return KEYWORDS[i].t;
            }
        }
        if (industry && INDUSTRY_MAP[industry]) return INDUSTRY_MAP[industry];
        return 'generic';
    }

    // ─── RECIPES ─── Each entry is a **pool** (3+ options) so sequential
    // randomizes still feel distinct while staying architecturally correct
    // for the site type. One is picked at random. hero + contact are
    // auto-prepended/appended by app.js.
    var RECIPES = {
        gaming: [
            ['hero', 'statsStrip', 'portfolio', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'services',   'statsStrip', 'logoCloud', 'faq', 'contact'],
            ['hero', 'portfolio',  'team', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'statsStrip', 'services', 'portfolio', 'faq', 'contact']
        ],
        shop: [
            ['hero', 'portfolio', 'testimonials', 'pricing', 'faq', 'contact'],
            ['hero', 'logoCloud', 'portfolio', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'portfolio', 'about', 'testimonials', 'pricing', 'contact'],
            ['hero', 'statsStrip','portfolio', 'testimonials', 'faq', 'contact']
        ],
        restaurant: [
            ['hero', 'services', 'portfolio', 'testimonials', 'contact'],
            ['hero', 'about', 'services', 'team', 'contact'],
            ['hero', 'portfolio', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'services', 'statsStrip', 'testimonials', 'contact']
        ],
        portfolio: [
            ['hero', 'portfolio', 'about', 'testimonials', 'contact'],
            ['hero', 'about', 'portfolio', 'process', 'contact'],
            ['hero', 'portfolio', 'services', 'testimonials', 'contact'],
            ['hero', 'portfolio', 'statsStrip', 'about', 'contact']
        ],
        photography: [
            ['hero', 'portfolio', 'about', 'testimonials', 'contact'],
            ['hero', 'portfolio', 'services', 'pricing', 'contact'],
            ['hero', 'portfolio', 'about', 'pricing', 'contact']
        ],
        blog: [
            ['hero', 'portfolio', 'about', 'ctaBanner', 'contact'],
            ['hero', 'portfolio', 'logoCloud', 'about', 'contact'],
            ['hero', 'about', 'portfolio', 'ctaBanner', 'contact']
        ],
        podcast: [
            ['hero', 'portfolio', 'about', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'statsStrip', 'portfolio', 'about', 'contact'],
            ['hero', 'about', 'portfolio', 'logoCloud', 'contact']
        ],
        event: [
            ['hero', 'statsStrip', 'services', 'team', 'pricing', 'faq', 'contact'],
            ['hero', 'services', 'team', 'testimonials', 'pricing', 'contact'],
            ['hero', 'statsStrip', 'portfolio', 'pricing', 'faq', 'contact']
        ],
        app: [
            ['hero', 'services', 'statsStrip', 'testimonials', 'pricing', 'faq', 'contact'],
            ['hero', 'logoCloud', 'services', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'services', 'portfolio', 'pricing', 'faq', 'contact']
        ],
        saas: [
            ['hero', 'logoCloud', 'services', 'testimonials', 'pricing', 'faq', 'contact'],
            ['hero', 'services', 'statsStrip', 'testimonials', 'pricing', 'contact'],
            ['hero', 'services', 'process', 'testimonials', 'pricing', 'faq', 'contact']
        ],
        course: [
            ['hero', 'services', 'process', 'testimonials', 'pricing', 'faq', 'contact'],
            ['hero', 'statsStrip', 'services', 'team', 'pricing', 'contact'],
            ['hero', 'services', 'about', 'testimonials', 'pricing', 'faq', 'contact']
        ],
        fitness: [
            ['hero', 'services', 'team', 'testimonials', 'pricing', 'contact'],
            ['hero', 'statsStrip', 'services', 'testimonials', 'pricing', 'contact'],
            ['hero', 'about', 'services', 'pricing', 'faq', 'contact']
        ],
        realestate: [
            ['hero', 'portfolio', 'statsStrip', 'team', 'testimonials', 'contact'],
            ['hero', 'portfolio', 'about', 'testimonials', 'faq', 'contact'],
            ['hero', 'services', 'portfolio', 'team', 'contact']
        ],
        healthcare: [
            ['hero', 'services', 'team', 'testimonials', 'faq', 'contact'],
            ['hero', 'about', 'services', 'testimonials', 'contact'],
            ['hero', 'services', 'process', 'faq', 'contact']
        ],
        fashion: [
            ['hero', 'portfolio', 'about', 'testimonials', 'contact'],
            ['hero', 'portfolio', 'logoCloud', 'ctaBanner', 'contact'],
            ['hero', 'portfolio', 'about', 'ctaBanner', 'contact']
        ],
        music: [
            ['hero', 'portfolio', 'statsStrip', 'about', 'ctaBanner', 'contact'],
            ['hero', 'portfolio', 'about', 'testimonials', 'contact'],
            ['hero', 'statsStrip', 'portfolio', 'logoCloud', 'contact']
        ],
        nonprofit: [
            ['hero', 'about', 'statsStrip', 'services', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'statsStrip', 'services', 'team', 'ctaBanner', 'contact'],
            ['hero', 'about', 'services', 'testimonials', 'contact']
        ],
        finance: [
            ['hero', 'services', 'statsStrip', 'testimonials', 'pricing', 'faq', 'contact'],
            ['hero', 'services', 'logoCloud', 'testimonials', 'contact'],
            ['hero', 'about', 'services', 'testimonials', 'faq', 'contact']
        ],
        legal: [
            ['hero', 'services', 'team', 'testimonials', 'faq', 'contact'],
            ['hero', 'about', 'services', 'team', 'contact'],
            ['hero', 'services', 'testimonials', 'faq', 'contact']
        ],
        agency: [
            ['hero', 'services', 'portfolio', 'testimonials', 'contact'],
            ['hero', 'portfolio', 'about', 'process', 'testimonials', 'contact'],
            ['hero', 'logoCloud', 'services', 'portfolio', 'testimonials', 'contact'],
            ['hero', 'services', 'portfolio', 'team', 'ctaBanner', 'contact']
        ],
        generic: [
            ['hero', 'services', 'portfolio', 'testimonials', 'contact'],
            ['hero', 'about', 'services', 'testimonials', 'pricing', 'contact'],
            ['hero', 'portfolio', 'about', 'faq', 'contact']
        ]
    };

    /** Return a section order pick (array of section IDs incl. hero & contact)
     *  for the given type. Picks uniformly at random from the recipe pool. */
    function recipe(type) {
        var pool = RECIPES[type] || RECIPES.generic;
        return pool[Math.floor(Math.random() * pool.length)].slice();
    }

    /** All known types — exposed so UI / AI prompt can list them. */
    function types() { return Object.keys(RECIPES); }

    global.ArbelSiteType = { infer: infer, recipe: recipe, types: types };
})(window);
