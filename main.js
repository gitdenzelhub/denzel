/* ============================================================
   Interaction layer
   - GSAP + ScrollTrigger for the entrance and scroll choreography
   - masked, per-character headline reveal
   - dense cursor-reactive particle field behind the hero
   The hidden entrance states live behind the `gsap` class set in the
   document head, so if the CDN is unreachable the page renders fully
   visible and only the motion is lost.
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ── Headline: split into lines → words → characters ─────── */

  function splitHeadline(el) {
    var lines = (el.getAttribute("data-split") || "").split("|");
    var frag = document.createDocumentFragment();

    lines.forEach(function (lineText) {
      var line = document.createElement("span");
      line.className = "hero-line";

      var inner = document.createElement("span");
      inner.className = "hero-line-inner";

      lineText.trim().split(/\s+/).forEach(function (wordText, wi, words) {
        var word = document.createElement("span");
        word.className = "word";

        // Non-breaking space: a plain space inside an inline-block
        // character span collapses to zero width and welds words together.
        var text = wi < words.length - 1 ? wordText + String.fromCharCode(160) : wordText;

        text.split("").forEach(function (ch) {
          var span = document.createElement("span");
          span.className = "char";
          span.textContent = ch;
          word.appendChild(span);
        });

        inner.appendChild(word);
      });

      line.appendChild(inner);
      frag.appendChild(line);
    });

    el.appendChild(frag);
    return el;
  }

  var headline = document.querySelector(".hero-headline");
  if (headline) splitHeadline(headline);

  /* ── Choreography ────────────────────────────────────────── */

  var heroTitle = document.querySelector(".hero-title");
  var eyebrow = document.querySelector(".hero-eyebrow");
  var heroFoot = document.querySelector(".hero-foot");
  var field = document.querySelector(".hero-field");
  var curtain = document.querySelector(".page-transition");

  // Drop every element into its rest state without animating. Used when
  // GSAP is missing and when the visitor asked for reduced motion.
  function settle() {
    document.documentElement.classList.add("is-ready");
    [heroTitle, eyebrow, heroFoot, field].forEach(function (el) {
      if (el) el.classList.add("is-in");
    });
    document.querySelectorAll(".reveal, .reel-row").forEach(function (el) {
      el.classList.add("is-in");
    });
    if (hasGSAP) gsap.set(".split-fill", { scaleX: 1 });
  }

  // Hand an element back to CSS once its tween is done, so the hover
  // rules are not fighting leftover inline styles from GSAP.
  function release(targets, scope) {
    return function () {
      gsap.set(targets, { clearProps: "opacity,transform" });
      if (scope) scope.classList.add("is-in");
    };
  }

  var chars = headline ? headline.querySelectorAll(".char") : [];

  if (!hasGSAP) {
    settle();
  } else if (reduced) {
    // Reduced motion asks for less movement, not necessarily none. Drop
    // every translation, parallax and the curtain, but still cross-fade
    // the headline in — opacity carries no vestibular risk.
    settle();
    gsap.fromTo(chars,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.5,
        stagger: 0.012,
        ease: "none",
        onComplete: function () { gsap.set(chars, { clearProps: "opacity" }); }
      });
  } else {

    var intro = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.out" },
      onStart: function () {
        document.documentElement.classList.add("is-ready");
      }
    });

    // Timing note: every headline beat is placed AFTER the curtain has
    // cleared (~0.75s). Starting the characters earlier means most of the
    // climb happens behind the curtain and the reveal is never actually seen.
    intro
      // Curtain lifts.
      .to(curtain, { yPercent: -101, duration: 0.75, ease: "power3.inOut" }, 0)
      .to(curtain, { autoAlpha: 0, duration: 0.25, ease: "none" }, 0.5)

      .fromTo(eyebrow,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7, onComplete: release(eyebrow, eyebrow) },
        0.62)

      // Characters climb out of their line masks — the main event, so it
      // gets the stage to itself once the curtain is gone.
      .fromTo(chars,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.1,
          stagger: 0.032,
          ease: "expo.out",
          onComplete: release(chars, heroTitle)
        },
        0.72)

      .fromTo(heroFoot ? heroFoot.children : [],
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.1,
          onComplete: release(heroFoot ? heroFoot.children : [], heroFoot)
        },
        1.55)

      .fromTo(field, { opacity: 0 }, { opacity: 1, duration: 1.5 }, 0.85);

    // Hold everything behind the curtain until the webfont is actually in.
    // Animating 28 characters while Inter is still swapping makes the whole
    // line re-measure and jump mid-flight.
    var started = false;
    function launch() {
      if (started) return;
      started = true;
      ScrollTrigger.refresh();   // positions moved when the font landed
      intro.play();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(launch);
      setTimeout(launch, 1800);  // never wait on a stalled font forever
    } else {
      launch();
    }

    /* ── Scroll-triggered reveals ──────────────────────────── */

    ScrollTrigger.batch(".reveal", {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.fromTo(batch,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            stagger: 0.09,
            ease: "power3.out",
            onComplete: function () {
              batch.forEach(function (el) { el.classList.add("is-in"); });
              gsap.set(batch, { clearProps: "opacity,transform" });
            }
          });
      }
    });

    ScrollTrigger.batch(".reel-row", {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.fromTo(batch.map(function (r) { return r.querySelector(".reel-link"); }),
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.08,
            ease: "power3.out",
            onComplete: function () {
              batch.forEach(function (el) { el.classList.add("is-in"); });
              // Released so the hover dimming can take over.
              gsap.set(batch.map(function (r) { return r.querySelector(".reel-link"); }),
                { clearProps: "opacity,transform" });
            }
          });
      }
    });

    // Audience split bar grows from the left.
    gsap.to(".split-fill", {
      scaleX: 1,
      duration: 1.4,
      ease: "power3.out",
      scrollTrigger: { trigger: ".split", start: "top 85%", once: true }
    });

    /* ── Counters ──────────────────────────────────────────── */

    document.querySelectorAll("[data-count]").forEach(function (el) {
      var to = parseFloat(el.getAttribute("data-count"));
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var commas = el.hasAttribute("data-commas");

      function render(v) {
        var s = v.toFixed(decimals);
        el.textContent = commas ? Number(s).toLocaleString("en-US") : s;
      }

      var counter = { v: 0 };
      gsap.to(counter, {
        v: to,
        duration: 1.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: function () { render(0); }
        },
        onUpdate: function () { render(counter.v); },
        onComplete: function () { render(to); }
      });
    });

    /* ── Hero parallax ─────────────────────────────────────── */

    gsap.to(".hero-inner", {
      y: -60,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.4
      }
    });

    /* ── Header tint ───────────────────────────────────────── */

    ScrollTrigger.create({
      start: 24,
      onUpdate: function (self) {
        var header = document.querySelector(".site-header");
        if (header) header.classList.toggle("is-stuck", self.scroll() > 24);
      }
    });
  }

  // Header tint still needs to work when GSAP is absent.
  if (!hasGSAP) {
    var header = document.querySelector(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-stuck", window.scrollY > 24);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  /* ── Hero particle field ─────────────────────────────────── */

  var canvas = document.querySelector(".hero-field");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var particles = [];
    var w = 0, h = 0, dpr = 1;
    var raf = null;

    // Raw pointer, and a smoothed one the field actually chases.
    var target = { x: -9999, y: -9999 };
    var pointer = { x: -9999, y: -9999 };
    var hasPointer = false;

    var REACH = 170;         // cursor influence radius
    var REACH2 = REACH * REACH;

    // Particles are sorted into depth layers. Drawing one layer as a single
    // path means ~8 canvas state changes per frame instead of thousands,
    // which is what makes a field this dense affordable.
    var LAYERS = 8;
    var cool = [];   // resting particles, by layer
    var warm = [];   // particles inside the cursor's reach, by intensity
    var layerAlpha = [];
    for (var L = 0; L < LAYERS; L++) {
      cool.push([]);
      warm.push([]);
      layerAlpha.push((0.05 + (L / (LAYERS - 1)) * 0.32).toFixed(3));
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      // Density scales with area, capped so low-end GPUs stay smooth.
      var count = Math.min(4200, Math.round((w * h) / 360));
      particles = [];
      for (var i = 0; i < count; i++) {
        // Depth drives size, brightness and drift speed together, so the
        // field reads as layered dust rather than one flat sheet of dots.
        var depth = Math.random();
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (0.05 + depth * 0.2),
          vy: (Math.random() - 0.5) * (0.05 + depth * 0.2),
          s: 0.6 + depth * 1.25,
          L: Math.min(LAYERS - 1, Math.floor(depth * LAYERS))
        });
      }
    }

    function frame() {
      // Ease the field's idea of the cursor toward the real one.
      if (hasPointer) {
        pointer.x += (target.x - pointer.x) * 0.14;
        pointer.y += (target.y - pointer.y) * 0.14;
      }

      ctx.clearRect(0, 0, w, h);

      var i, p, b, list, n;

      for (b = 0; b < LAYERS; b++) { cool[b].length = 0; warm[b].length = 0; }

      for (i = 0; i < particles.length; i++) {
        p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        // Wrap at the edges so the field never thins out.
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4;
        if (p.y > h + 4) p.y = -4;

        var heat = 0;

        if (hasPointer) {
          var dx = p.x - pointer.x;
          var dy = p.y - pointer.y;
          var d2 = dx * dx + dy * dy;

          if (d2 < REACH2 && d2 > 0.01) {
            var d = Math.sqrt(d2);
            var f = 1 - d / REACH;
            var nx = dx / d, ny = dy / d;
            // Push outward, plus a tangential nudge so the field
            // swirls around the cursor instead of just fleeing it.
            p.x += nx * f * 2.4 + -ny * f * 1.5;
            p.y += ny * f * 2.4 + nx * f * 1.5;
            heat = f;
          }
        }

        if (heat > 0.04) warm[Math.min(LAYERS - 1, (heat * LAYERS) | 0)].push(p);
        else cool[p.L].push(p);
      }

      // Resting dust, one path per depth layer.
      for (b = 0; b < LAYERS; b++) {
        list = cool[b];
        n = list.length;
        if (!n) continue;
        ctx.beginPath();
        for (i = 0; i < n; i++) { p = list[i]; ctx.rect(p.x, p.y, p.s, p.s); }
        ctx.fillStyle = "rgba(245, 240, 235, " + layerAlpha[b] + ")";
        ctx.fill();
      }

      // Everything the cursor is stirring up, brightened toward the accent.
      for (b = 0; b < LAYERS; b++) {
        list = warm[b];
        n = list.length;
        if (!n) continue;
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          p = list[i];
          ctx.rect(p.x - 0.35, p.y - 0.35, p.s + 0.7, p.s + 0.7);
        }
        ctx.fillStyle = "rgba(255, 122, 64, " + (0.14 + (b / (LAYERS - 1)) * 0.62).toFixed(3) + ")";
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    function drawStill() {
      // Reduced motion: draw the field once, then leave it still.
      ctx.clearRect(0, 0, w, h);
      for (var b = 0; b < LAYERS; b++) {
        ctx.beginPath();
        var drew = false;
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          if (p.L !== b) continue;
          ctx.rect(p.x, p.y, p.s, p.s);
          drew = true;
        }
        if (!drew) continue;
        ctx.fillStyle = "rgba(245, 240, 235, " + layerAlpha[b] + ")";
        ctx.fill();
      }
    }

    function play() { if (!raf && !reduced) raf = requestAnimationFrame(frame); }
    function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    window.addEventListener("resize", function () {
      pause();
      resize();
      if (reduced) drawStill(); else play();
    });

    if (reduced) {
      drawStill();
    } else {
      play();

      window.addEventListener("pointermove", function (e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        if (!hasPointer) { pointer.x = x; pointer.y = y; }   // no jump on first move
        target.x = x;
        target.y = y;
        hasPointer = true;
      }, { passive: true });

      window.addEventListener("pointerleave", function () {
        hasPointer = false;
      }, { passive: true });

      // Stop drawing when the hero has scrolled away or the tab is hidden.
      window.addEventListener("scroll", function () {
        var r = canvas.getBoundingClientRect();
        var onScreen = r.bottom > 0 && r.top < (window.innerHeight || 0);
        if (onScreen && !document.hidden) play(); else pause();
      }, { passive: true });

      document.addEventListener("visibilitychange", function () {
        document.hidden ? pause() : play();
      });
    }
  }

  /* ── Footer year ─────────────────────────────────────────── */

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
