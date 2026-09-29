import { createHash } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import { SEARCH_CACHE_TTL_MS, stillFresh, type CachedSearch } from "@/lib/place-search-cache";

/**
 * Place search answers, kept so the same search is paid for once.
 *
 * In memory first, then in `place_search_cache` (the migration of that name),
 * shared by every server and kept two weeks. The key is a hash of the search
 * (place-search-cache.ts), never the words themselves or who searched. An
 * empty answer is kept an hour, in memory only. Two identical searches at
 * once share one lookup. Until the migration is applied, memory alone, with
 * one warning in the log.
 */
const MEMORY_MAX = 2_000;
/** About one save in this many also clears out answers past their time. */
const SWEEP_EVERY = 200;

type Saved<P> = { at: number; entry: CachedSearch<P> };

const memory = new Map<string, Saved<unknown>>();
const running = new Map<string, Promise<CachedSearch<unknown>>>();
let tableMissing = false;

function hashOf(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function remember<P>(hash: string, saved: Saved<P>) {
  memory.delete(hash);
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value!);
  memory.set(hash, saved as Saved<unknown>);
}

function tableFailed(error: unknown) {
  if (tableMissing) return;
  tableMissing = true;
  console.warn(
    "[places] search cache table unavailable (is the place_search_cache migration applied?); memory only:",
    error instanceof Error ? error.message : error,
  );
}

async function fromTable<P>(hash: string): Promise<Saved<P> | null> {
  if (tableMissing) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("place_search_cache")
      .select("results, created_at")
      .eq("key", hash)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const at = Date.parse(data.created_at);
    const entry = data.results as unknown as CachedSearch<P>;
    if (!Array.isArray(entry?.places) || !stillFresh(at, false, Date.now())) return null;
    return { at, entry };
  } catch (error) {
    tableFailed(error);
    return null;
  }
}

async function toTable<P>(hash: string, entry: CachedSearch<P>) {
  if (tableMissing) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("place_search_cache").upsert({
      key: hash,
      results: entry as unknown as Json,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    if (Math.random() < 1 / SWEEP_EVERY) {
      const cutoff = new Date(Date.now() - SEARCH_CACHE_TTL_MS).toISOString();
      await supabaseAdmin.from("place_search_cache").delete().lt("created_at", cutoff);
    }
  } catch (error) {
    tableFailed(error);
  }
}

/**
 * The answer to the search `key`, kept or looked up with `run`. A lookup that
 * throws is not kept: the next search tries again.
 */
export async function cachedPlaceSearch<P>(
  key: string,
  run: () => Promise<CachedSearch<P>>,
): Promise<CachedSearch<P>> {
  const hash = hashOf(key);
  const now = Date.now();
  const known = memory.get(hash) as Saved<P> | undefined;
  if (known && stillFresh(known.at, known.entry.places.length === 0, now)) return known.entry;
  const already = running.get(hash) as Promise<CachedSearch<P>> | undefined;
  if (already) return already;

  const lookup = (async () => {
    const saved = await fromTable<P>(hash);
    if (saved) {
      remember(hash, saved);
      return saved.entry;
    }
    const entry = await run();
    remember(hash, { at: Date.now(), entry });
    if (entry.places.length) void toTable(hash, entry);
    return entry;
  })();
  running.set(hash, lookup as Promise<CachedSearch<unknown>>);
  try {
    return await lookup;
  } finally {
    running.delete(hash);
  }
}
