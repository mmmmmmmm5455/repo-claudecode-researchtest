/* app.js — Application orchestrator
 * Binds UI events, manages game loop, coordinates GameAPI + GameRenderer + Background
 */
(function () {
  'use strict';

  var sessionId = null;
  var processing = false;
  var currentScene = 'fog_highway';
  var sceneManager = null;

  // ── Init ──────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', initGame);

  async function initGame() {
    try {
      var resp = await window.GameAPI.sendAction('__new__', '');
      // Actually use POST /api/game/new
      var res = await fetch('/api/game/new', { method: 'POST' });
      var data = await res.json();
      sessionId = data.session_id;
      applyGameResponse(data);
    } catch (e) {
      // Fallback: create session via action
      try {
        var res = await fetch('/api/game/new', { method: 'POST' });
        var data = await res.json();
        sessionId = data.session_id;
        if (data.narrative) {
          document.getElementById('dialog-content').textContent = data.narrative + '
';
        }
      } catch (e2) {
        document.getElementById('dialog-content').textContent = '[錯誤] 無法連接到遊戲伺服器。請確認後端已啟動。';
      }
    }

    // Init background scene
    if (typeof BackgroundManager !== 'undefined') {
      BackgroundManager.start(currentScene);
    }
  }

  // ── Send Handler ──────────────────────────────────────────────────

  async function handleSend() {
    if (processing || !sessionId) return;

    var inputEl = document.getElementById('input-field');
    var input = inputEl.value.trim();
    if (!input) return;

    processing = true;
    inputEl.value = '';
    inputEl.disabled = true;
    document.getElementById('send-button').disabled = true;

    // Echo player input to dialog
    var dialog = document.getElementById('dialog-content');
    dialog.textContent += '
> ' + input + '

';
    dialog.scrollTop = dialog.scrollHeight;

    // Try WebSocket streaming first, fall back to POST
    var ws = window.GameAPI.connectWebSocket(sessionId, input, {
      onToken: function (token) {
        dialog.textContent += token;
        dialog.scrollTop = dialog.scrollHeight;
      },
      onStateUpdate: function (state) {
        applyGameResponse(state);
        finishProcessing();
      },
      onError: function (err) {
        // WebSocket failed, fall back to POST
        fallbackPost(input);
      },
    });

    // Timeout: if no response in 15s, fallback
    setTimeout(function () {
      if (processing && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        fallbackPost(input);
      }
    }, 15000);
  }

  async function fallbackPost(input) {
    try {
      var data = await window.GameAPI.sendAction(sessionId, input);
      var dialog = document.getElementById('dialog-content');
      dialog.textContent += data.narrative + '

';
      dialog.scrollTop = dialog.scrollHeight;
      applyGameResponse(data);
    } catch (e) {
      document.getElementById('dialog-content').textContent += '[錯誤] ' + e.message + '
';
    }
    finishProcessing();
  }

  function finishProcessing() {
    processing = false;
    document.getElementById('input-field').disabled = false;
    document.getElementById('send-button').disabled = false;
    document.getElementById('input-field').focus();
  }

  // ── Apply Game Response ───────────────────────────────────────────

  function applyGameResponse(data) {
    if (data.emotion_value !== undefined) {
      window.GameRenderer.updateStatusBars(
        data.emotion_value,
        data.infection_level,
        data.memory_fragments
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
    }
    if (data.system_event) {
      window.GameRenderer.showSystemDialog(data.system_event);
    }
    if (data.location || data.scene_trigger) {
      var locNames = {
        rain_underpass: '雨天地下通道',
        snow_bridge: '雪夜步行橋',
        fog_highway: '大霧高架橋',
        blizzard_street: '暴雪城市街景',
      };
      var locEl = document.getElementById('location-display');
      if (locEl) {
        locEl.textContent = locNames[data.scene_trigger] || data.location || '';
      }
    }
  }

  function fetchAndApplyState() {
    if (!sessionId) return;
    window.GameAPI.getGameState(sessionId).then(function (state) {
      applyGameResponse(state);
    }).catch(function () {});
  }

  // ── Event Bindings ────────────────────────────────────────────────

  document.getElementById('send-button').addEventListener('click', handleSend);
  document.getElementById('input-field').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleSend();
  });
  document.getElementById('system-dialog-close').addEventListener('click', function () {
    window.GameRenderer.showSystemDialog(null);
  });

  // ── Exports ───────────────────────────────────────────────────────

  window.App = {
    initGame: initGame,
    handleSend: handleSend,
    applyGameResponse: applyGameResponse,
    fetchAndApplyState: fetchAndApplyState,
  };
})();
