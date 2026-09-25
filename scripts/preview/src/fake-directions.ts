export type RouteLeg = any;
const w = window as unknown as { __routeCalls?: unknown[] };
type S = { title: string; lat?: number | null; lon?: number | null; day_date?: string | null };
const km = (a: S, b: S) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat! - a.lat!) * r) / 2) ** 2 +
    Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(((b.lon! - a.lon!) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
/** A 16-minute walk per leg, except same-day pins 150+ km apart, which the real router flags. */
export const buildRoutes = async (input?: { data?: { stops?: S[] } }) => {
  (w.__routeCalls ??= []).push(input?.data ?? null);
  const stops = input?.data?.stops ?? [];
  const legs = stops.length > 1
    ? stops.slice(0, -1).map((a, i) => {
        const b = stops[i + 1]!;
        const placed = a.lat != null && b.lat != null;
        const apart = placed ? km(a, b) : 0;
        return a.day_date && a.day_date === b.day_date && apart > 150
          ? { from: a.title, to: b.title, mode: "walking", distance: 0, duration: 0, steps: [], mapUrl: "#", farApartKm: Math.round(apart) }
          : { from: a.title, to: b.title, mode: "walking", distance: 1200, duration: 960, steps: [], mapUrl: "#" };
      })
    : [{ from: "", to: "", mode: "walking", distance: 1200, duration: 960, steps: [], mapUrl: "#" }];
  return { legs, unresolved: [] };
};
