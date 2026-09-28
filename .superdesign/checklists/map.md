# Trip page — Map view: function checklist

Sources: `TripDetail.tsx` (map section), `day/DayMapView.tsx`, `day/DayMap.tsx`, `TripMap.tsx`.

## Both layouts
- [ ] Split / Focus switch, remembered per device
- [ ] Pins numbered like the day's cards; soft dotted arc between them (never a route)
- [ ] Places inside another shown nested ("In …"), unless Customize turns nesting off
- [ ] OpenStreetMap + Geoapify credit on the map
- [ ] "Nothing to put on the map yet." / "No stop on this day has a location yet."
- [ ] Whole trip selected: one map per day in Split, plus the city-to-city TripMap
- [ ] "Locate on map" from the Timeline opens here on that stop

## Focus (the draft's "Live")
- [ ] Map fills the screen under the header; follows the chosen stop
- [ ] Whole day (fit), numbered strip to jump to any stop
- [ ] Stop card: number, time, ~stay, Booked, previous / n of N / next, swipe to step
- [ ] Kind mark, title, address, nesting line
- [ ] "Then {next}, about N min walk" (as the crow flies), Open in maps

## Split
- [ ] Per day: header (Day N, date, stops, about distance), Béa's note
- [ ] Rail of stops with times, legs between, Booked, "Not on the map yet", Show on the map, Open in maps
- [ ] Fit route; tap a card ↔ pin

## Not in the app (draft shows them)
- Zoom + / − buttons — pinch only today; easy to add.
- Locate me and full-screen buttons — new; left out.
- Leave by / Béa says on the map card — those belong to Companion.
