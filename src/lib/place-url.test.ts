import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMapHost, isMapPlaceUrl, isPublicHttpsUrl } from "./place-url.ts";

/**
 * The bug these guard against: the paste box accepted any link that looked
 * like one, and the copy beside it promised "Maps, Instagram, a blog —
 * anywhere", but the fetch layer required the host to be one of six map sites.
 * Everything else was accepted by the interface and silently dropped before a
 * request was ever made, so an Instagram link could only ever come back empty.
 */

const url = (u: string) => new URL(u);

describe("what the fetch layer will request", () => {
  it("allows the sites the interface promises", () => {
    for (const u of [
      "https://www.instagram.com/p/Cxyz/",
      "https://www.tiktok.com/@a/video/1",
      "https://x.com/a/status/1",
      "https://www.timeout.com/lisbon/restaurants",
      "https://www.google.com/maps/place/Bar/@1,2,17z",
      "https://maps.app.goo.gl/abc",
    ]) {
      assert.equal(isPublicHttpsUrl(url(u)), true, u);
    }
  });

  it("still refuses anything that is not public https", () => {
    // These are the actual SSRF defence, and none of them moved.
    for (const u of [
      "http://example.com/",
      "https://localhost/",
      "https://127.0.0.1/",
      "https://10.0.0.5/",
      "https://192.168.1.1/",
      "https://169.254.169.254/",
    ]) {
      assert.equal(isPublicHttpsUrl(url(u)), false, u);
    }
  });
});

describe("isMapHost", () => {
  it("knows the map sites whose URLs carry structured place data", () => {
    for (const h of [
      "maps.app.goo.gl",
      "www.google.com",
      "maps.google.com",
      "maps.apple.com",
      "www.yelp.com",
      "www.tripadvisor.com",
      "www.openstreetmap.org",
    ]) {
      assert.equal(isMapHost(h), true, h);
    }
  });

  it("does not claim a social post or a blog is a map link", () => {
    for (const h of ["www.instagram.com", "www.tiktok.com", "x.com", "www.timeout.com"]) {
      assert.equal(isMapHost(h), false, h);
    }
  });

  it("is not fooled by a lookalike host", () => {
    // "google.com.evil.test" must not read as Google.
    assert.equal(isMapHost("google.com.evil.test"), false);
    assert.equal(isMapHost("notgoogle.com"), false);
    assert.equal(isMapHost("yelp.com.attacker.test"), false);
  });

  it("ignores case and a trailing dot", () => {
    assert.equal(isMapHost("MAPS.APP.GOO.GL."), true);
  });

  it("is no longer a fetch gate, only a parsing hint", () => {
    // Both are map links; neither statement should imply anything about
    // whether the page will be requested.
    assert.equal(isMapPlaceUrl(url("https://www.yelp.com/biz/x")), true);
    assert.equal(isMapPlaceUrl(url("https://www.instagram.com/p/x/")), false);
    assert.equal(isPublicHttpsUrl(url("https://www.instagram.com/p/x/")), true);
  });
});
