---
name: Béa
description: Responsive travel workspace with warm editorial typography, compact mobile-first structure, and three user-selectable themes.
colors:
  calm-background: "#f7f2e9"
  calm-foreground: "#28231f"
  calm-card: "#fffdf8"
  calm-elevated: "#efe8dc"
  calm-primary: "#7a6552"
  calm-primary-soft: "rgb(122 101 82 / 0.12)"
  calm-muted: "#f0eae0"
  calm-muted-foreground: "#746b63"
  calm-border: "#ddd3c7"
  colorful-background: "#ffffff"
  colorful-foreground: "#29252a"
  colorful-card: "#ffffff"
  colorful-elevated: "#f6eee8"
  colorful-world: "#2f7bb0"
  colorful-home: "#c24a67"
  colorful-trips: "#2a7f52"
  colorful-recs: "#7a5aa8"
  colorful-you: "#9a6a10"
  colorful-tile-lavender: "color-mix(in oklch, #e6ddf3 62%, white)"
  colorful-tile-sky: "color-mix(in oklch, #dceaf4 62%, white)"
  colorful-tile-mint: "color-mix(in oklch, #dcecdd 62%, white)"
  colorful-tile-butter: "color-mix(in oklch, #f4e7b9 62%, white)"
  colorful-tile-blush: "color-mix(in oklch, #f4dce2 62%, white)"
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
  success: "#58745c"
  warning: "#b47a35"
typography:
  display:
    fontFamily: '"Instrument Serif", ui-serif, Georgia, serif'
    fontSize: "27px"
    fontWeight: 400
  title:
    fontFamily: '"Instrument Serif", ui-serif, Georgia, serif'
    fontSize: "22px"
    fontWeight: 400
  heading:
    fontFamily: '"Instrument Serif", ui-serif, Georgia, serif'
    fontSize: "19px"
    fontWeight: 400
  body:
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: "14.5px"
    fontWeight: 400
  label:
    fontFamily: '"Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "0.08em"
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
components:
  button-primary:
    backgroundColor: "{colors.calm-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    height: "52px"
  card-soft:
    backgroundColor: "{colors.calm-card}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.calm-card}"
    textColor: "{colors.calm-foreground}"
    rounded: "{rounded.input}"
    height: "52px"
---

# Design System: Béa

## Overview

Béa's incumbent visual system is a mobile-first editorial travel interface built around warm neutrals, expressive serif headings, compact Manrope UI text, softly lifted surfaces, and rounded touch-friendly controls. It supports three user-selectable themes—Calm, Colorful, and Dark—without changing the underlying shapes, spacing, information architecture, or interaction model.

No named creative metaphor has been explicitly approved, so this document does not invent one. The current implementation instead provides a clear practical direction: calm and editorial in structure, tactile without being decorative, and visually supportive of trip information rather than competing with it.

**Key Characteristics:**
- Mobile-first single-column app shell that expands modestly on larger screens.
- Instrument Serif for identity and editorial hierarchy; Manrope for functional UI.
- Rounded cards and controls with soft, low-contrast depth.
- Three themes sharing the same component geometry.
- Colorful uses alternating pastel surfaces and tab-specific accent colors; Calm and Dark stay restrained.
- Maps remain visually neutral across themes; route and pin color carry emphasis.
- Phosphor Regular icons are the app-wide icon system.

## Colors

The palette is theme-aware. Semantic component roles stay stable while theme tokens change their actual colors.

### Primary
- **Calm warm taupe** (`#7a6552`): primary controls, focus/ring treatment, selected emphasis, and the base Calm accent. The owner has explicitly rejected terracotta.
- **Dark warm beige** (`#c9a27e`): primary action and focus accent against near-black surfaces.
- **Colorful tab accents:** Home blush `#c24a67`, World sky `#2f7bb0`, Trips mint `#2a7f52`, Recs lavender `#7a5aa8`, You butter/gold `#9a6a10`. On Colorful, the active tab also supplies that section's primary/ring color.

### Secondary
- **Calm elevated sand** (`#efe8dc`): quiet grouped surfaces and secondary UI.
- **Colorful soft neutral** (`#f6eee8`): non-pastel elevated surfaces where a mixed tile treatment is not appropriate.
- **Dark elevated charcoal** (`#2b2723`): secondary surfaces, popovers, and grouped content.

### Tertiary
- **Visited** (`oklch(0.55 0.135 249)`), **Next time** (`oklch(0.56 0.12 158)`), **Wishlist** (`oklch(0.66 0.135 84)`), and **Recommendation** (`oklch(0.545 0.155 305)`) are established semantic place-state colors. Dark mode lightens these roles while preserving their hue families.

### Neutral
- **Calm ground** (`#f7f2e9`), foreground (`#28231f`), card (`#fffdf8`), border (`#ddd3c7`).
- **Colorful ground/card** (`#ffffff`), foreground (`#29252a`), border (`#e7dde2`).
- **Dark ground** (`#171513`), foreground (`#f6f0e8`), card (`#211e1b`), border (`#3a342f`).

### Named Rules
**The No-Terracotta Rule.** Terracotta is not part of the approved current visual system. Calm uses warm taupe; Dark uses beige; Colorful uses section-specific accents.

**The Neutral Map Rule.** Map baselayers remain neutral in every theme. Color belongs to routes, pins, and other map-state signals rather than the map ground.

**The Colorful Mix Rule.** Colorful should read as a mixed pastel system, not one tinted theme. Neighboring tiles can alternate lavender, sky, mint, butter, and blush; one hue should not wash over an entire page.

## Typography

**Display Font:** Instrument Serif (with `ui-serif, Georgia, serif` fallback)  
**Body Font:** Manrope (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** Editorial identity is concentrated in titles and selected headings, while the rest of the interface stays compact and utilitarian. The contrast between Instrument Serif and Manrope gives Béa personality without turning dense travel information into decorative copy.

### Hierarchy
- **Display** (400, 27px): page-level identity and large editorial titles.
- **Title** (400, 22px): major section and surface titles.
- **Heading** (400, 19px): card and subsection headings where a serif voice is useful.
- **Body** (400, 14.5px): standard app copy and information density.
- **Lead** (15px): slightly larger body copy where emphasis is needed without becoming a heading.
- **Small** (13.5px), **Caption** (12.5px), **Micro** (11px): supporting metadata and compact states.
- **Label** (700, 11px, 14px line-height, 0.08em tracking, uppercase): eyebrows, navigation labels, and small structural labels.

### Named Rules
**The Editorial-Only-When-It-Helps Rule.** Instrument Serif carries identity and hierarchy; dense functional text remains Manrope.

## Layout

The app is a centered, phone-first single column. `AppShell` is capped at 520px by default, 680px at the medium breakpoint, and 780px at extra-large widths, with faint side borders. The shell occupies one dynamic viewport height; its main content area scrolls internally while the header and five-tab navigation remain structural siblings.

Core screens typically use 16px content padding inside the shell, while the shared token set defines 20px screen padding and 16px card padding for newer or tokenized surfaces. Touch targets must be at least 44px. Standard structural heights include 52px buttons, 52px inputs, 56px rows, and 34px chips.

The main navigation is always five equal columns: Home, World, Trips, Recs, You. The active state uses one sliding rounded indicator plus stronger icon weight rather than relying on color alone. Trip and other flush views may intentionally run content to the shell edge when they own their own internal header or viewport treatment.

## Elevation & Depth

Béa uses a hybrid of tonal layering and restrained shadows. Cards generally sit lighter than the page ground, so depth is established first by surface contrast and only then by a diffuse shadow. Borders are hairlines used for separation and dark-mode contrast, not as the primary way to draw every container.

### Shadow Vocabulary
- **xs:** `0 1px 2px oklch(0.3 0.02 60 / 0.04)` in Calm; minimal resting separation.
- **sm / md:** Calm currently uses `0 2px 12px rgb(30 26 23 / 0.19)` for compact raised content and standard cards.
- **lg:** `0 6px 24px rgb(30 26 23 / 0.22)` in Calm; sheets and stronger overlays.
- **primary:** `0 6px 18px -8px rgb(122 101 82 / 0.45)` in Calm; tied to primary action emphasis and replaced per theme/accent.
- **Dark shadows:** use stronger black alpha because tonal separation alone is insufficient against the dark ground.

### Named Rules
**The Surface-First Rule.** Prefer surface contrast and tonal layering before adding stronger shadow. Hard drop shadows are outside the incumbent language.

## Shapes

The current master geometry is rounded but not bubbly. Cards use an 18px master radius, primary buttons 16px, inputs 14px, sheets 28px, and chips/icon buttons may be fully round. Tailwind also exposes a related radius ladder around the base radius for legacy and compositional needs.

Images use a 16px radius. Repeated surfaces should inherit shared geometry (`card-soft`, `surface`, `card-raised`) instead of inventing one-off corner treatments.

## Components

### Buttons
- **Primary:** theme primary gradient, primary-foreground text, 16px radius, minimum 52px height, primary-tinted shadow.
- **General UI button variants:** default, destructive, outline, secondary, ghost, and link variants exist in the shared button component.
- **Touch:** visible glyphs may be smaller, but actionable controls should maintain at least a 44px hit target.
- **Focus:** use the theme ring/primary treatment; do not invent unrelated focus colors.

### Chips
- **Selected:** `primary-soft` fill with a 45% primary border and normal foreground text.
- **Colorful:** selected-state accent follows the current section when the primary token is remapped by tab.
- **Height:** established master chip height is 34px.

### Cards / Containers
- **`card-soft`:** card background, 55% border hairline, shared card radius, standard shadow.
- **`surface`:** elevated background, rounded panel, no default border.
- **`card-raised`:** popover background, stronger hairline, 28px sheet radius, large shadow for sheets and overlays.
- **Colorful tile cards:** use the alternating pastel tile set; Calm and Dark keep equivalent surfaces quiet.

### Inputs / Fields
- **Style:** 52px height, 14px radius, card background, border color from the active theme, 16px horizontal padding.
- **Focus:** border shifts to primary and receives a two-pixel ring using the theme ring color.
- **Text:** standard field text is approximately 15px Manrope.

### Navigation
- **Header:** translucent background with backdrop blur, compact logo/wordmark, one optional page-level action, and a subtle tab-colored bottom rule.
- **Bottom tabs:** Home, World, Trips, Recs, You; uppercase labels, Phosphor icons, one sliding pill, stronger active icon weight.
- **Icons:** Phosphor Regular app-wide through `src/components/icons.tsx`; active navigation may map to Phosphor Bold.

### Béa Artwork
Béa artwork belongs in identity-supporting surfaces such as You, Béa settings, loaders, empty states, and login rather than being repeated indiscriminately in trip banners. Existing place and trip artwork should be reused; new generated imagery requires explicit approval because it can incur external image-generation cost.

## Do's and Don'ts

### Do:
- **Do** preserve all three themes using the same component geometry and interaction structure.
- **Do** use Instrument Serif for editorial hierarchy and Manrope for functional information.
- **Do** keep maps neutral and let routes/pins carry state color.
- **Do** use Phosphor icons from the shared icon wrapper rather than mixing icon families.
- **Do** keep active navigation legible without color alone by using weight and the sliding indicator.
- **Do** reuse shared surface utilities and established touch/spacing tokens before introducing one-off values.
- **Do** keep active-trip/mobile information compact and easy to scan while moving.

### Don't:
- **Don't** introduce terracotta into the current approved system.
- **Don't** turn Colorful into a single purple, blue, or other one-hue theme; it is deliberately mixed.
- **Don't** mix illustration and real-photo modes on the same screen.
- **Don't** make maps decorative or theme-heavy.
- **Don't** wrap every piece of information in another card; use `surface`, hairlines, spacing, and hierarchy when a full card is unnecessary.
- **Don't** replace established functions, icons, or product behavior merely to match a visual concept.
