/* ===========================================================
   hearthlyapps — scroll-scrubbed film
   2026-08-19.

   WHAT THIS IS AND WHY IT EXISTS
   ------------------------------
   The previous motion pass animated *properties* — things tilted,
   dissolved, drew themselves in. Tasteful, and not what was asked for.
   What was asked for is a film that plays as you scroll: continuous
   motion of a real subject through a real scene, the way Apple's product
   pages work.

   That cannot be faked with transforms. It needs actual frames.

   The frames are real: 781 of them, 1080x1920, already rendered in this
   project's own v3 WebGL build (marketing/v3_build/raw_frames_v4) — a
   3D phone travelling through a teal/violet field while its screen moves
   through genuine Sustain screens, with 3D objects drifting past. Nothing
   here is generated, stock, or invented; it is this product's own
   existing render, resampled to 132 frames at 810x1440 WebP (2.4MB total)
   and scrubbed against scroll position.

   HOW IT WORKS
   ------------
   A pinned <canvas> fills the viewport. Scroll progress through the
   section maps to a frame index. Each rAF we draw the nearest decoded
   frame with cover-fit. That's it — no video element (which can't be
   scrubbed reliably across browsers, seeks are async and stutter), no
   library.

   LOADING STRATEGY
   ----------------
   Frames load in three waves so the section is usable almost
   immediately and never blocks the rest of the page:
     1. every 8th frame  — a coarse flipbook, enough to scrub roughly
     2. every 2nd frame  — usable smoothness
     3. the remainder    — full 132
   The canvas draws the nearest *loaded* frame, so early scrubbing
   degrades in smoothness rather than breaking.
   =========================================================== */

(function () {
  "use strict";

  var stage = document.querySelector("[data-film]");
  if (!stage) return;

  var canvas = stage.querySelector("canvas");
  var scene  = stage.closest("[data-film-scene]");
  if (!canvas || !scene) return;

  var COUNT = parseInt(stage.getAttribute("data-frames"), 10) || 132;
  var PATH  = stage.getAttribute("data-path") || "";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ctx = canvas.getContext("2d", { alpha: false });
  var imgs = new Array(COUNT);
  var ready = new Array(COUNT);
  var loadedCount = 0;
  var current = -1;
  var wantFrame = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function url(i) { return PATH + "f_" + String(i).padStart(3, "0") + ".webp"; }

  function load(i, cb) {
    if (imgs[i]) return;
    var im = new Image();
    im.decoding = "async";
    im.onload = function () {
      ready[i] = true; loadedCount++;
      if (cb) cb();
      // first frame available: paint immediately so the section is never
      // an empty box while the rest streams in
      if (current === -1) draw(true);
    };
    im.onerror = function () { ready[i] = false; };
    im.src = url(i);
    imgs[i] = im;
  }

  // nearest loaded frame to the one we want, searching outward
  function nearestLoaded(target) {
    if (ready[target]) return target;
    for (var d = 1; d < COUNT; d++) {
      if (target - d >= 0 && ready[target - d]) return target - d;
      if (target + d < COUNT && ready[target + d]) return target + d;
    }
    return -1;
  }

  function sizeCanvas() {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      current = -1;                 // force a repaint at the new size
    }
  }

  // Tiny offscreen buffer used to produce a colour-matched blurred
  // backdrop. Drawing the frame into ~40px wide and blowing it back up
  // with smoothing on is an extremely cheap blur — far cheaper than a
  // canvas filter, and it tracks the frame's own colours exactly.
  var bg = document.createElement("canvas");
  bg.width = 40; bg.height = 71;
  var bgx = bg.getContext("2d");

  function draw(force) {
    var idx = nearestLoaded(wantFrame);
    if (idx < 0) return;
    if (idx === current && !force) return;
    current = idx;

    var im = imgs[idx];
    var cw = canvas.width, ch = canvas.height;

    // 1. blurred backdrop, full bleed.
    //    Cover-fitting the sharp frame instead would crop a 9:16 render
    //    into a 16:9 stage — on a 1440x900 viewport that throws away
    //    about 1600px of vertical, which put the camera so close that the
    //    phone overflowed the screen on every frame.
    bgx.drawImage(im, 0, 0, bg.width, bg.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bg, 0, 0, cw, ch);

    // 2. the real frame, contained, so the whole composition is in shot
    var ir = im.naturalWidth / im.naturalHeight;
    var dh = ch, dw = ch * ir;
    if (dw > cw) { dw = cw; dh = cw / ir; }
    ctx.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* ---------------------------------------------------- scroll */

  var ticking = false;
  function onFrame() {
    ticking = false;
    var r = scene.getBoundingClientRect();
    var vh = window.innerHeight;
    var span = Math.max(scene.offsetHeight - vh, 1);
    var p = Math.min(1, Math.max(0, -r.top / span));

    stage.style.setProperty("--film", p.toFixed(4));
    var f = Math.min(COUNT - 1, Math.round(p * (COUNT - 1)));
    if (f !== wantFrame) { wantFrame = f; draw(false); }

    // Invert the nav while the film is behind it, so an opaque bar of
    // paper doesn't cut across a full-bleed sequence.
    var nav = document.querySelector(".nav");
    if (nav) {
      var over = r.top <= 60 && r.bottom > 120;
      if (over !== navOver) { navOver = over; nav.classList.toggle("over-film", over); }
    }
  }
  var navOver = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onFrame);
  }

  /* ---------------------------------------------------- boot */

  sizeCanvas();

  if (reduced) {
    // One representative frame, no scrubbing, no streaming. The section
    // still shows the product; it just doesn't move.
    var still = Math.round(COUNT * 0.62);
    load(still, function () { wantFrame = still; draw(true); });
    stage.setAttribute("data-static", "");
    return;
  }

  function startLoading() {
    // wave 1 — coarse flipbook
    var wave1 = [];
    for (var i = 0; i < COUNT; i += 8) wave1.push(i);
    if (wave1[wave1.length - 1] !== COUNT - 1) wave1.push(COUNT - 1);

    var w1done = 0;
    wave1.forEach(function (i) {
      load(i, function () {
        w1done++;
        if (w1done === wave1.length) wave2();
      });
    });
  }

  // Don't fetch 2.4MB of frames on first paint. Measured: without this
  // gate all 132 frames were requested during page load, ahead of a hero
  // the visitor sees immediately and a film they may never reach. The
  // gate opens roughly a viewport and a half out, which on any normal
  // scroll speed is well before the first frame is needed.
  if ("IntersectionObserver" in window) {
    var gate = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      gate.disconnect();
      startLoading();
    }, { rootMargin: "150% 0px 150% 0px" });
    gate.observe(scene);
  } else {
    startLoading();
  }

  function wave2() {
    var list = [];
    for (var i = 0; i < COUNT; i += 2) if (!imgs[i]) list.push(i);
    var done = 0;
    if (!list.length) return wave3();
    list.forEach(function (i) {
      load(i, function () { done++; if (done === list.length) wave3(); });
    });
  }

  function wave3() {
    for (var i = 0; i < COUNT; i++) if (!imgs[i]) load(i);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    sizeCanvas(); draw(true); onFrame();
  }, { passive: true });

  onFrame();
})();
