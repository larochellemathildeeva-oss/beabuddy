The trip page now has four views — Overview, Companion, Map and Timeline — with Bookings inside Overview. Its shared banner keeps the trip and selected-day data, the app's own art and photo preference, and dog/Béa identity. Progress shows days and cities on Overview and named stops on day views. The views bar can sit at Top, Bottom or Side, saved on this device.

Only UI revamp step 1. Plan with Béa, To do, Currency, Add stop, presence, pin checks, city/day choices, all booking filters and saves, documents and every existing menu section remain wired to their existing components and callbacks. Companion/Overview/Map/Timeline content and the trip menu redesign are reserved for their later steps. `package.json` version remains 6.15.4.

## Phone screenshots (390 × 844)

These render the real components inside AppShell with the repository's existing deterministic preview fixture and app fonts/artwork. Before renders main's source; after renders this branch. No mockup pictures or example data were copied into production.

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/before-trip-calm.png) | ![After Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/after-trip-calm.png) |
| Colorful · Pink | ![Before Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/before-trip-colorful-pink.png) | ![After Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/after-trip-colorful-pink.png) |
| Colorful · Periwinkle | ![Before Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/before-trip-colorful-periwinkle.png) | ![After Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/after-trip-colorful-periwinkle.png) |
| Dark | ![Before Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/before-trip-dark.png) | ![After Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-1/.superdesign/handoff/ui-revamp-step-1/after-trip-dark.png) |

## Validation

- Typecheck, lint (0 errors; 15 existing warnings), tests (1,922 passing), production build, public-secrets and migration checks pass.
- Frozen import/place audit passes with zero external/paid calls and no pin regression. Import/place lookup code was not changed.
- Full preview gate passes in Calm, Colorful and Dark: 129 controls clicked per theme, zero problems. See `preview-report.json` alongside the screenshots.
- Browser checks: all three bar positions restore after reload and stay clear of the main navigation; all four view labels; legacy Bookings preference opens Overview; Overview and menu booking filters; tracker dots open StopPeek from every day view.
- Click review at 320px and 390px, 135% reading size, Calm/Colorful/Dark and both accents: captions ≥13px and bar buttons ≥44px, without horizontal page overflow.

## Preservation checklists

Quoted from `.superdesign/checklists/`. Checked items were reviewed and clicked in the running component preview. Later-step content remains unchecked. Menu destinations were opened in every appearance; their deeper mutation and account workflows were not fully exercised, so those full rows are deliberately unchecked. The checklists predate some current features (including stop photos); those newer controls/data paths remain intact as well.

# Trip page — Companion view: function checklist

Every function the trip page's top and its Companion view have today. The
redesign (ChatGPT draft, adapted) keeps all of them, with the app's lucide
icons. Sources: `TripDetail.tsx`, `day/NowPanel.tsx`, `day/JourneyTracker.tsx`,
`day/DayRibbon.tsx`, `day/StopPeek.tsx`, `DaySelector.tsx`.

## Top of the trip page
- [x] Trip name, place, dates (tentative marked), companions line
- [x] Béa's line about the trip (beaTripNote)
- [x] Plan with Béa → planner (Import / Optimize / Compare)
- [x] To do → to-dos and packing
- [x] Trip settings (gear) → the settings sheet
- [x] Add stop → add a stop, saved place or city
- [x] Entries · stops count
- [x] Presence: "You're the only one here right now" / "Sam is here" / "Sam is editing …", avatars
- [x] Companion / Map / Timeline Editor switch, with the view's hint line
- [x] Day selector (days with counts, today marked)

## Companion
- [ ] "N of M stops reached"
- [ ] Rain likely later today (Open-Meteo credit), only when it is
- [ ] Current stop: time, title, address, planned stay / time left (StayLine), Leave by, **Leaving**, **Not here yet**
- [ ] Between stops: "Left X" + **Still there**
- [ ] Next stop ("First up" / "Up next stop" / "On the way to"): time, title, address, place facts (opening hours etc.), leave-by line ("Time to leave", "Be there by"), journey (walk/drive, minutes, distance, same spot), "Working out the journey…", not-on-map note, **I'm here**, **Open in maps**
- [ ] Day done: "That's the day." + reached / skipped
- [ ] Later: time + title, "Show all N" / "Show fewer"
- [ ] Live Journey Tracker: numbered stops, done ticked, current ringed, skipped marked; tap to look
- [ ] Day ribbon (Customize → on/off): swipe cards, part-of-day filters, Current / Next / Skipped tags; tap to look
- [ ] Looking at a stop (StopPeek): Back to now, Open in Maps, Edit in Timeline Editor
- [ ] Empty: "Nothing on this trip yet." / "Pick a day to follow." with day buttons

## Not in the app (draft shows them)
- Stop photos — the app has none; the stop's kind icon stands in.
- Weather icon on the day banner — the app only has the rain notice.

# Trip menu (⋯): function checklist

Source: the settings `Sheet` in `TripDetail.tsx`, `TripSettings.tsx`,
`TripPeople.tsx`, `TripBudget.tsx`, `TripStops.tsx`, `day/CustomizeTrip.tsx`.

- [ ] Plan with Béa (planner) · To do (to-dos and packing) · Add stop — moved here from the trip page's pill row
- [ ] Edit trip: name, starting city, dates (fixed / tentative), status (Upcoming / In progress), Save changes
- [ ] Invite and people: invite code, revoke, members, remove member, Leave trip (non-owners)
- [ ] Budget: on/off switch, the budget itself
- [ ] Destinations: the trip's cities in order (TripStops)
- [ ] Packing: attach a copy of a packing list ("Choose a list…")
- [ ] Offline and directions: Walk / Drive, Download / Refresh directions, saved-when and out-of-date note, a map of each day kept on the phone, Delete saved directions
- [ ] Customize trip page: the page's on/off switches (ribbon, tracker, nesting, walk times …), saved on this device
- [ ] Delete trip (owner only, with "Delete this trip?" confirm)

## Questions

No product questions. Live Supabase/account mutations were not performed; browser verification uses the existing preview adapters, and backend data paths were left intact.
