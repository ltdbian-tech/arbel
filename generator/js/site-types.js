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
        // Hardware / B2B manufacturing — must run BEFORE shop so "we produce CPUs"
        // doesn't get classed as a consumer e-commerce site.
        { t: 'saas',        rx: /\b(cpus?|gpus?|chips?(et)?|semiconductors?|processors?|motherboards?|firmware|hardware|circuits?|silicon|wafers?|socs?|microcontrollers?|fpgas?|asics?|pcbs?|ssds?|rams?|datacenters?|data[- ]centers?|manufactur(e|er|ers|ing)|oem|supply[- ]chain|industrial)\b/i },
        { t: 'shop',        rx: /\b(shop|store|ecommerce|e-commerce|retail|merch|boutique|cart|checkout|grocer(y|ies)|products?[ -](catalog|page|list)|(clothing|apparel|jewelry|accessories)[- ]?(line|shop|store|brand)?|shopify|marketplace|bazaar)\b/i },
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
            ['hero', 'cinematicReel', 'agentRoster', 'gameModes', 'statsStrip', 'ctaBanner', 'contact'],
            ['hero', 'statsStrip', 'agentRoster', 'gameModes', 'faq', 'contact'],
            ['hero', 'cinematicReel', 'gameModes', 'statsStrip', 'team', 'contact'],
            ['hero', 'agentRoster', 'gameModes', 'testimonials', 'ctaBanner', 'contact']
        ],
        shop: [
            ['hero', 'categoryChips', 'productGrid', 'dealBanner', 'testimonials', 'contact'],
            ['hero', 'dealBanner', 'productGrid', 'categoryChips', 'logoCloud', 'contact'],
            ['hero', 'categoryChips', 'productGrid', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'productGrid', 'dealBanner', 'about', 'faq', 'contact']
        ],
        restaurant: [
            ['hero', 'menuSections', 'about', 'team', 'contact'],
            ['hero', 'menuSections', 'statsStrip', 'testimonials', 'contact'],
            ['hero', 'about', 'menuSections', 'ctaBanner', 'contact'],
            ['hero', 'menuSections', 'team', 'testimonials', 'contact']
        ],
        portfolio: [
            ['hero', 'statWall', 'portfolio', 'about', 'contact'],
            ['hero', 'portfolio', 'raceTimeline', 'about', 'contact'],
            ['hero', 'portfolio', 'statWall', 'process', 'contact'],
            ['hero', 'about', 'portfolio', 'statWall', 'contact']
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
            ['hero', 'releaseGrid', 'about', 'testimonials', 'ctaBanner', 'contact'],
            ['hero', 'statsStrip', 'releaseGrid', 'about', 'contact'],
            ['hero', 'about', 'releaseGrid', 'logoCloud', 'contact']
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
            ['hero', 'lookbookHorizontal', 'about', 'testimonials', 'contact'],
            ['hero', 'lookbookHorizontal', 'logoCloud', 'ctaBanner', 'contact'],
            ['hero', 'lookbookHorizontal', 'about', 'ctaBanner', 'contact'],
            ['hero', 'about', 'lookbookHorizontal', 'logoCloud', 'contact']
        ],
        music: [
            ['hero', 'releaseGrid', 'statsStrip', 'about', 'ctaBanner', 'contact'],
            ['hero', 'releaseGrid', 'about', 'testimonials', 'contact'],
            ['hero', 'statsStrip', 'releaseGrid', 'logoCloud', 'contact']
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

    /* ─── PROFILES ────────────────────────────────────────────────
     * Per-type design + content personality. Consumed by the compiler
     * (visual identity CSS, default content fills), by app.js
     * (palette / preset / font biasing) and by ai.js (persona hint
     * fed to the LLM so it generates industry-appropriate copy).
     *
     * Each profile is an object of POOLS — pick a random member so
     * we still get variety across regens but stay inside the right
     * aesthetic lane for the type.
     *
     *   presetIds:   preferred animation style IDs (pool)
     *   palettes:    [accent, bg] hex pairs (pool)
     *   fonts:       preferred fontPair keys (pool)
     *   corners, cardTreatment, navStyle, heroLayout, etc. — pools
     *                of values the app will randomly pick from when
     *                the axis is unset & unlocked.
     *   statsStrip:  default {v,l} entries for the big-numbers band
     *   logoCloud:   default brand names for the trust marquee
     *   team:        default team member {n,r} entries
     *   labels:      overrides for services/portfolio/team/stats etc.
     *                section mono labels (e.g. portfolio → "GAMES")
     *   persona:     one-line prose hint fed to the AI prompt so
     *                generated copy matches the type
     *   bodyClass:   CSS hook (always `sitetype-<type>`)
     * ─────────────────────────────────────────────────────────── */
    var PROFILES = {
        gaming: {
            presetIds: ['neon', 'matrix', 'plasma', 'circuits', 'galaxy', 'vortex', 'nebula'],
            palettes: [
                ['#00ffa3', '#060611'], ['#ff2e63', '#0d0b1e'], ['#7c4dff', '#0a0a14'],
                ['#00e5ff', '#050510'], ['#ffd300', '#12020e'], ['#ff0059', '#080414'],
                ['#ff6b35', '#0a0608'], ['#39ff14', '#030308'], ['#ff00ff', '#0a000f'],
                ['#00b8ff', '#050a14']
            ],
            fonts: ['arena', 'tech', 'terminal', 'futurist', 'brutalist', 'mono', 'athletic'],
            corners: ['sharp', 'sharp', 'soft'],
            cardTreatment: ['bordered', 'filled', 'glass'],
            navStyle: ['minimal', 'ghost', 'pill'],
            heroLayout: ['name-lockup', 'name-lockup', 'centered', 'left'],
            heroArt: ['grid', 'cross', 'dots'],
            buttonStyle: ['sharp', 'solid', 'outline'],
            typeScale: ['dramatic', 'normal'],
            labelStyle: ['bar', 'stripe', 'number'],
            dividerStyle: ['numbered', 'line'],
            logoStyle: ['monogram', 'bracket', 'slash'],
            cursorStyle: ['crosshair', 'ring-only', 'magnetic'],
            headingAlign: ['left', 'center'],
            statsStrip: [
                { v: '450K', l: 'PLAYERS' }, { v: '2.1M', l: 'MATCHES' },
                { v: 'RANK #12', l: 'LEADERBOARD' }, { v: '98%', l: 'HEADSHOT' },
                { v: '1.7K', l: 'HOURS' }
            ],
            logoCloud: ['Razer', 'HyperX', 'G FUEL', 'SteelSeries', 'Corsair', 'Twitch', 'Logitech G', 'NVIDIA'],
            team: [
                { n: 'Nova Sato', r: 'Team Captain' },
                { n: 'Rax Duvall', r: 'Duelist / IGL' },
                { n: 'Echo Vance', r: 'Smokes / Support' },
                { n: 'Pixel Orta', r: 'Coach' }
            ],
            labels: { portfolio: 'GAMEPLAY', services: 'MODES', team: 'ROSTER', process: 'RANKUP', ctaBanner: 'QUEUE UP' },
            cta: {
                heroCta:        ['PLAY FREE', 'QUEUE UP', 'ENTER ARENA', 'DROP IN', 'JOIN SQUAD'],
                heroCtaSecondary:['WATCH TRAILER', 'VIEW ROSTER', 'SEE MODES'],
                ctaBannerHeading:['Ready to drop in?', 'Enter the arena.', 'One match. One objective.'],
                ctaBannerSub:   ['Free to play. Queue up now and climb the ranks.', 'Five roles. Infinite outcomes. No subscription.'],
                ctaBannerCta:   ['PLAY FREE', 'QUEUE UP', 'DOWNLOAD NOW']
            },
            persona: 'high-energy esports / gaming site — expect stats like K/D, rank, hours logged, tournament wins; copy should feel like a clan page or streamer portfolio, NOT a marketing agency',
            navExtra: { label: 'QUEUE UP', href: '#contact', kind: 'button' },
            footerRecipe: {
                tagline: 'Queue fast. Rank faster. Always-on servers worldwide.',
                columns: [
                    { heading: 'PLAY',       items: [{ label: 'Modes',    href: '#gameModes' }, { label: 'Roster',   href: '#agentRoster' }, { label: 'Patch Notes', href: '#' }] },
                    { heading: 'COMMUNITY',  items: [{ label: 'Discord',  href: '#' }, { label: 'Twitch',       href: '#' }, { label: 'Reddit',      href: '#' }] },
                    { heading: 'SUPPORT',    items: [{ label: 'Server Status', href: '#' }, { label: 'Report a Bug', href: '#' }, { label: 'Terms',       href: '#' }] }
                ]
            },
            content: {
                agentRoster: [
                    { name: 'Vortex', role: 'DUELIST', ability: 'Aggressive entry fragger with time-warp dash' },
                    { name: 'Cipher', role: 'SENTINEL', ability: 'Lockdown specialist — locks sites with tripwires' },
                    { name: 'Echo',   role: 'INITIATOR', ability: 'Sonar pulse reveals enemies through walls' },
                    { name: 'Kairo',  role: 'CONTROLLER', ability: 'Smoke + area denial at long range' }
                ],
                gameModes: [
                    { name: 'Ranked', desc: '5v5 competitive. Climb Iron to Radiant.', tag: 'COMPETITIVE' },
                    { name: 'Unrated', desc: 'Standard rules, no rank pressure.', tag: 'CASUAL' },
                    { name: 'Spike Rush', desc: 'Fast-paced bo9 with random buffs.', tag: 'QUICK' },
                    { name: 'Deathmatch', desc: 'Free-for-all warmup, 10 min.', tag: 'WARMUP' }
                ],
                statWall: [
                    { v: '2.1M+', l: 'Matches Played' },
                    { v: 'RADIANT', l: 'Peak Rank' },
                    { v: '1.78', l: 'K/D Ratio' },
                    { v: '12K',  l: 'Hours Logged' }
                ],
                cinematicReel: { heading: 'Enter the arena', sub: 'Five roles. One objective. Zero retries. Queue up free.', cta: 'Play Free', label: 'NOW PLAYING' }
            }
        },
        shop: {
            presetIds: ['meshGrad', 'iridescent', 'sunsetBlob', 'morphBlob', 'prism'],
            palettes: [
                ['#ff5c8a', '#fff5f2'], ['#0b0b0b', '#f4efe8'], ['#1a1a1a', '#faf7f0'],
                ['#c2410c', '#fef3eb'], ['#6d28d9', '#fdf9ff'],
                ['#059669', '#f0fdf4'], ['#0f172a', '#f1f5f9'], ['#be185d', '#fff1f5'],
                ['#7c2d12', '#fef7ed']
            ],
            fonts: ['retail', 'modern', 'humanist', 'editorial', 'boutique', 'streetwear'],
            corners: ['soft', 'pill', 'soft'],
            cardTreatment: ['floating', 'minimal', 'bordered'],
            navStyle: ['pill', 'minimal', 'default'],
            heroLayout: ['left', 'split', 'centered'],
            buttonStyle: ['solid', 'lifted', 'gradient'],
            typeScale: ['normal', 'dramatic'],
            labelStyle: ['default', 'dot'],
            logoStyle: ['mark-left', 'dot', 'underline', ''],
            headingAlign: ['left', 'center'],
            statsStrip: [
                { v: '120K+', l: 'ORDERS SHIPPED' }, { v: '4.9★', l: 'AVG REVIEW' },
                { v: '48H', l: 'FAST SHIPPING' }, { v: '30 DAY', l: 'RETURNS' }
            ],
            logoCloud: ['Vogue', 'Highsnobiety', 'Dazed', 'Hypebeast', 'ELLE', 'GQ', 'Nylon', 'Refinery29'],
            team: [
                { n: 'Léa Moreau', r: 'Founder / Creative' },
                { n: 'Theo Park', r: 'Head of Product' },
                { n: 'Imani Cole', r: 'Customer Care' }
            ],
            labels: { portfolio: 'SHOP', services: 'COLLECTION', pricing: 'BUNDLES', ctaBanner: 'SHOP NOW' },
            cta: {
                heroCta:        ['Shop Now', 'Browse Collection', 'Add to Cart', 'Start Shopping'],
                heroCtaSecondary:['View Lookbook', 'See What\u2019s New'],
                ctaBannerHeading:['Free shipping on orders over $75.', 'The new drop is here.', 'Good things ship fast.'],
                ctaBannerSub:   ['Same-day delivery in most cities. Hassle-free returns up to 30 days.', 'Curated. Responsibly sourced. Shipped carbon-neutral.'],
                ctaBannerCta:   ['Shop Now', 'Shop the Drop', 'Browse Collection']
            },
            pageRecipes: [
                { id: 'shop',    name: 'Shop',    path: '/shop',    sections: ['categoryChips','productGrid','dealBanner','ctaBanner'] },
                { id: 'about',   name: 'About',   path: '/about',   sections: ['about','team','statsStrip','logoCloud'] },
                { id: 'contact', name: 'Contact', path: '/contact', sections: [] }
            ],
            persona: 'consumer shop / DTC brand — portfolio acts as a product grid, pricing reads as bundles, stats are orders-shipped + reviews; copy is aspirational and product-led',
            navExtra: { label: 'Cart', href: '#', kind: 'icon-cart' },
            footerRecipe: {
                tagline: 'Curated goods, shipped fast. Free returns within 30 days.',
                columns: [
                    { heading: 'SHOP',     items: [{ label: 'All Products', href: '/shop' }, { label: 'New Arrivals',   href: '/shop#new' }, { label: 'Bundles',  href: '#pricing' }] },
                    { heading: 'HELP',     items: [{ label: 'Shipping',     href: '/contact' }, { label: 'Returns',        href: '/contact' }, { label: 'Contact',  href: '/contact' }] },
                    { heading: 'COMPANY',  items: [{ label: 'About',        href: '/about' },   { label: 'Stockists',      href: '#' },         { label: 'Journal',  href: '#' }] }
                ]
            },
            content: {
                productGrid: [
                    { name: 'Organic Hass Avocado', price: '$1.49', category: 'Produce', badge: 'FRESH' },
                    { name: 'Sourdough Loaf, bakery-fresh', price: '$4.99', category: 'Bakery', badge: '' },
                    { name: 'Free-range Eggs, dozen', price: '$5.29', category: 'Dairy', badge: '' },
                    { name: 'Cold-pressed Orange Juice 1L', price: '$6.49', category: 'Drinks', badge: 'NEW' },
                    { name: 'Grass-fed Ribeye, 12oz', price: '$18.99', category: 'Butcher', badge: '' },
                    { name: 'Wild Blueberries, 500g', price: '$7.49', category: 'Produce', badge: '-10%' }
                ],
                categoryChips: ['Produce', 'Bakery', 'Dairy', 'Butcher', 'Pantry', 'Drinks', 'Frozen', 'Household'],
                dealBanner: { tag: 'THIS WEEK ONLY', heading: 'Save up to 30% on fresh produce', sub: 'Same-day delivery on orders over $35. Free pickup, always.', cta: 'Shop Deals' }
            }
        },
        restaurant: {
            presetIds: ['ember', 'lavaLamp', 'auroraBlob', 'sunsetBlob', 'fireflies'],
            palettes: [
                ['#c2410c', '#1a0f08'], ['#b45309', '#11080a'], ['#92400e', '#14110d'],
                ['#dc2626', '#0d0604'], ['#f59e0b', '#0f0a07'],
                ['#713f12', '#fdf6ec'], ['#881337', '#1a0a0f'], ['#166534', '#0a110d'],
                ['#a16207', '#13100b']
            ],
            fonts: ['chef', 'editorial', 'luxe', 'classical', 'humanist'],
            corners: ['soft', 'soft', 'pill'],
            cardTreatment: ['minimal', 'bordered', 'floating'],
            navStyle: ['minimal', 'default'],
            heroLayout: ['dish-photo', 'dish-photo', 'centered', 'left', 'split'],
            buttonStyle: ['outline', 'solid'],
            typeScale: ['normal', 'dramatic'],
            labelStyle: ['dot', 'default', 'bar'],
            logoStyle: ['underline', 'mark-left', ''],
            headingAlign: ['center', 'left'],
            statsStrip: [
                { v: 'EST 1994', l: 'FAMILY RECIPE' }, { v: '4.8★', l: 'OVER 1,200 REVIEWS' },
                { v: '18', l: 'SEASONAL DISHES' }, { v: '100%', l: 'FARM SOURCED' }
            ],
            logoCloud: ['Eater', 'Bon Appétit', 'Michelin Guide', 'TimeOut', 'Zagat', 'Condé Nast Traveler'],
            team: [
                { n: 'Chef Aurelia Rossi', r: 'Executive Chef' },
                { n: 'Marco Delacroix', r: 'Sommelier' },
                { n: 'Yuki Tanaka', r: 'Pastry Chef' }
            ],
            labels: { portfolio: 'MENU', services: 'EXPERIENCES', team: 'OUR KITCHEN', ctaBanner: 'RESERVE A TABLE' },
            cta: {
                heroCta:        ['Book a Table', 'Reserve', 'View Menu', 'Order Online'],
                heroCtaSecondary:['See the Menu', 'Find Us', 'Call Us'],
                ctaBannerHeading:['Come sit at our table.', 'Saturday night has a seat for you.', 'Dinner is on.'],
                ctaBannerSub:   ['Weekends book fast. Reserve a seat for the best table in town.', 'Private dining, seasonal tastings, and weekend brunch.'],
                ctaBannerCta:   ['Book a Table', 'Reserve Now', 'View Tonight\u2019s Menu']
            },
            pageRecipes: [
                { id: 'menu',         name: 'Menu',         path: '/menu',         sections: ['menuSections','ctaBanner'] },
                { id: 'reservations', name: 'Reservations', path: '/reservations', sections: [] },
                { id: 'about',        name: 'About',        path: '/about',        sections: ['about','team','statsStrip'] },
                { id: 'contact',      name: 'Contact',      path: '/contact',      sections: [] }
            ],
            persona: 'restaurant / hospitality — portfolio is the menu, services are tasting experiences, copy uses sensory language (textures, ingredients, provenance) and reservation CTAs',
            navExtra: { label: 'Book a Table', href: '/reservations', kind: 'button' },
            footerRecipe: {
                tagline: 'Open for dinner Tuesday – Sunday. Brunch on weekends.',
                columns: [
                    { heading: 'HOURS',    items: ['Tue – Thu  5 – 10pm', 'Fri – Sat  5 – 11pm', 'Sun brunch  11 – 3pm', 'Closed Mondays'] },
                    { heading: 'VISIT',    items: [{ label: 'Reservations', href: '/reservations' }, { label: 'Private Dining', href: '/contact' }, { label: 'Gift Cards', href: '#' }] },
                    { heading: 'FOLLOW',   items: [{ label: 'Instagram',    href: '#' },              { label: 'Newsletter',     href: '#' },          { label: 'Press',      href: '#' }] }
                ]
            },
            content: {
                menuSections: [
                    { name: 'Burrata & Heirloom Tomatoes', desc: 'Stracciatella, aged balsamic, torn basil, focaccia.', price: '$17', category: 'Antipasti', tags: 'V' },
                    { name: 'Beef Carpaccio',              desc: 'Thin-sliced prime, arugula, lemon oil, pecorino.', price: '$19', category: 'Antipasti', tags: '' },
                    { name: 'Wild-Mushroom Tagliatelle',   desc: 'Hand-cut egg pasta, porcini, thyme butter.',        price: '$26', category: 'Primi', tags: 'V' },
                    { name: 'Cacio e Pepe',                desc: 'Tonnarelli, pecorino romano, black pepper.',         price: '$22', category: 'Primi', tags: 'V' },
                    { name: 'Bistecca alla Fiorentina',    desc: '34-day dry-aged T-bone, rosemary, sea salt.',        price: '$68', category: 'Secondi', tags: '' },
                    { name: 'Branzino al Cartoccio',       desc: 'Whole sea bass, fennel, Amalfi lemon.',             price: '$44', category: 'Secondi', tags: '' },
                    { name: 'Tiramisu',                    desc: 'Mascarpone, espresso, cocoa, ladyfingers.',         price: '$12', category: 'Dolci', tags: 'V' },
                    { name: 'Affogato',                    desc: 'Vanilla gelato drowned in a shot of espresso.',     price: '$10', category: 'Dolci', tags: 'V' }
                ]
            }
        },
        portfolio: {
            presetIds: ['obsidian', 'silk', 'noiseGrad', 'iridescent', 'bokeh', 'stardust'],
            palettes: [
                ['#f5f5f5', '#0a0a0a'], ['#e6b13a', '#111111'], ['#d4d4d4', '#0f0f12'],
                ['#ff6b6b', '#0a0a0a'], ['#c4a8ff', '#080810'],
                ['#fbbf24', '#18181b'], ['#10b981', '#0a0f0c'], ['#f5f5f5', '#1c1917'],
                ['#111111', '#fafaf9']
            ],
            fonts: ['runway', 'editorial', 'display', 'luxe', 'modern', 'magazine'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'bordered', 'floating'],
            navStyle: ['minimal', 'ghost', 'default'],
            heroLayout: ['name-lockup', 'left', 'minimal', 'split'],
            typeScale: ['dramatic', 'tight', 'normal'],
            labelStyle: ['number', 'stripe'],
            dividerStyle: ['numbered', 'dotline'],
            logoStyle: ['monogram', 'slash', ''],
            headingAlign: ['left'],
            containerWidth: ['narrow', 'normal'],
            statsStrip: [
                { v: '48', l: 'SHIPPED PROJECTS' }, { v: '9 YEARS', l: 'CLIENT WORK' },
                { v: '24', l: 'AWARDS' }, { v: '14', l: 'COUNTRIES' }
            ],
            logoCloud: ['Nike', 'Spotify', 'Apple', 'Stripe', 'Figma', 'Linear', 'Notion', 'Vercel'],
            team: [
                { n: 'This is me', r: 'Designer' }
            ],
            labels: { portfolio: 'SELECTED WORK', about: 'PROFILE', process: 'HOW I WORK' },
            persona: 'solo/studio portfolio — emphasize individual point of view, case-study projects with client/tag metadata, first-person or studio-voice copy',
            content: {
                statWall: [
                    { v: '48', l: 'Projects Shipped' },
                    { v: '9 YRS', l: 'Client Work' },
                    { v: '24', l: 'Awards' },
                    { v: '14', l: 'Countries' }
                ],
                raceTimeline: [
                    { date: '2026 · Q2', event: 'Stripe — Atlas onboarding redesign', result: 'Shipped', points: '+32%' },
                    { date: '2026 · Q1', event: 'Linear — Marketing site v3',        result: 'Launched', points: '—' },
                    { date: '2025 · Q4', event: 'Notion — Calendar product IA',      result: 'Shipped', points: '—' },
                    { date: '2025 · Q3', event: 'Vercel — DX docs overhaul',         result: 'Launched', points: '—' },
                    { date: '2025 · Q2', event: 'Figma — Config keynote visuals',    result: 'Delivered', points: '—' }
                ]
            }
        },
        photography: {
            presetIds: ['bokeh', 'silk', 'stardust', 'nebula', 'iridescent'],
            palettes: [
                ['#fafaf9', '#0c0a09'], ['#d4a373', '#1c120b'], ['#e4c1b3', '#10090a']
            ],
            fonts: ['editorial', 'luxe', 'classical', 'display'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'floating'],
            navStyle: ['minimal', 'ghost'],
            heroLayout: ['minimal', 'left', 'split'],
            typeScale: ['dramatic', 'tight'],
            logoStyle: ['slash', 'monogram', ''],
            labelStyle: ['number', 'default'],
            headingAlign: ['left', 'center'],
            statsStrip: [
                { v: '250+', l: 'WEDDINGS SHOT' }, { v: '32', l: 'EDITORIAL FEATURES' },
                { v: '12', l: 'YEARS BEHIND LENS' }
            ],
            logoCloud: ['Vogue', 'Harper\u2019s Bazaar', 'ELLE', 'Nat Geo', 'National Portrait'],
            team: [{ n: 'Aria Lin', r: 'Lead Photographer' }, { n: 'Sami Ortega', r: 'Second Shooter' }],
            labels: { portfolio: 'GALLERY', services: 'SESSIONS', pricing: 'PACKAGES' },
            persona: 'photography studio — visual-first, minimal copy, gallery-heavy; mention film/digital/lens specifics if hinted, pricing reads as session packages'
        },
        blog: {
            presetIds: ['noiseGrad', 'silk', 'meshGrad', 'obsidian', 'snow'],
            palettes: [
                ['#111111', '#faf7f0'], ['#0b0b0b', '#f4efe8'], ['#d97706', '#fffbeb'],
                ['#1e1b4b', '#f5f3ff']
            ],
            fonts: ['editorial', 'classical', 'journal', 'humanist', 'luxe'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'bordered'],
            navStyle: ['minimal', 'default'],
            heroLayout: ['left', 'minimal'],
            typeScale: ['tight', 'normal'],
            logoStyle: ['underline', ''],
            labelStyle: ['number', 'default', 'bar'],
            dividerStyle: ['line', 'dotline', 'numbered'],
            containerWidth: ['narrow', 'normal'],
            headingAlign: ['left'],
            statsStrip: [
                { v: '12K', l: 'SUBSCRIBERS' }, { v: 'WEEKLY', l: 'ESSAYS' },
                { v: '180', l: 'ARCHIVED POSTS' }
            ],
            logoCloud: ['The Verge', 'Wired', 'The Atlantic', 'New Yorker', 'FT', 'Monocle'],
            team: [{ n: 'The Editor', r: 'Writer' }],
            labels: { portfolio: 'LATEST ESSAYS', about: 'MASTHEAD', ctaBanner: 'SUBSCRIBE' },
            persona: 'blog / editorial publication — portfolio cards are essay posts with date/tag/excerpt; use a masthead voice; CTA is newsletter subscribe'
        },
        podcast: {
            presetIds: ['sineWaves', 'ripple', 'liquidWave', 'meshGrad', 'aurora'],
            palettes: [
                ['#a855f7', '#0e0a1c'], ['#f59e0b', '#130a03'], ['#22d3ee', '#05111a']
            ],
            fonts: ['vinyl', 'display', 'tech', 'editorial', 'humanist'],
            corners: ['pill', 'soft'],
            cardTreatment: ['floating', 'filled', 'glass'],
            navStyle: ['pill', 'default'],
            heroLayout: ['centered', 'split'],
            buttonStyle: ['solid', 'gradient', 'lifted'],
            labelStyle: ['dot', 'bar'],
            statsStrip: [
                { v: '1.2M', l: 'DOWNLOADS' }, { v: '140', l: 'EPISODES' },
                { v: '4.9★', l: 'APPLE PODCASTS' }
            ],
            logoCloud: ['Spotify', 'Apple Podcasts', 'Overcast', 'Pocket Casts', 'YouTube Music', 'Stitcher'],
            team: [{ n: 'Host 1', r: 'Host' }, { n: 'Host 2', r: 'Co-host' }, { n: 'Producer', r: 'Producer' }],
            labels: { portfolio: 'EPISODES', services: 'SEASONS', ctaBanner: 'LISTEN NOW' },
            cta: {
                heroCta:        ['Listen Now', 'Play Latest', 'Subscribe', 'Latest Episode'],
                heroCtaSecondary:['Apple Podcasts', 'Spotify', 'All Episodes'],
                ctaBannerHeading:['New episodes every Tuesday.', 'Tap in.', 'Never miss an episode.'],
                ctaBannerSub:   ['Subscribe on Apple Podcasts, Spotify, Overcast, or anywhere you listen.', 'Honest conversations with the people building the future.'],
                ctaBannerCta:   ['Subscribe', 'Listen Now', 'Latest Episode']
            },
            persona: 'podcast show — portfolio cards are episode titles with guest/season tags; CTAs push toward Apple/Spotify; tone is conversational'
        ,
            navExtra: { label: 'Listen', href: '#contact', kind: 'button' },
            footerRecipe: {
                tagline: 'New episodes every Tuesday. Subscribe anywhere you listen.',
                columns: [
                    { heading: 'LISTEN',  items: [{ label: 'Apple Podcasts', href: '#' }, { label: 'Spotify', href: '#' }, { label: 'Overcast', href: '#' }, { label: 'RSS', href: '#' }] },
                    { heading: 'SHOW',    items: [{ label: 'All Episodes', href: '#portfolio' }, { label: 'Guests',  href: '#' }, { label: 'Transcripts', href: '#' }] },
                    { heading: 'ABOUT',   items: [{ label: 'The Hosts',    href: '#' },          { label: 'Press',   href: '#' }, { label: 'Contact',     href: '/contact' }] }
                ]
            }
        },
        event: {
            presetIds: ['neon', 'prism', 'confetti', 'spark', 'iridescent', 'aurora'],
            palettes: [
                ['#ff2e63', '#0a0a14'], ['#ffd300', '#0b0606'], ['#7c4dff', '#0a0a14'],
                ['#22d3ee', '#05111a']
            ],
            fonts: ['arena', 'display', 'futurist', 'brutalist', 'tech'],
            corners: ['sharp', 'pill'],
            cardTreatment: ['bordered', 'filled', 'floating'],
            navStyle: ['pill', 'minimal'],
            heroLayout: ['name-lockup', 'centered', 'split'],
            buttonStyle: ['solid', 'gradient', 'sharp'],
            typeScale: ['dramatic'],
            labelStyle: ['number', 'stripe', 'bar'],
            statsStrip: [
                { v: 'SEP 12', l: 'DATE' }, { v: 'BERLIN', l: 'VENUE' },
                { v: '3 DAYS', l: 'DURATION' }, { v: '40+', l: 'SPEAKERS' }
            ],
            logoCloud: ['TechCrunch', 'Wired', 'The Verge', 'Fast Company', 'Forbes', 'Sifted'],
            team: [
                { n: 'Keynote Speaker', r: 'Opening Keynote' },
                { n: 'Panel Chair', r: 'Day 1 Host' },
                { n: 'Workshop Lead', r: 'Labs' }
            ],
            labels: { portfolio: 'PROGRAM', team: 'SPEAKERS', pricing: 'TICKETS', ctaBanner: 'GET TICKETS' },
            cta: {
                heroCta:        ['Get Tickets', 'Register', 'Save Your Spot', 'Buy Pass'],
                heroCtaSecondary:['View Program', 'Speaker Lineup', 'Venue Info'],
                ctaBannerHeading:['Early-bird ends Friday.', 'Last call for early-bird.', 'Only 200 seats left.'],
                ctaBannerSub:   ['40+ speakers across three days in Berlin. Pass includes workshops + after-hours mixers.', 'Save $200 before early-bird closes. Workshops fill fast.'],
                ctaBannerCta:   ['Get Tickets', 'Register Now', 'Claim Early-bird']
            },
            pageRecipes: [
                { id: 'program', name: 'Program',  path: '/program',  sections: ['services','statsStrip'] },
                { id: 'speakers',name: 'Speakers', path: '/speakers', sections: ['team','logoCloud'] },
                { id: 'tickets', name: 'Tickets',  path: '/tickets',  sections: ['pricing','faq','ctaBanner'] },
                { id: 'contact', name: 'Contact',  path: '/contact',  sections: [] }
            ],
            persona: 'live event / conference — date/venue/speakers/tickets are the stars; copy is urgent and countdown-aware; portfolio reads as program sessions'
        ,
            navExtra: { label: 'Get Tickets', href: '/tickets', kind: 'button' },
            footerRecipe: {
                tagline: 'Three days. 40+ speakers. One unforgettable room.',
                columns: [
                    { heading: 'ATTEND',  items: [{ label: 'Tickets',   href: '/tickets' }, { label: 'Program',  href: '/program' }, { label: 'Speakers',  href: '/speakers' }] },
                    { heading: 'VENUE',   items: [{ label: 'Location',  href: '#' },         { label: 'Hotels',   href: '#' },        { label: 'Travel',    href: '#' }] },
                    { heading: 'CONTACT', items: [{ label: 'Press',     href: '#' },         { label: 'Sponsors', href: '#' },        { label: 'Help',      href: '/contact' }] }
                ]
            }
        },
        app: {
            presetIds: ['meshGrad', 'northern', 'morphBlob', 'oceanBlob', 'constellation', 'aurora'],
            palettes: [
                ['#6366f1', '#030712'], ['#22d3ee', '#020817'], ['#14b8a6', '#010712'],
                ['#f472b6', '#0a0614']
            ],
            fonts: ['tech', 'modern', 'humanist', 'futurist'],
            corners: ['soft', 'pill'],
            cardTreatment: ['glass', 'floating', 'filled'],
            navStyle: ['pill', 'minimal'],
            heroLayout: ['split', 'left', 'centered'],
            buttonStyle: ['gradient', 'solid', 'lifted'],
            typeScale: ['normal', 'dramatic'],
            logoStyle: ['mark-left', 'dot', ''],
            statsStrip: [
                { v: '500K+', l: 'DOWNLOADS' }, { v: '4.8★', l: 'APP STORE' },
                { v: '#1', l: 'PRODUCTIVITY' }, { v: '150+', l: 'COUNTRIES' }
            ],
            logoCloud: ['Product Hunt', 'TechCrunch', 'The Verge', 'Wired', 'Fast Company', '9to5Mac'],
            team: [
                { n: 'Alex Chen', r: 'CEO / Co-founder' },
                { n: 'Priya Rao', r: 'CTO / Co-founder' },
                { n: 'Jordan Lee', r: 'Design Lead' }
            ],
            labels: { portfolio: 'FEATURES IN ACTION', services: 'FEATURES', pricing: 'PLANS', ctaBanner: 'GET THE APP' },
            cta: {
                heroCta:        ['Download Free', 'Get the App', 'Try Free', 'Start Free Trial'],
                heroCtaSecondary:['App Store', 'Google Play', 'See Features'],
                ctaBannerHeading:['Free to download. Free to use.', 'Try it free for 14 days.', 'Ready when you are.'],
                ctaBannerSub:   ['Works on iOS, Android, and the web. No credit card required to start.', 'Join 500,000+ people who get more done with us.'],
                ctaBannerCta:   ['Download Free', 'Get the App', 'Start Free']
            },
            pageRecipes: [
                { id: 'features', name: 'Features', path: '/features', sections: ['services','portfolio','statsStrip'] },
                { id: 'pricing',  name: 'Pricing',  path: '/pricing',  sections: ['pricing','faq','ctaBanner'] },
                { id: 'contact',  name: 'Support',  path: '/support',  sections: [] }
            ],
            persona: 'mobile/SaaS app — download CTAs + App Store badge energy; services = features; pricing = monthly plans; copy is benefit-led and outcome-focused'
        ,
            navExtra: { label: 'Download', href: '/features', kind: 'button' },
            footerRecipe: {
                tagline: 'Works on iOS, Android, and the web. Free to download.',
                columns: [
                    { heading: 'PRODUCT', items: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Changelog', href: '#' }] },
                    { heading: 'SUPPORT', items: [{ label: 'Help Center', href: '/support' }, { label: 'Status', href: '#' }, { label: 'Contact',   href: '/support' }] },
                    { heading: 'COMPANY', items: [{ label: 'About',     href: '#about' },     { label: 'Privacy', href: '#' }, { label: 'Terms',     href: '#' }] }
                ]
            }
        },
        saas: {
            presetIds: ['meshGrad', 'constellation', 'northern', 'oceanBlob', 'aurora', 'frost'],
            palettes: [
                ['#6366f1', '#030712'], ['#0ea5e9', '#020817'], ['#10b981', '#020712'],
                ['#8b5cf6', '#0a0614']
            ],
            fonts: ['tech', 'modern', 'humanist'],
            corners: ['soft'],
            cardTreatment: ['glass', 'minimal', 'bordered'],
            navStyle: ['pill', 'minimal', 'default'],
            heroLayout: ['split', 'left'],
            buttonStyle: ['solid', 'gradient'],
            statsStrip: [
                { v: '10M+', l: 'API CALLS / DAY' }, { v: '99.99%', l: 'UPTIME' },
                { v: 'SOC 2', l: 'COMPLIANT' }, { v: '1200+', l: 'TEAMS' }
            ],
            logoCloud: ['Stripe', 'Notion', 'Linear', 'Figma', 'Vercel', 'Loom', 'Retool', 'Airtable'],
            team: [
                { n: 'Founding Team', r: 'Product' },
                { n: 'Eng Lead', r: 'Engineering' },
                { n: 'DX Lead', r: 'Developer Relations' }
            ],
            labels: { portfolio: 'CUSTOMERS', services: 'PLATFORM', pricing: 'PRICING', ctaBanner: 'START FREE' },
            cta: {
                heroCta:        ['Start Free', 'Try Free', 'Book a Demo', 'Get Started'],
                heroCtaSecondary:['Book a Demo', 'See Pricing', 'Read Docs'],
                ctaBannerHeading:['Start free. Upgrade when you\u2019re ready.', 'Book a 15-minute demo.', 'Ship faster, starting today.'],
                ctaBannerSub:   ['No credit card required. Full access to every feature for 14 days.', 'Used by 1,200+ engineering teams — from seed stage to Fortune 100.'],
                ctaBannerCta:   ['Start Free', 'Book a Demo', 'Talk to Sales']
            },
            pageRecipes: [
                { id: 'pricing', name: 'Pricing', path: '/pricing', sections: ['pricing','faq','ctaBanner'] },
                { id: 'about',   name: 'About',   path: '/about',   sections: ['about','team','statsStrip','logoCloud'] },
                { id: 'contact', name: 'Contact', path: '/contact', sections: [] }
            ],
            persona: 'B2B SaaS platform — logoCloud is client proof, pricing is seat-based tiers, features emphasize integrations/security/uptime'
        ,
            navExtra: { label: 'Start Free', href: '/contact', kind: 'button' },
            footerRecipe: {
                tagline: 'Trusted by 1,200+ engineering teams. SOC 2 Type II certified.',
                columns: [
                    { heading: 'PRODUCT',  items: [{ label: 'Platform',  href: '#services' }, { label: 'Pricing', href: '/pricing' }, { label: 'Integrations', href: '#' }, { label: 'Changelog', href: '#' }] },
                    { heading: 'DEVELOPERS', items: [{ label: 'Docs',    href: '#' }, { label: 'API Reference', href: '#' }, { label: 'Status', href: '#' }] },
                    { heading: 'COMPANY',  items: [{ label: 'About',    href: '/about' }, { label: 'Customers', href: '#portfolio' }, { label: 'Security', href: '#' }, { label: 'Contact', href: '/contact' }] }
                ]
            }
        },
        course: {
            presetIds: ['meshGrad', 'northern', 'aurora', 'prism', 'iridescent'],
            palettes: [
                ['#f59e0b', '#0c0a09'], ['#8b5cf6', '#0a0614'], ['#10b981', '#020712']
            ],
            fonts: ['display', 'editorial', 'humanist', 'modern'],
            corners: ['soft', 'pill'],
            cardTreatment: ['filled', 'floating', 'bordered'],
            navStyle: ['pill', 'default'],
            heroLayout: ['left', 'split'],
            buttonStyle: ['solid', 'gradient', 'lifted'],
            statsStrip: [
                { v: '8 WEEKS', l: 'COHORT LENGTH' }, { v: '96%', l: 'COMPLETION RATE' },
                { v: '4K+', l: 'ALUMNI' }, { v: '1:1', l: 'MENTOR RATIO' }
            ],
            logoCloud: ['Harvard', 'MIT', 'Stanford', 'Y Combinator', 'On Deck', 'Reforge'],
            team: [
                { n: 'Lead Instructor', r: 'Instructor' },
                { n: 'TA', r: 'Mentor' }
            ],
            labels: { portfolio: 'CURRICULUM', services: 'WHAT YOU\u2019LL LEARN', team: 'INSTRUCTORS', pricing: 'ENROLLMENT', ctaBanner: 'APPLY NOW' },
            persona: 'online course / bootcamp / academy — curriculum modules, cohort dates, instructor bios, apply/enroll CTAs'
        },
        fitness: {
            presetIds: ['ember', 'neon', 'aurora', 'meshGrad', 'plasma'],
            palettes: [
                ['#22d3ee', '#020617'], ['#f43f5e', '#09090b'], ['#84cc16', '#0a0a0a']
            ],
            fonts: ['brutalist', 'tech', 'futurist', 'display'],
            corners: ['sharp', 'pill'],
            cardTreatment: ['filled', 'bordered'],
            navStyle: ['minimal', 'pill'],
            heroLayout: ['left', 'split', 'centered'],
            buttonStyle: ['sharp', 'solid'],
            typeScale: ['dramatic'],
            statsStrip: [
                { v: '12 WEEKS', l: 'PROGRAM' }, { v: '1000+', l: 'MEMBERS' },
                { v: '5 DAYS', l: 'PER WEEK' }, { v: '4AM–10PM', l: 'OPEN' }
            ],
            logoCloud: ['Men\u2019s Health', 'Women\u2019s Health', 'Runner\u2019s World', 'Onnit'],
            team: [
                { n: 'Coach K', r: 'Head Coach' },
                { n: 'Dr. Rivera', r: 'Sports Medicine' },
                { n: 'Maya Cho', r: 'Nutrition Lead' }
            ],
            labels: { portfolio: 'RESULTS', services: 'PROGRAMS', team: 'COACHES', pricing: 'MEMBERSHIP', ctaBanner: 'START TRAINING' },
            persona: 'gym / fitness studio / coach — results-first, programs instead of services, members instead of customers, urgency and discipline language'
        },
        realestate: {
            presetIds: ['silk', 'obsidian', 'meshGrad', 'noiseGrad', 'bokeh'],
            palettes: [
                ['#b08968', '#1c1917'], ['#0b0b0b', '#f4efe8'], ['#d4a373', '#14100d']
            ],
            fonts: ['editorial', 'luxe', 'classical', 'display'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'floating'],
            navStyle: ['minimal', 'default'],
            heroLayout: ['split', 'left', 'minimal'],
            typeScale: ['normal', 'tight'],
            logoStyle: ['monogram', 'underline', ''],
            statsStrip: [
                { v: '$2.4B', l: 'SOLD VOLUME' }, { v: '420', l: 'LISTINGS CLOSED' },
                { v: '14 DAYS', l: 'AVG DAYS ON MARKET' }
            ],
            logoCloud: ['Sotheby\u2019s', 'Christie\u2019s', 'Compass', 'Douglas Elliman', 'The Agency'],
            team: [
                { n: 'Principal Broker', r: 'Managing Broker' },
                { n: 'Listing Agent', r: 'Senior Agent' }
            ],
            labels: { portfolio: 'LISTINGS', services: 'SPECIALTIES', team: 'AGENTS', ctaBanner: 'BOOK A SHOWING' },
            persona: 'luxury real estate — portfolio cards are listings (address, sqft, price tag), agents instead of team, showing/tour CTAs'
        },
        healthcare: {
            presetIds: ['frost', 'snow', 'meshGrad', 'noiseGrad', 'ripple'],
            palettes: [
                ['#0891b2', '#f0f9ff'], ['#059669', '#ecfdf5'], ['#2563eb', '#eff6ff'],
                ['#0ea5e9', '#0b0f14']
            ],
            fonts: ['humanist', 'modern', 'soft'],
            corners: ['soft', 'pill'],
            cardTreatment: ['minimal', 'bordered', 'floating'],
            navStyle: ['default', 'pill'],
            heroLayout: ['split', 'left', 'centered'],
            buttonStyle: ['solid', 'outline'],
            statsStrip: [
                { v: '15+', l: 'YEARS PRACTICE' }, { v: '4.9★', l: 'PATIENT RATING' },
                { v: '8,000+', l: 'PATIENTS SEEN' }
            ],
            logoCloud: ['Mayo Clinic', 'Johns Hopkins', 'NIH', 'WebMD', 'Cleveland Clinic'],
            team: [
                { n: 'Dr. A. Kumar, MD', r: 'Medical Director' },
                { n: 'Dr. L. Park, DMD', r: 'Specialist' }
            ],
            labels: { portfolio: 'TREATMENTS', services: 'SERVICES', team: 'OUR DOCTORS', ctaBanner: 'BOOK A CONSULTATION' },
            persona: 'clinic / medical practice — trust-building, credentials-heavy, patient-outcome statistics, book-a-consultation CTAs, calm copy'
        },
        fashion: {
            presetIds: ['silk', 'iridescent', 'sunsetBlob', 'noiseGrad', 'obsidian'],
            palettes: [
                ['#f5f5f5', '#0a0a0a'], ['#0a0a0a', '#f5f5f5'], ['#d4af37', '#1a1208'],
                ['#ff5c8a', '#fff0f5'], ['#6d28d9', '#fdf9ff'],
                ['#7c2d12', '#fef7ed'], ['#292524', '#fafaf9'], ['#701a75', '#fdf4ff'],
                ['#0c4a6e', '#f0f9ff']
            ],
            fonts: ['runway', 'editorial', 'luxe', 'streetwear', 'boutique', 'magazine'],
            corners: ['sharp'],
            cardTreatment: ['minimal', 'floating'],
            navStyle: ['minimal', 'ghost'],
            heroLayout: ['name-lockup', 'name-lockup', 'minimal', 'left'],
            typeScale: ['dramatic', 'tight'],
            logoStyle: ['monogram', 'slash', ''],
            labelStyle: ['number', 'default'],
            dividerStyle: ['numbered', 'line'],
            containerWidth: ['wide', 'normal'],
            headingAlign: ['left'],
            statsStrip: [
                { v: 'SS26', l: 'CURRENT COLLECTION' }, { v: '14', l: 'STOCKISTS' },
                { v: 'MADE IN', l: 'MILANO' }
            ],
            logoCloud: ['Vogue', 'Harper\u2019s Bazaar', 'ELLE', 'i-D', 'Dazed', 'AnOther'],
            team: [
                { n: 'Creative Director', r: 'Creative Director' },
                { n: 'Atelier Lead', r: 'Head of Atelier' }
            ],
            labels: { portfolio: 'THE COLLECTION', services: 'CAPSULES', team: 'THE HOUSE', ctaBanner: 'SHOP THE DROP' },
            cta: {
                heroCta:        ['Shop the Drop', 'View Lookbook', 'Shop SS26', 'Explore Collection'],
                heroCtaSecondary:['The Lookbook', 'The Story', 'Stockists'],
                ctaBannerHeading:['The SS26 collection is live.', 'Every piece. Made to last.', 'The drop lands today.'],
                ctaBannerSub:   ['Limited runs. Once it\u2019s gone, it\u2019s gone. Sign up for early access to the next capsule.', 'Hand-finished in the atelier. Delivered anywhere in the world.'],
                ctaBannerCta:   ['Shop the Drop', 'Shop SS26', 'Join the List']
            },
            pageRecipes: [
                { id: 'shop',     name: 'Shop',     path: '/shop',     sections: ['lookbookHorizontal','productGrid','ctaBanner'] },
                { id: 'lookbook', name: 'Lookbook', path: '/lookbook', sections: ['lookbookHorizontal','portfolio'] },
                { id: 'about',    name: 'Atelier',  path: '/atelier',  sections: ['about','team','statsStrip'] },
                { id: 'contact',  name: 'Contact',  path: '/contact',  sections: [] }
            ],
            persona: 'fashion / couture house — lookbook-style portfolio, collection naming conventions (SS26/AW25), boutique-voice copy, stockist namedrop',
            navExtra: { label: 'Shop', href: '/shop', kind: 'button' },
            footerRecipe: {
                tagline: 'Limited runs. Hand-finished in the atelier. Shipped worldwide.',
                columns: [
                    { heading: 'THE HOUSE', items: [{ label: 'Atelier',  href: '/atelier' }, { label: 'Lookbook',    href: '/lookbook' }, { label: 'Stockists', href: '#' }] },
                    { heading: 'SHOP',      items: [{ label: 'SS26',     href: '/shop' },    { label: 'Archive',      href: '/shop#archive' }, { label: 'Care Guide', href: '#' }] },
                    { heading: 'CLIENT',    items: [{ label: 'Sizing',   href: '#' },         { label: 'Shipping',    href: '/contact' },      { label: 'Contact',   href: '/contact' }] }
                ]
            },
            content: {
                lookbookHorizontal: [
                    { title: 'Linen Shirt — Ecru',     tag: 'SS26 · 01' },
                    { title: 'Wide-leg Trouser — Jet', tag: 'SS26 · 02' },
                    { title: 'Cropped Blazer — Bone',  tag: 'SS26 · 03' },
                    { title: 'Silk Slip — Oyster',     tag: 'SS26 · 04' },
                    { title: 'Knit Cardigan — Flax',   tag: 'SS26 · 05' },
                    { title: 'Tailored Coat — Taupe',  tag: 'SS26 · 06' }
                ]
            }
        },
        music: {
            presetIds: ['sineWaves', 'liquidWave', 'ripple', 'neon', 'plasma', 'prism'],
            palettes: [
                ['#ec4899', '#09090b'], ['#f59e0b', '#0a0a0a'], ['#22d3ee', '#030712'],
                ['#8b5cf6', '#0a0614'],
                ['#dc2626', '#0a0604'], ['#84cc16', '#0a100a'], ['#f472b6', '#18070f'],
                ['#fbbf24', '#0f0a02']
            ],
            fonts: ['vinyl', 'display', 'brutalist', 'futurist', 'editorial'],
            corners: ['sharp', 'pill'],
            cardTreatment: ['filled', 'bordered', 'floating'],
            navStyle: ['minimal', 'pill'],
            heroLayout: ['name-lockup', 'centered', 'left'],
            typeScale: ['dramatic'],
            labelStyle: ['number', 'bar'],
            logoStyle: ['monogram', 'slash', 'bracket'],
            statsStrip: [
                { v: '22M+', l: 'STREAMS' }, { v: '48', l: 'CITY TOUR' },
                { v: 'OUT NOW', l: 'DEBUT LP' }
            ],
            logoCloud: ['Pitchfork', 'Rolling Stone', 'NME', 'FADER', 'NPR', 'Billboard'],
            team: [
                { n: 'Lead Vocals', r: 'Vocals' },
                { n: 'Producer', r: 'Production' }
            ],
            labels: { portfolio: 'DISCOGRAPHY', services: 'TOUR DATES', ctaBanner: 'LISTEN EVERYWHERE' },
            cta: {
                heroCta:        ['Listen Now', 'Play', 'Stream', 'Tour Tickets'],
                heroCtaSecondary:['Spotify', 'Apple Music', 'Tour Dates'],
                ctaBannerHeading:['Out everywhere.', 'On tour — 48 cities.', 'The new LP is live.'],
                ctaBannerSub:   ['Stream the debut LP on Spotify, Apple Music, and Tidal.', 'Catch us on stage in a city near you this summer.'],
                ctaBannerCta:   ['Listen Now', 'Stream on Spotify', 'Tour Tickets']
            },
            persona: 'band / musician / record label — portfolio is discography, services become tour dates, bold typographic pressroom energy',
            navExtra: { label: 'Listen', href: '#contact', kind: 'button' },
            footerRecipe: {
                tagline: 'Streaming everywhere. New LP out now.',
                columns: [
                    { heading: 'LISTEN',  items: [{ label: 'Spotify',  href: '#' }, { label: 'Apple Music', href: '#' }, { label: 'Bandcamp', href: '#' }, { label: 'Tidal', href: '#' }] },
                    { heading: 'TOUR',    items: [{ label: 'All Dates', href: '#services' }, { label: 'VIP Packages', href: '#' }, { label: 'Book the Band', href: '/contact' }] },
                    { heading: 'FOLLOW',  items: [{ label: 'Instagram', href: '#' }, { label: 'YouTube',      href: '#' }, { label: 'Newsletter',    href: '#' }] }
                ]
            },
            content: {
                releaseGrid: [
                    { title: 'Afterglow',      year: '2026', type: 'LP' },
                    { title: 'Static Bloom',   year: '2025', type: 'EP' },
                    { title: 'Night Shift',    year: '2025', type: 'Single' },
                    { title: 'Paper Moon',     year: '2024', type: 'LP' },
                    { title: 'Cassiopeia',     year: '2024', type: 'Single' },
                    { title: 'Velvet / Bruise',year: '2023', type: 'EP' }
                ]
            }
        },
        nonprofit: {
            presetIds: ['auroraBlob', 'northern', 'fireflies', 'meshGrad', 'frost'],
            palettes: [
                ['#166534', '#f0fdf4'], ['#b45309', '#fffbeb'], ['#15803d', '#ecfdf5'],
                ['#b91c1c', '#fef2f2']
            ],
            fonts: ['humanist', 'editorial', 'classical', 'soft'],
            corners: ['soft', 'pill'],
            cardTreatment: ['minimal', 'bordered'],
            navStyle: ['default', 'minimal'],
            heroLayout: ['centered', 'left'],
            buttonStyle: ['solid', 'outline'],
            statsStrip: [
                { v: '$12M', l: 'RAISED TO DATE' }, { v: '26', l: 'COUNTRIES' },
                { v: '48K', l: 'LIVES IMPACTED' }, { v: '100%', l: 'GOES TO PROGRAMS' }
            ],
            logoCloud: ['UN', 'UNICEF', 'Gates Foundation', 'Ford Foundation', 'WHO'],
            team: [
                { n: 'Executive Director', r: 'Executive Director' },
                { n: 'Programs Lead', r: 'Programs Director' },
                { n: 'Field Lead', r: 'Director of Field Ops' }
            ],
            labels: { portfolio: 'OUR WORK', services: 'PROGRAMS', team: 'OUR TEAM', pricing: 'WAYS TO GIVE', ctaBanner: 'DONATE NOW' },
            cta: {
                heroCta:        ['Donate Now', 'Give Today', 'Join Us', 'Volunteer'],
                heroCtaSecondary:['Our Programs', 'Annual Report', 'Get Involved'],
                ctaBannerHeading:['Every dollar reaches the field.', 'Stand with us.', 'Change lives, today.'],
                ctaBannerSub:   ['100% of donations go directly to programs. Overhead is funded separately.', 'Your monthly gift keeps programs running year-round.'],
                ctaBannerCta:   ['Donate Now', 'Give Monthly', 'Volunteer']
            },
            persona: 'nonprofit / mission-driven — impact numbers, programs (not services), donor CTAs, human story-led copy with no salesy language'
        },
        finance: {
            presetIds: ['frost', 'obsidian', 'constellation', 'meshGrad', 'oceanBlob'],
            palettes: [
                ['#d4a373', '#0a0a0a'], ['#16a34a', '#020617'], ['#1e293b', '#f8fafc'],
                ['#0f172a', '#f1f5f9']
            ],
            fonts: ['editorial', 'classical', 'modern', 'luxe'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'bordered'],
            navStyle: ['default', 'minimal'],
            heroLayout: ['split', 'left'],
            typeScale: ['tight', 'normal'],
            logoStyle: ['monogram', 'mark-left', ''],
            statsStrip: [
                { v: '$4.2B', l: 'AUM' }, { v: '12%', l: 'AVG ANNUAL RETURN' },
                { v: '30+ YR', l: 'TRACK RECORD' }, { v: 'SEC', l: 'REGISTERED' }
            ],
            logoCloud: ['Bloomberg', 'Reuters', 'WSJ', 'Financial Times', 'Barron\u2019s', 'Forbes'],
            team: [
                { n: 'Managing Partner', r: 'Managing Partner' },
                { n: 'CIO', r: 'Chief Investment Officer' }
            ],
            labels: { portfolio: 'PORTFOLIO', services: 'ADVISORY', team: 'PARTNERS', ctaBanner: 'SCHEDULE A CALL' },
            persona: 'finance / investment / wealth — credibility signals (AUM, track record, regulatory), partner-led bios, advisory CTAs, restrained copy'
        },
        legal: {
            presetIds: ['obsidian', 'frost', 'noiseGrad', 'silk'],
            palettes: [
                ['#b08968', '#0c0a09'], ['#1e293b', '#f8fafc'], ['#0f172a', '#f1f5f9']
            ],
            fonts: ['classical', 'editorial', 'luxe'],
            corners: ['sharp'],
            cardTreatment: ['minimal', 'bordered'],
            navStyle: ['default', 'minimal'],
            heroLayout: ['left', 'split'],
            typeScale: ['tight', 'normal'],
            logoStyle: ['monogram', ''],
            containerWidth: ['narrow', 'normal'],
            statsStrip: [
                { v: '40+ YRS', l: 'COMBINED EXPERIENCE' }, { v: '96%', l: 'CASE SUCCESS' },
                { v: '$500M+', l: 'SETTLEMENTS' }
            ],
            logoCloud: ['WSJ', 'FT', 'Bloomberg Law', 'Reuters', 'Law360'],
            team: [
                { n: 'Senior Partner', r: 'Senior Partner' },
                { n: 'Associate', r: 'Senior Associate' }
            ],
            labels: { portfolio: 'CASE WINS', services: 'PRACTICE AREAS', team: 'OUR ATTORNEYS', ctaBanner: 'SCHEDULE CONSULTATION' },
            persona: 'law firm / legal practice — practice areas, attorneys (not team), case-win credibility, consultation CTAs, formal voice'
        },
        agency: {
            presetIds: ['obsidian', 'aurora', 'meshGrad', 'noiseGrad', 'silk', 'prism'],
            palettes: [
                ['#e6b13a', '#0a0a0a'], ['#ff6b6b', '#0a0a0a'], ['#c4a8ff', '#080810'],
                ['#f5f5f5', '#0a0a0a']
            ],
            fonts: ['editorial', 'display', 'modern', 'brutalist'],
            corners: ['sharp', 'soft'],
            cardTreatment: ['minimal', 'bordered', 'floating'],
            navStyle: ['minimal', 'default'],
            heroLayout: ['left', 'split'],
            typeScale: ['dramatic'],
            statsStrip: [
                { v: '120+', l: 'PROJECTS' }, { v: '98%', l: 'RETENTION' },
                { v: '24', l: 'AWARDS' }, { v: '12', l: 'COUNTRIES' }
            ],
            logoCloud: ['Nike', 'Spotify', 'Apple', 'Stripe', 'Figma', 'Linear', 'Notion', 'Vercel'],
            team: [
                { n: 'Alex Chen', r: 'Founder / Design' },
                { n: 'Jordan Rivera', r: 'Engineering Lead' },
                { n: 'Sam Okafor', r: 'Creative Director' }
            ],
            labels: { portfolio: 'SELECTED WORK', services: 'CAPABILITIES', process: 'HOW WE WORK', ctaBanner: 'START A PROJECT' },
            persona: 'creative agency / studio — selected work case studies, capability pillars, senior team bios, project-kickoff CTAs'
        },
        generic: {
            presetIds: ['obsidian', 'meshGrad', 'aurora', 'noiseGrad', 'silk'],
            palettes: [
                ['#e6b13a', '#0a0a0a'], ['#c4a8ff', '#080810'], ['#0b0b0b', '#f4efe8']
            ],
            fonts: ['modern', 'humanist', 'editorial', 'display'],
            corners: ['soft'],
            cardTreatment: ['minimal', 'bordered'],
            navStyle: ['default', 'minimal'],
            heroLayout: ['centered', 'left', 'split'],
            statsStrip: [
                { v: '120+', l: 'Projects' }, { v: '98%', l: 'Retention' },
                { v: '12', l: 'Countries' }, { v: '2019', l: 'Founded' }
            ],
            logoCloud: ['Acme Co', 'Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark'],
            team: [
                { n: 'Alex Chen', r: 'Founder / Design' },
                { n: 'Jordan Rivera', r: 'Engineering Lead' },
                { n: 'Sam Okafor', r: 'Creative Director' }
            ],
            labels: {},
            persona: 'general business site'
        }
    };

    /** Return the design + content profile for a type. Always returns an
     *  object; falls back to the generic profile for unknown types. */
    function profile(type) {
        return PROFILES[type] || PROFILES.generic;
    }

    /** Pick a random entry from a pool array, or return undefined for empties. */
    function pickFrom(pool) {
        if (!Array.isArray(pool) || !pool.length) return undefined;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /** ═══════════════════════════════════════════════════════════════════
     *  DESIGN VARIANTS — coherent style "personalities" within a single
     *  type. Each variant locks a bundle of design axes so that two sites
     *  in the same category (e.g. shop) can look radically different —
     *  think walmart.com (big-box) vs amazon.com (marketplace) vs a
     *  farmer's-market boutique. Picked once per randomize and merged
     *  on top of the profile defaults.
     *  ═════════════════════════════════════════════════════════════════ */
    var VARIANTS = {
        shop: [
            { id: 'big-box',     presetId: 'meshGrad',   palette: ['#0071dc', '#ffffff'], font: 'modern',    corners: 'soft',  cardTreatment: 'filled',   typeScale: 'normal',  buttonStyle: 'solid',    navStyle: 'pill',    logoStyle: 'mark-left' },
            { id: 'marketplace', presetId: 'noiseGrad',  palette: ['#ff9900', '#131921'], font: 'modern',    corners: 'sharp', cardTreatment: 'bordered', typeScale: 'tight',   buttonStyle: 'solid',    navStyle: 'default', logoStyle: 'mark-left' },
            { id: 'boutique',    presetId: 'silk',       palette: ['#8b6f3e', '#f7f1e3'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',   buttonStyle: 'underline',navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'farm',        presetId: 'auroraBlob', palette: ['#4f7c3a', '#f5ebd7'], font: 'humanist',  corners: 'pill',  cardTreatment: 'floating', typeScale: 'normal',  buttonStyle: 'lifted',   navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'neon-bodega', presetId: 'neon',       palette: ['#ff2d6f', '#0a0a14'], font: 'brutalist', corners: 'sharp', cardTreatment: 'filled',   typeScale: 'dramatic',buttonStyle: 'sharp',    navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'deal-hunter', presetId: 'ember',      palette: ['#e63946', '#fff9f0'], font: 'display',   corners: 'soft',  cardTreatment: 'filled',   typeScale: 'normal',  buttonStyle: 'gradient', navStyle: 'pill',    logoStyle: 'mark-left' },
            { id: 'dtc-minimal', presetId: 'frost',      palette: ['#2d3748', '#f7fafc'], font: 'modern',    corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',   buttonStyle: 'outline',  navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'zine',        presetId: 'noiseGrad',  palette: ['#111111', '#ffd166'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic',buttonStyle: 'sharp',    navStyle: 'ghost',   logoStyle: 'bracket' },
            { id: 'luxury-mall', presetId: 'silk',       palette: ['#1a1a1a', '#d4af37'], font: 'luxe',      corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic',buttonStyle: 'outline',  navStyle: 'ghost',   logoStyle: 'monogram' }
        ],
        gaming: [
            { id: 'esports',      presetId: 'neon',       palette: ['#ff2e63', '#05070e'], font: 'tech',      corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',  navStyle: 'minimal', logoStyle: 'bracket' },
            { id: 'aaa-cinematic',presetId: 'obsidian',   palette: ['#d97757', '#0a0605'], font: 'display',   corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'outline',navStyle: 'ghost',   logoStyle: 'monogram' },
            { id: 'indie',        presetId: 'morphBlob',  palette: ['#f5b700', '#1a1038'], font: 'futurist',  corners: 'pill',  cardTreatment: 'filled',   typeScale: 'normal',   buttonStyle: 'lifted', navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'arcade',       presetId: 'matrix',     palette: ['#39ff14', '#000000'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',  navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'competitive',  presetId: 'circuits',   palette: ['#00d4ff', '#030917'], font: 'tech',      corners: 'sharp', cardTreatment: 'filled',   typeScale: 'tight',    buttonStyle: 'solid',  navStyle: 'pill',    logoStyle: 'bracket' },
            { id: 'cozy',         presetId: 'stardust',   palette: ['#b388ff', '#1a0f2e'], font: 'humanist',  corners: 'pill',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'gradient',navStyle: 'minimal',logoStyle: 'dot' },
            { id: 'retro-8bit',   presetId: 'matrix',     palette: ['#ff6b35', '#1a1a2e'], font: 'tech',      corners: 'sharp', cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'sharp',  navStyle: 'minimal', logoStyle: 'bracket' },
            { id: 'horror',       presetId: 'obsidian',   palette: ['#a4161a', '#0a0000'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'outline',navStyle: 'ghost',   logoStyle: 'slash' },
            { id: 'cyberpunk',    presetId: 'neon',       palette: ['#f72585', '#0a0e27'], font: 'futurist',  corners: 'sharp', cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'gradient',navStyle: 'minimal',logoStyle: 'bracket' }
        ],
        restaurant: [
            { id: 'trattoria',    presetId: 'silk',       palette: ['#8b1e1e', '#f5eee0'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'neo-bistro',   presetId: 'obsidian',   palette: ['#d4af37', '#0a0a0a'], font: 'luxe',      corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'outline',   navStyle: 'ghost',   logoStyle: 'monogram' },
            { id: 'farmhouse',    presetId: 'sunsetBlob', palette: ['#6b4423', '#f4e9d8'], font: 'classical', corners: 'soft',  cardTreatment: 'bordered', typeScale: 'normal',   buttonStyle: 'solid',     navStyle: 'default', logoStyle: 'mark-left' },
            { id: 'street-food',  presetId: 'ember',      palette: ['#ff4e1a', '#121212'], font: 'brutalist', corners: 'sharp', cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'ramen-bar',    presetId: 'bokeh',      palette: ['#e63946', '#0c0a0a'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'normal',   buttonStyle: 'solid',     navStyle: 'pill',    logoStyle: 'bracket' },
            { id: 'cafe',         presetId: 'noiseGrad',  palette: ['#6f4e37', '#efe6d6'], font: 'humanist',  corners: 'pill',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'lifted',    navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'sushi',        presetId: 'silk',       palette: ['#1a1a1a', '#d4a373'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'underline', navStyle: 'ghost',   logoStyle: 'monogram' },
            { id: 'diner',        presetId: 'meshGrad',   palette: ['#c1272d', '#fffbea'], font: 'display',   corners: 'pill',  cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'lifted',    navStyle: 'pill',    logoStyle: 'mark-left' }
        ],
        portfolio: [
            { id: 'editorial',    presetId: 'noiseGrad',  palette: ['#f5f5f5', '#0a0a0a'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'brutalist',    presetId: 'obsidian',   palette: ['#ffffff', '#000000'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'warm-indie',   presetId: 'sunsetBlob', palette: ['#ff8c69', '#1a0f0a'], font: 'display',   corners: 'pill',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'gradient',  navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'clean-saas',   presetId: 'meshGrad',   palette: ['#5b6cff', '#f8fafc'], font: 'modern',    corners: 'soft',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'solid',     navStyle: 'default', logoStyle: 'mark-left' },
            { id: 'athlete',      presetId: 'liquidWave', palette: ['#ff3b30', '#0b0b0b'], font: 'tech',      corners: 'sharp', cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'ghost',   logoStyle: 'bracket' },
            { id: 'archive',      presetId: 'frost',      palette: ['#0a0a0a', '#e5e5e5'], font: 'classical', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'swiss',        presetId: 'frost',      palette: ['#e63946', '#ffffff'], font: 'modern',    corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'experimental', presetId: 'prism',      palette: ['#ff006e', '#0a0014'], font: 'futurist',  corners: 'pill',  cardTreatment: 'floating', typeScale: 'dramatic', buttonStyle: 'gradient',  navStyle: 'ghost',   logoStyle: 'slash' }
        ],
        fashion: [
            { id: 'couture',      presetId: 'silk',       palette: ['#0a0a0a', '#f5f0e8'], font: 'luxe',      corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'streetwear',   presetId: 'obsidian',   palette: ['#ff2d55', '#0a0a0a'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'ethereal',     presetId: 'iridescent', palette: ['#e6ccff', '#1a0b2e'], font: 'editorial', corners: 'soft',  cardTreatment: 'floating', typeScale: 'tight',    buttonStyle: 'gradient',  navStyle: 'ghost',   logoStyle: 'dot' },
            { id: 'vintage',      presetId: 'sunsetBlob', palette: ['#8b4513', '#faf3e0'], font: 'classical', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'outline',   navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'y2k',          presetId: 'prism',      palette: ['#ff6ec7', '#0d0d0d'], font: 'futurist',  corners: 'pill',  cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'lifted',    navStyle: 'pill',    logoStyle: 'bracket' }
        ],
        music: [
            { id: 'underground',  presetId: 'obsidian',   palette: ['#d4af37', '#050505'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'slash' },
            { id: 'pop',          presetId: 'prism',      palette: ['#ff3d7f', '#0f0a1a'], font: 'display',   corners: 'pill',  cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'gradient',  navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'indie-folk',   presetId: 'ripple',     palette: ['#a4764c', '#1d140c'], font: 'editorial', corners: 'soft',  cardTreatment: 'minimal',  typeScale: 'normal',   buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'electronic',   presetId: 'plasma',     palette: ['#22d3ee', '#030712'], font: 'futurist',  corners: 'sharp', cardTreatment: 'floating', typeScale: 'tight',    buttonStyle: 'solid',     navStyle: 'ghost',   logoStyle: 'bracket' },
            { id: 'classical',    presetId: 'sineWaves',  palette: ['#1a1a2e', '#f5f1e8'], font: 'classical', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'outline',   navStyle: 'minimal', logoStyle: 'monogram' }
        ],
        ecommerce: null, // alias → shop (resolved at pick time)
        podcast: [
            { id: 'npr-style',    presetId: 'noiseGrad',  palette: ['#e63946', '#fdfaf3'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'true-crime',   presetId: 'obsidian',   palette: ['#c1121f', '#0a0a0a'], font: 'brutalist', corners: 'sharp', cardTreatment: 'bordered', typeScale: 'dramatic', buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'bracket' },
            { id: 'tech-chat',    presetId: 'circuits',   palette: ['#5b6cff', '#0a0b1a'], font: 'tech',      corners: 'soft',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'solid',     navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'comedy',       presetId: 'spark',      palette: ['#ffb703', '#1a1a1a'], font: 'display',   corners: 'pill',  cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'gradient',  navStyle: 'pill',    logoStyle: 'mark-left' }
        ],
        event: [
            { id: 'conference',   presetId: 'meshGrad',   palette: ['#0a6fff', '#fafbff'], font: 'modern',    corners: 'soft',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'solid',     navStyle: 'default', logoStyle: 'mark-left' },
            { id: 'festival',     presetId: 'confetti',   palette: ['#ff006e', '#0a0614'], font: 'display',   corners: 'pill',  cardTreatment: 'filled',   typeScale: 'dramatic', buttonStyle: 'gradient',  navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'gala',         presetId: 'silk',       palette: ['#d4af37', '#0a0a0a'], font: 'luxe',      corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'outline',   navStyle: 'ghost',   logoStyle: 'monogram' },
            { id: 'hackathon',    presetId: 'matrix',     palette: ['#00ff88', '#000000'], font: 'tech',      corners: 'sharp', cardTreatment: 'bordered', typeScale: 'tight',    buttonStyle: 'sharp',     navStyle: 'minimal', logoStyle: 'bracket' }
        ],
        photography: [
            { id: 'monograph',    presetId: 'obsidian',   palette: ['#ffffff', '#000000'], font: 'editorial', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'underline', navStyle: 'minimal', logoStyle: 'monogram' },
            { id: 'travel',       presetId: 'sunsetBlob', palette: ['#f4a261', '#1d1412'], font: 'classical', corners: 'soft',  cardTreatment: 'floating', typeScale: 'normal',   buttonStyle: 'gradient',  navStyle: 'pill',    logoStyle: 'dot' },
            { id: 'fine-art',     presetId: 'noiseGrad',  palette: ['#0a0a0a', '#e5e0d5'], font: 'luxe',      corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'tight',    buttonStyle: 'underline', navStyle: 'ghost',   logoStyle: 'monogram' },
            { id: 'wedding',      presetId: 'silk',       palette: ['#c9a961', '#faf5ee'], font: 'classical', corners: 'sharp', cardTreatment: 'minimal',  typeScale: 'dramatic', buttonStyle: 'outline',   navStyle: 'minimal', logoStyle: 'monogram' }
        ]
    };
    VARIANTS.ecommerce = VARIANTS.shop;

    /** Pick a random variant for a given type, or null if no variants defined. */
    function variant(type) {
        var v = VARIANTS[type];
        if (!Array.isArray(v) || !v.length) return null;
        return v[Math.floor(Math.random() * v.length)];
    }

    global.ArbelSiteType = {
        infer: infer,
        recipe: recipe,
        types: types,
        profile: profile,
        pickFrom: pickFrom,
        variant: variant,
        variants: function (type) { return VARIANTS[type] || null; }
    };
})(window);
