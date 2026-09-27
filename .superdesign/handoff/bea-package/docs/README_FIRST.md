# Béa — Final Loading Animation Handoff

This package is ready to give to Claude Code together with the Béa app repository.

## Start here

Give Claude:

`CLAUDE_IMPLEMENTATION_PROMPT.md`

Claude should inspect the real repository before applying the reference implementation.

## Package contents

### Final animation assets
`assets/animations/`

Actions:
- run
- dig
- ball
- bone
- think

Every action contains:
- transparent 256×256 frame sequence
- animated `.webp`
- animated `.apng`
- `.gif` preview
- static PNG fallback for Reduce Motion
- original high-resolution source strip

### Copy/personality
`config/bea-quotes.json`

### Timing / behavior
`config/animation-manifest.json`

### Approved visual references
`assets/references/`

### Clean generated loading-screen mockups
`assets/mockups/`

### UI revamp audit
`docs/UI_USAGE_AUDIT.md`

### Reference code
- `code/react/`
- `code/swiftui/`

These are reference implementations, not instructions to change the app's framework.

## Final UX

Universal heading:
**Béa is working on it…**

Under it:
- rotating Béa joke
- four loading dots

The animation changes based on the task.

Use ball and bone rarely so they remain funny.

## Production note

The package intentionally provides frame sequences in addition to animated files. This gives Claude a framework-independent source of truth and is the safest option for native/mobile integration.


## Personality builder update

The handoff now includes a complete customizable Béa personality system.

Users can start with a preset or independently adjust:
Helpful, Funny, Sassy, Encouraging, Curious, Adventurous, Dramatic, and Chill.

See `docs/PERSONALITY_BUILDER_UX.md`.


## Character continuity update

The package now includes Béa's advanced character layer:
- contextual quirks
- micro-reactions
- long-load escalation sequences
- rare visual Easter eggs
- success reactions
- situational/seasonal copy
- “Béa says” Companion asides
- mandatory no-joke contexts
- Béa's invisible confidence trait

Start with `docs/BEA_CHARACTER_ENHANCEMENTS.md`.


## Dynamic wardrobe update

Béa now includes a weather/activity-aware wardrobe system with explicit cultural-safety rules.

See:
- `docs/BEA_DYNAMIC_WARDROBE.md`
- `config/bea-dynamic-wardrobe.json`


## Béa lore update

Béa now has a separate recurring lore system for her questionable academic credentials.

Primary fictional institution:
**The Canine Institute of Travel**

See:
- `docs/BEA_LORE_AND_CREDENTIALS.md`
- `config/bea-lore-and-credentials.json`
