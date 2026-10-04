import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanAccountSettings,
  ownsDeviceSettings,
  MAX_SETTING_LENGTH,
  planSync,
  settingStorageKey,
  SYNCED_SETTINGS,
} from "./account-settings.ts";

describe("settingStorageKey", () => {
  it("keeps the keys the device already used", () => {
    assert.equal(settingStorageKey("theme", "u1"), "bea-theme");
    assert.equal(settingStorageKey("personality", "u1"), "bea-personality");
    assert.equal(settingStorageKey("pictures", "u1"), "bea-stop-pictures");
    assert.equal(settingStorageKey("homeLayout", "u1"), "bea-home-layout-u1");
    assert.equal(settingStorageKey("tripView", "u1"), "bea-trip-view-u1");
    assert.equal(settingStorageKey("statsLayout", "u1"), "bea-stats-layout-u1");
    assert.equal(settingStorageKey("worldLayout", "u1"), "bea-world-layout-u1");
    assert.equal(settingStorageKey("homeCurrency", "u1"), "bea-home-currency");
  });

  it("gives every setting its own key", () => {
    const keys = SYNCED_SETTINGS.map((n) => settingStorageKey(n, "u1"));
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("cleanAccountSettings", () => {
  it("keeps known settings and resets", () => {
    assert.deepEqual(cleanAccountSettings({ theme: "dark", homeLayout: null }), {
      theme: "dark",
      homeLayout: null,
    });
  });

  it("drops unknown names, wrong types and oversized values", () => {
    assert.deepEqual(
      cleanAccountSettings({
        other: "x",
        theme: 3,
        personality: "y".repeat(MAX_SETTING_LENGTH + 1),
      }),
      {},
    );
  });

  it("reads anything that is not an object as empty", () => {
    assert.deepEqual(cleanAccountSettings(null), {});
    assert.deepEqual(cleanAccountSettings("dark"), {});
    assert.deepEqual(cleanAccountSettings(["dark"]), {});
  });
});

describe("planSync", () => {
  it("brings the account's settings to a new device", () => {
    const plan = planSync({ theme: "dark", pictures: "photos" }, {});
    assert.deepEqual(plan.toDevice, { theme: "dark", pictures: "photos" });
    assert.deepEqual(plan.toAccount, {});
  });

  it("sends up what the account has never seen", () => {
    const plan = planSync({}, { theme: "colorful", homeCurrency: "EUR" });
    assert.deepEqual(plan.toAccount, { theme: "colorful", homeCurrency: "EUR" });
    assert.deepEqual(plan.toDevice, {});
  });

  it("lets the account win a disagreement", () => {
    const plan = planSync({ theme: "dark" }, { theme: "calm" });
    assert.deepEqual(plan.toDevice, { theme: "dark" });
    assert.deepEqual(plan.toAccount, {});
  });

  it("puts a setting reset on another device back to its default here", () => {
    const plan = planSync({ homeLayout: null }, { homeLayout: '{"weather":false}' });
    assert.deepEqual(plan.toDevice, { homeLayout: null });
  });

  it("changes nothing when both agree", () => {
    const plan = planSync({ theme: "dark", tripView: null }, { theme: "dark" });
    assert.deepEqual(plan, { toDevice: {}, toAccount: {} });
  });

  it("leaves a setting changed during the read to its own save", () => {
    const plan = planSync(
      { theme: "dark" },
      { theme: "calm", pictures: "none" },
      new Set(["theme", "pictures"] as const),
    );
    assert.deepEqual(plan, { toDevice: {}, toAccount: {} });
  });
});

describe("switching accounts on one device", () => {
  it("treats settings as the signer's own when nobody or they held the device", () => {
    assert.equal(ownsDeviceSettings(null, "u1"), true);
    assert.equal(ownsDeviceSettings("u1", "u1"), true);
    assert.equal(ownsDeviceSettings("u1", "u2"), false);
  });

  it("never sends the last account's device-wide settings up to the next", () => {
    const device = { theme: "dark", homeCurrency: "EUR", homeLayout: '{"weather":false}' };
    const plan = planSync({}, device, new Set(), false);
    assert.deepEqual(plan.toAccount, { homeLayout: '{"weather":false}' });
    assert.deepEqual(plan.toDevice, { theme: null, homeCurrency: null });
  });

  it("still applies the next account's own settings", () => {
    const plan = planSync({ theme: "colorful" }, { theme: "dark" }, new Set(), false);
    assert.deepEqual(plan, { toDevice: { theme: "colorful" }, toAccount: {} });
  });
});
