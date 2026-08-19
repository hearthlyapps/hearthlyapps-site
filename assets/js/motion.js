/* ===========================================================
   hearthlyapps — motion engine
   2026-08-19.

   WHAT THIS IS
   ------------
   A scroll-linked timeline engine in ~180 lines with no dependencies.

   The previous build only had enter-viewport reveals: an element crossed
   a threshold, a class was added, CSS faded it in. That produces "a site
   with animations on it". Scroll position was a trigger, never a
   timeline, so nothing could be *scrubbed* — you could not scroll
   halfway into a moment and see it half-played.

   Here, scroll position is the playhead. Every element marked
   [data-scene] gets a normalised progress value 0..1 for its own scroll
   range, published as a CSS custom property (--p). All the actual
   animation lives in CSS as transforms and opacity driven by that
   number, which keeps the work on the compositor and keeps the authoring
   declarative:

       .thing { transform: translateY(calc(var(--p) * -80px)); }

   WHY NOT GSAP/ScrollTrigger
   --------------------------
   It would do this well, but it is ~70KB gz for behaviour that is one
   rAF loop and one passive listener. The brief asks for the simplest
   technology that reaches the result and no unnecessary heavy libraries.

   PERFORMANCE MODEL
   -----------------
   - One passive scroll listener, one resize listener, one rAF loop.
   - Geometry (offsetTop/height) is cached and only recomputed on resize
     or after fonts load, so the per-frame path never reads layout —
     no interleaved read/write, no forced synchronous reflow.
   - The loop early-exits when nothing changed.
   - Only transform/opacity/custom properties are written.
   =========================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var scenes = [];
  var ticking = false;
  var lastY = -1;

  function measure() {
    scenes = [];
    var els = document.querySelectorAll("[data-scene]");
    Array.prototype.forEach.call(els, function (el) {
      var rect = el.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var h = rect.height;

      // How the scroll range is defined, per scene mode:
      //   "cover"  progress runs from the element's top reaching the
      //            bottom of the viewport, to its bottom reaching the top.
      //            Good for things that should animate as they pass by.
      //   "pin"    progress runs across the element's own height minus one
      //            viewport, which is exactly the distance a sticky child
      //            stays pinned. Good for pinned storytelling.
      //   "enter"  progress runs from the element entering to it being
      //            one third up the screen. Good for entrances.
      var mode = el.getAttribute("data-scene") || "cover";
      var vh = window.innerHeight;
      var start, end;

      if (mode === "pin") {
        start = top;
        end = top + Math.max(h - vh, 1);
      } else if (mode === "exit") {
        // For a scene that already occupies the first screen: progress
        // begins at rest and runs as the visitor scrolls it away. Using
        // "cover" here would start the hero mid-animation on load.
        start = top;
        end = top + h;
      } else if (mode === "enter") {
        start = top - vh;
        end = top - vh * 0.34;
      } else {
        start = top - vh;
        end = top + h;
      }

      // Sliced children: elements that consume a sub-range of the scene's
      // own progress, e.g. data-slice="0.24,0.58". The arithmetic lives
      // here rather than in CSS because a clamp()/calc() chain assigned
      // to a custom property is stored as unevaluated tokens — --d never
      // resolves, var(--d, 0) silently falls back to 0, and the whole
      // animation sits at frame zero with no error anywhere. Writing a
      // plain number from JS is unambiguous and always valid.
      var slices = [];
      Array.prototype.forEach.call(el.querySelectorAll("[data-slice]"), function (c) {
        var parts = (c.getAttribute("data-slice") || "0,1").split(",").map(parseFloat);
        // Two numbers  -> a ramp: 0 at `a`, 1 from `b` onward.
        // Four numbers -> a trapezoid: in over a..b, hold b..c, out over
        // c..d. Captions over a continuous film need the exit as much as
        // the entrance, otherwise every line that has ever appeared is
        // still sitting on screen at the end of the sequence.
        if (parts.length >= 4) {
          slices.push({ el: c, trap: parts.slice(0, 4), last: -1 });
        } else {
          var a = parts[0] || 0;
          var bb = isNaN(parts[1]) ? 1 : parts[1];
          slices.push({ el: c, a: a, span: Math.max(bb - a, 0.0001), last: -1 });
        }
      });

      scenes.push({ el: el, start: start, end: Math.max(end, start + 1), last: -1, slices: slices });
    });
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function apply() {
    ticking = false;
    var y = window.scrollY;
    if (y === lastY) return;
    lastY = y;

    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var p = clamp01((y - s.start) / (s.end - s.start));
      // Skip writes when the value hasn't moved enough to be visible.
      // Cheap, and it keeps long static stretches free of style work.
      if (Math.abs(p - s.last) < 0.0006) continue;
      s.last = p;
      s.el.style.setProperty("--p", p.toFixed(4));

      for (var j = 0; j < s.slices.length; j++) {
        var c = s.slices[j], sp;
        if (c.trap) {
          var t = c.trap;
          sp = p < t[1] ? clamp01((p - t[0]) / Math.max(t[1] - t[0], 1e-4))
             : p <= t[2] ? 1
             : 1 - clamp01((p - t[2]) / Math.max(t[3] - t[2], 1e-4));
          sp = clamp01(sp);
        } else {
          sp = clamp01((p - c.a) / c.span);
        }
        if (Math.abs(sp - c.last) < 0.0006) continue;
        c.last = sp;
        c.el.style.setProperty("--s", sp.toFixed(4));
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  }

  function start() {
    measure();
    lastY = -1;
    apply();
  }

  /* ---------------------------------------------------- step rail

     The pinned tour needs to know which step is active so the phone can
     change screens and the rail can highlight. Rather than a second
     observer, it's derived from the same scene progress: the pinned
     scene's progress is sliced into N equal bands.                      */

  function wireStepper(scene) {
    var steps = scene.querySelectorAll("[data-step]");
    var frames = scene.querySelectorAll("[data-frame]");
    var pips = scene.querySelectorAll("[data-pip]");
    var n = frames.length;
    if (!n) return null;
    var current = -1;

    return function (p) {
      // Bias slightly so the first screen holds a touch longer than a
      // strict 1/n slice; entering a sequence mid-transition feels broken.
      var idx = Math.min(n - 1, Math.floor(p * n * 0.999));
      if (idx === current) return;
      current = idx;
      for (var i = 0; i < n; i++) {
        frames[i].classList.toggle("is-live", i === idx);
        // Screens already visited sit behind the live one rather than in
        // front of it, so the dissolve has a consistent direction of
        // travel instead of flickering both ways.
        frames[i].classList.toggle("is-past", i < idx);
        if (pips[i]) pips[i].classList.toggle("is-live", i === idx);
        if (steps[i]) steps[i].classList.toggle("is-live", i === idx);
      }
      scene.setAttribute("data-active", idx);
    };
  }

  /* ---------------------------------------------------- boot */

  function init() {
    // Reduced motion: publish the finished state once and never animate.
    // Everything the visitor needs is present, it simply doesn't move.
    if (reduced.matches) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-scene]"), function (el) {
        el.style.setProperty("--p", "1");
        el.setAttribute("data-static", "");
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-slice]"), function (el) {
        el.style.setProperty("--s", "1");
      });
      var tour = document.querySelector('[data-scene="pin"]');
      if (tour) {
        var f = tour.querySelectorAll("[data-frame]");
        var pp = tour.querySelectorAll("[data-pip]");
        if (f[0]) f[0].classList.add("is-live");
        if (pp[0]) pp[0].classList.add("is-live");
        Array.prototype.forEach.call(tour.querySelectorAll("[data-step]"), function (s) {
          s.classList.add("is-live");
        });
      }
      document.documentElement.classList.add("no-motion");
      return;
    }

    var tourScene = document.querySelector('[data-scene="pin"]');
    var stepper = tourScene ? wireStepper(tourScene) : null;

    if (stepper) {
      // Hook the stepper into the same rAF pass rather than its own.
      var baseApply = apply;
      apply = function () {
        baseApply();
        for (var i = 0; i < scenes.length; i++) {
          if (scenes[i].el === tourScene) { stepper(scenes[i].last); break; }
        }
      };
    }

    start();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      // Geometry only; cheap enough at resize frequency.
      measure(); lastY = -1; apply();
    }, { passive: true });

    // Web fonts land after first paint and change heights, which would
    // leave every cached offset slightly wrong for the rest of the visit.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); lastY = -1; apply(); });
    }
    window.addEventListener("load", function () { measure(); lastY = -1; apply(); });
  }

  /* ---------------------------------------------------- boot the UI

     The hero interface assembles itself once, on load. It is started
     from JS rather than autoplaying from CSS so it can't burn its
     animation while the page is still below the fold on a deep link,
     and so reduced-motion visitors simply get the finished screen.     */

  function bootUI() {
    var ui = document.querySelector("[data-boot]");
    if (!ui) return;
    if (reduced.matches) { ui.classList.remove("ui-boot"); return; }
    // Two frames: one for the initial style to commit, one to start.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ui.classList.add("go"); });
    });
  }

  /* ---------------------------------------------------- magnetic buttons

     A few pixels of lean toward the cursor. Deliberately tiny: the point
     is that the control feels physical, not that it performs. Bound per
     button on enter and torn down on leave, so there is no global
     mousemove listener running for the life of the page.                 */

  function magnets() {
    if (reduced.matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    Array.prototype.forEach.call(document.querySelectorAll(".btn"), function (btn) {
      var raf = 0;
      function move(e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = btn.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
          var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
          // capped hard: past ~7px it stops reading as physics and starts
          // reading as the button running away from the pointer
          btn.style.setProperty("--mx", (Math.max(-1, Math.min(1, dx)) * 6).toFixed(1) + "px");
          btn.style.setProperty("--my", (Math.max(-1, Math.min(1, dy)) * 4).toFixed(1) + "px");
        });
      }
      btn.addEventListener("mouseenter", function () {
        btn.classList.add("is-mag");
        btn.addEventListener("mousemove", move);
      });
      btn.addEventListener("mouseleave", function () {
        btn.removeEventListener("mousemove", move);
        btn.classList.remove("is-mag");
        btn.style.removeProperty("--mx");
        btn.style.removeProperty("--my");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); bootUI(); magnets(); });
  } else {
    init(); bootUI(); magnets();
  }
})();
