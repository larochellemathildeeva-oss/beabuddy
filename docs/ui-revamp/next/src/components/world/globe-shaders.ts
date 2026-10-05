/**
 * GLSL for the interactive globe. WebGL1-compatible (three.js ShaderMaterial).
 * Textures are sampled as raw sRGB and shaded in that space on purpose: the
 * mockups were graded by eye, and this keeps the numbers in globe-looks.ts
 * predictable.
 */

/** Shared: the east/north tangent frame of a unit sphere in our lat/lon convention. */
const TANGENTS = /* glsl */ `
  vec3 eastOf(vec3 n) { return normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0)); }
`;

export const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vObjN;
  varying vec3 vWorldPos;
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vNo;
  ${TANGENTS}
  void main() {
    vUv = uv;
    vec3 n = normalize(position);
    vObjN = n;
    vec3 e = eastOf(n);
    mat3 rot = mat3(modelMatrix);
    vN = rot * n;
    vE = rot * e;
    vNo = rot * cross(n, e);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const GLOBE_FRAGMENT = /* glsl */ `
  uniform sampler2D uSurface;
  uniform sampler2D uRelief;
  uniform float uNight;
  uniform vec3 uLightDir;
  uniform vec2 uTexel;
  uniform float uAmbient;
  uniform float uExposure;
  uniform float uSaturation;
  uniform vec3 uOceanTint;
  uniform vec3 uLandTint;
  uniform float uReliefStrength;
  uniform float uReliefContrast;
  uniform float uSpecular;
  uniform vec3 uRimColor;
  uniform float uRimStrength;
  uniform float uRimPower;
  uniform float uCloudShadow;
  uniform float uCloudShift;
  uniform vec3 uCityColor;
  uniform float uCityGain;
  varying vec2 vUv;
  varying vec3 vObjN;
  varying vec3 vWorldPos;
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vNo;

  vec3 saturateColor(vec3 c, float s) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return mix(vec3(l), c, s);
  }

  void main() {
    // World-space frame: geometric normal, east and north tangents.
    vec3 N = normalize(vN);
    vec3 east = normalize(vE);
    vec3 north = normalize(vNo);

    vec4 rel = texture2D(uRelief, vUv);
    float ocean = rel.g;
    vec2 dx = vec2(uTexel.x * 1.5, 0.0);
    vec2 dy = vec2(0.0, uTexel.y * 1.5);
    float hE = texture2D(uRelief, vUv + dx).r;
    float hW = texture2D(uRelief, vUv - dx).r;
    float hN = texture2D(uRelief, vUv + dy).r;
    float hS = texture2D(uRelief, vUv - dy).r;
    // East–west texels crowd together toward the poles; keep slopes honest.
    float cosLat = max(sqrt(1.0 - vObjN.y * vObjN.y), 0.2);
    vec3 grad = ((hE - hW) / cosLat) * east + (hN - hS) * north;
    vec3 B = normalize(N - uReliefStrength * grad);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uLightDir);

    vec3 base = texture2D(uSurface, vUv).rgb;
    vec3 col = base * mix(uLandTint, uOceanTint, ocean);
    col = saturateColor(col, uSaturation);

    float ndl = dot(N, L);
    float wrap = clamp((ndl + 0.5) / 1.5, 0.0, 1.0);
    float light = mix(uAmbient, 1.0, wrap);
    float relief = clamp(1.0 + (dot(B, L) - ndl) * uReliefContrast, 0.3, 1.9);
    col *= light * relief;

    // Soft shadows of the drifting clouds, nudged away from the light.
    float cs = texture2D(uRelief, vUv + vec2(uCloudShift - 0.0025, 0.0025)).b;
    col *= 1.0 - smoothstep(0.05, 0.7, cs) * uCloudShadow;

    // A gentle glint on the sea.
    vec3 H = normalize(L + V);
    col += pow(max(dot(N, H), 0.0), 60.0) * uSpecular * ocean;

    if (uNight > 0.5) {
      col = mix(col, vec3(0.025, 0.05, 0.1), ocean * 0.55);
      float lum = dot(base, vec3(0.299, 0.587, 0.114));
      float warm = clamp((base.r - base.b) * 5.0, 0.0, 1.0);
      float city = smoothstep(0.2, 0.62, lum) * (0.4 + 0.6 * warm) * (1.0 - ocean);
      col = mix(col, uCityColor * (0.6 + lum), clamp(city * uCityGain, 0.0, 1.0));
    }

    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
    col = mix(col, uRimColor, clamp(fres * uRimStrength, 0.0, 1.0));
    gl_FragColor = vec4(col * uExposure, 1.0);
  }
`;

export const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D uRelief;
  uniform vec3 uLightDir;
  uniform vec2 uTexel;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uShade;
  varying vec2 vUv;
  varying vec3 vObjN;
  varying vec3 vWorldPos;
  varying vec3 vN;
  varying vec3 vE;
  varying vec3 vNo;

  void main() {
    float c = texture2D(uRelief, vUv).b;
    if (c < 0.02) discard;
    vec3 G = normalize(vN);
    vec3 east = normalize(vE);
    vec3 north = normalize(vNo);
    vec2 dx = vec2(uTexel.x * 2.0, 0.0);
    vec2 dy = vec2(0.0, uTexel.y * 2.0);
    float cE = texture2D(uRelief, vUv + dx).b;
    float cW = texture2D(uRelief, vUv - dx).b;
    float cN = texture2D(uRelief, vUv + dy).b;
    float cS = texture2D(uRelief, vUv - dy).b;
    // Puff the clouds up: their own density is their height.
    vec3 N = normalize(G - 2.2 * ((cE - cW) * east + (cN - cS) * north));
    vec3 V = normalize(cameraPosition - vWorldPos);
    float lit = clamp(0.5 + 0.65 * dot(N, normalize(uLightDir)), 0.0, 1.0);
    vec3 col = mix(uShade, uColor, lit);
    float a = smoothstep(0.04, 0.55, c) * uOpacity * smoothstep(0.02, 0.35, dot(G, V));
    gl_FragColor = vec4(col, a);
  }
`;

export const HALO_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform float uEdge;
  uniform float uWidth;
  uniform float uStrength;
  uniform float uBloom;
  uniform float uBloomWidth;
  varying vec2 vPos;
  void main() {
    float r = length(vPos);
    float d = r - uEdge;
    if (d < -0.03) discard;
    float t = 0.5 + 0.5 * dot(vPos / max(r, 1e-4), normalize(vec2(-0.7, 0.7)));
    vec3 c = mix(uOuter, uInner, t);
    float x = max(d, 0.0);
    float a = uStrength * exp(-x / uWidth) + uBloom * exp(-x / uBloomWidth);
    a = clamp(a, 0.0, 1.0) * smoothstep(-0.03, 0.0, d);
    gl_FragColor = vec4(c, a);
  }
`;
