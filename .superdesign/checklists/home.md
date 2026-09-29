# Home — function checklist

Every function the current Home page has. The redesign must keep all of them
(icons from lucide, as in the app). Source: `src/routes/index.tsx` and the
components it imports.

## Frame (AppShell, every page)
- [ ] Béa logo + serif wordmark + version + "Travel Buddy" label → Home
- [ ] Page guide button (Sparkles icon)
- [ ] Online / offline dot
- [ ] Bottom tabs: Home, World, Trips, Recs, You (Home, Globe2, MapPinned, Bookmark, User)

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
