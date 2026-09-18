import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hostOf, linkFailureMessage, siteName } from "./link-failure.ts";

describe("siteName", () => {
  it("names the sites people actually paste from", () => {
    assert.equal(siteName("www.instagram.com"), "Instagram");
    assert.equal(siteName("maps.app.goo.gl"), "Google Maps");
    assert.equal(siteName("www.tiktok.com"), "TikTok");
    assert.equal(siteName("twitter.com"), "X");
  });

  it("follows a subdomain up to the site it belongs to", () => {
    assert.equal(siteName("maps.google.com"), "Google Maps");
  });

  it("falls back to the bare host, then to something neutral", () => {
    assert.equal(siteName("www.timeout.com"), "timeout.com");
    assert.equal(siteName(undefined), "that page");
    assert.equal(siteName(""), "that page");
  });
});

describe("hostOf", () => {
  it("reads the host", () => {
    assert.equal(hostOf("https://www.instagram.com/p/abc/"), "www.instagram.com");
  });

  it("never throws on rubbish", () => {
    assert.equal(hostOf("not a url"), undefined);
    assert.equal(hostOf(undefined), undefined);
  });
});

describe("linkFailureMessage", () => {
  it("says the request failed when it failed", () => {
    const m = linkFailureMessage("unreachable", "maps.app.goo.gl");
    assert.match(m, /couldn't reach Google Maps/);
  });

  it("says the site refused when it refused, and does not blame the reader", () => {
    const m = linkFailureMessage("refused", "www.instagram.com");
    assert.match(m, /^Instagram didn't answer/);
    assert.match(m, /login/);
  });

  it("distinguishes a page it read from one it could not", () => {
    const read = linkFailureMessage("no-details", "www.timeout.com");
    const notRead = linkFailureMessage("unreachable", "www.timeout.com");
    assert.notEqual(read, notRead);
    assert.match(read, /didn't name a place/);
  });

  it("never tells anyone to paste a longer link", () => {
    // The old copy said this for every cause. It helps in none of the three.
    for (const reason of ["unreachable", "refused", "no-details", undefined] as const) {
      assert.doesNotMatch(linkFailureMessage(reason, "x.com"), /long(er)? link/i);
    }
  });

  it("always offers the way forward that does work", () => {
    for (const reason of ["unreachable", "refused", "no-details", undefined] as const) {
      assert.match(linkFailureMessage(reason, "x.com"), /type the name/i, String(reason));
    }
  });
});
