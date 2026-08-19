/* ===========================================================
   hearthlyapps — site behaviour, v3
   2026-08-19.

   Replaces v2's GSAP + ScrollTrigger + Three.js stack (roughly 700KB of
   CDN JavaScript plus a 1,500-line WebGL scene) with ~80 lines of vanilla
   JS and no dependencies at all. Everything here is either a scroll
   reveal or the sticky product rail; nothing animates for decoration.

   Both features are progressive enhancements: with JS disabled or
   IntersectionObserver unavailable, every reveal is forced visible and
   the rail falls back to showing its first screen, so the page still
   reads completely.
   =========================================================== */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------- scroll reveal */

  var reveals = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || reduced) {
    // No observer, or the visitor asked for no motion: show everything now.
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add("in"); });
  } else {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        // Stagger siblings slightly so a row of items arrives as a phrase
        // rather than all at once. Capped so nothing ever feels slow.
        var i = Number(e.target.getAttribute("data-i") || 0);
        e.target.style.transitionDelay = Math.min(i, 4) * 70 + "ms";
        e.target.classList.add("in");
        revealObs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    Array.prototype.forEach.call(reveals, function (el, i) {
      // index within the immediate parent, for the stagger above
      var sibs = el.parentNode ? el.parentNode.querySelectorAll(":scope > .reveal") : [];
      el.setAttribute("data-i", Array.prototype.indexOf.call(sibs, el));
      revealObs.observe(el);
    });
  }

  /* ---------------------------------------------------- sticky rail

     The product tour: copy steps scroll past a pinned phone, and the
     phone swaps to the screenshot belonging to whichever step is
     currently centred. Desktop only — below 940px the steps carry their
     own inline screenshot instead (see .step-shot in the CSS), because
     pinning inside a short viewport strands the reader.                  */

  var rail = document.querySelector("[data-rail]");
  if (rail) {
    var frames = rail.querySelectorAll("[data-frame]");
    var steps  = document.querySelectorAll("[data-step]");

    var show = function (idx) {
      Array.prototype.forEach.call(frames, function (f, i) {
        f.classList.toggle("is-live", i === idx);
      });
    };
    show(0);

    if ("IntersectionObserver" in window && steps.length) {
      var stepObs = new IntersectionObserver(function (entries) {
        // Pick the entry closest to the middle of the viewport, so fast
        // scrolling can't leave the phone on a step that's already gone.
        var best = null, bestDist = Infinity;
        var mid = window.innerHeight / 2;
        Array.prototype.forEach.call(steps, function (s) {
          var r = s.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return;
          var d = Math.abs(r.top + r.height / 2 - mid);
          if (d < bestDist) { bestDist = d; best = s; }
        });
        if (best) show(Number(best.getAttribute("data-step")));
      }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" });

      Array.prototype.forEach.call(steps, function (s) { stepObs.observe(s); });
    }
  }

  /* ---------------------------------------------------- figure

     The divergence figure draws each line on with stroke-dashoffset. The
     dash length has to equal the path's own length or the stroke either
     finishes early or never arrives, so it's measured from the geometry
     rather than hard-coded to a guess that breaks the moment a curve is
     nudged. Purely additive: if this never runs, the CSS fallback length
     still reveals the lines.                                             */

  var figs = document.querySelectorAll("[data-figure] .fig-line");
  Array.prototype.forEach.call(figs, function (path) {
    try {
      var len = Math.ceil(path.getTotalLength());
      if (len && isFinite(len)) path.style.setProperty("--len", len);
    } catch (e) { /* getTotalLength unsupported: CSS fallback covers it */ }
  });

  /* The authored viewBox reserves ~180px on the right for the direct
     labels. Those labels are hidden below 760px (the HTML legend takes
     over), so on a phone that reservation is just dead margin making an
     already-wide 880x360 drawing shorter than it needs to be. Cropping it
     buys back about 20% of drawing height for free. */
  var figSvg = document.querySelector("[data-figure] svg");
  if (figSvg) {
    var narrow = window.matchMedia("(max-width: 759px)");
    var fitViewBox = function (mq) {
      figSvg.setAttribute("viewBox", mq.matches ? "0 0 720 350" : "0 0 880 360");
    };
    fitViewBox(narrow);
    if (narrow.addEventListener) narrow.addEventListener("change", fitViewBox);
    else if (narrow.addListener) narrow.addListener(fitViewBox);
  }

  /* ---------------------------------------------------- current year */

  var y = document.querySelectorAll("[data-year]");
  Array.prototype.forEach.call(y, function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
