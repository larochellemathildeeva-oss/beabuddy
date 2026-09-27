# You and Your Béa — function checklist

Every function the You page (`/profile`) and Your Béa (`/profile/bea`) had
before the master rebuild. The redesign keeps all of them. Sources:
`src/routes/profile.tsx`, `src/routes/profile_.bea.tsx`, `PackingLists.tsx`,
`CustomizeHome.tsx`, `ThemePicker.tsx`, `FeedbackForm.tsx`,
`CopyrightNotice.tsx`.

## You — signed out
- [x] "Sign in to keep all of this forever." card with "Sign in or create an account" → /auth
- [x] Help, feedback, legal links still reachable signed out (page is gated by AppShell anyway)

## You — account (signed in)
- [x] Avatar initial, display name, email
- [x] "Saved" flash after a profile field saves
- [x] "Import photos" → /photos
- [x] "Sign out" → signs out, goes to /auth
- [x] Demo / sample data card (hidden once dismissed): "Load sample" (→ /world on success, message), "Remove sample" (hides the card), result / error line, "Working…" while busy

## You — profile settings
- [x] Your name (saves on blur to profiles.display_name)
- [x] Home city (saves on blur to profiles.home_city)
- [x] Travel-tag count in the section hint
- [x] Travel preferences → /preferences (data-guide="travel-preferences")
- [x] Customise Home (`CustomizeHome variant="row"`)
- [x] Theme picker (Calm / Colorful / Dark)
- [x] "Take the tour again" → Replay (resumeOrReplayTour, → /)

## You — Your Béa
- [x] Béa card with current mode name (`modeName`) → /profile/bea

## You — packing lists
- [x] Explanation + `PackingLists` (reusable templates: create, edit, delete)

## You — what is kept on this phone
- [x] Offline explanation text
- [x] List of trips with saved directions on this device (title + location), or "None yet…"
- [x] "Open trips" → /trips

## You — legal, privacy and such
- [x] Privacy policy → /privacy
- [x] Terms of Service → /terms
- [x] Copyright notice + ownership note
- [x] Erase all my data (two-step confirm dialog, eraseMyData, clears local data and cache, toast, → /)
- [x] Delete my account (type DELETE, deleteMyAccount, clears vault keys and local data, sign out, → /auth)

## You — work travel
- [x] Receipts & expenses → /expenses

## You — help and feedback
- [x] Help & FAQ → /help
- [x] Feedback form (`FeedbackForm`)

## You — guide anchors
- [x] data-guide: profile-account, profile-settings, travel-preferences, replay-tour, packing-lists, offline-options, legal, feedback

## Your Béa (/profile/bea)
- [x] Back to You
- [x] Current mode: name + preset description (or "Your own mix…")
- [x] Presets (Balanced, Helpful, Funny, Sassy, Minimal) as a radio group; selected shows a check
- [x] Set the mix: a slider per trait (0–100, step 5), share % beside it, trait description, aria-label
- [x] Reset to Balanced
- [x] Preview lines in the current mix, "Try another" for new ones, "Examples only."
- [x] Extras switches: "Béa says" lines, Reactions, Rare surprises
- [x] Note: personality never changes facts; payments, security, deleting, errors always plain
- [x] Béa's credentials card with "Another credential"
- [x] Everything saves on change to this device (`saveBeaSettings`)
