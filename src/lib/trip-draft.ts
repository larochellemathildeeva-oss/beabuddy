import { z } from "zod";

export const TRIP_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
export const tripDraftKey = (uid: string) => `bea.trip-draft.${uid}`;
const text = z.string().max(2000);
const city = z.object({
  city: text,
  country: text,
  start: text,
  end: text,
  lat: z.number().finite().optional(),
  lon: z.number().finite().optional(),
  dayTrip: z.boolean().optional(),
});
const packingItem = z.object({
  id: z.string().uuid(),
  label: text,
  section: text.nullable(),
  quantity: z.number().finite(),
});
export const tripDraftSchema = z.object({
  form: z.object({
    title: text,
    city: text,
    country: text,
    start_date: text,
    end_date: text,
    dates_status: z.enum(["tentative", "confirmed"]),
  }),
  multiCity: z.boolean(),
  cities: z.array(city).max(100),
  dayTrips: z.array(city).max(100),
  withBudget: z.boolean(),
  packTemplateId: text,
  plan: z.enum(["build", "import"]).optional(),
  ask: text.optional(),
  attempt: z
    .object({
      ownerId: text,
      tripId: z.string().uuid(),
      stopIds: z.array(z.string().uuid()).max(200),
      packing: z
        .object({
          ownerId: text,
          id: z.string().uuid(),
          name: text,
          emoji: text,
          items: z.array(packingItem).max(2000),
        })
        .optional(),
    })
    .optional(),
});
export type TripDraft = z.infer<typeof tripDraftSchema>;
export type PackingRecovery = NonNullable<NonNullable<TripDraft["attempt"]>["packing"]>;
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readTripDraft(
  store: DraftStorage,
  uid: string,
  now = Date.now(),
): TripDraft | null {
  try {
    const raw: unknown = JSON.parse(store.getItem(tripDraftKey(uid)) ?? "null");
    const envelope = z
      .object({
        version: z.literal(1),
        uid: z.literal(uid),
        expiresAt: z.number().finite(),
        draft: tripDraftSchema,
      })
      .safeParse(raw);
    if (
      !envelope.success ||
      (envelope.success &&
        envelope.data.draft.attempt &&
        (envelope.data.draft.attempt.ownerId !== uid ||
          (envelope.data.draft.attempt.packing &&
            envelope.data.draft.attempt.packing.ownerId !== uid))) ||
      envelope.data.expiresAt <= now ||
      envelope.data.expiresAt > now + TRIP_DRAFT_TTL
    ) {
      store.removeItem(tripDraftKey(uid));
      return null;
    }
    return envelope.data.draft;
  } catch {
    try {
      store.removeItem(tripDraftKey(uid));
    } catch {
      /* blocked storage */
    }
    return null;
  }
}
export function writeTripDraft(
  store: DraftStorage,
  uid: string,
  draft: TripDraft,
  now = Date.now(),
): boolean {
  try {
    store.setItem(
      tripDraftKey(uid),
      JSON.stringify({
        version: 1,
        uid,
        expiresAt: now + TRIP_DRAFT_TTL,
        draft: tripDraftSchema.parse(draft),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function forgetTripDraft(store: DraftStorage, uid: string): void {
  try {
    store.removeItem(tripDraftKey(uid));
  } catch {
    /* storage unavailable */
  }
}
export function hasTripDraftInput(draft: TripDraft): boolean {
  return Boolean(
    draft.attempt ||
    draft.form.title.trim() ||
    draft.form.city.trim() ||
    draft.form.country.trim() ||
    draft.form.start_date ||
    draft.form.end_date ||
    draft.withBudget ||
    draft.packTemplateId ||
    draft.cities.some((c) => c.city.trim() || c.start || c.end) ||
    draft.dayTrips.some((c) => c.city.trim() || c.start || c.end),
  );
}
