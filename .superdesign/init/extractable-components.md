# Extractable components

## Layout Components

## AppTopBar
- Source: `src/components/AppShell.tsx` (the `<header>` block)
- Category: layout
- Description: Top bar — optional round back button, Béa logo image + serif "Béa" wordmark with small version line, "TRAVEL BUDDY" caps label; right side page-guide button and online status dot
- Extractable props: showBack (boolean, default: true), version (string, default: "3.4.1"), online (boolean, default: true)
- Hardcoded: logo image (`src/assets/bea-logo.png`), wordmark, icons (lucide ArrowLeft), all CSS

## TabBar
- Source: `src/components/AppShell.tsx` (the `<nav aria-label="Main">` block)
- Category: layout
- Description: Bottom 5-tab bar (Home, World, Trips, Recs, You) with lucide icons, uppercase labels, one sliding tinted pill behind the active tab
- Extractable props: activeItem (string, default: "home")
- Hardcoded: tab labels, icons (Home, Globe2, MapPinned, Bookmark, User), CSS

## PageHeader
- Source: `src/components/PageHeader.tsx`
- Category: layout
- Description: Screen title block — small caps eyebrow, large Instrument Serif title, one optional right action
- Extractable props: eyebrow (string, default: "Trip folders"), title (string, default: "Everything, already filed.")
- Hardcoded: typography, spacing

## Basic Components

## TripCard
- Source: `src/components/TripCard.tsx` (+ `TripBanner.tsx`)
- Category: basic
- Description: Trip folder card with image/gradient banner, name, dates, place count
- Extractable props: title, dates, cityCount
- Hardcoded: layout, CSS

## Section
- Source: `src/components/Section.tsx`
- Category: basic
- Description: Titled content section with caps label and optional action
- Extractable props: title (string)
- Hardcoded: CSS

## Sheet
- Source: `src/components/Sheet.tsx`
- Category: basic
- Description: Bottom sheet over content (card-raised surface, grab handle)
- Extractable props: title (string)
- Hardcoded: CSS
