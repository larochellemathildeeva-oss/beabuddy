import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findForbiddenSecrets } from "./check-public-secrets.mjs";

test("a server env name compiled into client code is caught", () => {
  assert.deepEqual(findForbiddenSecrets("const key = process.env.GEOAPIFY_API_KEY;"), [
    "GEOAPIFY_API_KEY",
  ]);
  assert.deepEqual(findForbiddenSecrets('e["SUPABASE_SERVICE_ROLE_KEY"]'), [
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
});

test("a Supabase secret key is caught, supabase-js's own prefix check is not", () => {
  assert.equal(findForbiddenSecrets("k='sb_secret_AbCdEfGhIjKlMnOpQrSt'").length, 1);
  assert.deepEqual(findForbiddenSecrets("e.startsWith(`sb_secret_`)"), []);
});

test("ordinary client code passes", () => {
  assert.deepEqual(findForbiddenSecrets('console.log("hello"); const url = "/api/tile";'), []);
});
