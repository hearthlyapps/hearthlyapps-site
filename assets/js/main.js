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

  /* ---------------------------------------------------- current year */

  var y = document.querySelectorAll("[data-year]");
  Array.prototype.forEach.call(y, function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
