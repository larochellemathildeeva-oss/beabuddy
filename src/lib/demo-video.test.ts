import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  configuredDemoVideo,
  configuredVideo,
  configuredVideos,
  DEMO_VIDEOS,
  demoVideoSource,
  helpVideos,
} from "./demo-video.ts";

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

describe("the film catalogue", () => {
  it("gives every film its own id and its own variable", () => {
    const ids = DEMO_VIDEOS.map((v) => v.id);
    const keys = DEMO_VIDEOS.map((v) => v.envKey);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(keys).size, keys.length);
    for (const v of DEMO_VIDEOS) {
      assert.match(v.envKey, /^VITE_[A-Z_]+_URL$/, `${v.id} would not reach the browser`);
      assert.ok(v.title.trim() && v.blurb.trim() && v.length.trim(), `${v.id} is missing copy`);
    }
  });

  it("keeps the welcome film on the variable deploys already set", () => {
    assert.equal(DEMO_VIDEOS.find((v) => v.id === "welcome")?.envKey, "VITE_DEMO_VIDEO_URL");
  });

  it("never says Béa in the first person or calls her a planner", () => {
    for (const v of DEMO_VIDEOS) {
      // "I'm here", "Future Me" and "Help me choose" are names of buttons, not Béa talking.
      const copy = `${v.title} ${v.blurb}`.replace(/I'm here|Future Me|Help me choose/g, "");
      assert.doesNotMatch(copy, /\b(I|I'm|I've|me|my)\b/i, `${v.id}: "${copy}"`);
      assert.doesNotMatch(copy, /AI travel planner/i, v.id);
    }
  });

  it("has nothing to show on a deploy with nothing set", () => {
    assert.deepEqual(configuredVideos({}), []);
    assert.equal(configuredDemoVideo({}), null);
    assert.deepEqual(helpVideos({}), []);
  });

  it("shows only the films that are set and playable, in catalogue order", () => {
    const env = {
      VITE_CLIP_NEAR_URL: "/clips/near.mp4",
      VITE_CLIP_SAVE_URL: "https://youtu.be/dQw4w9WgXcQ",
      VITE_CLIP_PLAN_URL: "https://example.com/not-a-video",
    };
    assert.deepEqual(
      configuredVideos(env).map((v) => v.id),
      ["save", "near"],
    );
  });

  it("finds the welcome film where it always was", () => {
    const env = { VITE_DEMO_VIDEO_URL: "/welcome.mp4" };
    assert.deepEqual(configuredDemoVideo(env), { kind: "file", src: "/welcome.mp4" });
    assert.equal(configuredVideo("welcome", env)?.title, "Watch how Béa works");
  });

  it("keeps the welcome film out of Help's list", () => {
    const env = {
      VITE_DEMO_VIDEO_URL: "/welcome.mp4",
      VITE_WALKTHROUGH_VIDEO_URL: "/walkthrough.mp4",
    };
    assert.deepEqual(
      helpVideos(env).map((v) => v.id),
      ["walkthrough"],
    );
  });
});
