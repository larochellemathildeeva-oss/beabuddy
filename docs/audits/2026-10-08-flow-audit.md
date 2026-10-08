# Béa — full flow audit (menus, submenus, click-through)

Method: four read-only code passes (shell/Home/auth, Trips + trip views, Recs/World, You/settings/extras). Findings come from reading the code, not from running the app, so contrast and live behaviour are unchecked. "Taps" are counted from the nearest tab.

## A. Top 10 (fix first)

| # | Finding | Where | Sev |
|---|---|---|---|
| 1 | One-tap deletes with no confirm or undo: Protected documents (encrypted, unrecoverable), receipts, photos (tap a thumbnail), city notes, sample data, "Delete saved directions", "Been there" on a bucket-list destination | DocumentVault, expenses, photos, memories, profile, TripDetail, world.tsx | High |
| 2 | Failed deletes and loads are silent (row just reappears); /expenses, /memories, /story, /calendar have no error or retry state | useExpenses, usePhotoMemories | High |
| 3 | Same lists, different names. Bucket list = "Wishlist", Been there = "Visited"; counts differ per screen | atlas.ts:137, recommendations.tsx:1419, world.tsx | High |
| 4 | "Next time" is a dead end from World (opens Recs with no list selected); the three list tiles sit on World's Stats tab | world.tsx:431, 1111 | High |
| 5 | Menu "Help for this page" does nothing on pages without a guide (privacy, terms, how-it-works, shared link); header Help button is always hidden | AppShell:354, PageGuide:108 | High |
| 6 | Menu is not a hub: no Sign out, Appearance or Feedback; Sign out only at the bottom of You | AppShell:345, profile.tsx:497 | High |
| 7 | Trip menu rows close the whole menu and don't return to it | TripDetail ~2829 | High |
| 8 | Offline has four names ("Offline maps", "Download directions", "Keep on this phone", "Delete saved directions") in two places | TripMenuSheet:280, ItineraryDirections:338 | High |
| 9 | Pins to check hidden by default; the "!" only shows after a 3-tap switch | useTripViewPrefs:49, TripDetail:1590 | High |
| 10 | Back on secondary pages falls back to Home, not You (/preferences, /help, /calendar, /photos, /expenses, /memories, /story) | back-target.ts:4 | High |

## B. Navigation and naming

- "Profile settings" (Menu) is the You tab. "Privacy & legal" is a page in the Menu but a sheet in You. Help has four names.
- Add-to-trip: card says "Add to a day", sheet "Add to trip", success "View in itinerary". The picker silently shows only 8 trips.
- Trip header vs menu vs sheet titles differ: To do / "To do and packing" / "Before you go"; Add stop / "Add a stop" / "Add to this trip"; Plan with Béa / Ask Béa.
- Features by name: Trip documents / Your files / Protected / "vault"; Photos & memories / Photo memories / City memories; Work travel / Business expenses / Receipts; Your Béa / Béa's brain. "Search your places" is not a global search.
- Two different "⋯" buttons on the trip page (Trip menu, Timeline options).
- Companion is hidden behind Map (2 taps) and three "now" ideas exist: Companion, "Now" button, "Back to now". (Planned fix: Phase 4, one Map view.)
- Optimize, "Change a day" and Ask Béa overlap.

## C. Buried features (3+ taps)

Story (You > Photos > Memories > Story), Calendar (inside "Data & imports"), Replay tour and How Béa works (inside About), Pins to check switch, Offline settings, reading and accessibility settings (4th section of Appearance, no "Accessibility" label), Erase/Delete account (under legal links).

## D. Duplicates and dead ends

- /next, /world/next and /trips/next are unlinked copies (~1,000 lines each). Delete or merge.
- Landing: 6 sign-up entry points; "Join with a code" has no code field; "Start your vault" is jargon.
- How Béa works shows "Start free" to signed-in users. Expired share links and expired reset links dead-end. Calendar "Coming up" items aren't links.
- Béa personality has two back arrows. Prep "More" sheet can be empty. Share link card vanishes silently when unavailable.

## E. Accessibility

- Radio groups (Theme, Accent, Text size, Font) have no arrow-key support.
- Tab patterns lack panels in trip views, World tabs and Saved screen. Row menu on World has no Escape or outside-click close; sheets in Recs have no focus trap; Help guide overlay has no focus trap.
- Placeholder used as label on sign-in fields and Alternatives/Rebuild boxes.
- Home logo label announces the version, not "Home". Photo thumbnails (delete) have no aria-label.
- Targets under 44px in pins review, share link buttons, Prep "More". Many 12–13px helper strings.
- Loading states without live regions on Calendar and Expenses.

## F. Smaller items

Stale copy ("Now tab", "Day tab"); dead code (`CustomizeTrip`, unused trip-menu icons); Trip documents row does a full page reload (`href` not `to`); Home hero blank while trips load; share link "follow along" pre-checked; sign-up shows no resend/change-email; sign out has no visible progress during its offline-clear.

## G. What already works

Erase/Delete account protections; sheets trap focus and restore it (shell Sheet); preferences and documents have proper loading/error states; trip route has loading, not-found and signed-out states; gated routes keep the return path.

## H. How this feeds the redesign

- **Phase 2 (Home, Trips, You, Places):** one vocabulary (items 3, 4, B); a real Menu hub (6, 5); Trips and Recs entry points (D).
- **Phase 3 (system states):** confirm-and-undo pattern, error and retry state, empty states (1, 2).
- **Phase 4 (trip views):** single Map view, one trip-menu structure, offline naming (7, 8, 9).
- **Phase 5 (settings):** keyboard radios, Accessibility section, Account section.
- **Quick wins, any time (no design needed):** delete /next copies, back-target map, "Help" row hide, labels, aria-labels, confirm dialogs.

## I. Tracking (update as items ship)

Status: `[ ]` open, `[x]` done (PR). Findings numbers refer to table A.

- [ ] 1 One-tap deletes need confirm + undo (Phase 3)
- [ ] 2 Error and retry states for expenses, memories, story, calendar (Phase 3)
- [ ] 3 One vocabulary: Bucket list / Been there / Next time (Phase 2)
- [ ] 4 Next time reachable from World; list tiles off the Stats tab (Phase 2)
- [ ] 5 Help row hidden where no guide exists; header Help decided (Phase 2)
- [ ] 6 Menu as a hub: Sign out, Appearance, Feedback (Phase 2)
- [ ] 7 Trip menu keeps the menu underneath (Phase 4)
- [ ] 8 One name and place for offline / kept directions (Phase 4)
- [ ] 9 Pins to check visible without the 3-tap switch (Phase 4)
- [ ] 10 Back target for /preferences, /help, /calendar, /photos, /expenses, /memories, /story (quick win)
- [ ] Quick wins: delete /next, /world/next, /trips/next copies; aria-labels; Home logo label "Home"
- [ ] Sections B-F: not yet scheduled (assign to phases after owner review)

Owner decisions pending: quick-wins PR before Phase 2? Menu long-term contents?
