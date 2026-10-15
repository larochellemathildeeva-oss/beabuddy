import { strict as assert } from "node:assert";
import { test } from "node:test";
import { transform } from "lightningcss";
import { textScaleVisitor } from "./text-scale-css.ts";

function run(css: string): string {
  return transform({
    filename: "t.css",
    code: Buffer.from(css),
    minify: true,
    visitor: textScaleVisitor,
  }).code.toString();
}

test("pixel font sizes and line heights follow --text-scale", () => {
  const out = run(".a{font-size:16px;line-height:22px}");
  assert.match(out, /font-size:calc\(16px \* var\(--text-scale,\s*1\)\)/);
  assert.match(out, /line-height:calc\(22px \* var\(--text-scale,\s*1\)\)/);
});

test("other values are left as they are", () => {
  const out = run(".a{font-size:1rem;line-height:1.4;width:13px}.b{font-size:var(--x)}");
  assert.doesNotMatch(out, /--text-scale/);
  assert.match(out, /font-size:1rem/);
  assert.match(out, /width:13px/);
});

test("small sizes sit on the 12px and 14px steps", () => {
  const sizeOf = (px: string) =>
    run(`.a{font-size:${px}}`).match(/font-size:calc\((\d+(?:\.\d+)?)px/)?.[1];
  assert.equal(sizeOf("10px"), "12");
  assert.equal(sizeOf("11.5px"), "12");
  assert.equal(sizeOf("12px"), "12");
  assert.equal(sizeOf("13px"), "14");
  assert.equal(sizeOf("15px"), "15");
});
