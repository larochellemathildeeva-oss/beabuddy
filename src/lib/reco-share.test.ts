import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shareStatusLine,
  shareSummaryLine,
  sharedListFromRows,
  suggestedShareTitle,
  toKeptReco,
  toShareItems,
  type SharedItem,
} from "./reco-share.ts";

const reco = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  name: "Bar Raval",
  city: "Toronto",
  country: "Canada",
  address: "505 College St",
  category: "bar",
  notes: "Overrated, went on a bad date here",
  source: "Instagram",
  url: "https://example.com/bar",
  lat: 43.6555,
  lon: -79.4111,
  pin_type: "visited",
  ...over,
});

describe("toShareItems", () => {
  it("drops your private notes unless you say otherwise", () => {
    const [item] = toShareItems("s1", [reco()]);
    assert.equal(item!.notes, null);
    assert.equal(item!.name, "Bar Raval");
    assert.equal(item!.city, "Toronto");
  });

  it("carries notes when the sharer opts in", () => {
    const [item] = toShareItems("s1", [reco()], { includeNotes: true });
    assert.equal(item!.notes, "Overrated, went on a bad date here");
  });

  it("numbers items so the order survives", () => {
    const items = toShareItems("s1", [reco(), reco({ id: "r2", name: "Sotto" })]);
    assert.deepEqual(
      items.map((i) => i.position),
      [0, 1],
    );
    assert.equal(items[0]!.share_id, "s1");
  });

  it("turns blank strings into null rather than empty columns", () => {
    const [item] = toShareItems("s1", [reco({ city: "   ", country: "", address: null })]);
    assert.equal(item!.city, null);
    assert.equal(item!.country, null);
    assert.equal(item!.address, null);
  });

  it("keeps coordinates only when they are really numbers", () => {
    const [withPin] = toShareItems("s1", [reco()]);
    assert.equal(withPin!.lat, 43.6555);
    const [without] = toShareItems("s1", [reco({ lat: null, lon: undefined })]);
    assert.equal(without!.lat, null);
    assert.equal(without!.lon, null);
  });

  it("trims the name", () => {
    const [item] = toShareItems("s1", [reco({ name: "  Sotto Sotto  " })]);
    assert.equal(item!.name, "Sotto Sotto");
  });
});

const shared = (over: Partial<SharedItem> = {}): SharedItem => ({
  id: "i1",
  name: "Bar Raval",
  city: "Toronto",
  country: "Canada",
  address: "505 College St",
  category: "bar",
  notes: "",
  source: "Instagram",
  url: "https://example.com/bar",
  lat: 43.6555,
  lon: -79.4111,
  pinType: "visited",
  ...over,
});

describe("toKeptReco", () => {
  it("records who gave it to you", () => {
    const kept = toKeptReco(shared(), "Sarah");
    assert.equal(kept.recommended_by, "Sarah");
  });

  it("never inherits someone else's visited flag", () => {
    const kept = toKeptReco(shared({ pinType: "visited" }), "Sarah");
    assert.equal(kept.pin_type, "reco");
  });

  it("leaves recommended_by off when the sharer had no name", () => {
    const kept = toKeptReco(shared(), "   ");
    assert.equal("recommended_by" in kept, false);
  });

  it("omits empty fields instead of writing empty strings", () => {
    const kept = toKeptReco(shared({ address: "", category: "", url: "" }), "Sarah");
    assert.equal("address" in kept, false);
    assert.equal("category" in kept, false);
    assert.equal("url" in kept, false);
  });

  it("keeps the map pin", () => {
    const kept = toKeptReco(shared(), "Sarah");
    assert.equal(kept.lat, 43.6555);
    assert.equal(kept.lon, -79.4111);
  });

  it("drops a pin that never existed", () => {
    const kept = toKeptReco(shared({ lat: null, lon: null }), "Sarah");
    assert.equal("lat" in kept, false);
  });
});

const dbRow = (over: Record<string, unknown> = {}) => ({
  share_id: "s1",
  title: "Lisbon list",
  note: "the good ones",
  shared_by_name: "Sarah",
  item_id: "i1",
  name: "Bar Raval",
  city: "Toronto",
  country: "Canada",
  address: null,
  category: null,
  notes: null,
  source: null,
  url: null,
  lat: null,
  lon: null,
  pin_type: null,
  ...over,
});

describe("sharedListFromRows", () => {
  it("folds repeated share columns into one list", () => {
    const list = sharedListFromRows([dbRow(), dbRow({ item_id: "i2", name: "Sotto" })]);
    assert.equal(list?.title, "Lisbon list");
    assert.equal(list?.sharedByName, "Sarah");
    assert.equal(list?.items.length, 2);
  });

  it("returns null for no rows", () => {
    assert.equal(sharedListFromRows([]), null);
  });

  it("falls back to a title rather than showing nothing", () => {
    const list = sharedListFromRows([dbRow({ title: null })]);
    assert.equal(list?.title, "Shared places");
  });

  it("defaults a missing pin type to reco", () => {
    const list = sharedListFromRows([dbRow()]);
    assert.equal(list?.items[0]?.pinType, "reco");
  });
});

describe("suggestedShareTitle", () => {
  it("names one city", () => {
    assert.equal(suggestedShareTitle([reco(), reco({ id: "r2" })]), "2 places in Toronto");
  });

  it("names two", () => {
    const title = suggestedShareTitle([reco(), reco({ id: "r2", city: "Montreal" })]);
    assert.equal(title, "2 places in Toronto and Montreal");
  });

  it("counts more than two", () => {
    const title = suggestedShareTitle([
      reco(),
      reco({ id: "r2", city: "Montreal" }),
      reco({ id: "r3", city: "Lisbon" }),
    ]);
    assert.equal(title, "3 places in 3 cities");
  });

  it("falls back to the month when nothing has a city", () => {
    const title = suggestedShareTitle([reco({ city: "" })], new Date("2026-09-17T12:00:00Z"));
    assert.equal(title, "1 place, September");
  });
});

describe("shareSummaryLine", () => {
  it("says notes stay private by default", () => {
    assert.match(shareSummaryLine(3, false), /stay private/);
  });

  it("says so when notes are going too", () => {
    assert.match(shareSummaryLine(3, true), /with your notes/);
  });

  it("asks for a pick when nothing is selected", () => {
    assert.match(shareSummaryLine(0, false), /Pick the places/);
  });

  it("gets singular right", () => {
    assert.match(shareSummaryLine(1, false), /^1 place\./);
  });
});

describe("shareStatusLine", () => {
  const base = {
    use_count: 0,
    max_uses: 50,
    expires_at: "2099-01-01T00:00:00Z",
    revoked_at: null as string | null,
  };

  it("reports a stopped share first, even if it has not expired", () => {
    assert.equal(shareStatusLine({ ...base, revoked_at: "2026-01-01T00:00:00Z" }), "Stopped");
  });

  it("reports expiry", () => {
    assert.equal(shareStatusLine({ ...base, expires_at: "2020-01-01T00:00:00Z" }), "Expired");
  });

  it("says when nobody has opened it", () => {
    assert.equal(shareStatusLine(base), "Not opened yet");
  });

  it("counts one person", () => {
    assert.equal(shareStatusLine({ ...base, use_count: 1 }), "Kept by 1 person");
  });

  it("marks a share that has hit its cap", () => {
    assert.equal(shareStatusLine({ ...base, use_count: 50 }), "Kept by 50 people · full");
  });
});
