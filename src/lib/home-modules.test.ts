import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { savedForTrip, tripTowns, worthADetour } from "./home-modules.ts";

describe("Home's trip modules", () => {
  const rows = [
    { id: "1", name: "Pastéis de Belém", city: "Lisbon, Portugal", visited: false },
    { id: "2", name: "Time Out Market", city: "lisbon", visited: false },
    { id: "3", name: "Livraria Lello", city: "Porto", visited: false },
    { id: "4", name: "Castelo", city: "Lisboa", visited: false },
    { id: "5", name: "LX Factory", city: "Lisbon", visited: true },
  ];

  it("finds the places saved in the trip's towns", () => {
    const towns = tripTowns({ city: "Lisbon" }, [{ city: "Sintra" }, { city: null }]);
    assert.deepEqual([...towns], ["lisbon", "sintra"]);
    assert.deepEqual(
      savedForTrip(rows, towns).map((r) => r.id),
      ["1", "2"],
    );
  });

  it("offers the first saved place the plan does not have", () => {
    const saved = savedForTrip(rows, tripTowns({ city: "Lisbon" }, []));
    assert.equal(worthADetour(saved, ["Breakfast at Pasteis de Belem", "Walk"])?.id, "2");
    assert.equal(worthADetour(saved, ["Pastéis de Belém", "Time Out Market"]), null);
    assert.equal(worthADetour([], ["x"]), null);
  });
});
