# Béa Copy / Saying Library

This folder is the quickest place to find all Béa wording.

## `ALL_BEA_COPY_LIBRARY.json`
Machine-readable bundle of the complete character-copy configuration, including:

- Helpful / Funny / Sassy / Encouraging
- Curious / Adventurous / Dramatic / Chill
- loading prompts by action
- empty-state language
- success reactions
- micro-reactions
- situational / weather language
- visual-Easter-egg copy
- questionable-credentials / academic lore
- wardrobe-context comments

## `ALL_BEA_SAYINGS.txt`
Flattened, deduplicated list of short user-facing Béa sayings for review.

## Source-of-truth hierarchy

For implementation, Claude should prefer the newer systems:

1. `config/bea-personality-v2.json`
2. `config/bea-prompt-banks-v2.json`
3. `config/bea-character-continuity.json`
4. `config/bea-moments-and-reactions.json`
5. `config/bea-lore-and-credentials.json`
6. `config/bea-dynamic-wardrobe.json`
7. `config/bea-visual-easter-eggs.json`

Older `bea-personality.json` / `bea-quotes.json` remain included because they contain useful historical empty-state/copy material, but the V2 files govern the final personality model.

## Final Balanced preset

- Helpful: 35
- Funny: 35
- Sassy: 20
- Encouraging: 10
- Curious: 0
- Adventurous: 0
- Dramatic: 0
- Chill: 0

Users can switch to presets or customize all eight traits independently from 0–100. The app normalizes the non-zero values internally.
