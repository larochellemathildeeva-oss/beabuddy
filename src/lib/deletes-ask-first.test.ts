import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Deleting these cannot be undone (encrypted documents, receipt and photo
// files, notes, saved directions, the sample), so a tap opens ConfirmSheet
// instead of deleting. Each entry: the file, and the call that deletes.
const DELETES: ReadonlyArray<readonly [string, RegExp]> = [
  ["components/DocumentVault.tsx", /onClick=\{\(\) => void run\(\(\) => v\.removeDoc/],
  ["routes/_authenticated/expenses.tsx", /onClick=\{\(\) => void removeExpense/],
  ["routes/_authenticated/photos.tsx", /onClick=\{\(\) => remove\(r\)\}/],
  ["routes/_authenticated/memories.tsx", /onClick=\{\(\) => void notes\.remove/],
  ["components/TripDetail.tsx", /onClick=\{\(\) => \{\s*dir\.clear\(\)/],
  ["routes/profile.tsx", /onClick=\{async \(\) => \{\s*setSeeding\(true\)/],
];

test("irreversible deletes ask first", () => {
  for (const [file, direct] of DELETES) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!direct.test(source), `${file} deletes on a single tap`);
    assert.ok(source.includes("<ConfirmSheet"), `${file} has no ConfirmSheet`);
  }
});
