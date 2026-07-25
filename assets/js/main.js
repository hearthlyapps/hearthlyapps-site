/* ===========================================================
   hearthlyapps — DOM/CSS animations (nav, hero, scroll-reveal)
   GSAP + ScrollTrigger, loaded from cdnjs on each page. The phone, the five
   3D objects, and the animated background used to be driven from here too
   (a DOM/CSS phone-frame + inline SVG icons); that's all moved to
   assets/js/scene.js's persistent Three.js world now, so this file only
   handles plain 2D page chrome — the nav's frosted-on-scroll state, the
   hero's entrance animation, and generic reveal-on-scroll for the
   non-pinned sections (feature grid, pricing, etc).

   Important: every entrance/reveal animation below uses gsap.from(), not
   gsap.to(). CSS never hides this content by default (see style.css) — the
   hidden starting point is only ever applied here, in JS, right before
   animating it away. If these CDN scripts fail to load, are blocked, or
   load slowly, the page simply renders normally with no entrance animation
   instead of staying invisible.
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Nav: transparent at top, frosted once scrolled ----------
     Plain scroll listener, no GSAP dependency — always works. */
  const navs = document.querySelectorAll(".nav");
  const setNavState = () => {
    const solid = window.scrollY > 32;
    navs.forEach((n) => n.classList.toggle("is-solid", solid));
  };
  setNavState();
  window.addEventListener("scroll", setNavState, { passive: true });

  /* Everything below needs GSAP + ScrollTrigger. If the CDN scripts didn't
     load, skip straight out — content is already visible by default (see
     style.css), so this is a silent, harmless no-op, not a blank page. */
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    console.warn("hearthlyapps: GSAP failed to load — scroll animations skipped, content still visible.");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Hero entrance ---------- */
  const hero = document.querySelector(".hero");
  if (hero) {
    const eyebrow = hero.querySelector(".eyebrow");
    const h1 = hero.querySelector("h1");
    const lede = hero.querySelector("p.lede");
    const btnRow = hero.querySelector(".btn-row");
    const tl = gsap.timeline({ delay: 0.2 });
    if (eyebrow) tl.from(eyebrow, { opacity: 0, y: 14, duration: 0.7, ease: "power3.out" });
    if (h1) tl.from(h1, { opacity: 0, y: 24, duration: 0.9, ease: "power3.out" }, "-=0.5");
    if (lede) tl.from(lede, { opacity: 0, y: 24, duration: 0.8, ease: "power3.out" }, "-=0.6");
    if (btnRow) tl.from(btnRow, { opacity: 0, y: 24, duration: 0.8, ease: "power3.out" }, "-=0.6");
  }

  /* ---------- Generic reveal-on-scroll for non-pinned sections ---------- */
  gsap.utils.toArray(".reveal").forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      y: 32,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
      },
      delay: (i % 3) * 0.06,
    });
  });

  ScrollTrigger.refresh();
});
