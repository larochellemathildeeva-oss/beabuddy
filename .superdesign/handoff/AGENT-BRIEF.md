# Brief for helper agents (Béa master redesign)

You are rebuilding one group of Béa's screens to the master design ChatGPT
drew, inside the existing TanStack Start app. Read this whole file first, then
`AGENTS.md` at the repo root.

## Non-negotiables

- **Keep every existing function.** Each screen's current features must still
  work and be reachable. Checklists of functions live in
  `.superdesign/checklists/`. Restyle and reorganise; never drop a feature.
  A tile or button whose feature is not built stays hidden.
- **Only touch the files your task owns** (listed in your prompt). Do NOT edit
  `src/styles.css`, `src/components/AppShell.tsx`, `src/components/PageHeader.tsx`
  or another group's files. If you truly need a new shared style, write it
  as Tailwind classes in your component instead.
- **Icons:** import from `@/components/icons` (Phosphor under Lucide names).
  If you need an icon that is not exported there, append it at the END of the
  import block and at the END of the export list in `src/components/icons.tsx`
  (one line each), nothing else in that file.
- **No terracotta** anywhere. Use the theme tokens only: `bg-primary`,
  `text-primary`, `bg-primary-soft`, `bg-card`, `bg-elevated`,
  `text-muted-foreground`, `border-border`. Never hard-code a brand colour.
- **Pastel cards:** use `tile-card-1..5` for cards and `tile-fill-1..5` for
  panels inside a card. In Colorful they alternate pastels; in Calm and Dark
  they are plain cards. Give neighbouring cards different numbers.
- **Fonts:** headings `font-display` (Instrument Serif, a thin serif — never
  `font-bold` on it); section titles ~27px `leading-none`; body Manrope.
- **Corners/sizes:** cards `rounded-[var(--r-card)]` (tile-card already has it),
  main buttons use the `btn-primary` utility (52px tall), chips `rounded-full`.
- **Pictures:** illustrations only for now. Place pictures:
  `placeArtUrl(placeArtFor({ category, kind, name }))` from `@/lib/place-art`
  (18 painted kinds in `public/places/`). Trip pictures:
  `bannerArtUrl(bannerSceneFor([...]))` from `@/lib/banner-art`. Add class
  `art-dim` to every painted `<img>` (Dark dims it). **Never generate new
  images** (no Gemini calls — it costs the owner money).
- **Béa's voice:** third person only ("Béa found…", never "I"), no emoji, never
  "AI travel planner", no jokes for payments, security, deleting, errors,
  privacy. Nothing "tailored to destination". Personality lines come from
  `src/lib/bea-personality.ts` (`emptyLine`, `successLine`, `loadingLine`) and
  `useBeaSettings()`; the waiting animation is `<BeaLoader>`; empty states can
  show `/bea/bea-think-static.png` with an `emptyLine`.
- **Privacy/geo rules in AGENTS.md** (keys only in `*.server.ts`, OSM and
  Geoapify attribution visible on maps) still apply.

## Design references

- Wireframe HTML for every screen (layout and content only; ignore its colours,
  fonts and text-symbol icons): `.superdesign/handoff/wireframes/NN-*.html`.
- Picture references (flattened mockups, low-res):
  `.superdesign/handoff/NN-*.webp` and sharper PNG/JPEGs in
  `/tmp/claude-0/-home-user-beabuddy/84be02bb-f89b-5f97-abc2-14397813c30a/scratchpad/handoff2/Bea_Code_Handoff_COMPLETE/assets/references/`.
- Already rebuilt to the master (copy their look): Home (`src/routes/index.tsx`,
  `src/components/HomeTripCard.tsx`), Trips (`src/routes/trips.tsx`,
  `src/components/TripCard.tsx`), Trip Overview (`src/components/TripOverview.tsx`).

## Checks before you finish

```
npm run typecheck
npm test
npm run lint        # 16 existing warnings is normal; 0 errors
npm run build       # with VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=placeholder
```

Screenshots: after the build, start the server on YOUR port
(`PORT=<your port> node .output/server/index.mjs &`), copy
`<scratchpad>/signedin3.cjs` to your own name, change `localhost:3456` to your
port, and run it from the scratchpad directory with
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node <script> <path> calm colorful dark`.
It mocks a signed-in user with trips, to-dos, a saved place and itinerary
stops. Combine the three with `node side3.cjs <out.png> a.png b.png c.png`
(edit it to read your file names). Stop your server afterwards with
`ps -eo pid,args | awk '/node .output\/server\/index.mjs$/ {print $1}'` — kill
only the PID you started.

Commit on your worktree's branch with a clear message. Do not push, do not
bump the version, do not open a PR. In your final report give: the branch
name, the files changed, what each screen now looks like, any function you
could not keep and why, and the path of your screenshot PNG.
