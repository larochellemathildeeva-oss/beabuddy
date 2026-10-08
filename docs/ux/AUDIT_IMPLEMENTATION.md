# UX audit implementation and release gates

This checklist reconciles the Figma findings with current `main`. A prototype
omission is not proof of a production bug. Preserve recommendations, memories,
trip collaboration, budget, documents, offline tools and all three themes.

## Implemented in this change

- New-trip retries reuse a confirmed trip ID and confirmed packing attachment.
  The initial form values remain the values submitted on retries. Form controls
  lock while finishing the same attempt; save feedback explains that behavior.
- Import retries reuse confirmed stops, costs and dates rather than restarting
  the whole save. Review controls lock and a separate retry action finishes the
  original reviewed payload. Rapid taps share one attempt.
- Joining a trip and assigning a document reject simultaneous submissions;
  closing those sheets during a pending write is blocked.
- Shared-trip sign-in retains the shared URL. Following presents a direct link
  to the Following list, and Trips validates and honors that destination.
- Timeline Now clears filters that could hide its destination, moves keyboard
  focus to the stop and respects reduced motion.
- Home widget handles, size pickers and module actions now have 48px targets.
- Shared Button defaults use minimum 48px targets, grow with content and have
  a stronger keyboard focus ring. Password visibility and legal agreement
  labels also have 48px targets. AuthField keeps both help and error descriptions.
- Signup explains the agreements required for its disabled submit button;
  pending submit and saved-import feedback expose accessible status.

## Existing implementations retained

| Audit concern                          | Existing implementation                                 | Remaining verification                                                |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Confirmed / tentative / unset dates    | `trip-dates.ts`, trip row and creation form             | Deployed schema compatibility and real cross-device persistence       |
| Safe auth return paths                 | `auth-redirect.ts` rejects external URLs and auth loops | Google callback and email confirmation on a second device             |
| Modal focus and Escape                 | `Sheet.tsx` traps and restores focus                    | Screen-reader and nested-sheet manual testing                         |
| Booking truthfulness                   | Import says Béa has not checked or made bookings        | Review every booking/document entry point                             |
| Reduced motion and reading preferences | Shared CSS and synced settings                          | 200% text on every populated page                                     |
| Home customisation                     | Existing dnd-kit grid and settings persistence          | Keyboard resizing/reordering and all module size combinations         |
| Read-only followed trips               | Server-controlled public share view                     | Live authorization tests with separate owner/member/follower accounts |
| Private documents                      | Existing encrypted vault and explicit passcode flow     | Wrong passcode, old vault upgrade and interrupted upload              |

## Remaining work, in order

1. **Durable save reconciliation (High).** Track logical save attempts across
   reloads and reconcile ambiguous network failures. Checkpoints here remember
   only writes whose promises resolve while the component is mounted; they are
   not transactions or server-side idempotency. A callback may itself partially
   write before rejecting. Inspect that behavior before selecting a database
   transaction or idempotency key. Do not claim duplicate prevention across
   reloads until those failure scenarios have tests.
2. **Draft continuity (High).** Inventory route changes, refresh, cancellation,
   and authentication interruptions for planning and document drafts. Specify
   privacy-safe expiry and account isolation before storing sensitive content.
3. **Navigation and hierarchy (High).** Compare each of the five landing tabs
   and trip subpages against the authoritative minimalist Figma edition. Keep
   one primary next action, meaningful empty states, explicit Recommendations
   versus World labels and tools subordinate to a daily trip summary. Record
   feature-by-feature parity before replacing any component.
4. **Interaction states (High).** Exercise zero/maximum data, long titles,
   invalid dates, deleted shares, upload validation, failed reads, offline saves,
   canceled extraction and retry. Preserve recoverable input and explain what
   is actually saved, pending, failed or unavailable.
5. **Accessibility (High).** Audit custom controls beyond shared Button for
   48px touch targets, field/control contrast, names, keyboard order, drag
   alternatives and announcements. Test Calm, Colorful and Dark, reduced motion,
   200% text, VoiceOver and TalkBack. Screenshots alone cannot prove compliance.
6. **First-use usability (Medium).** Ask new participants to create a trip,
   save a recommendation, follow a shared trip, assign a document and recover
   from a failed save. Record wrong turns and completion without prompting.
   Prioritize observed blockers over decorative conversion changes.

## Release requirements

Run typecheck, lint, the full tests, migration checks, build, public secret scan
and frozen itinerary audit. Use the real-component browser preview for empty,
undated, long-title, guest and populated trip states and theme checks. The preview now wraps trip fixtures in the real app shell by
default, follows Appearance to reach customization, and filters standalone
checks consistently when a single flow is requested. Browser
fixtures do not establish live Supabase configuration, cross-device behavior or
screen-reader conformance. Publish a PR for review; do not merge or deploy as part
of the audit. No package version changes or database migration in this change.
