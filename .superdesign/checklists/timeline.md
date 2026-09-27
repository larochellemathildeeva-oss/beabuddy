# Trip page — Timeline view: function checklist

Sources: `TripDetail.tsx` (timeline section), `day/TimelineCard.tsx`
(`TimelineEntry`, `TravelConnector`, inside pill/editor, place editor),
`ItineraryDirections.tsx`, `TimelineEntryForm.tsx`, `day/SwipeRow.tsx`.

## List header
- [ ] Stops scheduled · visited count
- [ ] All / Not visited (N)
- [ ] Timeline / Neighbourhood order (by day)
- [ ] All entries / By day
- [ ] Add (form) · Edit the itinerary / Done editing (every card's back at once)
- [ ] Optimize (planner, Optimize tab)
- [ ] Undo on the toast after a move / done / delete ("New order saved", "Back to the previous order")

## Stop card
- [ ] Front: time, name, where; number; Booked; done state; inside pill ("2 inside · 1 stop") with tick-off list
- [ ] Tap turns it over: name, note, day, time, stay, place (Change place / Set place), booking, detail
- [ ] Mark done · Save to your places · Locate on the map · Move earlier / later · Delete · Done
- [ ] Swipe right: done; swipe left: save / delete
- [ ] Add something to see inside this stop
- [ ] Add a stop between
- [ ] Now line on a travel day

## Between stops (TravelConnector)
- [ ] Walk / drive time and distance ("~" when estimated), or "Travelling to X" / "Not measured yet"
- [ ] Leave by (when the next stop has a time)
- [ ] Far-apart warning (a pin is probably wrong)
- [ ] Open in Maps; See / Hide directions with the steps, or the not-measured note

## Directions (ItineraryDirections)
- [ ] Get directions · Refresh · Keep on this phone / Kept on this phone · Add these legs to the timeline

## Not in the app (draft shows them)
- The small route map inside an open connector — new; left out for now.
- "Mostly flat" — Béa has no elevation data.
- Several tags per stop — the app has one kind per stop.
