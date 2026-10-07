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
    // No longer than the hour a signed URL lasts (SIGN_SECONDS in
    // trip-share.server.ts, 3600 elsewhere): a photo can be hidden from a
    // link or the link turned off, and a longer cache would outlive that.
    .upload(path, uploadFile, {
      contentType: uploadFile.type || "image/jpeg",
      cacheControl: "3600",
    });
  if (error) throw error;
  return path;
}
