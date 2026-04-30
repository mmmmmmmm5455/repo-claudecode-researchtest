/* audio.js — Web Audio API ambient drone + environmental sound system
 * Y2K dark cyan liminal aesthetic: diegetic only, <200Hz dominant, 20% max volume
 * Programmatic OscillatorNode synthesis — no MP3 dependencies required
 * Exports: AudioManager { init, switchScene, dispose, setMasterVolume, toggleMute }
 */
var AudioManager = (function () {
  'use strict';

  var ctx = null;
  var masterGain = null;
  var currentScene = null;
  var crossfadeMs = 3000;
  var muted = false;
  var savedVolume = 0.20;

  // Track active nodes per scene for crossfade cleanup
  var activeNodes = {};  // { sceneId: { drone: {osc,filter,gain,lfo[]}, env: {src,filter,gain,lfo[]} } }

  // ---- Drone presets (per prompt: all <200Hz dominant) ----
  var DRONE_PRESETS = {
    fog_highway:     { freq: 100, wave: 'sawtooth', filtFreq: 180, lfoTarget: 'freq', lfoHz: 0.3, lfoDepth: 8, droneVol: 0.15 },
    rain_underpass:  { freq: 80,  wave: 'sine',     filtFreq: 200, lfoTarget: null,   lfoHz: 0,   lfoDepth: 0, droneVol: 0.15 },
    snow_bridge:     { freq: 60,  wave: 'triangle', filtFreq: 150, lfoTarget: 'gain',  lfoHz: 0.2, lfoDepth: 0.03,droneVol: 0.15 },
    blizzard_street: { freq: 50,  wave: 'square',   filtFreq: 120, lfoTarget: 'filt',  lfoHz: 0.5, lfoDepth: 15, droneVol: 0.15 }
  };

  // ---- Environmental sound presets ----
  var ENV_PRESETS = {
    fog_highway:     { type: 'wind_distant', noise: 'white', filtType: 'bandpass', filtLo: 200, filtHi: 400, envVol: 0.05, continuous: true },
    rain_underpass:  { type: 'water_drip',   noise: 'white', filtType: 'bandpass', filtLo: 400, filtHi: 1200,envVol: 0.08, continuous: false, intervalMs: [2000, 5000] },
    snow_bridge:     { type: 'wind_gust',    noise: 'pink',  filtType: 'lowpass',  filtLo: 300, filtHi: 0,   envVol: 0.06, continuous: true,  lfoHz: 0.1, lfoDepth: 0.02 },
    blizzard_street: { type: 'wind_howl',    noise: 'white', filtType: 'bandpass', filtLo: 150, filtHi: 500, envVol: 0.07, continuous: true,  lfoHz: 0.3, lfoDepth: 0.04 }
  };

  // ---- Noise buffer cache ----
  var noiseBufferCache = {};

  function createNoiseBuffer(type) {
    if (noiseBufferCache[type]) return noiseBufferCache[type];
    var len = ctx.sampleRate * 2; // 2 seconds
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    if (type === 'pink') {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < len; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      for (var i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    noiseBufferCache[type] = buf;
    return buf;
  }

  // ---- Create drone oscillator chain for a scene ----
  function createDrone(sceneId) {
    var preset = DRONE_PRESETS[sceneId];
    if (!preset) return null;

    var osc = ctx.createOscillator();
    osc.type = preset.wave;
    osc.frequency.value = preset.freq;

    var lfoNodes = [];
    if (preset.lfoHz > 0 && preset.lfoTarget) {
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = preset.lfoHz;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = preset.lfoDepth;

      if (preset.lfoTarget === 'freq') {
        lfo.connect(lfoGain).connect(osc.frequency);
      } else if (preset.lfoTarget === 'gain') {
        // lfoGain will connect to droneGain later
        lfoNodes.push({ osc: lfo, gain: lfoGain, target: 'droneGain' });
        lfo.connect(lfoGain);
      } else if (preset.lfoTarget === 'filt') {
        // lfoGain will connect to filter.frequency later
        lfoNodes.push({ osc: lfo, gain: lfoGain, target: 'filtFreq' });
        lfo.connect(lfoGain);
      }
      lfo.start(0);
      lfoNodes.push({ osc: lfo, gain: lfoGain, target: preset.lfoTarget, _started: true });
    }

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.filtFreq;
    filter.Q.value = 1.0;

    // Connect LFO to filter frequency if that's the target
    for (var i = 0; i < lfoNodes.length; i++) {
      if (lfoNodes[i].target === 'filtFreq') {
        lfoNodes[i].gain.connect(filter.frequency);
      } else if (lfoNodes[i].target === 'freq') {
        // already connected to osc.frequency above
      }
    }

    var droneGain = ctx.createGain();
    droneGain.gain.value = 0; // start silent, ramp up

    osc.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(masterGain);

    // Connect LFO to droneGain if that's the target
    for (var i = 0; i < lfoNodes.length; i++) {
      if (lfoNodes[i].target === 'droneGain') {
        lfoNodes[i].gain.connect(droneGain.gain);
      }
    }

    osc.start(0);

    // H6: Dissonant drone layer for snow_bridge (fragments >= 3 + revisited)
    if (sceneId === 'snow_bridge' && typeof window !== 'undefined' && window.App &&
        window.App.memoryFragments >= 3 && window.App.visitedScenes &&
        window.App.visitedScenes.has('snow_bridge')) {
      var dissonantOsc = ctx.createOscillator();
      dissonantOsc.type = 'sine';
      dissonantOsc.frequency.value = 73;
      var dissonantLfo = ctx.createOscillator();
      dissonantLfo.type = 'sine';
      dissonantLfo.frequency.value = 0.13;
      var dissonantLfoGain = ctx.createGain();
      dissonantLfoGain.gain.value = 0.015;
      var dissonantGain = ctx.createGain();
      dissonantGain.gain.value = 0;
      dissonantLfo.connect(dissonantLfoGain);
      dissonantLfoGain.connect(dissonantGain.gain);
      dissonantOsc.connect(dissonantGain);
      dissonantGain.connect(masterGain);
      dissonantOsc.start(0);
      dissonantLfo.start(0);
      dissonantGain.gain.setValueAtTime(0, ctx.currentTime);
      dissonantGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
      lfoNodes.push({ osc: dissonantOsc, gain: dissonantGain, _dissonant: true });
      lfoNodes.push({ osc: dissonantLfo, gain: dissonantLfoGain, _dissonant: true });
    }

    return { osc: osc, filter: filter, gain: droneGain, lfoNodes: lfoNodes, vol: preset.droneVol };
  }

  // ---- Create environmental sound chain for a scene ----
  function createEnvironment(sceneId) {
    var preset = ENV_PRESETS[sceneId];
    if (!preset) return null;

    var noiseBuf = createNoiseBuffer(preset.noise);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = preset.continuous;

    var filter;
    if (preset.filtType === 'bandpass') {
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = (preset.filtLo + preset.filtHi) / 2;
      filter.Q.value = filter.frequency.value / (preset.filtHi - preset.filtLo);
    } else {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset.filtLo;
      filter.Q.value = 0.7;
    }

    var envGain = ctx.createGain();
    envGain.gain.value = 0; // start silent

    var lfoNodes = [];
    if (preset.lfoHz && preset.lfoHz > 0) {
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = preset.lfoHz;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = preset.lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(envGain.gain);
      lfo.start(0);
      lfoNodes.push({ osc: lfo, gain: lfoGain });
    }

    src.connect(filter);
    filter.connect(envGain);
    envGain.connect(masterGain);

    src.start(0);

    return { src: src, filter: filter, gain: envGain, lfoNodes: lfoNodes, vol: preset.envVol, continuous: preset.continuous };
  }

  // ---- Rain drip burst: short filtered noise pulses (H2: irregular mode on revisit+infection) ----
  function createRainDrips(sceneId) {
    var preset = ENV_PRESETS[sceneId];
    var noiseBuf = createNoiseBuffer('white');
    var active = true;

    // H2: Irregular drip mode when rain_underpass revisited + infection > 35
    var irregularDrips = (typeof window !== 'undefined' && window.App && window.App.visitedScenes &&
      window.App.visitedScenes.has('rain_underpass') && window.App.infectionLevel > 35);

    function triggerDrip() {
      if (!active) return;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;

      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 2;

      var env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(preset.envVol, ctx.currentTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      src.connect(filter);
      filter.connect(env);
      env.connect(masterGain);
      src.start(ctx.currentTime);
      src.stop(ctx.currentTime + 0.5);

      // H2: Double-drip (second pulse 0.3s later, 40% chance in irregular mode)
      if (irregularDrips && Math.random() < 0.4) {
        var src2 = ctx.createBufferSource();
        src2.buffer = noiseBuf;
        var filter2 = ctx.createBiquadFilter();
        filter2.type = 'bandpass';
        filter2.frequency.value = 600;
        filter2.Q.value = 3;
        var env2 = ctx.createGain();
        env2.gain.setValueAtTime(0, ctx.currentTime + 0.3);
        env2.gain.linearRampToValueAtTime(preset.envVol * 0.6, ctx.currentTime + 0.32);
        env2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        src2.connect(filter2);
        filter2.connect(env2);
        env2.connect(masterGain);
        src2.start(ctx.currentTime + 0.3);
        src2.stop(ctx.currentTime + 0.7);
      }

      // H2: Irregular interval (8-15s vs normal 2-5s)
      var minMs = irregularDrips ? 8000 : preset.intervalMs[0];
      var maxMs = irregularDrips ? 15000 : preset.intervalMs[1];
      var next = minMs + Math.random() * (maxMs - minMs);
      if (active) {
        setTimeout(triggerDrip, next);
      }
    }

    triggerDrip();

    return {
      dispose: function () { active = false; }
    };
  }

  // ---- Dreamcore music box fragments (distant, lo-fi, emotion-gated) ----
  var musicBoxActive = true;
  var musicBoxTimer = null;

  function scheduleMusicBoxFragment() {
    if (!musicBoxActive || !ctx) return;
    // Only trigger when emotion is very low (<= 30) — quiet, nostalgic moments
    var emotion = (typeof window !== 'undefined' && window.App) ? (window.App.emotionLevel || 0) : 0;
    if (emotion > 30) {
      // Emotion too high — check again later
      musicBoxTimer = setTimeout(scheduleMusicBoxFragment, 30000 + Math.random() * 30000);
      return;
    }
    playMusicBoxFragment();
    var next = 60000 + Math.random() * 120000;
    musicBoxTimer = setTimeout(scheduleMusicBoxFragment, next);
  }

  function playMusicBoxFragment() {
    if (!ctx) return;
    var now = ctx.currentTime;

    // Simple 4-note melody: root, fifth, octave, fifth (pentatonic fragment)
    var melody = [
      { freq: 880, start: 0, dur: 0.4 },
      { freq: 1320, start: 0.5, dur: 0.35 },
      { freq: 1760, start: 1.0, dur: 0.5 },
      { freq: 1320, start: 1.6, dur: 0.35 }
    ];

    for (var n = 0; n < melody.length; n++) {
      var note = melody[n];
      var t = now + note.start;

      // Fundamental
      var osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = note.freq + (Math.random() - 0.5) * 6;

      // Overtone (octave above, softer)
      var osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = note.freq * 2 + (Math.random() - 0.5) * 10;

      // Quick percussive envelope
      var env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.025, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + note.dur);

      // Distant bandpass (sounds like through a wall)
      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 800 + Math.random() * 600;
      filt.Q.value = 1.5;

      osc1.connect(filt);
      osc2.connect(filt);
      filt.connect(env);
      env.connect(masterGain);

      osc1.start(t);
      osc1.stop(t + note.dur + 0.1);
      osc2.start(t);
      osc2.stop(t + note.dur + 0.1);
    }
  }

  function startMusicBox() {
    if (musicBoxTimer) return;
    musicBoxActive = true;
    musicBoxTimer = setTimeout(scheduleMusicBoxFragment, 30000 + Math.random() * 60000);
  }

  function stopMusicBox() {
    musicBoxActive = false;
    if (musicBoxTimer) { clearTimeout(musicBoxTimer); musicBoxTimer = null; }
  }

  // ---- Public API ----

  function init() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : savedVolume;
      masterGain.connect(ctx.destination);

      // Resume on first user interaction (browser autoplay policy)
      var resumeOnInteract = function () {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        document.removeEventListener('click', resumeOnInteract);
        document.removeEventListener('keydown', resumeOnInteract);
        document.removeEventListener('touchstart', resumeOnInteract);
      };
      document.addEventListener('click', resumeOnInteract);
      document.addEventListener('keydown', resumeOnInteract);
      document.addEventListener('touchstart', resumeOnInteract);

      return ctx;
    } catch (e) {
      console.warn('[Audio] Web Audio API not available — running in silent mode');
      return null;
    }
  }

  function disposeNodes(nodes) {
    if (!nodes) return;
    try {
      if (nodes.drone) {
        var d = nodes.drone;
        try { d.osc.stop(); } catch(e) {}
        for (var i = 0; i < d.lfoNodes.length; i++) {
          try { d.lfoNodes[i].osc.stop(); } catch(e) {}
        }
      }
      if (nodes.env) {
        var e = nodes.env;
        try { e.src.stop(); } catch(e) {}
        for (var i = 0; i < e.lfoNodes.length; i++) {
          try { e.lfoNodes[i].osc.stop(); } catch(e) {}
        }
      }
      if (nodes.drips) {
        try { nodes.drips.dispose(); } catch(e) {}
      }
    } catch(e) {
      console.warn('[Audio] Error disposing nodes:', e);
    }
  }

  function switchScene(sceneId) {
    if (!sceneId || sceneId === currentScene) return;
    init();
    if (!ctx) return;

    var oldNodes = activeNodes[currentScene];
    currentScene = sceneId;

    // Create new scene audio
    var newDrone = createDrone(sceneId);
    var newEnv = createEnvironment(sceneId);
    var newDrips = null;
    if (sceneId === 'rain_underpass') {
      newDrips = createRainDrips(sceneId);
    }

    var newNodes = { drone: newDrone, env: newEnv, drips: newDrips, sceneId: sceneId };
    activeNodes[sceneId] = newNodes;

    // Start music box fragments (persistent, emotion-gated)
    startMusicBox();

    // Ramp in new audio
    var now = ctx.currentTime;
    var rampEnd = now + crossfadeMs / 1000;

    if (newDrone) {
      newDrone.gain.gain.setValueAtTime(0, now);
      newDrone.gain.gain.linearRampToValueAtTime(newDrone.vol, rampEnd);
    }
    if (newEnv) {
      newEnv.gain.gain.setValueAtTime(0, now);
      newEnv.gain.gain.linearRampToValueAtTime(newEnv.vol, rampEnd);
    }

    // Ramp out and dispose old audio
    if (oldNodes) {
      if (oldNodes.drone) {
        oldNodes.drone.gain.gain.linearRampToValueAtTime(0, rampEnd);
      }
      if (oldNodes.env) {
        oldNodes.env.gain.gain.linearRampToValueAtTime(0, rampEnd);
      }
      (function (nodes) {
        setTimeout(function () { disposeNodes(nodes); }, crossfadeMs + 200);
      })(oldNodes);
    }
  }

  function dispose() {
    stopMusicBox();
    var scenes = Object.keys(activeNodes);
    for (var i = 0; i < scenes.length; i++) {
      disposeNodes(activeNodes[scenes[i]]);
    }
    activeNodes = {};
    currentScene = null;
  }

  function setMasterVolume(v) {
    savedVolume = Math.max(0, Math.min(1, v));
    if (!muted && masterGain) {
      masterGain.gain.value = savedVolume;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (!masterGain) return muted;
    if (muted) {
      masterGain.gain.value = 0;
    } else {
      masterGain.gain.value = savedVolume;
    }
    return muted;
  }

  return {
    init: init,
    switchScene: switchScene,
    dispose: dispose,
    setMasterVolume: setMasterVolume,
    toggleMute: toggleMute
  };
})();
