/* ═══════════════════════════════════════════════
   CINEMATIC COMPILER — Scroll-Cinema Engine

   Generates scroll-pinned, timeline-driven
   cinematic websites from scene-based config.
   Shares runtime libs with Classic compiler.
   ═══════════════════════════════════════════════ */

window.ArbelCinematicCompiler = (function () {
    'use strict';

    /* ─── Helpers ─── */
    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /** Sanitise a URL for use in href/src attributes. */
    function escHref(url) {
        if (!url) return '';
        var s = url.replace(/[\x00-\x1f]+/g, '').trim();
        if (/^\s*(javascript|vbscript)\s*:/i.test(s)) return '';
        if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return '';
        return esc(s);
    }

    function uid() {
        return 'cne-' + Math.random().toString(36).substr(2, 8);
    }

    /* ─── Scene Templates ─── */
    var SCENE_TEMPLATES = {
        hero: {
            label: 'Hero',
            desc: 'Full-screen title with subtitle',
            elements: [
                { id: 'hero-title', tag: 'h1', text: 'Your Headline', style: { fontSize: '6vw', fontWeight: '800', color: '#ffffff', position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', width: '80%' }, scroll: { opacity: [1, 0], y: [0, -120], start: 0.3, end: 0.8 } },
                { id: 'hero-sub', tag: 'p', text: 'Your subtitle goes here', style: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.6)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,0)', textAlign: 'center', width: '60%' }, scroll: { opacity: [0, 1, 0], y: [40, 0, -60], start: 0.05, end: 0.85 } }
            ]
        },
        splitMedia: {
            label: 'Split + Media',
            desc: 'Left text, right image area',
            elements: [
                { id: 'split-title', tag: 'h2', text: 'Feature Title', style: { fontSize: '3.5vw', fontWeight: '700', color: '#ffffff', position: 'absolute', top: '30%', left: '8%', width: '38%' }, scroll: { opacity: [0, 1], x: [-80, 0], start: 0, end: 0.4 } },
                { id: 'split-desc', tag: 'p', text: 'Describe your feature in detail. This text reveals as you scroll.', style: { fontSize: '1.2rem', color: 'rgba(255,255,255,0.65)', position: 'absolute', top: '48%', left: '8%', width: '35%', lineHeight: '1.7' }, scroll: { opacity: [0, 1], x: [-60, 0], start: 0.1, end: 0.5 } },
                { id: 'split-media', tag: 'div', text: '', style: { position: 'absolute', top: '15%', right: '5%', width: '42%', height: '70%', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(108,92,231,0.3), rgba(0,206,201,0.2))', border: '1px solid rgba(255,255,255,0.1)' }, scroll: { opacity: [0, 1], scale: [0.85, 1], start: 0.05, end: 0.5 } }
            ]
        },
        showcase: {
            label: 'Showcase',
            desc: 'Centered large element with caption',
            elements: [
                { id: 'showcase-item', tag: 'div', text: '', style: { position: 'absolute', top: '10%', left: '10%', width: '80%', height: '65%', borderRadius: '20px', background: 'linear-gradient(180deg, rgba(108,92,231,0.2), rgba(0,0,0,0.4))', border: '1px solid rgba(255,255,255,0.08)' }, scroll: { scale: [0.8, 1, 0.95], opacity: [0, 1, 0.8], start: 0, end: 0.9 } },
                { id: 'showcase-title', tag: 'h2', text: 'Product Name', style: { fontSize: '2.8vw', fontWeight: '700', color: '#ffffff', position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [40, 0], start: 0.2, end: 0.6 } },
                { id: 'showcase-tag', tag: 'span', text: 'Category — Year', style: { fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)' }, scroll: { opacity: [0, 1], start: 0.3, end: 0.65 } }
            ]
        },
        stats: {
            label: 'Stats',
            desc: 'Animated numbers with labels',
            elements: [
                { id: 'stats-heading', tag: 'h2', text: 'By The Numbers', style: { fontSize: '3vw', fontWeight: '700', color: '#ffffff', position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [-30, 0], start: 0, end: 0.3 } },
                { id: 'stat-1', tag: 'div', text: '500+', style: { fontSize: '4vw', fontWeight: '800', color: '#6C5CE7', position: 'absolute', top: '45%', left: '15%', textAlign: 'center', width: '20%' }, scroll: { opacity: [0, 1], scale: [0.5, 1], start: 0.1, end: 0.5 } },
                { id: 'stat-2', tag: 'div', text: '98%', style: { fontSize: '4vw', fontWeight: '800', color: '#00CEC9', position: 'absolute', top: '45%', left: '40%', textAlign: 'center', width: '20%' }, scroll: { opacity: [0, 1], scale: [0.5, 1], start: 0.2, end: 0.6 } },
                { id: 'stat-3', tag: 'div', text: '24/7', style: { fontSize: '4vw', fontWeight: '800', color: '#fd79a8', position: 'absolute', top: '45%', left: '65%', textAlign: 'center', width: '20%' }, scroll: { opacity: [0, 1], scale: [0.5, 1], start: 0.3, end: 0.7 } }
            ]
        },
        textReveal: {
            label: 'Text Reveal',
            desc: 'Split-text cinematic reveal',
            elements: [
                { id: 'reveal-line1', tag: 'h1', text: 'Built for', style: { fontSize: '7vw', fontWeight: '800', color: '#ffffff', position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', overflow: 'hidden' }, scroll: { opacity: [0, 1], y: [100, 0], start: 0, end: 0.35 }, splitText: true },
                { id: 'reveal-line2', tag: 'h1', text: 'the future.', style: { fontSize: '7vw', fontWeight: '800', color: '#6C5CE7', position: 'absolute', top: '48%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', overflow: 'hidden' }, scroll: { opacity: [0, 1], y: [100, 0], start: 0.15, end: 0.5 }, splitText: true }
            ]
        },
        blank: {
            label: 'Blank',
            desc: 'Empty scene — build from scratch',
            elements: []
        },
        marquee: {
            label: 'Marquee',
            desc: 'Scrolling text strip with overlay',
            elements: [
                { id: 'mrq-line1', tag: 'h1', text: 'DESIGN · DEVELOP · DEPLOY · ', style: { fontSize: '8vw', fontWeight: '900', color: '#ffffff', position: 'absolute', top: '30%', left: '0', whiteSpace: 'nowrap', opacity: '0.12', width: '200%' }, scroll: { x: [0, -800], start: 0, end: 1 } },
                { id: 'mrq-line2', tag: 'h1', text: 'CREATE · ITERATE · LAUNCH · ', style: { fontSize: '8vw', fontWeight: '900', color: '#ffffff', position: 'absolute', top: '55%', left: '-400px', whiteSpace: 'nowrap', opacity: '0.12', width: '200%' }, scroll: { x: [-800, 0], start: 0, end: 1 } },
                { id: 'mrq-center', tag: 'h2', text: 'We make things happen', style: { fontSize: '2.5vw', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: '2' }, scroll: { opacity: [0, 1], blur: [15, 0], scale: [0.9, 1], start: 0.1, end: 0.5 } }
            ]
        },
        featureGrid: {
            label: 'Feature Grid',
            desc: 'Glass cards with staggered reveal',
            elements: [
                { id: 'fg-title', tag: 'h2', text: 'What We Offer', style: { fontSize: '3vw', fontWeight: '700', color: '#ffffff', position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [-30, 0], start: 0, end: 0.2 } },
                { id: 'fg-card1', tag: 'div', text: '', style: { position: 'absolute', top: '25%', left: '5%', width: '28%', height: '55%', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }, scroll: { opacity: [0, 1], y: [60, 0], blur: [10, 0], start: 0.05, end: 0.35 } },
                { id: 'fg-c1-title', tag: 'h3', text: 'Design', style: { fontSize: '1.4rem', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '32%', left: '8%', width: '22%' }, scroll: { opacity: [0, 1], y: [30, 0], start: 0.1, end: 0.35 } },
                { id: 'fg-c1-desc', tag: 'p', text: 'Pixel-perfect interfaces crafted with care', style: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '40%', left: '8%', width: '22%', lineHeight: '1.6' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.15, end: 0.4 } },
                { id: 'fg-card2', tag: 'div', text: '', style: { position: 'absolute', top: '25%', left: '36%', width: '28%', height: '55%', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }, scroll: { opacity: [0, 1], y: [60, 0], blur: [10, 0], start: 0.12, end: 0.42 } },
                { id: 'fg-c2-title', tag: 'h3', text: 'Develop', style: { fontSize: '1.4rem', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '32%', left: '39%', width: '22%' }, scroll: { opacity: [0, 1], y: [30, 0], start: 0.17, end: 0.42 } },
                { id: 'fg-c2-desc', tag: 'p', text: 'Robust, scalable code that performs', style: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '40%', left: '39%', width: '22%', lineHeight: '1.6' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.22, end: 0.47 } },
                { id: 'fg-card3', tag: 'div', text: '', style: { position: 'absolute', top: '25%', left: '67%', width: '28%', height: '55%', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }, scroll: { opacity: [0, 1], y: [60, 0], blur: [10, 0], start: 0.19, end: 0.49 } },
                { id: 'fg-c3-title', tag: 'h3', text: 'Deploy', style: { fontSize: '1.4rem', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '32%', left: '70%', width: '22%' }, scroll: { opacity: [0, 1], y: [30, 0], start: 0.24, end: 0.49 } },
                { id: 'fg-c3-desc', tag: 'p', text: 'Ship to production with confidence', style: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '40%', left: '70%', width: '22%', lineHeight: '1.6' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.29, end: 0.54 } }
            ]
        },
        imageReveal: {
            label: 'Image Reveal',
            desc: 'Full-width image with cinematic wipe',
            elements: [
                { id: 'imgr-tag', tag: 'span', text: 'FEATURED WORK', style: { fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', position: 'absolute', top: '5%', left: '8%' }, scroll: { opacity: [0, 1], x: [-30, 0], start: 0, end: 0.3 } },
                { id: 'imgr-frame', tag: 'div', text: '', style: { position: 'absolute', top: '12%', left: '8%', width: '84%', height: '70%', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(108,92,231,0.3), rgba(0,206,201,0.15))', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }, scroll: { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], start: 0.05, end: 0.45 } },
                { id: 'imgr-title', tag: 'h2', text: 'Project Name', style: { fontSize: '3.5vw', fontWeight: '700', color: '#ffffff', position: 'absolute', bottom: '10%', left: '8%' }, scroll: { opacity: [0, 1], y: [40, 0], blur: [8, 0], start: 0.35, end: 0.6 } },
                { id: 'imgr-cat', tag: 'span', text: 'Branding — 2024', style: { fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', position: 'absolute', bottom: '6%', left: '8%' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.4, end: 0.65 } }
            ]
        },
        testimonial: {
            label: 'Testimonial',
            desc: 'Customer quote with cinematic entrance',
            elements: [
                { id: 'tst-bg', tag: 'div', text: '', style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,92,231,0.15), transparent 70%)', filter: 'blur(60px)' }, scroll: { opacity: [0, 0.6], scale: [0.6, 1.2], start: 0, end: 0.6 } },
                { id: 'tst-quote', tag: 'h2', text: '"This product completely transformed our workflow and exceeded every expectation."', style: { fontSize: '2.8vw', fontWeight: '300', fontStyle: 'italic', color: '#ffffff', position: 'absolute', top: '25%', left: '15%', width: '70%', textAlign: 'center', lineHeight: '1.5' }, scroll: { opacity: [0, 1], blur: [20, 0], start: 0, end: 0.4 }, splitText: true },
                { id: 'tst-divider', tag: 'div', text: '', style: { position: 'absolute', top: '62%', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '2px', background: 'rgba(255,255,255,0.3)' }, scroll: { opacity: [0, 1], scale: [0, 1], start: 0.25, end: 0.5 } },
                { id: 'tst-author', tag: 'p', text: 'Jane Smith', style: { fontSize: '1rem', fontWeight: '600', color: 'rgba(255,255,255,0.8)', position: 'absolute', top: '68%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.35, end: 0.55 } },
                { id: 'tst-role', tag: 'span', text: 'CEO, Company Name', style: { fontSize: '0.8rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', position: 'absolute', top: '74%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [15, 0], start: 0.4, end: 0.6 } }
            ]
        },
        ctaSection: {
            label: 'Call to Action',
            desc: 'CTA with button and gradient glow',
            elements: [
                { id: 'cta-glow', tag: 'div', text: '', style: { position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,92,231,0.3), transparent 70%)', filter: 'blur(60px)' }, scroll: { opacity: [0, 0.8], scale: [0.5, 1.2], start: 0, end: 0.5 } },
                { id: 'cta-heading', tag: 'h2', text: 'Ready to get started?', style: { fontSize: '4vw', fontWeight: '700', color: '#ffffff', position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', width: '80%' }, scroll: { opacity: [0, 1], y: [40, 0], blur: [10, 0], start: 0.05, end: 0.35 } },
                { id: 'cta-sub', tag: 'p', text: 'Join thousands of creators building the future', style: { fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '48%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: '60%' }, scroll: { opacity: [0, 1], y: [30, 0], start: 0.15, end: 0.4 } },
                { id: 'cta-btn', tag: 'div', text: 'Get Started \u2192', style: { fontSize: '1rem', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '60%', left: '50%', transform: 'translateX(-50%)', padding: '16px 40px', borderRadius: '50px', background: 'linear-gradient(135deg, #6C5CE7, #a855f7)', cursor: 'pointer', textAlign: 'center' }, scroll: { opacity: [0, 1], y: [20, 0], scale: [0.9, 1], start: 0.25, end: 0.5 } }
            ]
        },
        bigText: {
            label: 'Big Text',
            desc: 'Oversized cinematic typography',
            elements: [
                { id: 'bt-word1', tag: 'h1', text: 'THINK', style: { fontSize: '12vw', fontWeight: '900', color: '#ffffff', position: 'absolute', top: '15%', left: '10%', opacity: '0.1', letterSpacing: '-0.04em' }, scroll: { opacity: [0, 0.15], x: [-200, 0], start: 0, end: 0.3 } },
                { id: 'bt-word2', tag: 'h1', text: 'BUILD', style: { fontSize: '12vw', fontWeight: '900', color: '#ffffff', position: 'absolute', top: '35%', right: '10%', opacity: '0.1', letterSpacing: '-0.04em', textAlign: 'right', width: '80%' }, scroll: { opacity: [0, 0.15], x: [200, 0], start: 0.1, end: 0.4 } },
                { id: 'bt-word3', tag: 'h1', text: 'SHIP', style: { fontSize: '12vw', fontWeight: '900', color: '#ffffff', position: 'absolute', top: '55%', left: '10%', opacity: '0.1', letterSpacing: '-0.04em' }, scroll: { opacity: [0, 0.15], x: [-200, 0], start: 0.2, end: 0.5 } },
                { id: 'bt-overlay', tag: 'h2', text: 'We help you ship faster', style: { fontSize: '2.5vw', fontWeight: '500', color: '#ffffff', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: '2' }, scroll: { opacity: [0, 1], blur: [20, 0], start: 0.3, end: 0.6 } }
            ]
        },
        gradientHero: {
            label: 'Gradient Hero',
            desc: 'Hero with animated gradient orbs',
            elements: [
                { id: 'gh-grad1', tag: 'div', text: '', style: { position: 'absolute', top: '10%', left: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,92,231,0.4), transparent 70%)', filter: 'blur(80px)' }, scroll: { x: [0, 200], y: [0, -100], start: 0, end: 1 } },
                { id: 'gh-grad2', tag: 'div', text: '', style: { position: 'absolute', bottom: '0', right: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,206,201,0.3), transparent 70%)', filter: 'blur(80px)' }, scroll: { x: [0, -150], y: [0, 100], start: 0, end: 1 } },
                { id: 'gh-tag', tag: 'span', text: 'INTRODUCING', style: { fontSize: '0.75rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%)' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0, end: 0.2 } },
                { id: 'gh-title', tag: 'h1', text: 'The Next Generation', style: { fontSize: '6vw', fontWeight: '800', color: '#ffffff', position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,0)', textAlign: 'center', width: '80%', letterSpacing: '-0.03em' }, scroll: { opacity: [0, 1], y: [60, 0], clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], start: 0.05, end: 0.35 } },
                { id: 'gh-sub', tag: 'p', text: 'Beautiful, fast, and built for the modern web', style: { fontSize: '1.3rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '55%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', width: '50%' }, scroll: { opacity: [0, 1], y: [30, 0], start: 0.15, end: 0.4 } }
            ]
        },
        cardStack: {
            label: 'Card Stack',
            desc: 'Stacked cards with depth reveal',
            elements: [
                { id: 'cs-card3', tag: 'div', text: '', style: { position: 'absolute', top: '21%', left: '19%', width: '62%', height: '60%', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', zIndex: '1' }, scroll: { y: [60, -16], opacity: [0, 0.4], scale: [0.9, 0.92], start: 0.2, end: 0.6 } },
                { id: 'cs-card2', tag: 'div', text: '', style: { position: 'absolute', top: '18%', left: '22%', width: '56%', height: '60%', borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', zIndex: '2' }, scroll: { y: [80, -8], opacity: [0, 0.7], scale: [0.95, 0.96], start: 0.1, end: 0.5 } },
                { id: 'cs-card1', tag: 'div', text: '', style: { position: 'absolute', top: '15%', left: '25%', width: '50%', height: '60%', borderRadius: '20px', background: 'linear-gradient(180deg, rgba(108,92,231,0.15), rgba(0,0,0,0.3))', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', zIndex: '3' }, scroll: { y: [100, 0], opacity: [0, 1], rotation: [-3, 0], start: 0, end: 0.4 } },
                { id: 'cs-title', tag: 'h2', text: 'Our Work', style: { fontSize: '2rem', fontWeight: '600', color: '#ffffff', position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: '4' }, scroll: { opacity: [0, 1], y: [30, 0], blur: [10, 0], start: 0.15, end: 0.45 } },
                { id: 'cs-desc', tag: 'p', text: 'Scroll to explore our latest projects', style: { fontSize: '1rem', color: 'rgba(255,255,255,0.5)', position: 'absolute', top: '35%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: '4', width: '40%' }, scroll: { opacity: [0, 1], y: [20, 0], start: 0.2, end: 0.5 } }
            ]
        }
    };

    /* ─── Animation Presets (Framer-style quick-apply) ─── */
    var ANIMATION_PRESETS = {
        none:           null,
        // ── Fade In ──
        fadeInUp:       { opacity: [0, 1], y: [60, 0], start: 0, end: 0.4, ease: 'power2.out' },
        fadeInDown:     { opacity: [0, 1], y: [-60, 0], start: 0, end: 0.4, ease: 'power2.out' },
        fadeInLeft:     { opacity: [0, 1], x: [-80, 0], start: 0, end: 0.4, ease: 'power2.out' },
        fadeInRight:    { opacity: [0, 1], x: [80, 0], start: 0, end: 0.4, ease: 'power2.out' },
        // ── Scale In ──
        scaleIn:        { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4, ease: 'power3.out' },
        scaleInUp:      { opacity: [0, 1], scale: [0.8, 1], y: [40, 0], start: 0, end: 0.4, ease: 'power3.out' },
        // ── Blur In ──
        blurIn:         { opacity: [0, 1], blur: [20, 0], start: 0, end: 0.4, ease: 'power2.out' },
        blurInUp:       { opacity: [0, 1], blur: [15, 0], y: [40, 0], start: 0, end: 0.4, ease: 'power2.out' },
        blurInScale:    { opacity: [0, 1], blur: [12, 0], scale: [0.9, 1], start: 0, end: 0.45, ease: 'power2.out' },
        // ── Slide / Clip ──
        slideInUp:      { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], y: [20, 0], start: 0, end: 0.45, ease: 'power3.out' },
        slideInDown:    { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [-20, 0], start: 0, end: 0.45, ease: 'power3.out' },
        slideInLeft:    { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], x: [-20, 0], start: 0, end: 0.45, ease: 'power3.out' },
        slideInRight:   { clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0%)'], x: [20, 0], start: 0, end: 0.45, ease: 'power3.out' },
        clipRevealUp:   { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], start: 0, end: 0.5, ease: 'power3.out' },
        clipRevealDown: { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], start: 0, end: 0.5, ease: 'power3.out' },
        clipRevealLeft: { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], start: 0, end: 0.5, ease: 'power3.out' },
        clipRevealRight:{ clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0%)'], start: 0, end: 0.5, ease: 'power3.out' },
        // ── Rotate / Flip In ──
        rotateIn:       { opacity: [0, 1], rotation: [15, 0], scale: [0.9, 1], start: 0, end: 0.4, ease: 'power2.out' },
        rotateInLeft:   { opacity: [0, 1], rotation: [-15, 0], x: [-60, 0], start: 0, end: 0.45, ease: 'power2.out' },
        flipInX:        { opacity: [0, 1], rotateX: [90, 0], start: 0, end: 0.5, ease: 'power3.out' },
        flipInY:        { opacity: [0, 1], rotateY: [90, 0], start: 0, end: 0.5, ease: 'power3.out' },
        // ── Zoom ──
        zoomIn:         { scale: [0.5, 1], opacity: [0, 1], start: 0, end: 0.5, ease: 'power2.out' },
        zoomOut:        { scale: [1.3, 1], opacity: [0, 1], start: 0, end: 0.5, ease: 'power2.out' },
        // ── Bounce In ──
        bounceIn:       { opacity: [0, 1], scale: [0.3, 1.05, 0.95, 1], y: [60, -10, 5, 0], start: 0, end: 0.5, ease: 'back.out(1.7)' },
        bounceInUp:     { opacity: [0, 1], y: [120, -15, 5, 0], start: 0, end: 0.5, ease: 'back.out(1.7)' },
        bounceInLeft:   { opacity: [0, 1], x: [-120, 15, -5, 0], start: 0, end: 0.5, ease: 'back.out(1.7)' },
        bounceInDown:   { opacity: [0, 1], y: [-120, 15, -5, 0], start: 0, end: 0.5, ease: 'back.out(1.7)' },
        // ── Special Entrance ──
        rollIn:         { opacity: [0, 1], x: [-120, 0], rotation: [-120, 0], start: 0, end: 0.5, ease: 'power3.out' },
        jackInTheBox:   { opacity: [0, 1], scale: [0.1, 1], rotation: [30, -10, 3, 0], start: 0, end: 0.5, ease: 'back.out(2)' },
        backInUp:       { opacity: [0, 0.7, 1], scale: [0.7, 0.7, 1], y: [120, 0, 0], start: 0, end: 0.5, ease: 'power2.out' },
        backInLeft:     { opacity: [0, 0.7, 1], scale: [0.7, 0.7, 1], x: [-200, 0, 0], start: 0, end: 0.5, ease: 'power2.out' },
        lightSpeedInRight: { opacity: [0, 1], x: [200, 0], skewX: [-30, 0], start: 0, end: 0.4, ease: 'power3.out' },
        swingIn:        { opacity: [0, 1], rotation: [15, -10, 5, -2, 0], start: 0, end: 0.5, ease: 'power2.out' },
        rubberBand:     { opacity: [0, 1], scale: [0.3, 1.25, 0.75, 1.15, 0.95, 1], start: 0, end: 0.5, ease: 'power1.out' },
        jello:          { opacity: [0, 1], skewX: [0, -12.5, 6.25, -3.1, 1.5, 0], skewY: [0, -12.5, 6.25, -3.1, 1.5, 0], start: 0, end: 0.5, ease: 'power1.out' },
        tada:           { opacity: [0, 1], scale: [0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1, 1], rotation: [0, -3, -3, 3, -3, 3, -3, 0], start: 0, end: 0.5, ease: 'power1.out' },
        heartBeat:      { opacity: [0, 1], scale: [1, 1.3, 1, 1.3, 1], start: 0, end: 0.5, ease: 'power1.inOut' },
        // ── 3D Entrance ──
        flip3DX:        { opacity: [0, 1], rotateX: [180, 0], start: 0, end: 0.5, ease: 'power3.out' },
        flip3DY:        { opacity: [0, 1], rotateY: [180, 0], start: 0, end: 0.5, ease: 'power3.out' },
        cubeRotate:     { opacity: [0, 1], rotateY: [-90, 0], y: [50, 0], start: 0, end: 0.5, ease: 'power3.out' },
        doorOpen:       { opacity: [0, 1], rotateY: [-90, 0], start: 0, end: 0.6, ease: 'expo.out' },
        unfold:         { opacity: [0, 1], rotateX: [-90, 0], y: [-40, 0], start: 0, end: 0.5, ease: 'power3.out' },
        pivotIn:        { opacity: [0, 1], rotation: [-90, 0], scale: [0.5, 1], start: 0, end: 0.5, ease: 'power3.out' },
        swingDoor:      { opacity: [0, 1], rotateY: [90, -20, 10, 0], start: 0, end: 0.6, ease: 'power2.out' },
        perspective3D:  { opacity: [0, 1], rotateX: [30, 0], rotateY: [-30, 0], y: [60, 0], start: 0, end: 0.5, ease: 'power3.out' },
        // ── Cinematic Entrance ──
        cinematicFade:   { opacity: [0, 1], scale: [1.1, 1], blur: [8, 0], start: 0, end: 0.5, ease: 'power2.out' },
        cinematicSlide:  { opacity: [0, 1], x: [-120, 0], skewX: [8, 0], start: 0, end: 0.5, ease: 'power3.out' },
        cinematicReveal: { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], opacity: [0.5, 1], scale: [0.95, 1], start: 0, end: 0.6, ease: 'expo.out' },
        cinematicDrop:   { opacity: [0, 1], y: [-100, 0], rotateX: [45, 0], start: 0, end: 0.5, ease: 'back.out(1.7)' },
        cinematicRise:   { opacity: [0, 1], y: [100, 0], scale: [0.9, 1], blur: [12, 0], start: 0, end: 0.55, ease: 'power3.out' },
        // ── Exit — Fade ──
        fadeOut:         { opacity: [1, 0], y: [0, -40], start: 0.6, end: 1, ease: 'power1.in' },
        fadeOutUp:       { opacity: [1, 0], y: [0, -80], start: 0.6, end: 1, ease: 'power1.in' },
        fadeOutDown:     { opacity: [1, 0], y: [0, 60], start: 0.6, end: 1, ease: 'power1.in' },
        fadeOutLeft:     { opacity: [1, 0], x: [0, -80], start: 0.6, end: 1, ease: 'power1.in' },
        fadeOutRight:    { opacity: [1, 0], x: [0, 80], start: 0.6, end: 1, ease: 'power1.in' },
        // ── Exit — Slide / Scale ──
        slideOutUp:      { clipPath: ['inset(0% 0 0 0)', 'inset(0 0 100% 0)'], y: [0, -20], start: 0.6, end: 1, ease: 'power3.in' },
        slideOutDown:    { clipPath: ['inset(0 0 0% 0)', 'inset(100% 0 0 0)'], y: [0, 20], start: 0.6, end: 1, ease: 'power3.in' },
        slideOutLeft:    { clipPath: ['inset(0 0% 0 0)', 'inset(0 0 0 100%)'], x: [0, -20], start: 0.6, end: 1, ease: 'power3.in' },
        slideOutRight:   { clipPath: ['inset(0 0 0 0%)', 'inset(0 100% 0 0)'], x: [0, 20], start: 0.6, end: 1, ease: 'power3.in' },
        scaleOut:        { opacity: [1, 0], scale: [1, 0.8], start: 0.6, end: 1, ease: 'power2.in' },
        zoomOutUp:       { opacity: [1, 0], scale: [1, 0.4], y: [0, -80], start: 0.6, end: 1, ease: 'power2.in' },
        zoomOutDown:     { opacity: [1, 0], scale: [1, 0.4], y: [0, 80], start: 0.6, end: 1, ease: 'power2.in' },
        // ── Exit — Special ──
        blurOut:         { opacity: [1, 0], blur: [0, 20], start: 0.6, end: 1, ease: 'power1.in' },
        bounceOut:       { opacity: [1, 0], scale: [1, 0.95, 1.1, 0.3], start: 0.6, end: 1, ease: 'power1.in' },
        rollOut:         { opacity: [1, 0], x: [0, 120], rotation: [0, 120], start: 0.6, end: 1, ease: 'power2.in' },
        backOutUp:       { opacity: [1, 0.7, 0], scale: [1, 0.7, 0.7], y: [0, 0, -120], start: 0.6, end: 1, ease: 'power2.in' },
        backOutLeft:     { opacity: [1, 0.7, 0], scale: [1, 0.7, 0.7], x: [0, 0, -200], start: 0.6, end: 1, ease: 'power2.in' },
        lightSpeedOutRight: { opacity: [1, 0], x: [0, 200], skewX: [0, 30], start: 0.6, end: 1, ease: 'power3.in' },
        flipOutX:        { opacity: [1, 0], rotateX: [0, 90], start: 0.6, end: 1, ease: 'power3.in' },
        flipOutY:        { opacity: [1, 0], rotateY: [0, 90], start: 0.6, end: 1, ease: 'power3.in' },
        hinge:           { opacity: [1, 1, 0], rotation: [0, 80, 60, 80, 0], y: [0, 0, 300], start: 0.5, end: 1, ease: 'power2.in' },
        // ── Attention / Continuous ──
        pulse:           { scale: [1, 1.08, 1], start: 0, end: 1, ease: 'sine.inOut' },
        shake:           { x: [0, -10, 10, -10, 10, -6, 6, -2, 0], start: 0, end: 1, ease: 'none' },
        swing:           { rotation: [0, 15, -10, 5, -5, 0], start: 0, end: 1, ease: 'power1.inOut' },
        wobble:          { x: [0, -60, 40, -30, 20, -10, 0], rotation: [0, -5, 3, -3, 2, -1, 0], start: 0, end: 1, ease: 'none' },
        bounce:          { y: [0, -30, 0, -15, 0, -5, 0], start: 0, end: 1, ease: 'none' },
        flash:           { opacity: [1, 0, 1, 0, 1], start: 0, end: 1, ease: 'none' },
        headShake:       { x: [0, -6, 5, -3, 2, 0], rotation: [0, -9, 7, -5, 3, 0], start: 0, end: 1, ease: 'none' },
        pendulum:        { rotation: [-15, 15, -10, 10, -5, 0], start: 0, end: 1, ease: 'sine.inOut' },
        vibrate:         { x: [0, -3, 3, -3, 3, -2, 2, -1, 0], start: 0, end: 1, ease: 'none' },
        wiggle:          { rotation: [0, -12, 8, -8, 4, -2, 0], start: 0, end: 1, ease: 'power1.inOut' },
        sway:            { x: [-20, 20], rotation: [-3, 3], start: 0, end: 1, ease: 'sine.inOut' },
        floatLoop:       { y: [-20, 20], rotation: [-2, 2], start: 0, end: 1, ease: 'none' },
        breatheLoop:     { scale: [0.95, 1.05], opacity: [0.7, 1], start: 0, end: 1, ease: 'sine.inOut' },
        driftLoop:       { x: [-30, 30], y: [-15, 15], start: 0, end: 1, ease: 'none' },
        // ── Text Presets ──
        typewriterFade:  { opacity: [0, 1], x: [20, 0], blur: [4, 0], start: 0, end: 0.3, ease: 'power1.out' },
        headlineSlam:    { opacity: [0, 1], scale: [2, 1], blur: [20, 0], start: 0, end: 0.4, ease: 'expo.out' },
        subtitleGlide:   { opacity: [0, 1], y: [30, 0], x: [-20, 0], start: 0.1, end: 0.4, ease: 'power2.out' },
        letterByLetter:  { opacity: [0, 1], y: [20, 0], start: 0, end: 0.3, ease: 'power2.out', splitText: true },
        wordByWord:      { opacity: [0, 1], y: [15, 0], blur: [4, 0], start: 0, end: 0.35, ease: 'power2.out', splitText: true },
        lineReveal:      { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [20, 0], start: 0, end: 0.4, ease: 'power3.out' },
        splitFade:       { opacity: [0, 1], x: [-30, 0], blur: [8, 0], start: 0, end: 0.35, ease: 'power2.out', splitText: true },
        scrambleIn:      { opacity: [0, 1], blur: [6, 0], rotation: [5, 0], start: 0, end: 0.35, ease: 'power2.out' },
        glitchText:      { opacity: [0, 1], x: [-10, 10, -5, 0], skewX: [10, -5, 3, 0], start: 0, end: 0.3, ease: 'power1.out' },
        waveText:        { opacity: [0, 1], y: [30, -10, 5, 0], start: 0, end: 0.4, ease: 'power2.out', splitText: true },
        bounceLetters:   { opacity: [0, 1], y: [40, -8, 3, 0], scale: [0.5, 1.1, 0.95, 1], start: 0, end: 0.4, ease: 'back.out(1.7)', splitText: true },
        cascadeWords:    { opacity: [0, 1], y: [40, 0], x: [-20, 0], start: 0, end: 0.35, ease: 'power3.out', splitText: true },
        neonFlicker:     { opacity: [0, 1, 0.4, 1, 0.7, 1], start: 0, end: 0.4, ease: 'none' },
        // ── Parallax ──
        parallaxSlow:    { y: [80, -80], start: 0, end: 1, ease: 'none' },
        parallaxFast:    { y: [200, -200], start: 0, end: 1, ease: 'none' },
        parallaxZoom:    { scale: [0.8, 1.2], start: 0, end: 1, ease: 'none' },
        parallaxRotate:  { rotation: [-5, 5], y: [60, -60], start: 0, end: 1, ease: 'none' },
        parallaxTilt:    { rotateX: [10, -10], rotateY: [-5, 5], y: [40, -40], start: 0, end: 1, ease: 'none' },
        parallaxDeep:    { y: [300, -300], scale: [0.9, 1.1], start: 0, end: 1, ease: 'none' },
        parallaxMultiLayer: { y: [100, -100], x: [-30, 30], opacity: [0.6, 1], start: 0, end: 1, ease: 'none' },
        horizontalScroll:{ x: [400, -400], start: 0, end: 1, ease: 'none' },
        pinAndZoom:      { scale: [1, 2.5], opacity: [1, 0.3], start: 0, end: 1, ease: 'power1.in' },
        scrubRotate:     { rotation: [0, 360], start: 0, end: 1, ease: 'none' },
        // ── Stagger ──
        staggerFadeUp1:  { opacity: [0, 1], y: [40, 0], start: 0, end: 0.3, ease: 'power2.out' },
        staggerFadeUp2:  { opacity: [0, 1], y: [40, 0], start: 0.05, end: 0.35, ease: 'power2.out' },
        staggerFadeUp3:  { opacity: [0, 1], y: [40, 0], start: 0.1, end: 0.4, ease: 'power2.out' },
        staggerFadeUp4:  { opacity: [0, 1], y: [40, 0], start: 0.15, end: 0.45, ease: 'power2.out' },
        staggerFadeUp5:  { opacity: [0, 1], y: [40, 0], start: 0.2, end: 0.5, ease: 'power2.out' },
        staggerScaleIn1: { opacity: [0, 1], scale: [0.7, 1], start: 0, end: 0.3, ease: 'back.out(1.7)' },
        staggerScaleIn2: { opacity: [0, 1], scale: [0.7, 1], start: 0.06, end: 0.36, ease: 'back.out(1.7)' },
        staggerScaleIn3: { opacity: [0, 1], scale: [0.7, 1], start: 0.12, end: 0.42, ease: 'back.out(1.7)' },
        staggerScaleIn4: { opacity: [0, 1], scale: [0.7, 1], start: 0.18, end: 0.48, ease: 'back.out(1.7)' }
    };

    /* ─── Default Scene Factory ─── */
    function createScene(templateId, index) {
        var tpl = SCENE_TEMPLATES[templateId] || SCENE_TEMPLATES.blank;
        var sceneId = 'scene-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        var elems = [];
        tpl.elements.forEach(function (e) {
            elems.push({
                id: e.id + '-' + sceneId.substr(-4),
                tag: e.tag,
                text: e.text,
                style: JSON.parse(JSON.stringify(e.style)),
                scroll: e.scroll ? JSON.parse(JSON.stringify(e.scroll)) : null,
                splitText: e.splitText || false,
                parallax: e.parallax || 1,
                visible: true,
                locked: false
            });
        });
        return {
            id: sceneId,
            name: tpl.label + (index !== undefined ? ' ' + (index + 1) : ''),
            template: templateId,
            duration: 100,
            pin: true,
            bgColor: '',
            bgImage: '',
            elements: elems
        };
    }

    /* ─── Compile ─── */
    function compile(cfg) {
        var files = {};
        var c = _defaults(cfg);

        // L8: Validate scenes — ensure each has elements array and reasonable duration
        (c.scenes || []).forEach(function (scene) {
            if (!Array.isArray(scene.elements)) scene.elements = [];
            scene.duration = Math.max(20, Math.min(500, parseInt(scene.duration) || 100));
            scene.elements.forEach(function (el) {
                if (!el.id) el.id = uid();
                if (!el.tag) el.tag = 'div';
            });
        });

        files['index.html'] = _buildHTML(c);
        files['css/style.css'] = _buildCSS(c);
        files['js/cinema.js'] = _buildCinemaJS(c);
        files['js/main.js'] = _buildMainJS(c);

        // Background animation JS (reuse from classic compiler for the same style)
        var cat = ArbelCompiler.getAnimCategory(c.style);
        if (cat === 'shader') {
            files['js/shader.js'] = _buildShaderBridge(c);
        }

        files['README.md'] = _buildReadme(c);
        // M4: Export arbel.config.json (public metadata only — no sensitive data)
        files['arbel.config.json'] = _buildCineConfig(c);

        // P1: Build background animation JS for non-shader styles (reuses classic compiler)
        if (cat !== 'shader') {
            var animFile = ArbelCompiler.getAnimJsFile ? ArbelCompiler.getAnimJsFile(c.style) : 'particles.js';
            var animJS = ArbelCompiler.buildAnimJS ? ArbelCompiler.buildAnimJS(c.style, c.particles, c.bgColor) : null;
            if (animJS) files['js/' + animFile] = animJS;
        }

        return files;
    }

    function _defaults(cfg) {
        return Object.assign({
            brandName: 'My Site',
            tagline: '',
            style: 'obsidian',
            accent: '#6C5CE7',
            bgColor: '#0a0a0f',
            scenes: [createScene('hero', 0)],
            nav: { logo: '', links: [] }
        }, cfg);
    }

    /* ─── Config Builder (M4) ─── */
    function _buildCineConfig(cfg) {
        // M4/P4: Public metadata config — mirrors classic arbel.config.json structure for cinematic mode.
        // contactEmail intentionally excluded (public file on GitHub Pages).
        return JSON.stringify({
            version: '1.0',
            generator: 'arbel-cinematic',
            mode: 'cinematic',
            brandName: cfg.brandName,
            tagline: cfg.tagline,
            style: cfg.style,
            accent: cfg.accent,
            bgColor: cfg.bgColor,
            industry: cfg.industry || '',
            nav: cfg.nav,
            seo: cfg.seo,
            designTokens: cfg.designTokens,
            scenes: (cfg.scenes || []).map(function (s) {
                return {
                    id: s.id,
                    name: s.name,
                    template: s.template,
                    duration: s.duration,
                    pin: s.pin,
                    bgColor: s.bgColor,
                    bgImage: s.bgImage,
                    bg3dType: s.bg3dType || '',
                    bg3dColor1: s.bg3dColor1 || '',
                    bg3dColor2: s.bg3dColor2 || '',
                    bg3dIntensity: s.bg3dIntensity || '',
                    bg3dSpeed: s.bg3dSpeed || '',
                    elements: (s.elements || []).map(function (el) {
                        return { id: el.id, tag: el.tag, text: el.text, style: el.style, scroll: el.scroll, splitText: el.splitText, parallax: el.parallax, visible: el.visible };
                    })
                };
            })
        }, null, 2);
    }

    /* ─── HTML Builder ─── */
    function _buildHTML(cfg) {
        var scenes = cfg.scenes || [];
        var accent = esc(cfg.accent);
        var bg = esc(cfg.bgColor);

        var seo = cfg.seo || {};
        var seoTitle = seo.title || cfg.brandName;
        var seoDesc = seo.description || cfg.tagline || cfg.brandName;

        var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
        html += '<meta charset="UTF-8">\n';
        html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
        html += '<title>' + esc(seoTitle) + '</title>\n';
        html += '<meta name="description" content="' + esc(seoDesc) + '">\n';
        if (!seo.index && seo.index !== undefined) {
            html += '<meta name="robots" content="noindex, nofollow">\n';
        }
        if (seo.canonical) html += '<link rel="canonical" href="' + escHref(seo.canonical) + '">\n';
        if (seo.favicon) html += '<link rel="icon" href="' + escHref(seo.favicon) + '">\n';
        // Open Graph
        html += '<meta property="og:type" content="website">\n';
        html += '<meta property="og:title" content="' + esc(seoTitle) + '">\n';
        html += '<meta property="og:description" content="' + esc(seoDesc) + '">\n';
        if (seo.canonical) html += '<meta property="og:url" content="' + escHref(seo.canonical) + '">\n';
        if (seo.ogImage) html += '<meta property="og:image" content="' + escHref(seo.ogImage) + '">\n';
        // Twitter Card
        html += '<meta name="twitter:card" content="' + (seo.ogImage ? 'summary_large_image' : 'summary') + '">\n';
        html += '<meta name="twitter:title" content="' + esc(seoTitle) + '">\n';
        html += '<meta name="twitter:description" content="' + esc(seoDesc) + '">\n';
        if (seo.ogImage) html += '<meta name="twitter:image" content="' + escHref(seo.ogImage) + '">\n';
        html += '<link rel="preconnect" href="https://fonts.googleapis.com">\n';
        html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';

        // Collect used font families from elements
        var usedFonts = { 'Inter': 'Inter:wght@300;400;500;600;700;800;900' };
        var fontMap = {
            // Sans Serif
            'Space Mono': 'Space+Mono:wght@400;700',
            'Space Grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
            'DM Sans': 'DM+Sans:wght@300;400;500;600;700',
            'Sora': 'Sora:wght@300;400;500;600;700;800',
            'Outfit': 'Outfit:wght@300;400;500;600;700;800',
            'Poppins': 'Poppins:wght@300;400;500;600;700;800;900',
            'Montserrat': 'Montserrat:wght@300;400;500;600;700;800;900',
            'Raleway': 'Raleway:wght@300;400;500;600;700;800;900',
            'Roboto': 'Roboto:wght@300;400;500;700;900',
            'Open Sans': 'Open+Sans:wght@300;400;500;600;700;800',
            'Nunito': 'Nunito:wght@300;400;500;600;700;800;900',
            'Rubik': 'Rubik:wght@300;400;500;600;700;800;900',
            'Work Sans': 'Work+Sans:wght@300;400;500;600;700;800',
            'Quicksand': 'Quicksand:wght@300;400;500;600;700',
            'Lexend': 'Lexend:wght@300;400;500;600;700;800',
            'Urbanist': 'Urbanist:wght@300;400;500;600;700;800',
            'Figtree': 'Figtree:wght@300;400;500;600;700;800',
            'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
            'Manrope': 'Manrope:wght@300;400;500;600;700;800',
            'Albert Sans': 'Albert+Sans:wght@300;400;500;600;700;800',
            'Onest': 'Onest:wght@300;400;500;600;700;800',
            'Geist': 'Geist:wght@300;400;500;600;700;800;900',
            // Serif
            'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800;900',
            'DM Serif Display': 'DM+Serif+Display',
            'Lora': 'Lora:wght@400;500;600;700',
            'Merriweather': 'Merriweather:wght@300;400;700;900',
            'Crimson Text': 'Crimson+Text:wght@400;600;700',
            'Source Serif 4': 'Source+Serif+4:wght@300;400;500;600;700;800;900',
            'Noto Serif': 'Noto+Serif:wght@400;500;600;700;800;900',
            'EB Garamond': 'EB+Garamond:wght@400;500;600;700;800',
            'Cormorant Garamond': 'Cormorant+Garamond:wght@300;400;500;600;700',
            'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
            'Fraunces': 'Fraunces:wght@300;400;500;600;700;800;900',
            'Bodoni Moda': 'Bodoni+Moda:wght@400;500;600;700;800;900',
            'Young Serif': 'Young+Serif',
            'Instrument Serif': 'Instrument+Serif:ital@0;1',
            // Display
            'Oswald': 'Oswald:wght@300;400;500;600;700',
            'Bebas Neue': 'Bebas+Neue',
            'Archivo Black': 'Archivo+Black',
            'Anton': 'Anton',
            'Abril Fatface': 'Abril+Fatface',
            'Righteous': 'Righteous',
            'Permanent Marker': 'Permanent+Marker',
            'Pacifico': 'Pacifico',
            'Lobster': 'Lobster',
            'Josefin Sans': 'Josefin+Sans:wght@300;400;500;600;700',
            // Monospace
            'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
            'Fira Code': 'Fira+Code:wght@400;500;600;700',
            'Source Code Pro': 'Source+Code+Pro:wght@300;400;500;600;700',
            'Inconsolata': 'Inconsolata:wght@300;400;500;600;700;800;900',
            'Roboto Mono': 'Roboto+Mono:wght@300;400;500;600;700',
            'Ubuntu Mono': 'Ubuntu+Mono:wght@400;700',
            'IBM Plex Mono': 'IBM+Plex+Mono:wght@300;400;500;600;700',
            // Handwritten
            'Caveat': 'Caveat:wght@400;500;600;700',
            'Dancing Script': 'Dancing+Script:wght@400;500;600;700',
            'Satisfy': 'Satisfy',
            'Great Vibes': 'Great+Vibes',
            'Kalam': 'Kalam:wght@300;400;700',
            'Shadows Into Light': 'Shadows+Into+Light'
        };
        (cfg.scenes || []).forEach(function (scene) {
            (scene.elements || []).forEach(function (el) {
                if (el.style && el.style.fontFamily) {
                    Object.keys(fontMap).forEach(function (name) {
                        if (el.style.fontFamily.indexOf(name) >= 0) {
                            usedFonts[name] = fontMap[name];
                        }
                    });
                }
            });
        });
        var fontFamilies = Object.keys(usedFonts).map(function (k) { return 'family=' + usedFonts[k]; }).join('&');
        html += '<link href="https://fonts.googleapis.com/css2?' + fontFamilies + '&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">\n';
        html += '<link rel="stylesheet" href="css/style.css">\n';
        // Custom head injection (analytics, tracking pixels, etc.)
        if (cfg.editorOverrides && cfg.editorOverrides.customHead) {
            html += cfg.editorOverrides.customHead + '\n';
        }
        html += '</head>\n<body>\n';

        // Preloader
        html += '<div class="cne-preloader" id="preloader">\n';
        html += '  <div class="cne-preloader-inner">\n';
        html += '    <span class="cne-preloader-text mono">' + esc(cfg.brandName) + '</span>\n';
        html += '    <div class="cne-preloader-bar"><div class="cne-preloader-fill"></div></div>\n';
        html += '  </div>\n</div>\n\n';

        // Navigation
        html += '<nav class="cne-nav" data-arbel-id="site-nav">\n';
        html += '  <a href="#" class="cne-nav-logo" data-arbel-id="site-logo" data-arbel-edit="text">' + esc(cfg.brandName) + '</a>\n';
        html += '  <div class="cne-nav-links">\n';
        if (cfg.nav && cfg.nav.links) {
            cfg.nav.links.forEach(function (link) {
                html += '    <a href="' + escHref(link.href) + '" class="cne-nav-link" data-arbel-edit="text">' + esc(link.text) + '</a>\n';
            });
        }
        html += '  </div>\n';
        html += '  <div class="cne-scroll-progress"><div class="cne-scroll-progress-fill" id="scrollProgress"></div></div>\n';
        html += '</nav>\n\n';

        // P1: Shader styles use a WebGL canvas; non-shader styles use a plain div targeted by classic animation JS
        if (ArbelCompiler.getAnimCategory(cfg.style) === 'shader') {
            html += '<canvas id="bgCanvas" class="cne-bg-canvas"></canvas>\n\n';
        } else {
            html += '<div class="anim-bg cne-bg-canvas" aria-hidden="true"></div>\n\n';
        }

        // Scenes
        html += '<main class="cne-scenes">\n';
        scenes.forEach(function (scene, i) {
            var sceneBg = '';
            if (scene.bgColor) sceneBg += 'background-color:' + esc(scene.bgColor) + ';';
            if (scene.bgImage) {
                var safeBgUrl = scene.bgImage.replace(/[\\"'<>()\n\r]/g, '').replace(/javascript\s*:/gi, '').replace(/expression\s*\(/gi, '');
                if (/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:image\/)/i.test(safeBgUrl)) {
                    sceneBg += 'background-image:url(' + esc(safeBgUrl) + ');background-size:cover;background-position:center;';
                }
            }

            html += '  <section class="cne-scene"';
            html += ' data-scene-id="' + esc(scene.id) + '"';
            html += ' data-scene-index="' + i + '"';
            html += ' data-pin="' + (scene.pin !== false ? 'true' : 'false') + '"';
            html += ' data-duration="' + (scene.duration || 100) + '"';
            if (sceneBg) html += ' style="' + sceneBg + '"';
            html += '>\n';

            // 3D background effect
            if (scene.bg3dType) {
                var bg3dC1 = esc(scene.bg3dColor1 || '#6c5ce7');
                var bg3dC2 = esc(scene.bg3dColor2 || '#00cec9');
                var bg3dIntensity = parseInt(scene.bg3dIntensity) || 5;
                var bg3dSpeed = esc(scene.bg3dSpeed || 'medium');
                html += '    <div class="cne-bg3d" data-bg3d="' + esc(scene.bg3dType) + '"';
                html += ' data-color1="' + bg3dC1 + '" data-color2="' + bg3dC2 + '"';
                html += ' data-intensity="' + bg3dIntensity + '" data-speed="' + bg3dSpeed + '"';
                html += ' aria-hidden="true"></div>\n';
            }

            // Spline 3D embed
            if (scene.splineUrl && /^https:\/\/(prod|my|viewer)\.spline\.design\//.test(scene.splineUrl)) {
                html += '    <iframe class="cne-spline-embed" src="' + escHref(scene.splineUrl) + '"';
                html += ' style="position:absolute;inset:0;width:100%;height:100%;border:none;z-index:0;pointer-events:none"';
                html += ' loading="lazy" title="3D Scene" aria-hidden="true"></iframe>\n';
            }

            (scene.elements || []).forEach(function (el) {
                if (!el.visible) return;
                var validTags = ['h1','h2','h3','p','span','div','img','video','a','form','section','header','footer','nav','ul','li','ol'];
                var tag = (validTags.indexOf(el.tag) >= 0) ? el.tag : 'div';
                var style = '';
                if (el.style) {
                    Object.keys(el.style).forEach(function (prop) {
                        var val = String(el.style[prop]);
                        // Sanitize: escape characters that could break the style/HTML context
                        val = val.replace(/[<>"'`]/g, '');
                        if (/javascript\s*:/i.test(val) || /expression\s*\(/i.test(val) || /-moz-binding/i.test(val)) return;
                        style += _camelToDash(prop) + ':' + val + ';';
                    });
                }
                var scrollData = '';
                if (el.scroll) {
                    // Strict per-property scroll sanitization (mirrors editor's _sanitizeScroll)
                    var safeScroll = {};
                    var scrollKeys = el.scroll;
                    var allowedScrollKeys = {opacity:1,x:1,y:1,scale:1,rotation:1,blur:1,clipPath:1,rotateX:1,rotateY:1,skewX:1,skewY:1,start:1,end:1,ease:1};
                    var allowedEaseRe = /^(none|power[1-4]\.(in|out|inOut)|expo\.(in|out|inOut)|circ\.(in|out|inOut)|sine\.(in|out|inOut)|back\.(in|out|inOut)\([0-9.]+\)|elastic\.(in|out|inOut)\([0-9.,]+\)|bounce\.(in|out|inOut)|cubic-bezier\(-?[0-9.]+,-?[0-9.]+,-?[0-9.]+,-?[0-9.]+\))$/;
                    Object.keys(scrollKeys).forEach(function (k) {
                        if (!allowedScrollKeys[k]) return;
                        var v = scrollKeys[k];
                        if (k === 'start' || k === 'end') {
                            var n = parseFloat(v);
                            if (!isNaN(n)) safeScroll[k] = Math.max(0, Math.min(1, n));
                        } else if (k === 'ease') {
                            if (typeof v === 'string' && allowedEaseRe.test(v)) safeScroll[k] = v;
                        } else if (k === 'clipPath') {
                            if (Array.isArray(v)) {
                                var clipRe = /^(inset|circle|ellipse|polygon)\([^)]*\)$/;
                                var safe = v.filter(function (cp) { return typeof cp === 'string' && clipRe.test(cp.trim()); }).slice(0, 4);
                                if (safe.length >= 2) safeScroll[k] = safe;
                            }
                        } else if (k === 'opacity') {
                            if (Array.isArray(v)) {
                                safeScroll[k] = v.slice(0, 4).map(function (a) { return Math.max(0, Math.min(1, parseFloat(a) || 0)); });
                            }
                        } else if (k === 'scale') {
                            if (Array.isArray(v)) {
                                safeScroll[k] = v.slice(0, 4).map(function (a) { return Math.max(0, Math.min(3, parseFloat(a) || 1)); });
                            }
                        } else if (k === 'blur') {
                            if (Array.isArray(v)) {
                                safeScroll[k] = v.slice(0, 4).map(function (a) { return Math.max(0, Math.min(50, parseFloat(a) || 0)); });
                            }
                        } else if (k === 'x' || k === 'y') {
                            if (Array.isArray(v)) {
                                safeScroll[k] = v.slice(0, 4).map(function (a) { return Math.max(-2000, Math.min(2000, parseFloat(a) || 0)); });
                            }
                        } else if (k === 'rotation' || k === 'rotateX' || k === 'rotateY' || k === 'skewX' || k === 'skewY') {
                            if (Array.isArray(v)) {
                                safeScroll[k] = v.slice(0, 4).map(function (a) { return Math.max(-360, Math.min(360, parseFloat(a) || 0)); });
                            }
                        }
                    });
                    if (Object.keys(safeScroll).length > 0) {
                        scrollData = " data-scroll='" + esc(JSON.stringify(safeScroll)) + "'";
                    }
                }
                var splitAttr = el.splitText ? ' data-split-text="true"' : '';
                var parallaxAttr = el.parallax && el.parallax !== 1 ? ' data-parallax="' + parseFloat(el.parallax) + '"' : '';

                html += '    <' + tag + ' class="cne-element"';
                html += ' data-arbel-id="' + esc(el.id) + '"';
                html += ' data-arbel-edit="text"';
                if (el.group) html += ' data-arbel-group="' + esc(el.group) + '"';
                html += scrollData;
                html += splitAttr;
                html += parallaxAttr;
                if (style) html += ' style="' + style + '"';

                if (tag === 'img') {
                    var imgSrc = el.src ? escHref(el.src) : '';
                    html += ' src="' + imgSrc + '" alt="' + esc(el.text || '') + '" loading="lazy"';
                    html += '>\n';
                } else if (tag === 'video') {
                    var vidSrc = el.src ? escHref(el.src) : '';
                    html += (el.videoAutoplay !== false ? ' autoplay' : '');
                    html += (el.videoLoop !== false ? ' loop' : '');
                    html += (el.videoMuted !== false ? ' muted' : '');
                    html += ' playsinline';
                    if (vidSrc) html += ' src="' + vidSrc + '"';
                    html += '></video>\n';
                } else if (tag === 'a') {
                    var href = el.href ? escHref(el.href) : '#';
                    html += ' href="' + href + '"';
                    if (el.linkNewTab) html += ' target="_blank" rel="noopener noreferrer"';
                    html += '>' + esc(el.text) + '</a>\n';
                } else if (tag === 'form') {
                    var formAction = el.formAction ? escHref(el.formAction) : '';
                    var formMethod = (el.formMethod === 'GET') ? 'GET' : 'POST';
                    html += ' action="' + formAction + '" method="' + formMethod + '"';
                    html += '>\n';
                    var fields = el.formFields || [];
                    fields.forEach(function (field) {
                        var fName = esc(field.name || '');
                        var fType = esc(field.type || 'text');
                        var validTypes = ['text','email','tel','url','number','textarea','select'];
                        if (validTypes.indexOf(fType) < 0) fType = 'text';
                        var fLabel = fName.charAt(0).toUpperCase() + fName.slice(1);
                        html += '      <div class="cne-form-group">\n';
                        html += '        <label class="cne-form-label" for="field-' + fName + '">' + fLabel + '</label>\n';
                        if (fType === 'textarea') {
                            html += '        <textarea class="cne-form-input cne-form-textarea" id="field-' + fName + '" name="' + fName + '" placeholder="' + fLabel + '" rows="4"></textarea>\n';
                        } else {
                            html += '        <input class="cne-form-input" type="' + fType + '" id="field-' + fName + '" name="' + fName + '" placeholder="' + fLabel + '">\n';
                        }
                        html += '      </div>\n';
                    });
                    var submitText = esc(el.formSubmitText || 'Send Message');
                    html += '      <button type="submit" class="cne-form-submit">' + submitText + '</button>\n';
                    html += '    </form>\n';
                } else {
                    // Lottie animation embed
                    if (el.lottieUrl && /^https?:\/\//.test(el.lottieUrl)) {
                        var safeLottie = escHref(el.lottieUrl);
                        html += '><dotlottie-player src="' + safeLottie + '" background="transparent" speed="1" loop autoplay style="width:100%;height:100%"></dotlottie-player></' + tag + '>\n';
                    // SVG illustration
                    } else if (el.svgContent) {
                        // Sanitize SVG: strip scripts and event handlers
                        var safeSvg = el.svgContent
                            .replace(/<script[\s\S]*?<\/script>/gi, '')
                            .replace(/\bon\w+\s*=/gi, 'data-removed=');
                        html += '>' + safeSvg + '</' + tag + '>\n';
                    // iFrame embed (YouTube, Vimeo, etc.)
                    } else if (el.embedUrl && /^https:\/\//.test(el.embedUrl)) {
                        var safeEmbed = escHref(el.embedUrl);
                        html += '><iframe src="' + safeEmbed + '" style="width:100%;height:100%;border:none" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></' + tag + '>\n';
                    // For non-anchor elements with href, wrap in anchor
                    } else if (el.href && el.href !== '#' && el.href !== '') {
                        var anchorHref = escHref(el.href);
                        var anchorAttrs = ' href="' + anchorHref + '"';
                        if (el.linkNewTab) anchorAttrs += ' target="_blank" rel="noopener noreferrer"';
                        anchorAttrs += ' style="text-decoration:none;color:inherit;display:contents"';
                        html += '>' + esc(el.text) + '</' + tag + '>\n';
                        // Wrap: inject opening <a> before the element, closing </a> after
                        var elOpen = '    <' + tag + ' class="cne-element"';
                        var lastIdx = html.lastIndexOf(elOpen);
                        if (lastIdx >= 0) {
                            html = html.substring(0, lastIdx) + '    <a' + anchorAttrs + '>\n    ' + html.substring(lastIdx) + '    </a>\n';
                        }
                    } else {
                        html += '>' + esc(el.text) + '</' + tag + '>\n';
                    }
                }
            });

            html += '  </section>\n\n';
        });
        html += '</main>\n\n';

        // Footer
        html += '<footer class="cne-footer">\n';
        html += '  <span class="mono">' + esc(cfg.brandName) + ' &copy; ' + new Date().getFullYear() + '</span>\n';
        html += '</footer>\n\n';

        // Scripts
        // Check if any Lottie elements exist
        var hasLottie = false;
        (cfg.scenes || []).forEach(function (scene) {
            (scene.elements || []).forEach(function (el) {
                if (el.lottieUrl) hasLottie = true;
            });
        });
        if (hasLottie) {
            html += '<script src="https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs" type="module"><\/script>\n';
        }

        html += '<script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"><\/script>\n';
        html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>\n';
        html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>\n';

        var cat = ArbelCompiler.getAnimCategory(cfg.style);
        if (cat === 'shader') {
            html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n';
            html += '<script src="js/shader.js"><\/script>\n';
        } else {
            var animF = ArbelCompiler.getAnimJsFile ? ArbelCompiler.getAnimJsFile(cfg.style) : 'particles.js';
            html += '<script src="js/' + animF + '"><\/script>\n';
        }

        html += '<script src="js/cinema.js"><\/script>\n';
        html += '<script src="js/main.js"><\/script>\n';

        // Custom body-end injection (third-party scripts, chat widgets, etc.)
        if (cfg.editorOverrides && cfg.editorOverrides.customBodyEnd) {
            html += cfg.editorOverrides.customBodyEnd + '\n';
        }

        html += '</body>\n</html>';

        // Apply editor overrides if present
        if (cfg.editorOverrides) {
            html = _applyOverrides(html, cfg.editorOverrides);
        }

        return html;
    }

    /* ─── CSS Builder ─── */
    function _buildCSS(cfg) {
        var accent = cfg.accent || '#6C5CE7';
        var bg = cfg.bgColor || '#0a0a0f';
        var surface = _lighten(bg, 8);
        var fg = '#f0f0f0';
        var fg2 = 'rgba(240,240,240,0.5)';
        var border = 'rgba(255,255,255,0.08)';

        var dt = cfg.designTokens || {};

        var css = '/* Cinematic Mode — Generated by Arbel */\n\n';

        // Reset + Variables
        css += ':root {\n';
        css += '  --accent: ' + accent + ';\n';
        css += '  --primary: ' + (dt.primary || accent) + ';\n';
        css += '  --secondary: ' + (dt.secondary || '#00CEC9') + ';\n';
        css += '  --bg: ' + (dt.bg || bg) + ';\n';
        css += '  --surface: ' + (dt.surface || surface) + ';\n';
        css += '  --fg: ' + (dt.text || fg) + ';\n';
        css += '  --fg2: ' + (dt.textMuted || fg2) + ';\n';
        css += '  --border: ' + border + ';\n';
        css += '  --font-body: ' + (dt.bodyFont || '"Inter", system-ui, -apple-system, sans-serif') + ';\n';
        css += '  --font-display: ' + (dt.headingFont || '"Instrument Serif", Georgia, serif') + ';\n';
        css += '  --token-base-size: ' + (dt.baseSize || 16) + 'px;\n';
        css += '  --token-scale: ' + (dt.scale || 1.25) + ';\n';
        css += '  --token-space-unit: ' + (dt.spaceUnit || 8) + 'px;\n';
        css += '  --token-radius: ' + (dt.radius || 8) + 'px;\n';
        css += '}\n\n';

        css += '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }\n';
        css += 'html { scroll-behavior: auto; }\n';
        css += 'body { font-family: var(--font-body); font-size: var(--token-base-size); background: var(--bg); color: var(--fg); overflow-x: hidden; -webkit-font-smoothing: antialiased; }\n';
        css += '.mono { font-family: "Space Mono", "SF Mono", monospace; }\n\n';

        // Preloader
        css += '.cne-preloader { position: fixed; inset: 0; z-index: 9999; background: var(--bg); display: flex; align-items: center; justify-content: center; transition: opacity 0.6s, visibility 0.6s; }\n';
        css += '.cne-preloader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }\n';
        css += '.cne-preloader-inner { text-align: center; }\n';
        css += '.cne-preloader-text { font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--fg2); display: block; margin-bottom: 1.5rem; }\n';
        css += '.cne-preloader-bar { width: 200px; height: 2px; background: var(--border); border-radius: var(--token-radius); overflow: hidden; }\n';
        css += '.cne-preloader-fill { width: 0%; height: 100%; background: var(--accent); transition: width 0.3s; }\n\n';

        // Navigation
        css += '.cne-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: calc(var(--token-space-unit) * 1.5) calc(var(--token-space-unit) * 3); display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: rgba(10,10,15,0.5); border-bottom: 1px solid var(--border); transition: transform 0.4s; }\n';
        css += '.cne-nav.hidden { transform: translateY(-100%); }\n';
        css += '.cne-nav-logo { font-size: 1.1rem; font-weight: 700; color: var(--fg); text-decoration: none; letter-spacing: -0.02em; }\n';
        css += '.cne-nav-links { display: flex; gap: calc(var(--token-space-unit) * 3); }\n';
        css += '.cne-nav-link { font-size: 0.8rem; color: var(--fg2); text-decoration: none; letter-spacing: 0.05em; text-transform: uppercase; transition: color 0.3s; }\n';
        css += '.cne-nav-link:hover { color: var(--fg); }\n';
        css += '.cne-scroll-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: transparent; }\n';
        css += '.cne-scroll-progress-fill { height: 100%; width: 0%; background: var(--accent); transition: width 0.1s linear; }\n\n';

        // Background canvas
        css += '.cne-bg-canvas { position: fixed; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; }\n\n';

        // Scenes
        css += '.cne-scenes { position: relative; z-index: 1; }\n';
        css += '.cne-scene { position: relative; width: 100%; min-height: 100vh; overflow: hidden; }\n';
        css += '.cne-element { position: absolute; will-change: transform, opacity; }\n\n';

        // Split text
        css += '.cne-char, .cne-word { display: inline-block; will-change: transform, opacity; }\n';
        css += '.cne-word { margin-right: 0.3em; }\n';
        css += '.cne-char { white-space: pre; }\n\n';

        // Footer
        css += '.cne-footer { padding: calc(var(--token-space-unit) * 4) calc(var(--token-space-unit) * 3); text-align: center; color: var(--fg2); font-size: 0.8rem; letter-spacing: 0.1em; border-top: 1px solid var(--border); }\n\n';

        // Scrollbar
        css += '::-webkit-scrollbar { width: 6px; }\n';
        css += '::-webkit-scrollbar-track { background: transparent; }\n';
        css += '::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }\n';
        css += '::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }\n\n';

        // Utility classes
        css += '/* Utility classes */\n';
        css += '.cne-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--token-radius); }\n';
        css += '.cne-gradient-text { background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }\n';
        css += '.cne-glow { box-shadow: 0 0 60px color-mix(in srgb, var(--primary) 15%, transparent), 0 0 120px color-mix(in srgb, var(--primary) 5%, transparent); }\n';
        css += '.cne-noise::before { content: ""; position: fixed; inset: 0; z-index: 9000; pointer-events: none; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E"); }\n';
        css += '.cne-element[data-arbel-edit] { transition: outline 0.15s; }\n';
        css += '.cne-element[style*="backdrop-filter"] { -webkit-backdrop-filter: inherit; }\n\n';

        // Selection highlight
        css += '/* Selection */\n';
        css += '::selection { background: ' + accent + '; color: #fff; }\n\n';

        // 3D background effect containers
        css += '/* 3D Background Effects */\n';
        css += '.cne-bg3d { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }\n';
        css += '.cne-bg3d canvas { width: 100%; height: 100%; display: block; }\n';
        css += '.cne-bg3d-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5; animation: cne-orb-float var(--orb-speed, 12s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-orb-float { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -40px) scale(1.15); } 100% { transform: translate(-20px, 30px) scale(0.95); } }\n';
        css += '.cne-bg3d-particle { position: absolute; border-radius: 50%; animation: cne-particle-drift var(--p-speed, 20s) linear infinite; }\n';
        css += '@keyframes cne-particle-drift { 0% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-10vh) scale(1); opacity: 0; } }\n';
        css += '.cne-bg3d-aurora { position: absolute; inset: 0; opacity: 0.4; background: linear-gradient(180deg, transparent 30%, var(--aurora-c1, #6c5ce7) 50%, var(--aurora-c2, #00cec9) 70%, transparent 90%); filter: blur(60px); animation: cne-aurora-shift var(--aurora-speed, 8s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-aurora-shift { 0% { transform: translateX(-20%) skewY(-2deg); opacity: 0.3; } 100% { transform: translateX(20%) skewY(2deg); opacity: 0.6; } }\n';
        css += '.cne-bg3d-mesh { position: absolute; inset: -50%; width: 200%; height: 200%; animation: cne-mesh-rotate var(--mesh-speed, 20s) linear infinite; }\n';
        css += '@keyframes cne-mesh-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\n';
        css += '.cne-bg3d-star { position: absolute; border-radius: 50%; background: #fff; animation: cne-star-twinkle var(--star-speed, 3s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-star-twinkle { 0% { opacity: 0.2; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }\n';
        css += '.cne-bg3d-grid-line { position: absolute; background: currentColor; opacity: 0.1; }\n\n';

        // Responsive — generic layout
        css += '@media (max-width: 768px) {\n';
        css += '  .cne-nav { padding: 1rem 1.2rem; }\n';
        css += '  .cne-nav-links { display: none; }\n';
        css += '  .cne-element { font-size: 0.85em; }\n';
        css += '  .cne-scene { min-height: 80vh; }\n';
        css += '}\n\n';

        // Form element styles
        css += '.cne-form-group { margin-bottom: 1rem; }\n';
        css += '.cne-form-label { display: block; font-size: 0.85rem; margin-bottom: 0.35rem; opacity: 0.7; }\n';
        css += '.cne-form-input { width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: inherit; font-family: inherit; font-size: 0.95rem; outline: none; transition: border-color 0.2s; box-sizing: border-box; }\n';
        css += '.cne-form-input:focus { border-color: ' + accent + '; }\n';
        css += '.cne-form-textarea { resize: vertical; min-height: 100px; }\n';
        css += '.cne-form-submit { display: inline-block; padding: 0.85rem 2.4rem; background: ' + accent + '; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s, transform 0.2s; }\n';
        css += '.cne-form-submit:hover { opacity: 0.88; transform: translateY(-1px); }\n\n';

        // Per-element responsive overrides
        var tabletCSS = '';
        var mobileCSS = '';
        (cfg.scenes || []).forEach(function (scene) {
            (scene.elements || []).forEach(function (el) {
                if (el.tabletStyle && Object.keys(el.tabletStyle).length) {
                    tabletCSS += '  [data-arbel-id="' + esc(el.id) + '"] {';
                    Object.keys(el.tabletStyle).forEach(function (prop) {
                        var val = String(el.tabletStyle[prop]).replace(/[<>"'`]/g, '');
                        if (!/javascript\s*:/i.test(val) && !/expression\s*\(/i.test(val)) {
                            tabletCSS += ' ' + _camelToDash(prop) + ': ' + val + ' !important;';
                        }
                    });
                    tabletCSS += ' }\n';
                }
                if (el.mobileStyle && Object.keys(el.mobileStyle).length) {
                    mobileCSS += '  [data-arbel-id="' + esc(el.id) + '"] {';
                    Object.keys(el.mobileStyle).forEach(function (prop) {
                        var val = String(el.mobileStyle[prop]).replace(/[<>"'`]/g, '');
                        if (!/javascript\s*:/i.test(val) && !/expression\s*\(/i.test(val)) {
                            mobileCSS += ' ' + _camelToDash(prop) + ': ' + val + ' !important;';
                        }
                    });
                    mobileCSS += ' }\n';
                }
            });
        });
        if (tabletCSS) css += '@media (max-width: 768px) {\n' + tabletCSS + '}\n\n';
        if (mobileCSS) css += '@media (max-width: 480px) {\n' + mobileCSS + '}\n';

        // Per-element hover styles
        var hoverCSS = '';
        (cfg.scenes || []).forEach(function (scene) {
            (scene.elements || []).forEach(function (el) {
                if (!el.hoverStyle || !Object.keys(el.hoverStyle).length) return;
                var hs = el.hoverStyle;
                var rule = '';
                var transProps = [];
                var rawDur = parseFloat(hs._duration);
                var duration = (!isNaN(rawDur) && rawDur >= 0 && rawDur <= 5) ? rawDur : 0.3;
                if (hs.opacity !== undefined && hs.opacity !== '') { var ho = Math.max(0, Math.min(100, parseFloat(hs.opacity) || 0)); rule += ' opacity: ' + (ho / 100) + ';'; transProps.push('opacity'); }
                if (hs.color) { rule += ' color: ' + hs.color + ';'; transProps.push('color'); }
                if (hs.background) { rule += ' background: ' + hs.background + ';'; transProps.push('background'); }
                if (hs.boxShadow) { rule += ' box-shadow: ' + hs.boxShadow + ';'; transProps.push('box-shadow'); }
                // Individual CSS transform properties — compose with GSAP's inline transform
                if (hs.scale !== undefined && hs.scale !== '') { rule += ' scale: ' + hs.scale + ';'; transProps.push('scale'); }
                if (hs.translateY !== undefined && hs.translateY !== '') { rule += ' translate: 0 ' + hs.translateY + 'px;'; transProps.push('translate'); }
                if (hs.rotate !== undefined && hs.rotate !== '') { rule += ' rotate: ' + hs.rotate + 'deg;'; transProps.push('rotate'); }
                if (rule) {
                    // Add property-specific transitions to avoid conflicting with GSAP scroll transforms
                    var transStr = transProps.map(function (p) { return p + ' ' + duration + 's ease'; }).join(', ');
                    hoverCSS += '[data-arbel-id="' + esc(el.id) + '"] { transition: ' + transStr + '; }\n';
                    hoverCSS += '[data-arbel-id="' + esc(el.id) + '"]:hover {' + rule + ' }\n';
                }
            });
        });
        if (hoverCSS) css += '\n/* Hover States */\n' + hoverCSS;

        // Custom CSS injection
        if (cfg.editorOverrides && cfg.editorOverrides.customCSS) {
            css += '\n/* Custom CSS */\n' + cfg.editorOverrides.customCSS + '\n';
        }

        return css;
    }

    /* ─── Cinema JS (ScrollTrigger engine) ─── */
    function _buildCinemaJS(cfg) {
        var js = '/* Cinematic Engine — Generated by Arbel */\n';
        js += '(function(){\n';
        js += '"use strict";\n\n';

        // Preloader
        js += '/* Preloader */\n';
        js += 'var preloader = document.getElementById("preloader");\n';
        js += 'var fill = preloader ? preloader.querySelector(".cne-preloader-fill") : null;\n';
        js += 'var loadPct = 0;\n';
        js += 'var loadTimer = setInterval(function(){\n';
        js += '  loadPct += Math.random() * 20 + 5;\n';
        js += '  if(loadPct > 100) loadPct = 100;\n';
        js += '  if(fill) fill.style.width = loadPct + "%";\n';
        js += '  if(loadPct >= 100){ clearInterval(loadTimer); setTimeout(function(){ if(preloader) preloader.classList.add("hidden"); initCinema(); },400); }\n';
        js += '}, 150);\n\n';

        // Smooth scroll
        js += '/* Lenis smooth scroll */\n';
        js += 'var lenis;\n';
        js += 'function initLenis(){\n';
        js += '  if(window.innerWidth < 768) return;\n';
        js += '  lenis = new Lenis({ duration: 1.2, easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });\n';
        js += '  lenis.on("scroll", ScrollTrigger.update);\n';
        js += '  gsap.ticker.add(function(time){ lenis.raf(time * 1000); });\n';
        js += '  gsap.ticker.lagSmoothing(0);\n';
        js += '}\n\n';

        // Split text utility
        js += '/* Split text into chars */\n';
        js += 'function splitText(el){\n';
        js += '  var text = el.textContent;\n';
        js += '  var words = text.split(/\\s+/);\n';
        js += '  el.innerHTML = "";\n';
        js += '  words.forEach(function(word, wi){\n';
        js += '    var wSpan = document.createElement("span");\n';
        js += '    wSpan.className = "cne-word";\n';
        js += '    word.split("").forEach(function(ch){\n';
        js += '      var cSpan = document.createElement("span");\n';
        js += '      cSpan.className = "cne-char";\n';
        js += '      cSpan.textContent = ch;\n';
        js += '      wSpan.appendChild(cSpan);\n';
        js += '    });\n';
        js += '    el.appendChild(wSpan);\n';
        js += '  });\n';
        js += '  return el.querySelectorAll(".cne-char");\n';
        js += '}\n\n';

        // Scroll progress
        js += '/* Scroll progress bar */\n';
        js += 'function initScrollProgress(){\n';
        js += '  var bar = document.getElementById("scrollProgress");\n';
        js += '  if(!bar) return;\n';
        js += '  window.addEventListener("scroll", function(){\n';
        js += '    var pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;\n';
        js += '    bar.style.width = Math.min(pct, 100) + "%";\n';
        js += '  });\n';
        js += '}\n\n';

        // Cubic-bezier helper for GSAP
        js += '/* Cubic-bezier to GSAP ease */\n';
        js += 'function parseBezierEase(str){\n';
        js += '  if(!str || str.indexOf("cubic-bezier") !== 0) return str;\n';
        js += '  var m = str.match(/cubic-bezier\\(([^)]+)\\)/);\n';
        js += '  if(!m) return "none";\n';
        js += '  var p = m[1].split(",").map(Number);\n';
        js += '  return function(t){\n';
        js += '    var cx=3*p[0],bx=3*(p[2]-p[0])-cx,ax=1-cx-bx;\n';
        js += '    var cy=3*p[1],by=3*(p[3]-p[1])-cy,ay=1-cy-by;\n';
        js += '    var lo=0,hi=1,mid;\n';
        js += '    for(var i=0;i<16;i++){mid=(lo+hi)/2;var x=((ax*mid+bx)*mid+cx)*mid;if(x<t)lo=mid;else hi=mid;}\n';
        js += '    return((ay*mid+by)*mid+cy)*mid;\n';
        js += '  };\n';
        js += '}\n\n';

        // Main cinema init
        js += '/* Init cinema engine */\n';
        js += 'function initCinema(){\n';
        js += '  gsap.registerPlugin(ScrollTrigger);\n';
        js += '  initLenis();\n';
        js += '  initScrollProgress();\n\n';

        js += '  var scenes = document.querySelectorAll(".cne-scene");\n';
        js += '  scenes.forEach(function(scene){\n';
        js += '    var shouldPin = scene.dataset.pin === "true";\n';
        js += '    var duration = parseInt(scene.dataset.duration) || 100;\n\n';

        // Pin the scene
        js += '    if(shouldPin){\n';
        js += '      ScrollTrigger.create({\n';
        js += '        trigger: scene,\n';
        js += '        start: "top top",\n';
        js += '        end: "+=" + (duration) + "%",\n';
        js += '        pin: true,\n';
        js += '        pinSpacing: true,\n';
        js += '        anticipatePin: 1\n';
        js += '      });\n';
        js += '    }\n\n';

        // Animate elements within each scene
        js += '    var elems = scene.querySelectorAll("[data-scroll]");\n';
        js += '    elems.forEach(function(el){\n';
        js += '      var sd;\n';
        js += '      try { sd = JSON.parse(el.dataset.scroll); } catch(e){ return; }\n';
        js += '      if(!sd) return;\n\n';

        // Split text handling
        js += '      /* Split text if flagged */\n';
        js += '      var isSplit = el.dataset.splitText === "true";\n';
        js += '      var chars;\n';
        js += '      if(isSplit){ chars = splitText(el); }\n\n';

        // Build GSAP timeline
        js += '      var tl = gsap.timeline({\n';
        js += '        scrollTrigger: {\n';
        js += '          trigger: scene,\n';
        js += '          start: "top top",\n';
        js += '          end: "+=" + duration + "%",\n';
        js += '          scrub: 1\n';
        js += '        }\n';
        js += '      });\n\n';

        // Handle multi-keyframe scroll animations
        js += '      var startPct = sd.start || 0;\n';
        js += '      var endPct = sd.end || 1;\n';
        js += '      var easeVal = parseBezierEase(sd.ease || "none");\n\n';

        js += '      /* Build from/to tweens for each property */\n';
        js += '      var props = ["opacity","x","y","scale","rotation"];\n';
        js += '      props.forEach(function(prop){\n';
        js += '        if(!sd[prop]) return;\n';
        js += '        var vals = Array.isArray(sd[prop]) ? sd[prop] : [sd[prop]];\n';
        js += '        if(vals.length < 2) return;\n\n';

        js += '        var target = isSplit ? chars : el;\n';
        js += '        var segLen = (endPct - startPct) / (vals.length - 1);\n\n';

        js += '        for(var i = 0; i < vals.length - 1; i++){\n';
        js += '          var from = {}; from[prop] = vals[i];\n';
        js += '          var to = {}; to[prop] = vals[i+1];\n';
        js += '          to.ease = easeVal;\n';
        js += '          if(isSplit) to.stagger = 0.02;\n';
        js += '          var pos = startPct + (segLen * i);\n';
        js += '          tl.fromTo(target, from, to, pos);\n';
        js += '        }\n';
        js += '      });\n\n';

        // String-interpolated & special properties (blur, clipPath, 3D)
        js += '      /* Special properties (blur, clip-path, 3D) */\n';
        js += '      var specialProps = ["blur","clipPath","rotateX","rotateY","skewX","skewY"];\n';
        js += '      specialProps.forEach(function(prop){\n';
        js += '        if(!sd[prop]) return;\n';
        js += '        var vals = Array.isArray(sd[prop]) ? sd[prop] : [sd[prop]];\n';
        js += '        if(vals.length < 2) return;\n\n';
        js += '        var target = isSplit ? chars : el;\n';
        js += '        var segLen = (endPct - startPct) / (vals.length - 1);\n\n';
        js += '        for(var i = 0; i < vals.length - 1; i++){\n';
        js += '          var from = {}, to = {};\n';
        js += '          if(prop === "blur"){\n';
        js += '            from.filter = "blur(" + vals[i] + "px)";\n';
        js += '            to.filter = "blur(" + vals[i+1] + "px)";\n';
        js += '          } else if(prop === "clipPath"){\n';
        js += '            from.clipPath = vals[i];\n';
        js += '            to.clipPath = vals[i+1];\n';
        js += '          } else {\n';
        js += '            from[prop] = vals[i];\n';
        js += '            to[prop] = vals[i+1];\n';
        js += '          }\n';
        js += '          to.ease = easeVal;\n';
        js += '          if(isSplit) to.stagger = 0.02;\n';
        js += '          var pos = startPct + (segLen * i);\n';
        js += '          tl.fromTo(target, from, to, pos);\n';
        js += '        }\n';
        js += '      });\n';
        js += '    });\n\n';

        // Parallax elements
        js += '    /* Parallax */\n';
        js += '    var pxEls = scene.querySelectorAll("[data-parallax]");\n';
        js += '    pxEls.forEach(function(pxEl){\n';
        js += '      var depth = parseFloat(pxEl.dataset.parallax) || 1;\n';
        js += '      gsap.to(pxEl, {\n';
        js += '        y: (depth - 1) * -200,\n';
        js += '        ease: "none",\n';
        js += '        scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true }\n';
        js += '      });\n';
        js += '    });\n';
        js += '  });\n\n';

        // 3D Background effects
        js += '  /* 3D Background Effects */\n';
        js += '  document.querySelectorAll(".cne-bg3d").forEach(function(container){\n';
        js += '    var type = container.dataset.bg3d;\n';
        js += '    var c1 = container.dataset.color1 || "#6c5ce7";\n';
        js += '    var c2 = container.dataset.color2 || "#00cec9";\n';
        js += '    var intensity = parseInt(container.dataset.intensity) || 5;\n';
        js += '    var speed = container.dataset.speed || "medium";\n';
        js += '    var speedMs = speed === "slow" ? 20 : speed === "fast" ? 6 : 12;\n\n';

        js += '    if(type === "gradient-orbs"){\n';
        js += '      for(var i = 0; i < Math.min(intensity, 8); i++){\n';
        js += '        var orb = document.createElement("div");\n';
        js += '        orb.className = "cne-bg3d-orb";\n';
        js += '        var size = 200 + Math.random() * 300;\n';
        js += '        orb.style.width = size + "px"; orb.style.height = size + "px";\n';
        js += '        orb.style.background = i % 2 === 0 ? c1 : c2;\n';
        js += '        orb.style.top = Math.random() * 80 + "%";\n';
        js += '        orb.style.left = Math.random() * 80 + "%";\n';
        js += '        orb.style.setProperty("--orb-speed", (speedMs + Math.random() * 8) + "s");\n';
        js += '        orb.style.animationDelay = -(Math.random() * speedMs) + "s";\n';
        js += '        container.appendChild(orb);\n';
        js += '      }\n';
        js += '    }\n\n';

        js += '    if(type === "particle-field"){\n';
        js += '      var count = intensity * 8;\n';
        js += '      for(var j = 0; j < Math.min(count, 60); j++){\n';
        js += '        var p = document.createElement("div");\n';
        js += '        p.className = "cne-bg3d-particle";\n';
        js += '        var pSize = 2 + Math.random() * 4;\n';
        js += '        p.style.width = pSize + "px"; p.style.height = pSize + "px";\n';
        js += '        p.style.background = Math.random() > 0.5 ? c1 : c2;\n';
        js += '        p.style.left = Math.random() * 100 + "%";\n';
        js += '        p.style.opacity = 0.3 + Math.random() * 0.5;\n';
        js += '        p.style.setProperty("--p-speed", (speedMs + Math.random() * 15) + "s");\n';
        js += '        p.style.animationDelay = -(Math.random() * 30) + "s";\n';
        js += '        container.appendChild(p);\n';
        js += '      }\n';
        js += '    }\n\n';

        js += '    if(type === "aurora"){\n';
        js += '      for(var a = 0; a < Math.min(intensity, 5); a++){\n';
        js += '        var au = document.createElement("div");\n';
        js += '        au.className = "cne-bg3d-aurora";\n';
        js += '        au.style.setProperty("--aurora-c1", c1);\n';
        js += '        au.style.setProperty("--aurora-c2", c2);\n';
        js += '        au.style.setProperty("--aurora-speed", (speedMs + a * 3) + "s");\n';
        js += '        au.style.animationDelay = -(a * 2) + "s";\n';
        js += '        au.style.opacity = 0.2 + (a * 0.1);\n';
        js += '        container.appendChild(au);\n';
        js += '      }\n';
        js += '    }\n\n';

        js += '    if(type === "mesh-gradient"){\n';
        js += '      var mesh = document.createElement("div");\n';
        js += '      mesh.className = "cne-bg3d-mesh";\n';
        js += '      var stops = "radial-gradient(circle at 20% 30%, " + c1 + " 0%, transparent 50%),radial-gradient(circle at 80% 70%, " + c2 + " 0%, transparent 50%),radial-gradient(circle at 50% 50%, " + c1 + " 0%, transparent 70%)";\n';
        js += '      mesh.style.background = stops;\n';
        js += '      mesh.style.opacity = Math.min(intensity * 0.08, 0.6);\n';
        js += '      mesh.style.setProperty("--mesh-speed", speedMs * 3 + "s");\n';
        js += '      container.appendChild(mesh);\n';
        js += '    }\n\n';

        js += '    if(type === "noise-fog"){\n';
        js += '      for(var f = 0; f < Math.min(intensity, 6); f++){\n';
        js += '        var fog = document.createElement("div");\n';
        js += '        fog.className = "cne-bg3d-orb";\n';
        js += '        var fSize = 300 + Math.random() * 500;\n';
        js += '        fog.style.width = fSize + "px"; fog.style.height = fSize + "px";\n';
        js += '        fog.style.background = f % 2 === 0 ? c1 : c2;\n';
        js += '        fog.style.filter = "blur(" + (100 + Math.random() * 80) + "px)";\n';
        js += '        fog.style.opacity = 0.15 + Math.random() * 0.15;\n';
        js += '        fog.style.top = Math.random() * 100 + "%";\n';
        js += '        fog.style.left = Math.random() * 100 + "%";\n';
        js += '        fog.style.setProperty("--orb-speed", (speedMs * 2 + Math.random() * 10) + "s");\n';
        js += '        fog.style.animationDelay = -(Math.random() * 20) + "s";\n';
        js += '        container.appendChild(fog);\n';
        js += '      }\n';
        js += '    }\n\n';

        js += '    if(type === "starfield"){\n';
        js += '      var starCount = intensity * 15;\n';
        js += '      for(var s = 0; s < Math.min(starCount, 100); s++){\n';
        js += '        var star = document.createElement("div");\n';
        js += '        star.className = "cne-bg3d-star";\n';
        js += '        var sSize = 1 + Math.random() * 3;\n';
        js += '        star.style.width = sSize + "px"; star.style.height = sSize + "px";\n';
        js += '        star.style.top = Math.random() * 100 + "%";\n';
        js += '        star.style.left = Math.random() * 100 + "%";\n';
        js += '        star.style.setProperty("--star-speed", (speedMs * 0.3 + Math.random() * 3) + "s");\n';
        js += '        star.style.animationDelay = -(Math.random() * 5) + "s";\n';
        js += '        container.appendChild(star);\n';
        js += '      }\n';
        js += '    }\n\n';

        js += '    if(type === "wave-grid"){\n';
        js += '      var cols = 20; var rows = 12;\n';
        js += '      for(var gy = 0; gy < rows; gy++){\n';
        js += '        var line = document.createElement("div");\n';
        js += '        line.className = "cne-bg3d-grid-line";\n';
        js += '        line.style.width = "100%"; line.style.height = "1px";\n';
        js += '        line.style.top = (gy / rows * 100) + "%";\n';
        js += '        line.style.left = "0";\n';
        js += '        line.style.color = c1;\n';
        js += '        container.appendChild(line);\n';
        js += '      }\n';
        js += '      for(var gx = 0; gx < cols; gx++){\n';
        js += '        var vline = document.createElement("div");\n';
        js += '        vline.className = "cne-bg3d-grid-line";\n';
        js += '        vline.style.width = "1px"; vline.style.height = "100%";\n';
        js += '        vline.style.top = "0";\n';
        js += '        vline.style.left = (gx / cols * 100) + "%";\n';
        js += '        vline.style.color = c2;\n';
        js += '        container.appendChild(vline);\n';
        js += '      }\n';
        js += '      gsap.to(container.querySelectorAll(".cne-bg3d-grid-line"), {\n';
        js += '        opacity: 0.3,\n';
        js += '        duration: speedMs * 0.5,\n';
        js += '        stagger: { each: 0.05, repeat: -1, yoyo: true },\n';
        js += '        ease: "sine.inOut"\n';
        js += '      });\n';
        js += '    }\n';
        js += '  });\n\n';

        // Nav hide/show
        js += '  /* Nav auto-hide on scroll */\n';
        js += '  var nav = document.querySelector(".cne-nav");\n';
        js += '  if(nav){\n';
        js += '    var lastY = 0;\n';
        js += '    window.addEventListener("scroll", function(){\n';
        js += '      var y = window.scrollY;\n';
        js += '      if(y > lastY && y > 100) nav.classList.add("hidden");\n';
        js += '      else nav.classList.remove("hidden");\n';
        js += '      lastY = y;\n';
        js += '    });\n';
        js += '  }\n';

        js += '}\n';
        js += '})();\n';

        return js;
    }

    /* ─── Main JS (cursor, interactions) ─── */
    function _buildMainJS(cfg) {
        var js = '/* Main interactions — Generated by Arbel */\n';
        js += '(function(){\n';
        js += '"use strict";\n\n';

        // Custom cursor
        js += '/* Custom cursor */\n';
        js += 'var cursor = document.createElement("div");\n';
        js += 'cursor.className = "cne-cursor";\n';
        js += 'document.body.appendChild(cursor);\n';
        js += 'var cx = 0, cy = 0, tx = 0, ty = 0;\n';
        js += 'document.addEventListener("mousemove", function(e){ tx = e.clientX; ty = e.clientY; });\n';
        js += '(function tick(){ cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15; cursor.style.transform = "translate(" + cx + "px," + cy + "px)"; requestAnimationFrame(tick); })();\n\n';

        // Cursor style inject
        js += 'var cursorCSS = document.createElement("style");\n';
        js += 'cursorCSS.textContent = ".cne-cursor{position:fixed;top:-10px;left:-10px;width:20px;height:20px;border:1.5px solid rgba(255,255,255,0.5);border-radius:50%;pointer-events:none;z-index:9998;mix-blend-mode:difference;transition:width 0.3s,height 0.3s,border-color 0.3s;will-change:transform} a:hover~.cne-cursor,.cne-cursor.hover{width:44px;height:44px;border-color:' + (cfg.accent || '#6C5CE7') + '}";\n';
        js += 'document.head.appendChild(cursorCSS);\n\n';

        // Link hover effect on cursor
        js += 'document.querySelectorAll("a, button").forEach(function(el){\n';
        js += '  el.addEventListener("mouseenter", function(){ cursor.classList.add("hover"); });\n';
        js += '  el.addEventListener("mouseleave", function(){ cursor.classList.remove("hover"); });\n';
        js += '});\n';

        js += '})();\n';
        return js;
    }

    /* ─── Shader bridge (reuses classic compiler) ─── */
    function _buildShaderBridge(cfg) {
        // Delegate to classic compiler's shader builder
        var frag = ArbelCompiler.getShaderFragment(cfg.style);
        if (!frag) return '/* No shader */';

        var js = '/* WebGL Background — Generated by Arbel */\n';
        js += '(function(){\n';
        js += '"use strict";\n';
        js += 'var canvas = document.getElementById("bgCanvas");\n';
        js += 'if(!canvas || !window.THREE) return;\n\n';
        js += 'var scene = new THREE.Scene();\n';
        js += 'var camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);\n';
        js += 'var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });\n';
        js += 'renderer.setSize(window.innerWidth, window.innerHeight);\n';
        js += 'renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));\n\n';

        js += 'var uniforms = { uTime: {value:0}, uMouse: {value: new THREE.Vector2(0.5,0.5)}, uRes: {value: new THREE.Vector2(window.innerWidth, window.innerHeight)} };\n\n';

        js += 'var snoise = `' + (frag.snoise || '') + '`;\n';
        js += 'var vertShader = "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";\n';
        js += 'var fragShader = "precision mediump float;\\nuniform float uTime;\\nuniform vec2 uMouse;\\nuniform vec2 uRes;\\nvarying vec2 vUv;\\n" + snoise + "\\nvoid main(){\\n' + (frag.core || '').replace(/\n/g, '\\n').replace(/"/g, '\\"') + '\\n}";\n\n';

        js += 'var geo = new THREE.PlaneGeometry(2,2);\n';
        js += 'var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vertShader, fragmentShader: fragShader });\n';
        js += 'scene.add(new THREE.Mesh(geo, mat));\n\n';

        js += 'document.addEventListener("mousemove", function(e){ uniforms.uMouse.value.set(e.clientX/window.innerWidth, 1.0 - e.clientY/window.innerHeight); });\n';
        js += 'window.addEventListener("resize", function(){ renderer.setSize(window.innerWidth, window.innerHeight); uniforms.uRes.value.set(window.innerWidth, window.innerHeight); });\n\n';

        js += 'function tick(){ uniforms.uTime.value += 0.01; renderer.render(scene, camera); requestAnimationFrame(tick); }\n';
        js += 'tick();\n';
        js += '})();\n';

        return js;
    }

    /* ─── Readme ─── */
    function _buildReadme(cfg) {
        var md = '# ' + esc(cfg.brandName) + '\n\n';
        md += '> ' + esc(cfg.tagline || 'A cinematic website built with Arbel') + '\n\n';
        md += '## Built With\n\n';
        md += '- **Arbel Generator** — Cinematic Mode\n';
        md += '- **GSAP** + **ScrollTrigger** — Scroll-driven animations\n';
        md += '- **Lenis** — Smooth scrolling\n';
        md += '- **Three.js** — WebGL background\n\n';
        md += '## Scenes\n\n';
        (cfg.scenes || []).forEach(function (s, i) {
            md += (i + 1) + '. **' + esc(s.name) + '** — ' + (s.elements || []).length + ' elements\n';
        });
        md += '\n---\n\nGenerated by [Arbel](https://arbel.live)\n';
        return md;
    }

    /* ─── Override applicator (same as classic) ─── */
    function _applyOverrides(html, overrides) {
        if (!overrides) return html;
        Object.keys(overrides).forEach(function (id) {
            var ov = overrides[id];
            if (ov.text !== undefined) {
                var re = new RegExp('(data-arbel-id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>)[^<]*', 'g');
                html = html.replace(re, function (match, prefix) {
                    var div = document.createElement('div');
                    div.appendChild(document.createTextNode(ov.text));
                    return prefix + div.innerHTML;
                });
            }
        });
        return html;
    }

    /* ─── Utilities ─── */
    function _camelToDash(str) {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    function _lighten(hex, pct) {
        var num = parseInt(hex.replace('#', ''), 16);
        var r = Math.min(255, (num >> 16) + Math.round(255 * pct / 100));
        var g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * pct / 100));
        var b = Math.min(255, (num & 0xff) + Math.round(255 * pct / 100));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    /* ─── Public API ─── */
    return {
        compile: compile,
        getSceneTemplates: function () {
            var out = [];
            Object.keys(SCENE_TEMPLATES).forEach(function (k) {
                out.push({ id: k, label: SCENE_TEMPLATES[k].label, desc: SCENE_TEMPLATES[k].desc });
            });
            return out;
        },
        getAnimationPresets: function () {
            var out = [];
            Object.keys(ANIMATION_PRESETS).forEach(function (k) {
                out.push({ id: k, preset: ANIMATION_PRESETS[k] });
            });
            return out;
        },
        getPreset: function (id) {
            return ANIMATION_PRESETS[id] ? JSON.parse(JSON.stringify(ANIMATION_PRESETS[id])) : null;
        },
        createScene: createScene
    };
})();
