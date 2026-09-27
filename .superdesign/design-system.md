# Béa — Design System

## Product
Béa ("Travel Buddy") is a mobile-first travel companion: the place where your travel life lives. Save recommendations from friends, track places you've been, plan trips from saved ideas, and rediscover saved places when you're nearby. Mission: "Béa remembers your travel life so Future You doesn't miss what matters." Never position it as an "AI travel planner".

Mascot: Béa is a small French bulldog in a bandana. Copy speaks *about* her in third person ("Béa is sniffing out your stops"), never "I".

Key pages: Home ("At a glance"), World (globe of places you've been), Trips (trip folders) → Trip detail (day timeline, stops, map, budget, people, packing), Recs (recommendation vault with Near filter), You (profile/settings). Secondary: Memories, Photos, Story playback, Calendar, Expenses, Preferences, Auth, Help, Legal.

Voice: explain, encourage, reassure. Personality on saves, empty states, waits and milestones; utilitarian on auth, legal, settings, expenses, deletes.

## Visual style — warm editorial cream & clay
- Ground: warm cream `oklch(0.963 0.016 76)` (~#F5EEE4) with a soft light wash at the top. Cards are *lighter* than the ground (`oklch(0.998 0.004 88)`, ~#FFFEFB); depth comes from surface + soft shadow, not borders everywhere.
- Text: dark warm brown `oklch(0.245 0.024 52)` (~#2E241D); muted `oklch(0.515 0.029 56)` (~#7A6B5F).
- Primary: terracotta clay `oklch(0.535 0.162 39)` (~#B4502E). Main buttons use the clay gradient `linear-gradient(142deg, oklch(0.625 0.155 50), oklch(0.485 0.16 30))` with a warm glow shadow. Selected chips: 11% clay tint with 45% clay border.
- Category colors: visited blue `oklch(0.55 0.135 249)`, next-time green `oklch(0.56 0.12 158)`, wishlist gold `oklch(0.71 0.135 84)`, reco purple `oklch(0.545 0.155 305)`.
- Tab accent walks terracotta → gold along the tab bar (hue 39/49/59/69/79); used only for the active tab pill and the header hairline.
- Dark mode: warm charcoal (`oklch(0.182 0.014 56)`), clay stays saturated (`oklch(0.715 0.158 45)`).

## Typography
- Display: **Instrument Serif** (regular + italic) for page titles (~27px, line-height 1.06), the "Béa" wordmark (23px) and editorial headings.
- UI/body: **Manrope** 300–700, body 15px / 1.5.
- Caps labels (eyebrows, section labels, tab labels): 11px, weight 600, uppercase, letter-spacing 0.13em, muted color.

## Shape, depth, spacing
- Radius base 1.02rem (~16px); cards 3xl (~28px); panels/buttons 2xl (~24px); chips and icon buttons fully round.
- Shadows soft and warm-tinted, never hard: cards `0 1px 2px rgba(60,40,25,.04), 0 10px 24px -14px rgba(60,40,25,.28)`; sheets deeper.
- Surfaces: `card-soft` (white card, faint hairline, soft shadow), `surface` (quiet elevated cream panel, no border), `card-raised` (floating sheets/popovers).
- Page padding 16px; generous vertical rhythm; single column.

## Layout
- Phone-first single centered column (max 520px; 680px tablet; 780px desktop) with faint side borders.
- Top bar: back button (round, bordered, 32px), Béa logo + serif wordmark + tiny version, "TRAVEL BUDDY" caps label; right: guide button + online dot. Blurred translucent background.
- Page header: caps eyebrow + serif title + one optional action; compresses to a bar on scroll.
- Bottom tab bar: Home, World, Trips, Recs, You — lucide icons (Home, Globe2, MapPinned, Bookmark, User), 11.5px uppercase labels, one sliding tinted pill.
- Bottom sheets for secondary actions.

## Icons
lucide-react, 1.7 stroke (2.3 when active), 16–19px.

## Motion
tap 120ms, shift 200ms, move 320ms, arrive 420ms; ease-standard cubic-bezier(.32,.72,0,1); a small overshoot (.34,1.4,.5,1) only for "that worked" moments. Screens slide/fade in by plane (tab vs detail).

## Approved direction (redesign, Sept 2026)
Approved by the owner as the overall style — "a good start", not final screens.
- **Three user-selectable themes:** Calm (white, cream, light beige), Colorful (cheerful cool pastels — lilac, blue, cyan, teal — with a violet accent; no orange), Dark (near-black with off-white and beige). Picked on the You page.
- **Layout:** "Tiles" — rounded tiles and cards, serif display titles, calm spacing. Trip pages use thin lines and small dots; accent color only marks "now".
- **Colorful mixes its pastels on every page**: neighbouring cards and boxes each take a different colour (lilac, sky, teal, cyan, pink) — never one hue over the whole page. Calm and Dark stay quiet. Same shapes across all three.
- **Maps stay neutral in every theme** (beige in Calm, grey in Colorful, dark in Dark); only the route and pins carry color.
- **Keep:** the "Day by day" itinerary overview.
- **Hard rules for building it:** keep the app's existing icons, and keep every existing function on every page. The mockups omit some of both; they are a style reference, not a feature list.
