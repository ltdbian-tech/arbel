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
        if (/^data:/i.test(s) && !/^data:(image|video)\//i.test(s)) return '';
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

    /**
     * Extract inline data:video URLs from compiled files to separate asset files.
     * Call this for final export/ZIP — NOT for live preview (blob iframes can't
     * resolve relative asset paths).
     */
    function _extractAssets(files) {
        if (!files || !files['index.html']) return files;
        var html = files['index.html'];
        var vidIdx = 0;
        html = html.replace(/src="(data:video\/([a-z0-9]+);base64,[A-Za-z0-9+\/=]+)"/g, function (match, dataUrl, ext) {
            var assetName = 'assets/video-' + vidIdx + '.' + (ext === 'webm' ? 'webm' : ext === 'ogg' ? 'ogg' : 'mp4');
            files[assetName] = dataUrl;
            vidIdx++;
            return 'src="' + assetName + '"';
        });

        // Extract reveal layer images (background-image data URLs)
        var imgIdx = 0;
        html = html.replace(/background-image:url\('(data:image\/([a-z0-9+]+);base64,[A-Za-z0-9+\/=]+)'\)/g, function (match, dataUrl, ext) {
            var fext = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : ext === 'gif' ? 'gif' : ext === 'svg+xml' ? 'svg' : 'jpg';
            var assetName = 'assets/reveal/img-' + imgIdx + '.' + fext;
            files[assetName] = dataUrl;
            imgIdx++;
            return "background-image:url('" + assetName + "')";
        });

        files['index.html'] = html;
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

        // Helper: slugify scene name for anchor IDs
        function slugify(str) {
            return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }

        // Build scene-name → slug map for internal anchor links
        var sceneSlugMap = {};
        scenes.forEach(function (scene, i) {
            var slug = slugify(scene.name || 'scene-' + (i + 1));
            sceneSlugMap[scene.name] = slug;
            sceneSlugMap[(scene.name || '').toLowerCase()] = slug;
        });

        // Navigation
        if (!cfg.nav || cfg.nav.show !== false) {
            html += '<nav class="cne-nav" data-arbel-id="site-nav">\n';
            html += '  <a href="#" class="cne-nav-logo" data-arbel-id="site-logo" data-arbel-edit="text">' + esc(cfg.brandName) + '</a>\n';
            html += '  <div class="cne-nav-links">\n';
            if (cfg.nav && cfg.nav.links) {
                cfg.nav.links.forEach(function (link) {
                    var href = link.href || '#';
                    // Resolve scene name references to anchor slugs
                    var lowerHref = href.replace(/^#/, '');
                    if (sceneSlugMap[lowerHref] || sceneSlugMap[lowerHref.toLowerCase()]) {
                        href = '#' + (sceneSlugMap[lowerHref] || sceneSlugMap[lowerHref.toLowerCase()]);
                    }
                    var linkClass = link.variant === 'button' ? 'cne-nav-link cne-nav-cta' : 'cne-nav-link';
                    html += '    <a href="' + escHref(href) + '" class="' + linkClass + '" data-arbel-edit="text">' + esc(link.text) + '</a>\n';
                });
            }
            html += '  </div>\n';
            html += '  <div class="cne-scroll-progress"><div class="cne-scroll-progress-fill" id="scrollProgress"></div></div>\n';
            html += '</nav>\n\n';
        }

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

            // Pre-compute reveal layer z-indexes for the section tag
            var revealVars = '';
            var revealSceneAttrs = '';
            if (scene.revealLayers && scene.revealLayers.length >= 1 && scene.revealEffect) {
                var rEff = scene.revealEffect;
                var rOrder = rEff.layerOrder;
                if (rOrder) {
                    var cZ = rOrder.indexOf('content') + 1;
                    var mZ = 0;
                    rOrder.forEach(function (lid, zi) {
                        if (lid !== 'bg' && lid !== 'content') { if (zi + 1 > mZ) mZ = zi + 1; }
                    });
                    revealVars = '--content-z:' + cZ + ';--reveal-z:' + (mZ || 2) + ';';
                }
                revealSceneAttrs = ' data-reveal-invert="' + (rEff.invert ? 'true' : 'false') + '"';
            }

            html += '  <section class="cne-scene"';
            html += ' id="' + esc(slugify(scene.name || 'scene-' + (i + 1))) + '"';
            html += ' data-scene-id="' + esc(scene.id) + '"';
            html += ' data-scene-index="' + i + '"';
            html += ' data-pin="' + (scene.pin !== false ? 'true' : 'false') + '"';
            html += ' data-duration="' + (scene.duration || 100) + '"';
            html += revealSceneAttrs;
            if (sceneBg || revealVars) html += ' style="' + sceneBg + revealVars + '"';
            html += '>\n';

            // Scene background video
            if (scene.bgVideo) {
                var safeBgVid = scene.bgVideo.replace(/[\\"'<>()\n\r]/g, '').replace(/javascript\s*:/gi, '');
                if (/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:video\/)/i.test(safeBgVid)) {
                    html += '    <video class="cne-scene-bgvid" autoplay loop muted playsinline';
                    html += ' src="' + escHref(safeBgVid) + '"';
                    html += ' style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none"';
                    html += '></video>\n';
                }
            }

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
                // Vignette overlay to ensure content readability over 3D backgrounds
                html += '    <div class="cne-bg3d-vignette" aria-hidden="true"></div>\n';
            }

            // Spline 3D embed
            if (scene.splineUrl && /^https:\/\/(prod|my|viewer)\.spline\.design\//.test(scene.splineUrl)) {
                html += '    <iframe class="cne-spline-embed" src="' + escHref(scene.splineUrl) + '"';
                html += ' style="position:absolute;inset:0;width:100%;height:100%;border:none;z-index:0;pointer-events:none"';
                html += ' loading="lazy" title="3D Scene" aria-hidden="true"></iframe>\n';
            }

            // Hover Reveal Layers — scene bg acts as implicit base, uploaded layers are reveal tops
            if (scene.revealLayers && scene.revealLayers.length >= 1 && scene.revealEffect) {
                var eff = scene.revealEffect;
                // Filter visible layers only
                var visibleRevealLayers = scene.revealLayers.filter(function (l) { return l.visible !== false; });
                if (visibleRevealLayers.length >= 1) {
                    // Use layerOrder for z-index assignment if available
                    var layerOrder = eff.layerOrder;
                    var rlSorted;
                    if (layerOrder) {
                        rlSorted = [];
                        layerOrder.forEach(function (lid) {
                            if (lid === 'bg' || lid === 'content') return;
                            for (var ri = 0; ri < visibleRevealLayers.length; ri++) {
                                if (visibleRevealLayers[ri].id === lid) { rlSorted.push(visibleRevealLayers[ri]); break; }
                            }
                        });
                    } else {
                        rlSorted = visibleRevealLayers.slice().sort(function (a, b) { return a.order - b.order; });
                    }

                    html += '    <div class="cne-reveal-container" data-reveal-type="' + esc(eff.type) + '"';
                    html += ' data-reveal-radius="' + (parseInt(eff.radius) || 120) + '"';
                    html += ' data-reveal-feather="' + (parseInt(eff.feather) || 40) + '"';
                    html += ' data-reveal-speed="' + (parseFloat(eff.speed) || 0.15) + '"';
                    html += ' data-reveal-invert="' + (eff.invert ? 'true' : 'false') + '"';
                    html += ' data-content-masked="' + (eff.contentMasked ? 'true' : 'false') + '"';
                    html += ' data-bg-masked="' + (eff.bgMasked ? 'true' : 'false') + '"';
                    html += '>\n';
                    rlSorted.forEach(function (layer, li) {
                        var isMasked = layer.masked !== false;
                        var cls = 'cne-reveal-layer' + (isMasked ? ' cne-reveal-top' : '');
                        var src = layer.dataUrl;
                        if (layer.mediaType === 'video') {
                            html += '      <div class="' + cls + '" data-layer="' + li + '">';
                            html += '<video autoplay loop muted playsinline src="' + esc(src) + '"';
                            html += ' style="width:100%;height:100%;object-fit:cover"></video>';
                            html += '</div>\n';
                        } else {
                            html += '      <div class="' + cls + '" data-layer="' + li + '"';
                            html += ' style="background-image:url(\'' + esc(src) + '\');background-size:cover;background-position:center">';
                            html += '</div>\n';
                        }
                    });
                    html += '    </div>\n';
                }
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
                    // Element background video
                    var elBgVidHtml = '';
                    if (el.bgVideo) {
                        var safeElVid = el.bgVideo.replace(/[\\"'<>()\n\r]/g, '').replace(/javascript\s*:/gi, '');
                        if (/^(https?:\/\/|\/\/|\/|\.\/|\.\.\/|data:video\/)/i.test(safeElVid)) {
                            elBgVidHtml = '<video class="cne-el-bgvid" autoplay loop muted playsinline src="' + escHref(safeElVid) + '"></video>';
                        }
                    }
                    // Lottie animation embed
                    if (el.lottieUrl && /^https?:\/\//.test(el.lottieUrl)) {
                        var safeLottie = escHref(el.lottieUrl);
                        html += '>' + elBgVidHtml + '<dotlottie-player src="' + safeLottie + '" background="transparent" speed="1" loop autoplay style="width:100%;height:100%"></dotlottie-player></' + tag + '>\n';
                    // SVG illustration
                    } else if (el.svgContent) {
                        // Sanitize SVG: strip scripts and event handlers
                        var safeSvg = el.svgContent
                            .replace(/<script[\s\S]*?<\/script>/gi, '')
                            .replace(/\bon\w+\s*=/gi, 'data-removed=');
                        html += '>' + elBgVidHtml + safeSvg + '</' + tag + '>\n';
                    // iFrame embed (YouTube, Vimeo, etc.)
                    } else if (el.embedUrl && /^https:\/\//.test(el.embedUrl)) {
                        var safeEmbed = escHref(el.embedUrl);
                        html += '>' + elBgVidHtml + '<iframe src="' + safeEmbed + '" style="width:100%;height:100%;border:none" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></' + tag + '>\n';
                    // For non-anchor elements with href, wrap in anchor
                    } else if (el.href && el.href !== '#' && el.href !== '') {
                        // Resolve scene name references to anchor slugs
                        var elHref = el.href;
                        var elHrefKey = elHref.replace(/^#/, '');
                        if (sceneSlugMap[elHrefKey] || sceneSlugMap[elHrefKey.toLowerCase()]) {
                            elHref = '#' + (sceneSlugMap[elHrefKey] || sceneSlugMap[elHrefKey.toLowerCase()]);
                        }
                        var anchorHref = escHref(elHref);
                        var anchorAttrs = ' href="' + anchorHref + '"';
                        if (el.linkNewTab) anchorAttrs += ' target="_blank" rel="noopener noreferrer"';
                        anchorAttrs += ' style="text-decoration:none;color:inherit;display:contents"';
                        html += '>' + elBgVidHtml + esc(el.text) + '</' + tag + '>\n';
                        // Wrap: inject opening <a> before the element, closing </a> after
                        var elOpen = '    <' + tag + ' class="cne-element"';
                        var lastIdx = html.lastIndexOf(elOpen);
                        if (lastIdx >= 0) {
                            html = html.substring(0, lastIdx) + '    <a' + anchorAttrs + '>\n    ' + html.substring(lastIdx) + '    </a>\n';
                        }
                    } else {
                        html += '>' + elBgVidHtml + esc(el.text) + '</' + tag + '>\n';
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
        css += '.cne-nav-links { display: flex; gap: calc(var(--token-space-unit) * 3); align-items: center; }\n';
        css += '.cne-nav-link { font-size: 0.8rem; color: var(--fg2); text-decoration: none; letter-spacing: 0.05em; text-transform: uppercase; transition: color 0.3s; }\n';
        css += '.cne-nav-link:hover { color: var(--fg); }\n';
        css += '.cne-nav-cta { padding: 0.5rem 1.4rem; border: 1px solid var(--fg2); border-radius: 50px; color: var(--fg); transition: background 0.3s, color 0.3s, border-color 0.3s; }\n';
        css += '.cne-nav-cta:hover { background: var(--fg); color: var(--bg); border-color: var(--fg); }\n';
        css += '.cne-scroll-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: transparent; }\n';
        css += '.cne-scroll-progress-fill { height: 100%; width: 0%; background: var(--accent); transition: width 0.1s linear; }\n\n';

        // Background canvas
        css += '.cne-bg-canvas { position: fixed; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; }\n\n';

        // Scenes
        css += '.cne-scenes { position: relative; z-index: 1; }\n';
        css += '.cne-scene { position: relative; width: 100%; min-height: 100vh; overflow: hidden; }\n';
        css += '.cne-element { position: absolute; will-change: transform, opacity; z-index: var(--content-z, 1); }\n';
        css += '.cne-scene-bgvid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; pointer-events: none; }\n';
        css += '.cne-el-bgvid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; pointer-events: none; border-radius: inherit; }\n';
        css += '@media (max-width: 768px) { .cne-scene-bgvid, .cne-el-bgvid { display: none; } }\n\n';

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
        css += '.cne-bg3d { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; opacity: 0.55; }\n';
        css += '.cne-bg3d canvas { width: 100%; height: 100%; display: block; }\n';
        css += '.cne-bg3d-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.35; animation: cne-orb-float var(--orb-speed, 12s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-orb-float { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -40px) scale(1.15); } 100% { transform: translate(-20px, 30px) scale(0.95); } }\n';
        css += '.cne-bg3d-particle { position: absolute; border-radius: 50%; animation: cne-particle-drift var(--p-speed, 20s) linear infinite; }\n';
        css += '@keyframes cne-particle-drift { 0% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-10vh) scale(1); opacity: 0; } }\n';
        css += '.cne-bg3d-aurora { position: absolute; inset: 0; opacity: 0.25; background: linear-gradient(180deg, transparent 30%, var(--aurora-c1, #6c5ce7) 50%, var(--aurora-c2, #00cec9) 70%, transparent 90%); filter: blur(60px); animation: cne-aurora-shift var(--aurora-speed, 8s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-aurora-shift { 0% { transform: translateX(-20%) skewY(-2deg); opacity: 0.3; } 100% { transform: translateX(20%) skewY(2deg); opacity: 0.6; } }\n';
        css += '.cne-bg3d-mesh { position: absolute; inset: -50%; width: 200%; height: 200%; animation: cne-mesh-rotate var(--mesh-speed, 20s) linear infinite; }\n';
        css += '@keyframes cne-mesh-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\n';
        css += '.cne-bg3d-star { position: absolute; border-radius: 50%; background: #fff; animation: cne-star-twinkle var(--star-speed, 3s) ease-in-out infinite alternate; }\n';
        css += '@keyframes cne-star-twinkle { 0% { opacity: 0.2; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }\n';
        css += '.cne-bg3d-grid-line { position: absolute; background: currentColor; opacity: 0.04; }\n';
        css += '.cne-bg3d-vignette { position: absolute; inset: 0; z-index: 0; pointer-events: none; background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%); }\n\n';

        // Hover Reveal Layer styles
        css += '/* Hover Reveal Layers */\n';
        css += '.cne-reveal-container { position: absolute; inset: 0; z-index: var(--reveal-z, 2); overflow: hidden; cursor: none; }\n';
        css += '.cne-reveal-layer { position: absolute; inset: 0; width: 100%; height: 100%; }\n';
        css += '.cne-reveal-top { z-index: 1; -webkit-mask-image: linear-gradient(transparent,transparent); mask-image: linear-gradient(transparent,transparent); }\n';
        css += '.cne-reveal-container[data-reveal-invert="true"] .cne-reveal-top { -webkit-mask-image: none; mask-image: none; }\n';
        css += '.cne-reveal-cursor { position: fixed; pointer-events: none; z-index: 9999; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.5); border-radius: 50%; transform: translate(-50%,-50%); transition: opacity 0.3s; mix-blend-mode: difference; }\n';
        css += '.cne-reveal-masked { -webkit-mask-image: linear-gradient(transparent,transparent); mask-image: linear-gradient(transparent,transparent); }\n';
        css += '.cne-scene[data-reveal-invert="true"] .cne-reveal-masked { -webkit-mask-image: none; mask-image: none; }\n\n';

        // Hero on-load entrance animation (CSS, not scroll-dependent)
        // NOTE: Must NOT animate 'transform' — it would override GSAP xPercent/yPercent centering
        css += '@keyframes cne-hero-entrance { 0% { opacity: 0; filter: blur(8px); } 100% { opacity: 1; filter: blur(0); } }\n\n';

        // Responsive — generic layout
        css += '@media (max-width: 768px) {\n';
        css += '  .cne-nav { padding: 1rem 1.2rem; }\n';
        css += '  .cne-nav-links { display: none; }\n';
        css += '  .cne-element { font-size: 0.85em; }\n';
        css += '  .cne-scene { min-height: 80vh; }\n';
        css += '}\n';
        css += '@media (max-width: 480px) {\n';
        css += '  .cne-element { font-size: 0.78em; }\n';
        css += '  .cne-scene { min-height: 75vh; }\n';
        css += '  .cne-nav-logo { font-size: 1rem; }\n';
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

        // Preserve CSS translate centering by converting to GSAP xPercent/yPercent
        js += '      /* Preserve CSS translate centering */\n';
        js += '      var inT = el.style.transform || "";\n';
        js += '      var hasXCenter = inT.indexOf("translateX(-50%)") >= 0 || inT.indexOf("translate(-50%") >= 0;\n';
        js += '      var hasYCenter = inT.indexOf("translateY(-50%)") >= 0 || inT.indexOf("translate(-50%,-50%)") >= 0 || inT.indexOf("translate(-50%, -50%)") >= 0;\n';
        js += '      if(hasXCenter) gsap.set(el, { xPercent: -50 });\n';
        js += '      if(hasYCenter) gsap.set(el, { yPercent: -50 });\n';
        js += '      if(hasXCenter || hasYCenter) el.style.transform = "";\n\n';

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
        js += '        p.style.opacity = 0.15 + Math.random() * 0.35;\n';
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
        js += '      var cols = 12; var rows = 8;\n';
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
        js += '        opacity: 0.12,\n';
        js += '        duration: speedMs * 0.5,\n';
        js += '        stagger: { each: 0.05, repeat: -1, yoyo: true },\n';
        js += '        ease: "sine.inOut"\n';
        js += '      });\n';
        js += '    }\n';

        // Classic canvas-based background effects
        js += '    var _classicFx = "particles bubbles stars snow fireflies confetti matrix blobs geometric orbits dna cube sphere pyramid torus cylinder crystal icosahedron grid3d gradient waves aurora noise".split(" ");\n';
        js += '    if(_classicFx.indexOf(type) !== -1){\n';
        js += '      var hRgb=function(h){h=h.replace("#","");return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)].join(",")};\n';
        js += '      var col1=hRgb(c1),col2=hRgb(c2),count=intensity*15,spd=speed==="slow"?0.5:speed==="fast"?2:1;\n';
        js += '      var cv=document.createElement("canvas");cv.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block";\n';
        js += '      container.appendChild(cv);var ctx=cv.getContext("2d");\n';
        js += '      var rsz=function(){cv.width=container.offsetWidth;cv.height=container.offsetHeight};rsz();window.addEventListener("resize",rsz);\n';
        // Mouse tracking on parent section — disabled when a reveal layer is present
        js += '      var mx=-1,my=-1,sec=container.parentElement,hasReveal=sec&&sec.querySelector(".cne-reveal-container");\n';
        js += '      if(sec&&!hasReveal){sec.addEventListener("mousemove",function(e){var r=container.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top});sec.addEventListener("mouseleave",function(){mx=-1;my=-1})}\n';
        js += '      var ps=[];for(var pi=0;pi<count;pi++)ps.push({x:Math.random()*cv.width,y:Math.random()*cv.height,vx:(Math.random()-.5)*.8*spd,vy:(Math.random()-.5)*.8*spd,sz:Math.random()*3+1,a:Math.random()*.5+.2,p:Math.random()*6.28,rot:Math.random()*360,col:Math.random()>.5?col1:col2});\n';
        js += '      if(type==="bubbles")ps.forEach(function(p){p.vy=-(Math.random()+.3)*spd;p.sz=Math.random()*6+2});\n';
        js += '      if(type==="snow")ps.forEach(function(p){p.vy=(Math.random()*.5+.2)*spd;p.sz=Math.random()*3+1});\n';
        js += '      if(type==="fireflies")ps=ps.slice(0,Math.min(count,25));\n';
        js += '      (function draw(){\n';
        js += '        var cw=cv.width,ch=cv.height,t=Date.now()*.001;\n';
        js += '        ctx.clearRect(0,0,cw,ch);\n';

        // gradient
        js += '        if(type==="gradient"){var g=ctx.createLinearGradient(cw*(.5+.5*Math.sin(t*.5)),0,cw*(.5+.5*Math.cos(t*.3)),ch);g.addColorStop(0,"rgba("+col1+",.12)");g.addColorStop(.5,"rgba("+col2+",.06)");g.addColorStop(1,"rgba("+col1+",.12)");ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);requestAnimationFrame(draw);return}\n';

        // waves — mouse bends amplitude
        js += '        if(type==="waves"){var wOy=0;if(mx>=0)wOy=(my/ch-0.5)*30;for(var w=0;w<3;w++){ctx.strokeStyle="rgba("+col1+","+(0.15-w*0.03)+")";ctx.lineWidth=1.5-w*0.3;ctx.beginPath();for(var x=0;x<=cw;x+=4){var wAmp=20*(w+1);if(mx>=0){var wd=Math.abs(x-mx);if(wd<200)wAmp+=15*(1-wd/200)}var y=ch*.5+wOy+Math.sin(x*.01+t+w)*wAmp;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}requestAnimationFrame(draw);return}\n';

        // aurora — mouse warps bands
        js += '        if(type==="aurora"){var aOy=0;if(mx>=0)aOy=(my/ch-0.5)*25;for(var ab=0;ab<3;ab++){ctx.fillStyle="rgba("+(ab%2===0?col1:col2)+",0.04)";ctx.beginPath();for(var ax=0;ax<=cw;ax+=6){var aAmp=ch*.15;if(mx>=0){var awd=Math.abs(ax-mx);if(awd<250)aAmp+=ch*.06*(1-awd/250)}var ay=ch*.3+aOy+Math.sin(ax*.005+t*.5+ab*2)*aAmp;ax===0?ctx.moveTo(ax,ay):ctx.lineTo(ax,ay)}ctx.lineTo(cw,ch);ctx.lineTo(0,ch);ctx.fill()}requestAnimationFrame(draw);return}\n';

        // noise
        js += '        if(type==="noise"){var imd=ctx.createImageData(cw,ch);var d=imd.data;for(var j=0;j<d.length;j+=4){var v=Math.random()*30;d[j]=v;d[j+1]=v;d[j+2]=v;d[j+3]=12}ctx.putImageData(imd,0,0);requestAnimationFrame(draw);return}\n';

        // blobs — drift toward mouse
        js += '        if(type==="blobs"){var bMx=0,bMy=0;if(mx>=0){bMx=(mx/cw-0.5)*60;bMy=(my/ch-0.5)*40}for(var b=0;b<3;b++){ctx.fillStyle="rgba("+(b%2===0?col1:col2)+",0.06)";ctx.beginPath();var bx=cw*(.3+b*.2)+Math.sin(t*.5+b)*50+bMx,by=ch*(.3+b*.2)+Math.cos(t*.4+b)*40+bMy,br=60+Math.sin(t+b)*20;for(var ba=0;ba<6.28;ba+=.1){var rr=br+Math.sin(ba*3+t+b)*15;ba===0?ctx.moveTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr):ctx.lineTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr)}ctx.closePath();ctx.fill()}requestAnimationFrame(draw);return}\n';

        // geometric — shapes shift toward mouse
        js += '        if(type==="geometric"){var gMx=0,gMy=0;if(mx>=0){gMx=(mx/cw-0.5)*30;gMy=(my/ch-0.5)*20}ctx.strokeStyle="rgba("+col1+",0.15)";ctx.lineWidth=0.5;for(var gi=0;gi<15;gi++){var gx=cw*.1+gi*cw/15+Math.sin(t+gi)*10+gMx,gy=ch*.5+Math.cos(t*.7+gi)*ch*.3+gMy,gsz=15+Math.sin(t+gi)*5;ctx.beginPath();for(var gs=0;gs<6;gs++){var ga=gs*Math.PI/3+t*.2;ctx.lineTo(gx+Math.cos(ga)*gsz,gy+Math.sin(ga)*gsz)}ctx.closePath();ctx.stroke()}requestAnimationFrame(draw);return}\n';

        // 3D shapes — mouse-driven rotation
        js += '        if("cube sphere pyramid torus cylinder crystal icosahedron grid3d".split(" ").indexOf(type)!==-1){\n';
        js += '          var cx3=cw/2,cy3=ch/2,sz3=Math.min(cw,ch)*0.35;\n';
        js += '          var rotA=t*0.7,rotB=t*0.5;if(mx>=0){rotA+=(mx/cw-0.5)*1.5;rotB+=(my/ch-0.5)*1.5}\n';
        js += '          var cosA=Math.cos(rotA),sinA=Math.sin(rotA),cosB=Math.cos(rotB),sinB=Math.sin(rotB);\n';
        js += '          var proj=function(x,y,z){var x1=x*cosA-z*sinA,z1=x*sinA+z*cosA,y1=y*cosB-z1*sinB,z2=y*sinB+z1*cosB;var sc=1/(1+z2*0.003);return{x:cx3+x1*sc,y:cy3+y1*sc,z:z2}};\n';
        js += '          var edg=function(p1,p2,c,a){ctx.strokeStyle="rgba("+c+","+a+")";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()};\n';
        js += '          var dt=function(p,c,r){ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,r,0,6.28);ctx.fill()};\n';

        // cube
        js += '          if(type==="cube"){var s=sz3*.4,vts=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];var pv=vts.map(function(v){return proj(v[0],v[1],v[2])});[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(function(e){edg(pv[e[0]],pv[e[1]],col1,0.6)});pv.forEach(function(p){dt(p,"rgba("+col2+",0.8)",3)})}\n';

        // sphere
        js += '          else if(type==="sphere"){for(var sli=0;sli<60;sli++){var phi=Math.PI*sli/30,theta=2*Math.PI*((sli*7)%60)/60;var sx3=sz3*0.4*Math.sin(phi)*Math.cos(theta),sy3=sz3*0.4*Math.sin(phi)*Math.sin(theta),sz4=sz3*0.4*Math.cos(phi);var sp=proj(sx3,sy3,sz4);var bright=0.3+0.5*((sp.z+sz3)/(2*sz3));dt(sp,"rgba("+(sli%2===0?col1:col2)+","+bright+")",2+bright)}}\n';

        // pyramid
        js += '          else if(type==="pyramid"){var ph2=sz3*0.5,pb2=sz3*0.35;var pvt=[[0,-ph2,0],[-pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,pb2],[-pb2,ph2*0.5,pb2]];var ppv=pvt.map(function(v){return proj(v[0],v[1],v[2])});[[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]].forEach(function(e){edg(ppv[e[0]],ppv[e[1]],col1,0.5)});ppv.forEach(function(p){dt(p,"rgba("+col2+",0.8)",3)})}\n';

        // torus
        js += '          else if(type==="torus"){var R2=sz3*0.3,r3=sz3*0.12;for(var ti3=0;ti3<80;ti3++){var u=2*Math.PI*ti3/40,v3=2*Math.PI*((ti3*3)%80)/80;var tx=(R2+r3*Math.cos(v3))*Math.cos(u),ty=r3*Math.sin(v3),tz=(R2+r3*Math.cos(v3))*Math.sin(u);var tp=proj(tx,ty,tz);dt(tp,"rgba("+(ti3%2===0?col1:col2)+",0.5)",2)}}\n';

        // cylinder
        js += '          else if(type==="cylinder"){var cr2=sz3*0.25,ch3=sz3*0.5;for(var ci3=0;ci3<24;ci3++){var ca2=2*Math.PI*ci3/12;var ptop=proj(Math.cos(ca2)*cr2,-ch3*0.5,Math.sin(ca2)*cr2);var pbot=proj(Math.cos(ca2)*cr2,ch3*0.5,Math.sin(ca2)*cr2);dt(ptop,"rgba("+col1+",0.7)",2);dt(pbot,"rgba("+col2+",0.7)",2);if(ci3<12)edg(ptop,pbot,col1,0.3)}}\n';

        // crystal
        js += '          else if(type==="crystal"){var cs3=sz3*0.2,ct2=sz3*0.5;var cvts=[];for(var cv2=0;cv2<6;cv2++){var ang=cv2*Math.PI/3;cvts.push([Math.cos(ang)*cs3,0,Math.sin(ang)*cs3])}cvts.push([0,-ct2,0]);cvts.push([0,ct2*0.5,0]);var cpv=cvts.map(function(v){return proj(v[0],v[1],v[2])});for(var ce=0;ce<6;ce++){edg(cpv[ce],cpv[(ce+1)%6],col1,0.4);edg(cpv[ce],cpv[6],col2,0.5);edg(cpv[ce],cpv[7],col1,0.3)}cpv.forEach(function(p){dt(p,"rgba("+col2+",0.9)",3)})}\n';

        // icosahedron
        js += '          else if(type==="icosahedron"){var phi3=(1+Math.sqrt(5))/2,ir=sz3*0.3;var ivts=[[-1,phi3,0],[1,phi3,0],[-1,-phi3,0],[1,-phi3,0],[0,-1,phi3],[0,1,phi3],[0,-1,-phi3],[0,1,-phi3],[phi3,0,-1],[phi3,0,1],[-phi3,0,-1],[-phi3,0,1]];var ipv=ivts.map(function(v){var l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return proj(v[0]/l*ir,v[1]/l*ir,v[2]/l*ir)});[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].forEach(function(f){edg(ipv[f[0]],ipv[f[1]],col1,0.3);edg(ipv[f[1]],ipv[f[2]],col1,0.3);edg(ipv[f[2]],ipv[f[0]],col1,0.3)});ipv.forEach(function(p){dt(p,"rgba("+col2+",0.8)",2)})}\n';

        // grid3d
        js += '          else if(type==="grid3d"){var gs3=sz3*0.15,gc=4;for(var gxi=-gc;gxi<=gc;gxi+=2)for(var gyi=-gc;gyi<=gc;gyi+=2)for(var gzi=-gc;gzi<=gc;gzi+=2){var gp=proj(gxi*gs3,gyi*gs3,gzi*gs3);var ga2=0.15+0.3*((gp.z+sz3*2)/(sz3*4));dt(gp,"rgba("+((gxi+gyi+gzi)%2===0?col1:col2)+","+ga2+")",2)}}\n';

        js += '          requestAnimationFrame(draw);return;\n';
        js += '        }\n';

        // orbits — center follows mouse
        js += '        if(type==="orbits"){var ocx=cw/2,ocy=ch/2;if(mx>=0){ocx+=(mx-cw/2)*0.3;ocy+=(my-ch/2)*0.3}for(var oi=0;oi<8;oi++){var oa=t*.5+oi*Math.PI/4,or2=50+oi*15,ox=ocx+Math.cos(oa)*or2,oy=ocy+Math.sin(oa)*or2;ctx.fillStyle="rgba("+col1+","+(0.4-oi*0.04)+")";ctx.beginPath();ctx.arc(ox,oy,3,0,6.28);ctx.fill()}requestAnimationFrame(draw);return}\n';

        // dna — mouse offset
        js += '        if(type==="dna"){var dOx=0,dOy=0;if(mx>=0){dOx=(mx/cw-0.5)*40;dOy=(my/ch-0.5)*20}for(var di=0;di<20;di++){var dx=cw*.2+di*(cw*.6/20)+dOx,dy1=ch/2+Math.sin(di*.5+t)*30+dOy,dy2=ch/2-Math.sin(di*.5+t)*30+dOy;ctx.fillStyle="rgba("+col1+",0.5)";ctx.beginPath();ctx.arc(dx,dy1,3,0,6.28);ctx.fill();ctx.fillStyle="rgba("+col2+",0.5)";ctx.beginPath();ctx.arc(dx,dy2,3,0,6.28);ctx.fill();ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.beginPath();ctx.moveTo(dx,dy1);ctx.lineTo(dx,dy2);ctx.stroke()}requestAnimationFrame(draw);return}\n';

        // confetti + mouse attraction
        js += '        if(type==="confetti"){ps.forEach(function(p){if(mx>=0){var dx=mx-p.x,dy=my-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<150){var f=0.02*(1-d/150);p.x+=dx*f*2;p.y+=dy*f*2}}p.y+=p.vy+1;p.x+=Math.sin(p.p)*0.5;p.rot+=2;p.p+=0.03;if(p.y>ch+10){p.y=-10;p.x=Math.random()*cw}ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle="rgba("+p.col+","+p.a+")";ctx.fillRect(-3,-1.5,6,3);ctx.restore()});requestAnimationFrame(draw);return}\n';

        // matrix + mouse glow
        js += '        if(type==="matrix"){ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,cw,ch);ctx.font="12px monospace";ps.forEach(function(p){var bright=0.6;if(mx>=0){var dd=Math.sqrt((mx-p.x)*(mx-p.x)+(my-p.y)*(my-p.y));if(dd<120)bright=0.6+0.4*(1-dd/120)}ctx.fillStyle="rgba(0,255,65,"+bright+")";ctx.fillText(String.fromCharCode(0x30A0+Math.random()*96),p.x,p.y);p.y+=12;if(p.y>ch){p.y=0;p.x=Math.random()*cw}});requestAnimationFrame(draw);return}\n';

        // default particles (particles, bubbles, stars, snow, fireflies) + mouse attraction
        js += '        ps.forEach(function(p){if(mx>=0){var dx=mx-p.x,dy=my-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<150){var f=0.02*(1-d/150);p.vx+=dx*f;p.vy+=dy*f}}p.x+=p.vx;p.y+=p.vy;p.p+=.02;if(p.x<-5)p.x=cw+5;if(p.x>cw+5)p.x=-5;if(p.y<-5)p.y=ch+5;if(p.y>ch+5)p.y=-5;var al=p.a;if(type==="stars"||type==="fireflies")al=p.a*(.5+.5*Math.sin(p.p));ctx.beginPath();if(type==="fireflies"){ctx.shadowBlur=10;ctx.shadowColor="rgba(100,255,100,"+al+")";ctx.fillStyle="rgba(100,255,100,"+al+")"}else if(type==="snow"){ctx.fillStyle="rgba(255,255,255,"+al+")";p.x+=Math.sin(p.p)*.5}else{ctx.fillStyle="rgba("+p.col+","+al+")"}ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0});\n';
        js += '        requestAnimationFrame(draw);\n';
        js += '      })();\n';
        js += '    }\n';

        js += '  });\n\n';
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

        // Smooth scroll for ALL internal anchor links (nav links + buttons + any <a href="#...">)
        js += '\n  /* Smooth scroll for internal anchor links */\n';
        js += '  document.querySelectorAll("a[href^=\'#\']").forEach(function(a){\n';
        js += '    if(a.getAttribute("href").length <= 1) return;\n';
        js += '    a.addEventListener("click", function(e){\n';
        js += '      var target = document.getElementById(a.getAttribute("href").substring(1));\n';
        js += '      if(target){ e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); }\n';
        js += '    });\n';
        js += '  });\n';

        // Hover Reveal Layer engine
        js += '\n  /* Hover Reveal Layers */\n';
        js += '  document.querySelectorAll(".cne-reveal-container").forEach(function(container){\n';
        js += '    var type, radius, feather, speed, invert;\n';
        js += '    function readSettings(){\n';
        js += '      type = container.dataset.revealType || "circle";\n';
        js += '      radius = parseInt(container.dataset.revealRadius) || 120;\n';
        js += '      feather = parseInt(container.dataset.revealFeather) || 40;\n';
        js += '      speed = parseFloat(container.dataset.revealSpeed) || 0.15;\n';
        js += '      invert = container.dataset.revealInvert === "true";\n';
        js += '    }\n';
        js += '    readSettings();\n';
        js += '    var tops = Array.prototype.slice.call(container.querySelectorAll(".cne-reveal-top"));\n';
        js += '    var scene = container.closest(".cne-scene");\n';
        js += '    var contentMasked = container.dataset.contentMasked === "true";\n';
        js += '    var bgMasked = container.dataset.bgMasked === "true";\n';
        js += '    if(contentMasked && scene){\n';
        js += '      var els = scene.querySelectorAll(".cne-element");\n';
        js += '      els.forEach(function(el){ tops.push(el); el.classList.add("cne-reveal-masked"); });\n';
        js += '    }\n';
        js += '    if(bgMasked && scene){\n';
        js += '      var bgvid = scene.querySelector(".cne-scene-bgvid");\n';
        js += '      if(bgvid){ tops.push(bgvid); bgvid.classList.add("cne-reveal-masked"); }\n';
        js += '    }\n';
        js += '    if(!tops.length) return;\n\n';

        js += '    var mx = -9999, my = -9999, cx = -9999, cy = -9999;\n';
        js += '    var active = false;\n';
        js += '    var evtTarget = scene || container;\n';
        js += '    if(scene) scene.style.cursor = "none";\n\n';

        // Initial state handled by CSS (.cne-reveal-top / .cne-reveal-masked has transparent mask by default)
        js += '    var hideMask = "linear-gradient(transparent,transparent)";\n';

        js += '    evtTarget.addEventListener("mouseenter", function(){ active = true; });\n';
        js += '    evtTarget.addEventListener("mouseleave", function(){\n';
        js += '      active = false;\n';
        js += '      tops.forEach(function(t){\n';
        js += '        if(!invert){ t.style.webkitMaskImage = hideMask; t.style.maskImage = hideMask; }\n';
        js += '        else { t.style.webkitMaskImage = "none"; t.style.maskImage = "none"; }\n';
        js += '      });\n';
        js += '    });\n\n';

        js += '    evtTarget.addEventListener("mousemove", function(e){\n';
        js += '      var rect = container.getBoundingClientRect();\n';
        js += '      mx = e.clientX - rect.left;\n';
        js += '      my = e.clientY - rect.top;\n';
        js += '    });\n\n';

        // rAF loop for smooth following
        js += '    function tick(){\n';
        js += '      readSettings();\n';
        js += '      if(active){\n';
        js += '        cx += (mx - cx) * Math.min(1, speed * 3);\n';
        js += '        cy += (my - cy) * Math.min(1, speed * 3);\n';
        js += '        var mask, isMulti = false;\n';
        js += '        var ci = invert ? "transparent" : "black";\n';
        js += '        var co = invert ? "black" : "transparent";\n';
        js += '        if(type === "circle"){\n';
        js += '          mask = "radial-gradient(circle " + radius + "px at " + cx + "px " + cy + "px, " + ci + " " + Math.max(0, radius - feather) + "px, " + co + " " + radius + "px)";\n';
        js += '        } else if(type === "spotlight"){\n';
        js += '          var r2 = radius * 1.5;\n';
        js += '          mask = "radial-gradient(ellipse " + r2 + "px " + (r2 * 0.7) + "px at " + cx + "px " + cy + "px, " + ci + " " + Math.max(0, r2 - feather * 2) + "px, " + co + " " + r2 + "px)";\n';
        js += '        } else if(type === "blob"){\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var r1 = radius + Math.sin(t * 1.3) * radius * 0.2;\n';
        js += '          var r2b = radius + Math.cos(t * 0.9) * radius * 0.25;\n';
        js += '          mask = "radial-gradient(ellipse " + r1 + "px " + r2b + "px at " + cx + "px " + cy + "px, " + ci + " " + Math.max(0, Math.min(r1, r2b) - feather) + "px, " + co + " " + Math.max(r1, r2b) + "px)";\n';
        js += '        } else if(type === "wipe"){\n';
        js += '          var pct = Math.max(0, Math.min(100, (cx / container.offsetWidth) * 100));\n';
        js += '          mask = "linear-gradient(to right, " + ci + " " + Math.max(0, pct - feather / 2) + "%, " + co + " " + Math.min(100, pct + feather / 2) + "%)";\n';

        // Venom — organic tendrils radiating from cursor
        js += '        } else if(type === "venom"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          var cb = radius * 0.5;\n';
        js += '          masks.push("radial-gradient(circle " + cb + "px at " + cx + "px " + cy + "px, " + ci + " " + Math.max(0, cb - feather) + "px, " + co + " " + cb + "px)");\n';
        js += '          for(var k = 0; k < 6; k++){\n';
        js += '            var angle = k * 1.047 + t * 0.5 + Math.sin(t * 1.5 + k) * 0.4;\n';
        js += '            for(var j = 1; j <= 5; j++){\n';
        js += '              var dist = j * radius * 0.22 + Math.sin(t * 2 + k + j * 0.5) * 8;\n';
        js += '              var sz = Math.max(6, radius * 0.25 * (1.1 - j * 0.18) + Math.sin(t * 3 + k * 0.7 + j) * 4);\n';
        js += '              var px = cx + Math.cos(angle + Math.sin(t + j * 0.3) * 0.15) * dist;\n';
        js += '              var py = cy + Math.sin(angle + Math.sin(t + j * 0.3) * 0.15) * dist;\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.3) + "px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Particles — scattered dots around cursor
        js += '        } else if(type === "particles"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          var cg = radius * 0.25;\n';
        js += '          masks.push("radial-gradient(circle " + cg + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + cg + "px)");\n';
        js += '          for(var k = 0; k < 30; k++){\n';
        js += '            var a = k * 2.399 + t * 0.4 + Math.sin(t * 0.7 + k * 0.5) * 0.6;\n';
        js += '            var d = (k / 30) * radius * 1.3 + Math.sin(t * 1.5 + k * 1.1) * 12;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var sz = 3 + k * 0.25 + Math.sin(t * 2.5 + k * 0.9) * 2.5;\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.3) + "px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Noise — dissolve/static edge reveal
        js += '        } else if(type === "noise"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + radius + "px at " + cx + "px " + cy + "px, " + ci + " " + Math.max(0, radius * 0.25) + "px, " + co + " " + radius + "px)");\n';
        js += '          for(var k = 0; k < 40; k++){\n';
        js += '            var a = k * 2.399 + Math.sin(t * 0.8 + k * 0.9) * 0.4;\n';
        js += '            var d = radius * 0.55 + Math.sin(t * 1.2 + k * 2.1) * radius * 0.55;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var sz = feather * 0.25 + Math.abs(Math.sin(k * 1.7 + t * 0.9)) * feather * 0.35;\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Ripple — concentric rings pulsing outward
        js += '        } else if(type === "ripple"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.003;\n';
        js += '          var masks = [];\n';
        js += '          for(var k = 0; k < 5; k++){\n';
        js += '            var phase = (t + k * 1.2) % 6.0;\n';
        js += '            var rr = phase / 6.0 * radius * 2;\n';
        js += '            var w = feather * 0.3 * (1 - phase / 6.0);\n';
        js += '            if(rr > 0 && w > 1){\n';
        js += '              masks.push("radial-gradient(circle " + rr + "px at " + cx + "px " + cy + "px, " + co + " " + Math.max(0, rr - w) + "px, " + ci + " " + rr + "px, " + co + " " + (rr + w) + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.15) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.15) + "px)");\n';
        js += '          mask = masks.join(", ");\n';

        // Spiral — rotating arms from cursor
        js += '        } else if(type === "spiral"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.3) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.3) + "px)");\n';
        js += '          for(var arm = 0; arm < 3; arm++){\n';
        js += '            var baseA = arm * 2.094 + t;\n';
        js += '            for(var k = 0; k < 10; k++){\n';
        js += '              var d = (k + 1) * radius * 0.12;\n';
        js += '              var a = baseA + k * 0.5;\n';
        js += '              var sz = Math.max(4, radius * 0.15 - k * 1.2);\n';
        js += '              var px = cx + Math.cos(a) * d;\n';
        js += '              var py = cy + Math.sin(a) * d;\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.2) + "px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Honeycomb — hexagonal cells expanding from cursor
        js += '        } else if(type === "honeycomb"){\n';
        js += '          isMulti = true;\n';
        js += '          var masks = [];\n';
        js += '          var cellR = Math.max(12, radius * 0.18);\n';
        js += '          var cols = Math.ceil(radius * 2.5 / (cellR * 1.5));\n';
        js += '          for(var gy = -cols; gy <= cols; gy++){\n';
        js += '            for(var gx = -cols; gx <= cols; gx++){\n';
        js += '              var px = cx + gx * cellR * 1.75 + (gy % 2) * cellR * 0.875;\n';
        js += '              var py = cy + gy * cellR * 1.52;\n';
        js += '              var dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));\n';
        js += '              if(dist < radius * 1.3){\n';
        js += '                var fade = 1 - dist / (radius * 1.3);\n';
        js += '                var sz = cellR * fade;\n';
        js += '                if(sz > 2) masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.7) + "px, " + co + " " + sz + "px)");\n';
        js += '              }\n';
        js += '            }\n';
        js += '          }\n';
        js += '          if(!masks.length) masks.push("radial-gradient(circle " + radius + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + radius + "px)");\n';
        js += '          mask = masks.join(", ");\n';

        // Shatter — angular glass fragments
        js += '        } else if(type === "shatter"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.0005;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.25) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.25) + "px)");\n';
        js += '          for(var k = 0; k < 18; k++){\n';
        js += '            var a = k * 0.349 + Math.sin(t + k * 2.3) * 0.15;\n';
        js += '            var d = radius * 0.3 + (k % 3) * radius * 0.25 + Math.sin(k * 1.7 + t) * radius * 0.08;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var szx = radius * 0.2 + Math.sin(k * 2.1) * radius * 0.08;\n';
        js += '            var szy = radius * 0.12 + Math.cos(k * 1.3) * radius * 0.06;\n';
        js += '            masks.push("radial-gradient(ellipse " + szx + "px " + szy + "px at " + px + "px " + py + "px, " + ci + " " + (Math.min(szx, szy) * 0.4) + "px, " + co + " " + Math.max(szx, szy) + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Smoke — soft drifting clouds
        js += '        } else if(type === "smoke"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.0008;\n';
        js += '          var masks = [];\n';
        js += '          for(var k = 0; k < 8; k++){\n';
        js += '            var a = k * 0.785 + Math.sin(t * 0.7 + k) * 0.6;\n';
        js += '            var d = Math.sin(t * 0.5 + k * 1.2) * radius * 0.4 + radius * 0.2;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d - Math.sin(t + k) * 15;\n';
        js += '            var sz = radius * 0.5 + Math.sin(t * 0.9 + k * 0.8) * radius * 0.2;\n';
        js += '            var szy = sz * (0.6 + Math.sin(t * 0.6 + k * 1.1) * 0.2);\n';
        js += '            masks.push("radial-gradient(ellipse " + sz + "px " + szy + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.15) + "px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Glitch — horizontal scan line bars
        js += '        } else if(type === "glitch"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var masks = [];\n';
        js += '          var w = container.offsetWidth;\n';
        js += '          for(var k = 0; k < 12; k++){\n';
        js += '            var barY = cy + (k - 6) * (radius * 0.18) + Math.sin(t * 3 + k * 2.3) * 8;\n';
        js += '            var barH = radius * 0.06 + Math.abs(Math.sin(t * 2.5 + k * 1.7)) * radius * 0.08;\n';
        js += '            var offX = Math.sin(t * 4 + k * 0.9) * 30;\n';
        js += '            var bw = w * 0.3 + Math.sin(t * 1.5 + k * 1.3) * w * 0.15;\n';
        js += '            masks.push("radial-gradient(ellipse " + bw + "px " + barH + "px at " + (cx + offX) + "px " + barY + "px, " + ci + " " + (bw * 0.7) + "px, " + co + " " + bw + "px)");\n';
        js += '          }\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.2) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.2) + "px)");\n';
        js += '          mask = masks.join(", ");\n';

        // Drip — vertical dripping tendrils
        js += '        } else if(type === "drip"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.35) + "px at " + cx + "px " + cy + "px, " + ci + " " + (radius * 0.1) + "px, " + co + " " + (radius * 0.35) + "px)");\n';
        js += '          for(var k = 0; k < 7; k++){\n';
        js += '            var dx = (k - 3) * radius * 0.2 + Math.sin(t * 0.8 + k * 1.5) * 6;\n';
        js += '            var speed2 = 0.8 + k * 0.15;\n';
        js += '            for(var j = 0; j < 6; j++){\n';
        js += '              var dy = j * radius * 0.22 + Math.sin(t * speed2 + k + j * 0.7) * 10;\n';
        js += '              var sz = Math.max(4, radius * 0.12 * (1 - j * 0.12));\n';
        js += '              masks.push("radial-gradient(ellipse " + (sz * 0.7) + "px " + sz + "px at " + (cx + dx) + "px " + (cy + dy) + "px, " + ci + " " + (sz * 0.2) + "px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Fireworks — exploding burst pattern
        js += '        } else if(type === "fireworks"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.2) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.2) + "px)");\n';
        js += '          for(var burst = 0; burst < 3; burst++){\n';
        js += '            var phase = ((t * 0.7 + burst * 2.1) % 3.0) / 3.0;\n';
        js += '            var bRadius = phase * radius * 1.5;\n';
        js += '            var bAlpha = 1 - phase;\n';
        js += '            if(bAlpha > 0.1){\n';
        js += '              for(var k = 0; k < 12; k++){\n';
        js += '                var a = k * 0.524 + burst * 0.3;\n';
        js += '                var px = cx + Math.cos(a) * bRadius;\n';
        js += '                var py = cy + Math.sin(a) * bRadius;\n';
        js += '                var sz = Math.max(3, radius * 0.1 * bAlpha);\n';
        js += '                masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.3) + "px, " + co + " " + sz + "px)");\n';
        js += '              }\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Cells — organic bubble clusters
        js += '        } else if(type === "cells"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.0006;\n';
        js += '          var masks = [];\n';
        js += '          for(var k = 0; k < 15; k++){\n';
        js += '            var seed = k * 7.31;\n';
        js += '            var a = seed + Math.sin(t + seed) * 0.4;\n';
        js += '            var d = (seed * 3.7 % 1) * radius + Math.sin(t * 0.7 + seed) * 15;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var sz = radius * 0.15 + Math.sin(t * 0.5 + seed * 0.3) * radius * 0.1;\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.5) + "px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Wave — sinusoidal revealing edge
        js += '        } else if(type === "wave"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var masks = [];\n';
        js += '          var h = container.offsetHeight;\n';
        js += '          var pct = Math.max(0, Math.min(1, cx / container.offsetWidth));\n';
        js += '          for(var k = 0; k <= 20; k++){\n';
        js += '            var yy = (k / 20) * h;\n';
        js += '            var waveX = pct * container.offsetWidth + Math.sin(t + k * 0.6) * feather * 1.5;\n';
        js += '            var sz = feather * 0.6 + Math.sin(t * 1.3 + k * 0.8) * feather * 0.2;\n';
        js += '            masks.push("radial-gradient(ellipse " + sz + "px " + (h / 18) + "px at " + waveX + "px " + yy + "px, " + ci + " " + (sz * 0.6) + "px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          masks.push("linear-gradient(to right, " + ci + " " + Math.max(0, pct * 100 - 10) + "%, " + co + " " + (pct * 100 + 10) + "%)");\n';
        js += '          mask = masks.join(", ");\n';

        // Pixelate — blocky pixel grid
        js += '        } else if(type === "pixelate"){\n';
        js += '          isMulti = true;\n';
        js += '          var masks = [];\n';
        js += '          var cellSz = Math.max(8, radius * 0.12);\n';
        js += '          var span = Math.ceil(radius * 1.4 / cellSz);\n';
        js += '          for(var gy = -span; gy <= span; gy++){\n';
        js += '            for(var gx = -span; gx <= span; gx++){\n';
        js += '              var px = cx + gx * cellSz * 1.1;\n';
        js += '              var py = cy + gy * cellSz * 1.1;\n';
        js += '              var dist = Math.sqrt(gx * gx + gy * gy) * cellSz;\n';
        js += '              if(dist < radius * 1.3){\n';
        js += '                var fade = Math.max(0, 1 - dist / radius);\n';
        js += '                var sz = cellSz * 0.48 * fade;\n';
        js += '                if(sz > 1) masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.85) + "px, " + co + " " + sz + "px)");\n';
        js += '              }\n';
        js += '            }\n';
        js += '          }\n';
        js += '          if(!masks.length) masks.push("radial-gradient(circle " + radius + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + radius + "px)");\n';
        js += '          mask = masks.join(", ");\n';

        // Meteor — trailing particle shower
        js += '        } else if(type === "meteor"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.3) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.3) + "px)");\n';
        js += '          for(var k = 0; k < 25; k++){\n';
        js += '            var trail = k * 0.12;\n';
        js += '            var tx = cx - Math.cos(0.7) * radius * trail * 0.5 + Math.sin(t * 2 + k * 1.3) * (k * 1.5);\n';
        js += '            var ty = cy - Math.sin(0.7) * radius * trail * 0.5 + Math.cos(t * 1.5 + k * 0.9) * (k * 1.2);\n';
        js += '            var sz = Math.max(2, radius * 0.12 * (1 - k * 0.035));\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + tx + "px " + ty + "px, " + ci + " " + (sz * 0.3) + "px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Galaxy — spinning arms with scattered stars
        js += '        } else if(type === "galaxy"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.0008;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.2) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.2) + "px)");\n';
        js += '          for(var arm = 0; arm < 2; arm++){\n';
        js += '            var baseA = arm * 3.14159 + t;\n';
        js += '            for(var k = 0; k < 14; k++){\n';
        js += '              var d = (k + 1) * radius * 0.09;\n';
        js += '              var a = baseA + k * 0.45;\n';
        js += '              var sz = Math.max(3, radius * 0.12 + Math.sin(t * 1.5 + k) * 3);\n';
        js += '              var px = cx + Math.cos(a) * d + Math.sin(t * 2 + k * arm) * 3;\n';
        js += '              var py = cy + Math.sin(a) * d + Math.cos(t * 2 + k * arm) * 3;\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " " + (sz * 0.2) + "px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          for(var k = 0; k < 10; k++){\n';
        js += '            var sa = k * 2.399 + t * 0.3;\n';
        js += '            var sd = Math.sin(k * 3.7) * radius * 0.8;\n';
        js += '            var ssz = 2 + Math.sin(t * 3 + k) * 1.5;\n';
        js += '            masks.push("radial-gradient(circle " + ssz + "px at " + (cx + Math.cos(sa) * sd) + "px " + (cy + Math.sin(sa) * sd) + "px, " + ci + " 0px, " + co + " " + ssz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Magnetic — dots pulled toward cursor
        js += '        } else if(type === "magnetic"){\n';
        js += '          isMulti = true;\n';
        js += '          var masks = [];\n';
        js += '          var cols = 12, rows = 8;\n';
        js += '          for(var gy = 0; gy < rows; gy++){\n';
        js += '            for(var gx = 0; gx < cols; gx++){\n';
        js += '              var bx = (gx + 0.5) * w / cols;\n';
        js += '              var by = (gy + 0.5) * h / rows;\n';
        js += '              var ddx = cx - bx, ddy = cy - by;\n';
        js += '              var dist = Math.sqrt(ddx * ddx + ddy * ddy) + 1;\n';
        js += '              var pull = Math.min(1, radius * 2.5 / dist);\n';
        js += '              var px = bx + ddx * pull * 0.6;\n';
        js += '              var py = by + ddy * pull * 0.6;\n';
        js += '              var sz = 3 + pull * radius * 0.08;\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Breathe — pulsing growing circles at random positions
        js += '        } else if(type === "breathe"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.4) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.4) + "px)");\n';
        js += '          for(var k = 0; k < 30; k++){\n';
        js += '            var a = k * 2.399;\n';
        js += '            var d = (k * 7.3) % (radius * 1.4);\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var phase = t * 1.5 + k * 0.8;\n';
        js += '            var sz = Math.max(1, (4 + Math.sin(phase) * 6) * (1 - d / (radius * 2)));\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Swarm — flock of dots orbiting erratically
        js += '        } else if(type === "swarm"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var masks = [];\n';
        js += '          for(var k = 0; k < 40; k++){\n';
        js += '            var a = t + k * 0.618 * 6.2832;\n';
        js += '            var r2 = 15 + (Math.sin(t * 0.7 + k * 2.1) * 0.5 + 0.5) * radius * 0.9;\n';
        js += '            var px = cx + Math.cos(a + Math.sin(t + k)) * r2;\n';
        js += '            var py = cy + Math.sin(a + Math.cos(t * 0.8 + k)) * r2;\n';
        js += '            var sz = 2 + Math.sin(t * 3 + k * 1.7) * 2;\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Electric — jagged lightning branches from cursor
        js += '        } else if(type === "electric"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.004;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.15) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.15) + "px)");\n';
        js += '          for(var branch = 0; branch < 5; branch++){\n';
        js += '            var ba = branch * 1.2566 + Math.sin(t + branch) * 0.3;\n';
        js += '            var bx = cx, by = cy;\n';
        js += '            for(var seg = 0; seg < 8; seg++){\n';
        js += '              var jitter = (Math.sin(t * 7 + branch * 13 + seg * 5.7) * 0.6);\n';
        js += '              var step = radius * 0.13;\n';
        js += '              bx += Math.cos(ba + jitter) * step;\n';
        js += '              by += Math.sin(ba + jitter) * step;\n';
        js += '              var sz = Math.max(1, 4 - seg * 0.3);\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + bx + "px " + by + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Orbit — layered rings of dots orbiting at different speeds
        js += '        } else if(type === "orbit"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.0015;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.1) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.1) + "px)");\n';
        js += '          for(var ring = 1; ring <= 5; ring++){\n';
        js += '            var rd = ring * radius * 0.18;\n';
        js += '            var count = 4 + ring * 2;\n';
        js += '            var spd = t * (1.5 - ring * 0.2) * (ring % 2 === 0 ? -1 : 1);\n';
        js += '            for(var k = 0; k < count; k++){\n';
        js += '              var a = spd + k * 6.2832 / count;\n';
        js += '              var sz = 2 + (5 - ring) * 0.8;\n';
        js += '              masks.push("radial-gradient(circle " + sz + "px at " + (cx + Math.cos(a) * rd) + "px " + (cy + Math.sin(a) * rd) + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Norris — landonorris.com dot field with size falloff and scatter
        js += '        } else if(type === "norris"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.001;\n';
        js += '          var masks = [];\n';
        js += '          var count = 70;\n';
        js += '          for(var k = 0; k < count; k++){\n';
        js += '            var seed = k * 7.31 + 0.5;\n';
        js += '            var ang = seed * 2.399;\n';
        js += '            var spread = Math.sqrt(k / count) * radius * 1.3;\n';
        js += '            var px = cx + Math.cos(ang + t * 0.3 * Math.sin(seed)) * spread;\n';
        js += '            var py = cy + Math.sin(ang + t * 0.3 * Math.cos(seed)) * spread;\n';
        js += '            var distN = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));\n';
        js += '            var falloff = Math.max(0, 1 - distN / (radius * 1.4));\n';
        js += '            var sz = Math.max(1, falloff * 10 * (0.6 + 0.4 * Math.sin(t * 2 + k * 0.9)));\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + px + "px " + py + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Rain — falling vertical droplets
        js += '        } else if(type === "rain"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.003;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.3) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.3) + "px)");\n';
        js += '          for(var k = 0; k < 35; k++){\n';
        js += '            var seed = k * 3.14 + 0.7;\n';
        js += '            var bx = cx + (Math.sin(seed * 7.1) - 0.5) * radius * 2;\n';
        js += '            var fallY = ((t * (40 + Math.sin(seed) * 20) + seed * 100) % (h + 40)) - 20;\n';
        js += '            var ddx = cx - bx, ddy = cy - fallY;\n';
        js += '            var dist = Math.sqrt(ddx * ddx + ddy * ddy);\n';
        js += '            var sz = dist < radius ? 3 + (1 - dist / radius) * 5 : 2;\n';
        js += '            masks.push("radial-gradient(ellipse " + sz + "px " + (sz * 2.5) + "px at " + bx + "px " + fallY + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Scatter — random square-ish fragments
        js += '        } else if(type === "scatter"){\n';
        js += '          isMulti = true;\n';
        js += '          var masks = [];\n';
        js += '          var count = 24;\n';
        js += '          for(var k = 0; k < count; k++){\n';
        js += '            var seed = k * 5.17;\n';
        js += '            var a = seed * 2.399;\n';
        js += '            var d = Math.sqrt(k / count) * radius * 1.2;\n';
        js += '            var px = cx + Math.cos(a) * d;\n';
        js += '            var py = cy + Math.sin(a) * d;\n';
        js += '            var sz = 6 + (1 - d / (radius * 1.3)) * 14;\n';
        js += '            masks.push("linear-gradient(to right, " + co + " " + (px - sz) + "px, " + ci + " " + (px - sz) + "px, " + ci + " " + (px + sz) + "px, " + co + " " + (px + sz) + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // DNA — double helix dot strands
        js += '        } else if(type === "dna"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.002;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.15) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.15) + "px)");\n';
        js += '          for(var k = 0; k < 24; k++){\n';
        js += '            var off = (k - 12) * radius * 0.1;\n';
        js += '            var twist = Math.sin(t + k * 0.5) * radius * 0.25;\n';
        js += '            var sz = 3 + Math.abs(Math.cos(t + k * 0.5)) * 3;\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + (cx + twist) + "px " + (cy + off) + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '            masks.push("radial-gradient(circle " + sz + "px at " + (cx - twist) + "px " + (cy + off) + "px, " + ci + " 0px, " + co + " " + sz + "px)");\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        // Pulse — heartbeat expanding rings
        js += '        } else if(type === "pulse"){\n';
        js += '          isMulti = true;\n';
        js += '          var t = Date.now() * 0.003;\n';
        js += '          var masks = [];\n';
        js += '          masks.push("radial-gradient(circle " + (radius * 0.15) + "px at " + cx + "px " + cy + "px, " + ci + " 0px, " + co + " " + (radius * 0.15) + "px)");\n';
        js += '          for(var k = 0; k < 5; k++){\n';
        js += '            var phase = (t + k * 1.2) % 6.0;\n';
        js += '            var rd = phase * radius * 0.25;\n';
        js += '            var opacity = Math.max(0, 1 - phase / 6.0);\n';
        js += '            var thick = 3 + opacity * 4;\n';
        js += '            if(rd > 0){\n';
        js += '              masks.push("radial-gradient(circle " + (rd + thick) + "px at " + cx + "px " + cy + "px, " + co + " " + Math.max(0, rd - thick) + "px, " + ci + " " + rd + "px, " + ci + " " + (rd + thick * 0.3) + "px, " + co + " " + (rd + thick) + "px)");\n';
        js += '            }\n';
        js += '          }\n';
        js += '          mask = masks.join(", ");\n';

        js += '        }\n';
        js += '        if(mask){\n';
        js += '          tops.forEach(function(t){\n';
        js += '            t.style.webkitMaskImage = mask;\n';
        js += '            t.style.maskImage = mask;\n';
        js += '            if(isMulti && invert){\n';
        js += '              t.style.webkitMaskComposite = "source-in";\n';
        js += '              t.style.maskComposite = "intersect";\n';
        js += '            } else if(isMulti){\n';
        js += '              t.style.webkitMaskComposite = "source-over";\n';
        js += '              t.style.maskComposite = "add";\n';
        js += '            } else {\n';
        js += '              t.style.webkitMaskComposite = "";\n';
        js += '              t.style.maskComposite = "";\n';
        js += '            }\n';
        js += '          });\n';
        js += '        }\n';
        js += '      }\n';
        js += '      requestAnimationFrame(tick);\n';
        js += '    }\n';
        js += '    tick();\n';
        js += '  });\n\n';

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
        extractAssets: _extractAssets,
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
