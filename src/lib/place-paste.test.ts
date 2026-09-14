import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cleanPastedHttpsUrl,
  extractPastedPlaceLink,
  looksLikePastedPlaceLink,
} from "./place-paste.ts";

test("cleanPastedHttpsUrl strips trailing chat punctuation", () => {
  assert.equal(cleanPastedHttpsUrl("https://maps.app.goo.gl/abc)."), "https://maps.app.goo.gl/abc");
});

test("extractPastedPlaceLink accepts a bare https Maps link", () => {
  const out = extractPastedPlaceLink("  https://maps.app.goo.gl/AbCdEf  ");
  assert.equal(out?.url, "https://maps.app.goo.gl/AbCdEf");
  assert.equal(out?.nameHint, undefined);
});

test("extractPastedPlaceLink pulls the link out of a Maps share sheet paste", () => {
  const paste = `Café de Flore
★★★★☆ · Cafe
172 Boulevard Saint-Germain
https://maps.app.goo.gl/xyz123`;
  const out = extractPastedPlaceLink(paste);
  assert.equal(out?.url, "https://maps.app.goo.gl/xyz123");
  assert.equal(out?.nameHint, "Café de Flore");
});

test("extractPastedPlaceLink handles name and link on one line", () => {
  const out = extractPastedPlaceLink("Bar Raval https://maps.app.goo.gl/rr");
  assert.equal(out?.url, "https://maps.app.goo.gl/rr");
  assert.equal(out?.nameHint, "Bar Raval");
});

test("extractPastedPlaceLink adds https to scheme-less short links", () => {
  assert.equal(extractPastedPlaceLink("maps.app.goo.gl/AbCd")?.url, "https://maps.app.goo.gl/AbCd");
  assert.equal(
    extractPastedPlaceLink("maps.apple.com/?ll=48.85,2.29&q=Eiffel")?.url,
    "https://maps.apple.com/?ll=48.85,2.29&q=Eiffel",
  );
});

test("extractPastedPlaceLink prefers a Maps link when several https URLs appear", () => {
  const paste = `See https://example.com/blog and then https://maps.app.goo.gl/here`;
  assert.equal(extractPastedPlaceLink(paste)?.url, "https://maps.app.goo.gl/here");
});

test("looksLikePastedPlaceLink is false for ordinary place names", () => {
  assert.equal(looksLikePastedPlaceLink("Café de Flore, Paris"), false);
  assert.equal(looksLikePastedPlaceLink("https://maps.app.goo.gl/x"), true);
});

test("cleanPastedHttpsUrl upgrades a plain http link", () => {
  assert.equal(cleanPastedHttpsUrl("http://joesdiner.com/menu"), "https://joesdiner.com/menu");
});

test("extractPastedPlaceLink reads an http link out of a share", () => {
  const out = extractPastedPlaceLink("Joe's Diner\nhttp://joesdiner.com/menu");
  assert.equal(out?.url, "https://joesdiner.com/menu");
});

test("extractPastedPlaceLink accepts scheme-less Yelp and g.page shares", () => {
  assert.equal(
    extractPastedPlaceLink("yelp.com/biz/bar-raval-toronto")?.url,
    "https://yelp.com/biz/bar-raval-toronto",
  );
  assert.equal(extractPastedPlaceLink("g.page/barraval")?.url, "https://g.page/barraval");
});

test("extractPastedPlaceLink still refuses a plain place name", () => {
  assert.equal(extractPastedPlaceLink("Bar Raval, Toronto"), null);
  assert.equal(extractPastedPlaceLink("joesdiner.com"), null);
});
