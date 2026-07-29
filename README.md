# hearthlyapps.com

**Status as of 2026-07-29: live** at hearthlyapps.com via GitHub Pages
(`github.com/hearthlyapps/hearthlyapps-site`), verified through several rounds of
real-iPhone visual review. Both pages now link directly to Sustain's real App Store
listing (`apps.apple.com/us/app/sustain-glp-1-companion/id6793802192`) — the pre-launch
"Notify me at launch" waitlist forms have been removed now that the app has shipped.

Static marketing site for hearthlyapps and its first product, Sustain. No build step —
plain HTML/CSS/JS, GSAP + Three.js loaded from CDN.

**Read `PROJECT_HANDOFF.md` in this same directory before making any changes.** It's a
full, lossless engineering record of how this site was built, every design decision and
bug fix, and everything still open. Its §8/§9 sections were written before deployment and
real-device verification happened — both have since been corrected in place with dated
update notes rather than rewritten, so read the update notes at the top of each rather
than trusting the original prose below them at face value.

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
Swift/SwiftUI codebase with its own handoff document at
`../Sustain/Documentation/PROJECT_HANDOFF.md`.
