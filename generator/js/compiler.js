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
    function _buildParticlesJS(style, pCfg) {
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
    function _buildBlobsJS(style, userCfg) {
        var b = BLOBS[style] || BLOBS.morphBlob;
        var c = b.config;
        var count = (userCfg && userCfg.count) || c.count;
        var blur = (userCfg && userCfg.blur) || c.blur;
        var speed = (userCfg && userCfg.speed) || c.speed;
        var colorsArr = JSON.stringify(c.baseColors);

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
            '    grad.addColorStop(0,"' + c.bgGrad[0] + '");\n' +
            '    grad.addColorStop(1,"' + c.bgGrad[1] + '");\n' +
            '    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);\n' +
            '    ctx.filter="blur("+BLUR+"px)";\n' +
            '    blobs.forEach(function(b){\n' +
            '      b.phase+=0.008*SPEED;\n' +
            '      b.x+=b.vx+Math.sin(b.phase)*0.5;\n' +
            '      b.y+=b.vy+Math.cos(b.phase*0.7)*0.5;\n' +
            '      if(b.x<-b.r)b.x=W+b.r;if(b.x>W+b.r)b.x=-b.r;\n' +
            '      if(b.y<-b.r)b.y=H+b.r;if(b.y>W+b.r)b.y=-b.r;\n' +
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
    function _buildGradientJS(style, userCfg) {
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
    function _buildWaveJS(style, userCfg) {
        var w = WAVES[style] || WAVES.sineWaves;
        var c = w.config;
        var layers = (userCfg && userCfg.layers) || c.layers;
        var amplitude = (userCfg && userCfg.amplitude) || c.amplitude;
        var speed = (userCfg && userCfg.speed) || c.speed;
        var colorsArr = JSON.stringify(c.colors);

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
            '    grad.addColorStop(0,"' + c.bgGrad[0] + '");\n' +
            '    grad.addColorStop(1,"' + c.bgGrad[1] + '");\n' +
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
            '      ctx.fillStyle=color+Math.round(40-l*6).toString(16).padStart(2,"0");\n' +
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
    function _heroHTML(c, bgClass) {
        return '<section class="hero" id="hero" data-arbel-id="hero">\n' +
            '  <div class="' + bgClass + ' hero-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="hero-content" data-arbel-id="hero-content">\n' +
            '    <h1 class="hero-heading" data-arbel-id="hero-heading">\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line1" data-arbel-edit="text">' + esc(c.heroLine1 || 'We build') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line2" data-arbel-edit="text">' + esc(c.heroLine2 || 'cinematic') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner" data-arbel-id="hero-line3" data-arbel-edit="text"><em>' + esc(c.heroLine3 || 'experiences.') + '</em></span></span>\n' +
            '    </h1>\n' +
            '    <p class="hero-sub" data-arbel-id="hero-sub" data-arbel-edit="text">' + esc(c.heroSub || '') + '</p>\n' +
            '    <div class="hero-actions">\n' +
            '      <a href="#contact" class="btn btn-primary magnetic" data-arbel-id="hero-cta" data-arbel-edit="text">' + esc(c.heroCta || 'GET STARTED') + '</a>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '  <div class="scroll-indicator mono"><span>SCROLL</span><div class="scroll-track"><div class="scroll-thumb"></div></div></div>\n' +
            '</section>';
    }

    function _servicesHTML(c) {
        var items = '';
        for (var i = 1; i <= 3; i++) {
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
            '  <div class="section-label mono">SERVICES</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="services-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.servicesHeading || 'What we do') + '</span></span></h2>\n' +
            '  <div class="services-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _portfolioHTML(c) {
        var items = '';
        for (var i = 1; i <= 3; i++) {
            var title = c['project' + i + 'Title'] || 'Project ' + i;
            var tag = c['project' + i + 'Tag'] || 'Design';
            var desc = c['project' + i + 'Desc'] || '';
            items += '  <div class="portfolio-card reveal-up cursor-hover" data-arbel-id="portfolio-card-' + i + '">\n' +
                '    <div class="portfolio-card-inner">\n' +
                '      <div class="portfolio-meta mono"><span data-arbel-id="project-' + i + '-tag" data-arbel-edit="text">' + esc(tag) + '</span></div>\n' +
                '      <h3 class="portfolio-title" data-arbel-id="project-' + i + '-title" data-arbel-edit="text">' + esc(title) + '</h3>\n' +
                '      <p class="portfolio-desc" data-arbel-id="project-' + i + '-desc" data-arbel-edit="text">' + esc(desc) + '</p>\n' +
                '      <div class="portfolio-num mono">0' + i + '</div>\n' +
                '    </div>\n' +
                '  </div>\n';
        }
        return '<section class="section portfolio" id="portfolio" data-arbel-id="portfolio">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PORTFOLIO</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="portfolio-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.portfolioHeading || 'Our Work') + '</span></span></h2>\n' +
            '  <div class="portfolio-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _aboutHTML(c) {
        var stats = '';
        for (var i = 1; i <= 3; i++) {
            var val = c['stat' + i + 'Val'] || '--';
            var label = c['stat' + i + 'Label'] || 'Stat';
            stats += '    <div class="stat-block" data-arbel-id="stat-' + i + '"><div class="stat-val" data-arbel-id="stat-' + i + '-val" data-arbel-edit="text">' + esc(val) + '</div><div class="stat-label mono" data-arbel-id="stat-' + i + '-label" data-arbel-edit="text">' + esc(label) + '</div></div>\n';
        }
        return '<section class="section about" id="about" data-arbel-id="about">\n' +
            '<div class="container">\n' +
            '  <div class="about-grid">\n' +
            '    <div class="about-left">\n' +
            '      <div class="section-label mono">ABOUT</div>\n' +
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
        var steps = '';
        for (var i = 1; i <= 3; i++) {
            var title = c['step' + i + 'Title'] || 'Step ' + i;
            var desc = c['step' + i + 'Desc'] || '';
            steps += '  <div class="process-card reveal-up" data-arbel-id="process-card-' + i + '">\n' +
                '    <div class="process-num mono">0' + i + '</div>\n' +
                '    <h3 class="process-title" data-arbel-id="step-' + i + '-title" data-arbel-edit="text">' + esc(title) + '</h3>\n' +
                '    <p class="process-desc" data-arbel-id="step-' + i + '-desc" data-arbel-edit="text">' + esc(desc) + '</p>\n' +
                '  </div>\n';
        }
        return '<section class="section process" id="process" data-arbel-id="process">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PROCESS</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="process-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">' + esc(c.processHeading || 'How We Work') + '</span></span></h2>\n' +
            '  <div class="process-grid">\n' + steps + '  </div>\n' +
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
            '  <div class="section-label mono">TESTIMONIALS</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="testimonials-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">What they <em>say.</em></span></span></h2>\n' +
            '  <div class="testimonials-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _pricingHTML(c) {
        var tiers = '';
        for (var i = 1; i <= 3; i++) {
            var name = c['tier' + i + 'Name'] || 'Plan ' + i;
            var price = c['tier' + i + 'Price'] || '--';
            var features = (c['tier' + i + 'Features'] || '').split('\n').filter(Boolean);
            var featureList = features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('\n');
            var accent = i === 2 ? ' pricing-card--accent' : '';
            tiers += '  <div class="pricing-card' + accent + ' reveal-up" data-arbel-id="pricing-card-' + i + '">\n' +
                '    <h3 class="pricing-name" data-arbel-id="tier-' + i + '-name" data-arbel-edit="text">' + esc(name) + '</h3>\n' +
                '    <div class="pricing-price" data-arbel-id="tier-' + i + '-price" data-arbel-edit="text">' + esc(price) + '</div>\n' +
                '    <ul class="pricing-features" data-arbel-id="tier-' + i + '-features">' + featureList + '</ul>\n' +
                '    <a href="#contact" class="btn' + (i === 2 ? ' btn-primary' : '') + '" data-arbel-id="tier-' + i + '-cta" data-arbel-edit="text">Get Started</a>\n' +
                '  </div>\n';
        }
        return '<section class="section pricing" id="pricing" data-arbel-id="pricing">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PRICING</div>\n' +
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
            '  <div class="section-label mono">FAQ</div>\n' +
            '  <h2 class="section-heading" data-arbel-id="faq-heading" data-arbel-edit="text"><span class="line"><span class="line-inner">Frequently <em>Asked.</em></span></span></h2>\n' +
            '  <div class="faq-list">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _contactHTML(c, email, bgClass) {
        return '<section class="section contact" id="contact" data-arbel-id="contact">\n' +
            '  <div class="' + bgClass + ' contact-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="container contact-inner">\n' +
            '    <div class="section-label mono">CONTACT</div>\n' +
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
                sectionsHTML += builder(c, bgClass) + '\n\n';
            } else if (s === 'contact') {
                sectionsHTML += builder(c, cfg.contactEmail, bgClass) + '\n\n';
            } else {
                sectionsHTML += builder(c) + '\n\n';
            }
        });

        var navLinks = '';
        var navMap = { services: 'Services', portfolio: 'Work', about: 'About', process: 'Process', pricing: 'Pricing', contact: 'Contact' };
        sections.forEach(function (s) {
            if (s === 'hero' || s === 'testimonials' || s === 'faq') return;
            if (navMap[s]) navLinks += '        <a href="#' + s + '" class="nav-link">' + navMap[s] + '</a>\n';
        });

        return '<!DOCTYPE html>\n' +
            '<html lang="en">\n<head>\n' +
            '  <meta charset="UTF-8">\n' +
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
            '  <title>' + esc(cfg.brandName) + (cfg.tagline ? ' — ' + esc(cfg.tagline) : '') + '</title>\n' +
            '  <meta name="description" content="' + esc(cfg.tagline || cfg.brandName) + '">\n' +
            '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
            '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
            '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">\n' +
            '  <link rel="stylesheet" href="css/style.css">\n' +
            '</head>\n<body>\n\n' +
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
            '  <!-- Header -->\n' +
            '  <header class="header" id="header">\n' +
            '    <div class="header-inner">\n' +
            '      <a href="#" class="logo">' + esc(cfg.brandName) + '</a>\n' +
            '      <nav class="nav" id="nav">\n' + navLinks +
            '      </nav>\n' +
            '      <button class="menu-btn" id="menuBtn" aria-label="Menu"><span></span><span></span></button>\n' +
            '    </div>\n' +
            '  </header>\n\n' +
            '  <main>\n' + sectionsHTML + '  </main>\n\n' +
            '  <footer class="footer">\n' +
            '    <div class="footer-inner">\n' +
            '      <span class="logo">' + esc(cfg.brandName) + '</span>\n' +
            '      <span class="mono">&copy; ' + new Date().getFullYear() + ' All rights reserved.</span>\n' +
            '    </div>\n' +
            '  </footer>\n\n' +
            (cat === 'shader' ? '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n' : '') +
            '  <script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js"><\/script>\n' +
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

        return '/* Generated by Arbel Generator — ' + esc(cfg.brandName) + ' */\n' +
            ':root {\n' +
            '  --bg: ' + bg + ';\n' +
            '  --surface: ' + colors.surface + ';\n' +
            '  --fg: ' + colors.fg + ';\n' +
            '  --fg2: ' + colors.fg2 + ';\n' +
            '  --accent: ' + accent + ';\n' +
            '  --border: ' + colors.border + ';\n' +
            '  --font-body: "Inter", -apple-system, sans-serif;\n' +
            '  --font-display: "Instrument Serif", Georgia, serif;\n' +
            '  --font-mono: "Space Mono", monospace;\n' +
            '  --ease: cubic-bezier(0.16, 1, 0.3, 1);\n' +
            '}\n\n' +
            '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }\n' +
            'html { font-size: 16px; -webkit-font-smoothing: antialiased; }\n' +
            'html.lenis, html.lenis body { height: auto; }\n' +
            '.lenis.lenis-smooth { scroll-behavior: auto; }\n' +
            'body { font-family: var(--font-body); background: var(--bg); color: var(--fg); overflow-x: hidden; }\n' +
            'a { color: inherit; text-decoration: none; }\n' +
            '.mono { font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; }\n' +
            'em { font-family: var(--font-display); font-style: italic; }\n' +
            '.container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }\n' +
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
            '/* ═══ HEADER ═══ */\n' +
            '.header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1rem 2rem; background: rgba(10,10,15,0.8); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }\n' +
            '.header-inner { display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; }\n' +
            '.logo { font-family: var(--font-display); font-size: 1.3rem; }\n' +
            '.nav { display: flex; gap: 2rem; align-items: center; }\n' +
            '.nav-link { font-size: 0.85rem; color: var(--fg2); transition: color 0.3s; }\n' +
            '.nav-link:hover { color: var(--fg); }\n' +
            '.menu-btn { display: none; background: none; border: none; cursor: pointer; width: 28px; height: 20px; position: relative; }\n' +
            '.menu-btn span { display: block; width: 100%; height: 2px; background: var(--fg); position: absolute; left: 0; transition: all 0.3s; }\n' +
            '.menu-btn span:first-child { top: 0; }\n' +
            '.menu-btn span:last-child { bottom: 0; }\n' +
            '@media (max-width: 768px) {\n' +
            '  .nav { display: none; position: fixed; inset: 0; background: var(--bg); flex-direction: column; justify-content: center; align-items: center; gap: 2rem; z-index: 99; }\n' +
            '  .nav.open { display: flex; }\n' +
            '  .nav-link { font-size: 1.5rem; }\n' +
            '  .menu-btn { display: block; z-index: 101; }\n' +
            '}\n\n' +
            '/* ═══ HERO ═══ */\n' +
            '.hero { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }\n' +
            '.hero-bg { position: absolute; inset: 0; }\n' +
            '.hero-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 40%, var(--bg) 100%); pointer-events: none; }\n' +
            '.hero-content { position: relative; z-index: 2; text-align: center; padding: 2rem; max-width: 800px; }\n' +
            '.hero-heading { font-size: clamp(2.5rem, 7vw, 5.5rem); font-weight: 800; line-height: 1.05; margin-bottom: 1.5rem; }\n' +
            '.hero-heading .line { display: block; overflow: hidden; }\n' +
            '.hero-heading .line-inner { display: inline-block; }\n' +
            '.hero-sub { color: var(--fg2); font-size: 1.05rem; line-height: 1.6; max-width: 500px; margin: 0 auto 2rem; }\n' +
            '.hero-actions { display: flex; gap: 1rem; justify-content: center; }\n' +
            '.scroll-indicator { position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%); color: var(--fg2); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }\n' +
            '.scroll-track { width: 1px; height: 40px; background: var(--border); position: relative; overflow: hidden; }\n' +
            '.scroll-thumb { width: 100%; height: 40%; background: var(--accent); animation: scrollPulse 2s infinite; }\n' +
            '@keyframes scrollPulse { 0%{transform:translateY(-100%)} 100%{transform:translateY(250%)} }\n\n' +
            '/* ═══ BUTTONS ═══ */\n' +
            '.btn { display: inline-flex; align-items: center; padding: 0.85rem 2rem; border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.3s var(--ease); background: transparent; color: var(--fg); position: relative; overflow: hidden; }\n' +
            '.btn::before { content: ""; position: absolute; inset: 0; background: var(--accent); transform: translateY(100%); transition: transform 0.4s var(--ease); }\n' +
            '.btn:hover::before { transform: translateY(0); }\n' +
            '.btn span, .btn { position: relative; z-index: 1; }\n' +
            '.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }\n' +
            '.btn-primary::before { background: #fff; }\n' +
            '.btn-primary:hover { color: var(--bg); }\n\n' +
            '/* ═══ SECTIONS ═══ */\n' +
            '.section { padding: 8rem 0; position: relative; }\n' +
            '.section-label { color: var(--accent); margin-bottom: 1rem; }\n' +
            '.section-heading { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; line-height: 1.1; margin-bottom: 2rem; }\n' +
            '.section-heading .line { display: block; overflow: hidden; }\n' +
            '.section-heading .line-inner { display: inline-block; }\n\n' +
            '/* ═══ SERVICES ═══ */\n' +
            '.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.service-card { padding: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; transition: border-color 0.3s, transform 0.3s var(--ease); }\n' +
            '.service-card:hover { border-color: var(--accent); transform: translateY(-4px); }\n' +
            '.service-num { color: var(--accent); margin-bottom: 1rem; }\n' +
            '.service-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; }\n' +
            '.service-desc { color: var(--fg2); font-size: 0.9rem; line-height: 1.6; }\n\n' +
            '/* ═══ PORTFOLIO ═══ */\n' +
            '.portfolio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
            '.portfolio-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: border-color 0.3s, transform 0.3s var(--ease); }\n' +
            '.portfolio-card:hover { border-color: var(--accent); transform: translateY(-4px); }\n' +
            '.portfolio-card-inner { padding: 2rem; position: relative; min-height: 200px; display: flex; flex-direction: column; justify-content: flex-end; }\n' +
            '.portfolio-meta { color: var(--accent); margin-bottom: 0.5rem; }\n' +
            '.portfolio-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }\n' +
            '.portfolio-desc { color: var(--fg2); font-size: 0.9rem; }\n' +
            '.portfolio-num { position: absolute; top: 1.5rem; right: 1.5rem; font-size: 3rem; color: var(--border); font-weight: 800; }\n\n' +
            '/* ═══ ABOUT ═══ */\n' +
            '.about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start; }\n' +
            '.about-desc { color: var(--fg2); font-size: 1rem; line-height: 1.7; margin-bottom: 2rem; }\n' +
            '.stats-row { display: flex; gap: 3rem; }\n' +
            '.stat-val { font-size: 2rem; font-weight: 800; color: var(--accent); }\n' +
            '.stat-label { color: var(--fg2); margin-top: 0.25rem; }\n' +
            '@media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; gap: 2rem; } }\n\n' +
            '/* ═══ PROCESS ═══ */\n' +
            '.process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-top: 3rem; }\n' +
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
            '}\n';
    }

    /* ─── Animations JS ─── */
    function _buildAnimationsJS() {
        return '/* Scroll Animations */\n' +
            '(function(){\n' +
            '"use strict";\n' +
            'function init(){\n' +
            '  if(typeof gsap==="undefined"||typeof ScrollTrigger==="undefined"){setTimeout(init,100);return;}\n' +
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
    function _buildMainJS() {
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
            '// Mobile menu\n' +
            'var menuBtn=document.getElementById("menuBtn");\n' +
            'var nav=document.getElementById("nav");\n' +
            'if(menuBtn&&nav){\n' +
            '  menuBtn.addEventListener("click",function(){nav.classList.toggle("open");});\n' +
            '  nav.querySelectorAll(".nav-link").forEach(function(link){\n' +
            '    link.addEventListener("click",function(){nav.classList.remove("open");});\n' +
            '  });\n' +
            '}\n\n' +
            '// Smooth anchor scroll\n' +
            'document.querySelectorAll(\'a[href^="#"]\').forEach(function(a){\n' +
            '  a.addEventListener("click",function(e){\n' +
            '    var target=document.querySelector(a.getAttribute("href"));\n' +
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
        return JSON.stringify({
            version: '1.0',
            generator: 'arbel',
            style: cfg.style,
            brandName: cfg.brandName,
            tagline: cfg.tagline,
            accent: cfg.accent,
            bgColor: cfg.bgColor,
            contactEmail: cfg.contactEmail,
            industry: cfg.industry || '',
            sections: cfg.sections,
            content: cfg.content
        }, null, 2);
    }

    /* ═══ PUBLIC: Compile full site ═══ */
    function compile(userConfig) {
        var cfg = _defaults(userConfig);
        var cat = _getAnimCategory(cfg.style);
        var files = {
            'index.html': _buildHTML(cfg),
            'css/style.css': _buildCSS(cfg),
            'js/animations.js': _buildAnimationsJS(),
            'js/main.js': _buildMainJS(),
            'README.md': _buildReadme(cfg),
            'arbel.config.json': _buildConfig(cfg)
        };
        var jsFile = _getAnimJsFile(cat);
        switch (cat) {
            case 'particle': files['js/' + jsFile] = _buildParticlesJS(cfg.style, cfg.particles); break;
            case 'blob':     files['js/' + jsFile] = _buildBlobsJS(cfg.style, cfg.particles); break;
            case 'gradient': files['js/' + jsFile] = _buildGradientJS(cfg.style, cfg.particles); break;
            case 'wave':     files['js/' + jsFile] = _buildWaveJS(cfg.style, cfg.particles); break;
            default:         files['js/' + jsFile] = _buildShaderJS(cfg.style); break;
        }

        // Apply editor overrides (text changes, animations, hover, effects)
        if (cfg.editorOverrides) {
            files['index.html'] = _applyOverrides(files['index.html'], cfg.editorOverrides);
        }

        return files;
    }

    /** Apply visual editor overrides to compiled HTML */
    function _applyOverrides(html, overrides) {
        var ids = Object.keys(overrides);
        if (!ids.length) return html;

        // Build extra CSS for animations and hover effects
        var extraCSS = '';
        var extraJS = '';
        var hasEffects = false;

        ids.forEach(function (id) {
            var o = overrides[id];
            var selector = '[data-arbel-id="' + id + '"]';

            // Text replacement: find the element by data-arbel-id and replace innerText
            if (o.text !== undefined) {
                // Match the opening tag with data-arbel-id="id" then content up to closing tag
                var tagPattern = new RegExp(
                    '(data-arbel-id="' + id.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '"[^>]*>)([\\s\\S]*?)(<\\/)',
                    ''
                );
                html = html.replace(tagPattern, function (match, openPart, oldContent, closePart) {
                    return openPart + esc(o.text) + closePart;
                });
            }

            // Entrance animation attributes
            if (o.animation && o.animation !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-anim="' + esc(o.animation) + '"'
                );
            }

            // Hover effect attributes
            if (o.hover && o.hover !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-hover="' + esc(o.hover) + '"'
                );
            }

            // Background effects
            if (o.effect && o.effect !== 'none') {
                html = html.replace(
                    'data-arbel-id="' + id + '"',
                    'data-arbel-id="' + id + '" data-arbel-effect="' + esc(o.effect) + '"'
                );
                hasEffects = true;
            }
        });

        // Inject per-element animation and hover JS into the page
        var overrideJS = _buildOverrideJS(overrides, hasEffects);
        if (overrideJS) {
            html = html.replace('</body>', '<script>' + overrideJS + '<\/script>\n</body>');
        }

        return html;
    }

    /** Build runtime JS for editor overrides (animations, hover, bg effects) */
    function _buildOverrideJS(overrides, hasEffects) {
        var ids = Object.keys(overrides);
        var hasAnimOrHover = ids.some(function (id) {
            var o = overrides[id];
            return (o.animation && o.animation !== 'none') || (o.hover && o.hover !== 'none');
        });
        if (!hasAnimOrHover && !hasEffects) return '';

        var js = '(function(){\n';

        // Animation presets
        js += 'var AN={' +
            'fadeIn:{from:"opacity:0",to:"opacity:1"},' +
            'slideUp:{from:"opacity:0;transform:translateY(40px)",to:"opacity:1;transform:translateY(0)"},' +
            'slideDown:{from:"opacity:0;transform:translateY(-40px)",to:"opacity:1;transform:translateY(0)"},' +
            'slideLeft:{from:"opacity:0;transform:translateX(40px)",to:"opacity:1;transform:translateX(0)"},' +
            'slideRight:{from:"opacity:0;transform:translateX(-40px)",to:"opacity:1;transform:translateX(0)"},' +
            'scaleUp:{from:"opacity:0;transform:scale(0.8)",to:"opacity:1;transform:scale(1)"},' +
            'rotateIn:{from:"opacity:0;transform:rotate(-10deg)",to:"opacity:1;transform:rotate(0)"},' +
            'bounceIn:{from:"opacity:0;transform:scale(0.3)",to:"opacity:1;transform:scale(1)"},' +
            'flipIn:{from:"opacity:0;transform:perspective(400px) rotateY(90deg)",to:"opacity:1;transform:perspective(400px) rotateY(0)"},' +
            'blurIn:{from:"opacity:0;filter:blur(10px)",to:"opacity:1;filter:blur(0)"}' +
            '};\n';

        // Hover presets
        js += 'var HV={lift:"transform:translateY(-5px);box-shadow:0 10px 30px rgba(0,0,0,.2)",' +
            'scale:"transform:scale(1.05)",glow:"box-shadow:0 0 20px var(--accent)",tilt:"transform:rotate(-2deg)"};\n';

        // Apply animations on scroll using IntersectionObserver
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

        // Init hover elements
        js += 'document.querySelectorAll("[data-arbel-hover]").forEach(function(el){\n' +
            '  var h=el.getAttribute("data-arbel-hover"),css=HV[h];\n' +
            '  if(!css)return;\n' +
            '  el.style.transition="all .3s ease";\n' +
            '  el.addEventListener("mouseenter",function(){el._ph=el.style.cssText;css.split(";").forEach(function(s){var kv=s.split(":");if(kv.length===2)el.style[kv[0].trim()]=kv[1].trim()})});\n' +
            '  el.addEventListener("mouseleave",function(){if(el._ph!==undefined)el.style.cssText=el._ph});\n' +
            '});\n';

        // Background effects
        if (hasEffects) {
            js += 'document.querySelectorAll("[data-arbel-effect]").forEach(function(el){\n' +
                '  var name=el.getAttribute("data-arbel-effect");\n' +
                '  if(name==="none")return;\n' +
                '  var pos=getComputedStyle(el).position;if(pos==="static")el.style.position="relative";\n' +
                '  var cv=document.createElement("canvas");cv.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0";\n' +
                '  el.insertBefore(cv,el.firstChild);\n' +
                '  var ctx=cv.getContext("2d");\n' +
                '  function rsz(){cv.width=el.offsetWidth;cv.height=el.offsetHeight}rsz();\n' +
                '  var ps=[];for(var i=0;i<30;i++){ps.push({x:Math.random()*cv.width,y:Math.random()*cv.height,' +
                '    vx:(Math.random()-.5)*.5,vy:name==="bubbles"?-(Math.random()+.3):name==="snow"?(Math.random()*.5+.2):(Math.random()-.5)*.5,' +
                '    sz:Math.random()*3+1,a:Math.random()*.5+.2,p:Math.random()*6.28})}\n' +
                '  function draw(){ctx.clearRect(0,0,cv.width,cv.height);var t=Date.now()*.001;\n' +
                '    if(name==="gradient"){var g=ctx.createLinearGradient(cv.width*(.5+.5*Math.sin(t*.5)),0,cv.width*(.5+.5*Math.cos(t*.3)),cv.height);g.addColorStop(0,"rgba(100,108,255,.1)");g.addColorStop(.5,"rgba(100,108,255,.05)");g.addColorStop(1,"rgba(100,108,255,.1)");ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);requestAnimationFrame(draw);return}\n' +
                '    if(name==="waves"){ctx.strokeStyle="rgba(100,108,255,.15)";ctx.lineWidth=1;for(var w=0;w<3;w++){ctx.beginPath();for(var x=0;x<=cv.width;x+=5){var y=cv.height*.5+Math.sin(x*.01+t+w)*20*(w+1);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}requestAnimationFrame(draw);return}\n' +
                '    ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.p+=.02;if(p.x<-5)p.x=cv.width+5;if(p.x>cv.width+5)p.x=-5;if(p.y<-5)p.y=cv.height+5;if(p.y>cv.height+5)p.y=-5;' +
                '    var al=p.a;if(name==="stars"||name==="fireflies")al=p.a*(.5+.5*Math.sin(p.p));ctx.beginPath();' +
                '    if(name==="fireflies"){ctx.shadowBlur=10;ctx.shadowColor="rgba(100,255,100,"+al+")";ctx.fillStyle="rgba(100,255,100,"+al+")"}' +
                '    else if(name==="snow"){ctx.fillStyle="rgba(255,255,255,"+al+")";p.x+=Math.sin(p.p)*.5}' +
                '    else{ctx.fillStyle="rgba(100,108,255,"+al+")"}' +
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

    return {
        compile: compile,
        getStyles: getStyles,
        getShaderFragment: getShaderFragment,
        getParticleConfig: getParticleConfig,
        getAnimConfig: getAnimConfig,
        getAnimCategory: getAnimCategory
    };
})();
