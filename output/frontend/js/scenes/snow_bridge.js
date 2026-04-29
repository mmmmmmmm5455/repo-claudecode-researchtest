/* Scene 2: Snow Night Bridge — PS1 Liminal Space
 * Warm yellow highlight + pure black, 5500K highlights, -2.5EV
 * 16x16 pixel blocks, 70% dead black (RGB 0-20), 1:20 extreme light ratio
 * Single center streetlight as sole illumination
 * Exports via window.createScene_snow_bridge
 */
function createScene_snow_bridge() {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x003344, 0.0012);
    scene.userData.fogDensityBase = 0.0012;

    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 150);
    camera.position.set(0, 1.8, 6);

    // Minimal ambient — 70% dead black requirement
    scene.add(new THREE.AmbientLight(0x000511, 0.05));

    // Single streetlight, 1:20 light ratio
    var streetlight = new THREE.PointLight(0x00bcd4, 4.0, 12);
    streetlight.position.set(0, 5, -1);
    scene.add(streetlight);

    // Pole
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0, flatShading: true });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 8), poleMat);
    pole.position.set(0, 2, -1.5);
    scene.add(pole);

    // Housing
    var housingMat = new THREE.MeshStandardMaterial({
        color: 0x1a404a, roughness: 0.3, emissive: 0x006064, emissiveIntensity: 2.0, flatShading: true
    });
    var housing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8), housingMat);
    housing.position.set(0, 5.3, -1.5);
    scene.add(housing);

    // Bridge surface
    var bridgeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0, flatShading: true });
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
        var flicker = 1.0 - Math.random() * 0.05;
        streetlight.intensity = 4.0 * flicker;
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
