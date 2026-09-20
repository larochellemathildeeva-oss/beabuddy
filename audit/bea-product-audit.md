# Béa — Product, Logic and Trust Audit

Scope: `src/` at `fd9480e`. Read as a product and travel-planning artefact, not a
style review. Every finding names the file and function it comes from.

A note on baseline: `node_modules` is absent in the audit container, so
`npm run typecheck`, `npm run lint` and `npm run build` could not be run. `npm test`
passed 710 of 717; all 7 failures are `ERR_MODULE_NOT_FOUND: date-fns`, which **is**
declared in `package.json` — an install artefact, not a repo break. No claim below
rests on a failing build.

This codebase is unusually self-aware. Many of the classic failures (bare-name
geocoding, the "Plan" kind collapse, the neighbourhood-centroid pin) are already
fixed, with the scar tissue written into the comments. The findings below are
mostly about **fixes that were applied on one path and not the other three**.

---

# 1. User Experience Failures

## 1.1 Revising a plan keeps the old plan's map pins

### Severity
**Critical**

### User Story
"Béa drafted my Lisbon trip. Stop 3 was a restaurant I didn't like, so I ticked it,
typed 'somewhere less touristy', and she found me a great alternative. I saved the
trip." The new restaurant is on the timeline — pinned to the old restaurant's
coordinates, across town.

### What Actually Happens
`src/components/ItineraryImport.tsx`:

1. `read()` calls `parseItinerary`, then `setPlacements({})` and
   `void placeParsed(out.items)`. `placeParsed` geocodes each row and
   stores the result in `placements`, **keyed by array index**.
2. `findAlternatives()` / `rebuildTrip()` call `reviseItinerary` and
   hand the result to `applyRevision`.
3. `applyRevision` sets `summary`, `items`, `plan`, `picked`. It **never** calls
   `setPlacements({})` and **never** re-runs `placeParsed`.
4. `addChosen()` then does `const found = placements[i]` and writes
   `{ lat: found.lat, lon: found.lon }` onto the new row.

`mergeAlternativeItems` (`src/lib/itinerary-plan.ts`) swaps replacements in **at the
same indexes**, which is precisely what makes the stale map line up silently.

### Why It Happens
`placements` is index-keyed state with a lifecycle tied to one specific call to
`parseItinerary`, but three different functions can replace `items` underneath it.
The index is a coincidence of array position, not an identity.

### Consequences
The single worst outcome this app can produce: a **confidently wrong pin, with the
right name on it**, created by the exact feature the user reached for to improve
the plan. `PlacementNote` will even render "high confidence · Cervejaria
Ramiro" under a row that now says something else entirely. Trust damage is total
and unrecoverable — the user discovers it standing on a street corner.

### Suggested Fix
Key placements by a stable row identity, not index. Minimum viable fix: call
`setPlacements({})` inside `applyRevision`, and re-run `placeParsed(out.items)`.
Better: give each parsed item a client-side `uid` at parse time, carry it through
`mergeAlternativeItems`, and key `placements` by it — replaced rows lose their
placement, kept rows keep theirs, and no re-geocode is wasted.

### Estimated Effort
**Small** (clear-on-revise) / **Medium** (uid-keyed, correct).

---

## 1.2 Three of four geocoding paths write pins with no confidence check

### Severity
**Critical**

### User Story
"I added 'Dinner at a little izakaya' to day 3 of my Kyoto trip. It showed up on the
map." It is pinned to the centroid of Kyoto. Nothing said so, and nothing will.

### What Actually Happens
`geocodePlanStops` (`src/lib/geocode-plan.functions.ts`) returns `label`, `category`
and `kind` alongside `lat`/`lon` — precisely the evidence
`scoreMatch` (`src/lib/match-confidence.ts`) exists to grade, including its
`AREA_TYPES` set (`city`, `suburb`, `neighbourhood`, `district`…).

Four call sites:

| Call site | Scores the match? | Tells the user? | Writes to DB? |
|---|---|---|---|
| `ItineraryImport.tsx:319` (`placeParsed`) | **yes** (`scoreMatch`) | yes (`PlacementNote`) | after review |
| `TripDetail.tsx:151` (place trip stops) | no | no | **immediately** |
| `TripDetail.tsx:211` (place timeline rows) | no | no | **immediately** |
| `TimelineEntryForm.tsx:239` (place typed entry) | no | no | **immediately** |

The three silent sites drop `hit.label`, `hit.category` and `hit.kind` on the floor
and write `{ lat, lon }` in a background `useEffect` the user never sees
(`TripDetail.tsx:151`, `:211`; `TimelineEntryForm.tsx:239`).

Worse, they are **one-shot**: `rowsToPlace` / `stopsToPlace`
(`src/lib/stop-placing.ts`) filter on `!(typeof lat === "number" && typeof lon ===
"number")`. Once a bad centroid is written, the row is "placed" forever and is never
looked at again.

### Why It Happens
The confidence system was built for the import review screen, where there is a
natural moment to interrupt. The background-placement effects were written earlier
(and separately) to solve "the trip map is empty", and were never brought up to the
same standard.

### Consequences
- The trip map, `Near`, the trip card's map thumbnail and every distance
  computation silently inherit area centroids as venue positions.
- `buildRoutes` will then route *between two city centroids* and report a confident
  "Walk · 240 m · 3 min" for two restaurants that are 4 km apart.
- Because the write is invisible, there is no moment at which the user could have
  caught it.

### Suggested Fix
Move `scoreMatch` into `geocodePlanStops` itself and return
`{ confidence, reason }` on every `PlacedStop`. Then:
- `confidence: "high"` → write silently, as now.
- `confidence: "medium" | "low"` → write `lat`/`lon` **plus** a
  `location_confidence` column, and render the existing `PlacementNote` treatment
  inline on the timeline row ("Check this one — this looks like a whole area").
- Never auto-write `low`.

### Estimated Effort
**Medium** (server change is small; one migration; three call sites; one row badge).

---

## 1.3 Article import auto-selects the top worldwide hit and saves it

### Severity
**Critical**

### User Story
"I pasted a Time Out Rome listicle. Béa found 22 restaurants and looked them all up.
I tapped Save." Several are now in the vault with coordinates in other countries.

### What Actually Happens
`src/components/RecoListImport.tsx`:

1. `parseRecoList` (`src/lib/reco-list.functions.ts`) returns `{name, city, notes,
   category}` — and the prompt says *"Do not look them up"*, so `city` is only set
   when the article states it per-item, which listicles usually don't.
2. `searchQueryForReco` (`src/lib/reco-list.ts`, `searchQueryForReco`) appends the city only if present.
   No city → the query is a **bare venue name**.
3. `lookupOneByOne` calls `search({ data: { query: row.query } })` —
   note the absence of `at`. In `searchPlaces` (`src/lib/places.functions.ts`),
   `at` nullish ⇒ `area === undefined` ⇒ **unbounded worldwide search**.
4. `applySearchHits` (`reco-list.ts`, `applySearchHits`) sets `chosen: 0` — the top hit is
   preselected.
5. `draftsToSave` writes `hit.lat`, `hit.lon`, `hit.country`, `hit.address`
   — but keeps `draft.originalName` as the name.

`geocodeIsTrustworthy` (`src/lib/geocode-trust.ts`) — written specifically to stop
this — is **not consulted anywhere on this path**. Neither is `scoreMatch`.

### Why It Happens
`geocode-trust.ts` was bolted onto `parsePlaceLink` (the path where the Harvey's
bug was found) and never generalised to the other bare-name consumer.

### Consequences
This is the Harvey's-in-Slovakia failure, re-created in the highest-volume import
path, with one aggravating factor: because `draftsToSave` keeps the *article's*
name, the vault entry reads "Roscioli" — correct — while the pin is somewhere else.
There is no visible symptom at all until `Near` fails to fire, or a trip is built
around it.

### Suggested Fix
1. Pass the user's location (or the article's dominant city, derivable from the
   items that *did* get one) as `at`.
2. Gate `chosen: 0` on `geocodeIsTrustworthy({ name: originalName, city, hitName:
   hit.name })`. When it fails, set `chosen: null` and `status: "empty"` so the row
   renders as "Béa couldn't place this one — tap to search".
3. Render `scoreMatch` badges on this list, reusing `PlacementNote`.

### Estimated Effort
**Medium**

---

## 1.4 The entire AI product is behind one unlabeled 36-pixel circle

### Severity
**High**

### User Story
"Does Béa plan trips? I've had the app a week." Yes — build an itinerary, import
one from a photo, compare two plans, and optimise the days. All four live behind a
button with no text.

### What Actually Happens
`src/components/TripDetail.tsx`, the icon row above the trip title renders three `size-9` (36px) circular
icon buttons in a row. The first is the Béa logo with a sparkle
(`data-guide="bea-plan"`), `aria-label="Let Béa plan this trip"` — no visible label.
It opens `ItineraryImport`, whose three tabs (`Plan` / `Optimize` / `Compare`) are the whole AI surface.

`Optimize` has a second door (`TripDetail.tsx:539`, a text `SectionAction`) but only
appears once `board.items.length >= 2`. **Compare has exactly one door**: that icon,
then the third tab.

### Why It Happens
`roadmap.md` line 1: "Move Béa trip planning into an icon beside trip settings" —
this was a deliberate decluttering that succeeded at decluttering.

### Consequences
Compare-two-itineraries is the most differentiated thing in the product (§10) and
is effectively undiscoverable. Realistic discovery: **under 15%** of users who never
run the tour will find Compare; the build/import flow fares better only because the
icon sits at the top of an empty trip.

### Suggested Fix
On a trip with an empty timeline, replace the icon row with a labelled primary
card: "Let Béa plan this trip" / "Already have a plan? Paste or photograph it."
Collapse to the icon only once the timeline has content. Give Compare a second entry
point from the trips list.

### Estimated Effort
**Small**

---

## 1.5 The "Save" one-tap path skips the duplicate check the slow path has

### Severity
**High**

### User Story
"I saved Bar Brutal from a friend's text. Two months later someone else mentions it,
I search and tap Save again." Two entries, no warning.

### What Actually Happens
`src/routes/recommendations.tsx`:
- `existingMatch` runs `findDuplicate` and renders a warning inside the draft form —
  but **only inside the full draft form**.
- `quickSave`, wired to the `PlaceSearchInput` `quickAdd` button,
  goes straight to `vault.add(...)` with **no duplicate check at all**.

The UI deliberately funnels people to `quickSave`: it is the primary control, and
the five older add-buttons were folded away into "Other ways to save" (see the comment above
`PlaceSearchInput`).

### Why It Happens
Dedupe was added to the form; the one-tap path was added later as the fast lane and
inherited none of the form's guards.

### Consequences
The vault — the product's core asset and its stated moat — accumulates duplicates
through its most-used door. Duplicates then propagate: into `vaultPrompt`'s top-8
(§3.1), into `Near`, into Compare.

### Suggested Fix
Run `findDuplicate(vault.rows, captured)` inside `quickSave`. On a hit, don't block
— save nothing and show a toast: "You already saved this in March. Open it?" with an
Open action and a "Save anyway" action.

### Estimated Effort
**Small**

---

## 1.6 Béa says the same sentence all day

### Severity
**Medium**

### User Story
Save six places in one evening; see "Saved. Future You has excellent taste." six
identical times. It stops reading as a companion and starts reading as a string
constant, which is what it is.

### What Actually Happens
`src/lib/bea-voice.ts`, `beaLine`:
```js
export function beaLine(moment: BeaMoment, at = new Date()): BeaLine {
  const pool = POOLS[moment];
  const i = ((dayIndex(at) % pool.length) + pool.length) % pool.length;
  return pool[i]!;
}
```
`dayIndex` is `floor(now / 86_400_000)` — constant for 24 hours. Every `beaLine`
call on a given day returns the same entry. All 14 call sites use it
(`TripDetail.tsx:267`, `recommendations.tsx:404,435`, `ItineraryImport.tsx:296,463`,
`world.tsx:219`, `index.tsx:165`, …).

`BeaRunning` is the exception and does it right: `beaMomentPool` + random seed +
4.2s walk (`BeaRunning.tsx:36-59`). The 19-line `plan.locating` pool — the best
writing in the codebase — is the only one that works as intended.

### Why It Happens
"Stable-ish rotation so the same day feels consistent" optimised for a
property nobody perceives (cross-session consistency) at the cost of the one they
do (within-session variety).

### Consequences
Béa's personality is her entire positioning (`docs/WHAT_BEA_BELIEVES.md`,
`BEA_POSITION`). The mechanism that delivers it is set to "off" everywhere except
one loading spinner.

### Suggested Fix
Rotate per call within a session: keep a module-level `Map<BeaMoment, number>`
cursor, advance on each `beaLine`, seed from `dayIndex` so the *first* line of the
day is stable. Three lines of change, and the existing writing suddenly lands.

### Estimated Effort
**Small**

---

## 1.7 "Nothing nearby" is said without checking whether it could be known

### Severity
**High**

### User Story
"I'm in Lisbon and Béa says nothing is nearby." Eleven of her Lisbon saves came
from a pasted article and have no coordinates. She is standing 200 m from one.

### What Actually Happens
`recoAsPin` (`src/lib/vault-for-build.ts` `recoAsPin`, `useRecommendations.ts` `pins`) — and the equivalent in
`useRecommendations` — sets `lat: row.lat ?? Number.NaN`. `pinsWithin`
(`src/lib/near.ts`, `pinsWithin`) does `metresAway(here, pin)` → `haversine` with `NaN` → `NaN`
→ `NaN <= radius` is `false` → the pin is **silently dropped**.

`NearbyPlaces.tsx:293` then renders `beaLine("near.empty")`: *"Nothing nearby today.
The adventure appears to be hiding."*

Unplaced recs are common by construction: `parsePlaceLink` deliberately returns
`unlocated: true` rather than guessing (`places.functions.ts`), and
`draftsToSave` writes no coords when `chosen` is null.

### Why It Happens
`Number.NaN` was used as "no location", and `NaN` comparisons fail closed and
silently. Nothing counts how many pins were excluded.

### Consequences
Béa claims knowledge she doesn't have, in her own voice, in the single moment the
product exists for. This is the highest-value feature (`near.nearby`: "Past You left
a breadcrumb") failing invisibly.

### Suggested Fix
Have `pinsWithin` return `{ rows, unplaced }`. When `unplaced > 0` and `rows` is
empty, change the copy: *"Nothing nearby — but 11 of your saved places don't have a
location yet. Want Béa to find them?"* with a button that runs a paced batch lookup.

### Estimated Effort
**Small** (copy + count) / **Medium** (with the repair button).

---

## 1.8 The Help page describes a Home screen that no longer exists

### Severity
**Medium**

### User Story
"Help says I can hide 'Travel story and City memories shortcuts' and 'Recent
memories' under Customize home." Those switches aren't there, and neither are the
shortcuts.

### What Actually Happens
`src/lib/help-faq.ts:91` lists six toggles. `HOME_SECTIONS`
(`src/hooks/useHomeLayout.ts`, `HOME_SECTIONS`) has three: `trip`, `waiting`, `future`.
`src/routes/index.tsx` (`SignedInHome`) renders exactly those three plus
`NearHome` — no Travel story link, no City memories link, no recent memories.

`help-faq.ts:87` also says "Playback is your travel story — also called Travel story
on Home." There is no such thing on Home.

### Why It Happens
Home was simplified; the FAQ is a hand-maintained string table with no test binding
it to `HOME_SECTIONS`.

### Consequences
Help is the surface people reach when already confused. Being wrong there converts
confusion into distrust.

### Suggested Fix
Generate the Customize-home answer from `HOME_SECTIONS`, and add a test asserting
every feature named in `help-faq.ts` has a reachable route (see §9.1).

### Estimated Effort
**Small**

---

# 2. Logic Bugs

## 2.1 `buildRoutes` reuses one pin for every stop that shares a title

### Severity
**High**

### What Actually Happens
`src/lib/directions.functions.ts`, the stop loop in `buildRoutes`. Stops without coordinates are geocoded
once and memoised:

```js
const reuse = remembered.get(reuseKeyForStop(stop));
if (reuse) { points.push(reuse); continue; }
```

`reuseKeyForStop` (`src/lib/direction-stops.ts`, `reuseKeyForStop`):
```js
const address = stop.address?.trim();
if (!address) return stop.title.trim().toLowerCase();
```

So **every untitled-address stop is keyed by its title alone**, for the whole trip.

### Trace
A 5-day Rome trip parsed from a blog. `parseItinerary` emits `kind: "meal"` rows
titled `"Lunch"` on days 1, 2, 4 and `"Dinner"` on days 1, 3, 5 — a completely
ordinary output, since the source often only names the meal. None carry an address
(`placeHintFromDetail` returns null for prose like "somewhere near the Pantheon").

Day 1 "Lunch" geocodes to whatever `"Lunch, Rome"` resolves to. Days 2 and 4 then
take that same pin from `remembered` without a lookup.

### Why It Happens
The cache key was designed for the genuine case — the same *venue* appearing twice
in one trip — and falls back to the title when there is no address to disambiguate
with. Generic titles are the common case, not the edge case.

### Consequences
Legs are computed between duplicated points: `haversine(a, b) < 25` → `sameSpot:
true` → `directionDetail` renders **"Same place — no walk"** between two restaurants
on opposite sides of Rome. Then `placedFromLegs` (`timeline-directions.ts`, `placedFromLegs`)
writes those coordinates **back onto the timeline rows**, making the corruption
permanent and invisible.

### Suggested Fix
Include the stop's identity in the key when there is no address:
`stop.id ?? title`. Where there is no id, include `day_date` so at minimum two
different days never collapse. Never let a generic title alone be a cache key.

### Estimated Effort
**Small**

---

## 2.2 `planDayTrip` forces every stop into a vocabulary the app abandoned

### Severity
**Medium**

### What Actually Happens
`src/lib/itinerary.functions.ts`, `planDayTrip` prompt:
```
"Keep each saved name exactly. kind must be Plan, Reservation or Transport."
```
`TIMELINE_KINDS` (`src/lib/timeline-kind.ts`, `TIMELINE_KINDS`) is
`flight|hotel|reservation|transport|lodging|meal|sight|walk|activity|note`.
`"Plan"` is not in it — it is the *retired* vocabulary the file's own comment describes tearing out, and `SYNONYMS` maps `plan → activity`.

So a day trip built from a café, a museum and a restaurant stores three `activity`
rows.

### Consequences
- `timelineGlyph` returns `activity` for all of them — the icon spine, which exists
  to make a day scannable, goes flat.
- `vaultCategory(timelineGlyph(item))` returns `"Place"` for every one, so
  "keep this as a rec" files a restaurant as a generic Place — the exact regression
  `timeline-kind.ts`, the `TIMELINE_KINDS` doc comment was written to fix.
- `dayShapeLine` reports "3 activities" instead of "1 meal · 1 sight · 1 café".
- The `movement` set in the handler (`transport|flight|walk`) can never match
  `walk`, because the prompt forbids emitting it.

### Suggested Fix
Replace that prompt line with the same `kind must be exactly one of: ${KINDS}` used
by `instructions()`, plus the kind-selection sentence. One-line change.

### Estimated Effort
**Small**

---

## 2.3 A geocoder hit's street address is thrown away and replaced by the city

### Severity
**High**

### What Actually Happens
`placeFromNominatim` (`src/lib/place-label.ts`, `placeFromNominatim`) sets
`address: formatPlaceLine(hit)`. `formatPlaceLine`:

```js
const local = localityName(address) || cleanName(hit.name) || addressField(address, "country");
const admin = adminName(address);
const country = addressField(address, "country");
return uniqueParts([local, admin, country]).join(", ");
```

`LOCALITY_KEYS` is city/town/village/hamlet/suburb/neighbourhood/municipality;
`ADMIN_KEYS` is state/province. **`house_number` and `road` are never read**, even
though `addressDetails: true` is requested (`places.functions.ts`) and Nominatim
returns them.

### Trace
Search "Olive et Gourmando". Nominatim returns `address: {house_number: "351", road:
"Rue Saint-Paul Ouest", city: "Montréal", state: "Quebec", country: "Canada"}`.
`formatPlaceLine` → `"Montréal, Quebec, Canada"`. That string is what
`capturedFromParsedPlace` → `toNewReco` writes to `recommendations.address`.

### Consequences
Cascading, because "address" is load-bearing in five places:
- The vault shows "Montréal, Quebec, Canada" as a café's address. Useless to a
  traveller and indistinguishable from a rec that genuinely has no address.
- `looksLikeStreetAddress(address)` is always false, so `placeQueryCandidates`
  (`direction-stops.ts`, `placeQueryCandidates`) never gets the high-precision street query that its
  own doc comment says exists to prevent centroid pins.
- `reuseKeyForStop` falls through to title-only — which is §2.1's root cause.
- `addressLine` / `placePatchForSavedRow` propagate it onward.
- Offline directions and the "Map" link lose their best disambiguator.

This is the single highest-leverage data loss in the app: one function discards the
field that three other safety mechanisms are waiting for.

### Suggested Fix
Add `streetLine(address)` returning `[house_number, road].filter(Boolean).join(" ")`
and prepend it in `formatPlaceLine`. Keep `formatPlaceLine` for the *display* line
if needed, but have `placeFromNominatim` return the street-bearing address.

### Estimated Effort
**Small** (the function), **Medium** with test updates —
`place-label.test.ts` asserts current behaviour.

---

## 2.4 Compare's walking/transit/leg metrics are structurally unreachable

### Severity
**High**

### What Actually Happens
`compareItineraries` (`itinerary.functions.ts`) parses both plans with `runParse`,
which returns `ParsedItinerary` — and `ItemSchema` has **no `lat`/`lon` fields at
all**. There is no geocoding step on this path.

`computeItineraryMetrics` (`src/lib/itinerary-metrics.ts`, `computeItineraryMetrics`):
```js
const consecutive = points.length > 1 && points.every(Boolean);
let walkingKmPerDay = null;
if (consecutive) { ... }
```
`points` is all `null` ⇒ `consecutive` is `false` ⇒ `walkingKmPerDay` is **always
null**. `transitMinutesPerDay` and `longestTravelLegMinutes` are hardcoded `null`.

`METRIC_ROWS` (`ItineraryImport.tsx`, `METRIC_ROWS`) lists seven measures. Three of them can
never produce a number. Every comparison ever run renders:

> Walking / day — Not measured — Need a map pin on every stop.
> Transit / day — Not measured — Need routed times.
> Longest single trip — Not measured — Need routed times.

### Consequences
- Three of seven rows in the flagship comparison table are permanently dead. The
  table promises a rigour it structurally cannot deliver.
- `help-faq.ts:124` tells users Compare "reports indoor share, active hours a day,
  **walking distance** and estimated spend by category." That is false.
- The honest footnote ("A blank row means we could not measure it — never a guess")
  is doing real work, but three permanent blanks read as brokenness, not honesty.

### Suggested Fix
Either (a) run `geocodePlanStops` on both parsed plans before
`computeItineraryMetrics` — Compare already warns it "takes a little longer", so the
budget exists — and then `buildRoutes` for transit; or (b) delete the three rows and
the FAQ claim. (a) is what makes Compare defensible; (b) is honest and ships today.

### Estimated Effort
**Large** for (a), **Small** for (b).

---

## 2.5 `tagVaultItems` decides "From your vault" by naive substring, both ways

### Severity
**Medium**

### What Actually Happens
`src/lib/vault-for-build.ts`, `tagVaultItems`:
```js
const names = recos.map(r => r.name.trim().toLowerCase()).filter(n => n.length > 2);
const hit = names.some(name => title.includes(name) || name.includes(title));
return { ...item, source: hit ? "vault" : item.source === "vault" ? "new" : (item.source ?? "new") };
```

Two failures in one expression:
- **False positive.** A vault rec named `"Bar Basso"` (or just `"Bar"`, 3 chars, past
  the `> 2` filter) matches `title.includes(name)` for `"Barcelona Cathedral"`,
  `"Barbican Centre"`, `"Rhubarb"`. That row gets the **"From your vault"** badge
  (`ItineraryImport.tsx`, the "From your vault" badge).
- **False negative, deliberately.** When `hit` is false, an item the *model* marked
  `source: "vault"` is explicitly **demoted to `"new"`**. The model's own judgment —
  which had the actual vault list in its prompt — is discarded in favour of substring
  matching.

### Consequences
"From your vault" is the badge that makes the whole Past-You → Future-You premise
legible. It is decided by string containment and is wrong in both directions. A
user who sees it on a place they never saved loses the premise; a user who doesn't
see it on a place they did save never learns the feature works.

### Suggested Fix
Match on `comparableName` (`src/lib/captured-place.ts`, `comparableName`) equality — it already
normalises accents, punctuation and leading articles — rather than substring. Keep
the model's `"vault"` label when a normalised name also matches; drop the demotion
branch entirely.

### Estimated Effort
**Small**

---

## 2.6 Duplicate detection calls two different venues 80 m apart the same place

### Severity
**Medium**

### What Actually Happens
`isSamePlace` (`src/lib/captured-place.ts`, `isSamePlace`):
```js
if (a && b && haversine(a, b) <= SAME_PLACE_METRES) return true;   // 120 m
```
Coordinate proximity short-circuits **before any name comparison**. The doc comment
is explicit that this is intended ("Two pins on the same spot count even when the
names differ"), and for the Sagrada Família case it is right.

But 120 m in Shinjuku, the Marais or Gràcia contains dozens of distinct venues.
Two recs saved from the same block are declared the same place.

### Consequences
- `recommendations.tsx`, `existingMatch` renders "You already saved this" for a genuinely new
  place.
- `partitionNew` (`captured-place.ts`, `partitionNew`) — used by bulk import — silently drops it
  into `duplicates`.
- The failure is *silent suppression*: the place the user meant to save doesn't
  appear, and the reason given is wrong.

Note this does **not** affect `ItineraryImport`'s `duplicateIndexes`, which passes a
candidate with no coords and therefore falls through to name matching.

### Suggested Fix
Require corroboration: coordinate proximity alone counts only when the names are
*not* clearly different — e.g. `haversine <= 120 && (namesMatch ||
!bothNamesPresent)`. Tighten to ~40 m for the name-mismatch case.

### Estimated Effort
**Small**

---

## 2.7 A 3 km straight line is "walking"; a 300 km one is "driving"

### Severity
**Medium**

### What Actually Happens
`directions.functions.ts:301`:
```js
const mode: "walking" | "driving" = straight < 3000 ? "walking" : "driving";
```

Straight-line distance, with no reference to the stop's `kind`.

### Trace
- Tokyo → Kyoto, a `flight`/`transport` row the user booked on the Shinkansen:
  straight line 370 km → `driving` → OSRM returns a ~6 h car route → the timeline
  gains a Transport row reading **"Drive · 452 km · 5 h 40 min"** for a 2 h 15 train.
- Two stops 2.9 km apart across a river with one bridge: `walking`, and OSRM's foot
  profile will at least route it — but the mode was chosen before anyone looked.
- Paris → Tokyo: `driving`, OSRM fails, falls to `mapsOnlyLeg` with a Google Maps
  driving-directions URL between continents.

### Consequences
Timelines gain fabricated transport rows contradicting bookings the user told Béa
about. `directionTitle` writes "Drive to Kyoto" as a first-class timeline entry.

### Suggested Fix
Read the stop `kind`. `flight` → emit no leg (or a "Flight" row with no distance
claim). `transport` with a long straight line → `mapsOnlyLeg` rather than a driving
route. Cap `driving` at a sane intra-trip distance (say 200 km) and hand anything
above it to maps.

### Estimated Effort
**Small**

---

## 2.8 Historical expenses convert at today's exchange rate

### Severity
**Low**

### What Actually Happens
`useTripBudget` (`src/hooks/useTripBudget.ts`) loads `expenses` with `spent_on`, and
uses `useRates()` → `getRates` (`src/lib/rates.functions.ts`), which fetches
`api.frankfurter.dev/v1/latest`. `spent_on` is loaded but never used for conversion.

### Consequences
A three-week trip through a currency move shows a total that changes each time the
page loads. For an expense log with receipts and a `billable` flag, that is wrong in
a way people reconcile against.

### Suggested Fix
Frankfurter supports `/v1/{date}`. Fetch per distinct `spent_on`, cache by date
(rates for a past date never change), fall back to latest with a marked estimate.

### Estimated Effort
**Medium**

---

## 2.9 Article import silently truncates the page and the list

### Severity
**Medium**

### What Actually Happens
Two uncommunicated caps in series:
- `htmlToPlainText` (`src/lib/html-text.ts`, `htmlToPlainText`) hard-caps at `12_000` characters with
  `text.slice(0, max)`. Boilerplate (nav, cookie banner, author bio) is not stripped
  — only `<script>`, `<style>`, `<noscript>`, comments — so it consumes budget first.
- `startRecoDrafts` (`reco-list.ts`, `startRecoDrafts`) does `.slice(0, RECO_LIST_MAX)` where
  `RECO_LIST_MAX = 25`.

Neither cap is reported.

### Consequences
"The 50 Best Restaurants in Rome" yields maybe 15 places, and Béa says *"Béa found
15 places"* with complete confidence. The user believes the article had 15. Béa is
confidently wrong about a fact the user can check, which is the fastest way to lose
them.

### Suggested Fix
Return `{ truncated: boolean, sourceChars }` from the parse and say so: "This page
was long — Béa read the first part and found 15 places. Paste the rest to get the
others." Add basic readability extraction (`<article>`, `<main>`) before truncating.

### Estimated Effort
**Small** (the notice) / **Medium** (with extraction).

---

## 2.10 Photo import's reverse-geocode is the one geocoding path with no rate pacing

### Severity
**Medium**

### What Actually Happens
`src/routes/_authenticated/photos.tsx`, the `onFiles` loop, inside a `for (const file of files)`
loop:
```js
const place = await reverseGeocode(exif.lat, exif.lon);
```
`reverseGeocode` (`src/lib/geocode.ts`, `reverseGeocode`) caches on `lat.toFixed(3)` (~100 m) and
calls `lookupCoords` → `reverse()` → Nominatim.

Every other geocoding path in the repo paces itself — `nominatim()` has `Pace`/
`wait()`, `geocodePlanStops` has `nextDelayMs` + `sent[]`, `buildRoutes` has the
same. **This one has none.**

### Consequences
Import 40 photos from 40 locations on a road trip: 40 requests as fast as the loop
runs, against a provider with a documented 1 req/s policy. Nominatim returns 429;
`reverse()` catches, returns `{}`; `reverseGeocode` caches `null` — *permanently for
that session*, per the "A photograph without a city is still a photograph" comment.

The photos land in the **"Unsorted"** group (`photos.tsx`, the `groups` reduce). In
`mode: "locations"` they are **skipped entirely** and counted in the
`"had no location saved inside"` message — which is a false statement about the
user's files.

### Suggested Fix
Move the batch server-side into a paced `reverseCoordsBatch` server fn reusing
`nextDelayMs`, mirroring `geocodePlanStops`. Distinguish a 429 from a miss and
never cache a throttle as a miss — `geocode-plan.functions.ts` already models this
exactly (`throttled` handling).

### Estimated Effort
**Medium**

---

## 2.11 Failed lookups are retried with the identical query

### Severity
**Low**

### What Actually Happens
`RecoListImport.tsx:180-184`:
```js
let hits = await search({ data: { query: row.query } });
if (hits.length === 0) {
  await wait(PLACE_LOOKUP_GAP_MS);
  hits = await search({ data: { query: row.query } });
}
```
Identical query, identical parameters. `searchPlaces` is deterministic given a
responsive provider, so the only scenario this helps is a transient provider
failure — which `nominatim()` signals by **throwing**, not by returning `[]`.

### Consequences
Doubles request volume on exactly the rows most likely to be rate-limiting the
batch, making the failure worse.

### Suggested Fix
Delete the retry, or retry with a genuinely different query (`fuzzyQueryVariants`
already exists, and `searchPlaces` already applies it internally).

### Estimated Effort
**Small**

---

# 3. AI Product Audit

For each capability: what the user thinks they're giving, what the model actually
receives, and where the line falls between **AI actually knows** and **AI is
confidently guessing**.

## 3.1 Build itinerary (`parseItinerary`, `mode: "build"`)

**User thinks they're giving:** "my trip, my saved places, my tastes." The sheet
header says *"Built around your travel preferences and tagged recs."*

**Model actually receives** (`loadBuildExtra`, `instructions`):
- `preferencePrompt(preferences)` — the full profile. Real.
- `vaultPrompt(city, recos, notes, prefs)` — **at most 8 recs**
  (`vault-for-build.ts`, `vaultPrompt`, `limit = 8`), selected by `rankOpportunities` with
  **no `ctx`**, drawn from a `.limit(40)` query filtered `ilike('%city%')` then
  narrowed by `matchesDestination`.
- Free text, pace, budget level, currency, dates.

**Missing context:**
- **Vault is loaded only when `mode === "build" && tripCity`.** A trip with no city
  set gets **zero** vault places — and the "Built around your tagged recs" header
  still shows.
- A multi-city trip filtered on one `tripCity` misses every rec saved under the other
  cities. Kyoto saves are invisible to a trip whose `city` is "Tokyo".
- Only 8 of up to 40 matching recs reach the model. The user is never told which 8,
  or that there were 40.
- **No coordinates**, no opening hours, no travel times, no distance matrix, no
  weather, no availability.

**Where hallucination occurs:**
- Every venue name is generated from parametric knowledge. Nothing verifies a
  restaurant still exists, is open, or is in the right neighbourhood.
- `day_number` / `time_label` are invented. The prompt says *"Use realistic opening
  patterns and travel times"* — the model has no data for either; it is asked to
  simulate plausibility.
- Costs, when enabled, are entirely invented. `applyCostPolicy` correctly strips
  them when not asked for, which is good discipline.

**AI actually knows:** the structure of the request; the vocabulary (`kind` is
constrained to `TIMELINE_KINDS` then `normaliseKind`d); the names of the 8 vault
places handed to it; the user's stated preferences.

**AI is confidently guessing:** that the places exist, are open, are reachable in
the time allotted, cost what it says, and are where geocoding will later put them.

The prompt is unusually disciplined about the *booking* boundary ("Béa cannot check
availability or make a reservation" appears in four separate prompts). It says
nothing about the *existence* and *geography* boundary, which is where the actual
failures are.

## 3.2 Import itinerary (`parseItinerary`, `mode: "import"`)

**User thinks:** "Béa reads my plan and keeps it."

**Model receives:** the pasted text (≤20k chars) or up to 6 downscaled images, plus
`instructions()` with `"Never invent confirmed bookings, confirmation numbers or
times that are not in the source."` — good — **plus `preferencePrompt(preferences)`**.

**Problem:** injecting the user's preference profile into an *extraction* task is a
category error. `"Things to avoid entirely: crowds"` and `"Food rules that must be
respected: vegetarian"` are in the same prompt as "extract this itinerary". Nothing
instructs the model that preferences are irrelevant here. Quiet omission of a
source item is undetectable — the user has no per-item diff.

**Best-engineered part of the whole AI surface:** `day_number`. Asking "which
numbered day is this?" and doing the arithmetic in `resolveDayDates`
(`src/lib/relative-days.ts`, `resolveDayDates`) is exactly right, and the `needsDayOne` UI
(`ItineraryImport.tsx`, the `needsDayOne` block) asks for the one missing fact once.

**Fix:** drop `preferences` from `mode === "import"` `runParse` calls, or replace with
`"Preferences are context only. Do not add, drop or alter any item because of them."`

## 3.3 Parse article (`parseRecoList`)

**User thinks:** "Béa read this article and saved the places in it."

**Model receives:** `htmlToPlainText(html)` capped at 12k chars, with only
script/style/comment removal. Prompt: `"Do not invent places that are not in the
source. Do not look them up."` — correct instruction.

**Missing:** boilerplate removal, any signal about truncation, any city context.

**Where it goes wrong — and it's not the model:** the model behaves. It returns
`city: null` because the article didn't state one per item, exactly as instructed.
The *app* then takes that honest null and runs an unbounded worldwide geocode,
auto-selects hit #0, and saves it (§1.3). **The hallucination is in the client, not
the model.**

**AI actually knows:** what the (truncated) page says.
**AI is confidently guessing:** nothing — it is the geocoding layer that guesses.

## 3.4 Compare itineraries (`compareItineraries`)

**User thinks:** "Béa measured both plans and told me which is better."

**Model receives:** three calls. Two `runParse` extractions (`mode: "import"`,
`includeCosts: true`, currency forced to `homeCurrency`), then one `judgmentCall`
comparison over `formatPlanForCompare` output — **titles, kinds, dates and details
only. No coordinates. No distances. No prices from anywhere but itself.**

**The trust structure is inverted:**

| Row | Presented as | Actually |
|---|---|---|
| Estimated cost | summed by the app | **model-invented prices**, summed |
| Places visited | summed by the app | genuinely computed ✓ |
| Active hours / day | computed | **model's `durationHours` guesses**, divided by day count |
| Works in bad weather | computed % | **model's `indoor/outdoor/mixed` labels**, averaged |
| Walking / day | computed | permanently null (§2.4) |
| Transit / day | computed | permanently null |
| Longest single trip | computed | permanently null |

The footnote reads: *"Cost and stop counts are added up in the app. A blank row
means we could not measure it — never a guess."* Stop count is true. **Cost is
arithmetic performed on guesses, which is not the same as not guessing** — and
arithmetic on a guess looks far more authoritative than the guess did.

The prompt does one thing exactly right: *"Do not output walking kilometres, transit
minutes or longest-leg times — the app computes those only when it has
coordinates."* The model is correctly forbidden from guessing them. Then the app
can't compute them either, so the rows are just empty.

`reasoningText` behind "How Béa decided" is genuinely excellent — it is the most
honest AI surface in the product.

## 3.5 Recommendation extraction / place matching (`searchPlaces`)

`searchPlaces` (`places.functions.ts`) is the **best-reasoned function in the
codebase**. Every guard is deliberate and documented:
- `localPlaceHits` short-circuit for countries/cities.
- Bounded viewbox first, then worldwide — with a comment explaining why the bounded
  pass must return `[]` rather than a city centroid.
- `isVenueHit` preferred over streets/parks, with the "harvey → Rue Harvey" case
  written down.
- `extraTags` to recover a franchise `brand` name.
- Throws on 429/401/403 so "unreachable" ≠ "not found".
- Shared `Pace` across nearby and worldwide passes.

**The problem is entirely at the call sites.** `RecoListImport` calls it with no
`at`, and auto-selects hit 0 (§1.3). The function's careful "here are ranked
candidates" contract is consumed as "here is the answer."

## 3.6 Photo import

**Not an AI feature at all**, despite `BeaRunning moment="photos.working"` saying
*"Béa is revisiting old adventures… She recognises more of these than you would
think."* It is `readExif` (a hand-rolled JPEG EXIF parser) plus reverse geocoding.
No model is involved.

`readExif` (`src/lib/exif.ts`, `readExif`) returns `{}` unless `view.getUint16(0) === 0xffd8`
— **JPEG only**. HEIC and PNG yield nothing. The UI (`photos.tsx`, the numbered how-it-works list) states flatly:
*"Béa reads the location saved inside each photo and works out the city and country
on its own."* For a non-JPEG in `mode: "locations"`, the photo is skipped and
reported as having no location.

The personality line claiming recognition is the clearest voice/reality mismatch in
the app: it implies visual understanding where there is a byte-offset parser.

## 3.7 Optimize (`optimizeItinerary`)

**Best-guarded AI call in the product.** It receives ids, dates, times, kinds,
titles, addresses **and coordinates when present**, plus the city list with coords.
The handler then:
- Filters output to known ids, dedupes (`seen`).
- Re-locks `day_date`/`time_label` for `FIXED_KINDS` (flight/hotel/reservation/
  lodging) server-side, regardless of what the model said.
- Re-appends any dropped input at the end so nothing is lost.
- Renumbers `position` itself.

`GOAL_PROMPT.rainy` even says *"You do not have a weather forecast — do not invent
rain or sunshine."*

**Remaining gap:** ordering is still the model's spatial reasoning over lat/lon
text. No distance matrix is computed, no travel time validated. `"Closest together"`
— the default goal — is an LLM eyeballing coordinate pairs. The `reason` strings it
emits ("saves crossing the river twice") are plausible narration, not verification.

**AI actually knows:** the coordinates, when the rows have them.
**AI is confidently guessing:** that its ordering is actually shorter.

---

# 4. Trust Audit — every leak, in order of damage

| # | The leak | Where | Why it's a leak |
|---|---|---|---|
| 1 | Pins written silently with no confidence check | `TripDetail.tsx:151,211`; `TimelineEntryForm.tsx:239` | `scoreMatch` exists and is used on one path in four. Area centroids become venue pins, permanently, invisibly. |
| 2 | Stale placements survive a revision | `ItineraryImport.tsx:482` | Right name, wrong pin, high-confidence badge. |
| 3 | "From your vault" decided by substring | `vault-for-build.ts`, `tagVaultItems` | The badge carrying the product's whole premise is wrong both ways. |
| 4 | "Nothing nearby today" | `NearbyPlaces.tsx:293` + `near.ts`, `pinsWithin` | Unplaced pins are `NaN`-filtered out. Béa says she looked and found nothing; she couldn't look. |
| 5 | Compare cost/hours/indoor shown as measured | `ItineraryImport.tsx`, `METRIC_ROWS`, `itinerary-metrics.ts` | Model guesses, summed and tabulated under a "never a guess" footnote. |
| 6 | "Built around your preferences and tagged recs" | `ItineraryImport.tsx`, the `Sheet` `hint` prop | Shown even when zero vault items were loaded (no `tripCity`). |
| 7 | "Béa found 15 places" after silent truncation | `html-text.ts`, `htmlToPlainText`, `reco-list.ts`, `startRecoDrafts` | A checkable claim, stated confidently, wrong. |
| 8 | "Béa recognises more of these than you would think" | `bea-voice.ts` `photos.working` | Implies visual recognition; it is a JPEG EXIF parser. |
| 9 | "Consulting your vault, not the internet" | `bea-voice.ts` `choose.working` | `comparePlaces` sends to Gemini, which reasons from world knowledge. The vault is the *subject*, not the *source*. |
| 10 | "Same place — no walk" between distant venues | `directions.functions.ts:293` + `reuseKeyForStop` | A positive, specific claim produced by a cache collision. |
| 11 | "Drive · 452 km · 5 h 40" for a booked train | `directions.functions.ts`, the region-less retry in `buildRoutes` | Contradicts a fact the user supplied. |
| 12 | Street address replaced by city/state/country | `place-label.ts`, `formatPlaceLine` | A rec appears to have an address; it has a region. |
| 13 | Article-import top hit auto-selected as truth | `reco-list.ts`, `applySearchHits` | No confidence signal at all on this path. |
| 14 | Optimize's `reason` strings | `itinerary.functions.ts` | Reads as justification from analysis; is narration of an unverified reordering. |
| 15 | Help describes a Home that doesn't exist | `help-faq.ts:91` | Distrust at the surface reached when already confused. |
| 16 | Duplicate warning on a genuinely new place | `captured-place.ts`, `isSamePlace` | 120 m radius overrides differing names. |

**The pattern:** Béa is scrupulously honest about the thing she was accused of once
(booking — four prompts repeat it) and silent about everything she has never been
caught on. The honesty is *reactive* rather than systematic.

---

# 5. Data Flow Audit

## Trips
```
create (title/city/country/dates) → trips
  → TripDetail useEffect ① geocodePlanStops(stops)  ── evidence DISCARDED → trip_stops.lat/lon
  → TripDetail useEffect ② geocodePlanStops(rows)   ── evidence DISCARDED → itinerary_items.lat/lon
  → load(): order day_date ASC, position ASC → groupTimelineByDay → render
```
**Lost:** `label`/`category`/`kind` from every placement (§1.2). Once `lat`/`lon` are
non-null, `rowsToPlace` excludes the row forever — the guess is load-bearing and
unrevisitable.

**Re-inferred later:** `addressForStop` re-derives an address from `detail` prose on
every directions build, because the address was never stored.

## Recommendations
```
search/link/article → ParsedPlace{name,address,city,country,category,placeType,lat,lon,source,url}
  → capturedFromParsedPlace → toNewReco → recommendations
  → recoAsPin: lat: row.lat ?? NaN
  → pinsWithin / scoreOpportunity / vaultPrompt
```
**Flattened:** `address` is already city/state/country, not a street (§2.3).
**Lost:** `placeType` (Nominatim's `cafe`/`museum`) is carried in `CapturedPlace` and
used by `timelineKindForPlace` for a timeline entry — but `toNewReco` **drops it**.
`recommendations` stores only the prettified `category`, so the kind must be
re-guessed later from `reco-tags.ts` regexes.
**Corrupted:** `NaN` as "unknown location" means every downstream comparison
fails closed and silently (§1.7).

## Imported itineraries
```
photo/text → parseItinerary → ParsedItinerary{items[], costs[], dates}
  → placements (INDEX-KEYED, survives revision) ─────────┐
  → resolveDayDates(items, planStart)                    │
  → addChosen: merges placements[i] ←────────────────────┘  ⚠ §1.1
      detail = [detail, `Est. ${cost} ${cur}`].join(" · ")   ⚠ number → prose
  → itinerary_items
```
**Flattened:** the estimated cost becomes a **string inside `detail`**. It is
simultaneously written to `trip_budget_items` via `onAddCosts`, so the same number
lives in two places, one of them uneditable and unsummable.
**Lost:** `day_number` after `resolveDayDates`; `source: "vault"` is never persisted,
so "From your vault" exists only in the review sheet and is gone the moment it saves.
`summary` — Béa's one warm sentence about the plan — is never stored either.

## AI outputs
| Output | Persisted? |
|---|---|
| `parsed.summary` | ✗ toast only |
| `parsed.trip_title` | ✗ unless `onApplyDates` |
| `item.source` ("vault"/"new") | ✗ |
| `placements[].confidence/reason/label` | ✗ |
| `optimize.summary` / `.changes` / per-item `.reason` | ✗ |
| `comparison.*` (whole comparison) | ✗ — component state only |
| `reasoningText` | ✗ |

**A user cannot revisit a comparison they ran, or see why a stop moved, or find
out where a pin came from.** Every explanation Béa produces is discarded at
unmount. For a product whose thesis is *memory*, this is the deepest structural
gap in the app.

---

# 6. Place Intelligence Audit

## Where correct places become wrong pins — four concrete walkthroughs

**(a) The timeline centroid.** Trip city "Kyoto". A row titled "Dinner at a small
izakaya in Gion". `TripDetail.tsx:211` → `planStopQueries` →
`placeQueryCandidates("Dinner at a small izakaya in Gion")` → the `/\b(at|in|to|
around|near)\s+(.+)$/` branch yields `"a small izakaya in Gion"`, then
`"Gion"` via `stripTail`/`stripVerb` variants → query `"Gion, Kyoto"` → Nominatim
returns Gion, `type: "suburb"`. `scoreMatch` would return
`low: "This looks like a whole area rather than the place itself."` **It is never
called.** The pin is written. Done.

**(b) The chain branch.** Article import, item `"Sushiro"`, `city: null`. Query is
the bare name, no `at`, worldwide. `nominatimVariants` prefers `isVenueHit`, so it
returns *a* Sushiro — one of ~600, likely whichever OSM ranks highest.
`applySearchHits` sets `chosen: 0`. Saved. The vault now contains "Sushiro" at a
branch in a prefecture the user will never visit.

**(c) The cache collision.** §2.1. Two "Lunch" rows in Rome share one pin;
`placedFromLegs` writes it back onto both rows. Two timeline entries are now
permanently co-located, and `isSamePlace` will subsequently call them duplicates.

**(d) The one that works.** Paste a Google Maps link with no coordinates for
"Harvey's". `parsePlaceLink` → `queryIsLocatable({name: "Harvey's", address:
undefined})` → **false** → no lookup → returns `unlocated: true` → the UI says the
name is right but the map is empty. **This is correct behaviour and the app should
do it everywhere.**

## Neighbourhood centroids specifically

Three mechanisms *should* prevent them, and each has a hole:

1. `placeQueryCandidates` ordering — "only something genuinely more precise than the
   name outranks the name." Correct, but `looksLikeStreetAddress` can never fire on
   a stored address, because `formatPlaceLine` never produces one (§2.3).
2. `nominatimVariants` bounded-pass returning `[]` on non-venue hits. Applies only
   to `searchPlaces`; `geocodePlanStops` has no equivalent and takes `limit: 1`
   unconditionally.
3. `scoreMatch`'s `AREA_TYPES`. Used on one of four call sites.

## Ambiguous name handling

Genuinely sophisticated where it exists: `refineNominatimHits` →
`isAdminRegion` (drops admin blobs unless the query asked for one) →
`rankScore` (importance + locality-type bonus + prefix match + `queryMentionsHit`)
→ `dedupeNearDuplicates` (50 km, same locality+country+admin) →
`dropFarCollisions` (same name, different country, importance gap ≥ 0.12 or
city-beats-village). `fuzzyRank` then re-ranks by query similarity.

All of this runs in `searchPlaces` only. `geocodePlanStops` and `buildRoutes` both
call their own bare `geocode()` with `limit: 1` and take `json[0]`.

## Place confidence handling

`match-confidence.ts` is well-built — three tiers, `nameEchoes` with a `NOISE` stop
list, CJK/Hangul-aware `meaningfulWords` splitting, and the deliberate choice to
stay quiet on `high`. It is wired to **25% of the places that get pinned**, is never
persisted, and never appears on a saved row.

## Summary table

| System | Quality | Wired everywhere? |
|---|---|---|
| Forward geocoding (`searchPlaces`) | Excellent | ✗ — 1 of 3 geocoders |
| Forward geocoding (`geocodePlanStops`) | Anchored but unverified | — |
| Forward geocoding (`buildRoutes.geocode`) | Unverified, unanchored fallback | — |
| Reverse geocoding | Good key fallback chain | ✗ — unpaced in photo import |
| Trust gate (`geocode-trust`) | Correct | ✗ — `parsePlaceLink` only |
| Confidence (`match-confidence`) | Correct | ✗ — `ItineraryImport` only |
| Duplicate detection | Good names, weak geometry | ✗ — not in `quickSave` |
| Clustering | **Does not exist** | — |
| Directions | Solid OSRM handling | Mode chosen by straight line |

**Clustering** deserves its own line: `OPTIMIZE_GOALS.closest` is labelled "Same-day
clusters, less backtracking" and there is **no clustering code anywhere in `src/`**.
The coordinates are printed into a prompt and the model is asked to think about them.

---

# 7. Travel Reality Audit

Planning a real 5-day Rome trip through this app:

**Opening hours are never considered — and the data is already being fetched.**
`nominatim()` requests `extraTags: true` (`places.functions.ts`), which makes
Nominatim return OSM's `opening_hours`. `placeFromNominatim` reads exactly one
extratag: `brand`. `opening_hours` is discarded. Nothing anywhere in `src/`
references opening hours. So Béa will cheerfully put the Galleria Borghese on a
Monday, a market at 6 pm, and a bakery at 4 pm — and the build prompt says *"Use
realistic opening patterns"*, which asks a model to simulate the data sitting
unused in the response.

**Distance is claimed without being computed — and computed without being claimed.**
Two opposite failures in one product:
- `directionDetail` prints `"Walk · 1.2 km · 15 min"` from a real OSRM route ✓ —
  but between endpoints that may be cache collisions (§2.1) or centroids (§1.2).
- Compare's "Walking / day" is permanently blank (§2.4) even though the pins could
  be fetched.

**Route optimisation is naive in a specific, checkable way.** `optimizeItinerary`
prints `lat,lon` into a prompt. No distance matrix, no TSP, no nearest-neighbour,
no validation that the output is shorter than the input. The app will not notice
if the "optimised" order is worse. `haversine` exists in `src/lib/geo.ts` and is
used four times, never here.

**Physically impossible plans are reachable.**
- `FIXED_KINDS` locks flights and hotels during optimize ✓ — but nothing locks the
  *gap* around them. A 06:00 flight can have a 04:30 museum before it.
- No minimum transfer time between stops. `"Avoid impossible transfers and leave
  breathing room"` is prompt text, unvalidated.
- `resolveDayDates` will place `day_number: 9` nine days from the start on a
  6-day trip. `lastDayDate` then extends `end_date` to match — the trip silently
  grows to fit the plan.
- Multi-city trips: `optimizeItinerary` receives the city list with `arrive_on`/
  `depart_on`, but nothing prevents it moving a Kyoto stop to a day the traveller
  is in Tokyo. The prompt doesn't even mention the constraint.

**Timelines become unrealistic at a predictable point.** Days 1–2 of a build look
excellent — recognisable anchors, plausible spacing. By day 4 the model is
generating filler ("explore the neighbourhood", "coffee somewhere local"), which
then fails to geocode, lands as a centroid, and pollutes the map.

**What a real traveller would hit on day one:** open the trip on the plane with no
signal. Offline directions exist (`useOfflineDirections`, localStorage, with a
`directionsSignature` staleness check — genuinely good). But the timeline itself
loads from Supabase, and `load()` on error just `return`s. The first render has
`items: []`. On a plane, the trip is blank.

---

# 8. Personality Audit

## Where Béa is a companion

- `BeaRunning` (`src/components/BeaRunning.tsx`). Running dog, dust motes, a pin
  landing beside her, 19 rotating lines, a **real** progress count and a real time
  estimate. "Please be patient. Béa is running as fast as she can. She has little
  legs." This is a character doing a job you can see, during a wait that genuinely
  takes 30 seconds. It is the best thing in the product.
- `plan.locating`'s scout voice ("Béa is checking one more side street…") is
  *literally true* — it is one Nominatim lookup per second. Personality and
  mechanism agree.
- The refusal copy: "Béa drafts a plan. She does not book hotels, restaurants or
  tickets, and she cannot check whether a table or room is actually free."
  Honest AI mode, well written, in the right place.

## Where Béa disappears

Béa is **absent from every destination and present only in transit.** She narrates
the wait, then vanishes the instant there is something to say.

- The parsed itinerary list: 20 rows, checkboxes, badges. No Béa.
- The timeline, the map, the trip page: no voice at all.
- The vault: `beaLine("empty.recs")` only when empty; a full vault is silent.
- Search results, `PlacementNote`, the duplicate warning: neutral system copy.
- `Near` after the first card: a list.

`scoreMatch` produces `reason: "This looks like a whole area rather than the place
itself."` — a *perfect* Béa line, written in the app's system voice, and only
reachable on one screen.

## Where the UI talks *about* Béa vs. where she participates

| Surface | Talks about | Participates |
|---|---|---|
| "Let Béa plan this trip" (sheet title) | ✓ | |
| "Ask Béa to find alternatives" | ✓ | |
| "Béa is rearranging…" | ✓ | |
| "Béa would pick Plan A." | | ✓ |
| `BeaRunning` | | ✓ |
| Toasts (`recs.saved`, `plan.complete`) | | ✓ (once per day) |
| Timeline, map, vault, search, prep, packing, expenses | | — |

She is a **label on buttons** far more than a voice in the product.

## First-person vs third-person

Inconsistent by surface, and the inconsistency is unowned:
- Third person dominates: *"Béa has opinions."*, *"Béa is thinking."*
- First person exists: `BEA_TAGLINES.companion` = *"I remember travel things so you
  don't have to."* — and it is **never rendered anywhere** (grep: only
  `bea-voice.ts` and tests).
- Second-person-as-Béa: *"Past You would like a word."* — Béa speaking *as* the
  user's past self. A third distinct register.
- `BEA_SIGNATURE.planning` = *"Professionally assembled from your own excellent
  ideas."* — no subject at all.

Four registers, no rule. The strongest of them (first person) is dead code.

## Unused personality systems and dead metadata

| Asset | Status |
|---|---|
| `BeaLine.mode` (`companion`/`archivist`/`scout`/`planner`/`honest`/`curator`) | **Dead.** Every line carries one. The only consumer is `bea-voice.test.ts:36` asserting it is non-empty. |
| `nearCardLine(metres)` | **Dead.** Exported, distance-aware ("You're 180 m from something Past You cared about") — the single best personality line in the app. **Zero call sites.** |
| `BEA_TAGLINES.companion` / `.personality` / `.futureYou` / `.travelLife` | Unused |
| `BEA_SIGNATURE.playback` ("Let's rewind the adventure.") | Unused — its page is unreachable (§9.1) |
| `choose.working` pool | Used once (`ComparePins.tsx:154`) |
| `empty.trips` pool | Two near-identical entries; with day-rotation, effectively one line |
| `beaLine` rotation itself | Effectively disabled (§1.6) |

## How users actually experience Béa

Two Béas, and users meet the wrong one most:

1. **The loading-screen dog.** Charming, specific, memorable. Appears for 30 seconds
   during a plan, then leaves.
2. **The button prefix.** "Ask Béa to…", "Let Béa…". A brand name on a form.

The `mode` taxonomy, the signatures, the first-person voice and the distance-aware
scout line all describe a *third* Béa — a companion woven through the product — that
exists in `bea-voice.ts` and nowhere else. **The personality system is more complete
than the personality.**

---

# 9. Hidden Feature Audit

| Feature | Where it lives | How you find it | Realistic discovery |
|---|---|---|---|
| **Travel story / playback** (`/story`, 265 lines) | `_authenticated/story.tsx` | **Nowhere.** Zero inbound `<Link to="/story">` in `src/`. Only `PageGuide.tsx:309` has an entry for a page you cannot reach. `help-faq.ts:87` says it's "on Home"; it isn't. | **~0%** |
| **Compare two itineraries** | `ItineraryImport` tab 3 | Unlabeled 36px logo icon → third tab | **<15%** |
| **Build vs Import mode** | `ItineraryImport.tsx`, the build/import mode cards | Two cards, `build` preselected. `pastedPlanNote` (`wrongMode`) catches the mistake live — genuinely excellent recovery | 80% *after* the rescue fires |
| **Day trip from Near** | `DayTripFromNear.tsx` | Tick ≥2 pins in the Near list, then a button appears | ~20% |
| **Customize home** | `profile.tsx:265` | You → a "row" entry among many | ~25% |
| **City memories** (`/memories`) | — | Only from `photos.tsx:407` | ~20% |
| **Calendar** (`/calendar`) | — | Only from `/trips:85` | ~40% |
| **Expenses** (`/expenses`) | — | `TripBudget.tsx:171`, `profile.tsx:418` | ~45% |
| **Travel preferences** (`/preferences`) | — | `profile.tsx:250` | ~50%, and it is the input to every AI feature |
| **Optimize** | `TripDetail.tsx:539` | Text action, but only at ≥2 timeline items | ~55% |
| **Document vault**, **Packing lists**, **Trip todos**, **Share recs** | Trip sub-sections | Behind collapsible sections | 30–50% |
| **Sample data** | `index.tsx`, the sample-data prompt / profile | Only when the account is *completely* empty and not dismissed | — |
| **Tour / Deep Dive** | `Tour.tsx` | You → Replay | ~20% |

**Pattern:** the navigation is five tabs; thirteen routes live outside it and are
reachable only from inside a specific page. `tab-bar.ts`'s own comment acknowledges
this ("Fifteen of Béa's routes are reached from inside a tab"). The result is that
roughly **half the built product is invisible**, including one whole page with no
door at all.

---

# 10. Product-Moat Audit

| Feature | Verdict | Why |
|---|---|---|
| **AI itinerary generation** | **Commodity** | ChatGPT does this free, better, conversationally. Béa's version has fewer knobs and can't iterate in dialogue. The *only* differentiation is vault-grounding (§3.1), which is capped at 8 places and often zero. |
| **Itinerary comparison** | **Potential moat — the strongest thing here** | Nobody else does this. "I have a ChatGPT plan and a friend's plan, which is better?" is a real, frequent, unserved job. The structure — parse both → compute what's computable → commit to a pick → name what to borrow → show reasoning — is genuinely novel. It is undermined by three dead metric rows, AI-guessed costs presented as computed, and being buried behind an unlabeled icon. **Fix those three things and this is the product.** |
| **Article parsing** | **Differentiated → commodity** | The job (blog post → structured saved places) is real and underserved. The extraction is fine. But the place-matching that makes it *valuable* is the weakest path in the app (§1.3). Without trustworthy matching it is a list of names, which a screenshot also is. |
| **Photo memories** | **Commodity** | Google Photos and Apple Photos do this natively, better, with no import. The one differentiated angle — **"locations only, don't keep my photos"** — is a genuinely distinctive privacy position and is buried as the second of two radio cards. |
| **Taste matching** (`scoreOpportunity`) | **Differentiated** | Multi-factor, explainable (`reasons[]`), and the **dormancy term is the real insight**: "Saved 2 years ago, never visited" is a scoring dimension nobody else has, and it is the literal expression of Past You → Future You. Currently it only surfaces inside `vaultPrompt` and the Near sort — never as a feature in its own right. |
| **Recommendation vault** | **Moat — but only with the rest fixed** | The durable asset. Nobody else holds "places my friends told me about, with who said it and why." `recommended_by` + `notes` + `travel_tags` + `created_at` is a dataset that compounds and cannot be cloned. Everything above is a *feature*; this is the *business*. It is currently degraded by duplicates (§1.5), wrong pins (§1.3), missing coordinates (§1.7) and useless addresses (§2.3). |
| **Near / proximity surfacing** | **Potential moat** | "You're 180 m from something Past You cared about" is the single most emotionally distinctive moment the product can create. It requires correct coordinates on saved places, which is exactly what §1.2/§1.3/§1.7 break. `nearCardLine` — the line written for this moment — is dead code. |
| **Offline directions** | **Differentiated** | `directionsSignature` staleness detection, real storage-failure messaging, honest "Open in maps for this stretch" fallbacks. Well built, quietly valuable, invisible. |
| **Trip collaboration** (realtime presence, invites) | **Commodity** | Table stakes. `private: true` presence gating is correctly done. |

**What is actually unique:** *a vault of places real people recommended to you, which
resurfaces when you're near them or planning a trip that includes them.* That is one
sentence and it is defensible. Everything in the AI tier is commodity **except
Compare**, which is unique and buried.

---

# Top 10 Most Important Problems

Ranked by impact × frequency × trust damage.

| # | Problem | § | Sev | Why it ranks here |
|---|---|---|---|---|
| **1** | Stale placements survive a revision — right name, wrong pin, confident badge | 1.1 | Critical | Fires on the *improvement* path. Worst possible failure mode: confidently wrong, invisible until you're standing there. |
| **2** | Three of four geocoding paths write pins with no confidence check | 1.2 | Critical | Highest volume. Every typed entry, every planned stop. Permanent and unrevisitable once written. |
| **3** | Article import auto-saves the top worldwide hit | 1.3 | Critical | Re-creates the Harvey's bug in the highest-volume import path, with the right name masking the wrong pin. |
| **4** | Compare's walking/transit/leg rows are permanently dead, costs are guesses shown as computed | 2.4, 3.4 | High | Cripples the only genuine moat, and the FAQ makes a false claim about it. |
| **5** | Street addresses discarded by `formatPlaceLine` | 2.3 | High | One function; breaks three downstream safety mechanisms and every displayed address. |
| **6** | The entire AI product is behind one unlabeled 36px circle | 1.4 | High | Everything built above is worth zero to a user who never finds it. |
| **7** | "Nothing nearby" said over `NaN`-filtered pins | 1.7 | High | Kills the product's most distinctive emotional moment, silently, in Béa's own voice. |
| **8** | `buildRoutes` reuses one pin per title; writes it back to the timeline | 2.1 | High | Fabricates "Same place — no walk", then persists the corruption. |
| **9** | `quickSave` skips duplicate detection | 1.5 | High | The primary add path degrades the core asset on every use. |
| **10** | Béa says the same line all day; her best lines are dead code | 1.6, §8 | Medium | The differentiator is a three-line bug away from working. `nearCardLine` has zero call sites. |

---

# If I Had One Week

Ten changes. Every one is Small or Small-Medium; together they close the top of the
trust list and switch the personality on.

1. **Clear `placements` in `applyRevision`.** (`ItineraryImport.tsx:482`) Three lines.
   Kills the worst bug in the app. *(§1.1)*
2. **Return `confidence`/`reason` from `geocodePlanStops`, and refuse to auto-write
   `low`.** One server change covers all four call sites. *(§1.2)*
3. **Gate `chosen: 0` on `geocodeIsTrustworthy` in `applySearchHits`; pass `at` to
   `searchPlaces` from `RecoListImport`.** *(§1.3)*
4. **Fix `reuseKeyForStop` to include `stop.id ?? day_date`.** Ends the
   "Same place — no walk" fabrication. *(§2.1)*
5. **Prepend `house_number + road` in `formatPlaceLine`.** Unlocks three other
   safety mechanisms for free. *(§2.3)*
6. **Delete the three unmeasurable Compare rows and correct `help-faq.ts:124`** —
   until 2.4(a) lands, four honest rows beat seven with three permanent blanks.
   Relabel "Estimated cost" as "Béa's estimate" and fix the footnote. *(§2.4, §3.4)*
7. **Per-session rotation in `beaLine`.** Module-level cursor. The writing already
   exists; three lines make it land. *(§1.6)*
8. **Wire `nearCardLine` into the Near card, and count unplaced pins in the empty
   state.** Two of the product's best moments, currently dead. *(§1.7, §8)*
9. **Duplicate check in `quickSave`** with an "Open it?" / "Save anyway" toast.
   *(§1.5)*
10. **Label the planner.** On an empty trip, a text card instead of the icon row; a
    second door to Compare from `/trips`. *(§1.4)*

---

# If I Had One Month

The ten above, plus:

11. **Persist match evidence.** `location_confidence`, `location_label`,
    `located_at` on `itinerary_items` and `recommendations`. A badge on any row Béa
    guessed at, tappable to fix. Turns an invisible guess into a visible, repairable
    one. *(§4, §5)*
12. **Geocode both sides of Compare**, then `buildRoutes` for real transit minutes.
    Makes the moat defensible instead of aspirational. *(§2.4a)*
13. **Read `opening_hours` from `extratags`** — already in the response — store it,
    and warn on the timeline when a stop is scheduled while closed. First feature in
    this product that no generic chatbot can do. *(§7)*
14. **Real clustering for `closest`.** Greedy nearest-neighbour + 2-opt on the
    coordinates, computed in `src/lib/`, with the model only writing the prose. Then
    Optimize can *prove* the new order is shorter. *(§6, §7)*
15. **Multi-city and travel-mode correctness.** Pass city date-windows into the
    optimize prompt as hard constraints and validate server-side; choose leg mode
    from `kind`, not straight-line distance. *(§2.7, §7)*
16. **Fix `tagVaultItems` to use `comparableName`, persist `source: "vault"`** as a
    column, and show "From your vault" on the saved timeline, not just the review
    sheet. *(§2.5, §5)*
17. **Paced, server-side batch reverse-geocoding for photo import**, modelled on
    `geocodePlanStops`'s `throttled` handling. Report non-JPEG files honestly.
    *(§2.10, §3.6)*
18. **Store comparisons and optimize rationales.** A `trip_decisions` table holding
    the comparison, the pick, and `reasoningText`. Béa's memory should include her
    own reasoning — this is the thesis of the product applied to itself. *(§5)*
19. **Widen and report the vault context.** Raise `vaultPrompt`'s limit past 8; query
    by every city on the trip, not just `trip.city`; and say on screen *"Béa used 12
    of your 47 saved Tokyo places"* with a list. Turns an invisible claim into a
    visible feature. *(§3.1, §4)*
20. **Boilerplate extraction + truncation notice** for article import; raise
    `RECO_LIST_MAX` and report when it clips. *(§2.9)*
21. **Give `/story` a door**, or delete it. Same audit for `/memories` and
    `/calendar`. Add a test asserting every route has an inbound link and every
    feature named in `help-faq.ts` resolves. *(§9)*
22. **Pick one voice.** First person ("I remember travel things so you don't have
    to") is the strongest register and is currently dead code. Make `BeaLine.mode`
    do real work — `honest` mode renders differently from `companion`. *(§8)*
23. **Surface dormancy as a feature.** "Saved 2 years ago, never visited" is the most
    original idea in `scoreOpportunity` and only exists inside a prompt. It deserves
    its own Home section. *(§10)*
24. **Confidence-aware Near.** Exclude `low`-confidence pins from proximity alerts
    entirely — a nudge fired from a centroid is worse than no nudge. *(§4)*
25. **Offline-first timeline read.** Cache `itinerary_items` in localStorage beside
    the already-excellent offline directions. The trip page should not be blank on a
    plane. *(§7)*
26. **Historical FX rates** by `spent_on`, cached by date. *(§2.8)*
27. **Fix `planDayTrip`'s kind vocabulary** to `TIMELINE_KINDS`. One line. *(§2.2)*
28. **Require name corroboration in `isSamePlace`** below ~40 m. *(§2.6)*
29. **Remove `preferencePrompt` from import-mode parsing.** *(§3.2)*
30. **Per-item import diff.** Show the user what Béa read vs. what the source said,
    so quiet omission stops being undetectable. *(§3.2)*

---

# What Béa Could Become

## The thing that is already true

Béa is not an AI travel planner, and the codebase knows it —
`docs/WHAT_BEA_BELIEVES.md` and `AGENTS.md` both say so explicitly. The architecture
already encodes a better idea than the interface expresses:

**Past You captures → Present You decides → Future You benefits.**

Every durable asset in the schema serves it. `recommendations.recommended_by` — who
told you. `.notes` — why they said it. `.created_at` — when you cared.
`future_notes` — a message to yourself, filed by city. `photo_memories` — where you
actually went. `travel_tags` — what you're like. `scoreOpportunity`'s dormancy term
— *"Saved 2 years ago, never visited."*

No general-purpose model has any of this. No competitor can acquire it. It compounds
with use and it is worthless to anyone but its owner. **That is the moat, and it is
already built.**

## The strongest version of this product

**Béa is the memory layer between you and every travel tool you already use.**

She doesn't compete with ChatGPT for plan generation — that fight is lost and wasn't
worth having. She does the four things a chatbot structurally cannot:

1. **She remembers.** Not a session — years. The friend who recommended the bar in
   Lisbon in 2024 is still attached to it in 2027. This is `recommendations` plus
   ruthless place-matching discipline.

2. **She judges other people's plans.** This is Compare, and it is the sharpest
   unclaimed position in travel software. Everyone now arrives with two or three
   candidate itineraries — one from an LLM, one from a friend, one from a blog — and
   nobody helps them choose. Béa parses both, **computes what is computable and
   refuses to guess the rest**, weighs them against your actual saved tastes, and
   commits to a pick with the reasoning shown. The honest-blank discipline already
   in `METRIC_ROWS` and `computeItineraryMetrics` is the right instinct; it just
   needs the pins so the blanks fill in. *"Béa is the second opinion on your AI's
   travel plan"* is a sentence no competitor can currently say.

3. **She surfaces at the right moment.** "You're 180 m from something Past You cared
   about" is the emotional core. Everything else is infrastructure for this
   sentence. `nearCardLine` is already written and has zero call sites — that is the
   whole audit in one fact.

4. **She is honest about what she knows.** This codebase has an unusual instinct for
   it: `geocode-trust.ts`, `match-confidence.ts`, `"Not measured — Need a map pin on
   every stop"`, `"You do not have a weather forecast — do not invent rain"`,
   `"Silently inventing a location is worse than having none"`. In a market where
   every product is racing to sound more confident, **calibrated honesty is a
   differentiator, not a limitation.** The gap is that honesty is currently applied
   where a bug was once found, not systematically. Make it a rule — *no pin, no
   number and no claim reaches the user without a confidence it can state* — and Béa
   becomes the travel tool people trust precisely because she says "I'm not sure
   about this one."

## What has to change to get there

The technical debt is not architectural. The architecture is right. The debt is
**a set of good ideas implemented once and not propagated**:

- `geocode-trust` exists on one of three paths.
- `match-confidence` exists on one of four call sites.
- The rate-limit pacing exists on three of four geocoders.
- The personality rotation exists in one of fourteen call sites.
- The best line in the voice system has zero call sites.
- The best feature in the product has one unlabeled door.

None of that requires a rewrite. It requires taking each mechanism that was built
correctly once and finishing the job — which is what the one-week and one-month
lists above are.

## The one-line version

> **Béa remembers where you wanted to go, tells you honestly when she isn't sure,
> and taps you on the shoulder when you're standing next to it.**

The vault, the confidence system and the proximity nudge are all already in the
repository. Connecting them is a month of work, not a pivot.
