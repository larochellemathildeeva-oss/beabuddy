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
- Companion keeps its day picker available during a live journey, including
  All days; accessible date labels include the day number, and arrow/Home/End
  keys switch days. An explicit All days choice asks which day to follow while
  opening still selects today automatically and one-day trips keep their fallback.
- The saved Itinerary ribbon switch renders the existing ribbon again; looking
  at a stop on it keeps the current stop intact.
- Document assignment fields lock while saving so edits made during the request
  cannot silently disappear when the sheet closes.
- Timeline Now clears filters that could hide its destination, moves keyboard
  focus to the stop and respects reduced motion.
- Home widget handles, size pickers and module actions now have 48px targets.
- Shared Button defaults use minimum 48px targets, grow with content and have
  a stronger keyboard focus ring. Password visibility and legal agreement
  labels also have 48px targets. AuthField keeps both help and error descriptions.
- Signup explains the agreements required for its disabled submit button;
  pending submit and saved-import feedback expose accessible status.

## Follow-up: review fixes and new-trip recovery

- New-trip input survives refresh and route changes in this browser. The copy
  is scoped to the signed-in account, versioned, validated and available for
  seven days after the last edit. Expired/corrupt copies are removed when read.
  Account erase clears its draft on this device. Storage failure is explained;
  this local copy is not encrypted and does not sync across devices.
- Before creating a trip, freeze the reviewed details, city IDs and selected
  packing-list contents. Retry reconciles the same primary keys for the trip,
  cities, packing copy and items, inserting only missing rows. A lost response
  or failure copying packing items does not require a second list. Existing
  rows are not overwritten; reads/writes keep normal Supabase RLS and owner
  checks. The attempt can be restored after refresh while its local copy exists.
- An explicit Recovery options action discards local recovery details and
  unlocks a new draft. It explains that saved parts remain in Trips and a new
  creation is a separate trip. Closing the sheet retains recovery.
- Clearing a Trips view query restores Upcoming. City removal and day-trip
  actions have 48px targets.
- Companion's explicit All days choice is an in-session flag, separate from
  restored filters, city changes and Timeline selections. Reopening follows
  today automatically; a manual Companion All days tap still asks for a day.
- Below 416px the date-range dialog uses native date fields with 48px targets;
  wider screens keep the range calendar with 48px days/month navigation. The
  range can still be cleared, confirmed or reduced to a single day.

These changes address all six inline findings on PR #306. They do not make
multi-table creation atomic. Other entry points, import review payloads,
documents and cross-device drafts are not made durable by this batch. Losing
or discarding the browser copy removes the stable attempt IDs.

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

1. **Durable save reconciliation (High).** The new-trip sheet now reconciles
   stable IDs across reloads while its browser copy exists. Extend equivalent
   recovery to itinerary imports and other creation entry points. Their
   checkpoints still remember only confirmed writes while mounted; they are
   not transactions or server-side idempotency. A callback may itself partially
   write before rejecting. Inspect that behavior before selecting a database
   transaction or idempotency key. Do not claim duplicate prevention across
   reloads until those failure scenarios have tests.
2. **Draft continuity (High).** New-trip fields now have account-scoped browser
   recovery. Inventory route changes, refresh, cancellation, and authentication
   interruptions for planning/import review and document drafts. Specify
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
