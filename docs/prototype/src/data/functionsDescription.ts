/**
 * Complete Functional & UX/UI Specification of the Béa Travel Itinerary Application
 * 
 * Exported identifier: functionsdescription
 * Describes in exhaustive detail every UI/UX pattern, transition, gesture, flow,
 * state lifecycle, and user experience built into the application.
 */

export const functionsdescription = `
================================================================================
BÉA TRAVEL ITINERARY COMPANION — COMPREHENSIVE FUNCTIONS & UX/UI SPECIFICATION
================================================================================

1. BRAND PHILOSOPHY & DESIGN SYSTEM
--------------------------------------------------------------------------------
- Aesthetic Tone: Warm editorial Japanese craft ("Wabi-Sabi Modern"), blending clean swiss typography with organic warmth and gentle tactile feedback.
- Color Palette:
  * Primary Accent: Terracotta Clay (#D96B43) — symbolizes torii gates, warmth, and active travel energy.
  * Deep Accent: Umber / Dark Espresso (#C25832 / #5C473A) — provides rich typographic contrast.
  * Base Surfaces: Milk Cream & Rice Paper (#FFFDF9, #FAF5EE, #FAF8F5) — gentle on eyes during long travel days.
  * Ink & Typography: Warm Charcoal (#2C2623) — soft high-contrast readability without harsh digital black.
  * Success & Confirmation: Japanese Pine / Soft Emerald (#2A9D8F, #21867a, #EAF6F4) — calm verification state.
  * Destructive & Alerts: Autumn Coral (#E76F51, #D45A3C, #FDEEE9) — friendly yet unambiguous deletion signifier.
- Typography & Hierarchy:
  * System Font Stack: Plus Jakarta Sans / Inter with tabular mono numerals for times and durations.
  * Zero-Pill Discipline: Thoughtful unboxed metadata separated by warm mid-dots (·) to reduce visual clutter.
  * Progressive Disclosure: Information revealed in calibrated layers (Summary -> Neighborhood -> Turn-by-Turn -> Rich Inspection).

2. APPLICATION HEADER & GLOBAL TRIP CONTROLS
--------------------------------------------------------------------------------
- Brand & Mascot Avatar:
  * Features the animated Béa mascot avatar with real-time status ring ("Live in Hiroshima").
  * Tapping or viewing Béa displays ambient trip context and local daily observations.
- Active Trip Context Header:
  * Displays destination title: "Hiroshima & Miyajima".
  * Subtitle badge displays trip span: "3 Days (Oct 14 – 16)".
- Action Suite:
  * [Offline Directions]: Opens the Offline Directions Modal. Offers formatted printable/PDF instructions and exportable clean TXT directions complete with step-by-step navigation, transit schedules, and emergency contacts.
  * [Import Itinerary]: Opens the Import Itinerary Modal. Provides zero-loss parsing of custom itineraries formatted in JSON or plain text.
  * [Compare Plans]: Opens the Plan Comparison Suite. Allows travelers to contrast Plan A (Balanced Heritage), Plan B (Culinary & Slower Pacing), and Plan C (Fast Photography Highlights) side-by-side with pacing ratings and 1-click switching.
  * [Saved Places Drawer]: Slides open the Saved Gems collection. Displays bookmarked places with filter tags (Food, Culture, Sights), estimated stay times, and 1-click "Add to Today's Itinerary" buttons.
  * [Customize UI]: Opens the User UI Preferences Modal. Provides real-time toggles for:
    - Photo card visibility
    - Transit connector details
    - In-situ budding nodes
    - Mascot expressiveness (expressive / calm / minimal)
    - Layout density (comfortable vs. compact)
  * [+ Add Stop]: Opens the comprehensive Stop Creation Modal with category selectors, duration sliders, address inputs, and coordinate lookup.
  * [UX & Feature Docs]: Direct access to inspect this full functional description in-app.

3. DAY SELECTOR & INTELLIGENT ROUTE OPTIMIZATION ENGINE
--------------------------------------------------------------------------------
- Day Selection Strip:
  * Segmented interactive pills representing Day 1, Day 2, and Day 3.
  * Instant tab transitions with zero reload latency, synchronizing itinerary items, map markers, and transit legs.
  * Displays active stop count (e.g., "5 stops") and day theme ("Peace Park & Sacred Miyajima Island").
- "🪄 Optimize Route" Algorithmic Resequencing:
  * Algorithm: Runs a 2-opt Euclidean Travelling Salesperson Problem (TSP) heuristic on the day's geographical coordinates.
  * Intelligence: Pins initial anchor locations (like morning hotel or arrival stations) and reorders subsequent stops to minimize spatial backtracking across the city.
  * User Feedback:
    - Calculates distance reduction and estimated walking minutes saved (e.g., "18 mins walking saved!").
    - Triggers celebratory animated confirmation modal with before-and-after sequence inspection.
    - Mounts a persistent floating Undo toast allowing 1-click reversion of the entire sequence to its previous order.

4. THREE COMPREHENSIVE VIEWING PERSPECTIVES
--------------------------------------------------------------------------------
- Perspective 1: Companion View (Active Travel Storyline):
  * Designed for walking travelers holding their mobile device in one hand.
  * "Now & Next" Hero Card:
    - Highlights current or upcoming activity with real-time arrival countdown.
    - Displays leave-by buffers and travel alerts (e.g., ferry departures, ticket cutoff times).
  * Turn-by-Turn Transit Cards:
    - Embedded directly between sequential itinerary stops.
    - Shows transit mode icons (walk, tram, ferry, train), distance in kilometers, estimated transit minutes, and scenic walkway tips.
  * Grouping by Neighborhoods:
    - Organizes stops by urban cluster (e.g., Peace Park District, Hondori Arcade, Miyajima Waterfront).
- Perspective 2: Map Split View (Spatial Synchronization):
  * Dual-pane responsive layout: interactive vector map on left/top and itinerary sequence on right/bottom.
  * Leaflet/Vector Canvas Integration:
    - Custom styled pins with numbered sequence badges matching itinerary order.
    - Animated polyline routes illustrating walking and transit pathways between stops.
    - Bi-directional synchronization: clicking a stop in the list pans and zooms the map smoothly to the pin; clicking a map pin highlights and scrolls the list item into view.
- Perspective 3: Quick Editor (Pacing & Scheduling Control):
  * High-density management view for travelers who want rapid reordering and schedule tuning.
  * Reorder Chevrons: Instant 1-tap elevation or deferral of stops with automatic recalculation of start times.
  * Inline Time Editing: Clickable arrival time badges that convert into native time pickers for rapid schedule adjustments.
  * Cross-Day Migration: Dedicated dropdown on each stop to move activities between Day 1, Day 2, or Day 3 without retyping.

5. HORIZONTAL SWIPE GESTURE ENGINE (TOUCH, TRACKPAD & MOUSE)
--------------------------------------------------------------------------------
- Pointer Capture & Event Mechanics:
  * Uses Pointer Events API with 'setPointerCapture(pointerId)' to guarantee drag tracking even if the cursor or finger moves beyond card boundaries or over nested text.
  * Direction Lock Disambiguation: Evaluates the initial 6px vector delta (Math.abs(dx) vs Math.abs(dy)). If vertical, native smooth scroll (touch-action: pan-y) is preserved with zero stutter; if horizontal, horizontal drag takes exclusive control.
  * Click Collision Prevention: Swallows synthetic click events generated upon pointer release to prevent accidental card accordion toggle when a swipe gesture finishes.
  * Button Isolation: Guards interactive child buttons via .closest('button, select, input, a') to allow instantaneous tapping of child controls without dragging.
- Gesture Action 1: Swipe Right (> 65px) — "Complete / Incomplete":
  * Visual Feedback: Reveals a vivid Japanese Pine Green (#2A9D8F) underlay with an animated checkmark icon that scales up dynamically with drag distance.
  * Threshold Activation: At > 65px, banner shifts to deep emerald and displays "Release to Complete! 🎉".
  * Reversible State: Swiping right on a completed item flips it back to active/incomplete.
  * Visual Transformation: Marks item title with elegant strikethrough, shifts border to soft mint, and adds an emerald "Completed" pill badge.
  * Toast Notification: Emits a floating toast with 1-click "Undo" button (persists for 4.5s).
- Gesture Action 2: Swipe Left (< -40px) — "Reveal Archive & Delete Tray":
  * Visual Feedback: Reveals a dual-action tray behind the card:
    * Archive Button (Terracotta #D96B43): Moves the stop into the traveler's Saved Places Drawer with all notes and coordinates preserved.
    * Delete Button (Coral #E76F51): Deletes the stop from the day's itinerary and recalculates arrival times of subsequent stops.
  * Mechanical Snap: Automatically docks at -140px to expose both buttons cleanly.
  * Dismissal: Tapping anywhere outside the card or tapping the card body smoothly snaps the card closed to 0px.
- Gesture Action 3: Deep Swipe Left (< -170px) — "Quick Delete":
  * Dragging past -170px triggers a fast-path direct deletion with spring exit animation and Undo toast.
- Desktop Accessibility Parity:
  * Hovering any card on desktop reveals quick-action icon buttons (Complete, Archive, Delete) in the top-right, giving desktop mouse users identical 1-click efficiency without requiring drag gestures.

6. IN-SITU BUDDING NODES ("+ ADD STOP BETWEEN")
--------------------------------------------------------------------------------
- Purpose: Eliminates the jarring disorientation of full-screen modals when travelers simply want to add a café or photo stop between two known locations.
- Visual Trigger: Floating circular "+" nodes nested along the vertical connector line between consecutive stops.
- Inline Form Experience:
  * Expands directly within the timeline space.
  * Smart Time Interpolation: Computes the midpoint between the departure time of Stop N and the arrival time of Stop N+1.
  * Quick Category Chips: Instant presets for Café/Snack, Photo Landmark, Rest Stop, or Shopping.
  * Seamless Insertion: Submitting instantly buds the new card into the sequence, renumbers subsequent items, and adjusts transit legs without page jumps.

7. PROGRESSIVE DISCLOSURE & RICH CARD INSPECTION
--------------------------------------------------------------------------------
- Summary State (Collapsed):
  * Displays sequence index (#1, #2, etc.), arrival time, title, and descriptive subtitle.
  * Unboxed metadata line: Neighborhood · Estimated Stay (~45m) · Cost (¥200) · Booked Status.
- Expanded State (Tapped):
  * High-Resolution Photography: Contextual photography with location overlay.
  * Traveler Notes: Historical context, navigation hints, and quiet hours.
  * Béa’s Secret Tips: Curated local advice (e.g., "Ring the Peace Bell gently with both hands; early mornings offer complete, reverent calm.").
  * Ticket & Booking Badges: Confirmed entry voucher codes, reservation references, and booking provider tags.
  * "Locate on Map": Action button that immediately switches to Map Split View and focuses the map viewport on that exact stop.

8. INSTANT FEEDBACK & SAFETY SYSTEM
--------------------------------------------------------------------------------
- Non-Modal Action Toasts:
  * Floating top-centered alert bar with high contrast dark charcoal container and crisp icons.
  * Instant Action Representation: Distinct icons and color themes for Complete (Emerald), Archive (Terracotta), and Delete (Coral).
  * 1-Click Undo: Every destructive or mutating action (complete, archive, delete, route optimization) includes an explicit Undo handler that restores prior state in memory without network latency.
  * Auto-Dismissal: Automatically fades out after 4.5–5 seconds, or can be dismissed immediately via the close icon.
================================================================================
`;

export const FUNCTIONS_DOCUMENTATION = {
  version: '2.4.0',
  title: 'Béa Itinerary Companion UX & Functional Architecture',
  summary: 'Exhaustive specification of all UI/UX flows, micro-interactions, gesture mechanics, transit sync, and design principles.',
  sections: [
    {
      id: 'brand-system',
      title: '1. Brand Philosophy & Design System',
      description: 'Wabi-sabi modern aesthetic, warm terracotta (#D96B43) & charcoal (#2C2623) palette, unboxed typography, zero-pill discipline.'
    },
    {
      id: 'header-controls',
      title: '2. App Header & Global Trip Controls',
      description: 'Animated Béa mascot status, live trip context badge, offline PDF/TXT directions exporter, trip comparison modal, saved gems drawer, and UI personalization.'
    },
    {
      id: 'day-optimization',
      title: '3. Day Selector & Route Optimization Engine',
      description: 'Segmented day pills with zero reload latency, 2-opt TSP distance reduction algorithm, walking time saved calculator, and 1-click Undo.'
    },
    {
      id: 'perspectives',
      title: '4. Three Unified Viewing Perspectives',
      description: 'Companion View (Now & Next hero card, transit legs), Map Split View (synchronized pins and polyline routes), Quick Editor (timeline resequencing).'
    },
    {
      id: 'swipe-gestures',
      title: '5. Horizontal Swipe Gesture Engine',
      description: 'Pointer capture mechanics, direction lock disambiguation, right swipe to complete/re-open, left swipe for archive/delete tray, deep swipe delete, and desktop hover buttons.'
    },
    {
      id: 'in-situ-budding',
      title: '6. In-Situ Budding Nodes',
      description: 'Zero-modal inline insertion nodes situated between stops with auto-interpolated arrival times and category presets.'
    },
    {
      id: 'progressive-disclosure',
      title: '7. Progressive Disclosure & Rich Card Inspection',
      description: 'Unboxed metadata summary transitioning into photography, traveler notes, Béa secret tips, ticket booking codes, and map locator.'
    },
    {
      id: 'feedback-safety',
      title: '8. Instant Feedback & Safety System',
      description: 'Floating dark charcoal action toasts with colored status badges, 1-click Undo handlers, and graceful auto-dismissal.'
    }
  ],
  rawText: functionsdescription
};
