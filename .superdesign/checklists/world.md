# World — function checklist

Every function the World tab (`/world`) had before the master rebuild. The
redesign keeps all of them. Sources: `src/routes/world.tsx`, `Globe.tsx`
(shared with the signed-out Home and Story), `AddVisitedCity.tsx`,
`ComparePins.tsx`, `Section.tsx`, `useStatsLayout`, `useVisitedProvinces`,
`world-visits.ts`.

## Header
- [x] Eyebrow/title "Your world"; summary line "N cities, N countries." (or Béa's world signature when empty)

## Empty state
- [x] With no visited places: Béa's `empty.globe` title and body

## Globe
- [x] Globe of visited places only (photos + visited recs)
- [x] City dots; province/state shading (admin-1, per country); country shading; country ring labels for country-only visits
- [x] Drag / fling to rotate, pinch / wheel / +/− to zoom, arrow keys, Home key resets, reset-view button
- [x] Tap a city pin → "You've been here" card (city, province, country, N places) with Close
- [x] Tap a country → opens one of your cities there (any language), while cities show
- [x] "+" button → Add cities or countries sheet

## Filters (the counts)
- [x] Cities / Provinces & states (only when any) / Countries counts, each a toggle filter of globe and list (tap again for everything); a non-city view closes the city card

## Where you've been list
- [x] Country rows with provinces line and city chips; list follows the filter
- [x] Tap a city chip → globe spins to it and selects it

## Travel statistics
- [x] Collapsible section
- [x] Countries (or % of the world, "x of 195" hint and sentence), Cities, Trips completed, Flights, Hotels, Restaurants (itinerary items), Travel days, Pins (all saved)
- [x] "?" note on what the numbers count, with You → Feedback link
- [x] "Choose stats": switch per stat, "Countries as a world share", Reset to default, feedback invitation linking to /profile
- [x] "Nothing selected" hint

## Add cities or countries sheet (AddVisitedCity)
- [x] One city: place search, Been there / Wishlist / Next time, When (month), Note, Add to my globe
- [x] Paste or upload a list: textarea, Upload a list (.txt/.md/.csv/.list), Look these up (paced), per row pick pin / Correct it / Skip / Include, Add N places
- [x] Country names saved as countries; saved message says where it went

## Help me choose (ComparePins)
- [x] Pick 2–5 saved places, priorities, month, Compare → Béa's comparison

## Guide anchors
- [x] data-guide: globe, add-city, places-list, travel-stats, compare-pins

## Where each lives after the master rebuild
- Map tab: globe (open variant, round locate/+/− controls), "Add places" button (data-guide add-city), filter pills, "You've been here" card, figures card, Add places card
- Bucket list tab: wishlist by country, "Open in Recs" / "Been there — put it on my globe" in ⋯, Add to bucket list / Add a destination (sheet opens on Wishlist), Help me choose
- Been there tab: filter pills, Where you've been rows (data-guide places-list); tap a row for its city chips, chip or pin → Map tab spun to it
- Stats tab: figures, flat map (expand → Map tab), travel lists, Add places card, Travel statistics (data-guide travel-stats) with every option
- Header search: finds your cities/countries and spins the globe to them
- The summary line "N cities, N countries." is kept for screen readers; the figures card shows the counts
- "From my trips" tile hidden: no such function exists yet
