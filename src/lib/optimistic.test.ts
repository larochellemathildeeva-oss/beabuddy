import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outcomeError, readableError, runOptimistic, writeFailureMessage } from "./optimistic.ts";

describe("outcomeError", () => {
  it("finds a Supabase-shaped error", () => {
    assert.deepEqual(outcomeError({ error: { message: "nope" } }), { message: "nope" });
  });

  it("treats no error as no error", () => {
    assert.equal(outcomeError({ error: null }), null);
    assert.equal(outcomeError(undefined), null);
    assert.equal(outcomeError(null), null);
  });
});

describe("readableError", () => {
  it("keeps a sentence and gives it a full stop", () => {
    assert.equal(
      readableError({ message: "That trip is no longer shared with you" }),
      "That trip is no longer shared with you.",
    );
  });

  it("does not double the full stop", () => {
    assert.equal(readableError("Row not found."), "Row not found.");
  });

  it("drops machinery a reader cannot use", () => {
    assert.equal(readableError({ message: "at Object.foo (bundle.js:1:2)" }), null);
    assert.equal(readableError({ message: "PGRST116" }), null);
    assert.equal(readableError({ message: '{"code":"23505"}' }), null);
    assert.equal(readableError({ message: "x".repeat(200) }), null);
  });

  it("returns null for nothing at all", () => {
    assert.equal(readableError(undefined), null);
    assert.equal(readableError({ message: "   " }), null);
  });
});

describe("writeFailureMessage", () => {
  it("names the thing and the action", () => {
    const m = writeFailureMessage("Bar Alimentar", "remove");
    assert.equal(m.title, "Couldn't remove Bar Alimentar");
    assert.match(m.body, /put back/);
  });

  it("never says only that something went wrong", () => {
    const m = writeFailureMessage("", "save");
    assert.equal(m.title, "Couldn't save that change");
  });

  it("includes provider text when it reads like a sentence", () => {
    const m = writeFailureMessage("the budget", "save", { message: "You are offline" });
    assert.match(m.body, /You are offline\./);
  });
});

describe("runOptimistic", () => {
  const harness = () => {
    const calls: string[] = [];
    const reports: { title: string; body: string }[] = [];
    return {
      calls,
      reports,
      apply: () => calls.push("apply"),
      reconcile: async () => {
        calls.push("reconcile");
      },
      report: (m: { title: string; body: string }) => reports.push(m),
    };
  };

  it("applies before it writes", async () => {
    const h = harness();
    await runOptimistic({
      ...h,
      write: async () => {
        h.calls.push("write");
        return {};
      },
      label: "a stop",
      action: "add",
    });
    assert.deepEqual(h.calls, ["apply", "write", "reconcile"]);
    assert.equal(h.reports.length, 0);
  });

  it("reports loudly and returns false when the write fails", async () => {
    const h = harness();
    const ok = await runOptimistic({
      ...h,
      write: async () => ({ error: { message: "Permission denied" } }),
      label: "a stop",
      action: "add",
    });
    assert.equal(ok, false);
    assert.equal(h.reports.length, 1);
    assert.equal(h.reports[0]?.title, "Couldn't add a stop");
    // The reconcile is what puts the row back, so it must still have run.
    assert.ok(h.calls.includes("reconcile"));
  });

  it("treats a thrown write as a failure rather than crashing the click", async () => {
    const h = harness();
    const ok = await runOptimistic({
      ...h,
      write: async () => {
        throw new Error("Network request failed");
      },
      label: "the note",
      action: "save",
    });
    assert.equal(ok, false);
    assert.match(h.reports[0]?.body ?? "", /Network request failed\./);
  });

  it("still reports the write error when the re-read also fails", async () => {
    const reports: { title: string }[] = [];
    const ok = await runOptimistic({
      apply: () => {},
      write: async () => ({ error: { message: "Denied" } }),
      reconcile: async () => {
        throw new Error("reload also failed");
      },
      report: (m) => reports.push(m),
      label: "a row",
      action: "save",
    });
    assert.equal(ok, false);
    assert.equal(reports.length, 1);
    assert.equal(reports[0]?.title, "Couldn't save a row");
  });

  it("returns true and says nothing when the write lands", async () => {
    const h = harness();
    const ok = await runOptimistic({
      ...h,
      write: async () => ({ error: null }),
      label: "a row",
      action: "save",
    });
    assert.equal(ok, true);
    assert.equal(h.reports.length, 0);
  });
});
