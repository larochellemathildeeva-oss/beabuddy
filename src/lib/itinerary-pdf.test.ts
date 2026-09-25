import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  isPdfDataUrl,
  MAX_PDF_BYTES,
  pdfProblem,
  pdfProblemMessage,
  PDF_DATA_URL_PREFIX,
} from "./itinerary-pdf.ts";
import { pdfPartFromDataUrl } from "./ai-image.ts";

const bytes = (s: string) => new TextEncoder().encode(s);
const pdf = (body: string, size = body.length) => ({ size, head: bytes(body), tail: bytes(body) });

test("a plain PDF reads", () => {
  assert.equal(pdfProblem(pdf("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n%%EOF")), null);
});

test("a file that is not a PDF is refused, whatever it is called", () => {
  assert.equal(pdfProblem(pdf("<html>not a pdf</html>")), "not-pdf");
  assert.equal(pdfProblem(pdf("\x89PNG\r\n")), "not-pdf");
});

test("an empty file says so rather than 'not a PDF'", () => {
  assert.equal(pdfProblem({ size: 0, head: bytes(""), tail: bytes("") }), "empty");
});

test("a PDF over the limit is refused before it is sent", () => {
  assert.equal(pdfProblem(pdf("%PDF-1.4\n", MAX_PDF_BYTES + 1)), "too-big");
  assert.equal(pdfProblem(pdf("%PDF-1.4\n", MAX_PDF_BYTES)), null);
});

test("a password-locked PDF is caught from its trailer, at either end", () => {
  const trailer = "trailer\n<< /Root 1 0 R /Encrypt 5 0 R >>\n%%EOF";
  assert.equal(
    pdfProblem({ size: 900, head: bytes("%PDF-1.6\n"), tail: bytes(trailer) }),
    "locked",
  );
  assert.equal(
    pdfProblem({ size: 900, head: bytes(`%PDF-1.6\n${trailer}`), tail: bytes("%%EOF") }),
    "locked",
  );
});

test("every problem has something to say", () => {
  for (const p of ["not-pdf", "too-big", "locked", "empty"] as const) {
    assert.ok(pdfProblemMessage(p).length > 20);
  }
  assert.match(pdfProblemMessage("too-big"), /5 MB/);
});

test("isPdfDataUrl checks the bytes, not only the label", () => {
  const real = PDF_DATA_URL_PREFIX + Buffer.from("%PDF-1.7\n...").toString("base64");
  const fake = PDF_DATA_URL_PREFIX + Buffer.from("<html>").toString("base64");
  assert.equal(isPdfDataUrl(real), true);
  assert.equal(isPdfDataUrl(fake), false);
  assert.equal(isPdfDataUrl("data:image/png;base64,JVBERi0xLjcK"), false);
});

test("pdfPartFromDataUrl hands Gemini the bare bytes as a PDF", () => {
  const b64 = Buffer.from("%PDF-1.7\nhello").toString("base64");
  const part = pdfPartFromDataUrl(PDF_DATA_URL_PREFIX + b64);
  assert.deepEqual(part, { type: "file", mediaType: "application/pdf", data: b64 });
  assert.throws(
    () => pdfPartFromDataUrl("data:application/pdf;base64,PGh0bWw+"),
    /Could not read that PDF/,
  );
});
