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
        return !!PARTICLES[style];
    }

    /* ─── SHADERS ─── */
    var SHADERS = {
        obsidian: {
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
            colors: { accent: '#60a5fa', bg: '#06080f', surface: '#0c1018', fg: '#e8eef5', fg2: '#7090b0', border: 'rgba(100,160,255,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 120, baseColor: [96,165,250], bgGrad: ['#06080f','#0a1020'] }
        },
        fireflies: {
            colors: { accent: '#fbbf24', bg: '#080a04', surface: '#10120c', fg: '#f5f0e0', fg2: '#a09870', border: 'rgba(250,190,40,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 0, baseColor: [251,191,36], bgGrad: ['#080a04','#0c1008'] }
        },
        snow: {
            colors: { accent: '#e2e8f0', bg: '#0a0e14', surface: '#10141c', fg: '#f0f2f5', fg2: '#8090a0', border: 'rgba(200,210,230,0.06)' },
            config: { shape: 'circle', glow: false, connectDist: 0, baseColor: [226,232,240], bgGrad: ['#0a0e14','#141820'] }
        },
        nebula: {
            colors: { accent: '#c084fc', bg: '#08060e', surface: '#12101a', fg: '#f0e8f8', fg2: '#9080b0', border: 'rgba(190,130,255,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 80, baseColor: [192,132,252], bgGrad: ['#08060e','#140e20'] }
        },
        matrix: {
            colors: { accent: '#22c55e', bg: '#030806', surface: '#081008', fg: '#d0f0d0', fg2: '#60a060', border: 'rgba(30,200,80,0.08)' },
            config: { shape: 'text', glow: true, connectDist: 0, baseColor: [34,197,94], bgGrad: ['#030806','#061008'] }
        },
        bokeh: {
            colors: { accent: '#f472b6', bg: '#0c060a', surface: '#14101a', fg: '#f8e8f0', fg2: '#b08090', border: 'rgba(240,110,180,0.08)' },
            config: { shape: 'circle', glow: true, connectDist: 0, baseColor: [244,114,182], bgGrad: ['#0c060a','#180e18'] }
        }
    };

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
            'var surfaces=document.querySelectorAll(".particle-bg");\n' +
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

    /* ─── Section HTML generators ─── */
    function _heroHTML(c, bgClass) {
        return '<section class="hero" id="hero">\n' +
            '  <div class="' + bgClass + ' hero-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="hero-content">\n' +
            '    <h1 class="hero-heading">\n' +
            '      <span class="line"><span class="line-inner">' + esc(c.heroLine1 || 'We build') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner">' + esc(c.heroLine2 || 'cinematic') + '</span></span>\n' +
            '      <span class="line"><span class="line-inner"><em>' + esc(c.heroLine3 || 'experiences.') + '</em></span></span>\n' +
            '    </h1>\n' +
            '    <p class="hero-sub">' + esc(c.heroSub || '') + '</p>\n' +
            '    <div class="hero-actions">\n' +
            '      <a href="#contact" class="btn btn-primary magnetic">' + esc(c.heroCta || 'GET STARTED') + '</a>\n' +
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
            items += '  <div class="service-card reveal-up">\n' +
                '    <div class="service-num mono">0' + i + '</div>\n' +
                '    <h3 class="service-title">' + esc(title) + '</h3>\n' +
                '    <p class="service-desc">' + esc(desc) + '</p>\n' +
                '  </div>\n';
        }
        return '<section class="section services" id="services">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">SERVICES</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">' + esc(c.servicesHeading || 'What we do') + '</span></span></h2>\n' +
            '  <div class="services-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _portfolioHTML(c) {
        var items = '';
        for (var i = 1; i <= 3; i++) {
            var title = c['project' + i + 'Title'] || 'Project ' + i;
            var tag = c['project' + i + 'Tag'] || 'Design';
            var desc = c['project' + i + 'Desc'] || '';
            items += '  <div class="portfolio-card reveal-up cursor-hover">\n' +
                '    <div class="portfolio-card-inner">\n' +
                '      <div class="portfolio-meta mono"><span>' + esc(tag) + '</span></div>\n' +
                '      <h3 class="portfolio-title">' + esc(title) + '</h3>\n' +
                '      <p class="portfolio-desc">' + esc(desc) + '</p>\n' +
                '      <div class="portfolio-num mono">0' + i + '</div>\n' +
                '    </div>\n' +
                '  </div>\n';
        }
        return '<section class="section portfolio" id="portfolio">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PORTFOLIO</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">' + esc(c.portfolioHeading || 'Our Work') + '</span></span></h2>\n' +
            '  <div class="portfolio-grid">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _aboutHTML(c) {
        var stats = '';
        for (var i = 1; i <= 3; i++) {
            var val = c['stat' + i + 'Val'] || '--';
            var label = c['stat' + i + 'Label'] || 'Stat';
            stats += '    <div class="stat-block"><div class="stat-val">' + esc(val) + '</div><div class="stat-label mono">' + esc(label) + '</div></div>\n';
        }
        return '<section class="section about" id="about">\n' +
            '<div class="container">\n' +
            '  <div class="about-grid">\n' +
            '    <div class="about-left">\n' +
            '      <div class="section-label mono">ABOUT</div>\n' +
            '      <h2 class="section-heading"><span class="line"><span class="line-inner">' + esc(c.aboutHeading || 'About Us') + '</span></span></h2>\n' +
            '    </div>\n' +
            '    <div class="about-right">\n' +
            '      <p class="about-desc">' + esc(c.aboutDesc || '') + '</p>\n' +
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
            steps += '  <div class="process-card reveal-up">\n' +
                '    <div class="process-num mono">0' + i + '</div>\n' +
                '    <h3 class="process-title">' + esc(title) + '</h3>\n' +
                '    <p class="process-desc">' + esc(desc) + '</p>\n' +
                '  </div>\n';
        }
        return '<section class="section process" id="process">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PROCESS</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">' + esc(c.processHeading || 'How We Work') + '</span></span></h2>\n' +
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
            items += '  <div class="testimonial-card reveal-up">\n' +
                '    <blockquote class="testimonial-quote">&ldquo;' + esc(quote) + '&rdquo;</blockquote>\n' +
                '    <div class="testimonial-author">\n' +
                '      <span class="testimonial-name">' + esc(name) + '</span>\n' +
                '      <span class="testimonial-role mono">' + esc(role) + '</span>\n' +
                '    </div>\n' +
                '  </div>\n';
        }
        return '<section class="section testimonials" id="testimonials">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">TESTIMONIALS</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">What they <em>say.</em></span></span></h2>\n' +
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
            tiers += '  <div class="pricing-card' + accent + ' reveal-up">\n' +
                '    <h3 class="pricing-name">' + esc(name) + '</h3>\n' +
                '    <div class="pricing-price">' + esc(price) + '</div>\n' +
                '    <ul class="pricing-features">' + featureList + '</ul>\n' +
                '    <a href="#contact" class="btn' + (i === 2 ? ' btn-primary' : '') + '">Get Started</a>\n' +
                '  </div>\n';
        }
        return '<section class="section pricing" id="pricing">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">PRICING</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">' + esc(c.pricingHeading || 'Pricing') + '</span></span></h2>\n' +
            '  <div class="pricing-grid">\n' + tiers + '  </div>\n' +
            '</div>\n</section>';
    }

    function _faqHTML(c) {
        var items = '';
        for (var i = 1; i <= 3; i++) {
            var q = c['faq' + i + 'Q'] || '';
            var a = c['faq' + i + 'A'] || '';
            if (!q) continue;
            items += '  <details class="faq-item reveal-up">\n' +
                '    <summary class="faq-question">' + esc(q) + '</summary>\n' +
                '    <p class="faq-answer">' + esc(a) + '</p>\n' +
                '  </details>\n';
        }
        return '<section class="section faq" id="faq">\n' +
            '<div class="container">\n' +
            '  <div class="section-label mono">FAQ</div>\n' +
            '  <h2 class="section-heading"><span class="line"><span class="line-inner">Frequently <em>Asked.</em></span></span></h2>\n' +
            '  <div class="faq-list">\n' + items + '  </div>\n' +
            '</div>\n</section>';
    }

    function _contactHTML(c, email, bgClass) {
        return '<section class="section contact" id="contact">\n' +
            '  <div class="' + bgClass + ' contact-bg"></div>\n' +
            '  <div class="hero-vignette"></div>\n' +
            '  <div class="container contact-inner">\n' +
            '    <div class="section-label mono">CONTACT</div>\n' +
            '    <h2 class="section-heading text-center">\n' +
            '      <span class="line"><span class="line-inner">' + esc(c.contactHeading || "Let's Talk") + '</span></span>\n' +
            '    </h2>\n' +
            '    <div class="contact-actions">\n' +
            '      <a href="mailto:' + esc(email) + '" class="btn btn-primary magnetic">' + esc(c.contactCta || 'EMAIL US') + '</a>\n' +
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
        var isParticle = _isParticleStyle(cfg.style);
        var bgClass = isParticle ? 'particle-bg' : 'webgl-bg';
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
            (isParticle ? '' : '  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>\n') +
            '  <script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>\n' +
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>\n' +
            (isParticle ? '  <script src="js/particles.js"><\/script>\n' : '  <script src="js/shader.js"><\/script>\n') +
            '  <script src="js/animations.js"><\/script>\n' +
            '  <script src="js/main.js"><\/script>\n' +
            '</body>\n</html>';
    }

    /* ─── CSS builder ─── */
    function _buildCSS(cfg) {
        var src = _isParticleStyle(cfg.style) ? PARTICLES[cfg.style] : (SHADERS[cfg.style] || SHADERS.obsidian);
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
            '.webgl-bg, .particle-bg { position: absolute; inset: 0; overflow: hidden; }\n' +
            '.webgl-bg canvas, .particle-bg canvas { width: 100% !important; height: 100% !important; display: block; }\n\n' +
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
        var isParticle = _isParticleStyle(cfg.style);
        var files = {
            'index.html': _buildHTML(cfg),
            'css/style.css': _buildCSS(cfg),
            'js/animations.js': _buildAnimationsJS(),
            'js/main.js': _buildMainJS(),
            'README.md': _buildReadme(cfg),
            'arbel.config.json': _buildConfig(cfg)
        };
        if (isParticle) {
            files['js/particles.js'] = _buildParticlesJS(cfg.style, cfg.particles);
        } else {
            files['js/shader.js'] = _buildShaderJS(cfg.style);
        }
        return files;
    }

    /** Get available styles for the picker */
    function getStyles() {
        var list = [];
        Object.keys(SHADERS).forEach(function (key) {
            list.push({ id: key, type: 'shader', colors: SHADERS[key].colors });
        });
        Object.keys(PARTICLES).forEach(function (key) {
            list.push({ id: key, type: 'particle', colors: PARTICLES[key].colors, config: PARTICLES[key].config });
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

    return {
        compile: compile,
        getStyles: getStyles,
        getShaderFragment: getShaderFragment,
        getParticleConfig: getParticleConfig
    };
})();
