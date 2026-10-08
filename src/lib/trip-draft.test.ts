import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readTripDraft,
  writeTripDraft,
  forgetTripDraft,
  tripDraftKey,
  TRIP_DRAFT_TTL,
  type TripDraft,
} from "./trip-draft.ts";
const draft: TripDraft = {
  form: {
    title: "Kyoto",
    city: "Kyoto",
    country: "Japan",
    start_date: "",
    end_date: "",
    dates_status: "tentative",
  },
  multiCity: false,
  cities: [],
  dayTrips: [],
  withBudget: true,
  packTemplateId: "",
  plan: "build",
  ask: "Quiet places",
};
function storage() {
  const rows = new Map<string, string>();
  return {
    rows,
    getItem: (k: string) => rows.get(k) ?? null,
    setItem: (k: string, v: string) => {
      rows.set(k, v);
    },
    removeItem: (k: string) => {
      rows.delete(k);
    },
  };
}
test("draft survives storage reload and keeps planning intent", () => {
  const store = storage();
  assert.equal(writeTripDraft(store, "a", draft, 1000), true);
  assert.deepEqual(readTripDraft(store, "a", 1001), draft);
  assert.equal(readTripDraft(store, "b", 1001), null);
});
test("expiry and malformed payloads are removed", () => {
  const store = storage();
  writeTripDraft(store, "a", draft, 1000);
  assert.equal(readTripDraft(store, "a", 1000 + TRIP_DRAFT_TTL), null);
  assert.equal(store.rows.has(tripDraftKey("a")), false);
  store.setItem(
    tripDraftKey("a"),
    JSON.stringify({
      version: 1,
      uid: "a",
      expiresAt: 5000,
      draft: { ...draft, form: { ...draft.form, dates_status: "invalid" } },
    }),
  );
  assert.equal(readTripDraft(store, "a", 1001), null);
  assert.equal(store.rows.has(tripDraftKey("a")), false);
});
test("copied envelopes cannot expose another account's draft", () => {
  const store = storage();
  writeTripDraft(store, "a", draft, 1000);
  store.setItem(tripDraftKey("b"), store.getItem(tripDraftKey("a"))!);
  assert.equal(readTripDraft(store, "b", 1001), null);
});
test("stable attempt IDs and packing payload survive reload", () => {
  const store = storage();
  const attempt = {
    ownerId: "a",
    tripId: "00000000-0000-4000-8000-000000000001",
    stopIds: ["00000000-0000-4000-8000-000000000002"],
    packing: {
      ownerId: "a",
      id: "00000000-0000-4000-8000-000000000003",
      name: "Carry-on",
      emoji: "",
      items: [
        {
          id: "00000000-0000-4000-8000-000000000004",
          label: "Passport",
          section: null,
          quantity: 1,
        },
      ],
    },
  };
  writeTripDraft(store, "a", { ...draft, attempt }, 1000);
  assert.deepEqual(readTripDraft(store, "a", 1001)?.attempt, attempt);
  forgetTripDraft(store, "a");
  assert.equal(readTripDraft(store, "a", 1002), null);
});
test("blocked or full storage returns failure without throwing", () => {
  const store = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(writeTripDraft(store, "a", draft), false);
  assert.equal(readTripDraft(store, "a"), null);
  assert.doesNotThrow(() => forgetTripDraft(store, "a"));
});
