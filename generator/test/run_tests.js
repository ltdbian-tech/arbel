/**
 * Arbel Generator — Compiler Test Harness
 * Run with: node generator/test/run_tests.js
 */
'use strict';

// ── DOM shim (compiler uses document.createElement for escaping) ──
const { JSDOM } = (() => { try { return require('jsdom'); } catch(e) { return null; } })() || {};

let dom;
if (JSDOM) {
    dom = new JSDOM('');
    global.window = dom.window;
    global.document = dom.window.document;
} else {
    // Minimal shim without jsdom
    global.document = {
        createElement: function(tag) {
            const el = {
                _children: [],
                innerHTML: '',
                appendChild: function(child) {
                    // Simple HTML entity encoding
                    this.innerHTML = String(child._text || '')
                        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
                }
            };
            return el;
        },
        createTextNode: function(text) { return { _text: text }; }
    };
    global.window = { ArbelCompiler: null, ArbelCinematicCompiler: null };
}

// ── Load compiler files ──
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function loadFile(relPath) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8')
        .replace(/^window\./gm, 'global.');
    // eslint-disable-next-line no-eval
    eval(src);
}

loadFile('js/compiler.js');
loadFile('js/cinematic-compiler.js');

const ArbelCompiler = global.ArbelCompiler;
const ArbelCinematicCompiler = global.ArbelCinematicCompiler;

// ── Test runner ──
let passed = 0, failed = 0, warned = 0;
const issues = [];

function test(name, fn) {
    try {
        fn();
        console.log('  ✓  ' + name);
        passed++;
    } catch(e) {
        console.error('  ✗  ' + name);
        console.error('     → ' + e.message);
        failed++;
        issues.push({ name, error: e.message });
    }
}

function warn(name, fn) {
    try {
        fn();
        console.log('  ✓  ' + name);
        passed++;
    } catch(e) {
        console.warn('  ⚠  ' + name + ' (warning)');
        console.warn('     → ' + e.message);
        warned++;
        issues.push({ name, error: e.message, level: 'warn' });
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertContains(str, sub, msg) {
    if (!str || str.indexOf(sub) < 0) throw new Error((msg || 'Expected to contain') + ': ' + JSON.stringify(sub).slice(0,100));
}
function assertNotContains(str, sub, msg) {
    if (str && str.indexOf(sub) >= 0) throw new Error((msg || 'Should not contain') + ': ' + JSON.stringify(sub).slice(0,100));
}
function assertValidHtml(html, context) {
    assert(html && html.length > 100, context + ': HTML is too short');
    assertContains(html, '<!DOCTYPE html>', context + ': Missing DOCTYPE');
    assertContains(html, '<html', context + ': Missing <html>');
    assertContains(html, '</html>', context + ': Missing </html>');
    assertContains(html, '<head>', context + ': Missing <head>');
    assertContains(html, '</head>', context + ': Missing </head>');
    assertContains(html, '<body>', context + ': Missing <body>');
    assertContains(html, '</body>', context + ': Missing </body>');
}

// ── Default config for tests ──
const BASE_CFG = {
    brandName: 'Test Studio',
    tagline: 'We test things',
    style: 'obsidian',  // shader
    accent: '#6C5CE7',
    bgColor: '#0a0a0f',
    contactEmail: 'test@example.com',
    industry: 'agency',
    sections: ['hero', 'services', 'portfolio', 'about', 'contact'],
    content: {
        heroLine1: 'We craft',
        heroLine2: 'cinematic',
        heroLine3: 'experiences.',
        heroSub: 'A world-class studio.',
        heroCta: 'GET STARTED',
        servicesHeading: 'What We Do',
        service1Title: 'Web Design',
        service1Desc: 'Beautiful websites.',
        portfolioHeading: 'Our Work',
        project1Title: 'Project One',
        aboutHeading: 'About Us',
        aboutDesc: 'We are great.',
        contactHeading: 'Get In Touch',
        contactCta: 'Send Message',
    }
};

const PARTICLE_CFG = Object.assign({}, BASE_CFG, { style: 'nebula' });  // particle
const BLOB_CFG = Object.assign({}, BASE_CFG, { style: 'morphBlob' });  // blob
const WAVE_CFG = Object.assign({}, BASE_CFG, { style: 'sineWaves' });  // wave

// ─────────────────────────────────────────────
//  1. COMPILER API
// ─────────────────────────────────────────────
console.log('\n📦  Classic Compiler API');

test('ArbelCompiler is defined', () => assert(ArbelCompiler, 'ArbelCompiler undefined'));
test('compile() exists', () => assert(typeof ArbelCompiler.compile === 'function'));
test('getStyles() exists', () => assert(typeof ArbelCompiler.getStyles === 'function'));
test('getAnimCategory() exists', () => assert(typeof ArbelCompiler.getAnimCategory === 'function'));
test('buildAnimJS() exists', () => assert(typeof ArbelCompiler.buildAnimJS === 'function'));
test('getAnimJsFile() exists', () => assert(typeof ArbelCompiler.getAnimJsFile === 'function'));
test('getShaderFragment() exists', () => assert(typeof ArbelCompiler.getShaderFragment === 'function'));
test('getAnimConfig() exists', () => assert(typeof ArbelCompiler.getAnimConfig === 'function'));

// ─────────────────────────────────────────────
//  2. STYLE CATEGORISATION
// ─────────────────────────────────────────────
console.log('\n🎨  Style Categories');

test('obsidian → shader', () => assert(ArbelCompiler.getAnimCategory('obsidian') === 'shader'));
test('aurora → shader', () => assert(ArbelCompiler.getAnimCategory('aurora') === 'shader'));
test('ember → shader', () => assert(ArbelCompiler.getAnimCategory('ember') === 'shader'));
test('nebula → particle', () => assert(ArbelCompiler.getAnimCategory('nebula') === 'particle'));
test('morphBlob → blob', () => assert(ArbelCompiler.getAnimCategory('morphBlob') === 'blob', 'got ' + ArbelCompiler.getAnimCategory('morphBlob')));
test('sineWaves → wave', () => assert(ArbelCompiler.getAnimCategory('sineWaves') === 'wave', 'got ' + ArbelCompiler.getAnimCategory('sineWaves')));
test('getAnimJsFile shader → shader.js', () => assert(ArbelCompiler.getAnimJsFile('obsidian') === 'shader.js'));
test('getAnimJsFile particle → particles.js', () => assert(ArbelCompiler.getAnimJsFile('nebula') === 'particles.js'));
test('getAnimJsFile blob → blobs.js', () => assert(ArbelCompiler.getAnimJsFile('morphBlob') === 'blobs.js'));
test('getAnimJsFile wave → waves.js', () => assert(ArbelCompiler.getAnimJsFile('sineWaves') === 'waves.js'));

// ─────────────────────────────────────────────
//  3. buildAnimJS()
// ─────────────────────────────────────────────
console.log('\n🔧  buildAnimJS()');

test('buildAnimJS shader → null', () => assert(ArbelCompiler.buildAnimJS('obsidian') === null));
test('buildAnimJS particle → non-null JS', () => {
    const js = ArbelCompiler.buildAnimJS('nebula', { count: 80, speed: 1, glow: 0.5, interact: true, connect: true }, '#0a0a0f');
    assert(js && js.length > 100, 'No JS returned');
    assertContains(js, 'canvas', 'Missing canvas');
});
test('buildAnimJS blob → non-null JS', () => {
    const js = ArbelCompiler.buildAnimJS('morphBlob', { count: 60 }, '#0a0a0f');
    assert(js && js.length > 100, 'No JS returned');
});
warn('buildAnimJS wave → non-null JS', () => {
    const js = ArbelCompiler.buildAnimJS('sineWaves', {}, '#0a0a0f');
    assert(js && js.length > 100, 'No JS returned');
});

// ─────────────────────────────────────────────
//  4. CLASSIC COMPILE — shader style
// ─────────────────────────────────────────────
console.log('\n📄  Classic Compile (shader: obsidian)');

let shaderFiles;
test('compile() returns files object', () => {
    shaderFiles = ArbelCompiler.compile(BASE_CFG);
    assert(shaderFiles && typeof shaderFiles === 'object', 'Not an object');
});
test('index.html present', () => assert(shaderFiles['index.html']));
test('css/style.css present', () => assert(shaderFiles['css/style.css']));
test('js/main.js present', () => assert(shaderFiles['js/main.js']));
test('js/animations.js present', () => assert(shaderFiles['js/animations.js']));
test('js/shader.js present for shader style', () => assert(shaderFiles['js/shader.js'], 'shader.js missing'));
test('arbel.config.json present', () => assert(shaderFiles['arbel.config.json']));
test('index.html is valid HTML', () => assertValidHtml(shaderFiles['index.html'], 'shader index.html'));
test('contactEmail not leaked in arbel.config.json', () => {
    const cfg = JSON.parse(shaderFiles['arbel.config.json']);
    assert(!cfg.contactEmail, 'contactEmail found in public config!');
});
test('brandName in index.html', () => assertContains(shaderFiles['index.html'], 'Test Studio'));
test('tagline in index.html', () => assertContains(shaderFiles['index.html'], 'We test things'));
test('heroLine1 content in index.html', () => assertContains(shaderFiles['index.html'], 'We craft'));
test('servicesHeading in index.html', () => assertContains(shaderFiles['index.html'], 'What We Do'));
test('no <script> injection in content (XSS)', () => {
    const xssCfg = Object.assign({}, BASE_CFG, {
        brandName: '<script>alert(1)</script>',
        content: { heroLine1: '"><img src=x onerror=alert(1)>' }
    });
    const files = ArbelCompiler.compile(xssCfg);
    assertNotContains(files['index.html'], '<script>alert(1)</script>', 'XSS in brandName');
    assertNotContains(files['index.html'], '<img src=x onerror=', 'XSS: unescaped tag in content');
});
test('index.html has lenis script tag', () => assertContains(shaderFiles['index.html'], 'lenis'));
test('index.html has gsap script tag', () => assertContains(shaderFiles['index.html'], 'gsap'));
test('shader style has three.js script', () => assertContains(shaderFiles['index.html'], 'three'));
test('shader style has shader.js script tag', () => assertContains(shaderFiles['index.html'], 'js/shader.js'));
test('index.html has Instrument Serif font', () => assertContains(shaderFiles['index.html'], 'Instrument+Serif'));

// ─────────────────────────────────────────────
//  5. CLASSIC COMPILE — particle style
// ─────────────────────────────────────────────
console.log('\n💠  Classic Compile (particle: nebula)');

let particleFiles;
test('compile() with nebula', () => {
    particleFiles = ArbelCompiler.compile(PARTICLE_CFG);
    assert(particleFiles && typeof particleFiles === 'object');
});
test('no shader.js for particle style', () => assertNotContains(Object.keys(particleFiles).join(','), 'shader.js'));
test('js/particles.js present', () => assert(particleFiles['js/particles.js'], 'particles.js missing'));
test('particles.js has canvas', () => assertContains(particleFiles['js/particles.js'], 'canvas'));
test('particles.js has requestAnimationFrame', () => assertContains(particleFiles['js/particles.js'], 'requestAnimationFrame'));
test('index.html script tag for particles.js', () => assertContains(particleFiles['index.html'], 'js/particles.js'));
test('index.html no three.js for particle style', () => assertNotContains(particleFiles['index.html'], 'three.js'));

// ─────────────────────────────────────────────
//  6. SECTIONS presence
// ─────────────────────────────────────────────
console.log('\n📑  Section Rendering');

const allSectionsCfg = Object.assign({}, BASE_CFG, {
    sections: ['hero', 'services', 'portfolio', 'about', 'process', 'testimonials', 'pricing', 'faq', 'contact'],
    content: Object.assign({}, BASE_CFG.content, {
        processHeading: 'How We Work',
        step1Title: 'Discovery',
        step1Desc: 'We discover.',
        testimonial1Quote: 'Great work!',
        testimonial1Name: 'Jane Doe',
        pricingHeading: 'Pricing',
        tier1Name: 'Basic',
        tier1Price: '$29',
        tier1Features: 'Feature A\nFeature B',
        faq1Q: 'What do you do?',
        faq1A: 'We make websites.'
    })
});
let allSectionsHtml;
test('all sections compile', () => {
    const f = ArbelCompiler.compile(allSectionsCfg);
    allSectionsHtml = f['index.html'];
    assert(allSectionsHtml, 'No index.html');
});
test('services section present', () => assertContains(allSectionsHtml, 'id="services"'));
test('portfolio section present', () => assertContains(allSectionsHtml, 'id="portfolio"'));
test('about section present', () => assertContains(allSectionsHtml, 'id="about"'));
test('process section present', () => assertContains(allSectionsHtml, 'id="process"'));
test('testimonials section present', () => assertContains(allSectionsHtml, 'id="testimonials"'));
test('pricing section present', () => assertContains(allSectionsHtml, 'id="pricing"'));
test('faq section present', () => assertContains(allSectionsHtml, 'id="faq"'));
test('contact section present', () => assertContains(allSectionsHtml, 'id="contact"'));
test('process heading rendered', () => assertContains(allSectionsHtml, 'How We Work'));
test('testimonial quote rendered', () => assertContains(allSectionsHtml, 'Great work'));
test('pricing tier rendered', () => assertContains(allSectionsHtml, 'Basic'));
test('faq question rendered', () => assertContains(allSectionsHtml, 'What do you do'));

// ─────────────────────────────────────────────
//  7. MULTI-PAGE (sub-pages)
// ─────────────────────────────────────────────
console.log('\n📃  Multi-Page');

const multiPageCfg = Object.assign({}, BASE_CFG, {
    pages: [
        { id: 'about', name: 'About', path: '/about', seoTitle: 'About — Test Studio', seoDesc: 'Learn about us.' },
        { id: 'contact', name: 'Contact', path: '/contact', seoTitle: 'Contact', seoDesc: 'Reach out.' },
        { id: 'services', name: 'Services', path: '/services', seoTitle: 'Services', seoDesc: 'What we offer.' }
    ]
});
let multiFiles;
test('multi-page compile', () => {
    multiFiles = ArbelCompiler.compile(multiPageCfg);
    assert(multiFiles, 'No files returned');
});
test('about page generated', () => assert(multiFiles['about/index.html'] || multiFiles['about.html'], 'about page missing'));
test('contact page generated', () => assert(multiFiles['contact/index.html'] || multiFiles['contact.html'], 'contact page missing'));
test('services page generated', () => assert(multiFiles['services/index.html'] || multiFiles['services.html'], 'services page missing'));

const aboutHtml = multiFiles['about/index.html'] || multiFiles['about.html'];
const contactHtml = multiFiles['contact/index.html'] || multiFiles['contact.html'];

test('about page valid HTML', () => aboutHtml && assertValidHtml(aboutHtml, 'about page'));
test('contact page has form element', () => assertContains(contactHtml, '<form'));
test('contact form has name input', () => assertContains(contactHtml, 'name="name"'));
test('contact form has email input', () => assertContains(contactHtml, 'name="email"'));
test('contact form has message textarea', () => assertContains(contactHtml, 'name="message"'));
test('contact form has working onsubmit (single quotes in attribute)', () => {
    // The onsubmit attr value should NOT have unescaped " inside it
    const idx = contactHtml.indexOf('onsubmit=');
    assert(idx >= 0, 'No onsubmit attribute');
    const attrStart = contactHtml.indexOf('"', idx) + 1;
    const attrEnd = contactHtml.indexOf('"', attrStart);
    const attrVal = contactHtml.slice(attrStart, attrEnd);
    assertNotContains(attrVal, '"', 'Unescaped double quote inside onsubmit attribute breaks HTML');
});
test('about page has back-to-home nav link', () => assertContains(aboutHtml, 'href="..'));
test('contact page title is correct', () => assertContains(contactHtml, 'Contact'));
test('services page has About heading content', () => {
    const servHtml = multiFiles['services/index.html'] || multiFiles['services.html'];
    assert(servHtml, 'services page HTML missing');
    // Should use servicesHeading content key
    assert(servHtml.length > 200, 'services page too short');
});

// ─────────────────────────────────────────────
//  8. SEO / META TAGS
// ─────────────────────────────────────────────
console.log('\n🔍  SEO & Meta');

const seoCfg = Object.assign({}, BASE_CFG, {
    seo: {
        title: 'Custom SEO Title',
        description: 'Custom meta description for search',
        canonical: 'https://example.com',
        ogImage: 'https://example.com/og.jpg',
        favicon: 'https://example.com/fav.ico',
        index: true
    }
});
let seoFiles;
test('SEO compile', () => { seoFiles = ArbelCompiler.compile(seoCfg); assert(seoFiles); });
test('custom SEO title', () => assertContains(seoFiles['index.html'], 'Custom SEO Title'));
test('meta description', () => assertContains(seoFiles['index.html'], 'Custom meta description'));
test('canonical link', () => assertContains(seoFiles['index.html'], 'https://example.com'));
test('og:image', () => assertContains(seoFiles['index.html'], 'https://example.com/og.jpg'));
test('favicon', () => assertContains(seoFiles['index.html'], 'https://example.com/fav.ico'));
test('og:title present', () => assertContains(seoFiles['index.html'], 'og:title'));
test('twitter:card present', () => assertContains(seoFiles['index.html'], 'twitter:card'));
test('noindex NOT present when index=true', () => assertNotContains(seoFiles['index.html'], 'noindex'));
const noIndexCfg = Object.assign({}, BASE_CFG, { seo: { index: false } });
test('noindex IS present when index=false', () => {
    const f = ArbelCompiler.compile(noIndexCfg);
    assertContains(f['index.html'], 'noindex');
});

// ─────────────────────────────────────────────
//  9. arbel.config.json structure
// ─────────────────────────────────────────────
console.log('\n📋  arbel.config.json');

test('classic config is valid JSON', () => {
    JSON.parse(shaderFiles['arbel.config.json']);
});
test('classic config has version', () => {
    const cfg = JSON.parse(shaderFiles['arbel.config.json']);
    assert(cfg.version, 'No version');
});
test('classic config has style', () => {
    const cfg = JSON.parse(shaderFiles['arbel.config.json']);
    assert(cfg.style === 'obsidian');
});
test('classic config has content', () => {
    const cfg = JSON.parse(shaderFiles['arbel.config.json']);
    assert(cfg.content && cfg.content.heroLine1 === 'We craft');
});
test('classic config has no contactEmail', () => {
    const cfg = JSON.parse(shaderFiles['arbel.config.json']);
    assert(cfg.contactEmail === undefined, 'contactEmail must not be exported!');
});

// ─────────────────────────────────────────────
//  10. CSS output
// ─────────────────────────────────────────────
console.log('\n🎨  CSS Output');

test('css/style.css is non-empty', () => assert(shaderFiles['css/style.css'] && shaderFiles['css/style.css'].length > 200));
test('CSS has --accent variable', () => assertContains(shaderFiles['css/style.css'], '--accent'));
test('CSS has --bg variable', () => assertContains(shaderFiles['css/style.css'], '--bg'));
test('CSS has --fg variable', () => assertContains(shaderFiles['css/style.css'], '--fg'));
test('CSS has responsive queries', () => assertContains(shaderFiles['css/style.css'], '@media'));

// ─────────────────────────────────────────────
//  11. CINEMATIC COMPILER API
// ─────────────────────────────────────────────
console.log('\n🎬  Cinematic Compiler API');

test('ArbelCinematicCompiler defined', () => assert(ArbelCinematicCompiler));
test('compile() exists', () => assert(typeof ArbelCinematicCompiler.compile === 'function'));
test('getSceneTemplates() exists', () => assert(typeof ArbelCinematicCompiler.getSceneTemplates === 'function'));
test('createScene() exists', () => assert(typeof ArbelCinematicCompiler.createScene === 'function'));

// ─────────────────────────────────────────────
//  12. CINEMATIC COMPILE — shader style
// ─────────────────────────────────────────────
console.log('\n🎬  Cinematic Compile (shader: obsidian)');

const CIN_BASE = {
    brandName: 'Cinema Test',
    tagline: 'Scroll to discover',
    style: 'obsidian',  // shader
    accent: '#6C5CE7',
    bgColor: '#0a0a0f',
    industry: 'agency',
    nav: { logo: 'Cinema Test', links: [] },
    seo: { title: 'Cinema Test', description: 'Cinematic experience' },
    scenes: [
        ArbelCinematicCompiler.createScene('hero', 0),
        ArbelCinematicCompiler.createScene('textReveal', 1),
        ArbelCinematicCompiler.createScene('stats', 2),
        ArbelCinematicCompiler.createScene('cta', 3)
    ]
};

let cinShaderFiles;
test('cinematic shader compile', () => {
    cinShaderFiles = ArbelCinematicCompiler.compile(CIN_BASE);
    assert(cinShaderFiles && typeof cinShaderFiles === 'object');
});
test('cinematic index.html present', () => assert(cinShaderFiles['index.html']));
test('cinematic css/style.css present', () => assert(cinShaderFiles['css/style.css']));
test('cinematic js/cinema.js present', () => assert(cinShaderFiles['js/cinema.js']));
test('cinematic js/main.js present', () => assert(cinShaderFiles['js/main.js']));
test('cinematic js/shader.js present for shader', () => assert(cinShaderFiles['js/shader.js'], 'shader.js missing'));
test('cinematic arbel.config.json present', () => assert(cinShaderFiles['arbel.config.json']));
test('cinematic README.md present', () => assert(cinShaderFiles['README.md']));
test('cinematic index.html valid HTML', () => assertValidHtml(cinShaderFiles['index.html'], 'cinematic shader'));
test('cinematic shader uses <canvas> bgCanvas', () => assertContains(cinShaderFiles['index.html'], 'id="bgCanvas"'));
test('cinematic canvas element (not div) for shader', () => assertContains(cinShaderFiles['index.html'], '<canvas'));
test('cinematic shader has three.js script', () => assertContains(cinShaderFiles['index.html'], 'three'));
test('cinematic arbel.config.json valid JSON', () => JSON.parse(cinShaderFiles['arbel.config.json']));
test('cinematic config has scenes array', () => {
    const cfg = JSON.parse(cinShaderFiles['arbel.config.json']);
    assert(Array.isArray(cfg.scenes) && cfg.scenes.length === 4);
});
test('cinematic config generator=arbel-cinematic', () => {
    const cfg = JSON.parse(cinShaderFiles['arbel.config.json']);
    assert(cfg.generator === 'arbel-cinematic');
});
test('cinematic config no contactEmail', () => {
    const cfg = JSON.parse(cinShaderFiles['arbel.config.json']);
    assert(cfg.contactEmail === undefined);
});
test('cinematic shader.js has vUv varying', () => assertContains(cinShaderFiles['js/shader.js'], 'varying vec2 vUv'));
test('cinematic shader.js has void main()', () => assertContains(cinShaderFiles['js/shader.js'], 'void main()'));
test('cinematic shader.js has projectionMatrix', () => assertContains(cinShaderFiles['js/shader.js'], 'projectionMatrix'));

// ─────────────────────────────────────────────
//  13. CINEMATIC COMPILE — particle style
// ─────────────────────────────────────────────
console.log('\n🎬  Cinematic Compile (particle: nebula)');

const CIN_PARTICLE = Object.assign({}, CIN_BASE, {
    style: 'nebula',
    particles: { count: 80, speed: 1, glow: 0.6, interact: true, connect: true }
});
let cinPartFiles;
test('cinematic particle compile', () => {
    cinPartFiles = ArbelCinematicCompiler.compile(CIN_PARTICLE);
    assert(cinPartFiles);
});
test('cinematic particle: no shader.js', () => assertNotContains(Object.keys(cinPartFiles).join(','), 'shader.js'));
test('cinematic particle: js/particles.js present', () => assert(cinPartFiles['js/particles.js'], 'particles.js missing'));
test('cinematic particle: particles.js has canvas code', () => assertContains(cinPartFiles['js/particles.js'], 'canvas'));
test('cinematic particle: index.html has <div class="anim-bg', () => assertContains(cinPartFiles['index.html'], 'anim-bg'));
test('cinematic particle: no <canvas id="bgCanvas">', () => assertNotContains(cinPartFiles['index.html'], 'id="bgCanvas"'));
test('cinematic particle: script tag for particles.js', () => assertContains(cinPartFiles['index.html'], 'js/particles.js'));
test('cinematic particle: no three.js script', () => assertNotContains(cinPartFiles['index.html'], 'three.min.js'));

// ─────────────────────────────────────────────
//  14. CINEMATIC CSS
// ─────────────────────────────────────────────
console.log('\n🎨  Cinematic CSS');

test('cinematic CSS has :root vars', () => assertContains(cinShaderFiles['css/style.css'], ':root'));
test('cinematic CSS has --accent', () => assertContains(cinShaderFiles['css/style.css'], '--accent'));
test('cinematic CSS has .cne-scene', () => assertContains(cinShaderFiles['css/style.css'], '.cne-scene'));
test('cinematic CSS has .cne-bg-canvas', () => assertContains(cinShaderFiles['css/style.css'], '.cne-bg-canvas'));
test('cinematic CSS .cne-bg-canvas is position:fixed', () => assertContains(cinShaderFiles['css/style.css'], 'position: fixed'));

// ─────────────────────────────────────────────
//  15. CINEMATIC SCENARIO — edge cases
// ─────────────────────────────────────────────
console.log('\n⚠️   Cinematic Edge Cases');

test('empty scenes array defaults gracefully', () => {
    const f = ArbelCinematicCompiler.compile(Object.assign({}, CIN_BASE, { scenes: [] }));
    assertValidHtml(f['index.html'], 'empty scenes');
});
test('scene with no elements compiles', () => {
    const f = ArbelCinematicCompiler.compile(Object.assign({}, CIN_BASE, {
        scenes: [{ id: 'empty-scene', name: 'Empty', template: 'blank', duration: 100, pin: true, elements: [] }]
    }));
    assertValidHtml(f['index.html'], 'scene with no elements');
});
test('XSS in scene element text escaped', () => {
    const scene = ArbelCinematicCompiler.createScene('hero', 0);
    scene.elements[0].text = '<script>alert(1)</script>';
    const f = ArbelCinematicCompiler.compile(Object.assign({}, CIN_BASE, { scenes: [scene] }));
    assertNotContains(f['index.html'], '<script>alert(1)</script>');
});
test('XSS in bgImage blocked', () => {
    const scene = ArbelCinematicCompiler.createScene('hero', 0);
    scene.bgImage = 'javascript:alert(1)';
    const f = ArbelCinematicCompiler.compile(Object.assign({}, CIN_BASE, { scenes: [scene] }));
    assertNotContains(f['index.html'], 'javascript:alert');
});
test('cinematic main.js has cursor animation loop', () => {
    assertContains(cinShaderFiles['js/main.js'], 'requestAnimationFrame');
});
test('cinematic cinema.js has GSAP ScrollTrigger', () => {
    assertContains(cinShaderFiles['js/cinema.js'], 'ScrollTrigger');
});

// ─────────────────────────────────────────────
//  16. CLASSIC — blob and wave styles
// ─────────────────────────────────────────────
console.log('\n🌊  Classic Compile (blob + wave)');

test('blob style compiles with blobs.js', () => {
    const f = ArbelCompiler.compile(BLOB_CFG);
    assert(f['js/blobs.js'], 'blobs.js missing');
    assertContains(f['index.html'], 'js/blobs.js');
});
test('wave style compiles with waves.js', () => {
    const f = ArbelCompiler.compile(WAVE_CFG);
    assert(f['js/waves.js'], 'waves.js missing');
    assertContains(f['index.html'], 'js/waves.js');
});

// ─────────────────────────────────────────────
//  17. Custom builder style
// ─────────────────────────────────────────────
console.log('\n🔨  Custom Builder Style');

test('custom particle style is accepted', () => {
    const customCfg = Object.assign({}, BASE_CFG, {
        style: 'custom-particle',
        customStyle: { category: 'particle', color1: '#ff0000', color2: '#0000ff', color3: '#0a0a0f',
            particleCount: 100, particleSize: 2, speed: 1, glow: 0.6, connect: true, interact: true }
    });
    const f = ArbelCompiler.compile(customCfg);
    assert(f['index.html'], 'No index.html');
});

// ─────────────────────────────────────────────
console.log('\n🎭  New Scroll Presets');

test('cinematic presets exist', () => {
    const presets = ArbelCinematicCompiler.getAnimationPresets();
    const ids = presets.map(p => p.id);
    assert(ids.indexOf('cinematicFade') >= 0, 'missing cinematicFade');
    assert(ids.indexOf('cinematicSlide') >= 0, 'missing cinematicSlide');
    assert(ids.indexOf('cinematicReveal') >= 0, 'missing cinematicReveal');
});

test('parallax presets exist', () => {
    const p = ArbelCinematicCompiler.getPreset('parallaxSlow');
    assert(p, 'parallaxSlow preset not found');
    assert(Array.isArray(p.y), 'parallaxSlow should have y array');
});

test('stagger presets exist', () => {
    const p1 = ArbelCinematicCompiler.getPreset('staggerFadeUp1');
    const p3 = ArbelCinematicCompiler.getPreset('staggerFadeUp3');
    assert(p1 && p3, 'stagger presets missing');
    assert(p1.start < p3.start, 'stagger presets should have increasing start offsets');
});

test('continuous loop presets exist', () => {
    const p = ArbelCinematicCompiler.getPreset('floatLoop');
    assert(p, 'floatLoop not found');
    assert(p.ease === 'none', 'loop preset should use linear ease');
});

test('text presets exist', () => {
    const p = ArbelCinematicCompiler.getPreset('headlineSlam');
    assert(p, 'headlineSlam not found');
    assert(Array.isArray(p.scale), 'headlineSlam should have scale array');
});

// ─────────────────────────────────────────────
console.log('\n📦  New Element Types');

test('lottie element compiles', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'lottie-1', tag: 'div', text: '', lottieUrl: 'https://example.com/anim.json',
            style: { position: 'absolute', top: '20%', left: '50%', width: '200px', height: '200px' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('dotlottie-player') >= 0, 'Lottie player tag missing');
    assert(f['index.html'].indexOf('dotlottie-player') >= 0, 'Lottie script missing');
});

test('svg element compiles', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'svg-1', tag: 'div', text: '', svgContent: '<svg><circle cx="50" cy="50" r="40"/></svg>',
            style: { position: 'absolute', top: '20%', left: '50%', width: '200px', height: '200px' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('<circle') >= 0, 'SVG content missing');
});

test('svg sanitizes script injection', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'svg-1', tag: 'div', text: '',
            svgContent: '<svg><script>alert("xss")</script><circle cx="50" cy="50" r="40"/></svg>',
            style: { position: 'absolute', top: '20%', left: '50%' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('<script>') < 0, 'SVG script tag not stripped');
});

test('embed element compiles', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'embed-1', tag: 'div', text: '', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            style: { position: 'absolute', top: '15%', left: '50%', width: '560px', height: '315px' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('<iframe') >= 0, 'Embed iframe missing');
    assert(f['index.html'].indexOf('youtube.com/embed') >= 0, 'Embed URL missing');
});

test('embed rejects non-https URLs', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'embed-1', tag: 'div', text: '', embedUrl: 'http://evil.com/page',
            style: { position: 'absolute', top: '15%', left: '50%' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('<iframe') < 0, 'Non-https embed should be rejected');
});

test('lottie script absent when no lottie elements', () => {
    const f = ArbelCinematicCompiler.compile(CIN_BASE);
    assert(f['index.html'].indexOf('dotlottie-player.mjs') < 0, 'Lottie script should not be included when unused');
});

test('clip-path crop compiles in element style', () => {
    const cfg = Object.assign({}, CIN_BASE);
    cfg.scenes = [{ id: 's1', name: 'Test', template: 'blank', duration: 100, pin: true,
        elements: [{ id: 'img-1', tag: 'img', text: '', src: 'https://example.com/photo.jpg',
            style: { position: 'absolute', top: '20%', left: '50%', width: '300px', height: '200px',
                objectFit: 'cover', clipPath: 'inset(10% 5% 10% 5%)' },
            visible: true }]
    }];
    const f = ArbelCinematicCompiler.compile(cfg);
    assert(f['index.html'].indexOf('clip-path:inset(10% 5% 10% 5%)') >= 0, 'clip-path crop missing in compiled output');
});

// ─────────────────────────────────────────────
//  SUMMARY
// ─────────────────────────────────────────────
console.log('\n' + '─'.repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed, ${warned} warnings`);
console.log('─'.repeat(55));

if (issues.filter(i => i.level !== 'warn').length > 0) {
    console.log('\n❌  FAILURES:');
    issues.filter(i => i.level !== 'warn').forEach(i => console.log('  • ' + i.name + ': ' + i.error));
}
if (issues.filter(i => i.level === 'warn').length > 0) {
    console.log('\n⚠️  WARNINGS:');
    issues.filter(i => i.level === 'warn').forEach(i => console.log('  • ' + i.name + ': ' + i.error));
}

process.exit(failed > 0 ? 1 : 0);
