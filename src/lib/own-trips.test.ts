import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ownTrips } from "./own-trips.ts";

test("ownTrips keeps only trips the traveller owns or joined", () => {
  const trips = [
    { id: "mine", owner_id: "me" },
    { id: "shared", owner_id: "friend" },
    { id: "stranger", owner_id: "someone" },
  ];
  const members = [
    { trip_id: "mine", user_id: "me" },
    { trip_id: "shared", user_id: "friend" },
    { trip_id: "shared", user_id: "me" },
    { trip_id: "stranger", user_id: "someone" },
  ];
  const out = ownTrips(trips, members, "me");
  assert.deepEqual(
    out.trips.map((t) => t.id),
    ["mine", "shared"],
  );
  assert.equal(
    out.members.some((m) => m.trip_id === "stranger"),
    false,
  );
});
