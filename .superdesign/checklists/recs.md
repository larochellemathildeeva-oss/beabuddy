# Recs — function checklist

Every function the Recs tab had before the master redesign. The redesign must
keep all of them. Source: `src/routes/recommendations.tsx` and the components
only it uses (`NearbyMapPin`, `RecoListImport`, `TripPlacesImport`,
`ShareRecos`), plus shared ones it renders (`PlaceSearchInput`, `PlaceFacts`,
`Section`, `RowListSkeleton`).

## Header
- [ ] Title (was "Recommendation vault."), count of saved places (eyebrow "N saved")
- [ ] Page meta: title, description, og tags

## Add a place (data-guide `reco-add`)
- [ ] One search field (`PlaceSearchInput`): type-ahead lookup, Search button,
      "Did you mean" spellings, "Search near me" (asks for location only then),
      "Nearest to you first", results list
- [ ] Location reused silently when permission was already granted (never prompts on arrival)
- [ ] Paste a link (Google Maps, share text …) → read into a draft; partial /
      unlocated link messages
- [ ] Quick "Save" on a result (one tap) → then offer: Which pin, Who told you, Add a note
- [ ] Tap a result → draft card
- [ ] "Save '…' as typed" (opens in Maps by name, `draftFromTyped`, source "Typed in")
- [ ] "+" menu (other ways to add and share):
  - [ ] From my trips → `TripPlacesImport` (pick places off trip timelines, mark already-saved, save as a pin type)
  - [ ] I'm here now → geolocate, reverse-lookup city/country → draft (source "Current location"); framed/blocked/failed messages
  - [ ] By hand → empty draft
  - [ ] Paste a list → `RecoListImport` (paste/upload a list or a page of suggestions)
  - [ ] Send places → `ShareRecos` picking mode (snapshot behind a code)
  - [ ] Open a share → `ShareRecos` opening mode (keep places someone sent)
  - [ ] Pin somewhere nearby → `NearbyMapPin` (data-guide `pin-nearby`)
- [ ] Error line under the add area

## Just saved (after a quick save)
- [ ] "Saved {name}" with close
- [ ] Which pin (Recommendation / Wishlist / Next time / Visited)
- [ ] Who told you (text, Enter or Save)
- [ ] Add a note (text, Enter or Save)
- [ ] Toast `beaLine("recs.saved")` when no id comes back

## Draft card ("Check the details")
- [ ] Scrolls into view when a draft appears
- [ ] Discard
- [ ] Duplicate warning ("You already saved X in Y …")
- [ ] Save to vault (top and bottom), disabled without a name, "Saving…"
- [ ] Name field
- [ ] Address/city/country line
- [ ] Optional field chips: Category, Who told you, Note, City, Country, Address (one open at a time)
- [ ] Travel tags: guessed (`suggestTravelTags`), re-guessed on edits until touched, toggle, "Add a tag"/"Fewer tags"
- [ ] Location on the map (data-guide `reco-location`): pinned coords or "No exact spot yet", search a place/street/city, "Find this spot", pick a result
- [ ] Pin on the map: Recommendation / Wishlist / Next time / Visited
- [ ] "Give it a name first", "Sign in on the You tab …" hints
- [ ] Success toast `beaLine("recs.saved")`, haptic `confirm()`

## Nearby map (`NearbyMapPin`)
- [ ] Open → locate (errors: no geolocation, framed preview, blocked, other) + Try again / Use my location
- [ ] Map tiles through `/api/tile` (key never in the browser), drag to pan
- [ ] Places around (Overpass, 800 m, two mirrors, 12 s timeout), "Looking around you…", "Couldn't reach the map just now." + Try again, "N places around here"
- [ ] Existing saved pins drawn as coloured dots
- [ ] Tap a place → name-this-pin draft; tap anywhere → pin that exact spot
- [ ] Name this pin, choose Wishlist / Next time / Visited / Recommendation, Save as …, Cancel, confirmation line
- [ ] Back to me
- [ ] Nearest 12 list with distance (m / km), tap → draft + centre

## Saved places
- [ ] Search saved (fuzzy, typos fine; name, city, country, who, notes) (data-guide `reco-search`), shown when worth it
- [ ] City filter (data-guide `reco-places`), Type filter (data-guide `reco-categories`), shown when worth it; "cafe"/"Cafe" one option
- [ ] Unfiltered order by opportunity score (`scoreOpportunity`, `useScorePrefs`)
- [ ] Grouped by pin type (Recommendation, Wishlist, Next time, Visited) with counts, collapsible (data-guide `reco-list`)
- [ ] Only venues listed (city-level places left out)
- [ ] Each row: pin colour, name, city/country, by who, source, notes, travel tags, category, year
- [ ] Open in Maps ↗ (`recMapsUrl`)
- [ ] Hours on request (`PlaceFacts`), not for city/country-level places
- [ ] Remove with undo (re-creates the row)
- [ ] Loading skeleton, empty line `beaLine("empty.recs")`, "Nothing saved matches that yet."
