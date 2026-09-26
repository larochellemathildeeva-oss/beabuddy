import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  isAlreadyKept,
  isKeepable,
  keeperGroups,
  keeperToReco,
  type KeeperItem,
  type KeeperTrip,
} from "./trip-keepers.ts";

const lisbon: KeeperTrip = {
  id: "t1",
  title: "Lisbon long weekend",
  city: "Lisbon",
  country: "Portugal",
  start_date: "2026-05-01",
  end_date: "2026-05-04",
};

const tokyo: KeeperTrip = {
  id: "t2",
  title: "Tokyo",
  city: "Tokyo",
  country: "Japan",
  start_date: "2026-11-10",
  end_date: "2026-11-20",
};

let n = 0;
function row(patch: Partial<KeeperItem> & { title: string }): KeeperItem {
  n += 1;
  return {
    id: `i${n}`,
    trip_id: "t1",
    kind: "activity",
    detail: null,
    address: null,
    lat: null,
    lon: null,
    day_date: "2026-05-01",
    position: n,
    ...patch,
  };
}

test("isKeepable: places yes, notes and journeys no", () => {
  assert.equal(isKeepable({ kind: "meal", title: "Taberna da Rua das Flores" }), true);
  assert.equal(isKeepable({ kind: "sight", title: "Belém Tower" }), true);
  assert.equal(isKeepable({ kind: "note", title: "Bring cash" }), false);
  assert.equal(isKeepable({ kind: "transport", title: "Train to Sintra" }), false);
  assert.equal(isKeepable({ kind: "activity", title: "Walk to Alfama" }), false);
  assert.equal(isKeepable({ kind: "activity", title: "   " }), false);
});

test("keeperToReco files by glyph and says which trip it came from", () => {
  const reco = keeperToReco(
    row({
      kind: "dinner",
      title: " Cervejaria Ramiro ",
      detail: "Get the prawns",
      lat: 38.72,
      lon: -9.13,
    }),
    lisbon,
    "visited",
  );
  assert.deepEqual(reco, {
    name: "Cervejaria Ramiro",
    city: "Lisbon",
    country: "Portugal",
    category: "Restaurant",
    notes: "Get the prawns",
    source: "Trip: Lisbon long weekend",
    lat: 38.72,
    lon: -9.13,
    pin_type: "visited",
  });
  assert.equal("pin_type" in keeperToReco(row({ title: "LX Factory" }), lisbon), false);
});

test("isAlreadyKept matches the vault by name and city", () => {
  const vault = [{ name: "LX Factory", city: "Lisbon" }];
  assert.equal(isAlreadyKept(row({ title: "LX factory" }), lisbon, vault), true);
  assert.equal(isAlreadyKept(row({ title: "Time Out Market" }), lisbon, vault), false);
});

test("keeperGroups: started trips first, places in order, repeats once", () => {
  const items: KeeperItem[] = [
    row({ title: "Pastéis de Belém", day_date: "2026-05-02", position: 1 }),
    row({ title: "Bring cash", kind: "note" }),
    row({ title: "Time Out Market", day_date: "2026-05-01", position: 2 }),
    row({ title: "Time Out Market", day_date: "2026-05-03", position: 1, left_at: "x" }),
    row({ title: "Senso-ji", trip_id: "t2" }),
    row({ title: "Train to Kyoto", kind: "transport", trip_id: "t2" }),
  ];
  const groups = keeperGroups([tokyo, lisbon], items, [{ name: "Pastéis de Belém" }], "2026-09-26");
  assert.deepEqual(
    groups.map((g) => g.trip.id),
    ["t1", "t2"],
  );
  assert.deepEqual(
    groups[0]!.places.map((p) => [p.item.title, p.saved, p.went]),
    [
      ["Time Out Market", false, true],
      ["Pastéis de Belém", true, false],
    ],
  );
  assert.deepEqual(
    groups[1]!.places.map((p) => p.item.title),
    ["Senso-ji"],
  );
});

test("keeperGroups leaves out trips with nothing to keep", () => {
  const empty: KeeperTrip = { ...lisbon, id: "t3" };
  const groups = keeperGroups(
    [empty],
    [row({ title: "Note", kind: "note", trip_id: "t3" })],
    [],
    "2026-09-26",
  );
  assert.deepEqual(groups, []);
});
