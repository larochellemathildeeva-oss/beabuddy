# UI revamp — handoff for the agent applying it to the app

Read this whole file before writing any code. It is the brief.

## What is in this folder

| File | What it is |
| --- | --- |
| `mockup.html` | The approved clickable mockup. Open it in a browser. Self-contained (fonts and pictures are embedded). Left-hand controls switch screens, trip state (Upcoming / On trip / No trip), banner picture (Stops / Photo), Trips layout (Big banner / List) and the trip views bar (Top / Bottom / Side). The phone frame is 288 × 653 CSS px; multiply sizes by about 1.35 for a 390 px wide phone. |
| `trip-page-audit.html` | The UX audit of the trip page (Overview, Companion, Map, Timeline, Bookings) that led to the trip-page design. It lists the problems the redesign fixes. |
| `README.md` | This file. |

The mockup is **layout, hierarchy and flow**. It is not production code: it is plain HTML strings and global state, the data is invented, and every picture in it was generated as a placeholder.

## The one rule

**Nothing the app does today may be lost.** The mockup does not show every function. A function the mockup does not show stays, in the place that fits it best, styled like its neighbours. Removing or replacing a function needs the owner's explicit approval, in writing, before the change. This has gone wrong before: restyling must never become replacing.

How to keep that promise:

1. Every screen has a function checklist in `.superdesign/checklists/` (home, world, trips, companion, map, timeline, planner, todo-packing, trip-menu, recs, you, login). Before porting a screen, copy its checklist into your PR description and tick each item **only after you have clicked it in the running app**.
2. Read the screen's current component(s) end to end before changing them (see the mapping table below). The checklist can be out of date; the code is the truth.
3. Restyle inside the existing components where you can. Move a function rather than delete it.
4. Anything you are unsure about goes on a question list for the owner, not into code.

## Authority order (when sources disagree)

1. The owner's latest written decision (recorded under "Owner decisions" below).
2. `docs/VISUAL_NORTH_STAR.md` (palette, type, navigation, composition rules).
3. `mockup.html` (layout, hierarchy, flows).
4. `DESIGN.md`, `.impeccable/design.json`, existing implementation.

Behaviour: the repository decides what each page does (`AGENTS.md`, the checklists, the code).

### Known conflicts between the mockup and the north star — settle these first

| Topic | Mockup | `VISUAL_NORTH_STAR.md` | What to do |
| --- | --- | --- | --- |
| Accent colour | User's choice: **Pink** `#F6466E` (default) or **Periwinkle** `#6675FF` | Periwinkle only | **Owner decided (2026-10-03): the traveller chooses, pink by default.** Update the north star's palette section to match. |
| Fonts | Newsreader + Inter (stand-ins used in the mockup) | Instrument Serif + Manrope | Use the app's fonts (north star). Keep the mockup's sizes and weights as a guide. |
| Mascot | Dog head beside the "Béa." wordmark in every header; a generated "sitting dog with lemon bandana" on empty states and the landing page | "No mascot or decorative character should be invented. Use only approved Béa artwork" | The dog head is the existing logo (`src/assets/bea-logo.png`) and the owner asked for it in every header: keep it. Do **not** ship the generated sitting dog or the generated landing illustrations; use approved artwork or ask. |
| Pictures | Generated terrain, city maps, stop photos, faces | "Real content first … do not fabricate" | Use the app's real sources: your own photos, `banner-art.ts` scenes, Place Details / Wikimedia / Pexels photos (`stop-pictures.ts`, `PlacePicture.tsx`), the day map. New terrain art for Home/Trips needs owner-approved artwork. |
| Bookings | Lives inside Overview (Booked strip → Bookings page) | Lists Bookings as a trip perspective | **Owner decided (2026-10-03): Bookings goes inside Overview.** Keep every Bookings function; reach it from Overview's Booked strip and the trip menu. Update `trip-perspective.ts` accordingly (an old saved "bookings" preference must open Overview). |
| Themes | Colorful only | Calm, Colorful, Dark | Port Colorful first. Calm and Dark must keep working with the new layouts (tokens only, no hard-coded colours). |

## Owner decisions already made (do not re-litigate)

- Bottom bar: **Home · World · Trips · Recs · You**, five tabs. World and Trips are separate.
- Dog logo beside the "Béa." wordmark in every signed-in header; large on landing and sign-in.
- The trip view is called **Companion**. Never "Today", "Now" or "Day by day".
- Trip views: **Overview · Companion · Map · Timeline**. Bookings inside Overview.
- Views bar position is a user setting: **Top** (sticky under the banner), **Bottom** (floating above the main bar), **Side** (icon rail on the right, with labels for screen readers). Saved per device.
- Trip pictures are a user setting: **Stops** (illustration with the trip's route and stops) or **Photo**. Applies to every trip picture.
- Trips tab layout is a user setting: **Big banner** (next trip highlighted) or **List**.
- Home and the trip page: customizable modules, separate lists per trip state.
- Overview shows **trip progress by days and cities**; the day views show **progress by stops**, as named dots.
- Companion contains, in this order: compact itinerary ribbon (no part-of-day filters), current stop with Béa's one-line leave-by and the Leaving / I'm here button, next stop, a short summary of the rest of the day (Later today), Make the day easier.
- Béa says the leave time once (not twice).
- **Accent colour is the traveller's choice**, under You → Theme: **Pink** (default) or **Periwinkle**. Owner, 2026-10-03. Implement as tokens switched by an attribute on `<html>` (the mockup uses `data-accent`), saved with the account like the theme, and applied before first paint like `ACCESSIBILITY_BOOT_SCRIPT`. Every accent use goes through the tokens, never a literal colour:

  | Token | Pink | Periwinkle | Used for |
  | --- | --- | --- | --- |
  | `--acc` | `#F6466E` | `#6675FF` | primary buttons, live badges, current stop, active route |
  | `--acc2` | `#F24A70` | `#5C6CF5` | pins and route on maps |
  | `--acc-soft` | `#FDE3EA` | `#ECEEFF` | selected tabs, chips, bottom-bar bubble |
  | `--acc-done` | `#F59AB0` | `#B3BAFF` | done stops and days |
  | `--acc-line` | `#F3B6C5` | `#C5CBFF` | dashed lines between stops |
  | `--acc-track` | `#F3E4E8` | `#E3E6FF` | progress bar tracks |

  Check contrast for both: white text on `--acc` buttons must stay at least 4.5:1 at body size, or use bold 14+ (both accents pass for large or bold text). The danger red `#C22A52` and the blush pastel are separate from the accent and do not switch.
- **Calm's base colour is white:** app ground `#FFFFFF` in Calm (cards separate by hairline and shadow, not by a tinted ground). Owner, 2026-10-03.
- **Text sizes follow the mobile typography rules below** (owner, 2026-10-03).

## Design tokens (from the mockup; map them to the app's Colorful theme)

- Ground `#FCF9F4` in Colorful, `#FFFFFF` in Calm; cards `#FFFFFF` with `0 1px 10px rgba(80,60,40,.07)` and a 1px `rgba(255,255,255,.7)` edge; radius 16 (cards), 12–13 (small cards), 999 (pills).
- Ink `#111`; secondary text `#77736F`; hairlines `#F2EDE6`.
- Pastels: blush `#FDE3EA`, powder `#E9F1FC`, mint `#E3F3EF`, butter `#FEF3D5`, lavender `#F1ECFB` (use the north star's exact values).
- Page header pattern (Home, World, Trips, Recs, You, trip subpages): logo row (dog + "Béa." + coral dot) at top-left, 1–3 round white 30 px buttons top-right; a spaced-out uppercase kicker (7 px, letter-spacing 2px); a large serif title ending with a full stop ("Your world.", "Places worth remembering.").
- Trip banner pattern: full-bleed terrain or photo, haze at the top for the title, a white glowing route with labelled stops, current stop ringed, then a panel rising over it (radius 24 top corners).
- Floating bottom bar: white, 88% opacity with blur, radius 24, active tab in a soft accent bubble with icon + label.
- Text sizes in the mockup are for a 288 px frame. Scale up; keep the app's minimum 44 px touch targets and the reading-settings text scale (`text-scale-css.ts`).

## Type scale (owner decision, 2026-10-03)

Source: ["Guide for designing better mobile apps typography"](https://uxdesign.cc/guide-for-designing-better-mobile-apps-typography-5796495ef86f), which follows Apple (body at least 17pt), Material (body at least 16sp) and WCAG (18pt regular / 14pt bold counts as large text). Smaller text is only for captions the screen still makes sense without.

Sizes in CSS px at a 390 px wide phone (1 CSS px = 1 pt on iOS):

| Role | Size | Use |
| --- | --- | --- |
| Display title | 34–40, serif | Page titles ("Your world.", "Day 3 in Berlin.") |
| Section heading | 20–22, serif | "Later today", "Your days" |
| Card title | 17–18 | Stop and trip names |
| **Body** | **16 minimum**, 17 preferred | Descriptions, notes, form fields, button labels |
| Secondary / meta | 14 | Times, distances, dates under a title |
| Caption | 13 minimum | Kickers, badges, tab labels, map labels. Never the only place important information appears. |

- Nothing below 13. If something does not fit at these sizes, change the layout (wrap, stack, shorten the words), never shrink the text.
- Line height 1.4–1.5 for body text, about 1.1 for display titles. Body lines at most about 60–70 characters.
- Keep the app's Reading settings: every size is still written in px so `text-scale-css.ts` scales it.

The mockup was rescaled to these sizes (its 288 px frame is 390 / 1.354, so 16 there is about 11.8 px). Where a card's fixed height no longer fitted, the layout was changed, not the text.

## Screen-by-screen mapping

"Mockup" names refer to the JavaScript in `mockup.html` (search for them). "App" names are the files to change. "Checklist" is the function list to keep.

| Screen | Mockup | App | Checklist | Notes |
| --- | --- | --- | --- | --- |
| Landing (signed out) | `soHTML` (`SO.page='landing'`) | `src/routes/index.tsx` signed-out branch, `Globe.tsx` | login.md | Keep the signed-out globe and How it works link; north star: show Save → Plan → Travel → Remember. |
| Welcome / sign-in | `soHTML` (`'auth'`) | `src/routes/auth.tsx`, forgot/reset password | login.md | Google + email/password, terms. Keep every existing auth path and error. Utilitarian per north star. |
| First-use "What should Béa help with first?" | `soHTML` (`'onboard'`) | **new** | — | New screen; owner approved in the reference set. Each option deep-links (Plan → planner, Bring a plan → import, Save places → Recs, Map where I've been → World). Skippable; shown once. |
| Home, upcoming | `homeUpcoming`, then `renderModules` | `src/routes/index.tsx`, `HomeTripCard.tsx`, `CustomizeHome.tsx`, `HomeWeather.tsx`, `HomeSaveTile.tsx`, `NearHome.tsx` | home.md | Map with photo bubbles per city, stats strip (to-dos, flight, packed %), "Where to next?" search, Suggested for your trip, then the user's modules. Keep weather (with its ask-first location rules), Near home, Future me, sample data prompt, past trips. |
| Home, on trip | `tripHero('home')` | same | home.md, companion.md | Banner with route + Current stop / Next stop cards + pills, then modules. |
| Home, no trip | `tripHero('home')` when `state==='none'` | same | home.md | "Where to next?", saved cities as heart pins, Plan a trip. |
| Home modules | `MODULES`, `DEFAULTS`, `renderList` | `CustomizeHome.tsx` | home.md | Separate module lists per state; toggle + reorder; saved per account. Only modules backed by real data ship (see "Not real yet"). |
| World | `renderWBody`, `globeHTML`, `panelHTML`, `WMODS`, `openWSheet` | `src/routes/world.tsx`, `Globe.tsx`, `AddVisitedCity.tsx`, `ComparePins.tsx` | world.md | Map / Bucket list / Been there / Stats tabs, globe filters, place card, stats strip, Customize world. Keep province shading, drag/zoom, arrow keys, every stat option. |
| Trips | `renderTrips`, `featured`, `nextUpHTML`, `t4Row`, `vaultHTML`, `openTSheet` | `src/routes/trips.tsx`, `TripCard.tsx`, `TripBanner.tsx`, `DocumentVault.tsx`, `DateRangeField.tsx` | trips.md | Header art with trip tags, Upcoming/Past/Drafts/All, Plan with Béa + Join with a code, Big banner / List, Stops / Photo, Later, Past, Trip documents vault (12-character passcode rule stays). New trip / Join / Calendar sheets. |
| Trip page shell | `tripHero`, `trackerHTML`, `trTabs`, `setTabPos` | `src/components/TripDetail.tsx`, `trip-perspective.ts`, `day/StickyDayBar.tsx`, `TripBanner.tsx` | companion.md (top), trip-menu.md | Banner + progress tracker + pills + views bar. Tracker: days/cities on Overview, the day's stops elsewhere; tapping a dot opens that stop. |
| Overview | `trOverview` | `TripOverview.tsx`, `day/TripBookings.tsx`, `day/TripCheckup.tsx`, `day/PastYouCard.tsx` | companion.md, trip-menu.md | Right now (on trip) or Before you go, Your days cards, Booked strip → Bookings, missing-stay reminder, Saved for this trip. Keep Past you, find cities, essentials. |
| Companion | `trToday`, `ribbonHTML`, `restHTML`, `leaveLine` | `day/NowPanel.tsx`, `day/DayRibbon.tsx`, `day/JourneyTracker.tsx`, `day/StopPeek.tsx`, `day/CompanionBanner.tsx` | companion.md | Order fixed by the owner (see decisions). Keep rain notice + Make it easier, StayLine, place facts, journeys, "Not here yet", "Still there", Day done, empty states. Never open on "All". |
| Map | `trMap` | `day/DayMapView.tsx`, `day/DayMap.tsx`, `TripMap.tsx` | map.md | Map owns the screen; day chips float on it; stop card with prev/next pans the map; pull up for the day list; Whole trip view. Keep Split/Focus behaviour as the pulled-up list, nesting, credits (OSM, Geoapify, OpenFreeMap), offline tiles. |
| Timeline | `trTimeline` | `TripDetail.tsx` timeline section, `day/TimelineCard.tsx`, `ItineraryDirections.tsx`, `TimelineEntryForm.tsx`, `day/SwipeRow.tsx`, `day/SortableStops.tsx` | timeline.md | Lighter cards; Map/Directions move into each stop's ⋯; walk times on the dashed line; Edit day for reorder; one dismissible tip. Keep swipe actions, undo toasts, inside-pill, between-stop directions, Keep on this phone, add between. |
| Trip settings (⋯) | `PAGES.menu` | `day/TripMenuSheet.tsx`, `TripSettings.tsx` | trip-menu.md | Full page instead of a sheet: Plan / The trip / On this phone groups, Delete with an in-page confirm. |
| Ask Béa (in a trip) | `PAGES.ask`, `PAGES.review` | `PlanWithBea.tsx`, `ItineraryImport.tsx` (Optimize) | planner.md | Proposal → Review changes (MOVE / ADD list, booking-conflict check) → Apply / Keep; Undo after. Nothing changes before Apply. AI cost per `AGENTS.md` (`reserveAi`, `AI_COST`). |
| Plan with Béa (new trip) | `PAGES.plan` (`tab:'home'` list, then Plan / Optimize / Compare) | `src/routes/trips_.plan.tsx`, `ItineraryImport.tsx` | planner.md | Options list with pictures → existing Build / Import / Optimize / Compare flows, web-check note with Google's suggestions and sources, pin review, "Nothing here is reserved". |
| To do and packing | `PAGES.prep` | `TripPrep.tsx`, `TripTodos.tsx`, `PackingLists.tsx`, `PackingListView.tsx` | todo-packing.md | Before / During / Anytime grouping from due dates; every packing function. |
| Bookings | `PAGES.bookings` | `day/TripBookings.tsx`, `DocumentSheets.tsx` | — (read the component) | Filters, booked list, Not booked yet + Mark booked, add a booking document, "Fill in from this file". |
| Edit trip | `PAGES.edit` | `TripSettings.tsx`, `TripStops.tsx` | trip-menu.md | Name, starting city, status, cover, route & dates reorder, add destination, tentative, the "this can move days" warning. |
| People, Budget, Destinations, Currency, Offline, Customize | `PAGES.people` … `PAGES.custom` | `TripPeople.tsx`, `TripBudget.tsx`, `TripStops.tsx`, currency component, offline directions, `day/CustomizeTrip.tsx` | trip-menu.md | Same functions, page layout. |
| Stop page | `PAGES.stop` | `day/TimelineCard.tsx` back side, `day/DayEditSheet.tsx` | timeline.md | Name, time, stay, day, place (Change/Set), booking, note; Mark done, Save to places, Show on map, Directions, Delete. |
| Recs | `renderRecs` | `src/routes/recommendations.tsx`, `src/components/recs/*`, `RecoListImport.tsx`, `ShareRecos.tsx` | recs.md | One field for name or link first; lists All / Recs / Wishlist / Next time; Saved for the next trip; Recently saved. Keep city/category filters, Near me, import lists, share. |
| You | `renderYou` | `src/routes/profile.tsx`, `profile_.bea.tsx`, `preferences.tsx`, `profile_.documents.tsx` | you.md | Identity first, then Your Béa, preferences, Customize Home, packing, photos; Settings & storage; Theme; Help. Keep every row that exists today (documents, data, legal, sign out, erase…). |

### Not in the mockup — keep as they are, restyled with the same tokens

Calendar, Photos, Memories, Story, Expenses, Help, How it works, Privacy, Terms, Shared trip (`/shared/$token`), Preferences page, Your Béa page, Trip documents page, password recovery, PageGuide, offline indicator, idle logout, the Reading settings. North star "Product hierarchy by surface" says what each must feel like.

### Not real yet — do not ship as fake data

Mockup modules with invented content need a real source or must stay off: "Right now there" (live view), "Worth a detour", "Notes from Béa", "Group plans" faces, trip "Weather there", Suggested for your trip, the stats on World if the numbers are not computed. Each needs a data source decision from the owner.

## Order of work (one pull request per step)

Each PR: restyle + restructure only that screen, keep every checklist item, screenshots of before/after in the PR, owner approval before merging (bug-only fixes may merge on green CI, per `docs/UI_PORT_PLAN.md`).

0. **Tokens and shell.** Accent decision applied; tokens in `src/styles.css` for Colorful (Calm/Dark keep working); header pattern component (logo row, kicker, serif title); floating bottom bar in `AppShell.tsx`. No screen layout changes yet.
1. **Trip page shell.** Banner + tracker + pills + views bar with Top/Bottom/Side; Bookings folded into Overview (`trip-perspective.ts`).
2. **Companion.**
3. **Overview.**
4. **Map.**
5. **Timeline.**
6. **Trip settings, Ask Béa / review, Edit trip, To do & packing, Bookings, stop page.**
7. **Trips tab.**
8. **Home** (three states + modules).
9. **World.**
10. **Recs, You.**
11. **Landing, sign-in, first-use.**
12. Everything in "Not in the mockup", restyled.

## Test gate before every push (from `AGENTS.md`)

```
npm run typecheck
npm run lint            # 0 errors
npm test
npm run build
npm run check:public-secrets
npm run preview:check   # see below
npm run audit:ci        # if the import, place lookup or plan reading is touched
```

**`npm run preview:check` is broken on `main` today** (found during the audit): the bundle fails on server-only imports (`node:crypto`, `node:dns`, `node:buffer`, `undici`, `string_decoder`, `?url` imports), `scripts/preview/src/main.tsx` imports `HomeNextUp` / `HomeLaterTrips` which no longer exist, `fake-place-details.ts` lacks `townPhoto`, the fake `createServerFn` returns `{}` (which crashes `rainNotice` on an undefined `utcOffsetSeconds`), and the tab click-through still expects a "Map" tab name it cannot find. Fix the harness first (step 0): stub `node:*` and those packages in the esbuild config, update the stale imports, return `null` from the fake server functions, and click tabs by their current labels. It is the only automated proof that every control still does something.

## Done means

- Every checklist item ticked in the running app, per screen.
- `preview:check` clicks every control on every trip view with 0 problems, in Calm, Colorful and Dark.
- Screenshots side by side with `mockup.html` and the approved Home and World references.
- No function removed without the owner's written approval.
- Migrations: none are needed for layout. Any new setting (views bar position, trip pictures, Trips layout, module lists) is per device (localStorage) or reuses existing account settings; if one needs a column, write the migration with grants per `AGENTS.md` and say plainly it must be applied by hand.
