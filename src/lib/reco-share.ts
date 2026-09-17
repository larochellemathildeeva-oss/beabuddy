/**
 * Sharing a list of saved places with another traveller.
 *
 * A share is a snapshot, not live access to a vault. What leaves your account
 * is exactly the rows you ticked, as they were when you shared them — editing
 * or deleting the original later does not rewrite what someone already has,
 * and nothing about the rest of your vault is reachable through a share code.
 */

/** What a share looks like once read back by code. */
export type SharedList = {
  shareId: string;
  title: string;
  note: string;
  sharedByName: string;
  items: SharedItem[];
};

export type SharedItem = {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  category: string;
  notes: string;
  source: string;
  url: string;
  lat: number | null;
  lon: number | null;
  pinType: string;
};

/** A saved recommendation, as much of it as sharing cares about. */
export type ShareableReco = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  category?: string | null;
  notes?: string | null;
  source?: string | null;
  url?: string | null;
  lat?: number | null;
  lon?: number | null;
  pin_type?: string | null;
};

/** One row of reco_share_items, ready to insert. */
export type ShareItemRow = {
  share_id: string;
  position: number;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  category: string | null;
  notes: string | null;
  source: string | null;
  url: string | null;
  lat: number | null;
  lon: number | null;
  pin_type: string | null;
};

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

/**
 * Turn picked recommendations into share rows.
 *
 * `includeNotes` is false by default and that is deliberate: people write
 * honest things in their own notes ("overrated", "bad date here"), and a
 * sharing feature that quietly forwards them is a nasty surprise. Sharing
 * notes is a decision the sharer makes, not a default they discover.
 */
export function toShareItems(
  shareId: string,
  recos: ShareableReco[],
  options: { includeNotes?: boolean } = {},
): ShareItemRow[] {
  const includeNotes = options.includeNotes ?? false;
  return recos.map((reco, index) => ({
    share_id: shareId,
    position: index,
    name: reco.name.trim(),
    city: text(reco.city),
    country: text(reco.country),
    address: text(reco.address),
    category: text(reco.category),
    notes: includeNotes ? text(reco.notes) : null,
    source: text(reco.source),
    url: text(reco.url),
    lat: typeof reco.lat === "number" ? reco.lat : null,
    lon: typeof reco.lon === "number" ? reco.lon : null,
    pin_type: text(reco.pin_type),
  }));
}

/**
 * A received place, ready to insert into your own vault.
 *
 * `recommended_by` is the whole point: a kept place remembers who gave it to
 * you, which is the column Béa already had for exactly this. The pin type is
 * not carried over — someone else marking a place "visited" says nothing about
 * whether you have been, so everything arrives as a recommendation.
 */
export function toKeptReco(
  item: SharedItem,
  sharedByName: string,
): {
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  notes?: string;
  recommended_by?: string;
  source?: string;
  url?: string;
  lat?: number;
  lon?: number;
  pin_type: "reco";
} {
  const who = sharedByName.trim();
  return {
    name: item.name,
    ...(item.city ? { city: item.city } : {}),
    ...(item.country ? { country: item.country } : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.category ? { category: item.category } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
    ...(who ? { recommended_by: who } : {}),
    ...(item.source ? { source: item.source } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...(typeof item.lat === "number" ? { lat: item.lat } : {}),
    ...(typeof item.lon === "number" ? { lon: item.lon } : {}),
    pin_type: "reco",
  };
}

type ShareRowFromDb = {
  share_id: string;
  title: string | null;
  note: string | null;
  shared_by_name: string | null;
  item_id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  category: string | null;
  notes: string | null;
  source: string | null;
  url: string | null;
  lat: number | null;
  lon: number | null;
  pin_type: string | null;
};

/**
 * `read_reco_share` returns the share's own fields repeated on every item row,
 * so one call fetches everything. Fold that back into one list.
 *
 * An empty result is a share with no items left, not a missing share — the
 * function raises for missing, expired and revoked codes instead of returning
 * nothing, so those never arrive here.
 */
export function sharedListFromRows(rows: ShareRowFromDb[]): SharedList | null {
  const first = rows[0];
  if (!first) return null;
  return {
    shareId: first.share_id,
    title: first.title?.trim() || "Shared places",
    note: first.note?.trim() || "",
    sharedByName: first.shared_by_name?.trim() || "",
    items: rows.map((row) => ({
      id: row.item_id,
      name: row.name,
      city: row.city ?? "",
      country: row.country ?? "",
      address: row.address ?? "",
      category: row.category ?? "",
      notes: row.notes ?? "",
      source: row.source ?? "",
      url: row.url ?? "",
      lat: row.lat,
      lon: row.lon,
      pinType: row.pin_type ?? "reco",
    })),
  };
}

/** A default title, so a share is never just a bare code in a message. */
export function suggestedShareTitle(recos: ShareableReco[], now = new Date()): string {
  const cities = [...new Set(recos.map((r) => (r.city ?? "").trim()).filter(Boolean))];
  const count = recos.length;
  const places = `${count} place${count === 1 ? "" : "s"}`;
  if (cities.length === 1) return `${places} in ${cities[0]}`;
  if (cities.length === 2) return `${places} in ${cities[0]} and ${cities[1]}`;
  if (cities.length > 2) return `${places} in ${cities.length} cities`;
  return `${places}, ${now.toLocaleString("en", { month: "long" })}`;
}

/** Plain-language line for what a share will hand over. */
export function shareSummaryLine(count: number, includeNotes: boolean): string {
  if (count === 0) return "Pick the places you want to send.";
  const places = `${count} place${count === 1 ? "" : "s"}`;
  return includeNotes
    ? `${places}, with your notes on each one.`
    : `${places}. Your own notes stay private.`;
}

/** How a share reads once it is out in the world. */
export function shareStatusLine(
  share: { use_count: number; max_uses: number; expires_at: string; revoked_at: string | null },
  now = new Date(),
): string {
  if (share.revoked_at) return "Stopped";
  if (new Date(share.expires_at) < now) return "Expired";
  const left = Math.max(0, share.max_uses - share.use_count);
  if (share.use_count === 0) return "Not opened yet";
  const taken = `Kept by ${share.use_count} ${share.use_count === 1 ? "person" : "people"}`;
  return left === 0 ? `${taken} · full` : taken;
}
