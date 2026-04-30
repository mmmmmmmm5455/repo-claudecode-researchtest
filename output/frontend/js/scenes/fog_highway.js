/* Scene 3: Fog Highway — PS1 Liminal Space
 * Gray-white + gray-black, 9500K, -1.8EV, -10% contrast
 * 50m visibility fog, 30% distant opacity
 * Hooks: H7 (car wreck)
 * Exports via window.createScene_fog_highway
 */
function createScene_fog_highway() {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1c20);
    scene.fog = new THREE.FogExp2(0x8a9bb0, 0.0015);
    scene.userData.fogDensityBase = 0.0015;

    var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 120);
    camera.position.set(0, 1.6, 5);

    var visitCount = (window.App && window.App.visitCounts && window.App.visitCounts.fog_highway) || 0;
    var isRevisit = window.App && window.App.visitedScenes && window.App.visitedScenes.has('fog_highway');

    scene.add(new THREE.AmbientLight(0x7088a0, 0.25));
    var highwayLight = new THREE.PointLight(0xaaccff, 1.2, 40);
    highwayLight.position.set(0, 8, -30);
    scene.add(highwayLight);

    // Road
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.95, flatShading: true });
    var road = new THREE.Mesh(new THREE.PlaneGeometry(14, 100, 8, 32), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = -1.2;
    scene.add(road);

    // Dashed center line (30% opacity)
    for (var z = -40; z < 40; z += 6) {
        var dashMat = new THREE.MeshBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.3 });
        var dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(0, -1.18, z);
        scene.add(dash);
    }

    // Guardrails
    var postMat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 1.0, flatShading: true });
    for (var z = -35; z <= 35; z += 5) {
        var pGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.2, 6);
        var pL = new THREE.Mesh(pGeo, postMat);
        pL.position.set(6.5, -0.5, z);
        scene.add(pL);
        var pR = new THREE.Mesh(pGeo, postMat);
        pR.position.set(-6.5, -0.5, z);
        scene.add(pR);
    }

    // Distant overpass
    var overpassMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 1.0, flatShading: true });
    var overpass = new THREE.Mesh(new THREE.BoxGeometry(16, 1.5, 3), overpassMat);
    overpass.position.set(0, 2.5, -45);
    scene.add(overpass);

    // Light poles fading into fog (30% distant opacity)
    for (var z = -35; z <= -10; z += 8) {
        var dist = Math.abs(z);
        var opacity = Math.max(0.05, 0.3 * (1 - dist / 50));
        var poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 4, 6);
        var poleMat2 = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1.0, flatShading: true, transparent: true, opacity: opacity });
        var pole1 = new THREE.Mesh(poleGeo, poleMat2);
        pole1.position.set(5, 1, z);
        scene.add(pole1);
        var pole2 = new THREE.Mesh(poleGeo, poleMat2.clone());
        pole2.position.set(-5, 1, z);
        scene.add(pole2);
    }

    // H7: Abandoned car wreck at fog distance (visit >= 2)
    if (isRevisit && visitCount >= 2) {
        var wreckGroup = new THREE.Group();
        var wreckMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.9, flatShading: true });
        // Car body
        var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 3.5), wreckMat);
        body.position.y = 0.3;
        wreckGroup.add(body);
        // Cabin
        var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.8), wreckMat);
        cabin.position.set(0, 0.8, -0.2);
        wreckGroup.add(cabin);
        // Hazard light (faint cold amber pulse)
        var hazardGeo = new THREE.SphereGeometry(0.08, 4, 4);
        var hazardMat = new THREE.MeshBasicMaterial({ color: 0x00bcd4 });
        var hazardLight = new THREE.Mesh(hazardGeo, hazardMat);
        hazardLight.position.set(0, 0.6, -1.8);
        wreckGroup.add(hazardLight);
        wreckGroup.position.set(3.5, -0.9, -38);
        wreckGroup.rotation.y = 0.3;
        wreckGroup.name = 'hook_car_wreck';
        scene.add(wreckGroup);
    }

    // Fog particles
    var fogCount = 300;
    var fogGeo = new THREE.BufferGeometry();
    var fogPositions = new Float32Array(fogCount * 3);
    var fogVelocities = new Float32Array(fogCount);
    for (var i = 0; i < fogCount; i++) {
        fogPositions[i * 3] = (Math.random() - 0.5) * 30;
        fogPositions[i * 3 + 1] = Math.random() * 8;
        fogPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
        fogVelocities[i] = 0.005 + Math.random() * 0.015;
    }
    fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPositions, 3));
    var fogMat = new THREE.PointsMaterial({
        color: 0x8899aa, size: 0.6, transparent: true, opacity: 0.15, blending: THREE.NormalBlending
    });
    var fogParticles = new THREE.Points(fogGeo, fogMat);
    scene.add(fogParticles);

    // H7 hazard light blink timer
    var hazardBlink = 0;
    var hasWreck = (isRevisit && visitCount >= 2);

    function animate(dt, elapsed) {
        var pos = fogParticles.geometry.attributes.position.array;
        for (var i = 0; i < fogCount; i++) {
            pos[i * 3 + 2] += fogVelocities[i];
            pos[i * 3] += Math.sin(elapsed * 0.5 + i * 0.1) * 0.01;
            if (pos[i * 3 + 2] > 25) {
                pos[i * 3 + 2] = -35;
                pos[i * 3] = (Math.random() - 0.5) * 30;
            }
        }
        fogParticles.geometry.attributes.position.needsUpdate = true;
        camera.position.x = Math.sin(elapsed * 0.2) * 0.12;
        camera.position.y = 1.6 + Math.sin(elapsed * 0.4) * 0.06;

        // H7: Hazard light blink (1-3s irregular)
        if (hasWreck) {
            hazardBlink += dt;
            var wreck = scene.getObjectByName('hook_car_wreck');
            if (wreck && hazardBlink > 1 + Math.random() * 2) {
                hazardBlink = 0;
                var hl = wreck.children[2]; // hazard light sphere
                if (hl && hl.material) {
                    hl.material.opacity = hl.material.opacity > 0.5 ? 0.1 : 0.8;
                    hl.material.transparent = true;
                }
            }
        }
    }

    function dispose() {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    return { scene: scene, camera: camera, animate: animate, dispose: dispose };
}
window['createScene_fog_highway'] = createScene_fog_highway;
