// The real module, with the plan reader answered from a canned plan.
export * from "../../../src/lib/itinerary.functions";

const PLAN = {
  summary: "A day between Hiroshima and Miyajima.",
  trip_title: "Hiroshima and Miyajima",
  start_date: null,
  end_date: null,
  estimated_total: null,
  currency: null,
  costs: [],
  items: [
    { day_date: null, day_number: 1, time_label: "08:00", end_time: "08:45", duration_minutes: null, kind: "meal", title: "Breakfast at the station", detail: null, place: "Hiroshima Station", address: null, city: "Hiroshima", estimated_cost: null, currency: null, source: null },
    { day_date: null, day_number: 1, time_label: "10:00", end_time: null, duration_minutes: 90, kind: "sight", title: "Itsukushima Shrine", detail: "Go at high tide", place: "Itsukushima Shrine (厳島神社)", address: null, city: "Miyajima", estimated_cost: null, currency: null, source: null },
    { day_date: null, day_number: 1, time_label: "12:00", end_time: null, duration_minutes: null, kind: "meal", title: "Oyster lunch", detail: "Grilled oysters", place: "Kakiya", address: "539 Miyajimacho", city: "Miyajima", estimated_cost: null, currency: null, source: null },
    { day_date: null, day_number: 1, time_label: "19:00", end_time: null, duration_minutes: null, kind: "walk", title: "Evening stroll", detail: null, place: null, address: null, city: null, estimated_cost: null, currency: null, source: null },
  ],
};

export const parseItinerary = async (args: { data: unknown }) => {
  const w = window as unknown as { __parseCalls?: unknown[] };
  (w.__parseCalls ??= []).push(args.data);
  return structuredClone(PLAN);
};

// "Find alternatives": the third stop swapped for another.
export const reviseItinerary = async () => {
  const plan = structuredClone(PLAN);
  plan.items[2] = { ...plan.items[2]!, title: "Okonomiyaki lunch", place: "Okonomimura", address: null, detail: null };
  return plan;
};
