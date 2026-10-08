# Béa minimalist design system — design spec

Status: **draft for review** (no code changed). Date: 2026-10-08.
Source: Figma `ozW1QFqodeqcpK9wQmkg1S`, "Béa — Minimalist complete" (index
`123:268`), the functional re-audit (`131:268`), the conversion review
(`140:580`) and the first-time-user audit (`143:956`), plus the UX audit in
`docs/ux/AUDIT_IMPLEMENTATION.md`.

## 1. Understanding

**Outcome.** Béa looks calm, minimal and consistent: white surfaces, one sans
family, small radii, hairline structure, real icons — in **all three themes**
(Calm, Colorful, Dark). The current look (editorial serif, square panels,
pastels) is not liked.

**Decided by the owner**
- The minimalist system applies to Calm, Colorful **and** Dark. Themes differ
  by palette only, not by type, shape or layout.
- Calm is the white edition: it is the reference the Figma draws.

- D3. The 3D globe is retired. An **atlas** (flat map, shaded countries and
  provinces) becomes a **Home widget** with the travel stats (countries,
  cities, % of world). This reverses #305's decision to keep the globe.
- D4. The **World tab becomes Friends**: a private, **invite-only** circle
  (see section 11). Built after the redesign, from its own spec.
- D5. The **Companion card regression is fixed first**, as its own functional
  PR: the Map/Companion view must show the old Current-stop card with all its
  info, plus the Next stop (section 12).

**Constraints**
- No feature is removed. The Figma is not a functional spec (its own audit:
  144 of 228 entries drawn, 405 of 503 buttons unlinked). Where the Figma and
  the app disagree, the app's behaviour wins and the screen is restyled.
- Keep the repo rules in `AGENTS.md`: px font sizes (build-time text scaling),
  map attributions, no `package.json` version change in a branch, `npm run
  typecheck/lint/test/build`, `db:check:ci`, `check:public-secrets`.
- Reading settings (text size, font, contrast, bold, reduced motion) keep
  working.

**Success criteria**
1. No serif or mono in UI chrome; one sans family (DM Sans) loads reliably.
2. Corners 8px, borders hairline, no decorative shadows.
3. Functional borders (inputs, controls) ≥ 3:1; text ≥ 4.5:1; in every theme.
4. Interactive targets ≥ 48px; visible 2px focus ring on every control.
5. One icon set; no text glyphs (`⌕ ≡ ← ●○`) used as icons.
6. One primary action per screen; destructive actions styled distinctly.
7. Usable at 200% text size and with reduced motion, in every theme.

**Assumptions (please confirm or correct)**
- A1. Calm becomes the default theme (today `DEFAULT_THEME = "colorful"`).
- A2 (corrected after Phase 0). Calm is `#111111` ink on white and Dark is
  pure white on pure black ("clear dark/white", owner decision 2026-10-08),
  whichever accent is chosen. Colorful keeps the accent choice: its "pink" is
  neon mint (`#5df0bf`) and its "periwinkle" is `#6675ff`. The accent picker is
  shown only in Colorful. Pastels survive only as illustration and
  photo-placeholder tints.
- A3. The globe, day map and Home route map keep their own palettes but get
  the new chrome (controls, pills, attribution) and a per-theme tint.

## 2. What the audits changed in this design

The Figma is more minimal than usable. The following are **design additions**
the implementation makes on top of it (each is a finding from the
five-dimension review):

| Gap in the Figma | Decision |
| --- | --- |
| Card/input borders `#EFEFEF` ≈ 1.15:1 (Figma only) | The app already separates `--border` (dividers) from `--field-border` (3:1, WCAG 1.4.11); keep that split and use `--field-border` for every control the Figma draws with a hairline |
| Every action is the same near-black button | `Button` already has default/secondary/destructive/outline/ghost/link variants; the work is *using* them: one primary per screen, destructive confirms use `destructive` |
| No icons (text glyphs only) in the Figma | The app already has Phosphor behind `src/components/icons.tsx` (old Lucide names); keep it, draw the Figma's glyphs with it, always paired with a label in nav |
| Bottom nav is text with a 1px underline | Icon + label, filled active indicator, bold active label |
| No visible focus/pressed states in the Figma | A global 2px `*:focus-visible` ring exists (`--color-ring`); verify it per theme in the contrast script, add a pressed token only if a screen needs one |
| Controls drawn as descriptions (map, timeline, packing, widget resize) | Real controls; see §6 |
| Two masthead variants (text `SEARCH/MENU` vs glyphs) | One masthead: logo, wordmark, Search icon, Menu icon (48px targets) |
| Big empty stat/weather cards on Home | Compact 1×1 variants; no card taller than its content needs |
| Decorative hero photo on Recs, repeated Kyoto image | Photos only where they carry meaning (trip card, stop thumbnails) |

## 3. Fonts (corrected)

An earlier draft said the fonts do not load. **That was wrong.**
`BeaProvider.tsx:26-30` renders the Google Fonts link for Manrope, Bodoni Moda,
Instrument Serif and DM Mono, and the reading-font options load theirs on
demand (`accessibility.ts` `FONT_HREF`). The real findings:

- The Figma's family, **DM Sans, is not loaded anywhere** in the app today.
- All fonts come from Google's servers (third-party request on every first
  load, not in the offline service-worker cache by design, and a privacy-page
  disclosure).
- There is a user-facing **headline font** setting (`bodoni` / `instrument`)
  synced with the account. The minimalist system has one family, so this
  setting is retired: old saved values map to the sans without error.

Phase 0 therefore **self-hosts DM Sans** (same-origin, cached by the service
worker) and points `--font-sans` and `--font-display` at it. The reading-font
choices (Atkinson, Lexend, system) stay.

## 4. Architecture

`styles.css` is 4,591 lines with **stacked per-theme token blocks** from
successive redesigns (`:root/[data-theme="calm"]` at lines ~111, ~1435,
~2069, each with `colorful` and `dark` twins). Adding another layer would make
this worse. The plan:

1. **One semantic token layer** (new, last-wins, then the old ones are
   deleted as screens migrate): surface, ink, ink-muted, line, line-strong,
   accent, accent-ink, focus, destructive, plus radius/size/space tokens.
   Existing Tailwind theme vars (`--color-*`, `--radius-*`) point at it, so
   components already using them follow automatically.
2. **Three palettes** fill that layer (Calm, Colorful, Dark). Theme selection
   (`data-theme`, `dark` class, `theme.ts`) is unchanged.
3. **Shared components own structure**: `Button`, `Input`, `MenuRow`,
   `Choice`, `Switch`, `Slider`, `PageHeader`, `Masthead`, `BottomNav`,
   `Sheet`, `ConfirmSheet`, `Icon`. Screens stop hand-rolling these.
4. **Per-theme selectors in screen CSS go away** (`[data-theme="colorful"]
   .tile-card-1` and similar) — themes no longer change layout.

### Tokens (Calm reference, from the Figma)

| Token | Value |
| --- | --- |
| Ink / surface / page | `#141414` / `#FFFFFF` / `#FFFFFF` (Figma shows `#F5F5F5` behind component sheets only) |
| Ink muted | `#666666` (5.7:1) |
| `--line` / `--line-strong` | `#EFEFEF` / `#767676` (4.5:1) |
| Radius | 8px (cards, buttons, inputs, images); sheets 16px top |
| Heights | button 52, input 52, row 56, chip 36; target ≥ 48 |
| Type scale (px) | 28 / 20 / 16 / 14 / 12 — **12 only for captions**; functional text ≥ 14 |
| Weights | 700 headings, 400 body, 500 labels (no 600 everywhere) |

Colorful and Dark values are derived in Phase 0 and contrast-checked by a
script (`scripts/check-contrast.mjs`, added in Phase 0, run in CI) rather than
by eye.

## 5. Rollout (each step is its own PR, CI-green, reviewable)

| Phase | Scope | Notes |
| --- | --- | --- |
| 0 Foundations | Contrast script in CI; self-hosted DM Sans and font tokens; headline setting retired; 8px shape tokens; Calm/Dark primary tokens (accent only in Colorful); Calm default theme | Plan: `docs/superpowers/plans/2026-10-08-minimalist-phase-0.md` |
| 1 Shell | Masthead, BottomNav, PageHeader, MenuRow, Input, Choice, Switch, Slider, Sheet | Touches every screen lightly |
| 2 Landing pages | Home (incl. widget grid and sizes, **atlas widget and stats**), Trips, Recs, You; World restyled as an interim "Places" page (Bucket list, Been there, Next time) until Friends ships | Figma `116:5349/6136/5913/6554/6780`; the globe and its assets are removed here |
| 3 System states | Loading, offline, empty, error, not found, confirms (destructive variant), unsaved changes, sizes | Figma `116:5069`, `118:2695`, `127:874` |
| 4 Trip views | Overview, Companion, Timeline, Map, Directions | Highest functional risk; keeps all behaviour |
| 5 Planning, sharing, documents, bookings, budget, packing, auth, details | Figma sections `116`, `118`, `120` | Protected-document UI is **not drawn** in the Figma; restyle existing, do not redesign |
| 6 Cleanup | Delete superseded editorial rules and per-theme selectors; update `docs/VISUAL_NORTH_STAR.md`, `.superdesign/design-system.md`, `docs/BRANDING.md` | Version label `version:enhance` on the final PR |

Functional fixes from the re-audit and first-time-user audit
(`docs/ux/AUDIT_IMPLEMENTATION.md`) ride **separate PRs** from visual ones, so
a regression can be bisected to one or the other.

## 6. Controls that must become real (from the re-audit)

Trip preferences multi-select; layout vs picture choice as separate groups;
create-trip Continue/Back/validation/destination; reading-preferences return
to You; auth (Google, consent, password visibility, rule feedback); timeline
move/lock/include/pin-fix; packing quantity/section/filter; widget Apply/Cancel
and keyboard resize; World stats as independent choices; map zoom/recenter and
day controls on the actual map.

## 7. Verification

Per PR: `typecheck`, `lint`, `test`, `build`, `db:check:ci`,
`check:public-secrets`, `audit:ci` when the import is touched. Visual: browser
screenshots of the five landing pages in all three themes at 100% and 200%
text size, with reduced motion on. Contrast script green. Keyboard pass on the
shell. **Not claimed:** screen-reader conformance or authenticated production
behaviour until checked on devices.

## 8. Risks

- Blast radius is the whole app; mitigated by token-first phases and small PRs.
- Removing the serif changes brand voice; `docs/BRANDING.md` is updated in
  Phase 6 and the owner signs off on Phase 2 screenshots first.
- Map/globe/relief assets have baked-in colours; may need tinted variants.
- Text scaling depends on px sizes; any `rem`/`calc()` size silently stops
  scaling — the contrast/size script also flags those.
- Figma copy ("Let's get back to Japan.") is placeholder; app copy and
  `bea-voice.ts` stay.

## 9. Out of scope

Building Friends (own spec, section 11); backend or migrations in the
redesign PRs; Protected-document redesign; conversion-uplift claims (none
measured); participant research.

## 10. Open questions

1. Confirm A1 (Calm default), A2 (accent behaviour per theme), A3 (maps).
2. Sign-off on the Phase 2 screenshots before Phase 3 starts?
3. Where do Bucket list / Been there / Next time live long term? Interim:
   the restyled World "Places" page; final home decided in the Friends spec.

## 11. Friends (replaces the World tab) — direction only

**Decided:** private and **invite-only first**. Not a public network.

Direction for its own spec (not built in the redesign):
- Follow by invite link or username that the other person shares; no open
  user search or discovery in v1.
- A member sees only what someone **explicitly shared**: trips, photos, recs.
  Builds on what exists (share links, Following, follow-along, opt-in photos
  via `trip_share_links` / `trip_follows`).
- v1: chronological, read-only. No likes or public comments. v2: comments and
  reactions. v3: discovery, if ever.
- Required before launch: report and block, removal of a follower, account and
  content deletion, privacy-page and consent copy (Canada Law 25; age gate),
  rate limits, storage cost review, RLS tests. Apple requires report/block for
  user content.
- Product guard: `docs/WHAT_BEA_BELIEVES.md` and the privacy copy ("designed
  to / private by default / may") are updated deliberately, not by accident.
- Nav: five tabs stay (Home, Friends, Trips, Recs, You). This also resolves the
  first-time-user finding that World and Recs looked interchangeable.

## 12. Companion card regression (functional, before the redesign)

The Map/Companion view lost the Current-stop card with its full detail and the
Next-stop card. "Current stop" and "Next stop" still exist in `NowPanel.tsx`
and `DayMapView.tsx`. First step: read git history to list exactly what the
old card showed. Then restore it in the Companion view, keep the Next stop,
and add a regression test. Separate PR; no visual restyle in it.
