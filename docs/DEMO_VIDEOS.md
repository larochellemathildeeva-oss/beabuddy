# In-app videos — production plan

Internal. This covers the films people see **inside** Béa: a short welcome film,
a five-minute walkthrough, and nine short clips in Help. The 90-second launch
film for the site and stores is a separate piece, in `LAUNCH_VIDEO.md`. The two
share a palette and a story, but not a job.

The plan began as a suggestion from ChatGPT: a welcome film, a full walkthrough
and 5–8 short clips. That structure is kept. Its script was not, for the
reasons in the next section.

---

## What changed from the suggestion, and why

**1. It sold Béa as an AI planner.** Lines like "Béa quickly understanding a
trip", "Béa takes care of the messy bits" and a chapter on "how Béa's AI
interactions work" are the position `BRANDING.md` rules out: _never lead with
"AI travel planner."_ Béa's story is **Past You captures → Present You decides
→ Future You benefits**. The traveller is the clever one and Béa is the
diligent one. Every film below keeps to that.

**2. It named features Béa does not have, or has under other names.** ChatGPT
has never seen the app. The table below maps each of its topics to the real
thing. Anything with no real feature behind it is cut.

| Suggested topic             | What Béa actually has                                                                                             | Where it is filmed |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| Creating / importing a trip | Trips → Start a trip; Let Béa plan → Build or Import (photo, PDF, link, pasted text, calendar file)               | Clip 3             |
| Trip dashboard              | The trip page: Companion, Map and Timeline Editor, plus the To do and Settings buttons                            | Clips 3, 4, 6      |
| Timeline                    | Timeline Editor: cards that flip over, swipe to mark done, Edit mode                                              | Clip 4             |
| Map                         | The day map: Split and Focus layouts, numbered pins, directions kept on the phone                                 | Clip 4             |
| Bookings                    | A stop's booking (ticket button, "Booked" badge, reference), the Document Vault, the Calendar page                | Clips 4, 8         |
| Explore Nearby              | **Near you** on Home (your own saves sorted by distance), and **Pin something nearby** on Recs                    | Clips 1, 7         |
| Recommendations             | **Recs** is your own vault of places people told you about. Béa does not hand out outside recommendations         | Clip 1             |
| Saving places               | Recs: one field for a name or a link, and the + menu                                                              | Clip 1             |
| Editing a trip              | Trip Settings (name, place, dates, Tentative / Confirmed); Timeline Editor for stops                              | Clips 3, 4         |
| To-do and packing           | The **To do** sheet: To do and Packing, side by side                                                              | Clip 8             |
| How Béa's AI works          | **Ask Béa** (the page sparkle explains a screen) vs **Let Béa plan** (the trip sparkle), and what she will not do | Clips 3, 5         |

**3. The ending line.** "Your whole trip, one place. Béa takes care of the
messy bits." is replaced by the mission line, word for word: _Béa remembers
your travel life so Future You doesn't miss what matters._ Béa is about a
travel **life**, not one trip.

**4. What was right and is kept:** two films with different jobs, short clips
for the feature someone forgot, a slower literal tone for teaching, one motion
language across all of it, and Béa used sparingly.

---

## The package

| #   | Film                         | Length | Plays where                                                       | Variable                     |
| --- | ---------------------------- | ------ | ----------------------------------------------------------------- | ---------------------------- |
| —   | Welcome film                 | ~40 s  | First card of the welcome tour, the Replay chooser, How Béa works | `VITE_DEMO_VIDEO_URL`        |
| —   | Béa in five minutes          | ~5 min | Top of Help → Watch how it's done                                 | `VITE_WALKTHROUGH_VIDEO_URL` |
| 1   | Save a place                 | ~60 s  | Help                                                              | `VITE_CLIP_SAVE_URL`         |
| 2   | Your globe                   | ~60 s  | Help                                                              | `VITE_CLIP_WORLD_URL`        |
| 3   | Start a trip                 | ~60 s  | Help                                                              | `VITE_CLIP_PLAN_URL`         |
| 4   | The timeline and the map     | ~60 s  | Help                                                              | `VITE_CLIP_DAY_URL`          |
| 5   | Optimize and Compare         | ~45 s  | Help                                                              | `VITE_CLIP_OPTIMIZE_URL`     |
| 6   | On the day                   | ~45 s  | Help                                                              | `VITE_CLIP_COMPANION_URL`    |
| 7   | Near you                     | ~45 s  | Help                                                              | `VITE_CLIP_NEAR_URL`         |
| 8   | To do, packing and documents | ~60 s  | Help                                                              | `VITE_CLIP_PREP_URL`         |
| 9   | Photos and memories          | ~60 s  | Help                                                              | `VITE_CLIP_MEMORIES_URL`     |

Nine clips, not 5–8. Fewer would leave whole parts of the app (the on-the-day
Companion, the memory side) without a film. Each one is optional, so any can
ship first.

**Make the walkthrough last, from the clips.** It is clips 1–9 in order, with
a two-second chapter card between each one and a short opening and close. One
recording session serves both. When the app changes, you re-record one clip and
re-cut the walkthrough, instead of shooting five minutes again.

The titles, one-line descriptions and lengths shown in the app live in
`DEMO_VIDEOS` in `src/lib/demo-video.ts`. If a finished clip runs much longer
or shorter than planned, change its `length` there.

---

## Rules for every film

### Positioning

- Béa is **where your travel life lives**. She is not a trip generator, a
  booking app or a map app.
- She **remembers and assembles**. The traveller **decides**. Show the moment
  the person chooses (ticks the places, approves the new order) every time.
- Never say "AI travel planner". Never show brain or neural-network imagery.
- **Béa does not book anything**, and she does not check availability. Never
  show a booking being made. A booking in Béa is a reference you typed in
  yourself.
- **Béa is not a no-signal app.** She needs a connection to open. **Keep on
  this phone** keeps saved directions and the map around each day's stops, so a
  day map that is **already open** keeps working when the signal drops. Never
  imply more than that.
- Privacy wording matches `AGENTS.md`: _designed to, private by default, may_.
  No "100% private" or "we never see anything".

### Béa herself

- **She is a small French bulldog**, a head-on portrait. Use the real artwork.
  The redrawn version with paws and a flapping bandana was worse, and it is not
  the Béa people meet in the app.
- **Third person, always.** "Béa is sniffing out hidden gems", never "I'm
  sniffing out hidden gems". A test fails any rotating line in first person,
  and the films follow the same rule.
- **She appears only at her real moments**: saving, empty screens, Near,
  finishing a plan, and the waits (placing stops, building a trip, comparing
  places, importing photos). Everywhere else the interface speaks plainly.
- **Her dog vocabulary** is playful and often literally true, because she
  really does look places up one a second: _sniffing out · following the scent
  · on the trail · nose down · scouting ahead · one more corner · little legs ·
  tiny legs, big thoughts._
- **Quote her real lines.** Every caption in her voice below comes from
  `src/lib/bea-voice.ts`. Do not write new jokes for the film. If a line is
  worth having, add it to the pool first so the app says it too.

### Look

- Warm cream `#F9F2E7`, near-white cards `#FFFEFB`, ink `#2A1D16`, terracotta
  `#B74111`, sand `#EEDBC6`. Night: `#17100C` with `#F27E46`.
- Instrument Serif for headlines and captions, Manrope for interface text.
- **No blue or teal**, including map water tinted by an editor.
- The app has a night appearance (black and light grey). Shoot everything in
  the day look. Clip 9 may end at night, because Playback is the evening
  moment.

### Format

- **16:9.** The in-app player is a 16:9 frame (`aspect-video` in
  `DemoVideo.tsx`). Put the phone recording in the centre and the captions
  beside it on wide screens. On a phone, captions go above and below.
- **Captions are burned in** and carry the meaning. The player never
  autoplays, and many people will watch with the sound off. A voice-over is
  optional, and if there is one it reads the captions.
- **Pace.** The welcome film cuts on the beat. The clips are slow and literal:
  show the finger, show the tap, hold on what changed for a full second, then
  caption it. No zoom-punches, no whooshes.
- **Music.** Warm and quiet. No stings on the Near moment. It is a small, good
  moment, not a win.

---

## Setting up the recording

### Account and data

1. Use a **fresh demo account**, never a personal one. Screen recordings show
   everything.
2. On Home (or You), tap **Load sample travel data**. It gives you:
   - **Paris in spring**, upcoming in three weeks: arrival at CDG, Musée
     d'Orsay, Café de Flore, a Canal Saint-Martin picnic.
   - **Tokyo cherry season**, three months out: Shimokitazawa, Tsukiji outer
     market, TeamLab Planets.
   - **Lisbon long weekend**, forty days ago: Alfama, Time Out Market, Belém,
     LX Factory.
   - Saved places with real names and people: Time Out Market (Sofia), LX
     Factory (Miguel), Pastéis de Belém (Ana), Café de Flore (Claire),
     Shimokitazawa record shops (Ken), and more in Barcelona, New York and
     elsewhere.
   - Future Me notes: _"Next time: tram 28 at dawn, before it fills with
     tourists."_ (Lisbon), _"Buy museum pass on day one; Orsay before lunch."_
     (Paris), _"Stay in Shimokitazawa one night — quieter than Shibuya."_
     (Tokyo).
   - Visited cities across the globe, for the World tab.
3. Fill in **You → Travel preferences** before recording clips 3 and 5.
   Planning reads them.

### Things the sample data does not cover

- **Companion (clip 6)** only appears on a trip that is under way. Make a short
  trip dated **today** (a copy of the Paris stops is fine), with clock times on
  the stops. On its timeline, tap **Get directions**, then **Keep on this
  phone**, so **Leave by** has a real journey time straight away.
- **Near (clip 7)** needs a location. In a desktop browser, set a fake location
  near **Café A Brasileira in Lisbon** (about 38.7107, -9.1424) in the
  developer tools' sensors panel. Several Lisbon saves are then a short walk
  away.
- **Photos (clip 9)** needs a set of travel photos that still carry their GPS
  data. Use your own, or a set you have the rights to. Faces are fine but not
  needed.
- **A shared trip (clip 3)** needs a second demo account to join with the
  invite code.

### Deploy

Record on the real Canner deploy with its keys set. The Geoapify key draws the
journal-style vector map, stop hours and place photos. The Gemini key runs
planning and Compare. Without them the map falls back to image tiles and some
clips cannot be shot.

### Capture

- A phone-sized browser window (390 × 844) or a real phone. Keep one device
  for the whole package.
- Turn on the device's tap indicators.
- Hide the notification bar, clock and battery, or set them to something
  neutral.
- Blank out or crop **invite codes** and **share codes** before publishing.
  They are real for up to seven or thirty days.

---

## The welcome film (~40 s)

**Job:** make a new traveller feel what Béa is for in forty seconds, then get
out of the way. It is offered on the first card of the welcome tour as **Watch
the film first**, beside **Next**, which walks the real screens. It never
autoplays.

**Tone:** the launch film in miniature. Warm, quick, a little witty. Very
little instruction.

| Time    | Picture                                                                                                                         | Caption                                                                   | Source                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| 0–4 s   | Béa's portrait fades in on cream. A small map pin lands beside her.                                                             | _Your travel life, all in one place._                                     | Real artwork, motion graphics                      |
| 4–9 s   | Fragments drift across the frame: a friend's text, a screenshot of a café, a link in a group chat. They scatter.                | _You already found the good places._                                      | Motion graphics or Veo (`LAUNCH_VIDEO.md` scene 1) |
| 9–15 s  | Recs: a link is pasted, places appear, a finger ticks three. Toast: **"Saved." / "Future You has excellent taste."**            | _Keep who told you._                                                      | Screen recording                                   |
| 15–21 s | World: the globe turns to Lisbon. Four colours of pin.                                                                          | _Where you've been, and where you're going next._                         | Screen recording                                   |
| 21–28 s | Paris trip: a saved place drops onto a day, the map draws the day. Béa runs on the spot: **"Béa is sniffing out hidden gems…"** | _Professionally assembled from your own excellent ideas._                 | Screen recording                                   |
| 28–34 s | Home, out walking: Near you shows Café A Brasileira, 180 m.                                                                     | _Past You left a breadcrumb._                                             | Screen recording, with an optional street shot     |
| 34–40 s | Béa's portrait again, on cream.                                                                                                 | _Béa remembers your travel life so Future You doesn't miss what matters._ | Real artwork                                       |

No button in the film. The tour's own **Next** is the call to action.

---

## Béa in five minutes

Clips 1–9 in order. Between each, a two-second chapter card: cream, the clip's
title in Instrument Serif, and its number.

- **Open (8 s):** Béa's portrait. _"Five minutes, nine things. Skip to any one
  of them."_
- **Close (8 s):** _"Forgot one? Every clip is in Help, one at a time."_ Then
  the mission line.

If it is hosted on YouTube, add chapter timestamps in the description (0:00
Open, then one per clip) so the player shows chapters.

---

## The clips

Each clip is slow and literal: one task, start to finish, in the real app.
Captions are plain and descriptive. Béa's voice appears only where the app
itself uses it.

Every clip opens on its title card (1.5 s) and ends on the same last frame:
the finished result, held for two seconds, with the caption _"Tap Ask Béa (the
sparkle) on any page for a walk around that screen."_ That line teaches the one
habit that helps with everything else.

### 1. Save a place (~60 s)

**What you'll know afterwards:** how to keep any tip, and how to find it again.

| #   | On screen                                                                                                                                      | Caption                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Recs tab. Type "Pastéis de Belém". Suggestions appear as you pause.                                                                            | _Type a name. Béa looks it up._                     |
| 2   | Tap the row, not Save. The details card opens.                                                                                                 | _Tap the row to add the details first._             |
| 3   | Fill in **Who told you**: Ana. Add a note. Béa's guessed travel tags are already there.                                                        | _Keep who told you, and why._                       |
| 4   | Save. Toast: **"Recommendation secured."** / _"A gift from Present You to Future You."_                                                        | — (Béa's line is the caption)                       |
| 5   | Paste a Google Maps link into the same field. Béa reads it and shows the draft.                                                                | _Or paste a link: Maps, Instagram, a blog._         |
| 6   | Open the **+**. Pan slowly over the menu: From my trips, I'm here now, By hand, Paste a list, Send places, Open a share, Pin something nearby. | _The + holds every other way in._                   |
| 7   | **Paste a list**: paste five names from a notes app. Béa looks each one up and shows the list to edit before anything is saved.                | _Paste a whole list. You check it before it saves._ |
| 8   | Search the vault for "pasteis", no accent. It finds Pastéis de Belém.                                                                          | _Typos and missing accents still match._            |
| 9   | Tap the Lisbon city chip, then a kind chip.                                                                                                    | _Filter by city, or by kind._                       |
| 10  | **+ → Send places**: tick three and make a code. Crop the code.                                                                                | _Send a few to a friend. They never see the rest._  |

**Show these details:** a place already in the vault is flagged before it is
saved twice. **Remove** gives an Undo. **Pick the exact spot** fixes a pin Béa
missed.

**Never say:** that Béa recommends places to you. The vault is yours.

### 2. Your globe (~60 s)

**What you'll know afterwards:** how to fill in where you've been, and how Béa
helps you choose where next.

| #   | On screen                                                                                                                                                                              | Caption                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | World tab. Drag to spin the globe. Pinch to zoom.                                                                                                                                      | _Everywhere you've been, on one globe._                |
| 2   | Zoom to Europe: visited countries shaded, provinces inside them, a dot per city.                                                                                                       | _Countries, the regions inside them, and your cities._ |
| 3   | The chips above the globe hide and show the four pin types: Visited, Next time, Wishlist, Recommendation.                                                                              | _Four kinds of pin. Hide any group when it gets busy._ |
| 4   | The round **+**: add "Kyoto". Then paste a short list. Béa shows the pins to confirm before anything lands.                                                                            | _Add places by hand, or paste a list from your notes._ |
| 5   | In the places list, show one saved as "日本" counted as Japan.                                                                                                                         | _Saved in another language? Still the same country._   |
| 6   | Open **Travel statistics**. Switch countries to a share of the world.                                                                                                                  | _Choose which counters to show._                       |
| 7   | **Help me choose**: tick three saved places, type "warm, cheap, a long weekend". Béa: **"Béa is weighing the options…"** / _"Extremely biased toward your preferences, as requested."_ | _Pick a few places you already saved._                 |
| 8   | The pick, with its trade-offs. **"Béa has an opinion."** / _"Confidence: grounded in what you already saved."_                                                                         | _Choosing is harder than dreaming._                    |

**Show these details:** the globe works by keyboard and screen reader, and its
colours are safe for colour-blind viewers. One card worth: _"Works with a
keyboard and a screen reader."_

**Never say:** that Help me choose searches the internet for new destinations.
It weighs only places you picked.

### 3. Start a trip (~60 s)

**What you'll know afterwards:** how to create a trip, bring someone in, and
get a first plan onto it.

| #   | On screen                                                                                                                                                                                         | Caption                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Trips → **Start a trip**. Search "Porto". Pick dates, mark them **Tentative**. Leave the budget unticked.                                                                                         | _Where and when. A name is optional._                                 |
| 2   | The trip opens. The banner is your own Porto photo if you have one, or Béa's painted dusk.                                                                                                        | _Your own photo of the place, or a painted dusk._                     |
| 3   | Settings → **People**: make an invite code (crop it). The second account types it into **Join with a code**. "Flying Solo" becomes two people.                                                    | _Invite a friend. You both edit the same plan._                       |
| 4   | Tap the trip's sparkle, **Let Béa plan**. Choose **Build**.                                                                                                                                       | _Let Béa plan starts from your saved places and preferences._         |
| 5   | Béa checks the web first. The Search note appears under the plan.                                                                                                                                 | _She checks what's on while you're there: events, closures, strikes._ |
| 6   | The wait: Béa running on the spot with a real count ("4 of 12"). Let two lines rotate: **"Béa is running as fast as she can. She has little legs."**, **"Béa is checking one more side street…"** | — (Béa's lines are the caption)                                       |
| 7   | The draft: days, stops, optional costs. Each stop shows where Béa placed it, and flags any she was unsure of.                                                                                     | _She tells you which stops she's unsure of._                          |
| 8   | Type "rainy-day activities" and tap **Ask Béa to find alternatives for these suggestions**. Then show **Rebuild my trip**.                                                                        | _Ask for alternatives, or rebuild it._                                |
| 9   | **Import** instead: drop in a PDF booking confirmation, then show that a photo, a link or a calendar file work too.                                                                               | _Already have a plan? Import it._                                     |
| 10  | Save. Toast: **"On the timeline."** / _"Professionally assembled from your own excellent ideas."_                                                                                                 | —                                                                     |

**Show these details:** a calendar file (.ics) is read directly with no AI, so
its times are exact. Costs are optional.

**Say plainly, on a card:** _Béa does not book anything or check availability.
You reserve hotels, tables and tickets yourself._

**Never say:** that Béa invented the trip. She assembled it from your saves and
your preferences.

### 4. The timeline and the map (~60 s)

**What you'll know afterwards:** how to shape a day and see it on the map.

| #   | On screen                                                                                                               | Caption                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Paris trip, **Timeline Editor**. Scroll one day.                                                                        | _The day in order._                                   |
| 2   | Tap a card: it flips over to show the note, time, place, booking and actions. **Done** flips it back.                   | _Tap a stop to turn it over._                         |
| 3   | **Add stop → from Saved**: Café de Flore drops onto Tuesday with its pin and address.                                   | _Add a stop from your saved places._                  |
| 4   | Open the ticket button on Musée d'Orsay. Mark it booked and type a reference. The **Booked** badge appears.             | _Keep the booking reference for the door._            |
| 5   | Swipe a card right: done. Swipe left: Save and Delete. Delete, then **Undo**.                                           | _Swipe to tick off. Every remove can be undone._      |
| 6   | A stop with a list inside: "2 inside". Open it and tick one off.                                                        | _A market, a museum: list what's inside it._          |
| 7   | **Map** view, **Split**: the day's timeline beside its map, numbered pins joined by a soft arc.                         | _Pins are numbered like the cards._                   |
| 8   | **Focus**: the map first, one stop's card over it. Swipe through the day and the map follows.                           | _Or the map first, one stop at a time._               |
| 9   | On the timeline, **Get directions**. **Add to timeline** puts the walks between the stops. Then **Keep on this phone**. | _Keep directions and the map on this phone._          |
| 10  | Stop card: opening hours, "looks open at 14:00", step-free access, and a Wikimedia photo with its author and licence.   | _Hours, access and a photo, when the map knows them._ |

**Show these details:** the map is in Béa's own journal colours, not a
standard street map. Distances between pins say "about", because they are
straight lines, not routes. The map credits (OpenStreetMap, Geoapify) stay in
frame. Do not crop them out.

**Caption the offline limit truthfully:** _A map that's already open keeps
working when the signal drops. Béa still needs a connection to open._

### 5. Optimize and Compare (~45 s)

**What you'll know afterwards:** how to tighten a plan without losing
anything, and how to weigh two plans.

| #   | On screen                                                                                                                                                               | Caption                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Let Béa plan → **Optimize**. The goals: Closest together, Open when you get there, Rainy-day indoor, Easy mornings, Leave a rest day, Even pace, Meals first. Tick two. | _Keep every stop. Reorder them._                                    |
| 2   | The proposal: old order beside new, and _"Getting between stops: about 3 h 10 min on foot → about 2 h 5 min."_                                                          | _See the new order before anything moves._                          |
| 3   | Approve. The timeline reshuffles.                                                                                                                                       | _You approve it. Then it saves._                                    |
| 4   | **Compare**: paste Plan A (a friend's) and Plan B (from a chatbot). Add "slow mornings, good food".                                                                     | _Two whole plans, side by side._                                    |
| 5   | Wait: **"Béa is deciding between good and better."**                                                                                                                    | —                                                                   |
| 6   | Day by day, what actually differs. The table: estimated cost, places visited, active hours, works in bad weather, walking per day.                                      | _What really differs, day by day._                                  |
| 7   | The pick, in two sentences, plus the one idea worth borrowing from the other plan.                                                                                      | _She commits to a pick. And says what to steal from the other one._ |

**Show these details:** where Béa cannot measure travel times, the row says so
rather than guessing. If one plan is shorter, its extra days read "nothing
planned". Hold on that row for a beat and caption it: _She won't invent
numbers she can't measure._

### 6. On the day (~45 s)

**What you'll know afterwards:** how Béa keeps you company during the trip.

| #   | On screen                                                  | Caption                                               |
| --- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Today's trip opens on **Companion** by itself.             | _On the trip, Béa opens on today._                    |
| 2   | The line of numbered stops, with the current one ringed.   | _Where you are in the day._                           |
| 3   | Tap **I'm here** at the first stop.                        | _Tap I'm here when you arrive._                       |
| 4   | **Leave by 10:40** appears for the next stop.              | _Leave by: the next stop's time minus the real walk._ |
| 5   | Tap **Leaving**. The track fills.                          | _Leaving moves you on._                               |
| 6   | Skip a stop. The tracker shows it as skipped, not visited. | _Skip one and it says skipped. It won't pretend._     |
| 7   | A quiet rain note for later in the afternoon.              | _A quiet word if rain is likely._                     |
| 8   | The day ribbon: filter to Afternoon.                       | _Morning, afternoon, evening._                        |

**Show this quirk on purpose:** nothing moves because the clock says it
should. Béa waits for your tap. Caption: _Nothing moves until you tap. Running
late is allowed._

**Never say:** that Béa tracks you through the day. She does not.

### 7. Near you (~45 s)

**What you'll know afterwards:** how Béa hands back what you saved, when
you're close enough to use it.

| #   | On screen                                                                                                                                      | Caption                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Home. **Near you** asks to look. Choose for how long.                                                                                          | _Béa looks only when you say so, for as long as you choose._ |
| 2   | Your saves, nearest first: Café A Brasileira, 180 m. **"Past You left a breadcrumb."** / _"You're 180 m from something Past You cared about."_ | —                                                            |
| 3   | The card: who told you, your note, one tap to directions.                                                                                      | _Who told you. What you wrote._                              |
| 4   | **Snooze** one.                                                                                                                                | _Not now? Snooze it._                                        |
| 5   | **Show all**: change the distance. Tick three. Pick a pace. **Arrange with Béa**.                                                              | _Tick a few. Béa strings them into a day._                   |
| 6   | Save as a day trip.                                                                                                                            | _Saved as a day trip. Still built from your own places._     |
| 7   | The weather tile and the "At a glance" place beside it.                                                                                        | —                                                            |

**Show the empty case too:** walk the fake location somewhere with nothing
saved. **"No breadcrumbs in range."** / _"Widen the radius, or keep
wandering."_

**Never say:** "discover places near you". Near shows only what you already
saved.

### 8. To do, packing and documents (~60 s)

**What you'll know afterwards:** where everything that isn't a place lives.

| #   | On screen                                                                                                                 | Caption                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | The trip's **To do** button. The sheet opens on **To do**.                                                                | _Everything left before you leave, in one place._  |
| 2   | **Start me off**: Béa suggests the usual errands for an international trip with flights. Keep three. Give one a due date. | _Start me off suggests the usual ones._            |
| 3   | Switch to **Packing**. Add a copy of "Weekend" from You → Packing lists. Tick things off.                                 | _Reusable packing lists. Ticks stay on this trip._ |
| 4   | Trip Settings → **Budget**: add a meal.                                                                                   | _A budget only if you want one._                   |
| 5   | **Expenses**: photograph a receipt. Béa reads the merchant and amount. Tag it to Paris.                                   | _Snap a receipt. It lands on the trip's budget._   |
| 6   | Download the spreadsheet in your home currency.                                                                           | _Every amount, converted, for your accountant._    |
| 7   | **Trip documents**: set a passcode, add a boarding pass, lock it. The list still shows its label while locked.            | _Tickets and confirmations, locked on your phone._ |
| 8   | **Calendar**: month view, tap a day.                                                                                      | _Every trip on one calendar._                      |

**Say on the Document Vault, exactly:** _Encrypted on your device. Not for
passports or visas. Forget the passcode and it may not be recoverable._

**Never say:** that the receipt export is a tax document. It isn't.

### 9. Photos and memories (~60 s)

**What you'll know afterwards:** how the memory side of Béa fills itself in.

| #   | On screen                                                                                                 | Caption                                             |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | You → Photos. The privacy note before the upload.                                                         | _Your photos stay private to your account._         |
| 2   | Choose **Locations only**, then show the other option: keep the pictures.                                 | _Keep the pictures, or only where they were taken._ |
| 3   | The wait: **"Béa is revisiting old adventures…"** / _"Reading where each photo was taken, nothing else."_ | —                                                   |
| 4   | Pins light up on the globe.                                                                               | _Years of travel, onto one map._                    |
| 5   | **City memories**: Lisbon's page, visits years apart.                                                     | _Some places become recurring characters._          |
| 6   | Leave a **Future Me** note: "Tram 28 at dawn."                                                            | _Leave a note for next time._                       |
| 7   | Home shows the note again.                                                                                | _Béa hands it back when you return._                |
| 8   | **Playback**: the cities in the order you were there, photos changing.                                    | _Let's rewind the adventure._                       |

**End on Playback, held**, then the mission line. This is the emotional close
of the walkthrough, as the map scene is for the launch film.

---

## Things every film leaves out on purpose

These are real, but they are not what anyone forgets how to do. Help's written
answers already cover them.

- Signing in, password rules, reset.
- Idle sign-out after about 45 minutes, erase all data, delete the account.
- Customize Home, the night appearance, "What is kept on this phone".
- Feedback (and its best category, _It broke and I laughed_). Worth a two-second
  cameo in the walkthrough's close, not a clip.

---

## Settle before filming

**Béa speaks in the first person on Help.** Help's welcome card says _"Hi,
I'm Béa. I remember travel things so you don't have to."_ and
`BEA_TAGLINES.companion` says the same. Both break the third-person rule in
`WHAT_BEA_BELIEVES.md`, which calls it "known, not yet resolved". The clips
live on the Help page, so a film in the third person will sit right under a
card in the first. Settle the line (for example _"Béa remembers travel things
so you don't have to."_) before recording anything that shows Help.

---

## Putting the films in the app

Each film is switched on by its own variable in Canner. They are build-time
(`VITE_`) variables, so **redeploy after setting one**. A variable left unset
shows nothing: no empty heading, no dead button.

| Variable                                        | Film                | Appears                                                                                       |
| ----------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_DEMO_VIDEO_URL`                           | Welcome film        | **Watch the film first** on the tour's first card; the Replay chooser; the How Béa works page |
| `VITE_WALKTHROUGH_VIDEO_URL`                    | Béa in five minutes | Help → Watch how it's done, first row                                                         |
| `VITE_CLIP_SAVE_URL` … `VITE_CLIP_MEMORIES_URL` | Clips 1–9           | Help → Watch how it's done, in order                                                          |

**Accepted values** (the same for every variable): an `.mp4`, `.webm`, `.ogv`
or `.mov` over https; a path the app serves itself (`/clips/near.mp4` in
`public/`); or a YouTube or Vimeo link. YouTube is played through
`youtube-nocookie.com`, so someone who never presses play is not tracked.
Anything else counts as "no video" on purpose.

**Hosting:** unlisted YouTube or Vimeo, or a CDN. Do not commit video files to
`public/`. They bloat every clone and every deploy.

**Keeping them current:** when a screen changes, re-record only its clip,
update its variable, and re-cut the walkthrough. The chapter cards make that a
splice, not a reshoot.
