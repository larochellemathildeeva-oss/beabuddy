# UI port — handoff

Branch `UIREMAKE`, based on `main`. Rebuilding the trip experience around a
**day**, from a prototype the owner built in Google AI Studio.

Read this instead of re-deriving the context. It is the whole brief.

## The decision that shapes everything

**The owner's brief is a merge: everything the trip page already does, plus
the prototype's new features, on one page.** Nothing existing is left out.

This reverses an earlier call in this doc. The port first grew as a separate
screen at `/trips/$tripId/day` beside the trip page, on the reasoning that
porting piece by piece into `TripDetail` lets the old style absorb the new
composition. That screen never had the old page's functions (editing, adding
stops, Plan with Béa, directions, undo), and the owner had not asked for a
second screen. It was removed on 2026-09-24.

Now `TripDetail` (`/trips/$tripId`) carries the four tabs — **Now · Map ·
Day · Trip** — under its banner and action row, and every existing section
sits under one of them:

| Tab | What is in it |
| --- | --- |
| Always visible | banner, action row (Plan with Béa: import / optimize / compare, add a stop, before you go, settings), who else is here |
| Now | `TripToday`, `JourneyTracker`, `DayRibbon`, `NowPanel` |
| Map | `DayMapView` (day map + cards), `TripMap` (whole trip) |
| Day | the whole "Your itinerary" section, unchanged: add, edit mode, reorder, day / time / stay pickers, By day / All entries, directions, nearby-stop runs, the now line, undo, keep to vault |
| Trip | `TripStops`, To do, Packing, budget, `TripPeople`, trip details |
| Settings sheet | unchanged, including offline directions and packing templates |

Day and Trip stay mounted behind `hidden` so edits survive a tab switch and
the action row can open their forms from anywhere; Map mounts only while
shown, because Leaflet cannot lay out in a hidden box.

**Before building anything else, check scope with the owner.** The costliest
mistake in this port was deciding scope from this doc instead of asking.

## Built

| | |
| --- | --- |
| `src/lib/trip-days.ts` (+test) | day chips, default choice, filtering |
| `src/components/DaySelector.tsx` | the chip strip |
| `src/lib/trip-perspective.ts` (+test) | the four perspectives |
| `src/components/day/StopCard.tsx` | collapsed stop card; selectable on the Map view |
| `src/lib/day-map.ts` (+test) | pin numbering, partial-map caption, selection |
| `src/components/day/DayMap.tsx` | the Leaflet day map |
| `src/lib/companion.ts` (+test) | Now: progress, up next, leave by, writes |
| `src/components/day/NowPanel.tsx` | the Now view |
| `src/lib/planned-stay.ts` (+test) | planned-stay choices and labels |
| `src/components/day/JourneyTracker.tsx` | the prototype's live journey tracker |
| `src/components/day/DayRibbon.tsx` | the prototype's itinerary ribbon, with part-of-day filters |
| `src/components/day/DayMapView.tsx` | the day map with its cards |
| `src/components/TripDetail.tsx` | the trip page, now with the four tabs |


**Four perspectives: Now · Map · Day · Trip**, all on the trip page. Trip is
a *peer* of the day views on purpose: the prototype had no place for
stops, prep, packing, budget or people, and dropping them would lose more
than the redesign gains.

## Still to build from the prototype

Not started, in the order proposed to the owner (confirm before building):
Day-tab restyle with transit cards between stops, "+ Add stop between",
swipe to complete / delete with undo, Customize (three toggles), saved
places drawer, the A/B/C plan comparison. See the spec table on the
progress page for the full list.

## Next, in order

1. ~~**Leaflet day map.**~~ Done — see "Day map" below.
2. ~~**Migration.**~~ Done and **applied to the live project** (2026-09-24) —
   see "Stop progress (step 2)" below.
3. ~~**Now (companion).**~~ Done — see "Now (step 3)" below.
4. **Trip tab** — first pass done; see "Trip (step 4)" below for what is
   still to move.

## Day map (step 1)

- **Tiles come through Béa's `/api/tile` proxy, not CartoDB Voyager.** The
  prototype loads Voyager straight from the browser. The repo already proxies
  tiles for the Near map (`tile-proxy.ts`): the LocationIQ token stays on the
  server, and the device contacts no new third party, which keeps the privacy
  page true. The cost is Voyager's warmer styling. Switching would mean
  adding CARTO to the privacy page and its attribution to the map.
- **Pins carry the card's number, counted before unplaced stops are
  dropped**, so card 3 is always pin 3. With all days shown, numbering runs
  straight through so two pins never both say "1".
- One selection drives both halves: tap a card or a pin; tap again to clear.
  A pin tap scrolls its card into view only if it is off screen.
- `tripMapPlan` decides the empty state, `legLabels` places the distances
  (re-placed on every zoom, since it works in screen pixels), and
  `OSM_ATTRIBUTION` sits under the map beside Leaflet's own tile credit.
- Leaflet is imported inside an effect; it never runs on the server.
- **`TripMap` is kept**: under the day map on the Map tab (the whole trip,
  city to city) and as the trip card backdrop, where an offline SVG with no
  requests suits better than tiles.

## Stop progress (step 2)

`supabase/migrations/20260924120000_itinerary_stop_progress.sql` adds
`arrived_at`, `left_at` (timestamptz) and `planned_stay_minutes` (integer) to
`itinerary_items`, all nullable. **Applied by hand to the live project on
2026-09-24**, along with `20260924130000_grant_trip_invite_attempts.sql`
(both reported successful by the owner). It is safe
to re-run, and carries its own undo block. Checked against a scratch Postgres
16: idempotent, existing rows untouched, constraints refuse what they should.

To see whether it has been applied:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'itinerary_items'
  and column_name in ('arrived_at', 'left_at', 'planned_stay_minutes');
```

What step 3 has to respect:

- **The columns exist live, so they can go in the itinerary `select` in
  `useTrips.ts`** and on `ItineraryRow`. Be aware of how that query fails: it
  names its columns and, on any error, keeps what it had. On a database that
  lacks the migration, every trip would load empty. Live has it now and any
  rebuild from this folder includes it, but that is why the migration has to
  run before the code that reads it reaches `main`.
- **Constraints:** `left_at` needs `arrived_at` and must not precede it;
  `planned_stay_minutes` is 1–44640. So "undo arrival" clears `left_at` in the
  same update, or the database refuses it.
- **Progress is per stop, not per person.** Every member sees the same
  arrived / left state, under the existing "Members manage itinerary" policy.
  Right for a group travelling together; wrong if they split up for a day. No
  per-person table until that is shown to matter.
- The types in `src/integrations/supabase/types.ts` were extended by hand to
  match — regenerate them when there is a connection to the project.

## Now (step 3)

- **Manual progression.** "I'm here" sets `arrived_at`; "Leaving" sets
  `left_at`. Arriving somewhere closes any stop still open. "Not here yet"
  clears both columns together, and "Still there" clears `left_at`. The pure
  rules live in `companion.ts`; the writes go through `useTripBoard`'s
  `setProgress`, which reloads once at the end.
- **Up next is after the furthest stop reached**, so a skipped stop is
  behind you rather than offered again.
- **Leave by** = next stop's clock time minus the saved leg's duration,
  rounded early. The leg comes from directions saved on this phone when
  their signature still matches the timeline's direction stops (a saved leg
  exists only between consecutive stops). Otherwise Now routes that one
  journey itself through `buildRoutes` — **only when both ends are on the
  map**, never by name — once per journey per session, cached by both stops
  and their coordinates. It is not shown for a capped leg, an unplaced end, a
  zero duration or failed route, or a next stop with no clock time ("Lunch").
  When an end is off the map it says which and where to fix it. The same spot
  at both ends shows "no need to move".
- **Which day:** the day picked, or today when "All days" is showing. With
  neither, it asks for a day.
- **Planned stay** is set two ways: "Plan to stay" on the "You're at" card,
  and "Stay" beside Day and Time in the Day tab's edit mode. Both
  are pick-lists (`planned-stay.ts`) that cannot produce a value the database
  refuses, and keep an odd value already on a row.
- Walk / Drive rows from saved directions are the journey, not stops, and are
  left out — the same filter the directions use, so leg indexes line up.

## Trip (step 4)

"Bucket D" was the trip-wide material: everything that belongs to the trip
rather than to a day. The first pass renders the **existing components**,
not copies. (Written when there were two pages; since the merge there is
one, and the settings sheet still offers the same controls.)

| On the Trip tab | Component |
| --- | --- |
| Stops and cities | `TripStops` |
| To do | `TripTodosBody` (was only inside `TripPrep`'s sheet) |
| Packing | `PackingBody` (same) |
| People and invites | `TripPeople` — extracted from `TripDetail`'s settings sheet, with its leave / remove confirmations; both pages now render it |
| Budget | `TripBudget`, when `budget_enabled`; otherwise a line pointing at the switch |
| Trip details | `TripDetailsForm`, `TripBudgetSwitch`, `TripDeleteButton` (`TripSettings.tsx`), extracted from the settings sheet |

Each hook instance opens its own realtime channel (`…:${channelId}`), so the
Trip tab and the settings sheet rendering the same component do not
collide. The to-do suggestions
get the same `international` / `hasLodging` / `hasFlights` readings the old
page computes.

Delete is now shown only to the owner on both pages. The "Owner deletes
trips" policy already refused it for guests, but silently — the delete
matched no rows, raised no error, and sent them to the trip list as if it
had worked.

"Documents" was dropped
from the Trip hint: vault documents belong to the account, not a trip, and
there is no trip-level documents section to move.

## Settled — don't relitigate

- **Type and palette stay Béa's** (Manrope, Instrument Serif, existing
  tokens). The prototype's Playfair/Jakarta/Italiana are the tool's defaults,
  not the brand. The palettes are near-identical anyway: Béa `--primary`
  `oklch(.535 .162 39)` vs prototype `#D96B43` = `oklch(.651 .149 40)`.
- **Never render a field the schema lacks.** No stay length, per-stop cost or
  "booked" tick until the migration lands.
- **Preferences are three toggles**, not eight — ribbon, live journey, walk
  times — reusing the `useHomeLayout` / `CustomizeHome` pattern. A preference
  is for something the user may not want to see; something absent because the
  data isn't there is a conditional render.
- **Béa insights are cut.** In the prototype they are hardcoded strings; no
  generator exists. `dayShapeLine` is the honest equivalent if wanted later.
- **No Google Maps migration.** See `audit/bea-google-maps-briefing.txt`.

## Constraints

- **Cannot be verified visually from a sandbox session.** The route is behind
  `_authenticated` and needs live Supabase; `mcp.supabase.com` and
  `ai.studio` are both blocked by the network egress policy. The dev server
  also can't bind — the Lovable config forces `:::8080` and there is no IPv6.
  Run it locally to look at it.
- CI gates every push: typecheck, lint, test, build. Bump the version per the
  table in `AGENTS.md`.
- The prototype source is in `docs/prototype/` (AI Studio export, lockfile
  dropped). It is reference only: outside `tsconfig`, ignored by lint and
  prettier, never imported. Leaflet map: `components/InteractiveMap.tsx`.

## Related docs

- `audit/bea-google-maps-briefing.txt` — the provider decision (this branch).
- The full product/logic/trust audit is on branch
  `claude/bea-codebase-audit-lcvwkb`, not here.
