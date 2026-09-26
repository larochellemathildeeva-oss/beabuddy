# Béa — UI/UX & Architecture Briefing (external design review)

Snapshot of `main` at app version **3.1.0**. Paths are relative to the repo root.

---

## 1. Product & environment context

**Domain.** A personal *travel memory vault + trip companion*, not an "AI trip
planner" (`docs/WHAT_BEA_BELIEVES.md`). Organising idea: **Past You captures →
Present You decides → Future You benefits.** Four object types carry the product:

| Object | Table(s) | Meaning |
| --- | --- | --- |
| Saved place ("rec") | `recommendations` | A place someone told you about. Typed by pin: `reco`, `wishlist`, `nexttime`, `visited`. |
| Trip | `trips`, `trip_members`, `trip_invites`, `trip_stops` (cities), `itinerary_items` (timeline rows), `trip_todos`, `trip_budget_items` | Shared, realtime, invite-by-code folder. |
| Memory | `photo_memories`, `future_notes` | Where you've been + notes to your future self per city. |
| Vault | `vault_documents`, `vault_settings`, `packing_*`, `expenses` | Encrypted docs, packing lists, work receipts. |

Persona/voice: Béa is a French-bulldog mascot, always third person
(`src/lib/bea-voice.ts`, pools tested in `bea-voice.test.ts`). Personality is
confined to empty states, saves, waits and milestones; auth/legal/settings/
expenses are utilitarian.

**Form factor.** Mobile-first **responsive web app** (TanStack Start + React 19,
SSR), installable-looking (`apple-mobile-web-app-capable`, `viewport-fit=cover`)
but **no PWA manifest or service worker**. The whole app lives in a single
centred column: `max-w-[520px]` → `md:680px` → `xl:780px` (`AppShell.tsx`). On
desktop it is a phone-shaped column with side borders, not a desktop layout.

**Physical environment the code designs for.**
- **On the street, one hand, mid-trip**: Companion view ("I'm here" / "Leaving"
  taps, "Leave by" time), swipe-to-done stop rows, bottom tab bar with
  safe-area padding, `h-dvh` shell to survive iOS viewport churn.
- **Patchy connectivity**: an online/offline dot in the header, plus
  *per-trip, opt-in* offline copies of directions and day maps in
  `localStorage` (`useOfflineDirections`, `useOfflineDayMaps`). No offline write
  queue — edits need a connection.
- **Planning at home**: long-form editing (Timeline Editor, planner sheet with
  paste/photo/PDF/ICS import, optimiser).
- **Shared devices / security**: idle sign-out after **45 min**
  (`src/lib/idle-logout.ts`).

---

## 2. Information architecture & route map

File-based routing in `src/routes/` (TanStack Router). One shell (`AppShell`)
wraps every page: top bar (back, logo+version, `PageGuide` "?" help, online dot)
→ `PageHeader` (eyebrow + serif title, compresses on scroll) → scrolling `<main>`
→ bottom tab bar. Each route declares a transition "plane" (`tab` = lateral
drift, `detail` = push).

```
/ (Home)                         TAB 1   public: landing  | signed-in: dashboard
/world                           TAB 2   globe + visited stats
/trips                           TAB 3   trip list, create / join
  /trips/$tripId                 detail  (file: trips_.$tripId.tsx — not nested)
/recommendations                 TAB 4 "Recs"  vault, add, filter, Near
/profile                         TAB 5 "You"   settings, data, legal, account
/_authenticated/* (beforeLoad guard, ssr:false, plane: detail)
  /calendar                      trips on a calendar (linked from /trips)
  /memories                      city memories + future notes
  /photos                        photo import → visited places
  /story                         "journey played back"
  /expenses                      work receipts / exports (from You › Work travel)
/preferences                     "Béa's brain" — taste, diet, avoid lists
/auth, /forgot-password, /reset-password
/help, /how-it-works, /privacy, /terms   (public)
/opportunities  → redirect to /  (legacy; "Near" was folded into Recs/Home)
```

Tab bar: `Home · World · Trips · Recs · You` (5 equal columns, sliding pill
indicator, per-tab accent hue). Routes outside the five (calendar, memories,
photos, story, expenses, preferences) show **no active tab**.

**Entry point.** `/`: signed-out → `LandingPage` (demo globe, "Create an
account", "How Béa works"); signed-in → `SignedInHome`. First-run users see a
"Load sample travel data" card; an optional guided `Tour` and per-page
`PageGuide` spotlight explain features.

**Core journeys.**

1. **Capture a rec** — Recs → type/paste in the single add field
   (`PlaceSearchInput`) → pick suggestion → **Save** (quick-add) *or* draft card
   → optional chip fields → Save. Later surfaces on Home ("Waiting for you",
   Near).
2. **Plan a trip** — Trips → **New trip** → city search (or "Several cities")
   → `DateRangeField` (+ tentative) → optional budget / packing template →
   create → trip page → **Plan with Béa** (import a plan / optimise / compare)
   or **Add stop** → Timeline Editor.
3. **Travel the day** — Trip page opens on **Companion** when the trip is
   underway → `DayRibbon`/`JourneyTracker` → `NowPanel` ("I'm here", "Leaving",
   "Leave by") → swipe stops done → Map view for spatial context.

---

## 3. Screen-by-screen

### Home — `/`
- **CTA:** tap the active trip hero; empty state: *Load sample travel data* / *Save a place*.
- **Above the fold:** date eyebrow + greeting title, one-line status ("You're in
  the middle of it."), `HomeTripHero` (photo, dates, people count, glance).
  Then "At a glance" 2-up grid: `HomeWeather` + `HomeSaveTile` (top-ranked rec
  via `rankOpportunities`).
- **Below:** `HomeNextUp`, `HomeLaterTrips`, `NearHome` (saved places near your
  position), "Future me · {city}" note.
- **Interactions:** sections toggled by `useHomeLayout` (`CustomizeHome`).
- **State:** trip section hidden while trips load (no skeleton); geolocation
  read only if permission already granted; `.rise` entrance animation.

### World — `/world`
- **CTA:** *Add a city or country* (`AddVisitedCity` sheet).
- **Above the fold:** `Globe` (countries shaded, admin-1 provinces from
  `public/geo/admin1/`, city pins); tap a country → selected pin card.
- **Below:** collapsible "Where you've been" `Section` — `Stat` tiles
  (Countries, Cities, …; editable via `useStatsLayout`), "countries as world
  share" toggle, info caveat about what numbers count.
- **State:** `empty.globe` Béa line when nothing visited.

### Trips — `/trips`
- **CTA:** **New trip** (primary) / *Join with a code*; secondary *Calendar view*.
- **Above the fold:** create/join panels expand inline (`.rise card-soft`),
  then `TripCard` list (photo, dates, glance, people).
- **Create form:** name (optional, auto-suggested "Lisbon, March"), segmented
  *One place / Several cities* (repeating city+date rows), `PlaceSearchInput`,
  `DateRangeField` with tentative status, budget switch, packing template select.
- **State:** `TripListSkeleton`; view-transition names so the card photo
  tweens into the trip banner.

### Trip — `/trips/$tripId` (`TripDetail.tsx`, ~1.9k lines)
- **Sticky:** `TripBanner` (compact: title, cities, dates, tentative flag, photo, companions).
- **Action pill row (horizontal scroll):** **Plan with Béa** · To do · ⚙ Settings · **+ Add stop** (primary).
- **Presence bar:** live "X is editing Y" / "You're the only one here" + avatars (Supabase Realtime presence).
- **Day strip:** `DaySelector` chips (ordinal, label, count).
- **Segmented perspectives** (`src/lib/trip-perspective.ts`): **Companion** | **Map** | **Timeline Editor**
  (default Companion if underway, else Timeline; remembered per trip).
  - *Companion:* `DayRibbon`, `JourneyTracker`, `StopPeek` (tap preview → Edit jumps to Timeline), `NowPanel`.
    Empty state offers day chips inline so it's never a dead end.
  - *Map:* `DayMapView` (Leaflet, one day, optional nesting) + `TripMap` (city-to-city, only when showing >1 day). Mounted only when visible.
  - *Timeline Editor:* "All Scheduled Stops" toolbar (All / Not visited (n); Timeline / Neighbourhood grouping), `Section "Your itinerary"` of `TimelineEntry` cards in `SwipeRow` (→ done, ← dock Save/Delete, long ← delete), `TravelConnector` between stops (walk/drive leg), `ItineraryDirections`, `TripPrep`. Stays mounted when hidden so in-progress edits survive.
- **Sheets (`Sheet.tsx`):** *Add to this trip* (stop / From Saved → `SavedPlacesSheet` / another city); `TimelineEntryForm`; *Plan with Béa* (`ItineraryImport`: **Import** — paste text, photos, PDF/ICS; **Optimize** — goals, budget level, day order; **Compare**); *Settings* sheet with accordion sections Invite · Packing · Offline · Budget · Cities · Customize · Edit details, plus delete/leave (`ConfirmSheet`).
- **State:** `TripDetailSkeleton`; distinct "This trip isn't here" state; background geocoding of stops/rows (silent, capped, throttle-aware); deletes are immediate with **Undo toast** (`useUndo`, sonner); haptic confirm.

### Recs — `/recommendations` (~1.2k lines)
- **CTA:** the single add field (`PlaceSearchInput` with type-ahead, paste-a-link, quick "Save").
- **Secondary:** *Add places you loved from your trips*; *Other ways to save* → I'm here now · link · manual · import a list (`RecoListImport`) · share (`ShareRecos`).
- **Draft card:** name + pin-type choice + chip-revealed optional fields (Category, Who told you, Note, City, Country, Address), auto-suggested travel tags.
- **List:** search (fuzzy), place filter chips, category chips — each shown only past a data threshold (`*WorthShowing`). Grouped by pin type in collapsible `Section`s; rows have `NearbyMapPin`, done action.
- **State:** `RowListSkeleton`, `empty.recs` Béa line, inline error text.

### You — `/profile`
Collapsible `Section`s: Profile settings (name, home city, dark mode) · Create
packing lists · What is kept on this phone (offline data) · Legal, privacy ·
Work travel → `/expenses` · Feedback. Account deletion requires typing
`DELETE`. Sample-data loader lives here too.

### Secondary screens
| Route | Header | Notes |
| --- | --- | --- |
| `/calendar` | "Plan it before you leave home." | month view of trips |
| `/memories` | "Every place, kept in one page." | per-city groups, future-note input, `ContentCardSkeleton` |
| `/photos` | "Import from your phone" | EXIF → places, fallback city/country fields, tap-to-remove |
| `/story` | "Your journey, played back." | animated history |
| `/expenses` | "Receipts, kept tidy" | first-run "Before you start" sheet, receipt OCR, home currency |
| `/preferences` | "Travel preferences" | countries, food, avoid lists; feed the optimiser/scoring |

---

## 4. Component & design-system anatomy

**Styling.** Tailwind CSS v4 (`@theme inline` in `src/styles.css`), OKLCH tokens,
light "warm cream/clay" + dark "warm charcoal" (`.dark`, boot script in
`lib/theme`). Fonts: **Manrope** (UI), **Instrument Serif** (`font-display`
titles/empty states).

| Token group | Values |
| --- | --- |
| Surface | `background`, `card` (lighter than ground), `elevated`, `popover` |
| Brand | `primary` clay `oklch(.535 .162 39)`, `primary-soft` tint, `--gradient-clay` |
| Semantic pins | `visited` (blue), `nexttime` (green, also "online"), `wishlist` (amber), `reco` (purple) |
| Per-tab accent | `[data-tab]` sets `--tab-hue` 39→79; `.tab-tint`, `.tab-ink`, `.tab-rule` |
| Radius | base `1.02rem`, scale sm→4xl |
| Shadow | soft, low-contrast `xs…lg`, `shadow-primary` |
| Motion | `--t-tap 120ms`, `--t-shift 200ms`, `--t-move 320ms`, `--t-arrive 420ms`; `--ease-standard/exit/confirm` |

Utility classes used everywhere: `card-soft`, `label-caps`, `rise`,
`section-stagger`, `plane-enter`.

**Core widgets.**
- Shell: `AppShell`, `PageHeader`, `PageGuide`, `Tour`, `SpotlightOverlay`.
- Overlays: `Sheet` (Béa's own: scrim, Esc, scroll-lock, `sm|md`, stackable `above`), `ConfirmSheet`; vendored `ui/sheet`, `ui/alert-dialog`, `ui/tooltip`, `sonner` toasts.
- Layout: `Section` (collapsible titled group with hint + action), `ContentCard`, `Skeletons`.
- Inputs: `PlaceSearchInput` (geocoder type-ahead, "near me", quick-add, save-typed), `DateRangeField` (+ tentative/firm), `DaySelector` chips, segmented radio groups (hand-rolled per screen), `ui/switch`, `ui/calendar`.
- Trip/day: `TripBanner`, `TripCard`, `HomeTripCard`, `DayRibbon`, `JourneyTracker`, `StopCard`, `StopPeek`, `NowPanel`, `TimelineCard` (`TimelineEntry`, `TravelConnector`), `SwipeRow`, `DayMap`/`DayMapView`/`TripMap` (Leaflet + Geoapify/OSM tiles), `BookingSheet`, `SavedPlacesSheet`, `CustomizeTrip`.
- Status: pin-type colour dots, "tentative" dates flag, presence avatars, online dot, "Not visited (n)" counts, stale-directions labels (`savedAgoLabel`).

**State management.** No global store. Per-feature hooks over Supabase
(`useTrips`, `useTripBoard`, `useRecommendations`, `useTripStops`, …) holding
local React state with reload-after-write; Realtime channels for trips
(`trips-sync`, `trip:{id}`, presence `trip-presence:{id}`). React Query is
provisioned but barely used (only `/profile`). Server work via
`createServerFn` in `src/lib/*.functions.ts` (geocode, directions, itinerary AI
via Gemini, receipts, weather, rates). View prefs persist per trip in
`localStorage`.

**Tap/keystroke cost of primary operations (best case).**
| Operation | Cost |
| --- | --- |
| Save a rec | type ~4–8 chars → pick suggestion → **Save** = **2 taps** |
| Create a trip | New trip → type city → pick → pick 2 dates → create ≈ **6 taps**, name optional |
| Add a timeline stop | Add stop → "A stop on the itinerary" → type → pick → (day/time chips) → add ≈ **4–6 taps** |
| Mark stop done | 1 swipe right (or 1 tap on card button) |
| Advance Companion | 1 tap ("I'm here" / "Leaving") |
| Join a trip | Join with a code → type code → join = **2 taps + code** |

---

## 5. UX friction & technical bottlenecks

**High cognitive load**
1. **Trip page chrome before content.** On a phone, before the first stop you
   pass: sticky banner, Béa note, 4-pill action row, presence bar, day strip,
   3-way segmented control, hint line, and (Timeline) a toolbar with two more
   segmented groups. ~7 control rows compete above the fold.
2. **Settings sheet is a catch-all**: invite, packing, offline, budget, cities,
   customize, edit details, delete — 7+ accordions in one sheet. "To do"
   opens yet another area (`TripPrep`), so trip-wide things live in two places.
3. **Small type and targets.** Toolbar text at 10–11.5px; header buttons 28–32px
   (`size-7`/`size-8`), perspective tabs ~28px tall — under 44px for on-the-go use.
4. **Recs filters appear/disappear with data volume** (`*WorthShowing`), so the
   screen reshapes as the vault grows; no sort control (grouped by pin type
   only; no "closest", "newest", "from whom").

**Fragmented workflows**
5. **Four ways to add to a trip**: Add stop sheet (3 branches), `TimelineEntryForm`,
   Plan with Béa → Import (paste/photo/PDF/ICS), and From Saved. Their outputs
   converge, but entry points and forms differ.
6. **Planner is a tabbed mega-sheet** (`ItineraryImport.tsx`, ~2k lines):
   Import / Optimize / Compare with long AI waits inside a modal; closing the
   sheet risks losing context.
7. **Secondary routes are orphaned from the tab bar** (calendar, memories,
   photos, story, expenses, preferences): no active tab, reachable only via
   in-page links; "Near" lives partly on Home, partly as a Recs concept.
8. **Two trip-creation paths for multi-city**: cities at create time *and* the
   Settings › Cities section later.

**Ambiguous status & feedback**
9. **Offline is mostly advisory.** Only a 6px dot signals offline; no write
   queue or service worker, so edits fail offline; offline directions/maps
   must be saved manually per trip in a Settings section. Idle sign-out (45 min)
   can hit a traveller mid-day.
10. **Silent background geocoding.** Stops/rows get placed quietly (capped,
    throttle-aware); unplaced ("stray") stops and failures aren't surfaced, so
    a missing map pin has no explanation.
11. **"Leave by" appears conditionally** (needs a clock time *and* a routed
    leg); when absent there's no explanation of why.
12. **Optimistic updates are patchy.** A shared pattern exists
    (`lib/optimistic.ts`: apply locally, roll back loudly) but only to-dos use
    it; most writes reload the board after the server round-trip, so on slow
    networks the list lags. Undo is post-hoc (row already deleted).
13. **Two auth gates** — client-side redirect in `AppShell` (plain "Loading…"
    text) and `beforeLoad` on `/_authenticated/*` — give different loading
    experiences for the same condition.
14. **Two sheet primitives** (`components/Sheet` vs vendored `ui/sheet`) and
    hand-rolled segmented controls per screen — inconsistent affordances risk.

**Suggested review focus:** trip-page above-the-fold hierarchy on a 375px
viewport; consolidating "add to trip" into one sheet; an explicit offline/sync
model; touch-target audit; Recs sorting and stable filter placement.
