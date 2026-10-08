# Places and lists — design

Status: agreed with the owner in chat on 2026-10-08; this file is for their review.
Part of the minimalist redesign (`2026-10-08-minimalist-design-system-design.md`): Phase 2 builds sections 1–4; section 5 is the end state for the Friends phase.

## Intent

A traveller keeps two kinds of saved things: **where** they want to go or have been (cities, countries) and **what** to do there (businesses, landmarks, attractions). Today they are mixed in both tabs, under three names for one list ("Wishlist" in Recs, "Bucket list" in World) and a fourth list ("Next time") nobody can find from World. Success: one vocabulary, each thing in one place, and a city always shows the recs saved for it.

## Owner decisions

- "Bucket list" and "Next time" become one list: **Bucket list**. "Wishlist" was the same list under another name.
- **Recs** holds only businesses, landmarks and attractions (restaurants, cafés, shops, activities, landmarks, museums, parks, beaches, viewpoints). Never cities or countries.
- **World** holds only locations (cities, countries).
- A location on World shows how many recs are saved for it, and opens them. Every location, Bucket list and Been there alike.
- Béa finds articles for a location herself ("Find recs for LA"); pasting a link stays as a fallback.
- Recs and World **should** become one tab, **Places**; that happens in the Friends phase, when World's slot becomes Friends (section 5).

Assumption to confirm: neighbourhoods (Montmartre, Shibuya) count as attractions, so they go to Recs.

## 1. Data and names

- No migration. Saved items stay in `recommendations`. The split is by kind, decided when shown:
  - **Location**: a whole city or country, `isAreaPlace` (`reco-place.ts`, existing, tested). Shown on World only.
  - **Rec**: everything else. Shown in Recs only.
- Lists shown to people: **Recommendation**, **Bucket list**, **Been there**. `pin_type` keeps its stored values; `wishlist` and `nexttime` both show as Bucket list; `visited` (and `visited: true`) as Been there; `reco` as Recommendation.
- New saves never write `nexttime`; they write `wishlist`. Existing `nexttime` rows stay as they are, so nothing is lost and the change can be undone. A later cleanup migration is possible, not needed.
- "Wishlist", "Visited" and "Next time" leave every screen. The colour token `--nexttime` (used for "done" and "open now" greens) is not a list and stays.

New pure helpers in `src/lib/place-lists.ts`, tested:
- `listOf(row): "recommendation" | "bucket" | "been"`.
- `isLocation(row)`: `isAreaPlace` under a name that says what it is for.
- `recsForLocation(location, rows)`: the recs whose city matches the location's city and whose country matches by `countryKey` (any language); a country location matches recs in that country with no narrower location saved.

## 2. World

Tabs: **Map / Bucket list / Been there / Stats**. The "Next time" tile on Stats goes; Stats keeps the figures.

- Bucket list and Been there list locations only.
- A location row: name, country, and "· 5 recs" when `recsForLocation` finds any; nothing when it finds none.
- Tapping a location opens the **location sheet**:
  - its recs (name, kind, Bucket list / Been there), each opening its card in Recs;
  - **Find recs for {city}** (section 4);
  - **Paste an article link**, the existing reader (`RecoListImport`) with the city filled in;
  - today's row actions: move to Been there, remove (both through `ConfirmSheet` where they cannot be undone).
- The Map tab's place card for a city shows the same count and opens the same sheet.

## 3. Recs and the save sheet

- Chips: **All / Recs / Bucket list / Been there**. Bucket list counts `wishlist` and `nexttime` rows.
- Cities and countries do not show in Recs. Saving one from Recs (typed "Lisbon", or a pasted link to a city) saves it to World and says "Added to your Bucket list on World", with a link there.
- A rec card names its list in the same words and its city ("Los Angeles · Bucket list").
- The card button reads **Add to trip**, as the sheet does (audit finding).
- Save sheet (`SaveSheet.tsx`) and add-city sheet (`AddVisitedCity.tsx`): list choices **Recommendation / Bucket list / Been there**. Editing an old "Next time" item shows Bucket list; saving without changing the list writes nothing new.

## 4. Find recs for a location

The traveller taps **Find recs for Los Angeles**:
1. Béa runs one Grounding with Google Search call for recent "things to do / where to eat in {city}" articles and shows 2–3 (title, site, date) with Google's Search Suggestions and sources, unaltered, as its terms ask (the `SearchGroundingNote` pattern from `web-check.server.ts`).
2. The traveller picks one. Béa reads it with the existing reader (`parseRecoList` with `pageUrl`), lists the places, and the traveller chooses which to save. Each saved rec keeps the article link as its `source` (the reader already does this).
3. Only place names and the link are kept, never the article's text.

Costs and limits:
- New `AI_COST.articleSearch: 2`, reserved through `reserveAi` before the search; reading the article costs the existing `recoList: 3`.
- Answers cached in process for 7 days per city and country (key: folded city + `countryKey`).
- Only the city and country are searched, never the traveller's notes.
- `GEMINI_SEARCH_GROUNDING=off` hides Find recs and leaves Paste a link.
- No signal, quota reached, or a site that blocks reading: said plainly in the sheet; Paste a link and the saved recs keep working.
- New server code lives in `article-search.server.ts`, imported lazily from its `.functions.ts`.

## 5. End state: one Places tab (Friends phase, not Phase 2)

- Recs and World merge into **Places**, with a top switch: **Locations** (map, Bucket list, Been there, stats) and **Recs** (search, quick add, chips).
- A visible **Add** stays at the top of Places in both halves: saving a link or a tip is the most frequent action and must stay one tap from the bar.
- The bottom bar becomes Home / Places / Trips / Friends / You; World's slot becomes Friends (own spec, private and invite-only).
- Phase 2 already uses the same data model and helpers, so the merge moves screens, not data.

## Testing

- Unit tests: `listOf`, `isLocation`, `recsForLocation` (cities across languages, a country location, no false matches between namesake cities in different countries), the article-search cache key, `AI_COST.articleSearch`.
- Preview flows, three themes: World — a city shows "· N recs" and opens them; Recs — no city rows, chips read Bucket list and Been there; save sheet — no "Next time"; Find recs — quota refusal and no-signal messages render; Paste a link opens the reader with the city.
- `npm run typecheck`, lint, tests, build, `check:public-secrets` (the new server file), `check:contrast`, `db:check:ci`, `preview:check`.

## Out of scope

The Places tab merge and the bottom-bar change (Friends phase); a migration rewriting `nexttime`; sharing recs with friends; booking or availability (Béa never books).
