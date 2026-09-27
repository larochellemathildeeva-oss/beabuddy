# Decisions log (owner's calls, in order)

- Three themes: Calm (white/cream/beige, neutral, no pastel category tiles), Colorful
  (light pastels that alternate box to box, no single purple accent), Dark (black with
  white/beige, no terracotta). Picked in You → settings.
- Maps stay neutral in every theme. Keep every existing function and the app's icons.
- Béa: removed from trip banners (the old drawing). Her real artwork from the
  personality package is used on You, Béa settings, loaders, empty states, login.
- Nothing is merged until the whole redesign is done (PR 91 stays open).
- ChatGPT's master handoff replaces earlier approved designs (Home, Trips, trip menu …);
  Claude may say where an earlier design was better.
- Map one-stop view is called "Focus" (not "Live" — it does not track location).
- Map uses real saved journey times from downloaded directions; falls back to
  "about … · not measured yet".
- Stop pictures: a setting — Illustrations (default) / Real photos (Wikimedia
  Commons) / No pictures. Never mixed on one screen. Real photos in lists needs a
  saved-photo column; the owner will run the SQL.
- Trip documents: easy-access booking inbox; a Protected section (replaces the vault)
  unlocked with Face ID / fingerprint / passcode; an optional lock on all of Trip
  documents, on by default, turning it off shows a warning.
- Keep the current serif font (no DejaVu Serif).
- Email forwarding of bookings: separate project (needs an inbound-email service).
- Béa personality: agreed with ChatGPT's review — third person, no emoji, no-joke
  contexts are mandatory (not a setting), no culture-coded "tailor to destination",
  outfits wait for artwork, conversational actions are a separate future product,
  personality never changes facts or recommendations.
- To exactly match ChatGPT's designs: asking ChatGPT for design tokens (JSON) and, if
  it can, a real layered Figma file; plus separate image files for any picture to keep.

## Design tokens (bea-design-tokens.json)

- ChatGPT's token file is the source of truth for colours, radii, shadows and
  sizes in all three themes. Applied in `src/styles.css`.
- **Fonts: not applied.** The file names DejaVu Serif/Sans; the owner chose to
  keep the current serif (Instrument Serif) and body font (Manrope).
- Colorful uses peach, sky, mint, butter and blush for the five tiles.
  Lavender and rose are left out so it never reads as purple.
