import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { demoVideoSource } from "./demo-video.ts";

describe("demoVideoSource", () => {
  it("has no video when nothing is configured", () => {
    assert.equal(demoVideoSource(null), null);
    assert.equal(demoVideoSource(""), null);
    assert.equal(demoVideoSource("   "), null);
  });

  it("plays a file served by the app itself", () => {
    assert.deepEqual(demoVideoSource("/demo.mp4"), { kind: "file", src: "/demo.mp4" });
  });

  it("plays a hosted file", () => {
    assert.deepEqual(demoVideoSource("https://cdn.example.com/bea/tour.webm"), {
      kind: "file",
      src: "https://cdn.example.com/bea/tour.webm",
    });
  });

  it("keeps a query string on a signed file URL", () => {
    const signed = "https://cdn.example.com/tour.mp4?token=abc123";
    assert.deepEqual(demoVideoSource(signed), { kind: "file", src: signed });
  });

  it("turns a YouTube watch link into a no-cookie embed", () => {
    const hit = demoVideoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(hit?.kind, "embed");
    assert.match(hit!.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  });

  it("handles a youtu.be short link", () => {
    const hit = demoVideoSource("https://youtu.be/dQw4w9WgXcQ");
    assert.match(hit!.src, /embed\/dQw4w9WgXcQ/);
  });

  it("handles a YouTube link that is already an embed", () => {
    const hit = demoVideoSource("https://www.youtube.com/embed/dQw4w9WgXcQ");
    assert.match(hit!.src, /embed\/dQw4w9WgXcQ/);
  });

  it("handles Vimeo", () => {
    assert.deepEqual(demoVideoSource("https://vimeo.com/824804225"), {
      kind: "embed",
      src: "https://player.vimeo.com/video/824804225",
    });
  });

  it("refuses to iframe an arbitrary page", () => {
    // A mis-set variable should mean "no video", not "embed a stranger's site".
    assert.equal(demoVideoSource("https://example.com/watch-our-video"), null);
  });

  it("refuses plain http", () => {
    assert.equal(demoVideoSource("http://cdn.example.com/tour.mp4"), null);
  });

  it("refuses a protocol-relative URL", () => {
    assert.equal(demoVideoSource("//cdn.example.com/tour.mp4"), null);
  });

  it("refuses a local path that is not a video", () => {
    assert.equal(demoVideoSource("/tour.html"), null);
  });

  it("refuses nonsense", () => {
    assert.equal(demoVideoSource("not a url at all"), null);
    assert.equal(demoVideoSource("javascript:alert(1)"), null);
  });
});
