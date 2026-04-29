/* PS1 Vertex Shader — Vertex wobble + low-precision quantization
 * Simulates PlayStation 1 fixed-point vertex processing artifacts.
 * wobble: sin() based vertex jitter along X axis
 * quantization: floor(xyz * 32) / 32 emulates fixed-point precision loss
 */
uniform float uTime;
varying vec2 vUv;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Vertex wobble — PS1 signature effect
    float wobble = sin(mvPosition.y * 100.0 + uTime) * 0.3;
    mvPosition.x += wobble;

    // Low-precision quantization (fixed-point emulation, 5-bit fraction)
    mvPosition.xyz = floor(mvPosition.xyz * 32.0) / 32.0;

    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
}
