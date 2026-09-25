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

**Every migration that creates a table in `public` grants it explicitly**, in
the same file. From 2026-10-30 Supabase no longer grants new tables to the API
roles automatically, so a table without grants is unreachable on any database
rebuilt from this folder. Follow the existing tables, not Supabase's template:
`select, insert, update, delete` to `authenticated`, `all` to `service_role`,
and nothing to `anon` — Béa has no signed-out data access. A table only a
`SECURITY DEFINER` function touches still needs `service_role` if server code
reaches it with the admin client.

Storage buckets and auth settings are configured in the Supabase dashboard and
are not fully represented in this repo. Do not assume the repo describes the
live configuration; check before relying on it.

## Geocoding and routing

Place lookups and directions go through `src/lib/geo-endpoints.ts` (pure URL
building, tested) with the provider chosen in `geo-provider.server.ts`, in this
order:

1. `GEOAPIFY_API_KEY` set: **Geoapify** — geocoding, autocomplete, reverse and
   walking/driving routes, five requests a second. Its terms allow storing
   results, which is what saved pins are. It answers in its own shapes;
   `geoapify.ts` translates them into Nominatim's and OSRM's (tested), and
   callers read every answer through `readGeoJson`.
2. `LOCATIONIQ_TOKEN` set: LocationIQ, which speaks Nominatim's and OSRM's
   shapes directly, at two requests a second. A walk its router refuses is
   routed as a drive and timed at walking pace, marked as an estimate.
3. Neither: OpenStreetMap's public Nominatim and the OSRM demo router —
   keyless, one request a second, and not really intended for systematic
   geocoding.

Keys are read only in `*.server.ts` and imported lazily inside handlers,
because `*.functions.ts` ships to the client bundle. Never prefix them
`VITE_`. After changing anything here, check neither followed the code into
the browser:

```
npm run build && grep -rlE "GEOAPIFY_API_KEY|LOCATIONIQ_TOKEN" .output/public/   # must print nothing
```

OpenStreetMap data is ODbL, so `OSM_ATTRIBUTION` must stay visible wherever
its data is shown — currently the trip map and the privacy page — and
`GEOAPIFY_ATTRIBUTION` beside it on the maps, as Geoapify's free plan asks.

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
