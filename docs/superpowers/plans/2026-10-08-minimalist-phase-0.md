# Minimalist design system — Phase 0 (foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the foundations of the minimalist system under all three themes — a contrast gate, self-hosted DM Sans, 8px shape tokens, Calm/Dark primaries, Calm as the default — without redesigning any screen.

**Architecture:** Token-first. Everything is a change to `src/styles.css` tokens, one font package, one small CI script, and three small TypeScript modules. Screens follow through the existing Tailwind theme variables (`--color-*`, `--radius-*`).

**Tech Stack:** TanStack Start, React, Tailwind v4 theme vars in `src/styles.css`, `node --test` (Node ≥ 22.6), `@fontsource-variable/dm-sans`.

**Spec:** `docs/superpowers/specs/2026-10-08-minimalist-design-system-design.md` (sections 1, 3, 4, 5 Phase 0).

## Global Constraints

- Phase 0 only. No screen redesign, no new components, no migrations.
- Do **not** change `package.json` `version` (AGENTS.md). No PR label (patch bump).
- Font sizes stay in px (build-time text scaling); no `rem`/`calc()` sizes added.
- Calm default theme `calm`; saved choices of existing users are never overwritten.
- Calm primary `#111111` on `#ffffff`; Dark primary `#ffffff` on `#000000` (owner: clear dark/white); Colorful keeps `var(--acc)` (neon mint for pink, or periwinkle). As built; the original plan said `#141414` and off-white.
- Shape tokens: `--r-card`, `--r-button`, `--r-input`, `--r-image` = `8px`; `--r-sheet` = `16px`; `--radius` = `0.5rem`.
- Contrast: text pairs ≥ 4.5:1; non-text (`--field-border`, `--ring`) ≥ 3:1; every theme, and Colorful under both accents.
- Reading fonts (`easy`, `lexend`, `system`) keep working and keep overriding DM Sans.
- Every PR gate: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:public-secrets`.

## Review Focus

- An account whose synced settings hold `headline: "bodoni"` or `"instrument"` loads without error and gets the sans (no crash, no stale attribute).
- An installed (offline) Béa renders DM Sans: the font file is in the service worker's asset cache and `VERSION` in `public/sw.js` is bumped.
- `data-font="easy" | "lexend" | "system"` still wins over DM Sans in every theme.
- A user with saved theme `colorful` or `dark` and accent `periwinkle` keeps both after the default changes.
- Calm's black primary next to leftover accent tints (`--primary-soft`, `--tile-3`, map route colours) leaves no unreadable pair.
- DM Sans is wider than Manrope: Home and Trips headings still fit 390px at 100% and 200% text size.

---

### Task 1: Contrast gate

**Files:**
- Create: `scripts/check-contrast.mjs`, `scripts/check-contrast.test.mjs`
- Modify: `package.json` (script `check:contrast`), `.github/workflows/ci.yml` (run it after build)

**Interfaces:**
- Produces: `contrastRatio(fg: string, bg: string): number` (hex in, WCAG ratio out);
  `resolveTokens(css: string, theme: "calm" | "colorful" | "dark", accent: "pink" | "periwinkle"): Record<string, string>` (merges `:root`, `[data-theme=…]`, `.dark`, `[data-accent=…]` blocks in file order, follows `var(--x)` aliases, leaves `oklch`/`color-mix` unresolved);
  `checkContrast(css: string): { theme: string; accent: string; pair: string; ratio: number; min: number }[]` (failures only).

- [ ] **Step 1: Write failing tests** in `check-contrast.test.mjs`: `contrastRatio("#000000","#ffffff") === 21`; `contrastRatio("#777777","#ffffff") < 4.5`; `resolveTokens(css,"calm","pink")["--field-border"] === "#8a847e"`; `resolveTokens(css,"colorful","periwinkle")["--primary"] === "#6675ff"`; a fixture CSS with `--muted-foreground:#bbbbbb` on `--card:#ffffff` makes `checkContrast` return one failure naming `--muted-foreground on --card`; the real `src/styles.css` returns `[]`.
- [ ] **Step 2: Run** `node --test scripts/check-contrast.test.mjs` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the three exports; the pair table is: text `--foreground/--background`, `--foreground/--card`, `--muted-foreground/--card`, `--primary-foreground/--primary`, `--destructive-foreground/--destructive` (min 4.5); non-text `--field-border/--card`, `--ring/--background` (min 3). Skip a pair when either token is unresolved. CLI mode prints failures and exits 1.
- [ ] **Step 4:** If the real stylesheet reports failures, fix the token (not the table) in `src/styles.css`, smallest change that passes. Run the test again — expect PASS.
- [ ] **Step 5:** Add `"check:contrast": "node scripts/check-contrast.mjs"` and a CI step `npm run check:contrast`. Commit `ci: contrast gate for all three themes`.

### Task 2: Self-hosted DM Sans

**Files:**
- Modify: `package.json`/lockfile (`@fontsource-variable/dm-sans`), `src/styles.css:82-88` (font tokens + import), `src/components/BeaProvider.tsx:21-32` (drop the Google link), `public/sw.js:17` (`VERSION` → `"v4"`), privacy copy in `src/routes/privacy.tsx` (Google Fonts mention)

**Interfaces:**
- Produces: `--font-sans`, `--font-display`, `--font-mono` all `"DM Sans Variable", ui-sans-serif, system-ui, sans-serif`.

- [ ] **Step 1:** Install the package; import its variable `wght` CSS at the top of `src/styles.css` so Vite emits a same-origin hashed woff2.
- [ ] **Step 2:** Set the three font tokens as above in the `@theme` block; leave the `:root[data-font=…]` overrides untouched.
- [ ] **Step 3:** Remove the Bodoni/Instrument/Manrope/DM Mono `<link>`s from `BeaProvider.tsx`; keep the reading-font loader in `accessibility.ts`.
- [ ] **Step 4:** Bump the service worker `VERSION`; confirm the worker's asset rule caches `.woff2` from the build (read `public/sw.js`; add the extension only if missing).
- [ ] **Step 5:** Update the privacy page so it no longer says the default fonts come from Google.
- [ ] **Step 6: Verify:** `npm run build`; `ls .output/public/assets | grep -i dm-sans` shows a `.woff2`; `grep -rl "fonts.googleapis.com/css2?family=Manrope" .output/public` returns nothing; `npm run check:public-secrets` passes. Commit `feat: self-host DM Sans`.

### Task 3: Retire the headline-font setting

**Files:**
- Modify: `src/lib/accessibility.ts:33-34,76`, `src/lib/accessibility.test.ts`, `src/components/AccessibilityPicker.tsx` (remove the Headline control), consumers found by `grep -rn headline src`

**Interfaces:**
- Produces: `HEADLINE_FONTS = ["sans"] as const`; the settings parser maps any stored `headline` (including `"bodoni"`, `"instrument"`, garbage) to `"sans"`.

- [ ] **Step 1: Write failing tests** in `accessibility.test.ts`: parsing `{ headline: "bodoni" }` and `{ headline: "instrument" }` and `{ headline: 7 }` each give `headline === "sans"`; an account payload with no `headline` gives `"sans"`.
- [ ] **Step 2:** Run `npm test` — expect those three FAIL.
- [ ] **Step 3:** Change `HEADLINE_FONTS`, the default in the parser, and remove the picker control and any `data-headline` styling that selected a serif.
- [ ] **Step 4:** `npm test` and `npm run typecheck` pass. Commit `feat: retire the headline font choice`.

### Task 4: Shape tokens

**Files:**
- Modify: `src/styles.css` (the `:root, [data-theme="calm"]` block at ~111-126)
- Test: `scripts/check-contrast.test.mjs` (token invariants)

- [ ] **Step 1: Write failing test:** resolved `--r-card`, `--r-button`, `--r-input`, `--r-image` equal `"8px"`, `--r-sheet` equals `"16px"`, `--radius` equals `"0.5rem"` for all three themes.
- [ ] **Step 2:** Run it — expect FAIL (16/16/13/16/28, 1.02rem).
- [ ] **Step 3:** Set the values in the shared root block.
- [ ] **Step 4:** Test passes; `npm run build`; take preview screenshots (below) of Home, Trips, You in all themes and attach to the PR. Commit `feat: 8px shape tokens`.

### Task 5: Calm and Dark primaries; accent only in Colorful

**Files:**
- Modify: `src/styles.css` (`[data-theme="calm"]` ~line 140 and `.dark` ~line 255 colour tokens), `src/components/ThemePicker.tsx` (show the accent row only when the theme is Colorful; hint text says so)
- Test: `scripts/check-contrast.test.mjs`

**Interfaces:**
- Consumes: Task 1's `resolveTokens`, `checkContrast`.

- [ ] **Step 1: Write failing tests:** Calm resolves `--primary === "#141414"`, `--primary-foreground === "#ffffff"`, `--ring === "#141414"`; Dark resolves `--primary === "#f6f3ee"`, `--primary-foreground === "#121212"`, `--ring === "#f6f3ee"`; Colorful `--primary` still resolves to the accent for both `pink` and `periwinkle`; `checkContrast` on the real file returns `[]`.
- [ ] **Step 2:** Run — expect FAIL on Calm and Dark.
- [ ] **Step 3:** Set the tokens (also `--primary-ink` equal to `--primary`, `--accent` to `--elevated` in Calm so ghost hover is neutral). Change `ThemePicker.tsx` to render the accent row only for Colorful; keep the stored accent value untouched.
- [ ] **Step 4:** All tests pass; screenshots for Calm/Dark/Colorful show black, off-white and accent buttons respectively. Commit `feat: Calm and Dark primaries, accent in Colorful only`.

### Task 6: Calm is the default theme

**Files:**
- Modify: `src/lib/theme.ts:23` (`DEFAULT_THEME`), `src/lib/theme.test.ts`; check `src/lib/account-settings*.ts` for a `"colorful"` fallback (`grep -n colorful`)

**Interfaces:**
- Produces: `DEFAULT_THEME === "calm"`; `readTheme()` with no stored value returns `"calm"`.

- [ ] **Step 1: Write failing tests:** `DEFAULT_THEME === "calm"`; `readTheme()` with empty storage and no attribute returns `"calm"`; with stored `"colorful"` returns `"colorful"`; with legacy `bea-dark = "yes"` returns `"dark"`; the boot script string falls back to `"calm"`.
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3:** Change the constant (and any account-settings default found by the grep).
- [ ] **Step 4:** Tests pass. Commit `feat: Calm is the default theme`.

### Task 7: Verify and open the PR

- [ ] **Step 1:** Run the full gate: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:public-secrets && npm run check:contrast && npm run db:check:ci`.
- [ ] **Step 2:** `npm run preview:check`; screenshots of Home, Trips, You in Calm, Colorful, Dark at 100% and 200% text size; confirm no heading overflows at 390px.
- [ ] **Step 3:** Open the PR with the screenshots and the Review Focus list answered. Do not merge; the owner signs off on screenshots before Phase 1.
