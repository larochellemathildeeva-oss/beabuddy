The Map view now owns a tall stage. Day chips float on it. Live keeps one stop in a sheet and the map follows it. Split pulls the day list up over the same map. Whole trip in Split is still one map per day, with the city-to-city TripMap underneath. Bookings stay in Overview. `package.json` version remains 6.15.8.

The stored layout ids are still `focus` and `split` (`bea.mapLayout`). The visible labels stay Live and Split.

## Phone screenshots (390 × 844)

Real trip components, the preview fixture, and the app's fonts and artwork. Before is main. After is this branch. No mockup pictures were copied in.

### Split

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-calm-pink-split.png) | ![After Calm Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-calm-pink-split.png) |
| Colorful · Pink | ![Before Colorful Pink Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-colorful-pink-split.png) | ![After Colorful Pink Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-colorful-pink-split.png) |
| Colorful · Periwinkle | ![Before Colorful Periwinkle Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-colorful-periwinkle-split.png) | ![After Colorful Periwinkle Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-colorful-periwinkle-split.png) |
| Dark | ![Before Dark Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-dark-pink-split.png) | ![After Dark Split](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-dark-pink-split.png) |

### Live

| Appearance | Before | After |
| --- | --- | --- |
| Calm | ![Before Calm Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-calm-pink-live.png) | ![After Calm Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-calm-pink-live.png) |
| Colorful · Pink | ![Before Colorful Pink Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-colorful-pink-live.png) | ![After Colorful Pink Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-colorful-pink-live.png) |
| Colorful · Periwinkle | ![Before Colorful Periwinkle Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-colorful-periwinkle-live.png) | ![After Colorful Periwinkle Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-colorful-periwinkle-live.png) |
| Dark | ![Before Dark Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/before-dark-pink-live.png) | ![After Dark Live](https://raw.githubusercontent.com/larochellemathildeeva-oss/beabuddy/cursor/ui-revamp-step-4-map-4809/.superdesign/handoff/ui-revamp-step-4/after-dark-pink-live.png) |

## Validation

- Typecheck, lint (0 errors; 15 existing warnings), tests (1,929 passing), production build, and public-secrets check pass.
- Import and place lookup were not changed, so `audit:ci` was not run.
- `preview:check` clicks every control on every trip view with 0 problems, in Calm, Colorful and Dark: 96 controls per theme.
- Map checklist below was clicked in the running preview at 390×844. Nesting, Booked, and Béa's note were clicked with `?nest=1` (a stop inside another, a booked mark, and a gap tight enough for the existing note). The unpinned-day sentence was clicked with `?sample=map-gap`. Neither parameter changes the default sample.

## Preservation checklist

Quoted from `.superdesign/checklists/map.md`. A box is ticked only after that control or sentence was clicked in the running app.

# Trip page — Map view: function checklist

Sources: `TripDetail.tsx` (map section), `day/DayMapView.tsx`, `day/DayMap.tsx`, `TripMap.tsx`.

## Both layouts
- [x] Split / Focus switch, remembered per device
- [x] Pins numbered like the day's cards; soft dotted arc between them (never a route)
- [x] Places inside another shown nested ("In …"), unless Customize turns nesting off
- [x] OpenStreetMap + Geoapify credit on the map
- [x] "Nothing to put on the map yet." / "No stop on this day has a location yet."
- [x] Whole trip selected: one map per day in Split, plus the city-to-city TripMap
- [x] "Locate on map" from the Timeline opens here on that stop

## Focus (the draft's "Live")
- [x] Map fills the screen under the header; follows the chosen stop
- [x] Whole day (fit), numbered strip to jump to any stop
- [x] Stop card: number, time, ~stay, Booked, previous / n of N / next, swipe to step
- [x] Kind mark, title, address, nesting line
- [x] "Then {next}, about N min walk" (as the crow flies), Open in maps

## Split
- [x] Per day: header (Day N, date, stops, about distance), Béa's note
- [x] Rail of stops with times, legs between, Booked, "Not on the map yet", Show on the map, Open in maps
- [x] Fit route; tap a card ↔ pin

## Not in the app (draft shows them)
- Zoom + / − buttons — pinch only today; easy to add.
- Locate me and full-screen buttons — new; left out.
- Leave by / Béa says on the map card — those belong to Companion.

The running app already has Leaflet zoom, "Show where I am", and Leave by / Béa says on the Live card. Those stayed. The checklist's note that they are absent is out of date. See questions.

## Questions

1. The switch is labeled Live / Split. The checklist calls Live "Focus". The stored ids are still `focus` and `split`. Should the visible word become Focus?
2. The checklist says Leave by and Béa's line belong on Companion and were not on the map. The Live card already shows both. I kept them on the sheet. Should they leave the map?
3. The mockup stop sheet has "In the timeline". Timeline is already a view in the bar. I did not add a second button. Should the sheet have one?
4. The mockup's whole-trip map is one picture of the cities. The checklist asks for one map per day in Split, plus the city-to-city TripMap. I kept that. Is the extra TripMap still wanted under the day maps?
5. Zoom +/− and "Show where I am" are already in the app. The checklist thought they were not. I kept both and did not add a full-screen button. "Show where I am" now sits on the left, under the fit control, because the map credit was taking the click when it sat under zoom. Should it go back to the right if the sheet is shorter?
6. A stop that has been arrived at and left is drawn with the accent's done colour and black text. Should a finished stop keep its kind colour instead?
7. Kind chips are 12px and Booked chips are 11.5px in the shared stop bits, including on the map. I left them so the timeline card-height check and the other views stay as they are. Should they become 13px everywhere?
8. The Live card now shows "Open in maps" and keeps the older "Navigate" label. Both open the same place. Is one enough?
