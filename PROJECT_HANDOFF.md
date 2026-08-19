# hearthlyapps.com — Website Engineering Handoff / Project Memory Dump

## 0. COMPLIANCE — read before touching any screenshot, phone mockup, or app UI content

**Never show a specific prescription drug brand name anywhere on this site** (Wegovy,
Ozempic, Mounjaro, Zepbound, Tirzepatide, Semaglutide, or any other GLP-1 brand/generic
name), in any screenshot, live-rendered UI mockup, image, or piece of copy that depicts
or implies the product's own on-screen content. This is not a style preference — it's the
same rule the sibling `Sustain/marketing/` video project enforces (see that project's
`marketing/LESSONS_LEARNED.md`), established after real TikTok Community Guidelines
strikes caused by drug brand names visible in marketing video frames.

**Real incident, 2026-08-19:** the `/sustain` hero (§5's live-rendered `.ui` component,
not a screenshot — see `sustain/index.html`'s dose card) had "Wegovy" and "1.7 mg" typed
directly into the markup as literal, fully legible text, live on the site, for some
unknown period before being caught by Dhanvanth looking at the page directly. This
happened because the hero was hand-built from a real screenshot's visible content without
checking it against the drug-brand-name rule that every other part of this project
already enforces. Fixed by replacing "Wegovy" with the generic "GLP-1 dose" label —
same dose amount, date, and button all preserved, just no specific brand identified.

**Rule going forward, structural not just remembered:** before shipping any change to
`sustain/index.html`'s hero `.ui` block (or any future live UI mockup, screenshot crop,
or video-style asset embedded in this site), grep the actual rendered page text for
`Wegovy|Ozempic|Mounjaro|Zepbound|Tirzepatide|Semaglutide` (case-insensitive) and confirm
zero matches before calling it done — don't just eyeball it. The one exception:
`/sustain/faq/index.html`'s AEO content, which factually discusses these drug names in
question-and-answer form ("Does Ozempic, Wegovy, Mounjaro, or Zepbound cause muscle
loss?") — that's legitimate informational/SEO content, not a product mockup depicting
the app's own screen, and is fine to keep as-is.

**Purpose of this document:** a lossless knowledge transfer from the Claude conversation
that designed and built this website, written for an AI (or human) who will continue
development with zero access to that conversation. It captures what was built, why, every
rejected alternative, every bug found and fixed (with root cause), and everything still
open. Treat it as this project's permanent engineering journal, not a summary.

**Sibling project:** this repo root (`Claude Idea/`) also contains `Sustain/`, a separate
native iOS app (Swift/SwiftUI) that hearthlyapps' first product page (`/sustain`) markets.
That project has its own much larger handoff document at `../Sustain/Documentation/PROJECT_HANDOFF.md`
— read it if you need to understand Sustain-the-app itself (features, architecture,
pricing, App Store submission status). This document only covers the **website**, which is
a completely separate static HTML/CSS/JS codebase with no build step and no shared code
with the Swift app. The website's copy and screenshots are *sourced from* the app, but
nothing here requires touching Swift code, and nothing in the Swift app requires touching
this site.

---

## 1. What this is

A marketing website for **hearthlyapps** (the indie studio/brand) and its first product,
**Sustain**, deliberately built to feel like a premium Apple product page: full-bleed
scroll-driven animation, not a typical scroll-and-read brochure site. Two live pages today:

- `/` — hearthlyapps homepage (brand-level: philosophy, Sustain teaser, "what's next" teaser
  for future apps)
- `/sustain/` — full Sustain product page (features, pricing, App Store CTA)

Plus two pre-existing static pages that were **not** touched in the original build and
were, for a long time, left alone: `/privacy/` and `/support/` (both simple, non-animated
HTML — see `privacy/index.html`, `support/index.html`). **`/privacy/` is no longer
untouched** — it's been updated in place each time Sustain's actual data practices
changed (Google sign-in added 2026-08-01, lab result import disclosed 2026-08-06, commit
`50d206f`/`50d256f` — see `../Sustain/Documentation/CHANGELOG.md`'s corresponding entries
for what changed and why), and should keep being treated as a living document tied to the
app's real behavior, not a fixed pre-existing page.

Domain: **hearthlyapps.com** (see `CNAME` at repo root — GitHub Pages custom domain file,
containing exactly `hearthlyapps.com`), served via **GitHub Pages**. **[UPDATED
2026-07-29, corrects the paragraph below]**: `site/` now has a real git repo,
`git remote -v` shows `origin https://github.com/hearthlyapps/hearthlyapps-site.git`,
and the site is live and has been deployed for some time — the "currently has no `.git`
directory" claim right below is stale, kept only for the historical note about what
state this was in when first built.

Original note, now historical: at the time this document was first written, `site/`
had no `.git` directory of its own — confirmed via `find`/`ls`. Nothing in that session
initialized git or pushed anything live; the homepage and `/sustain` rebuild existed only
on the local filesystem as of that handoff. Deploying it was flagged as an explicit open
task — see §8/§9, both since resolved.

## 2. Origin / why this was built

The user's own words, kicking this off: *"I want to make full use of my domain and create
a beautiful front page for hearthlyapps... The website should heavily give Apple website
vibes, with the smooth transitions when scrolling... phones should zoom in and out, similar
to how Apple does it... there should be hearthlyapps.com/sustain, which goes to a site
fully dedicated to Sustain."* They linked a YouTube video (an interactive/scroll-driven
site) as inspiration and said explicitly: *"This should give you full inspiration on how
interactive the websites should be."* (The video wasn't transcribed/watched in detail in
this session — its role was as a reference point for "how interactive should this feel,"
not a literal spec.)

Two rounds of user feedback, both fully implemented, materially reshaped the architecture
— see §5 for the second, larger one, which is the current state of the codebase.

## 3. File structure

```
site/
├── CNAME                          — "hearthlyapps.com", GitHub Pages custom domain file
├── index.html                     — homepage
├── sustain/index.html             — Sustain product page
├── privacy/index.html             — pre-existing, untouched this session
├── support/index.html             — pre-existing, untouched this session
└── assets/
    ├── css/style.css              — single shared stylesheet, all pages
    ├── js/
    │   ├── main.js                — 2D DOM chrome only (nav, hero entrance, .reveal fades)
    │   └── scene.js                — the persistent Three.js 3D world (see §6)
    └── img/
        ├── app-icon.png            — Sustain app icon, used in both pages' nav/footer
        ├── leaf-mark.svg           — orphaned/unused decorative asset, see §7
        └── screenshots/
            ├── 01-dashboard.png
            ├── 02-paywall.png      — NOT currently referenced by either page
            ├── 03-trends.png
            ├── 04-protein.png
            ├── 05-sideeffect.png
            └── 06-maintenance.png
```

All six screenshots are real Sustain app screenshots, resized via ImageMagick
(`convert -resize 700x -strip -quality 85`) earlier in the project for web use. Five of the
six (`01`, `03`, `04`, `05`, `06`) are wired into the `/sustain` reel; the homepage reel
uses three of those five (`01`, `04`, `03`). `02-paywall.png` exists on disk but is not
referenced anywhere — available if a future pricing-focused animation step is added.

**[STALENESS FLAG, 2026-08-01]**: these six screenshots predate Sustain's mandatory
account/sign-in gate, specific-days-of-week dose scheduling UI, and the new branded
camera viewfinder (all shipped in v2.0). They still work visually as generic app
screenshots, but if any future update wants the reel to reflect current UI exactly, these
should be recaptured against a build running v2.0 or later — unconfirmed without a
side-by-side visual diff, flagged here as an open item rather than fixed silently.

No build tooling, no `package.json`, no bundler. Pure static files, GSAP/ScrollTrigger and
Three.js both loaded directly from CDN (`cdnjs.cloudflare.com` and `cdn.jsdelivr.net`
respectively) via `<script>` tags — this means **the site requires a live internet
connection to render correctly**; there's no vendored/offline fallback for either library.

## 4. Design system (`assets/css/style.css`, ~605 lines)

Central `:root` custom properties (the "another universe" cosmic/glass theme, current as
of this handoff — see §5 for what it replaced):

```css
--teal: #2fb89f;
--teal-dark: #1a7364;
--teal-glow: rgba(47, 184, 159, 0.35);
--ink: #f3f4f8;                              /* near-white; theme is dark-mode-only now */
--ink-soft: rgba(243, 244, 248, 0.68);
--ink-faint: rgba(243, 244, 248, 0.45);
--glass-bg: rgba(18, 14, 38, 0.46);
--glass-bg-strong: rgba(14, 10, 30, 0.66);
--glass-border: rgba(255, 255, 255, 0.14);
--radius-lg: 28px; --radius-md: 18px;
--font: -apple-system, BlinkMacSystemFont, "SF Pro Display", ... ;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
```

`body` has `background: #0a0715` (deep space) as a fallback — visible for one frame before
WebGL initializes, and as the permanent fallback if WebGL fails entirely, so a canvas
failure degrades to "a bit flatter than intended," never a broken-looking page.

There is **no light/white/dark section system anymore.** The old `.section-light` /
`.section-white` / `.section-dark` classes (and their corresponding opaque background
rules) were fully removed from the CSS and stripped from both HTML files' `<header>`/
`<section>` tags during this session — every section is now visually transparent, letting
`#scene-canvas` (fixed behind everything, `z-index: -1`) show through continuously, which
is required for the "phone/objects flow through the whole page" effect the user asked for.
Cards (`.feature-card`, `.soon-card`, `.price-card`, `footer`) are glassmorphism panels:
`background: var(--glass-bg[-strong])`, `border: 1px solid var(--glass-border)`,
`backdrop-filter: blur(18px) saturate(140%)` (+ `-webkit-` prefix for Safari).

`.price-card` has an explicit `color: var(--ink)` — this is a deliberate fix, not
decoration; see §5's pricing-card bug for why.

`.price-card .amount` is `display: inline-flex; align-items: baseline; gap: 6px;` with a
`.suffix` child class (`font-size: 15px; font-weight: 500; color: var(--ink-soft);`) for
the "/year", "/month", "one-time" text — both HTML files now use `<span class="suffix">`
for this, matching the CSS (see §5).

`.reel-stage` / `.reel-caption`: what's left of the old pinned-reel CSS. `.reel-stage` just
centers `.reel-caption` and is `pointer-events: none` (the phone/objects living inside it
used to be DOM+CSS; they're now WebGL, rendered by `scene.js`, not laid out by this CSS at
all anymore). `.reel-caption [data-step]` are the per-step caption text blocks, shown/hidden
via a JS-toggled `.is-active` class (see §6's `updatePhoneAndObjects`).

`@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }` is the only
reduced-motion accommodation currently implemented — **note this does NOT disable the
Three.js scroll-driven animation or the GSAP scroll reveals**, only CSS smooth-scroll. A
fuller reduced-motion pass (skipping/simplifying the 3D choreography) is not yet done —
worth doing before this ships broadly; see §8.

## 5. Design evolution — two full rebuilds, in order

### 5a. First version (Apple-style, DOM/CSS + GSAP ScrollTrigger)

The original build: light theme, opaque white/dark alternating sections
(`.section-light`/`.section-white`/`.section-dark`), a **DOM** phone mockup
(`.phone-frame` > `.phone-screen` > real `<img>` screenshots swapped via GSAP
ScrollTrigger `pin` + `scrub`), and **inline SVG glyph icons** (hand-drawn pen/plate/scale/
capsule/leaf shapes, not photos) flying in/holding/flying out beside the phone using the
same GSAP ScrollTrigger pinning technique — implemented as one pinned `.reel-track` section
per page (3 steps on the homepage, 5 on `/sustain`), each step advancing the phone's
screenshot and swapping which SVG glyph was visible, all driven by scroll position via
`ScrollTrigger.create({ trigger, pin: true, scrub: true, ... })` inside `main.js` (this
logic has since been deleted from `main.js` — see §5b).

Two real bugs were found and fixed in this version, in order:

1. **Hero invisible until scrolling.** Root cause: hero text elements had CSS
   `opacity: 0` as their *default* state, with the plan being that GSAP would animate them
   to `opacity: 1` on page load. If the GSAP CDN script was slow, blocked, or failed, the
   CSS default won and the text stayed invisible forever — a slow network turned "no
   animation" into "permanently blank page." **Fixed** by removing the CSS `opacity: 0`
   defaults entirely (content is visible by default now, full stop) and switching the JS
   from `gsap.to(el, {opacity: 1, ...})` to `gsap.from(el, {opacity: 0, ...})` — `gsap.from`
   sets the starting (hidden) state itself, in JS, right before animating away from it, so
   if GSAP never runs at all, the CSS-default-visible content just sits there statically
   instead of vanishing. **This defensive pattern — CSS never hides by default, JS only
   ever animates FROM a hidden state it sets itself — was then applied consistently
   everywhere** (hero entrance, `.reveal` fades) and is still true in the current
   `main.js`; preserve it in any future edits.
2. **Caption text overlapping the phone mockup**, confirmed via a user screenshot showing
   "PROTEIN WITHOUT VISIBILITY" caption text rendered directly on top of the phone image.
   Root cause: the caption (`position: absolute; top: 10%`) and the phone (separately
   centered via flexbox) were positioned independently with no layout relationship, so on
   certain viewport heights they simply overlapped. **Fixed** by making both plain flex
   children of a `flex-direction: column` stage container, and switching the phone's height
   from a fixed pixel value to `height: min(560px, 56vh)` (viewport-relative), so the two
   elements' vertical space is always negotiated by flexbox instead of independently
   guessed pixel values.

### 5b. Second, current version — persistent 3D world (the big pivot)

The user's escalation, in two parts (verbatim, since the exact wording matters for judging
whether the implementation actually satisfies it):

First: *"From the start of the page to the end of the page, I want objects (phones,
medical devices, etc.) to be flying in and out of the webpage. It should feel like a smooth
video app tour when scrolling smoothly down the page... First, do research on what objects
to keep on screen for animating when the user scrolls down. For sure, there should be an
animated iPhone with the Sustain app on it, transitioning between the screenshots."*

Response at the time: researched and picked five objects tied to real Sustain features —
**injection pen** (dose tracking), **plate/fork** (protein tracking), **scale** (weight
trend), **capsule** (oral GLP-1 / side effects), **leaf** (brand mark / maintenance/goal-
reached) — and rebuilt the pinned reel as a continuous scroll-driven sequence (still DOM/
CSS + GSAP ScrollTrigger `scrub` at this point, with hand-drawn inline SVG icons), replacing
the earlier isolated per-step zoom sections with one continuous "reel."

Then, after a pricing-card screenshot bug report, a second and much larger escalation
(verbatim, since this is the exact brief `scene.js` was built to satisfy):

> "1. I want the phone to, sort of, spin around the entire webpage to make the page way
> more interactive. This may be able to be done using a 3d rendered iPhone, but you're the
> boss so you can definitely find a way to make this vision come to life. 2. I see that,
> for the objects, you used glyphs instead of images of real-life objects. You need to
> replace the glyphs with real objects. Let me know if you need me to provide you with the
> images of the objects, or if you'll be able to find the objects on your own. 3. Rather
> than a white background, I want a very very unique background, making it look like the
> app is in another universe, with powerful colors to complement the whole website. The
> background should move along with where the mouse is, and/or where the phone is spinning
> around in the website. Use research in professional website design to figure out what
> background(s) should be used, and what images of objects should be used."

A clarifying question was asked about how to source the five "real objects" — three
options were offered: (a) source stock photography, (b) have the user provide photos, or
(c) build genuinely 3D-rendered objects in the same 3D scene as the phone, for guaranteed
consistent lighting/style. **The user chose option (c), explicitly: "Realistic 3D-rendered
objects instead."** This is the reason the current architecture is a single Three.js scene
rather than photography — it was the user's explicit, deliberate choice between three
concretely offered alternatives, not an assumption. If a future session considers swapping
in real photography, that would be reversing this explicit decision, not just a style
tweak — flag it back to the user first.

This rebuild is what's live in the codebase today:
- `style.css` was fully rewritten (not edited) for the dark "cosmic/glass" theme (§4).
- `main.js` was trimmed down to only 2D DOM chrome (nav frosted-on-scroll, hero entrance,
  generic `.reveal` fades) — all phone/object choreography was deleted from it.
- `scene.js` is an entirely new file (~554 lines) implementing the whole persistent 3D
  world. See §6 for full detail.
- Both `index.html` and `sustain/index.html` had their `.phone-frame` DOM markup and inline
  SVG `.reel-object` blocks deleted, replaced with a `<canvas id="scene-canvas">` element
  and `data-screens="[...]"` / `data-objects="[...]"` JSON attributes on each
  `.reel-track` section (read by `scene.js`, not rendered as DOM anymore) — see §6.3.

### 5c. Pricing card bug (found alongside the second escalation, fixed same session)

User screenshot showed the `/sustain` pricing cards' "$59.99", "$7.99", "$19.99" amounts
rendering **invisible** — white text on a white/light card background. Root cause: in the
*first* (light-theme) version of the CSS, `.section-dark` set `color: white` at the section
level, and `.price-card` (which had its own light/white-ish background) never reset that
inherited color — so the bare `$59.99` text node (no explicit color of its own) inherited
white-on-white, while sibling elements with *explicit* inline colors (like the "30-day free
trial" text) stayed visible. **Fixed** two ways: (1) `.price-card` now has an explicit
`color: var(--ink)` so nothing inside it can silently inherit a mismatched color from an
ancestor again, and (2) `.amount`'s bare `<span>` suffix ("/year" etc.) was restructured
into a named `.suffix` class with its own explicit `color: var(--ink-soft)`, and both HTML
files were updated to use `<span class="suffix">` instead of a bare `<span>` — this was
originally left as a known gap after the CSS-only fix landed, and was closed later in this
same overall session (both `index.html`'s reel and `sustain/index.html`'s three price cards
now use the class). Also migrated the price cards' plan-label and trial-note text off
inline `style="..."` attributes onto the CSS's `.plan-label` / `.trial-note` classes, which
already existed in `style.css` but weren't being used by the HTML until this pass.

## 6. The persistent 3D world (`assets/js/scene.js`)

### 6.1 Why one Three.js scene instead of three separate systems

Directly justified by the user's explicit choice in §5b: the phone, the five objects, and
the background all need to share **one lighting rig and one color grade** so they read as
one consistent "universe," which three independent rendering systems (a CSS-transformed
phone div, flat SVG icons, and a CSS gradient background) fundamentally cannot deliver — a
CSS box can't be lit by the same virtual light source as a Three.js mesh. So everything
Three.js-related — background, phone, all five objects — lives in one `THREE.Scene`,
rendered on one `<canvas id="scene-canvas">` that is `position: fixed; inset: 0; z-index:
-1` (see §4), so it never scrolls with the page and sits behind all the glass-panel DOM
content.

### 6.2 Libraries and loading

`three@0.160.0`, loaded as an ES module directly from jsdelivr:
```html
<script type="module" src="assets/js/scene.js"></script>
```
`scene.js` itself does `import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";`
at the top — there is no local/vendored copy, no npm, no bundler. GSAP + ScrollTrigger
(also CDN, cdnjs) are loaded separately and are **only** used by `main.js` for 2D DOM
chrome now — `scene.js` does not use or depend on GSAP at all; all its motion is hand-rolled
per-frame math driven by `window.scrollY` and `requestAnimationFrame`.

### 6.3 What `.reel-track` sections look like now (the HTML/JS contract)

Each `.reel-track` section in the HTML carries two JSON data attributes that `scene.js`
reads on init:

```html
<section class="reel-track" style="--steps: 3;"
  data-screens='["assets/img/screenshots/01-dashboard.png", "...", "..."]'
  data-objects='["pen", "plate", "scale"]'>
  <div class="reel-stage">
    <div class="reel-caption">
      <div data-step="0" class="is-active">...</div>
      <div data-step="1">...</div>
      <div data-step="2">...</div>
    </div>
  </div>
</section>
```

`data-screens` is an ordered array of screenshot URLs (one per step); `data-objects` is an
ordered array of object-type keys matching `OBJECT_FACTORIES` (`pen`, `plate`, `scale`,
`capsule`, `leaf`) — homepage uses `["pen","plate","scale"]` (3 steps), `/sustain` uses all
five (5 steps). The `<div data-step="N">` caption elements are the only part of a reel that
remains real DOM/CSS — `scene.js` toggles `.is-active` on the correct one each frame based
on scroll progress; the phone and per-step object are 100% WebGL, not DOM.

`parseReels()` (scene.js) reads every `.reel-track` on the page this way at init, builds one
Three.js object `Group` per `data-objects` entry via `OBJECT_FACTORIES[type].make()`, and
adds each `group` to the scene with `visible = false` initially. `measureReels()` records
each reel's `top`/`height` in absolute document coordinates (`getBoundingClientRect().top +
window.scrollY`), re-run on `resize`.

### 6.4 Scroll choreography — computed fresh every frame, never accumulated

`getActiveReel()` replicates the exact math the earlier GSAP ScrollTrigger `start: "top
top", end: "bottom bottom"` pinning used to use: a reel's active scroll range is
`[reel.top, reel.top + reel.height - windowHeight]`, and `progress` is
`(scrollY - start) / (end - start)`, clamped `[0, 1]`. **This is recomputed from
`window.scrollY` from scratch every single `requestAnimationFrame` tick** — nothing is
accumulated relative to the previous frame's value. This is deliberate and important: it's
what makes the animation robust to the user scrolling up, scrolling fast, or the browser
skipping frames — the position is always "what should this look like right now," never
"apply a delta to wherever it was last frame." Preserve this pattern in any future edits to
the choreography; accumulating deltas here would make the animation drift/desync on fast or
reversed scrolling.

Within an active reel, `progress` (0→1 across the whole reel) is split into `steps` equal
segments (`steps = screens.length`); each segment further splits into three phases via
`segP` (0→1 within that segment):
- `segP < 0.24` — **fly in**: object eases in (`easeOutCubic`) from far off-screen
  (`farX = dir * 9`) to its "hold" position beside the phone, scaling up from 40% to 100%
  of its base scale, fading in.
- `0.24 ≤ segP < 0.72` — **hold**: object sits at its hold position with a gentle gyroscopic
  float (`Math.sin(t * Math.PI * 2) * 0.15` on Y and rotation) so it doesn't look frozen.
- `segP ≥ 0.72` — **fly out**: eases out (`easeInCubic`) back off-screen the same way it
  came in, on the opposite side from the *next* object's entry (alternating `dir` by index
  parity), fading out.

Only the object matching the *current* step index is visible at any moment; every other
reel's objects (and the current reel's non-active-step objects) are forced `visible = false`
each frame.

### 6.5 The phone's three states

`updatePhoneAndObjects()` computes one of three target position/scale pairs for
`phoneGroup` every frame, then **lerps toward it** (`.lerp(target, 0.06)` for position,
manual linear interpolation for scale) rather than snapping — this is what makes the phone
feel like it's smoothly gliding between states rather than teleporting:

1. **Hero** (`window.scrollY < firstReelTop`, i.e. before the first `.reel-track` begins):
   centered-ish, `position (0, -0.3, 0)`, `scale 1.05`, showing the *first* reel's first
   screenshot.
2. **Active reel** (scroll position is inside some `.reel-track`'s range): centered higher,
   `position (0, 0.15, 0)`, `scale 1`, full spin tied to reel progress
   (`rotation.y = idleAngle + progress * Math.PI * 2` — one full 360° turn over the course
   of each reel), screen texture swapped to the current step's screenshot, and the matching
   caption's `.is-active` class toggled on.
3. **Docked** (scrolled past the last reel): shrinks to a small corner position
   `(2.7, 1.5, -2.4)`, `scale 0.4`, keeps idly spinning (`idleAngle`, continuous regardless
   of state) but stops advancing screenshots — shows the *last* reel's *last* screenshot
   permanently.

`idleAngle` accumulates every frame (`dt * 0.25` rad/sec) regardless of state and is always
added into the phone's (and every visible object's) rotation, so there's always some gentle
motion even when nothing else is changing (e.g. while reading the feature grid between
reels).

### 6.6 Screen texture swapping

`screenMesh` (a `THREE.PlaneGeometry` positioned just in front of the phone body) has a
`THREE.MeshBasicMaterial` whose `.map` is swapped via a small `textureCache` (`Map<url,
THREE.Texture>`, populated lazily by `getTexture(url)`) — textures are only loaded once per
URL, then reused every time that screenshot is shown again (e.g. hero and the first reel
step share `01-dashboard.png`). `sRGBColorSpace` is set on both the renderer's output and
each loaded texture so colors match what a browser would show for the same PNG in an
`<img>` tag.

### 6.7 Background shader

A `THREE.ShaderMaterial` rendered on the **inside** (`side: THREE.BackSide`) of a large
`THREE.SphereGeometry(60, 48, 48)` centered on the camera, so it always fills the entire
view regardless of camera movement. The fragment shader is a **hand-written value-noise +
fbm** (fractal Brownian motion, 5 octaves) — explicitly NOT the standard Perlin/simplex
noise algorithm, just a simpler custom hash-based value noise, chosen because it needed no
external GLSL noise library/include and is cheap enough to run at 5 octaves per pixel every
frame. Three noise samples (`n1`, `n2`, `n3`) at different scales/offsets are blended
between four hand-picked colors (`colorA` near-black-purple, `colorB` teal, `colorC`
magenta/pink, `colorD` deep violet) via `mix()`/`smoothstep()` to create a shifting
nebula/aurora look. Three uniforms drive it: `uTime` (continuous), `uMouse` (lerped mouse
position, same value feeding the camera parallax), `uScroll` (0→1 across total page scroll
height) — so the background visibly reacts to both mouse movement and scroll position, per
the user's explicit request in §5b point 3.

### 6.8 Camera / mouse parallax

`mousemove` sets a `targetMouse` (normalized `-1..1` both axes); each frame, `mouse` lerps
toward it (`0.045` factor) and the camera's `position.x`/`position.y` are set from `mouse`
(small range, `±0.6`/`±0.4`), always `lookAt(0,0,0)` — a subtle parallax/tilt effect as the
user moves their cursor, not a full free-look camera. The same lerped `mouse` value feeds
`bgUniforms.uMouse`, so the background shader and the camera parallax are visually
synchronized (both driven by the same smoothed mouse position, not two independently-lerped
values that could drift apart).

### 6.9 Failure handling

`WebGLRenderer` creation is wrapped in `try/catch` — on failure (`WebGL unavailable`), it
`console.warn`s and returns early, doing nothing further. Combined with §4's dark-fallback
`body` background, this means **a WebGL failure never breaks the page** — the DOM content
(nav, hero text, feature cards, pricing, footer) all render normally via ordinary CSS
regardless of whether the 3D scene loads, just without the phone/objects/animated
background. `initScene()` also checks `document.readyState` and defers to
`DOMContentLoaded` if the script executes before the DOM is ready (defensive, since it's a
`type="module"` script which already defers by default, but this is an extra guard).

## 7. Known loose ends / minor debt (not urgent, listed for completeness)

- **`assets/img/leaf-mark.svg`** — created early as decorative hero art, never referenced
  in any current HTML (superseded first by inline SVG glyphs, then by the 3D `leaf` object
  in `scene.js`). Dead file. Safe to delete or repurpose; not urgent.
- **`02-paywall.png`** — exists in `assets/img/screenshots/` but isn't wired into either
  reel's `data-screens`. Available if a future pricing/paywall-focused animation beat is
  added to `/sustain`.
- **No offline/vendored fallback for GSAP or Three.js** — both load from CDN only. If
  either CDN is unreachable, `main.js` degrades gracefully (see its own internal
  `typeof gsap === "undefined"` guard) and `scene.js` degrades gracefully (its own
  `try/catch`), but neither has a local copy to fall back to; this is a reasonable tradeoff
  for a marketing site but worth knowing if offline demoing is ever needed.
- **`@media (prefers-reduced-motion: reduce)`** only disables CSS smooth-scroll (`html {
  scroll-behavior: auto }`), not the Three.js scroll-driven choreography or GSAP reveals —
  a fuller accessibility pass would gate `scene.js`'s animation intensity (or GSAP's
  reveals) behind this media query too, not just CSS scrolling. Not done.

## 8. Verification status — UPDATE (2026-07-27): this section is now historical, not current

**Everything below this line in §8, describing "no real-browser verification has ever
happened," is now out of date and kept only for its still-accurate technical detail about
*why* the sandbox couldn't do it (headless Chromium remains genuinely unlaunchable here,
missing `libxdamage1`, no root — see also `../Sustain/marketing/VIDEO_AD_HANDOFF.md` §5 for
the same finding rediscovered independently during later video-ad work).** What's changed
since this was originally written: the site has since been deployed live to
hearthlyapps.com (see the updated §9 below) and gone through several real rounds of actual
verification — not from this sandbox, but via the developer's own real iPhone. The working
loop, confirmed effective, was exactly what §8 originally speculated it would have to be:
make a change, the developer loads the real page on their iPhone (Safari, both normal and
Private-tab to rule out caching), sends a screenshot back, the next fix is made from that.

This caught and fixed several real mobile-only bugs that static syntax-checking never
could have: a caption/phone overlap bug (root-caused through several iterations — first a
CSS media query that collapsed every reel-step caption to the same screen half regardless
of which half its paired phone position used, then a deeper issue where mobile Safari's
address-bar collapse mid-scroll was silently desyncing `scene.js`'s whole layout from the
actual live viewport, and finally fixed properly by rewriting the mobile layout path in
`scene.js` to measure each caption's real on-screen bounding box every frame and place the
phone/object in the genuinely free space next to it, rather than trusting hand-tuned
position fractions that only ever held up on the desktop viewport they were tuned against).
Also fixed the same session: a direction-dependent object-misplacement bug (the object's
hold position was being computed from the phone's live, lerping — and therefore
scroll-direction-and-speed-dependent — position instead of its stable per-step target), and
a waitlist-form centering bug. **The lesson worth carrying forward: every mobile-specific
bug found here was invisible to this sandbox's own tooling (`node --check`, CSS
parse-checking, tag-balance counting) and was only ever caught by a real screenshot from a
real device — don't trust "the code looks right" for anything view­port/scroll-dependent
without that loop.**

The original §8 text (kept for its still-relevant technical detail on sandbox limitations):

**No screenshot, no browser render, no visual QA of this site has been possible from the
sandbox this was built in.** The sandbox has no root access (`sudo` blocked by the
container's "no new privileges" flag), so Playwright/headless-Chromium — the only path to
programmatic screenshots — could not be installed (`apt-get install`/`playwright
install-deps` both failed on missing system libraries like `libxdamage1`, with no way to
grant them). What verification *was* done, every time, was purely static:

- `node --check` on a temp `.mjs` copy of `scene.js` and directly on `main.js` — confirms
  JS syntax validity only, says nothing about runtime behavior, WebGL compatibility, shader
  compilation, or whether the choreography actually looks good.
- Python `tinycss2` parse-error checking on `style.css` — confirms CSS syntax validity only.
- Regex-based HTML open/close tag-balance counting on both `index.html` and
  `sustain/index.html` — confirms tags are balanced, canvas/script elements are present,
  and the old `.phone-frame`/`.reel-object` markup is fully gone; says nothing about visual
  layout.

**The real verification loop for this entire project has been: make a change, ask the user
to load the page in their own real browser, and read their screenshot/description of what's
actually wrong.** This is how both the hero-invisible bug and the caption-overlap bug were
actually caught and confirmed fixed (§5a) — not through anything run in the sandbox. **The
current state (the full 3D pivot: spinning phone, 3D objects, shader background) has NOT
yet been through this loop even once** — it was built, statically validated, and wired into
both HTML files, but nobody has actually looked at it running in a browser yet as of this
handoff. Treat the entire 3D system as unverified-by-a-human until that happens. If a new
session picks this up, the first thing worth doing is asking the user to open `index.html`
(or `sustain/index.html`) in a real browser and describe/screenshot what they see — don't
assume the choreography, colors, or performance are correct just because the code is
syntactically valid and logically sound.

Things especially worth double-checking once real-browser verification is possible:
- Does the phone visibly spin/dock/hero-transition the way §6.5 describes, or does
  something clip/jitter?
- Do the five 3D objects actually read as "pen," "plate/fork," "scale," "capsule," "leaf" at
  the sizes/angles they render at, or do they need bigger detail/better silhouettes?
- Is the shader background too subtle, too intense, or performing poorly (frame rate) on
  the user's actual hardware?
- Does opening the HTML files directly via `file://` (rather than a local server) cause any
  CORS issues loading the screenshot textures? (Likely fine since they're same-origin
  relative paths, but genuinely untested.)

## 9. Explicit pending tasks for a new session — UPDATE (2026-07-27)

Tasks 1 and 2 below are done as of 2026-07-27; kept struck-through rather than deleted so
the history isn't lost. Current open items follow.

1. ~~Get real-browser eyes on the current 3D build~~ — **done**, extensively, via the
   developer's real iPhone (see the updated §8 above).
2. ~~Deploy~~ — **done**. The site is live at hearthlyapps.com via GitHub Pages, repo
   `github.com/hearthlyapps/hearthlyapps-site`, custom domain via `CNAME` as this section
   originally guessed.
3. Consider the reduced-motion gap (§7) if accessibility is a priority before wider launch.
   Still open, not revisited.
4. Homepage's "what's next" section content was originally scoped to pull from
   `../iPhone-App-Opportunity-Report.md` — still open, not revisited this session.
5. ~~If/when Sustain's real App Store listing goes live, swap the `/sustain` page's "Coming
   soon" buttons for real App Store links~~ — **[DONE, 2026-07-29]**. Sustain has been live
   since 1.0(3) (`apps.apple.com/us/app/sustain-glp-1-companion/id6793802192`); a major 2.0
   update (mandatory account sync, real camera viewfinder, specific-days-of-week
   scheduling) was accepted and went live 2026-08-01 — see
   `../Sustain/Documentation/CHANGELOG.md` for current status. The nav CTA,
   hero CTA, and a new post-pricing CTA on both `index.html` and `sustain/index.html` now
   link there directly with a "Download on the App Store" button (Apple icon SVG, opens in
   a new tab). See `../Sustain/Documentation/CHANGELOG.md`'s "iPad device-support fix"
   entry (2026-07-29) for the session this happened in.
6. ~~A Formspree-backed waitlist form was added to both CTA spots on `/sustain`~~ —
   **[REMOVED, 2026-07-29]**. Now that the app is live, the "Notify me at launch" waitlist
   forms were stale and actively misleading (signing up for a launch that already
   happened). Both were removed and replaced by the real App Store download buttons in
   item 5 above. Final tally before removal: zero signups. The Formspree endpoint and
   `waitlist@hearthlyapps.com` alias are no longer wired into either page but haven't been
   deleted/decommissioned externally — worth doing if they're not needed for anything else.
7. ~~A video ad (for YouTube Shorts/TikTok) was attempted using this site's real
   screenshots/brand assets as source material~~ — **done, UPDATE (2026-07-27, later
   session)**: v1 and v2 (pure ffmpeg/Python, 2D image with a fake perspective warp,
   built in the constrained sandbox described below) were superseded by v3, built in a
   later, meaningfully less-restricted session that had a real browser with working
   WebGL. v3 actually renders this site's real `scene.js` phone/lighting/background
   through that real WebGL context, driven by a scripted cinematic camera, captured
   frame-by-frame and composited — genuine 3D depth and camera movement, not a 2D
   illusion, closing the exact gap the developer had flagged. Output:
   `../Sustain/marketing/sustain_short_ad_v3_real3d.mp4`. Full technical detail,
   including how that later session verified real WebGL availability (against the live
   `hearthlyapps.com/sustain` domain, not a local copy — see the caveat logged there
   about a local-serving quirk) before committing to this approach, lives in
   `../Sustain/marketing/VIDEO_AD_HANDOFF.md` §8. The original note below (kept for
   history) describes the pre-v3 state and the sandbox limits that shaped v1/v2 — no
   longer the current constraints, but still useful context for why v1/v2 look the way
   they do.

   Original note: two versions were built via pure code (ffmpeg + Python) in the same
   constrained sandbox this whole site was built in; the developer's verdict was
   "better, but still not Apple-commercial quality, wants more 3D." That handoff
   documents a detailed list of exactly which environment limits shaped what was
   possible then (no root, blocked network paths, a one-library-short-of-working
   headless Chromium) — worth knowing as background even though a later session's
   environment didn't share those limits.
