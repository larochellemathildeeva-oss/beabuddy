import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runThemeChecks } from "./preview/run-themes.mjs";

async function withWorker(body, run) {
  const out = mkdtempSync(join(tmpdir(), "bea-preview-reports-"));
  const script = join(out, "worker.mjs");
  writeFileSync(
    script,
    `import {writeFileSync} from 'node:fs';import {join} from 'node:path';const theme=process.env.PREVIEW_THEME;const file=join(process.env.PREVIEW_REPORT_DIR,'report-'+theme+'.json');${body}`,
  );
  try {
    await run({ script, out });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

test("preview combines only reports written by the current workers", async () => {
  await withWorker(
    "writeFileSync(file, JSON.stringify({clicked:7,failures:[]}));",
    async (args) => {
      const reports = await runThemeChecks(args);
      assert.equal(reports.length, 3);
      assert.ok(reports.every((r) => r.code === 0 && r.clicked === 7 && r.failures.length === 0));
      assert.deepEqual(JSON.parse(readFileSync(join(args.out, "report.json"))), reports);
    },
  );
});

test("an early worker exit cannot reuse a previous green report", async () => {
  await withWorker(
    "if(theme==='dark')process.exit(2);writeFileSync(file,JSON.stringify({clicked:7,failures:[]}));",
    async (args) => {
      writeFileSync(
        join(args.out, "report-dark.json"),
        JSON.stringify({ clicked: 999, failures: [] }),
      );
      const reports = await runThemeChecks(args);
      const dark = reports.find((r) => r.theme === "dark");
      assert.equal(dark.clicked, 0);
      assert.equal(dark.code, 2);
      assert.match(dark.failures.join(" "), /no valid report.*worker failed/);
      assert.deepEqual(JSON.parse(readFileSync(join(args.out, "report-dark.json"))), dark);
      assert.ok(reports.filter((r) => r.theme !== "dark").every((r) => r.failures.length === 0));
    },
  );
});

test("missing, malformed and invalid reports fail even when the worker exits zero", async () => {
  await withWorker(
    "if(theme==='calm')writeFileSync(file,'{');if(theme==='colorful')writeFileSync(file,JSON.stringify({clicked:0,failures:null}));",
    async (args) => {
      const reports = await runThemeChecks(args);
      assert.ok(reports.every((r) => r.code === 0 && r.failures.length > 0));
    },
  );
});

test("failure to launch workers produces a failed report instead of crashing", async () => {
  await withWorker("", async (args) => {
    const reports = await runThemeChecks({ ...args, execPath: join(args.out, "missing-node") });
    assert.ok(reports.every((r) => r.code !== 0 && r.failures.some((f) => f.includes("ENOENT"))));
  });
});
