import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMapHost,
  isMapPlaceUrl,
  isPublicHttpsUrl,
  resolvesToPublicAddress,
} from "./place-url.ts";

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

describe("addresses the spelling check used to let through", () => {
  /**
   * `new URL()` canonicalizes an IPv6 host to its shortest hex form, so the
   * old dotted-quad match on `::ffff:` could never fire: `[::ffff:127.0.0.1]`
   * reached the guard as `::ffff:7f00:1` and was judged public. `[::]` had no
   * case at all and routes to localhost.
   */
  it("refuses loopback and link-local written as IPv6", () => {
    for (const u of [
      "https://[::ffff:127.0.0.1]/",
      "https://[::ffff:7f00:1]/",
      "https://[::ffff:169.254.169.254]/",
      "https://[::ffff:a9fe:a9fe]/",
      "https://[64:ff9b::127.0.0.1]/",
      "https://[::1]/",
      "https://[::]/",
      "https://[0::1]/",
      "https://[fe80::1]/",
      "https://[fd00::1]/",
    ]) {
      assert.equal(isPublicHttpsUrl(url(u)), false, u);
    }
  });

  it("still allows an ordinary public IPv6 host", () => {
    assert.equal(isPublicHttpsUrl(url("https://[2001:4860:4860::8888]/")), true);
  });

  it("keeps refusing the encodings it already caught", () => {
    // The URL parser normalizes all of these to 127.0.0.1 before we see them.
    for (const u of ["https://2130706433/", "https://0x7f000001/", "https://127.1/"]) {
      assert.equal(isPublicHttpsUrl(url(u)), false, u);
    }
  });
});

describe("where a name actually points", () => {
  /**
   * The spelling check cannot see this: a public name is free to carry an A
   * record in private space, and wildcard-DNS services exist to provide one.
   */
  it("refuses an address literal that resolves nowhere public", async () => {
    assert.equal(await resolvesToPublicAddress("127.0.0.1"), false);
    assert.equal(await resolvesToPublicAddress("[::ffff:7f00:1]"), false);
    assert.equal(await resolvesToPublicAddress("169.254.169.254"), false);
    assert.equal(await resolvesToPublicAddress("10.1.2.3"), false);
  });

  it("allows a public address literal", async () => {
    assert.equal(await resolvesToPublicAddress("8.8.8.8"), true);
  });

  it("refuses a name that will not resolve at all", async () => {
    assert.equal(await resolvesToPublicAddress("no-such-host.invalid"), false);
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
