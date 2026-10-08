# Screen audit — captured flows (Calm, 390 × 844)

Method: the `audit` skill (karanmrn/karanagentskills), run on the repo's preview app (`scripts/preview`, sample data, fake router) at commit 45298721, Calm theme, iPhone-size viewport. Each screen was captured, inspected, and checked in the DOM for small targets, unnamed controls and text under 13px. Screenshots are not committed (kept with the session); re-capture with `node scripts/preview/shots.mjs <sample> <prefix>`.

**Verdict:** the Phase 1 shell (header, bottom bar, Menu rows) reads cleanly. Every page body still mixes in the old style: uppercase 11px labels and buttons on 7 of 11 screens. The trip page and World have layout bugs you can see. Recs, World and You show the naming and count mismatches the flow audit predicted.

| Step | Screen | Health | Key evidence |
|---|---|---|---|
| 1 | Landing (signed out) | Good | Clear promise and three paths. "v6.19.3" sits under the logo at 10px; "Join with a code" leads to a form with no code field |
| 2 | Sign in | Needs work | Phase 1 missed this page: "TRIPS · PLACES · MEMORIES", "OR SIGN IN WITH EMAIL", "SIGN IN" (11px), "NEW HERE?" in spaced capitals; Google button keeps a shadow; fields use placeholders as labels; "Sign me in automatically / Ask me every time" is unexplained; Terms and Privacy links are 17px tall |
| 3 | Welcome (first run) | Good | Clear dialog, close button, step dots. Only "LET'S GO" is 11px capitals |
| 4 | Home | Fair | Three stacked headings compete ("Good afternoon.", "Let's get back to Los Angeles.", 48px trip title). Trip card text touches the card edge (no inner padding). Stat row is clear |
| 5 | Menu | Needs work | Four rows only; no Sign out, Appearance or Feedback. "Profile settings" repeats the You tab. The only exit is a small "Back" link; no close button |
| 6 | Trips | Needs work | Old style: "UPCOMING / PAST / ALL", "CREATE TRIP →", "PLAN WITH BÉA", "JOIN WITH A CODE" in 11px capitals. Three buttons of near-equal weight; "Calendar" is a 12px text link |
| 7 | Trip page | Poor | **Header actions are clipped:** five round buttons run under Search, and "⋯" (Trip menu) is cut off at 390px. Two tab rows (Overview/Map/Timeline, then Map/Companion): "Map" is selected while Companion shows. "All days" wraps to two lines. Stop dots are 32×32 (under 44). Tab labels 11px capitals |
| 8 | Trip menu | Fair | Rows are readable and grouped. Opened as "Trip menu" (breadcrumb) but titled "Trip settings." Double rule under the title. 11 rows in "The trip" before the end |
| 9 | Recs | Needs work | The list is called "WISHLIST" here and "BUCKET LIST" on World. The chip row is cut off at the right (5th chip half visible, no scroll cue). The search box has **no accessible name** (DOM). "Add to a day" button vs "Add to trip" sheet. Filter icon has no visible label |
| 10 | World | Needs work | The "Portugal" pin label sits under a dot and can't be read. Zoom controls overlap the globe's left edge. Two rows of 11px capital tabs. A second search button duplicates the header's. Stats show "4 Countries" and "14 Been there" next to "5 Cities" with no explanation |
| 11 | You | Needs work | Says **0 Countries** while World says **4 Countries** for the same traveller. Old style: "EDIT PROFILE", "HOME CITY", "TRIPS / PLACES / COUNTRIES" in 11px capitals. "Add your interests" is 41px tall |

## Highest-impact changes

1. **Trip page header (step 7):** the trip menu button is cut off on a 390px phone. Collapse the five round buttons into two (Add, Trip menu), or move Search and Menu off this header. *(Bug; fix before Phase 4.)*
2. **One count for countries (steps 10, 11):** World says 4, You says 0. Confirmed in code: You counts countries of trips that have started (`profile.tsx:196`), World counts countries of places marked visited (`world.tsx:210`). Use one function for both. *(Bug.)*
3. **Finish the type change on page bodies (steps 2, 3, 6, 7, 10, 11):** capital-letter 11px labels and buttons remain on sign-in, Welcome, Trips, trip tabs, World tabs and You. This is the Phase 2 and 4 restyle; sign-in and Welcome should join Phase 2.
4. **One list name (steps 9, 10):** Bucket list / Been there / Next time everywhere.
5. **Menu as a hub (step 5):** add Sign out, Appearance, Feedback and a close button; drop "Profile settings".
6. **Recs search label and chip overflow (step 9):** give the search box a name; let the chips scroll with a visible edge or wrap.
7. **World pins and zoom controls (step 10):** keep labels clear of dots; place zoom controls inside the frame.

## Accessibility notes (from screenshots and DOM only)

- Seen: unnamed Recs search box; 32px stop dots and 17–23px text links on sign-in; many labels at 10–12px (version, eyebrows, tab labels); placeholder-only fields on sign-in.
- Not checked: screen-reader output, keyboard order and focus, real contrast of text over photos, zoom to 200%, motion. Use `npm run preview:check` flows and a manual VoiceOver pass for these.

## Evidence limits

- Preview app with sample data and a fake router: the bottom bar shows **You** selected on every screen because the fake router defaults to `/profile`. This is not an app bug.
- Calm theme and 390px only; content below the first screen of each page was not captured (pages scroll inside a container).
- Sign-in, Welcome and Landing were captured signed out; the rest signed in with sample data.
