/* Scene 1: Rainy Underpass — PS1 Liminal Space
 * Cold gray + dark blue, 10000K, -1.5EV, rain blur 10px, 6x6 pixel blocks
 * Single distant warm window light (the only life sign)
 * Exports: createScene(container) -> { scene, camera, renderer, animate, dispose }
 */

function createScene(container) {
    // ── Setup ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14); // void-black
    scene.fog = new THREE.Fog(0x001a2e, 20, 80); // cold blue fog

    const camera = new THREE.PerspectiveCamera(
        65, container.clientWidth / container.clientHeight, 0.5, 200
    );
    camera.position.set(0, 1.6, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // PS1 texture filtering: nearest neighbor, 256x256 textures
    renderer.domElement.style.imageRendering = 'pixelated';

    // ── Lighting: single distant warm window ─────────────────────────
    const ambientLight = new THREE.AmbientLight(0x1a2530, 0.3);
    scene.add(ambientLight);

    const windowLight = new THREE.PointLight(0xffaa44, 0.8, 30);
    windowLight.position.set(0, 3, -25);
    scene.add(windowLight);

    // ── Underpass geometry ──────────────────────────────────────────
    // Floor: cracked concrete
    const floorGeo = new THREE.PlaneGeometry(40, 80, 16, 32);
    // Vertex wobble via custom attribute (simplified: use low-poly for PS1 look)
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x2a3540,
        roughness: 0.95,
        flatShading: true
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    scene.add(floor);

    // Ceiling
    const ceilingGeo = new THREE.BoxGeometry(12, 0.4, 80);
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x1a2530,
        roughness: 1.0,
        flatShading: true
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.y = 4;
    scene.add(ceiling);

    // Left wall
    const wallGeo = new THREE.BoxGeometry(0.3, 6, 80);
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x1a2530,
        roughness: 0.9,
        flatShading: true
    });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-6, 1.5, -5);
    scene.add(leftWall);

    // ── Distant building (the only window light source) ──────────────
    const buildingGeo = new THREE.BoxGeometry(3, 4, 2);
    const buildingMat = new THREE.MeshStandardMaterial({
        color: 0x0d1117,
        roughness: 1.0,
        flatShading: true
    });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.set(1, 1, -30);
    scene.add(building);

    // The one warm window
    const windowGeo = new THREE.PlaneGeometry(0.4, 0.6);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(1.4, 2.5, -29);
    scene.add(windowMesh);

    // ── Rain system ─────────────────────────────────────────────────
    const rainCount = 600;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    const rainVelocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 30;
        rainPositions[i * 3 + 1] = Math.random() * 15;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        rainVelocities[i] = 0.05 + Math.random() * 0.1;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
        color: 0x88aacc,
        size: 0.08,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    scene.add(rain);

    // ── Animate ─────────────────────────────────────────────────────
    let animId;
    function animate() {
        animId = requestAnimationFrame(animate);

        // Animate rain
        const pos = rain.geometry.attributes.position.array;
        for (let i = 0; i < rainCount; i++) {
            pos[i * 3 + 1] -= rainVelocities[i];
            if (pos[i * 3 + 1] < -2) {
                pos[i * 3 + 1] = 14;
                pos[i * 3] = (Math.random() - 0.5) * 30;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
            }
        }
        rain.geometry.attributes.position.needsUpdate = true;

        // Subtle camera sway
        camera.position.x = Math.sin(Date.now() * 0.0003) * 0.08;

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
