import { Check, Route, CalendarDays, Pencil } from "@/components/icons";
import { TimelineEntryForm } from "@/components/TimelineEntryForm";
import { Sheet } from "@/components/Sheet";
import { TimeChangeBox } from "@/components/day/TimeChangeBox";
import { DayEditSheet } from "@/components/day/DayEditSheet";
import { MoveStopSheet } from "@/components/day/MoveStopSheet";
import { ReviewChangesSheet } from "@/components/day/ReviewChangesSheet";
import { MenuChoice } from "./timeline-bits";
import type { TripDetailCtx } from "./ctx";

export function TripTimelineSheets({ td }: { td: TripDetailCtx }) {
  return (
    <>
      {/**
       * Adding opens over the page, not under the list, so the form
       * arrives where you are looking, with the fields in reach.
       */}
      <Sheet
        open={td.addingTimeline}
        onClose={() => {
          td.setAddingTimeline(false);
          td.setAddDay("");
          td.setAddBetween(null);
        }}
        title={td.addBetween ? "Add a stop between" : "Add to the timeline"}
      >
        <TimelineEntryForm
          tripStart={td.trip.start_date}
          tripEnd={td.trip.end_date}
          {...(td.addDay ? { openDay: td.addDay } : {})}
          {...(td.addBetween?.time ? { openTime: td.addBetween.time } : {})}
          {...td.withNear(td.addDay || null)}
          existing={td.board.items.map((item) => ({
            title: item.title,
            address: item.address,
            lat: item.lat,
            lon: item.lon,
          }))}
          onAdd={
            td.addBetween
              ? async (entry) => {
                  const between = td.addBetween;
                  if (!between) return undefined;
                  const id = await td.board.insertItemAfter(
                    td.insertAnchor.current ?? between.afterId,
                    entry,
                  );
                  if (id) td.insertAnchor.current = id;
                  return id;
                }
              : td.board.addItem
          }
          onUpdateEntry={(id, patch) => td.board.updateItem(id, patch)}
          onDone={() => {
            td.setAddingTimeline(false);
            td.setAddDay("");
            td.setAddBetween(null);
          }}
        />
      </Sheet>

      <DayEditSheet
        open={td.dayEditOpen}
        onClose={() => {
          td.setDayEditOpen(false);
          td.setDayEditStart(null);
        }}
        tripId={td.trip.id}
        stops={td.stopItems}
        days={td.moveDays}
        initialDay={td.dayEditStart?.day ?? td.addToDay}
        initialAsk={td.dayEditStart?.ask}
        area={(day) => td.nearOn(day)}
        center={(day) => td.centerOn(day)}
        onApply={td.applyDayEdit}
      />

      <MoveStopSheet
        stop={td.movingStop}
        stops={td.stopItems}
        days={td.moveDays}
        onMove={(move) => td.moveStops([move])}
        onClose={() => td.setMovingId(null)}
      />

      <ReviewChangesSheet {...td.scheduleReview.sheet} />

      {/* The list's own ⋯: which stops, in which order, and the tools. */}
      <Sheet
        open={td.timelineMenuOpen}
        onClose={() => td.setTimelineMenuOpen(false)}
        title="Timeline"
        hint={`${td.stopItems.length} ${td.stopItems.length === 1 ? "stop" : "stops"} scheduled${td.doneCount > 0 ? ` · ${td.doneCount} visited` : ""}`}
        width="sm"
      >
        <div className="space-y-4">
          {td.stopItems.length > 0 && (
            <TimeChangeBox
              tripId={td.trip.id}
              stops={td.stopItems}
              days={td.moveDays}
              onChangeTime={async (id, time) => {
                await td.board.updateItem(id, { time_label: time });
              }}
              onApply={(moves, summary) => td.moveStops(moves, summary || "Plan changed")}
              onDone={() => td.setTimelineMenuOpen(false)}
            />
          )}
          <MenuChoice
            label="Show"
            value={td.hideDone}
            onChange={td.setHideDone}
            options={[
              [false, "All"],
              [true, `Not visited (${td.stopItems.length - td.doneCount})`],
            ]}
          />
          <MenuChoice
            label="Cards"
            value={td.compactCards}
            onChange={td.setCompactCards}
            options={[
              [false, "Full"],
              [true, "Compact"],
            ]}
          />
          <MenuChoice
            label="List"
            value={td.timelineByDay}
            onChange={td.setTimelineByDay}
            options={[
              [false, "All entries"],
              [true, "By day"],
            ]}
          />
          {td.timelineByDay && (
            <MenuChoice
              label="Order"
              value={td.byArea}
              onChange={td.setByArea}
              options={[
                [false, "Timeline"],
                [true, "Neighbourhood"],
              ]}
            />
          )}
          <div className="grid gap-2">
            {td.stopItems.length > 0 && (
              <button
                type="button"
                aria-pressed={td.editingTimeline}
                onClick={() => {
                  td.setEditingTimeline((v) => !v);
                  td.setTimelineMenuOpen(false);
                }}
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-left text-[14.5px] font-semibold"
              >
                {td.editingTimeline ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : (
                  <Pencil className="size-4 text-primary" aria-hidden />
                )}
                {td.editingTimeline ? "Done editing the itinerary" : "Edit the itinerary"}
              </button>
            )}
            {td.stopItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  td.setTimelineMenuOpen(false);
                  td.setDayEditOpen(true);
                }}
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-left text-[14.5px] font-semibold"
              >
                <CalendarDays className="size-4 text-primary" aria-hidden />
                Change a day
              </button>
            )}
            {td.stopItems.length >= 2 && (
              <button
                type="button"
                data-guide="optimize-trip"
                onClick={() => {
                  td.setTimelineMenuOpen(false);
                  td.setPlannerTab("optimize");
                  td.setPlannerOpen(true);
                }}
                className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-left text-[14.5px] font-semibold"
              >
                <Route className="size-4 text-primary" aria-hidden />
                Optimize the order
              </button>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">
            Tap a stop to edit it · the card between stops has the way there.
          </p>
        </div>
      </Sheet>
    </>
  );
}
