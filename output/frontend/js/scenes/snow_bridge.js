/* Scene 2: Snow Night Bridge — PS1 Liminal Space
 * Warm yellow highlight + pure black, 5500K highlights, -2.5EV
 * 16x16 pixel blocks, 70% dead black (RGB 0-20), 1:20 extreme light ratio
 * Single center streetlight as sole illumination
 * Exports: createScene(container) -> { scene, camera, renderer, animate, dispose }
 */

function createScene(container) {
    // ── Setup ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // pure black, 70% dead black

    const camera = new THREE.PerspectiveCamera(
        60, container.clientWidth / container.clientHeight, 0.5, 150
    );
    camera.position.set(0, 1.8, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.imageRendering = 'pixelated';

    // ── Lighting: single streetlight, 1:20 light ratio ──────────────
    // No ambient light — 70% of screen is dead black
    const ambientLight = new THREE.AmbientLight(0x000511, 0.05);
    scene.add(ambientLight);

    const streetlight = new THREE.PointLight(0xffcc66, 4.0, 12);
    streetlight.position.set(0, 5, -1);
    scene.add(streetlight);

    // Streetlight pole
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 8);
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 1.0, flatShading: true
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 2, -1.5);
    scene.add(pole);

    // Streetlight housing (emissive)
    const housingGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 8);
    const housingMat = new THREE.MeshStandardMaterial({
        color: 0xffcc44, roughness: 0.3, emissive: 0xffaa22, emissiveIntensity: 2.0,
        flatShading: true
    });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0, 5.3, -1.5);
    scene.add(housing);

    // ── Bridge geometry ─────────────────────────────────────────────
    const bridgeGeo = new THREE.BoxGeometry(8, 0.3, 30);
    const bridgeMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a, roughness: 1.0, flatShading: true
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.y = -0.5;
    scene.add(bridge);

    // Bridge railings
    for (let z = -12; z <= 12; z += 4) {
        const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
        const rail = new THREE.Mesh(railGeo, poleMat);
        rail.position.set(3.5, 0.3, z);
        scene.add(rail);

        const rail2 = new THREE.Mesh(railGeo, poleMat);
        rail2.position.set(-3.5, 0.3, z);
        scene.add(rail2);
    }

    // ── Snow particles ──────────────────────────────────────────────
    const snowCount = 400;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount);

    for (let i = 0; i < snowCount; i++) {
        snowPositions[i * 3] = (Math.random() - 0.5) * 20;
        snowPositions[i * 3 + 1] = Math.random() * 12;
        snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        snowVelocities[i] = 0.01 + Math.random() * 0.03;
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.15,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });
    const snow = new THREE.Points(snowGeo, snowMat);
    scene.add(snow);

    // ── Animate ─────────────────────────────────────────────────────
    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);

        // Animate snow
        const pos = snow.geometry.attributes.position.array;
        for (let i = 0; i < snowCount; i++) {
            pos[i * 3 + 1] -= snowVelocities[i];
            pos[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.005;
            if (pos[i * 3 + 1] < -2) {
                pos[i * 3 + 1] = 11;
                pos[i * 3] = (Math.random() - 0.5) * 20;
            }
        }
        snow.geometry.attributes.position.needsUpdate = true;

        // Subtle streetlight flicker (1:20 ratio maintained)
        const flicker = 1.0 - Math.random() * 0.05;
        streetlight.intensity = 4.0 * flicker;

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
