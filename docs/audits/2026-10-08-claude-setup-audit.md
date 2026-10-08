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
