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
        fadeInUp:       { opacity: [0, 1], y: [60, 0], start: 0, end: 0.4 },
        fadeInDown:     { opacity: [0, 1], y: [-60, 0], start: 0, end: 0.4 },
        fadeInLeft:     { opacity: [0, 1], x: [-80, 0], start: 0, end: 0.4 },
        fadeInRight:    { opacity: [0, 1], x: [80, 0], start: 0, end: 0.4 },
        scaleIn:        { opacity: [0, 1], scale: [0.8, 1], start: 0, end: 0.4 },
        scaleInUp:      { opacity: [0, 1], scale: [0.8, 1], y: [40, 0], start: 0, end: 0.4 },
        blurIn:         { opacity: [0, 1], blur: [20, 0], start: 0, end: 0.4 },
        blurInUp:       { opacity: [0, 1], blur: [15, 0], y: [40, 0], start: 0, end: 0.4 },
        blurInScale:    { opacity: [0, 1], blur: [12, 0], scale: [0.9, 1], start: 0, end: 0.45 },
        slideInUp:      { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], y: [20, 0], start: 0, end: 0.45 },
        slideInDown:    { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], y: [-20, 0], start: 0, end: 0.45 },
        slideInLeft:    { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], x: [-20, 0], start: 0, end: 0.45 },
        slideInRight:   { clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0%)'], x: [20, 0], start: 0, end: 0.45 },
        clipRevealUp:   { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'], start: 0, end: 0.5 },
        clipRevealDown: { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0% 0)'], start: 0, end: 0.5 },
        clipRevealLeft: { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], start: 0, end: 0.5 },
        clipRevealRight:{ clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0%)'], start: 0, end: 0.5 },
        rotateIn:       { opacity: [0, 1], rotation: [15, 0], scale: [0.9, 1], start: 0, end: 0.4 },
        rotateInLeft:   { opacity: [0, 1], rotation: [-15, 0], x: [-60, 0], start: 0, end: 0.45 },
        flipInX:        { opacity: [0, 1], rotateX: [90, 0], start: 0, end: 0.5 },
        flipInY:        { opacity: [0, 1], rotateY: [90, 0], start: 0, end: 0.5 },
        zoomIn:         { scale: [0.5, 1], opacity: [0, 1], start: 0, end: 0.5 },
        zoomOut:        { scale: [1.3, 1], opacity: [0, 1], start: 0, end: 0.5 },
        bounceIn:       { opacity: [0, 1], scale: [0.3, 1.05, 0.95, 1], y: [60, -10, 5, 0], start: 0, end: 0.5 },
        fadeOut:         { opacity: [1, 0], y: [0, -40], start: 0.6, end: 1 },
        fadeOutDown:     { opacity: [1, 0], y: [0, 60], start: 0.6, end: 1 },
        scaleOut:        { opacity: [1, 0], scale: [1, 0.8], start: 0.6, end: 1 },
        blurOut:         { opacity: [1, 0], blur: [0, 20], start: 0.6, end: 1 }
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
        if (seo.canonical) html += '<link rel="canonical" href="' + esc(seo.canonical) + '">\n';
        if (seo.favicon) html += '<link rel="icon" href="' + esc(seo.favicon) + '">\n';
        // Open Graph
        html += '<meta property="og:type" content="website">\n';
        html += '<meta property="og:title" content="' + esc(seoTitle) + '">\n';
        html += '<meta property="og:description" content="' + esc(seoDesc) + '">\n';
        if (seo.canonical) html += '<meta property="og:url" content="' + esc(seo.canonical) + '">\n';
        if (seo.ogImage) html += '<meta property="og:image" content="' + esc(seo.ogImage) + '">\n';
        // Twitter Card
        html += '<meta name="twitter:card" content="' + (seo.ogImage ? 'summary_large_image' : 'summary') + '">\n';
        html += '<meta name="twitter:title" content="' + esc(seoTitle) + '">\n';
        html += '<meta name="twitter:description" content="' + esc(seoDesc) + '">\n';
        if (seo.ogImage) html += '<meta name="twitter:image" content="' + esc(seo.ogImage) + '">\n';
        html += '<link rel="preconnect" href="https://fonts.googleapis.com">\n';
        html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';

        // Collect used font families from elements
        var usedFonts = { 'Inter': 'Inter:wght@300;400;500;600;700;800;900' };
        var fontMap = {
            'Space Mono': 'Space+Mono:wght@400;700',
            'Space Grotesk': 'Space+Grotesk:wght@300;400;500;600;700',
            'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800;900',
            'DM Sans': 'DM+Sans:wght@300;400;500;600;700',
            'DM Serif Display': 'DM+Serif+Display',
            'Sora': 'Sora:wght@300;400;500;600;700;800',
            'Outfit': 'Outfit:wght@300;400;500;600;700;800',
            'Poppins': 'Poppins:wght@300;400;500;600;700;800;900',
            'Montserrat': 'Montserrat:wght@300;400;500;600;700;800;900',
            'Raleway': 'Raleway:wght@300;400;500;600;700;800;900',
            'Oswald': 'Oswald:wght@300;400;500;600;700',
            'Lora': 'Lora:wght@400;500;600;700',
            'Merriweather': 'Merriweather:wght@300;400;700;900',
            'Roboto': 'Roboto:wght@300;400;500;700;900',
            'Open Sans': 'Open+Sans:wght@300;400;500;600;700;800',
            'Bebas Neue': 'Bebas+Neue',
            'Archivo Black': 'Archivo+Black',
            'Crimson Text': 'Crimson+Text:wght@400;600;700',
            'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
            'Fira Code': 'Fira+Code:wght@400;500;600;700'
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
                html += '    <a href="' + esc(link.href) + '" class="cne-nav-link" data-arbel-edit="text">' + esc(link.text) + '</a>\n';
            });
        }
        html += '  </div>\n';
        html += '  <div class="cne-scroll-progress"><div class="cne-scroll-progress-fill" id="scrollProgress"></div></div>\n';
        html += '</nav>\n\n';

        // Background canvas
        html += '<canvas id="bgCanvas" class="cne-bg-canvas"></canvas>\n\n';

        // Scenes
        html += '<main class="cne-scenes">\n';
        scenes.forEach(function (scene, i) {
            var sceneBg = '';
            if (scene.bgColor) sceneBg += 'background-color:' + esc(scene.bgColor) + ';';
            if (scene.bgImage) sceneBg += 'background-image:url(' + esc(scene.bgImage) + ');background-size:cover;background-position:center;';

            html += '  <section class="cne-scene"';
            html += ' data-scene-id="' + esc(scene.id) + '"';
            html += ' data-scene-index="' + i + '"';
            html += ' data-pin="' + (scene.pin !== false ? 'true' : 'false') + '"';
            html += ' data-duration="' + (scene.duration || 100) + '"';
            if (sceneBg) html += ' style="' + sceneBg + '"';
            html += '>\n';

            (scene.elements || []).forEach(function (el) {
                if (!el.visible) return;
                var validTags = ['h1','h2','h3','p','span','div','img','video','a','section','header','footer','nav','ul','li','ol'];
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
                    var allowedScrollKeys = {opacity:1,x:1,y:1,scale:1,rotation:1,blur:1,clipPath:1,rotateX:1,rotateY:1,skewX:1,skewY:1,start:1,end:1};
                    Object.keys(scrollKeys).forEach(function (k) {
                        if (!allowedScrollKeys[k]) return;
                        var v = scrollKeys[k];
                        if (k === 'start' || k === 'end') {
                            var n = parseFloat(v);
                            if (!isNaN(n)) safeScroll[k] = Math.max(0, Math.min(1, n));
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
                    var imgSrc = el.src ? esc(el.src) : '';
                    html += ' src="' + imgSrc + '" alt="' + esc(el.text || '') + '" loading="lazy"';
                    html += '>\n';
                } else if (tag === 'video') {
                    var vidSrc = el.src ? esc(el.src) : '';
                    html += (el.videoAutoplay !== false ? ' autoplay' : '');
                    html += (el.videoLoop !== false ? ' loop' : '');
                    html += (el.videoMuted !== false ? ' muted' : '');
                    html += ' playsinline';
                    if (vidSrc) html += ' src="' + vidSrc + '"';
                    html += '></video>\n';
                } else if (tag === 'a') {
                    var href = el.href ? esc(el.href) : '#';
                    html += ' href="' + href + '"';
                    if (el.linkNewTab) html += ' target="_blank" rel="noopener noreferrer"';
                    html += '>' + esc(el.text) + '</a>\n';
                } else {
                    // For button divs with href, wrap in anchor
                    if (el.href && el.href !== '#' && el.href !== '') {
                        html += '>' + esc(el.text) + '</' + tag + '>\n';
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
        html += '<script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"><\/script>\n';
        html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>\n';
        html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>\n';

        var cat = ArbelCompiler.getAnimCategory(cfg.style);
        if (cat === 'shader') {
            html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n';
            html += '<script src="js/shader.js"><\/script>\n';
        }

        html += '<script src="js/cinema.js"><\/script>\n';
        html += '<script src="js/main.js"><\/script>\n';

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

        var css = '/* Cinematic Mode — Generated by Arbel */\n\n';

        // Reset + Variables
        css += ':root {\n';
        css += '  --accent: ' + accent + ';\n';
        css += '  --bg: ' + bg + ';\n';
        css += '  --surface: ' + surface + ';\n';
        css += '  --fg: ' + fg + ';\n';
        css += '  --fg2: ' + fg2 + ';\n';
        css += '  --border: ' + border + ';\n';
        css += '  --font-body: "Inter", system-ui, -apple-system, sans-serif;\n';
        css += '  --font-display: "Instrument Serif", Georgia, serif;\n';
        css += '}\n\n';

        css += '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }\n';
        css += 'html { scroll-behavior: auto; }\n';
        css += 'body { font-family: var(--font-body); background: var(--bg); color: var(--fg); overflow-x: hidden; -webkit-font-smoothing: antialiased; }\n';
        css += '.mono { font-family: "Space Mono", "SF Mono", monospace; }\n\n';

        // Preloader
        css += '.cne-preloader { position: fixed; inset: 0; z-index: 9999; background: var(--bg); display: flex; align-items: center; justify-content: center; transition: opacity 0.6s, visibility 0.6s; }\n';
        css += '.cne-preloader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }\n';
        css += '.cne-preloader-inner { text-align: center; }\n';
        css += '.cne-preloader-text { font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--fg2); display: block; margin-bottom: 1.5rem; }\n';
        css += '.cne-preloader-bar { width: 200px; height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; }\n';
        css += '.cne-preloader-fill { width: 0%; height: 100%; background: var(--accent); transition: width 0.3s; }\n\n';

        // Navigation
        css += '.cne-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.2rem 2.5rem; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: rgba(10,10,15,0.5); border-bottom: 1px solid var(--border); transition: transform 0.4s; }\n';
        css += '.cne-nav.hidden { transform: translateY(-100%); }\n';
        css += '.cne-nav-logo { font-size: 1.1rem; font-weight: 700; color: var(--fg); text-decoration: none; letter-spacing: -0.02em; }\n';
        css += '.cne-nav-links { display: flex; gap: 2rem; }\n';
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
        css += '.cne-footer { padding: 3rem 2.5rem; text-align: center; color: var(--fg2); font-size: 0.8rem; letter-spacing: 0.1em; border-top: 1px solid var(--border); }\n\n';

        // Scrollbar
        css += '::-webkit-scrollbar { width: 6px; }\n';
        css += '::-webkit-scrollbar-track { background: transparent; }\n';
        css += '::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }\n';
        css += '::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }\n\n';

        // Utility classes
        css += '/* Utility classes */\n';
        css += '.cne-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }\n';
        css += '.cne-gradient-text { background: linear-gradient(135deg, ' + accent + ', #00CEC9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }\n';
        css += '.cne-glow { box-shadow: 0 0 60px rgba(108,92,231,0.15), 0 0 120px rgba(108,92,231,0.05); }\n';
        css += '.cne-noise::before { content: ""; position: fixed; inset: 0; z-index: 9000; pointer-events: none; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E"); }\n';
        css += '.cne-element[data-arbel-edit] { transition: outline 0.15s; }\n';
        css += '.cne-element[style*="backdrop-filter"] { -webkit-backdrop-filter: inherit; }\n\n';

        // Button styles
        css += '/* Button elements */\n';
        css += '.cne-element[style*="cursor: pointer"]:hover { opacity: 0.9; transform: scale(0.98); transition: opacity 0.2s, transform 0.2s; }\n\n';

        // Selection highlight
        css += '/* Selection */\n';
        css += '::selection { background: ' + accent + '; color: #fff; }\n\n';

        // Responsive
        css += '@media (max-width: 768px) {\n';
        css += '  .cne-nav { padding: 1rem 1.2rem; }\n';
        css += '  .cne-nav-links { display: none; }\n';
        css += '  .cne-element { font-size: 0.85em; }\n';
        css += '  .cne-scene { min-height: 80vh; }\n';
        css += '}\n';

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
        js += '      var endPct = sd.end || 1;\n\n';

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
        js += '          to.ease = "none";\n';
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
        js += '          to.ease = "none";\n';
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
        js += 'var vertShader = "void main(){gl_Position = vec4(position,1.0);}";\n';
        js += 'var fragShader = "precision mediump float; uniform float uTime; uniform vec2 uMouse; uniform vec2 uRes;\\n" + snoise + "\\n' + (frag.core || '').replace(/\n/g, '\\n').replace(/"/g, '\\"') + '";\n\n';

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
