/* audio.js — Web Audio API ambient playback with crossfade (P2-AUDIO-02)
 * Manages AudioContext, GainNode-based crossfade between scene-specific ambient tracks.
 * Placeholder: when P2-AUDIO-01 delivers 4 ambient drone MP3s, load them via fetch+decode.
 * Exports: AudioManager { start, switchScene, getState }
 */
var AudioManager = (function () {
  'use strict';

  var ctx = null;
  var currentGain = null;
  var nextGain = null;
  var currentSource = null;
  var currentScene = null;
  var crossfadeMs = 3000;
  var masterGain = null;
  var ambientPath = 'assets/audio/ambient_';

  function init() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.25;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('AudioManager: Web Audio API not available');
    }
    return ctx;
  }

  function switchScene(sceneName) {
    if (!init() || sceneName === currentScene) return;
    currentScene = sceneName;

    if (currentGain) {
      currentGain.gain.linearRampToValueAtTime(0, ctx.currentTime + crossfadeMs / 1000);
      setTimeout(function () {
        if (currentSource) { try { currentSource.stop(); } catch(e) {} }
      }, crossfadeMs + 100);
    }

    nextGain = ctx.createGain();
    nextGain.gain.value = 0;
    nextGain.connect(masterGain);
    nextGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + crossfadeMs / 1000);

    var url = ambientPath + sceneName + '.mp3';
    fetch(url)
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.arrayBuffer();
      })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (audioBuffer) {
        var src = ctx.createBufferSource();
        src.buffer = audioBuffer;
        src.loop = true;
        src.connect(nextGain);
        src.start(0);
        if (currentSource) {
          try { currentSource.stop(ctx.currentTime + crossfadeMs / 1000 + 0.1); } catch(e) {}
        }
        currentSource = src;
        currentGain = nextGain;
      })
      .catch(function (err) {
        console.warn('AudioManager: ambient track not found for ' + sceneName + ' (' + err.message + ')');
        currentGain = nextGain;
      });
  }

  function getState() {
    return {
      contextReady: !!ctx,
      currentScene: currentScene,
      crossfadeMs: crossfadeMs
    };
  }

  return { init: init, switchScene: switchScene, getState: getState };
})();
