# Béa Character Enhancements — Implementation Spec

This extends the existing personality sliders and quirks without adding more user-facing controls.

## 1. Character continuity

Béa should feel like the same dog from screen to screen.

Persist:
- selected personality preset/custom sliders
- short-term history of recent Béa lines
- short-term history of recent quirks

Do not persist long-term joke history across devices unless the app already has an appropriate lightweight preference store.

## 2. Micro-reactions

Allow short optional reactions when the app detects notable outcomes:
- unusually good option
- very expensive set of options
- too many transfers
- strong hidden gem
- no useful result

These are secondary comments only. Never replace the underlying factual result.

## 3. Contextual obsessions

Match recurring quirks to context:
- food → snacks
- long route → tiny legs / stamina
- parks → sniffing
- beach → digging / sand
- flights → airport drama
- maps → navigation confidence
- long wait → naps / ball / bone

## 4. Long-load escalation

For selected longer loads, allow a short sequence:
1. normal work line
2. follow-up line
3. rare visual Easter egg
4. return-to-work line

Example:
“Béa is focused.”
“Still focused.”
“Correction: ball.”
“Right. Back to work.”

Do not use this on every load.

## 5. Visual Easter eggs

Rare:
- ball rolls through
- bone discovery
- micro-nap
- upside-down map

Max one rare Easter egg per loading session.

## 6. Success reactions

After selected tasks complete, Béa may show one brief success line before/with the result.

Examples:
- “Done. Béa would like full credit.”
- “Finished. Against several odds.”
- “Route ready. Béa will be taking none of the credit for traffic.”

Do not delay access to the result for the joke.

## 7. Empty and first-use states

Use static Béa art for:
- no trips
- no saved recommendations
- no saved places
- no search results
- first-use Companion / trip creation moments

Do not use a working animation when nothing is being processed.

## 8. “Béa says” layer

Companion can occasionally surface a short Béa aside, visually separated from factual content.

See `docs/BEA_SAYS_LAYER.md`.

## 9. Seasonal and situational lines

Allow context-aware lines for:
- rain
- heat
- red-eye flights
- very early departures
- holiday crowds
- jet lag

Do not use a date-based seasonal joke if the app cannot reliably determine that context.

## 10. No-joke intelligence

Suppress personality jokes for:
- payment/billing problems
- account/security problems
- booking failures requiring action
- safety-critical information
- destructive confirmations
- technical errors requiring remediation
- privacy/permission failures

This restraint is part of Béa's personality quality.

## 11. Béa confidence

Confidence is an invisible, non-user-editable character trait.

The recurring joke:
Béa behaves like a highly qualified travel expert even though she is obviously a small French bulldog.

Use sparingly.

Examples:
- “Béa has completed her analysis. Qualifications remain unclear.”
- “Béa has selected the best route. Please do not ask how she learned to read a map.”
- “Béa has spoken with the authority of someone wearing a lemon bandana.”

## 12. Priority order

When generating a Béa comment:

1. check whether jokes are allowed in this context
2. identify the app/task context
3. choose personality trait using normalized user sliders
4. optionally choose a compatible quirk
5. optionally choose a notable-outcome reaction
6. enforce no-repeat rules
7. keep the factual UI separate
