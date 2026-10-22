/* ===========================================================
   Snooze Control page — audio, 2026-10-22.

   Two jobs, both progressive enhancement:
   1. The hero player plays a real morning built from the app's own
      recorded lines and sounds, and moves the caption, the level ticks
      and the clock along with it, from cue times measured when the
      audio was rendered (scripts in the app repo).
   2. Each character row's button plays that character's sample.

   One sound at a time, never autoplay, every control is a real
   <button> with aria-pressed. With JS off, the captions still read as
   static text and the buttons simply do nothing.
   =========================================================== */

(function () {
  "use strict";

  var current = null;      // { audio, button }

  function stopCurrent() {
    if (!current) return;
    current.audio.pause();
    current.button.setAttribute("aria-pressed", "false");
    if (current.onStop) current.onStop();
    current = null;
  }

  function toggle(button, audio, onStop) {
    if (current && current.audio === audio) {
      stopCurrent();
      return;
    }
    stopCurrent();
    var p = audio.play();
    if (p && p.catch) p.catch(function () { button.setAttribute("aria-pressed", "false"); });
    button.setAttribute("aria-pressed", "true");
    current = { audio: audio, button: button, onStop: onStop };
    audio.onended = function () { stopCurrent(); };
  }

  /* ---------------------------------------------------- character samples */

  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (btn) {
    var audio = null;
    btn.addEventListener("click", function () {
      if (!audio) { audio = new Audio(btn.getAttribute("data-sample")); audio.preload = "auto"; }
      toggle(btn, audio);
    });
  });

  /* ---------------------------------------------------- the hero morning */

  var player = document.querySelector("[data-morning]");
  if (!player) return;

  var cueEl = document.getElementById("sc-cues");
  var cues = [];
  try { cues = JSON.parse(cueEl.textContent).cues; } catch (e) { return; }

  var btn = player.querySelector("[data-morning-play]");
  var stage = player.querySelector(".sc-stage");
  var title = player.querySelector(".sc-title");
  var who = player.querySelector(".sc-who");
  var line = player.querySelector(".sc-line");
  var ticks = player.querySelectorAll(".sc-levels span");
  var clock = player.querySelector(".sc-clock");
  var time = player.querySelector(".sc-time");
  var audio = new Audio(player.getAttribute("data-morning"));
  audio.preload = "metadata";
  var shown = -1;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clockFor(level) {
    // 7:00 AM, plus a nine-minute snooze per level: what the alarm would say.
    var m = Math.min(level, 6) * 9;
    return "7:" + (m < 10 ? "0" : "") + m + " AM";
  }

  function show(i) {
    if (i === shown || !cues[i]) return;
    shown = i;
    var c = cues[i];
    var apply = function () {
      title.textContent = c.title;
      who.textContent = c.who;
      line.textContent = c.line;
      clock.textContent = clockFor(c.level);
      Array.prototype.forEach.call(ticks, function (t, n) {
        t.className = n < c.level ? "is-past" : (n === c.level ? "is-now" : "");
      });
      stage.classList.remove("is-swap");
    };
    if (reduced) { apply(); return; }
    stage.classList.add("is-swap");
    setTimeout(apply, 220);
  }

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return "0:" + (s < 10 ? "0" : "") + s;
  }

  audio.addEventListener("timeupdate", function () {
    var t = audio.currentTime, i = 0;
    for (var n = 0; n < cues.length; n++) if (t >= cues[n].t) i = n;
    show(i);
    if (time) time.textContent = fmt(t) + " / " + fmt(audio.duration || 45);
  });

  btn.addEventListener("click", function () {
    if (audio.ended) audio.currentTime = 0;
    toggle(btn, audio, function () { /* paused: keep the caption where it is */ });
  });
})();
