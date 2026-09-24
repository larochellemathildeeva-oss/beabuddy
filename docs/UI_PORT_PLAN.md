# Finishing the trip page UI/UX transition — plan

Written 2026-09-24. Companion to `docs/UI_PORT.md` (what is built and why).
The owner approves this plan once; each phase then runs without re-scoping.

## Definition of done

The trip page (`/trips/$tripId`) has the AI Studio prototype's layout with
Béa's fonts and photo banner, every function the page had before still
works, and an automated check proves that **every control on every tab does
something visible, nothing throws, and no screen is a dead end.**

## Rules for every phase (these are what keep credit use down)

1. **Scope is this document.** No feature is added, dropped or reinterpreted
   without asking the owner first. Anything unclear goes on the decision
   list below, not into code.
2. **One phase = one pull request.** Merge only after the owner has seen the
   screenshots, except bug-only fixes, which the owner has allowed to merge
   once CI is green.
3. **Test gate, in this order, before every commit:**
   - `npm run typecheck`, `npm run lint` (0 errors), `npm test`, `npm run build`
   - `npm run preview:check` (phase 0): renders the real `TripDetail` with
     sample data, clicks every control on every tab, fails on any page
     error or dead control, and writes screenshots of each tab.
   - Read the screenshots before calling a step done.
4. **Work from files, not memory.** Start each session with: "On branch
   `UIREMAKE`, read `docs/UI_PORT_PLAN.md` and `docs/UI_PORT.md`, then do
   phase N." Read only the files that phase names.
5. **Report plainly:** what changed, what was tested, what was not.

## Phase 0 — put the test harness in the repo (small)

The preview harness exists only in a scratchpad that disappears with the
session. Rebuilding it each time is the biggest avoidable cost.

- `scripts/preview/`: fake Supabase client with a sample trip (8 stops on
  day one, 3 on day two, one stop in progress), stubs for server functions,
  the router and `node:*` modules; esbuild bundle of the real `TripDetail`.
- `scripts/preview/check.mjs` (Playwright, uses the preinstalled Chromium):
  - open each tab: Now, Map, Day, Trip;
  - click every `button`, `a`, `select` and `[role=tab]` in the page, one at a
    time from a fresh load, and record what happened: sheet opened, text
    changed, a write was sent to the fake database, focus moved, or a link
    has a real `href`;
  - fail if a click throws, changes nothing, or leaves no way back;
  - also run the sample with an empty trip, an undated trip and a 45-stop
    day, and as a guest (not owner);
  - save one screenshot per tab per sample to `scripts/preview/out/`
    (git-ignored).
- `npm run preview:check` wires it up. Not in CI (it needs a browser);
  run locally before each push.

**Test:** the check passes on current `UIREMAKE`; deliberately breaking a
button (no handler) makes it fail.

## Phase 1 — audit and fix what the checker finds (small–medium)

Run the checker, then fix every failure. Known suspects to verify:

| Area | Check |
| --- | --- |
| Tabs | Tab survives a refresh and the back button (put it in the URL, e.g. `?view=map`) |
| Day strip | Picking a day updates Now, Map and Day; "Whole trip" works on each tab; hidden in "All entries" mode on Day is intentional and says so |
| Now, trip not started | Picking a day shows "First up"; with no day picked the prompt is clear |
| Now, 45 stops | Tracker scrolls to the current stop; ribbon and "Later" stay usable |
| Map | Each layout frames the whole day; "Jump to", ‹ › and pins agree; stops without a location are listed and explained |
| Map | The old whole-trip map under the list: keep, restyle or remove (decision D6) |
| Day | Swipe, icons, chevrons, tap-time, add-between, edit mode, undo on delete and on done |
| Day | Walk rows appear once directions exist; "Add stop between" places the stop correctly |
| Trip | Every section opens; owner vs guest (Delete only for the owner, Leave only for guests) |
| Action pills | Plan with Béa opens import; Before you go opens to-dos; Settings opens; Add stop opens the stop form on the Trip tab |
| Empty states | Empty trip, undated stops, a trip with no locations: each says what to do next and links to it |
| Accessibility | Every control reachable by keyboard, has a name, and swipe actions have buttons (already true; the checker confirms it) |
| Dark mode | All four tabs readable in dark mode |

**Test:** checker green on all samples; screenshots reviewed; owner checks
on their phone after merge.

## Phase 2 — small prototype features still missing (medium)

In order; each is independent and one commit:

1. **Locate on map** from a Day card: switches to Map with that stop
   selected and framed.
2. **Offline directions pill** beside the day strip (opens the existing
   offline directions in settings; no new behaviour).
3. **Stay length and "Booked"**: stay already shows; "Booked" only if
   decision D3 says to add a column.
4. **Remember choices** per trip on this device: last tab and day.

**Test:** checker extended with one assertion per feature, then green.

## Phase 3 — larger prototype features (medium–large, one PR each)

1. **Saved places drawer:** a "Saved" pill opens the owner's saved places
   (recommendations) filtered to this trip's city, each with "Add to this
   day". Uses existing tables; no migration.
2. **Optimize with before and after:** wraps the existing optimizer. Shows
   the old and new order, the minutes saved, and an Undo that restores the
   exact previous order.
3. **Compare plans A / B / C** (only if decision D1 is yes): needs a design
   first. Sketch in Figma or as a screenshot mock, approve, then build.

**Test:** checker assertions for each: the drawer opens, adding writes the
right day and position, optimize's undo restores positions exactly.

## Phase 4 — finish and tidy (small)

- Remove code the new page no longer uses (check with a search, not memory).
- Update `docs/UI_PORT.md` and the progress page to the final state.
- Final checker run on every sample, and full screenshots for the owner.

## Decisions needed from the owner (ask once, before phase 2)

| # | Question | Default if not answered |
| --- | --- | --- |
| D1 | Build Plan A / B / C comparison? It is new, and the largest item left. | No, park it |
| D2 | "Béa's daily guidance" card: the prototype's text is hard-coded. Build a real one (needs an AI call per day), or leave it out? | Leave it out |
| D3 | Cost and "Booked" on stops need new database columns (a migration you run by hand). Add them? | No |
| D4 | Photos on stop cards: no photo source exists for stops. Leave out? | Leave out |
| D5 | Group stops by neighbourhood: Béa has no neighbourhood data; it already groups stops within walking distance. Is that enough? | Yes, keep the walking groups |
| D6 | The old whole-trip map under the Map tab's list: keep, restyle or remove? | Keep, restyle to match |
| D7 | Tab names: Béa's Now / Map / Day / Trip, or the prototype's Companion / Map Split / Timeline (+ Trip)? | Keep Now / Map / Day / Trip |
| D8 | Swipe hints under every card, or only on the first card of each day? | First card only |

## Not in scope

The Home, World, Recs and You tabs; a new mascot or status ring; ferry and
ticket alerts (no data source); the in-app spec document.
