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

## Database

Migrations live in `supabase/migrations/` and are **applied by hand**, not by
the deploy. Writing a migration does not change the live database — say so
plainly rather than reporting a schema fix as done.

Storage buckets and auth settings are configured in the Supabase dashboard and
are not fully represented in this repo. Do not assume the repo describes the
live configuration; check before relying on it.

## Notes

- `vite.config.ts` builds on `@lovable.dev/vite-tanstack-config`, which supplies
  the whole plugin chain. It is a leftover from the previous host but is load-
  bearing — removing it means reconstructing the build config.
- `src/lib/*.functions.ts` files ship to the client bundle. Server-only code
  belongs in `*.server.ts`, or behind a lazy import inside a handler.
