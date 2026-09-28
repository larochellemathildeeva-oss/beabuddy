# Claude Code task — integrate the final Béa loading system

You are modifying the existing Béa travel app repository.

A folder called `bea_final_claude_handoff` has been provided. It contains final raster animation assets, quotes, reference screens, a screen-by-screen usage audit, and React/SwiftUI reference implementations.

## First: inspect before editing

Before changing code:
1. identify the actual framework and app architecture
2. locate current theme tokens and typography
3. locate every async/loading state
4. locate existing Béa logo/brand assets
5. summarize the current loading architecture and which files you intend to change

Do not assume React or SwiftUI. Use the reference code only if it matches the actual app.

## Product requirement

Create **one centralized reusable Béa loading system**.

Universal heading, exactly:

`Béa is working on it…`

The loader contains only:
- small Béa action animation
- the heading above
- one short Béa joke below
- four animated loading dots

Do not add:
- a task-specific subtitle
- a progress bar
- a fake percentage
- an extra Béa icon beside the joke

## Animation assets

See:
- `assets/animations/run`
- `assets/animations/dig`
- `assets/animations/ball`
- `assets/animations/bone`
- `assets/animations/think`
- `config/animation-manifest.json`

Each action includes:
- transparent 256×256 PNG frames
- animated WebP
- APNG
- GIF preview
- static Reduce Motion fallback
- original source strip

Prefer:
- WebP for supported web stacks
- PNG frame sequences for native iOS / stacks where animated WebP is not appropriate
- manifest timings for native playback

Do not regenerate or approximate these assets unless there is a concrete technical reason.

## Action mapping

Use the detailed audit in `docs/UI_USAGE_AUDIT.md`.

Core mapping:
- build itinerary → run
- directions / route calculation / reroute → run
- recommendations / hidden gems / nearby discovery → dig
- compare itineraries → think
- optimize → think
- import / parse itinerary or list of places → think
- generated packing / budget assistance → think
- ball / bone → occasional long-load Easter eggs only

## Loading behavior

- delay loader appearance ~300 ms so fast operations do not flash it
- once shown, keep visible at least ~650 ms
- rotate jokes only after ~4.2 seconds
- ball/bone may appear only after a longer load and should be uncommon
- dismiss immediately after the minimum-visible rule when the result is ready
- never block existing back/cancel behavior unless the current workflow already requires blocking

## Accessibility

- role/status or native equivalent
- accessible label: `Béa is working on it`
- respect Reduce Motion and use the supplied static frame
- do not make the joke the only source of task status/error information
- error states must switch to a real error message, not a joke

## Theme rules

Use existing theme tokens.

Critical:
- Calm: cream/beige + restrained burnt-orange
- Colorful: white + mixed pastel accents
- Dark: near-black + cream/white + **dark-beige accent**
- **Do not use terracotta in Dark mode**

## Mascot restraint

Béa is a character, not a pattern.

Do not add Béa decoratively to every page.
Do not add her persistently on Map Live, Map Split, Timeline editing, World map, basic menus, destructive confirmations, or normal page navigation.

## Implementation quality

- centralize quotes/action mappings
- no duplicated loading logic
- no hard-coded theme colors where project tokens exist
- keep skeletons where preserving layout is better UX
- preserve the existing UI revamp; do not redesign unrelated screens
- mobile-first
- verify the character stays visually small rather than dominating the screen

## Deliverables after implementation

Report:
1. all files changed
2. every async operation now using BéaLoader and which action it maps to
3. places intentionally left with existing spinner/skeleton and why
4. accessibility implementation
5. Reduce Motion behavior
6. theme behavior across Calm / Colorful / Dark
7. any remaining technical limitation


## Béa personality preference

Implement a user-selectable Béa personality setting using `config/bea-personality.json`.

**Required UI placement:** add the control inside the user's Profile settings. Prefer:
`Profile → Béa → Personality`
or, if the app already has a nested Settings area:
`Profile → Settings → Béa → Personality`.

Do not hide this preference elsewhere unless the existing information architecture requires it.

Presets:
- Balanced (default)
- Helpful
- Funny
- Sassy
- Minimal

This preference controls only optional Béa voice: loading comments, empty states, and companion personality copy. It must never alter factual travel content, prices, booking details, directions, warnings, error text, or safety-critical information.

Persist the user's choice using the app's existing settings/preferences architecture.

For quote selection:
- use the task action first
- sample from the selected personality's tone weights
- avoid the last 5 recently shown lines
- do not rotate faster than every ~4.2 seconds
- keep ball/bone Easter eggs uncommon

Also implement personality-aware static empty states for:
- no trips
- no saved recommendations
- no search results

See `docs/PERSONALITY_SYSTEM.md`.


## Custom Béa personality builder — REQUIRED

The Profile personality setting is no longer preset-only.

Implement:

`Profile → Béa → Personality`

(or `Profile → Settings → Béa → Personality` if that matches the existing information architecture).

Keep quick presets:
- Balanced
- Helpful
- Funny
- Sassy
- Minimal

Then provide **Customize Béa** with eight independent 0–100 intensity sliders:

1. Helpful
2. Funny
3. Sassy
4. Encouraging
5. Curious
6. Adventurous
7. Dramatic
8. Chill

Balanced starts at:
- Helpful 35
- Funny 35
- Sassy 20
- Encouraging 10
- all additional traits 0

### Important slider behavior

Do NOT force the user's slider values to sum to 100.

Treat each number as an intensity. Normalize all non-zero values internally into effective probabilities at runtime.

Moving any slider manually changes the current mode to **Custom**.

Persist custom values using the app's existing profile/settings persistence layer.

Include:
- Reset to Balanced
- a small `Meet your Béa` preview
- `Try another` to preview another line using the current mix

See:
- `config/bea-personality-v2.json`
- `config/bea-prompt-banks-v2.json`
- `docs/PERSONALITY_BUILDER_UX.md`

### Quirks

Tiny legs, balls, bones, sniffing, digging, maps, snacks, naps, questionable stamina and French-bulldog stubbornness are recurring Béa quirks — not sliders.

Use them occasionally and avoid repetition.

### Tone safety

Sassy and Dramatic Béa may make fun of:
- Béa herself
- the route
- an option
- awkward logistics
- an empty result set

She must never make fun of the user.

Do not apply personality humor to payments, security, destructive actions, safety-critical information, or actionable error messages.


## Béa character continuity + advanced personality — REQUIRED

Implement the character layer described in:

- `config/bea-character-continuity.json`
- `config/bea-moments-and-reactions.json`
- `config/bea-visual-easter-eggs.json`
- `docs/BEA_CHARACTER_ENHANCEMENTS.md`
- `docs/BEA_SAYS_LAYER.md`

### Character continuity
Béa should not feel like random copy. Preserve the user's personality mix and keep a short recent-history buffer so lines and quirks do not repeat too often.

### Contextual quirks
Use context-aware motifs:
- food → snacks
- routes → tiny legs/maps/stamina
- recommendations → sniffing/digging
- parks → sniffing
- beaches → sand/digging
- flights → airport drama
- long waits → naps/ball/bone

### Long-load escalation
For selected long loads, optionally allow a short multi-step joke sequence. Do not use this every time.

Example:
`Béa is focused.` → `Still focused.` → `Correction: ball.` → `Right. Back to work.`

Maximum one rare visual Easter egg per loading session.

### Success reactions
Selected completed tasks may show a very short Béa success line. Never delay the actual result to display the joke.

### Micro-reactions
Béa may occasionally react to notable results such as:
- excellent option
- unusually expensive options
- too many transfers
- hidden gem
- no useful results

The factual result always remains primary.

### “Béa says”
In Companion, support an optional visually distinct `Béa says` aside. It must never contain important factual content such as prices, addresses, times, warnings or booking conditions.

### Situational humor
Allow context-aware lines for rain, heat, red-eye flights, early departures, holiday crowds and jet lag only when the app has reliable context.

### Invisible confidence trait
Béa has a non-user-editable recurring comedic trait: she behaves like a highly qualified travel professional despite obviously being a small French bulldog.

Use confidence jokes sparingly.

### No-joke intelligence
Suppress personality humor for payment/billing, account/security, safety-critical information, destructive confirmations, technical errors requiring remediation, booking failures requiring user action, and privacy/permission failures.

This suppression is mandatory even if the user's personality mix is highly Funny/Sassy/Dramatic.


## Béa dynamic wardrobe & cultural-safety system — REQUIRED

Implement the contextual wardrobe rules in:

- `config/bea-dynamic-wardrobe.json`
- `docs/BEA_DYNAMIC_WARDROBE.md`

### Core rule
Béa may react visually to **weather, activity and travel context**, but must never be dressed as a nationality or cultural stereotype.

Béa's permanent visual identity remains:
- small white French bulldog
- lemon bandana
- same face/body proportions

### Priority
1. actual weather
2. trip/activity context
3. season
4. neutral environmental context
5. default Béa

### Examples
- rain → yellow raincoat / umbrella
- cold/snow → puffer / knit hat
- hot/sunny → sun hat / sunglasses
- beach → towel / sun hat
- hiking → harness / small backpack
- airport → neck pillow / suitcase
- red-eye → neck pillow + sleepy expression
- celebration → simple party hat/confetti

### Cultural-safety restrictions
Do NOT automatically use:
- traditional, ceremonial, religious, indigenous, ethnic or national dress
- religious head coverings
- ethnicity-coded physical changes
- fake accents/dialect mimicry
- flag costumes
- sacred symbols
- tourist stereotypes used as destination shorthand
- food/alcohol/religion/crime as shorthand for nationality or ethnicity

Do not infer culture from destination metadata.

If destination flavor is needed, use neutral environmental context such as route/map, terrain, coast, generic cityscape, transit or a relevant landmark silhouette.

### Architecture
Prefer:
`base Béa animation + optional accessory layer + optional prop`

Do not create a combinatorial set of fully rendered action × outfit assets.

If an accessory cannot align cleanly to a pose, fall back to default Béa.


## Béa lore & questionable credentials — REQUIRED CHARACTER LAYER

Add the recurring fake-academic lore defined in:

- `config/bea-lore-and-credentials.json`
- `docs/BEA_LORE_AND_CREDENTIALS.md`

### Architecture
Do NOT add credentials as another user personality slider.

Treat credentials/lore as its own character layer:

`task context → personality trait → optional quirk → optional lore reference → line`

Personality controls tone.
Lore controls Béa's recurring fictional backstory.

### Canonical institution
Use **The Canine Institute of Travel** as Béa's most recognizable fictional alma mater.

Secondary institutions can occasionally appear:
- Academy of Travel & Treat Sciences
- Canine College of Cartography
- Institute of Advanced Sniffing & Navigation
- Academy of Tiny-Leg Logistics
- International Institute of Very Serious Dogs

Intentional contradictions are allowed and are part of the joke.

### Frequency
Only use credential/lore references in roughly 5–12% of eligible Béa comments.
Avoid repeating the same institution or credential joke in the last 8 Béa comments.

### Optional profile Easter egg
Under `Profile → Béa`, add a small non-settings card called:

`Béa's credentials`

It may rotate one fictional qualification.
Do not make lore configurable.

### Safety / clarity
Never use fake-academic lore in payment, account/security, safety-critical, destructive, serious error, or remediation contexts.
Never present these fictional institutions as real or accredited.
