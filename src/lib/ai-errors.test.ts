import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  aiFailure,
  isDailyQuota,
  isNetworkFailure,
  isOverloaded,
  isRateLimited,
  isRetiredModel,
  normalizeGeminiModelId,
  parseModelChain,
  resolvePrimaryGeminiModel,
  runModelChain,
  shouldFallToNextModel,
} from "./ai-errors.ts";

test("isOverloaded matches capacity wording and 503", () => {
  assert.equal(isOverloaded(new Error("This model is currently experiencing high demand")), true);
  assert.equal(isOverloaded(new Error("503 Service Unavailable")), true);
  assert.equal(isOverloaded(new Error("You exceeded your current quota")), false);
});

test("isOverloaded does not treat retired-model refusals as capacity", () => {
  const retired = new Error(
    "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite",
  );
  assert.equal(isRetiredModel(retired), true);
  assert.equal(isOverloaded(retired), false);
  assert.equal(shouldFallToNextModel(retired), true);
});

test("isRateLimited matches 429 quota exhaustion", () => {
  const quota = new Error(
    'AI_APICallError: You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.7-flash Please retry in 40.320401434s. {"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}',
  );
  assert.equal(isRateLimited(quota), true);
  assert.equal(isOverloaded(quota), false);
  assert.equal(shouldFallToNextModel(quota), true);
  assert.equal(isRateLimited(new Error("rate limit exceeded")), true);
});

test("isDailyQuota treats free-tier request caps with a long wait as daily", () => {
  const shortWait = new Error(
    "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20. Please retry in 40s.",
  );
  assert.equal(isDailyQuota(shortWait), false);

  const longWait = new Error(
    "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20. Please retry in 3600s.",
  );
  assert.equal(isDailyQuota(longWait), true);

  const namedDaily = new Error("You have exceeded your requests per day quota (429)");
  assert.equal(isDailyQuota(namedDaily), true);
});

test("aiFailure uses distinct copy for busy vs short wait vs daily quota", () => {
  assert.match(aiFailure(new Error("high demand")).message, /busy right now/i);
  assert.match(
    aiFailure(new Error("429 rate limit — Please retry in 20s")).message,
    /Wait a minute/i,
  );
  assert.match(
    aiFailure(
      new Error(
        "free_tier_requests quota exceeded. Please retry in 7200s. status RESOURCE_EXHAUSTED 429",
      ),
    ).message,
    /used up for today/i,
  );
  assert.match(
    aiFailure(
      new Error(
        "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite",
      ),
    ).message,
    /outdated AI model/i,
  );
  assert.match(aiFailure(new TypeError("Load failed")).message, /didn't reach Béa/i);
  assert.match(aiFailure(new TypeError("Failed to fetch")).message, /didn't reach Béa/i);
  assert.match(aiFailure(new Error("Request Entity Too Large")).message, /too large to send/i);
});

test("isNetworkFailure matches Safari and Chromium fetch failures", () => {
  assert.equal(isNetworkFailure(new TypeError("Load failed")), true);
  assert.equal(isNetworkFailure(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkFailure(new Error("Could not read that picture")), false);
  assert.equal(isNetworkFailure(new TypeError("fetch is not a function")), false);
});

test("normalizeGeminiModelId remaps retired 2.5 ids and strips models/", () => {
  assert.equal(normalizeGeminiModelId("models/gemini-2.5-flash-lite"), "gemini-3.5-flash-lite");
  assert.equal(normalizeGeminiModelId("gemini-2.5-flash"), "gemini-3.6-flash");
  assert.equal(normalizeGeminiModelId("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
  assert.equal(normalizeGeminiModelId(""), "");
});

test("resolvePrimaryGeminiModel prefers product default over lite remapping", () => {
  assert.equal(resolvePrimaryGeminiModel("gemini-2.5-flash-lite"), "gemini-3.6-flash");
  assert.equal(resolvePrimaryGeminiModel("models/gemini-2.5-flash-lite"), "gemini-3.6-flash");
  assert.equal(resolvePrimaryGeminiModel(""), "gemini-3.6-flash");
  assert.equal(resolvePrimaryGeminiModel("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
});

test("parseModelChain builds a de-duplicated ladder", () => {
  assert.deepEqual(
    parseModelChain("gemini-3.6-flash", "gemini-3.5-flash-lite, gemini-3.1-flash-lite"),
    ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  );
  assert.deepEqual(parseModelChain("gemini-3.6-flash", "gemini-3.6-flash,gemini-3.5-flash-lite"), [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
  ]);
  assert.deepEqual(parseModelChain("gemini-3.6-flash", ""), ["gemini-3.6-flash"]);
});

test("parseModelChain remaps a stale Canner 2.5 primary and fallbacks", () => {
  assert.deepEqual(
    parseModelChain("gemini-2.5-flash-lite", "gemini-2.5-flash-lite,gemini-3.1-flash-lite-preview"),
    ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview"],
  );
});

test("runModelChain steps down on quota and stops on other errors", async () => {
  const tried: string[] = [];
  const result = await runModelChain(["a", "b", "c"], async (id) => {
    tried.push(id);
    if (id === "a") throw new Error("429 quota exceeded");
    if (id === "b") throw new Error("RESOURCE_EXHAUSTED free_tier");
    return `ok:${id}`;
  });
  assert.equal(result, "ok:c");
  assert.deepEqual(tried, ["a", "b", "c"]);

  await assert.rejects(
    () =>
      runModelChain(["a", "b"], async (id) => {
        if (id === "a") throw new Error("429 quota");
        throw new Error("Could not read that picture");
      }),
    /Could not read that picture/,
  );
});

test("runModelChain steps down when Google refuses a retired model id", async () => {
  const tried: string[] = [];
  const result = await runModelChain(["dead", "live"], async (id) => {
    tried.push(id);
    if (id === "dead") {
      throw new Error(
        "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite",
      );
    }
    return `ok:${id}`;
  });
  assert.equal(result, "ok:live");
  assert.deepEqual(tried, ["dead", "live"]);
});
