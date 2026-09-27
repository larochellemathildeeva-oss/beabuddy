# Trips — function checklist

Every function the current Trips page (`/trips`) has. The redesign keeps all
of them, with the app's lucide icons. Sources: `src/routes/trips.tsx`,
`TripCard.tsx`, `TripBanner.tsx`, `DocumentVault.tsx`, `DateRangeField.tsx`,
`PlaceSearchInput.tsx`, `Skeletons.tsx`.

## Header
- [ ] Eyebrow "Trip folders", title "Everything, already filed."
- [ ] "Calendar view" → /calendar

## Actions (signed in)
- [ ] "New trip" toggles the new-trip form (closes Join)
- [ ] "Join with a code" toggles the join form (closes New trip)
- [ ] Error line under the forms

## New trip form
- [ ] Trip name (placeholder = Béa's suggested name) + "No name needed — Béa will file this as “…”"
- [ ] One place / Several cities switch
- [ ] One place: "Where to — search it" place search
- [ ] Dates (range picker) with fixed / tentative dates
- [ ] Several cities: numbered city rows (search + "Dates in {city}" + remove X), "These dates fall outside the trip's.", "Add another city"
- [ ] "End date can't be earlier than the start date."
- [ ] "Attach a copy of a packing list" (select, "No packing list", note about copies) — only if you have packs
- [ ] "Track a budget for this trip" checkbox
- [ ] Still-editable note
- [ ] "Create trip" (disabled until valid) → opens the new trip

## Join form
- [ ] "Invite code" (uppercase, spaced) + "Join trip" (needs 4+ characters) → opens the trip

## Trip list
- [ ] Loading skeletons
- [ ] Trip cards → trip page:
  - [ ] Banner: your photo (credit line) or painted scene; pill (countdown / live / planning); people count; places · dates; title; corner "N stops · Nd"
  - [ ] Current leg ("Now · Lisbon")
  - [ ] Live strip: "Live · Stop 2 of 5 · Now: …"
  - [ ] Facts: First/Next flight (or "None saved yet · Add it to the itinerary"), Stay, Packing (x/y + bar) or First stop, To do (N open, due line)
  - [ ] Or "N places so far. Nothing on the timeline yet." / "Open it to start planning."
  - [ ] Béa's quote + "View itinerary →"
- [ ] Empty state: Béa line (empty.trips)

## Signed out
- [ ] "Sign in to start a trip." + note + sign-in link

## Trip documents (vault)
- [ ] "Trip documents" · "Encrypted on this device"
- [ ] Signed out: "Trip confirmations & tickets" + "Sign in to set up your vault"
- [ ] No vault: "Set a vault passcode" — passcode, repeat, create
- [ ] Locked: "Vault locked" — passcode, unlock
- [ ] Unlocked: list of documents (label, kind, expiry, open, remove), Lock
- [ ] Add a document: kind chips, label, confirmation / reference, date, notes, file (image or PDF), save / cancel
