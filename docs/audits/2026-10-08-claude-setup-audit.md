# Claude Code setup audit — Béa (project scope)

Method: `tools/audit-prompt.md` v5.2 from FlorianBruniaux/claude-code-ultimate-guide, run in fallback mode (none of its audit skills installed), project scope only, read-only. The tool assumes a `CLAUDE.md` + `.claude/` layout, so it understates a repo that uses `AGENTS.md`.

| # | Dimension | Score (fallback max) | Finding |
|---|---|---|---|
| 1 | Memory & context | 8 / 14 | No `CLAUDE.md`; `AGENTS.md` (39 KB, ~10K tokens) carries everything, so fixed context is ~18K (under 20K) but one very long file |
| 2 | Rules hygiene | 0 / 8 | No `.claude/rules/`; nothing is path-scoped, so every AGENTS.md section loads every session |
| 3 | Skills quality | 3 / 8 | One skill (superdesign), has `description`, no `effort` or `allowed-tools` |
| 4 | Agents/commands | 8 / 8 | Nothing to fault |
| 5 | Security posture | 3 / 17 | `.claude/settings.json` has no `permissions.deny` (`.env*`, `*.pem`), no PreToolUse hook, no sandbox; no secrets found in config; `.env` is gitignored |
| 6 | MCP | 3 / 10 | `.mcp.json` points at the live Supabase project (`fjfonywfnskriwlhbriw`) with `database` and `development` features and no read-only flag |
| 7 | Workflow commands | 0 / 10 | No project `/investigate`, `/qa`, `/review-pr` etc. (superpowers skills exist in the user's environment, not the repo) |
| 8 | Freshness | 10 / 10 | No deprecated model names; recent commits |
| | Total | 35 / 85 (about 41 / 100, "Growing") | |

## Top fixes (not applied)

1. **Supabase MCP on the production project.** Add `read_only=true` to the `.mcp.json` URL, or point it at a branch. AGENTS.md says migrations are applied by hand; the MCP can run `apply_migration` against production.
2. **Add `permissions.deny`** for `.env*`, `*.pem`, `credentials*` in `.claude/settings.json`.
3. **Split `AGENTS.md`** into short core rules plus path-scoped files (geo/map, AI quota, vault, import audit), which cuts the always-loaded context.
4. **Stale design docs.** `DESIGN.md` still names Bodoni, Manrope and Instrument (8 mentions) after Phase 0 moved to DM Sans; `.impeccable` and `PRODUCT.md` need the same check.
5. Optional: a PreToolUse hook that blocks edits to `supabase/migrations/` already applied, and a `/qa`-style command wrapping `npm run typecheck && lint && test && build`.

Install the guide's audit skills for a deeper pass (they were not run): token-audit, eval-rules, eval-skills, audit-agents-skills, security-check.

---

# Full pass (guide skills: security-check, token-audit, eval-skills, eval-rules, audit-agents-skills)

Run from a local clone of the guide's repo, against its threat database v2.31.0 (updated 2026-10-04). Read-only. Scope: project (`.claude/`, `.agents/`, `.codex/`, `.mcp.json`, `AGENTS.md`); the container's global `~/.claude` was not audited.

## Security check

| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | No hardcoded keys, private keys, remote-exec or exfiltration patterns in any skill script; no prompt-injection phrases in AGENTS.md / DESIGN.md / PRODUCT.md |
| High | 1 | Supabase MCP (`.mcp.json`) attached to the **live** project with `database` + `development` features, no `read_only`, no branch |
| Medium | 3 | No `permissions.deny` (`.env*`, `*.pem`, `credentials*`); `.agents/skills/impeccable/scripts/bin/linux-x64/impeccable` is a committed ELF binary (third-party, invoked by Codex hooks); superdesign skill can generate paid images/video, which AGENTS.md says not to do without the owner asking |
| Low | 2 | Plugin `impeccable` is pinned by commit SHA (good) but fetched from `main` ref; MCP URL is not version-pinned (HTTP service, so not applicable) |

Passed: no `dangerouslySkipPermissions`, no wildcard `allow`, no `curl | sh`, no zero-width / RTL characters in skills, no cron or shell-rc writes, `.env` ignored (only `.env.example` tracked), no CVE-matched MCP.

Hook note: `.codex/hooks.json` runs `.agents/skills/impeccable/scripts/impeccable` on every Edit/Write and on Stop, but only `scripts/bin/linux-x64/impeccable` exists, so the `[ ! -f … ] ||` guard makes it a no-op today. Decide whether the hook should run; if so, the binary should be pinned and its provenance recorded.

## Token audit

- Fixed context: `AGENTS.md` 39,321 bytes (~9.8K tokens) + system prompt (~7.5K) = **~17K tokens**, green (<20K). There is no `CLAUDE.md`, no `.claude/rules/`, no `MEMORY.md`.
- Everything is "always on". The geo/map, AI-quota, vault and import-audit sections only matter in some files. Moving them to path-scoped rules would save roughly 6–7K tokens per session without losing content.
- Skills load on demand: superdesign (154 lines) and impeccable (SKILL.md 11.9 KB) cost nothing until used.

## Skills quality (eval-skills)

| Skill | description | effort | allowed-tools | Problem |
|---|---|---|---|---|
| superdesign | yes (long, broad "even if they never say…") | no | no | Links `references/INIT.md`, `RESUME.md` and others that do **not exist** in the folder (only `SKILL.md`), so the skill points at missing files; the broad trigger can fire on any UI request |
| impeccable | yes | no | no | Frontmatter has `metadata.version` only; also a very broad trigger ("design, redesign, … improve a frontend interface") |

Both overlap with the superpowers and frontend-design skills in the user's environment; two design skills with broad triggers compete.

## Rules (eval-rules) and agents (audit-agents-skills)

No `.claude/rules/` and no project agents or commands, so there is nothing to grade. That is itself the gap: the repo's rules live in one file.

## Prioritised fixes (none applied; say which to do)

1. `.mcp.json`: add `&read_only=true` (or use a Supabase branch) so a session cannot change the live schema; keep migrations hand-applied as AGENTS.md says. *(1 line)*
2. `.claude/settings.json`: add `permissions.deny` for `.env*`, `*.pem`, `credentials*`. *(5 lines)*
3. Decide on the impeccable Codex hook and the committed binary (pin and document, or remove).
4. Fix or remove the superdesign skill's missing `references/`; add a line to AGENTS.md that it must not generate images or video unless the owner asks.
5. Split `AGENTS.md` into a short core file plus path-scoped rules (~6–7K tokens saved).
6. Refresh `DESIGN.md` / `.impeccable` for DM Sans (Phase 6 cleanup already lists this).

## Applied (fixes 1, 2, 4a)

- `.mcp.json`: Supabase MCP is read-only (`read_only=true`). Migrations stay hand-applied.
- `.claude/settings.json`: `permissions.deny` for `.env`, `.env.local`, `.env.production`, `*.pem`, `credentials*` (`.env.example` stays readable).
- `AGENTS.md`: the no-image-generation rule now names the superdesign skill.
- Still open: committed `impeccable` binary and Codex hook, superdesign's missing `references/`, splitting `AGENTS.md`, stale `DESIGN.md`.
