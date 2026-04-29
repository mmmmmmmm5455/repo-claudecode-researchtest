/* renderer.js — Text typewriter effect + UI state updates
 * Exports: typewriterEffect(), updateViewerCounter(), updateStatusBars(), showSystemDialog()
 *
 * DOM targets (from index.html):
 *   #dialog-content   — narrative text (typewriter target)
 *   #viewer-counter   — 7-segment viewer count (.seven-segment)
 *   #emotion-fill     — emotion bar fill width (0-100%)
 *   #infection-fill   — infection bar fill width (0-100%)
 *   #fragment-counter — memory fragment count (.seven-segment)
 *   #system-dialog    — glitch/infection popup (.hidden toggles visibility)
 *   #system-dialog-header / #system-dialog-body — popup text
 *   #location-display — scene name in zh-TW
 *
 * System event types (from game_engine._check_system_event):
 *   critical_infection — infection > 80
 *   infection_warning  — 60 < infection <= 65
 *   are_you_real       — emotion < 25, 15% random chance
 */
(function () {
  'use strict';

  var _timer = null;

  function cancelTypewriter() {
    if (_timer !== null) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  function typewriterEffect(text, targetEl, speed) {
    cancelTypewriter();
    if (!targetEl || !text) return;
    speed = speed || 40;
    var i = 0;
    _timer = setInterval(function () {
      if (i < text.length) {
        targetEl.textContent += text[i];
        i++;
        targetEl.scrollTop = targetEl.scrollHeight;
      } else {
        cancelTypewriter();
      }
    }, speed);
  }

  function updateViewerCounter(count) {
    var el = document.getElementById('viewer-counter');
    if (!el) return;
    var n = Math.min(99, Math.max(1, count | 0));
    el.textContent = String(n).padStart(2, '0');
  }

  function updateStatusBars(emotion, infection, fragments) {
    var emoFill = document.getElementById('emotion-fill');
    var infFill = document.getElementById('infection-fill');
    var fragEl = document.getElementById('fragment-counter');

    if (emoFill) emoFill.style.width = Math.min(100, Math.max(0, emotion)) + '%';
    if (infFill) infFill.style.width = Math.min(100, Math.max(0, infection)) + '%';
    if (fragEl) fragEl.textContent = String(Math.min(99, Math.max(0, fragments | 0))).padStart(2, '0');
  }

  function showSystemDialog(eventType) {
    var dialog = document.getElementById('system-dialog');
    if (!dialog) return;

    if (!eventType) {
      dialog.classList.add('hidden');
      return;
    }

    var header = document.getElementById('system-dialog-header');
    var body = document.getElementById('system-dialog-body');

    var msgs = {
      critical_infection: {
        header: '⚠ 感染嚴重警告',
        body: '你的感染程度已達到危險等級。如果不立即處理，系統將在短期內完全崩潰。請尋找修復工具或安全區域。',
      },
      infection_warning: {
        header: '⚠ 感染警告',
        body: '你感覺到體內有某種東西在蔓延。盡快找到解決方案，否則情況會持續惡化。',
      },
      are_you_real: {
        header: '???',
        body: '你確定你是真實的嗎？',
      },
    };

    var cfg = msgs[eventType] || { header: '系統訊息', body: eventType };
    if (header) header.textContent = cfg.header;
    if (body) body.textContent = cfg.body;
    dialog.classList.remove('hidden');
  }

  window.GameRenderer = {
    typewriterEffect: typewriterEffect,
    updateViewerCounter: updateViewerCounter,
    updateStatusBars: updateStatusBars,
    showSystemDialog: showSystemDialog,
    cancelTypewriter: cancelTypewriter,
  };
})();
