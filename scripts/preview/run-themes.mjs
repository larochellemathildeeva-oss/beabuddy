import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Each gate owns a fresh report directory, even when another run has failed. */
export async function runThemeChecks({ script, out, env = process.env, execPath = process.execPath }) {
  const reportDir = mkdtempSync(join(out, "reports-"));
  try {
    const results = await Promise.all(["calm", "colorful", "dark"].map((theme) => new Promise((resolve) => {
      const child = spawn(execPath, [script], {
        env: { ...env, PREVIEW_THEME: theme, PREVIEW_NO_BUILD: "1", PREVIEW_REPORT_DIR: reportDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let error;
      child.stdout.on("data", (chunk) => process.stdout.write(`[${theme}] ${chunk}`));
      child.stderr.on("data", (chunk) => process.stderr.write(`[${theme}] ${chunk}`));
      child.once("error", (e) => { error = e.message; });
      child.once("close", (code, signal) => resolve({ theme, code, signal, error }));
    })));
    const reports = results.map(({ theme, code, signal, error }) => {
      let report;
      try {
        report = JSON.parse(readFileSync(join(reportDir, `report-${theme}.json`), "utf8"));
        if (!Number.isInteger(report.clicked) || report.clicked < 0 || !Array.isArray(report.failures) || report.failures.some((f) => typeof f !== "string")) throw new Error("Invalid report structure");
      } catch (e) {
        report = { clicked: 0, failures: [`${theme}: no valid report from this run (${e.message})`] };
      }
      if (code !== 0) report.failures.push(`${theme}: worker failed (${error ?? signal ?? `exit ${code}`})`);
      return { theme, code, clicked: report.clicked, failures: report.failures };
    });
    for (const report of reports) writeFileSync(join(out, `report-${report.theme}.json`), JSON.stringify(report, null, 2));
    writeFileSync(join(out, "report.json"), JSON.stringify(reports, null, 2));
    return reports;
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}
