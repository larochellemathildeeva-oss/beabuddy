# Béa — Four Mobile UX Concepts

Internal design document. Pair with `WHAT_BEA_BELIEVES.md`, `BRANDING.md`, and
`src/lib/bea-voice.ts`.

Four distinct concepts for the trip surface of Béa: **Travel Companion**, **Map First**,
**Editorial Travel Guide**, and **The Scout**. They are not four skins of one design.
Each one answers the same seven goals with a different centre of gravity, so they can be
prototyped against each other rather than blended into mush.

> **Voice rule that governs every line in this document.** Béa is a small French bulldog
> in a bandana. The app speaks *about* her, in third person. She never says "I". Lines
> like "Béa found two Sainte-Chapelles" are in character; "I found two" makes her a
> chatbot wearing a dog.

---

## 0. Shared foundations

Everything below is common to all four concepts. The concepts differ in *staging*, not
in these rules.

### 0.1 The two-door rule

Goal 1 — build vs. import must be obvious in under a second — is solved the same way
everywhere: **two doors, never a segmented control, never a dropdown.** The doors differ
in shape, weight, and verb, because identical shapes read as "same thing, two labels".

```
  ┌───────────────────────────────┐   tall, illustrated, warm
  │  ✦  Start from nothing        │   → Béa asks about the trip
  │     Béa scouts, you choose    │
  └───────────────────────────────┘

  ┌───────────────────────────────┐   short, paper-textured, "inbox"
  │  ⤓  Bring a plan you have     │   → paste / share sheet / file
  │     Paste, share, or drop it  │
  └───────────────────────────────┘
```

- **Build** is a *creation* affordance: full-bleed image, a verb of departure, bright
  accent, the taller of the two.
- **Import** is a *container* affordance: paper texture, dashed edge, a verb of arrival,
  neutral. It visibly *accepts* things. It is the target of the OS share sheet.
- Never the same height. Never side-by-side equal cards. Never "New trip / New trip
  (import)".

### 0.2 The confidence ladder (Goal 3)

One model, used identically in all four concepts, in import, in manual add, and in
Béa's own suggestions.

| Confidence | Béa's behaviour | Visual | Interaction cost |
| --- | --- | --- | --- |
| **High** (≥ 0.85) | Auto-match, pin dropped, no interruption | Solid pin, no badge | Zero. Reviewable later. |
| **Medium** (0.5–0.85) | Best match shown, alternatives one tap behind | Dashed ring on pin, soft amber dot | One tap to confirm, one tap to swap |
| **Low** (< 0.5) | Held back, never guessed silently | Hollow pin, question-mark bandana | Card with 2–3 candidates + map thumbnails |

Rules that make the ladder trustworthy:

1. **Never silently downgrade.** A low-confidence place is never dropped from the trip —
   it stays visible as "needs a nose", never deleted to keep the screen tidy.
2. **Confidence is explained, not scored.** Never show "0.72". Show the *reason*:
   "Three places share this name in Lisbon" / "The blog only said 'that rooftop bar in
   Alfama'".
3. **Batch the low ones.** Ambiguity is resolved in one run of cards at the end of
   import, never as modal interruptions during it.
4. **Confirming is one tap; correcting is two.** The best match is pre-selected.
5. **Undo is always available** for at least the session, per the repo's existing undo
   pattern for bulk saves.

### 0.3 Places first, itinerary second (Goal 4)

After any import or build, the first thing the user sees is **the set of places** — as
pins, cards, or a gallery — never a day-by-day list. The itinerary is derived, and is
always one deliberate gesture away (a tab, a pull-up, a page turn). Rationale: people
recognise *places* ("yes, that's the restaurant Marc told me about") far faster than
they can verify a schedule. Trust is bought with places; structure is spent on days.

### 0.4 Béa's participation contract (Goal 7)

Béa is a scout, not a chat. Constraints that keep her from degenerating into an
assistant bubble:

- **No text input field addressed to her.** Requests are made by tapping things in the
  world (a place, a day, a gap), not by typing a message to a dog.
- **She speaks in short returns**, not paragraphs, and always with something attached:
  a pin, a card, a route, a swap. An observation with nothing attached is chatter.
- **She is interruptible and dismissable.** Every return can be waved off; waving off
  teaches her (fewer of that kind).
- **She has a rate limit.** Maximum one unsolicited return per screen session, plus
  returns the user explicitly asked for. Bea earns the right to a second by having the
  first accepted.
- **She is honest about limits.** Honest-AI mode: "Béa could not find opening hours for
  this one" beats a plausible guess. The repo's privacy voice rule applies —
  *designed to / may*, never absolute guarantees.

### 0.5 Motion vocabulary

Shared easing and intent, so all four concepts feel like the same house.

| Token | Curve | Duration | Used for |
| --- | --- | --- | --- |
| `ease-scout` | `cubic-bezier(.32,.72,0,1)` | 420 ms | Sheets, page turns, the big moves |
| `ease-settle` | `cubic-bezier(.2,.9,.3,1)` | 240 ms | Pins landing, cards settling |
| `ease-sniff` | spring, stiffness 180, damping 14 | ~600 ms | Béa's own body, bandana, ears |
| `ease-state` | `cubic-bezier(.4,0,.2,1)` | 160 ms | Toggles, chips, tabs |

Hard rules: no spinners anywhere a scout metaphor can carry the wait (the repo already
has trail-based wait copy); every list insert is staggered at 30 ms per item and capped
at 8 items of stagger; all motion respects `prefers-reduced-motion` by collapsing to
opacity-only cross-fades.

---

## Concept A — "Travel Companion"

**Centre of gravity:** the day you are living. A warm, card-based companion surface that
sits beside you rather than in front of you. Closest reference: Airbnb Trips + Notion
Calendar's calm typography.

### A.1 Screen hierarchy

```
Home (Today)
├── Trip switcher (sheet)
├── Today card stack  ← default landing while a trip is live
│   ├── Place detail (sheet, 3 detents)
│   └── Béa returns (inline card, inline in stack)
├── Places (tab)          ← post-import landing; gallery of places
│   ├── Needs a nose (queue)
│   └── Place detail
├── Itinerary (tab)       ← day rail, derived from Places
│   └── Day detail (full screen)
└── New
    ├── Build  → preference flow (5 light steps)
    └── Import → paste / share / file → review → confirm
```

### A.2 Wireframes

**Home, trip live**

```
┌─────────────────────────────────────┐
│  Lisbon · Day 2 of 5      ⌄ trips   │
│                                     │
│   ◍◍◍◍◍◍◌◌◌   9:41 · 3 of 7 done   │  ← day progress rail
│                                     │
│  ┌───────────────────────────────┐  │
│  │  NOW                          │  │
│  │  ▓▓▓▓▓▓▓  Time Out Market     │  │
│  │  ▓ img ▓  12:30 – 14:00       │  │
│  │  ▓▓▓▓▓▓▓  6 min walk from here│  │
│  │           ⟶ Directions   ⋯    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🐕 Béa scouted ahead          │  │
│  │ "Miradouro de Santa Catarina  │  │
│  │  is 4 minutes off the walk    │  │
│  │  back. Best light around 7."  │  │
│  │  [ Add after dinner ]  [ No ] │  │
│  └───────────────────────────────┘  │
│                                     │
│  NEXT · 16:00                       │
│  ┌───────────────────────────────┐  │
│  │ ▓▓▓  Livraria Bertrand        │  │
│  └───────────────────────────────┘  │
│                                     │
│ ─────────────────────────────────── │
│  Today    Places    Itinerary   ⊕   │
└─────────────────────────────────────┘
```

**Places tab (the post-import landing)**

```
┌─────────────────────────────────────┐
│  ← Lisbon                    ⊙ map  │
│  Béa found 23 places                │
│                                     │
│  ┌──────────┐ ┌──────────┐          │
│  │ ▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓ │          │
│  │ Belém    │ │ LX Fact. │          │
│  │ ✓ matched│ │ ✓ matched│          │
│  └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐          │
│  │ ▓▓▓▓▓▓▓▓ │ │ ╌╌╌╌╌╌╌╌ │          │
│  │ Pastéis  │ │ "rooftop │          │
│  │ ✓ matched│ │  in Alfa"│          │
│  └──────────┘ │ ? needs  │          │
│               └──────────┘          │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 3 places need a nose      →   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### A.3 Key animations

- **Card promotion.** When an item becomes NOW, the next card rises 8 pt, gains shadow,
  and its image crops from 16:9 to 3:2 over 420 ms `ease-scout`. The finished card
  shrinks to a 44 pt "done" strip and slides under the rail.
- **Béa's return.** Her card does not fade in. It *arrives*: a 12 pt upward overshoot
  with `ease-sniff`, bandana settling 80 ms behind her body. She only animates on
  arrival, never idles (an idling mascot is a toy; a returning one is a scout).
- **Progress rail fill.** Dots fill left to right with a 200 ms liquid sweep, and the
  current dot breathes at 0.06 amplitude, 3 s period.
- **Sheet detents.** Place detail opens at 40 %, snaps to 92 % on drag; the map behind
  parallaxes at 0.4× the sheet's travel.

### A.4 Transition flow

```
Home ──tab──▶ Places ──tap card──▶ Place sheet ──"add to day"──▶ Itinerary (day flashes)
  │                                                                     │
  └──⊕──▶ New ──Build──▶ Preferences ──▶ Béa working ──▶ Places ◀──────┘
             └─Import──▶ Paste ──▶ Béa reading ──▶ Review ──▶ Needs a nose ──▶ Places
```

Every terminal state lands on **Places**, never on the itinerary. The itinerary is
reached by intent.

### A.5 Béa interactions

| Trigger | Return |
| --- | --- |
| Gap > 90 min in today | "Béa found something in the gap" + one place card |
| Rain in the forecast for a day | Swap suggestion: indoor place, same neighbourhood |
| Two stops far apart in one day | "These two are 40 minutes apart. Béa would move one." |
| Day ends | Evening return: one photo prompt, one "worth keeping?" rec capture |
| Place saved by user | Silent. She does not congratulate. |

### A.6 Empty states

- **No trips:** the two doors (§0.1) over a soft horizon illustration. Line:
  *"Nothing on the map yet. Béa is ready when you are."*
- **Trip with no places:** *"An empty trip is just a date. Add a place, or let Béa
  scout."* with the two doors reduced to two buttons.
- **Today with nothing scheduled:** deliberately not an error. *"Nothing planned today.
  Béa thinks that is allowed."* + three nearby saved places.
- **Needs-a-nose queue empty:** *"Every place has a pin. Béa is pleased with herself."*

### A.7 Import experience

1. **Entry.** Paste field, share-sheet target, file drop. Existing roadmap item covers
   PDFs and calendar invites — the same funnel.
2. **Béa reading.** Full-screen, no spinner. The pasted text is shown, dimmed, with a
   highlight sweeping through it as places are found; each found name lifts out of the
   paragraph and flies to a growing pile at the bottom. Counter: *"17 places so far."*
   Wait copy comes from the existing trail pool (*following the scent*, *one more
   corner*).
3. **Review.** Places grid, grouped: *Matched* (large, quiet), *Béa's best guess*
   (medium, amber dashed), *Needs a nose* (small, hollow).
4. **Needs a nose.** Full-screen card run, one place at a time, 2–3 candidates with map
   thumbnails and the source sentence quoted underneath — the quote is what makes it
   verifiable. Buttons: pick / skip / *"not a place"*.
5. **Confirm.** One summary: places, days detected, dates, duplicates found against the
   existing timeline. Single primary button. Undo toast after.

### A.8 Itinerary view

A **vertical day rail**, not a table. Each day is a horizontally scrolling row of place
cards with a thin connecting line; time lives in a small left gutter, not a column.
Travel time between stops renders as the *length of the line*, not as a number — long
hops are visibly long. Tapping the line opens directions.

```
 Day 2 ──────────────────────────── 3 of 7
   09:00 ┃ ┌──────┐
         ┃ │ ▓▓▓▓ │ Jerónimos
         ┃ └──────┘
         ┃    │ 12 min ▁▁
   12:30 ┃ ┌──────┐
         ┃ │ ▓▓▓▓ │ Time Out  ● now
         ┃ └──────┘
         ╏    │ 25 min ▁▁▁▁▁▁
   16:00 ╏ ┌──────┐
         ╏ │ ▓▓▓▓ │ Bertrand
```

Solid rail = past and present, dotted = ahead. No grid lines, no all-day columns, no
spreadsheet.

### A.9 Day progress system

- A **dot rail** in the header: one dot per stop, filled as completed.
- **NOW is a position, not a badge** — the card stack physically scrolls so NOW is at
  the top; done items are collapsed above it.
- Completion is **ambient by default** (time passing marks things done) with a manual
  check available on the place sheet. Never nags.
- End-of-day state: the rail turns into a single line and Béa returns once with a recap.

### A.10 Advantages / disadvantages

**Advantages**
- Highest daily-use value: the "today" surface is genuinely useful in-destination.
- Warmest of the four; the companion metaphor is legible with no explanation.
- Cheapest to build on the existing card/timeline components.
- Works one-handed, offline-friendly, and reads well at a glance in sunlight.

**Disadvantages**
- Weakest spatial understanding — geography is inferred from line lengths, not seen.
- Card stacks flatten long trips; a 14-day trip is a lot of scrolling.
- "Today" is meaningless before the trip starts, so the pre-trip experience needs a
  separate landing (mitigated by defaulting to Places).
- Risk of feeling like a to-do app if the imagery budget is not met.

---

## Concept B — "Map First"

**Centre of gravity:** the place on the ground. The map *is* the app; the itinerary is a
layer over it. Closest reference: Apple Maps' sheet system + Google Trips' locality view.

### B.1 Screen hierarchy

```
Map (persistent, never unmounted)
├── Sheet: Places      (detent 1, default)   ← list of pins, sorted by cluster
├── Sheet: Day         (detent 1 alt)        ← the route for one day
├── Sheet: Place       (detent 2/3)
├── Overlay: Needs a nose  (map-anchored cards)
├── Overlay: Béa's scouting run (animated path)
└── Top bar: trip switcher · Build/Import ⊕ · day chips
```

There is only one screen. Everything else is a sheet detent or a map state. Back never
leaves the map.

### B.2 Wireframes

**Default, post-import**

```
┌─────────────────────────────────────┐
│  ⌂ Lisbon ⌄            D1 D2 D3 D4  │
│                                     │
│          ● ●                        │
│       ●     ◌ ←dashed = best guess  │
│     ●    ● ●         ○ ←hollow = ?  │
│            ●                        │
│         ●      ●                    │
│                                     │
│ ╭─────────────────────────────────╮ │
│ │           ────                  │ │
│ │  23 places · 3 need a nose      │ │
│ │  ┌───┐ Pastéis de Belém    ✓    │ │
│ │  │▓▓▓│ Bakery · Belém          │ │
│ │  └───┘                          │ │
│ │  ┌───┐ "rooftop in Alfama"  ?   │ │
│ │  │ ? │ Béa has 3 candidates     │ │
│ │  └───┘                          │ │
│ ╰─────────────────────────────────╯ │
└─────────────────────────────────────┘
```

**Day mode**

```
┌─────────────────────────────────────┐
│  ⌂ Lisbon ⌄        D1 [D2] D3 D4    │
│                                     │
│        ①━━━━━━②                     │
│              ┃                      │
│              ┗━━━━━③  (dimmed = ahead)│
│                                     │
│   ·········· other days ghosted ··· │
│                                     │
│ ╭─────────────────────────────────╮ │
│ │  Day 2 · 3 of 7 · 4.2 km walked │ │
│ │  ◍◍◍◌◌◌◌                        │ │
│ │  ① 09:00 Jerónimos       done   │ │
│ │  ② 12:30 Time Out        now ●  │ │
│ │  ③ 16:00 Bertrand               │ │
│ ╰─────────────────────────────────╯ │
└─────────────────────────────────────┘
```

**Ambiguity, resolved on the map**

```
┌─────────────────────────────────────┐
│     ○A          ○B      ○C          │
│      ╲          │      ╱            │
│       ╲         │     ╱             │
│ ╭─────────────────────────────────╮ │
│ │ 🐕 "Sainte-Chapelle" — Béa found│ │
│ │    three. The blog mentioned    │ │
│ │    stained glass and a queue.   │ │
│ │  ◀ ┌─────┐ ┌─────┐ ┌─────┐ ▶    │ │
│ │    │  A  │ │  B  │ │  C  │      │ │
│ │    │ Île │ │Vinc.│ │ Rep │      │ │
│ │    └─────┘ └─────┘ └─────┘      │ │
│ │      [ This one ]   [ None ]    │ │
│ ╰─────────────────────────────────╯ │
└─────────────────────────────────────┘
```

Swiping the candidate carousel **flies the map** to each candidate and lifts its pin.
This is the concept's signature move: ambiguity is resolved by *looking*, not reading.

### B.3 Key animations

- **Pin drop cascade.** On import completion, pins drop in geographic order (west→east)
  at 40 ms intervals, each with a 6 pt bounce (`ease-settle`) and a 200 ms ground
  shadow. 23 places take ~1.2 s and it is the single most satisfying moment in the app.
- **Confidence pulse.** Hollow pins pulse once every 4 s at 8 % scale, so the eye finds
  unresolved work without a badge count.
- **Map-follows-carousel.** 420 ms `ease-scout` camera fly, with the sheet held still —
  the world moves, the UI does not.
- **Route draw.** Day routes draw as a stroke from stop to stop, 180 ms per leg, with
  the walked portion in solid accent and the remainder in 40 % opacity.
- **Béa's scouting run.** When she is searching, a small paw-print trail animates along
  the streets of the area she is considering, then she returns to the sheet edge.

### B.4 Transition flow

```
Map[Places] ⇄ Map[Day n] ⇄ Map[Place]        (sheet detents + chips; no page pushes)
     │
     ├─ ⊕ Build  ──▶ full-screen preferences ──▶ map zooms out to city ──▶ pin cascade
     └─ ⊕ Import ──▶ full-screen paste ──▶ Béa reading ──▶ map zooms to bounds ──▶ cascade
                                                        └──▶ needs-a-nose overlay run
```

### B.5 Béa interactions

- **Anchored to geography.** Her returns appear as a pin with her bandana on it —
  tapping it opens the observation. Observations are always about *here*:
  "Two of tomorrow's stops are on this street."
- **Clustering opinions.** "Béa would spend Tuesday all in Alfama" — proposes a regroup
  of days by geography, previewed as a map morph before accepting.
- **Detour offers** when a route passes something saved: the route stroke sprouts a small
  branch and she offers it.

### B.6 Empty states

- **No trip:** map shows the user's World-tab pins, greyed. Two doors float over it.
  *"Béa has a map and no plans. Excellent starting position."*
- **Trip with no places:** map at city level with a single dashed circle. *"No pins yet.
  Paste a plan, or let Béa go sniff around Lisbon."*
- **Offline:** cached tiles, desaturated. *"No signal. Béa kept the map and the
  directions you already had."* (matches the existing offline-directions behaviour).

### B.7 Import experience

Import runs **over the map**. The paste screen is a sheet at 92 %; as Béa parses, the
sheet drops to 40 % and pins begin landing behind it — the user *watches the trip
appear in space*, which is the fastest possible trust signal for goal 2. Verification
then happens spatially: "does this shape look like my trip?" The review step is a
bounds-fit with a one-line verdict: *"23 places, mostly in Alfama and Belém, across
5 days."* Correction is by tapping a wrong-looking pin.

### B.8 Itinerary view

The itinerary is a **route on the map plus an ordered sheet list**. Reordering a stop in
the sheet redraws the route live and shows the delta: *"+9 min walking."* Days are
chips; scrubbing across chips morphs the route. There is no grid anywhere.

### B.9 Day progress system

- **The route is the progress bar.** Walked legs are solid, upcoming legs are 40 %.
- The **camera follows the day**: as stops complete, the map recentres on the next leg.
- A compact rail in the sheet header mirrors it for glanceability.
- Arrival detection (optional, permissioned) fills a leg automatically; manual tap
  otherwise.

### B.10 Advantages / disadvantages

**Advantages**
- Strongest possible answer to goal 2 and goal 3 — verification by *looking*.
- Best geographic sense-making; naturally surfaces bad routing and clustering.
- Matches the repo's existing map-centric direction and the World tab's globe language.
- One screen, so navigation is nearly free and the app feels fast.

**Disadvantages**
- Heaviest engineering: map performance, clustering, gestures, offline tiles.
- Poor for reading and browsing — text and imagery are cramped in a sheet.
- Weak before a trip has geography (early build flow has nothing to show).
- Sunlight, battery, and low-end device performance are real risks.
- Editorial delight is hard to deliver on a map surface.

---

## Concept C — "Editorial Travel Guide"

**Centre of gravity:** the trip as a printed guide made for you. Big type, full-bleed
photography, page turns. Closest reference: Airbnb's Trip Designer era + Apple News+
layout discipline.

### C.1 Screen hierarchy

```
Cover (trip)
├── Contents (the places, as a gallery-index)
│   └── Place page (full-bleed feature)
├── Day chapters (horizontal page turns)
│   └── Day page → stop entries (vertical)
├── Béa's margin notes (inline, in the gutter)
└── New
    ├── Build  → "commissioning" flow
    └── Import → "Béa is making a guide from this"
```

### C.2 Wireframes

**Cover**

```
┌─────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓                              ▓▓ │
│ ▓▓   L I S B O N                ▓▓ │
│ ▓▓   five days · march          ▓▓ │
│ ▓▓                              ▓▓ │
│ ▓▓   23 places, collected by    ▓▓ │
│ ▓▓   you, arranged by Béa       ▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                     │
│   ── swipe up for the places ──     │
└─────────────────────────────────────┘
```

**Contents — places first**

```
┌─────────────────────────────────────┐
│  THE PLACES                   23    │
│ ─────────────────────────────────── │
│  ┌─────────────┐  01                │
│  │ ▓▓▓▓▓▓▓▓▓▓▓ │  Pastéis de Belém  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓ │  bakery · belém    │
│  └─────────────┘  "the only one     │
│                    that matters"    │
│ ─────────────────────────────────── │
│  ┌─────────────┐  02                │
│  │ ▓▓▓▓▓▓▓▓▓▓▓ │  LX Factory        │
│  └─────────────┘  market · alcântara│
│ ─────────────────────────────────── │
│  ╭─────────────────────────────╮    │
│  │ 🐕 Béa left 3 notes in the  │    │
│  │    margin. Three places     │    │
│  │    still need a name.   →   │    │
│  ╰─────────────────────────────╯    │
└─────────────────────────────────────┘
```

**Day chapter**

```
┌─────────────────────────────────────┐
│  DAY TWO                    ·2/5·   │
│  Alfama, slowly                     │
│ ─────────────────────────────────── │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓▓▓▓▓ full-bleed morning ▓▓▓▓▓▓▓▓  │
│                                     │
│  MORNING                            │
│  Jerónimos Monastery        09:00   │
│  Go early. The queue is the         │
│  whole story here.                  │
│                                     │
│      ┊ 12 min on foot               │
│                                     │
│  MIDDAY                       ● now │
│  Time Out Market            12:30   │
│                          ╭────────╮ │
│                          │🐕 Béa: │ │
│                          │ the    │ │
│                          │ back   │ │
│                          │ row is │ │
│                          │ quieter│ │
│                          ╰────────╯ │
│  ─────────  ← swipe for Day Three   │
└─────────────────────────────────────┘
```

### C.3 Key animations

- **Page turn.** Horizontal day navigation uses a 420 ms `ease-scout` slide with a 0.9×
  parallax on the photograph and a subtle paper-edge shadow at the leading edge.
- **Cover parallax.** The cover photo moves at 0.5× scroll speed; the title locks to the
  top and shrinks into the nav bar between 0 and 120 pt of scroll.
- **Type settle.** Headlines arrive with a 200 ms opacity + 4 pt rise, letter-spacing
  easing from 0.04 em to 0 — the "printing" feel.
- **Margin note.** Béa's notes unfold from the gutter: a 10 pt-wide sliver expands to
  full card width over 260 ms, as if a bookmark opened.
- **Progress gutter.** A hairline in the left margin fills as the day is read/lived.

### C.4 Transition flow

```
Cover ──swipe up──▶ Contents ──tap──▶ Place page ──swipe down──▶ Contents
  │                    │
  │                    └──"read the days"──▶ Day 1 ⇄ Day 2 ⇄ Day 3  (horizontal)
  │                                              │
  └──⊕──▶ Build (commission) / Import (make a guide) ──▶ Cover reveal
```

The **cover reveal** is the payoff moment of this concept: after import, the guide's
cover assembles — photo, city name, place count — before anything else is shown.

### C.5 Béa interactions

- **Margin notes**: short, typographically distinct (italic, indented, bandana glyph).
  They *annotate* content rather than interrupt it.
- **Chapter introductions**: one line per day, written by her —
  *"Béa put Tuesday in Alfama so nobody walks the hill twice."* This single line does
  more for perceived intelligence than any other element in the four concepts.
- **The editor's note** on the cover: *"Arranged by Béa from your 23 places."*
- No floating bubbles, no toasts. Her presence is *set into the page*.

### C.6 Empty states

- **No trips:** a blank cover with a debossed bandana. *"An unwritten guide. Béa is
  holding the pen."* Two doors below the fold.
- **Trip with no places:** contents page with numbered blanks 01–05 ruled out.
  *"Every guide starts empty. Add the first place."*
- **No photos available for a place:** a typographic plate (large initial + name on
  paper texture) — never a grey box. This is a hard rule; the concept dies without it.

### C.7 Import experience

Framed as **commissioning a guide**.

1. Paste / share / file.
2. **Béa reading**: the source text is rendered as a manuscript page; found places are
   underlined in accent as she reads, in reading order, ~120 ms apart. Running marginal
   count: *"seventeen places."*
3. **Proof pages**: places presented as an index with their source sentence quoted
   beneath — *"from your blog: 'we finished at a rooftop in Alfama'"*. Quoting the
   source is this concept's trust mechanism (goal 2).
4. **Queries in the margin**: low-confidence items appear as editor's queries
   (*"Which Sainte-Chapelle?"*) with candidate plates.
5. **Cover reveal** on confirm.

### C.8 Itinerary view

Day chapters, read vertically, navigated horizontally. Times are *small caps in the
margin*, not a column. Travel between stops is a dotted vertical tick with a walking
time. Sections are named by daypart (MORNING / MIDDAY / EVENING) rather than by clock
hour, which keeps it from feeling like a schedule.

### C.9 Day progress system

- **A reading progress hairline** in the left margin, filling as stops complete.
- Completed entries fade to 60 % and their photo desaturates slightly — the page
  visibly "ages" behind you.
- The current entry is the only one with a full-bleed photograph; others are thumbnails.
  Progress is therefore visible from *layout weight*, not a widget.
- Day end: a printed end-mark (◆) and Béa's closing line.

### C.10 Advantages / disadvantages

**Advantages**
- Most premium and most differentiated; screenshots sell themselves.
- Best carrier for Béa's voice — margin notes are the most natural non-chatbot pattern
  of the four.
- Makes a trip feel like a gift from Present You to Future You, which is precisely the
  brand's triangle.
- Reading a day feels like travel, never like a spreadsheet (goal 5, decisively).

**Disadvantages**
- Photography-dependent: quality collapses without good imagery per place.
- Editing is awkward — printed things do not want to be dragged and reordered.
- Weak in-destination: too much scrolling for a quick "where next?" glance.
- Horizontal + vertical navigation needs teaching; discoverability risk.
- Heaviest content/production cost (per-day copy, per-place imagery).

---

## Concept D — "The Scout"

**Centre of gravity:** Béa herself. Every significant interaction is one narrative loop:

```
        ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
        │  YOU ASK     │ ──▶ │ BÉA INVESTI- │ ──▶ │ BÉA RETURNS  │
        │  (a question │     │ GATES        │     │ WITH FINDINGS│
        │   about the  │     │ (visible,    │     │ (a pack of   │
        │   world)     │     │  narrated)   │     │  cards)      │
        └──────────────┘     └──────────────┘     └──────────────┘
                 ▲                                        │
                 └──────── you keep, drop, or ask again ──┘
```

This is not a chat loop. The user never types *to* Béa; they *send her somewhere*. The
investigation is a visible, spatial, timed event — not a spinner — and findings arrive
as a physical-feeling **pack** that must be unpacked.

### D.1 Screen hierarchy

```
The Field  (home — the world as Béa sees it)
├── Send Béa    (ask sheet: destinations, gaps, questions — all tap-built)
├── The Run     (investigation, full screen, 4–20 s, skippable)
├── The Return  (pack of findings, card-by-card: keep / drop / more like this)
├── The Satchel (everything kept — places first)
│   └── Place dossier
├── The Route   (itinerary, presented as Béa's proposed path)
└── Day Watch   (in-destination day progress, Béa walking ahead of you)
```

### D.2 Wireframes

**The Field (home)**

```
┌─────────────────────────────────────┐
│                                     │
│        🐕  Béa is ready             │
│            Lisbon · 5 days          │
│                                     │
│  Send her to…                       │
│  ┌───────────────────────────────┐  │
│  │ ✦  Find things for this trip  │  │
│  │    She starts from nothing    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ ⤓  Read a plan you already    │  │
│  │    have — paste, share, drop  │  │
│  └───────────────────────────────┘  │
│                                     │
│  Last run · 2 days ago              │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │  kept 9 │
│  └──────┘ └──────┘ └──────┘         │
│                                     │
│  Satchel · 23 places        Route → │
└─────────────────────────────────────┘
```

**Send Béa (the ask — built by tapping, never typed)**

```
┌─────────────────────────────────────┐
│  ← Send Béa                         │
│                                     │
│  "Béa, go find                      │
│    [ dinner ⌄ ]                     │
│    near [ Alfama ⌄ ]                │
│    for [ Tuesday ⌄ ]                │
│    that is [ not touristy ⌄ ]"      │
│                                     │
│  ┌──────┐┌──────┐┌──────┐┌────────┐ │
│  │dinner││coffee││views ││walkable│ │
│  └──────┘└──────┘└──────┘└────────┘ │
│                                     │
│         [  Send her out  ]          │
└─────────────────────────────────────┘
```

The ask is a **fill-in-the-blank sentence** with tappable slots. It reads like natural
language but has zero free-text ambiguity — the anti-chatbot move that makes this
concept work.

**The Run (investigation)**

```
┌─────────────────────────────────────┐
│                                     │
│     ·  ·  ·  ·  ·  ·  ·             │
│   ·        🐕                       │
│  ·      paw trail across a          │
│          simplified map             │
│                                     │
│  ▸ checked 40 places in Alfama      │
│  ▸ threw out the ones with          │
│    tourist-menu boards              │
│  ▸ following the scent on three     │
│                                     │
│        ◍◍◍◍◍◍◌◌   about 6s          │
│                        [ skip ]     │
└─────────────────────────────────────┘
```

Narration is **real work, shown honestly** — counts of candidates considered and filters
applied, not theatre. Honest-AI mode: if she found little, she says so on return.

**The Return (the pack)**

```
┌─────────────────────────────────────┐
│  Béa came back with 5               │
│  ◍◍◌◌◌                       3 left │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │
│  │ ▓▓▓▓▓▓▓ photo ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │
│  │                               │  │
│  │ Taberna Sal Grosso            │  │
│  │ 12 min from your Tuesday stop │  │
│  │                               │  │
│  │ 🐕 "Béa waited outside for a  │  │
│  │    while. Locals, no menu     │  │
│  │    board, full at 8."         │  │
│  │                               │  │
│  │  ✕ drop        ♥ keep         │  │
│  └───────────────────────────────┘  │
│        ⟵ swipe to decide ⟶         │
└─────────────────────────────────────┘
```

**Day Watch (in-destination)**

```
┌─────────────────────────────────────┐
│  Day 2 · Béa is ahead of you        │
│  ◍◍◍◍◍◍◌◌◌                          │
│                                     │
│  behind you ────────────────────── │
│    ✓ Jerónimos      09:00           │
│    ✓ Coffee stop    11:10           │
│                                     │
│  you are here ● 12:34               │
│    Time Out Market                  │
│    ⟶ Directions                     │
│                                     │
│  🐕 ahead ──────────────────────── │
│    Bertrand         16:00           │
│    ╭─────────────────────────────╮  │
│    │ Béa ran ahead: the 28 tram  │  │
│    │ queue is long right now.    │  │
│    │ She would walk it.          │  │
│    │        [ reroute ] [ no ]   │  │
│    ╰─────────────────────────────╯  │
└─────────────────────────────────────┘
```

### D.3 Key animations

- **The send-off.** On "Send her out", Béa runs off the bottom-right of the screen; the
  UI she leaves behind desaturates 30 % and blurs 2 pt — *she is out there, you are
  here*. 500 ms, `ease-sniff`.
- **The run.** Paw prints appear along a path at 90 ms intervals with 8 % scale
  variation; the camera drifts slowly. Narration lines type on at 30 ms/char, max 3
  visible, oldest fading.
- **The return.** She trots back in from the left carrying the pack; the pack lands
  (12 pt bounce), then **cards fan out** — 5 cards spread to a 6° arc over 380 ms, then
  the top card squares up. The fan is the concept's signature gesture.
- **Keep / drop.** Swipe with rotation; kept cards fly to the Satchel icon and the
  satchel *bulges* once (scale 1.0 → 1.08 → 1.0, `ease-sniff`); dropped cards tumble.
- **Nothing found.** She returns with an empty mouth and sits down. No animation flourish
  — the absence is the message.

### D.4 Transition flow

```
Field ──send──▶ Ask ──send out──▶ Run ──▶ Return (pack)
  ▲                                         │ keep/drop each
  │                                         ▼
  └───────── Satchel (places) ⇄ Route (itinerary) ⇄ Day Watch
                   │
                   └── "send her again, but…" ──▶ Ask (pre-filled with last ask)
```

Every loop ends by offering the next loop, pre-filled — refinement is *another run*, not
a chat turn.

### D.5 Béa interactions

This concept's entire surface is Béa interaction, so the discipline is about *restraint*:

| Loop | User action | Béa's return |
| --- | --- | --- |
| Discover | Send her to a neighbourhood / daypart / vibe | A pack of 3–7 |
| Verify (import) | Give her a plan | A pack of *findings about the plan* |
| Disambiguate | Tap a "needs a nose" place | She goes and comes back with candidates |
| Optimise | Tap a day | "Béa walked it. Two hills, twice." + a proposed order |
| Compare | Tap two trips / two options | She returns with a verdict and its reason |
| In-destination | Nothing (ambient) | One "ran ahead" return per day, max |

She **must sometimes come back with nothing** — that is what makes the findings credible.
*"Béa went out. Nothing worth carrying back. She would ask a local."*

### D.6 Empty states

- **First launch:** just Béa, sitting, and the two doors. *"Béa is new here too. Where
  are we going?"*
- **Empty satchel:** *"The satchel is empty. Béa has been waiting to be useful."*
- **Empty run:** as above — the honest-return state, with a "send her somewhere else"
  affordance pre-filled with a widened ask.
- **No trip yet:** *"No trip on the board. Béa will settle for a daydream."* → build door.

### D.7 Import experience

Import is reframed as **"give Béa a plan to investigate"**, which converts the riskiest
trust moment into the concept's strongest narrative:

1. **Hand it over.** Paste / share sheet / file. Copy: *"Give Béa the plan. She will read
   it and report back."*
2. **The Run — reading.** She works through the text visibly: found names lift out and
   drop into her satchel; narration is honest work — *"23 place names · 5 days ·
   3 she is unsure about."*
3. **The Return — the report.** Not a diff table. A card run:
   - *"Béa matched 18 of them."* (grid of matched places, tappable, quiet)
   - *"Béa took her best guess on 2."* (best guess shown large, with the alternative
     one tap away)
   - *"Three she will not guess at."* (each with candidates + the quoted source line)
   - *"One looked like a place you already have."* (dedupe, per the roadmap item)
4. **Unpacking** resolves the ambiguities, one card at a time, in the same keep/drop
   language as discovery — so the user has already learned the gesture.
5. **Settled.** Satchel fills; Route becomes available. Undo toast covers the batch.

This satisfies goal 2 better than a preview table because Béa **reports what she was
unsure about before being asked** — volunteered uncertainty is the strongest available
trust signal.

### D.8 Itinerary view

Called **The Route** — framed as *Béa's proposed path*, which makes it feel authored and
revisable rather than generated.

```
┌─────────────────────────────────────┐
│  The Route · 5 days                 │
│  🐕 "Béa walked all of it. Twice."  │
│                                     │
│  ╭─ DAY 1 ─────────────── 4 stops ─╮│
│  │  ▓▓  ▓▓  ▓▓  ▓▓                 ││
│  │  Belém, then west                ││
│  ╰─────────────────────────────────╯│
│  ╭─ DAY 2 ─────────────── 7 stops ─╮│
│  │  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓     ││
│  │  Alfama, slowly    ● you're here ││
│  ╰─────────────────────────────────╯│
│  ╭─ DAY 3 ─────────────── 3 stops ─╮│
│  │  ▓▓  ▓▓  ▓▓         light day    ││
│  ╰─────────────────────────────────╯│
│                                     │
│  🐕 "Day 2 is heavy. Béa would move │
│      one thing to Day 3."  [ show ] │
└─────────────────────────────────────┘
```

Each day is a horizontally scrolling strip of place thumbnails with a one-line character
("Alfama, slowly"). Density is legible at a glance — a heavy day *looks* heavy. Accepting
a rebalance animates the thumbnail physically moving between strips.

### D.9 Day progress system

**Béa is ahead of you** — the spatial metaphor carries the progress model:

- The day splits into **behind you** (collapsed, checked, desaturated), **you are here**
  (expanded, live, with directions), and **ahead** (with Béa's icon at the boundary).
- The boundary line *is* the progress indicator; it physically moves down the screen.
- Béa "runs ahead" once per day with something time-sensitive (queue, light, closing
  time) — the one unsolicited return she is allowed.
- End of day: she comes back and sits. Recap + one capture prompt (photo/rec), consistent
  with the Past-You-captures belief.

### D.10 Advantages / disadvantages

**Advantages**
- The most coherent product story of the four; every screen teaches the same loop.
- Turns latency into narrative — a 6-second wait becomes the best moment in the app
  instead of the worst.
- Volunteered uncertainty makes the confidence ladder feel like character, not error
  handling. Best trust story for import.
- Unmistakably not a chatbot, despite being the most "AI-forward" concept.
- Strongest emotional brand fit: *she explores ahead of you and brings discoveries back*.

**Disadvantages**
- The narrative must never feel fake: if the run is theatre over an instant API call,
  users will see it and trust collapses. Run duration must be bounded by real work, and
  always skippable.
- Repetition risk — the third run must not feel like the first. Needs variation in
  narration, finding counts, and honest empty returns.
- Slower for power users who know exactly what they want; needs an express path
  (long-press → send instantly with last ask).
- Personality-heavy: localisation and tone drift are expensive, and the voice test in
  `bea-voice.test.ts` must cover every new pool.
- Weakest at *browsing* a finished trip — it is a discovery machine first.

---

## 5. Comparison

| | A · Companion | B · Map First | C · Editorial | D · The Scout |
| --- | --- | --- | --- | --- |
| Goal 1 · build vs import | Strong | Strong | Strong | **Strongest** (two errands) |
| Goal 2 · import trust | Good (review grid) | **Strongest** (see it in space) | Strong (quoted sources) | **Strongest** (volunteered doubt) |
| Goal 3 · confidence UX | Good | **Strongest** (candidates on map) | Good (margin queries) | Strong (unpack the pack) |
| Goal 4 · places first | Strong | **Strongest** | Strong | Strong |
| Goal 5 · not a spreadsheet | Good | Good | **Strongest** | Strong |
| Goal 6 · day progress | **Strongest** | Strong | Moderate | Strong |
| Goal 7 · Béa participates | Good | Moderate | Strong | **Strongest** |
| Daily in-destination use | **Best** | Good | Weak | Good |
| Engineering cost | Low | **High** | Medium | Medium-high |
| Content cost (photos/copy) | Medium | Low | **High** | Medium |
| Differentiation | Low | Medium | High | **Highest** |

### Recommendation

**Ship D's narrative over A's daily surface, with B's map as the verification layer.**

Concretely: The Scout's request → investigate → return loop for every *creation* moment
(build, import, disambiguate, optimise, compare); the Travel Companion's Today surface
for every *in-destination* moment; Map First's candidate-carousel-flies-the-map as the
one screen that resolves ambiguity. Editorial's margin notes and day-character lines are
the cheapest borrow of all — one line per day buys most of C's perceived craft without
its photography budget.

### What to prototype first

1. **The Return, on import.** One throwaway prototype: paste a real travel blog, watch
   Béa read it, unpack the pack. If this does not produce delight and trust in the first
   20 seconds, the narrative frame is wrong and A should lead instead.
2. **The pin cascade + candidate carousel** (B §B.3, §B.2). Cheap to fake, and it is the
   fastest way to learn whether spatial verification beats list verification.
3. **The two doors.** Five-second test, no facilitation: *"which one reads as 'I already
   have a plan'?"* Iterate until it is unanimous.
