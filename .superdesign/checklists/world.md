# World — function checklist

Every function the World tab (`/world`) had before the master rebuild. The
redesign keeps all of them. Sources: `src/routes/world.tsx`, `Globe.tsx`
(shared with the signed-out Home and Story), `AddVisitedCity.tsx`,
`ComparePins.tsx`, `Section.tsx`, `useStatsLayout`, `useVisitedProvinces`,
`world-visits.ts`.

## Step 9 (World restyle), checked in the preview build

Ticked only for controls clicked in `npm run preview:check` (`world:` flow, three themes). Unticked = kept in the code, not clicked this time.

## Header
- [ ] Kicker "Places you've been, and all that's still ahead.", title "Your world."; summary line "N cities, N countries." (screen readers; or Béa's world signature when empty)

## Empty state
- [ ] With no visited places: Béa's `empty.globe` title and body

## Globe
- [ ] Globe of visited places only (photos + visited recs)
- [ ] City dots; province/state shading (admin-1, per country); country shading; country ring labels for country-only visits
- [ ] Drag / fling to rotate, pinch / wheel / +/− to zoom, arrow keys, Home key resets, reset-view button
- [x] Tap a city pin → "You've been here" card (city, province, country, N places) with Close
- [ ] Tap a country → opens one of your cities there (any language), while cities show
- [x] "+" button → Add cities or countries sheet

## Filters (the counts)
- [x] Cities / Provinces & states (only when any) / Countries counts, each a toggle filter of globe and list (tap again for everything); a non-city view closes the city card

## Where you've been list
- [ ] Country rows with provinces line and city chips (shown under each country, no tap to open); list follows the filter
- [x] Tap a city chip → globe spins to it and selects it

## Travel statistics
- [x] Collapsible section
- [ ] Countries (or % of the world, "x of 195" hint and sentence), Cities, Trips completed, Flights, Hotels, Restaurants (itinerary items), Travel days, Pins (all saved)
- [x] "?" note on what the numbers count, with You → Feedback link
- [x] "Choose stats": switch per stat, "Countries as a world share", Reset to default, feedback invitation linking to /profile
- [ ] "Nothing selected" hint

## Add cities or countries sheet (AddVisitedCity)
- [ ] One city: place search, Been there / Wishlist / Next time, When (month), Note, Add to my globe
- [ ] Paste or upload a list: textarea, Upload a list (.txt/.md/.csv/.list), Look these up (paced), per row pick pin / Correct it / Skip / Include, Add N places
- [ ] Country names saved as countries; saved message says where it went

## Help me choose (ComparePins)
- [x] Pick 2–5 saved places, priorities, month, Compare → Béa's comparison

## Guide anchors
- [ ] data-guide: globe, add-city, places-list, travel-stats, compare-pins

## Where each lives after the master rebuild
- Map tab: globe (open variant, round locate/+/− controls), "Add places" button (data-guide add-city), filter pills, "You've been here" card, figures card, Add places card
- Bucket list tab: wishlist by country, "Open in Recs" / "Been there — put it on my globe" in ⋯, Add to bucket list / Add a destination (sheet opens on Wishlist), Help me choose
- Been there tab: filter pills, Where you've been rows (data-guide places-list); tap a row for its city chips, chip or pin → Map tab spun to it
- Stats tab: figures, flat map (expand → Map tab), travel lists, Add places card, Travel statistics (data-guide travel-stats) with every option
- Header search: finds your cities/countries and spins the globe to them
- The summary line "N cities, N countries." is kept for screen readers; the figures card shows the counts
- "From my trips" tile hidden: no such function exists yet
