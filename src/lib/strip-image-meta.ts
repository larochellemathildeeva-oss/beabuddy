/**
 * Re-encode an image through the canvas so GPS/EXIF in the file bytes is dropped.
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
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
