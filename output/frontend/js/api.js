/* api.js - HTTP fetch + WebSocket communication layer
 * Exports on window.GameAPI: sendAction(), connectWebSocket(), getGameState(), newSession()
 * NO import/require - pure browser execution, loaded via <script> tag
 */
(function () {
  'use strict';

  var BASE = '';

  async function sendAction(sessionId, playerInput) {
    var res = await fetch(BASE + '/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, player_input: playerInput }),
    });
    if (!res.ok) {
      var detail = '';
      try { var e = await res.json(); detail = e.detail || ''; } catch (_) {}
      throw new Error(detail || 'API error ' + res.status);
    }
    return res.json();
  }

  async function newSession() {
    var res = await fetch(BASE + '/api/game/new', { method: 'POST' });
    if (!res.ok) throw new Error('New session error ' + res.status);
    return res.json();
  }

  async function getGameState(sessionId) {
    var res = await fetch(BASE + '/api/game/state?session_id=' + encodeURIComponent(sessionId));
    if (!res.ok) {
      var detail = '';
      try { var e = await res.json(); detail = e.detail || ''; } catch (_) {}
      throw new Error(detail || 'State fetch error ' + res.status);
    }
    return res.json();
  }

  function connectWebSocket(sessionId, playerInput, callbacks) {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws = new WebSocket(proto + '//' + location.host + '/ws/game');

    ws.onopen = function () {
      ws.send(JSON.stringify({ session_id: sessionId, player_input: playerInput }));
    };

    ws.onmessage = function (ev) {
      var data;
      try { data = JSON.parse(ev.data); } catch (_) { return; }
      if (data.type === 'token' && callbacks.onToken) {
        callbacks.onToken(data.content);
      } else if (data.type === 'state_update' && callbacks.onStateUpdate) {
        callbacks.onStateUpdate(data);
      } else if (data.type === 'error' && callbacks.onError) {
        callbacks.onError(data.error || 'Unknown server error');
      }
    };

    ws.onerror = function () {
      if (callbacks.onError) callbacks.onError('WebSocket connection error');
    };

    ws.onclose = function () {
      if (callbacks.onClose) callbacks.onClose();
    };

    return ws;
  }

  window.GameAPI = {
    sendAction: sendAction,
    newSession: newSession,
    connectWebSocket: connectWebSocket,
    getGameState: getGameState,
  };
})();
