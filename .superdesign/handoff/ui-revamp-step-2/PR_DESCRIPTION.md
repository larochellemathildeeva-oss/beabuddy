This finishes Companion. Pull request 247 restyled the ribbon, the tracker, stop peek, and follow along. The Companion screen itself was still the previous layout. This puts it in the owner’s order: compact itinerary ribbon, current stop with a leave-by clock of its own, next stop, a short Later today summary, and Make the day easier.

Leave by is a round clock and the time in large numerals at the top of “You are here”, so it can be seen without reading Béa’s sentence. Béa still says the time. The rain notice keeps one action, “Substitute outdoor stops”. “Move indoors” stays under Make the day easier. Rain, StayLine, place facts, journeys, Not here yet, Still there, day done, and the empty states stay. The trip shell from step 1 is unchanged.

`package.json` version remains 6.15.6.

## Phone screenshots (390 × 844)

These render the real components inside AppShell with the repository’s existing preview fixture and the app’s fonts and artwork. Before is main. After is this branch. No mockup pictures or example copy were copied into the app.

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/before-companion-calm.png) | ![After Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/after-companion-calm.png) |
| Colorful · Pink | ![Before Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/before-companion-colorful-pink.png) | ![After Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/after-companion-colorful-pink.png) |
| Colorful · Periwinkle | ![Before Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/before-companion-colorful-periwinkle.png) | ![After Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/after-companion-colorful-periwinkle.png) |
| Dark | ![Before Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/before-companion-dark.png) | ![After Dark](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-2-finish-2581/.superdesign/handoff/ui-revamp-step-2/after-companion-dark.png) |

## Validation

- Typecheck, lint (0 errors; 15 existing warnings), tests (1,922 passing), production build, and public-secrets check pass.
- `audit:ci` was not run. Import, place lookup, and plan reading were not changed.
- Full preview gate passes in Calm, Colorful, and Dark: 129 controls clicked per theme, zero problems.
- Browser checks at 390px in the preview app. Click log: `click-review.json` and `click-review-extra.json` beside this file.

## What was clicked, and what was not

Clicked in the running preview: Companion tab (label is Companion), Day 1 and Day 2, Plan with Béa, To do, Add stop, Trip menu, Leaving, Not here yet, I’m here, Still there, Navigate, a ribbon card (StopPeek, Back to now), a tracker stop (Open in Maps, Edit in Timeline), Show all / Show fewer, Less walking, Map, Timeline, Overview, Whole trip “Pick a day to follow.” (two day buttons; picking one closes the prompt), and the empty trip “Nothing on this trip yet.” Walked I’m here / Leaving until “That’s the day.” / “Every stop reached.” and “Make Thu, Oct 8 easier”. The other day-done sentence, about stops skipped along the way, was not the one on screen. On the unpinned sample, after Not here yet: opening hours, a closed warning, the website, and “Be there by”. The leave-by clock is on the current stop, above the place name and above Béa’s sentence. Béa still says the time. StayLine showed “Here 40 min”. “You're the only one here right now” was on screen.

Not on screen, so those rows stay unticked:

- Rain likely later today. The preview forecast stub returns nothing.
- “Working out the journey…” and “isn’t on the map yet”. The fixtures resolved the journeys.
- A skipped stop. Sequential I’m here / Leaving reached every stop, so the dashed skipped mark was not shown. The tracker still marks done and the current stop, and a tap still looks.
- Part-of-day filters. They are not on the ribbon. That was an owner decision, recorded below.

## Preservation checklist

Quoted from `.superdesign/checklists/companion.md`. A box is ticked only when that row was exercised in the running preview. Rows that include a control or sentence that did not appear stay open.

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
- [x] Current stop: time, title, address, planned stay / time left (StayLine), Leave by, **Leaving**, **Not here yet**
- [x] Between stops: "Left X" + **Still there**
- [ ] Next stop ("First up" / "Up next stop" / "On the way to"): time, title, address, place facts (opening hours etc.), leave-by line ("Time to leave", "Be there by"), journey (walk/drive, minutes, distance, same spot), "Working out the journey…", not-on-map note, **I'm here**, **Open in maps**
- [x] Day done: "That's the day." + reached / skipped
- [x] Later: time + title, "Show all N" / "Show fewer"
- [ ] Live Journey Tracker: numbered stops, done ticked, current ringed, skipped marked; tap to look
- [ ] Day ribbon (Customize → on/off): swipe cards, part-of-day filters, Current / Next / Skipped tags; tap to look
- [x] Looking at a stop (StopPeek): Back to now, Open in Maps, Edit in Timeline Editor
- [x] Empty: "Nothing on this trip yet." / "Pick a day to follow." with day buttons

## Not in the app (draft shows them)
- Stop photos — the app has none; the stop's kind icon stands in.
- Weather icon on the day banner — the app only has the rain notice.

The next-stop row was partly exercised: First up, On the way to, Next stop, time, title, address, hours, a closed warning, Be there by, the walk time and distance, I’m here, and Navigate. “Time to leave”, “Same spot”, “Working out the journey…”, and the not-on-map sentence did not appear. The maps control still says Navigate.

The tracker was tapped. Numbered stops, done ticks, and the current ring were on screen. A skipped mark was not.

The ribbon switch still turns the strip on and off. Cards were swiped by tap, Current was on screen, and a tap opened the stop. Part-of-day filters are gone from the strip. Done and Skipped tags are in the component; this fixture did not leave a skipped card on screen. The switch was opened from Customize view.

“Sam is here” / “Sam is editing” was not in this fixture. The only-one line was.

## Decided

1. The ribbon does not have part-of-day filters. They do not move somewhere else. `partOfDay()` stays in the library.
2. Ribbon cards do not repeat the address or the planned stay. Opening a card shows the address on that stop.
3. The itinerary ribbon defaults to on. Customize view can turn it off, and a saved account preference still wins.
4. The next stop’s maps control stays “Navigate”. StopPeek stays “Open in Maps”.
5. Between stops, the control stays “Still there”.
6. The rain notice stays, with one action: “Substitute outdoor stops”. “Move indoors” remains under Make the day easier.
7. Ribbon tags keep the check mark: “✓ Done” and “✓ Booked”.
8. Leave by stays on the current stop as its own clock icon and large time, so it can be seen without reading Béa’s sentence. Béa still says the time.

## Questions

None. The decisions above are already answered.
