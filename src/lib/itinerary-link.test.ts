import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pastedLink, readFetchedLink } from "./itinerary-link.ts";

test("a lone link is a link", () => {
  assert.equal(
    pastedLink("  https://example.com/japan-10-days\n"),
    "https://example.com/japan-10-days",
  );
});

test("webcal and http links are asked for over https", () => {
  assert.equal(
    pastedLink("webcal://www.tripit.com/feed/ical/abc.ics"),
    "https://www.tripit.com/feed/ical/abc.ics",
  );
  assert.equal(pastedLink("http://example.com/plan"), "https://example.com/plan");
});

test("a plan with a link inside it is still a plan", () => {
  assert.equal(pastedLink("Day 1: Louvre https://louvre.fr"), null);
  assert.equal(pastedLink("Day 1\nhttps://louvre.fr"), null);
});

test("things that are not web links are not links", () => {
  assert.equal(pastedLink(""), null);
  assert.equal(pastedLink("louvre.fr"), null);
  assert.equal(pastedLink("mailto:a@b.com"), null);
  assert.equal(pastedLink("https://localhost/plan"), null);
});

test("a page's words are read, its markup and scripts are not", () => {
  const html = `<html><script>var x = 1;</script><body><h1>Ten days in Japan</h1><p>Day 1: land at Haneda, check in at the hotel, dinner in Shinjuku.</p></body></html>`;
  const out = readFetchedLink({ html }, "www.example.com");
  assert.equal(out.kind, "page");
  if (out.kind === "page") {
    assert.match(out.text, /Day 1: land at Haneda/);
    assert.doesNotMatch(out.text, /var x/);
  }
});

test("a calendar feed is recognised, to be read without AI", () => {
  const out = readFetchedLink(
    { html: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR" },
    "tripit.com",
  );
  assert.equal(out.kind, "calendar");
});

test("a link to a PDF points at the PDF button", () => {
  const out = readFetchedLink({ html: "%PDF-1.7\n..." }, "example.com");
  assert.equal(out.kind, "failed");
  if (out.kind === "failed") assert.match(out.message, /Add a PDF/);
});

test("each failure says what happened, naming the site", () => {
  const empty = readFetchedLink({ html: "<div id=root></div>" }, "www.app.example");
  assert.equal(empty.kind, "failed");
  if (empty.kind === "failed")
    assert.match(empty.message, /app\.example didn't send any readable text/);
  for (const failure of ["unreachable", "http-error", "blocked-host", "bad-url"] as const) {
    const out = readFetchedLink({ html: "", failure }, "example.com");
    assert.equal(out.kind, "failed");
  }
});
