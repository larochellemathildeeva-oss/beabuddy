# “Béa says” Companion Layer

Use a lightweight, visually distinct personality layer inside Companion responses.

## Purpose

Separate **Béa's character voice** from factual travel information.

Example:

**Béa says**  
“Three transfers. I have concerns.”

Then below it, present the actual route comparison with normal factual UI.

## Rules

- Optional, not mandatory on every response.
- Maximum one short Béa comment per major response block.
- Keep it visually secondary to the factual answer.
- Never put prices, addresses, times, warnings, booking conditions or other important facts inside the personality bubble.
- If the response contains an error, safety warning, payment/account issue or actionable problem, suppress the joke layer.
- Respect the user's personality mix.
- Respect the no-repeat history used by loading/empty-state comments.

## Good contexts

- before a recommendation shortlist
- after Béa completes a comparison
- when highlighting a surprisingly good or bad logistical option
- when a route is unusually complex
- when an empty state needs a friendly character moment

## Avoid

- every single message
- basic confirmations
- form validation
- destructive actions
- safety or medical information
- payment/account/security issues
