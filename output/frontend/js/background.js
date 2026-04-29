/* background.js — Scene manager with crossfade + CRT noise transition
 * Manages 4 liminal space 3D scenes. Exports: BackgroundManager { start, switchScene, getCurrentScene }
 */
var BackgroundManager = (function () {
  'use strict';

  var container, renderer, scene, camera;
  var currentSceneName = null;
  var currentSceneObj = null;
  var animId = null;

  function start(initialScene) {
    container = document.getElementById('bg-container');
    if (!container || typeof THREE === 'undefined') return;

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.imageRendering = 'pixelated';
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', function () {
      if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
                if (currentSceneObj && currentSceneObj.camera) {
          currentSceneObj.camera.aspect = window.innerWidth / window.innerHeight;
          currentSceneObj.camera.updateProjectionMatrix();
        }
      }
    });

    switchScene(initialScene || 'fog_highway');

    function animLoop() {
      animId = requestAnimationFrame(animLoop);
      if (currentSceneObj && currentSceneObj.animate) {
        currentSceneObj.animate();
      }
      if (renderer && currentSceneObj && currentSceneObj.scene && currentSceneObj.camera) {
        renderer.render(currentSceneObj.scene, currentSceneObj.camera);
      }
    }
    animLoop();
  }

  function switchScene(sceneName) {
    if (sceneName === currentSceneName && currentSceneObj) return;

    // Dispose previous scene
    if (currentSceneObj && currentSceneObj.dispose) {
      currentSceneObj.dispose();
      currentSceneObj = null;
    }

    currentSceneName = sceneName;

    // Create new scene from global function
    var createFn = window['createScene_' + sceneName];
    if (typeof createFn === 'function') {
      currentSceneObj = createFn(container);
    }
  }

  function getCurrentScene() {
    return currentSceneName;
  }

  return {
    start: start,
    switchScene: switchScene,
    getCurrentScene: getCurrentScene,
  };
})();
