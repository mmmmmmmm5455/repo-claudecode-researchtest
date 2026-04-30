/* background.js — PS1 Scene Manager with post-processing + crossfade + CRT transition
 * Owns the WebGLRenderer, render targets, and animation loop.
 * Scenes return { scene, camera, animate, dispose } — NO renderer creation.
 * Post-processing: scene → low-res RT → PS1 fragment shader → screen.
 * Crossfade: 3-second blend + CRT noise transition.
 * Exports: BackgroundManager { start, switchScene, getCurrentScene }
 */
var BackgroundManager = (function () {
  'use strict';

  var container, renderer, screenCamera, screenScene, screenMaterial;
  var sceneRT, prevRT, clock;
  var currentSceneName = null;
  var currentSceneObj = null;
  var animId = null;
  var transitionActive = false;
  var transitionStart = 0;
  var fogDensityVariation = 0;
  var fogDensityTimer = 0;
  var fogDensityInterval = 3 + Math.random() * 2;

  var fullscreenVert = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  var postFrag = [
    'uniform sampler2D uScene;',
    'uniform sampler2D uPrevScene;',
    'uniform float uTime;',
    'uniform float uTransition;',
    'uniform vec2 uResolution;',
    'uniform float uCrtIntensity;',
    'varying vec2 vUv;',
    'float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898,78.233)))*43758.5453); }',
    'vec2 barrelDistort(vec2 uv, float k) {',
    '  vec2 centered = uv - 0.5;',
    '  float r2 = dot(centered, centered);',
    '  float f = 1.0 + k * r2;',
    '  return 0.5 + centered * f;',
    '}',
    'void main() {',
    '  vec2 uv = barrelDistort(vUv, -0.12 * uCrtIntensity);',
    '  vec4 color = texture2D(uScene, uv);',
    '  if (uTransition > 0.0) {',
    '    vec4 prev = texture2D(uPrevScene, uv);',
    '    color = mix(prev, color, uTransition);',
    '  }',
    '  float sl = sin(uv.y * uResolution.y * 0.7) * 0.03;',
    '  float ns = rand(uv + floor(uTime*60.0)*0.01) * 0.08;',
    '  float fl = rand(vec2(floor(uTime*30.0), 0.0)) * 0.05;',
    '  color.rgb += sl + ns - fl;',
    '  float rs = rand(vec2(uv.y*100.0, uTime)) * 0.003;',
    '  color.r = texture2D(uScene, uv + vec2(rs, 0.0)).r;',
    '  color.rgb = floor(color.rgb * 31.0) / 31.0;',
    '  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));',
    '  color.rgb = mix(color.rgb, vec3(0.0, 0.2, 0.267), (1.0-lum)*0.6);',
    '  float band = floor(lum * 16.0) / 16.0;',
    '  color.rgb += (band - lum) * 0.08;',
    '  color.rgb *= 1.0 - length(uv - 0.5) * 0.5;',
    '  gl_FragColor = color;',
    '}'
  ].join('\n');

  function start(initialScene) {
    container = document.getElementById('bg-container');
    if (!container || typeof THREE === 'undefined') return;
    clock = new THREE.Clock();
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.imageRendering = 'pixelated';
    container.appendChild(renderer.domElement);
    var rtW = Math.max(160, Math.floor(window.innerWidth / 4));
    var rtH = Math.max(120, Math.floor(window.innerHeight / 4));
    sceneRT = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat
    });
    prevRT = new THREE.WebGLRenderTarget(rtW, rtH, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat
    });
    screenScene = new THREE.Scene();
    screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    screenMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert, fragmentShader: postFrag,
      uniforms: {
        uScene: { value: sceneRT.texture }, uPrevScene: { value: prevRT.texture },
        uTime: { value: 0 }, uTransition: { value: 0 },
        uResolution: { value: new THREE.Vector2(rtW, rtH) },
        uCrtIntensity: { value: 1.0 }
      },
      depthTest: false, depthWrite: false
    });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMaterial);
    screenScene.add(quad);
    sceneRT.texture.minFilter = THREE.NearestFilter;
    sceneRT.texture.magFilter = THREE.NearestFilter;
    prevRT.texture.minFilter = THREE.NearestFilter;
    prevRT.texture.magFilter = THREE.NearestFilter;
    window.addEventListener('resize', onResize);
    switchScene(initialScene || 'fog_highway');
    animLoop();
  }

  function onResize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    var rtW = Math.max(160, Math.floor(window.innerWidth / 4));
    var rtH = Math.max(120, Math.floor(window.innerHeight / 4));
    sceneRT.setSize(rtW, rtH);
    prevRT.setSize(rtW, rtH);
    screenMaterial.uniforms.uResolution.value.set(rtW, rtH);
    if (currentSceneObj && currentSceneObj.camera) {
      currentSceneObj.camera.aspect = window.innerWidth / window.innerHeight;
      currentSceneObj.camera.updateProjectionMatrix();
    }
  }

  function animLoop() {
    animId = requestAnimationFrame(animLoop);
    var elapsed = clock.getElapsedTime();
    if (transitionActive) {
      var p = Math.min(1, (performance.now() - transitionStart) / 3000);
      screenMaterial.uniforms.uTransition.value = p;
      if (p >= 1) { transitionActive = false; }
    }
    screenMaterial.uniforms.uTime.value = elapsed;
    if (currentSceneObj && currentSceneObj.animate) {
      currentSceneObj.animate(clock.getDelta(), elapsed);
    }
    // P2-FOG-01: procedural fog density random walk ±15%, update every 3-5s
    // H8: Dynamic infection-gated fog boost/revert on fog_highway
    fogDensityTimer += clock.getDelta();
    if (fogDensityTimer >= fogDensityInterval && currentSceneObj && currentSceneObj.scene && currentSceneObj.scene.fog) {
      fogDensityTimer = 0;
      fogDensityInterval = 3 + Math.random() * 2;
      if (currentSceneObj.scene.fog.density !== undefined) {
        var originalBase = currentSceneObj.scene.userData._originalFogDensityBase;
        var baseDensity = (originalBase !== undefined) ? originalBase
          : (currentSceneObj.scene.userData.fogDensityBase || currentSceneObj.scene.fog.density);
        if (originalBase === undefined) {
          currentSceneObj.scene.userData._originalFogDensityBase = baseDensity;
        }
        currentSceneObj.scene.userData.fogDensityBase = baseDensity;
        fogDensityVariation = (Math.random() - 0.5) * 0.30;

        // H8: Check infection for boost/revert
        var effectiveBase = baseDensity;
        if (currentSceneName === 'fog_highway') {
          var infected = (typeof window !== 'undefined' && window.App && window.App.infectionLevel) || 0;
          var visited = (typeof window !== 'undefined' && window.App && window.App.visitedScenes &&
            window.App.visitedScenes.has('fog_highway'));
          if (infected > 60 && visited) {
            effectiveBase = baseDensity * 1.4;
          }
        }
        currentSceneObj.scene.fog.density = effectiveBase * (1.0 + fogDensityVariation);
      }
    }
    // Update PS1 vertex wobble time on all scene materials
    if (currentSceneObj && currentSceneObj.scene) {
      updateWobbleTime(currentSceneObj.scene, elapsed);
    }

    if (currentSceneObj && currentSceneObj.scene && currentSceneObj.camera) {
      renderer.setRenderTarget(sceneRT);
      renderer.render(currentSceneObj.scene, currentSceneObj.camera);
    }
    renderer.setRenderTarget(null);
    renderer.render(screenScene, screenCamera);
  }

  function switchScene(sceneName) {
    if (sceneName === currentSceneName && currentSceneObj && !transitionActive) return;
    if (currentSceneObj && currentSceneObj.scene && currentSceneObj.camera) {
      renderer.setRenderTarget(prevRT);
      renderer.render(currentSceneObj.scene, currentSceneObj.camera);
      renderer.setRenderTarget(null);
      screenMaterial.uniforms.uPrevScene.value = prevRT.texture;
    }
    if (currentSceneObj && currentSceneObj.dispose) {
      try {
        currentSceneObj.dispose();
      } catch (e) {
        console.error('Error disposing scene ' + currentSceneName + ':', e);
      }
      currentSceneObj = null;
    }
    currentSceneName = sceneName;
    var createFn = window['createScene_' + sceneName];
    if (typeof createFn === 'function') {
      try {
        currentSceneObj = createFn();
        if (!currentSceneObj || !currentSceneObj.scene) {
          throw new Error('Scene factory returned null or missing scene for ' + sceneName);
        }
        injectVertexWobble(currentSceneObj.scene);
        setNearestFiltering(currentSceneObj.scene);

        // H8: Preserve immutable original fog density for dynamic boost/revert
        if (sceneName === 'fog_highway' && currentSceneObj.scene && currentSceneObj.scene.fog &&
            currentSceneObj.scene.fog.density !== undefined) {
          if (currentSceneObj.scene.userData.fogDensityBase !== undefined) {
            currentSceneObj.scene.userData._originalFogDensityBase = currentSceneObj.scene.userData.fogDensityBase;
          }
        }
      } catch (e) {
        console.error('Scene load failed for ' + sceneName + ', falling back to fog_highway:', e);
        currentSceneName = 'fog_highway';
        var fallbackFn = window['createScene_fog_highway'];
        if (typeof fallbackFn === 'function') {
          currentSceneObj = fallbackFn();
          if (currentSceneObj && currentSceneObj.scene) {
            injectVertexWobble(currentSceneObj.scene);
            setNearestFiltering(currentSceneObj.scene);
          }
        }
      }
    } else {
      // BUG-05 fix: fallback when scene factory doesn't exist (script failed to load)
      console.error('Scene factory missing for ' + sceneName + ', falling back to fog_highway');
      currentSceneName = 'fog_highway';
      var fallbackFn = window['createScene_fog_highway'];
      if (typeof fallbackFn === 'function') {
        currentSceneObj = fallbackFn();
        if (currentSceneObj && currentSceneObj.scene) {
          injectVertexWobble(currentSceneObj.scene);
          setNearestFiltering(currentSceneObj.scene);
        }
      }
    }
    transitionActive = true;
    transitionStart = performance.now();
    screenMaterial.uniforms.uTransition.value = 0;
  }

  var _wobbleInjected = new WeakSet();
  function injectVertexWobble(scene) {
    scene.traverse(function (obj) {
      if (!obj.material || _wobbleInjected.has(obj.material)) return;
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(function (mat) {
        if (!mat || !mat.isMaterial || _wobbleInjected.has(mat)) return;
        _wobbleInjected.add(mat);
        mat.onBeforeCompile = function (shader) {
          shader.uniforms.uTimeWobble = { value: 0 };
          shader.vertexShader = 'uniform float uTimeWobble;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n' +
            'float _w = sin(transformed.y * 100.0 + uTimeWobble) * 0.3;\n' +
            'transformed.x += _w;\n' +
            'transformed = floor(transformed * 32.0) / 32.0;'
          );
          mat._wobbleShader = shader;
        };
      });
    });
  }

  function setNearestFiltering(scene) {
    scene.traverse(function (obj) {
      if (!obj.material) return;
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(function (mat) {
        if (mat.map) { mat.map.minFilter = THREE.NearestFilter; mat.map.magFilter = THREE.NearestFilter; }
      });
    });
  }

  function updateWobbleTime(scene, t) {
    scene.traverse(function (obj) {
      if (!obj.material) return;
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(function (mat) {
        if (mat._wobbleShader && mat._wobbleShader.uniforms) {
          mat._wobbleShader.uniforms.uTimeWobble.value = t;
        }
      });
    });
  }

  function getCurrentScene() { return currentSceneName; }
  function setCrtIntensity(v) {
    if (screenMaterial && screenMaterial.uniforms) {
      screenMaterial.uniforms.uCrtIntensity.value = Math.max(0, Math.min(1, v));
    }
  }

  function toggleCrt() {
    if (!screenMaterial || !screenMaterial.uniforms) return 0;
    var cur = screenMaterial.uniforms.uCrtIntensity.value;
    var next = cur > 0.5 ? 0.0 : 1.0;
    screenMaterial.uniforms.uCrtIntensity.value = next;
    return next;
  }

  return { start: start, switchScene: switchScene, getCurrentScene: getCurrentScene, setCrtIntensity: setCrtIntensity, toggleCrt: toggleCrt };
})();
