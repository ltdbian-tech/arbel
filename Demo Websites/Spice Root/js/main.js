/* ===== THE SPICE ROOT — MAIN JS ===== */

gsap.registerPlugin(ScrollTrigger);

// ─── Smooth Scroll (desktop only) ────────────────────────────
const isTouchDevice = !window.matchMedia('(pointer: fine)').matches;

if (!isTouchDevice && typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ScrollTrigger.update);
}

// ─── Nav Scroll Behaviour ────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ─── Mobile Menu ─────────────────────────────────────────────
const menuBtn   = document.getElementById('menuBtn');
const navMobile = document.getElementById('navMobile');

menuBtn.addEventListener('click', () => {
    const open = navMobile.classList.toggle('is-open');
    menuBtn.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
});

document.querySelectorAll('.nav-mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        navMobile.classList.remove('is-open');
        menuBtn.classList.remove('is-open');
        document.body.style.overflow = '';
    });
});

// ─── Heat Pip Builder ────────────────────────────────────────
document.querySelectorAll('.heat-bar[data-level]').forEach(el => {
    const level = parseInt(el.dataset.level, 10);
    const wrap  = document.createElement('div');
    wrap.className = 'heat-pips';
    for (let i = 1; i <= 5; i++) {
        const pip = document.createElement('div');
        pip.className = 'heat-pip' + (i <= level ? ' active' : '');
        wrap.appendChild(pip);
    }
    el.replaceWith(wrap);
});

// ─── Canvas Particles (desktop only) ─────────────────────────
const canvas = document.getElementById('spiceCanvas');

if (canvas && !isTouchDevice) {
    const ctx    = canvas.getContext('2d');
    const colors = ['#E8610A', '#C8962A', '#B84500', '#C03210', '#F5A020', '#D4720A'];
    let W, H, particles = [];

    function resize() {
        W = canvas.width  = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    class Particle {
        constructor(randomY) {
            this.init(randomY);
        }
        init(randomY) {
            this.x       = Math.random() * W;
            this.y       = randomY ? Math.random() * H : H + 10;
            this.size    = Math.random() * 1.8 + 0.4;
            this.opacity = Math.random() * 0.25 + 0.04;
            this.dx      = (Math.random() - 0.5) * 0.25;
            this.dy      = -(Math.random() * 0.2 + 0.08);
            this.color   = colors[Math.floor(Math.random() * colors.length)];
            this.life    = 0;
            this.maxLife = Math.random() * 500 + 300;
        }
        update() {
            this.x += this.dx;
            this.y += this.dy;
            this.life++;
            if (this.life > this.maxLife || this.y < -10) {
                this.init(false);
            }
        }
        draw() {
            const fade = this.life < 80
                ? this.life / 80
                : this.life > this.maxLife - 80
                ? (this.maxLife - this.life) / 80
                : 1;
            ctx.save();
            ctx.globalAlpha = this.opacity * fade;
            ctx.fillStyle   = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    for (let i = 0; i < 90; i++) {
        particles.push(new Particle(true));
    }

    (function animate() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    })();
}

// ─── Hero Entrance Animation ─────────────────────────────────
gsap.timeline({ delay: 0.2 })
    .to('.hero-badge',      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' })
    .to('.hero-line',       { opacity: 1, y: 0, duration: 1.1, stagger: 0.16, ease: 'power4.out' }, '-=0.5')
    .to('.hero-sub',        { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.4')
    .to('.hero-actions',    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
    .to('.hero-stat-strip', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5');

// ─── Scroll Reveal (IntersectionObserver) ────────────────────
const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ─── Counter Animations ───────────────────────────────────────
const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el     = e.target;
        const target = parseInt(el.dataset.count, 10);
        const obj    = { val: 0 };
        gsap.to(obj, {
            val: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate() {
                el.textContent = target >= 1000
                    ? Math.round(obj.val).toLocaleString()
                    : Math.round(obj.val);
            }
        });
        counterIO.unobserve(el);
    });
}, { threshold: 0.5 });

document.querySelectorAll('.origins-stat-n[data-count]').forEach(el => counterIO.observe(el));

// ─── Flavor Bar Animations (product pages) ───────────────────
const flavorSection = document.querySelector('.pd-flavor-bars');
if (flavorSection) {
    const barIO = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            e.target.querySelectorAll('.flavor-bar-fill').forEach(fill => {
                fill.style.width = fill.dataset.width;
            });
            barIO.unobserve(e.target);
        });
    }, { threshold: 0.3 });
    barIO.observe(flavorSection);
}

// ─── Form Submit Feedback ─────────────────────────────────────
function handleSubmit(e) {
    e.preventDefault();
    const success = document.getElementById('formSuccess');
    success.classList.add('visible');
    e.target.reset();
    setTimeout(() => success.classList.remove('visible'), 5000);
}
