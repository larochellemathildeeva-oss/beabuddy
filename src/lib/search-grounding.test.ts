import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  readSearchGrounding,
  searchGroundingOn,
  suggestionsDocument,
  WEB_CHECK_MAX_SEARCHES,
  webCheckNote,
  webCheckPrompt,
} from "./search-grounding.ts";

test("searchGroundingOn is on by default and off only when asked", () => {
  assert.equal(searchGroundingOn(undefined), true);
  assert.equal(searchGroundingOn(""), true);
  assert.equal(searchGroundingOn("on"), true);
  for (const off of ["off", "OFF", "false", "0", "no", " off "]) {
    assert.equal(searchGroundingOn(off), false, off);
  }
});

test("readSearchGrounding returns null when Gemini did not search", () => {
  assert.equal(readSearchGrounding(undefined), null);
  assert.equal(readSearchGrounding({ google: {} }), null);
  assert.equal(readSearchGrounding({ google: { groundingMetadata: null } }), null);
  assert.equal(
    readSearchGrounding({ google: { groundingMetadata: { groundingChunks: [] } } }),
    null,
  );
});

test("readSearchGrounding keeps the suggestions and https sources, once each", () => {
  const out = readSearchGrounding({
    google: {
      groundingMetadata: {
        webSearchQueries: ["Big Bang CCB 2026"],
        searchEntryPoint: { renderedContent: '<div class="container">chips</div>' },
        groundingChunks: [
          { web: { uri: "https://vertexaisearch.cloud.google.com/r/1", title: "europa.tips" } },
          { web: { uri: "https://vertexaisearch.cloud.google.com/r/1", title: "europa.tips" } },
          { web: { uri: "http://insecure.example/x", title: "insecure" } },
          { web: { uri: "https://ccb.pt/agenda" } },
          { retrievedContext: { uri: "https://elsewhere.example" } },
        ],
      },
    },
  });
  assert.deepEqual(out, {
    suggestionsHtml: '<div class="container">chips</div>',
    sources: [
      { title: "europa.tips", url: "https://vertexaisearch.cloud.google.com/r/1" },
      { title: "ccb.pt", url: "https://ccb.pt/agenda" },
    ],
  });
});

test("readSearchGrounding keeps sources when there are no suggestions", () => {
  const out = readSearchGrounding({
    google: { groundingMetadata: { groundingChunks: [{ web: { uri: "https://a.example/" } }] } },
  });
  assert.deepEqual(out, {
    suggestionsHtml: null,
    sources: [{ title: "a.example", url: "https://a.example/" }],
  });
});

test("suggestionsDocument opens links in a new tab", () => {
  const doc = suggestionsDocument("<a href='https://www.google.com/search?q=x'>x</a>");
  assert.match(doc, /<base target="_blank">/);
  assert.match(doc, /google\.com\/search/);
});

test("webCheckPrompt names the place and dates and caps the searches", () => {
  const prompt = webCheckPrompt("Lisbon", "2026-10-03", "2026-10-04");
  assert.match(prompt, new RegExp(`at most ${WEB_CHECK_MAX_SEARCHES} Google searches`));
  assert.match(prompt, /visitor to Lisbon/);
  assert.match(prompt, /2026-10-03 to 2026-10-04/);
});

test("webCheckPrompt copes with one date or none", () => {
  assert.match(webCheckPrompt("Porto", "2026-10-03", "2026-10-03"), /for 2026-10-03:/);
  assert.match(webCheckPrompt("Porto", null, "2026-10-05"), /for 2026-10-05:/);
  assert.match(webCheckPrompt("Porto", null, null), /the coming weeks/);
});

test("webCheckNote hands the findings to the planner", () => {
  const note = webCheckNote("  * 2026-10-03: museum closed  ");
  assert.match(note, /^Checked on the web today for this trip:\n\* 2026-10-03: museum closed\n/);
  assert.match(note, /never suggest a place that is closed/);
});
