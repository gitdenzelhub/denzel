/* ============================================================
   Interaction layer — DNZL SZN
   - GSAP entrance choreography, held until the display font lands
   - scroll-triggered reveals, counters, benchmark bars
   - athlete pass: lanyard physics, pointer tilt, photo slideshow
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
        ".manifesto-soul, .bench-fill, .split-fill, .hero-field"
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

  /* ── Hero particle field ─────────────────────────────────── */
  // Carried over from the original site. The only change is that the two
  // colours are read from the live palette instead of being hardcoded, so
  // the dust recolours along with everything else.

  var canvas = document.querySelector(".hero-field");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var particles = [];
    var w = 0, h = 0, dpr = 1;
    var raf = null;

    // Resolve a CSS custom property to an "r, g, b" string by letting the
    // browser do the parsing, which keeps hex, rgb() and rgba() all working.
    function readToken(name, fallback) {
      var probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;color:var(" + name + ")";
      document.body.appendChild(probe);
      var c = window.getComputedStyle(probe).color;
      document.body.removeChild(probe);
      var m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
      return m ? m[1] + ", " + m[2] + ", " + m[3] : fallback;
    }

    var dustRGB = "245, 240, 235";
    var warmRGB = "255, 122, 64";

    function readPalette() {
      dustRGB = readToken("--fg", "245, 240, 235");
      warmRGB = readToken("--accent", "255, 122, 64");
    }
    readPalette();
    document.addEventListener("palettechange", function () {
      readPalette();
      if (reduced) drawStill();
    });

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
      if (window.getComputedStyle(canvas).display === "none") {
        pause();
        return;
      }
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
        ctx.fillStyle = "rgba(" + dustRGB + ", " + layerAlpha[b] + ")";
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
        ctx.fillStyle = "rgba(" + warmRGB + ", " + (0.14 + (b / (LAYERS - 1)) * 0.62).toFixed(3) + ")";
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
        ctx.fillStyle = "rgba(" + dustRGB + ", " + layerAlpha[b] + ")";
        ctx.fill();
      }
    }

    function fieldVisible() {
      return window.getComputedStyle(canvas).display !== "none";
    }

    function play() {
      if (!fieldVisible()) return;
      if (!raf && !reduced) raf = requestAnimationFrame(frame);
    }
    function pause() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    window.addEventListener("resize", function () {
      pause();
      resize();
      if (!fieldVisible()) return;
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

    // Collapsed by default: one grey arrow, nothing else.
    var toggle = document.createElement("button");
    toggle.className = "palette-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Choose a colour scheme");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="15 18 9 12 15 6"></polyline></svg>';

    toggle.addEventListener("click", function () {
      var open = bar.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    bar.appendChild(toggle);

    function choose(p) {
      root.setAttribute("data-palette", p.id);
      try { localStorage.setItem("dnzl-palette", p.id); } catch (e) {}
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", p.bg);
      buttons.forEach(function (b, i) {
        b.setAttribute("aria-pressed", String(PALETTES[i].id === p.id));
      });
      // The hero dust reads its colours from the palette, so tell it.
      document.dispatchEvent(new CustomEvent("palettechange"));
    }

    var active = PALETTES.filter(function (p) {
      return p.id === root.getAttribute("data-palette");
    })[0] || PALETTES[0];
    choose(active);

    // Clicking anywhere else puts it away again.
    document.addEventListener("click", function (e) {
      if (!bar.contains(e.target)) {
        bar.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        bar.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.body.appendChild(bar);
  }

  /* ── Athlete pass ────────────────────────────────────────── */
  // rig   → strap, clip and card swing as one pendulum from far above
  // card  → hinged at its clip, so it lags and overshoots the strap a touch
  // tilt  → the pointer tips the card on its own axis
  // photo → a slideshow, story-style

  var still = reduced || /[?&]static=1/.test(location.search);
  var scene = document.querySelector(".pass-scene");
  var rig = document.querySelector(".pass-rig");
  var pass = document.querySelector(".pass");
  var passTilt = document.querySelector(".pass-tilt");
  var kickPass = function () {};

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* Slideshow. Split bars fill across the top of the photo; tap the left
     third to go back and anywhere else to go on. It holds while the pass is
     hovered, held, keyboard-focused or off screen. */

  var photo = document.querySelector(".pass-photo");
  var slides = photo ? [].slice.call(photo.querySelectorAll(".pass-slide")) : [];
  var splits = photo ? [].slice.call(photo.querySelectorAll(".pass-split")) : [];
  var caption = document.querySelector(".pass-caption");
  var holds = {};
  var hold = function () {};

  if (slides.length > 1) {
    var current = 0;
    photo.classList.add("is-live");
    if (!still) photo.classList.add("is-playing");

    hold = function (reason, on) {
      holds[reason] = on;
      photo.classList.toggle("is-paused", Object.keys(holds).some(function (k) { return holds[k]; }));
    };

    var show = function (i, dir, tries) {
      var n = (i + slides.length) % slides.length;
      var img = slides[n];
      dir = dir || 1;
      tries = tries || 0;

      // Skip a photo that failed to load rather than fade to a blank frame.
      if (img.complete && !img.naturalWidth && tries < slides.length) {
        return show(n + dir, dir, tries + 1);
      }
      // And never cut to one that has not arrived yet.
      if (!img.complete) {
        img.loading = "eager";
        img.addEventListener("load", function () { show(n, dir); }, { once: true });
        img.addEventListener("error", function () { show(n + dir, dir, tries + 1); }, { once: true });
        return;
      }

      var changed = n !== current;
      current = n;
      slides.forEach(function (s, k) {
        s.classList.toggle("is-active", k === n);
        if (k === n) s.removeAttribute("aria-hidden");
        else s.setAttribute("aria-hidden", "true");
      });
      splits.forEach(function (s, k) {
        s.classList.remove("is-active");
        s.classList.toggle("is-done", k < n);
      });
      void photo.offsetWidth;   // restart the fill even when it is the same bar
      if (splits[n]) splits[n].classList.add("is-active");

      if (caption && changed) {
        caption.style.opacity = "0";
        setTimeout(function () {
          caption.textContent = img.getAttribute("data-caption") || "";
          caption.style.opacity = "";
        }, 200);
      }
    };

    show(0);

    photo.addEventListener("animationend", function (e) {
      if (splits[current] && e.target.parentNode === splits[current]) show(current + 1);
    });

    photo.querySelector(".pass-nav--prev").addEventListener("click", function () { show(current - 1, -1); });
    photo.querySelector(".pass-nav--next").addEventListener("click", function () { show(current + 1); });

    photo.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(current - 1, -1); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(current + 1); e.preventDefault(); }
    });

    if (pass) {
      pass.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "mouse") hold("hover", true);
      });
      pass.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "mouse") hold("hover", false);
      });
      // Keyboard focus only. A mouse click also focuses the button, and
      // that should not stop the show for good.
      pass.addEventListener("focusin", function (e) {
        var keyboard = true;
        try { keyboard = e.target.matches(":focus-visible"); } catch (err) {}
        hold("focus", keyboard);
      });
      pass.addEventListener("focusout", function (e) {
        if (!pass.contains(e.relatedTarget)) hold("focus", false);
      });
    }
  }

  /* Lanyard physics. Two damped springs: the strap's swing about its far
     pivot, and the card's about its clip, driven by the strap's
     acceleration. Grab the card to swing it, brush past it to nudge it, and
     swing slow breeze keeps it from ever hanging dead still. */

  if (scene && rig && pass && !still) {
    var SWING_K = 12;       // strap stiffness: a 1.8 s period, like a real lanyard
    var SWING_C = 0.75;     // strap damping: a flick dies away in five or six swings
    var CARD_K = 80;        // the card on its clip swings about twice as fast
    var CARD_C = 3.4;
    var CARD_LAG = 1.1;     // how far the strap's acceleration throws the card
    var MAX_PULL = 20;      // degrees the strap can be dragged out
    var MAX_FLICK = 60;     // degrees per second it can be let go at

    // Start from the resting pose styles.css paints, so nothing jumps.
    var swing = 0.5, swingV = 0;   // strap angle and angular velocity, degrees
    var tip = -1.6, tipV = 0;      // card angle on its clip
    var acc = 0;
    var clock = 0, last = 0, loop = null;
    var onScreen = true;
    var pending = null, drag = null, dragged = false;

    var step = function (now) {
      var dt = last ? Math.min(0.032, (now - last) / 1000) : 0;
      last = now;
      loop = requestAnimationFrame(step);
      if (!dt) return;
      clock += dt;

      if (drag) {
        // Held: the strap follows the hand, and carries the hand's speed
        // away with it on release.
        var vNext = swingV + ((drag.target - swing) / dt - swingV) * 0.3;
        acc = (vNext - swingV) / dt;
        swingV = vNext;
        swing = drag.target;
      } else {
        var breeze = 3 * Math.sin(clock * 1.03) + 1.8 * Math.sin(clock * 1.71 + 1.3);
        acc = -SWING_K * swing - SWING_C * swingV + breeze;
        swingV += acc * dt;
        swing += swingV * dt;
      }

      tipV += (-CARD_K * tip - CARD_C * tipV - CARD_LAG * clamp(acc, -900, 900)) * dt;
      tip += tipV * dt;

      rig.style.transform = "rotate(" + swing.toFixed(3) + "deg)";
      pass.style.transform = "rotate(" + tip.toFixed(3) + "deg)";
    };

    var run = function () {
      var go = onScreen && !document.hidden;
      if (go && !loop) { last = 0; loop = requestAnimationFrame(step); }
      if (!go && loop) { cancelAnimationFrame(loop); loop = null; }
    };

    kickPass = function () { swingV -= 10; };

    // The pivot, in viewport pixels. Read from the untransformed layout box
    // plus the CSS transform-origin, so it is right mid-swing too.
    var pivot = function () {
      var s = scene.getBoundingClientRect();
      var origin = window.getComputedStyle(rig).transformOrigin.split(" ");
      return {
        x: s.left + rig.offsetLeft + parseFloat(origin[0]),
        y: s.top + rig.offsetTop + parseFloat(origin[1])
      };
    };

    // Angle of the pointer seen from the pivot. A clockwise strap moves the
    // card left, hence the minus where this is used.
    var bearing = function (p, e) {
      return Math.atan2(e.clientX - p.x, e.clientY - p.y) * 180 / Math.PI;
    };

    pass.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var p = pivot();
      pending = { id: e.pointerId, x: e.clientX, y: e.clientY, p: p, a0: swing, b0: bearing(p, e) };
    });

    pass.addEventListener("pointermove", function (e) {
      if (pending && !drag && e.pointerId === pending.id &&
          Math.abs(e.clientX - pending.x) + Math.abs(e.clientY - pending.y) > 6) {
        drag = pending;
        drag.target = swing;
        try { pass.setPointerCapture(e.pointerId); } catch (err) {}
        pass.classList.add("is-dragging");
        hold("drag", true);
      }
      if (drag && e.pointerId === drag.id) {
        drag.target = clamp(drag.a0 - (bearing(drag.p, e) - drag.b0), -MAX_PULL, MAX_PULL);
      }
    });

    var letGo = function (e) {
      if (pending && e.pointerId === pending.id) pending = null;
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      swingV = clamp(swingV, -MAX_FLICK, MAX_FLICK);
      pass.classList.remove("is-dragging");
      hold("drag", false);
      // The click that follows a drag is not a tap on the photo.
      dragged = true;
      setTimeout(function () { dragged = false; }, 0);
    };

    pass.addEventListener("pointerup", letGo);
    pass.addEventListener("pointercancel", letGo);
    pass.addEventListener("dragstart", function (e) { e.preventDefault(); });
    pass.addEventListener("click", function (e) {
      if (dragged) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    // A mouse brushing past nudges it, by distance moved rather than speed,
    // so the push does not depend on how often the browser reports moves.
    var lastX = null;
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || drag || !loop) { lastX = null; return; }
      if (lastX !== null) {
        var r = pass.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        var reach = 1 - Math.sqrt(dx * dx + dy * dy) / 340;
        if (reach > 0) swingV = clamp(swingV - (e.clientX - lastX) * reach * 0.03, -MAX_FLICK, MAX_FLICK);
      }
      lastX = e.clientX;
    }, { passive: true });

    document.addEventListener("visibilitychange", run);
    run();
  }

  // Both the swing and the slideshow rest while the hero is scrolled away.
  if (scene && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      hold("away", !onScreen);
      if (typeof run === "function") run();
    }).observe(scene);
  }

  /* Pointer tilt, plus the laminate sheen that follows it. */

  if (hasGSAP && pass && passTilt &&
      window.matchMedia("(hover: hover)").matches && !reduced) {
    gsap.set(passTilt, { transformPerspective: 900, transformOrigin: "50% 10px" });

    var toRX = gsap.quickTo(passTilt, "rotationX", { duration: 0.5, ease: "power2.out" });
    var toRY = gsap.quickTo(passTilt, "rotationY", { duration: 0.5, ease: "power2.out" });

    pass.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var r = pass.getBoundingClientRect();
      var px = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      var py = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
      toRY(px * 14);
      toRX(py * -10);
      passTilt.style.setProperty("--glare", (70 - px * 80).toFixed(1) + "%");
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

  // Park the lines below their masks before anything can paint them, so the
  // parent's opacity is the only thing the stylesheet has to hide.
  if (heroLines.length) gsap.set(heroLines, { yPercent: 112 });

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
      { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 1.1, ease: "power4.out",
        onStart: kickPass,   // it arrives swinging, then settles on the strap
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
    if (canvas) canvas.classList.add("is-in");
    if (heroStack) heroStack.classList.add("is-in");
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
  var manifestoWrap = document.querySelector(".manifesto-lines");
  if (manifestoLines.length) {
    gsap.set(manifestoLines, { yPercent: 112 });

    gsap.timeline({
      // Triggered on the text itself rather than the section, whose top
      // padding sits a long way above the first line.
      scrollTrigger: { trigger: ".manifesto-lines", start: "top 85%", once: true },
      onStart: function () {
        if (manifestoWrap) manifestoWrap.classList.add("is-in");
      }
    })
      .fromTo(manifestoLines,
        { yPercent: 112 },
        { yPercent: 0, duration: 0.75, stagger: 0.08, ease: "expo.out",
          onComplete: function () {
            gsap.set(manifestoLines, { clearProps: "transform" });
          } })
      .fromTo(".manifesto-soul",
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
          onComplete: release(".manifesto-soul", document.querySelector(".manifesto-soul")) },
        0.4);
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
