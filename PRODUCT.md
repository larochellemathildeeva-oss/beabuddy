# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are leisure and work travellers planning, organizing, and actively taking trips, including shared trips with friends. They use Béa to turn fragmented travel information and preferences into a trip they can understand, edit, follow, and share before and during travel.

## Product Purpose

Béa is a persistent travel workspace and trip companion. It helps travellers create itineraries from their preferences, organize trip details, track reservations and documents, manage stops across timeline and map views, follow the current day while travelling, and keep travel companions aligned around the same trip.

Success means the user can move from planning to active travel without re-entering or mentally reconciling the same trip information across separate tools.

## Positioning

Béa is not only an AI itinerary generator. Its distinguishing mechanism is that planning, trip editing, timeline, map, saved reservations and documents, live-day guidance, and shared-trip coordination are different views and workflows over the same persistent trip data.

## Operating Context

Béa is used both before travel and during an active trip. Relevant trip information can include itinerary stops, dates, destinations, transport, hotels, reservations, documents, receipts for work travel, saved destination photos, notes, maps, timing, and travel companions.

Users may be on desktop while planning and on a phone while travelling. The product should therefore remain useful across responsive web layouts, with active-trip workflows designed for mobile use.

## Capabilities and Constraints

- Create and edit itineraries based on traveller preferences.
- Maintain multiple coordinated views of the same trip, including overview, timeline, companion/live-day, and map experiences.
- Save and organize reservations and trip documents.
- Support shared trips with friends or other travel companions.
- Support work-travel information, including receipts.
- Allow users to import photos and save them to a destination.
- Preserve trip continuity from planning through active travel rather than treating each planning interaction as disposable output.
- Do not fabricate travel facts, bookings, reservations, testimonials, customers, usage statistics, benchmarks, or other evidence.
- Existing product behavior and data should not be changed solely because a design tool proposes a different pattern; visual redesigns require explicit review and approval before implementation.

## Brand Commitments

- Product name: Béa, including the accent.
- Béa has an established product personality and voice that future work should preserve rather than replace casually.
- Béa's personality may be funny, punny, or lightly sarcastic where appropriate, while serious contexts suppress jokes.
- Béa should not rely on cultural stereotypes.
- The interface supports three user-selectable visual themes: Calm, Dark, and Colorful. These are binding product capabilities; their detailed visual treatment belongs in design-system documentation rather than this product record.
- Visual direction may evolve, but durable product truth and approved behavior should remain separate from aesthetic experimentation.

## Evidence on Hand

The repository itself is the primary source of evidence for current capabilities, workflows, routes, behavior, and implementation constraints. Existing product screens, code, tests, and approved design artifacts should be treated as evidence of incumbent behavior and design rather than replaced by invented assumptions.

There are no confirmed public testimonials, customer claims, adoption metrics, or performance benchmarks that future design work may fabricate as proof.

## Product Principles

1. One trip, many coordinated views: timeline, map, companion, documents, reservations, and planning should remain consistent representations of the same trip.
2. Travel continuity matters: Béa should remain useful from initial planning through the live trip rather than ending at itinerary generation.
3. Reduce travel-management fragmentation: users should not have to repeatedly reconstruct the same trip context across disconnected tools or screens.
4. Mobile travel use is a first-class context: active-trip information should be compact, legible, and easy to act on while moving.
5. Preserve user trust: distinguish known trip data from suggestions and never invent bookings, evidence, or travel facts.
