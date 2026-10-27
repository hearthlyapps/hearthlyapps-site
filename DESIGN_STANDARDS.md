# Design standards — things this site deliberately avoids, and why

This is a standing checklist, not a one-time audit. It exists because a viral
"30 signs your site was AI-vibecoded" list made the rounds and the owner
wanted the site checked against it (2026-09-27 pass). Most of it was already
true by design — the v3 rewrite documented at the top of `assets/css/style.css`
independently arrived at most of the same list while fixing a different
problem (the old dark "another universe" theme reading as generic). Keep this
file current: if a future edit reintroduces one of these, that's a regression,
not a style nitpick.

Read `PROJECT_HANDOFF.md` first for the full engineering history. This file
is narrower on purpose: it's the "don't reintroduce the generic-AI-SaaS look"
brief, nothing else.

## The checklist, item by item

1. **Harsh gradients** — Avoided. The only gradients in the sheet are a soft
   radial "floor halo" under the phone (`style.css` `.device-halo::before`)
   and a vignette under the film captions (`.film-stage::after`) — both
   functional (grounding a device, guaranteeing caption contrast), low-alpha,
   and never a loud hero-background gradient mesh.
2. **Lucide icons** — Not used. The only icon-like marks are the hand-drawn
   `.spark` SVG (the brand's own proprietary mark, derived from the site's
   "two lines" figure) and a literal Apple-logo SVG on App Store buttons.
   No generic icon library anywhere in the codebase.
3. **Pure white background** — Avoided. `--paper: #f7f4ef` — a warm
   off-white, chosen explicitly ("paper, not screen") — is the base
   throughout; `--card: #fffdfa` for card surfaces is likewise never `#fff`.
4. **Rainbow coloring** — Avoided. Three colors total: teal (the app's real
   accent, sampled from its own screenshots), ember/terracotta (the "hearth"
   note, used sparingly), and warm paper/ink neutrals.
5. **Drop shadows** — Used, but tuned and sparse, not the generic
   `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` default: see `.device`'s
   three-layer shadow stack and `.price--best`'s single soft shadow. Both are
   named, low-opacity, and tied to a real elevation (a physical device, a
   highlighted card), not decoration on every box.
6. **3 feature cards in a row** — Explicitly avoided. The homepage's "How we
   build" section is a numbered full-width editorial list, not a 3-up card
   grid (see the HTML comment at `index.html`'s rules section: "deliberately
   not three identical cards in a row"). `/sustain`'s differentiation section
   uses a row-based comparison table instead of a feature-card wall (see the
   CSS comment above `.compare`: "Replaces the 'why us' feature-card wall").
7. **Emojis** — None in any HTML file. Checked and confirmed empty across the
   whole site.
8. **Liquid glass / frosted glassmorphism** — Removed as of the v3 rewrite.
   The one remaining `backdrop-filter` (`.ui-tabs`) is inside the hero's
   pixel-accurate recreation of the real iOS tab bar, which itself uses this
   effect — that's reproducing the actual product's UI, not decorating the
   marketing page with a trend.
9. **Em dashes in copy text** — Avoided in body prose. (Title-tag separators
   like "Sustain — the GLP-1 companion..." and section-label dashes like
   "01 — Today" are typographic devices, not the AI-essay em-dash habit, and
   are left as-is.) Two mid-sentence body em dashes were found and fixed in
   `privacy/index.html` (the lab-import and progress-photos paragraphs) —
   replaced with a colon and a semicolon respectively, matching this
   project's established no-em-dash convention for actual sentences.
10. **Inter / Geist / Space Grotesk overused defaults** — Avoided. The stack
    is Fraunces (serif display, with custom `font-variation-settings: "SOFT"
    30, "WONK" 1` so it doesn't read as a stock serif), Instrument Sans, and
    IBM Plex Mono for eyebrow/mono labels — three typefaces with distinct,
    documented jobs, not one default sans dropped in unmodified.
11. **Colored left stripe on cards** — The one left-border accent (`.note`,
    a 2px teal rule on the privacy/FAQ callout box) is a single deliberate
    "note" callout, not a decorative treatment applied to every card.
12. **Fake testimonials** — None exist. This is called out explicitly in the
    HTML itself (`sustain/index.html`, Scene 5 comment): "No testimonials, no
    download counts, no star ratings: the app is new and inventing social
    proof would be the fastest way to lose the trust this section exists to
    build." Keep it that way — do not add invented quotes later. If real
    App Store reviews or user quotes ever become available, they can be
    added with attribution; nothing should be fabricated to fill the gap.
13. **Bento grids** — Not used anywhere.
14. **Decorative fake terminal window** — Not used anywhere.
15. **"It's not X, it's Y" copy pattern** — Avoided as a rhetorical device.
    Copy makes concrete, checkable claims ("Manual logging is free forever,"
    "Body fat and lean mass tracked separately") rather than vague
    inflationary contrasts ("it's not a tracker, it's a movement").
16. **Checkmark bullets (✓ lists)** — Pricing list items use a small teal
    dash (`.price li::before`, a 9×2px line) instead of a checkmark glyph —
    a deliberate, quieter alternative to the generic ✓-list look.
17. **3 pricing tiers** — Present, but real: Sustain+ annual, Sustain+
    monthly, and a one-time Maintenance program are three genuinely different
    products/billing terms, not three arbitrary price points invented to
    look complete. Don't collapse or pad this just to dodge the meme —
    it's legitimate.
18. **No real product demos** — Avoided. The site uses actual app
    screenshots (`assets/img/screenshots/`) and a real rendered film sequence
    scrubbed against scroll (`assets/film/`, `assets/js/film.js`) built from
    the product's own visual system. No screenshots should ever be invented
    to fill a gap — if a future feature needs a demo and no real capture
    exists yet, flag it rather than mocking one up.
19. **Soft, overly-generic corner radius everywhere** — Avoided by design.
    Three distinct radius tokens are used semantically, not interchangeably:
    `--r-panel: 4px` (near-square, editorial), `--r-control: 999px` (fully
    round, for pills/buttons), `--r-device: 34px` (device-shaped, only on
    the phone frame). Never one radius value applied to every box.
20. **Purple and black AI-startup scheme** — Explicitly rejected. The CSS's
    own top-of-file comment documents that the *previous* version of this
    site (v2, a dark "another universe" theme) used exactly this and was
    identified as looking AI-generated; v3 replaced it with paper/ink/teal/
    ember specifically because of that.
21. **No skeleton loaders** — Not applicable / not a real gap. This is a
    static marketing site with no async data fetching — there is nothing to
    skeleton-load. Do not add fake loading skeletons just to check this box;
    that would be busywork with no user benefit.
22. **Radial orbs (decorative blurred circles)** — The two radial-gradients
    in the sheet are functional (a device grounding shadow, a caption
    legibility vignette), not free-floating decorative orbs scattered across
    a hero. Don't add ambient blurred-circle decoration elsewhere.
23. **Dot grids (decorative background pattern)** — Not used anywhere.
24. **Sparkle icons (✨)** — Not used anywhere.
25. **Animated arrows** — Not used. The comparison table uses a static "→ "
    text glyph as a row prefix (`.compare-a--us::before`), not an animated
    bouncing/sliding arrow.
26. **No Terms of Service** — Genuinely true, and worth a real decision by
    the site owner rather than a fabricated fix (see report below — legal
    text shouldn't be auto-generated). Not addressed in this pass.
27. **No Privacy Policy** — False on this site: `/privacy/` exists and is a
    substantive, specific, regularly-updated document describing Sustain's
    actual data practices (account data, HealthKit sync, exactly which AI
    features send exactly which data to which provider, TelemetryDeck
    handling, deletion rights). Keep it that way: every time a data practice
    changes in the app, update this page in the same session, not "someday."
28. **Generic/cheap hover animations** — Out of scope for this pass (a prior
    session already did a full motion/hover audit against Emil Kowalski's
    design-engineering philosophy — hover states gated to
    `@media (hover: hover) and (pointer: fine)`, press feedback via
    `:active`, no layout-triggering transitions). See git history for that
    work; this document doesn't re-litigate it.
29. **Neon colors** — Avoided. Teal (`#1b7d69`/`#2fb89f`) and terracotta
    (`#c4522f`) are both desaturated relative to true neon; contrast values
    are tuned against WCAG targets, not maximized for punch.
30. **Basic pastel colors** — Avoided. `--teal-wash`/`--ember-soft` are the
    only pastel-adjacent tones and are used narrowly as tinted backgrounds
    behind teal/ember content (a chip, a callout), not as a primary palette.

## 2026-10-26: /sustain/ rebuilt as a page-scrub film

`/sustain/` now plays a 144-frame rendered film on a fixed full-viewport
canvas behind the whole page (layout reference: Kombai's "Apsis Aerospace"
page-scrub study). Files: `assets/css/scrub.css`, `assets/js/scrub.js`,
`assets/scrub/{land,port}/f_NNN.webp` (render source on the project drive
at `marketing/v3_build/scrub_render/`). How it squares with the list above:

- Item 18 (real product demos): every phone screen in the film is a real
  screenshot from `assets/img/screenshots/`. The old `assets/film/`
  sequence and `assets/js/film.js` are no longer referenced by any page.
  Note: several old `assets/film/` frames show the Today screen's
  unedited dose card with a drug brand name; they should be deleted from
  the repo, not just unlinked, since GitHub Pages still serves them.
- Item 20 (purple/black): the page is dark, but it's this system's own
  ink (#0b1312 / #14201e) with teal and ember. The reference's
  near-black + neon orange and the film's old violet/magenta nebula were
  both left out; the render's background shader was recoloured to ink,
  teal and ember.
- Item 10 (fonts): the reference's Space Grotesk was not adopted;
  Fraunces / Instrument Sans / IBM Plex Mono unchanged.
- Items 1 and 22 (gradients/orbs): the only gradients added are section
  scrims (directional falloffs that keep copy legible over the film) and
  the canvas's side-band fade on ultrawide screens. Both are functional.
- Item 8 (glass): the HUD bar and panels are solid translucent ink with
  no `backdrop-filter`.
- Item 23 (grids): the reference's 64px background grid was not added.
- Item 12 (fake proof): the HUD telemetry reads only off the film itself
  (chapter, which app screen is showing, frame, timecode). Nothing on it
  is presented as user data or as a health number.

## Findings from the 2026-09-27 pass that were NOT auto-fixed

- **No Terms of Service page.** Real gap, but writing one requires legal
  judgment (subscription terms, arbitration, liability limits for a health
  app) that shouldn't be auto-generated. Recommend the owner have one drafted
  (a lawyer, or at minimum Apple's standard EULA referenced explicitly) and
  linked from both footers, next to the existing Privacy link.
- Three pricing tiers and the film/screenshot product demos were confirmed
  genuine (not meme-list violations) and intentionally left as-is — see
  items 17 and 18 above.
