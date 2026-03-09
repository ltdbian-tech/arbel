/* ===== webgl-media.js — Three.js shader surfaces ===== */
(function(){
  'use strict';

  if(typeof THREE === 'undefined') return;

  /* ---- Theme colour map ---- */
  var ThemeMap = {
    ink:   { a:[0.01,0.01,0.01], b:[0.16,0.16,0.18] },
    warm:  { a:[0.05,0.04,0.03], b:[0.25,0.20,0.15] },
    cool:  { a:[0.02,0.03,0.04], b:[0.15,0.20,0.25] },
    ember: { a:[0.04,0.02,0.02], b:[0.25,0.12,0.12] },
    cyber: { a:[0.02,0.02,0.03], b:[0.4,0.6,0.05] }
  };

  /* ---- Procedural canvas texture ---- */
  function makeCanvas(w, h, theme){
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var cols = ThemeMap[theme] || ThemeMap.ink;

    var grad = ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0, 'rgb('+Math.round(cols.a[0]*255)+','+Math.round(cols.a[1]*255)+','+Math.round(cols.a[2]*255)+')');
    grad.addColorStop(1, 'rgb('+Math.round(cols.b[0]*255)+','+Math.round(cols.b[1]*255)+','+Math.round(cols.b[2]*255)+')');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    /* subtle grid lines */
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 1;
    for(var y=0; y<h; y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    for(var x=0; x<w; x+=40){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }

    return c;
  }

  /* ---- Shaders ---- */
  var vertexShader = [
    'varying vec2 vUv;',
        'void main(){',
    '  vec2 uv = vUv;',
    '  float t = uTime * 0.15;',
    '  // Add mouse distortion',
    '  vec2 mouseOffset = (uMouse - 0.5) * 0.2;',
    '  uv += mouseOffset * (1.0 - uv.y);',
    '  float n = snoise(vec3(uv * 2.5, t));',
    '  float n2 = snoise(vec3(uv * 4.0 + n * 0.5, t * 0.7));',
    '  vec3 color = mix(uColorA, uColorB, uv.y + n * 0.3 + n2 * 0.15);',
    '  vec4 tex = texture2D(uTexture, uv + n * 0.01);',
    '  color = mix(color, tex.rgb, uTextureMix);',
    '  color += vec3(n2 * 0.04);',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
        'precision highp float;',
    'uniform float uTime;',
    'uniform float uProgress;',
    'uniform vec2  uResolution;',
    'uniform vec2  uMouse;',
    'uniform sampler2D uTexture;',
    'uniform float uTextureMix;',
    'uniform vec3  uColorA;',
    'uniform vec3  uColorB;',
    'varying vec2  vUv;',

    'vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }',
    'vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }',
    'float snoise(vec3 v){',
    '  const vec2 C = vec2(1.0/6.0, 1.0/3.0);',
    '  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',
    '  vec3 i  = floor(v + dot(v, C.yyy));',
    '  vec3 x0 = v - i + dot(i, C.xxx);',
    '  vec3 g = step(x0.yzx, x0.xyz);',
    '  vec3 l = 1.0 - g;',
    '  vec3 i1 = min(g.xyz, l.zxy);',
    '  vec3 i2 = max(g.xyz, l.zxy);',
    '  vec3 x1 = x0 - i1 + C.xxx;',
    '  vec3 x2 = x0 - i2 + C.yyy;',
    '  vec3 x3 = x0 - D.yyy;',
    '  i = mod289(i);',
    '  vec4 p = permute(permute(permute(',
    '    i.z + vec4(0.0, i1.z, i2.z, 1.0))',
    '  + i.y + vec4(0.0, i1.y, i2.y, 1.0))',
    '  + i.x + vec4(0.0, i1.x, i2.x, 1.0));',
    '  float n_ = 0.142857142857;',
    '  vec3 ns = n_ * D.wyz - D.xzx;',
    '  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);',
    '  vec4 x_ = floor(j * ns.z);',
    '  vec4 y_ = floor(j - 7.0 * x_);',
    '  vec4 x  = x_ * ns.x + ns.yyyy;',
    '  vec4 y  = y_ * ns.x + ns.yyyy;',
    '  vec4 h  = 1.0 - abs(x) - abs(y);',
    '  vec4 b0 = vec4(x.xy, y.xy);',
    '  vec4 b1 = vec4(x.zw, y.zw);',
    '  vec4 s0 = floor(b0)*2.0 + 1.0;',
    '  vec4 s1 = floor(b1)*2.0 + 1.0;',
    '  vec4 sh = -step(h, vec4(0.0));',
    '  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;',
    '  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;',
    '  vec3 p0 = vec3(a0.xy,h.x);',
    '  vec3 p1 = vec3(a0.zw,h.y);',
    '  vec3 p2 = vec3(a1.xy,h.z);',
    '  vec3 p3 = vec3(a1.zw,h.w);',
    '  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    '  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;',
    '  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);',
    '  m = m * m;',
    '  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',

        'void main(){',
    '  vec2 uv = vUv;',
    '  float t = uTime * 0.15;',
    '  // Add mouse distortion',
    '  vec2 mouseOffset = (uMouse - 0.5) * 0.2;',
    '  uv += mouseOffset * (1.0 - uv.y);',
    '  float n = snoise(vec3(uv * 2.5, t));',
    '  float n2 = snoise(vec3(uv * 4.0 + n * 0.5, t * 0.7));',
    '  vec3 color = mix(uColorA, uColorB, uv.y + n * 0.3 + n2 * 0.15);',
    '  vec4 tex = texture2D(uTexture, uv + n * 0.01);',
    '  color = mix(color, tex.rgb, uTextureMix);',
    '  color += vec3(n2 * 0.04);',
    '  gl_FragColor = vec4(color, 1.0);',
    '}'
  ].join('\n');

  /* ---- Surface constructor ---- */
  function Surface(el){
    this.el = el;
    this.theme  = el.getAttribute('data-theme') || 'ink';
    this.colors = ThemeMap[this.theme] || ThemeMap.ink;
    this.visible = true;

    var rect = el.getBoundingClientRect();
    var w = Math.max(rect.width, 2);
    var h = Math.max(rect.height, 2);

    this.renderer = new THREE.WebGLRenderer({ alpha:true, antialias:false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    el.appendChild(this.renderer.domElement);

    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-0.5,0.5,0.5,-0.5,0.01,10);
    this.camera.position.z = 1;

    var canvas  = makeCanvas(512, 512, this.theme);
    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    this.uniforms = {
      uTime:       { value:0 },
      uProgress:   { value:0 },
      uResolution: { value:new THREE.Vector2(w,h) },
      uMouse:      { value:new THREE.Vector2(0.5,0.5) },
      uTexture:    { value:texture },
      uTextureMix: { value:0.0 },
      uColorA:     { value:new THREE.Vector3(this.colors.a[0],this.colors.a[1],this.colors.a[2]) },
      uColorB:     { value:new THREE.Vector3(this.colors.b[0],this.colors.b[1],this.colors.b[2]) }
    };

    var geo  = new THREE.PlaneGeometry(1,1);
    var mat  = new THREE.ShaderMaterial({ vertexShader:vertexShader, fragmentShader:fragmentShader, uniforms:this.uniforms });
    this.mesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.mesh);

    /* intersection observer to pause offscreen */
    var self = this;
    this.observer = new IntersectionObserver(function(entries){
      self.visible = entries[0].isIntersecting;
    }, { threshold:0 });
    this.observer.observe(el);
  }

  Surface.prototype.resize = function(){
    var rect = this.el.getBoundingClientRect();
    var w = Math.max(rect.width, 2);
    var h = Math.max(rect.height, 2);
    this.renderer.setSize(w, h);
    this.uniforms.uResolution.value.set(w, h);
  };

    Surface.prototype.render = function(time){
    if(!this.visible) return;
    this.uniforms.uTime.value = time;
    // Lerp mouse
    currentMouse.lerp(targetMouse, 0.05);
    this.uniforms.uMouse.value.copy(currentMouse);
    this.renderer.render(this.scene, this.camera);
  };

    /* ---- Mouse interaction for WebGL ---- */
  var targetMouse = new THREE.Vector2(0.5, 0.5);
  var currentMouse = new THREE.Vector2(0.5, 0.5);
  window.addEventListener('mousemove', function(e){
    targetMouse.x = e.clientX / window.innerWidth;
    targetMouse.y = 1.0 - (e.clientY / window.innerHeight);
  });

  /* ---- Init all surfaces ---- */
  var surfaces = [];
  document.querySelectorAll('.webgl-surface').forEach(function(el){
    surfaces.push(new Surface(el));
  });

  /* ---- Resize ---- */
  window.addEventListener('resize', function(){
    surfaces.forEach(function(s){ s.resize(); });
  });

  /* ---- Animate ---- */
  var clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    surfaces.forEach(function(s){ s.render(t); });
  }
  animate();

})();

