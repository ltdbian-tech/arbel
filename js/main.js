/* ===== main.js � DOM interactions ===== */
(function(){
  'use strict';

    /* lerp shared by cursor section */
  var lerp = function(a, b, n){ return a + (b - a) * n; };

    /* ---- Custom cursor ---- */
  var cursor = document.getElementById('cursor');
  if(cursor && window.matchMedia('(pointer:fine)').matches){
    var cx = 0, cy = 0, tx = 0, ty = 0;

    document.addEventListener('mousemove', function(e){
      tx = e.clientX; ty = e.clientY;
    });

    (function tick(){
      cx = lerp(cx, tx, 0.15);
      cy = lerp(cy, ty, 0.15);
      cursor.style.transform = 'translate3d('+cx+'px,'+cy+'px,0)';
      requestAnimationFrame(tick);
    })();

    /* magnetic and global hover targets */
    var hovers = document.querySelectorAll('a, button, .magnetic');
    hovers.forEach(function(el){
      el.addEventListener('mouseenter', function(){ cursor.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function(){ cursor.classList.remove('is-hover'); });
    });

    /* special 'VIEW' state for cinematic cards */
    var views = document.querySelectorAll('.cursor-hover-view');
    views.forEach(function(el){
      el.addEventListener('mouseenter', function(){ cursor.classList.add('is-view'); });
      el.addEventListener('mouseleave', function(){ cursor.classList.remove('is-view'); });
    });
  } else if(cursor){
    cursor.style.display = 'none';
  }

  /* ---- Magnetic buttons ---- */
  document.querySelectorAll('.magnetic').forEach(function(btn){
    btn.addEventListener('mousemove', function(e){
      var rect = btn.getBoundingClientRect();
      var dx = (e.clientX - (rect.left + rect.width / 2)) * 0.2;
      var dy = (e.clientY - (rect.top  + rect.height / 2)) * 0.2;
      btn.style.transform = 'translate('+dx+'px,'+dy+'px)';
    });
    btn.addEventListener('mouseleave', function(){
      btn.style.transform = '';
      btn.style.transition = 'transform .4s cubic-bezier(.16,1,.3,1)';
    });
  });

    /* ---- 3D Card Parallax / Tilt ---- */
  document.querySelectorAll('.work-card-inner, .premium-card').forEach(function(card){
    card.addEventListener('mousemove', function(e){
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2;
      var cy = rect.height / 2;
      
      // Calculate rotation (-10 to 10 degrees)
      var rx = ((cy - y) / cy) * 10;
      var ry = ((x - cx) / cx) * 10;
      
      card.style.transform = 'perspective(1000px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale3d(1.02, 1.02, 1.02)';
      card.style.transition = 'none';
      card.style.zIndex = '10';
    });
    
    card.addEventListener('mouseleave', function(){
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      card.style.zIndex = '1';
    });
  });

  /* ---- Mobile nav toggle ---- */
  var menuBtn = document.getElementById('menuBtn');
  var nav     = document.getElementById('nav');
  var header  = document.getElementById('header');
  if(menuBtn && nav){
    menuBtn.addEventListener('click', function(){
      nav.classList.toggle('is-open');
      menuBtn.classList.toggle('is-active');
      if(header) {
          if (nav.classList.contains('is-open')) {
              header.style.background = 'var(--surface)';
          } else {
              header.style.background = '';
          }
      }
    });
    nav.querySelectorAll('.nav-link').forEach(function(link){
      link.addEventListener('click', function(){
        nav.classList.remove('is-open');
        menuBtn.classList.remove('is-active');
        if(header) header.style.background = '';
      });
    });
  }

  /* ---- Auto-reveal hero on touch devices (after preloader exits ~3.8s) ---- */
  if (!window.matchMedia('(hover: hover)').matches) {
    var heroContainer = document.querySelector('.hero-cinematic-container');
    if (heroContainer) {
      // Preloader: 2.2s count + 0.2s pause + 1.2s slide-up = ~3.6s. Add 0.3s buffer.
      setTimeout(function() {
        heroContainer.classList.add('touch-revealed');
      }, 3900);
    }
  }

  /* ---- Smooth scroll anchors ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if(id === '#') return;
      var target = document.querySelector(id);
      if(target){
        e.preventDefault();
        target.scrollIntoView({ behavior:'smooth', block:'start' });
      }
    });
  });

  /* ---- Year ---- */
  var yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Section Spotlight: dual-layer cursor chase ---- */
  var spotlightSections = document.querySelectorAll('.hero, .work-scene, .process-scene, .about-terminal, .contact-scene');
  document.addEventListener('mousemove', function(e) {
    spotlightSections.forEach(function(section) {
      var rect = section.getBoundingClientRect();
      section.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
      section.style.setProperty('--my', (e.clientY - rect.top)  + 'px');
    });
  });

})();

