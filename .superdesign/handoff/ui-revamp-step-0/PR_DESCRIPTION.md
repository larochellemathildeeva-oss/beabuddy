The shared shell still used a different accent per tab, small header/tab text and a cream Calm ground. Step 0 gives it one traveller-selected accent (Pink by default, Periwinkle optional), the approved grounds and type tokens, a reusable dog + “Béa.” identity row, and a translucent floating five-tab bar.

## Scope

Only step 0 from `docs/ui-revamp/README.md`: tokens, shared header/navigation, the accent choice under the existing Theme picker, its account persistence and pre-paint bootstrap, and the explicitly required `preview:check` repair. Screen layouts and trip perspective structure remain at current main. `package.json` version remains 6.14.0. The scroll listener also reattaches when sign-in finishes, preserving header compression on a fresh load. No new database migration: accent uses the existing `profiles.app_settings` merge path.

The preview now stubs server-only imports, uses current Home exports and real current control labels, models atomic schedule writes, and tests controls in Calm, Colorful and Dark. Assertions still check saved itinerary data, booking references, import pins and durations, selected days/stops, and navigation.

Review fixes on this same step 0 branch:

- Header compression checks the available scroll range against the actual expanded header height. Short pages stay expanded, so browser scroll clamping cannot toggle the header repeatedly. Long titles wrap when expanded and truncate to one line in either compact header layout, including larger Reading text.
- Tailwind's text-color namespace supplies accent ink to `text-primary`, hover and opacity variants without overriding disabled utilities. Calm/Dark sequence glyphs use the same ink; Colorful keeps its existing category colors for these non-text icons. The real Saved Places “Added” button is checked for its disabled green state.
- Dark error text uses light danger ink, independent of the accent. Danger fill remains the owner's `#C22A52`. Secondary ink is darker on light beige surfaces. Rendered accent text at 85% opacity, error text and hint text are checked against 4.5:1.
- Version text is hidden below 390px again. Removed the five unused tab/home style aliases identified in review, retaining the used `tab-rule` utility. Accent names, labels and bootstrap validation come from one list.
- Preview workers write into a fresh directory per gate. Missing/malformed reports, launch errors and nonzero exits produce a failed current report; previous green reports cannot be reused. Regression tests exercise these failure cases.

## Validation

- [x] `npm run typecheck`
- [x] `npm run lint` — 0 errors; the same 15 existing warnings
- [x] `npm test` — 1,906 tests passed
- [x] `npm run build`
- [x] `npm run check:public-secrets`
- [x] `npm run db:check:ci`
- [x] `npm run audit:ci` — frozen inputs, no paid/external lookups
- [x] `npm run preview:check` — 131 controls per theme, 393 total, 0 problems; feature flows also pass in Calm, Colorful and Dark

Clicked the five main destinations, both back paths, brand link, Home search, guide open/close, theme and accent choices. Checked offline/online indicators, account-setting writes, remount persistence, storage-event updates, header/nav position while main scrolls, and 320/390px widths with 135% Reading text. Primary labels use black: both exact accents and their gradient endpoints meet 4.5:1, including Periwinkle’s darker map/gradient token.

Additional browser regressions cover a page with only 50px of overflow at 320/390px and 100%/135% Reading size, long compact titles with actions in either header position, version visibility, computed hover/opacity text colors, Dark error contrast, and the actual Saved Places disabled “Added” state. After screenshots have been refreshed following review.

Computed browser colors on elevated surfaces: Colorful hint text 4.81:1, Pink text at 85% opacity 4.96:1, Periwinkle text at 85% opacity 4.81:1; Dark error text 6.26:1. All exceed the 4.5:1 text minimum.

Browser verification uses the repo’s component preview: real AppShell, PageHeader, ThemePicker and TripDetail with simulated Supabase/server responses. Physical-device sync against a live Supabase account was not exercised.

## Phone screenshots — 390 × 844

Before is main `d37a1e7`. Captures use Béa’s Instrument Serif, Manrope and existing dog logo. The neutral shell fixture makes the shared-chrome change reviewable without changing any screen layout. Compared with `docs/ui-revamp/mockup.html` and approved Home/World references, with README owner decisions taking precedence.

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-shell-calm.png) | ![After Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-shell-calm.png) |
| Colorful · Pink | ![Before Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-shell-colorful-pink.png) | ![After Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-shell-colorful-pink.png) |
| Colorful · Periwinkle | ![Before Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-shell-colorful-periwinkle.png) | ![After Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-shell-colorful-periwinkle.png) |
| Dark · Pink | ![Before Dark · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-shell-dark.png) | ![After Dark · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-shell-dark.png) |

Home header variant on the same shell fixture:

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-home-header-calm.png) | ![After Calm](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-home-header-calm.png) |
| Colorful · Pink | ![Before Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-home-header-colorful-pink.png) | ![After Colorful · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-home-header-colorful-pink.png) |
| Colorful · Periwinkle | ![Before Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-home-header-colorful-periwinkle.png) | ![After Colorful · Periwinkle](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-home-header-colorful-periwinkle.png) |
| Dark · Pink | ![Before Dark · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/before-home-header-dark.png) | ![After Dark · Pink](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/ui-revamp-step-0/.superdesign/handoff/ui-revamp-step-0/after-home-header-dark.png) |

## Function checklists

Copied below in full as requested. Only the shared Frame and Theme picker are in step 0; all other entries are deliberately unchecked here because their screen port is a later step. Checked entries were clicked in the running component preview. The old checklist calls the guide icon Sparkles; current main uses HelpCircle and its current help flow is preserved.

# Home — function checklist

Every function the current Home page has. The redesign must keep all of them
(icons from lucide, as in the app). Source: `src/routes/index.tsx` and the
components it imports.

## Frame (AppShell, every page)
- [x] Béa logo + serif wordmark + version + "Travel Buddy" label → Home
- [x] Page guide button (Sparkles icon)
- [x] Online / offline dot
- [x] Bottom tabs: Home, World, Trips, Recs, You (Home, Globe2, MapPinned, Bookmark, User)

## Signed in
- [ ] Eyebrow: today's date ("Saturday 27 September")
- [ ] Title: greeting by time of day + first name ("Good morning, Mathilde.")
- [ ] Subtitle, one of: "Where to next?" / "Home in {city}. Where to next?" / "Your next chapter is taking shape." / "You're in the middle of it."
- [ ] **Trip hero** (current or next trip) → trip page
  - [ ] Your own photo of that city/country, else Béa's painted landscape
  - [ ] Countdown / status pill (white), tentative-dates marker
  - [ ] People count (Users icon)
  - [ ] Title, dates · route of cities
  - [ ] Readiness line (bookings, else packing, else planning) + "View itinerary" (ArrowUpRight)
- [ ] **At a glance**
  - [ ] Weather tile: ask first ("Looked up once, from a position rounded to about a kilometre." + Show), checking, not available, error + Try again, weather (temp °C/°F, place, condition icon, Open-Meteo credit)
  - [ ] Save tile (Bookmark): "Nearby save" (walk minutes, → Near) or "Waiting for you" (city · from who, → Recs)
- [ ] **Next up** (Ticket or CalendarClock icon, ChevronRight) → trip
  - [ ] "One thing for today" (a to-do, due line) or "Next on the plan" (day · time)
  - [ ] Open task count ("2 tasks")
- [ ] **Later trips** — heading "Later this {season}" / "Later this year" / "Coming up", "All trips" link, trip cards
- [ ] **Near home** ("Around you right now" / "Places near you")
  - [ ] Location explainer "Before Béa asks for your location", share for: Just this once / For 1 hour / For today / Until I turn it off
  - [ ] Stop sharing, locate again, error state
  - [ ] How far to look: 500 m / 1 km / 5 km / 25 km
  - [ ] Nothing within reach: "Nothing you've saved is within 5 km. Nearest is X, about Y away." + Look further / Show less
  - [ ] Place cards: type label, name, distance · category, note quote, Add to a day trip, Directions (Google Maps), Dismiss
  - [ ] "Show all N nearby"
  - [ ] Plan a day trip: when, pace, lean into today, notes, arrange, clear, save
- [ ] **Sample data prompt** (empty account): Béa line, "Load sample travel data" (→ World), "Save a place" (→ Recs), result message
- [ ] **Future me note**: "Future me · {city}", "Surfaces on revisit", reco dot, "Left {date}", the note
- [ ] **Past trips**: compact banners, "All trips" link
- [ ] Sections shown/hidden by "Customize home" on You: Weather, Trips, Saved places, Future me note

## Signed out (landing)
- [ ] Eyebrow tagline, title (position), mission paragraph
- [ ] Sample globe, pins selectable
- [ ] "Create an account", "How Béa works"
- [ ] Note that the globe is sample data


# You and Your Béa — function checklist

Every function the You page (`/profile`) and Your Béa (`/profile/bea`) had
before the master rebuild. The redesign keeps all of them. Sources:
`src/routes/profile.tsx`, `src/routes/profile_.bea.tsx`, `PackingLists.tsx`,
`CustomizeHome.tsx`, `ThemePicker.tsx`, `FeedbackForm.tsx`,
`CopyrightNotice.tsx`.

## You — signed out
- [ ] "Sign in to keep all of this forever." card with "Sign in or create an account" → /auth
- [ ] Help, feedback, legal links still reachable signed out (page is gated by AppShell anyway)

## You — account (signed in)
- [ ] Avatar initial, display name, email
- [ ] "Saved" flash after a profile field saves
- [ ] "Import photos" → /photos
- [ ] "Sign out" → signs out, goes to /auth
- [ ] Demo / sample data card (hidden once dismissed): "Load sample" (→ /world on success, message), "Remove sample" (hides the card), result / error line, "Working…" while busy

## You — profile settings
- [ ] Your name (saves on blur to profiles.display_name)
- [ ] Home city (saves on blur to profiles.home_city)
- [ ] Travel-tag count in the section hint
- [ ] Travel preferences → /preferences (data-guide="travel-preferences")
- [ ] Customise Home (`CustomizeHome variant="row"`)
- [x] Theme picker (Calm / Colorful / Dark)
- [ ] "Take the tour again" → Replay (resumeOrReplayTour, → /)

## You — Your Béa
- [ ] Béa card with current mode name (`modeName`) → /profile/bea

## You — packing lists
- [ ] Explanation + `PackingLists` (reusable templates: create, edit, delete)

## You — what is kept on this phone
- [ ] Offline explanation text
- [ ] List of trips with saved directions on this device (title + location), or "None yet…"
- [ ] "Open trips" → /trips

## You — legal, privacy and such
- [ ] Privacy policy → /privacy
- [ ] Terms of Service → /terms
- [ ] Copyright notice + ownership note
- [ ] Erase all my data (two-step confirm dialog, eraseMyData, clears local data and cache, toast, → /)
- [ ] Delete my account (type DELETE, deleteMyAccount, clears vault keys and local data, sign out, → /auth)

## You — work travel
- [ ] Receipts & expenses → /expenses

## You — help and feedback
- [ ] Help & FAQ → /help
- [ ] Feedback form (`FeedbackForm`)

## You — guide anchors
- [ ] data-guide: profile-account, profile-settings, travel-preferences, replay-tour, packing-lists, offline-options, legal, feedback

## Your Béa (/profile/bea)
- [ ] Back to You
- [ ] Current mode: name + preset description (or "Your own mix…")
- [ ] Presets (Balanced, Helpful, Funny, Sassy, Minimal) as a radio group; selected shows a check
- [ ] Set the mix: a slider per trait (0–100, step 5), share % beside it, trait description, aria-label
- [ ] Reset to Balanced
- [ ] Preview lines in the current mix, "Try another" for new ones, "Examples only."
- [ ] Extras switches: "Béa says" lines, Reactions, Rare surprises
- [ ] Note: personality never changes facts; payments, security, deleting, errors always plain
- [ ] Béa's credentials card with "Another credential"
- [ ] Everything saves on change to this device (`saveBeaSettings`)


Additional step 0 checks:

- [x] Pink is the default, Periwinkle is selectable, and switching one does not change the selected theme.
- [x] Accent changes reach the existing account-settings merge path and reappear on remount.
- [x] The pre-paint script restores Periwinkle; invalid or blocked storage falls back to Pink (executed unit tests).
- [x] Text labels and touch targets remain usable with larger Reading text at 320px and 390px.

## Questions

None for the step 0 implementation. No request to remove or rename an existing function.
