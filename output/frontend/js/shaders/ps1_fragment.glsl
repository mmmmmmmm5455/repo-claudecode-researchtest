/* PS1 Fragment Shader — Color quantization + shadow tint + color banding
 * Simulates PlayStation 1 16-bit color depth and dithering artifacts.
 * quantization: floor(rgb * 31) / 31 reduces to 5-bit per channel (32,768 colors)
 * shadow tint: #003344 (RGB: 0, 51, 68 → normalized: 0.0, 0.2, 0.267)
 * banding: visible color bands in dark gradient transitions
 *
 * Used by background.js as the post-processing fragment shader,
 * combined with CRT noise and crossfade blending at runtime.
 */
uniform sampler2D uScene;
uniform sampler2D uPrevScene;
uniform float uTime;
uniform float uTransition;
uniform vec2 uResolution;
varying vec2 vUv;

// Pseudo-random function for CRT noise
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUv;
    vec4 color = texture2D(uScene, uv);

    // Crossfade blend with previous scene during transition
    if (uTransition > 0.0) {
        vec4 prev = texture2D(uPrevScene, uv);
        color = mix(prev, color, uTransition);
    }

    // CRT noise: horizontal scanlines + random flicker
    float scanline = sin(uv.y * uResolution.y * 0.7) * 0.03;
    float noise = rand(uv + floor(uTime * 60.0) * 0.01) * 0.08;
    float flicker = rand(vec2(floor(uTime * 30.0), 0.0)) * 0.05;
    color.rgb += scanline + noise - flicker;

    // CRT RGB chromatic shift (horizontal color fringe)
    float rShift = rand(vec2(uv.y * 100.0, uTime)) * 0.003;
    color.r = texture2D(uScene, uv + vec2(rShift, 0.0)).r;

    // 16-bit color depth emulation (5 bits per channel = 32 levels)
    // floor(rgb * 31) / 31 — PS1 hardware color depth
    color.rgb = floor(color.rgb * 31.0) / 31.0;

    // Shadow tint overlay — #003344 applied to dark areas
    // #003344 → normalized RGB: (0.0, 0.2, 0.267)
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 shadowTint = vec3(0.0, 0.2, 0.267);
    color.rgb = mix(color.rgb, shadowTint, (1.0 - luminance) * 0.6);

    // Color banding artifact — quantize luminance in dark gradients
    // Creates visible stepping in smooth gradients
    float band = floor(luminance * 16.0) / 16.0;
    color.rgb += (band - luminance) * 0.08;

    // Vignette — edge darkening for liminal space atmosphere
    color.rgb *= 1.0 - length(uv - 0.5) * 0.5;

    gl_FragColor = color;
}
