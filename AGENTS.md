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

`package.json` `version` is the number shown in the app header. **Do not
change it in a branch.** Every branch that did conflicted with every other on
that one line. After each merge, `.github/workflows/version.yml` bumps it on
`main` and commits it back, so the deploy shows the new number.

The step is chosen by a label on the pull request, set before it is merged:

| Change | Label | Example |
| --- | --- | --- |
| Almost every change: fixes, improvements, small new tools | none | 1.0.0 → 1.0.1 |
| A big feature | `version:enhance` | 1.0.0 → 1.1.0 |
| A major overhaul, only when the owner asks | `version:feature` | 1.0.0 → 2.0.0 |
| No bump (docs, CI only) | `version:skip` | stays 1.0.0 |

Default to no label. When you open a pull request for a big feature, add
`version:enhance` to it and say so in its description. A pull request that
changes the version itself is left as it is, not bumped again. The
`version:fix` / `version:enhance` / `version:feature` scripts stay for bumping
by hand on `main`, which is rarely needed.

## Database

Migrations live in `supabase/migrations/` and are **applied by hand**, not by
the deploy. Writing a migration does not change the live database — say so
plainly rather than reporting a schema fix as done.

To see which migrations the live database is missing, run `npm run db:check`
and paste the query it prints into the Supabase SQL editor. Each row names a
migration (or part of one) the database does not match; no rows means every
migration is in. It replays the folder in order — tables, columns, functions,
triggers, policies, indexes, constraints, grants and revokes — so a new
migration is covered as soon as it is written.

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

1. `GEOAPIFY_API_KEY` set: **Geoapify** — geocoding, autocomplete, reverse,
   walking/driving routes, "coffee near me" category searches (its Places API,
   ahead of the public Overpass servers) and the map tiles served through
   `/api/tile`, five requests a second. Its terms allow storing
   results, which is what saved pins are. It answers in its own shapes;
   `geoapify.ts` translates them into Nominatim's and OSRM's (tested), and
   callers read every answer through `readGeoJson`.
   Optimize plans on travel times **estimated from the pins**
   (`estimatedTables` in `route-optimize.ts`) and orders each day with Béa's
   own exact solver (`solveDay`), both pure, tested and free. It then spends
   credits on two things only: **checking the journeys the plan actually
   makes** on the Routing API (`checkLegs` in `route-optimize.server.ts`, one
   credit per journey, at most `CHECK_MAX_LEGS` new ones a run — a day whose
   real route is much longer than the map said is ordered again on the real
   times). Journeys go through one cache shared with directions
   (`route-legs.server.ts`), asked the same way (`DIRECTIONS_WALK_M`), so a
   journey checked by Optimize is free when its directions are kept, and the
   other way round. The other spend is **Place Details** opening hours for
   the "Open when you get there" goal (one credit per new place,
   `HOURS_LOOKUP_MAX`, shared with the stop card through
   `place-facts.server.ts`). Geoapify's **Route Matrix and
   Route Planner are deliberately not used**: they cost locations ×
   min(locations, 10) credits, where checking the chosen route costs one per
   journey. Both lookups are cached in process and reserved against a daily
   ceiling, `OPTIMIZE_DAILY_CREDITS` in `geo-budget.server.ts`, through the
   `geo_credit_usage` migration. That migration is applied by hand; until it
   is, the ceiling is skipped with one warning in the log.
   **How the traveller gets around** is asked in the directions sheet
   (`travel-mode.ts`, pure and tested; remembered per trip on the phone by
   `travel-choice-store.ts`): walk what's close (the old default: walk under
   `DIRECTIONS_WALK_M`, drive the rest), public transit, walk everywhere, or
   car. Transit is routed only by Geoapify, with its `approximated_transit`
   mode (`GEOAPIFY_TRANSIT_MODE`): typical times, not a timetable, so every
   transit journey is marked as an estimate and opens Google Maps in transit
   mode for the real lines. Any other provider, or a failed transit route,
   gets a straight-line estimate (`route-estimate.ts`). `npm run map:check`
   routes one transit journey to confirm the mode name.
2. `LOCATIONIQ_TOKEN` set: LocationIQ, which speaks Nominatim's and OSRM's
   shapes directly, at two requests a second. A walk its router refuses is
   routed as a drive and timed at walking pace, marked as an estimate.
3. Neither: OpenStreetMap's public Nominatim and the OSRM demo router —
   keyless, one request a second, and not really intended for systematic
   geocoding.

**When Geoapify's day runs out.** Geoapify does not refuse the call that goes
over the free plan's 3,000 credits (one day of itinerary testing counted
8,728), so Béa keeps its own count. Every request that may reach Geoapify goes
through `geoFetch` in `geo-provider.server.ts`, which adds what Geoapify
charges for it (`geoapifyCredits` in `geo-credits.ts`, pure and tested: a
geocode, route or place search 1, Place Details 2, a tile or font ¼, a static
map 1 plus 1 per marker). At `GEOAPIFY_DAILY_CREDITS` (2,700 unless the env
var of that name says otherwise), or when Geoapify answers 401, 402 or 403,
Geoapify rests until midnight UTC; a 429 rests it for its `Retry-After`, or a
minute. While it rests, `geoFetch` sends nothing to Geoapify (a 503 instead),
batches re-ask `geoProvider()` before each lookup, and it answers with
LocationIQ, else the public servers,
Geoapify-only extras (hours, photos by place, nearby categories, static
maps) are skipped, and `/api/vtile` 404s so the day map draws image tiles.
The count is kept in the server's memory, so a restart starts it again at 0.

**The day map and its offline copy.** With a Geoapify key the day map
(`DayMap.tsx`) draws OpenMapTiles vector tiles in Béa's journal palette
(`journal-style.ts`), through `/api/vtile` and `/api/glyphs` in `server.ts`,
using MapLibre inside Leaflet (`@maplibre/maplibre-gl-leaflet`); the pins and
everything else stay Leaflet's. Paths are parsed in `vector-tiles.ts` (pure,
tested). Without a key, without WebGL, or when the server does not answer, it
draws the `/api/tile` image tiles as before — a 404 from `/api/vtile` is how
it knows, and it also checks a label font answers. "Keep offline" on saved
directions also saves the tiles around each day's stops (`offlineTilePlan`, at
most `OFFLINE_TILE_MAX`, a quarter credit each) into Cache Storage, one cache
per trip (`offline-map.ts`). `public/sw.js` (registered in production only)
keeps each page and the built files, so an installed Béa opens with no signal;
server functions, Supabase and tiles are never answered from it. A trip whose
directions are kept offline also keeps its plan on the phone
(`offline-trip.ts`), which the trip list and the trip read back when the
network fails. Bump `VERSION` in `sw.js` to drop old copies. The Geoapify URLs
were written from its documentation; `GEOAPIFY_API_KEY=… npm run map:check`
confirms them, and the transit mode, against the real thing.
Labels ask for the browser's language first (`name:fr`, `name:ja` …), then
Latin, then the local name (`labelName`). Arabic and Hebrew are shaped by
`@mapbox/mapbox-gl-rtl-text` (`rtl-text.ts`), served from Béa's own build and
fetched only when such a label is drawn. A saved map keeps the fonts for the
traveller's own script as well (`LANGUAGE_GLYPH_STARTS`).

**Stops the map misses.** With `OPEN_PLACES_API_KEY` set (the Open Places API's own key; an
Overture Maps API `ovt_…` key is for another service and does not work), a stop the
geocoder cannot find in its town — or finds only as a namesake out of town, or
under another name — is looked up by name near the middle of town in
Overture's place listings through the Open Places API (`open-places.ts`, pure
and tested; `open-places.server.ts` holds the key). OpenStreetMap is thin
outside big cities; Overture's listings are not, and are CDLA Permissive 2.0,
so the pins may be saved and drawn on Béa's own map (Google Places may not be:
its terms forbid its data on a non-Google map). What Google does allow is
a link: a rec saved from a pasted Google Maps link keeps that link, and
"Open in Maps" opens its exact place (`googlePlaceLink` in `reco-open.ts`:
the short link as is, a `ChIJ…` place ID through `query_place_id`, a
feature ID through `?cid=`), with no API call. A match must echo the stop's
name, closed places are skipped, and the nearest to the middle of town wins.
Only venues use it (`venues: true`), never a trip's cities. The free plan is
10,000 calls a month and stops answering at the cap; a refusal pauses it for
an hour. `OVERTURE_ATTRIBUTION` sits beside the other map credits.

**Place photos.** When a stop's Place Details carry a `wikimedia_commons`,
`image` or `wikidata` tag, the stop card shows that place's photo from
Wikimedia Commons (`wikimedia.ts`, pure and tested; `wikimedia.server.ts`
fetches, keyless, cached in process). Never `brand:wikidata` — that is the
chain, not the branch. Every photo is shown with its author and licence and
a link to its Commons page, and files with extra restrictions are skipped.
Only places already matched by name get one, like hours. With "Real photos" chosen
under You → Appearance (`stop-pictures.ts`), the same photo replaces the
illustration on stop and place pictures (`PlacePicture.tsx`), one Place
Details lookup per new placed stop; anything without a photo keeps its
illustration. A trip banner with no photo of the traveller's own shows
its town instead (`townPhotoFor`: the town's English Wikipedia article → its
Wikidata item → its Wikivoyage banner (P948), else its image (P18), else its
Commons category (P373); keyless, no Geoapify credit). Photos are judged
before they are shown (`readCommonsImage`): a place's must be a JPEG or WebP
photograph (no maps, drawings or logos), at least 600 px on its short side
and not a strip taller than 2:1; when it is not, the item's image and then
the best-rated file in its Commons category are tried, and only files Commons'
reviewers rated (featured, quality, valued) are taken from a category.

**Pexels first.** With `PEXELS_API_KEY` set, both the town banner and a
stop's photo are searched on Pexels first (`pexels.ts`, pure and tested;
`pexels.server.ts` holds the key), and Commons is only the backup. Pexels is a
stock library, so a photo is taken only when its description names the stop
or town (never a generic name like "Cafe"), and a town's must not name another
country. A stop's photo is searched by its name even when Place Details cannot
confirm the place at the pin, so it must not name a country the pin is outside
(`countryFilterAt`, from the boxes in `public/geo/admin1/index.json`). Pexels photos carry no credit of their own: the privacy page credits
Pexels, with a link, once. Commons photos keep theirs, as their licences
require. The free plan is 200 searches an hour for the whole app, so Béa stays
under 180, gives one traveller at most 40, and rests when Pexels says few are
left; Commons answers meanwhile.

Keys are read only in `*.server.ts` and imported lazily inside handlers,
because `*.functions.ts` ships to the client bundle. Never prefix them
`VITE_`. After changing anything here, check neither followed the code into
the browser:

```
npm run build && grep -rlE "GEOAPIFY_API_KEY|LOCATIONIQ_TOKEN|OPEN_PLACES_API_KEY|OVERTURE_API_KEY|PEXELS_API_KEY" .output/public/   # must print nothing
```

OpenStreetMap data is ODbL, so `OSM_ATTRIBUTION` must stay visible wherever
its data is shown — currently the trip map and the privacy page — and
`GEOAPIFY_ATTRIBUTION` beside it on the maps, as Geoapify's free plan asks.

**Smarter place search.** The search box's `searchPlaces` runs
`smartPlaceSearch` around the plain lookup (`findPlaces`), each step only
when the one before found nothing that is the place: a Japanese block
address ("2-3-23 Shinsaibashisuji") is asked as the map reads it,
"Shinsaibashisuji 2-chome 3-23" (`japan-address.ts`, also used by plan
lookups in `planStopQueries`); results sharing only the area's words with
the search ("Shinsaibashi Mocha Cat Cafe" for "Caffé Shinsaibashi") go last,
marked `weak` (`place-match.ts`); "Change place" sends the stop's name and
pin, so a shortened search is also asked by the full name; and in a country
mapped in another script, Gemini gives the name in that script and it is
searched too (`local-name.ts`, `local-name.server.ts`: only the name and
country are sent, cached in process, 30 an hour per traveller). Kind words
are spelt one way when names are compared (`canonicalSpelling`: caffè →
cafe). The import prompt (`ai-plan-prompt.ts`) asks for the local-script
name in brackets as well.

**Search credits.** A pause in typing (`typing: true`) runs only the
type-ahead, or one plain search when it has nothing: no spelling variants,
wider towns, name parts, Overture or Gemini. Pressing Search runs everything.
Each search's answer is kept (`place-search-cache.server.ts`): in memory,
then in `place_search_cache` for two weeks, keyed by a hash of the words,
town and rounded position (`searchCacheKey`, tested), so the same search is
paid for once across all travellers. Empty answers are kept an hour, in
memory only. Bump `SEARCH_CACHE_VERSION` when a change to the search should
not be answered from old results. The migration is applied by hand; until it
is, memory only, with one warning in the log.

## Import audit

**The frozen gate (CI).** `npm run audit:ci` runs on every pull request, with
no keys and no calls, and fails when the import reads or pins anything worse
than the saved bar in `scripts/itinerary-audit/frozen/`:

- `ci.mjs`: every fixture set through the list reader, and every frozen
  Gemini answer (`frozen/answers-<set>.json`) through today's clean-up
  (`audit.mjs --rescore … --replay --check`). A new finding fails.
- `pins-japan.mjs`: a traveller's real 10-day Japan plan (127 stops,
  `frozen/japan`, shared with their consent) placed from frozen map answers
  (`frozen/japan/geo`) and scored against an answer key reviewed by hand
  (`truth.json`). More pins saved wrong, or fewer saved right, fails.

Do not loosen a rule to fix one plan without running `npm run audit:ci`: it
is how a fix for one plan is kept from quietly breaking another. When a
change is right and the bar should move, re-save it (`ci.mjs --save`,
`pins-japan.mjs --save`) in the same pull request and say why. When a change
asks the map something new, the replay reports it: run
`NODE_USE_ENV_PROXY=1 node scripts/itinerary-audit/pins-japan.mjs --record`
(LocationIQ and Open Places keys, spend-capped), then `--save`.

`scripts/itinerary-audit/` puts sample plans through the real import and
scores the answer: `audit.mjs` for stops, times, kinds, bookings and towns
(`--fixtures fresh` or `more` for the newer sets; `--engine rules` needs no
key; `--rescore out/<file>.json --replay` re-runs saved Gemini answers
through today's clean-up for free), and `pins.mjs` for where each stop is
pinned against where it really is (`pins-truth.mjs`), scored the way the
import screen saves pins. Run both after changing the import, the plain-list
reader, the place lookup or the match scoring. In a cloud session, prefix
`pins.mjs` with `NODE_USE_ENV_PROXY=1`.
Fixture sets: the original, `fresh`, `more` (Béa's own prompt format),
`world` (day trips with hotels and flights) and `edge` (vague times,
alternatives, places passed but not visited, an overnight flight, stops
outside the city, a 140-stop plan). `check-truth.mjs` checks the answer key
against Wikipedia's coordinates (never against the geocoder under test);
`pins.mjs` scores checked places at 250 m and marks the rest unverified.
Both scripts load `spend-guard.mjs`: every Geoapify credit, LocationIQ call,
Open Places call and Gemini call is counted per UTC day in a file and refused past a cap
(`AUDIT_GEOAPIFY_CREDITS` 500, `AUDIT_LOCATIONIQ_CALLS` 1500,
`AUDIT_GEMINI_CALLS` 100, `AUDIT_OPENPLACES_CALLS` 120), and map answers are cached on disk. Béa's own
Geoapify guard counts in memory, so without it each run started at 0.

## Web check before planning

When Béa drafts or reworks a plan (Build, Rebuild, Alternatives), it first
runs a short **Grounding with Google Search** call (`web-check.server.ts`):
events, closures and strikes at the destination on the trip's dates, at most
`WEB_CHECK_MAX_SEARCHES` searches, cached six hours per place and dates. Only
the place and dates are searched, never the traveller's notes. A long planning
prompt with search switched on rarely searches, which is why it is a call of
its own. Google bills each search, and its terms ask that a grounded answer is
shown with its Search Suggestions, unaltered, and its sources:
`SearchGroundingNote` does that under the plan. `GEMINI_SEARCH_GROUNDING=off`
turns it off. A failed check never stops the plan.

## Reading a booking file

In Trip documents, a new PDF or photo can be read with **"Fill in from this
file"** (`AssignSheet` in `DocumentSheets.tsx`). Only when tapped: the file
goes to Gemini (`document-read.server.ts`, at most `DOCUMENT_READS_PER_HOUR`
per traveller), and the answer is cleaned in `document-read.ts` (pure and
tested): capped to the columns, card numbers (Luhn-checked, so 13-digit
e-ticket numbers stay) dropped, and its date used to pick the trip
(`tripForDate`) and stop (`stopForRead`) only when the choice is clear. It
fills the form, marks each field "from file" until it is edited, and saves
nothing. Other file types (.pkpass, .eml, .docx) do not offer it.

## World globe data

The World tab shades provinces and states from `public/geo/admin1/` — one
TopoJSON file per country plus an `index.json` of their boxes, built from
Natural Earth's public-domain admin-1 boundaries by
`scripts/provinces/build.mjs` (the steps are at the top of that file). They
are static files, fetched only for the countries a user has been to; which
province a city is in is worked out in the browser from its position.
Country names are matched in any language through `src/lib/country-names.ts`.

## Notes

- Product philosophy: `docs/WHAT_BEA_BELIEVES.md`. Brand: `docs/BRANDING.md`.
  Voice: `src/lib/bea-voice.ts`. Security checklist: `docs/SECURITY_REVIEW_CHECKLIST.md`.
  Never position Béa as “AI travel planner.” Prefer privacy copy that matches reality
  (*designed to / private by default / may*), not absolute guarantees.
- `vite.config.ts` lists the whole plugin chain itself: Tailwind, tsconfig
  paths, TanStack Start, Nitro (`node-server`, build only) and React. Add a
  plugin there only if it is not already in that list.
- `src/lib/*.functions.ts` files ship to the client bundle. Server-only code
  belongs in `*.server.ts`, or behind a lazy import inside a handler.
