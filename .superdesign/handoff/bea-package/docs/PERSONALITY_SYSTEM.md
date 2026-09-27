# Béa Personality System

Users may choose how Béa speaks. This affects loading jokes, empty-state copy, and other optional companion comments. It does **not** change core navigation labels, safety/error messages, booking facts, directions, prices, or other factual content.

## Presets

- **Balanced** — default. Useful first, with dry Béa humor mixed in.
- **Helpful** — clear, calm and minimally playful.
- **Funny** — dog puns, tiny-leg jokes and self-deprecation.
- **Sassy** — dry/sarcastic about situations and options, never insulting the user.
- **Minimal** — mostly plain status language.

## Required setting location

Add this user-facing control in the app's Profile settings:

`Profile → Béa → Personality`

If the app already nests preferences under a Settings section inside Profile, use:

`Profile → Settings → Béa → Personality`

Use a segmented picker or simple list with short examples.

Example preview:

**Helpful**
“Béa is comparing the options.”

**Funny**
“Thinking very hard. Please respect the ear angle.”

**Sassy**
“Béa is comparing the options. Some have disappointed her.”

**Minimal**
“Béa is working on it…”

## Implementation

The selected preset maps to tone weights in `config/bea-personality.json`.

For each loading event:
1. determine the action (`run`, `dig`, `think`, etc.)
2. choose a tone according to the selected personality preset
3. choose a non-recent line from that action/tone bank
4. do not repeat any of the last 5 lines
5. rotate only if the load lasts beyond ~4.2 seconds

Do not make every load random chaos. Keep the action relevant to what Béa is actually doing.

## Guardrails

Humor should never appear for:
- payment problems
- account/security issues
- destructive confirmations
- safety-critical information
- technical errors that require clear remediation

For those states, use direct helpful copy.

Empty states can use the same personality preference. Static Béa art is preferred over loading animation because nothing is currently being processed.
