/* ============================================================
   Interaction layer — DNZL SZN
   - GSAP entrance choreography, held until the display font lands
   - scroll-triggered reveals, counters, benchmark bars
   - athlete pass: strap and card swing together off one rig
   - course profile: scroll progress with a tick at every checkpoint
   - live Dubai clock and current split in the timing strip
   Hidden entrance states live behind the `gsap` class set in the
   document head, so if the CDN is unreachable the page renders
   fully visible and only the motion is lost.
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var root = document.documentElement;

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ── Rest-state fallback ─────────────────────────────────── */
  // Drop every element into its final state without animating. Used when
  // GSAP is missing and when the visitor asked for reduced motion.

  function settle() {
    document
      .querySelectorAll(
        ".reveal, .reel-row, .hero-stack, .hero-eyebrow, .hero-definition," +
        ".hero-intro, .hero-scroll, .pass-scene, .manifesto-lines," +
        ".manifesto-soul, .bench-fill, .split-fill"
      )
      .forEach(function (el) { el.classList.add("is-in"); });
  }

  // Hand elements back to CSS once a tween is done, so hover rules are
  // not fighting leftover inline styles from GSAP.
  function release(targets, scope) {
    return function () {
      gsap.set(targets, { clearProps: "opacity,transform" });
      if (scope) scope.classList.add("is-in");
    };
  }

  /* ── Header + mobile menu ────────────────────────────────── */

  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".mobile-menu");

  function closeMenu() {
    if (!menu || !toggle) return;
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ── Timing strip: Dubai clock ───────────────────────────── */

  var clockEl = document.querySelector("[data-clock]");
  function tickClock() {
    if (!clockEl) return;
    try {
      clockEl.textContent = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Dubai",
        hour12: false
      });
    } catch (e) {
      clockEl.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ── Course profile: progress, checkpoint ticks, split name ── */

  var coveredEl = document.querySelector("[data-covered]");
  var splitEl = document.querySelector("[data-split]");
  var courseFill = document.querySelector(".course-fill");
  var tickWrap = document.querySelector(".course-ticks");

  var checkpoints = [].slice
    .call(document.querySelectorAll("[data-checkpoint]"))
    .map(function (el) {
      return { el: el, name: el.getAttribute("data-checkpoint"), at: 0, tick: null };
    });

  if (tickWrap) {
    checkpoints.forEach(function (cp, i) {
      // The start line needs no tick of its own.
      if (i === 0) return;
      var tick = document.createElement("span");
      tick.className = "course-tick";
      tickWrap.appendChild(tick);
      cp.tick = tick;
    });
  }

  function measureCourse() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    checkpoints.forEach(function (cp) {
      var top = cp.el.getBoundingClientRect().top + window.scrollY;
      cp.at = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0;
      if (cp.tick) cp.tick.style.left = (cp.at * 100).toFixed(2) + "%";
    });
  }

  var telemetry = document.querySelector(".telemetry");

  function updateCourse() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

    // The strip belongs to the race, not the start line.
    if (telemetry) telemetry.classList.toggle("is-visible", window.scrollY > 32);

    if (courseFill) courseFill.style.transform = "scaleX(" + p + ")";
    if (coveredEl) coveredEl.textContent = String(Math.round(p * 100)).padStart(3, "0");

    var current = checkpoints.length ? checkpoints[0].name : "";
    checkpoints.forEach(function (cp) {
      var passed = p >= cp.at - 0.005;
      if (cp.tick) cp.tick.classList.toggle("is-passed", passed);
      if (passed) current = cp.name;
    });
    if (splitEl && splitEl.textContent !== current) splitEl.textContent = current;
  }

  window.addEventListener("scroll", updateCourse, { passive: true });
  window.addEventListener("resize", function () { measureCourse(); updateCourse(); });
  measureCourse();
  updateCourse();

  /* ── Footer year ─────────────────────────────────────────── */

  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  /* ── Palette compare (preview builds only) ───────────────── */
  // The published site ships one palette baked into <html data-palette>.
  // This switcher only appears when explicitly enabled, so a brand never
  // sees a half-finished set of options.

  var PALETTES = [
    { id: "night", label: "Night Track", bg: "#0a0e17", accent: "#ff3b2f" },
    { id: "bib", label: "Race Bib", bg: "#ffffff", accent: "#e4002b" },
    { id: "gulf", label: "Gulf Blue", bg: "#152bc4", accent: "#ffb800" },
    { id: "blackout", label: "Blackout", bg: "#000000", accent: "#ffffff" },
    { id: "sand", label: "Sand", bg: "#ebe3d3", accent: "#e8490f" }
  ];

  var compareOn = root.getAttribute("data-compare") === "on" ||
                  window.__DNZL_COMPARE ||
                  /[?&]compare=1/.test(location.search);

  if (compareOn) {
    var saved = null;
    try { saved = localStorage.getItem("dnzl-palette"); } catch (e) {}
    if (saved && PALETTES.some(function (p) { return p.id === saved; })) {
      root.setAttribute("data-palette", saved);
    }

    var bar = document.createElement("div");
    bar.className = "palette-bar";

    var name = document.createElement("span");
    name.className = "palette-bar-name";
    bar.appendChild(name);

    var dots = document.createElement("div");
    dots.className = "palette-dots";
    bar.appendChild(dots);

    var buttons = PALETTES.map(function (p) {
      var b = document.createElement("button");
      b.className = "palette-dot";
      b.type = "button";
      b.title = p.label;
      b.setAttribute("aria-label", "Colour scheme: " + p.label);
      b.style.setProperty("--chip-bg", p.bg);
      b.style.setProperty("--chip-accent", p.accent);
      b.addEventListener("click", function () { choose(p); });
      dots.appendChild(b);
      return b;
    });

    function choose(p) {
      root.setAttribute("data-palette", p.id);
      try { localStorage.setItem("dnzl-palette", p.id); } catch (e) {}
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", p.bg);
      name.textContent = p.label;
      buttons.forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(PALETTES[i].id === p.id));
      });
    }

    var active = PALETTES.filter(function (p) {
      return p.id === root.getAttribute("data-palette");
    })[0] || PALETTES[0];
    choose(active);

    document.body.appendChild(bar);
  }

  /* ── Athlete pass: the whole rig swings ──────────────────── */
  // rig  → left/right pointer swings strap and card together
  // card → up/down pointer tips the card on its own axis

  var pass = document.querySelector(".pass");
  var passTilt = document.querySelector(".pass-tilt");

  if (hasGSAP && pass && passTilt &&
      window.matchMedia("(hover: hover)").matches && !reduced) {
    gsap.set(passTilt, { rotation: 3, transformPerspective: 900 });

    var toRX = gsap.quickTo(passTilt, "rotationX", { duration: 0.5, ease: "power2.out" });
    var toRY = gsap.quickTo(passTilt, "rotationY", { duration: 0.5, ease: "power2.out" });

    // A slow idle sway on the z-rotation keeps the card feeling hung,
    // while the pointer drives X/Y independently.
    gsap.to(passTilt, {
      rotation: 4.2,
      duration: 2.6,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    });

    pass.addEventListener("pointermove", function (e) {
      var r = pass.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      toRY(px * 14);
      toRX(py * -12);
    });

    pass.addEventListener("pointerleave", function () {
      toRX(0);
      toRY(0);
    });
  }

  /* ── Entrance + scroll choreography ──────────────────────── */

  if (!hasGSAP) {
    settle();
    return;
  }

  // ?static=1 renders the settled page with no motion — handy for saving
  // the kit as a PDF or grabbing clean screenshots.
  if (reduced || /[?&]static=1/.test(location.search)) {
    settle();
    if (!reduced) return;
    gsap.fromTo(".hero-grid",
      { opacity: 0 },
      { opacity: 1, duration: 0.6, ease: "none",
        onComplete: function () { gsap.set(".hero-grid", { clearProps: "opacity" }); } });
    return;
  }

  var heroStack = document.querySelector(".hero-stack");
  var heroLines = document.querySelectorAll(".hero-line-inner");

  var intro = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });

  intro
    .fromTo(heroLines,
      { yPercent: 112 },
      {
        yPercent: 0,
        duration: 1.05,
        stagger: 0.14,
        ease: "expo.out",
        onComplete: release(heroLines, heroStack)
      }, 0)
    .fromTo(".hero-eyebrow",
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.7,
        onComplete: release(".hero-eyebrow", document.querySelector(".hero-eyebrow")) },
      0.3)
    .fromTo(".pass-scene",
      { opacity: 0, y: 44, rotate: 2 },
      { opacity: 1, y: 0, rotate: 0, duration: 1.1, ease: "power4.out",
        onComplete: release(".pass-scene", document.querySelector(".pass-scene")) },
      0.55)
    .fromTo([".hero-intro", ".hero-definition", ".hero-scroll"],
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1,
        onComplete: function () {
          [".hero-intro", ".hero-definition", ".hero-scroll"].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (el) { el.classList.add("is-in"); gsap.set(el, { clearProps: "opacity,transform" }); }
          });
        } },
      0.65);

  // Hold the entrance until Anton is in. Animating the stack mid-swap
  // makes every line re-measure and jump.
  var started = false;
  function launch() {
    if (started) return;
    started = true;
    ScrollTrigger.refresh();
    measureCourse();
    updateCourse();
    intro.play();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(launch);
    setTimeout(launch, 1800);   // never wait on a stalled font forever
  } else {
    launch();
  }

  /* ── Scroll-triggered reveals ────────────────────────────── */

  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    once: true,
    onEnter: function (batch) {
      gsap.fromTo(batch,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0,
          duration: 0.95,
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
    start: "top 90%",
    once: true,
    onEnter: function (batch) {
      gsap.fromTo(batch,
        { opacity: 0, y: 26 },
        {
          opacity: 1, y: 0,
          duration: 0.85,
          stagger: 0.09,
          ease: "power3.out",
          onComplete: function () {
            batch.forEach(function (el) { el.classList.add("is-in"); });
            gsap.set(batch, { clearProps: "opacity,transform" });
          }
        });
    }
  });

  /* Manifesto lines climb out of their masks, then the soul line. */

  var manifestoLines = document.querySelectorAll(".manifesto-line-inner");
  if (manifestoLines.length) {
    gsap.timeline({
      scrollTrigger: { trigger: ".manifesto", start: "top 62%", once: true }
    })
      .fromTo(manifestoLines,
        { yPercent: 112 },
        { yPercent: 0, duration: 1, stagger: 0.16, ease: "expo.out",
          onComplete: function () {
            var wrap = document.querySelector(".manifesto-lines");
            if (wrap) wrap.classList.add("is-in");
            gsap.set(manifestoLines, { clearProps: "transform" });
          } })
      .fromTo(".manifesto-soul",
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
          onComplete: release(".manifesto-soul", document.querySelector(".manifesto-soul")) },
        0.55);
  }

  /* Benchmark bars and the audience split grow from the left. */

  var benchFills = document.querySelectorAll(".bench-fill");
  if (benchFills.length) {
    gsap.fromTo(benchFills,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.3,
        stagger: 0.12,
        ease: "power3.inOut",
        scrollTrigger: { trigger: ".benchmark", start: "top 85%", once: true },
        onComplete: function () {
          benchFills.forEach(function (el) { el.classList.add("is-in"); });
          gsap.set(benchFills, { clearProps: "transform" });
        }
      });
  }

  gsap.to(".split-fill", {
    scaleX: 1,
    duration: 1.4,
    ease: "power3.out",
    scrollTrigger: { trigger: ".split", start: "top 85%", once: true },
    onComplete: function () {
      var el = document.querySelector(".split-fill");
      if (el) { el.classList.add("is-in"); gsap.set(el, { clearProps: "transform" }); }
    }
  });

  /* ── Counters ────────────────────────────────────────────── */

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

  /* ── Hero parallax ───────────────────────────────────────── */

  gsap.to(".hero-grid", {
    y: -50,
    opacity: 0.3,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.4
    }
  });
})();
