/**
 * The prompt a traveller copies from Help into whatever assistant they use,
 * so the plan it writes comes back in the shape Béa reads without a model.
 *
 * Where the map is in another script, the name also comes in that script in
 * brackets: the map there often knows a place only by its local name, and
 * the lookups search each name on its own (`placeQueryParts`).
 *
 * Every rule here matches the line reader in `plan-lines.ts`: one stop per
 * line, a 24-hour time first, the street address after a comma (searched
 * before the name, so the pin lands), notes after " — ". Only an address
 * starting with a number is read as one, so a park or neighbourhood gives
 * none rather than leaving a street in its title. Getting-there tips go in
 * brackets, because words like "metro" after the dash would make the stop
 * read as transport. The words it forbids are the ones that send a plan to
 * the model instead ("skip", "instead", "tickets" …). A plan of one or two
 * stops still goes to the model — the reader wants three before it trusts a
 * list — and the model reads this same format.
 *
 * Each day heading names its town, and a travel day names both ends
 * ("Paris, France → Lyon, France"), so a trip through several cities or
 * countries is looked up town by town rather than all in the first one.
 * Flights, trains between towns and hotel check-ins get lines of their own:
 * they are the fixed points of a day, the plans still to book, and where a
 * day starts. Food tips ride in the note, which the reader keeps.
 *
 * The example is tested against `readPlainPlan`, so if the reader changes
 * and this stops fitting it, the test says so.
 */

export const AI_PLAN_EXAMPLE = `Day 1 — 2026-10-12 — Paris, France
09:00 Breakfast at Café de Flore, 172 Boulevard Saint-Germain — try the hot chocolate
10:00–12:00 Musée d'Orsay, 1 Rue de la Légion d'Honneur — book ahead
12:30 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre — cheap classic bistro; order the steak frites
15:00 Check in at Hôtel des Grands Boulevards, 17 Boulevard Poissonnière
Day 2 — 2026-10-13 — Paris, France → Lyon, France
08:30 Walk in Jardin du Luxembourg (getting there: metro line 4, 15 min)
11:00 Train from Paris Gare de Lyon to Lyon Part-Dieu — book ahead
13:30 Check in at Hôtel Carlton Lyon, 4 Rue Jussieu
19:30 Dinner at Daniel et Denise Saint-Jean, 36 Rue Tramassac — Lyon bouchon; try the quenelles`;

export const AI_PLAN_PROMPT = `Write my itinerary for [CITIES OR COUNTRIES] from [START DATE] to [END DATE]. [Where I fly in from and out to.] [What I'd like to do.]

Give ONLY the itinerary, in this exact format. No intro, no tips, no summary, no other lines.

Day 1 — YYYY-MM-DD — City, Country
HH:MM Place name, street number and street — short note
HH:MM–HH:MM Place name, street number and street — short note

Rules:
1. Every day starts with its heading: "Day N — YYYY-MM-DD — City, Country", naming the town you are in that day. On a day you move to another town, name both, in order: "Day 4 — YYYY-MM-DD — Paris, France → Lyon, France". The same on the day you fly in or out: the town you fly from comes first.
2. One line = one place. If an activity covers two places (for example "walk through a park and a neighbourhood"), write two lines, each with its own time.
3. Every line starts with a 24-hour time (09:00, 14:30). Times go up within each day. Write HH:MM–HH:MM when you know the end time.
4. After the time, write the place's real, official name as it appears on a map. For meals: "Lunch at [restaurant name], [address]". In a country that writes in another script (Japan, China, Korea, Thailand, Greece, Russia, the Arab world…), add the name as written locally in brackets right after it: "Kuromon Market (黒門市場), 2-4-1 Nipponbashi".
5. After a comma, give the real street address, starting with the number. A park, neighbourhood or other place with no street number gets no address: write just its name. Never invent an address; if you are not sure, leave it out.
6. Flights, trains between towns and hotels get their own lines, written exactly like this:
   "HH:MM Flight [airline and number] from [airport name] Airport to [airport name] Airport"
   "HH:MM Arrive at [airport name] Airport"
   "HH:MM Train from [station name] to [station name]" (the same for a bus, coach or ferry between towns)
   "HH:MM Check in at [hotel name], [address]" — on the first day in each town.
7. No other travel lines. Never write "Walk to…", "Take the metro to…" or "A → B" for getting around town. To say how to get somewhere, add it in brackets at the end of the next place's line: "(getting there: metro line 2, 10 min)".
8. Never join two places on one line with "/", "+", "and" or "&".
9. Anything extra goes after " — " (space, long dash, space) on the same line: for food, what to order or what the place is known for; "book ahead" when a place, train or hotel needs booking. A tip about the whole day goes on that day's first line. Never write a note, tip or "Note:" on a line of its own. Keep each line under 150 characters.
10. Add "booked" at the end of a line only if it really is booked.
11. Do not use the words skip, instead, actually, cancel, tickets, seats, pass, reservation or paid.
12. Every place must really exist and be open at that time. If you are not sure a place exists, choose one you are sure of.

Example:
${AI_PLAN_EXAMPLE}`;
