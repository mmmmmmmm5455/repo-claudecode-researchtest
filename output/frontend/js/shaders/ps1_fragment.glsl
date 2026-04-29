/* PS1 Fragment Shader — Color quantization + shadow tint + color banding
 * Simulates PlayStation 1 16-bit color depth and dithering artifacts.
 * quantization: floor(rgb * 31) / 31 reduces to 5-bit per channel
 * shadow tint: #003344 (RGB: 0, 51, 68 → normalized: 0.0, 0.2, 0.267)
 * banding: visible color bands in dark gradient transitions
 */
uniform sampler2D uTexture;
uniform float uTime;
varying vec2 vUv;

void main() {
    vec4 color = texture2D(uTexture, vUv);

    // 16-bit color depth emulation (5 bits per channel = 32 levels)
    color.rgb = floor(color.rgb * 31.0) / 31.0;

    // Shadow tint overlay — #003344 on dark areas
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 shadowTint = vec3(0.0, 0.2, 0.267); // #003344 normalized
    color.rgb = mix(color.rgb, shadowTint, (1.0 - luminance) * 0.6);

    // Color banding artifact — quantize luminance in dark gradients
    float band = floor(luminance * 16.0) / 16.0;
    color.rgb += (band - luminance) * 0.1;

    gl_FragColor = color;
}
