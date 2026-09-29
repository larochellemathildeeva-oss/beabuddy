# Béa master redesign — build plan

Source: the master handoff (ChatGPT, 18 locked screens) and the Béa personality
package. The master replaces earlier approved designs; where I thought an
earlier design was better, it is noted. Every screen keeps every existing
function (see `checklists/`), and every visible control must work — a tile
whose feature is not built yet stays hidden until it is.

## Decisions (from the owner)

- The master replaces the earlier designs (Home, Trips, trip menu …).
- Font: keep the current serif (no DejaVu Serif).
- Stop pictures: a setting — Illustrations (default) / Real photos (Wikimedia
  Commons, needs the saved-photo column) / No pictures. Never mixed.
- Trip documents: one booking inbox, easy to open; a **Protected** section
  inside it replaces today's vault (encrypted, Face ID / fingerprint /
  passcode); an optional lock on all of Trip documents, on by default, can be
  turned off only after a clear warning.
- Email forwarding (travel@…) needs an inbound-email service: its own project.

## Béa rules (fixed, not settings)

- Third person only; no emoji in her lines; never "AI travel planner".
- Personality changes **how** she says it, never **what** is true or
  recommended: rankings, plans, prices, directions and facts ignore the mix.
- No jokes, whatever the mix, for payments, account/security, safety,
  destructive actions, booking failures, privacy/permissions and actionable
  errors. Not a user setting.
- No "tailor to destination" or culture-coded behaviour; context comes only
  from verified weather, season, activity and neutral trip context.
- Outfits: phase 2, only once accessory artwork exists and fits every pose.
- Conversational "Béa does it for you" (search/save/edit by chat): a separate
  future product, not part of this redesign.

## Feature list

Legend: **E** exists — restyle · **C** exists — needs changes · **N** new

### Béa (runs through every screen)
- N Voice engine: 8 traits, presets, derived mode name, no-repeat, serious contexts — *built*
- N Loader "Béa is working on it…" with the 5 animations, reduce motion — *built, wired into planner, compare, optimize, packing import, directions*
- N Personality settings (You → Béa): presets, 8 sliders, preview, Try another, reset, extras on/off, credentials card
- N Empty states with still Béa (no trips, no saved recs, no results)
- N Success lines, micro-reactions, Companion "Béa says" asides, rain lines
- N Stop pictures setting (illustrations / photos / none) + illustration set
- N Saved photo per stop (column; SQL by hand) for "Real photos" in lists

### Trips
- C Companion, Map Focus/Split, Timeline — to the master's pictures (designs adapted earlier)
- N Trip Overview dashboard (summary strip, trip essentials, itinerary preview, Open on map)
- C Trip menu → tile grid; Flights / Hotels / Transport / Activities open the bookings for that kind
- E To do / Packing — built; add the summary strip and packing category tiles
- C Trips landing → compact rows, Upcoming / Past / Drafts (undated) / All
- C Home → next trip, "Before X · N left", 4 shortcuts, nearby place, your trips; current extras kept below

### Bookings and documents
- C Bookings already live on itinerary stops (`booking_ref`, `booking_details`, BookingSheet) → one booking record that can also be unassigned, belong to a trip, and optionally link to a stop (new table + migration, SQL by hand)
- N You → Trip documents: library, filters (type / trip / unassigned), search, add (upload file, take a photo, import), assign to trip and event, document detail (view, download, share), manage (reassign, unlink, delete)
- C Vault → Protected section inside Trip documents; Face ID / fingerprint unlock (device passkey) with passcode fallback
- N Optional lock on Trip documents with warning when turned off
- N Booking detail sheet shared by the stop, the trip Overview and the library
- N (later) Béa suggests the trip/event for a new document; the traveller confirms
- N (separate project) Forward bookings by email

### You
- C Profile summary + stats (trips, places; home airport is **N**)
- E Travel preferences, Packing lists, Work travel (expenses exist), Feedback, Help & FAQ, Privacy
- N Your Béa card → personality settings
- C Appearance (theme exists; text size and map style are **N**)
- N Links & formats (units, date/currency format)
- N Notifications (reminders) — needs a push/notification service; hidden until built
- C Data & imports (photos and calendar import exist; gather them here)

### Recs
- C Landing: search, From my trips, I'm here now, categories, Explore nearby, My collections (= the existing Recommendations / Wishlist / Next time lists), Recently saved
- N Explore Nearby map + list, Search this area, selected place
- C Search / place detail / save / choose collection / add to trip (most exist in pieces)

### Sign in
- C Login restyle to the master picture (Google, email, show password, stay signed in / ask every time, forgot password, create account)

## Order

1. Béa engine, loader, personality settings, empty states *(in progress)*
2. Companion, Map, Timeline (+ stop pictures setting, illustrations)
3. Bookings model + Trip documents + Protected + lock + booking sheet + Trip Overview + trip menu
4. Home and Trips
5. You page (hide what is not built)
6. Recs (landing, Explore Nearby, place flow)
7. Login
8. Later: saved photo column → Real photos in lists; notifications; email forwarding; outfits; Béa suggestions for documents
