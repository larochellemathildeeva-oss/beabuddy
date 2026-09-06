import { strict as assert } from "node:assert";
import { test } from "node:test";
import { htmlToPlainText, loneHttpsUrl } from "./html-text.ts";
import { isPublicHttpsUrl } from "./place-url.ts";

test("htmlToPlainText strips tags and keeps the words", () => {
  const text = htmlToPlainText(
    `<html><head><style>p{color:red}</style><script>alert(1)</script></head>
     <body><h1>Best of Lisbon</h1><p>Visit &amp; Time Out Market</p><br/>and LX Factory</body></html>`,
  );
  assert.match(text, /Best of Lisbon/);
  assert.match(text, /Visit & Time Out Market/);
  assert.match(text, /LX Factory/);
  assert.doesNotMatch(text, /alert|color:red|<p>/);
});

test("htmlToPlainText caps length", () => {
  assert.equal(htmlToPlainText("abcdefghij", 4), "abcd");
});

test("loneHttpsUrl accepts a single https link", () => {
  assert.equal(loneHttpsUrl("  https://www.timeout.com/lisbon/things-to-do  "), "https://www.timeout.com/lisbon/things-to-do");
  assert.equal(loneHttpsUrl("https://x.com\nand another line"), null);
  assert.equal(loneHttpsUrl("Bar Raval"), null);
  assert.equal(loneHttpsUrl("http://example.com"), null);
});

test("isPublicHttpsUrl blocks local and credentialed hosts", () => {
  assert.equal(isPublicHttpsUrl(new URL("https://www.timeout.com/things-to-do")), true);
  assert.equal(isPublicHttpsUrl(new URL("http://www.timeout.com/things-to-do")), false);
  assert.equal(isPublicHttpsUrl(new URL("https://127.0.0.1/")), false);
  assert.equal(isPublicHttpsUrl(new URL("https://192.168.1.4/")), false);
  assert.equal(isPublicHttpsUrl(new URL("https://user:pass@example.com/")), false);
});
