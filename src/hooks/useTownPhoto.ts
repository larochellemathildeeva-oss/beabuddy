import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { townPhoto } from "@/lib/place-details.functions";
import type { PlacePhoto } from "@/lib/wikimedia";

/** One lookup per town per session, however many banners show it. */
const cache = new Map<string, Promise<PlacePhoto | null>>();

/** A Commons photo of a trip's town, for its banner; undefined while it loads. */
export function useTownPhoto(
  city: string | null | undefined,
  country: string | null | undefined,
  enabled: boolean,
): PlacePhoto | null | undefined {
  const ask = useServerFn(townPhoto);
  const town = city?.trim() ?? "";
  const key = town ? `${town}|${country?.trim() ?? ""}`.toLowerCase() : "";
  const [answer, setAnswer] = useState<{ key: string; photo: PlacePhoto | null } | null>(null);
  useEffect(() => {
    if (!enabled || !key) return;
    let live = true;
    let pending = cache.get(key);
    if (!pending) {
      pending = ask({
        data: { city: town.slice(0, 200), country: country?.trim().slice(0, 100) || null },
      }).catch(() => null);
      cache.set(key, pending);
    }
    void pending.then((photo) => {
      if (live) setAnswer({ key, photo });
    });
    return () => {
      live = false;
    };
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` stands for town and country
  return answer && answer.key === key ? answer.photo : undefined;
}
