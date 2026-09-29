import { useState } from "react";
import { useStopPictures } from "@/hooks/useStopPictures";
import { useTownPhoto } from "@/hooks/useTownPhoto";
import type { PlacePhoto } from "@/lib/wikimedia";

/**
 * With "Real photos" (You → Appearance), a trip with no photo of its own is
 * pictured by its town — from Pexels, else Wikimedia Commons — instead of a
 * painting. Null otherwise, or while it loads, or when the file will not load
 * (`onError` remembers that, and the painting comes back).
 */
export function useTownPicture(
  hasOwnPhoto: boolean,
  city: string | null | undefined,
  country: string | null | undefined,
): { photo: PlacePhoto | null; onError: (() => void) | undefined } {
  const [pictures] = useStopPictures();
  const wanted = pictures === "photos" && !hasOwnPhoto;
  const town = useTownPhoto(city, country, wanted);
  const [broken, setBroken] = useState<string | null>(null);
  const photo = wanted && town && town.url !== broken ? town : null;
  return { photo, onError: photo ? () => setBroken(photo.url) : undefined };
}
