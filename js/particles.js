/* ===== particles.js — Living Ink Cloud (Canvas) ===== */
(function () {
  'use strict';

  if (!window.matchMedia('(pointer:fine)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'ink-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9997;mix-blend-mode:screen;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- Particle pool ---- */
  var POOL_SIZE = 280;
  var particles = [];

  function Particle() {
    this.reset(0, 0, false);
  }
  Particle.prototype.reset = function (x, y, active) {
    this.x    = x;
    this.y    = y;
    this.vx   = (Math.random() - 0.5) * 2.8;
    this.vy   = (Math.random() - 0.5) * 2.8;
    this.life = 0;
    // life span: 60–110 frames
    this.maxLife = 60 + Math.random() * 50;
    // size peaks at 5–9px
    this.maxSize = 3 + Math.random() * 6;
    // hue: deep purple (260) → violet (290) → electric blue (220)
    this.hue  = 220 + Math.random() * 80;
    this.sat  = 70 + Math.random() * 30;
    this.active = active;
  };

  for (var i = 0; i < POOL_SIZE; i++) particles.push(new Particle());

  /* ---- Cursor state ---- */
  var mx = -9999, my = -9999;
  var active = false;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    if (!active) active = true;
    // Spawn 5–8 particles per move event
    var count = 5 + Math.floor(Math.random() * 4);
    var spawned = 0;
    for (var i = 0; i < particles.length && spawned < count; i++) {
      if (!particles[i].active) {
        particles[i].reset(mx, my, true);
        spawned++;
      }
    }
  });

  /* ---- Draw loop ---- */
  function draw() {
    requestAnimationFrame(draw);
    if (!active) return;

    // Fully clear canvas each frame — page content shows through
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Particles rendered with 'lighter' — overlapping particles bloom brighter
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.active) continue;

      p.life++;

      // Magnetic pull toward cursor — gentle attraction
      var pullX = (mx - p.x) * 0.012;
      var pullY = (my - p.y) * 0.012;
      p.vx += pullX;
      p.vy += pullY;

      // Friction so they don't accelerate forever
      p.vx *= 0.94;
      p.vy *= 0.94;

      p.x += p.vx;
      p.y += p.vy;

      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      // Life ratio 0→1
      var t = p.life / p.maxLife;

      // Size: rise to peak at 30% life, then shrink — the "exhale"
      var sizeFactor = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      var size = p.maxSize * sizeFactor;
      if (size < 0.3) continue;

      // Opacity peaks at 40% life
      var alpha = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
      alpha = Math.max(0, Math.min(1, alpha)) * 0.75;

      // Radial gradient for soft glow per particle
      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2.5);
      grad.addColorStop(0, 'hsla(' + p.hue + ',' + p.sat + '%,70%,' + alpha + ')');
      grad.addColorStop(0.5, 'hsla(' + p.hue + ',' + p.sat + '%,50%,' + (alpha * 0.4) + ')');
      grad.addColorStop(1, 'hsla(' + p.hue + ',60%,30%,0)');

      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  draw();
})();
