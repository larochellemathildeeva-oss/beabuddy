/** Longest side of a stored photo. Big enough for a full-screen phone view. */
export const PHOTO_MAX_SIDE = 1600;
/** JPEG quality of a stored photo: visually the same, a fraction of the bytes. */
export const PHOTO_JPEG_QUALITY = 0.8;

/**
 * The size a photo is drawn at: its own size when it already fits, else
 * scaled down so its longest side is `max`. Never scales up.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > max) || !(width > 0) || !(height > 0)) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Re-encode an image through the canvas so GPS/EXIF in the file bytes is dropped,
 * and shrink it to PHOTO_MAX_SIDE: every view of a stored photo is a download
 * from storage, so a 5 MB phone original costs ten times what this does.
 * Lat/lon for the map should be read with readExif *before* calling this.
 * Non-images or decode failures return the original file unchanged.
 */
export async function stripImageFileMetadata(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const size = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
