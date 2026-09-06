import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  filePartFromDataUrl,
  flattenGeminiPromptFiles,
  unwrapGeminiFileData,
} from "./ai-image.ts";

test("filePartFromDataUrl strips the data-URL wrapper", () => {
  const part = filePartFromDataUrl("data:image/jpeg;base64,abc123");
  assert.equal(part.type, "file");
  assert.equal(part.mediaType, "image/jpeg");
  assert.equal(part.data, "abc123");
});

test("filePartFromDataUrl rejects junk", () => {
  assert.throws(() => filePartFromDataUrl("not-an-image"), /Could not read that picture/);
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
