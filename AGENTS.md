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
npm run db:check:ci           # migration rules, offline (RLS, grants, no anon)
npm run check:public-secrets  # after build: no server secret in .output/public
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, the migration
rules, build and the public-bundle secret scan on every push to `main` and
every pull request. Do not push work that has not passed it
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
   ahead of the public Overpass servers) and, when OpenFreeMap does not
   answer, the day map's vector tiles, five requests a second. Never the image
   tiles of `/api/tile`: that endpoint is public, so it asks LocationIQ or
   OpenStreetMap only, and `tileSourceUrl` takes no Geoapify key. Its terms allow storing
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
   `DIRECTIONS_WALK_M`, drive the rest), public transit, walk everywhere,
   car, or the traveller's own distance rules (walk under one distance, one
   way up to a second, another beyond; kept as a `rules:…` string so it is
   stored and sent like a preset). A choice other than "walk what's close" is
   also told to Build, Rebuild, Alternatives and Optimize (`travelPrompt`).
   Transit is routed only by Geoapify, with its `approximated_transit`
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
maps) are skipped, and the day map's vector tiles come from OpenFreeMap alone
(below).
The app-wide count is reserved atomically in `geoapify_daily_usage` before a
request is sent, in 25-credit blocks shared across restarts and server
instances (`GeoLedger` in `geo-ledger.ts`, pure and tested); the in-memory
guard still counts each actual call too. The ledger keeps everything per UTC
day and only moves forward, so a reservation or denial for one day never
counts toward the next. If a reservation fails for anything except a missing
migration, `geoFetch` fails closed: nothing is sent to Geoapify, the cause is
logged (at most once a minute), and Geoapify rests for 60 seconds from the
failure so lookups move to the fallback meanwhile. The migration is applied
by hand; until it is, or where there is no service-role client at all (local
runs, unit tests, the import audit), Béa logs one warning and uses the
in-memory count, asking the database again hourly, so applying the migration
needs no restart. That durable count also bounds the vector-tile fallback,
which goes through `geoFetch`; only its 600-credit share stays per process.

Map proxy requests have their own guardrails before that shared allowance: successful image
tiles, vector tiles and glyphs stay in a 24-hour in-process LRU (2,000 entries / 64 MB), and a
cache miss that reaches anything except OpenFreeMap is limited to 600 upstream fetches per client
per 10 minutes. Image tiles never reach Geoapify. Vector tiles and glyphs may use at most 600
Geoapify credits per UTC day; after that they stop at OpenFreeMap, leaving the rest of the
app-wide allowance for place search and directions.

**The day map and its offline copy.** The day map (`DayMap.tsx`) draws
OpenMapTiles vector tiles in Béa's journal palette (`journal-style.ts`),
through `/api/vtile` and `/api/glyphs` in `server.ts`, using MapLibre inside
Leaflet (`@maplibre/maplibre-gl-leaflet`); the pins and everything else stay
Leaflet's. Paths are parsed in `vector-tiles.ts` (pure, tested). The server
asks **OpenFreeMap** first (`open-free-map.server.ts`: free, keyless, no
request limit, commercial use and offline copies allowed, same schema and
Noto Sans fonts; its weekly build's URL is read from its TileJSON), and
Geoapify, at a quarter credit a tile, only for what OpenFreeMap does not
answer; after a failure OpenFreeMap rests five minutes. `OPENFREEMAP=off`
leaves the map on Geoapify alone. OpenFreeMap asks to be credited with
OpenMapTiles: `OPENFREEMAP_ATTRIBUTION`, on the day map and the privacy page.
Without WebGL, or when neither answers, it draws the `/api/tile` image tiles
as before — a 404 or 502 from `/api/vtile` is how it knows, and it also
checks a label font answers. "Keep offline" on saved directions also saves
the tiles around each day's stops (`offlineTilePlan`, at most
`OFFLINE_TILE_MAX`) into Cache Storage, one cache per trip
(`offline-map.ts`). `public/sw.js` (registered in production only)
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

**Kept directions in the account.** "Keep offline" also writes the trip's
directions to `trip_directions` (one row per traveller and trip, readable
only by them while on the trip; `directions-account.ts`), and deleting them
deletes both copies. After sign-in, `restoreKeptOffline` (from `AppShell`,
once per page load) writes back every copy the phone is missing, with the
trip's plan (`keepTripPlanOffline` in `useTrips.ts`), its map and its day
pictures, so the trip opens offline without being opened first. Signing out
from the profile runs `clearKeptOfflineOnSignOut`: it first sends the
account any copy it lacks, then removes from the phone only the trips the
account holds (`signOutClears` in `directions-backup.ts`, pure and tested);
with no signal nothing is removed. The idle and Documents-lock sign-outs
clear nothing. Erase deletes the rows, and leaving a trip deletes that
traveller's row (a trigger on `trip_members`). The migration is applied by hand;
until it is, directions stay on the phone only, with one warning.

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
name, closed places are skipped, and the nearest to the stop before wins when
that stop is in the same town (a chain's branches), else the nearest to the
middle of town. A short word of the name (under five letters) must start a word
of the place's name: "ryo" and "sho" are both inside "Kisshokaryo".
Only venues use it (`venues: true`), never a trip's cities. The free plan is
10,000 calls a month and stops answering at the cap; a refusal pauses it for
an hour. `OVERTURE_ATTRIBUTION` sits beside the other map credits.

**Remembered places.** A stop the import finds by its name and trusts is
remembered in `resolved_places` (`resolved-places.ts`, pure and tested;
`resolved-places.server.ts`), and the next import of that stop near the same
town gets the same pin without asking the map. A place a traveller picks for
a stop with "Change place" (`rememberPlacePick`) is their vote; once two
different travellers pick the same spot for a name, that spot wins, even over
the map. A name matched at several spots in one town is a chain, and is
looked up as before. Only hashes of names and travellers are stored, by the
server alone. The migration is applied by hand; until it is, nothing is
remembered, with one warning in the log. The audits run with no database
(`no-database.ts`), so the pin check measures the lookup itself.

**Pins to check.** What the import's review says about a pin it was unsure
of ("Béa's best guess", "Check this one — not pinned") is kept on the stop as
`pin_check` (`pin-check.ts`, pure and tested), not dropped on saving. With
"Pins to check" on (trip view settings, off by default), the trip header
shows a "!" with their count, opening a list to review (`PinReviewSheet`):
"Looks right" approves the pin (and counts as the traveller's vote in
`resolved_places`), "Change place" sets another; either clears the note. The
printed itinerary carries the notes too while the setting is on. The
migration is applied by hand; until it is, nothing is kept.

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
npm run build && npm run check:public-secrets   # CI runs it too
```

A new server-only key goes into `SERVER_SECRET_NAMES` in
`scripts/check-public-secrets.mjs`.

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

## AI usage per traveller

Every Gemini call costs money, so each AI operation reserves units from the
traveller's day before Gemini is asked (`reserveAi` in `ai-quota.server.ts`;
costs in `AI_COST`, `ai-quota.ts`, pure and tested): a trip build 4, comparing
two plans 6, a receipt 2, and so on, `AI_DAILY_UNITS` a UTC day (100 unless
that env var says otherwise). One operation reserves once, however many models
`withModelFallback` tries, before the web check and after its pictures are
checked (a refused picture costs nothing). Local-script names looked up in the
background of a search draw on a bucket of their own (`LOCAL_NAME_DAILY`,
`reserve_ai_units_in`, the `ai_usage_buckets` migration), never the allowance
for what a traveller asks; when it cannot be counted in the deployed app, the
search simply goes on without them. The user ID always comes
from the verified session (`context.userId`). The count is held in
`ai_daily_usage` by `reserve_ai_units` (service role only, atomic), so restarts
and several instances share it. When the database cannot be asked, the
operation fails closed with a plain message, and so does the deployed app
(`isDeployedBuild` in `deployed.ts`) when the ledger is missing altogether.
Only run from source (local runs, unit tests, the import audit) is the same
ceiling counted per process, with one warning. The Geoapify ledger follows the
same rule: in the deployed app no ledger means no Geoapify, so lookups use the
fallback. The migration is applied by hand. The older hourly limits (document
reads, plan edits, local-script names) stay as they were. A new AI entry point
reserves too: add its cost to `AI_COST`.

## Photos on a stop

A traveller can add their own photos to a stop, in the stop's sheet
(`StopPhotos.tsx`, `useStopPhotos.ts`, read once per trip). Each is a row in
`photo_memories` with `itinerary_item_id`, and its `trip_id` is set by a
trigger from the stop, never trusted from the app. Everyone on the trip sees
them (row policy and a storage read policy); only the owner deletes one. They
are also the owner's Photo memories, so every personal read of
`photo_memories` (Photos page, globe, Past You) filters on `user_id`. The trip menu's
**Photos** card shows every photo on the trip and adds ones of the trip as a
whole: `trip_id` set by the app, no `itinerary_item_id`, no pin (the same
policies cover it, so no migration). The
migration is applied by hand; until it is, the sheet says photos are not
set up yet.

## Home's living map

Home with a trip ahead follows the "three moods" design
(`.superdesign/handoff/15-home-moods.jpg`): "Béa." header (`homeHeader` on
`AppShell`), "Upcoming trip / {title} in 2 days." over a map of the trip,
a card of to-dos, the flight and how packed, "Where to next?", and three
suggestions that open Plan with Béa with the request written but not sent
(`HomeLivingMap.tsx`). The map (`TripRouteMap.tsx`) is drawn from the trip's
own stops — real coastlines (`world-atlas` land-50m, loaded only when the map
draws), a relief made by an SVG lighting filter, one smooth line through the
cities and a pill beside each; the geometry and the pill placement are pure
and tested (`home-route-map.ts`). Its colours are per mood (`--home-*`,
`--map-*`, `--route-*`, `--pill-*` at the end of `styles.css`). No picture is
generated for it.

A city typed rather than picked from the search has no position, so it is
looked up by its name and country (`city-position.ts`, pure and tested;
`city-locate.ts` asks `searchPlaces` with `areas: true`, one at a time, and
keeps the answers on the phone). It happens when a trip is made or a city
added (`createTrip`, `addStops`), and on Home for an older trip, the first time
it shows (`useCityPositions`). The position is saved only on a stop that is
the city itself and still has none: never on a hotel or address, never over a
pin someone picked. A one-city trip's own city is looked up the same way.

## Follow along (Now)

"Follow along" on the Now view (`FollowAlong.tsx`; `live-companion.ts`, pure
and tested) watches the phone's position, through the same `useLiveLocation`
store as the day map, only after the traveller taps "Use my location" and
only while the screen is open. It offers "Looks like you're at …" / "Looks
like you've left …" (readings must be within ±75 m and agree for a minute,
or be close and sure at once; only the next stop or the one after it, never
one behind) and shows the time to the next stop from where they are, with
the straight-line estimate (`route-estimate.ts`). It never writes
`arrived_at` / `left_at` itself: those are on the trip for everyone on it,
so the traveller's tap still saves them. The position is not sent to the
server or kept.

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
"Paste text" in Add document opens the same form with a box for a
confirmation email's or message's text; **"Fill in from this text"** sends it
through the same reader, cleaned first by `cleanPastedText` (card numbers
dropped, capped at `PASTED_TEXT_MAX`). The pasted text is not saved.

## Follow-along links

A read-only share link (`ShareLinkCard`, `/shared/$token`, `trip-share.ts`)
can also "follow along": the page marks the stop someone on the trip tapped
"I'm here" at and the ones left (`sharedStopStatus`, pure and tested), and
re-reads itself every two minutes while open. It is built from `arrived_at`
and `left_at` only — never the phone's position or the times of the taps. An
arrival older than 12 hours with no "Leaving" counts as done. It is the
`follow_along` column on `trip_share_links`, off for older links; the
migration is applied by hand, and until it is, links show the plan only.

## Following a shared trip

A signed-in traveller who opens a share link can tap **"Follow in Béa"**
(`FollowButton` on `/shared/$token`) to keep the trip under **Trips →
Following** (a tab shown only once they follow one; `FollowedTripList`).
It is the same link, kept in their account: `trip_follows` holds one row per
traveller and link, written only by the server after it checks the token
(`trip-follow.server.ts`; no insert policy), and the trip is read through the
link in its fixed view (`followedTripCard` in `trip-follow.ts`, pure and
tested). A traveller follows at most `FOLLOW_MAX` (20) trips, read a few at
a time and limited per traveller, since each is a read of its plan. A link
turned off or expired drops out of the list and its row is cleared (only
after a read that worked; a failed one throws); Erase deletes the rows. The migration is applied by hand; until it
is, the button and the tab do not show.

## Protected passcodes

Protected is encrypted in the browser with a key from the traveller's
passcode (PBKDF2 then AES-GCM, `vaultCrypto.ts`). Anyone with a copy of
`vault_settings` can try passcodes offline against its verifier, so the
passcode is the weak part, not the cipher. A new passcode must be at least 12
characters, and one made only of digits at least 12 digits: a six-digit PIN
falls to an offline search in hours (`validateVaultPasscode` in
`vault-passcode.ts`, pure and tested), enforced
in `useVault`'s `createVault` as well as the form. Older vaults with a shorter
passcode still unlock; on unlock they are asked to choose a stronger one
(`changePasscode`): every document is re-encrypted in the browser and written
with the new salt and verifier in one transaction by `rotate_vault_passcode`
(security invoker, under the tables' own row level security), which refuses
if the verifier this device unlocked with is no longer current (a change on
another device) or a document is missing. Documents are read a page at a
time, and a change larger than 20 MB is refused up front. An insert into
`vault_documents` waits for a running change (a share lock on the
traveller's `vault_settings` row, by trigger), and `addDoc` re-reads the
verifier afterwards, deleting its row and asking to unlock again if the
passcode changed meanwhile. Face ID / fingerprint on that device is
forgotten, since it held the old key; a Face ID unlock never sees the
passcode, so it reads `vault_settings.passcode_rule` (the rule the passcode is
known to meet, written when one is created, changed, or typed and found long
enough; `VAULT_PASSCODE_RULE`) and asks when it is missing or older. A typed
short passcode is asked about too, and so is one given to set up Face ID.
After Face ID the prompt also offers "Mine is long enough": the current
passcode, typed once and checked, is recorded as meeting the rule. The
migration is applied by hand; until it is, the change fails with nothing
written and the old passcode keeps working.

## Reading settings

You → Appearance → Reading (`AccessibilityPicker`) sets text size, font
(Béa's, Atkinson Hyperlegible, Lexend or the device's), reduced motion, more
contrast and bolder text (`accessibility.ts`, pure and tested; synced with the
account as `accessibility`). Text size works because every pixel `font-size`
and `line-height` in the CSS is rewritten at build time to
`calc(<n>px * var(--text-scale, 1))` (`text-scale-css.ts`, a lightningcss
visitor in `vite.config.ts`), and the `--text-*` theme sizes are written the
same way. So keep writing sizes in px; a size inside `calc()`, `var()` or the
`font` shorthand is not scaled. The rest are `data-font`, `data-motion`,
`data-contrast` and `data-bold` on `<html>`, styled at the end of
`styles.css`; `ACCESSIBILITY_BOOT_SCRIPT` puts them on before first paint.

## World globe data

The World tab shades provinces and states from `public/geo/admin1/` — one
TopoJSON file per country plus an `index.json` of their boxes, built from
Natural Earth's public-domain admin-1 boundaries by
`scripts/provinces/build.mjs` (the steps are at the top of that file). They
are static files, fetched only for the countries a user has been to; which
province a city is in is worked out in the browser from its position.
Country names are matched in any language through `src/lib/country-names.ts`.

## Gemini spend from coding sessions

A coding session's Gemini key bills the same Google project as the app.
From 2026-09-03 to 2026-10-03, about 72% of the project's 25 CAD was image
generation (Gemini 3 Pro Image, Gemini 3.1 Flash Image) by coding sessions
painting the illustrations in `public/places/`, `public/banners/` and
`.superdesign/handoff/`. The app itself never generates images.

- **Never generate images with Gemini** (or any paid image model) unless
  the owner asks for that picture in that session. Reuse
  `public/places/` and `public/banners/`.
- Text calls to Gemini from a session (the audits, quick tests) go through
  the scripts' spend caps (`spend-guard.mjs`) and use the app's own model
  (`DEFAULT_GEMINI_MODEL`), not a Pro or newer model.

## Notes

- Product philosophy: `docs/WHAT_BEA_BELIEVES.md`. Brand: `docs/BRANDING.md`.
  Voice: `src/lib/bea-voice.ts`. Security checklist: `docs/SECURITY_REVIEW_CHECKLIST.md`;
  sign-in settings that live in the Supabase dashboard: `docs/AUTH_SECURITY_BASELINE.md`.
  Never position Béa as “AI travel planner.” Prefer privacy copy that matches reality
  (*designed to / private by default / may*), not absolute guarantees.
- `vite.config.ts` lists the whole plugin chain itself: Tailwind, tsconfig
  paths, TanStack Start, Nitro (`node-server`, build only) and React. Add a
  plugin there only if it is not already in that list.
- `src/lib/*.functions.ts` files ship to the client bundle. Server-only code
  belongs in `*.server.ts`, or behind a lazy import inside a handler.
