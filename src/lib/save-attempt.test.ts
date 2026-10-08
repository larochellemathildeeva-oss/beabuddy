import assert from "node:assert/strict";
import { it } from "node:test";
import { SaveAttempt } from "./save-attempt.ts";

it("retries the failed stage without creating another trip or repeating saved stops", async () => {
  const attempt = new SaveAttempt();
  let inserts = 0;
  let attachments = 0;
  const save = async () => {
    const id = await attempt.step("create", async () => {
      inserts++;
      return "trip-1";
    });
    await attempt.step("attach", async () => {
      attachments++;
      assert.equal(id, "trip-1");
      if (attachments === 1) throw new Error("offline");
    });
  };
  await assert.rejects(attempt.run(save), /offline/);
  await attempt.run(save);
  assert.equal(inserts, 1);
  assert.equal(attachments, 2);
});

it("coalesces rapid taps and retains the first reviewed payload on retry", async () => {
  const attempt = new SaveAttempt();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = attempt.run(async () => {
    calls++;
    await gate;
    throw new Error("retry");
  });
  const second = attempt.run(async () => {
    throw new Error("changed payload");
  });
  assert.equal(first, second);
  release();
  await assert.rejects(first, /retry/);
  await assert.rejects(
    attempt.run(async () => {
      throw new Error("changed payload");
    }),
    /retry/,
  );
  assert.equal(calls, 2);
});

it("remembers void writes and keeps separate workflows independent", async () => {
  const first = new SaveAttempt();
  const second = new SaveAttempt();
  let writes = 0;
  const write = async () => {
    writes++;
  };
  await first.step("budget", write);
  await first.step("budget", write);
  await second.step("budget", write);
  assert.equal(writes, 2);
});

it("distinguishes a rejected first write from a partially confirmed save", async () => {
  const attempt = new SaveAttempt();
  await assert.rejects(
    attempt.step("create", async () => {
      throw new Error("invalid");
    }),
  );
  assert.equal(attempt.hasConfirmedWrites, false);
  await attempt.step("create", async () => "trip-1");
  assert.equal(attempt.hasConfirmedWrites, true);
});
