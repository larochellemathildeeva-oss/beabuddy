import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  commonsFileName,
  commonsImageInfoUrl,
  commonsRefFromTags,
  photoCredit,
  readCommonsImage,
  readWikidataImage,
  readWikipediaItem,
  townTitles,
  wikidataImageUrl,
  wikipediaItemsUrl,
} from "./wikimedia.ts";
import { readPlaceDetails } from "./geoapify.ts";

test("a Commons file is read however a mapper wrote it", () => {
  assert.equal(commonsFileName("File:Pont Neuf.jpg"), "Pont Neuf.jpg");
  assert.equal(commonsFileName("Pont_Neuf.JPG"), "Pont Neuf.JPG");
  assert.equal(
    commonsFileName("https://commons.wikimedia.org/wiki/File:Caf%C3%A9_de_Flore.jpg"),
    "Café de Flore.jpg",
  );
  assert.equal(
    commonsFileName("https://upload.wikimedia.org/wikipedia/commons/a/ab/Pont_Neuf.jpg"),
    "Pont Neuf.jpg",
  );
  assert.equal(
    commonsFileName(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pont_Neuf.jpg/640px-Pont_Neuf.jpg",
    ),
    "Pont Neuf.jpg",
  );
  assert.equal(
    commonsFileName("https://commons.wikimedia.org/wiki/Special:FilePath/Pont_Neuf.jpg"),
    "Pont Neuf.jpg",
  );
  assert.equal(
    commonsFileName("https://upload.wikimedia.org/wikipedia/en/a/ab/Local_only.jpg"),
    null,
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
});

test("thumbnails served from thumb.wikimedia.org are accepted", () => {
  const credit = { Artist: { value: "Jane" }, LicenseShortName: { value: "CC BY 4.0" } };
  const thumb =
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Pont_Neuf.jpg/1024px-Pont_Neuf.jpg";
  assert.equal(readCommonsImage(info(credit, { thumburl: thumb }))?.url, thumb);
  assert.equal(
    readCommonsImage(info(credit, { thumburl: "https://thumb.example.org/a.jpg" })),
    null,
  );
});

test("missing, uncredited, restricted or off-site files are not shown", () => {
  assert.equal(readCommonsImage(info({ LicenseShortName: { value: "CC BY 4.0" } })), null);
  assert.equal(readCommonsImage(info({ Artist: { value: "Jane" } })), null);
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

test("a trip's town is asked with its country first, then alone", () => {
  assert.deepEqual(townTitles("Kyoto, Kyoto Prefecture, Japan", "Japan"), [
    "Kyoto, Japan",
    "Kyoto",
  ]);
  assert.deepEqual(townTitles("Singapore", "Singapore"), ["Singapore"]);
  assert.deepEqual(townTitles("Lisbon"), ["Lisbon"]);
  assert.deepEqual(townTitles("  ", "France"), []);
  const url = new URL(wikipediaItemsUrl(["Kyoto, Japan", "Kyoto"]));
  assert.equal(url.hostname, "en.wikipedia.org");
  assert.equal(url.searchParams.get("titles"), "Kyoto, Japan|Kyoto");
  assert.equal(url.searchParams.get("redirects"), "1");
});

test("the town's Wikidata item skips missing and disambiguation pages", () => {
  const titles = ["Portland, United States", "Portland"];
  const json = {
    query: {
      pages: [
        { title: "Portland, United States", missing: true },
        { title: "Portland", pageprops: { disambiguation: "", wikibase_item: "Q1" } },
      ],
    },
  };
  assert.equal(readWikipediaItem(json, titles), null);

  const kyoto = {
    query: {
      normalized: [{ from: "kyoto", to: "Kyoto" }],
      redirects: [{ from: "Kyoto, Japan", to: "Kyoto" }],
      pages: [{ title: "Kyoto", pageprops: { wikibase_item: "Q34600" } }],
    },
  };
  assert.equal(readWikipediaItem(kyoto, ["Kyoto, Japan", "kyoto"]), "Q34600");
  assert.equal(readWikipediaItem({}, ["Kyoto"]), null);
  assert.equal(
    readWikipediaItem({ query: { pages: [{ title: "X", pageprops: { wikibase_item: "bad" } }] } }, [
      "X",
    ]),
    null,
  );
});
