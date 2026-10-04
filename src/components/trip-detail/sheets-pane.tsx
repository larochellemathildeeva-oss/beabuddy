import { Bookmark, Check, MapPin, Plus } from "@/components/icons";
import { TripStops } from "@/components/TripStops";
import { Sheet } from "@/components/Sheet";
import { ItineraryImport } from "@/components/ItineraryImport";
import { toast } from "sonner";
import { tripPlaceFromTowns } from "@/lib/plan-cities";
import { SavedPlacesSheet } from "@/components/day/SavedPlacesSheet";
import type { TripDetailCtx } from "./ctx";

export function TripSheetsPane({ td }: { td: TripDetailCtx }) {
  return (
    <>
      <Sheet
        open={td.addOpen}
        onClose={() => td.setAddOpen(false)}
        title="Add to this trip"
        width="sm"
      >
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              td.setAddOpen(false);
              td.setPerspective("timeline");
              td.setTimelineOpen(true);
              td.setAddDay(td.addToDay ?? "");
              td.setAddingTimeline(true);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <Plus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">A stop on the itinerary</span>
              <span className="block text-[12px] text-muted-foreground">
                A place, meal or activity, in the Timeline.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              td.setAddOpen(false);
              td.setSavedOpen(true);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <Bookmark className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">From Saved</span>
              <span className="block text-[12px] text-muted-foreground">
                A place you kept, with its address and map pin.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              td.setAddOpen(false);
              td.setCitySignal((n) => n + 1);
            }}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-elevated"
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">Another city or location</span>
              <span className="block text-[12px] text-muted-foreground">
                Add a city to the trip's route.
              </span>
            </span>
          </button>
        </div>
      </Sheet>

      <TripStops
        tripId={td.trip.id}
        uid={td.me.id}
        openSignal={td.citySignal}
        formOnly
        home={td.trip}
      />

      <SavedPlacesSheet
        open={td.savedOpen}
        onClose={() => td.setSavedOpen(false)}
        city={td.trip.city}
        dayLabel={td.addToDayLabel}
        onAdd={async (place) => {
          await td.board.addItem({
            kind: /food|café|cafe|restaurant|bar|bakery|meal/i.test(place.category ?? "")
              ? "meal"
              : "activity",
            title: place.name,
            ...(td.addToDay ? { day_date: td.addToDay } : {}),
            ...(place.address ? { address: place.address } : {}),
            ...(place.lat != null ? { lat: place.lat } : {}),
            ...(place.lon != null ? { lon: place.lon } : {}),
          });
          toast.success(`${place.name} added${td.addToDayLabel ? ` to ${td.addToDayLabel}` : ""}`);
        }}
      />

      <ItineraryImport
        open={td.plannerOpen}
        onClose={() => {
          td.setPlannerOpen(false);
          td.setPlannerAsk("");
          td.setOptimizePreset(null);
        }}
        optimizePreset={td.optimizePreset}
        tripPreferences={td.tripPrefs.list}
        travel={td.travel}
        defaultTab={td.plannerTab}
        initialAsk={td.plannerAsk}
        existingItems={td.stopItems.map((item) => ({
          id: item.id,
          day_date: item.day_date,
          time_label: item.time_label,
          kind: item.kind,
          title: item.title,
          detail: item.detail,
          address: item.address,
          lat: item.lat,
          lon: item.lon,
          planned_stay_minutes: item.planned_stay_minutes,
        }))}
        cities={td.fullRoute.map((stop) => ({
          city: stop.city,
          kind: stop.kind,
          country: stop.country || null,
          arrive_on: stop.arrive_on || null,
          depart_on: stop.depart_on || null,
          lat: stop.lat,
          lon: stop.lon,
        }))}
        planCities={td.routeCities}
        {...(td.chosenCity ? { defaultPlanCity: td.chosenCity.id } : {})}
        {...(td.trip.city || td.trip.country
          ? { tripCity: [td.trip.city, td.trip.country].filter(Boolean).join(", ") }
          : {})}
        tripTitle={td.trip.title}
        {...(td.trip.start_date ? { startDate: td.trip.start_date } : {})}
        {...(td.trip.end_date ? { endDate: td.trip.end_date } : {})}
        onAddItems={td.board.addItems}
        onRemoveItems={td.board.removeItems}
        onAddDirections={td.setDirectionsFor}
        onAddCosts={async (items) => {
          if (!td.trip.budget_enabled) await td.onUpdate({ budget_enabled: true });
          await td.budget.addItems(items);
        }}
        onApplySchedule={async (updates) => {
          // What the optimiser is about to move, as it is now, so Undo can
          // put every stop back on its own day, time and place in the list.
          const previous = updates.flatMap((u) => {
            const row = td.board.items.find((item) => item.id === u.id);
            return row
              ? [
                  {
                    id: row.id,
                    day_date: row.day_date,
                    time_label: row.time_label,
                    position: row.position,
                  },
                ]
              : [];
          });
          await td.board.applySchedule(updates);
          toast("New order saved", {
            description: `${updates.length} ${updates.length === 1 ? "stop" : "stops"} rearranged.`,
            duration: 8000,
            action: {
              label: "Undo",
              onClick: () =>
                void td.board.applySchedule(previous).then(
                  () => toast.success("Back to the previous order"),
                  () => toast.error("Couldn't undo that. Check your connection."),
                ),
            },
          });
        }}
        onApplyDates={async (dates) => {
          await td.onUpdate(dates);
        }}
        onAddCities={async (list, plan) => {
          if (list.length > 0) await td.cities.addStops(list);
          // A trip with no starting city takes the plan's first town.
          const place = tripPlaceFromTowns(td.trip, plan.towns, plan.country);
          if (place) await td.onUpdate(place);
        }}
      />
    </>
  );
}
