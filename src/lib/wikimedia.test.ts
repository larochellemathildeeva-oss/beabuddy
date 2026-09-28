import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  commonsFileName,
  commonsImageInfoUrl,
  commonsRefFromTags,
  photoCredit,
  readCommonsImage,
  readWikidataImage,
  readWikidataCategory,
  readBestCategoryImage,
  readContinue,
  commonsCategoryFilesUrl,
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
    wikidata: "Q1",
  });
  assert.deepEqual(commonsRefFromTags({ image: "File:A.jpg" }), { file: "A.jpg" });
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
  assert.equal(new URL(wikidataImageUrl("Q243", "P948")).searchParams.get("property"), "P948");
  assert.match(url.searchParams.get("iiprop")!, /size/);
  assert.match(url.searchParams.get("iiprop")!, /mime/);
  const cat = new URL(commonsCategoryFilesUrl("Category:Kyoto"));
  assert.equal(cat.searchParams.get("gcmtitle"), "Category:Kyoto");
  assert.equal(cat.searchParams.get("gcmtype"), "file");
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
            width: 4000,
            height: 2667,
            mime: "image/jpeg",
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
  assert.deepEqual(facts?.commons, { file: "Pont Neuf.jpg", wikidata: "Q1" });
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

const credit = { Artist: { value: "Jane" }, LicenseShortName: { value: "CC BY 4.0" } };

test("only real, sharp photos, not tall strips, are shown on a place", () => {
  assert.ok(readCommonsImage(info(credit)));
  // Drawings, maps and logos
  assert.equal(readCommonsImage(info(credit, { mime: "image/png" })), null);
  assert.equal(readCommonsImage(info(credit, { mime: "image/svg+xml" })), null);
  // Too small to be sharp
  assert.equal(readCommonsImage(info(credit, { width: 800, height: 500 })), null);
  // An upright tower is fine; a strip a wide card would crop to a sliver is not
  assert.ok(readCommonsImage(info(credit, { width: 2900, height: 5367 })));
  assert.equal(readCommonsImage(info(credit, { width: 1000, height: 2500 })), null);
  // No size at all: not trusted
  assert.equal(readCommonsImage(info(credit, { width: undefined })), null);
});

test("a Wikivoyage banner may be a PNG but must be wide and large", () => {
  const banner = { mime: "image/png", width: 2100, height: 300 };
  assert.ok(readCommonsImage(info(credit, banner), "banner"));
  assert.equal(readCommonsImage(info(credit, banner)), null);
  assert.equal(readCommonsImage(info(credit, { ...banner, width: 1000 }), "banner"), null);
  assert.equal(
    readCommonsImage(info(credit, { ...banner, width: 1500, height: 2000 }), "banner"),
    null,
  );
});

test("a Wikidata item's banner and Commons category are read", () => {
  const claims = (property: string, value: string) => ({
    claims: { [property]: [{ rank: "normal", mainsnak: { datavalue: { value } } }] },
  });
  assert.equal(
    readWikidataImage(claims("P948", "Kyoto banner Fushimi Inari Torii.png"), "P948"),
    "Kyoto banner Fushimi Inari Torii.png",
  );
  assert.equal(readWikidataImage(claims("P948", "Banner.png")), null);
  assert.equal(readWikidataCategory(claims("P373", "Kyoto")), "Kyoto");
  assert.equal(readWikidataCategory(claims("P373", "Category:Kyoto")), "Kyoto");
  assert.equal(readWikidataCategory({}), null);
});

test("from a category, only a rated photo is picked: best rating, then landscape", () => {
  const file = (name: string, assessed: string | null, over = {}) => ({
    title: `File:${name}.jpg`,
    imageinfo: [
      {
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/640px-${name}.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
        width: 3000,
        height: 2000,
        mime: "image/jpeg",
        extmetadata: {
          ...credit,
          ...(assessed ? { Assessments: { value: assessed } } : {}),
        },
        ...over,
      },
    ],
  });
  const pick = (...pages: unknown[]) => readBestCategoryImage({ query: { pages } })?.page;
  assert.equal(pick(file("Plain", null)), undefined);
  assert.equal(
    pick(file("Valued", "valued"), file("Quality", "quality"), file("Plain", null)),
    "https://commons.wikimedia.org/wiki/File:Quality.jpg",
  );
  assert.equal(
    pick(file("Featured", "featured|quality"), file("Quality", "quality")),
    "https://commons.wikimedia.org/wiki/File:Featured.jpg",
  );
  assert.equal(
    pick(file("Square", "quality", { width: 2400, height: 2400 }), file("Wide", "quality")),
    "https://commons.wikimedia.org/wiki/File:Square.jpg",
  );
  assert.equal(
    pick(file("Tall", "quality", { width: 2000, height: 2400 }), file("Wide", "quality")),
    "https://commons.wikimedia.org/wiki/File:Wide.jpg",
  );
  // A rated drawing is still not a photo
  assert.equal(pick(file("Map", "featured", { mime: "image/png" })), undefined);
  assert.equal(readBestCategoryImage(null), null);
});

test("a category is read page by page, and the best across pages wins", () => {
  const url = new URL(
    commonsCategoryFilesUrl("Kyoto", 640, { gcmcontinue: "file|abc", continue: "gcmcontinue||" }),
  );
  assert.equal(url.searchParams.get("gcmcontinue"), "file|abc");
  assert.equal(url.searchParams.get("continue"), "gcmcontinue||");
  assert.deepEqual(readContinue({ continue: { gcmcontinue: "file|abc", continue: "x", n: 1 } }), {
    gcmcontinue: "file|abc",
    continue: "x",
  });
  assert.equal(readContinue({ batchcomplete: true }), null);

  const page = (name: string, assessed: string | null) => ({
    query: {
      pages: [
        {
          title: `File:${name}.jpg`,
          imageinfo: [
            {
              thumburl: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}.jpg`,
              descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
              width: 3000,
              height: 2000,
              mime: "image/jpeg",
              extmetadata: {
                ...credit,
                ...(assessed ? { Assessments: { value: assessed } } : {}),
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(
    readBestCategoryImage([page("First", null), page("Later", "quality")])?.page,
    "https://commons.wikimedia.org/wiki/File:Later.jpg",
  );
});
