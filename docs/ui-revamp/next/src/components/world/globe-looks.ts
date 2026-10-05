/**
 * How the interactive globe is lit and graded in each of Béa's moods.
 * Colours are linear-ish sRGB triples (0–1) handed straight to the shaders.
 *
 *   calm     natural daylight: teal seas, honest greens and sand, white haze rim
 *   colorful the same Earth, pushed toward aqua seas and lime land, peach→lavender rim
 *   dark     NASA Black Marble: charcoal land, warm gold city lights, blue rim
 */
export type GlobeMood = "calm" | "colorful" | "dark";

/** The repo's NASA textures (public/earth/, see AGENTS.md) plus the relief map this package adds. */
export const DEFAULT_EARTH_TEXTURES: { day: string; night: string; relief: string } = {
  day: "/earth/day.webp",
  night: "/earth/night.webp",
  relief: "/earth/relief.webp",
};

export type GlobeLook = {
  surface: "day" | "night";
  /** Base light that reaches the shaded side (0–1). */
  ambient: number;
  exposure: number;
  saturation: number;
  oceanTint: [number, number, number];
  landTint: [number, number, number];
  /** How far the normal is bent by the elevation map (embossed relief). */
  reliefStrength: number;
  /** Extra contrast of the relief shading on top of the plain lighting. */
  reliefContrast: number;
  specular: number;
  /** Fresnel haze on the globe itself. */
  rimColor: [number, number, number];
  rimStrength: number;
  rimPower: number;
  /** Atmosphere halo just outside the silhouette (top-left → bottom-right gradient). */
  haloInner: [number, number, number];
  haloOuter: [number, number, number];
  haloStrength: number;
  haloWidth: number;
  bloomStrength: number;
  bloomWidth: number;
  cloudOpacity: number;
  cloudColor: [number, number, number];
  cloudShade: [number, number, number];
  cloudShadow: number;
  cityColor: [number, number, number];
  cityGain: number;
};

export const GLOBE_LOOKS: Record<GlobeMood, GlobeLook> = {
  calm: {
    surface: "day",
    ambient: 0.6,
    exposure: 1.08,
    saturation: 1.08,
    oceanTint: [1.0, 1.1, 1.08],
    landTint: [1.0, 1.04, 0.94],
    reliefStrength: 8,
    reliefContrast: 1.25,
    specular: 0.22,
    rimColor: [0.9, 0.96, 1.0],
    rimStrength: 0.85,
    rimPower: 2.8,
    haloInner: [1.0, 1.0, 1.0],
    haloOuter: [0.82, 0.92, 1.0],
    haloStrength: 0.55,
    haloWidth: 0.018,
    bloomStrength: 0.22,
    bloomWidth: 0.06,
    cloudOpacity: 0.95,
    cloudColor: [1.0, 1.0, 1.0],
    cloudShade: [0.66, 0.72, 0.8],
    cloudShadow: 0.28,
    cityColor: [1.0, 0.8, 0.45],
    cityGain: 0,
  },
  colorful: {
    surface: "day",
    ambient: 0.62,
    exposure: 1.1,
    saturation: 1.35,
    oceanTint: [0.8, 1.24, 1.18],
    landTint: [1.0, 1.12, 0.82],
    reliefStrength: 8,
    reliefContrast: 1.2,
    specular: 0.2,
    rimColor: [1.0, 0.9, 0.95],
    rimStrength: 0.8,
    rimPower: 2.6,
    haloInner: [1.0, 0.84, 0.76],
    haloOuter: [0.86, 0.78, 1.0],
    haloStrength: 0.95,
    haloWidth: 0.03,
    bloomStrength: 0.35,
    bloomWidth: 0.08,
    cloudOpacity: 1.0,
    cloudColor: [1.0, 1.0, 1.0],
    cloudShade: [0.74, 0.78, 0.88],
    cloudShadow: 0.25,
    cityColor: [1.0, 0.8, 0.45],
    cityGain: 0,
  },
  dark: {
    surface: "night",
    ambient: 0.42,
    exposure: 1.0,
    saturation: 1.0,
    oceanTint: [0.55, 0.75, 1.15],
    landTint: [1.0, 1.0, 1.0],
    reliefStrength: 9,
    reliefContrast: 1.5,
    specular: 0.1,
    rimColor: [0.32, 0.52, 1.0],
    rimStrength: 0.85,
    rimPower: 2.4,
    haloInner: [0.45, 0.65, 1.0],
    haloOuter: [0.3, 0.45, 0.95],
    haloStrength: 0.38,
    haloWidth: 0.02,
    bloomStrength: 0.18,
    bloomWidth: 0.07,
    cloudOpacity: 0.22,
    cloudColor: [0.55, 0.6, 0.72],
    cloudShade: [0.12, 0.14, 0.2],
    cloudShadow: 0.1,
    cityColor: [1.0, 0.76, 0.36],
    cityGain: 1.8,
  },
};
