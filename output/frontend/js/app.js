/* app.js - Application orchestrator
 * Binds UI events, manages game loop, coordinates GameAPI + GameRenderer + Background.
 *
 * Data flow:
 *   narrative           -> GameRenderer.typewriterEffect() -> #dialog-content
 *   emotion/infection   -> GameRenderer.updateStatusBars() -> #emotion-fill, #infection-fill
 *   fragments           -> GameRenderer.updateStatusBars() -> #fragment-counter
 *   scene_trigger       -> BackgroundManager.switchScene() -> Three.js background
 *   viewer_count        -> GameRenderer.updateViewerCounter() -> #viewer-counter
 *   system_event        -> GameRenderer.showSystemDialog() -> #system-dialog
 */
(function () {
  'use strict';

  var sessionId = null;
  var processing = false;
  var currentScene = 'fog_highway';
  var wsPending = null;

  // ---- Init ----

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    initGame();
  });

  async function initGame() {
    try {
      var data = await window.GameAPI.newSession();
      sessionId = data.session_id;
      applyGameResponse(data);
    } catch (e) {
      document.getElementById('dialog-content').textContent =
        '[錯誤] 無法連接到遊戲伺服器。請確認後端已啟動。';
    }
    if (typeof BackgroundManager !== 'undefined') {
      BackgroundManager.start(currentScene);
    }
    if (typeof DreamcoreManager !== 'undefined') {
      DreamcoreManager.start();
    }
    if (typeof AudioManager !== 'undefined') {
      AudioManager.switchScene(currentScene);
    }
  }

  // ---- Event Binding ----

  function bindEvents() {
    document.getElementById('send-button').addEventListener('click', handleSend);
    document.getElementById('input-field').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSend();
    });
    document.getElementById('system-dialog-close').addEventListener('click', function () {
      window.GameRenderer.showSystemDialog(null);
    });
    document.getElementById('ayr-yes').addEventListener('click', function () {
      window.GameRenderer.showSystemDialog(null);
    });
    document.getElementById('ayr-no').addEventListener('click', function () {
      window.GameRenderer.showSystemDialog(null);
    });

    // QA-NEW-01: [T] toggles CRT post-processing
    document.addEventListener('keydown', function (e) {
      if (e.key === 't' || e.key === 'T') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (typeof BackgroundManager !== 'undefined' && BackgroundManager.toggleCrt) {
          BackgroundManager.toggleCrt();
        }
      }
    });

    // QA-NEW-02: [M] toggles audio mute
    document.addEventListener('keydown', function (e) {
      if (e.key === 'm' || e.key === 'M') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (typeof AudioManager !== 'undefined' && AudioManager.toggleMute) {
          AudioManager.toggleMute();
        }
      }
    });

    // P1-DREAMCORE-04: [G] toggles zalgo glitch intensity
    document.addEventListener('keydown', function (e) {
      if (e.key === 'g' || e.key === 'G') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (typeof window.GameRenderer !== 'undefined' && window.GameRenderer.toggleGlitch) {
          window.GameRenderer.toggleGlitch();
        }
      }
    });
  }

  // ---- Send Handler ----

  async function handleSend() {
    if (processing || !sessionId) return;
    var inputEl = document.getElementById('input-field');
    var input = inputEl.value.trim();
    if (!input) return;

    processing = true;
    inputEl.value = '';
    inputEl.disabled = true;
    document.getElementById('send-button').disabled = true;

    // Echo player input
    var dialog = document.getElementById('dialog-content');
    dialog.textContent += '> ' + input + '\n\n';
    dialog.scrollTop = dialog.scrollHeight;

    // WebSocket-first with POST fallback
    var wsDone = false;
    var fallbackFired = false;

    function runFallback() {
      if (fallbackFired) return;
      fallbackFired = true;
      if (wsPending && wsPending.readyState === WebSocket.OPEN) {
        try { wsPending.close(); } catch (_) {}
      }
      fallbackPost(input);
    }

    window.GameRenderer.cancelTypewriter();

    wsPending = window.GameAPI.connectWebSocket(sessionId, input, {
      onToken: function (token) {
        var displayToken = window.GameRenderer.glitchText ? window.GameRenderer.glitchText(token) : token;
        dialog.textContent += displayToken;
        dialog.scrollTop = dialog.scrollHeight;
      },
      onStateUpdate: function (state) {
        wsDone = true;
        wsPending = null;
        applyGameResponse(state);
        finishProcessing();
      },
      onError: function () {
        if (!wsDone) runFallback();
      },
      onClose: function () {
        if (!wsDone) runFallback();
      }
    });

    setTimeout(function () {
      if (!wsDone) runFallback();
    }, 5000);
  }

  async function fallbackPost(input) {
    try {
      var data = await window.GameAPI.sendAction(sessionId, input);
      var dialog = document.getElementById('dialog-content');
      if (data.narrative) {
        var displayText = window.GameRenderer.glitchText ? window.GameRenderer.glitchText(data.narrative) : data.narrative;
        dialog.textContent += displayText + '\n\n';
        dialog.scrollTop = dialog.scrollHeight;
      }
      applyGameResponse(data);
    } catch (e) {
      document.getElementById('dialog-content').textContent +=
        '[錯誤] ' + e.message + '\n';
    }
    finishProcessing();
  }

  function finishProcessing() {
    processing = false;
    wsPending = null;
    var inputEl = document.getElementById('input-field');
    inputEl.disabled = false;
    document.getElementById('send-button').disabled = false;
    inputEl.focus();
  }

  // ---- Apply Game Response ----

  function applyGameResponse(data) {
    if (data.emotion_value !== undefined) {
      window.GameRenderer.updateStatusBars(
        data.emotion_value,
        data.infection_level != null ? data.infection_level : 0,
        data.memory_fragments != null ? data.memory_fragments : 0
      );
      if (typeof window.GameRenderer.setInfectionLevel === 'function') {
        window.GameRenderer.setInfectionLevel(data.infection_level != null ? data.infection_level : 0);
      }
    }
    if (data.emotion_value !== undefined) {
      window.App.emotionLevel = data.emotion_value;
    }
    if (data.infection_level !== undefined) {
      window.App.infectionLevel = data.infection_level;
    }
    if (data.memory_fragments !== undefined) {
      window.App.memoryFragments = data.memory_fragments;
    }
    if (data.viewer_count !== undefined) {
      window.App.viewerCount = data.viewer_count;
      window.GameRenderer.updateViewerCounter(data.viewer_count);
    }

    // TRIGGER-01: Viewer #2 connects
    if (!window.App.viewerBumped && window.App.visitedScenes.size >= 3 && window.App.totalVisits() >= 5) {
      window.App.viewerBumped = true;
      window.App.viewerCount = 2;
      window.GameRenderer.updateViewerCounter(2);
      window.GameRenderer.showSystemDialog({
        header: '系統訊息',
        body: 'Viewer #2 connected.'
      });
    }

    // TRIGGER-04: White flash on scene transition (20% chance with fragments >= 5)
    if (data.scene_trigger && window.App.memoryFragments >= 5 && Math.random() < 0.2) {
      var flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;opacity:0.3;z-index:999;pointer-events:none;';
      document.body.appendChild(flash);
      setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 50);
    }

    if (data.scene_trigger && data.scene_trigger !== currentScene) {
      currentScene = data.scene_trigger;

      // P1-DREAMCORE-02: 2-second silence before scene transition
      if (typeof AudioManager !== 'undefined' && AudioManager.momentOfSilence) {
        AudioManager.momentOfSilence(2000);
      }

      // P1-DREAMCORE-03: Dreamcore fragment 3-8s after hook trigger
      if (typeof DreamcoreManager !== 'undefined' && DreamcoreManager.triggerFragment) {
        var hookFragMap = {
          rain_underpass: 'F1',
          snow_bridge: 'F4',
          fog_highway: 'F2',
          blizzard_street: 'F6'
        };
        var fragId = hookFragMap[data.scene_trigger] || 'F3';
        var fragDelay = 3000 + Math.random() * 5000;
        DreamcoreManager.triggerFragment(fragId, fragDelay);
      }

      var switched = true;
      if (typeof BackgroundManager !== 'undefined') {
        BackgroundManager.switchScene(data.scene_trigger);
      }
      if (typeof AudioManager !== 'undefined') {
        AudioManager.switchScene(data.scene_trigger);
      }
      // Update visit tracking AFTER successful scene switch
      window.App.visitedScenes.add(data.scene_trigger);
      window.App.visitCounts[data.scene_trigger] = (window.App.visitCounts[data.scene_trigger] || 0) + 1;
      window.App.sceneEntryTime = Date.now();
      updateLocationDisplay(data.scene_trigger);
    }
    if (data.system_event) {
      window.GameRenderer.showSystemDialog(data.system_event);
    }
  }

  function updateLocationDisplay(sceneId) {
    var locEl = document.getElementById('location-display');
    if (!locEl) return;
    var names = {
      rain_underpass: '雨天地下通道',
      snow_bridge: '雪夜步行橋',
      fog_highway: '大霧高架橋',
      blizzard_street: '暴雪城市街景'
    };
    locEl.textContent = names[sceneId] || '';
  }

  // ---- Exports ----

  window.App = {
    initGame: initGame,
    handleSend: handleSend,
    applyGameResponse: applyGameResponse,
    visitedScenes: new Set(),
    visitCounts: {},
    infectionLevel: 0,
    memoryFragments: 0,
    emotionLevel: 0,
    viewerCount: 1,
    viewerBumped: false,
    sceneEntryTime: Date.now(),
    getTimeInScene: function () { return (Date.now() - this.sceneEntryTime) / 1000; },
    totalVisits: function () { var s = 0; for (var k in this.visitCounts) { s += this.visitCounts[k]; } return s; }
  };
})();
