/* Scene 1: Rainy Underpass — PS1 Liminal Space
 * Cold gray + dark blue, 10000K, -1.5EV, rain blur 10px, 6x6 pixel blocks
 * Single distant warm window light (the only life sign)
 * Hooks: H1 (graffiti decal), H3 (fluorescent flicker)
 * Exports via window.createScene_rain_underpass
 */
function createScene_rain_underpass() {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.Fog(0x001a2e, 10, 80);

    var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 200);
    camera.position.set(0, 1.6, 8);

    // Lighting: low ambient + single distant warm window
    scene.add(new THREE.AmbientLight(0x1a2530, 0.3));
    var windowLight = new THREE.PointLight(0x00bcd4, 0.8, 30);
    windowLight.position.set(0, 3, -25);
    scene.add(windowLight);

    // H3: Fluorescent ceiling light
    var fluorescent = new THREE.PointLight(0xaaccff, 0.4, 10);
    fluorescent.position.set(0, 3.5, 2);
    scene.add(fluorescent);

    var visitCount = (window.App && window.App.visitCounts && window.App.visitCounts.rain_underpass) || 0;
    var infected = (window.App && window.App.infectionLevel) || 0;

    // Floor: cracked concrete
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.95, flatShading: true });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 80, 16, 32), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    scene.add(floor);

    // Ceiling
    var ceilMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 1.0, flatShading: true });
    var ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 80), ceilMat);
    ceiling.position.y = 4;
    scene.add(ceiling);

    // Left wall
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.9, flatShading: true });
    var leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 80), wallMat);
    leftWall.position.set(-6, 1.5, -5);
    scene.add(leftWall);

    // Right wall
    var rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 80), wallMat);
    rightWall.position.set(6, 1.5, -5);
    scene.add(rightWall);

    // Distant building
    var bldgMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 1.0, flatShading: true });
    var building = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 2), bldgMat);
    building.position.set(1, 1, -30);
    scene.add(building);

    // Warm window
    var winMat = new THREE.MeshBasicMaterial({ color: 0x00bcd4 });
    var windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), winMat);
    windowMesh.position.set(1.4, 2.5, -29);
    scene.add(windowMesh);

    // H1: Graffiti decal — "你還在嗎" on right wall (visit >= 2)
    if (window.App && window.App.visitedScenes && window.App.visitedScenes.has('rain_underpass') && visitCount >= 2) {
        var canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,229,255,0.35)';
        ctx.font = '28px "VT323", "Silkscreen", monospace';
        ctx.fillText('你還在嗎', 60, 70);
        var graffitiTex = new THREE.CanvasTexture(canvas);
        graffitiTex.minFilter = THREE.NearestFilter;
        graffitiTex.magFilter = THREE.NearestFilter;
        var graffitiMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(3.5, 0.9),
            new THREE.MeshBasicMaterial({ map: graffitiTex, transparent: true, depthTest: false, depthWrite: false })
        );
        graffitiMesh.position.set(5.8, 1.6, -6);
        graffitiMesh.name = 'hook_graffiti';
        scene.add(graffitiMesh);
    }

    // Dreamcore memory clue: warm light in distant second window (approx 3200K)
    var memoryWindowLight = new THREE.PointLight(0xff8844, 0.25, 12);
    memoryWindowLight.position.set(-1.5, 2.5, -28);
    scene.add(memoryWindowLight);

    // Dreamcore memory trace: unexplainable key on the ground
    var keyHeadGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8);
    var keyShaftGeo = new THREE.BoxGeometry(0.03, 0.02, 0.18);
    var keyMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.3, metalness: 0.6, flatShading: true });
    var keyHead = new THREE.Mesh(keyHeadGeo, keyMat);
    keyHead.rotation.x = Math.PI / 2;
    keyHead.position.set(4.2, -0.48, -4);
    var keyShaft = new THREE.Mesh(keyShaftGeo, keyMat);
    keyShaft.position.set(4.2, -0.48, -4.1);
    var keyGroup = new THREE.Group();
    keyGroup.add(keyHead);
    keyGroup.add(keyShaft);
    keyGroup.name = 'memory_key';
    scene.add(keyGroup);

        // Rain particle system (600 drops)
    var rainCount = 600;
    var rainGeo = new THREE.BufferGeometry();
    var rainPositions = new Float32Array(rainCount * 3);
    var rainVelocities = new Float32Array(rainCount);
    for (var i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 30;
        rainPositions[i * 3 + 1] = Math.random() * 15;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        rainVelocities[i] = 0.05 + Math.random() * 0.1;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    var rainMat = new THREE.PointsMaterial({
        color: 0x88aacc, size: 0.08, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
    });
    var rain = new THREE.Points(rainGeo, rainMat);
    scene.add(rain);

    // H3: Fluorescent flicker via setTimeout scheduling (3rd+ visit)
    var flickerAlive = true;

    function scheduleFlicker() {
        if (!flickerAlive) return;
        var delay = 10000 + Math.random() * 20000;
        setTimeout(function () {
            if (!flickerAlive) return;
            fluorescent.intensity = 0;
            setTimeout(function () { if (flickerAlive && fluorescent) fluorescent.intensity = 0.4; }, 32);
            scheduleFlicker();
        }, delay);
    }
    if (visitCount >= 3) scheduleFlicker();

    function animate(dt, elapsed) {
        var pos = rain.geometry.attributes.position.array;
        for (var i = 0; i < rainCount; i++) {
            pos[i * 3 + 1] -= rainVelocities[i];
            if (pos[i * 3 + 1] < -2) {
                pos[i * 3 + 1] = 14;
                pos[i * 3] = (Math.random() - 0.5) * 30;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
            }
        }
        rain.geometry.attributes.position.needsUpdate = true;
        camera.position.x = Math.sin(elapsed * 0.3) * 0.08;
    }

    function dispose() {
        flickerAlive = false;
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
    }

    return { scene: scene, camera: camera, animate: animate, dispose: dispose };
}
window['createScene_rain_underpass'] = createScene_rain_underpass;
