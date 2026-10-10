import type { Confidence } from "./match-confidence.ts";

/**
 * Why a stop's place is worth a second look, kept on the stop.
 *
 * The import works out how sure it is of each pin and says so at review
 * ("Béa's best guess", "Check this one — not pinned"). That used to be
 * dropped on saving, so a guess looked like a certainty on the trip. It is
 * kept as `pin_check` (see the pin_check migration), shown on the timeline
 * and in the printed itinerary when the traveller asks for "Places to confirm",
 * and let go once they set the place themselves.
 *
 * Pure, so every wording is tested without a database.
 */

/** As the migration's check allows. */
export const PIN_CHECK_MAX = 300;

/** What the stop's card and print say for a stop pinned far from the rest of the trip. */
export const STRAY_PIN_CHECK = "Far from the rest of the trip: check it is the right place";

type Found = { confidence: Confidence; reason: string; label?: string | undefined };

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > PIN_CHECK_MAX ? `${clean.slice(0, PIN_CHECK_MAX - 1).trimEnd()}…` : clean;
}

/** "Kiyomizu Slope, Kiyomizu 2-chome, …" → "Kiyomizu Slope, Kiyomizu 2-chome". */
function shortLabel(label: string | undefined): string {
  return (label ?? "").split(",").slice(0, 2).join(",").trim();
}

/**
 * The note an imported stop is saved with, or null when there is nothing to
 * check: a sure pin, no match at all ("No place yet" says so already), or a
 * pin the traveller removed themselves.
 */
export function pinCheckNote(found: Found | undefined, kept: boolean): string | null {
  if (!found) return null;
  const reason = found.reason.trim();
  if (!kept) {
    if (found.confidence !== "low") return null;
    const near = shortLabel(found.label);
    return clip(`Not pinned: ${reason || "Béa was unsure"}${near ? `. Béa found ${near}` : ""}`);
  }
  if (found.confidence === "high") return null;
  const lead = found.confidence === "low" ? "Kept though Béa was unsure" : "Béa's best guess";
  return clip(reason ? `${lead}: ${reason}` : lead);
}

/** What to show for a stop, when pins to check are shown: its own note, else a stray pin's. */
export function pinCheckFor(
  row: { pin_check?: string | null | undefined },
  stray: boolean,
): string | null {
  const own = row.pin_check?.trim();
  if (own) return own;
  return stray ? STRAY_PIN_CHECK : null;
}

/**
 * The stops to review behind the trip's "!", in timeline order: every one
 * with a note to check. Approving a stop, or setting its place, clears its
 * note, and it leaves the list.
 */
export function pinsToCheck<T extends { pin_check?: string | null | undefined }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => Boolean(item.pin_check?.trim()));
}
