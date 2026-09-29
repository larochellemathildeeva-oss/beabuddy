# BÉA — FINAL COMPLETE HANDOFF

This is the consolidated final package for Claude.

## Included

### Production animation sets
- Run
- Dig
- Think
- Ball
- Bone

Each set includes:
- animated WebP
- APNG
- GIF preview
- transparent static PNG
- six transparent PNG source frames
- source strip

### Loading experience
Universal heading:

**Béa is working on it…**

Includes:
- action mapping
- four-dot loader
- loading-screen mockups
- iOS-compatible MP4/MOV/GIF showcase previews
- Reduce Motion behavior
- React reference component
- SwiftUI reference component

### Personality system
Eight independent traits:
- Helpful
- Funny
- Sassy
- Encouraging
- Curious
- Adventurous
- Dramatic
- Chill

Balanced:
**35 Helpful / 35 Funny / 20 Sassy / 10 Encouraging**

Users may create a Custom Béa by setting each trait from 0–100. Values are normalized internally and do not need to total 100.

Setting location:
**Profile → Béa → Personality**

### Character systems
- quirks
- character continuity
- success reactions
- micro-reactions
- long-load escalation
- visual Easter eggs
- situational/weather comments
- no-joke intelligence
- “Béa says” Companion layer
- Dynamic Wardrobe
- cultural-safety rules
- questionable-credentials lore
- Canine Institute of Travel

### Empty states
Static Béa artwork/copy rules for:
- no trips
- no saved recommendations
- no saved places
- no results

### Claude implementation
Start with:

**`CLAUDE_IMPLEMENTATION_PROMPT.md`**

Then consult:
- `docs/UI_USAGE_AUDIT.md`
- `docs/PERSONALITY_BUILDER_UX.md`
- `docs/BEA_CHARACTER_ENHANCEMENTS.md`
- `docs/BEA_DYNAMIC_WARDROBE.md`
- `docs/BEA_LORE_AND_CREDENTIALS.md`
- `docs/ACCEPTANCE_CHECKLIST.md`

### Complete wording library
See:
- `copy/ALL_BEA_COPY_LIBRARY.json`
- `copy/ALL_BEA_SAYINGS.txt`
- `copy/COPY_LIBRARY_INDEX.md`

## Important design rule

Béa is a character, not a decorative pattern.

Use her intentionally for:
- work/loading
- Companion
- empty states
- first-use moments
- selected success reactions
- occasional Easter eggs

Do not clutter maps, timelines, normal navigation, destructive actions, serious errors, payment/security, or safety-critical interfaces with playful Béa behavior.
