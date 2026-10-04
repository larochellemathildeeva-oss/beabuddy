This is step 3, Overview. The trip shell and Companion stay as they are. Overview is now the mockup’s order: Before you go while the trip is still ahead, Right now while it is underway, then the days, the Booked strip, a missing stay, and places already saved for the trip.

Bookings stay inside Overview. The list opens from the Booked tiles and from All bookings. Past you, find cities, and the essentials (to-do, packing, timeline, map, travel documents) stay. Trip checkup stays in the trip menu.

`package.json` version remains 6.15.7.

## Phone screenshots (390 × 844)

These render the real components with the repository’s preview fixture and the app’s fonts and artwork. Before is main. After is this branch. No mockup pictures or example copy were copied into the app. The fixture trip is still ahead, so these four show Before you go. Right now is the same screen once the trip has started; that shot sets the clock to the trip’s first day so the underway card can be seen.

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/before-overview-calm.png) | ![After Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/after-overview-calm.png) |
| Colorful · Pink | ![Before Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/before-overview-colorful-pink.png) | ![After Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/after-overview-colorful-pink.png) |
| Colorful · Periwinkle | ![Before Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/before-overview-colorful-periwinkle.png) | ![After Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/after-overview-colorful-periwinkle.png) |
| Dark | ![Before Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/before-overview-dark.png) | ![After Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/after-overview-dark.png) |

Right now, Colorful · Pink, clock on the trip’s first day: ![Right now](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-3-2581/.superdesign/handoff/ui-revamp-step-3/after-overview-right-now-colorful-pink.png)

## Validation

- Typecheck, lint (0 errors; 15 existing warnings), tests (1,925 passing), production build, and public-secrets check pass.
- `audit:ci` was not run. Import, place lookup, and plan reading were not changed.
- Full preview gate passes in Calm, Colorful, and Dark: 133 controls clicked per theme, zero problems.
- Browser checks at 390px in the preview app. The preview selector for the bookings disclosure now looks for All bookings, which is the label on screen.
- The nine phone screenshots were taken locally at 390×844. They could not be stored through the GitHub text API, which writes file bodies as UTF-8, so the image links above will not load until the PNG files are added under `.superdesign/handoff/ui-revamp-step-3/`.

## What was clicked, and what was not

Clicked on Overview: trip name, Hiroshima, the dates, Flying solo, Béa’s leaving line, Plan with Béa, To do, Add stop, the trip menu, Before you go (To-do, Flight, Packing), Find cities, See on map (Map becomes selected), a day card (Timeline becomes selected), the Timeline and Map essentials, the Booked tiles (each sets that filter), Add on the missing-stay note, Travel docs, See all and a saved place, All your memories, All bookings and the Flights / Stays / Transport / Activities / All filters, and a not-booked row (the booking sheet opens on Arrive Hiroshima Station). With the clock on the first trip day, Overview shows Right now (You are here, Peace Memorial Museum, the next stop) and Open Companion selects Companion.

Clicked in the trip menu: Edit trip (name JQAPALA A, dates, Tentative / Confirmed, Upcoming / In progress / Past, Save changes), Create an invite code, Revoke this code, the only-person line, Track a budget and Set a budget, Destinations (Hiroshima, and find cities from the stops), Packing (no saved lists on this fixture), Offline maps (the download copy), Customize view (the itinerary-ribbon switch flips), Delete trip (the confirm says “Delete this trip?”; Escape leaves the trip in place). On the guest sample, Leave trip opens “Leave this trip?”.

Clicked on Companion enough to keep the shared checklist honest: Day 1, “stops reached”, Leave by, Later today, Not here yet, and the empty trip’s “Nothing on this trip yet.”

Not on screen, so those rows stay open:

- “Sam is here” / “Sam is editing”. The only-one line was on screen.
- Rain. The preview forecast stub returns nothing.
- Leaving, Still there, I’m here, Navigate, Show all / Show fewer, the tracker, the ribbon cards, and StopPeek. Those belong to Companion and were not the state on screen in this pass. The preview gate still clicks every visible Companion control.
- Remove member. The owner fixture has only you. The guest fixture offers Leave, not Remove.
- “Choose a list…”. This fixture has no packing lists, so Packing shows the empty sentence.
- Walk / Drive and Delete saved directions. Offline maps explains the download. Nothing is saved yet, so delete is not offered. Walk and Car live on Directions between stops.
- “Pick a day to follow.” The empty sample shows “Nothing on this trip yet.”

## Preservation checklist

Quoted from `.superdesign/checklists/companion.md` and `.superdesign/checklists/trip-menu.md`. A box is ticked only when that row was exercised in the running preview. Rows that include a control or sentence that did not appear stay open.

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
- [ ] Presence: "You're the only one here right now" / "Sam is here" / "Sam is editing …", avatars
- [x] Companion / Map / Timeline Editor switch, with the view's hint line
- [x] Day selector (days with counts, today marked)

## Companion
- [x] "N of M stops reached"
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

The stops count is the progress line (“10 entries”, “1/10 stops reached”). “You're the only one here right now” was on screen. Leave by and Not here yet were on Companion. The empty trip showed “Nothing on this trip yet.”

# Trip menu (⋯): function checklist

Source: the settings `Sheet` in `TripDetail.tsx`, `TripSettings.tsx`,
`TripPeople.tsx`, `TripBudget.tsx`, `TripStops.tsx`, `day/CustomizeTrip.tsx`.

- [x] Plan with Béa (planner) · To do (to-dos and packing) · Add stop — moved here from the trip page's pill row
- [x] Edit trip: name, starting city, dates (fixed / tentative), status (Upcoming / In progress), Save changes
- [ ] Invite and people: invite code, revoke, members, remove member, Leave trip (non-owners)
- [x] Budget: on/off switch, the budget itself
- [x] Destinations: the trip's cities in order (TripStops)
- [ ] Packing: attach a copy of a packing list ("Choose a list…")
- [ ] Offline and directions: Walk / Drive, Download / Refresh directions, saved-when and out-of-date note, a map of each day kept on the phone, Delete saved directions
- [x] Customize trip page: the page's on/off switches (ribbon, tracker, nesting, walk times …), saved on this device
- [x] Delete trip (owner only, with "Delete this trip?" confirm)

Plan with Béa, To do, and Add stop are still the pills on the trip page. Invite: a code was created and revoked, and the member line was on screen. Leave trip was clicked on the guest sample and the confirm opened. Remove was not offered. Packing showed “No saved lists yet”. Offline maps was opened; Walk / Car and Delete saved directions were not on that sheet.

## Questions

1. The Booked tiles stay Flights, Stays, Transport, and Activities. The mockup’s example tiles say Trains, Tables, and Tickets. I kept the app’s four kinds. Should any kind be renamed?
2. Right now does not repeat a leave-by time. Companion already says the real one, and a guessed time would be invented. Should Overview repeat a saved leave-by when there is one?
3. Saved for this trip and Past you both list unvisited saved places in the trip’s cities. I kept both. Should one of them drop that list?
4. Day cards use the city’s banner illustration, and they hide when pictures are off. The trip-wide Stops / Photo choice in the README is not in the app yet. Is banner art the right picture until that setting exists?
5. Trip checkup stays in the trip menu. Step 6 is the full Bookings and settings pass. Should a short checkup also sit on Overview?
6. The disclosure that opens the bookings list used to say “Booked · N”. It now says “All bookings”, with the count beside it, because the strip above is already titled Booked. Is that the right label?
7. The heading under the list stays “On the itinerary, not booked yet”. The mockup shortens that to “Not booked yet”. I kept the app’s sentence. Should it change?
8. The trip page is the same screen, split into modules under `src/components/trip-detail/` so the source could be committed in pieces that stay typechecked. Nothing was removed. Should it be folded back into one `TripDetail.tsx`?
