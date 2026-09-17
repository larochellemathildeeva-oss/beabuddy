# Launch video — prompt pack

Internal. Scene-by-scene prompts for Google AI Studio / Veo, written against
what Béa actually is (`BRANDING.md`, `WHAT_BEA_BELIEVES.md`, `src/lib/bea-voice.ts`)
and what Béa actually ships.

Generate one scene per clip and stitch them. Regenerating scene 4 should never
mean regenerating scenes 1–3.

---

## What changed from the first draft, and why

Three corrections, in order of how much damage they would have done.

**The video sold the product Béa's branding explicitly rejects.** `BRANDING.md`
positions Béa as "the place where your travel life lives — **not** another AI
travel planner · itinerary builder · map · bucket list · trip generator," and
ends with a hard rule: _never lead with "AI travel planner."_ The draft led with
exactly that — "The AI begins building an itinerary," "Build personalized
itineraries in seconds," "The Béa AI compares both plans." A launch video is the
loudest positioning statement a product makes; this one argued against its own
brand.

The fix is not cosmetic. Béa's real arc is already written down:
**Past You captures → Present You decides → Future You benefits.** That is a
better story than "AI does it for you," because it is about the viewer being
clever rather than the software being clever. Every scene below serves it.

**The palette was someone else's.** Charcoal / teal / ocean blue / "professional
SaaS aesthetic" describes a fintech dashboard. Béa is warm cream, terracotta,
Instrument Serif over Manrope. Real values are in the master prompt.

**Two scenes described features that do not exist.**

- _"Recommended for people with similar tastes"_ — there is no collaborative
  filtering in the codebase. Nothing compares one user's taste to another's.
  Claiming it in a launch video is a promise the app breaks on day one.
- _"Two itineraries side by side… travel times… neighborhood clustering"_ —
  `compare.functions.ts` compares **saved places** ("Help me choose"), not two
  itineraries. The real reordering feature is **Optimize**, which reshuffles one
  trip's stops and shows the new order for approval before saving.

Both were replaced with real features that happen to be better on camera.

---

## Master prompt

Prepend to every scene.

```text
Create a premium product launch video for a travel memory app called Béa.

Positioning:
- Béa is where your travel life lives
- not an AI trip generator, not a booking app, not a map app
- the app remembers what you saved so you can use it later
- the person is the clever one; the software is the diligent one

Style:
- Apple keynote quality, Airbnb product commercial
- warm editorial minimalism, not cold SaaS
- premium motion design, smooth transitions
- realistic mobile application interface
- printed-travel-journal feeling rendered as software

Colors (exact):
- warm cream background #F9F2E7
- near-white cards #FFFEFB
- deep warm ink for text #2A1D16
- terracotta accent #B74111
- soft sand #EEDBC6
- for night scenes: warm near-black #17100C with #F27E46 accent

Typography:
- headlines in a high-contrast serif (Instrument Serif)
- interface text in a geometric sans (Manrope)
- generous spacing, never cramped

Camera:
- smooth zooms, elegant pans, floating interface panels
- no shaky camera, no cartoon style, no sci-fi holograms

Mood:
- warm, witty, reassuring, quietly competent
- nostalgic without being sentimental

Format:
- app demonstration mixed with motion graphics
- 16:9 landscape

No watermarks. No glitches. No distorted text. No random symbols.
No blue or teal anywhere. No neural-network or brain imagery.
Professional quality UI.
```

---

## Scene 1 — The problem: it all scatters

```text
Scene 1.

A phone screen fills with travel recommendations arriving from everywhere at once.

A friend's voice note. A screenshot of a restaurant. A saved Instagram reel.
A article link pasted into a group chat. A note typed at midnight and never reopened.

Each one appears, then slides away into a different corner of the phone —
photos, messages, notes, browser tabs — scattering rather than collecting.

Camera pulls back slowly. The fragments drift apart into darkness.

Warm cream interface on #F9F2E7, terracotta highlights.

Serif text fades in:

"You already found the good places."

Beat.

"You just can't find them again."

Premium Apple-style animation. No clutter-panic, no frantic cutting —
the feeling is quiet loss, not chaos.
```

**Why:** the enemy is not information overload, it is _your own good taste,
lost_. That is the problem Béa actually solves.

---

## Scene 2 — Capture: paste anything

```text
Scene 2.

A user pastes a link into Béa.

The pasted item is an article: "10 Hidden Gems in Lisbon".

Béa reads it. A calm progress line, not a scanning laser.

Place cards appear one at a time, each with a name, a neighbourhood and a
small terracotta pin: a bakery, a viewpoint, a tiled courtyard, a record shop.

The user taps three of them. The others fade away politely.

Pins settle onto a warm-toned city map.

Serif text:

"Paste a link. Keep the parts you want."

Modern product commercial. Warm cream UI, terracotta accents.
The app is doing filing, not thinking for the user.
```

**Real feature:** link + article import (`RecoListImport`, `parsePlaceLink`).
Note the deliberate beat where the user _chooses_ — Béa extracts, the person
curates. That is the brand line.

---

## Scene 3 — The vault: four kinds of wanting

```text
Scene 3.

A grid of saved places in a warm cream interface.

Each card carries one of four coloured labels:

Visited.
Next time.
Wishlist.
Recommendation.

The user sorts a handful of places into these four buckets with small taps.
Cards animate into tidy groups.

A counter climbs quietly in the corner: 40, 80, 140 saved places.

Then the view pulls back and the same places appear as coloured pins
scattered across a world map.

Serif text:

"Future You has excellent taste."

No AI imagery. No network diagrams. No clustering animation.
This is a well-kept collection, not a machine learning demo.
```

**Real feature:** the recommendation vault's four pin types — the exact labels
are `Visited`, `Next time`, `Wishlist`, `Recommendation`. The line is Béa's own
Recs screen signature from `BRANDING.md`.

---

## Scene 4 — Assemble a trip from what you already saved

```text
Scene 4.

The user starts a trip: Tokyo, five days.

Instead of an empty planner, a panel slides in titled "From your saved places".

It is already full — the places this person saved months ago, the ones
near Tokyo floating to the top.

The user drags four of them into days. Each lands on a timeline with a time
and a day label. A map draws walking lines between them.

One tap on "Optimize" and the stops reshuffle into a tighter route —
then pause, waiting for approval, showing the old order and the new one.

The user approves.

Serif text:

"Professionally assembled from your own excellent ideas."

The software is doing the tedious part. The taste was already there.
```

**Real feature:** `SavedPlacePicker` (the saved-recs-into-trips bridge) and
**Optimize**, which proposes a reordering and waits for approval before saving.
The tagline is the Planning screen signature from `BRANDING.md`. Note what this
scene refuses to say: nothing here claims Béa invented the itinerary.

---

## Scene 5 — Near: Past You left a breadcrumb

```text
Scene 5.

A person walking in a city, phone in hand. Late afternoon light.

A quiet notification appears — not an alert, a nudge:

"You saved a place two streets away."

The card opens: a café, saved eleven months ago, recommended by a friend
whose name is on the card.

The user looks up. The café is right there.

Serif text:

"Past You left a breadcrumb."

Warm, understated, real street footage blended with the interface.
No excitement music sting. This is a small, good moment.
```

**Real feature:** the Near / Opportunities screen, and its `BRANDING.md`
signature line verbatim. **This scene replaces the invented "similar tastes"
scene**, and it is a far better one — it is the single clearest demonstration of
why saving things into Béa pays off later.

---

## Scene 6 — Help me choose

```text
Scene 6.

Two saved restaurants sit side by side on screen.

The user cannot decide. They tap "Help me choose".

A calm comparison appears — not a dashboard, a short honest note:
how far each one is, who recommended it, when it was saved,
which one fits tonight.

Béa gives an opinion, in one line, with a reason.

The user picks. The other place stays saved for next time.

Serif text:

"Choosing is harder than dreaming."

Trustworthy and analytical, never flashy.
No percentage scores. No confidence meters. No charts.
```

**Real feature:** `compare.functions.ts` — comparison of **saved places**, which
is what it actually does. The line is the "Help me choose" signature from
`BRANDING.md`. **This scene replaces the invented itinerary A/B comparison.**

---

## Scene 7 — The map fills in

```text
Scene 7.

The user connects their photo library.

Thousands of travel photos are read — quietly, on the device.

A warm near-black world map appears (#17100C).

Pins begin lighting in terracotta, one by one, then faster:

Montreal. New York. Lisbon. Paris. Rome. Tokyo.

Years of travel assembling themselves onto one map.

The user taps a pin. Photos from that trip fan open —
a meal, a street, a friend laughing.

Serif text:

"Some places become recurring characters."

Warm and nostalgic. This is the emotional peak of the film.
Hold the last shot longer than feels comfortable.
```

**Real feature:** `photos.tsx` reads EXIF coordinates and pins the library onto
the world map. The line is the Memories screen signature from `BRANDING.md`.
This was the strongest scene in the original draft and it was already accurate —
it moves later so the film ends on it.

---

## Ending

```text
Final scene.

Warm near-black background #17100C.

The world map from the previous scene, still glowing with terracotta pins,
slowly drifts out of focus.

The Béa logo fades in — the small French bulldog, warm and hand-drawn.

Serif text, one line at a time, unhurried:

"Béa remembers your travel life"

"so Future You doesn't miss what matters."

Beat.

"Remember everywhere. Go anywhere."

End card: Get Started, in terracotta #B74111 on warm near-black.

Premium Apple keynote style. Warm, not corporate.
```

**Copy:** the mission line and the strongest tagline, both verbatim from
`BRANDING.md`. Do not paraphrase these — they are the source of truth for the
site, the store listing and onboarding, and the video should match them exactly.

---

## Production notes

**Generate per scene, not as one 90-second render.** Unchanged from the original
plan, and correct — a bad scene 5 should cost one regeneration.

**Consider shooting scenes 2, 3, 4 and 6 from the real app instead.** Veo cannot
render Béa's actual interface, and invented UI in a product video is obvious to
anyone who then opens the app. Screen-record the real screens and use Veo for
scenes 1, 5 and 7 plus the connective motion graphics. The film will be more
consistent and more honest, and the real UI is good enough now to carry it.

**Suggested running order and weight:**

| #   | Scene            | Length | Job            |
| --- | ---------------- | ------ | -------------- |
| 1   | It all scatters  | 8s     | the problem    |
| 2   | Paste a link     | 10s    | capture        |
| 3   | The vault        | 8s     | the collection |
| 4   | Assemble a trip  | 12s    | the payoff     |
| 5   | Near             | 10s    | the surprise   |
| 6   | Help me choose   | 8s     | the honesty    |
| 7   | The map fills in | 14s    | the feeling    |
| —   | Ending           | 8s     | the ask        |

Roughly 78 seconds plus transitions.

**What never appears:** the phrase "AI travel planner," neural-network or brain
imagery, teal or blue, confidence percentages, or any claim that Béa decides for
you. Béa remembers and assembles. The person decides.
