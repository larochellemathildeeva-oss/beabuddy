---
name: Béa
description: Mobile-first editorial travel workspace built around immersive geography, sparse utility UI, and three user-selectable themes.
colors:
  calm-background: "#f7f2e9"
  calm-foreground: "#28231f"
  calm-card: "#fffdf8"
  calm-elevated: "#efe8dc"
  calm-primary: "#7a6552"
  calm-primary-soft: "rgb(122 101 82 / 0.12)"
  calm-border: "#ddd3c7"
  colorful-background: "#fbf8f4"
  colorful-foreground: "#0a0a0a"
  colorful-card: "#ffffff"
  colorful-elevated: "#f5f1ed"
  colorful-primary: "#6675ff"
  colorful-primary-soft: "#eceeff"
  colorful-muted-foreground: "#66615d"
  colorful-border: "#e9e3de"
  colorful-tile-blush: "#fbdce7"
  colorful-tile-sky: "#dbecfa"
  colorful-tile-mint: "#ddf1e8"
  colorful-tile-butter: "#fcf2cc"
  colorful-tile-lavender: "#eae3fa"
  dark-background: "#171513"
  dark-foreground: "#f6f0e8"
  dark-card: "#211e1b"
  dark-elevated: "#2b2723"
  dark-primary: "#c9a27e"
  dark-primary-soft: "rgb(201 162 126 / 0.16)"
  dark-border: "#3a342f"
  visited: "oklch(0.55 0.135 249)"
  next-time: "oklch(0.56 0.12 158)"
  wishlist: "oklch(0.66 0.135 84)"
  recommendation: "oklch(0.545 0.155 305)"
typography:
  display:
    fontFamily: '"Instrument Serif", ui-serif, Georgia, serif'
    fontWeight: 400
  body:
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif'
    fontWeight: 400
rounded:
  input: "14px"
  button: "16px"
  card: "18px"
  sheet: "28px"
  pill: "9999px"
spacing:
  screen: "20px"
  card: "16px"
  tap-target: "44px"
---

# Design System: Béa

## Visual authority

The approved Home and World reference boards are the visual authority for Béa. `docs/VISUAL_NORTH_STAR.md` translates those references into rules that design tools and contributors can follow.

When sources conflict:

1. approved Home and World references;
2. `docs/VISUAL_NORTH_STAR.md`;
3. this file and `.impeccable/design.json`;
4. existing implementation styling.

The repository remains the behavioral source of truth. A visual redesign may change hierarchy and composition, but must not silently remove, invent, rename, or replace real functionality.

## The Béa visual idea

Béa is **immersive geography + editorial typography + sparse utility UI**.

The strongest screens use the traveller's world itself as the interface: terrain, routes, globe, place imagery, memories, and spatial relationships. Controls support that content rather than turning the app into a dashboard of equally weighted cards.

The same visual identity must also survive on non-geographic surfaces. Auth, documents, expenses, settings, legal and destructive actions inherit the typography, spacing, shape language and palette without forcing maps or decorative terrain where it does not belong.

### Key characteristics

- Mobile-first and thumb-friendly.
- Instrument Serif creates editorial identity; Manrope handles functional UI.
- One dominant visual or functional anchor per screen.
- Travel imagery and geography provide most of the drama.
- Floating controls and compact strips are preferred over permanent toolbars.
- Cards are supporting actors, not the default wrapper for every item.
- Colorful is a coordinated multi-accent system, not a different brand color for each tab.
- Product state and information hierarchy matter more than decoration.

## Color system

### Colorful — current redesign authority

Colorful is the primary theme for current visual exploration.

**Brand anchor**
- Ink / near-black: `#0A0A0A`.
- Used for large editorial type, important icons, high-confidence actions and structural emphasis.

**Primary interaction accent**
- Béa periwinkle-cobalt: `#6675FF`.
- Soft interaction tint: `#ECEEFF`.
- Used for focus, selected interactive emphasis, route selection and important progress states where a chromatic cue helps.
- It is deliberately restrained. Most screens should still read as app ground + ink + real travel imagery.

**Base surfaces**
- App ground: `#FBF8F4`.
- Card / floating surface: `#FFFFFF`.
- Primary text: `#0A0A0A`.
- Secondary text: `#66615D`.
- Border: `#E9E3DE`.

There is one consistent Colorful app ground. Do not create unrelated cream, white and beige page backgrounds.

**Supporting pastel family**
- Blush `#FBDCE7`
- Powder blue `#DBECFA`
- Mint `#DDF1E8`
- Butter `#FCF2CC`
- Lavender `#EAE3FA`

These are peer accents. Pink is not Béa's defining UI accent. No pastel owns Home, World, Trips, Recs or You.

### Calm and Dark

Calm and Dark remain supported user themes and preserve the same information architecture, geometry and interaction model. Do not redesign their palette independently while working on Colorful unless the owner explicitly asks for that review.

### Semantic colors

Visited, Next time, Wishlist and Recommendation retain semantic hue families because their meaning spans multiple surfaces. Semantic state color is not the same thing as brand accent.

### Named color rules

**No Terracotta.** Terracotta and burnt-orange UI chrome are not part of the approved system.

**Ink Anchors the Brand.** Béa should still feel recognizable when all pastel accents are removed.

**Periwinkle Is Interaction, Not Wallpaper.** `#6675FF` marks interaction and emphasis; it does not tint whole pages.

**Pastels Are Peers.** Blush, sky, mint, butter and lavender support hierarchy and category distinction. None owns a top-level tab.

**Natural Travel Color Stays Natural.** Photography, globe textures, maps and terrain may retain their real colors.

**No Color-Only State.** Selection must also use weight, geometry, text or icon treatment.

## Typography

**Display:** Instrument Serif (`ui-serif, Georgia, serif` fallback).

**Functional:** Manrope (`ui-sans-serif, system-ui, sans-serif` fallback).

The serif/sans contrast is a core part of Béa's identity. Do not flatten the product into an all-sans startup UI.

### Hierarchy

- Large editorial display: page identity, destination, journey or emotional moment.
- Section title: major grouping or important state.
- Functional heading: compact module hierarchy.
- Body: dense trip information and explanatory text.
- Label / eyebrow: compact structural metadata, usually Manrope uppercase with tracking.

**Editorial only when it helps.** Dense travel data, forms, filters and high-stakes content remain Manrope.

## Composition

### One dominant object

Every important screen has one obvious anchor.

Examples:
- Home: current/upcoming journey.
- World: globe.
- Trips: active/next trip or journey collection.
- Companion: current stop.
- Map: map.
- Recs: add/search action or place collection.
- Memories: destination and its memories.

If five modules compete equally, the hierarchy is wrong.

### Geography as interface

Use immersive geography where location is part of the task: Home, World, Trips, Companion, Map, Recs Nearby, Memories and Story.

Do not force geography onto auth, legal, documents, expenses, settings, confirmations or other utility screens.

### Cards are supporting actors

Avoid card soup. Prefer:
- full-bleed / edge-to-edge visual regions;
- floating controls;
- compact information strips;
- hairlines and spacing;
- progressive disclosure;
- bottom sheets and contextual panels.

A card should represent a discrete object, not simply be a default container.

### Floating chrome

Controls over maps, terrain, globe and photography can use white or translucent surfaces with restrained blur and soft shadow. Keep them sparse and at least 44px tappable.

### Real content first

Use actual traveller data to create visual interest: places, routes, trip state, photos, bookings, recommendations and memories. Do not fabricate production stats, bookings, users or destinations merely to fill a layout.

## App shell and navigation

The primary member navigation is always:

**Home · World · Trips · Recs · You**

Do not rename Recs to Saved or You to Profile in visual comps.

The active state combines a moving/filled geometry treatment, stronger icon weight and accent. Color is supplemental.

The app remains a centered mobile-first shell with modest larger-screen expansion. Active-trip and map views may intentionally run edge-to-edge within the shell.

## Shape and depth

The system is rounded but not bubbly.

- Inputs: 14px.
- Buttons: 16px.
- Cards: 18px.
- Sheets / major floating panels: 28px.
- Pills and compact icon controls may be fully round.

Depth is created first with surface contrast, then restrained diffuse shadow. Avoid hard drop shadows and gratuitous glassmorphism.

## Components

### Primary actions

Colorful primary actions may use either ink or Béa periwinkle depending on context:

- **Ink primary:** strongest irreversible or high-confidence forward action where black creates better hierarchy.
- **Periwinkle primary:** selected/interactive emphasis, planning actions, route/map interactions and focus states.

Do not default every button to pink.

### Chips and segmented controls

Selected states use geometry + weight + either periwinkle-soft or a relevant supporting pastel. Keep long filter rows horizontally scrollable rather than wrapping into a wall of controls.

### Cards and modules

Colorful modules may use pastel surfaces, but neighboring modules should not become a decorative rainbow. Use pastel only when it clarifies grouping, state or hierarchy.

### Fields

Fields use white/card surfaces on the consistent app ground. Focus is periwinkle unless a semantic state takes precedence.

### Maps and globe

Maps and globe are product content, not generic decoration.

- Preserve geographic richness.
- Keep labels and controls readable.
- Use route/pin/state color deliberately.
- The approved World direction is a globe, not a substitute flat map on the Map tab.
- Do not add decorative clouds to the approved World globe.

### Béa artwork

Use only approved Béa artwork already in the product. Do not invent mascots, cats or replacement characters.

High-personality artwork belongs in identity-supporting moments, not on every trip or utility screen.

## Surface jobs

The detailed page-by-page visual brief lives in `docs/VISUAL_NORTH_STAR.md`. The short rule is:

- **Home:** what matters now?
- **World:** where have I been / where might I go?
- **Trips:** which journey am I working on?
- **Recs:** what places did I save / what should I do with them?
- **You:** who am I to Béa / how does Béa work for me?

Trip detail keeps distinct perspectives rather than collapsing them:

- Overview = readiness.
- Companion = current → leave by → next → later.
- Map = spatial understanding.
- Timeline = itinerary view/edit.
- Bookings = what is actually reserved and attached.

## Voice and emotional fit

Béa refers to herself in the third person. High personality belongs in saves, empty states, Near, plan completion, milestones, memory import and waits. Auth, legal, privacy, security, expenses, errors and destructive confirmations stay utilitarian.

Do not use personality as filler. Every line should explain, encourage or reassure.

## Design workflow rule

Before creating or redesigning any page:

1. Re-open the approved Home and World references.
2. Read the existing route and its function checklist/components.
3. State the page's single user job.
4. Preserve all real functionality unless the owner explicitly approves removal.
5. Use this exact Colorful palette; do not invent a page-specific palette.
6. Match Home/World typography, image treatment, density, controls and shape language.
7. Compare the result side-by-side with Home and World before calling it finished.

If a design tool cannot faithfully produce the approved aesthetic, say so before substituting another approach.

## Do / Don't

### Do
- Preserve real product behavior.
- Use Instrument Serif + Manrope consistently.
- Make travel content the visual hero where appropriate.
- Keep the Colorful base consistent across pages.
- Use ink as the brand anchor and periwinkle as the primary chromatic interaction accent.
- Keep supporting pastels as peers.
- Use Phosphor icons through the shared wrapper.
- Keep mobile active-trip information glanceable.
- Use progressive disclosure for secondary tools.

### Don't
- Do not make pink the defining UI accent.
- Do not use a different brand accent for each top-level tab.
- Do not introduce terracotta / burnt orange UI chrome.
- Do not generate multiple unrelated whites/creams for Colorful pages.
- Do not wrap everything in cards.
- Do not replace the World globe with a flat map on its Map tab.
- Do not force geography into utility screens.
- Do not invent product functionality or remove existing functionality for visual neatness.
- Do not invent mascots or unapproved Béa artwork.
