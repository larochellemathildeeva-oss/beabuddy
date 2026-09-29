import { strict as assert } from "node:assert";
import { test } from "node:test";
import { onlyAreaMatches, rankByName, stopTitleAddsToQuery } from "./place-match.ts";

const catCafe = {
  name: "Shinsaibashi Mocha Cat Cafe",
  address: "Daihoji-dori, Chūō Ward, Osaka, Higashi-Shinsaibashi 1-chome 542-8799, Japan",
  city: "Osaka",
  country: "Japan",
  lat: 34.67369,
  lon: 135.50302,
};
const gram = {
  name: "GRAM Shinsaibashi",
  address: "Suomachi-dori, Chūō Ward, Osaka, Higashi-Shinsaibashi 1-chome, Japan",
  city: "Osaka",
  country: "Japan",
};
const excelsior = {
  name: "EXCELSIOR CAFE",
  address: "Shinsaibashisuji Shopping Street, Chūō Ward, Osaka, Shinsaibashisuji 2, Japan",
  city: "Osaka",
  country: "Japan",
  lat: 34.669842,
  lon: 135.501425,
};

test("a place sharing only the neighbourhood and 'cafe' is only the area", () => {
  assert.equal(onlyAreaMatches("Caffé Shinsaibashi", catCafe), true);
  assert.equal(onlyAreaMatches("Caffé Shinsaibashi", gram), true);
});

test("the café's own name matches, whatever way cafe is spelt", () => {
  assert.equal(onlyAreaMatches("Excelsior Caffé Shinsaibashi", excelsior), false);
  assert.equal(onlyAreaMatches("Excelsior Caffè", excelsior), false);
  assert.equal(onlyAreaMatches("Excelsior Caffé Shinsaibashi", catCafe), true);
});

test("a name that is only area words matches the place called just that", () => {
  const station = { name: "Hiroshima Station", address: "Minami Ward, Hiroshima, Japan" };
  assert.equal(onlyAreaMatches("Hiroshima Station", station), false);
});

test("a kind of place is never marked", () => {
  assert.equal(onlyAreaMatches("cafe", catCafe), false);
});

test("a typo in the name still matches", () => {
  assert.equal(onlyAreaMatches("Excelsor Cafe", excelsior), false);
});

test("real matches go first, the rest are marked", () => {
  const ranked = rankByName([catCafe, excelsior], "Excelsior Caffé Shinsaibashi");
  assert.equal(ranked[0]!.name, "EXCELSIOR CAFE");
  assert.equal(ranked[0]!.weak, undefined);
  assert.equal(ranked[1]!.weak, true);
});

test("beside the stop's pin leads among equal matches", () => {
  const far = { ...excelsior, name: "Excelsior Caffe", lat: 35.68, lon: 139.69 };
  const ranked = rankByName([far, excelsior], "Excelsior", {
    pin: { lat: 34.66985, lon: 135.50143 },
  });
  assert.equal(ranked[0]!.lat, 34.669842);
});

test("the stop's name is searched only when it adds to the query", () => {
  assert.equal(stopTitleAddsToQuery("Caffé Shinsaibashi", "Excelsior Caffé Shinsaibashi"), true);
  assert.equal(stopTitleAddsToQuery("Excelsior Caffé", "excelsior caffé"), false);
  assert.equal(stopTitleAddsToQuery("sushi", "Lunch"), false);
  assert.equal(stopTitleAddsToQuery("sushi", ""), false);
});

test("a place asked for by its local name matches through its other names", () => {
  const ranked = rankByName([excelsior], "エクセルシオール カフェ 心斎橋", {
    namesOf: () => ["エクセルシオール カフェ 心斎橋店", "EXCELSIOR CAFE"],
  });
  assert.equal(ranked[0]!.weak, undefined);
});

test("a local-script ask answered only in English is not judged", async () => {
  const { scriptsDiffer } = await import("./place-match.ts");
  assert.equal(scriptsDiffer("エクセルシオール カフェ", ["EXCELSIOR CAFE"]), true);
  assert.equal(scriptsDiffer("エクセルシオール カフェ", ["エクセルシオール"]), false);
  assert.equal(scriptsDiffer("Excelsior", ["EXCELSIOR CAFE"]), false);
  const ranked = rankByName([excelsior], "エクセルシオール カフェ 心斎橋");
  assert.equal(ranked[0]!.weak, undefined);
});
