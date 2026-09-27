import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  commonsFileName,
  commonsImageInfoUrl,
  commonsRefFromTags,
  photoCredit,
  readCommonsImage,
  readWikidataImage,
  wikidataImageUrl,
} from "./wikimedia.ts";
import { readPlaceDetails } from "./geoapify.ts";

test("a Commons file is read however a mapper wrote it", () => {
  assert.equal(commonsFileName("File:Pont Neuf.jpg"), "Pont Neuf.jpg");
  assert.equal(commonsFileName("Pont_Neuf.JPG"), "Pont Neuf.JPG");
  assert.equal(
    commonsFileName("https://commons.wikimedia.org/wiki/File:Caf%C3%A9_de_Flore.jpg"),
    "Café de Flore.jpg",
  );
  assert.equal(commonsFileName("Category:Pont Neuf"), null);
  assert.equal(commonsFileName("https://example.com/wiki/File:Pont.jpg"), null);
  assert.equal(commonsFileName("https://example.com/pont.jpg"), null);
  assert.equal(commonsFileName("File:Plan.pdf"), null);
  assert.equal(commonsFileName(42), null);
});

test("a named file wins over the Wikidata item, and a brand's item is never used", () => {
  assert.deepEqual(commonsRefFromTags({ wikimedia_commons: "File:A.jpg", wikidata: "Q1" }), {
    file: "A.jpg",
  });
  assert.deepEqual(commonsRefFromTags({ wikidata: "q243" }), { wikidata: "Q243" });
  assert.equal(commonsRefFromTags({ "brand:wikidata": "Q244457" }), null);
  assert.equal(commonsRefFromTags({ wikidata: "not an id" }), null);
});

test("the requests ask for a thumbnail with its credit, and an item's image", () => {
  const url = new URL(commonsImageInfoUrl("Pont Neuf.jpg"));
  assert.equal(url.hostname, "commons.wikimedia.org");
  assert.equal(url.searchParams.get("titles"), "File:Pont Neuf.jpg");
  assert.equal(url.searchParams.get("iiurlwidth"), "640");
  assert.match(url.searchParams.get("iiextmetadatafilter")!, /Artist/);
  const wd = new URL(wikidataImageUrl("Q243"));
  assert.equal(wd.searchParams.get("entity"), "Q243");
  assert.equal(wd.searchParams.get("property"), "P18");
});

test("Wikidata's preferred image is taken, a deprecated one never", () => {
  const claim = (value: string, rank = "normal") => ({
    rank,
    mainsnak: { datavalue: { value, type: "string" } },
  });
  assert.equal(
    readWikidataImage({ claims: { P18: [claim("Old.jpg"), claim("Best.jpg", "preferred")] } }),
    "Best.jpg",
  );
  assert.equal(readWikidataImage({ claims: { P18: [claim("Bad.jpg", "deprecated")] } }), null);
  assert.equal(readWikidataImage({ claims: {} }), null);
});

const info = (extmetadata: Record<string, { value: string }>, over = {}) => ({
  query: {
    pages: [
      {
        title: "File:Pont Neuf.jpg",
        imageinfo: [
          {
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pont_Neuf.jpg/640px-Pont_Neuf.jpg",
            thumbwidth: 640,
            thumbheight: 427,
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Pont_Neuf.jpg",
            extmetadata,
            ...over,
          },
        ],
      },
    ],
  },
});

test("a Commons answer gives the thumbnail, its page and a plain-text credit", () => {
  const photo = readCommonsImage(
    info({
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane&nbsp;Doe</a>' },
      LicenseShortName: { value: "CC BY-SA 4.0" },
    }),
  );
  assert.equal(photo?.author, "Jane Doe");
  assert.equal(photo?.license, "CC BY-SA 4.0");
  assert.equal(photo?.width, 640);
  assert.equal(photo?.page, "https://commons.wikimedia.org/wiki/File:Pont_Neuf.jpg");
  assert.equal(photoCredit(photo!), "Photo: Jane Doe · CC BY-SA 4.0 · Wikimedia Commons");
  assert.equal(photoCredit({}), "Photo · Wikimedia Commons");
});

test("missing, restricted or off-site files are not shown", () => {
  assert.equal(readCommonsImage({ query: { pages: [{ missing: true }] } }), null);
  assert.equal(readCommonsImage(info({ Restrictions: { value: "trademarked" } })), null);
  assert.equal(readCommonsImage(info({}, { thumburl: "https://example.com/a.jpg" })), null);
  assert.equal(readCommonsImage(null), null);
});

test("Place Details carries the Commons reference from the OSM tags", () => {
  const facts = readPlaceDetails({
    features: [
      {
        properties: {
          feature_type: "details",
          name: "Pont Neuf",
          wiki_and_media: { wikidata: "Q1" },
          datasource: { raw: { wikimedia_commons: "File:Pont Neuf.jpg" } },
        },
      },
    ],
  });
  assert.deepEqual(facts?.commons, { file: "Pont Neuf.jpg" });
  const onlyItem = readPlaceDetails({
    features: [{ properties: { name: "X", wiki_and_media: { wikidata: "Q1" } } }],
  });
  assert.deepEqual(onlyItem?.commons, { wikidata: "Q1" });
});
