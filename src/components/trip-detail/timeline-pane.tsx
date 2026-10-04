import { Fragment } from "react";
import { Check, LocateFixed, MapPin } from "@/components/icons";
import { ItineraryDirections } from "@/components/ItineraryDirections";
import { StickyDayBar } from "@/components/day/StickyDayBar";
import { SortableDay, SortableStop, type SortableBind } from "@/components/day/SortableStops";
import { dayLengthLabel, dayTitle } from "@/components/day/stop-words";
import { forgetOfflineTrip } from "@/lib/offline-trip";
import { dropMove } from "@/lib/stop-move";
import { dayTightnessNote, minutesUntilLabel, nextUp, nowDivider } from "@/lib/day-shape";
import { runLabelsByIndex, walkableRuns } from "@/lib/stop-grouping";
import { groupByArea } from "@/lib/neighbourhood";
import { toast } from "sonner";
import { isDone } from "@/lib/companion";
import { daysForMaps } from "@/lib/day-maps";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION, OVERTURE_ATTRIBUTION } from "@/lib/geo-endpoints";
import { TravelConnector, TimelineEntry } from "@/components/day/TimelineCard";
import type { TripDetailCtx } from "./ctx";
import { NowLine, RailLine, TimelineHead } from "./timeline-bits";
import { TripTimelineSheets } from "./timeline-sheets";

export function TripTimelinePane({ td }: { td: TripDetailCtx }) {
  return (
    <div hidden={td.perspective !== "timeline"}>
      {td.perspective === "timeline" &&
        td.timelineByDay &&
        td.offerDays &&
        td.stopItems.length > 0 && (
          <StickyDayBar
            chips={td.chips}
            value={td.chosenDay}
            onChange={td.setDayChoice}
            anchor={td.dayCardsRef}
            onCurrency={() => td.setCurrencyOpen(true)}
          />
        )}
      <div data-guide="trip-timeline" className="plain-card px-3 pb-3 pt-4">
        {td.editingTimeline && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-primary-soft px-3 py-2">
            <p className="text-[13px] font-semibold text-primary">Editing every stop at once</p>
            <button
              type="button"
              onClick={() => td.setEditingTimeline(false)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
            >
              <Check className="size-4" aria-hidden />
              Done editing
            </button>
          </div>
        )}

        {td.stopItems.length === 0 ? (
          <>
            <TimelineHead
              title="Your itinerary"
              line="Activities, meals, transport and notes."
              onAdd={() => {
                td.setAddDay(td.addToDay ?? "");
                td.setAddingTimeline(true);
              }}
              addLabel="Add to the timeline"
            />
            <p className="px-1 py-4 text-[14px] text-muted-foreground">
              Nothing planned yet. Add a stop, or let Béa draft the days from a plan you already
              have.
            </p>
          </>
        ) : td.timelineByDay ? (
          <div className="space-y-6">
            {td.shownGroups.map((group) => {
              const dayOpen = !td.collapsedDays[group.key];
              const isToday = group.key === td.todayKey;
              const divider = isToday ? nowDivider(group.items, td.minutesNow) : null;
              const coming = isToday ? nextUp(group.items, td.minutesNow) : null;
              const untilNext = minutesUntilLabel(coming, td.minutesNow);
              // Both read the day as written: one says where the clock
              // and the distances disagree, the other says which stops
              // are close enough that their order stops mattering.
              const tight = dayTightnessNote(group.items);
              const runLabels = runLabelsByIndex(walkableRuns(group.items));
              const visited = group.items.filter(isDone).length;
              const length = dayLengthLabel(group.items, td.travelInto);
              return (
                <section key={group.key || "undated"} data-day-key={group.key} className="min-w-0">
                  <TimelineHead
                    title={dayTitle(group.key, td.ordinalFor(group.key), group.label)}
                    line={[
                      `${group.items.length} ${group.items.length === 1 ? "stop" : "stops"}`,
                      length,
                      visited ? `${visited} visited` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    open={dayOpen}
                    onToggle={() =>
                      td.setCollapsedDays((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                    }
                    onAdd={() => {
                      td.setAddDay(group.key);
                      td.setAddingTimeline(true);
                    }}
                    addLabel={`Add something to ${group.label}`}
                    onMore={() => td.setTimelineMenuOpen(true)}
                    {...td.directionsButton}
                  >
                    {coming && (
                      <span className="mt-1 block text-[12.5px] font-semibold text-primary">
                        Next: {coming.title}
                        {untilNext ? ` · ${untilNext}` : ""}
                      </span>
                    )}
                    {/* Two numbers the plan already carries, put next to
            each other. Never a verdict on the day. */}
                    {tight && (
                      <span className="mt-1 block text-[12.5px] text-muted-foreground">
                        {tight}
                      </span>
                    )}
                  </TimelineHead>
                  {dayOpen && td.dayMaps.maps[group.key] && (
                    <details className="mb-2 rounded-2xl bg-elevated p-2">
                      <summary className="cursor-pointer px-1 text-[13px] font-semibold">
                        Map of the day · saved on this phone
                      </summary>
                      <img
                        src={td.dayMaps.maps[group.key]}
                        alt={`Map of ${group.label}, stops numbered in order`}
                        className="mt-2 w-full rounded-xl"
                      />
                      <p className="mt-1 px-1 text-[10.5px] text-muted-foreground">
                        Stops numbered in order; the line joins them, it isn't the walking route.{" "}
                        {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION} · {OVERTURE_ATTRIBUTION}
                      </p>
                    </details>
                  )}
                  {dayOpen && (
                    <ol className="relative min-w-0 space-y-1 overflow-x-hidden py-1">
                      <RailLine />
                      {td.hidingDone && group.items.every(isDone) && (
                        <li className="list-none py-2 pl-[5.25rem] text-[13px] text-muted-foreground">
                          ✓ Every stop on this day is visited.
                        </li>
                      )}
                      {td.byArea && !td.editingTimeline
                        ? groupByArea(
                            group.items.filter((item) => !(td.hidingDone && isDone(item))),
                          ).map((area) => (
                            <Fragment key={area.area}>
                              <li className="relative z-10 flex list-none items-center gap-1.5 pl-[5.25rem] pt-2 text-[12.5px] font-semibold text-muted-foreground">
                                <MapPin className="size-3.5 text-primary" aria-hidden />
                                <span>
                                  {area.area}
                                  <span className="font-normal">
                                    {` · ${area.items.length} ${area.items.length === 1 ? "stop" : "stops"}`}
                                  </span>
                                </span>
                              </li>
                              {area.items.map((item) => (
                                <TimelineEntry
                                  compact={td.compactCards && !td.editingTimeline}
                                  key={item.id}
                                  item={item}
                                  showDay={false}
                                  number={group.items.indexOf(item) + 1}
                                  onLocate={() => td.locate(item)}
                                  onSaveBooking={(patch) => td.board.updateItem(item.id, patch)}
                                  {...td.docProps(item)}
                                  onToggleDone={() => td.toggleDone(item)}
                                  {...td.withNear(item.day_date)}
                                  {...td.nestProps(item)}
                                  onEdit={(field) => td.board.setEditing(field)}
                                  onUpdate={(patch) => td.saveCard(item.id, patch)}
                                  onRemove={() => void td.removeTimelineItem(item)}
                                  tripStart={td.trip.start_date}
                                  tripEnd={td.trip.end_date}
                                  onKeep={td.keepItemAsReco}
                                  kept={td.isKept(item)}
                                  stray={td.strayIds.has(item.id)}
                                  {...td.foldProps(item)}
                                />
                              ))}
                            </Fragment>
                          ))
                        : (() => {
                            // Drag to reorder: a grip on each card, inside
                            // the day, not while editing every card at once.
                            const sortable = !td.editingTimeline && group.items.length > 1;
                            const dragging = td.draggingDay === group.key;
                            const rows = group.items.map((item, dayIndex) => {
                              if (td.hidingDone && isDone(item)) return null;
                              const entry = (bind?: SortableBind) => (
                                <TimelineEntry
                                  {...(bind ?? {})}
                                  compact={td.compactCards && !td.editingTimeline}
                                  item={item}
                                  showDay={false}
                                  number={dayIndex + 1}
                                  showSwipeHint={dayIndex === 0}
                                  onLocate={() => td.locate(item)}
                                  onSaveBooking={(patch) => td.board.updateItem(item.id, patch)}
                                  {...td.docProps(item)}
                                  onToggleDone={() => td.toggleDone(item)}
                                  editing={td.editingTimeline}
                                  {...td.withNear(item.day_date)}
                                  {...td.nestProps(item)}
                                  onEdit={(field) => td.board.setEditing(field)}
                                  onUpdate={(patch) => td.saveCard(item.id, patch)}
                                  onRemove={() => void td.removeTimelineItem(item)}
                                  {...td.moveProps(item)}
                                  tripStart={td.trip.start_date}
                                  tripEnd={td.trip.end_date}
                                  onKeep={td.keepItemAsReco}
                                  kept={td.isKept(item)}
                                  stray={td.strayIds.has(item.id)}
                                  {...td.foldProps(item)}
                                />
                              );
                              // The next stop on the list as shown, so the
                              // connector never points at a hidden one.
                              const next = group.items
                                .slice(dayIndex + 1)
                                .find((n) => !(td.hidingDone && isDone(n)));
                              return (
                                <Fragment key={item.id}>
                                  {!dragging && divider === dayIndex && <NowLine />}
                                  {/* A run of stops close enough together to
                                      be one decision rather than several. A
                                      label, not a container. */}
                                  {!dragging && runLabels.has(dayIndex) && (
                                    <li className="relative z-10 list-none pl-[5.25rem] pt-1 text-[12px] text-muted-foreground">
                                      {runLabels.get(dayIndex)}
                                    </li>
                                  )}
                                  {sortable ? (
                                    <SortableStop id={item.id} title={item.title}>
                                      {entry}
                                    </SortableStop>
                                  ) : (
                                    entry()
                                  )}
                                  {next && !td.editingTimeline && !dragging && (
                                    <TravelConnector
                                      from={item}
                                      to={next}
                                      leg={td.travelInto(item, next)}
                                      area={td.directionArea ?? ""}
                                      showTime={td.view.prefs.walkTimes}
                                      onAddBetween={() => td.openAddBetween(item, next)}
                                      fromNumber={dayIndex + 1}
                                    />
                                  )}
                                </Fragment>
                              );
                            });
                            if (!sortable) return rows;
                            return (
                              <SortableDay
                                ids={group.items
                                  .filter((item) => !(td.hidingDone && isDone(item)))
                                  .map((item) => item.id)}
                                onDragging={(on) => td.setDraggingDay(on ? group.key : null)}
                                onDrop={(activeId, overId) => {
                                  const move = dropMove(td.stopItems, activeId, overId);
                                  if (move) void td.moveStops([move]).catch(() => undefined);
                                }}
                              >
                                {rows}
                              </SortableDay>
                            );
                          })()}
                      {divider === group.items.length && <NowLine done />}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <TimelineHead
              title="All entries"
              line={[
                `${td.stopItems.length} ${td.stopItems.length === 1 ? "stop" : "stops"}`,
                td.doneCount ? `${td.doneCount} visited` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              onAdd={() => {
                td.setAddDay(td.addToDay ?? "");
                td.setAddingTimeline(true);
              }}
              addLabel="Add to the timeline"
              onMore={() => td.setTimelineMenuOpen(true)}
              {...td.directionsButton}
            />
            <ol className="relative min-w-0 space-y-1 overflow-x-hidden py-1">
              <RailLine />
              {td.stopItems.map((item, i) =>
                td.hidingDone && isDone(item) ? null : (
                  <Fragment key={item.id}>
                    <TimelineEntry
                      compact={td.compactCards && !td.editingTimeline}
                      item={item}
                      showDay
                      number={i + 1}
                      showSwipeHint={i === 0}
                      onLocate={() => td.locate(item)}
                      onSaveBooking={(patch) => td.board.updateItem(item.id, patch)}
                      {...td.docProps(item)}
                      onToggleDone={() => td.toggleDone(item)}
                      editing={td.editingTimeline}
                      {...td.withNear(item.day_date)}
                      {...td.nestProps(item)}
                      onEdit={(field) => td.board.setEditing(field)}
                      onUpdate={(patch) => td.saveCard(item.id, patch)}
                      onRemove={() => void td.removeTimelineItem(item)}
                      {...td.moveProps(item)}
                      tripStart={td.trip.start_date}
                      tripEnd={td.trip.end_date}
                      onKeep={td.keepItemAsReco}
                      kept={td.isKept(item)}
                      stray={td.strayIds.has(item.id)}
                      {...td.foldProps(item)}
                    />
                    {(() => {
                      const next = td.stopItems
                        .slice(i + 1)
                        .find((n) => !(td.hidingDone && isDone(n)));
                      if (!next || td.editingTimeline) return null;
                      return (
                        <TravelConnector
                          from={item}
                          to={next}
                          leg={td.travelInto(item, next)}
                          area={td.directionArea ?? ""}
                          showTime={td.view.prefs.walkTimes}
                          onAddBetween={() => td.openAddBetween(item, next)}
                          fromNumber={i + 1}
                        />
                      );
                    })()}
                  </Fragment>
                ),
              )}
            </ol>
          </>
        )}

        {/* "Now", on a trip day: back to the stop you're at or the next
one. Sticky at the bottom of the list while it is on screen. */}
        {td.nowStop && !td.editingTimeline && (
          <div className="pointer-events-none sticky bottom-3 z-30 mt-2 flex justify-end">
            <button
              type="button"
              onClick={td.jumpToNow}
              aria-label={`Jump to ${td.nowStop.title}`}
              className="pointer-events-auto inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-lg"
            >
              <LocateFixed className="size-4" aria-hidden />
              Now
            </button>
          </div>
        )}

        {/* Opened from the signpost on a day's header; each leg draws
under the entry it leaves from. */}
        <ItineraryDirections
          open={td.directionsOpen}
          onClose={() => td.setDirectionsOpen(false)}
          timelineCount={td.savedDirectionRows.length}
          onRemoveFromTimeline={td.removeDirectionRows}
          onForgetOffline={() => {
            td.dir.clear();
            forgetOfflineTrip(localStorage, td.trip.id);
            td.dayMaps.clear();
            td.offlineMap.clear();
            td.setLiveLegs(null);
            toast.success("Directions deleted from this phone");
          }}
          stops={td.directionStops}
          known={td.knownDirections}
          travel={td.travel}
          onTravel={td.chooseTravel}
          existingTitles={td.board.items.map((i) => i.title)}
          onAddToTimeline={td.board.upsertItems}
          onKeepOffline={(result, stops) => {
            const kept = td.dir.keep(result, stops);
            // A picture of each day's map goes with the directions, so
            // the day can be followed with no signal at all; and, where
            // the day map is drawn from vector tiles, the map itself
            // around each day's stops, so it still pans and zooms.
            if (kept) {
              void td.dayMaps.save(daysForMaps(td.stopItems));
              // Every day, not only the pictures' first three weeks:
              // the tile plan has its own cap.
              void td.offlineMap.save(daysForMaps(td.stopItems, Infinity));
            }
            return kept;
          }}
          onLegs={td.setLiveLegs}
          onPlaced={(placed) => {
            // The router already found these. Keep them, so the map can
            // draw the trip and the next Refresh does not pay again.
            for (const stop of placed) {
              void td.board.updateItem(stop.id, { lat: stop.lat, lon: stop.lon });
            }
          }}
          onBusy={td.setDirectionsBusy}
          {...(td.dir.saved?.signature ? { savedSignature: td.dir.saved.signature } : {})}
          {...(td.dir.saved?.savedAt ? { savedAt: td.dir.saved.savedAt } : {})}
          {...(td.directionArea ? { area: td.directionArea } : {})}
        />
      </div>

      <TripTimelineSheets td={td} />
    </div>
  );
}
