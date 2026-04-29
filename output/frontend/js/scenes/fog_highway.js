/* Scene 3: Fog Highway — PS1 Liminal Space
 * Gray-white + gray-black, 9500K, -1.8EV, -10% contrast
 * 50m visibility fog, 30% distant opacity
 * Exports: createScene(container) -> { scene, camera, renderer, animate, dispose }
 */

function createScene(container) {
    // ── Setup ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1c20);
    scene.fog = new THREE.FogExp2(0x8a9bb0, 0.0006);

    const camera = new THREE.PerspectiveCamera(
        65, container.clientWidth / container.clientHeight, 0.5, 120
    );
    camera.position.set(0, 1.6, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.imageRendering = 'pixelated';

    // ── Lighting: 9500K cool blue-white, -1.8EV underexposed ────────
    const ambientLight = new THREE.AmbientLight(0x7088a0, 0.25);
    scene.add(ambientLight);

    const highwayLight = new THREE.PointLight(0xaaccff, 1.2, 40);
    highwayLight.position.set(0, 8, -30);
    scene.add(highwayLight);

    // ── Highway geometry ────────────────────────────────────────────
    const roadGeo = new THREE.PlaneGeometry(14, 100, 8, 32);
    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x2a2d33, roughness: 0.95, flatShading: true
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = -1.2;
    scene.add(road);

    // Dashed center line (low contrast, 30% opacity)
    for (let z = -40; z < 40; z += 6) {
        const dashGeo = new THREE.PlaneGeometry(0.3, 2.5);
        const dashMat = new THREE.MeshBasicMaterial({
            color: 0x8899aa, transparent: true, opacity: 0.3
        });
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(0, -1.18, z);
        scene.add(dash);
    }

    // Guardrails
    for (let z = -35; z <= 35; z += 5) {
        const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.2, 6);
        const postMat = new THREE.MeshStandardMaterial({
            color: 0x3a3d44, roughness: 1.0, flatShading: true
        });
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(6.5, -0.5, z);
        scene.add(postL);
        const postR = new THREE.Mesh(postGeo, postMat);
        postR.position.set(-6.5, -0.5, z);
        scene.add(postR);
    }

    // Distant overpass silhouette
    const overpassGeo = new THREE.BoxGeometry(16, 1.5, 3);
    const overpassMat = new THREE.MeshStandardMaterial({
        color: 0x1a1c20, roughness: 1.0, flatShading: true
    });
    const overpass = new THREE.Mesh(overpassGeo, overpassMat);
    overpass.position.set(0, 2.5, -45);
    scene.add(overpass);

    // Light poles fading into fog (30% distant opacity)
    for (let z = -35; z <= -10; z += 8) {
        const dist = Math.abs(z);
        const opacity = Math.max(0.05, 0.3 * (1 - dist / 50));

        const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 4, 6);
        const poleMat = new THREE.MeshStandardMaterial({
            color: 0x2a2d33, roughness: 1.0, flatShading: true
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(5, 1, z);
        pole.material = pole.material.clone();
        pole.material.opacity = opacity;
        pole.material.transparent = true;
        scene.add(pole);

        const pole2 = new THREE.Mesh(poleGeo, poleMat);
        pole2.position.set(-5, 1, z);
        pole2.material = pole2.material.clone();
        pole2.material.opacity = opacity;
        pole2.material.transparent = true;
        scene.add(pole2);
    }

    // ── Fog particles ───────────────────────────────────────────────
    const fogCount = 300;
    const fogGeo = new THREE.BufferGeometry();
    const fogPositions = new Float32Array(fogCount * 3);
    const fogVelocities = new Float32Array(fogCount);

    for (let i = 0; i < fogCount; i++) {
        fogPositions[i * 3] = (Math.random() - 0.5) * 30;
        fogPositions[i * 3 + 1] = Math.random() * 8;
        fogPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
        fogVelocities[i] = 0.005 + Math.random() * 0.015;
    }

    fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPositions, 3));
    const fogMat = new THREE.PointsMaterial({
        color: 0x8899aa,
        size: 0.6,
        transparent: true,
        opacity: 0.15,
        blending: THREE.NormalBlending
    });
    const fogParticles = new THREE.Points(fogGeo, fogMat);
    scene.add(fogParticles);

    // ── Animate ─────────────────────────────────────────────────────
    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);

        const pos = fogParticles.geometry.attributes.position.array;
        for (let i = 0; i < fogCount; i++) {
            pos[i * 3 + 2] += fogVelocities[i];
            pos[i * 3] += Math.sin(Date.now() * 0.0005 + i * 0.1) * 0.01;
            if (pos[i * 3 + 2] > 25) {
                pos[i * 3 + 2] = -35;
                pos[i * 3] = (Math.random() - 0.5) * 30;
            }
        }
        fogParticles.geometry.attributes.position.needsUpdate = true;

        camera.position.x = Math.sin(Date.now() * 0.0002) * 0.12;
        camera.position.y = 1.6 + Math.sin(Date.now() * 0.0004) * 0.06;

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
