/* Scene 4: Blizzard City Street — PS1 Liminal Space
 * Gray-black + dark red, 10000K, -2.0EV, ISO 3200 film grain 25%
 * 8px snow motion blur, extreme cold atmosphere
 * Exports: createScene(container) -> { scene, camera, renderer, animate, dispose }
 */

function createScene(container) {
    // ── Setup ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0808); // near-black with red hint
    scene.fog = new THREE.Fog(0x1a1015, 8, 35); // dark red fog

    const camera = new THREE.PerspectiveCamera(
        60, container.clientWidth / container.clientHeight, 0.5, 100
    );
    camera.position.set(0, 1.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.imageRendering = 'pixelated';

    // ── Lighting: 10000K blue-white, -2.0EV very dark ───────────────
    const ambientLight = new THREE.AmbientLight(0x1a1520, 0.12);
    scene.add(ambientLight);

    // Distant red emergency light
    const emergencyLight = new THREE.PointLight(0xcc2233, 0.6, 18);
    emergencyLight.position.set(3, 2.5, -10);
    scene.add(emergencyLight);

    // Faint streetlight
    const streetLight = new THREE.PointLight(0xaaccff, 0.4, 14);
    streetLight.position.set(-4, 4, -5);
    scene.add(streetLight);

    // ── City street geometry ────────────────────────────────────────
    // Ground with snow accumulation
    const groundGeo = new THREE.PlaneGeometry(20, 50, 16, 32);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x1a1820, roughness: 0.9, flatShading: true
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);

    // Buildings (dark silhouettes)
    const buildingMat = new THREE.MeshStandardMaterial({
        color: 0x0e0c10, roughness: 1.0, flatShading: true
    });

    for (let z = -20; z <= -5; z += 5) {
        const h = 3 + Math.random() * 5;
        const w = 2 + Math.random() * 3;
        const bGeo = new THREE.BoxGeometry(w, h, 2);
        const b = new THREE.Mesh(bGeo, buildingMat);
        b.position.set(7, h / 2 - 1.5, z);
        scene.add(b);

        const b2Geo = new THREE.BoxGeometry(w * 0.8, h * 0.7, 2);
        const b2 = new THREE.Mesh(b2Geo, buildingMat);
        b2.position.set(-7, h * 0.35 - 1.5, z);
        scene.add(b2);
    }

    // Red emergency box on wall
    const alarmGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
    const alarmMat = new THREE.MeshStandardMaterial({
        color: 0x881111, roughness: 0.5, emissive: 0x440000, emissiveIntensity: 0.5,
        flatShading: true
    });
    const alarm = new THREE.Mesh(alarmGeo, alarmMat);
    alarm.position.set(5.5, 0.5, -8);
    scene.add(alarm);

    // ── Snow particles (8px motion blur via larger size + fast velocity) ──
    const snowCount = 500;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount);

    for (let i = 0; i < snowCount; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 25;
        snowPositions[i * 3 + 1] = Math.random() * 14;
        snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 25;
        snowVelocities[i] = 0.06 + Math.random() * 0.14; // fast for motion blur
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
        color: 0xddeeff,
        size: 0.25, // 8px equivalent — larger for motion blur effect
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const snow = new THREE.Points(snowGeo, snowMat);
    scene.add(snow);

    // ── Film grain overlay (25% noise via extra particle layer) ─────
    const grainCount = 200;
    const grainGeo = new THREE.BufferGeometry();
    const grainPositions = new Float32Array(grainCount * 3);

    for (let i = 0; i < grainCount; i++) {
        grainPositions[i * 3] = (Math.random() - 0.5) * 16;
        grainPositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
        grainPositions[i * 3 + 2] = -1; // near camera plane
    }

    grainGeo.setAttribute('position', new THREE.BufferAttribute(grainPositions, 3));
    const grainMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.03,
        transparent: true,
        opacity: 0.25, // ISO 3200 film grain 25%
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
    });
    const grain = new THREE.Points(grainGeo, grainMat);
    grain.position.z = -1;
    scene.add(grain);

    // ── Animate ─────────────────────────────────────────────────────
    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);

        // Snow motion blur — fast diagonal fall
        const spos = snow.geometry.attributes.position.array;
        for (let i = 0; i < snowCount; i++) {
            spos[i * 3 + 1] -= snowVelocities[i];
            spos[i * 3] += (Math.random() - 0.5) * 0.15; // horizontal jitter = motion blur
            if (spos[i * 3 + 1] < -2) {
                spos[i * 3 + 1] = 13;
                spos[i * 3] = (Math.random() - 0.5) * 25;
                spos[i * 3 + 2] = (Math.random() - 0.5) * 25;
            }
        }
        snow.geometry.attributes.position.needsUpdate = true;

        // Regenerate film grain positions each frame (ISO 3200 noise)
        const gpos = grain.geometry.attributes.position.array;
        for (let i = 0; i < grainCount; i++) {
            gpos[i * 3] = (Math.random() - 0.5) * 16;
            gpos[i * 3 + 1] = (Math.random() - 0.5) * 8;
        }
        grain.geometry.attributes.position.needsUpdate = true;

        // Emergency light flicker
        emergencyLight.intensity = 0.6 + Math.random() * 0.3;

        camera.position.x = Math.sin(Date.now() * 0.0004) * 0.1;
        camera.position.y = 1.5 + Math.sin(Date.now() * 0.0003) * 0.05;

        renderer.render(scene, camera);
    }

    function dispose() {
        cancelAnimationFrame(animId);
        renderer.dispose();
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }

    return { scene, camera, renderer, animate, dispose };
}
