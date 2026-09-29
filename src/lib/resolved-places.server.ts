import { createHash } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import {
  chooseResolved,
  placeNameKey,
  SAME_SPOT_KM,
  type Resolved,
  type ResolvedRow,
} from "@/lib/resolved-places";
import { distanceKm } from "@/lib/geocode-plan";

/**
 * `resolved_places`, read and written by the server (rules in
 * resolved-places.ts). Names and travellers are stored as hashes. Until the
 * migration is applied, nothing is remembered, with one warning in the log.
 * Nothing here ever stops an import: a failure reads as "not remembered".
 */
let tableMissing = false;

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

function tableFailed(error: unknown) {
  if (tableMissing) return;
  tableMissing = true;
  console.warn(
    "[places] resolved_places unavailable (is the resolved_places migration applied?); nothing is remembered:",
    error instanceof Error ? error.message : error,
  );
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function rowsFor(hashes: string[]): Promise<ResolvedRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("resolved_places")
    .select("lat, lon, label, also_named, source, voter")
    .in("name_key", hashes)
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    lat: row.lat,
    lon: row.lon,
    label: row.label,
    alsoNamed: Array.isArray(row.also_named) ? (row.also_named as string[]) : null,
    source: row.source === "traveller" ? "traveller" : "match",
    voter: row.voter,
  }));
}

/** The remembered place for a stop by any of its names, near `centre`, or nothing. */
export async function findResolved(
  names: (string | null | undefined)[],
  centre: { lat: number; lon: number },
): Promise<Resolved | null> {
  if (tableMissing) return null;
  const hashes = [...new Set(names.map(placeNameKey).filter((k): k is string => !!k))].map(sha);
  if (!hashes.length) return null;
  try {
    return chooseResolved(await rowsFor(hashes), centre);
  } catch (error) {
    tableFailed(error);
    return null;
  }
}

/** A stop the import found by its name and trusted: remembered, once per spot. */
export async function rememberMatch(
  name: string | null | undefined,
  hit: { lat: number; lon: number; label?: string | null; alsoNamed?: string[] | null },
): Promise<void> {
  const key = placeNameKey(name);
  if (tableMissing || !key || !hit.label) return;
  try {
    const hash = sha(key);
    const known = await rowsFor([hash]);
    if (known.some((row) => row.source === "match" && distanceKm(row, hit) <= SAME_SPOT_KM)) return;
    const db = await admin();
    const { error } = await db.from("resolved_places").insert({
      name_key: hash,
      lat: hit.lat,
      lon: hit.lon,
      label: hit.label.slice(0, 300),
      also_named: (hit.alsoNamed ?? []).slice(0, 8) as unknown as Json,
      source: "match",
    });
    if (error) throw error;
  } catch (error) {
    tableFailed(error);
  }
}

/** A traveller's "Change place" pick for a stop: their one vote for that name. */
export async function rememberPick(
  userId: string,
  name: string | null | undefined,
  pick: { lat: number; lon: number; label: string },
): Promise<void> {
  const key = placeNameKey(name);
  if (tableMissing || !key) return;
  try {
    const hash = sha(key);
    const db = await admin();
    const { error } = await db.from("resolved_places").upsert(
      {
        name_key: hash,
        lat: pick.lat,
        lon: pick.lon,
        label: pick.label.slice(0, 300),
        source: "traveller",
        voter: sha(`${userId}|${key}`),
        created_at: new Date().toISOString(),
      },
      { onConflict: "name_key,voter" },
    );
    if (error) throw error;
  } catch (error) {
    tableFailed(error);
  }
}
