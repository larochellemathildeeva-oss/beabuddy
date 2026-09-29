import { strict as assert } from "node:assert";
import { test } from "node:test";
import { countryCode } from "./country-names.ts";
import {
  countryAt,
  localLanguageFor,
  localNamePrompt,
  readLocalName,
  worthTranslating,
} from "./local-name.ts";

test("only countries mapped in another script get a language", () => {
  assert.equal(localLanguageFor("JP"), "Japanese");
  assert.equal(localLanguageFor("kr"), "Korean");
  assert.equal(localLanguageFor("FR"), null);
  assert.equal(localLanguageFor(null), null);
});

test("a name already in the local script is not translated", () => {
  assert.equal(worthTranslating("Excelsior Caffé Shinsaibashi"), true);
  assert.equal(worthTranslating("エクセルシオール カフェ"), false);
  assert.equal(worthTranslating("ab"), false);
});

test("the prompt carries the name and nothing else of the trip", () => {
  const prompt = localNamePrompt("Excelsior Caffé Shinsaibashi", "Japanese", "Japan");
  assert.match(prompt, /Excelsior Caffé Shinsaibashi/);
  assert.match(prompt, /Japanese/);
});

test("the answer is read as one line in the local script", () => {
  assert.equal(
    readLocalName("エクセルシオール カフェ 心斎橋\n", "Excelsior Caffé Shinsaibashi"),
    "エクセルシオール カフェ 心斎橋",
  );
  assert.equal(readLocalName("「心斎橋」", "Shinsaibashi"), "心斎橋");
  assert.equal(readLocalName("NONE", "x"), null);
  assert.equal(readLocalName("Excelsior Cafe", "Excelsior Caffé"), null);
  assert.equal(readLocalName("", "x"), null);
});

test("countryAt picks the smallest box that holds the point", () => {
  const boxes = [
    { country: "Russia", bbox: [19, 41, 180, 82] },
    { country: "Japan", bbox: [122, 24, 154, 46] },
  ];
  assert.equal(countryAt(34.67, 135.5, boxes, countryCode), "JP");
  assert.equal(countryAt(0, 0, boxes, countryCode), null);
});

test("countryAt reads boxes that cross the 180° line", () => {
  const boxes = [{ country: "Russia", bbox: [19.611, 41.192, -168.995, 81.86] }];
  assert.equal(countryAt(55.75, 37.62, boxes, countryCode), "RU");
  assert.equal(countryAt(64.7, 177.5, boxes, countryCode), "RU");
  assert.equal(countryAt(64.7, -170, boxes, countryCode), "RU");
  assert.equal(countryAt(40, -100, boxes, countryCode), null);
});
