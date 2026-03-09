/* ===== animations.js - Cinematic GSAP Orchestration ===== */
(function(){
  'use strict';

  /* ---- Lenis Smooth Scroll ---- */
  var lenis;
  try {
    lenis = new Lenis({ duration: 1.2, smoothWheel: true, syncTouch: true });
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
  } catch(e) {
    console.warn('Lenis failed to initialize:', e);
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 1 });

  /* ---- Preloader Sequence ---- */
  var preloader = document.getElementById('preloader');
  var fill = document.getElementById('preloaderFill');
  var progress = document.getElementById('preloaderProgress');
  
  var count = { val: 0 };
  var preloaderTL = gsap.timeline({
    onComplete: function(){
      gsap.to(preloader, { yPercent: -100, duration: 1.2, ease: "expo.inOut", delay: 0.2, onComplete: () => { preloader.style.pointerEvents = 'none'; preloader.style.display = 'none'; } });
      
    }
  });

  preloaderTL.to(count, {
    val: 100,
    duration: 2.2,
    ease: "power2.inOut",
    onUpdate: function(){
      var p = Math.round(count.val);
      fill.style.width = p + '%';
      if(progress) progress.textContent = (p < 10 ? '0'+p : p) + '%';
    }
  });

  /* ---- Helper: hide lines then reveal on scroll ---- */
  function splitLines(selector){
    try {
        var els = gsap.utils.toArray(selector + ' .line-inner');
        if (els.length) gsap.set(els, { yPercent: 110 });
        return els;
    } catch(e) { return []; }
  }

  // Only split things that aren't the hero if needed.
  // var heroLines = splitLines('.hero-heading'); 
  /*
  var heroReveal = gsap.timeline({ delay: 2.5 });

  if (heroLines.length){
      heroReveal
        .to(heroLines, { yPercent: 0, duration: 1.2, stagger: 0.1, ease: "expo.out" })
  }
  */

  /* ---- Header scroll class ---- */
  var header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', function(){
      if (window.scrollY > 60) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    }, { passive: true });
  }

  /* ---- Time Update ---- */
  var timeEl = document.getElementById('sysTime');
  if(timeEl) {
    setInterval(function(){
        var d = new Date();
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        timeEl.textContent = h + ":" + m + ":" + s + " UTC";
    }, 1000);
  }

  /* ---- Horizontal Work Rail ---- */
  var workScene = document.getElementById('work');
  var workRail = document.getElementById('workRail');
  
  if(workScene && workRail && window.innerWidth > 1024) {
    function getScrollAmount() {
      let railWidth = workRail.scrollWidth;
      return -(railWidth - window.innerWidth);
    }

    const tween = gsap.to(workRail, {
      x: getScrollAmount,
      ease: "none"
    });

    ScrollTrigger.create({
      trigger: workScene,
      start: "top top",
      end: () => "+=" + (getScrollAmount() * -1),
      pin: true,
      animation: tween,
      scrub: 1,
      invalidateOnRefresh: true
    });
  }

  /* ---- Process Cards Reveal ---- */
  var isTouch = window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(hover: none)').matches;
  
  gsap.utils.toArray('.premium-card').forEach(function(card, i){
      gsap.from(card, {
          y: 40,
          opacity: 0,
          duration: 1,
          scrollTrigger: {
              trigger: card,
              start: "top 85%",
              toggleActions: "play none none reverse",
              onEnter: () => { if(isTouch) card.classList.add('is-active'); },
              onLeave: () => { if(isTouch) card.classList.remove('is-active'); },
              onEnterBack: () => { if(isTouch) card.classList.add('is-active'); },
              onLeaveBack: () => { if(isTouch) card.classList.remove('is-active'); }
          }
      });
  });

  /* ---- Work Cards Mobile Reveal ---- */
  if (isTouch) {
    gsap.utils.toArray('.work-card').forEach(function(card){
        ScrollTrigger.create({
            trigger: card,
            start: "top 60%", /* Trigger slightly above center */
            end: "bottom 40%",
            onEnter: () => card.classList.add('is-active'),
            onLeave: () => card.classList.remove('is-active'),
            onEnterBack: () => card.classList.add('is-active'),
            onLeaveBack: () => card.classList.remove('is-active')
        });
    });
  }

  /* ---- Text Line Split Reveals for other sections ---- */
  ['.process-header', '.contact-scene'].forEach(function(sectionStr){
      var section = document.querySelector(sectionStr);
      if(!section) return;
      var h = section.querySelector('.scene-heading');
      if(!h) return;

      var lines = splitLines(sectionStr + ' .scene-heading');
      if(lines.length > 0) {
          ScrollTrigger.create({
              trigger: h,
              start: "top 85%",
              once: true,
              onEnter: function() {
                  gsap.to(lines, { yPercent:0, duration: 1.2, stagger: 0.1, ease:"expo.out" });
              }
          });
      }
  });

  /* ---- Terminal Animation Reveal ---- */
  var termBox = document.querySelector('.terminal-box');
  if (termBox) {
      gsap.from(termBox, {
          y: 30, opacity: 0, duration: 1,
          scrollTrigger: {
              trigger: termBox,
              start: "top 85%"
          }
      });
  }

})();




