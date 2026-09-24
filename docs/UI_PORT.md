# UI port — handoff

Branch `UIREMAKE`, based on `main`. Rebuilding the trip experience around a
**day**, from a prototype the owner built in Google AI Studio.

Read this instead of re-deriving the context. It is the whole brief.

## The decision that shapes everything

**A new route, not a port into the old screen.** `/trips/$tripId/day`
(`src/routes/trips_.$tripId_.day.tsx`) lives *beside* `/trips/$tripId`,
which is untouched and still the default.

Porting the design piece by piece into `TripDetail` was tried and rejected:
each piece gets assimilated into the surrounding style as it lands, and the
composition — most of what makes the new design good — never arrives. The
"restyle it at the end" step always gets cut.

So: composition is right from commit one, gaps are visible rather than
implied, and nothing is migrated or removed while it grows.

## Built

| | |
| --- | --- |
| `src/lib/trip-days.ts` (+test) | day chips, default choice, filtering |
| `src/components/DaySelector.tsx` | the chip strip |
| `src/lib/trip-perspective.ts` (+test) | the four perspectives |
| `src/components/day/StopCard.tsx` | collapsed stop card; selectable on the Map view |
| `src/lib/day-map.ts` (+test) | pin numbering, partial-map caption, selection |
| `src/components/day/DayMap.tsx` | the Leaflet day map |
| `src/routes/trips_.$tripId_.day.tsx` | the screen |

`DaySelector` is also wired into the old `TripDetail` (commit `8fb4800`).
That wiring is the only throwaway work if the old screen is retired.

**Four perspectives: Now · Map · Day · Trip.** **Day** and **Map** are built.
Now renders a named "not built yet" card pointing at the old page. **Trip** is
where stops, prep, packing, to-dos, documents, budget and invites will live —
it is a *peer* of the day views on purpose, because the prototype had none of
them and a day-centric screen that dropped them loses more than it wins.

## Next, in order

1. ~~**Leaflet day map.**~~ Done — see "Day map" below.
2. **Migration** — `arrived_at`, `left_at`, `planned_stay_minutes` on
   `itinerary_items`. Applied **by hand**; writing it changes nothing live.
3. **Now (companion).** Current stop / up next / "Leave by". Use **manual
   progression** (tap on arrival), not clock inference: it needs no
   `time_label`, survives running late, and captures what actually happened.
   "Leave by" = next `time_label` − `RouteLeg.duration`; suppress it when the
   leg is `unknownSpot` or `capped` — never a number over a guess.
4. **Trip tab** — move bucket D across, one component at a time.

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
- **`TripMap` is not replaced on the old page or the trip card backdrop.**
  It stays there — an offline SVG with no requests suits a card backdrop —
  until the old screen is retired.

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
