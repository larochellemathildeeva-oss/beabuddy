# Trips — function checklist

Every function the current Trips page (`/trips`) has. The redesign keeps all
of them, with the app's lucide icons. Sources: `src/routes/trips.tsx`,
`TripCard.tsx`, `TripBanner.tsx`, `DocumentVault.tsx`, `DateRangeField.tsx`,
`PlaceSearchInput.tsx`, `Skeletons.tsx`.

## Header
- [x] Eyebrow "Trip folders", title "Everything, already filed."
- [x] "Calendar view" → /calendar

## Actions (signed in)
- [x] "New trip" toggles the new-trip form (closes Join)
- [x] "Join with a code" toggles the join form (closes New trip)
- [x] Error line under the forms

## New trip form
- [x] Trip name (placeholder = Béa's suggested name) + "No name needed — Béa will file this as “…”"
- [x] One place / Several cities switch
- [x] One place: "Where to — search it" place search
- [x] Dates (range picker) with fixed / tentative dates
- [x] Several cities: numbered city rows (search + "Dates in {city}" + remove X), "These dates fall outside the trip's.", "Add another city"
- [x] "End date can't be earlier than the start date."
- [x] "Attach a copy of a packing list" (select, "No packing list", note about copies) — only if you have packs
- [x] "Track a budget for this trip" checkbox
- [x] Still-editable note
- [x] "Create trip" (disabled until valid) → opens the new trip

## Join form
- [x] "Invite code" (uppercase, spaced) + "Join trip" (needs 4+ characters) → opens the trip

## Trip list
- [x] Loading skeletons
- [x] Trip cards → trip page:
  - [x] Banner: your photo (credit line) or painted scene; pill (countdown / live / planning); people count; places · dates; title; corner "N stops · Nd"
  - [x] Current leg ("Now · Lisbon")
  - [x] Live strip: "Live · Stop 2 of 5 · Now: …"
  - [x] Facts: First/Next flight (or "None saved yet · Add it to the itinerary"), Stay, Packing (x/y + bar) or First stop, To do (N open, due line)
  - [x] Or "N places so far. Nothing on the timeline yet." / "Open it to start planning."
  - [x] Béa's quote + "View itinerary →"
- [x] Empty state: Béa line (empty.trips)

## Signed out
- [x] "Sign in to start a trip." + note + sign-in link

## Trip documents (vault)
- [x] "Trip documents" · "Encrypted on this device"
- [x] Signed out: "Trip confirmations & tickets" + "Sign in to set up your vault"
- [x] No vault: "Set a vault passcode" — passcode, repeat, create
- [x] Locked: "Vault locked" — passcode, unlock
- [x] Unlocked: list of documents (label, kind, expiry, open, remove), Lock
- [x] Add a document: kind chips, label, confirmation / reference, date, notes, file (image or PDF), save / cancel

## Built (Trips v3)
- Tall illustrated banner (`TripBanner variant="feature"`), your photo first,
  else the scene for the place (`src/lib/banner-art.ts`) in the theme's colours.
- Facts in columns (Calm/Dark) or pastel boxes (Colorful); packing bar under them.
- My trips / Past trips toggle (`splitTrips`); past trips as the compact banners from Home.
- Colorful: each card, fact box, button and the vault a different pastel.

## Built (Trips v4, UI revamp step 7)
- Header: "Trip folders" / "Your trips." over Home's relief terrain, framed
  around the trips' places, a tag at each (city and month, "Now" while on
  it) opening the trip (`TripsHero`, `TripsWorldMap`). Calendar and New trip
  are the round buttons at its top right. No placed trip: the title alone.
- Tabs Upcoming / Past / Drafts / (Following) / All. Drafts left Upcoming for
  their own tab; Upcoming links to them ("N drafts with no dates yet").
- Plan with Béa and Join with a code as two pastel cards. New trip and Join
  open as sheets with the same forms.
- Layout switch, on this device (`bea-trips-layout`): Big banner (the next
  trip as `TripFeature`, the rest under "Later") or List (every trip as a
  row). Picture switch: Stops or Photo, the same setting as the trip page.
- Next up: picture with travellers or the live stop, glass panel with name,
  places, dates and a countdown circle, the cities in order with their
  dates, chips for flight (or the stay once under way), to-dos and packing
  that open those parts, the stay, Béa's line and View itinerary.
- Rows (`TripListRow`): little map or photo, name, dates, places, current
  leg, travellers, a tag (live / in N days / draft / tentative), ⋯ with Open
  trip, To-dos, Packing, Bookings.
- Past trips: three tiles (map or photo) and See all; the Past tab as rows.
- Trip documents: its own section, linking to /profile/documents.
