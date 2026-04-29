/* Scene 4: Blizzard City Street — PS1 Liminal Space
 * Gray-black + dark red, 10000K, -2.0EV, ISO 3200 film grain 25%
 * 8px snow motion blur, extreme cold atmosphere
 * Exports via window.createScene_blizzard_street
 */
function createScene_blizzard_street() {
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0808);
    scene.fog = new THREE.Fog(0x1a1015, 8, 35);

    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 100);
    camera.position.set(0, 1.5, 5);

    scene.add(new THREE.AmbientLight(0x1a1520, 0.12));

    // Distant red emergency light
    var emergencyLight = new THREE.PointLight(0xcc2233, 0.6, 18);
    emergencyLight.position.set(3, 2.5, -10);
    scene.add(emergencyLight);

    // Faint streetlight
    var streetLight = new THREE.PointLight(0xaaccff, 0.4, 14);
    streetLight.position.set(-4, 4, -5);
    scene.add(streetLight);

    // Snow-covered ground
    var groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1820, roughness: 0.9, flatShading: true });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 50, 16, 32), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);

    // Buildings
    var bldgMat = new THREE.MeshStandardMaterial({ color: 0x0e0c10, roughness: 1.0, flatShading: true });
    for (var z = -20; z <= -5; z += 5) {
        var h = 3 + Math.random() * 5;
        var w = 2 + Math.random() * 3;
        var b1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), bldgMat);
        b1.position.set(7, h / 2 - 1.5, z);
        scene.add(b1);
        var b2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.7, 2), bldgMat);
        b2.position.set(-7, h * 0.35 - 1.5, z);
        scene.add(b2);
    }

    // Red emergency box
    var alarmMat = new THREE.MeshStandardMaterial({
        color: 0x881111, roughness: 0.5, emissive: 0x440000, emissiveIntensity: 0.5, flatShading: true
    });
    var alarm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.15), alarmMat);
    alarm.position.set(5.5, 0.5, -8);
    scene.add(alarm);

    // Snow particles (8px motion blur via size + velocity)
    var snowCount = 500;
    var snowGeo = new THREE.BufferGeometry();
    var snowPositions = new Float32Array(snowCount * 3);
    var snowVelocities = new Float32Array(snowCount);
    for (var i = 0; i < snowCount; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 25;
        snowPositions[i * 3 + 1] = Math.random() * 14;
        snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 25;
        snowVelocities[i] = 0.06 + Math.random() * 0.14;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    var snowMat = new THREE.PointsMaterial({
        color: 0xddeeff, size: 0.25, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
    });
    var snow = new THREE.Points(snowGeo, snowMat);
    scene.add(snow);

    // Film grain (ISO 3200, 25% opacity overlay)
    var grainCount = 200;
    var grainGeo = new THREE.BufferGeometry();
    var grainPositions = new Float32Array(grainCount * 3);
    for (var i = 0; i < grainCount; i++) {
        grainPositions[i * 3] = (Math.random() - 0.5) * 16;
        grainPositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
        grainPositions[i * 3 + 2] = -1;
    }
    grainGeo.setAttribute('position', new THREE.BufferAttribute(grainPositions, 3));
    var grainMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.03, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false
    });
    var grain = new THREE.Points(grainGeo, grainMat);
    grain.position.z = -1;
    scene.add(grain);

    function animate(dt, elapsed) {
        var spos = snow.geometry.attributes.position.array;
        for (var i = 0; i < snowCount; i++) {
            spos[i * 3 + 1] -= snowVelocities[i];
            spos[i * 3] += (Math.random() - 0.5) * 0.15;
            if (spos[i * 3 + 1] < -2) {
                spos[i * 3 + 1] = 13;
                spos[i * 3] = (Math.random() - 0.5) * 25;
                spos[i * 3 + 2] = (Math.random() - 0.5) * 25;
            }
        }
        snow.geometry.attributes.position.needsUpdate = true;

        var gpos = grain.geometry.attributes.position.array;
        for (var i = 0; i < grainCount; i++) {
            gpos[i * 3] = (Math.random() - 0.5) * 16;
            gpos[i * 3 + 1] = (Math.random() - 0.5) * 8;
        }
        grain.geometry.attributes.position.needsUpdate = true;

        emergencyLight.intensity = 0.6 + Math.random() * 0.3;
        camera.position.x = Math.sin(elapsed * 0.4) * 0.1;
        camera.position.y = 1.5 + Math.sin(elapsed * 0.3) * 0.05;
    }

    function dispose() {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
    }

    return { scene: scene, camera: camera, animate: animate, dispose: dispose };
}
window['createScene_blizzard_street'] = createScene_blizzard_street;
