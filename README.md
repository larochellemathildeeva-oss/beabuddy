# Béa

Build a production-ready mobile-first application called Atlas.

Atlas is not primarily a trip planner.

Atlas is a Travel Operating System and Personal Travel Memory Vault.

The core mission is:

"Remember everywhere you've been, organize everywhere you want to go, never lose a recommendation again, and surface opportunities when they become relevant."

The application should support both solo travelers and collaborative group travel.

--------------------------------------------------

DESIGN REQUIREMENTS

--------------------------------------------------

Design Style:

- Apple-quality user experience

- Premium modern appearance

- Highly visual

- Clean minimalist interface

- Dark mode and light mode

- Mobile-first design

- Responsive for web and tablet

- Smooth animations

- Map-centric experience

Main navigation:

1. Home

2. World

3. Trips

4. Recommendations

5. Opportunities

6. Profile

--------------------------------------------------

AUTHENTICATION

--------------------------------------------------

Provide:

- Email/password signup

- Google sign in

- Apple sign in

- User profiles

User profiles contain:

- Name

- Profile image

- Home city

- Travel statistics

- Travel preferences

--------------------------------------------------

WORLD TAB

--------------------------------------------------

This is the flagship feature.

Create an interactive globe experience.

Requirements:

- Rotatable world globe

- Zoom in and out

- Click countries

- Click cities

- Highlight visited places

- Highlight wishlist places

- Highlight recommendation locations

Clicking a city opens:

- Photos

- Hotels

- Restaurants

- Attractions

- Recommendations

- Notes

- Future Me Notes

- Next Time Pins

- Budget information

--------------------------------------------------

PHOTO MEMORY SYSTEM

--------------------------------------------------

Connect to photo libraries.

Requirements:

- Read GPS metadata

- Automatically determine cities and countries

- Auto-group photos by location

- Auto-group photos by trip dates

Each city becomes a travel memory page.

Store:

- Photos

- Trip dates

- Notes

- Favorite moments

--------------------------------------------------

PIN SYSTEM

--------------------------------------------------

Support four pin types.

VISITED PINS (Blue)

Fields:

- Name

- Notes

- Date visited

- Photos

- Rating

- Would Return

NEXT TIME PINS (Green)

Purpose:

Store activities, attractions, restaurants and experiences users want to do on their next visit.

Fields:

- Title

- Notes

- Priority

- Category

WISHLIST PINS (Yellow)

Purpose:

Places users want to visit someday.

Fields:

- Location

- Notes

- Priority

RECOMMENDATION PINS (Purple)

Purpose:

Recommendations from friends, social media, blogs or websites.

Fields:

- Name

- Location

- Category

- Recommended By

- Source

- Notes

- Date Added

--------------------------------------------------

RECOMMENDATION VAULT

--------------------------------------------------

Create a recommendation database.

Users can save recommendations through:

1. Manual entry

2. URL sharing

3. Screenshot upload

4. Voice notes

When importing recommendations:

Attempt to extract:

- Business name

- Address

- Category

- GPS coordinates

- Website

Each recommendation stores:

- Name

- Location

- Coordinates

- Category

- Notes

- Source URL

- Recommended By

- Date Saved

- Priority

Allow filtering by:

- Country

- City

- Category

- Source

--------------------------------------------------

SMART RECOMMENDATION REMINDERS

--------------------------------------------------

This is a core feature.

Use location services.

When a user is near:

- Saved recommendation

- Wishlist item

- Next Time pin

- Favorite location

generate notifications.

Example:

"You are 200m from a recommendation saved in 2026."

Notification displays:

- Recommendation name

- Distance

- Who recommended it

- Original note

Users can configure:

- Alert distance

- Alert frequency

Create an Opportunities Near Me screen.

--------------------------------------------------

TRAVEL OPPORTUNITY ENGINE

--------------------------------------------------

Create an Opportunities section.

Show:

- Nearby saved recommendations

- Nearby wishlist items

- Nearby Next Time pins

- Nearby favorite places

Display:

Title

Distance

Reason it is relevant

Examples:

"Saved by Sarah"

"Added 2 years ago"

"Never visited"

"High Priority"

Prioritize opportunities by relevance.

--------------------------------------------------

FUTURE ME NOTES

--------------------------------------------------

Allow users to leave notes for future trips.

Examples:

- Stay near this station next time

- Skip hotel breakfast

- Book tickets two weeks ahead

- Avoid this tourist trap

When a user revisits a city, automatically surface previous Future Me Notes.

--------------------------------------------------

TRAVEL DOCUMENT VAULT

--------------------------------------------------

Create secure storage for trip-useful documents:

- Reservations

- Tickets

- Booking confirmations

- Boarding passes

- Other confirmations useful during a trip

(Not intended for identity documents such as passports or visas.)

Security:

- Encryption

- Biometric authentication

- Passcode protection

--------------------------------------------------

TRIP FOLDERS

--------------------------------------------------

Each trip contains:

- Reservations

- Documents

- Photos

- Notes

- Budget

- Pins

- Recommendations

Everything should be automatically organized.

--------------------------------------------------

TRAVEL TIMELINE

--------------------------------------------------

Create an interactive timeline showing:

- Flights

- Hotels

- Activities

- Restaurants

- Attractions

Display chronologically.

--------------------------------------------------

TRAVEL DEBRIEF

--------------------------------------------------

When a trip ends, ask:

- Best meal?

- Best activity?

- Biggest mistake?

- Biggest surprise?

- Would you return?

Save answers permanently.

--------------------------------------------------

TRAVEL STATISTICS

--------------------------------------------------

Display:

- Countries visited

- Cities visited

- Trips completed

- Restaurants visited

- Attractions visited

- Photos stored

- Days traveled

--------------------------------------------------

TRAVEL HEATMAP

--------------------------------------------------

Create a heatmap view.

Countries become darker according to:

- Number of visits

- Days spent

- Photos taken

--------------------------------------------------

TRAVEL STORY PLAYBACK

--------------------------------------------------

Generate an animated travel story.

Show:

- Routes traveled

- Cities visited

- Photos appearing on the route

- Major trip milestones

Allow export as a shareable video.

--------------------------------------------------

PERSONAL PREFERENCE ENGINE

--------------------------------------------------

Track interests such as:

- Restaurants

- Coffee shops

- Museums

- Hiking

- Beaches

- Luxury travel

- Local experiences

Use preferences to improve Opportunities recommendations.

--------------------------------------------------

COLLABORATIVE TRAVEL

--------------------------------------------------

Allow users to invite friends to trips.

Features:

- Real-time collaboration

- Live updates

- Shared itineraries

- Shared recommendations

- Shared wishlist locations

- Shared Next Time pins

Users can:

- Add recommendations

- Add restaurants

- Add attractions

- Comment

- React

- Edit trip plans

Display live presence indicators.

Example:

"Sarah is currently editing Tokyo itinerary."

Sync changes instantly.

--------------------------------------------------

OFFLINE MODE

--------------------------------------------------

Allow users to download:

- Maps

- Photos

- Recommendations

- Itineraries

- Documents

for offline use.

--------------------------------------------------

TECHNICAL REQUIREMENTS

--------------------------------------------------

Use a scalable architecture.

Provide:

- Authentication

- Database

- Storage

- Notifications

- Real-time collaboration

- Geolocation support

- Map integration

Ensure all data is attached to user accounts.

Support code export.

Support GitHub integration.

--------------------------------------------------

PRODUCT POSITIONING

--------------------------------------------------

This app is NOT a booking platform.

This app is NOT another itinerary planner.

This app is a lifelong personal travel operating system that combines:

- Travel memories

- Recommendations

- Future planning

- Location-based reminders

- Trip collaboration

- Travel knowledge management

The most important user experience is:

A recommendation can be saved once and years later, when the user is near that location, Atlas remembers it and surfaces it automatically.

Call the app Béa

## Development

Requirements: You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
