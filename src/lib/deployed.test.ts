import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isDeployedBuild } from "./deployed.ts";

test("run from source, this is not the deployed build", () => {
  assert.equal(isDeployedBuild(), false);
});
