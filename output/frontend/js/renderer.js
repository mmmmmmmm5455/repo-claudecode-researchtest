/* renderer.js - Text typewriter effect + UI state updates
 * Exports on window.GameRenderer: typewriterEffect(), updateViewerCounter(),
 *   updateStatusBars(), showSystemDialog(), cancelTypewriter()
 *
 * DOM targets (from index.html):
 *   #dialog-content   - narrative text (typewriter target)
 *   #viewer-counter   - 7-segment viewer count (.seven-segment)
 *   #emotion-fill     - emotion bar fill width (0-100%)
 *   #infection-fill   - infection bar fill width (0-100%)
 *   #fragment-counter - memory fragment count (.seven-segment)
 *   #system-dialog    - glitch/infection popup (.hidden toggles visibility)
 *   #system-dialog-header / #system-dialog-body - popup text
 *   #location-display - scene name in zh-TW
 */
(function () {
  'use strict';

  var _timer = null;
  var _infectionLevel = 0;
  var _glitchIntensity = 1;
  var _zalgoMarks = [
    '̀', '́', '̂', '̃', '̄', '̅', '̆', '̇', '̈',
    '̉', '̊', '̋', '̌', '̍', '̎', '̏',
    '̐', '̑', '̒', '̓', '̔', '̕', '̖', '̗', '̘',
    '̙', '̚', '̛', '̜', '̝', '̞', '̟',
    '̠', '̡', '̢', '̣', '̤', '̥', '̦', '̧', '̨',
    '̩', '̪', '̫', '̬', '̭', '̮', '̯',
    '̰', '̱', '̲', '̳', '̴', '̵', '̶', '̷', '̸',
    '̹', '̺', '̻', '̼', '̽', '̾', '̿',
    '̀', '́', '͂', '̓', '̈́', 'ͅ', '͆', '͇', '͈',
    '͉', '͊', '͋', '͌', '͍', '͎', '͏',
    '͐', '͑', '͒', '͓', '͔', '͕', '͖', '͗', '͘',
    '͙', '͚', '͛', '͜', '͝', '͞', '͟',
    '͠', '͡', '͢', 'ͣ', 'ͤ', 'ͥ', 'ͦ', 'ͧ', 'ͨ',
    'ͩ', 'ͪ', 'ͫ', 'ͬ', 'ͭ', 'ͮ', 'ͯ'
  ];

  function setInfectionLevel(level) {
    _infectionLevel = Math.min(100, Math.max(0, level | 0));
    var dialog = document.getElementById('dialog-panel');
    if (dialog) {
      if (_infectionLevel > 70) {
        dialog.classList.add('dialog-jitter');
      } else {
        dialog.classList.remove('dialog-jitter');
      }
    }
  }

  function glitchText(text) {
    if (_infectionLevel <= 70 || !text || _glitchIntensity <= 0) return text;
    var rate = 0.05 + (Math.min(95, _infectionLevel) - 70) / 25 * 0.25;
    var result = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      result += ch;
      if (/[a-zA-Z]/.test(ch) && Math.random() < rate) {
        var count = 1 + Math.floor(Math.random() * 3);
        for (var j = 0; j < count; j++) {
          result += _zalgoMarks[Math.floor(Math.random() * _zalgoMarks.length)];
        }
      }
    }
    return result;
  }

  function cancelTypewriter() {
    if (_timer !== null) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  /* Typewriter effect. Uses [...text] for Unicode-safe character iteration.
   * speed defaults to 40ms/char (within 30-50ms spec).
   */
  function typewriterEffect(text, targetEl, speed) {
    cancelTypewriter();
    if (!targetEl || !text) return;
    speed = speed || 40;
    var chars = Array.from(text);
    var i = 0;
    _timer = setInterval(function () {
      if (i < chars.length) {
        targetEl.textContent += chars[i];
        i++;
        targetEl.scrollTop = targetEl.scrollHeight;
      } else {
        cancelTypewriter();
      }
    }, speed);
  }

  /* Update 7-segment viewer counter. Clamps to 1-99, zero-padded to 2 digits. */
  function updateViewerCounter(count) {
    var el = document.getElementById('viewer-counter');
    if (!el) return;
    var n = Math.min(99, Math.max(1, count | 0));
    var prev = el.textContent;
    el.textContent = String(n).padStart(2, '0');
    if (prev !== el.textContent) {
      el.classList.add('glitching');
      setTimeout(function () { el.classList.remove('glitching'); }, 150);
    }
  }

  /* Update emotion bar (0-100% width), infection bar (0-100% width), fragment counter */
  function updateStatusBars(emotion, infection, fragments) {
    var emoFill = document.getElementById('emotion-fill');
    var infFill = document.getElementById('infection-fill');
    var fragEl = document.getElementById('fragment-counter');

    if (emoFill) emoFill.style.width = Math.min(100, Math.max(0, emotion | 0)) + '%';
    if (infFill) infFill.style.width = Math.min(100, Math.max(0, infection | 0)) + '%';
    if (fragEl) fragEl.textContent = String(Math.min(99, Math.max(0, fragments | 0))).padStart(2, '0');
  }

  /* Show/hide system dialog popup. Pass null/undefined to hide.
   * Known event types: critical_infection, infection_warning, are_you_real
   */
  function showSystemDialog(eventType) {
    var dialog = document.getElementById('system-dialog');
    var ayrPopup = document.getElementById('are-you-real-popup');

    if (!eventType) {
      if (dialog) dialog.classList.add('hidden');
      if (ayrPopup) ayrPopup.classList.add('hidden');
      return;
    }

    if (eventType === 'are_you_real') {
      if (dialog) dialog.classList.add('hidden');
      if (ayrPopup) ayrPopup.classList.remove('hidden');
      return;
    }

    if (ayrPopup) ayrPopup.classList.add('hidden');
    if (!dialog) return;

    var header = document.getElementById('system-dialog-header');
    var body = document.getElementById('system-dialog-body');

    var msgs = {
      critical_infection: {
        header: '⚠ 感染嚴重警告',
        body: '你的感染程度已達到危險等級。如果不立即處理，系統將在短期內完全崩潰。請尋找修復工具或安全區域。'
      },
      infection_warning: {
        header: '⚠ 感染警告',
        body: '你感覺到體內有某種東西在蔓延。盡快找到解決方案，否則情況會持續惡化。'
      }
    };

    var cfg = msgs[eventType] || { header: '系統訊息', body: eventType };
    if (header) header.textContent = cfg.header;
    if (body) body.textContent = cfg.body;
    dialog.classList.remove('hidden');
  }

  function setGlitchIntensity(v) {
    _glitchIntensity = Math.max(0, Math.min(1, v));
    return _glitchIntensity;
  }

  function toggleGlitch() {
    _glitchIntensity = _glitchIntensity > 0 ? 0 : 1;
    return _glitchIntensity;
  }

  window.GameRenderer = {
    typewriterEffect: typewriterEffect,
    updateViewerCounter: updateViewerCounter,
    updateStatusBars: updateStatusBars,
    showSystemDialog: showSystemDialog,
    cancelTypewriter: cancelTypewriter,
    setInfectionLevel: setInfectionLevel,
    glitchText: glitchText,
    setGlitchIntensity: setGlitchIntensity,
    toggleGlitch: toggleGlitch,
    getGlitchIntensity: function () { return _glitchIntensity; }
  };
})();
