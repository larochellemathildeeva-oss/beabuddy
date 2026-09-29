# Trip page — Companion view: function checklist

Every function the trip page's top and its Companion view have today. The
redesign (ChatGPT draft, adapted) keeps all of them, with the app's lucide
icons. Sources: `TripDetail.tsx`, `day/NowPanel.tsx`, `day/JourneyTracker.tsx`,
`day/DayRibbon.tsx`, `day/StopPeek.tsx`, `DaySelector.tsx`.

## Top of the trip page
- [ ] Trip name, place, dates (tentative marked), companions line
- [ ] Béa's line about the trip (beaTripNote)
- [ ] Plan with Béa → planner (Import / Optimize / Compare)
- [ ] To do → to-dos and packing
- [ ] Trip settings (gear) → the settings sheet
- [ ] Add stop → add a stop, saved place or city
- [ ] Entries · stops count
- [ ] Presence: "You're the only one here right now" / "Sam is here" / "Sam is editing …", avatars
- [ ] Companion / Map / Timeline Editor switch, with the view's hint line
- [ ] Day selector (days with counts, today marked)

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
