import { supabase } from "@/integrations/supabase/client";
import { stripImageFileMetadata } from "@/lib/strip-image-meta";

/**
 * Puts one photo in the traveller's own folder of the private photo-memories
 * bucket and returns its path. The location and camera details inside the
 * file are dropped first, so read them (readExif) before calling this.
 */
export async function uploadPhotoFile(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const uploadFile = await stripImageFileMetadata(file);
  const path =
    uploadFile.type === "image/jpeg"
      ? `${uid}/${crypto.randomUUID()}.jpg`
      : `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("photo-memories")
    // A photo's file never changes (a new one gets a new path), so let the
    // browser and the CDN keep it for a year rather than fetch it again.
    .upload(path, uploadFile, {
      contentType: uploadFile.type || "image/jpeg",
      cacheControl: "31536000",
    });
  if (error) throw error;
  return path;
}
