/**
 * Where tapping a saved rec takes you: the phone's maps app, on that place.
 *
 * A rec with a pin opens on the pin. One saved without a spot — typed in by
 * hand because the search could not find it — opens a search for its name
 * with its address or city, which the maps app resolves the way a person
 * would. That is what makes saving an unfound place worth doing: it still
 * opens somewhere useful.
 */
import { mapsPlaceUrl } from "./direction-stops.ts";

export function recMapsUrl(rec: {
  name: string;
  address?: string | null | undefined;
  city?: string | null | undefined;
  country?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
}): string {
  if (rec.lat != null && rec.lon != null) {
    return mapsPlaceUrl(rec.name, { lat: rec.lat, lon: rec.lon });
  }
  const where = rec.address?.trim() || rec.city?.trim() || "";
  const parts = [rec.name.trim(), where, where === rec.address?.trim() ? "" : rec.country?.trim()];
  const query = parts.filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * A name typed into the search, as a draft: "Mandy's, Montreal" is a name
 * and a city. The city is only taken after a comma, never guessed from the
 * words — "Café Olimpico Mile End" stays one name.
 */
export function draftFromTyped(text: string): { name: string; city?: string } {
  const trimmed = text.trim();
  const comma = trimmed.indexOf(",");
  if (comma <= 0) return { name: trimmed };
  const name = trimmed.slice(0, comma).trim();
  const city = trimmed.slice(comma + 1).trim();
  return city ? { name, city } : { name };
}
