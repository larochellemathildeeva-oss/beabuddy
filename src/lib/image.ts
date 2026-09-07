/** Soft ceiling for one AI data URL (under Zod's 3_000_000 and typical proxy limits). */
export const AI_IMAGE_MAX_CHARS = 1_200_000;

const READ_FAIL = "Could not read that picture. Try a JPEG or PNG, or take the photo again.";

type BitmapLike = {
  width: number;
  height: number;
  close?: () => void;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

async function decodeToBitmap(file: File): Promise<BitmapLike> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      };
    } catch {
      // Fall through — some HEIC / iCloud picks need the Image path.
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error(READ_FAIL));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error(READ_FAIL));
        return;
      }
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      });
    };
    img.onerror = fail;
    img.src = url;
  });
}

function encodeJpeg(
  draw: BitmapLike["draw"],
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(READ_FAIL);
  draw(ctx, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Shrink a picked image in the browser so it can be sent to Béa quickly.
 * Prefers createImageBitmap (no FileReader / data-URL decode — Safari often
 * reports those failures as the opaque "Load failed"), then falls back to an
 * object-URL Image. Re-encodes as JPEG and steps quality/size down until the
 * data URL fits AI_IMAGE_MAX_CHARS.
 */
export async function downscaleImage(file: File, maxSide = 1200, quality = 0.72): Promise<string> {
  if (!file || file.size === 0) throw new Error(READ_FAIL);

  let bitmap: BitmapLike;
  try {
    bitmap = await decodeToBitmap(file);
  } catch (err) {
    if (err instanceof Error && err.message === READ_FAIL) throw err;
    throw new Error(READ_FAIL);
  }

  try {
    let side = maxSide;
    let q = quality;
    let dataUrl = "";

    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      try {
        dataUrl = encodeJpeg(bitmap.draw, width, height, q);
      } catch {
        throw new Error(READ_FAIL);
      }
      if (dataUrl.length <= AI_IMAGE_MAX_CHARS) return dataUrl;
      if (q > 0.45) q = Math.max(0.45, q - 0.1);
      else side = Math.max(640, Math.round(side * 0.75));
    }

    if (dataUrl.startsWith("data:image/") && dataUrl.length <= 3_000_000) return dataUrl;
    throw new Error("That picture is too large to send. Try a clearer crop or a smaller photo.");
  } finally {
    bitmap.close?.();
  }
}
