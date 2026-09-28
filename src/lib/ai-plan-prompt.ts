/**
 * The prompt a traveller copies from Help into whatever assistant they use,
 * so the plan it writes comes back in the shape Béa reads without a model.
 *
 * Every rule here matches the line reader in `plan-lines.ts`: one stop per
 * line, a 24-hour time first, the street address after a comma (searched
 * before the name, so the pin lands), notes after " — ". Getting-there tips
 * go in brackets, because words like "metro" after the dash would make the
 * stop read as transport. The words it forbids are the ones that send a
 * plan to the model instead ("skip", "instead", "tickets" …).
 *
 * The example is tested against `readPlainPlan`, so if the reader changes
 * and this stops fitting it, the test says so.
 */

export const AI_PLAN_EXAMPLE = `Day 1 — 2026-10-12
09:00 Breakfast at Café Olimpico, 124 Rue Saint-Viateur O
10:00–11:30 Walk in Parc Jeanne-Mance, 4422 Avenue de l'Esplanade — up to the Cartier monument
11:45 Walk in Mile End, Rue Saint-Viateur O — bagels, murals, bookshops
13:00 Lunch at Schwartz's Deli, 3895 Boulevard Saint-Laurent (getting there: metro line 2, 10 min)`;

export const AI_PLAN_PROMPT = `Write my itinerary for [CITY] from [START DATE] to [END DATE]. [What I'd like to do.]

Give ONLY the itinerary, in this exact format. No intro, no tips, no summary, no other lines.

Day 1 — YYYY-MM-DD
HH:MM Place name, street number and street — short note
HH:MM–HH:MM Place name, street number and street — short note

Rules:
1. One line = one place. If an activity covers two places (for example "walk through a park and a neighbourhood"), write two lines, each with its own time.
2. Every line starts with a 24-hour time (09:00, 14:30). Times go up within each day. Write HH:MM–HH:MM when you know the end time.
3. After the time, write the place's real, official name as it appears on a map. For meals: "Lunch at [restaurant name], [address]".
4. After a comma, give the real street address, starting with the number. For a park or neighbourhood with no number, give its main street or entrance. Never invent an address; if you are not sure, leave it out.
5. No travel lines. Never write "Walk to…", "Take the metro to…", "Travel to…" or "A → B". To say how to get somewhere, add it in brackets at the end of the next place's line: "(getting there: metro line 2, 10 min)".
6. Never join two places on one line with "/", "+", "and" or "&".
7. Anything extra goes after " — " (space, long dash, space) on the same line. Keep each line under 150 characters.
8. Add "booked" at the end of a line only if it really is booked.
9. Do not use the words skip, instead, actually, cancel, tickets, seats or paid.
10. Every place must really exist and be open at that time. If you are not sure a place exists, choose one you are sure of.

Example:
${AI_PLAN_EXAMPLE}`;
