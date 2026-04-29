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
        dialog.textContent += token;
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
        dialog.textContent += data.narrative + '\n\n';
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
    }
    if (data.viewer_count !== undefined) {
      window.GameRenderer.updateViewerCounter(data.viewer_count);
    }
    if (data.scene_trigger && data.scene_trigger !== currentScene) {
      currentScene = data.scene_trigger;
      if (typeof BackgroundManager !== 'undefined') {
        BackgroundManager.switchScene(data.scene_trigger);
      }
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
  };
})();
