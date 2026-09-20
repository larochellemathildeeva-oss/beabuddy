# Security audits

Output of the [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
workflow. One directory per run.

## run-1 — 2026-09-20, commit 56cb8fa

Two confirmed findings, **both fixed in commit `ff5d666`**, which landed with the
audit:

| ID | Severity | Status |
|---|---|---|
| F-1 | High | Fixed — `supabase/migrations/20260920120000_fix_invite_update_scope.sql` |
| F-2 | Medium | Fixed — `src/lib/place-url.ts`, with one residual noted below |

F-2's fix leaves the DNS-rebinding window open on purpose: undici re-resolves the
name when it connects, so pinning needs a custom dispatcher `lookup` (undici as a
direct dependency) or an egress proxy. The source comment says so at the point it
matters.

The F-1 migration, like every other file in `supabase/migrations/`, does not change
the live database on its own — it still has to be applied.

Two coverage units were left unassigned rather than reported as clean:
`ai.server.ts` prompt assembly and `vaultCrypto.ts`. The first is the priority for a
follow-up run, because F-2 established that attacker-influenced page text reaches a
model prompt.

`ssrf-guard-verdicts.txt` is the raw output of the offline harness used as evidence
for F-2: a verbatim transcription of the old guard, run against 22 host forms with
no network access.
