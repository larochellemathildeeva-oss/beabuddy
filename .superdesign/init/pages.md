# Pages — component dependency trees

Local UI imports only (.tsx/.css/.png), traced recursively. `(seen)` = already listed above in the same tree. Every page renders inside `AppShell` (see layouts.md) except `/auth`, `/forgot-password` and `/reset-password`, which draw their own standalone layout.

## / (Home)
Entry: src/routes/index.tsx (293 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/Globe.tsx
- src/components/HomeTripCard.tsx
  - src/components/TripBanner.tsx
  - src/components/TripCard.tsx
    - src/components/TripBanner.tsx (seen)
- src/components/HomeSaveTile.tsx
  - src/components/HomeWeather.tsx
- src/components/ContentCard.tsx
- src/components/NearHome.tsx
  - src/components/NearbyPlaces.tsx
    - src/components/DayTripFromNear.tsx
      - src/hooks/useAuth.tsx (seen)
- src/components/HomeWeather.tsx (seen)
- src/hooks/useAuth.tsx (seen)

## /trips (Trips list)
Entry: src/routes/trips.tsx (450 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/DocumentVault.tsx
- src/components/DateRangeField.tsx
  - src/components/ui/calendar.tsx
    - src/components/ui/button.tsx
- src/components/PlaceSearchInput.tsx
- src/components/TripCard.tsx
  - src/components/TripBanner.tsx
- src/components/Skeletons.tsx
- src/hooks/useAuth.tsx (seen)

## /trips/$tripId (Trip detail)
Entry: src/routes/trips_.$tripId.tsx (100 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/TripDetail.tsx
  - src/components/TripBudget.tsx
  - src/components/TripStops.tsx
    - src/components/PlaceSearchInput.tsx
    - src/components/Section.tsx
    - src/components/Sheet.tsx
    - src/components/SavedPlacePicker.tsx
  - src/components/TripPeople.tsx
    - src/components/ConfirmSheet.tsx
      - src/components/Sheet.tsx (seen)
  - src/components/TripSettings.tsx
    - src/components/ConfirmSheet.tsx (seen)
    - src/components/DateRangeField.tsx
      - src/components/ui/calendar.tsx
        - src/components/ui/button.tsx
    - src/components/PlaceSearchInput.tsx (seen)
  - src/components/Section.tsx (seen)
  - src/components/TripBanner.tsx
  - src/components/TimelineEntryForm.tsx
    - src/components/PlaceSearchInput.tsx (seen)
    - src/components/SavedPlacePicker.tsx (seen)
  - src/components/Sheet.tsx (seen)
  - src/components/TripMap.tsx
  - src/components/TripPrep.tsx
    - src/components/PackingLists.tsx
      - src/components/Sheet.tsx (seen)
      - src/components/PackingListView.tsx
    - src/components/Sheet.tsx (seen)
    - src/components/TripTodos.tsx
  - src/components/ItineraryImport.tsx
    - src/components/Sheet.tsx (seen)
    - src/components/BeaRunning.tsx
      - src/assets/bea-logo.png (seen)
    - src/components/SearchGroundingNote.tsx
    - src/components/ui/switch.tsx
    - src/assets/bea-logo.png (seen)
  - src/components/ItineraryDirections.tsx
  - src/components/DaySelector.tsx
  - src/assets/bea-logo.png (seen)
  - src/components/day/DayMapView.tsx
    - src/components/day/DayMap.tsx
    - src/components/TimelineGlyph.tsx
  - src/components/day/DayRibbon.tsx
  - src/components/day/JourneyTracker.tsx
  - src/components/day/StopPeek.tsx
  - src/components/day/NowPanel.tsx
    - src/components/PlaceFacts.tsx
  - src/components/day/CustomizeTrip.tsx
    - src/components/Sheet.tsx (seen)
    - src/components/ui/switch.tsx (seen)
  - src/components/day/SavedPlacesSheet.tsx
    - src/components/Sheet.tsx (seen)
  - src/components/day/TimelineCard.tsx
    - src/components/PlaceFacts.tsx (seen)
    - src/components/PlaceSearchInput.tsx (seen)
    - src/components/TimelineGlyph.tsx (seen)
    - src/components/day/SwipeRow.tsx
    - src/components/day/BookingSheet.tsx
      - src/components/Sheet.tsx (seen)
      - src/components/ui/switch.tsx (seen)
- src/hooks/useAuth.tsx (seen)
- src/components/Skeletons.tsx

## /world (World globe)
Entry: src/routes/world.tsx (552 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/Globe.tsx
- src/components/Section.tsx
- src/components/ComparePins.tsx
  - src/components/BeaRunning.tsx
    - src/assets/bea-logo.png (seen)
- src/components/AddVisitedCity.tsx
  - src/components/PlaceSearchInput.tsx
  - src/components/Sheet.tsx
- src/components/ui/switch.tsx

## /recommendations (Recs (saved places))
Entry: src/routes/recommendations.tsx (1226 lines)
Dependencies:
- src/components/Skeletons.tsx
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/NearbyMapPin.tsx
- src/components/RecoListImport.tsx
- src/components/TripPlacesImport.tsx
- src/components/ShareRecos.tsx
- src/components/PlaceSearchInput.tsx
- src/hooks/useAuth.tsx (seen)
- src/components/Section.tsx
- src/components/PlaceFacts.tsx

## /profile (You / profile)
Entry: src/routes/profile.tsx (603 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/Tour.tsx
  - src/hooks/useAuth.tsx (seen)
  - src/components/SpotlightOverlay.tsx (seen)
  - src/components/DemoVideo.tsx
- src/components/PackingLists.tsx
  - src/components/Sheet.tsx
  - src/components/PackingListView.tsx
- src/components/Section.tsx
- src/components/CustomizeHome.tsx
  - src/components/ui/sheet.tsx
  - src/components/ui/switch.tsx
- src/components/FeedbackForm.tsx
  - src/hooks/useAuth.tsx (seen)
- src/components/CopyrightNotice.tsx
- src/components/ui/alert-dialog.tsx
  - src/components/ui/button.tsx
- src/hooks/useAuth.tsx (seen)

## /preferences (Preferences)
Entry: src/routes/preferences.tsx (389 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/hooks/useAuth.tsx (seen)

## /auth (Sign in / sign up)
Entry: src/routes/auth.tsx (302 lines)
Dependencies:
- src/hooks/useAuth.tsx
- src/components/CopyrightNotice.tsx
- src/components/PasswordCreationRules.tsx

## /memories (Memories)
Entry: src/routes/_authenticated/memories.tsx (331 lines)
Dependencies:
- src/components/Skeletons.tsx
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx

## /photos (Photos)
Entry: src/routes/_authenticated/photos.tsx (423 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/BeaRunning.tsx
  - src/assets/bea-logo.png (seen)

## /expenses (Expenses)
Entry: src/routes/_authenticated/expenses.tsx (473 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/Sheet.tsx

## /calendar (Calendar)
Entry: src/routes/_authenticated/calendar.tsx (260 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx

## /story (Story / playback)
Entry: src/routes/_authenticated/story.tsx (266 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/Globe.tsx

## /how-it-works (How it works)
Entry: src/routes/how-it-works.tsx (154 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx
- src/components/DemoVideo.tsx
- src/components/HowItWorksFigures.tsx

## /help (Help)
Entry: src/routes/help.tsx (108 lines)
Dependencies:
- src/components/AppShell.tsx
  - src/hooks/useAuth.tsx
  - src/components/PageHeader.tsx
  - src/assets/bea-logo.png
  - src/components/PageGuide.tsx
    - src/components/SpotlightOverlay.tsx

