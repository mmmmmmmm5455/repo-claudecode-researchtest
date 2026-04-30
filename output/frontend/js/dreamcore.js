/* dreamcore.js — Dreamcore fragment overlay system (P2-DREAM-01/02, Liminal refactor)
 * Displays nostalgic/confused text fragments at random screen positions.
 * Exploration-reward design: triggers on time-in-scene, emotional state, visits — not infection.
 * F1-F10 each fires at most once per session (Set-based).
 * Interval: 45-240s, drops to min 30s when scenes explored >= 3.
 * Exports: DreamcoreManager { start, stop }
 */
var DreamcoreManager = (function () {
  'use strict';

  var fragments = [
    { id: 'F1', text: 'do you remember this place',     cond: function (a) { return a.getTimeInScene() >= 60; } },
    { id: 'F2', text: 'this place feels familiar somehow', cond: function (a) { return a.visitedScenes.size >= 1 && a.emotionLevel >= 30; } },
    { id: 'F3', text: 'you have been here before',       cond: function (a) { return a.totalVisits() >= 2; } },
    { id: 'F4', text: 'someone was here, just now',      cond: function (a) { return a.visitedScenes.size >= 2 && a.getTimeInScene() >= 120; } },
    { id: 'F5', text: 'the signal is fading, like a memory', cond: function (a) { return a.memoryFragments >= 2; } },
    { id: 'F6', text: 'some things are better left unseen', cond: function (a) { return a.visitedScenes.size >= 3; } },
    { id: 'F7', text: 'maybe there was never an exit',    cond: function (a) { return a.getTimeInScene() >= 180 && a.memoryFragments >= 3; } },
    { id: 'F8', text: 'you left something behind',       cond: function (a) { return a.visitedScenes.size >= 3 && a.totalVisits() >= 4; } },
    { id: 'F9', text: "it's different from how you remember", cond: function (a) { return a.visitedScenes.size >= 4; } },
    { id: 'F10', text: "you're already awake",            cond: function (a) { return a.visitedScenes.size >= 4 && a.memoryFragments >= 5 && a.totalVisits() >= 7; } }
  ];

  var container = null;
  var activeEls = [];
  var timerId = null;
  var running = false;
  var shownFragments = null;

  function getApp() { return (typeof window !== 'undefined' && window.App) ? window.App : null; }

  function getInterval() {
    var app = getApp();
    var minMs = (app && app.visitedScenes && app.visitedScenes.size >= 3) ? 30000 : 45000;
    var maxMs = 240000;
    return minMs + Math.random() * (maxMs - minMs);
  }

  function pickEligibleFragment() {
    var app = getApp();
    if (!app) return null;
    var candidates = fragments.slice();
    // Fisher-Yates shuffle
    for (var i = candidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
    }
    for (var i = 0; i < candidates.length; i++) {
      var f = candidates[i];
      if (!shownFragments.has(f.id) && f.cond(app)) {
        return f;
      }
    }
    return null;
  }

  function createFragmentEl(text) {
    var el = document.createElement('div');
    el.className = 'dreamcore-fragment';
    el.textContent = text;
    el.style.left = (5 + Math.random() * 15) + '%';
    el.style.top = (10 + Math.random() * 20) + '%';
    el.style.opacity = '0';
    return el;
  }

  function spawnFragment() {
    if (!running || !container) return;
    var frag = pickEligibleFragment();
    if (!frag) {
      timerId = setTimeout(spawnFragment, getInterval());
      return;
    }
    shownFragments.add(frag.id);
    var el = createFragmentEl(frag.text);
    container.appendChild(el);
    activeEls.push(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    // Fade out after 10s hold
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        var idx = activeEls.indexOf(el);
        if (idx >= 0) activeEls.splice(idx, 1);
      }, 2000);
    }, 10000);
    // Cap concurrent fragments at 2
    if (activeEls.length > 2) {
      var oldest = activeEls.shift();
      oldest.style.opacity = '0';
      setTimeout(function () {
        if (oldest.parentNode) oldest.parentNode.removeChild(oldest);
      }, 2000);
    }
    timerId = setTimeout(spawnFragment, getInterval());
  }

  function start() {
    if (running) return;
    shownFragments = new Set();
    container = document.createElement('div');
    container.id = 'dreamcore-overlay';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:55;';
    document.body.appendChild(container);
    running = true;
    timerId = setTimeout(spawnFragment, 45000 + Math.random() * 75000);
  }

  function stop() {
    running = false;
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (container && container.parentNode) container.parentNode.removeChild(container);
    container = null;
    activeEls = [];
    shownFragments = null;
  }

  function triggerFragment(id, delayMs) {
    delayMs = delayMs || 0;
    setTimeout(function () {
      if (!running) return;
      var frag = null;
      for (var i = 0; i < fragments.length; i++) {
        if (fragments[i].id === id) { frag = fragments[i]; break; }
      }
      if (!frag || shownFragments.has(frag.id)) return;
      shownFragments.add(frag.id);
      var el = createFragmentEl(frag.text);
      container.appendChild(el);
      activeEls.push(el);
      requestAnimationFrame(function () { el.style.opacity = '1'; });
      setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
          var idx = activeEls.indexOf(el);
          if (idx >= 0) activeEls.splice(idx, 1);
        }, 2000);
      }, 10000);
      if (activeEls.length > 2) {
        var oldest = activeEls.shift();
        oldest.style.opacity = '0';
        setTimeout(function () { if (oldest.parentNode) oldest.parentNode.removeChild(oldest); }, 2000);
      }
    }, delayMs);
  }

  function triggerBlurOverlay(imageUrl) {
    var el = document.createElement('div');
    el.className = 'dreamcore-blur-overlay';
    if (imageUrl) el.style.backgroundImage = 'url(' + imageUrl + ')';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6200);
  }

  return { start: start, stop: stop, triggerFragment: triggerFragment, triggerBlurOverlay: triggerBlurOverlay };
})();
