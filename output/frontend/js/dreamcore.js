/* dreamcore.js — Dreamcore fragment overlay system (P2-DREAM-01, P2-DREAM-02)
 * Displays cryptic text fragments at random screen positions with fade in/out over 8-12s.
 * Fragments cycle randomly, one visible at a time with overlapping fades.
 * Exports: DreamcoreManager { start, stop }
 */
var DreamcoreManager = (function () {
  'use strict';

  var fragments = [
    "are you still there",
    "this is not a place",
    "you have been here before",
    "they are watching through the screen",
    "the signal is decaying",
    "don't trust the viewer count",
    "this space has no exit",
    "the void remembers",
    "you are not alone here",
    "nothing is real"
  ];

  var container = null;
  var activeEls = [];
  var timerId = null;
  var running = false;

  function createFragmentEl() {
    var el = document.createElement('div');
    el.className = 'dreamcore-fragment';
    el.textContent = fragments[Math.floor(Math.random() * fragments.length)];
    el.style.left = (5 + Math.random() * 60) + '%';
    el.style.top = (8 + Math.random() * 70) + '%';
    el.style.opacity = '0';
    el.style.animationDuration = (8 + Math.random() * 4) + 's';
    return el;
  }

  function spawnFragment() {
    if (!running || !container) return;
    var el = createFragmentEl();
    container.appendChild(el);
    activeEls.push(el);
    el.style.opacity = '0';
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    var lifetime = 8000 + Math.random() * 4000;
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        var idx = activeEls.indexOf(el);
        if (idx >= 0) activeEls.splice(idx, 1);
      }, 2000);
    }, lifetime);
    if (activeEls.length > 3) {
      var oldest = activeEls.shift();
      oldest.style.opacity = '0';
      setTimeout(function () {
        if (oldest.parentNode) oldest.parentNode.removeChild(oldest);
      }, 2000);
    }
    timerId = setTimeout(spawnFragment, 6000 + Math.random() * 5000);
  }

  function start() {
    if (running) return;
    container = document.createElement('div');
    container.id = 'dreamcore-overlay';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:55;';
    document.body.appendChild(container);
    running = true;
    spawnFragment();
  }

  function stop() {
    running = false;
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (container && container.parentNode) container.parentNode.removeChild(container);
    container = null;
    activeEls = [];
  }

  return { start: start, stop: stop };
})();
