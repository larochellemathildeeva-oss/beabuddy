import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeItineraryMetrics } from "./itinerary-metrics.ts";

describe("computeItineraryMetrics", () => {
  it("counts stops and sums cost lines in code", () => {
    const metrics = computeItineraryMetrics(
      [
        { day_date: "2026-09-12", title: "ROM", estimated_cost: 30 },
        { day_date: "2026-09-12", title: "Lunch", estimated_cost: 20 },
        { day_date: "2026-09-13", title: "High Park", estimated_cost: 0 },
      ],
      [
        { amount: 30 },
        { amount: 20 },
        { amount: 0 },
      ],
      [
        { title: "ROM", setting: "indoor", durationHours: 3 },
        { title: "Lunch", setting: "indoor", durationHours: 1 },
        { title: "High Park", setting: "outdoor", durationHours: 2 },
      ],
    );
    assert.equal(metrics.stopCount, 3);
    assert.equal(metrics.estimatedCost, 50);
    assert.equal(metrics.indoorShare, 0.67);
    assert.equal(metrics.activeHoursPerDay, 3);
    assert.equal(metrics.walkingKmPerDay, null);
    assert.equal(metrics.transitMinutesPerDay, null);
    assert.equal(metrics.longestTravelLegMinutes, null);
  });

  it("computes walking km only when every stop has coordinates", () => {
    const withCoords = computeItineraryMetrics(
      [
        { day_date: "2026-09-12", title: "ROM", estimated_cost: null, lat: 43.6677, lon: -79.3948 },
        { day_date: "2026-09-12", title: "High Park", estimated_cost: null, lat: 43.6465, lon: -79.4637 },
      ],
      [],
      [
        { title: "ROM", setting: "indoor", durationHours: 3 },
        { title: "High Park", setting: "outdoor", durationHours: 2 },
      ],
    );
    assert.ok(withCoords.walkingKmPerDay != null && withCoords.walkingKmPerDay > 5 && withCoords.walkingKmPerDay < 8);
    assert.equal(withCoords.transitMinutesPerDay, null);

    const missing = computeItineraryMetrics(
      [
        { day_date: "2026-09-12", title: "ROM", estimated_cost: null, lat: 43.6677, lon: -79.3948 },
        { day_date: "2026-09-12", title: "Lunch", estimated_cost: null },
      ],
      [],
      [
        { title: "ROM", setting: "indoor", durationHours: 3 },
        { title: "Lunch", setting: "indoor", durationHours: 1 },
      ],
    );
    assert.equal(missing.walkingKmPerDay, null);
  });
});
