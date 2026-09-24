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
| `src/components/day/StopCard.tsx` | collapsed stop card |
| `src/routes/trips_.$tripId_.day.tsx` | the screen |

`DaySelector` is also wired into the old `TripDetail` (commit `8fb4800`).
That wiring is the only throwaway work if the old screen is retired.

**Four perspectives: Now · Map · Day · Trip.** Only **Day** is built. Now and
Map render a named "not built yet" card pointing at the old page. **Trip** is
where stops, prep, packing, to-dos, documents, budget and invites will live —
it is a *peer* of the day views on purpose, because the prototype had none of
them and a day-centric screen that dropped them loses more than it wins.

## Next, in order

1. **Leaflet day map.** Replaces `TripMap` (currently d3-geo + topojson SVG,
   no selection state). Prototype uses Leaflet + CartoDB Voyager tiles — OSM
   data, so no licensing change. **`OSM_ATTRIBUTION` must stay visible** (ODbL,
   see `AGENTS.md`), and `legLabels` + `tripMapPlan` from `trip-map.ts` must
   carry over.
2. **Migration** — `arrived_at`, `left_at`, `planned_stay_minutes` on
   `itinerary_items`. Applied **by hand**; writing it changes nothing live.
3. **Now (companion).** Current stop / up next / "Leave by". Use **manual
   progression** (tap on arrival), not clock inference: it needs no
   `time_label`, survives running late, and captures what actually happened.
   "Leave by" = next `time_label` − `RouteLeg.duration`; suppress it when the
   leg is `unknownSpot` or `capped` — never a number over a guess.
4. **Trip tab** — move bucket D across, one component at a time.

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
