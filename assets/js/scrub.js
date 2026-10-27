/* ===========================================================
   /sustain/ — page-scrub film
   2026-10-26.

   A fixed full-viewport canvas draws one frame of a 144-frame rendered
   sequence (assets/scrub/{land,port}/f_NNN.webp) behind the page. Scroll
   position picks the frame, so scrolling forward plays the film and
   scrolling back rewinds it. The HUD telemetry and the progress rail are
   written from the same value in the same rAF pass.

   One deliberate difference from a plain "scrollY / maxScroll -> frame"
   mapping: each section carries data-film="t", the point in the film its
   chapter starts at, and the playhead is interpolated between those
   anchors. Section heights change with viewport width and copy length;
   anchoring keeps the phone on the right screen for the words beside it
   on every screen size, instead of drifting a chapter early or late.

   Loading: frame 0 is a real <img> poster in the HTML (first paint, and
   the no-JS view). The rest load coarse-to-fine (every 16th, then 8th,
   4th, 2nd, all), and the draw step uses the nearest frame that has
   arrived, so scrubbing works within a second and sharpens as it loads.

   Reduced motion: no continuous scrubbing. The film holds one composed
   frame per chapter and changes only when the chapter does.
   =========================================================== */

(function () {
  "use strict";

  var film = document.querySelector("[data-scrub]");
  var canvas = film && film.querySelector("canvas");
  if (!film || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d", { alpha: false });
  var N = Number(film.getAttribute("data-frames")) || 144;
  var BASE = film.getAttribute("data-base") || "../assets/scrub/";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Mirrors SCREEN_AT in the renderer (marketing/v3_build/scrub_render/scene.js).
  // If the film is re-rendered with different timings, update both.
  var SCREENS = [[0, "Today"], [0.31, "Camera scan"], [0.468, "Body comp"], [0.615, "Ask Sustain"], [0.738, "Lab results"], [0.935, "Today"]];

  var hud = {
    scene: document.querySelector("[data-hud=scene]"),
    screen: document.querySelector("[data-hud=screen]"),
    frame: document.querySelector("[data-hud=frame]"),
    clock: document.querySelector("[data-hud=clock]")
  };
  var rail = document.querySelector("[data-rail]");
  var railPct = document.querySelector("[data-rail-pct]");
  var ticksWrap = document.querySelector("[data-rail-ticks]");

  /* ---------------------------------------------------- frame sets */

  var sets = {};       // "land" | "port" -> array of Image (or undefined)
  var current = null;  // active set key
  var queue = [];
  var loading = 0;

  function setKey() {
    return window.innerWidth / Math.max(window.innerHeight, 1) >= 0.9 ? "land" : "port";
  }

  function src(key, i) {
    return BASE + key + "/f_" + String(i).padStart(3, "0") + ".webp";
  }

  function order() {
    var seen = {}, out = [];
    [16, 8, 4, 2, 1].forEach(function (step) {
      for (var i = 0; i < N; i += step) if (!seen[i]) { seen[i] = 1; out.push(i); }
    });
    if (!seen[N - 1]) out.push(N - 1);
    return out;
  }

  function useSet(key) {
    if (current === key) return;
    current = key;
    if (!sets[key]) {
      sets[key] = new Array(N);
      queue = order().map(function (i) { return [key, i]; });
      pump();
    }
    lastIdx = -1;
    schedule();
  }

  // Six requests in flight at a time: enough to saturate a connection,
  // few enough that frame 0..16 aren't stuck behind 140 others.
  function pump() {
    while (loading < 6 && queue.length) {
      var job = queue.shift();
      if (sets[job[0]][job[1]]) continue;
      (function (key, i) {
        var img = new Image();
        img.decoding = "async";
        loading++;
        img.onload = function () {
          loading--;
          sets[key][i] = img;
          if (key === current) { lastIdx = -1; schedule(); }
          pump();
        };
        img.onerror = function () { loading--; pump(); };
        img.src = src(key, i);
      })(job[0], job[1]);
    }
  }

  function nearest(i) {
    var s = sets[current];
    if (!s) return null;
    for (var d = 0; d < N; d++) {
      if (s[i - d]) return s[i - d];
      if (s[i + d]) return s[i + d];
    }
    return null;
  }

  /* ---------------------------------------------------- geometry */

  var anchors = [];   // [{y, t, el, name}]
  var maxY = 1;
  var cw = 0, ch = 0, dpr = 1;

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    ch = film.clientHeight || window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);

    var vh = window.innerHeight;
    maxY = Math.max(1, document.documentElement.scrollHeight - vh);
    anchors = [];
    Array.prototype.forEach.call(document.querySelectorAll("[data-film]"), function (el) {
      var top = el.getBoundingClientRect().top + window.scrollY;
      // A chapter "starts" when its section's top edge is halfway up the
      // viewport. With the bare-film gap above each section (scrub.css,
      // .sc + .sc) that puts the phone's turn between chapters inside the
      // gap, and the phone has settled by the time the words are read.
      var y = el === anchorsFirst() ? 0 : Math.max(0, top - vh * 0.5);
      anchors.push({ y: Math.min(y, maxY), t: parseFloat(el.getAttribute("data-film")) || 0, el: el, name: el.getAttribute("data-chapter") || "" });
    });
    anchors.sort(function (a, b) { return a.y - b.y; });
    anchors.push({ y: maxY, t: 1, el: null, name: anchors.length ? anchors[anchors.length - 1].name : "" });
    buildTicks();
    lastIdx = -1;
    lastY = -1;
  }

  function anchorsFirst() { return document.querySelector("[data-film]"); }

  function filmT(y) {
    if (!anchors.length) return y / maxY;
    if (y <= anchors[0].y) return anchors[0].t;
    for (var i = 0; i < anchors.length - 1; i++) {
      var a = anchors[i], b = anchors[i + 1];
      if (y <= b.y) {
        var k = b.y > a.y ? (y - a.y) / (b.y - a.y) : 1;
        return a.t + (b.t - a.t) * k;
      }
    }
    return 1;
  }

  function chapterAt(y) {
    var c = anchors[0];
    for (var i = 0; i < anchors.length - 1; i++) if (y + 1 >= anchors[i].y) c = anchors[i];
    return c;
  }

  /* ---------------------------------------------------- rail ticks */

  function buildTicks() {
    if (!ticksWrap) return;
    ticksWrap.innerHTML = "";
    anchors.forEach(function (a) {
      if (!a.el || !a.el.id) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rail-tick";
      b.style.top = (a.y / maxY * 100).toFixed(2) + "%";
      b.setAttribute("aria-label", "Jump to " + a.name);
      b.innerHTML = "<span>" + a.name + "</span>";
      b.addEventListener("click", function () {
        a.el.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
      });
      a.tick = b;
      ticksWrap.appendChild(b);
    });
  }

  /* ---------------------------------------------------- draw */

  var ticking = false, lastIdx = -1, lastY = -1;

  // Cover, with one exception: on screens wider than the 16:9 film
  // (ultrawide monitors, short browser windows) pure cover would crop the
  // top and bottom off the phone. There the crop is capped at ~8% and the
  // leftover side bands are filled by stretching the frame's own outer
  // edge (soft out-of-focus field, so it reads as more of the same) and
  // fading it into the ground colour.
  function drawCover(img) {
    var W = canvas.width, H = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var s = Math.max(W / iw, H / ih);
    var wide = W / H > iw / ih;
    if (wide) s = Math.min(s, (H / ih) * 1.08);
    var w = iw * s, h = ih * s;
    var x = (W - w) / 2, y = (H - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    if (wide && x > 0.5) {
      var edge = Math.max(2, Math.round(iw * 0.015));
      ctx.drawImage(img, 0, 0, edge, ih, 0, y, Math.ceil(x) + 1, h);
      ctx.drawImage(img, iw - edge, 0, edge, ih, Math.floor(x + w) - 1, y, Math.ceil(x) + 1, h);
      var fade = Math.min(x + w * 0.1, W / 2);
      var gl = ctx.createLinearGradient(0, 0, fade, 0);
      gl.addColorStop(0, "rgba(11,19,18,0.92)");
      gl.addColorStop(1, "rgba(11,19,18,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, fade, H);
      var gr = ctx.createLinearGradient(W, 0, W - fade, 0);
      gr.addColorStop(0, "rgba(11,19,18,0.92)");
      gr.addColorStop(1, "rgba(11,19,18,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(W - fade, 0, fade, H);
    }
  }

  function pad(n, l) { return String(n).padStart(l || 2, "0"); }

  function render() {
    ticking = false;
    var y = window.scrollY;
    var ch0 = chapterAt(y);
    var t = reduced.matches ? holdT(ch0) : filmT(y);
    var idx = Math.max(0, Math.min(N - 1, Math.round(t * (N - 1))));

    if (idx !== lastIdx) {
      var img = nearest(idx);
      if (img) {
        drawCover(img);
        lastIdx = sets[current][idx] ? idx : -1; // redraw when the exact frame lands
        film.classList.add("is-live");
      }
    }

    if (y !== lastY) {
      lastY = y;
      var p = Math.min(1, Math.max(0, y / maxY));
      if (rail) rail.style.setProperty("--rp", p.toFixed(4));
      if (railPct) railPct.textContent = pad(Math.round(p * 100)) + "%";
      if (hud.scene) hud.scene.textContent = ch0 ? ch0.name : "";
      if (hud.screen) {
        var name = SCREENS[0][1];
        for (var i = 0; i < SCREENS.length; i++) if (t >= SCREENS[i][0]) name = SCREENS[i][1];
        hud.screen.textContent = name;
      }
      if (hud.frame) hud.frame.textContent = pad(idx, 3) + " / " + pad(N - 1, 3);
      if (hud.clock) {
        // the film's own timecode at 24 fps: what a scrubber would show
        var f = idx, secs = Math.floor(f / 24);
        hud.clock.textContent = pad(Math.floor(secs / 60)) + ":" + pad(secs % 60) + ":" + pad(f % 24);
      }
      anchors.forEach(function (a) { if (a.tick) a.tick.classList.toggle("is-on", a === ch0 || a.y <= y); });
    }
  }

  // Reduced motion: each chapter shows the frame where its own scene is
  // fully composed (75% of the way through its film range), never a
  // mid-spin transition frame.
  function holdT(c) {
    var i = anchors.indexOf(c);
    if (i < 0) return 0;
    var a = anchors[i].t, b = (anchors[i + 1] || { t: 1 }).t;
    return i === 0 ? 0 : a + (b - a) * 0.75;
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  }

  /* ---------------------------------------------------- boot */

  function onResize() {
    var k = setKey();
    measure();
    if (k !== current) useSet(k);
    schedule();
  }

  useSet(setKey());
  measure();
  schedule();

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  window.addEventListener("load", onResize);
})();
