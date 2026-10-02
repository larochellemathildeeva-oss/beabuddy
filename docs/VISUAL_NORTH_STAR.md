# Béa Visual North Star

This document is the visual authority for Béa. It exists to stop design tools, contributors, and future redesigns from drifting away from the approved Home and World direction.

## Authority order

When design sources conflict, use this order:

1. The approved Home and World reference boards supplied by the owner.
2. This document.
3. `DESIGN.md` and `.impeccable/design.json`.
4. Existing implementation details.

Product behavior is separate: the repository remains the source of truth for what each page actually does. A redesign may change composition and hierarchy, but it must not silently remove, invent, or replace functions.

## The visual idea

Béa is **immersive geography + editorial typography + sparse utility UI**.

The visual character comes from the travel content itself: terrain, globe, routes, place imagery, real memories, and spatial relationships. UI supports that content instead of competing with it.

A Béa screen should feel:

- editorial, not dashboard-like;
- immersive, not card-heavy;
- modern and sleek, but not sterile;
- playful through color and copy, not gimmicks;
- recognizable as travel before the user reads the labels;
- premium without becoming luxury beige;
- functional enough to use one-handed while travelling.

## Colorful theme: approved palette

Colorful is the primary exploration theme for current redesign work.

### Brand anchor

- **Ink / near-black:** `#0A0A0A`
- Used for large editorial type, important icons, structural controls, selected text, and high-confidence actions.
- Ink is the visual anchor of Colorful. Pink is not the brand-defining accent.

### Primary interaction accent

- **Béa periwinkle-cobalt:** `#6675FF`
- Soft: `#ECEEFF`
- Use for focus rings, primary interactive emphasis, route selection, active controls where a chromatic accent is useful, and key progress states.
- Do not flood whole screens with it. Most screens should still read primarily as white/ink plus travel imagery.

### Base surfaces

- **App ground:** `#FBF8F4`
- **Card / floating surface:** `#FFFFFF`
- **Primary text:** `#0A0A0A`
- **Secondary text:** `#66615D`
- **Hairline border:** `#E9E3DE`

There should be one consistent app ground, not several unrelated shades of white from page to page.

### Supporting pastel family

These are peers, not route-specific brand colors:

- **Blush:** `#FBDCE7`
- **Powder blue:** `#DBECFA`
- **Mint:** `#DDF1E8`
- **Butter:** `#FCF2CC`
- **Lavender:** `#EAE3FA`

Use them to distinguish modules, categories, secondary controls, moments, and supporting states. No one pastel owns Home, World, Trips, Recs, or You.

### Color rules

- No terracotta or burnt orange UI chrome.
- Pink is allowed, but it is one pastel among peers.
- Do not make each top-level tab a different brand color.
- Do not tint an entire page with one pastel.
- Natural travel imagery keeps its real colors.
- Semantic map/pin states may retain their own established state colors when meaning depends on them.
- Selected state must remain readable without color alone.

## Typography

- **Instrument Serif**: identity, large page titles, destination names, major section headings, expressive moments.
- **Manrope**: functional UI, buttons, tabs, dates, metadata, forms, dense travel information.

The serif/sans contrast is part of Béa's identity. Do not replace it with a generic all-sans startup system.

Large editorial type is encouraged when a screen has one dominant idea. Dense utility screens should stay restrained.

## Composition rules

### 1. One dominant object

Every important screen should have one obvious visual or functional anchor.

Examples:
- Home: the current/upcoming journey.
- World: the globe.
- Trips: the active/next journey or trip collection.
- Companion: the current stop.
- Map: the map itself.
- Recs: the save/search action or a place collection.
- Memories: the destination and its memories.

If five modules compete equally, the hierarchy is wrong.

### 2. Geography is interface when geography matters

Use immersive geography on travel/spatial surfaces: Home, World, Trips, Companion, Map, Recs Nearby, Memories, Story.

Do **not** force maps or landscapes onto settings, auth, documents, expenses, legal, destructive confirmations, or other utility surfaces. Those inherit Béa's typography, spacing, color and polish, not the geographic metaphor.

### 3. Cards are supporting actors

Do not turn Béa into card soup.

Prefer:
- full-bleed or edge-to-edge visual regions;
- floating controls;
- hairlines and spacing;
- compact strips;
- bottom sheets;
- progressive disclosure.

Use a card only when the content truly behaves as a discrete object.

### 4. Floating chrome

Controls over maps, globes, photography, and terrain may float in translucent or white surfaces with restrained blur/shadow. They should be sparse and thumb-friendly.

### 5. Real content first

Use the traveller's places, routes, photos, bookings, saved recommendations, trip state, and memories to create visual interest. Do not fabricate decorative destinations, stats, bookings, or user history in production.

## Navigation

The member app always has five primary destinations:

**Home · World · Trips · Recs · You**

No design reference may rename these to Saved, Profile, Plan, or other alternatives.

The active state uses geometry/weight plus color. Color alone is insufficient.

## Product hierarchy by surface

This section tells design tools what each surface is trying to accomplish. It does not replace the implementation checklist.

### Public Home `/`
Goal: make a stranger understand Béa and start an account.

Visual outcome: approved Home language, clear product loop, one strong CTA. Show **Save → Plan → Travel → Remember** rather than a feature inventory. Do not position Béa as merely an AI itinerary generator.

### Signed-in Home `/`
Goal: answer **What matters now?**

- No trip: activation and first meaningful action.
- Upcoming trip: trip + preparation.
- On trip: current stop → leave by → next stop.
- Returned: memory/review opportunities.

### World `/world`
Goal: answer **Where have I been, and where might I go?**

The globe is the primary object. Preserve the real Map / Bucket list / Been there / Stats structure. World is not a flat-map dashboard.

### Trips `/trips`
Goal: answer **Which journey am I working on?**

Lead with the active or next trip. Preserve Plan with Béa, New trip, Join with a code, Calendar, trip states, and real trip glance data. Past and Drafts are quieter.

### Plan with Béa `/trips/plan`
Goal: get to a useful trip draft with minimal cognitive load.

The product supports Build, Import, Optimize and Compare. Present them progressively rather than as four equally loud products when context already determines the likely task.

### Trip detail `/trips/$tripId`
The persistent trip context is shared; each perspective has a different job.

- **Overview:** trip readiness and health.
- **Companion:** current stop → leave by → next stop → later.
- **Map:** spatial understanding; map owns the viewport.
- **Timeline:** view/edit ordered itinerary.
- **Bookings:** what is actually booked and the documents attached to it.

Do not merge these into one overloaded screen.

### Recs `/recommendations`
Goal: answer **What places did I save, and what should I do with them?**

The fastest path is one field that accepts a place name or link. Other acquisition modes stay behind progressive disclosure. Retrieval should feel like a personal collection, not CRM rows.

### You `/profile`
Goal: answer **Who am I to Béa, and how does Béa work for me?**

Lead with identity and travel profile. Preferences, packing, work travel, documents, Your Béa, appearance, data, help and legal remain reachable but visually lower in the hierarchy.

### Preferences `/preferences`
Goal: teach Béa how the traveller likes to travel once, then reuse it everywhere.

### Your Béa `/profile/bea`
Goal: personality customization and delight. Keep serious settings and facts clear.

### Trip documents `/profile/documents`
Goal: find a confirmation under pressure. Trust and speed beat personality here.

### Calendar `/calendar`
Goal: see when travel happens and jump directly into the relevant trip.

### Photos `/photos`
Goal: turn selected photos into organized travel memories, with clear privacy before import and immediate reward after import.

### Memories `/memories`
Goal: make accumulated travel history emotionally valuable. Destination-led, photo-led, and editorial.

### Story `/story`
Goal: replay travel. Cinematic and low-chrome.

### Expenses `/expenses`
Goal: capture and export work-travel receipts. Utilitarian and fast.

### Help `/help`
Goal: get unstuck. Search and goal-based walkthroughs first; FAQ second.

### How it works `/how-it-works`
Goal: convert a skeptical visitor by showing the product loop, not listing features.

### Shared trip `/shared/$token`
Goal: let a non-user understand the plan immediately. Current/today context first when follow-along is enabled. Keep it read-only and clear.

### Auth and password recovery
Goal: remove friction and establish trust. Keep these surfaces plain, fast and utilitarian.

### Privacy and Terms
Goal: remove anxiety. Plain English, strong typography, minimal decoration.

## Interaction and density

- Mobile-first.
- Minimum 44px touch target.
- Active-trip surfaces must be usable while walking, holding luggage, or glancing quickly.
- Progressive disclosure beats permanent toolbars.
- Normal viewing and editing should be visibly different modes where an editor exposes many actions.
- Important current state should appear above customization and administration.

## Béa voice

Béa speaks about herself in the third person. High personality belongs in saves, empty states, Near, plan completion, milestones, memory import, and waits. Auth, legal, security, expenses, errors and destructive actions stay utilitarian.

No mascot or decorative character should be invented. Use only approved Béa artwork already in the product.

## Reference discipline for design tools

Before creating or redesigning any page:

1. Re-open the approved Home and World references.
2. Read the existing route and relevant function checklist in the repo.
3. State the page's single user job.
4. Preserve every real function unless the owner explicitly approves removal.
5. Use this Colorful palette exactly; do not invent a new page palette.
6. Keep the same typography, shape language, imagery treatment, and navigation.
7. Check the result side-by-side against Home and World before calling it finished.

If a tool cannot reproduce the approved aesthetic faithfully, say so before substituting another style.
