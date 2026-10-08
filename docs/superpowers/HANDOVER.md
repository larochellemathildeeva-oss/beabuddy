# Handover: minimalist redesign (read this first)

Updated 2026-10-08, after PR #312 merged (app v6.20.x on `main`).

## The one source of truth for the UI

**Figma file `ozW1QFqodeqcpK9wQmkg1S`, page "Start here / Minimalist complete"**
<https://www.figma.com/design/ozW1QFqodeqcpK9wQmkg1S/Untitled?node-id=123-268>

Every screen of the live Béa app is being restyled to match it, in all three
themes (Calm, Colorful, Dark). The same file also holds **"Original
Editorial" / "bea- editorial edition" pages: do not use them.** They are an
older direction (Didone serif, all-caps mono labels, square edges).

Rules from the Figma start page (`123:268`): white surfaces, DM Sans,
type 28 / 20 / 16 / 14 / 12px (12 for captions and tab words only), fine
neutral borders, 8px corners (sheets 16px on top), 44–52px targets, Béa
dog logo. Sentence case everywhere, no letterspacing.

Spec: `docs/superpowers/specs/2026-10-08-minimalist-design-system-design.md`
(phases 0–6). Places and lists: `docs/superpowers/specs/2026-10-08-places-lists-design.md`.

Figma frames for the landing pages (390px wide):

| Screen | Node | Status |
| --- | --- | --- |
| Home (upcoming) | `116:5349` | **next** |
| Trips (upcoming) | `116:6136` | done, #312 |
| World (map) | `116:5913` | **next** |
| Recs (saved) | `116:6554` | **next** |
| You | `116:6780` | done, #312 |
| Page guide menu | `116:5109` | reference |
| System states | `116:5069`, `118:2695`, `127:874` | phase 3 |
| Sections 116 / 118 / 120 | trip views, planning, sharing, docs, bookings, auth | phases 4–5 |

Figma access: the Figma connector must be connected in claude.ai connector
settings (it drops now and then). Load the `figma:figma-design-to-code`
skill before `get_design_context`.

## Done so far

- #309 Phase 0 (tokens, DM Sans, contrast script), #310 Phase 1 shell +
  audit group 1 fixes.
- #311 Places and lists: one Bucket list, Recs holds businesses/landmarks,
  World holds cities/countries with their recs, Find recs (articles).
- #312 Trips and You restyled; app-wide: sentence-case labels, 8px corners,
  the editorial uppercase/letterspacing rules in `styles.css` neutralised.

## Next steps, in order (one PR each)

1. **Home** (`116:5349`): "Good morning," 28px + subtitle; upcoming-trip
   card (title 28, places 20, dates 12, photo, black "View trip"); joined
   figure cells (Places saved, Travellers) 28px bold + 12px label; Weather
   there; Notes from Béa; "Customize home" secondary button. Widget grid
   1×1 / 2×1 / 2×2 is kept (`127:15714` widget size rules). Shrink the
   leftover editorial sizes: `.module-big` (82px), `.home-widget h2/h3`
   (30px), `HomeTripCard.tsx` 38px, `HomeLivingMap.tsx` 34px,
   `HomeMoods.tsx` 38px, `next/HomeNextModules.tsx` 34px.
2. **World** (`116:5913`): ruled tabs Map / Bucket list / Been there /
   Stats; a flat world map with dots replaces the globe on this screen
   (spec phase 2 says the globe goes here, keep its data and pins);
   joined figures Countries / Cities; "Your travel lists" rows (Bucket
   list, Been there — **no "Next time"**, merged in #311 even though the
   Figma still draws it); "Add places" primary, "Customize world"
   secondary. `WorldScreen.tsx` has 34–40px sizes to bring down.
3. **Recs** (`116:6554`): "Recs / saved", "Places worth keeping." 28px,
   search box, ruled tabs Saved / Nearby / Map, photo, "Recently saved"
   rows (name 16, "City / Kind / distance" 14), "Save a place" primary,
   "Filters" secondary. Keep the list chips from #311 (All / Recs /
   Bucket list / Been there).
4. **Menu** (top right): owner was asked, not yet answered, whether it
   should be Help, Appearance, Feedback, Privacy & legal and Sign out.
   Today it is Help for this page, Profile settings, Help & FAQ, Privacy
   & legal (`AppShell.tsx` ~line 346). Ask before changing.
5. Sign-in / Welcome restyle, then phases 3 (system states), 4 (trip
   views), 5 (planning, sharing, documents, bookings, budget, packing,
   auth, details), 6 (delete superseded editorial CSS, update
   `docs/VISUAL_NORTH_STAR.md`, `.superdesign/design-system.md`,
   `docs/BRANDING.md`; `version:enhance` on that last PR).

Other 40px+ titles still to shrink when their phase comes:
`TripPageBanner.tsx` 44px, `CompanionBanner.tsx` 38px, `auth.tsx`,
`forgot-password.tsx`, `reset-password.tsx`, `__root.tsx` 40px,
`PlaceDetail.tsx` / `profile_.bea.tsx` / `Welcome.tsx` 34px,
`DocumentDetail.tsx` 32px.

## Owner decisions to keep

- Bottom bar: **icons with labels** (the Figma draws words only; owner
  chose icons + labels).
- Keep the version number in the header (`AGENTS.md`), even though the
  Figma masthead shows logo + "Search" / "Menu" words.
- Never remove functionality while restyling; move it, and say where.
- Figma copy ("Let's get back to Japan.") is placeholder; app copy and
  `bea-voice.ts` stay.
- Recs and World become one Places tab only in the Friends phase.
- Never generate images with Gemini or any paid image model.

## Open, small (from #311)

Rec deep links from the World location sheet; article titles with
numbers; Find recs errors through `aiFailure`; sources hidden when no
article; double counting of recs in country + city; owner to confirm
Been-there country counts and grounding-off behaviour; delete the `/next`
route copies (incl. `/world/next`).

## How to work here

- Superpowers flow: plan in `docs/superpowers/plans/`, TDD for logic.
- Preview screenshots: `npm run build` **first** (the preview's `app.css`
  comes from `.output`), then `PREVIEW_RENDER_ONLY=1 node
  scripts/preview/check.mjs`, then `SHOTS_DIR=… SHOTS_H=1100 node
  scripts/preview/shots.mjs <homepage|trips|world|recs|you> <prefix>`.
  Compare with `get_screenshot` of the Figma node.
- Before pushing: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`, `npm run check:public-secrets`, `npm run
  check:contrast`, `node scripts/preview/check.mjs` (update its flows
  when a screen's words change).
- Don't change `package.json` version in a branch. Qodo reviews every PR;
  fix real findings, reply on each thread, resolve.
