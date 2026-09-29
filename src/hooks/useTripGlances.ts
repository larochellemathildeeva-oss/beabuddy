import { useEffect, useMemo, useState } from "react";
import { isSavedDirectionItem } from "@/lib/direction-stops";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import { currentHighlights, packingReadiness } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  documentHighlights,
  firstStop,
  nextTodo,
  plansConfirmed,
  stopCount,
} from "@/lib/trip-glance";
import { lastLoaded, rememberLoaded, screenGeneration } from "@/lib/screen-cache";

export type GlanceItem = {
  id: string;
  trip_id: string;
  day_date: string | null;
  time_label: string | null;
  title: string;
  kind: string;
  detail: string | null;
  address: string | null;
  booked?: boolean;
  /** The live tracker's taps, so a card can say where you are today. */
  arrived_at?: string | null;
  left_at?: string | null;
};

export type TripGlance = {
  items: GlanceItem[];
  flight: GlanceItem | null;
  lodging: GlanceItem | null;
  firstStop: GlanceItem | null;
  /** Places to see, leaving out travel, beds and notes. */
  stops: number;
  packing: ReturnType<typeof packingReadiness>;
  plans: ReturnType<typeof plansConfirmed>;
  /** Open to-dos on the trip, and the one due soonest. */
  todos: { open: number; next: GlanceTodo | null };
  /** A flight and a stay from Trip documents filed to the trip, when it has any. */
  booked: { flight: GlanceDocument | null; lodging: GlanceDocument | null };
};

export type GlanceDocument = { id: string; trip_id: string | null; kind: string; title: string };

export type GlanceTodo = {
  id: string;
  trip_id: string;
  title: string;
  due_on: string | null;
  done: boolean;
  position: number;
};

type GlanceRows = {
  items: GlanceItem[];
  packed: { trip_id: string; packed: boolean }[];
  todos: GlanceTodo[];
  docs: GlanceDocument[];
};

const COLS = "id, trip_id, day_date, time_label, title, kind, detail, address, arrived_at, left_at";

/** Kept after the first miss: the bookings migration is applied by hand. */
let bookedColumn: boolean | null = null;

/** Null when the read failed, so a hiccup is not mistaken for an empty plan. */
async function selectItems(ids: string[]): Promise<GlanceItem[] | null> {
  const query = (cols: string) =>
    supabase
      .from("itinerary_items")
      .select(cols)
      .in("trip_id", ids)
      .order("day_date", { ascending: true })
      .order("position", { ascending: true });
  if (bookedColumn !== false) {
    const first = await query(`${COLS}, booked`);
    if (!first.error) {
      bookedColumn = true;
      return (first.data ?? []) as unknown as GlanceItem[];
    }
    if (!isMissingColumn(first.error, ["booked"])) return null;
    bookedColumn = false;
  }
  const retry = await query(COLS);
  return retry.error ? null : ((retry.data ?? []) as unknown as GlanceItem[]);
}

/**
 * The flight out, the stay, how packed, how booked and what is left to do — for every trip card on
 * a screen at once.
 *
 * Four queries for the whole list rather than four per card: a hook per
 * card is how a list of ten trips turns into forty requests.
 */
export function useTripGlances(tripIds: readonly string[]) {
  const key = [...tripIds].sort().join(",");
  // The cards open with what they last said, not "nothing left to do" until
  // the to-dos arrive.
  const [last] = useState(() => lastLoaded<GlanceRows>(`glances:${key}`));
  const [items, setItems] = useState<GlanceItem[]>(last?.items ?? []);
  const [packed, setPacked] = useState<{ trip_id: string; packed: boolean }[]>(last?.packed ?? []);
  const [todos, setTodos] = useState<GlanceTodo[]>(last?.todos ?? []);
  const [docs, setDocs] = useState<GlanceDocument[]>(last?.docs ?? []);
  const [loaded, setLoaded] = useState(Boolean(last));

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    const hit = lastLoaded<GlanceRows>(`glances:${key}`);
    if (hit) {
      setItems(hit.items);
      setPacked(hit.packed);
      setTodos(hit.todos);
      setDocs(hit.docs);
      setLoaded(true);
    }
    if (ids.length === 0) {
      setItems([]);
      setPacked([]);
      setTodos([]);
      setDocs([]);
      setLoaded(true);
      return;
    }
    let active = true;
    const since = screenGeneration();
    void (async () => {
      const [rows, lists, todoRows, docRows] = await Promise.all([
        selectItems(ids),
        supabase.from("packing_lists").select("id, trip_id").in("trip_id", ids),
        // An error (the to-do migration not applied yet) just means no to-dos.
        supabase
          .from("trip_todos")
          .select("id, trip_id, title, due_on, done, position")
          .in("trip_id", ids)
          .eq("done", false),
        // Bookings kept in Trip documents. Its table arrives with a migration
        // applied by hand and is not in the generated types; an error just
        // means no documents.
        (
          supabase as unknown as {
            from: (t: string) => {
              select: (c: string) => {
                in: (
                  col: string,
                  v: string[],
                ) => {
                  order: (
                    col: string,
                    o: { ascending: boolean },
                  ) => PromiseLike<{ data: GlanceDocument[] | null; error: unknown }>;
                };
              };
            };
          }
        )
          .from("trip_documents")
          .select("id, trip_id, kind, title")
          .in("trip_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      const listTrip = new Map<string, string>();
      for (const l of lists.data ?? []) if (l.trip_id) listTrip.set(l.id, l.trip_id);
      let packing: { trip_id: string; packed: boolean }[] | null = lists.error ? null : [];
      if (listTrip.size > 0) {
        const { data, error } = await supabase
          .from("packing_items")
          .select("list_id, packed")
          .in("list_id", [...listTrip.keys()]);
        packing = error
          ? null
          : (data ?? []).map((p) => ({
              trip_id: listTrip.get(p.list_id) ?? "",
              packed: Boolean(p.packed),
            }));
      }
      if (!active) return;
      // A read that failed keeps what the cards last said rather than
      // blanking it — and so does the copy kept for the next visit.
      const next: GlanceRows = {
        // Saved walks and drives are travel between stops, not stops to count.
        items: rows ? rows.filter((row) => !isSavedDirectionItem(row)) : (hit?.items ?? []),
        packed: packing ?? hit?.packed ?? [],
        todos: todoRows.error ? (hit?.todos ?? []) : ((todoRows.data ?? []) as GlanceTodo[]),
        docs: docRows.error ? (hit?.docs ?? []) : (docRows.data ?? []),
      };
      setItems(next.items);
      setPacked(next.packed);
      setTodos(next.todos);
      setDocs(next.docs);
      setLoaded(true);
      rememberLoaded(`glances:${key}`, next, since);
    })();
    return () => {
      active = false;
    };
  }, [key]);

  const glances = useMemo(() => {
    const today = toLocalISODate(new Date());
    const out: Record<string, TripGlance> = {};
    for (const id of key ? key.split(",") : []) {
      const mine = items.filter((i) => i.trip_id === id);
      const { flight, lodging } = currentHighlights(mine, today);
      out[id] = {
        items: mine,
        flight,
        lodging,
        firstStop: firstStop(mine),
        stops: stopCount(mine),
        packing: packingReadiness(packed.filter((p) => p.trip_id === id)),
        plans: plansConfirmed(mine),
        todos: (() => {
          const open = todos.filter((t) => t.trip_id === id && !t.done);
          return { open: open.length, next: nextTodo(open) };
        })(),
        booked: documentHighlights(docs.filter((d) => d.trip_id === id)),
      };
    }
    return out;
  }, [key, items, packed, todos, docs]);

  return { glances, loaded };
}
