/* dreamcore.js — Dreamcore fragment overlay system (P2-DREAM-01/02, refactored)
 * Displays cryptic text fragments with trigger conditions at random screen positions.
 * F1-F10 from design spec, each fires at most once per session (Set-based).
 * Interval: 45-240s, drops to min 30s when infection > 70.
 * Exports: DreamcoreManager { start, stop }
 */
var DreamcoreManager = (function () {
  'use strict';

  var fragments = [
    { id: 'F1', text: 'are you still there',   cond: function (a) { return a.infectionLevel >= 20; } },
    { id: 'F2', text: 'this is not a place',    cond: function (a) { return a.infectionLevel >= 30; } },
    { id: 'F3', text: 'you have been here before', cond: function (a) { return a.totalVisits() >= 2; } },
    { id: 'F4', text: 'they are watching through the screen', cond: function (a) { return a.viewerCount >= 2; } },
    { id: 'F5', text: 'the signal is decaying', cond: function (a) { return a.infectionLevel >= 50; } },
    { id: 'F6', text: 'don\'t trust the viewer count', cond: function (a) { return a.viewerCount >= 1 && a.infectionLevel >= 40; } },
    { id: 'F7', text: 'this space has no exit', cond: function (a) { return a.memoryFragments >= 5 && a.visitedScenes.size >= 3; } },
    { id: 'F8', text: 'your body is not here',  cond: function (a) { return a.infectionLevel >= 65; } },
    { id: 'F9', text: 'they rebuilt it wrong',  cond: function (a) { return a.visitedScenes.size >= 4; } },
    { id: 'F10', text: 'wake up',               cond: function (a) { return a.infectionLevel >= 90; } }
  ];

  var container = null;
  var activeEls = [];
  var timerId = null;
  var running = false;
  var shownFragments = null; // Set — tracks which fragment IDs have fired

  function getApp() { return (typeof window !== 'undefined' && window.App) ? window.App : null; }

  function getInterval() {
    var app = getApp();
    var minMs = (app && app.infectionLevel > 70) ? 30000 : 45000;
    var maxMs = 240000;
    return minMs + Math.random() * (maxMs - minMs);
  }

  function pickEligibleFragment() {
    var app = getApp();
    if (!app) return null;
    // Shuffle and pick first eligible fragment not yet shown
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
      // No eligible fragment — retry later
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
    // First fragment after 45-120s delay
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

  return { start: start, stop: stop };
})();
