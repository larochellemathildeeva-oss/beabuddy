/**
 * The WebGL Earth behind BeaGlobe's overlays. Loaded with `await import()`
 * from BeaGlobe so three.js is code-split and never runs during SSR.
 *
 * Orthographic camera, so it lines up pixel-for-pixel with d3's
 * geoOrthographic (the SVG shading/rings) — see src/lib/bea-globe.test.ts.
 */
import * as THREE from "three";
import { rotationToEuler, type Rotation } from "@/lib/bea-globe";
import { GLOBE_LOOKS, type GlobeMood } from "./globe-looks";
import {
  CLOUD_FRAGMENT,
  GLOBE_FRAGMENT,
  HALO_FRAGMENT,
  HALO_VERTEX,
  SURFACE_VERTEX,
} from "./globe-shaders";

export type EarthTextures = { day: string; night: string; relief: string };

export type EarthEngine = {
  /** `radiusFraction` = globe radius ÷ canvas side (Globe.tsx: 150 × zoom ÷ 320). */
  render: (
    rotation: Rotation,
    radiusFraction: number,
    cloudDrift: number,
    showClouds: boolean,
  ) => void;
  setSize: (cssPx: number) => void;
  setLook: (mood: GlobeMood) => Promise<void>;
  dispose: () => void;
};

/** The light comes from the upper left and a little in front, like the mockups. */
const LIGHT = new THREE.Vector3(-0.55, 0.6, 0.75).normalize();

export async function createEarthEngine(
  canvas: HTMLCanvasElement,
  pixelRatio: number,
  urls: EarthTextures,
): Promise<EarthEngine> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 50);
  camera.lookAt(0, 0, 0);

  const loader = new THREE.TextureLoader();
  const cache = new Map<string, Promise<THREE.Texture>>();
  const load = (url: string) => {
    let p = cache.get(url);
    if (!p) {
      p = loader.loadAsync(url).then((t) => {
        t.colorSpace = THREE.NoColorSpace; // shaded as raw sRGB, see globe-shaders.ts
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        t.wrapS = THREE.RepeatWrapping;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.needsUpdate = true;
        return t;
      });
      cache.set(url, p);
    }
    return p;
  };

  const relief = await load(urls.relief);
  const img = relief.image as { width?: number; height?: number } | undefined;
  const texel = new THREE.Vector2(1 / (img?.width ?? 2048), 1 / (img?.height ?? 1024));
  const v3 = (c: readonly [number, number, number]) => new THREE.Vector3(c[0], c[1], c[2]);

  const g = {
    uSurface: { value: relief },
    uRelief: { value: relief },
    uNight: { value: 0 },
    uLightDir: { value: LIGHT },
    uTexel: { value: texel },
    uAmbient: { value: 0.6 },
    uExposure: { value: 1 },
    uSaturation: { value: 1 },
    uOceanTint: { value: new THREE.Vector3(1, 1, 1) },
    uLandTint: { value: new THREE.Vector3(1, 1, 1) },
    uReliefStrength: { value: 8 },
    uReliefContrast: { value: 1.3 },
    uSpecular: { value: 0.2 },
    uRimColor: { value: new THREE.Vector3(1, 1, 1) },
    uRimStrength: { value: 0.8 },
    uRimPower: { value: 2.6 },
    uCloudShadow: { value: 0.25 },
    uCloudShift: { value: 0 },
    uCityColor: { value: new THREE.Vector3(1, 0.8, 0.4) },
    uCityGain: { value: 0 },
  };
  const c = {
    uRelief: { value: relief },
    uLightDir: { value: LIGHT },
    uTexel: { value: texel },
    uOpacity: { value: 1 },
    uColor: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(0.7, 0.75, 0.82) },
  };
  const h = {
    uInner: { value: new THREE.Vector3(1, 1, 1) },
    uOuter: { value: new THREE.Vector3(1, 1, 1) },
    uEdge: { value: 1 }, // orthographic: the silhouette is the unit circle
    uWidth: { value: 0.02 },
    uStrength: { value: 0.5 },
    uBloom: { value: 0.2 },
    uBloomWidth: { value: 0.06 },
  };

  const pivot = new THREE.Group();
  scene.add(pivot);
  const globeGeo = new THREE.SphereGeometry(1, 160, 112);
  const globeMat = new THREE.ShaderMaterial({
    uniforms: g,
    vertexShader: SURFACE_VERTEX,
    fragmentShader: GLOBE_FRAGMENT,
  });
  pivot.add(new THREE.Mesh(globeGeo, globeMat));

  const cloudGeo = new THREE.SphereGeometry(1.01, 128, 96);
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: c,
    vertexShader: SURFACE_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  pivot.add(clouds);

  const haloGeo = new THREE.PlaneGeometry(3, 3);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: h,
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.renderOrder = -1;
  scene.add(halo);

  let look = GLOBE_LOOKS.calm;

  return {
    render(rotation, radiusFraction, cloudDrift, showClouds) {
      const half = 0.5 / Math.max(radiusFraction, 0.05);
      if (camera.top !== half) {
        camera.left = -half;
        camera.right = half;
        camera.top = half;
        camera.bottom = -half;
        camera.updateProjectionMatrix();
      }
      const { yaw, pitch } = rotationToEuler(rotation);
      pivot.rotation.set(pitch, yaw, 0, "XYZ");
      clouds.rotation.y = cloudDrift;
      g.uCloudShift.value = -cloudDrift / (2 * Math.PI);
      const on = showClouds && look.cloudOpacity > 0;
      clouds.visible = on;
      g.uCloudShadow.value = on ? look.cloudShadow : 0;
      renderer.render(scene, camera);
    },
    setSize(cssPx) {
      renderer.setSize(cssPx, cssPx, false);
    },
    async setLook(mood) {
      const next = GLOBE_LOOKS[mood];
      const surface = await load(next.surface === "night" ? urls.night : urls.day);
      g.uSurface.value = surface;
      g.uNight.value = next.surface === "night" ? 1 : 0;
      g.uAmbient.value = next.ambient;
      g.uExposure.value = next.exposure;
      g.uSaturation.value = next.saturation;
      g.uOceanTint.value = v3(next.oceanTint);
      g.uLandTint.value = v3(next.landTint);
      g.uReliefStrength.value = next.reliefStrength;
      g.uReliefContrast.value = next.reliefContrast;
      g.uSpecular.value = next.specular;
      g.uRimColor.value = v3(next.rimColor);
      g.uRimStrength.value = next.rimStrength;
      g.uRimPower.value = next.rimPower;
      g.uCityColor.value = v3(next.cityColor);
      g.uCityGain.value = next.cityGain;
      c.uOpacity.value = next.cloudOpacity;
      c.uColor.value = v3(next.cloudColor);
      c.uShade.value = v3(next.cloudShade);
      h.uInner.value = v3(next.haloInner);
      h.uOuter.value = v3(next.haloOuter);
      h.uStrength.value = next.haloStrength;
      h.uWidth.value = next.haloWidth;
      h.uBloom.value = next.bloomStrength;
      h.uBloomWidth.value = next.bloomWidth;
      look = next;
    },
    dispose() {
      globeGeo.dispose();
      cloudGeo.dispose();
      haloGeo.dispose();
      globeMat.dispose();
      cloudMat.dispose();
      haloMat.dispose();
      for (const p of cache.values()) void p.then((t) => t.dispose()).catch(() => {});
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
