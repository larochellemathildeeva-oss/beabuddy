# Working in this repo

Béa is a TanStack Start app deployed by **Canner** from `main` on GitHub, with
its database and auth in a **dedicated Supabase project** (`fjfonywfnskriwlhbriw`).
It is no longer connected to Lovable.

## Toolchain

```
npm run typecheck   # tsc --noEmit — vite does not typecheck, so run this
npm test            # node --test over src/lib/*.test.ts (needs Node >= 22.6)
npm run lint        # eslint; the tree carries pre-existing prettier drift
npm run build       # must exit 0 before anything is pushed
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on every
push to `main` and every pull request. Do not push work that has not passed it
locally first.

## App version (Canner)

`package.json` `version` is the number shown in the app header. Bump it on
every push that will deploy to Canner.

| Change | Command | Example |
| --- | --- | --- |
| Bug fix, no new capability | `npm run version:fix` | 1.0.0 → 1.0.1 |
| Better existing feature | `npm run version:enhance` | 1.0.0 → 1.1.0 |
| New feature or large change | `npm run version:feature` | 1.0.0 → 2.0.0 |

## Database

Migrations live in `supabase/migrations/` and are **applied by hand**, not by
the deploy. Writing a migration does not change the live database — say so
plainly rather than reporting a schema fix as done.

Storage buckets and auth settings are configured in the Supabase dashboard and
are not fully represented in this repo. Do not assume the repo describes the
live configuration; check before relying on it.

## Notes

- Product philosophy: `docs/WHAT_BEA_BELIEVES.md`. Brand: `docs/BRANDING.md`.
  Voice: `src/lib/bea-voice.ts`. Security checklist: `docs/SECURITY_REVIEW_CHECKLIST.md`.
  Never position Béa as “AI travel planner.” Prefer privacy copy that matches reality
  (*designed to / private by default / may*), not absolute guarantees.
- `vite.config.ts` builds on `@lovable.dev/vite-tanstack-config`, which supplies
  the whole plugin chain. It is a leftover from the previous host but is load-
  bearing — removing it means reconstructing the build config.
- `src/lib/*.functions.ts` files ship to the client bundle. Server-only code
  belongs in `*.server.ts`, or behind a lazy import inside a handler.
