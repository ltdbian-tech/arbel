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
   COMPILER — Template Engine
   
   Takes a config object from the wizard and
   compiles it into a complete static website
   (HTML + CSS + JS) ready to deploy.
   ═══════════════════════════════════════════════ */

window.ArbelCompiler = (function () {
    'use strict';

    /** Escape HTML entities to prevent XSS in generated output */
    function esc(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /** Sanitize a URL/href — block javascript: and data: (non-image) schemes */
    function escHref(str) {
        if (!str) return '';
        var trimmed = str.replace(/^\s+/, '').toLowerCase();
        if (/^\s*javascript\s*:/i.test(trimmed) || /^\s*vbscript\s*:/i.test(trimmed)) return '';
        if (/^\s*data\s*:/i.test(trimmed) && !/^\s*data:image\//i.test(trimmed)) return '';
        return esc(str);
    }

    /** Build full site config with defaults */
    function _defaults(cfg) {
        var d = Object.assign({
            brandName: 'My Site',
            tagline: '',
            style: 'obsidian',
            accent: '#6C5CE7',
            bgColor: '#0a0a0f',
            contactEmail: '',
            sections: ['hero', 'services', 'about', 'contact'],
            content: {},
            particles: { count: 120, speed: 1, glow: 0.6, interact: true, connect: true }
        }, cfg);
        return d;
    }

    /** Check if a style uses particles instead of shaders */
    function _isParticleStyle(style) {
        return _getAnimCategory(style) !== 'shader';
    }

    /** Get the CSS bg class for a style */
    function _getBgClass(style) {
        var cat = _getAnimCategory(style);
        if (cat === 'shader') return 'webgl-bg';
        return 'anim-bg';
    }

    /** Map animation category to JS filename */
    function _getAnimJsFile(cat) {
        var map = { shader: 'shader.js', particle: 'particles.js', blob: 'blobs.js', gradient: 'gradient.js', wave: 'waves.js' };
        return map[cat] || 'shader.js';
    }

    /* ─── SHADERS ─── */
    var SHADERS = {
        obsidian: {
            label: 'Obsidian', desc: 'DARK INK FLUID', tags: ['Premium', 'Mysterious', 'Luxury'],
            colors: { accent: '#6C5CE7', bg: '#0a0a0f', surface: '#12121a', fg: '#f0f0f0', fg2: '#a0a0b0', border: 'rgba(255,255,255,0.08)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.3;',
                'float n = snoise(vec3(uv * 2.5, t)) * 0.5;',
                'n += snoise(vec3(uv * 5.0, t * 1.3)) * 0.25;',
                'n += snoise(vec3(uv * 10.0, t * 0.7)) * 0.125;',
                'vec3 col = mix(vec3(0.02, 0.02, 0.06), vec3(0.15, 0.1, 0.35), n * 0.5 + 0.5);',
                'col += vec3(0.08, 0.05, 0.2) * smoothstep(0.3, 0.7, n);',
                'float mx = smoothstep(0.0, 0.5, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.1, 0.08, 0.25) * mx * 0.5;',
                'gl_FragColor = vec4(col, 1.0);'
            ].join('\n')
        },
        aurora: {
            label: 'Aurora', desc: 'NORTHERN LIGHTS', tags: ['Vibrant', 'Modern', 'Tech'],
            colors: { accent: '#00d4aa', bg: '#050a12', surface: '#0a1220', fg: '#e8f4f0', fg2: '#8cb0a8', border: 'rgba(255,255,255,0.06)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.25;',
                'float wave = sin(uv.x * 6.0 + t) * cos(uv.y * 4.0 + t * 0.7) * 0.5;',
                'float n = snoise(vec3(uv * 3.0 + wave, t)) * 0.6;',
                'n += snoise(vec3(uv * 6.0, t * 1.5)) * 0.3;',
                'vec3 c1 = vec3(0.0, 0.8, 0.65);',
                'vec3 c2 = vec3(0.1, 0.3, 0.9);',
                'vec3 c3 = vec3(0.4, 0.0, 0.8);',
                'vec3 col = mix(vec3(0.01, 0.02, 0.05), mix(c1, mix(c2, c3, uv.x), n * 0.5 + 0.5), smoothstep(-0.2, 0.8, n));',
                'float mx = smoothstep(0.0, 0.5, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.0, 0.15, 0.1) * mx;',
                'gl_FragColor = vec4(col * 0.6, 1.0);'
            ].join('\n')
        },
        ember: {
            label: 'Ember', desc: 'WARM PARTICLE FIELD', tags: ['Bold', 'Energetic', 'Food'],
            colors: { accent: '#E8610A', bg: '#0a0604', surface: '#14100c', fg: '#f5ebe0', fg2: '#b09880', border: 'rgba(255,200,150,0.08)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.35;',
                'float n = snoise(vec3(uv * 3.0, t)) * 0.5;',
                'n += snoise(vec3(uv * 7.0, t * 1.2)) * 0.3;',
                'n += snoise(vec3(uv * 12.0, t * 0.8)) * 0.15;',
                'vec3 c1 = vec3(0.9, 0.35, 0.05);',
                'vec3 c2 = vec3(0.6, 0.15, 0.0);',
                'vec3 col = mix(vec3(0.03, 0.01, 0.0), mix(c2, c1, smoothstep(-0.3, 0.6, n)), smoothstep(-0.1, 0.7, n));',
                'float mx = smoothstep(0.0, 0.5, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.2, 0.08, 0.0) * mx;',
                'gl_FragColor = vec4(col * 0.5, 1.0);'
            ].join('\n')
        },
        frost: {
            label: 'Frost', desc: 'COOL CRYSTALLINE', tags: ['Clean', 'Clinical', 'Finance'],
            colors: { accent: '#4facfe', bg: '#060a10', surface: '#0c1218', fg: '#e4eef8', fg2: '#7a9ab8', border: 'rgba(150,200,255,0.08)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.2;',
                'float n = snoise(vec3(uv * 4.0, t)) * 0.4;',
                'n += snoise(vec3(uv * 8.0, t * 0.6)) * 0.2;',
                'float crystal = abs(snoise(vec3(uv * 15.0, t * 0.3))) * 0.15;',
                'vec3 col = mix(vec3(0.01, 0.03, 0.06), vec3(0.2, 0.5, 0.9), smoothstep(-0.1, 0.6, n));',
                'col += vec3(0.3, 0.6, 1.0) * crystal;',
                'float mx = smoothstep(0.0, 0.5, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.1, 0.15, 0.25) * mx;',
                'gl_FragColor = vec4(col * 0.4, 1.0);'
            ].join('\n')
        },
        neon: {
            label: 'Neon', desc: 'ELECTRIC GLOW', tags: ['Edgy', 'Futuristic', 'Gaming'],
            colors: { accent: '#ff006e', bg: '#05020a', surface: '#100818', fg: '#f0e8f8', fg2: '#a080c0', border: 'rgba(255,100,200,0.08)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.4;',
                'float n = snoise(vec3(uv * 2.0, t)) * 0.5;',
                'float grid = smoothstep(0.48, 0.5, abs(fract(uv.x * 20.0) - 0.5)) + smoothstep(0.48, 0.5, abs(fract(uv.y * 20.0) - 0.5));',
                'grid *= 0.03;',
                'vec3 c1 = vec3(1.0, 0.0, 0.4);',
                'vec3 c2 = vec3(0.3, 0.0, 1.0);',
                'vec3 col = mix(vec3(0.01, 0.0, 0.03), mix(c2, c1, uv.x + n * 0.3), smoothstep(-0.2, 0.5, n) * 0.35);',
                'col += vec3(0.15, 0.05, 0.2) * grid;',
                'float mx = smoothstep(0.0, 0.4, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.15, 0.0, 0.08) * mx;',
                'gl_FragColor = vec4(col, 1.0);'
            ].join('\n')
        },
        silk: {
            label: 'Silk', desc: 'SOFT FLOWING', tags: ['Elegant', 'Minimal', 'Fashion'],
            colors: { accent: '#c4b5fd', bg: '#0a0a0e', surface: '#131318', fg: '#f0eef5', fg2: '#9090a8', border: 'rgba(200,180,255,0.08)' },
            fragmentCore: [
                'vec2 uv = vUv;',
                'float t = uTime * 0.15;',
                'float n = snoise(vec3(uv * 1.5, t)) * 0.6;',
                'n += snoise(vec3(uv * 3.0, t * 0.8)) * 0.3;',
                'vec3 c1 = vec3(0.75, 0.7, 1.0);',
                'vec3 c2 = vec3(0.95, 0.85, 0.9);',
                'vec3 col = mix(vec3(0.03, 0.03, 0.05), mix(c1, c2, uv.y + n * 0.2), smoothstep(-0.3, 0.5, n) * 0.25);',
                'float mx = smoothstep(0.0, 0.6, 1.0 - length(vUv - uMouse));',
                'col += vec3(0.08, 0.06, 0.12) * mx;',
                'gl_FragColor = vec4(col, 1.0);'
            ].join('\n')
        }
    };

    /* ─── PARTICLE STYLES ─── */
    var PARTICLES = {
        constellation: {
            label: 'Constellation', desc: 'CONNECTED STARS', tags: ['Tech','Clean','Futuristic'],
            colors: { accent: '#60a5fa', bg: '#06080f', surface: '#0c1018', fg: '#e8eef5', fg2: '#7090b0', border: 'rgba(100,160,255,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 120, baseColor: [96,165,250], bgGrad: ['#06080f','#0a1020'] }
        },
        fireflies: {
            label: 'Fireflies', desc: 'GLOWING FLOATS', tags: ['Warm','Organic','Ambient'],
            colors: { accent: '#fbbf24', bg: '#080a04', surface: '#10120c', fg: '#f5f0e0', fg2: '#a09870', border: 'rgba(250,190,40,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 0, baseColor: [251,191,36], bgGrad: ['#080a04','#0c1008'] }
        },
        snow: {
            label: 'Snow', desc: 'GENTLE SNOWFALL', tags: ['Calm','Pure','Seasonal'],
            colors: { accent: '#e2e8f0', bg: '#0a0e14', surface: '#10141c', fg: '#f0f2f5', fg2: '#8090a0', border: 'rgba(200,210,230,0.06)' },
            config: { shape: 'circle', glow: false, connectDist: 0, baseColor: [226,232,240], bgGrad: ['#0a0e14','#141820'] }
        },
        nebula: {
            label: 'Nebula', desc: 'COSMIC GLOW MESH', tags: ['Space','Premium','Creative'],
            colors: { accent: '#c084fc', bg: '#08060e', surface: '#12101a', fg: '#f0e8f8', fg2: '#9080b0', border: 'rgba(190,130,255,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 80, baseColor: [192,132,252], bgGrad: ['#08060e','#140e20'] }
        },
        matrix: {
            label: 'Matrix', desc: 'FALLING CODE RAIN', tags: ['Hacker','Cyber','Dev'],
            colors: { accent: '#22c55e', bg: '#030806', surface: '#081008', fg: '#d0f0d0', fg2: '#60a060', border: 'rgba(30,200,80,0.08)' },
            config: { shape: 'text', glow: true, connectDist: 0, baseColor: [34,197,94], bgGrad: ['#030806','#061008'] }
        },
        bokeh: {
            label: 'Bokeh', desc: 'DREAMY LIGHT ORBS', tags: ['Photography','Soft','Romantic'],
            colors: { accent: '#f472b6', bg: '#0c060a', surface: '#14101a', fg: '#f8e8f0', fg2: '#b08090', border: 'rgba(240,110,180,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 0, baseColor: [244,114,182], bgGrad: ['#0c060a','#180e18'] }
        },
        spark: {
            label: 'Spark', desc: 'ELECTRIC SPARKS', tags: ['Energy','Fast','Dynamic'],
            colors: { accent: '#facc15', bg: '#0a0804', surface: '#141008', fg: '#f5f0d0', fg2: '#b0a060', border: 'rgba(250,200,20,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 60, baseColor: [250,204,21], bgGrad: ['#0a0804','#141008'] }
        },
        plasma: {
            label: 'Plasma', desc: 'HOT PLASMA FIELD', tags: ['Sci-Fi','Intense','Bold'],
            colors: { accent: '#f97316', bg: '#0c0604', surface: '#180c08', fg: '#f5e8e0', fg2: '#b08060', border: 'rgba(250,120,20,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 100, baseColor: [249,115,22], bgGrad: ['#0c0604','#180c08'] }
        },
        stardust: {
            label: 'Stardust', desc: 'COSMIC DUST TRAIL', tags: ['Space','Dreamy','Portfolio'],
            colors: { accent: '#a78bfa', bg: '#080610', surface: '#100c18', fg: '#ece8f5', fg2: '#8878a8', border: 'rgba(170,140,250,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 40, baseColor: [167,139,250], bgGrad: ['#080610','#100c20'] }
        },
        rain: {
            label: 'Rain', desc: 'FALLING RAIN DROPS', tags: ['Moody','Dark','Immersive'],
            colors: { accent: '#94a3b8', bg: '#0a0c10', surface: '#10121a', fg: '#e8eaf0', fg2: '#8090a0', border: 'rgba(150,165,185,0.06)' },
            config: { shape: 'line', glow: false, connectDist: 0, baseColor: [148,163,184], bgGrad: ['#0a0c10','#141620'] }
        },
        vortex: {
            label: 'Vortex', desc: 'SPINNING SPIRAL', tags: ['Abstract','Motion','Creative'],
            colors: { accent: '#06b6d4', bg: '#040a0e', surface: '#081218', fg: '#e0f0f5', fg2: '#70a0b0', border: 'rgba(6,180,210,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 70, baseColor: [6,182,212], bgGrad: ['#040a0e','#081420'] }
        },
        circuits: {
            label: 'Circuits', desc: 'CIRCUIT BOARD LINES', tags: ['Tech','Hardware','Dev'],
            colors: { accent: '#34d399', bg: '#040a08', surface: '#081410', fg: '#e0f5e8', fg2: '#60a080', border: 'rgba(50,210,150,0.08)' },
            config: { shape: 'square', glow: true, connectDist: 100, baseColor: [52,211,153], bgGrad: ['#040a08','#081810'] }
        },
        confetti: {
            label: 'Confetti', desc: 'CELEBRATION BURST', tags: ['Fun','Events','Colorful'],
            colors: { accent: '#f472b6', bg: '#0c080e', surface: '#141018', fg: '#f5e8f0', fg2: '#a080a0', border: 'rgba(240,110,180,0.08)' },
            config: { shape: 'rect', glow: false, connectDist: 0, baseColor: [244,114,182], bgGrad: ['#0c080e','#140e18'], multi: true }
        },
        galaxy: {
            label: 'Galaxy', desc: 'SPIRAL GALAXY', tags: ['Space','Epic','Premium'],
            colors: { accent: '#818cf8', bg: '#06040c', surface: '#0e0a16', fg: '#eae8f5', fg2: '#8080b0', border: 'rgba(130,140,250,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 50, baseColor: [129,140,248], bgGrad: ['#06040c','#0e0a1c'] }
        }
    };

    /* ─── BLOB STYLES ─── */
    var BLOBS = {
        morphBlob: {
            label: 'Morph Blob', desc: 'ORGANIC MORPHING', tags: ['Modern','Startup','Clean'],
            colors: { accent: '#8b5cf6', bg: '#0a0a12', surface: '#12121c', fg: '#f0f0f5', fg2: '#9090b0', border: 'rgba(140,90,250,0.08)' },
            config: { count: 3, blur: 60, speed: 0.8, baseColors: ['#8b5cf6','#3b82f6','#ec4899'], bgGrad: ['#0a0a12','#0c0c18'] }
        },
        lavaLamp: {
            label: 'Lava Lamp', desc: 'RETRO LAVA FLOW', tags: ['Retro','Warm','Playful'],
            colors: { accent: '#f97316', bg: '#0c0804', surface: '#180e08', fg: '#f5e8d8', fg2: '#b09060', border: 'rgba(250,120,20,0.08)' },
            config: { count: 4, blur: 80, speed: 0.5, baseColors: ['#f97316','#ef4444','#eab308','#f472b6'], bgGrad: ['#0c0804','#180c06'] }
        },
        auroraBlob: {
            label: 'Aurora Blob', desc: 'NORTHERN GLOW FIELDS', tags: ['Premium','Nature','Elegant'],
            colors: { accent: '#34d399', bg: '#040a08', surface: '#081210', fg: '#e0f5e8', fg2: '#60a080', border: 'rgba(50,210,150,0.08)' },
            config: { count: 3, blur: 70, speed: 0.6, baseColors: ['#34d399','#06b6d4','#22d3ee'], bgGrad: ['#040a08','#061410'] }
        },
        sunsetBlob: {
            label: 'Sunset Blob', desc: 'WARM SUNSET GLOW', tags: ['Warm','Fashion','Lifestyle'],
            colors: { accent: '#fb923c', bg: '#0c0806', surface: '#180e08', fg: '#f5e8d0', fg2: '#b09060', border: 'rgba(250,150,60,0.08)' },
            config: { count: 3, blur: 65, speed: 0.7, baseColors: ['#fb923c','#f472b6','#a855f7'], bgGrad: ['#0c0806','#140a08'] }
        },
        oceanBlob: {
            label: 'Ocean Blob', desc: 'DEEP OCEAN FLOW', tags: ['Calm','Corporate','SaaS'],
            colors: { accent: '#0ea5e9', bg: '#040810', surface: '#081018', fg: '#e0eaf5', fg2: '#6080b0', border: 'rgba(14,165,230,0.08)' },
            config: { count: 4, blur: 75, speed: 0.5, baseColors: ['#0ea5e9','#3b82f6','#6366f1','#06b6d4'], bgGrad: ['#040810','#060c1a'] }
        },
        cosmicBlob: {
            label: 'Cosmic Blob', desc: 'COSMIC NEBULA BLOBS', tags: ['Space','Creative','Dark'],
            colors: { accent: '#c084fc', bg: '#08060e', surface: '#12101a', fg: '#f0e8f5', fg2: '#9080b0', border: 'rgba(190,130,250,0.08)' },
            config: { count: 5, blur: 90, speed: 0.4, baseColors: ['#c084fc','#818cf8','#f472b6','#a855f7','#6366f1'], bgGrad: ['#08060e','#100a18'] }
        }
    };

    /* ─── GRADIENT STYLES ─── */
    var GRADIENTS = {
        meshGrad: {
            label: 'Mesh Gradient', desc: 'ANIMATED MESH', tags: ['Apple','Modern','SaaS'],
            colors: { accent: '#8b5cf6', bg: '#0a0a14', surface: '#12121e', fg: '#f0f0f5', fg2: '#9090b0', border: 'rgba(140,90,250,0.08)' },
            config: { stops: ['#8b5cf6','#3b82f6','#ec4899','#06b6d4'], speed: 0.6, type: 'mesh', bgGrad: ['#0a0a14','#06060e'] }
        },
        noiseGrad: {
            label: 'Noise Gradient', desc: 'ORGANIC NOISE FLOW', tags: ['Abstract','Minimal','Art'],
            colors: { accent: '#a78bfa', bg: '#080810', surface: '#101018', fg: '#ece8f5', fg2: '#8878a8', border: 'rgba(170,140,250,0.08)' },
            config: { stops: ['#a78bfa','#818cf8','#c084fc'], speed: 0.4, type: 'noise', bgGrad: ['#080810','#0c0c18'] }
        },
        prism: {
            label: 'Prism', desc: 'RAINBOW REFRACT', tags: ['Colorful','Creative','Portfolio'],
            colors: { accent: '#f472b6', bg: '#0a0810', surface: '#141018', fg: '#f5e8f0', fg2: '#a080a0', border: 'rgba(240,110,180,0.08)' },
            config: { stops: ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'], speed: 0.5, type: 'prism', bgGrad: ['#0a0810','#0e0a14'] }
        },
        iridescent: {
            label: 'Iridescent', desc: 'HOLOGRAPHIC SHEEN', tags: ['Futuristic','Fashion','Luxury'],
            colors: { accent: '#67e8f9', bg: '#060a0e', surface: '#0c1218', fg: '#e0f0f5', fg2: '#70a0b0', border: 'rgba(100,230,250,0.06)' },
            config: { stops: ['#67e8f9','#a78bfa','#f472b6','#34d399'], speed: 0.7, type: 'mesh', bgGrad: ['#060a0e','#0a0e16'] }
        },
        northern: {
            label: 'Northern Lights', desc: 'AURORA BOREALIS GRAD', tags: ['Nature','Calm','Premium'],
            colors: { accent: '#34d399', bg: '#040a08', surface: '#081210', fg: '#e0f5e8', fg2: '#60a080', border: 'rgba(50,210,150,0.08)' },
            config: { stops: ['#34d399','#06b6d4','#8b5cf6'], speed: 0.3, type: 'noise', bgGrad: ['#040a08','#081410'] }
        }
    };

    /* ─── WAVE STYLES ─── */
    var WAVES = {
        sineWaves: {
            label: 'Sine Waves', desc: 'FLOWING SINE CURVES', tags: ['Music','Calm','Elegant'],
            colors: { accent: '#3b82f6', bg: '#060810', surface: '#0c1018', fg: '#e0e8f5', fg2: '#7088b0', border: 'rgba(60,130,250,0.08)' },
            config: { layers: 4, amplitude: 0.15, speed: 0.8, colors: ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe'], bgGrad: ['#060810','#0a1020'] }
        },
        topology: {
            label: 'Topology', desc: 'TOPOGRAPHIC LINES', tags: ['Minimal','Cartography','Dev'],
            colors: { accent: '#a3e635', bg: '#0a0c08', surface: '#121408', fg: '#f0f2e8', fg2: '#90a060', border: 'rgba(160,230,50,0.06)' },
            config: { layers: 8, amplitude: 0.08, speed: 0.3, colors: ['#a3e635','#84cc16','#65a30d','#4d7c0f'], bgGrad: ['#0a0c08','#0e1008'] }
        },
        ripple: {
            label: 'Ripple', desc: 'WATER RIPPLE RINGS', tags: ['Zen','Calm','Wellness'],
            colors: { accent: '#06b6d4', bg: '#040a0e', surface: '#081218', fg: '#e0f0f5', fg2: '#70a0b0', border: 'rgba(6,180,210,0.08)' },
            config: { layers: 5, amplitude: 0.12, speed: 0.5, colors: ['#06b6d4','#22d3ee','#67e8f9','#a5f3fc'], bgGrad: ['#040a0e','#081420'] }
        },
        liquidWave: {
            label: 'Liquid Wave', desc: 'THICK LIQUID MOTION', tags: ['Bold','Abstract','Creative'],
            colors: { accent: '#ec4899', bg: '#0c060a', surface: '#18101a', fg: '#f5e0e8', fg2: '#b07080', border: 'rgba(236,72,153,0.08)' },
            config: { layers: 3, amplitude: 0.25, speed: 1.0, colors: ['#ec4899','#f472b6','#f9a8d4'], bgGrad: ['#0c060a','#180e18'] }
        }
    };

    /* ─── All non-shader categories ─── */
    var ANIM_CATEGORIES = {
        particle: PARTICLES,
        blob: BLOBS,
        gradient: GRADIENTS,
        wave: WAVES
    };

    /** Determine animation category for a style ID */
    function _getAnimCategory(style) {
        if (PARTICLES[style]) return 'particle';
        if (BLOBS[style]) return 'blob';
        if (GRADIENTS[style]) return 'gradient';
        if (WAVES[style]) return 'wave';
        return 'shader';
    }

    /** Get the style config regardless of category */
    function _getStyleConfig(style) {
        return PARTICLES[style] || BLOBS[style] || GRADIENTS[style] || WAVES[style] || SHADERS[style] || SHADERS.obsidian;
    }

    /* ─── SNOISE GLSL (shared) ─── */
    var SNOISE_GLSL = [
        'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
        'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
        'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
        'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
        'float snoise(vec3 v){',
        '  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
        '  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
        '  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;',
        '  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
        '  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
        '  i=mod289(i);',
        '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
        '  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
        '  vec4 j=p-49.0*floor(p*ns.z*ns.z);',
        '  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);',
        '  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;',
        '  vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
        '  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;',
        '  vec4 sh=-step(h,vec4(0.0));',
        '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
        '  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);',
        '  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
        '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
        '  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
        '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);',
        '  m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
        '}'
    ].join('\n');

    /* ─── Generate shader.js for the selected style ─── */
    function _buildShaderJS(style) {
        var shader = SHADERS[style] || SHADERS.obsidian;
        return '/* WebGL Shader — ' + style + ' */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'var surfaces=document.querySelectorAll(".webgl-bg");\n' +
            'if(!surfaces.length||!window.THREE)return;\n' +
            'var mouse={x:0.5,y:0.5},target={x:0.5,y:0.5};\n' +
            'document.addEventListener("mousemove",function(e){\n' +
            '  target.x=e.clientX/window.innerWidth;\n' +
            '  target.y=1.0-e.clientY/window.innerHeight;\n' +
            '},{passive:true});\n\n' +
            'var vertSrc="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";\n\n' +
            'var fragSrc="precision mediump float;\\n"+\n' +
            '"uniform float uTime;\\n"+\n' +
            '"uniform vec2 uMouse;\\n"+\n' +
            '"varying vec2 vUv;\\n"+\n' +
            '"' + SNOISE_GLSL.replace(/\n/g, '\\n"+\n"') + '\\n"+\n' +
            '"void main(){\\n"+\n' +
            '"' + shader.fragmentCore.replace(/\n/g, '\\n"+\n"') + '\\n"+\n' +
            '"}";\n\n' +
            'surfaces.forEach(function(el){\n' +
            '  var w=el.offsetWidth,h=el.offsetHeight;\n' +
            '  var renderer=new THREE.WebGLRenderer({alpha:true,antialias:false});\n' +
            '  renderer.setSize(w,h);\n' +
            '  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));\n' +
            '  el.appendChild(renderer.domElement);\n' +
            '  var scene=new THREE.Scene();\n' +
            '  var camera=new THREE.OrthographicCamera(-0.5,0.5,0.5,-0.5,0.1,10);\n' +
            '  camera.position.z=1;\n' +
            '  var uniforms={uTime:{value:0},uMouse:{value:new THREE.Vector2(0.5,0.5)}};\n' +
            '  var mat=new THREE.ShaderMaterial({vertexShader:vertSrc,fragmentShader:fragSrc,uniforms:uniforms});\n' +
            '  var mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);\n' +
            '  scene.add(mesh);\n' +
            '  var obs=new IntersectionObserver(function(entries){\n' +
            '    entries.forEach(function(e){el._vis=e.isIntersecting;});\n' +
            '  },{threshold:0});\n' +
            '  obs.observe(el);el._vis=true;\n' +
            '  function tick(t){\n' +
            '    requestAnimationFrame(tick);\n' +
            '    if(!el._vis)return;\n' +
            '    mouse.x+=(target.x-mouse.x)*0.05;\n' +
            '    mouse.y+=(target.y-mouse.y)*0.05;\n' +
            '    uniforms.uTime.value=t*0.001;\n' +
            '    uniforms.uMouse.value.set(mouse.x,mouse.y);\n' +
            '    renderer.render(scene,camera);\n' +
            '  }\n' +
            '  requestAnimationFrame(tick);\n' +
            '  window.addEventListener("resize",function(){\n' +
            '    var nw=el.offsetWidth,nh=el.offsetHeight;\n' +
            '    renderer.setSize(nw,nh);\n' +
            '  });\n' +
            '});\n' +
            '})();';
    }

    /* ─── Particle Engine JS builder ─── */
    function _buildParticlesJS(style, pCfg, bgColor) {
        var p = PARTICLES[style] || PARTICLES.constellation;
        var c = p.config;
        var count = pCfg.count || 120;
        var speed = pCfg.speed || 1;
        var glow = pCfg.glow || 0.6;
        var interact = pCfg.interact !== false;
        var connect = pCfg.connect !== false && c.connectDist > 0;
        var isMatrix = c.shape === 'text';

        return '/* Particle Engine — ' + style + ' */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'var surfaces=document.querySelectorAll(".anim-bg");\n' +
            'if(!surfaces.length)return;\n' +
            'var mx=0.5,my=0.5;\n' +
            'document.addEventListener("mousemove",function(e){\n' +
            '  mx=e.clientX/window.innerWidth;\n' +
            '  my=e.clientY/window.innerHeight;\n' +
            '},{passive:true});\n\n' +
            'surfaces.forEach(function(el){\n' +
            '  var canvas=document.createElement("canvas");\n' +
            '  canvas.style.cssText="width:100%;height:100%;display:block;";\n' +
            '  el.appendChild(canvas);\n' +
            '  var ctx=canvas.getContext("2d");\n' +
            '  var W,H,dpr=Math.min(window.devicePixelRatio,2);\n' +
            '  var particles=[];\n' +
            '  var COUNT=' + count + ';\n' +
            '  var SPEED=' + speed + ';\n' +
            '  var GLOW=' + glow + ';\n' +
            '  var CONNECT=' + (connect ? 'true' : 'false') + ';\n' +
            '  var INTERACT=' + (interact ? 'true' : 'false') + ';\n' +
            '  var CDIST=' + (c.connectDist || 0) + ';\n' +
            '  var BASE=[' + c.baseColor.join(',') + '];\n\n' +
            (isMatrix ?
                '  var chars="01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";\n' +
                '  function rChar(){return chars[Math.floor(Math.random()*chars.length)];}\n\n' :
                '') +
            '  function resize(){\n' +
            '    W=el.offsetWidth;H=el.offsetHeight;\n' +
            '    canvas.width=W*dpr;canvas.height=H*dpr;\n' +
            '    ctx.setTransform(dpr,0,0,dpr,0,0);\n' +
            '  }\n\n' +
            '  function spawn(){\n' +
            '    particles=[];\n' +
            '    for(var i=0;i<COUNT;i++){\n' +
            (isMatrix ?
                '      particles.push({x:Math.random()*W,y:Math.random()*H-H,\n' +
                '        vy:0.5+Math.random()*2*SPEED,size:8+Math.random()*10,\n' +
                '        ch:rChar(),tick:Math.random()*60|0,alpha:0.15+Math.random()*0.7});\n' :
                '      var r=1+Math.random()*3;\n' +
                '      particles.push({x:Math.random()*W,y:Math.random()*H,\n' +
                '        vx:(Math.random()-0.5)*0.5*SPEED,vy:(Math.random()-0.5)*0.5*SPEED,\n' +
                '        r:r,baseR:r,alpha:0.2+Math.random()*0.6,\n' +
                '        pulse:Math.random()*Math.PI*2,pulseSpeed:0.01+Math.random()*0.03});\n') +
            '    }\n' +
            '  }\n\n' +
            '  function draw(){\n' +
            '    ctx.clearRect(0,0,W,H);\n' +
            // Gradient background
            '    var grad=ctx.createLinearGradient(0,0,0,H);\n' +
            '    grad.addColorStop(0,"' + c.bgGrad[0] + '");\n' +
            '    grad.addColorStop(1,"' + c.bgGrad[1] + '");\n' +
            '    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);\n\n' +
            (isMatrix ?
                // Matrix rain
                '    particles.forEach(function(p){\n' +
                '      p.y+=p.vy;\n' +
                '      p.tick++;\n' +
                '      if(p.tick%6===0)p.ch=rChar();\n' +
                '      if(p.y>H){p.y=-20;p.x=Math.random()*W;}\n' +
                '      ctx.font=p.size+"px monospace";\n' +
                '      if(GLOW>0.2){ctx.shadowBlur=p.size*GLOW;ctx.shadowColor="rgba("+BASE.join(",")+",0.8)";}\n' +
                '      ctx.fillStyle="rgba("+BASE.join(",")+","+p.alpha+")";\n' +
                '      ctx.fillText(p.ch,p.x,p.y);\n' +
                '      ctx.shadowBlur=0;\n' +
                '    });\n' :
                // Circle particles
                '    if(CONNECT&&CDIST>0){\n' +
                '      for(var i=0;i<particles.length;i++){\n' +
                '        for(var j=i+1;j<particles.length;j++){\n' +
                '          var dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y;\n' +
                '          var d=Math.sqrt(dx*dx+dy*dy);\n' +
                '          if(d<CDIST){\n' +
                '            ctx.strokeStyle="rgba("+BASE.join(",")+","+(1-d/CDIST)*0.15+")";\n' +
                '            ctx.lineWidth=0.5;\n' +
                '            ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);\n' +
                '            ctx.lineTo(particles[j].x,particles[j].y);ctx.stroke();\n' +
                '          }\n' +
                '        }\n' +
                '      }\n' +
                '    }\n' +
                '    particles.forEach(function(p){\n' +
                '      p.pulse+=p.pulseSpeed;\n' +
                '      p.r=p.baseR*(0.8+Math.sin(p.pulse)*0.3);\n' +
                '      p.x+=p.vx;p.y+=p.vy;\n' +
                '      if(INTERACT){\n' +
                '        var dx=mx*W-p.x,dy=my*H-p.y;\n' +
                '        var d=Math.sqrt(dx*dx+dy*dy);\n' +
                '        if(d<150){var f=0.02*(1-d/150);p.vx+=dx*f;p.vy+=dy*f;}\n' +
                '      }\n' +
                '      p.vx*=0.99;p.vy*=0.99;\n' +
                '      if(p.x<-10)p.x=W+10;if(p.x>W+10)p.x=-10;\n' +
                '      if(p.y<-10)p.y=H+10;if(p.y>H+10)p.y=-10;\n' +
                '      if(GLOW>0.2){ctx.shadowBlur=p.r*4*GLOW;ctx.shadowColor="rgba("+BASE.join(",")+",0.6)";}\n' +
                '      ctx.beginPath();\n' +
                '      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);\n' +
                '      ctx.fillStyle="rgba("+BASE.join(",")+","+p.alpha+")";\n' +
                '      ctx.fill();ctx.shadowBlur=0;\n' +
                '    });\n') +
            '  }\n\n' +
            '  var vis=true;\n' +
            '  var obs=new IntersectionObserver(function(entries){\n' +
            '    entries.forEach(function(e){vis=e.isIntersecting;});\n' +
            '  },{threshold:0});\n' +
            '  obs.observe(el);\n\n' +
            '  function tick(){requestAnimationFrame(tick);if(!vis)return;draw();}\n' +
            '  resize();spawn();tick();\n' +
            '  window.addEventListener("resize",function(){resize();spawn();});\n' +
            '});\n' +
            '})();';
    }

    /* ─── Blob Engine JS builder ─── */
    function _buildBlobsJS(style, userCfg, bgColor) {
        var b = BLOBS[style] || BLOBS.morphBlob;
        var c = b.config;
        var count = (userCfg && userCfg.count) || c.count;
        var blur = (userCfg && userCfg.blur) || c.blur;
        var speed = (userCfg && userCfg.speed) || c.speed;
        var colorsArr = JSON.stringify(c.baseColors);
        var bg0 = bgColor || c.bgGrad[0];
        var bg1 = bgColor || c.bgGrad[1];

        return '/* Blob Animation — ' + style + ' */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'var surfaces=document.querySelectorAll(".anim-bg");\n' +
            'if(!surfaces.length)return;\n' +
            'surfaces.forEach(function(el){\n' +
            '  var canvas=document.createElement("canvas");\n' +
            '  canvas.style.cssText="width:100%;height:100%;display:block;";\n' +
            '  el.appendChild(canvas);\n' +
            '  var ctx=canvas.getContext("2d");\n' +
            '  var W,H,dpr=Math.min(window.devicePixelRatio,2);\n' +
            '  var COLORS=' + colorsArr + ';\n' +
            '  var COUNT=' + count + ';\n' +
            '  var BLUR=' + blur + ';\n' +
            '  var SPEED=' + speed + ';\n' +
            '  var blobs=[];\n\n' +
            '  function resize(){\n' +
            '    W=el.offsetWidth;H=el.offsetHeight;\n' +
            '    canvas.width=W*dpr;canvas.height=H*dpr;\n' +
            '    ctx.setTransform(dpr,0,0,dpr,0,0);\n' +
            '  }\n\n' +
            '  function spawn(){\n' +
            '    blobs=[];\n' +
            '    for(var i=0;i<COUNT;i++){\n' +
            '      blobs.push({x:W*0.2+Math.random()*W*0.6,y:H*0.2+Math.random()*H*0.6,\n' +
            '        r:Math.min(W,H)*0.15+Math.random()*Math.min(W,H)*0.2,\n' +
            '        vx:(Math.random()-0.5)*0.6*SPEED,vy:(Math.random()-0.5)*0.6*SPEED,\n' +
            '        color:COLORS[i%COLORS.length],phase:Math.random()*Math.PI*2});\n' +
            '    }\n' +
            '  }\n\n' +
            '  function draw(){\n' +
            '    var grad=ctx.createLinearGradient(0,0,0,H);\n' +
            '    grad.addColorStop(0,"' + bg0 + '");\n' +
            '    grad.addColorStop(1,"' + bg1 + '");\n' +
            '    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);\n' +
            '    ctx.filter="blur("+BLUR+"px)";\n' +
            '    blobs.forEach(function(b){\n' +
            '      b.phase+=0.008*SPEED;\n' +
            '      b.x+=b.vx+Math.sin(b.phase)*0.5;\n' +
            '      b.y+=b.vy+Math.cos(b.phase*0.7)*0.5;\n' +
            '      if(b.x<-b.r)b.x=W+b.r;if(b.x>W+b.r)b.x=-b.r;\n' +
            '      if(b.y<-b.r)b.y=H+b.r;if(b.y>H+b.r)b.y=-b.r;\n' +
            '      var rg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);\n' +
            '      rg.addColorStop(0,b.color+"cc");\n' +
            '      rg.addColorStop(1,b.color+"00");\n' +
            '      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);\n' +
            '      ctx.fillStyle=rg;ctx.fill();\n' +
            '    });\n' +
            '    ctx.filter="none";\n' +
            '  }\n\n' +
            '  var vis=true;\n' +
            '  var obs=new IntersectionObserver(function(e){e.forEach(function(en){vis=en.isIntersecting;});},{threshold:0});\n' +
            '  obs.observe(el);\n' +
            '  function tick(){requestAnimationFrame(tick);if(!vis)return;draw();}\n' +
            '  resize();spawn();tick();\n' +
            '  window.addEventListener("resize",function(){resize();spawn();});\n' +
            '});\n' +
            '})();';
    }

    /* ─── Gradient Engine JS builder ─── */
    function _buildGradientJS(style, userCfg, bgColor) {
        var g = GRADIENTS[style] || GRADIENTS.meshGrad;
        var c = g.config;
        var speed = (userCfg && userCfg.speed) || c.speed;
        var stopsArr = JSON.stringify(c.stops);

        return '/* Gradient Animation — ' + style + ' */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'var surfaces=document.querySelectorAll(".anim-bg");\n' +
            'if(!surfaces.length)return;\n' +
            'surfaces.forEach(function(el){\n' +
            '  var canvas=document.createElement("canvas");\n' +
            '  canvas.style.cssText="width:100%;height:100%;display:block;";\n' +
            '  el.appendChild(canvas);\n' +
            '  var ctx=canvas.getContext("2d");\n' +
            '  var W,H,dpr=Math.min(window.devicePixelRatio,2);\n' +
            '  var STOPS=' + stopsArr + ';\n' +
            '  var SPEED=' + speed + ';\n' +
            '  var t=0;\n\n' +
            '  function resize(){\n' +
            '    W=el.offsetWidth;H=el.offsetHeight;\n' +
            '    canvas.width=W*dpr;canvas.height=H*dpr;\n' +
            '    ctx.setTransform(dpr,0,0,dpr,0,0);\n' +
            '  }\n\n' +
            '  function hexToRgb(hex){\n' +
            '    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);\n' +
            '    return[r,g,b];\n' +
            '  }\n\n' +
            '  function draw(){\n' +
            '    t+=0.005*SPEED;\n' +
            '    var grad=ctx.createLinearGradient(0,0,0,H);\n' +
            '    grad.addColorStop(0,"' + c.bgGrad[0] + '");\n' +
            '    grad.addColorStop(1,"' + c.bgGrad[1] + '");\n' +
            '    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);\n' +
            '    ctx.filter="blur(40px)";\n' +
            '    for(var i=0;i<STOPS.length;i++){\n' +
            '      var angle=t+i*(Math.PI*2/STOPS.length);\n' +
            '      var cx=W*0.5+Math.cos(angle)*W*0.3;\n' +
            '      var cy=H*0.5+Math.sin(angle*0.7)*H*0.3;\n' +
            '      var r=Math.min(W,H)*0.3;\n' +
            '      var rg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);\n' +
            '      rg.addColorStop(0,STOPS[i]+"99");\n' +
            '      rg.addColorStop(1,STOPS[i]+"00");\n' +
            '      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);\n' +
            '      ctx.fillStyle=rg;ctx.fill();\n' +
            '    }\n' +
            '    ctx.filter="none";\n' +
            '  }\n\n' +
            '  var vis=true;\n' +
            '  var obs=new IntersectionObserver(function(e){e.forEach(function(en){vis=en.isIntersecting;});},{threshold:0});\n' +
            '  obs.observe(el);\n' +
            '  function tick(){requestAnimationFrame(tick);if(!vis)return;draw();}\n' +
            '  resize();tick();\n' +
            '  window.addEventListener("resize",function(){resize();});\n' +
            '});\n' +
            '})();';
    }

    /* ─── Wave Engine JS builder ─── */
    function _buildWaveJS(style, userCfg, bgColor) {
        var w = WAVES[style] || WAVES.sineWaves;
        var c = w.config;
        var layers = (userCfg && userCfg.layers) || c.layers;
        var amplitude = (userCfg && userCfg.amplitude) || c.amplitude;
        var speed = (userCfg && userCfg.speed) || c.speed;
        var colorsArr = JSON.stringify(c.colors);
        var wBg0 = bgColor || c.bgGrad[0];
        var wBg1 = bgColor || c.bgGrad[1];

        return '/* Wave Animation — ' + style + ' */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'var surfaces=document.querySelectorAll(".anim-bg");\n' +
            'if(!surfaces.length)return;\n' +
            'surfaces.forEach(function(el){\n' +
            '  var canvas=document.createElement("canvas");\n' +
            '  canvas.style.cssText="width:100%;height:100%;display:block;";\n' +
            '  el.appendChild(canvas);\n' +
            '  var ctx=canvas.getContext("2d");\n' +
            '  var W,H,dpr=Math.min(window.devicePixelRatio,2);\n' +
            '  var COLORS=' + colorsArr + ';\n' +
            '  var LAYERS=' + layers + ';\n' +
            '  var AMP=' + amplitude + ';\n' +
            '  var SPEED=' + speed + ';\n' +
            '  var t=0;\n\n' +
            '  function resize(){\n' +
            '    W=el.offsetWidth;H=el.offsetHeight;\n' +
            '    canvas.width=W*dpr;canvas.height=H*dpr;\n' +
            '    ctx.setTransform(dpr,0,0,dpr,0,0);\n' +
            '  }\n\n' +
            '  function draw(){\n' +
            '    t+=0.01*SPEED;\n' +
            '    var grad=ctx.createLinearGradient(0,0,0,H);\n' +
            '    grad.addColorStop(0,"' + wBg0 + '");\n' +
            '    grad.addColorStop(1,"' + wBg1 + '");\n' +
            '    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);\n' +
            '    for(var l=0;l<LAYERS;l++){\n' +
            '      var color=COLORS[l%COLORS.length];\n' +
            '      var baseY=H*(0.4+l*0.12);\n' +
            '      var freq=2+l*0.5;\n' +
            '      var amp=H*AMP*(1-l*0.1);\n' +
            '      ctx.beginPath();\n' +
            '      ctx.moveTo(0,H);\n' +
            '      for(var x=0;x<=W;x+=3){\n' +
            '        var y=baseY+Math.sin(x/W*freq*Math.PI+t+l*0.8)*amp;\n' +
            '        y+=Math.sin(x/W*freq*2*Math.PI+t*1.3)*amp*0.3;\n' +
            '        ctx.lineTo(x,y);\n' +
            '      }\n' +
            '      ctx.lineTo(W,H);ctx.closePath();\n' +
            '      ctx.fillStyle=color+Math.max(8,Math.round(40-l*6)).toString(16).padStart(2,"0");\n' +
            '      ctx.fill();\n' +
            '    }\n' +
            '  }\n\n' +
            '  var vis=true;\n' +
            '  var obs=new IntersectionObserver(function(e){e.forEach(function(en){vis=en.isIntersecting;});},{threshold:0});\n' +
            '  obs.observe(el);\n' +
            '  function tick(){requestAnimationFrame(tick);if(!vis)return;draw();}\n' +
            '  resize();tick();\n' +
            '  window.addEventListener("resize",function(){resize();});\n' +
            '});\n' +
            '})();';
    }

    /* ─── Section HTML generators ─── */
    function _clampCount(v, def, min, max) {
        var n = parseInt(v, 10);
        if (isNaN(n)) return def;
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    function _heroHTML(c, bgClass) {
        var layout = (c.__heroLayout || '').toString();
        var layoutClass = (layout === 'left' || layout === 'split' || layout === 'minimal') ? ' hero--' + layout : '';
        var decoration = layout === 'split' ? '    <div class="hero-decoration" aria-hidden="true"></div>\n' : '';
        var eyebrow = c.__heroEyebrow ? '    <div class="hero-eyebrow mono" data-arbel-id="hero-eyebrow" data-arbel-edit="text">' + esc(c.__heroEyebrow) + '</div>\n' : '';
        return '<section class="hero' + layoutClass + '" id="hero" data-arbel-id="hero">\n' +
            '  <div class="' + bgClass + ' hero-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="hero-content" data-arbel-id="hero-content">\n' +
            eyebrow +
            '    <h1 class="hero-heading" data-arbel-id="hero-heading">\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line1" data-arbel-edit="text">' + esc(c.heroLine1 || 'We build') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line2" data-arbel-edit="text">' + esc(c.heroLine2 || 'cinematic') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line3" data-arbel-edit="text"><em>' + esc(c.heroLine3 || 'experiences.') + '</em></span></span>\n' +
            '    </h1>\n' +
            '    <p class="hero-sub" data-arbel-id="hero-sub" data-arbel-edit="text">' + esc(c.heroSub || '') + '</p>\n' +
            '    <div class="hero-actions">\n' +
            '      <a href="#contact" class="btn btn-primary magnetic" data-arbel-id="hero-cta" data-arbel-edit="text">' + esc(c.heroCta || 'GET STARTED') + '</a>\n' +
            '    </div>\n' +
            decoration +
            '  </div>\n' +
            '  <div class="scroll-indicator mono"><span>SCROLL</span><div class="scroll-track"><div class="scroll-thumb"></div></div></div>\n' +
            '</section>';
    }

    function _servicesHTML(c) {
        var count = _clampCount(c.__servicesCount, 3, 2, 4);
        var items = '';
        for (var i = 1; i <= count; i++) {
            var title = c['service' + i + 'Title'] || 'Service ' + i;
            var desc = c['service' + i + 'Desc'] || '';
            items += '  <div class="service-card reveal-up" data-arbel-id="service-card-' + i + '">\n' +
                '    <div class="service-num mono">0' + i + '</div>\n' +
                '    <h3 class="service-title" data-arbel-id="service-' + i + '-title" data-arbel-edit="text">' + esc(title) + '</h3>\n' +
                '    <p class="service-desc" data-arbel-id="service-' + i + '-desc" data-arbel-edit="text">' + esc(desc) + '</p>\n' +
                '  </div>\n';
        }
        return '<section class="section services" id="services" data-arbel-id="services">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.servicesLabel || 'SERVICES') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="services-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.servicesHeading || 'What we do') + '</span></span></h2>\n' +
            '  <div class="services-grid services-grid--cols-' + count + '">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _portfolioHTML(c) {
        var count = _clampCount(c.__portfolioCount, 3, 2, 4);
        var items = '';
        for (var i = 1; i <= count; i++) {
            var title = c['project' + i + 'Title'] || 'Project ' + i;
            var tag = c['project' + i + 'Tag'] || 'Design';
            var desc = c['project' + i + 'Desc'] || '';
            items += '  <div class="portfolio-card reveal-up cursor-hover" data-arbel-id="portfolio-card-' + i + '">\n' +
                '    <div class="portfolio-card-inner">\n' +
                '      <div class="portfolio-meta mono"><span data-arbel-id="project-' + i + '-tag" data-arbel-edit="text">' + esc(tag) + '</span></div>\n' +
                '      <h3 class="portfolio-title" data-arbel-id="project-' + i + '-title" data-arbel-edit="text">' + esc(title) + '</h3>\n' +
                '      <p class="portfolio-desc" data-arbel-id="project-' + i + '-desc" data-arbel-edit="text">' + esc(desc) + '</p>\n' +
                '      <div class="portfolio-num mono">' + (i < 10 ? '0' + i : i) + '</div>\n' +
                '    </div>\n' +
                '  </div>\n';
        }
        return '<section class="section portfolio" id="portfolio" data-arbel-id="portfolio">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.portfolioLabel || 'PORTFOLIO') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="portfolio-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.portfolioHeading || 'Our Work') + '</span></span></h2>\n' +
            '  <div class="portfolio-grid portfolio-grid--cols-' + count + '">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _aboutHTML(c) {
        var flip = c.__aboutFlip ? ' about--flip' : '';
        var stats = '';
        for (var i = 1; i <= 3; i++) {
            var val = c['stat' + i + 'Val'] || '--';
            var label = c['stat' + i + 'Label'] || 'Stat';
            stats += '    <div class="stat-block" data-arbel-id="stat-' + i + '"><div class="stat-val" data-arbel-id="stat-' + i + '-val" data-arbel-edit="text">' + esc(val) + '</div><div class="stat-label mono" data-arbel-id="stat-' + i + '-label" data-arbel-edit="text">' + esc(label) + '</div></div>\n';
        }
        return '<section class="section about' + flip + '" id="about" data-arbel-id="about">\n' +
            '<div class="container">\n' +
            '  <div class="about-grid">\n' +
            '    <div class="about-left">\n' +
            '      <div class="section-label mono">' + esc(c.aboutLabel || 'ABOUT') + '</div>\n' +
            '      <h2 class="section-heading" data-arbel-id="about-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.aboutHeading || 'About Us') + '</span></span></h2>\n' +
            '    </div>\n' +
            '    <div class="about-right">\n' +
            '      <p class="about-desc" data-arbel-id="about-desc" data-arbel-edit="text">' + esc(c.aboutDesc || '') + '</p>\n' +
            '      <div class="stats-row">\n' + stats + '      </div>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</div>\n</section>';
    }

    function _processHTML(c) {
        var count = _clampCount(c.__processCount, 3, 3, 4);
        var steps = '';
        for (var i = 1; i <= count; i++) {
            var title = c['step' + i + 'Title'] || 'Step ' + i;
            var desc = c['step' + i + 'Desc'] || '';
            steps += '  <div class="process-card reveal-up" data-arbel-id="process-card-' + i + '">\n' +
                '    <div class="process-num mono">' + (i < 10 ? '0' + i : i) + '</div>\n' +
                '    <h3 class="process-title" data-arbel-id="step-' + i + '-title" data-arbel-edit="text">' + esc(title) + '</h3>\n' +
                '    <p class="process-desc" data-arbel-id="step-' + i + '-desc" data-arbel-edit="text">' + esc(desc) + '</p>\n' +
                '  </div>\n';
        }
        return '<section class="section process" id="process" data-arbel-id="process">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.processLabel || 'PROCESS') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="process-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.processHeading || 'How We Work') + '</span></span></h2>\n' +
            '  <div class="process-grid process-grid--cols-' + count + '">\n' + steps + '  </div>\n' +
            '</div>\n</section>';
    }

    function _testimonialsHTML(c) {
        var items = '';
        for (var i = 1; i <= 2; i++) {
            var quote = c['testimonial' + i + 'Quote'] || '';
            var name = c['testimonial' + i + 'Name'] || 'Client';
            var role = c['testimonial' + i + 'Role'] || '';
            if (!quote) continue;
            items += '  <div class="testimonial-card reveal-up" data-arbel-id="testimonial-card-' + i + '">\n' +
                '    <blockquote class="testimonial-quote" data-arbel-id="testimonial-' + i + '-quote" data-arbel-edit="text">&ldquo;' + esc(quote) + '&rdquo;</blockquote>\n' +
                '    <div class="testimonial-author">\n' +
                '      <span class="testimonial-name" data-arbel-id="testimonial-' + i + '-name" data-arbel-edit="text">' + esc(name) + '</span>\n' +
                '      <span class="testimonial-role mono" data-arbel-id="testimonial-' + i + '-role" data-arbel-edit="text">' + esc(role) + '</span>\n' +
                '    </div>\n' +
                '  </div>\n';
        }
        return '<section class="section testimonials" id="testimonials" data-arbel-id="testimonials">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.testimonialsLabel || 'TESTIMONIALS') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="testimonials-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + (c.testimonialsHeading ? esc(c.testimonialsHeading) : 'What they <em>say.</em>') + '</span></span></h2>\n' +
            '  <div class="testimonials-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _pricingHTML(c) {
        var accentTier = _clampCount(c.__pricingAccent, 2, 1, 3);
        var tiers = '';
        for (var i = 1; i <= 3; i++) {
            var name = c['tier' + i + 'Name'] || 'Plan ' + i;
            var price = c['tier' + i + 'Price'] || '--';
            var features = (c['tier' + i + 'Features'] || '').split('\n').filter(Boolean);
            var featureList = features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('\n');
            var accent = i === accentTier ? ' pricing-card--accent' : '';
            tiers += '  <div class="pricing-card' + accent + ' reveal-up" data-arbel-id="pricing-card-' + i + '">\n' +
                '    <h3 class="pricing-name" data-arbel-id="tier-' + i + '-name" data-arbel-edit="text">' + esc(name) + '</h3>\n' +
                '    <div class="pricing-price" data-arbel-id="tier-' + i + '-price" data-arbel-edit="text">' + esc(price) + '</div>\n' +
                '    <ul class="pricing-features" data-arbel-id="tier-' + i + '-features">' + featureList + '</ul>\n' +
                '    <a href="#contact" class="btn' + (i === accentTier ? ' btn-primary' : '') + '" data-arbel-id="tier-' + i + '-cta" data-arbel-edit="text">Get Started</a>\n' +
                '  </div>\n';
        }
        return '<section class="section pricing" id="pricing" data-arbel-id="pricing">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.pricingLabel || 'PRICING') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="pricing-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.pricingHeading || 'Pricing') + '</span></span></h2>\n' +
            '  <div class="pricing-grid">\n' + tiers + '  </div>\n' +
            '</div>\n</section>';
    }

    function _faqHTML(c) {
        var items = '';
        for (var i = 1; i <= 3; i++) {
            var q = c['faq' + i + 'Q'] || '';
            var a = c['faq' + i + 'A'] || '';
            if (!q) continue;
            items += '  <details class="faq-item reveal-up" data-arbel-id="faq-item-' + i + '">\n' +
                '    <summary class="faq-question" data-arbel-id="faq-' + i + '-q" data-arbel-edit="text">' + esc(q) + '</summary>\n' +
                '    <p class="faq-answer" data-arbel-id="faq-' + i + '-a" data-arbel-edit="text">' + esc(a) + '</p>\n' +
                '  </details>\n';
        }
        return '<section class="section faq" id="faq" data-arbel-id="faq">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.faqLabel || 'FAQ') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="faq-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + (c.faqHeading ? esc(c.faqHeading) : 'Frequently <em>Asked.</em>') + '</span></span></h2>\n' +
            '  <div class="faq-list">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _statsStripHTML(c) {
        var count = _clampCount(c.__statsStripCount, 4, 3, 5);
        var items = '';
        var defaults = [
            { v: '120+', l: 'Projects' },
            { v: '98%',  l: 'Retention' },
            { v: '12',   l: 'Countries' },
            { v: '2019', l: 'Founded' },
            { v: '24/7', l: 'Support' }
        ];
        for (var i = 1; i <= count; i++) {
            var v = c['statsStrip' + i + 'Val'] || defaults[i-1].v;
            var l = c['statsStrip' + i + 'Label'] || defaults[i-1].l;
            items += '    <div class="stats-strip-item reveal-up" data-arbel-id="stats-strip-' + i + '">\n' +
                '      <div class="stats-strip-val" data-arbel-id="stats-strip-' + i + '-val" data-arbel-edit="text">' + esc(v) + '</div>\n' +
                '      <div class="stats-strip-label mono" data-arbel-id="stats-strip-' + i + '-label" data-arbel-edit="text">' + esc(l) + '</div>\n' +
                '    </div>\n';
        }
        return '<section class="section stats-strip" id="statsStrip" data-arbel-id="statsStrip">\n' +
            '<div class="container">\n' +
            '  <div class="stats-strip-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _logoCloudHTML(c) {
        var count = _clampCount(c.__logoCloudCount, 6, 4, 8);
        var items = '';
        var defaults = ['Acme Co', 'Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark'];
        for (var i = 1; i <= count; i++) {
            var n = c['logoCloud' + i] || defaults[(i-1) % defaults.length];
            items += '    <div class="logo-cloud-item" data-arbel-id="logo-cloud-' + i + '" data-arbel-edit="text">' + esc(n) + '</div>\n';
        }
        // duplicate for seamless marquee
        var marquee = items + items;
        return '<section class="section logo-cloud" id="logoCloud" data-arbel-id="logoCloud">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono logo-cloud-label" data-arbel-id="logoCloud-label" data-arbel-edit="text">' + esc(c.logoCloudLabel || 'TRUSTED BY') + '</div>\n' +
            '  <div class="logo-cloud-track"><div class="logo-cloud-inner">\n' + marquee + '  </div></div>\n' +
            '</div>\n</section>';
    }

    function _ctaBannerHTML(c) {
        return '<section class="section cta-banner" id="ctaBanner" data-arbel-id="ctaBanner">\n' +
            '<div class="container cta-banner-inner">\n' +
            '  <h2 class="cta-banner-heading" data-arbel-id="ctaBanner-heading" data-arbel-edit="text">' + esc(c.ctaBannerHeading || 'Ready to begin?') + '</h2>\n' +
            '  <p class="cta-banner-sub" data-arbel-id="ctaBanner-sub" data-arbel-edit="text">' + esc(c.ctaBannerSub || 'Reach out and let\u2019s build something people remember.') + '</p>\n' +
            '  <a href="#contact" class="btn btn-primary magnetic" data-arbel-id="ctaBanner-cta" data-arbel-edit="text">' + esc(c.ctaBannerCta || 'START A PROJECT') + '</a>\n' +
            '</div>\n</section>';
    }

    function _teamHTML(c) {
        var count = _clampCount(c.__teamCount, 3, 2, 4);
        var items = '';
        var defaults = [
            { n: 'Alex Chen',    r: 'Founder / Design' },
            { n: 'Jordan Rivera', r: 'Engineering Lead' },
            { n: 'Sam Okafor',   r: 'Creative Director' },
            { n: 'Morgan Patel', r: 'Client Strategy' }
        ];
        for (var i = 1; i <= count; i++) {
            var n = c['team' + i + 'Name'] || defaults[i-1].n;
            var r = c['team' + i + 'Role'] || defaults[i-1].r;
            var initials = n.split(/\s+/).slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join('');
            items += '    <div class="team-card reveal-up" data-arbel-id="team-card-' + i + '">\n' +
                '      <div class="team-avatar" aria-hidden="true">' + esc(initials) + '</div>\n' +
                '      <h3 class="team-name" data-arbel-id="team-' + i + '-name" data-arbel-edit="text">' + esc(n) + '</h3>\n' +
                '      <p class="team-role mono" data-arbel-id="team-' + i + '-role" data-arbel-edit="text">' + esc(r) + '</p>\n' +
                '    </div>\n';
        }
        return '<section class="section team" id="team" data-arbel-id="team">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">' + esc(c.teamLabel || 'TEAM') + '</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="team-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.teamHeading || 'The people behind it.') + '</span></span></h2>\n' +
            '  <div class="team-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _contactHTML(c, email, bgClass) {
        return '<section class="section contact" id="contact" data-arbel-id="contact">\n' +
            '  <div class="' + bgClass + ' contact-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="container contact-inner">\n' +
            '    <div class="section-label mono">' + esc(c.contactLabel || 'CONTACT') + '</div>\n' +
            '    <h2 class="section-heading text-center" data-arbel-id="contact-heading" data-arbel-edit="text">\n' +
            '      <span class="line"><span class="line-inner">' + esc(c.contactHeading || "Let's Talk") + '</span></span>\n' +
            '    </h2>\n' +
            '    <div class="contact-actions">\n' +
            '      <a href="mailto:' + esc(email) + '" class="btn btn-primary magnetic" data-arbel-id="contact-cta" data-arbel-edit="text">' + esc(c.contactCta || 'EMAIL US') + '</a>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</section>';
    }

    /* ─── Section builder map ─── */
    var SECTION_BUILDERS = {
        hero: _heroHTML,
        services: _servicesHTML,
        portfolio: _portfolioHTML,
        about: _aboutHTML,
        process: _processHTML,
        testimonials: _testimonialsHTML,
        pricing: _pricingHTML,
        faq: _faqHTML,
        statsStrip: _statsStripHTML,
        logoCloud: _logoCloudHTML,
        ctaBanner: _ctaBannerHTML,
        team: _teamHTML,
        contact: _contactHTML
    };

    /* ─── Main HTML builder ─── */
    function _buildHTML(cfg) {
        var cat = _getAnimCategory(cfg.style);
        var bgClass = cat === 'shader' ? 'webgl-bg' : 'anim-bg';
        var sections = cfg.sections || ['hero', 'services', 'about', 'contact'];
        var c = cfg.content || {};
        var sectionsHTML = '';

        sections.forEach(function (s) {
            var builder = SECTION_BUILDERS[s];
            if (!builder) return;
            if (s === 'hero') {
                c.__heroLayout = cfg.heroLayout || '';
                c.__heroEyebrow = cfg.heroEyebrow || '';
                sectionsHTML += builder(c, bgClass) + '\n\n';
            } else if (s === 'contact') {
                sectionsHTML += builder(c, cfg.contactEmail, bgClass) + '\n\n';
            } else {
                // Inject per-section structural knobs (counts / flip / accent / layout)
                var counts = cfg.sectionCounts || {};
                if (counts[s] != null) c['__' + s + 'Count'] = counts[s];
                if (s === 'about') c.__aboutFlip = !!cfg.aboutFlip;
                if (s === 'pricing' && cfg.pricingAccent != null) c.__pricingAccent = cfg.pricingAccent;
                // Per-section layout variants (grid / list / bento / numbered) — applied as a
                // class on the section root by adding it to the emitted HTML via replace.
                var layouts = cfg.sectionLayouts || {};
                var layoutName = layouts[s];
                var html = builder(c);
                if (layoutName && /^[a-z]+$/.test(layoutName)) {
                    // Add layout class to the section root (first occurrence of `class="section `)
                    html = html.replace('class="section ' + s + '"', 'class="section ' + s + ' layout-' + layoutName + '"');
                }
                sectionsHTML += html + '\n\n';
            }
        });

        var navLinks = '';
        var navMap = { services: c.servicesNav || 'Services', portfolio: c.portfolioNav || 'Work', about: c.aboutNav || 'About', process: c.processNav || 'Process', pricing: c.pricingNav || 'Pricing', team: c.teamNav || 'Team', contact: c.contactNav || 'Contact' };
        sections.forEach(function (s) {
            if (s === 'hero' || s === 'testimonials' || s === 'faq') return;
            if (s === 'statsStrip' || s === 'logoCloud' || s === 'ctaBanner') return;
            if (navMap[s]) navLinks += '        <a href="#' + s + '" class="nav-link" data-arbel-id="nav-' + s + '" data-arbel-edit="text">' + navMap[s] + '</a>\n';
        });
        if (cfg.pages) {
            cfg.pages.forEach(function (pg) {
                if (pg.isHome || pg.showInNav === false) return;
                var href = pg.path || '/' + pg.id;
                navLinks += '        <a href="' + escHref(href) + '" class="nav-link" data-arbel-id="nav-page-' + pg.id + '" data-arbel-edit="text">' + esc(pg.name) + '</a>\n';
            });
        }

        var seo = cfg.seo || {};
        var seoTitle = seo.title || (cfg.brandName + (cfg.tagline ? ' — ' + cfg.tagline : ''));
        var seoDesc = seo.description || cfg.tagline || cfg.brandName;

        var metaBlock = '';
        metaBlock += '  <title>' + esc(seoTitle) + '</title>\n';
        metaBlock += '  <meta name="description" content="' + esc(seoDesc) + '">\n';
        if (!seo.index && seo.index !== undefined) {
            metaBlock += '  <meta name="robots" content="noindex, nofollow">\n';
        }
        if (seo.canonical) {
            metaBlock += '  <link rel="canonical" href="' + escHref(seo.canonical) + '">\n';
        }
        if (seo.favicon) {
            metaBlock += '  <link rel="icon" href="' + escHref(seo.favicon) + '">\n';
        }
        // Open Graph
        metaBlock += '  <meta property="og:type" content="website">\n';
        metaBlock += '  <meta property="og:title" content="' + esc(seoTitle) + '">\n';
        metaBlock += '  <meta property="og:description" content="' + esc(seoDesc) + '">\n';
        if (seo.canonical) metaBlock += '  <meta property="og:url" content="' + escHref(seo.canonical) + '">\n';
        if (seo.ogImage) metaBlock += '  <meta property="og:image" content="' + escHref(seo.ogImage) + '">\n';
        // Twitter Card
        metaBlock += '  <meta name="twitter:card" content="' + (seo.ogImage ? 'summary_large_image' : 'summary') + '">\n';
        metaBlock += '  <meta name="twitter:title" content="' + esc(seoTitle) + '">\n';
        metaBlock += '  <meta name="twitter:description" content="' + esc(seoDesc) + '">\n';
        if (seo.ogImage) metaBlock += '  <meta name="twitter:image" content="' + escHref(seo.ogImage) + '">\n';

        return '<!DOCTYPE html>\n' +
            '<html lang="en">\n<head>\n' +
            '  <meta charset="UTF-8">\n' +
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            metaBlock +
            '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
            '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
            '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;700&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Work+Sans:wght@400;500;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;700&family=DM+Serif+Display&family=DM+Sans:wght@400;500;700&family=Archivo:wght@400;600;800&family=Archivo+Black&family=JetBrains+Mono:wght@400;700&family=Syne:wght@500;700;800&family=Manrope:wght@400;500;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;700&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital@0;1&family=Raleway:wght@400;500;700&display=swap" rel="stylesheet">\n' +
            '  <link rel="stylesheet" href="css/style.css">\n' +
            '</head>\n<body' + (function () {
                var cls = [];
                if (cfg.headingAlign === 'center') cls.push('headings-center');
                else if (cfg.headingAlign === 'right') cls.push('headings-right');
                if (cfg.containerWidth === 'narrow') cls.push('container-narrow');
                else if (cfg.containerWidth === 'wide') cls.push('container-wide');
                var ct = cfg.cardTreatment;
                if (['bordered','filled','floating','minimal','glass'].indexOf(ct) !== -1) cls.push('cards-' + ct);
                var ns = cfg.navStyle;
                if (['pill','minimal','ghost'].indexOf(ns) !== -1) cls.push('nav-' + ns);
                var rh = cfg.sectionRhythm;
                if (['compact','roomy','alternating'].indexOf(rh) !== -1) cls.push('rhythm-' + rh);
                var bs = cfg.buttonStyle;
                if (['solid','outline','gradient','sharp','lifted'].indexOf(bs) !== -1) cls.push('btn-' + bs);
                var ts = cfg.typeScale;
                if (['tight','dramatic'].indexOf(ts) !== -1) cls.push('type-' + ts);
                var ds = cfg.dividerStyle;
                if (['line','gradient','numbered','dotline'].indexOf(ds) !== -1) cls.push('div-' + ds);
                var fs = cfg.footerStyle;
                if (['minimal','columns','centered','bigLogo','stripe'].indexOf(fs) !== -1) cls.push('footer-' + fs.toLowerCase());
                var ls = cfg.labelStyle;
                if (['bar','dot','number','stripe'].indexOf(ls) !== -1) cls.push('label-' + ls);
                var ha = cfg.heroArt;
                if (['grid','lines','circle','dots','cross'].indexOf(ha) !== -1) cls.push('heroart-' + ha);
                return cls.length ? ' class="' + cls.join(' ') + '"' : '';
            })() + '>\n\n' +
            '  <!-- Preloader -->\n' +
            '  <div class="preloader" id="preloader">\n' +
            '    <div class="preloader-inner">\n' +
            '      <div class="preloader-logo">' + esc(cfg.brandName) + '</div>\n' +
            '      <div class="preloader-line"><div class="preloader-fill" id="preloaderFill"></div></div>\n' +
            '    </div>\n' +
            '  </div>\n\n' +
            '  <!-- Cursor -->\n' +
            '  <div class="cursor" id="cursor"><div class="cursor-dot"></div><div class="cursor-ring"></div></div>\n\n' +
            '  <!-- Noise overlay -->\n' +
            '  <div class="noise-bg"></div>\n\n' +
            (cfg.navEnabled !== false ?
            '  <!-- Header -->\n' +
            '  <header class="header" id="header">\n' +
            '    <div class="header-inner">\n' +
            '      <a href="#" class="logo" data-arbel-id="site-logo" data-arbel-edit="text">' + esc(cfg.brandName) + '</a>\n' +
            '      <nav class="nav" id="nav" data-arbel-id="site-nav">\n' + navLinks +
            '      </nav>\n' +
            '      <div class="nav-extra" id="navExtra" data-arbel-id="nav-extra"></div>\n' +
            '      <button class="menu-btn" id="menuBtn" data-arbel-id="menu-btn" aria-label="Menu"><span></span><span></span></button>\n' +
            '    </div>\n' +
            '  </header>\n\n' : '') +
            '  <main>\n' + sectionsHTML + '  </main>\n\n' +
            '  <footer class="footer" data-brand="' + esc(cfg.brandName) + '">\n' +
            '    <div class="footer-inner">\n' +
            '      <span class="logo">' + esc(cfg.brandName) + '</span>\n' +
            '      <span class="mono">&copy; <script>document.write(new Date().getFullYear())<\/script> All rights reserved.</span>\n' +
            '    </div>\n' +
            '  </footer>\n\n' +
            '  <div class="arbel-badge">built with <a href="https://arbel.live" target="_blank" rel="noopener">arbel.live</a></div>\n\n' +
            (cat === 'shader' ? '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n' : '') +
            '  <script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>\n' +
            '  <script src="js/' + _getAnimJsFile(cat) + '"><\/script>\n' +
            '  <script src="js/animations.js"><\/script>\n' +
            '  <script src="js/main.js"><\/script>\n' +
            '</body>\n</html>';
    }

    /* ─── CSS builder ─── */
    function _buildCSS(cfg) {
        var src = _getStyleConfig(cfg.style) || SHADERS.obsidian;
        var colors = src.colors;
        var accent = cfg.accent || colors.accent;
        var bg = cfg.bgColor || colors.bg;
        var dt = cfg.designTokens || {};

        return '/* Generated by Arbel Generator — ' + esc(cfg.brandName) + ' */\n' +
            ':root {\n' +
            '  --bg: ' + (dt.bg || bg) + ';\n' +
            '  --menu-bg: ' + (cfg.menuBgColor || dt.bg || bg) + ';\n' +
            '  --surface: ' + (dt.surface || colors.surface) + ';\n' +
            '  --fg: ' + (dt.text || colors.fg) + ';\n' +
            '  --fg2: ' + (dt.textMuted || colors.fg2) + ';\n' +
            '  --accent: ' + accent + ';\n' +
            '  --border: ' + colors.border + ';\n' +
            '  --font-body: ' + (dt.bodyFont || '"Inter", -apple-system, sans-serif') + ';\n' +
            '  --font-display: ' + (dt.headingFont || '"Instrument Serif", Georgia, serif') + ';\n' +
            '  --font-mono: "Space Mono", monospace;\n' +
            '  --ease: cubic-bezier(0.16, 1, 0.3, 1);\n' +
            '  --token-base-size: ' + (dt.baseSize || 16) + 'px;\n' +
            '  --token-scale: ' + (dt.scale || 1.25) + ';\n' +
            '  --token-space-unit: ' + (dt.spaceUnit || 8) + 'px;\n' +
            '  --token-radius: ' + (dt.radius || 8) + 'px;\n' +
            '}\n\n' +
            '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }\n' +
            'html { font-size: var(--token-base-size); -webkit-font-smoothing: antialiased; }\n' +
            'html.lenis, html.lenis body { height: auto; }\n' +
            '.lenis.lenis-smooth { scroll-behavior: auto; }\n' +
            'body { font-family: var(--font-body); background: var(--bg); color: var(--fg); overflow-x: hidden; }\n' +
            'a { color: inherit; text-decoration: none; }\n' +
            '.mono { font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }\n' +
            'em { font-family: var(--font-display); font-style: italic; }\n' +
            '.container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }\n' +
            '.container-narrow .container { max-width: 860px; }\n' +
            '.container-wide .container { max-width: 1440px; }\n' +
            '.headings-center .section-heading, .headings-center .section-label { text-align: center; }\n' +
            '.headings-right .section-heading, .headings-right .section-label { text-align: right; }\n' +
            '.text-center { text-align: center; }\n\n' +
            '/* ═══ PRELOADER ═══ */\n' +
            '.preloader { position: fixed; inset: 0; z-index: 9999; background: var(--bg); display: flex; align-items: center; justify-content: center; transition: opacity 0.6s, visibility 0.6s; }\n' +
            '.preloader.done { opacity: 0; visibility: hidden; pointer-events: none; }\n' +
            '.preloader-inner { text-align: center; }\n' +
            '.preloader-logo { font-family: var(--font-display); font-size: 2rem; margin-bottom: 1.5rem; opacity: 0.9; }\n' +
            '.preloader-line { width: 120px; height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; margin: 0 auto; }\n' +
            '.preloader-fill { height: 100%; width: 0; background: var(--accent); transition: width 0.3s; }\n\n' +
            '/* ═══ CURSOR ═══ */\n' +
            '.cursor { position: fixed; top: 0; left: 0; z-index: 10000; pointer-events: none; mix-blend-mode: difference; }\n' +
            '.cursor-dot { width: 6px; height: 6px; background: #fff; border-radius: 50%; transform: translate(-50%, -50%); }\n' +
            '.cursor-ring { width: 36px; height: 36px; border: 1.5px solid rgba(255,255,255,0.5); border-radius: 50%; position: absolute; top: -15px; left: -15px; transform: translate(-50%, -50%); transition: width 0.3s, height 0.3s, top 0.3s, left 0.3s; }\n' +
            '@media (pointer: coarse) { .cursor { display: none; } }\n\n' +
            '/* ═══ NOISE ═══ */\n' +
            '.noise-bg { position: fixed; inset: 0; z-index: 9998; pointer-events: none; opacity: 0.035; background: url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E"); }\n\n' +
            (cfg.navEnabled !== false ?
            '/* ═══ HEADER ═══ */\n' +
            '.header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1rem 2rem; background: rgba(10,10,15,0.8); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }\n' +
            '.header-inner { display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; }\n' +
            '.logo { font-family: var(--font-display); font-size: 1.3rem; }\n' +
            '.nav { display: flex; gap: 2rem; align-items: center; }\n' +
            '.nav-link { font-size: 0.85rem; color: var(--fg2); transition: color 0.3s; }\n' +
            '.nav-link:hover { color: var(--fg); }\n' +
            '.nav-extra { display: none; }\n' +
            '.menu-btn { display: none; background: none; border: none; cursor: pointer; width: 28px; height: 20px; position: relative; }\n' +
            '.menu-btn span { display: block; width: 100%; height: 2px; background: var(--fg); position: absolute; left: 0; transition: all 0.3s; }\n' +
            '.menu-btn span:first-child { top: 0; }\n' +
            '.menu-btn span:last-child { bottom: 0; }\n' +
            (function () {
                var nm = cfg.navMode || {};
                var dsk = nm.desktop || 'links', tab = nm.tablet || 'hamburger', mob = nm.mobile || 'hamburger';
                // Determine if/where hamburger CSS starts
                var needHamburger = dsk === 'hamburger' || tab === 'hamburger' || mob === 'hamburger';
                if (!needHamburger) return '';
                var bp = dsk === 'hamburger' ? null : (tab === 'hamburger' ? 1024 : 768);
                var hamburgerCSS =
                    '  .header-inner { display: flex; align-items: center; justify-content: space-between; }\n' +
                    '  .logo { display: block; color: inherit; }\n' +
                    '  .nav { display: none; }\n' +
                    '  .nav.open { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2rem; margin: auto 0; width: 100%; padding: 2rem 0; }\n' +
                    '  .nav a, .nav-link { color: #fff; font-size: 1.5rem; text-decoration: none; padding: 0.5rem 1rem; transition: opacity 0.2s; }\n' +
                    '  .nav a:hover, .nav-link:hover { opacity: 0.7; }\n' +
                    '  .menu-btn { display: block; z-index: 10000; }\n' +
                    '  .menu-btn.is-active span:first-child { transform: translateY(9px) rotate(45deg); }\n' +
                    '  .menu-btn.is-active span:last-child { transform: translateY(-9px) rotate(-45deg); }\n' +
                    '  body.nav-open { overflow: hidden; }\n' +
                    '  body.nav-open .header { position: fixed; inset: 0; z-index: 9999; ' + (cfg.menuBgEnabled !== false ? 'background: var(--menu-bg, rgba(10,10,15,0.95)); ' : 'background: rgba(10,10,15,0.95); ') + 'backdrop-filter: none; border-bottom: none; display: flex; flex-direction: column; padding: 1rem 2rem; overflow-y: auto; }\n' +
                    '  body.nav-open .header-inner { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; max-width: none; position: relative; }\n' +
                    '  body.nav-open .logo { align-self: flex-start; }\n' +
                    '  body.nav-open .menu-btn { position: absolute; top: 0; right: 0; }\n' +
                    '  .nav-extra { display: none; width: 100%; }\n' +
                    '  body.nav-open .nav-extra { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 2rem; flex-shrink: 0; }\n';
                if (bp) return '@media (max-width: ' + bp + 'px) {\n' + hamburgerCSS + '}\n\n';
                return hamburgerCSS + '\n';
            })() : '') +
            '/* ═══ HERO ═══ */\n' +
            '.hero { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }\n' +
            '.hero-bg { position: absolute; inset: 0; }\n' +
            '.hero-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 40%, var(--bg) 100%); pointer-events: none; }\n' +
            /* Stronger scrim for animated overlays (blob/particle/wave) to keep text legible */
            (function () {
                var cat = _getAnimCategory(cfg.style);
                if (cat === 'blob' || cat === 'particle' || cat === 'wave' || cat === 'gradient') {
                    return '.hero::after { content:""; position:absolute; inset:0; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--bg) 55%, transparent) 0%, transparent 60%); pointer-events:none; z-index:1; }\n';
                }
                return '';
            })() +
            '.hero-content { position: relative; z-index: 2; text-align: center; padding: 2rem; max-width: 800px; }\n' +
            /* Text-shadow halo using bg color — invisible on flat bg, life-saver on blobs */
            '.hero-heading { font-size: clamp(2.5rem, 7vw, 5.5rem); font-weight: 800; line-height: 1.05; margin-bottom: 1.5rem; text-shadow: 0 2px 24px color-mix(in srgb, var(--bg) 80%, transparent), 0 0 48px color-mix(in srgb, var(--bg) 50%, transparent); }\n' +
            '.hero-heading .line { display: block; overflow: hidden; }\n' +
            '.hero-heading .line-inner { display: inline-block; }\n' +
            /* Hero sub: use full fg color + stronger halo + min-width to avoid squish */
            '.hero-sub { position: relative; z-index: 3; color: color-mix(in srgb, var(--fg) 92%, var(--fg2)); font-size: 1.05rem; line-height: 1.6; max-width: 520px; margin: 0 auto 2rem; text-shadow: 0 1px 16px color-mix(in srgb, var(--bg) 85%, transparent), 0 0 32px color-mix(in srgb, var(--bg) 60%, transparent); }\n' +
            /* Hero layout variants */
            '.hero--left .hero-content { text-align: left; margin-left: 8%; margin-right: auto; }\n' +
            '.hero--left .hero-heading, .hero--left .hero-actions { justify-content: flex-start; }\n' +
            '.hero--left .hero-sub { margin-left: 0; }\n' +
            '.hero--split .hero-content { max-width: 1200px; width: 90%; display: grid; grid-template-columns: 1.2fr 1fr; gap: 3rem; align-items: center; text-align: left; }\n' +
            '.hero--split .hero-heading { grid-column: 1; }\n' +
            '.hero--split .hero-sub { grid-column: 1; margin-left: 0; max-width: none; }\n' +
            '.hero--split .hero-actions { grid-column: 1; justify-content: flex-start; }\n' +
            '.hero--split .hero-decoration { grid-column: 2; grid-row: 1 / span 3; width: 100%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, var(--accent), transparent 70%); opacity: 0.35; filter: blur(24px); pointer-events: none; }\n' +
            '.hero--minimal .hero-vignette { display: none; }\n' +
            '.hero--minimal .hero-heading { font-size: clamp(2rem, 5vw, 3.5rem); }\n' +
            '@media (max-width: 768px) { .hero--split .hero-content { grid-template-columns: 1fr; } .hero--split .hero-decoration { display:none; } .hero--left .hero-content { margin-left: 5%; } }\n' +
            '.hero-actions { display: flex; gap: 1rem; justify-content: center; }\n' +
            '.scroll-indicator { position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%); color: var(--fg2); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }\n' +
            '.scroll-track { width: 1px; height: 40px; background: var(--border); position: relative; overflow: hidden; }\n' +
            '.scroll-thumb { width: 100%; height: 40%; background: var(--accent); animation: scrollPulse 2s infinite; }\n' +
            '@keyframes scrollPulse { 0%{transform:translateY(-100%)} 100%{transform:translateY(250%)} }\n\n' +
            '/* ═══ HERO EYEBROW ═══ */\n' +
            '.hero-eyebrow { display:inline-block; padding: 0.3rem 0.75rem; border:1px solid var(--border); border-radius: 999px; font-size: 0.65rem; letter-spacing: 0.15em; color: var(--accent); margin-bottom: 1.5rem; background: color-mix(in srgb, var(--bg) 60%, transparent); backdrop-filter: blur(6px); }\n\n' +
            '/* ═══ CARD TREATMENTS (body-class toggles) ═══ */\n' +
            '.cards-bordered .service-card, .cards-bordered .portfolio-card, .cards-bordered .process-card, .cards-bordered .testimonial-card, .cards-bordered .pricing-card { background: transparent; border-width: 2px; }\n' +
            '.cards-filled .service-card, .cards-filled .portfolio-card, .cards-filled .process-card, .cards-filled .testimonial-card, .cards-filled .pricing-card { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); border-color: transparent; }\n' +
            '.cards-floating .service-card, .cards-floating .portfolio-card, .cards-floating .process-card, .cards-floating .testimonial-card, .cards-floating .pricing-card { background: var(--surface); border-color: transparent; box-shadow: 0 12px 40px color-mix(in srgb, var(--bg) 50%, #000 0%), 0 2px 8px color-mix(in srgb, var(--bg) 70%, #000 0%); }\n' +
            '.cards-minimal .service-card, .cards-minimal .portfolio-card, .cards-minimal .process-card, .cards-minimal .testimonial-card, .cards-minimal .pricing-card { background: transparent; border-width: 0; border-top: 1px solid var(--border); border-radius: 0; padding-left: 0; padding-right: 0; }\n' +
            '.cards-minimal .pricing-card--accent { border-top-color: var(--accent); border-top-width: 2px; }\n' +
            '.cards-glass .service-card, .cards-glass .portfolio-card, .cards-glass .process-card, .cards-glass .testimonial-card, .cards-glass .pricing-card { background: color-mix(in srgb, var(--fg) 4%, transparent); border-color: color-mix(in srgb, var(--fg) 12%, transparent); backdrop-filter: blur(12px); }\n\n' +
            '/* ═══ NAV STYLE VARIANTS ═══ */\n' +
            '.nav-pill .header { top: 1rem; left: 50%; transform: translateX(-50%); right: auto; width: auto; border-radius: 999px; padding: 0.4rem 1.5rem; background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(14px); border: 1px solid var(--border); }\n' +
            '.nav-minimal .header { background: transparent; backdrop-filter: none; border-bottom: none; padding: 1.5rem 2rem; }\n' +
            '.nav-minimal .nav { gap: 2.5rem; }\n' +
            '.nav-ghost .header { background: transparent; border-bottom: none; }\n' +
            '.nav-ghost .nav a { opacity: 0.65; }\n' +
            '.nav-ghost .nav a:hover { opacity: 1; }\n\n' +
            '/* ═══ SECTION RHYTHM ═══ */\n' +
            '.rhythm-compact .section { padding: 4rem 0; }\n' +
            '.rhythm-roomy .section { padding: 10rem 0; }\n' +
            '.rhythm-alternating .section:nth-of-type(odd) { padding: 5rem 0; }\n' +
            '.rhythm-alternating .section:nth-of-type(even) { padding: 9rem 0; }\n' +
            '@media (max-width: 768px) { .rhythm-roomy .section { padding: 6rem 0; } .rhythm-alternating .section { padding: 5rem 0 !important; } }\n\n' +
            '/* ═══ HARDENING — contrast + overflow + readability ═══ */\n' +
            'html, body { overflow-x: hidden; max-width: 100vw; }\n' +
            '.container { min-width: 0; }\n' +
            '.section-heading, .hero-heading, .section-title { word-break: break-word; overflow-wrap: anywhere; }\n' +
            /* force readable card body text across every card treatment */
            '.service-desc, .portfolio-desc, .process-desc, .testimonial-quote, .pricing-card p, .pricing-card li { color: color-mix(in srgb, var(--fg) 82%, var(--fg2)); }\n' +
            /* filled + accent backgrounds darken surface — push body text closer to --fg */
            '.cards-filled .service-desc, .cards-filled .portfolio-desc, .cards-filled .process-desc, .cards-filled .testimonial-quote, .cards-filled .pricing-card p, .cards-filled .pricing-card li { color: color-mix(in srgb, var(--fg) 92%, transparent); }\n' +
            '.pricing-card--accent, .pricing-card--accent * { color: var(--fg); }\n' +
            '.pricing-card--accent .pricing-price, .pricing-card--accent .pricing-name { color: var(--fg); }\n' +
            /* ensure accent-coloured labels stay visible against surface — auto lift when accent is dim */
            '.section-label, .service-num, .process-num, .portfolio-meta, .pricing-price { color: color-mix(in srgb, var(--accent) 80%, var(--fg) 20%); }\n' +
            /* glass cards need extra contrast on mixed backgrounds */
            '.cards-glass .service-card, .cards-glass .portfolio-card, .cards-glass .process-card, .cards-glass .testimonial-card, .cards-glass .pricing-card { background: color-mix(in srgb, var(--surface) 55%, transparent); backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2); border: 1px solid color-mix(in srgb, var(--fg) 10%, transparent); }\n' +
            /* section headings get a subtle halo so animated bgs can never drown them */
            '.section-heading { text-shadow: 0 2px 20px color-mix(in srgb, var(--bg) 45%, transparent); }\n' +
            /* narrow viewports — guarantee card grids never overflow the container */
            '@media (max-width: 520px) { .services-grid, .portfolio-grid, .process-grid, .testimonials-grid, .pricing-grid { grid-template-columns: 1fr !important; } .stats-row { flex-wrap: wrap; gap: 1.25rem !important; } .hero-content { width: 92% !important; } }\n' +
            /* focus ring for keyboard a11y — auto-adapts to accent */
            'a:focus-visible, button:focus-visible, .btn:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }\n\n' +
            '/* ═══ TYPE SCALE (body-class toggle) ═══ */\n' +
            '.type-tight .hero-heading { font-size: clamp(2rem, 5.2vw, 4rem); letter-spacing: -0.015em; }\n' +
            '.type-tight .section-heading { font-size: clamp(1.6rem, 3vw, 2.5rem); }\n' +
            '.type-dramatic .hero-heading { font-size: clamp(3rem, 9vw, 7.5rem); letter-spacing: -0.04em; line-height: 0.98; }\n' +
            '.type-dramatic .section-heading { font-size: clamp(2.25rem, 5.5vw, 4.5rem); letter-spacing: -0.02em; }\n' +
            '.type-dramatic .hero-sub { font-size: 1.2rem; max-width: 640px; }\n\n' +
            '/* ═══ SECTION DIVIDERS (body-class toggles) ═══ */\n' +
            '.div-line .section + .section { border-top: 1px solid var(--border); }\n' +
            '.div-dotline .section + .section::before { content:""; display:block; height: 1px; width: 60%; margin: 0 auto; background-image: linear-gradient(to right, var(--border) 50%, transparent 50%); background-size: 10px 1px; position: absolute; top: 0; left: 20%; }\n' +
            '.div-dotline .section { }\n' +
            '.div-gradient .section + .section::before { content:""; display:block; height: 1px; width: 100%; background: linear-gradient(to right, transparent, var(--accent), transparent); opacity: 0.35; position: absolute; top: 0; left: 0; }\n' +
            '.div-numbered { counter-reset: arbel-section; }\n' +
            '.div-numbered .section { counter-increment: arbel-section; }\n' +
            '.div-numbered .section::before { content: "0" counter(arbel-section); position: absolute; top: 2rem; right: 2rem; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.15em; color: var(--fg2); opacity: 0.5; }\n' +
            '@media (max-width: 768px) { .div-numbered .section::before { top: 1rem; right: 1rem; } }\n\n' +
            '/* ═══ LABEL STYLES (body-class toggles) ═══ */\n' +
            '.label-bar .section-label { display: inline-flex; align-items: center; gap: 0.75rem; }\n' +
            '.label-bar .section-label::before { content:""; display: inline-block; width: 32px; height: 2px; background: var(--accent); }\n' +
            '.label-dot .section-label { display: inline-flex; align-items: center; gap: 0.6rem; }\n' +
            '.label-dot .section-label::before { content:""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }\n' +
            '.label-number .services .section-label::after { content:" / 01"; opacity: 0.5; }\n' +
            '.label-number .portfolio .section-label::after, .label-number #work .section-label::after { content:" / 02"; opacity: 0.5; }\n' +
            '.label-number .about .section-label::after, .label-number #about .section-label::after { content:" / 03"; opacity: 0.5; }\n' +
            '.label-number .process .section-label::after, .label-number #process .section-label::after { content:" / 04"; opacity: 0.5; }\n' +
            '.label-number .testimonials .section-label::after, .label-number #testimonials .section-label::after { content:" / 05"; opacity: 0.5; }\n' +
            '.label-number .pricing .section-label::after, .label-number #pricing .section-label::after { content:" / 06"; opacity: 0.5; }\n' +
            '.label-number .contact .section-label::after, .label-number #contact .section-label::after { content:" / 07"; opacity: 0.5; }\n' +
            '.label-stripe .section-label { display: inline-block; padding: 0.35rem 0.9rem; background: color-mix(in srgb, var(--accent) 15%, transparent); border-left: 2px solid var(--accent); color: var(--fg); }\n\n' +
            '/* ═══ HERO ART (decorative, body-class toggles) ═══ */\n' +
            '.heroart-grid .hero::before { content:""; position: absolute; inset: 0; background-image: linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px); background-size: 80px 80px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, #000 30%, transparent 70%); pointer-events: none; z-index: 1; }\n' +
            '.heroart-lines .hero::before { content:""; position: absolute; inset: 0; background-image: repeating-linear-gradient(90deg, transparent 0, transparent 119px, color-mix(in srgb, var(--fg) 8%, transparent) 119px, color-mix(in srgb, var(--fg) 8%, transparent) 120px); pointer-events: none; z-index: 1; }\n' +
            '.heroart-circle .hero::before { content:""; position: absolute; top: 50%; right: -200px; transform: translateY(-50%); width: 600px; height: 600px; border: 1px solid var(--accent); border-radius: 50%; opacity: 0.2; pointer-events: none; z-index: 1; }\n' +
            '.heroart-circle .hero::after { content:""; position: absolute; top: 50%; right: -120px; transform: translateY(-50%); width: 400px; height: 400px; border: 1px solid var(--accent); border-radius: 50%; opacity: 0.15; pointer-events: none; z-index: 1; }\n' +
            '.heroart-dots .hero::before { content:""; position: absolute; inset: 0; background-image: radial-gradient(circle, var(--fg) 1px, transparent 1.5px); background-size: 32px 32px; opacity: 0.12; pointer-events: none; z-index: 1; }\n' +
            '.heroart-cross .hero::before { content:"+"; position: absolute; top: 12%; left: 8%; font-size: 2rem; color: var(--accent); opacity: 0.3; pointer-events: none; z-index: 1; }\n' +
            '.heroart-cross .hero::after { content:"×"; position: absolute; bottom: 18%; right: 10%; font-size: 3rem; color: var(--accent); opacity: 0.25; pointer-events: none; z-index: 1; }\n\n' +
            '/* ═══ FOOTER STYLES (body-class toggles) ═══ */\n' +
            '.footer-minimal .footer { padding: 2rem 0; }\n' +
            '.footer-minimal .footer-inner { justify-content: center; flex-direction: column; gap: 0.5rem; text-align: center; }\n' +
            '.footer-centered .footer { padding: 4rem 0; text-align: center; }\n' +
            '.footer-centered .footer-inner { flex-direction: column; gap: 1.5rem; justify-content: center; align-items: center; }\n' +
            '.footer-biglogo .footer { padding: 6rem 0 2rem; position: relative; overflow: hidden; }\n' +
            '.footer-biglogo .footer::before { content: attr(data-brand); position: absolute; bottom: -2rem; left: 50%; transform: translateX(-50%); font-family: var(--font-display); font-size: clamp(5rem, 18vw, 14rem); font-weight: 800; color: color-mix(in srgb, var(--fg) 6%, transparent); letter-spacing: -0.04em; white-space: nowrap; pointer-events: none; line-height: 0.9; }\n' +
            '.footer-stripe .footer { padding: 3rem 0; border-top: 4px solid var(--accent); }\n' +
            '.footer-columns .footer { padding: 4rem 0 2rem; }\n' +
            '.footer-columns .footer-inner { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; align-items: start; }\n' +
            '@media (max-width: 768px) { .footer-columns .footer-inner { grid-template-columns: 1fr 1fr; gap: 2rem; } .footer-biglogo .footer::before { font-size: 6rem; } }\n\n' +
            '/* ═══ BUTTONS ═══ */\n' +
            '.btn { display: inline-flex; align-items: center; padding: 0.85rem 2rem; border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.3s var(--ease); background: transparent; color: var(--fg); position: relative; overflow: hidden; }\n' +
            '.btn::before { content: ""; position: absolute; inset: 0; background: var(--accent); transform: translateY(100%); transition: transform 0.4s var(--ease); }\n' +
            '.btn:hover::before { transform: translateY(0); }\n' +
            '.btn span, .btn { position: relative; z-index: 1; }\n' +
            '.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }\n' +
            '.btn-primary::before { background: #fff; }\n' +
            '.btn-primary:hover { color: var(--bg); }\n\n' +
            '/* ═══ BUTTON STYLES (body-class toggles) ═══ */\n' +
            '.btn-solid .btn { border-radius: 4px; border-width: 0; background: color-mix(in srgb, var(--fg) 10%, transparent); color: var(--fg); }\n' +
            '.btn-solid .btn-primary { background: var(--accent); color: #fff; }\n' +
            '.btn-outline .btn { background: transparent; border-width: 2px; border-color: var(--fg); color: var(--fg); }\n' +
            '.btn-outline .btn::before { display: none; }\n' +
            '.btn-outline .btn:hover { background: var(--fg); color: var(--bg); }\n' +
            '.btn-outline .btn-primary { border-color: var(--accent); color: var(--accent); }\n' +
            '.btn-outline .btn-primary:hover { background: var(--accent); color: #fff; }\n' +
            '.btn-gradient .btn-primary { background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 40%, var(--fg))); border-color: transparent; box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 35%, transparent); }\n' +
            '.btn-gradient .btn-primary::before { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 60%, var(--fg)), var(--accent)); }\n' +
            '.btn-sharp .btn { border-radius: 0; border-width: 1px; padding: 1rem 2.2rem; }\n' +
            '.btn-sharp .btn-primary { border-color: var(--accent); }\n' +
            '.btn-lifted .btn { border-radius: 8px; box-shadow: 0 4px 0 0 color-mix(in srgb, var(--bg) 60%, #000); transition: transform 0.15s ease, box-shadow 0.15s ease, color 0.3s var(--ease); }\n' +
            '.btn-lifted .btn:hover { transform: translateY(2px); box-shadow: 0 2px 0 0 color-mix(in srgb, var(--bg) 60%, #000); }\n' +
            '.btn-lifted .btn-primary { box-shadow: 0 4px 0 0 color-mix(in srgb, var(--accent) 40%, #000); }\n' +
            '.btn-lifted .btn-primary:hover { box-shadow: 0 2px 0 0 color-mix(in srgb, var(--accent) 40%, #000); }\n\n' +
            '/* ═══ SECTIONS ═══ */\n' +
            '.section { padding: 8rem 0; position: relative; }\n' +
            '.section-label { color: var(--accent); margin-bottom: 1rem; }\n' +
            '.section-heading { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; line-height: 1.1; margin-bottom: 2rem; }\n' +
            '.section-heading .line { display: block; overflow: hidden; }\n' +
            '.section-heading .line-inner { display: inline-block; }\n\n' +
            '/* ═══ SERVICES ═══ */\n' +
            '.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.services-grid--cols-2 { grid-template-columns: repeat(2, 1fr); max-width: 900px; margin-left: auto; margin-right: auto; }\n' +
            '.services-grid--cols-4 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
            '@media (max-width: 768px) { .services-grid--cols-2, .services-grid--cols-4 { grid-template-columns: 1fr; } }\n' +
            '.service-card { padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; transition: border-color 0.3s, transform 0.3s var(--ease); }\n' +
            '.service-card:hover { border-color: var(--accent); transform: translateY(-4px); }\n' +
            '.service-num { color: var(--accent); margin-bottom: 1rem; }\n' +
            '.service-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; }\n' +
            '.service-desc { color: var(--fg2); font-size: 0.9rem; line-height: 1.6; }\n\n' +
            '/* ═══ PORTFOLIO ═══ */\n' +
            '.portfolio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.portfolio-grid--cols-2 { grid-template-columns: repeat(2, 1fr); }\n' +
            '.portfolio-grid--cols-4 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }\n' +
            '@media (max-width: 768px) { .portfolio-grid--cols-2, .portfolio-grid--cols-4 { grid-template-columns: 1fr; } }\n' +
            '.portfolio-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: border-color 0.3s, transform 0.3s var(--ease); }\n' +
            '.portfolio-card:hover { border-color: var(--accent); transform: translateY(-4px); }\n' +
            '.portfolio-card-inner { padding: 2rem; position: relative; min-height: 200px; display: flex; flex-direction: column; justify-content: flex-end; }\n' +
            '.portfolio-meta { color: var(--accent); margin-bottom: 0.5rem; }\n' +
            '.portfolio-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }\n' +
            '.portfolio-desc { color: var(--fg2); font-size: 0.9rem; }\n' +
            '.portfolio-num { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 3rem; color: var(--border); font-weight: 800; }\n\n' +
            '/* ═══ ABOUT ═══ */\n' +
            '.about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start; }\n' +
            '.about--flip .about-grid { direction: rtl; }\n' +
            '.about--flip .about-grid > * { direction: ltr; }\n' +
            '.about-desc { color: var(--fg2); font-size: 1rem; line-height: 1.7; margin-bottom: 2rem; }\n' +
            '.stats-row { display: flex; gap: 3rem; }\n' +
            '.stat-val { font-size: 2rem; font-weight: 800; color: var(--accent); }\n' +
            '.stat-label { color: var(--fg2); margin-top: 0.25rem; }\n' +
            '@media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; gap: 2rem; } }\n\n' +
            '/* ═══ PROCESS ═══ */\n' +
            '.process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.process-grid--cols-4 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }\n' +
            '.process-card { padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }\n' +
            '.process-num { color: var(--accent); margin-bottom: 1rem; font-size: 1.5rem; font-weight: 700; }\n' +
            '.process-title { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.75rem; }\n' +
            '.process-desc { color: var(--fg2); font-size: 0.9rem; line-height: 1.6; }\n\n' +
            '/* ═══ TESTIMONIALS ═══ */\n' +
            '.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.testimonial-card { padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }\n' +
            '.testimonial-quote { font-size: 1.05rem; line-height: 1.7; color: var(--fg2); margin-bottom: 1.5rem; font-style: italic; }\n' +
            '.testimonial-name { font-weight: 600; display: block; }\n' +
            '.testimonial-role { color: var(--fg2); }\n\n' +
            '/* ═══ PRICING ═══ */\n' +
            '.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.pricing-card { padding: 2.5rem 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-align: center; }\n' +
            '.pricing-card--accent { border-color: var(--accent); position: relative; }\n' +
            '.pricing-card--accent::before { content: "POPULAR"; position: absolute; top: -0.7rem; left: 50%; transform: translateX(-50%); background: var(--accent); color: #fff; padding: 0.2rem 0.8rem; border-radius: 3px; font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.1em; }\n' +
            '.pricing-name { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }\n' +
            '.pricing-price { font-size: 2.5rem; font-weight: 800; color: var(--accent); margin-bottom: 1.5rem; }\n' +
            '.pricing-features { list-style: none; margin-bottom: 2rem; }\n' +
            '.pricing-features li { padding: 0.5rem 0; color: var(--fg2); font-size: 0.9rem; border-bottom: 1px solid var(--border); }\n\n' +
            '/* ═══ FAQ ═══ */\n' +
            '.faq-list { max-width: 700px; margin: 3rem auto 0; }\n' +
            '.faq-item { border-bottom: 1px solid var(--border); }\n' +
            '.faq-question { padding: 1.25rem 0; font-size: 1rem; font-weight: 500; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }\n' +
            '.faq-question::after { content: "+"; font-size: 1.2rem; color: var(--accent); transition: transform 0.3s; }\n' +
            '.faq-item[open] .faq-question::after { transform: rotate(45deg); }\n' +
            '.faq-answer { padding: 0 0 1.25rem; color: var(--fg2); line-height: 1.6; }\n\n' +
            '/* ═══ STATS STRIP ═══ */\n' +
            '.stats-strip { padding: 5rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }\n' +
            '.stats-strip-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 2rem; text-align: center; }\n' +
            '.stats-strip-item { }\n' +
            '.stats-strip-val { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; line-height: 1; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: -0.02em; }\n' +
            '.stats-strip-label { font-size: 0.7rem; letter-spacing: 0.15em; color: var(--fg2); }\n' +
            '@media (max-width: 520px) { .stats-strip-grid { grid-template-columns: repeat(2, 1fr); gap: 1.5rem; } }\n\n' +
            '/* ═══ LOGO CLOUD ═══ */\n' +
            '.logo-cloud { padding: 4rem 0; overflow: hidden; }\n' +
            '.logo-cloud-label { text-align: center; margin-bottom: 2rem; }\n' +
            '.logo-cloud-track { overflow: hidden; mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%); }\n' +
            '.logo-cloud-inner { display: flex; gap: 4rem; white-space: nowrap; animation: arbelMarquee 28s linear infinite; width: max-content; }\n' +
            '.logo-cloud-item { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--fg); opacity: 0.5; transition: opacity 0.3s; letter-spacing: -0.01em; }\n' +
            '.logo-cloud-item:hover { opacity: 1; }\n' +
            '@keyframes arbelMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }\n' +
            '@media (prefers-reduced-motion: reduce) { .logo-cloud-inner { animation: none; } }\n\n' +
            '/* ═══ CTA BANNER ═══ */\n' +
            '.cta-banner { padding: 6rem 0; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); text-align: center; position: relative; overflow: hidden; }\n' +
            '.cta-banner::before { content:""; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120%; aspect-ratio: 2/1; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 30%, transparent) 0%, transparent 60%); pointer-events: none; }\n' +
            '.cta-banner-inner { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; }\n' +
            '.cta-banner-heading { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.1; margin-bottom: 1rem; letter-spacing: -0.02em; }\n' +
            '.cta-banner-sub { color: var(--fg2); font-size: 1.05rem; line-height: 1.6; margin-bottom: 2rem; }\n\n' +
            '/* ═══ TEAM ═══ */\n' +
            '.team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.team-card { text-align: center; padding: 2rem 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; transition: border-color 0.3s, transform 0.3s var(--ease); }\n' +
            '.team-card:hover { border-color: var(--accent); transform: translateY(-4px); }\n' +
            '.team-avatar { width: 80px; height: 80px; margin: 0 auto 1rem; border-radius: 50%; background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 30%, var(--fg))); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: #fff; letter-spacing: 0.02em; }\n' +
            '.team-name { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; }\n' +
            '.team-role { color: var(--fg2); font-size: 0.7rem; letter-spacing: 0.1em; }\n\n' +
            '/* ═══ SECTION LAYOUT VARIANTS (per-section) ═══ */\n' +
            /* services: list — rows instead of grid */
            '.services.layout-list .services-grid { grid-template-columns: 1fr !important; max-width: 800px; margin-left: auto; margin-right: auto; gap: 0; }\n' +
            '.services.layout-list .service-card { display: grid; grid-template-columns: 80px 1fr; gap: 1.5rem; align-items: start; padding: 2rem 0; background: transparent !important; border-radius: 0 !important; border: 0 !important; border-bottom: 1px solid var(--border) !important; }\n' +
            '.services.layout-list .service-card:hover { transform: none; background: color-mix(in srgb, var(--accent) 4%, transparent) !important; }\n' +
            '.services.layout-list .service-num { font-size: 2rem; color: var(--accent); margin: 0; }\n' +
            /* services: alternating — two-column zigzag */
            '.services.layout-alternating .services-grid { grid-template-columns: 1fr !important; gap: 2rem; max-width: 960px; margin-left: auto; margin-right: auto; }\n' +
            '.services.layout-alternating .service-card { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; padding: 2rem; }\n' +
            '.services.layout-alternating .service-card:nth-child(even) .service-num { order: 2; text-align: right; }\n' +
            '@media (max-width: 768px) { .services.layout-alternating .service-card { grid-template-columns: 1fr; gap: 1rem; } }\n' +
            /* services/portfolio: bento — varied spans */
            '.services.layout-bento .services-grid, .portfolio.layout-bento .portfolio-grid { grid-template-columns: repeat(6, 1fr) !important; grid-auto-rows: minmax(180px, auto); gap: 1rem; }\n' +
            '.services.layout-bento .service-card:nth-child(1), .portfolio.layout-bento .portfolio-card:nth-child(1) { grid-column: span 4; grid-row: span 2; }\n' +
            '.services.layout-bento .service-card:nth-child(2), .portfolio.layout-bento .portfolio-card:nth-child(2) { grid-column: span 2; grid-row: span 1; }\n' +
            '.services.layout-bento .service-card:nth-child(3), .portfolio.layout-bento .portfolio-card:nth-child(3) { grid-column: span 2; grid-row: span 1; }\n' +
            '.services.layout-bento .service-card:nth-child(4), .portfolio.layout-bento .portfolio-card:nth-child(4) { grid-column: span 3; grid-row: span 1; }\n' +
            '.services.layout-bento .service-card:nth-child(5), .portfolio.layout-bento .portfolio-card:nth-child(5) { grid-column: span 3; grid-row: span 1; }\n' +
            '@media (max-width: 768px) { .services.layout-bento .services-grid, .portfolio.layout-bento .portfolio-grid { grid-template-columns: 1fr !important; grid-auto-rows: auto; } .services.layout-bento .service-card, .portfolio.layout-bento .portfolio-card { grid-column: auto !important; grid-row: auto !important; } }\n' +
            /* services: numbered-columns — giant numbers as columns */
            '.services.layout-numbered .services-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important; gap: 1rem; }\n' +
            '.services.layout-numbered .service-card { background: transparent !important; border: 0 !important; padding: 1.5rem 1rem; position: relative; }\n' +
            '.services.layout-numbered .service-num { font-size: 4rem; font-weight: 800; color: color-mix(in srgb, var(--accent) 25%, transparent); line-height: 1; margin-bottom: 0.5rem; }\n' +
            /* portfolio: list */
            '.portfolio.layout-list .portfolio-grid { grid-template-columns: 1fr !important; max-width: 900px; margin-left: auto; margin-right: auto; gap: 0; }\n' +
            '.portfolio.layout-list .portfolio-card { display: grid; grid-template-columns: 60px 1fr 120px; gap: 2rem; align-items: center; padding: 1.5rem 0; background: transparent !important; border-radius: 0 !important; border: 0 !important; border-bottom: 1px solid var(--border) !important; }\n' +
            '.portfolio.layout-list .portfolio-card:hover { transform: none; }\n' +
            '.portfolio.layout-list .portfolio-card-inner { padding: 0; min-height: 0; grid-column: 2; }\n' +
            '.portfolio.layout-list .portfolio-num { position: static; font-size: 2.5rem; grid-column: 1; }\n' +
            '@media (max-width: 640px) { .portfolio.layout-list .portfolio-card { grid-template-columns: 50px 1fr; } }\n\n' +
            '/* ═══ CONTACT ═══ */\n' +
            '.contact { min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; overflow: hidden; }\n' +
            '.contact-bg { position: absolute; inset: 0; }\n' +
            '.contact-inner { position: relative; z-index: 2; }\n' +
            '.contact-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; }\n\n' +
            '/* ═══ FOOTER ═══ */\n' +
            '.footer { padding: 2rem; border-top: 1px solid var(--border); }\n' +
            '.footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }\n' +
            '.footer .logo { font-size: 1rem; }\n' +
            '.footer .mono { color: var(--fg2); }\n\n' +
            '/* ═══ ARBEL BADGE ═══ */\n' +
            '.arbel-badge { text-align: center; padding: 10px 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: rgba(255,255,255,0.35); letter-spacing: 0.03em; user-select: none; -webkit-user-select: none; }\n' +
            '.arbel-badge a { color: rgba(255,255,255,0.45); text-decoration: none; transition: color 0.2s; }\n' +
            '.arbel-badge a:hover { color: rgba(255,255,255,0.7); }\n\n' +
            '/* ═══ REVEAL ANIMATIONS ═══ */\n' +
            '.reveal-up { will-change: transform, opacity; }\n' +
            '.line-inner { display: inline-block; will-change: transform; }\n\n' +
            '/* ═══ WEBGL / PARTICLES ═══ */\n' +
            '.webgl-bg, .anim-bg { position: absolute; inset: 0; overflow: hidden; }\n' +
            '.webgl-bg canvas, .anim-bg canvas { width: 100% !important; height: 100% !important; display: block; }\n\n' +
            '/* ═══ RESPONSIVE ═══ */\n' +
            '@media (max-width: 768px) {\n' +
            '  .section { padding: 5rem 0; }\n' +
            '  .hero-heading { font-size: clamp(2rem, 8vw, 3.5rem); }\n' +
            '  .stats-row { gap: 1.5rem; }\n' +
            '  .stat-val { font-size: 1.5rem; }\n' +
            '}\n' +
            _buildTokenOverrides(dt, cfg);
    }

    /** Apply AI-chosen design tokens (density / corners / typography / section tones / anims)
     *  as targeted overrides on top of the base CSS. */
    function _buildTokenOverrides(dt, cfg) {
        var css = '';
        if (dt && typeof dt === 'object') {
            css += '\n/* ═══ DESIGN TOKEN OVERRIDES (AI) ═══ */\n';
            if (dt.radius != null) {
                var r = Math.max(0, Math.min(40, +dt.radius));
                css += '.btn, .service-card, .portfolio-card, .process-card, .testimonial-card, .pricing-card, .faq-item, .stat, .tier-feature, input, textarea, select { border-radius: ' + r + 'px; }\n';
            }
            if (dt.spaceUnit != null) {
                var sp = Math.max(4, Math.min(16, +dt.spaceUnit));
                var padRem = (sp * 1.25).toFixed(2);
                css += '.section { padding: ' + padRem + 'rem 0; }\n';
                css += '.service-card, .process-card, .testimonial-card, .pricing-card { padding: ' + (sp * 0.28).toFixed(2) + 'rem; }\n';
            }
            if (dt.headingFont) {
                css += '.hero-heading, h1, h2, h3, .section-heading { font-family: ' + dt.headingFont + '; }\n';
            }
        }

        // Per-section tones — safe because section IDs are a fixed whitelist.
        // We redefine the CSS custom properties inside the section scope so EVERY
        // descendant (cards, body copy, labels, borders) automatically adapts —
        // this fixes invisible card text on light/accent-toned sections.
        var toneVars = {
            dark: {
                bg: 'var(--surface)', fg: 'var(--fg)',
                scope: ''
            },
            light: {
                bg: '#f8f6f1', fg: '#1a1a22',
                scope: '--fg:#1a1a22;--fg2:#4a4a55;--surface:#ffffff;--border:rgba(0,0,0,0.10);--bg:#f8f6f1;'
            },
            accent: {
                bg: 'var(--accent)', fg: '#ffffff',
                scope: '--fg:#ffffff;--fg2:rgba(255,255,255,0.82);--surface:color-mix(in srgb, var(--accent) 70%, #000 30%);--border:rgba(255,255,255,0.20);--bg:var(--accent);'
            }
        };
        if (cfg && cfg.sectionTones && typeof cfg.sectionTones === 'object') {
            css += '\n/* ═══ SECTION TONES (AI) ═══ */\n';
            Object.keys(cfg.sectionTones).forEach(function (id) {
                var toneName = cfg.sectionTones[id];
                var t = toneVars[toneName];
                if (!t) return;
                if (!/^[a-z]+$/.test(id)) return;
                css += '#' + id + '{background:' + t.bg + ';color:' + t.fg + ';' + t.scope + '}\n';
                // Force every text node inside the section to use the scoped foreground.
                // Without this, elements with explicit var(--fg2) stay dark-theme.
                css += '#' + id + ' .section-heading,#' + id + ' h2,#' + id + ' h3,#' + id + ' h4,#' + id + ' p,#' + id + ' li,#' + id + ' .service-title,#' + id + ' .portfolio-title,#' + id + ' .process-title,#' + id + ' .testimonial-name,#' + id + ' .pricing-name{color:var(--fg);}\n';
                css += '#' + id + ' .service-desc,#' + id + ' .portfolio-desc,#' + id + ' .process-desc,#' + id + ' .testimonial-quote,#' + id + ' .testimonial-role,#' + id + ' .stat-label,#' + id + ' .pricing-desc,#' + id + ' .pricing-card li{color:var(--fg2);}\n';
                if (toneName === 'light') {
                    css += '#' + id + ' .service-card,#' + id + ' .portfolio-card,#' + id + ' .process-card,#' + id + ' .testimonial-card,#' + id + ' .pricing-card,#' + id + ' .faq-item{background:#ffffff;border-color:rgba(0,0,0,0.10);box-shadow:0 1px 3px rgba(0,0,0,0.04);}\n';
                    css += '#' + id + ' .portfolio-num{color:rgba(0,0,0,0.08);}\n';
                }
                if (toneName === 'accent') {
                    css += '#' + id + ' .service-card,#' + id + ' .portfolio-card,#' + id + ' .process-card,#' + id + ' .testimonial-card,#' + id + ' .pricing-card,#' + id + ' .faq-item{background:rgba(0,0,0,0.18);border-color:rgba(255,255,255,0.18);}\n';
                    css += '#' + id + ' .section-label,#' + id + ' .service-num,#' + id + ' .process-num,#' + id + ' .portfolio-meta,#' + id + ' .pricing-price{color:#ffffff;}\n';
                    css += '#' + id + ' .portfolio-num{color:rgba(255,255,255,0.15);}\n';
                }
            });
        }

        // Per-section entrance animations
        var animMap = {
            fade:       '@keyframes arbelFade{from{opacity:0}to{opacity:1}}',
            fadeUp:     '@keyframes arbelFadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}',
            slideLeft:  '@keyframes arbelSlideL{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}',
            slideRight: '@keyframes arbelSlideR{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:translateX(0)}}',
            scale:      '@keyframes arbelScale{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}',
            blur:       '@keyframes arbelBlur{from{opacity:0;filter:blur(12px)}to{opacity:1;filter:blur(0)}}'
        };
        var animName = {
            fade:'arbelFade', fadeUp:'arbelFadeUp', slideLeft:'arbelSlideL',
            slideRight:'arbelSlideR', scale:'arbelScale', blur:'arbelBlur'
        };
        if (cfg && cfg.sectionAnims && typeof cfg.sectionAnims === 'object') {
            css += '\n/* ═══ SECTION ANIMATIONS (AI) ═══ */\n';
            var emitted = {};
            Object.keys(cfg.sectionAnims).forEach(function (id) {
                var a = cfg.sectionAnims[id];
                if (!/^[a-z]+$/.test(id)) return;
                if (a === 'none') {
                    css += '#' + id + ' .reveal-up{opacity:1;transform:none;}\n';
                    return;
                }
                if (a === 'stagger') {
                    // Apply a small delay ladder to children
                    css += '#' + id + ' .reveal-up{animation:arbelFadeUp 0.8s var(--ease) both;}\n';
                    for (var i = 1; i <= 8; i++) {
                        css += '#' + id + ' .reveal-up:nth-child(' + i + '){animation-delay:' + (i * 0.08).toFixed(2) + 's;}\n';
                    }
                    if (!emitted.fadeUp) { css += animMap.fadeUp + '\n'; emitted.fadeUp = true; }
                    return;
                }
                if (animName[a]) {
                    css += '#' + id + ' .reveal-up{animation:' + animName[a] + ' 0.9s var(--ease) both;}\n';
                    if (!emitted[a]) { css += animMap[a] + '\n'; emitted[a] = true; }
                }
            });
        }

        return css;
    }

    /* ─── Animations JS ─── */
    function _buildAnimationsJS() {
        return '/* Scroll Animations */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            '// Safety: dismiss preloader after 5s even if GSAP fails to load\n' +
            'var _safetyTimer=setTimeout(function(){var p=document.getElementById("preloader");if(p&&!p.classList.contains("done"))p.classList.add("done");},5000);\n' +
            'function init(){\n' +
            '  if(typeof gsap==="undefined"||typeof ScrollTrigger==="undefined"){setTimeout(init,100);return;}\n' +
            '  clearTimeout(_safetyTimer);\n' +
            '  gsap.registerPlugin(ScrollTrigger);\n\n' +
            '  // Preloader\n' +
            '  var fill=document.getElementById("preloaderFill");\n' +
            '  var pre=document.getElementById("preloader");\n' +
            '  if(fill){\n' +
            '    gsap.to(fill,{width:"100%",duration:1.2,ease:"power2.inOut",onComplete:function(){\n' +
            '      if(pre)pre.classList.add("done");\n' +
            '      revealHero();\n' +
            '    }});\n' +
            '  } else { revealHero(); }\n\n' +
            '  function revealHero(){\n' +
            '    gsap.to(".hero .line-inner",{yPercent:0,duration:1,stagger:0.12,ease:"expo.out",delay:0.2});\n' +
            '    gsap.to(".hero-sub",{opacity:1,y:0,duration:0.8,delay:0.6,ease:"power2.out"});\n' +
            '    gsap.to(".hero-actions",{opacity:1,y:0,duration:0.8,delay:0.8,ease:"power2.out"});\n' +
            '  }\n\n' +
            '  // Set initial states\n' +
            '  gsap.set(".line-inner",{yPercent:110});\n' +
            '  gsap.set(".hero-sub",{opacity:0,y:20});\n' +
            '  gsap.set(".hero-actions",{opacity:0,y:20});\n' +
            '  gsap.set(".reveal-up",{opacity:0,y:40});\n\n' +
            '  // Section heading reveals\n' +
            '  document.querySelectorAll(".section-heading .line-inner").forEach(function(el){\n' +
            '    ScrollTrigger.create({\n' +
            '      trigger:el.closest(".section"),\n' +
            '      start:"top 80%",\n' +
            '      onEnter:function(){gsap.to(el,{yPercent:0,duration:0.9,ease:"expo.out"});}\n' +
            '    });\n' +
            '  });\n\n' +
            '  // Reveal-up elements\n' +
            '  document.querySelectorAll(".reveal-up").forEach(function(el){\n' +
            '    ScrollTrigger.create({\n' +
            '      trigger:el,\n' +
            '      start:"top 85%",\n' +
            '      onEnter:function(){gsap.to(el,{opacity:1,y:0,duration:0.8,ease:"power2.out"});}\n' +
            '    });\n' +
            '  });\n\n' +
            '  // Smooth scroll\n' +
            '  if(typeof Lenis!=="undefined"){\n' +
            '    var lenis=new Lenis({lerp:0.1,smoothWheel:true});\n' +
            '    lenis.on("scroll",ScrollTrigger.update);\n' +
            '    gsap.ticker.add(function(t){lenis.raf(t*1000);});\n' +
            '    gsap.ticker.lagSmoothing(0);\n' +
            '    ScrollTrigger.refresh();\n' +
            '  }\n' +
            '}\n' +
            'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}\n' +
            '})();';
    }

    /* ─── Main JS (cursor, magnetic, tilt, menu) ─── */
    function _buildMainJS(cfg) {
        return '/* Main Interactions */\n' +
            '(function(){\n' +
            '"use strict";\n\n' +
            '// Custom cursor\n' +
            'var cursor=document.getElementById("cursor");\n' +
            'if(cursor && window.matchMedia("(pointer:fine)").matches){\n' +
            '  var cx=0,cy=0,tx=0,ty=0;\n' +
            '  document.addEventListener("mousemove",function(e){tx=e.clientX;ty=e.clientY;},{passive:true});\n' +
            '  (function loop(){\n' +
            '    cx+=(tx-cx)*0.15;cy+=(ty-cy)*0.15;\n' +
            '    cursor.style.transform="translate("+cx+"px,"+cy+"px)";\n' +
            '    requestAnimationFrame(loop);\n' +
            '  })();\n' +
            '  document.querySelectorAll("a,button,.cursor-hover").forEach(function(el){\n' +
            '    el.addEventListener("mouseenter",function(){cursor.classList.add("hover");});\n' +
            '    el.addEventListener("mouseleave",function(){cursor.classList.remove("hover");});\n' +
            '  });\n' +
            '  cursor.style.opacity="1";\n' +
            '} else if(cursor){ cursor.style.display="none"; }\n\n' +
            '// Magnetic buttons\n' +
            'document.querySelectorAll(".magnetic").forEach(function(btn){\n' +
            '  btn.addEventListener("mousemove",function(e){\n' +
            '    var r=btn.getBoundingClientRect();\n' +
            '    var x=(e.clientX-r.left-r.width/2)*0.2;\n' +
            '    var y=(e.clientY-r.top-r.height/2)*0.2;\n' +
            '    btn.style.transform="translate("+x+"px,"+y+"px)";\n' +
            '  });\n' +
            '  btn.addEventListener("mouseleave",function(){\n' +
            '    btn.style.transform="";\n' +
            '    btn.style.transition="transform 0.4s cubic-bezier(0.16,1,0.3,1)";\n' +
            '  });\n' +
            '});\n\n' +
            (cfg.navEnabled !== false ?
            '// Mobile menu\n' +
            'var menuBtn=document.getElementById("menuBtn");\n' +
            'var nav=document.getElementById("nav");\n' +
            'if(menuBtn&&nav){\n' +
            '  menuBtn.addEventListener("click",function(){var isOpen=nav.classList.toggle("open");menuBtn.classList.toggle("is-active");document.body.classList.toggle("nav-open",isOpen);});\n' +
            '  nav.querySelectorAll(".nav-link").forEach(function(link){\n' +
            '    link.addEventListener("click",function(){nav.classList.remove("open");menuBtn.classList.remove("is-active");document.body.classList.remove("nav-open");});\n' +
            '  });\n' +
            '}\n\n' : '') +
            '// Smooth anchor scroll\n' +
            'document.querySelectorAll(\'a[href^="#"]\').forEach(function(a){\n' +
            '  a.addEventListener("click",function(e){\n' +
            '    var h=a.getAttribute("href");if(!h||h==="#")return;\n' +
            '    var target=document.querySelector(h);\n' +
            '    if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth"});}\n' +
            '  });\n' +
            '});\n\n' +
            '// Section spotlight\n' +
            'document.querySelectorAll(".section").forEach(function(sec){\n' +
            '  sec.addEventListener("mousemove",function(e){\n' +
            '    var r=sec.getBoundingClientRect();\n' +
            '    sec.style.setProperty("--mx",((e.clientX-r.left)/r.width*100)+"%");\n' +
            '    sec.style.setProperty("--my",((e.clientY-r.top)/r.height*100)+"%");\n' +
            '  },{passive:true});\n' +
            '});\n\n' +
            '})();';
    }

    /* ─── README ─── */
    function _buildReadme(cfg) {
        return '# ' + cfg.brandName + '\n\n' +
            (cfg.tagline ? cfg.tagline + '\n\n' : '') +
            'Built with [Arbel Generator](https://arbeltechnologies.github.io/generator) — cinematic websites, free.\n\n' +
            '## Tech Stack\n' +
            '- Cinematic backgrounds (WebGL shaders / Canvas particles)\n' +
            '- Scroll-driven animations (GSAP + ScrollTrigger)\n' +
            '- Smooth scrolling (Lenis)\n' +
            '- Custom cursor & magnetic interactions\n' +
            '- Fully responsive\n\n' +
            '## Hosting\n' +
            'This site is hosted on GitHub Pages. To use a custom domain, add a `CNAME` file with your domain name.\n';
    }

    /* ─── Config JSON ─── */
    function _buildConfig(cfg) {
        // X9: arbel.config.json is publicly accessible on GitHub Pages.
        // contactEmail is intentionally excluded from this file to prevent public exposure.
        return JSON.stringify({
            version: '1.0',
            generator: 'arbel',
            style: cfg.style,
            brandName: cfg.brandName,
            tagline: cfg.tagline,
            accent: cfg.accent,
            bgColor: cfg.bgColor,
            industry: cfg.industry || '',
            sections: cfg.sections,
            content: cfg.content
        }, null, 2);
    }

    /* ═══ Build Video Layer JS ═══ */
    function _buildVideoLayerJS(vl) {
        var js = '/* Arbel — Video Scroll Layer */\n(function(){\n';
        js += 'var SPEED=' + (vl.speed || 1) + ',LOOP=' + (vl.loop ? 'true' : 'false') + ',FPS=' + (vl.fps || 24) + ';\n';
        js += 'var css=document.createElement("style");css.textContent=".arbel-vl{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none}.arbel-vl canvas{width:100%;height:100%;object-fit:cover}";document.head.appendChild(css);\n';
        js += 'document.body.style.position="relative";document.body.style.zIndex="0";\n';
        js += 'var div=document.createElement("div");div.className="arbel-vl";\n';
        js += 'var cv=document.createElement("canvas");div.appendChild(cv);document.body.insertBefore(div,document.body.firstChild);\n';
        js += 'var ctx=cv.getContext("2d"),frames=[],lastF=-1;\n';
        js += 'function rsz(){cv.width=window.innerWidth;cv.height=window.innerHeight;draw(lastF<0?0:lastF,true)}rsz();\n';
        js += 'window.addEventListener("resize",rsz);\n';
        js += 'function draw(i,force){if(i<0||i>=frames.length)return;if(!force&&i===lastF)return;if(frames[i]&&frames[i].complete&&frames[i].naturalWidth>0){ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(frames[i],0,0,cv.width,cv.height);lastF=i}}\n';
        js += 'function onScroll(){var mx=document.documentElement.scrollHeight-window.innerHeight;if(mx<=0){draw(0);return}var p=window.scrollY/mx*SPEED;if(LOOP)p=p%1;else p=Math.min(p,1);draw(Math.min(Math.floor(p*frames.length),frames.length-1))}\n';
        js += 'window.addEventListener("scroll",onScroll,{passive:true});\n';

        if (vl.preset) {
            // For presets: embed the generation code so frames are created on page load
            js += _getPresetGenCode(vl.preset);
        } else if (vl.frames && vl.frames.length) {
            // For uploaded videos/sequences: embed frame data URLs
            js += 'var srcs=' + JSON.stringify(vl.frames) + ';\n';
            js += 'srcs.forEach(function(s){var im=new Image();im.src=s;frames.push(im)});\n';
            js += 'if(frames[0])frames[0].onload=function(){draw(0,true);onScroll()};\n';
        }

        js += '})();\n';
        return js;
    }

    function _getPresetGenCode(preset) {
        var code = '';
        code += 'var genCv=document.createElement("canvas");genCv.width=640;genCv.height=360;\n';
        code += 'var gCtx=genCv.getContext("2d"),total=Math.max(30,Math.round(FPS*5)),idx=0;\n';
        code += 'function gen(){\n';
        code += '  if(idx>=total){if(frames[0])frames[0].onload=function(){draw(0,true);onScroll()};return}\n';
        code += '  var t=idx/total;gCtx.clearRect(0,0,640,360);\n';

        // Include the specific preset drawing code
        code += _getPresetDrawCode(preset);

        code += '  var im=new Image();im.src=genCv.toDataURL("image/jpeg",0.7);frames.push(im);idx++;\n';
        code += '  requestAnimationFrame(gen);\n';
        code += '}\ngen();\n';
        return code;
    }

    function _getPresetDrawCode(preset) {
        // Each preset's per-frame drawing code (same logic as editor.js _generatePresetFrames)
        var w = 640, h = 360;
        var presets = {
            cosmic: '  gCtx.fillStyle="#050510";gCtx.fillRect(0,0,640,360);for(var i=0;i<80;i++){var sx=(Math.sin(i*47.3+t*2)*.5+.5)*640,sy=(Math.cos(i*31.7+t*1.5)*.5+.5)*360;gCtx.fillStyle="rgba("+(150+i%100)+","+(100+i%50)+",255,"+(.3+Math.sin(i+t*5)*.2)+")";gCtx.beginPath();gCtx.arc(sx,sy,1+Math.sin(i+t*3)*.5,0,6.28);gCtx.fill()}var g=gCtx.createRadialGradient(640*(.3+t*.4),180,0,320,180,384);g.addColorStop(0,"rgba(100,50,200,0.08)");g.addColorStop(1,"transparent");gCtx.fillStyle=g;gCtx.fillRect(0,0,640,360);\n',
            ocean: '  gCtx.fillStyle="#020818";gCtx.fillRect(0,0,640,360);for(var wv=0;wv<5;wv++){gCtx.strokeStyle="rgba(0,"+(100+wv*30)+",255,"+(.1-wv*.015)+")";gCtx.lineWidth=2;gCtx.beginPath();for(var x=0;x<=640;x+=4){var y=360*(.3+wv*.12)+Math.sin(x*.01+t*6.28+wv)*30;x===0?gCtx.moveTo(x,y):gCtx.lineTo(x,y)}gCtx.stroke()}\n',
            aurora: '  gCtx.fillStyle="#050812";gCtx.fillRect(0,0,640,360);for(var ab=0;ab<4;ab++){gCtx.fillStyle="rgba("+(ab%2===0?"0,200,100":"100,0,200")+",0.04)";gCtx.beginPath();for(var ax=0;ax<=640;ax+=5){var ay=360*.3+Math.sin(ax*.006+t*6.28+ab*1.5)*360*.15;ax===0?gCtx.moveTo(ax,ay):gCtx.lineTo(ax,ay)}gCtx.lineTo(640,360);gCtx.lineTo(0,360);gCtx.fill()}\n',
            smoke: '  gCtx.fillStyle="#0a0a0a";gCtx.fillRect(0,0,640,360);for(var si=0;si<8;si++){var sx2=640*(.2+si*.08)+Math.sin(t*6.28+si)*40,sy2=360-360*t*.8-si*30;var g2=gCtx.createRadialGradient(sx2,sy2,0,sx2,sy2,80+si*10);g2.addColorStop(0,"rgba(150,150,150,0.05)");g2.addColorStop(1,"transparent");gCtx.fillStyle=g2;gCtx.fillRect(0,0,640,360)}\n',
            neon: '  gCtx.fillStyle="#08080f";gCtx.fillRect(0,0,640,360);gCtx.strokeStyle="rgba(100,108,255,0.15)";gCtx.lineWidth=.5;for(var gx=0;gx<640;gx+=40){gCtx.beginPath();gCtx.moveTo(gx,0);gCtx.lineTo(gx,360);gCtx.stroke()}for(var gy=0;gy<360;gy+=40){gCtx.beginPath();gCtx.moveTo(0,gy);gCtx.lineTo(640,gy);gCtx.stroke()}var ny=360*(1-t);gCtx.shadowBlur=20;gCtx.shadowColor="#646cff";gCtx.strokeStyle="#646cff";gCtx.lineWidth=2;gCtx.beginPath();gCtx.moveTo(0,ny);gCtx.lineTo(640,ny);gCtx.stroke();gCtx.shadowBlur=0;\n',
            nature: '  gCtx.fillStyle="#051008";gCtx.fillRect(0,0,640,360);for(var ni=0;ni<15;ni++){var nx=(Math.sin(ni*23.7+t*3)*.5+.5)*640,ny2=(ni*360/15+t*360)%(360+20)-10;gCtx.fillStyle="rgba(30,"+(120+ni*8)+",40,0.3)";gCtx.beginPath();gCtx.ellipse(nx,ny2,5+Math.sin(ni)*2,3,Math.sin(t*6.28+ni)*.5,0,6.28);gCtx.fill()}\n',
            glitch: '  gCtx.fillStyle="#0a0a12";gCtx.fillRect(0,0,640,360);for(var gi=0;gi<12;gi++){var gy2=Math.random()*360,gh2=2+Math.random()*8;gCtx.fillStyle="rgba("+(Math.random()>.5?"255,0,100":"0,200,255")+","+(0.1+Math.random()*0.2)+")";gCtx.fillRect(Math.random()*192,gy2,256+Math.random()*192,gh2)}gCtx.globalCompositeOperation="lighter";gCtx.fillStyle="rgba(255,0,80,0.05)";gCtx.fillRect(Math.sin(t*30)*10,0,640,360);gCtx.fillStyle="rgba(0,200,255,0.05)";gCtx.fillRect(-Math.sin(t*30)*10,0,640,360);gCtx.globalCompositeOperation="source-over";\n',
            fire: '  gCtx.fillStyle="#0a0400";gCtx.fillRect(0,0,640,360);for(var fi=0;fi<20;fi++){var fx=640*(.2+fi*0.03)+Math.sin(t*8+fi*2)*20;var fy=360-(t*360*0.7+fi*15+Math.sin(fi*3+t*5)*20);var fr=15+fi*2+Math.sin(t*6+fi)*8;var fGrad=gCtx.createRadialGradient(fx,fy,0,fx,fy,fr);fGrad.addColorStop(0,"rgba(255,"+(100+fi*5)+",0,0.15)");fGrad.addColorStop(1,"transparent");gCtx.fillStyle=fGrad;gCtx.fillRect(0,0,640,360)}\n',
            rain: '  gCtx.fillStyle="#060810";gCtx.fillRect(0,0,640,360);gCtx.strokeStyle="rgba(140,180,255,0.3)";gCtx.lineWidth=1;for(var ri=0;ri<60;ri++){var rx=(ri*17.3+t*50)%640;var ry=((ri*31.7+t*200)%(360+40))-20;gCtx.beginPath();gCtx.moveTo(rx,ry);gCtx.lineTo(rx-1,ry+12);gCtx.stroke()}\n',
            galaxy: '  gCtx.fillStyle="#030308";gCtx.fillRect(0,0,640,360);for(var spi=0;spi<120;spi++){var angle=spi*0.15+t*3;var dist=spi*1.5+Math.sin(spi*0.3)*10;var spx=320+Math.cos(angle)*dist;var spy=180+Math.sin(angle)*dist*0.6;var spBright=0.2+Math.sin(spi*0.5+t*4)*0.15;gCtx.fillStyle="rgba("+(180+spi%70)+","+(140+spi%80)+",255,"+spBright+")";gCtx.beginPath();gCtx.arc(spx,spy,1+Math.random(),0,6.28);gCtx.fill()}\n'
        };
        return presets[preset] || presets.cosmic;
    }

    /* ═══ Build sub-page HTML ═══ */
    function _buildPageHTML(cfg, page) {
        // Merge site-level content with any page-specific content overrides
        var c = Object.assign({}, cfg.content || {}, page.content || {});
        var cat = _getAnimCategory(cfg.style);
        var parts = (page.path || '').replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
        var prefix = parts.length > 0 ? parts.map(function () { return '..'; }).join('/') + '/' : '';

        // Build nav with links back to home sections + other pages
        var navLinks2 = '';
        var navMap2 = { services: c.servicesNav || 'Services', portfolio: c.portfolioNav || 'Work', about: c.aboutNav || 'About', process: c.processNav || 'Process', pricing: c.pricingNav || 'Pricing', contact: c.contactNav || 'Contact' };
        (cfg.sections || []).forEach(function (s) {
            if (s === 'hero' || s === 'testimonials' || s === 'faq') return;
            if (navMap2[s]) navLinks2 += '        <a href="' + prefix + '#' + s + '" class="nav-link" data-arbel-id="nav-' + s + '" data-arbel-edit="text">' + navMap2[s] + '</a>\n';
        });
        if (cfg.pages) {
            cfg.pages.forEach(function (pg) {
                if (pg.isHome || pg.showInNav === false || pg.id === page.id) return;
                var pgPath = (pg.path || '/' + pg.id).replace(/^\//, '').replace(/\/$/, '');
                navLinks2 += '        <a href="' + prefix + pgPath + '" class="nav-link" data-arbel-id="nav-page-' + pg.id + '" data-arbel-edit="text">' + esc(pg.name) + '</a>\n';
            });
        }

        return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
            '  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '  <title>' + esc(page.seoTitle || page.name) + ' \u2014 ' + esc(cfg.brandName) + '</title>\n' +
            (page.seoDesc ? '  <meta name="description" content="' + esc(page.seoDesc) + '">\n' : '') +
            '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
            '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
            '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">\n' +
            '  <link rel="stylesheet" href="' + prefix + 'css/style.css">\n' +
            '</head>\n<body>\n\n' +
            '  <div class="cursor" id="cursor"><div class="cursor-dot"></div><div class="cursor-ring"></div></div>\n' +
            '  <div class="noise-bg"></div>\n\n' +
            (cfg.navEnabled !== false ?
            '  <header class="header" id="header">\n    <div class="header-inner">\n' +
            '      <a href="' + prefix + '" class="logo" data-arbel-id="site-logo" data-arbel-edit="text">' + esc(cfg.brandName) + '</a>\n' +
            '      <nav class="nav" id="nav" data-arbel-id="site-nav">\n' + navLinks2 + '      </nav>\n' +
            '      <div class="nav-extra" id="navExtra" data-arbel-id="nav-extra"></div>\n' +
            '      <button class="menu-btn" id="menuBtn" data-arbel-id="menu-btn" aria-label="Menu"><span></span><span></span></button>\n' +
            '    </div>\n  </header>\n\n' : '') +
            (function () {
                var nameLower = (page.name || '').toLowerCase();
                var isContact = nameLower.indexOf('contact') >= 0 || (page.id || '').indexOf('contact') >= 0;
                var fieldStyle = 'width:100%;padding:0.85rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--fg);font-family:inherit;font-size:0.85rem;outline:none;transition:border-color 0.2s;';
                if (isContact) {
                    return '  <section class="section" style="padding-top:12rem;min-height:70vh">\n' +
                        '    <span class="section-label mono">' + esc((page.name || 'CONTACT').toUpperCase()) + '</span>\n' +
                        '    <h2 class="section-heading" data-arbel-id="contact-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.contactHeading || 'Get In Touch') + '</span></span></h2>\n' +
                        '    <p style="max-width:540px;color:var(--fg2);line-height:1.8;margin-top:1.5rem;margin-bottom:3rem" data-arbel-id="contact-sub" data-arbel-edit="text">' + esc(c.contactSubheading || page.seoDesc || 'Have a project in mind? We\'d love to hear from you.') + '</p>\n' +
                        '    <form action="#" method="POST" style="max-width:540px;display:grid;gap:1.2rem" onsubmit="this.querySelector(\'[type=submit]\').textContent=\'Sent!\';return false">\n' +
                        '      <input type="text" name="name" autocomplete="name" placeholder="Your Name" required style="' + fieldStyle + '">\n' +
                        '      <input type="email" name="email" autocomplete="email" placeholder="Your Email" required style="' + fieldStyle + '">\n' +
                        (cfg.contactEmail ? '      <p style="font-size:0.7rem;color:var(--fg3);margin-top:-0.5rem">Or email: <a href="mailto:' + esc(cfg.contactEmail) + '" style="color:var(--accent)">' + esc(cfg.contactEmail) + '</a></p>\n' : '') +
                        '      <textarea name="message" rows="5" placeholder="Your Message" required style="' + fieldStyle + 'resize:vertical"></textarea>\n' +
                        '      <button type="submit" class="cta-btn" style="align-self:start;cursor:pointer" data-arbel-id="contact-cta" data-arbel-edit="text">' + esc(c.contactCta || 'Send Message') + '</button>\n' +
                        '    </form>\n' +
                        '  </section>\n\n';
                }
                var pageHeading = c[nameLower + 'Heading'] || c[nameLower + 'Title'] || page.seoTitle || page.name;
                var pageDesc = page.seoDesc || '';
                var pageBody = c[nameLower + 'Body'] || c[nameLower + 'Intro'] || c[nameLower + 'Copy'] || '';
                return '  <section class="section" style="padding-top:12rem;min-height:60vh">\n' +
                    '    <span class="section-label mono">' + esc((page.name || '').toUpperCase()) + '</span>\n' +
                    '    <h2 class="section-heading" data-arbel-id="page-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(pageHeading) + '</span></span></h2>\n' +
                    (pageDesc ? '    <p style="max-width:640px;color:var(--fg2);line-height:1.85;margin-top:2rem" data-arbel-id="page-desc" data-arbel-edit="text">' + esc(pageDesc) + '</p>\n' : '') +
                    (pageBody && pageBody !== pageDesc ? '    <p style="max-width:640px;color:var(--fg2);line-height:1.85;margin-top:1.25rem" data-arbel-id="page-body" data-arbel-edit="text">' + esc(pageBody) + '</p>\n' : '') +
                    '  </section>\n\n';
            }()) +
            '  <footer class="footer">\n    <div class="footer-inner">\n' +
            '      <p class="footer-copy">&copy; <script>document.write(new Date().getFullYear())<\/script> ' + esc(cfg.brandName) + '</p>\n' +
            '    </div>\n  </footer>\n\n' +
            '  <div class="arbel-badge">built with <a href="https://arbel.live" target="_blank" rel="noopener">arbel.live</a></div>\n\n' +
            (cat === 'shader' ? '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n' : '') +
            '  <script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>\n' +
            '  <script src="' + prefix + 'js/' + _getAnimJsFile(cat) + '"><\/script>\n' +
            '  <script src="' + prefix + 'js/animations.js"><\/script>\n' +
            '  <script src="' + prefix + 'js/main.js"><\/script>\n' +
            '</body>\n</html>';
    }

    /* ═══ PUBLIC: Compile full site ═══ */
    function compile(userConfig) {
        var cfg = _defaults(userConfig);
        var cat = _getAnimCategory(cfg.style);
        var files = {
            'index.html': _buildHTML(cfg),
            'css/style.css': _buildCSS(cfg),
            'js/animations.js': _buildAnimationsJS(),
            'js/main.js': _buildMainJS(cfg),
            'README.md': _buildReadme(cfg),
            'arbel.config.json': _buildConfig(cfg)
        };
        var jsFile = _getAnimJsFile(cat);
        switch (cat) {
            case 'particle': files['js/' + jsFile] = _buildParticlesJS(cfg.style, cfg.particles, cfg.bgColor); break;
            case 'blob':     files['js/' + jsFile] = _buildBlobsJS(cfg.style, cfg.particles, cfg.bgColor); break;
            case 'gradient': files['js/' + jsFile] = _buildGradientJS(cfg.style, cfg.particles, cfg.bgColor); break;
            case 'wave':     files['js/' + jsFile] = _buildWaveJS(cfg.style, cfg.particles, cfg.bgColor); break;
            default:         files['js/' + jsFile] = _buildShaderJS(cfg.style); break;
        }

        // Generate additional page files
        if (cfg.pages) {
            cfg.pages.forEach(function (pg) {
                if (pg.isHome) return;
                var pagePath = (pg.path || '/' + pg.id).replace(/^\//, '').replace(/\/$/, '');
                if (pagePath) files[pagePath + '/index.html'] = _buildPageHTML(cfg, pg);
            });
        }

        // Apply editor overrides (text changes, animations, hover, effects) to all HTML files
        if (cfg.editorOverrides) {
            Object.keys(files).forEach(function (key) {
                if (key.match(/\.html$/)) {
                    files[key] = _applyOverrides(files[key], cfg.editorOverrides, cfg.accent);
                }
            });
        }

        // Include video scroll layer in all HTML pages
        if (cfg.videoLayer) {
            files['js/video-layer.js'] = _buildVideoLayerJS(cfg.videoLayer);
            Object.keys(files).forEach(function (key) {
                if (!key.match(/\.html$/)) return;
                var depth = key.split('/').length - 1;
                var vPrefix = depth > 0 ? new Array(depth).join('../') + '../' : '';
                files[key] = files[key].replace('</body>', '<script src="' + vPrefix + 'js/video-layer.js"></script>\n</body>');
            });
        }

        return files;
    }

    /** Apply visual editor overrides to compiled HTML */
    function _applyOverrides(html, overrides, accentColor) {
        var ids = Object.keys(overrides);
        if (!ids.length) return html;

        // Build and inject added overlay elements into nav-extra container
        var navExtraContent = '';
        var navDeviceCss = '';
        ids.forEach(function (id) {
            var o = overrides[id];
            if (!o._added || !o._navOverlay) return;
            var def = o._def || {};
            var tag = def.tag || 'div';
            var safeId = id.replace(/[<>"'`\\]/g, '');
            var elHtml = '<' + tag + ' data-arbel-id="' + safeId + '"';
            if (o.text && tag !== 'img' && tag !== 'video') elHtml += ' data-arbel-edit="text"';
            // Build initial style string from _initStyle
            var initParts = [];
            if (o._initStyle) {
                Object.keys(o._initStyle).forEach(function (k) {
                    var cssProp = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                    initParts.push(cssProp + ':' + o._initStyle[k]);
                });
            }
            if (initParts.length) elHtml += ' style="' + initParts.join(';') + '"';
            // Attributes
            if (o._attrs) {
                Object.keys(o._attrs).forEach(function (ak) {
                    var safeK = ak.replace(/[<>"'`\\]/g, '');
                    var safeV = String(o._attrs[ak]).replace(/[<>"'`\\]/g, '');
                    elHtml += ' ' + safeK + '="' + safeV + '"';
                });
            }
            elHtml += '>';
            // Content
            if (o._html) elHtml += o._html;
            else if (o.text) elHtml += esc(o.text);
            // Close tag (void elements self-close)
            if (tag !== 'img' && tag !== 'hr' && tag !== 'br') elHtml += '</' + tag + '>';
            navExtraContent += '        ' + elHtml + '\n';
            // Per-device visibility CSS
            if (o._navDevice === 'mobile') {
                navDeviceCss += '[data-arbel-id="' + safeId + '"]{display:none !important}\n';
                navDeviceCss += '@media(max-width:480px){body.nav-open [data-arbel-id="' + safeId + '"]{display:block !important}}\n';
            } else if (o._navDevice === 'tablet') {
                navDeviceCss += '[data-arbel-id="' + safeId + '"]{display:none !important}\n';
                navDeviceCss += '@media(max-width:768px){body.nav-open [data-arbel-id="' + safeId + '"]{display:block !important}}\n';
            }
        });
        if (navExtraContent) {
            html = html.replace(
                /<div class="nav-extra"([^>]*)><\/div>/g,
                '<div class="nav-extra"$1>\n' + navExtraContent + '      </div>'
            );
        }
        if (navDeviceCss) {
            html = html.replace('</head>', '<style>' + navDeviceCss + '</style>\n</head>');
        }

        var hasEffects = false;
        var hasAnimOrHover = false;
        var inlineStyles = {};

        ids.forEach(function (id) {
            var o = overrides[id];

            // Text replacement — match from data-arbel-id opening to the element's own closing tag
            if (o.text !== undefined) {
                var escapedId = id.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                // First, find the tag name of this element so we close on the right tag
                var tagFinder = new RegExp('<(\\w+)\\s[^>]*data-arbel-id="' + escapedId + '"');
                var tagMatch = html.match(tagFinder);
                var closingTag = tagMatch ? '</' + tagMatch[1] : '</';
                var tagPattern = new RegExp(
                    '(data-arbel-id="' + escapedId + '"[^>]*>)([\\s\\S]*?)(' + closingTag.replace('/', '\\/') + ')',
                    ''
                );
                html = html.replace(tagPattern, function (match, openPart, oldContent, closePart) {
                    return openPart + esc(o.text) + closePart;
                });
            }

            // Entrance animation
            if (o.animation && o.animation !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-anim="' + esc(o.animation) + '"'
                );
                hasAnimOrHover = true;
            }

            // Continuous animation
            if (o.continuous && o.continuous !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-continuous="' + esc(o.continuous) + '"'
                );
                hasAnimOrHover = true;
            }

            // Hover effect
            if (o.hover && o.hover !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-hover="' + esc(o.hover) + '"'
                );
                hasAnimOrHover = true;
            }

            // Background effect
            if (o.effect && o.effect !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-effect="' + esc(o.effect) + '"'
                );
                hasEffects = true;
            }

            // Collect inline style overrides
            var styleProps = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
                'textAlign', 'textDecoration', 'textTransform', 'color', 'backgroundColor', 'background',
                'backgroundImage', 'backgroundSize', 'backgroundPosition',
                'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                'border', 'borderRadius', 'opacity', 'zIndex', 'transform',
                'filter', 'objectFit', 'visibility', 'position', 'left', 'top', 'width', 'height'];
            var styleParts = [];
            styleProps.forEach(function (prop) {
                if (o[prop] !== undefined && o[prop] !== '') {
                    var cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                    var val = o[prop];
                    if (prop === 'zIndex') styleParts.push('z-index:' + val + ';position:relative');
                    else styleParts.push(cssProp + ':' + val);
                }
            });
            if (o.backdrop && o.backdrop !== 'none') {
                var bdMap = { 'blur-sm': 'blur(4px)', 'blur-md': 'blur(8px)', 'blur-lg': 'blur(16px)', saturate: 'saturate(2)', grayscale: 'grayscale(1)', sepia: 'sepia(1)' };
                if (bdMap[o.backdrop]) styleParts.push('backdrop-filter:' + bdMap[o.backdrop]);
            }
            if (o.shadow && o.shadow !== 'none') {
                var shMap = { sm: '0 2px 8px rgba(0,0,0,.15)', md: '0 4px 16px rgba(0,0,0,.2)', lg: '0 8px 32px rgba(0,0,0,.25)', xl: '0 16px 64px rgba(0,0,0,.3)', glow: '0 0 30px rgba(100,108,255,.4)', neon: '0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)', inner: 'inset 0 2px 10px rgba(0,0,0,.3)' };
                if (shMap[o.shadow]) styleParts.push('box-shadow:' + shMap[o.shadow]);
            }
            if (styleParts.length) inlineStyles[id] = styleParts.join(';');
        });

        // Inject inline styles into elements
        Object.keys(inlineStyles).forEach(function (id) {
            var escapedId = id.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            var styleVal = inlineStyles[id];
            // Try to append to existing style attribute
            var existingStyle = new RegExp('(data-arbel-id="' + escapedId + '"[^>]*?)style="([^"]*)"');
            if (existingStyle.test(html)) {
                html = html.replace(existingStyle, '$1style="$2;' + styleVal + '"');
            } else {
                html = html.replace('data-arbel-id="' + id + '"', 'data-arbel-id="' + id + '" style="' + styleVal + '"');
            }
        });

        // Inject background video elements
        ids.forEach(function (id) {
            var o = overrides[id];
            if (o.bgVideo) {
                var escapedId = id.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                var vidTag = '<video autoplay loop muted playsinline style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none"><source src="' + esc(o.bgVideo) + '"></video>';
                var openTagRe = new RegExp('(<\\w+\\s[^>]*data-arbel-id="' + escapedId + '"[^>]*>)');
                html = html.replace(openTagRe, function (match, openTag) {
                    // Ensure parent has position:relative and overflow:hidden
                    if (!/position\s*:/.test(openTag)) {
                        if (/style="/.test(openTag)) {
                            openTag = openTag.replace(/style="/, 'style="position:relative;overflow:hidden;');
                        } else {
                            openTag = openTag.replace(/>$/, ' style="position:relative;overflow:hidden">');
                        }
                    }
                    return openTag + vidTag;
                });
            }
        });

        // Load Google Fonts used
        var fontsUsed = {};
        ids.forEach(function (id) { var o = overrides[id]; if (o.fontFamily) { var m = o.fontFamily.match(/"([^"]+)"/); if (m) fontsUsed[m[1]] = true; } });
        var fontFamilies = Object.keys(fontsUsed);
        if (fontFamilies.length) {
            var fontLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?';
            fontLink += fontFamilies.map(function (f) { return 'family=' + encodeURIComponent(f) + ':wght@300;400;500;600;700;800;900'; }).join('&');
            fontLink += '&display=swap">';
            html = html.replace('</head>', fontLink + '\n</head>');
        }

        // Inject per-device responsive overrides as @media queries
        var _deviceCss = { tablet: '', mobile: '' };
        var _camelToDash = function (s) { return s.replace(/([A-Z])/g, '-$1').toLowerCase(); };
        var _bdMap = { 'blur-sm': 'blur(4px)', 'blur-md': 'blur(8px)', 'blur-lg': 'blur(16px)', saturate: 'saturate(2)', grayscale: 'grayscale(1)', sepia: 'sepia(1)' };
        var _shMap = { sm: '0 2px 8px rgba(0,0,0,.15)', md: '0 4px 16px rgba(0,0,0,.2)', lg: '0 8px 32px rgba(0,0,0,.25)', xl: '0 16px 64px rgba(0,0,0,.3)', glow: '0 0 30px rgba(100,108,255,.4)', neon: '0 0 10px #646cff,0 0 40px rgba(100,108,255,.3)', inner: 'inset 0 2px 10px rgba(0,0,0,.3)' };
        ids.forEach(function (id) {
            var o = overrides[id];
            ['_tablet', '_mobile'].forEach(function (dk) {
                var rsp = o[dk];
                if (!rsp) return;
                var device = dk.substring(1);
                var safeId = id.replace(/["\\]/g, '');
                var rules = '';
                Object.keys(rsp).forEach(function (prop) {
                    var val = String(rsp[prop]).replace(/[<>"'`]/g, '');
                    if (!/javascript\s*:/i.test(val) && !/expression\s*\(/i.test(val)) {
                        if (prop === 'backdrop' && val !== 'none' && _bdMap[val]) {
                            rules += 'backdrop-filter:' + _bdMap[val] + ' !important;';
                        } else if (prop === 'shadow' && val !== 'none' && _shMap[val]) {
                            rules += 'box-shadow:' + _shMap[val] + ' !important;';
                        } else if (prop === 'zIndex') {
                            rules += 'z-index:' + val + ' !important;position:relative !important;';
                        } else if (prop !== 'backdrop' && prop !== 'shadow') {
                            rules += _camelToDash(prop) + ':' + val + ' !important;';
                        }
                    }
                });
                if (rules) _deviceCss[device] += '[data-arbel-id="' + safeId + '"]{' + rules + '}\n';
            });
        });
        var responsiveStyle = '';
        if (_deviceCss.tablet) responsiveStyle += '@media (max-width:768px){\n' + _deviceCss.tablet + '}\n';
        if (_deviceCss.mobile) responsiveStyle += '@media (max-width:480px){\n' + _deviceCss.mobile + '}\n';
        if (responsiveStyle) {
            html = html.replace('</head>', '<style>' + responsiveStyle + '</style>\n</head>');
        }

        // Inject runtime JS
        var overrideJS = _buildOverrideJS(overrides, hasEffects, hasAnimOrHover, accentColor);
        if (overrideJS) {
            html = html.replace('</body>', '<script>' + overrideJS + '<\/script>\n</body>');
        }

        return html;
    }

    /** Build runtime JS for editor overrides */
    function _buildOverrideJS(overrides, hasEffects, hasAnimOrHover, accentColor) {
        if (!hasAnimOrHover && !hasEffects) return '';

        // Convert accent hex to RGB for use in effects
        var accentRgb = '100,108,255';
        if (accentColor && accentColor.charAt(0) === '#' && accentColor.length >= 7) {
            accentRgb = parseInt(accentColor.slice(1, 3), 16) + ',' + parseInt(accentColor.slice(3, 5), 16) + ',' + parseInt(accentColor.slice(5, 7), 16);
        }
        var secondaryRgb = '11,218,81';

        var js = '(function(){\n';
        js += 'var AC="' + accentRgb + '",SC="' + secondaryRgb + '";\n';

        // Animation presets (expanded)
        js += 'var AN={' +
            'fadeIn:{from:"opacity:0",to:"opacity:1"},' +
            'fadeInUp:{from:"opacity:0;transform:translateY(30px)",to:"opacity:1;transform:translateY(0)"},' +
            'fadeInDown:{from:"opacity:0;transform:translateY(-30px)",to:"opacity:1;transform:translateY(0)"},' +
            'slideUp:{from:"opacity:0;transform:translateY(60px)",to:"opacity:1;transform:translateY(0)"},' +
            'slideDown:{from:"opacity:0;transform:translateY(-60px)",to:"opacity:1;transform:translateY(0)"},' +
            'slideLeft:{from:"opacity:0;transform:translateX(60px)",to:"opacity:1;transform:translateX(0)"},' +
            'slideRight:{from:"opacity:0;transform:translateX(-60px)",to:"opacity:1;transform:translateX(0)"},' +
            'scaleUp:{from:"opacity:0;transform:scale(0.7)",to:"opacity:1;transform:scale(1)"},' +
            'scaleDown:{from:"opacity:0;transform:scale(1.3)",to:"opacity:1;transform:scale(1)"},' +
            'bounceIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},' +
            'elasticIn:{from:"opacity:0;transform:scale(0.5)",to:"opacity:1;transform:scale(1)"},' +
            'rotateIn:{from:"opacity:0;transform:rotate(-15deg) scale(0.9)",to:"opacity:1;transform:rotate(0) scale(1)"},' +
            'rotateInLeft:{from:"opacity:0;transform:rotate(-90deg)",to:"opacity:1;transform:rotate(0)"},' +
            'flipIn:{from:"opacity:0;transform:perspective(400px) rotateX(90deg)",to:"opacity:1;transform:perspective(400px) rotateX(0)"},' +
            'flipInY:{from:"opacity:0;transform:perspective(400px) rotateY(90deg)",to:"opacity:1;transform:perspective(400px) rotateY(0)"},' +
            'blurIn:{from:"opacity:0;filter:blur(12px)",to:"opacity:1;filter:blur(0)"},' +
            'glitchIn:{from:"opacity:0;transform:skewX(-20deg) translateX(-30px)",to:"opacity:1;transform:skewX(0) translateX(0)"},' +
            'clipIn:{from:"clip-path:inset(0 100% 0 0);opacity:0",to:"clip-path:inset(0 0 0 0);opacity:1"},' +
            'dropIn:{from:"opacity:0;transform:translateY(-100px)",to:"opacity:1;transform:translateY(0)"},' +
            'unfold:{from:"opacity:0;transform:scaleY(0);transform-origin:top",to:"opacity:1;transform:scaleY(1)"}' +
            '};\n';

        // Hover presets (expanded)
        js += 'var HV={lift:"transform:translateY(-6px);box-shadow:0 12px 40px rgba(0,0,0,.25)",' +
            'scale:"transform:scale(1.06)",glow:"box-shadow:0 0 25px rgba(100,108,255,.5)",' +
            'tilt:"transform:rotate(-2deg)",skew:"transform:skewX(-3deg)",' +
            '"border-glow":"box-shadow:0 0 0 2px #646cff,0 0 20px rgba(100,108,255,.3)",' +
            'brightness:"filter:brightness(1.3)","color-shift":"filter:hue-rotate(30deg)"};\n';

        // Continuous animation keyframes
        js += 'var st=document.createElement("style");st.textContent="' +
            '@keyframes arbel-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' +
            '@keyframes arbel-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}' +
            '@keyframes arbel-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
            '@keyframes arbel-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}' +
            '@keyframes arbel-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}' +
            '@keyframes arbel-swing{0%,100%{transform:rotate(0)}25%{transform:rotate(5deg)}75%{transform:rotate(-5deg)}}' +
            '@keyframes arbel-breathe{0%,100%{opacity:1}50%{opacity:.6}}' +
            '@keyframes arbel-glow-pulse{0%,100%{box-shadow:0 0 5px rgba(' + accentRgb + ',.3)}50%{box-shadow:0 0 25px rgba(' + accentRgb + ',.6)}}' +
            '";document.head.appendChild(st);\n';

        // Continuous animation map
        js += 'var CM={pulse:"arbel-pulse 2s ease-in-out infinite",float:"arbel-float 3s ease-in-out infinite",' +
            'spin:"arbel-spin 4s linear infinite",bounce:"arbel-bounce 1.5s ease-in-out infinite",' +
            'shake:"arbel-shake 0.5s ease-in-out infinite",swing:"arbel-swing 2s ease-in-out infinite",' +
            'breathe:"arbel-breathe 3s ease-in-out infinite","glow-pulse":"arbel-glow-pulse 2s ease-in-out infinite"};\n';

        // IntersectionObserver for entrance animations
        js += 'var io=new IntersectionObserver(function(entries){entries.forEach(function(e){\n' +
            '  if(!e.isIntersecting)return;\n' +
            '  var el=e.target,a=el.getAttribute("data-arbel-anim"),p=AN[a];\n' +
            '  if(!p)return;\n' +
            '  el.style.transition="all .8s cubic-bezier(.16,1,.3,1)";\n' +
            '  p.to.split(";").forEach(function(s){var kv=s.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});\n' +
            '  io.unobserve(el);\n' +
            '})},{threshold:0.15});\n';

        // Init animated elements
        js += 'document.querySelectorAll("[data-arbel-anim]").forEach(function(el){\n' +
            '  var a=el.getAttribute("data-arbel-anim"),p=AN[a];\n' +
            '  if(!p)return;\n' +
            '  p.from.split(";").forEach(function(s){var kv=s.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()});\n' +
            '  io.observe(el);\n' +
            '});\n';

        // Init continuous animations
        js += 'document.querySelectorAll("[data-arbel-continuous]").forEach(function(el){\n' +
            '  var c=el.getAttribute("data-arbel-continuous");\n' +
            '  if(CM[c])el.style.animation=CM[c];\n' +
            '});\n';

        // Init hover elements
        js += 'document.querySelectorAll("[data-arbel-hover]").forEach(function(el){\n' +
            '  var h=el.getAttribute("data-arbel-hover"),css=HV[h];\n' +
            '  if(!css)return;\n' +
            '  el.style.transition="all .3s ease";\n' +
            '  el.addEventListener("mouseenter",function(){el._ph=el.style.cssText;css.split(";").forEach(function(s){var kv=s.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()})});\n' +
            '  el.addEventListener("mouseleave",function(){if(el._ph!==undefined)el.style.cssText=el._ph});\n' +
            '});\n';

        // Background effects (expanded)
        if (hasEffects) {
            js += 'document.querySelectorAll("[data-arbel-effect]").forEach(function(el){\n' +
                '  var name=el.getAttribute("data-arbel-effect");\n' +
                '  if(name==="none")return;\n' +
                '  var pos=getComputedStyle(el).position;if(pos==="static")el.style.position="relative";\n' +
                '  var cv=document.createElement("canvas");cv.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0";\n' +
                '  el.insertBefore(cv,el.firstChild);\n' +
                '  var ctx=cv.getContext("2d");\n' +
                '  function rsz(){cv.width=el.offsetWidth;cv.height=el.offsetHeight}rsz();\n' +
                '  var count=50,ps=[];\n' +
                '  for(var i=0;i<count;i++){ps.push({x:Math.random()*cv.width,y:Math.random()*cv.height,' +
                '    vx:(Math.random()-.5)*.8,vy:(Math.random()-.5)*.8,' +
                '    sz:Math.random()*3+1,a:Math.random()*.5+.2,p:Math.random()*6.28,' +
                '    col:Math.random()>.5?"100,108,255":"11,218,81"})}\n' +
                '  if(name==="bubbles")ps.forEach(function(p){p.vy=-(Math.random()+.3);p.sz=Math.random()*6+2});\n' +
                '  if(name==="snow")ps.forEach(function(p){p.vy=Math.random()*.5+.2;p.sz=Math.random()*3+1});\n' +
                '  if(name==="fireflies"){ps=ps.slice(0,25)}\n' +
                '  function draw(){ctx.clearRect(0,0,cv.width,cv.height);var t=Date.now()*.001;\n' +
                '    if(name==="gradient"){var g=ctx.createLinearGradient(cv.width*(.5+.5*Math.sin(t*.5)),0,cv.width*(.5+.5*Math.cos(t*.3)),cv.height);g.addColorStop(0,"rgba(100,108,255,.12)");g.addColorStop(.5,"rgba(11,218,81,.06)");g.addColorStop(1,"rgba(100,108,255,.12)");ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);requestAnimationFrame(draw);return}\n' +
                '    if(name==="waves"){for(var w=0;w<3;w++){ctx.strokeStyle="rgba(100,108,255,"+(0.15-w*0.03)+")";ctx.lineWidth=1.5-w*0.3;ctx.beginPath();for(var x=0;x<=cv.width;x+=4){var y=cv.height*.5+Math.sin(x*.01+t+w)*20*(w+1);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="aurora"){for(var ab=0;ab<3;ab++){ctx.fillStyle="rgba("+(ab%2===0?"100,108,255":"11,218,81")+",0.04)";ctx.beginPath();for(var ax=0;ax<=cv.width;ax+=6){var ay=cv.height*.3+Math.sin(ax*.005+t*.5+ab*2)*cv.height*.15;ax===0?ctx.moveTo(ax,ay):ctx.lineTo(ax,ay)}ctx.lineTo(cv.width,cv.height);ctx.lineTo(0,cv.height);ctx.fill()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="noise"){var imd=ctx.createImageData(cv.width,cv.height);var d=imd.data;for(var j=0;j<d.length;j+=4){var v=Math.random()*30;d[j]=v;d[j+1]=v;d[j+2]=v;d[j+3]=12}ctx.putImageData(imd,0,0);requestAnimationFrame(draw);return}\n' +
                '    if(name==="blobs"){for(var b=0;b<3;b++){ctx.fillStyle="rgba("+(b%2===0?"100,108,255":"11,218,81")+",0.06)";ctx.beginPath();var bx=cv.width*(.3+b*.2)+Math.sin(t*.5+b)*50,by=cv.height*(.3+b*.2)+Math.cos(t*.4+b)*40,br=60+Math.sin(t+b)*20;for(var ba=0;ba<6.28;ba+=.1){var rr=br+Math.sin(ba*3+t+b)*15;ba===0?ctx.moveTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr):ctx.lineTo(bx+Math.cos(ba)*rr,by+Math.sin(ba)*rr)}ctx.closePath();ctx.fill()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="geometric"){ctx.strokeStyle="rgba(100,108,255,0.15)";ctx.lineWidth=0.5;for(var gi=0;gi<15;gi++){var gx=cv.width*.1+gi*cv.width/15+Math.sin(t+gi)*10,gy=cv.height*.5+Math.cos(t*.7+gi)*cv.height*.3,gsz=15+Math.sin(t+gi)*5;ctx.beginPath();for(var gs=0;gs<6;gs++){var ga=gs*Math.PI/3+t*.2;ctx.lineTo(gx+Math.cos(ga)*gsz,gy+Math.sin(ga)*gsz)}ctx.closePath();ctx.stroke()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="cube"||name==="sphere"||name==="pyramid"||name==="torus"||name==="cylinder"||name==="crystal"||name==="icosahedron"||name==="grid3d"){var cx3=cv.width/2,cy3=cv.height/2,sz3=Math.min(cv.width,cv.height)*0.35;var cosA=Math.cos(t*0.7),sinA=Math.sin(t*0.7),cosB=Math.cos(t*0.5),sinB=Math.sin(t*0.5);function proj(x,y,z){var x1=x*cosA-z*sinA,z1=x*sinA+z*cosA,y1=y*cosB-z1*sinB,z2=y*sinB+z1*cosB;var sc=1/(1+z2*0.003);return{x:cx3+x1*sc,y:cy3+y1*sc,z:z2}}function edg(p1,p2,c,a){ctx.strokeStyle="rgba("+c+","+a+")";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}function dt(p,c,r){ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,r,0,6.28);ctx.fill()}if(name==="cube"){var s=sz3*0.4,vts=[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]];var pvv=vts.map(function(v){return proj(v[0],v[1],v[2])});[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(function(e){edg(pvv[e[0]],pvv[e[1]],"100,108,255",0.6)});pvv.forEach(function(p){dt(p,"rgba(11,218,81,0.8)",3)})}else if(name==="sphere"){for(var sli=0;sli<60;sli++){var phi=Math.PI*sli/30,theta=2*Math.PI*((sli*7)%60)/60;var sx3=sz3*0.4*Math.sin(phi)*Math.cos(theta),sy3=sz3*0.4*Math.sin(phi)*Math.sin(theta),sz4=sz3*0.4*Math.cos(phi);var sp=proj(sx3,sy3,sz4);var bright=0.3+0.5*((sp.z+sz3)/(2*sz3));dt(sp,"rgba("+(sli%2===0?"100,108,255":"11,218,81")+","+bright+")",2+bright)}}else if(name==="pyramid"){var ph2=sz3*0.5,pb2=sz3*0.35;var pvt=[[0,-ph2,0],[-pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,-pb2],[pb2,ph2*0.5,pb2],[-pb2,ph2*0.5,pb2]];var ppv2=pvt.map(function(v){return proj(v[0],v[1],v[2])});[[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]].forEach(function(e){edg(ppv2[e[0]],ppv2[e[1]],"100,108,255",0.5)});ppv2.forEach(function(p){dt(p,"rgba(11,218,81,0.8)",3)})}else if(name==="torus"){var R2=sz3*0.3,r3=sz3*0.12;for(var ti3=0;ti3<80;ti3++){var u=2*Math.PI*ti3/40,v3=2*Math.PI*((ti3*3)%80)/80;var tx=(R2+r3*Math.cos(v3))*Math.cos(u),ty=r3*Math.sin(v3),tz=(R2+r3*Math.cos(v3))*Math.sin(u);var tp=proj(tx,ty,tz);dt(tp,"rgba("+(ti3%2===0?"100,108,255":"11,218,81")+",0.5)",2)}}else if(name==="cylinder"){var cr2=sz3*0.25,ch3=sz3*0.5;for(var ci3=0;ci3<24;ci3++){var ca2=2*Math.PI*ci3/12;var ptop=proj(Math.cos(ca2)*cr2,-ch3*0.5,Math.sin(ca2)*cr2);var pbot=proj(Math.cos(ca2)*cr2,ch3*0.5,Math.sin(ca2)*cr2);dt(ptop,"rgba(100,108,255,0.7)",2);dt(pbot,"rgba(11,218,81,0.7)",2);if(ci3<12)edg(ptop,pbot,"100,108,255",0.3)}}else if(name==="crystal"){var cs3=sz3*0.2,ct2=sz3*0.5;var cvts=[];for(var cv2=0;cv2<6;cv2++){var ang=cv2*Math.PI/3;cvts.push([Math.cos(ang)*cs3,0,Math.sin(ang)*cs3])}cvts.push([0,-ct2,0]);cvts.push([0,ct2*0.5,0]);var cpv2=cvts.map(function(v){return proj(v[0],v[1],v[2])});for(var ce=0;ce<6;ce++){edg(cpv2[ce],cpv2[(ce+1)%6],"100,108,255",0.4);edg(cpv2[ce],cpv2[6],"11,218,81",0.5);edg(cpv2[ce],cpv2[7],"100,108,255",0.3)}cpv2.forEach(function(p){dt(p,"rgba(11,218,81,0.9)",3)})}else if(name==="icosahedron"){var phi3=(1+Math.sqrt(5))/2,ir=sz3*0.3;var ivts=[[-1,phi3,0],[1,phi3,0],[-1,-phi3,0],[1,-phi3,0],[0,-1,phi3],[0,1,phi3],[0,-1,-phi3],[0,1,-phi3],[phi3,0,-1],[phi3,0,1],[-phi3,0,-1],[-phi3,0,1]];var ipv2=ivts.map(function(v){var l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return proj(v[0]/l*ir,v[1]/l*ir,v[2]/l*ir)});[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].forEach(function(f){edg(ipv2[f[0]],ipv2[f[1]],"100,108,255",0.3);edg(ipv2[f[1]],ipv2[f[2]],"100,108,255",0.3);edg(ipv2[f[2]],ipv2[f[0]],"100,108,255",0.3)});ipv2.forEach(function(p){dt(p,"rgba(11,218,81,0.8)",2)})}else if(name==="grid3d"){var gs3=sz3*0.15,gc=4;for(var gxi=-gc;gxi<=gc;gxi+=2)for(var gyi=-gc;gyi<=gc;gyi+=2)for(var gzi=-gc;gzi<=gc;gzi+=2){var gp=proj(gxi*gs3,gyi*gs3,gzi*gs3);var ga2=0.15+0.3*((gp.z+sz3*2)/(sz3*4));dt(gp,"rgba("+((gxi+gyi+gzi)%2===0?"100,108,255":"11,218,81")+","+ga2+")",2)}}requestAnimationFrame(draw);return}\n' +
                '    if(name==="orbits"){for(var oi=0;oi<8;oi++){var oa=t*.5+oi*Math.PI/4,or2=50+oi*15,ox=cv.width/2+Math.cos(oa)*or2,oy=cv.height/2+Math.sin(oa)*or2;ctx.fillStyle="rgba(100,108,255,"+(0.4-oi*0.04)+")";ctx.beginPath();ctx.arc(ox,oy,3,0,6.28);ctx.fill()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="dna"){for(var di=0;di<20;di++){var dx=cv.width*.2+di*(cv.width*.6/20),dy1=cv.height/2+Math.sin(di*.5+t)*30,dy2=cv.height/2-Math.sin(di*.5+t)*30;ctx.fillStyle="rgba(100,108,255,0.5)";ctx.beginPath();ctx.arc(dx,dy1,3,0,6.28);ctx.fill();ctx.fillStyle="rgba(11,218,81,0.5)";ctx.beginPath();ctx.arc(dx,dy2,3,0,6.28);ctx.fill();ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.beginPath();ctx.moveTo(dx,dy1);ctx.lineTo(dx,dy2);ctx.stroke()}requestAnimationFrame(draw);return}\n' +
                '    if(name==="confetti"){ps.forEach(function(p){p.y+=1;p.x+=Math.sin(p.p)*0.5;p.p+=0.03;if(p.y>cv.height+10){p.y=-10;p.x=Math.random()*cv.width}ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle="rgba("+p.col+","+p.a+")";ctx.fillRect(-3,-1.5,6,3);ctx.restore()});requestAnimationFrame(draw);return}\n' +
                '    if(name==="matrix"){ctx.fillStyle="rgba(0,0,0,0.05)";ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle="rgba(0,255,65,0.6)";ctx.font="12px monospace";ps.forEach(function(p){var ch=String.fromCharCode(0x30A0+Math.random()*96);ctx.fillText(ch,p.x,p.y);p.y+=12;if(p.y>cv.height){p.y=0;p.x=Math.random()*cv.width}});requestAnimationFrame(draw);return}\n' +
                '    ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.p+=.02;if(p.x<-5)p.x=cv.width+5;if(p.x>cv.width+5)p.x=-5;if(p.y<-5)p.y=cv.height+5;if(p.y>cv.height+5)p.y=-5;' +
                '    var al=p.a;if(name==="stars"||name==="fireflies")al=p.a*(.5+.5*Math.sin(p.p));ctx.beginPath();' +
                '    if(name==="fireflies"){ctx.shadowBlur=10;ctx.shadowColor="rgba(100,255,100,"+al+")";ctx.fillStyle="rgba(100,255,100,"+al+")"}' +
                '    else if(name==="snow"){ctx.fillStyle="rgba(255,255,255,"+al+")";p.x+=Math.sin(p.p)*.5}' +
                '    else{ctx.fillStyle="rgba("+p.col+","+al+")"}' +
                '    ctx.arc(p.x,p.y,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0});requestAnimationFrame(draw)}draw();\n' +
                '  window.addEventListener("resize",rsz);\n' +
                '});\n';
        }

        js += '})();';
        return js;
    }

    /** Get available styles for the picker */
    function getStyles() {
        var list = [];
        Object.keys(SHADERS).forEach(function (key) {
            list.push({ id: key, type: 'shader', label: SHADERS[key].label || key, desc: SHADERS[key].desc || '', colors: SHADERS[key].colors });
        });
        Object.keys(PARTICLES).forEach(function (key) {
            list.push({ id: key, type: 'particle', label: PARTICLES[key].label || key, desc: PARTICLES[key].desc || '', tags: PARTICLES[key].tags || [], colors: PARTICLES[key].colors, config: PARTICLES[key].config });
        });
        Object.keys(BLOBS).forEach(function (key) {
            list.push({ id: key, type: 'blob', label: BLOBS[key].label || key, desc: BLOBS[key].desc || '', tags: BLOBS[key].tags || [], colors: BLOBS[key].colors, config: BLOBS[key].config });
        });
        Object.keys(GRADIENTS).forEach(function (key) {
            list.push({ id: key, type: 'gradient', label: GRADIENTS[key].label || key, desc: GRADIENTS[key].desc || '', tags: GRADIENTS[key].tags || [], colors: GRADIENTS[key].colors, config: GRADIENTS[key].config });
        });
        Object.keys(WAVES).forEach(function (key) {
            list.push({ id: key, type: 'wave', label: WAVES[key].label || key, desc: WAVES[key].desc || '', tags: WAVES[key].tags || [], colors: WAVES[key].colors, config: WAVES[key].config });
        });
        return list;
    }

    /** Get shader fragment for preview canvases */
    function getShaderFragment(style) {
        var s = SHADERS[style] || SHADERS.obsidian;
        return {
            snoise: SNOISE_GLSL,
            core: s.fragmentCore
        };
    }

    /** Get particle config for preview */
    function getParticleConfig(style) {
        return PARTICLES[style] || null;
    }

    /** Get config for any animation style */
    function getAnimConfig(style) {
        return _getStyleConfig(style) || null;
    }

    /** Get the animation category for a style */
    function getAnimCategory(style) {
        return _getAnimCategory(style);
    }

    /** Build only the animation JS for any non-shader style (used by cinematic compiler — P1) */
    function buildAnimJS(style, particles, bgColor) {
        var cat = _getAnimCategory(style);
        switch (cat) {
            case 'particle': return _buildParticlesJS(style, particles, bgColor);
            case 'blob':     return _buildBlobsJS(style, particles, bgColor);
            case 'gradient': return _buildGradientJS(style, particles, bgColor);
            case 'wave':     return _buildWaveJS(style, particles, bgColor);
            default:         return null;
        }
    }

    /** Return the JS filename for a given style (e.g. 'particles.js', 'blobs.js') */
    function getAnimJsFile(style) {
        return _getAnimJsFile(_getAnimCategory(style));
    }

    return {
        compile: compile,
        getStyles: getStyles,
        getShaderFragment: getShaderFragment,
        getParticleConfig: getParticleConfig,
        getAnimConfig: getAnimConfig,
        getAnimCategory: getAnimCategory,
        buildAnimJS: buildAnimJS,
        getAnimJsFile: getAnimJsFile
    };
})();
