# hearthlyapps.com

Static marketing site for hearthlyapps and its first product, Sustain. No build step —
plain HTML/CSS/JS, GSAP + Three.js loaded from CDN.

**Read `PROJECT_HANDOFF.md` in this same directory before making any changes.** It's a
full, lossless engineering record of how this site was built, every design decision and
bug fix, and everything still open (most importantly: the current 3D build has not yet been
verified in a real browser, and the site is not yet deployed — both explained in detail
there).

Quick orientation:

- `index.html` — homepage
- `sustain/index.html` — Sustain product page
- `privacy/`, `support/` — pre-existing static pages, unrelated to this build
- `assets/css/style.css` — shared design system ("another universe" dark/glass theme)
- `assets/js/main.js` — 2D DOM chrome (nav, hero entrance, scroll-reveal fades)
- `assets/js/scene.js` — the persistent Three.js 3D world (spinning phone, 5 objects,
  animated shader background) — this is the heart of the site's interactivity
- `CNAME` — GitHub Pages custom domain file (`hearthlyapps.com`)

Sibling project: `../Sustain/` is the actual iOS app this site markets — a separate
Swift/SwiftUI codebase with its own `PROJECT_HANDOFF.md`.
