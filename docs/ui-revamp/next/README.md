# Béa — UI revamp steps 7 (Trips), 8 (Home) and 9 (World): new screens on new routes

**For Claude (the agent applying the UI revamp to `larochellemathildeeva-oss/beabuddy`).**
One package, three screens, each built from `docs/ui-revamp/README.md` (the brief), Claude's
`mockup.html`, and the owner's reference pictures (the "three moods" trip homes, the "Customizable trip
home" board, "Your trips." in three moods, the World board). Read this whole file first; the
paste-ready prompt is at the end.

| Step | Screen | New route (file) | Address | Today's page (untouched) |
| --- | --- | --- | --- | --- |
| 7 | Trips | `src/routes/trips_.next.tsx` | `/trips/next` | `/trips` (`trips.tsx`) |
| 8 | Home, 3 states + modules | `src/routes/next.tsx` | `/next` | `/` (`index.tsx`) |
| 9 | World | `src/routes/world_.next.tsx` | `/world/next` | `/world` (`world.tsx`) |

## The one rule: add, don't replace

The owner's instruction: **don't touch existing things, make new ones.**

- Every file in `src/` and `public/` here is **new**. No existing file is edited, moved or replaced —
  not `index.tsx`, `trips.tsx`, `world.tsx`, `Globe.tsx`, `HomeLivingMap.tsx`, `HomeMoods.tsx`,
  `HomeModules.tsx`, `TripsList.tsx`, `TripRouteMap.tsx`, `AppShell.tsx`, `account-settings.ts`.
- The new screens live on **new routes**, so `/`, `/trips` and `/world` keep working exactly as today
  until the owner decides to switch (a separate PR, their call). TanStack's generator adds the routes to
  `routeTree.gen.ts` itself — don't hand-edit it.
- The only existing file that gains lines is `src/styles.css`: **append** `src/styles/world.css`, then
  `src/styles/next.css` (new, namespaced tokens and classes only: `--world-*`, `--aerial-*`, `.aerial-*`,
  `.hn-*`, `.tn-*`). Nothing existing changes.
- New dependency: `three` (+ `@types/three`), for World only.

Authority order (from the brief): owner decisions > `docs/VISUAL_NORTH_STAR.md` > `mockup.html` > `DESIGN.md`.

## What's in the box

```
# Home + Trips (steps 7, 8)
src/routes/next.tsx                      NEW  /next: a copy of index.tsx's signed-in Home with the new hero,
                                              stats, module tiles and per-state module lists
src/routes/trips_.next.tsx               NEW  /trips/next: a copy of trips.tsx (forms, sheets, tabs, search
                                              params unchanged) with the new header, tiles, feature, rows
src/components/next/AerialBanner.tsx     NEW  the aerial banner engine (picture + route drawn in code)
src/components/next/HomeNext.tsx         NEW  HomeNextUpcoming, HomeNextOnTrip, HomeNextNoTrip, HomeNextStats
src/components/next/HomeNextModules.tsx  NEW  HomeNextModule (every HomeTripModule case), CustomizeHomeNext
src/components/next/TripsNext.tsx        NEW  TripsNextHero, TripsActionTile, TripNextFeature, TripNextRow,
                                              PastNextTiles, TripsNextSection
src/hooks/useAerialRoute.ts              NEW  a trip's placed stops (useTripStops + useCityPositions)
src/hooks/useHomeNextLayout.ts           NEW  one module list per trip state, on this device
src/lib/terrain-art.ts (+ .test.ts)      NEW  the per-destination terrain picture slot (empty by default)
src/lib/aerial-route.ts (+ .test.ts)     NEW  geometry: picture placement, progress, flight trail, callouts
src/lib/home-next-layout.ts (+ .test.ts) NEW  states, per-state modules and defaults, layout fallback
src/styles/next.css                      NEW  --aerial-* / --hn-* / --tn-* per theme (append to styles.css)

# World (step 9)
src/routes/world_.next.tsx               NEW  /world/next: world.tsx copied, Globe → BeaGlobe (same props)
```
src/components/world/BeaGlobe.tsx      NEW  the globe: same props as Globe.tsx + photoreal WebGL Earth
src/components/world/bea-earth-gl.ts   NEW  three.js renderer (lazy-loaded by BeaGlobe, never in SSR)
src/components/world/globe-shaders.ts  NEW  GLSL: surface (relief, light, night lights, rim), clouds, halo
src/components/world/globe-looks.ts    NEW  per-theme grading: calm / colorful / dark
src/components/world/GlobePinMarker.tsx NEW the frosted place tag (mockup .gtag)
src/components/world/WorldScreen.tsx   NEW  Map-tab sections: WorldTabs, WorldGlobeStage, WorldFilters,
                                            WorldPlaceCard, WorldStatsStrip, CustomizeWorldButton
                                            (+ preview-only header/nav stand-ins, see below)
src/lib/bea-globe.ts                   NEW  pure maths: d3-compatible orthographic projection, spin physics,
                                            label placement (no DOM, no three)
src/lib/bea-globe.test.ts              NEW  node --test; proves the projection equals d3's geoOrthographic
src/styles/world.css                   NEW  --world-* tokens (append to src/styles.css)
public/earth/relief.webp               NEW  2048×1024: R elevation, G ocean mask, B sparse clouds (NASA)
preview.html  globe-demo.html          standalone pages (open from disk, no server, no build)
demo/                                  their prebuilt bundles + inlined textures
dev/                                   preview harness only — do NOT copy into the app (see "dev/")
```
```

`public/earth/day.webp` and `night.webp` are the app's own (AGENTS.md); BeaGlobe reuses them.

## Install (all three)

1. Copy `src/**` and `public/earth/relief.webp` to the same paths in the repo (not `dev/`, `demo/`,
   `next-preview/`, `preview.html`, `globe-demo.html` — those are previews).
2. `npm i three` and `npm i -D @types/three` (World; lazy-loaded, never in SSR).
3. Append `src/styles/world.css` then `src/styles/next.css` to the end of `src/styles.css`.
4. `npm run dev` → `/next`, `/trips/next`, `/world/next`. The routes generate themselves.
5. Run the test gate (below), then tick `.superdesign/checklists/home.md`, `trips.md`, `world.md`
   against the new routes in Calm, Colorful and Dark (both accents).

Nothing links to the new routes yet, so nobody sees them until the owner does. Tab bar: `pathMatchesTab`
treats `/trips/next` as Trips and `/world/next` as World; `/next` lights no tab (Home matches `/` only).
That is intended while it is a preview; promoting `/next` to `/` later fixes it with no code change.

---

## Step 8 — Home (`/next`)

`next.tsx` is `index.tsx`'s signed-in page, copied: same hooks, same reads, same links. Signed-out
visitors are sent to `/` (the welcome page stays there). Only the hero, the stats, the module tiles and
the module lists are new. Mockup functions covered: `homeUpcoming`, `tripHero('home')`, `renderModules`,
`MODULES` / `DEFAULTS`.

**Three states** (which one comes from the real trip: `pickActiveTrip` + `isUnderway`):

- **Upcoming** (`HomeNextUpcoming`): "Upcoming trip" kicker, "{Trip} in N days." over the trip's part of the
  world seen from above, the route through its stops, and a photo bubble per city (your photo, else the
  Wikimedia town photo already used by `useTownPicture`, else the city's `banner-art.ts` painting) with how
  long you stay; bubbles never cover another bubble, a stop or the title, and keep a dotted thread to
  their town. Then `HomeNextStats` (to-dos → `?prep=todo`, flight → the flight or `?view=bookings`,
  packed % → `?prep=packing`; the same links as `HomeTripStats`), `HomeWhereNext`, `HomeSuggested`.
- **On a trip** (`HomeNextOnTrip`): "On trip · Day 3 of 7", the trip's name with a full stop (the
  references), the route with stops behind you filled and **the city you are in ringed — only after a
  Companion tap ("I'm here")**, as Home does today, never from the clock alone. A panel rises over the
  banner with **Current stop / Next stop** cards (Companion's own data: title, time, line, StopArt;
  "In 2 h 20 min"), then three chips: **stops x/y**, **weather there** (Open-Meteo through
  `usePlaceNow`, asked only when a weather module is on, as Home does), **Saved N places** (→ Recs). A
  round button opens today on the trip page. The stats strip follows.
- **No trip** (`HomeNextNoTrip`): greeting kicker, "Where to next?", today's date, heart tags on the
  cities you saved places in (→ Recs), then the app's own `HomeSavedCard` ("N saved places in M cities are
  waiting for a trip." + Plan a trip) and `HomeWaiting` tiles. With no placeable saved city, Home falls
  back to today's greeting header, exactly like `index.tsx`.

Kept from `index.tsx` (checklist `home.md`): AppShell frame and header (logo, version, guide, online dot,
tabs), eyebrow date + greeting title when there is no hero, `HomeYourTrips` (later + past trips),
`HomeWeather` with its ask-first location rules and `WeatherCredit`, `NearHome` (sharing durations, radius,
place cards, day trip planner), Future me note, the sample-data prompt, `HomeWhereNext`, `HomeSuggested`,
`HomeSavedCard`, `HomeWaiting`, the profile-name memory, every `data-guide` anchor (`home-trip`,
`home-next`, `customize-home`, `home-module-*`, `home-future`, `home-empty`).

**Modules** (`HomeNextModule`, the references' "Customizable trip home" board): Saved for this trip, Right
now there (local time + sky, live), Group plans (the trip's members as initials + invite), Trip tools
(Currency `menu=currency`, Transport `view=bookings`, Translate, Offline `menu=offline`), Weather there,
Worth a detour, Notes from Béa — every case of `HomeTripModule`, fed by the same `useHomeTripModules`
(real data only; a module with nothing to say draws nothing). Small modules pair two to a row
(`HOME_SMALL`, `moduleRows`), wide ones take a row.

**One list per trip state** (owner decision "separate lists per trip state"): `CustomizeHomeNext` is the
references' card at the foot of Home; it opens a sheet on the state Home is in, with tabs for the other two
(Upcoming trip / On a trip / No trip), a switch per module, up/down arrows (44 px), and Reset. Current /
Next stop stays first. Each state lists only its own modules (`STATE_MODULES`; no trip modules without a
trip). Starting point: the traveller's account Home layout (`homeLayout`) narrowed to the state, if they
ever customized it; otherwise the mockup's `DEFAULTS` per state (`STATE_DEFAULTS`). Kept **on this
device** (`bea-home-next-layout-{state}-{uid}`, via `settings-storage`); the account's `homeLayout` is
read, never written, so `/` keeps its own layout.

> Owner's call: the brief's mapping row says module lists are "saved per account", its Migrations note
> allows "per device (localStorage) or reuses existing account settings". Syncing the three lists to the
> account needs one edit to an existing file (`src/lib/account-settings.ts`: three keys
> `homeNextLayout.upcoming|ontrip|none` beside `homeLayout`, then `useHomeNextLayout` reads/writes them
> like `createModuleStore` does). Not done here because of the add-only rule.

## Step 7 — Trips (`/trips/next`)

`trips_.next.tsx` is `trips.tsx` copied, with only the presentational components swapped. Mockup
functions covered: `renderTrips`, `featured`, `nextUpHTML`, `t4Row`, `vaultHTML` (the documents link).

- **Header** (`TripsNextHero`): "Trip folders" / "Your trips." over the trips' part of the world from above,
  a frosted tag at each trip's place (city + month, "Now" while on it, "N trips" for a shared place) that
  opens the trip, and the dotted flight trail joining them in date order with its little plane (the
  reference). Calendar and New trip stay the round buttons top right. Tags avoid the title, the buttons,
  each other and the pins (`calloutBoxes`).
- **Tabs** Upcoming / Past / Drafts / (Following) / All as a frosted bar rising over the header; drafts
  link; the same `?view=` search param.
- **Plan with Béa** (→ `/trips/plan`) and **Join with a code** as two pastel tiles (`TripsActionTile`);
  New trip and Join open the **same sheets with the same forms** (name suggestion, one place / several
  cities, place search, date ranges with tentative dates, packing-list copy, budget, invite code rules).
- **Big banner / List** (`useTripsLayout`, `bea-trips-layout`) and **Stops / Photo** (`useTripPicture`, the
  trip page's own setting) — the app's `LayoutSwitch` and `PictureSwitch`.
- **Next up** (`TripNextFeature`): the trip's route from above (or its photo), travellers or the live stop,
  a glass panel with name, places, dates and the countdown circle, its cities in order with dates, chips
  for flight (or the stay once under way), to-dos and packing (each opens that part), the stay, Béa's line
  and View itinerary — `TripFeature`'s data.
- **Rows** (`TripNextRow`): a small map or photo, name, dates, places, current leg, travellers as faces
  (initials from member names — no stock faces), the tag (live / in N days / draft / tentative), ⋯ menu
  (Open trip, To-dos, Packing, Bookings) — `TripListRow`'s data.
- **Past** tiles + See all, **Trip documents** section → `/profile/documents` (the vault and its
  passcode rules live there, unchanged), loading skeletons, empty state, signed-out note.

## The aerial banners and the terrain slot

The references' trip homes are painted aerial landscapes. Per the brief ("use the app's real sources …
new terrain art needs owner-approved artwork"), `AerialBanner` draws **the route and stops in code**
over a picture chosen in this order:

1. **Owner terrain art** for the destination (`src/lib/terrain-art.ts`, `TERRAIN_ART`) — **empty by
   default**, so nothing new ships without the owner choosing it.
2. Else **the app's Natural Earth relief tiles** (`public/relief/…`, the same terrain as Home's living
   map), graded per theme (richer colour, theme water, soft clouds in Calm/Colorful, night wash in Dark).
3. Else (no tiles for the area) the destination's **`banner-art.ts` scene**.

Photo bubbles and stop cards use `stop-pictures.ts` / `StopArt` / `useTownPicture` exactly as the app does
(illustrations / photos / none is respected).

**Adding terrain art** (once approved): put the file in `public/terrain/`, add an entry keyed by
`terrainKey()` of the trip title, a city, or the country (first match wins, in that order):

```ts
export const TERRAIN_ART: TerrainRegistry = {
  italy: {
    src: "/terrain/italy.webp",
    darkSrc: "/terrain/italy-night.webp",      // optional
    bounds: [5.625, 38.82259, 18.28125, 47.04018], // W, S, E, N of a Web Mercator picture
    width: 2304, height: 2048,                 // its pixels (needed with bounds)
    credit: "…",                               // shown small on the banner
  },
};
```

With `bounds` every stop is drawn exactly where it is, and a picture of a wider area is enlarged until
the route fills the banner; art is used only if it holds every stop (`artCovers`). Without `bounds` the
picture fills the banner and the route is fitted over it as a drawing.

`dev/next/make_terrain.py` makes such a picture from NASA's public-domain *Blue Marble: Shaded Relief and
Bathymetry* (GIBS) for any box — the preview's `?terrain=demo` uses three of them (Alps, Italy, Japan)
to show the slot working (`bea-*-terrain-slot.png`). They are **not** in `src/` or `public/`: whether
they (or the owner's own art) ship is the owner's decision.

## Step 9 — World (`/world/next`)

`world_.next.tsx` is already in the package: `world.tsx` copied with `Globe` swapped for `BeaGlobe`
(same props), so `/world/next` runs the new globe with every World function. What remains is restyling
its Map tab with the package's sections, fed by the page's **real** values (checklist
`.superdesign/checklists/world.md`):

| Section | Props from the copied page |
| --- | --- |
| `WorldTabs` | `active={tab}` `onChange={setTab}` (same ids: map, bucket, been, stats) |
| `WorldGlobeStage` | children = `<BeaGlobe …/>`; `onAddPlace` = what the "+" does today (open `AddVisitedCity`) |
| `WorldFilters` | `active={view === "all" ? null : view}` `onChange={(f) => setView(f ?? "all")}`; hide/disable Provinces when there are none, as today |
| `WorldPlaceCard` | from the selected pin: city, country, visit count, latest `dateVisited` formatted, a real photo from `usePhotoMemories` if any (else a quiet pin tile — never a stock photo) |
| `WorldStatsStrip` | the first four enabled `STAT_OPTIONS` with the values world.tsx already computes. Never placeholder numbers |
| `CustomizeWorldButton` | opens the existing `CustomizeWorld` sheet |

Keep every hook, state, sheet and tab of the copy (`usePhotoMemories`, `useRecommendations`, `useTrips`,
`useVisitedProvinces`, `useStatsLayout`, `useWorldLayout`, `AddVisitedCity`, `ComparePins`,
`CustomizeWorld`, the `?tab=` param, header search, "You've been here", Bucket list / Been there / Stats,
every stat option, the `data-guide` anchors) and `AppShell` as world.tsx uses it. Do **not** render
`WorldHeaderPreview` / `WorldNavPreview` in the app — they only mirror AppShell for the previews.

### BeaGlobe

```tsx
import { BeaGlobe } from "@/components/world/BeaGlobe";

<BeaGlobe
  pins={globeCities} regions={provinceFeatures} visitedCountries={shadedCountries}
  shadePinCountries={show.countries} countryMarks={show.countries ? namedCountries : undefined}
  selectedId={selected?.id ?? null} onSelect={setSelected} onCountrySelect={openCityIn}
/>
```

**Every Globe.tsx interaction is kept** (same numbers where Globe.tsx has them):
drag to rotate with a fling; pinch, mouse wheel / trackpad and +/− buttons zoom 0.7–2.6×; arrow keys
rotate 12° (Shift 24°); `+`/`-` keys zoom; Home key and the "Reset the view" button go back to
Globe.tsx's home view `[-10, -18]`; tap a place → `onSelect`; tap a country → `onCountrySelect(name)`;
a drag that ends on a place or country is not a tap (6 px slop); selecting a place that is round the
back turns the globe to it; visited-country shading (from pins and/or `visitedCountries`);
province/state shading (`regions`); country ring markers with names (`countryMarks`);
`scrollFriendly` (vertical swipes scroll the page, pinch zooms the page); `autoSpin` (turns until the
first touch, never again); `prefers-reduced-motion` (no spin, no fling, jumps instead of animating);
pauses off-screen and in background tabs; the same screen-reader description and keyboard label.

**New:**
- Photoreal Earth: NASA Blue Marble day / Black Marble night (the app's own textures), embossed relief
  from an elevation map, specular sea glint, a soft atmosphere rim and halo, a few drifting clouds with
  shadows. Orthographic, so the d3 SVG overlays line up to the pixel (unit-tested against d3).
- Themes via `useThemeName()` (or `mood`): **Calm** natural daylight (teal sea, honest greens, white
  haze), **Colorful** the same Earth pushed to aqua/lime with a peach→lavender rim, **Dark** the night
  side with gold city lights and a blue rim.
- Gentle auto-rotation (6°/s, Globe.tsx's speed) that stops while held and **resumes 2.5 s after**
  (`autoRotate="resume"`, the default; `"until-touch"` = Globe.tsx's autoSpin; `"off"`). A flick coasts
  with inertia and settles back into the turn.
- Places as glowing dots; frosted tags (mockup `.gtag`: coloured drop + name, 13 px) where they fit,
  fading at the limb, hidden on the far side. Selected = accent ring + bold (not colour alone).
  Tags follow Globe.tsx's rule: never over another tag or another place's dot; the selected place is
  always named; budget 6 / 12 / 20 by zoom.
- No WebGL (or before textures arrive)? It draws Globe.tsx's plain vector globe with every interaction.

Extra props: `mood`, `autoRotate`, `clouds` (default true; DESIGN.md is wary of decoration — set
`false` if the owner prefers), `textures`, `pinColor(pin, i)` (default: blue, `--acc2`, amber, violet,
teal in list order, as the board), `controls` (the +/−/reset stack on the left), `initialRotation`.


### Tokens and type

- All colour comes from the app's tokens: `--background` (Calm `#FFFFFF`, Colorful `#FCF9F4`, Dark
  `#171513`), `--card`, `--foreground`, `--muted-foreground`, `--border`, `--ring`, `--visited`, and the
  accent set `--acc / --acc2 / --acc-soft / --acc-ink / --acc-done`, so `data-accent="pink|periwinkle"`
  switches them. `world.css` adds only what has no token: the four filter pastels (VISUAL_NORTH_STAR's
  Blush, Powder blue, Mint, Butter; dark variants), stats dividers, the Colorful wash, the active-tab
  tint (soft accent; in Dark a dimmed accent so white text keeps contrast).
- Calm / Colorful / Dark switch through the app's own selectors (`[data-theme]`, `.dark`) — no `mood`
  prop is needed on the sections.
- Type: nothing under 13 px (tab, filter, stat labels, tags 13; meta 13–14; body 15–16; card title
  22 serif; display title 40 serif in AppShell). Serif = Instrument Serif, sans = Manrope.
- Selected states are never colour-only: tabs bold + tinted tile + `aria-selected`; filters bold + ring
  + `aria-pressed`; tag bold + ring + `aria-pressed`.


- Home/Trips add `--aerial-*` (banner sea, water, wash, vignette, route, dots, tags), `--hn-*` (panel,
  cards, chips, faces) and `--tn-*` (trail, plane, pins) per theme with the app's selectors; everything
  else is the app's tokens (`--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`,
  `--acc*`, `--stat-*`). Pastels are the north star's Blush / Powder / Mint / Butter / Lavender; no orange
  or terracotta chrome. Text ≥ 13 px; touch targets ≥ 44 px; selected states never colour-only.

## How the references were read

- **Trip homes** (Calm "Alps Road Trip", Colorful "Coastal Italy", Dark "Japan Explorer"): followed — the
  aerial route with labelled stops and the current one ringed, the panel with Current / Next stop, the
  three chips, the module board and the Customize home card. Their nav labels (Trip / Saved / Profile)
  are not the app's; the bar stays **Home · World · Trips · Recs · You**.
- **"Your trips." in three moods**: left (warm peach with an orange "+") = **Calm**, shown with the
  traveller's accent because orange chrome is not allowed; middle (aqua, pink) = **Colorful**; right =
  **Dark**. Followed: header art with trip tags and the dashed plane trail, frosted tabs, the two action
  tiles, rows with faces and ⋯.

## What changed relative to Claude's mockup

- Home/Trips banners are real geography (the trip's own stops at their positions) instead of generated
  terrain; the terrain slot lets approved art in. Bubbles, tags and labels never overlap (13 px+).
- The on-trip ring follows Companion taps, not the clock. Chips only say what is known (no weather chip
  until the sky answers).
- Module tiles are the references' richer cards; the customize sheet has a tab per trip state.
- Trips: the reference's dotted flight trail and frosted tabs; rows show members' initials (no stock faces).
- World: see BeaGlobe above (real spinning Earth, 13 px tags, 44 px controls).
- AppShell is untouched, so the logo row stays above the hero rather than over the picture (the
  references float it on the image; doing that needs an AppShell change — owner's call).

### World specifics

- Real spinning 3D Earth instead of a static image; relief, atmosphere, clouds, three graded looks.
- Places come from lat/lon and stay on the surface while it turns; far-side places hide.
- Tags are 13 px (mockup 9.6 px at 288 px → too small at 390 px); controls are 44 px targets.
- The +/−/reset stack stays on the left as in the mockup; "Add places" bottom right.
- Filter tiles use the north-star pastel family instead of ad-hoc hexes, and work in Dark.
- No invented numbers or places in `src/` (the mockup's 6 / 9 / 12 / 18 are preview sample data).


## Verify (test gate)

```
npm run typecheck && npm run lint && npm test && npm run build && npm run check:public-secrets
npm run preview:check   # step 0 harness; add next:/trips-next:/world-next: flows
```

Already checked here, against a clean checkout of `main` (7642a87) with the package's files added
(no existing file changed):

- `tsc --noEmit` with the repo's `tsconfig.json`: 0 errors (with `three` installed).
- `eslint` (repo config) and `prettier --check` (repo `.prettierrc`) on every new file: clean.
- `npm test` (Node 22, `--experimental-strip-types`): **2006 / 2006** pass (the app's own + 32 new
  in `terrain-art`, `aerial-route`, `home-next-layout`, `bea-globe`).
- `vite build` (the app's own config): passes; the three routes are their own chunks (`next`,
  `trips_.next`, `world_.next`). One size notice: `bea-earth-gl` (three.js, 535 kB, lazy-loaded by BeaGlobe
  only on `/world/next`, never in the main bundle).
- `check:public-secrets`: clean.
- Browser e2e on the real routes (`dev/next/e2e/home-trips.mjs`, 40 checks, all pass): on-trip ring and cards,
  Customize sheet (moment tabs, toggle saves and shows/hides at once, arrows, fixed first module, Reset),
  upcoming bubbles and stat links, no-trip tags, terrain slot, Trips tags/trail/tiles, Join sheet,
  List/Photo switches saved, row ⋯ menu, Past tab, New trip sheet, documents link, no page errors.
  World: `dev/e2e/interact.mjs`, `dev/e2e/fling.mjs`.

## Previews (not for the app)

- **Home + Trips** — `next-preview/` is built from the package's **real route files** against an app
  checkout (`BEA_APP=/path/to/beabuddy node dev/next/build-next.mjs`; run `npm ci` in the app first): the real
  AppShell, the real hooks, the app's own CSS and pictures (`relief/`, `banners/`, `places/` are linked from
  the app's `public/`). Only the data is fake: `dev/next/shims/integrations/supabase/client.ts` serves
  the sample rows in `dev/next/sample-db.ts`, server functions answer `null` (the weather
  one asks Open-Meteo straight from the page). Serve: `python3 -m http.server -d next-preview 8765`, then
  `?screen=home&home=upcoming|ontrip|none&trip=alps|italy|japan&theme=calm|colorful|dark&modules=all&terrain=demo`
  or `?screen=trips&layout=big|list&picture=stops|photo&theme=…`. Screenshots: `node dev/next/shoot-all.mjs`. (`cd dev && npm i`, then `npm run build:next | serve:next | e2e:next | shoot:next`.)
- **World** — `preview.html`, `globe-demo.html` (open from disk).

### `dev/` (not for the app)

Standalone preview harness: esbuild + Tailwind CLI bundles of `src/` into `demo/`.
`dev/shims/` holds **verbatim copies** of the app files the package imports (icons, `cn`, `Pin`,
`useThemeName`, `theme`, `country-names`, `fuzzy`) and `dev/app-tokens.css` is a verbatim copy of
`src/styles.css` lines 90–301, so the previews use the real tokens. `dev/sample-data.ts` is the only
sample content. `dev/tsconfig.json` type-checks `src/` with the repo's exact compiler settings
(`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, …).
Rebuild: `cd dev && npm i && npm run build` (`npm run typecheck`, `npm run e2e` need Chrome).
Browser checks: `node e2e/interact.mjs` (tap place, drag ≠ tap, keys, zoom, tap country, turn to a
hidden place) and `node e2e/fling.mjs` (flick coasts and slows, holding stops it, auto-turn resumes).


## License notes

- Natural Earth relief tiles and `banner-art.ts` scenes: the app's existing assets.
- `public/earth/relief.webp` (new, World): NASA Blue Marble topography / water mask and NASA Visible
  Earth clouds — public domain. Preview-only terrain demo: NASA GIBS Blue Marble Shaded Relief and
  Bathymetry — public domain (not shipped).
- three.js MIT; d3-geo, topojson-client, world-atlas ISC/BSD (already in the app).
- No new API keys. At runtime Home/Trips load only the app's own tiles and pictures.

## Ready-to-paste prompt (for the owner to give Claude)

> Apply steps 7 (Trips), 8 (Home) and 9 (World) of `docs/ui-revamp/README.md` using the package in
> `bea-ui-next/`, following its README. **Don't edit any existing file** (not `index.tsx`, `trips.tsx`,
> `world.tsx`, `Globe.tsx`, the Home/Trips components, `AppShell.tsx` or `account-settings.ts`): copy the
> package's `src/**` and `public/earth/relief.webp` to the same paths, `npm i three` (+ `-D @types/three`),
> and append `src/styles/world.css` then `src/styles/next.css` to `src/styles.css`. That gives three new
> routes beside today's pages: `/next` (Home: upcoming / on trip / no trip, module tiles, one module list per
> trip state), `/trips/next` (aerial header with trip tags and flight trail, Big banner / List, Stops /
> Photo) and `/world/next` (the photoreal `BeaGlobe`). Then finish World's step 3 in
> `src/routes/world_.next.tsx`: restyle its Map tab with `WorldTabs`, `WorldGlobeStage`, `WorldFilters`,
> `WorldPlaceCard`, `WorldStatsStrip`, `CustomizeWorldButton` fed by the page's real values (table in the
> README). Use real data only; leave `TERRAIN_ART` empty unless I give you approved terrain pictures. Keep
> everything in `.superdesign/checklists/home.md`, `trips.md` and `world.md`. Run the test gate
> (typecheck, lint, test, build, check:public-secrets, preview:check with flows for the three new routes)
> and show me screenshots of `/next` (all three states + Customize home), `/trips/next` (Big banner / List,
> Stops / Photo) and `/world/next` in Calm, Colorful and Dark, side by side with today's pages. Don't link
> the new routes from the tab bar or promote them; that's my decision.
