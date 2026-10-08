# Minimalist design system — Phase 1 (shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every screen the minimalist chrome: one sans type scale, a quiet masthead with icon actions, an icon + label bottom bar, restyled buttons, fields and the Menu sheet, in Calm, Colorful and Dark.

**Architecture:** Replace the shell-related rules of the #305 "Editorial skin" layer in `src/styles.css` (about lines 3587-4037) with token-driven rules; edit the four shell components. The skin's rules for Home widgets, Trips rows and other page layouts are **left alone**: they are Phase 2.

**Tech Stack:** TanStack Start, React, Tailwind v4 theme vars, Phosphor icons via `src/components/icons.tsx`, `node --test`, `scripts/preview/check.mjs` (Playwright).

**Spec:** `docs/superpowers/specs/2026-10-08-minimalist-design-system-design.md` (sections 1, 2, 4, 5 Phase 1). Phase 0 is on `main` (contrast gate, DM Sans, 8px tokens, Calm default).

## Global Constraints

- Type scale in px: display `28px`, title/heading `20px`, body `16px`, small `14px`, caption `12px` (captions only; functional text ≥ 14px). Sizes stay `calc(<n>px * var(--text-scale, 1))`; no `rem`, no sizes inside `calc()` elsewhere.
- Corners 8px (sheets 16px); hairline `1px var(--border)`; functional edges `var(--field-border)` (3:1); no decorative shadows, blur or gradients.
- Interactive targets ≥ 48px (`--h-button: 52px`, `--h-input: 52px`); visible 2px focus ring (`*:focus-visible`, already global).
- One accent rule from Phase 0: Calm black/white, Dark white/black, Colorful keeps its accent.
- No feature removed: Search, Menu, Help-for-this-page, Sign in, offline banner, tab routing and `aria-current` stay.
- Every PR gate: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:public-secrets && npm run check:contrast && npm run db:check:ci`, then `npm run preview:check` (run `npm run build` first; the preview serves `.output`).
- Do not change `package.json` `version`. Final PR gets no label (a patch bump); the big-feature label is for the last phase.

## Review Focus

- Colorful and Dark: the bottom bar's active state, the primary button and the masthead icons keep ≥ 3:1 (non-text) and text ≥ 4.5:1 (the contrast gate plus a rendered check).
- At the app's largest text size (1.45×) and 320px wide, the masthead and the five-tab bar do not clip, wrap their labels badly or overlap.
- Icon-only buttons keep their names: "Search your places" and "Menu" are announced; the signed-out header still shows a visible "Sign in".
- Removing shell skin rules does not unstyle Phase 2 screens (Home widgets, Trips rows, trip views): they look the same as before this PR except for type, buttons and the bar.
- `data-contrast="more"` and `data-bold="on"` still strengthen borders and weight.
- `prefers-reduced-motion` / `data-motion="reduce"`: the bar has no travelling indicator and nothing animates.

## Not in this phase

Choice rows and sliders (they live on the preferences, Béa-personality and widget-size screens: Phase 5), the Home widget and Trips layouts (Phase 2), trip views including the Companion card (Phase 4), and removing the rest of the #305 skin layer (Phase 6). The Figma shows a text-only bottom bar; the spec chose icon + label, so this phase keeps the icons the app already has: confirm before merging.

---

### Task 1: Type scale and labels

**Files:**
- Modify: `src/styles.css` (`@theme` sizes at the top; skin rules `.label-caps`, `.mono-caps`, `h1/h2:not([class*="font-"])`, `.page-title-rule h1`, the uppercase groups near 3768-3777 and 3799-3807, `.home-widget .label-caps`)
- Test: `scripts/check-contrast.test.mjs` (add a "type scale" test reading the stylesheet text)

- [ ] **Step 1: Write failing test** `type scale: the minimalist sizes are set and labels are sentence case`: assert the CSS text contains `--text-display: calc(28px * var(--text-scale, 1))`, `--text-title: calc(20px *`, `--text-body: calc(16px *`, `--text-caption: calc(12px *`; and that no rule whose selector includes `.label-caps` or `.mono-caps` declares `text-transform: uppercase` (parse with the existing top-level rule reader, export it as `topLevelRules`).
- [ ] **Step 2:** Run `node --test scripts/check-contrast.test.mjs` — expect FAIL (64px, 22px, 17px, 13px, uppercase present).
- [ ] **Step 3:** Set the five sizes; make `.label-caps` and `.mono-caps` `font-family: var(--font-sans)`, 12px, `letter-spacing: 0`, `text-transform: none`, `color: var(--muted-foreground)`; set `h1`, `h2`, `h3` and `.font-display` to weight 700, `letter-spacing: 0`; drop the `h1` letter-spacing `-0.01em`/`-0.03em` rules.
- [ ] **Step 4:** Test passes; `npm run build`.
- [ ] **Step 5:** Commit `feat: minimalist type scale and sentence-case labels`.

### Task 2: Masthead

**Files:**
- Modify: `src/components/AppShell.tsx` (header block around lines 270-320), `src/components/PageHeader.tsx` (eyebrow/title classes), `src/styles.css` (header rules)
- Test: `scripts/preview/check.mjs` (new flow)

**Interfaces:**
- Produces: header actions are a link with accessible name "Search your places" and a button with name "Menu", each an icon (`Search` and `Menu` from `@/components/icons`, add `Menu` mapping to Phosphor `List` if missing) with `min-h-12 min-w-12`; signed-out header keeps the visible "Sign in" button.

- [ ] **Step 1: Write failing flow** `shell: header actions are named icon buttons at least 48px`: in the shell sample, `getByRole("link", { name: "Search your places" })` and `getByRole("button", { name: "Menu" })` each have an `svg` child and a bounding box ≥ 48×48.
- [ ] **Step 2:** Run `PREVIEW_FLOWS_ONLY=1 PREVIEW_FLOW_FILTER="header actions" node scripts/preview/check.mjs` (after `npm run build`) — expect FAIL (text links, no svg).
- [ ] **Step 3:** Replace the two text actions with icon buttons (`aria-label`, 24px icon, `size-12` hit area); keep the Help-for-this-page control; page title row: eyebrow becomes the small sentence-case label (Task 1), title uses `text-display` (28px) with `leading-tight`, no 64px.
- [ ] **Step 4:** Flow passes in Calm, Dark and Colorful.
- [ ] **Step 5:** Commit `feat: icon masthead with named 48px actions`.

### Task 3: Bottom bar

**Files:**
- Modify: `src/components/AppShell.tsx` (the `<nav aria-label="Main">` block), `src/styles.css` (delete the skin's `nav[aria-label="Main"]` rules at ~3816-3850; add plain rules)
- Test: `scripts/preview/check.mjs` (new flow)

- [ ] **Step 1: Write failing flow** `shell: the main bar shows an icon and a label per tab, 48px tall, one current`: five `nav[aria-label="Main"] a`, each with a visible `svg` and text, height ≥ 48, exactly one `aria-current="page"`, no element with `blur` backdrop and no travelling indicator span.
- [ ] **Step 2:** Run it — expect FAIL (icons are `display: none`, indicator span exists).
- [ ] **Step 3:** Remove the floating card, the blur and the indicator span; the bar is a flat row on `var(--background)` with a hairline top border; each tab is icon over label (13→14px label), active tab: filled icon, label weight 700, `color: var(--foreground)`; inactive `var(--muted-foreground)`; delete `indicatorOffset` if unused.
- [ ] **Step 4:** Flow passes in three themes; at 320px and `--text-scale: 1.45` labels do not overlap (assert each link's scrollWidth ≤ clientWidth).
- [ ] **Step 5:** Commit `feat: flat icon bottom bar`.

### Task 4: Buttons

**Files:**
- Modify: `src/components/ui/button.tsx` (the `cva` variants), `src/styles.css` (skin rules for `button.bg-primary`, `a.bg-primary`, the `rounded-full[class*="px-"]` squaring rule, the gradient/shadow rule near line 330)
- Test: `scripts/preview/check.mjs` (new flow)

**Interfaces:**
- Produces: `Button` variants `default` (filled `--primary`), `secondary` (transparent, `1px var(--field-border)`), `destructive` (filled `--destructive`), `outline` kept as an alias of secondary, `ghost`, `link`; all `rounded-[var(--r-button)]`, `min-h-[var(--h-button)]`, no shadow, no gradient.

- [ ] **Step 1: Write failing flow** `shell: primary and secondary buttons are 8px, flat and at least 48px`: on a sample page with both, computed `border-radius` 8px, `box-shadow` none, `background-image` none, height ≥ 48.
- [ ] **Step 2:** Run it — expect FAIL (`border-radius` 0 from the skin, shadow and gradient present).
- [ ] **Step 3:** Update the `cva` string and variants; delete the skin's squaring of pill buttons and the primary gradient/glow rules; keep the Colorful `a.bg-primary` accent fill.
- [ ] **Step 4:** Flow and `npm run check:contrast` pass.
- [ ] **Step 5:** Commit `feat: flat 8px buttons with a real secondary and destructive`.

### Task 5: Fields and controls

**Files:**
- Modify: `src/components/AuthField.tsx`, `src/components/ui/switch.tsx`, `src/styles.css` (input rules near 1315 and `.sub-page` input rules near 4258/4479)
- Test: `scripts/preview/check.mjs` (new flow)

- [ ] **Step 1: Write failing flow** `shell: text fields are 52px with a 3:1 edge and an 8px corner`: the auth field's input has height ≥ 52, `border-color` equal to `--field-border`, radius 8px; the switch's hit area ≥ 48.
- [ ] **Step 2:** Run it — expect FAIL on any of the three (label size, radius from the skin, switch 44px).
- [ ] **Step 3:** Field label 14px weight 500 above the input, input 16px (avoids iOS zoom); switch track 48px hit area with a visible focus ring; checkbox/radio keep accent via Phase 0 tokens.
- [ ] **Step 4:** Flow passes in three themes.
- [ ] **Step 5:** Commit `feat: minimalist fields and switch`.

### Task 6: Menu sheet and rows

**Files:**
- Modify: `src/components/Sheet.tsx`, `src/components/ConfirmSheet.tsx`, `src/styles.css` (`.menu-row*` rules ~4167-4320)
- Test: `scripts/preview/check.mjs` (new flow)

- [ ] **Step 1: Write failing flow** `shell: the Menu sheet lists rows with a 16px title, a 14px muted note and a hairline`: open Menu; each `.menu-row` has a title at 16px and a note at 14px in `--muted-foreground`, min height ≥ 56, `border-bottom` 1px; the sheet's top corners are 16px; Escape closes it.
- [ ] **Step 2:** Run it — expect FAIL (22px/16px serif sizes from the skin).
- [ ] **Step 3:** Restyle `.menu-row`, `.menu-row-title`, `.menu-row-note` to the sizes above; ConfirmSheet's destructive action uses the `destructive` button variant.
- [ ] **Step 4:** Flow passes; the existing "every control" run still closes sheets with Escape.
- [ ] **Step 5:** Commit `feat: minimalist Menu sheet and confirm sheet`.

### Task 7: Verify and open the PR

- [ ] **Step 1:** Run the full gate, then `npm run build && npm run preview:check` (all themes, 0 problems expected).
- [ ] **Step 2:** Screenshots of Home, Trips and You in Calm, Colorful and Dark, at default and the largest text size (320px and 390px); check each Review Focus line and report it in the PR.
- [ ] **Step 3:** Open the PR with the screenshots, the rulings made, and the deferred minors. Do not merge; the owner signs off on the screenshots before Phase 2.
