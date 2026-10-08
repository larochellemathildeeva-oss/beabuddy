# Places and lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Bucket list (Wishlist + Next time), Recs holds only businesses/landmarks/attractions, World only cities/countries, every World location shows and opens its recs, and Béa finds articles to pull recs from.

**Architecture:** No migration. A pure module `src/lib/place-lists.ts` decides which list a saved row is in and whether it is a location; every screen reads through it. Labels change once in `pinLabel`; pickers read one `SAVE_LISTS` constant. "Find recs" is a grounded Gemini search in `article-search.server.ts` behind a server function, feeding the existing article reader (`parseRecoList` with `pageUrl`).

**Tech Stack:** TanStack Start, React, Supabase (`recommendations` table), `ai` SDK with Gemini search grounding, `node --test`, `scripts/preview/check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-08-places-lists-design.md`

## Global Constraints

- No migration; `pin_type` keeps `visited | nexttime | wishlist | reco`. New saves never write `nexttime`.
- Shown names only: **Recommendation**, **Bucket list**, **Been there**. "Wishlist", "Visited" and "Next time" appear on no screen. The `--nexttime` colour token stays.
- Location = `isAreaPlace` (city or country); everything else is a rec (businesses, landmarks, attractions, neighbourhoods).
- `AI_COST.articleSearch = 2`; reading an article stays `recoList = 3`. Article search cached 7 days per city + country; only city and country are sent.
- `GEMINI_SEARCH_GROUNDING=off` hides Find recs. Google's Search Suggestions and sources are shown unaltered with any grounded answer (`SearchGroundingNote`).
- Only place names and the article link are saved, never article text.
- Do not change `package.json` `version`. PR label: `version:enhance` (a big feature).
- Gate before every push: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:public-secrets && npm run check:contrast && npm run db:check:ci`; `npm run preview:check` before the PR.

## Review Focus

- A city saved twice in different languages ("Los Ángeles" / "Los Angeles", "USA" / "United States") shows one location with one rec count.
- Two namesake cities (Paris, France and Paris, Texas) never share recs.
- An old `nexttime` row opened in the save sheet shows Bucket list and is not rewritten on save unless the list is changed.
- A country location (Japan) counts recs in Japan only when no city of that rec is itself a saved location.
- Find recs with no signal, quota spent, or grounding off: the sheet says so and Paste a link still works.

---

### Task 1: The list model

**Files:**
- Create: `src/lib/place-lists.ts`, `src/lib/place-lists.test.ts`
- Modify: `src/data/atlas.ts` (`pinLabel`), `src/lib/reco-groups.ts` (`RECO_GROUP_ORDER`, grouping), `src/lib/recs-browse.ts` (`listCounts`), `src/lib/reco-place.ts` (`hiddenFromRecs`)

**Interfaces:**
- Produces (in `place-lists.ts`):
  - `type ShownList = "recommendation" | "bucket" | "been"`
  - `listOf(row: { pin_type: string | null; visited?: boolean | null }): ShownList` — `visited` flag or `pin_type "visited"` → been; `wishlist`/`nexttime` → bucket; else recommendation.
  - `SAVE_LISTS: readonly PinType[] = ["reco", "wishlist", "visited"]`
  - `isLocation(row: RecoPlaceFields): boolean` (= `isAreaPlace`)
  - `recsForLocation<T extends RecoPlaceFields>(location: { city: string | null; country: string | null }, rows: readonly T[], locations: readonly { city: string | null; country: string | null }[]): T[]`
- Changes: `pinLabel` → `visited: "Been there"`, `wishlist: "Bucket list"`, `nexttime: "Bucket list"`, `reco: "Recommendation"`. `RECO_GROUP_ORDER` → `["reco", "wishlist", "visited"]` with `nexttime` rows grouped under `wishlist`. `listCounts` returns `{ reco, bucket, visited }` (bucket = wishlist + nexttime). `hiddenFromRecs` → true for every `isAreaPlace` row.

- [ ] **Step 1: Write failing tests** in `place-lists.test.ts`:
  - `listOf`: `{pin_type:"nexttime"}` and `{pin_type:"wishlist"}` → `"bucket"`; `{pin_type:"reco", visited:true}` → `"been"`; `{pin_type:null}` → `"recommendation"`.
  - `SAVE_LISTS` does not include `"nexttime"`.
  - `recsForLocation({city:"Los Angeles",country:"USA"}, rows, [])` returns a rec saved with `city:"Los Ángeles", country:"United States"` and not one with `city:"Paris", country:"France"`; Paris, France never matches a rec in Paris, Texas (`country:"US"`).
  - A country location `{city:null,country:"Japan"}` returns a Kyoto rec when Kyoto is not in `locations`, and not when `{city:"Kyoto",country:"Japan"}` is.
  - In existing test files: `pinLabel.nexttime === "Bucket list"`; `listCounts` of one wishlist + one nexttime row → `bucket: 2`; `hiddenFromRecs` of `{name:"Japan",country:"Japan",category:"country"}` with type `"wishlist"` → true.
- [ ] **Step 2:** `npm test` — the new tests fail (module missing, old labels).
- [ ] **Step 3:** Implement. City matching folds accents and case (`foldAccents`), compares the city's first comma part; countries compare by `countryKey`; a row with no country matches on city alone only when the location has no country either. Update every caller of `listCounts` (`recommendations.tsx`) to the new keys.
- [ ] **Step 4:** `npm test` and `npm run typecheck` pass.
- [ ] **Step 5:** Commit `feat: one Bucket list and a location/rec split in the list model`.

### Task 2: Save choices without Next time

**Files:**
- Modify: `src/components/recs/SaveSheet.tsx:8`, `src/components/RecoListImport.tsx:27`, `src/components/TripPlacesImport.tsx:20`, `src/components/recs/ExploreNearby.tsx:64`, `src/routes/recommendations.tsx:109`, `src/components/AddVisitedCity.tsx:40-44`, `src/components/NearbyMapPin.tsx:~40`, `src/lib/trip-keepers.ts:40`
- Test: `src/lib/no-next-time-choice.test.ts`

**Interfaces:** Consumes `SAVE_LISTS`, `pinLabel` (Task 1).

- [ ] **Step 1: Write failing test** `no save picker offers Next time`: read each file above; assert none contains `"nexttime"` in an array literal or a `{ type: "nexttime"` entry, and each picker file imports `SAVE_LISTS` or uses `pinLabel` only.
- [ ] **Step 2:** Run it — FAIL listing the eight files.
- [ ] **Step 3:** Replace each local choice array with `SAVE_LISTS` (AddVisitedCity and NearbyMapPin keep their own order but drop `nexttime`; their labels come from `pinLabel`). In SaveSheet, a row whose `pin_type` is `nexttime` shows Bucket list selected and saving writes `pin_type` only when the choice changed.
- [ ] **Step 4:** Test, typecheck pass; preview flow `save sheet: lists are Recommendation, Bucket list, Been there` (open SaveSheet in the `recs` sample; radio names exactly those three) green in three themes.
- [ ] **Step 5:** Commit `feat: save sheets offer Recommendation, Bucket list, Been there`.

### Task 3: Recs shows recs only

**Files:**
- Modify: `src/routes/recommendations.tsx` (chips ~1413-1440, saved-screen tabs ~839-860, card button ~757, card meta line ~739, add/paste save path)
- Test: `scripts/preview/check.mjs` (new flows)

**Interfaces:** Consumes `listOf`, `isLocation`, `listCounts` (`{ reco, bucket, visited }`), `pinLabel`.

- [ ] **Step 1: Write failing flows** (sample `recs`): chips read exactly `All`, `Recs`, `Bucket list`, `Been there` (no `Wishlist`, `Next time`, `Visited` text anywhere on the page); no card names a city-level save; every card's button is `Add to trip`; the chip row has `scrollWidth <= clientWidth` or a visible overflow fade (`[data-overflow]`); the search box has an accessible name `Search your recs` (the header link keeps `Search your places`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Chips from `listCounts` (bucket chip filters `listOf(r) === "bucket"`); the chip row wraps to two lines at 320px instead of overflowing; card meta reads `{city} · {pinLabel}`; "Add to a day" → "Add to trip"; the search `textarea` gets `aria-label="Search your recs"`. Saving a row that `isLocation` from the Recs add box saves it with `pin_type` as chosen and shows the toast "Added to your Bucket list on World" (or "…Been there on World") with an action linking to `/world?tab=bucket` (or `been`).
- [ ] **Step 4:** Flows green in three themes.
- [ ] **Step 5:** Commit `feat: Recs holds businesses, landmarks and attractions only`.

### Task 4: World locations and their recs

**Files:**
- Create: `src/components/world/LocationSheet.tsx`
- Modify: `src/routes/world.tsx` (`wishlistRows`/`nextTimeRows`/`destinationsOf` ~124-145 and ~247-255, Stats "Your travel lists" tiles ~420-435 and ~1111-1120, bucket rows and `RowMenu` ~853-950, Been there rows, map place card), `src/components/RecoListImport.tsx` (new optional props)
- Test: `scripts/preview/check.mjs`

**Interfaces:**
- Consumes: `listOf`, `isLocation`, `recsForLocation` (Task 1).
- Produces: `LocationSheet({ location: { name: string; city: string | null; country: string | null }, recs: RecoRowDB[], open: boolean, onClose: () => void, actions?: ReactNode })`; `RecoListImport` gains `initialCity?: string`, `initialPageUrl?: string` (prefill; a non-empty `initialPageUrl` starts reading at once).

- [ ] **Step 1: Write failing flows** (sample `world`, with sample data holding LA as a Bucket list city and 2 LA recs): the Bucket list tab lists only cities/countries (no business names); LA's row reads `· 2 recs`; tapping it opens a dialog named `Los Angeles` listing both recs and a `Paste an article link` button that opens the reader with `Los Angeles` filled in; the Stats tab has no `Next time` text; a Been there city with recs shows its count too; Escape closes the sheet.
- [ ] **Step 2:** Run — FAIL. Add LA and its recs to the preview's fake data if missing (`scripts/preview/src/fake-supabase.ts`).
- [ ] **Step 3:** Bucket rows = `vault.rows.filter(r => listOf(r) === "bucket" && isLocation(r))`, grouped by country with cities as today; the count uses `recsForLocation` over `vault.rows.filter(r => !isLocation(r))`; rows without recs show no count. The row menu's actions move into `LocationSheet` `actions`, and "Been there — put it on my globe" goes through `ConfirmSheet`. The Map tab's place card for a city shows the same count and opens the same sheet. Remove the Next time tile and its `nextTimeRows`.
- [ ] **Step 4:** Flows green in three themes; `npm test` passes.
- [ ] **Step 5:** Commit `feat: World locations show and open their recs`.

### Task 5: Find recs for a location

**Files:**
- Create: `src/lib/article-search.ts` (pure), `src/lib/article-search.test.ts`, `src/lib/article-search.server.ts`, `src/lib/article-search.functions.ts`
- Modify: `src/lib/ai-quota.ts` (`AI_COST`), `src/components/world/LocationSheet.tsx`, `src/lib/ai-quota.test.ts`

**Interfaces:**
- Produces:
  - `articleCacheKey(city: string | null, country: string | null): string` — folded city + `countryKey(country)`.
  - `articleSearchPrompt(city: string | null, country: string | null): string` — asks for up to 3 recent articles listing places to eat, see and do there, one per line as `Title | https://url`.
  - `readArticles(text: string): { title: string; url: string }[]` — keeps lines with a public `https:` URL (`isPublicHttpsUrl`), at most 3, no duplicates.
  - `findArticles` server fn (`requireSupabaseAuth`), input `{ city: string | null; country: string | null }`, returns `{ articles: {title,url}[]; grounding: SearchGrounding | null }`; reserves `articleSearch` before searching; cache 7 days, 200 entries; empty list when grounding is off.
  - `AI_COST.articleSearch = 2`.

- [ ] **Step 1: Write failing tests:** `articleCacheKey("Los Ángeles","USA") === articleCacheKey("los angeles","United States")`; `readArticles` of a reply with 4 URL lines, one `http:` and one duplicate returns 2 entries; `readArticles("no links here")` is `[]`; the prompt names the city and country and nothing else of the traveller's; `AI_COST.articleSearch === 2`.
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Implement the pure file, then the server file on the `webCheck` pattern (`searchTools()`, `withModelFallback`, `readSearchGrounding`, process cache with `TTL_MS = 7 * 24 * 60 * 60 * 1000`), then the server function importing it lazily inside the handler. In `LocationSheet`: **Find recs for {city}** (hidden when the function reports grounding off) lists the articles with `SearchGroundingNote` under them; picking one opens `RecoListImport` with `initialPageUrl`; quota and network failures show `friendlyError` text in a `role="alert"` line and keep Paste a link.
- [ ] **Step 4:** Tests pass; `npm run build && npm run check:public-secrets` pass (no key in the client bundle); preview flow with a faked `findArticles` reply (2 articles) shows both titles and opens the reader with the first URL; with a faked quota refusal shows the refusal text.
- [ ] **Step 5:** Commit `feat: Béa finds articles to pull recs from for a location`.

### Task 6: Verify and open the PR

- [ ] **Step 1:** Full gate (Global Constraints), then `npm run build && npm run preview:check`: 0 problems in three themes.
- [ ] **Step 2:** Screenshots (Calm, 390px) of Recs home, World Bucket list, the LA location sheet and Find recs; check each Review Focus line.
- [ ] **Step 3:** Update `docs/audits/2026-10-08-flow-audit.md` tracking (items 3, 4 and the Recs search/chip line); AGENTS.md gets a short "Places and lists" section (what is a location, the three list names, Find recs costs).
- [ ] **Step 4:** Push; open the PR with label `version:enhance` and the screenshots; subscribe to it.
