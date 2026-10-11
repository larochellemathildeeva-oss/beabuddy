# "Something changed" — running late, without AI

Status: draft for review. No code yet.

## Problem

Béa's Now view (`companion.ts`) is manual by design: the traveller taps "I'm
here" and "Leaving", and nothing is inferred from the clock. That stays true
when the day breaks. A delayed flight or a missed train leaves the plan wrong
and the only fix is dragging stops one at a time. There is no way to say
"everything after this is 3 hours later".

## What already exists (reuse, don't rebuild)

- `itinerary-change.ts`: `ChangeSet`, `ProposedChange` (`retime`, `move`,
  `delete`, `lock`…) and `checkChange`. It ripples only **Flexible** timed
  stops, never rewrites a time the traveller typed, reports **Fixed**
  (booked / locked) stops it cannot move, and flags `reachabilityConflicts`
  with travel estimated from the pins (`route-estimate.ts`).
- `itinerary-review.ts` + `ReviewChangesSheet.tsx`: the review sheet that
  shows shifts and conflicts before anything is saved.
- `itinerary-schedule-write.ts`: the atomic, version-checked schedule write.
- `timeModeFor`: Fixed / Flexible / Sequence, already derived per stop.

So "Something changed" is a **new way to build a `ChangeSet`**, not a new
engine.

## Design

### Entry point

A "Running late / Something changed" button on the Now view (and the stop
sheet). Two questions, one screen:

1. **What happened?** Running late by N minutes (15 / 30 / 60 / 120 / custom),
   or "This stop took the time it took" (use the current time as the new start
   of the next stop).
2. **From where?** Default: the next stop. Option: a specific stop.

No free text, no AI. Everything is a number the traveller picks.

### Building the ChangeSet (pure, tested)

New `disruption.ts`:

```ts
shiftFrom(stops, { fromStopId, deltaMinutes, today }): ChangeSet
```

- Takes the day's stops from `fromStopId` onward and emits a `retime` for each
  **timed Flexible** stop, `+delta`.
- Skips Sequence (untimed) stops: they have no time to move.
- Does not touch Fixed stops. They surface through `checkChange` as
  `fixedConstraints` / `reachabilityConflicts`, which is the point: "your 19:30
  dinner booking is now 40 min tight".
- Stays within `today`. Anything that would cross midnight sets
  `crossesDay`, which `checkChange` already sends to review.
- `source: "manual"`.

### Review, not auto-apply

The result always goes through `ReviewChangesSheet`, never `auto-apply`. When
the day is breaking, one clear "here is what moves, here is what no longer
fits" screen beats a silent rewrite. Conflicts are listed with the existing
copy from `review-lines.ts`.

### Suggested fixes (still no AI)

For each unreachable or no-longer-fits stop, offer **one tap each**, as
further `ProposedChange`s in the same ChangeSet:

- **Skip it** → `delete` (or mark skipped; see open questions).
- **Move to tomorrow** → `move` to the next day, if there is one.
- **Keep as is** → leave it, acknowledged.

Order of suggestions: Flexible, unbooked stops first. A booked stop is never
suggested for removal; it is shown with its booking time and ref so the
traveller can phone the venue.

### Worked example

Landing 3 h late. Tap "Running late → 180 min → from: Airport transfer".
`shiftFrom` retimes the transfer, check-in and a walk, leaves the 19:30
booked dinner (Fixed), and `checkChange` reports the dinner is now
unreachable by 40 min. Review sheet shows: "Check-in 15:00 → 18:00",
"Dinner (booked 19:30) — you'd arrive 20:10", with Skip / Keep. Two taps,
saved with the existing atomic write.

## Not in this spec

- **Flight-status feeds / pasted airline SMS parsing.** Phase 2, and the only
  part that would call Gemini (needs an `AI_COST` entry and the usual
  `reserveAi`). The manual flow above must ship and be used first.
- **Auto-detecting lateness from the phone's position.** `FollowAlong`
  deliberately never writes times without a tap; this keeps that rule.
- **Pushing the delay to people following a share link.** Follow-along links
  read `arrived_at`/`left_at` only. A shifted plan reaches followers through
  the normal plan read; no new channel.

## Tests

Pure, in `disruption.test.ts` (`node --test`, like the neighbours):

- shifts only timed Flexible stops after the chosen one
- leaves Fixed and untimed stops alone, and reports the Fixed one as a conflict
- crossing midnight → `crossesDay` → review
- delta 0 or no later stops → empty ChangeSet, button does nothing
- never touches other days or earlier stops

UI: one component test-free sheet reusing `ReviewChangesSheet`; check by hand
on a phone-width screen.

## Open questions for the owner

1. "Skip" — delete the stop, or keep it greyed as skipped? Deleting loses
   booking details; a skipped state would need a column (migration, applied by
   hand).
2. Should the shift also offer to move **Fixed** stops the traveller says have
   been rebooked (a one-tap `lock` + `retime`)?
3. Where does the button live first: Now view only, or also the day header?

## Size

Phase 1 is roughly one pure module with tests, one small sheet, and wiring into
the existing review flow (`useItineraryReviewFlow`). No migration. No new
server function. No AI cost.
