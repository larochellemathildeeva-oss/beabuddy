import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TOUR_PROGRESS_KEY,
  TOUR_SEEN_KEY,
  type TourStorage,
  beginTourReplay,
  hasSeenTour,
  markTourSeen,
  readTourProgress,
  saveTourProgress,
  shouldAutoOpenTour,
} from "./tour-state.ts";

function fakeStorage(seed: Record<string, string> = {}): TourStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("tour storage lifecycle", () => {
  it("does not open for a signed-out visitor", () => {
    // The bug: the sheet opened over the sign-in form, then navigated into
    // gated routes that bounced straight back to /auth.
    const s = fakeStorage();
    assert.equal(shouldAutoOpenTour(s, { signedIn: false }), false);
    assert.equal(shouldAutoOpenTour(s, { signedIn: true }), true);
  });

  it("keeps a skip through signing up", () => {
    // The bug: skip wrote "seen", then signup cleared it and re-opened the
    // chooser seconds later.
    const s = fakeStorage();
    markTourSeen(s);
    assert.equal(shouldAutoOpenTour(s, { signedIn: true }), false);
  });

  it("remembers the step so a closed tab is not a restart", () => {
    // The bug: progress was only written on completion, so quitting on step 9
    // of 42 meant reading all of it again.
    const s = fakeStorage();
    saveTourProgress(s, { mode: "deep", step: 9 });
    assert.deepEqual(readTourProgress(s), { mode: "deep", step: 9 });
  });

  it("replay does not un-mark the tour as seen", () => {
    // The bug: replaying cleared "seen" up front, so leaving mid-replay made
    // the next session look brand new.
    const s = fakeStorage();
    markTourSeen(s);
    saveTourProgress(s, { mode: "quick", step: 3 });
    beginTourReplay(s);
    assert.equal(hasSeenTour(s), true, "replay must never clear the seen mark");
    assert.equal(readTourProgress(s), null, "replay starts from the top");
  });

  it("finishing clears progress so a later replay starts clean", () => {
    const s = fakeStorage();
    saveTourProgress(s, { mode: "deep", step: 20 });
    markTourSeen(s);
    assert.equal(s.map.get(TOUR_SEEN_KEY), "yes");
    assert.equal(s.map.has(TOUR_PROGRESS_KEY), false);
  });

  it("ignores corrupt or hand-edited progress rather than throwing", () => {
    for (const raw of ["not json", "{}", '{"mode":"sideways","step":2}', '{"mode":"quick"}', '{"mode":"quick","step":-1}', '{"mode":"quick","step":1.5}']) {
      assert.equal(readTourProgress(fakeStorage({ [TOUR_PROGRESS_KEY]: raw })), null, raw);
    }
  });
});
