# Routes

TanStack Start file-based routing (`src/routes/`, generated `src/routeTree.gen.ts`). Root layout: `src/routes/__root.tsx`. Every page wraps its content in `<AppShell eyebrow title headerAction>` (`src/components/AppShell.tsx`), which draws the top bar, the serif page header and the 5-tab bottom bar (Home, World, Trips, Recs, You). Each route declares a motion "plane" in `staticData` (`tab` for tab roots, `detail` for pushed screens).

| URL | File | Layout | Header (eyebrow / title) | What it renders |
| --- | --- | --- | --- | --- |
| `/` | `src/routes/index.tsx` | AppShell (tab: Home) | — / "At a glance" | Home: greeting, globe snapshot, next/current trip card (HomeTripCard), save tile + weather, "near home" places, content cards; customizable sections |
| `/world` | `src/routes/world.tsx` | AppShell (tab: World) | "Your world" | 3D globe of visited countries/provinces, stats, list of places been, add city/country sheet |
| `/trips` | `src/routes/trips.tsx` | AppShell (tab: Trips) | "Trip folders" / "Everything, already filed." | List of trip folders (TripCard with banner), new trip form (place search + date range), document vault, skeletons |
| `/trips/$tripId` | `src/routes/trips_.$tripId.tsx` → `src/components/TripDetail.tsx` | AppShell `flush` (pinned own header) | "Trip" / trip name | Trip detail: banner, day ribbon, day timeline of stops (TimelineCard/StopCard), day map, now panel, budget, people, todos, prep, packing, settings |
| `/recommendations` | `src/routes/recommendations.tsx` | AppShell (tab: Recs) | "Recommendation vault." | Saved places vault with filters (incl. Near), import lists, share recos, nearby map pins |
| `/profile` | `src/routes/profile.tsx` | AppShell (tab: You) | "Profile" / "Profile settings" | Account, theme, packing lists, links to preferences, privacy, feedback |
| `/preferences` | `src/routes/preferences.tsx` | AppShell | "Béa's brain" / "Travel preferences" | Travel-style preference chips and toggles |
| `/memories` | `src/routes/_authenticated/memories.tsx` | AppShell | "City memories" / "Every place, kept in one page." | Per-city memory pages |
| `/photos` | `src/routes/_authenticated/photos.tsx` | AppShell | "Photo memories" | Import photos from phone, place them on trips |
| `/expenses` | `src/routes/_authenticated/expenses.tsx` | AppShell | "Business expenses" / "Receipts, kept tidy" | Receipt list and capture |
| `/calendar` | `src/routes/_authenticated/calendar.tsx` | AppShell | "Trip calendar" / "Plan it before you leave home." | Calendar of trips |
| `/story` | `src/routes/_authenticated/story.tsx` | AppShell | "Travel story" / "Your journey, played back." | Playback of a trip |
| `/auth` | `src/routes/auth.tsx` | AppShell `publicPage` | — | Sign in / sign up (email + Google) |
| `/forgot-password`, `/reset-password` | `src/routes/*.tsx` | AppShell `publicPage` | — | Password flows |
| `/how-it-works` | `src/routes/how-it-works.tsx` | AppShell `publicPage` | "How it works" | Explainer with figures |
| `/help` | `src/routes/help.tsx` | AppShell | "Help" / "Welcome to Béa" | FAQ |
| `/privacy`, `/terms` | `src/routes/*.tsx` | AppShell `publicPage` | "Privacy" / "Béa" | Legal text |
| `/opportunities` | `src/routes/opportunities.tsx` | — | — | Redirects to Recs "Near" filter |
