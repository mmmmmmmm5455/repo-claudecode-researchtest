/* Scene 2: Snow Night Bridge — PS1 Liminal Space
 * Warm yellow highlight + pure black, 5500K highlights, -2.5EV
 * 16x16 pixel blocks, 70% dead black (RGB 0-20), 1:20 extreme light ratio
 * Single center streetlight as sole illumination
 * Hooks: H4 (footprints), H5 (extra lit window)
 * Exports via window.createScene_snow_bridge
 */
function createScene_snow_bridge() {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a10);
    scene.fog = new THREE.FogExp2(0x0a3a50, 0.0015);
    scene.userData.fogDensityBase = 0.0015;

    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 150);
    camera.position.set(0, 1.8, 6);

    var visitCount = (window.App && window.App.visitCounts && window.App.visitCounts.snow_bridge) || 0;
    var infected = (window.App && window.App.infectionLevel) || 0;
    var isRevisit = window.App && window.App.visitedScenes && window.App.visitedScenes.has('snow_bridge');

    // Minimal ambient — 70% dead black requirement
    scene.add(new THREE.AmbientLight(0x0a1520, 0.08));

    // Single streetlight, 1:20 light ratio
    var streetlight = new THREE.PointLight(0x00d4f0, 4.5, 14);
    streetlight.position.set(0, 5, -1);
    scene.add(streetlight);

    // Pole
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0, flatShading: true });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 8), poleMat);
    pole.position.set(0, 2, -1.5);
    scene.add(pole);

    // Housing
    var housingMat = new THREE.MeshStandardMaterial({
        color: 0x1a4a55, roughness: 0.3, emissive: 0x007a80, emissiveIntensity: 2.5, flatShading: true
    });
    var housing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8), housingMat);
    housing.position.set(0, 5.3, -1.5);
    scene.add(housing);

    // Bridge surface
    var bridgeMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 1.0, flatShading: true });
    var bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 30), bridgeMat);
    bridge.position.y = -0.5;
    scene.add(bridge);

    // Railings
    for (var z = -12; z <= 12; z += 4) {
        var railGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
        var r1 = new THREE.Mesh(railGeo, poleMat);
        r1.position.set(3.5, 0.3, z);
        scene.add(r1);
        var r2 = new THREE.Mesh(railGeo, poleMat);
        r2.position.set(-3.5, 0.3, z);
        scene.add(r2);
    }

    // Distant housing block (for H5 window hook)
    var bldgMat2 = new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 1.0, flatShading: true });
    var distBuilding = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 1.5), bldgMat2);
    distBuilding.position.set(5, 0.8, -30);
    scene.add(distBuilding);

    // Windows on distant housing — 3 always lit, 1 toggled by H5
    var winLit = new THREE.MeshBasicMaterial({ color: 0x00bcd4 });
    var winDark = new THREE.MeshBasicMaterial({ color: 0x001111 });
    var winGeo = new THREE.PlaneGeometry(0.3, 0.4);
    var windowPositions = [
        { x: 4.4, y: 2.2, z: -29.2 },
        { x: 4.8, y: 2.2, z: -29.2 },
        { x: 5.2, y: 2.2, z: -29.2 },
        { x: 5.6, y: 3.0, z: -29.2 }  // top floor, far right — dark on first visit
    ];
    var fourthWindow = null;
    for (var wi = 0; wi < windowPositions.length; wi++) {
        var wp = windowPositions[wi];
        var isFourth = (wi === 3);
        var wMat = isFourth ? winDark : winLit;
        if (isFourth && isRevisit && infected > 40) wMat = winLit; // H5: light it up
        var wMesh = new THREE.Mesh(winGeo, wMat);
        wMesh.position.set(wp.x, wp.y, wp.z);
        scene.add(wMesh);
        if (isFourth) fourthWindow = wMesh;
    }

    // Dreamcore memory clue: warm ember point light on bridge surface (approx 3000K)
    var emberLight = new THREE.PointLight(0xffab00, 0.35, 8);
    emberLight.position.set(-2.5, -0.2, -2);
    scene.add(emberLight);

    // Dreamcore memory trace: faded photograph on bridge surface
    var photoCanvas = document.createElement('canvas');
    photoCanvas.width = 64; photoCanvas.height = 48;
    var pctx = photoCanvas.getContext('2d');
    pctx.fillStyle = '#ccaa88'; pctx.fillRect(0, 0, 64, 48);
    pctx.fillStyle = '#886644'; pctx.fillRect(8, 6, 20, 16);
    pctx.fillStyle = '#aa9977'; pctx.fillRect(36, 8, 14, 20);
    var photoTex = new THREE.CanvasTexture(photoCanvas);
    photoTex.minFilter = THREE.NearestFilter; photoTex.magFilter = THREE.NearestFilter;
    var photoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.3),
        new THREE.MeshBasicMaterial({ map: photoTex, transparent: true, opacity: 0.6, depthTest: true })
    );
    photoMesh.rotation.x = -Math.PI / 2 + 0.05;
    photoMesh.position.set(-2.8, -0.34, -3.5);
    photoMesh.name = 'memory_photo';
    scene.add(photoMesh);

        // H4: Footprints in snow (visit >= 2)
    if (isRevisit && visitCount >= 2) {
        var fpMat = new THREE.MeshStandardMaterial({ color: 0x8098b0, roughness: 1.0, flatShading: true });
        for (var fi = 0; fi < 8; fi++) {
            var fpGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.02, 6);
            var fp = new THREE.Mesh(fpGeo, fpMat);
            fp.position.set(1.8 + fi * 0.35, -0.33, -4 + fi * 0.7);
            fp.rotation.x = Math.PI * 0.05;
            scene.add(fp);
        }
    }

    // Snow particles
    var snowCount = 400;
    var snowGeo = new THREE.BufferGeometry();
    var snowPositions = new Float32Array(snowCount * 3);
    var snowVelocities = new Float32Array(snowCount);
    for (var i = 0; i < snowCount; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 20;
        snowPositions[i * 3 + 1] = Math.random() * 12;
        snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        snowVelocities[i] = 0.01 + Math.random() * 0.03;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    var snowMat = new THREE.PointsMaterial({
        color: 0xc0d8f0, size: 0.15, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending
    });
    var snow = new THREE.Points(snowGeo, snowMat);
    scene.add(snow);

    // Film grain overlay (PS1 noise, 15% opacity — subtle in darkness)
    var grainCount = 150;
    var grainGeo = new THREE.BufferGeometry();
    var grainPositions = new Float32Array(grainCount * 3);
    for (var gi = 0; gi < grainCount; gi++) {
        grainPositions[gi * 3] = (Math.random() - 0.5) * 16;
        grainPositions[gi * 3 + 1] = (Math.random() - 0.5) * 10;
        grainPositions[gi * 3 + 2] = -1;
    }
    grainGeo.setAttribute('position', new THREE.BufferAttribute(grainPositions, 3));
    var grainMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.04, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
    });
    var grain = new THREE.Points(grainGeo, grainMat);
    grain.position.z = -1;
    scene.add(grain);

    function animate(dt, elapsed) {
        var pos = snow.geometry.attributes.position.array;
        for (var i = 0; i < snowCount; i++) {
            pos[i * 3 + 1] -= snowVelocities[i];
            pos[i * 3] += Math.sin(elapsed + i) * 0.005;
            if (pos[i * 3 + 1] < -2) {
                pos[i * 3 + 1] = 11;
                pos[i * 3] = (Math.random() - 0.5) * 20;
            }
        }
        snow.geometry.attributes.position.needsUpdate = true;
        // Film grain random update
        var gpos = grain.geometry.attributes.position.array;
        for (var gi = 0; gi < grainCount; gi++) {
            gpos[gi * 3] = (Math.random() - 0.5) * 16;
            gpos[gi * 3 + 1] = (Math.random() - 0.5) * 10;
        }
        grain.geometry.attributes.position.needsUpdate = true;
        var flicker = 1.0 - Math.random() * 0.05;
        streetlight.intensity = 4.5 * flicker;
    }

    function dispose() {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    return { scene: scene, camera: camera, animate: animate, dispose: dispose };
}
window['createScene_snow_bridge'] = createScene_snow_bridge;
