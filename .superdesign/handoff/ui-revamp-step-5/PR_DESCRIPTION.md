<!-- ccr-projects-attribution: {"github_login":"larochellemathildeeva-oss"} -->
_Requested by **MPMR** · [project thread](https://claude.ai/code/project/chan_01Bx5Dh1pmd1Bw9FSqsH5pwS?thread=cmsg_01Bx5Dh1pmd1Bw9FSqsH5pwSQmG5tvEm9p5P13MpoFtu9U)_

This is step 5 of `docs/ui-revamp/README.md`: Timeline.

Before: each stop was a large card with its number on a rail, the time inside the card, and Map, Directions and a camera button on every card. Between stops was a row with a paw icon. The day heading had three round buttons, and a swipe hint sat under the first card.

After: Timeline follows the mockup's `trTimeline`.
- The time sits to the left of each card.
- Cards are lighter: the stop's type is an icon tile with the stop's number on its corner (the same number as its pin on Map), the name is in the serif font, and duration and type share one line with Booked, Now, Done or Not on the map.
- Map, Directions, Mark done, Edit stop, Save to your places, Booking, Add a photo, Move earlier or later, Move to… and Delete are all under the stop's ⋯ menu.
- Walk and drive times sit on a dashed line between cards.
- Each day has Edit stops and Add buttons, plus an "Add a stop to this day" button at the end.
- One tip explains where things went. It can be dismissed and stays dismissed on that phone.

Nothing was removed. The same callbacks and sheets are still wired: tapping a stop opens it for editing, swipe works as before, the ⋯ options sheet keeps Edit the itinerary, Change a day, Optimize, Not visited and Neighbourhood, and the directions signpost, the Now line and Add a stop between (inside an open leg) are unchanged. `package.json` version is unchanged.

## Phone screenshots (390 wide)

These use the real components with the repository's preview fixture. Before is main. After is this branch.

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/before-timeline-calm.png) | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/after-timeline-calm.png) |
| Colorful | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/before-timeline-colorful.png) | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/after-timeline-colorful.png) |
| Dark | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/before-timeline-dark.png) | ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/after-timeline-dark.png) |

A stop's ⋯ open (Colorful): ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/after-menu-colorful.png)

Edit stops (Colorful): ![](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/claude/ui-revamp-step-5-timeline/.superdesign/handoff/ui-revamp-step-5/after-edit-colorful.png)

## Validation

- Typecheck, lint (0 errors, 15 existing warnings), tests (1,929 pass), build, public-secrets check and migration rules all pass.
- `preview:check` clicked 133 controls per theme with 0 problems in Calm, Colorful and Dark.
- New preview flow: Map is no longer on a card's front. ⋯ has Show on the map, which switches to Map, and Directions. Edit stops turns every card over, Done ends it, and the tip dismisses.
- `audit:ci` was not run, because import, place lookup and plan reading are unchanged.

## Timeline checklist

Copied from `.superdesign/checklists/timeline.md`. A box is ticked only when a preview flow or the screenshots exercised that row.

## List header
- [x] Stops scheduled · visited count
- [x] All / Not visited (N)
- [x] Timeline / Neighbourhood order (by day)
- [ ] All entries / By day: the code path is unchanged; not clicked
- [x] Add (form) · Edit the itinerary / Done editing (every card's back at once)
- [x] Optimize (planner, Optimize tab)
- [ ] Undo on the toast after a move / done / delete: unchanged; not clicked

## Stop card
- [x] Front: time, name, where; number; Booked; done state
- [ ] Inside pill with tick-off list: same component, moved under the card's top row; not on the fixture
- [x] Tap opens the stop to edit (name, note, day, time, stay, place, booking, detail)
- [x] Mark done · Locate on the map · Move earlier / later · Delete
- [ ] Save to your places: under ⋯, not clicked
- [ ] Swipe right: done; swipe left: save / delete. SwipeRow is unchanged; not swiped in the preview
- [ ] Add something to see inside this stop: unchanged; not clicked
- [ ] Add a stop between: still inside an open leg; not clicked
- [ ] Now line on a travel day: unchanged; the fixture day is not today

## Between stops (TravelConnector)
- [x] Walk / drive time, or "Journey not measured yet"
- [x] Leave by
- [x] Far-apart warning
- [x] Open in Maps; See / Hide directions

## Directions (ItineraryDirections)
- [x] Get directions (signpost on the day heading)
- [ ] Refresh · Keep on this phone · Add these legs to the timeline: unchanged; not clicked

## Questions

1. The mockup's day button says "Edit day", but the app's edit mode turns over every stop on the trip, not just one day. It's labelled "Edit stops". Should it edit only that day?
2. The mockup drops the address line from the card. I kept it when a stop has an address, because it's the only place the front says where a stop is. Should it go?
3. The camera button moved from every card into ⋯ as "Add a photo". Should a stop that already has photos keep the camera on its front?

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01KyqLUZpRzgjg3XiM6UcGHB
