import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  AI_IMAGE_MAX_BYTES,
  filePartFromDataUrl,
  flattenGeminiPromptFiles,
  unwrapGeminiFileData,
} from "./ai-image.ts";

const b64 = (bytes: number[] | string) =>
  Buffer.from(typeof bytes === "string" ? bytes : Uint8Array.from(bytes)).toString("base64");
const JPEG = b64([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06]);
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56]);

test("filePartFromDataUrl strips the data-URL wrapper", () => {
  const part = filePartFromDataUrl(`data:image/jpeg;base64,${JPEG}`);
  assert.equal(part.type, "file");
  assert.equal(part.mediaType, "image/jpeg");
  assert.equal(part.data, JPEG);
});

test("JPEG, PNG and WebP are accepted by their real bytes", () => {
  assert.equal(filePartFromDataUrl(`data:image/png;base64,${PNG}`).mediaType, "image/png");
  assert.equal(filePartFromDataUrl(`data:image/webp;base64,${WEBP}`).mediaType, "image/webp");
  // Line breaks inside the base64 are tolerated, and dropped.
  const wrapped = `${JPEG.slice(0, 8)}\n${JPEG.slice(8)}`;
  assert.equal(filePartFromDataUrl(`data:image/jpeg;base64,${wrapped}`).data, JPEG);
});

test("filePartFromDataUrl rejects junk", () => {
  assert.throws(() => filePartFromDataUrl("not-an-image"), /Could not read that picture/);
  assert.throws(() => filePartFromDataUrl("data:image/jpeg;base64,!!!!"), /Could not read/);
  assert.throws(() => filePartFromDataUrl("data:image/jpeg;base64,abc"), /Could not read/);
});

test("a picture whose bytes do not match its label is refused", () => {
  assert.throws(() => filePartFromDataUrl(`data:image/jpeg;base64,${PNG}`), /isn't the kind/);
  assert.throws(
    () => filePartFromDataUrl(`data:image/png;base64,${b64("hello, this is text")}`),
    /isn't the kind/,
  );
  // Valid base64 (like the old "abc123" fixture), but not a JPEG.
  assert.throws(() => filePartFromDataUrl("data:image/jpeg;base64,abcd1234"), /isn't the kind/);
});

test("SVG, GIF and other labels are refused", () => {
  const svg = b64('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.throws(() => filePartFromDataUrl(`data:image/svg+xml;base64,${svg}`), /JPEG, PNG or WebP/);
  const gif = b64("GIF89a\x01\x00\x01\x00");
  assert.throws(() => filePartFromDataUrl(`data:image/gif;base64,${gif}`), /JPEG, PNG or WebP/);
});

test("a picture over the decoded size limit is refused", () => {
  const big = Buffer.alloc(AI_IMAGE_MAX_BYTES + 3);
  big.set([0xff, 0xd8, 0xff]);
  assert.throws(
    () => filePartFromDataUrl(`data:image/jpeg;base64,${big.toString("base64")}`),
    /too large/,
  );
  const ok = Buffer.alloc(AI_IMAGE_MAX_BYTES);
  ok.set([0xff, 0xd8, 0xff]);
  assert.equal(
    filePartFromDataUrl(`data:image/jpeg;base64,${ok.toString("base64")}`).mediaType,
    "image/jpeg",
  );
});

test("unwrapGeminiFileData peels the AI SDK tag", () => {
  assert.equal(unwrapGeminiFileData({ type: "data", data: "abc123" }), "abc123");
  assert.equal(unwrapGeminiFileData("already-raw"), "already-raw");
});

test("flattenGeminiPromptFiles unwraps file parts on user messages", () => {
  const prompt = flattenGeminiPromptFiles([
    {
      role: "user",
      content: [
        { type: "text", text: "hi" },
        { type: "file", mediaType: "image/jpeg", data: { type: "data", data: "abc123" } },
        { type: "image", image: { type: "data", data: "xyz" } },
      ],
    },
  ]);
  const file = prompt[0]?.content[1] as { data: unknown };
  const image = prompt[0]?.content[2] as { image: unknown };
  assert.equal(file.data, "abc123");
  assert.equal(image.image, "xyz");
});
