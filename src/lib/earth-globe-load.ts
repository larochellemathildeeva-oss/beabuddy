import type { EarthLook, EarthMap } from "./earth-globe";

const loaded = new Map<EarthLook, Promise<EarthMap | null>>();

/**
 * The Earth picture for a look, read into pixels once and only when the World
 * globe is drawn. Null when it cannot be read: the globe then keeps its plain
 * land, and the next draw tries again.
 */
export function loadEarthMap(look: EarthLook): Promise<EarthMap | null> {
  let pending = loaded.get(look);
  if (!pending) {
    pending = new Promise<EarthMap | null>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve({ data, width: canvas.width, height: canvas.height });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `/earth/${look}.webp`;
    }).then((map) => {
      if (!map) loaded.delete(look);
      return map;
    });
    loaded.set(look, pending);
  }
  return pending;
}
