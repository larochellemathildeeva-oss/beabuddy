import { ChevronDown, Plus } from "@/components/icons";
import { CurrencySheet } from "@/components/CurrencySheet";
import { TripOverview } from "@/components/TripOverview";
import { TripMap } from "@/components/TripMap";
import { TripPrep } from "@/components/TripPrep";
import { formatTripLocation, placePatchForSavedRow } from "@/lib/place-label";
import { DayCards } from "@/components/day/DayCards";
import { TripBookings } from "@/components/day/TripBookings";
import { PastYouCard } from "@/components/day/PastYouCard";
import { ALL_DAYS } from "@/lib/trip-days";
import { toast } from "sonner";
import logo from "@/assets/bea-logo.png";
import { DayMapView } from "@/components/day/DayMapView";
import { DayRibbon } from "@/components/day/DayRibbon";
import { StopPeek } from "@/components/day/StopPeek";
import { NowPanel } from "@/components/day/NowPanel";
import { rememberPick } from "@/components/day/TimelineCard";
import { PinReviewSheet } from "@/components/day/PinReviewSheet";
import type { TripDetailCtx } from "./ctx";
import { TripTimelinePane } from "./timeline-pane";

export function TripContentPane({ td }: { td: TripDetailCtx }) {
  return (
    <div className="trip-content section-stagger px-3 pb-4 pt-3">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-nexttime" />
          <p className="text-[13px] text-muted-foreground">
            {td.others.length === 0
              ? "You're the only one here right now"
              : td.others.some((o) => o.editing)
                ? `${td.others.find((o) => o.editing)?.name} is editing ${td.others.find((o) => o.editing)?.editing}`
                : `${td.others.map((o) => o.name).join(", ")} ${td.others.length === 1 ? "is" : "are"} here`}
          </p>
        </div>
        <div className="flex -space-x-1.5">
          {td.others.slice(0, 3).map((o) => (
            <span
              key={o.userId}
              title={o.name}
              className="grid size-6 place-items-center rounded-full border border-card bg-primary text-[13px] font-semibold text-primary-foreground"
            >
              {o.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Several cities: pick one and the days, the map and Now all follow
            it, instead of scrolling past one city to reach the next. */}
      {td.stopItems.length > 0 &&
        td.routeCities.length > 1 &&
        (td.perspective === "companion" ||
          td.perspective === "map" ||
          (td.perspective === "timeline" && td.timelineByDay)) && (
          <div className="mb-3">
            <div
              role="tablist"
              aria-label="Which city to show"
              className="no-scrollbar -mx-1 flex w-full gap-1.5 overflow-x-auto px-1 py-0.5"
            >
              {[
                { id: "", city: "All cities", arrive_on: null, depart_on: null },
                ...td.routeCities,
              ].map((c) => {
                const on = (td.chosenCity?.id ?? "") === c.id;
                const dates = [c.arrive_on, c.depart_on !== c.arrive_on ? c.depart_on : null]
                  .filter((d): d is string => Boolean(d))
                  .map((d) =>
                    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    }),
                  )
                  .join(" – ");
                return (
                  <button
                    key={c.id || "all"}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      td.setCityChoice(c.id ?? "");
                      // The city's days, not a day from the city before.
                      td.setDayChoice(ALL_DAYS);
                    }}
                    className={`inline-flex shrink-0 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-elevated text-foreground"
                    }`}
                  >
                    <span className="whitespace-nowrap text-[13px] font-semibold">{c.city}</span>
                    {dates && (
                      <span
                        className={`whitespace-nowrap text-[13px] ${on ? "opacity-80" : "text-muted-foreground"}`}
                      >
                        {dates}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {td.chosenCity && td.timelineGroups.length === 0 && (
              <p className="mt-1.5 px-1 text-[13px] text-muted-foreground">
                Nothing planned in {td.chosenCity.city} yet
                {td.chosenCity.arrive_on ? "" : " — give it dates under Cities on this trip"}.
              </p>
            )}
          </div>
        )}

      {/* One day row for Companion, Map and the Timeline by day: arrows
            either side of the day cards, the chosen day filled. */}
      {td.stopItems.length > 0 &&
        td.offerDays &&
        (td.perspective === "companion" ||
          td.perspective === "map" ||
          (td.perspective === "timeline" && td.timelineByDay)) && (
          <div ref={td.dayCardsRef} className="mb-3">
            <DayCards chips={td.chips} value={td.chosenDay} onChange={td.setDayChoice} />
          </div>
        )}
      {td.activePerspective.hint ? (
        <p className="mb-3 px-0.5 text-[16px] text-muted-foreground">{td.activePerspective.hint}</p>
      ) : null}

      {td.peekStop && (
        <StopPeek
          stop={td.peekStop}
          number={td.nowStops.indexOf(td.peekStop) + 1}
          onClose={() => td.setPeekId(null)}
          onEdit={() => {
            const peek = td.peekStop;
            if (!peek) return;
            td.setPeekId(null);
            td.jumpToStop(peek.id);
          }}
        />
      )}
      {td.perspective === "overview" && (
        <TripOverview
          tripId={td.trip.id}
          items={td.stopItems}
          cities={td.cities.stops.map((stop) => ({ city: stop.city, country: stop.country }))}
          country={td.trip.country}
          groups={td.allDayGroups}
          days={td.moveDays}
          route={td.routeCities}
          {...(td.canFindCities
            ? { onFindCities: td.findCities, findingCities: td.findingCities }
            : {})}
          bookingDocs={td.bookingDocs.docs}
          startDate={td.trip.start_date}
          endDate={td.trip.end_date}
          today={td.todayKey}
          onOpenCompanion={() => {
            td.setCityChoice("");
            td.setDayChoice(td.todayKey);
            td.setPerspective("companion");
          }}
          onOpenBookings={td.openBookings}
          onOpenTimeline={(dayKey) => {
            if (dayKey !== undefined) td.setDayChoice(dayKey);
            td.setPerspective("timeline");
          }}
          onOpenMap={(dayKey) => {
            if (dayKey) td.setDayChoice(dayKey);
            td.setPerspective("map");
          }}
          onPrep={(tab) => td.setPrepAsk((cur) => ({ tab, n: (cur?.n ?? 0) + 1 }))}
        />
      )}

      {td.perspective === "overview" && (
        <section
          ref={td.bookingsRef}
          aria-label="Bookings"
          className="mt-4 scroll-mt-[var(--trip-sticky-offset)]"
        >
          <button
            type="button"
            aria-expanded={td.bookingsOpen}
            onClick={() => td.setBookingsOpen((open) => !open)}
            className="plain-card flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="font-display text-[22px] leading-tight">All bookings</span>
            <span className="ml-auto text-[14px] text-muted-foreground">
              {Object.values(td.bookingCounts).reduce((n, count) => n + count, 0)}
            </span>
            <ChevronDown className={`size-5 ${td.bookingsOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <div hidden={!td.bookingsOpen} className="mt-3">
            <TripBookings
              filter={td.bookingFilter}
              onFilter={td.setBookingFilter}
              stops={td.stopItems}
              docs={td.bookingDocs.docs}
              onSaveBooking={(id, patch) => td.board.updateItem(id, patch)}
            />
          </div>
        </section>
      )}

      {/* Past You, for a trip still ahead or under way: not one already over. */}
      {td.perspective === "overview" &&
        td.todayKey <= (td.trip.end_date ?? td.trip.start_date ?? "9999-12-31") && (
          <div className="mt-4">
            <PastYouCard
              trip={td.trip}
              places={td.cities.stops.map((stop) => ({ city: stop.city, country: stop.country }))}
            />
          </div>
        )}

      {td.perspective === "companion" && (
        <div className="space-y-3">
          {td.nowStops.length > 0 && td.companionDay ? (
            <>
              {td.view.prefs.ribbon && (
                <DayRibbon
                  stops={td.nowStops}
                  dayLabel={td.companionOrdinal || undefined}
                  selectedId={td.peekStop?.id ?? null}
                  onSelect={td.setPeekId}
                />
              )}
              <NowPanel
                key={td.companionDay.key}
                dayStops={td.nowStops}
                tripStops={td.tripStopsForNow}
                legs={td.nowLegs}
                {...(td.directionArea ? { area: td.directionArea } : {})}
                travel={td.travel}
                bookingDocs={td.bookingDocs.docs}
                reminderItems={td.board.items}
                nextDay={
                  td.timelineGroups.find(
                    (group) =>
                      group.key !== "" && td.companionDay && group.key > td.companionDay.key,
                  )?.key ?? null
                }
                onEase={td.easeDay}
                onRework={(day, ask) => {
                  td.setDayEditStart({ day, ask });
                  td.setDayEditOpen(true);
                }}
                onProgress={td.board.setProgress}
                photosFor={(stop) => td.docProps(stop).photos}
                onLook={(id) => {
                  td.setPeekId(id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </>
          ) : (
            <div className="plain-card space-y-2 p-4">
              <img
                src="/bea/bea-think-static.png"
                alt=""
                className="size-16 rounded-full border border-border object-cover"
              />
              <p className="font-display text-[24px] leading-tight">
                {td.stopItems.length === 0 ? "Nothing on this trip yet." : "Pick a day to follow."}
              </p>
              <p className="text-[16px] leading-snug text-muted-foreground">
                {td.stopItems.length === 0
                  ? "Add stops in the Timeline, or let Béa draft the days from a plan you already have."
                  : "Companion walks through one day with you: where you are, what is next, and when to set off. On a travel day it opens on today by itself."}
              </p>
              {/* An empty trip gets its way in right here, never "go elsewhere first". */}
              {td.stopItems.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      td.setPlannerTab("build");
                      td.setPlannerOpen(true);
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[16px] font-semibold text-primary-foreground"
                  >
                    <img src={logo} alt="" className="size-5 object-contain" />
                    Plan with Béa
                  </button>
                  <button
                    type="button"
                    onClick={() => td.setAddOpen(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[16px] font-semibold"
                  >
                    <Plus className="size-4 text-primary" aria-hidden />
                    Add a stop
                  </button>
                </div>
              )}
              {/* The days right here, so the prompt is never a dead end. */}
              {td.stopItems.length > 0 && (
                <div
                  role="group"
                  aria-label="Day to follow"
                  className="flex flex-wrap gap-1.5 pt-1"
                >
                  {td.chips
                    .filter((chip) => chip.count > 0)
                    .map((chip) => (
                      <button
                        key={chip.key || "undated"}
                        type="button"
                        onClick={() => td.setDayChoice(chip.key)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[16px] font-semibold"
                      >
                        {chip.ordinal ? <span className="text-primary">{chip.ordinal}</span> : null}
                        {chip.label}
                        <span className="text-[13px] font-normal text-muted-foreground">
                          {chip.count}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mounted only while showing: Leaflet cannot lay out in a hidden box. */}
      {td.perspective === "map" && (
        <div className="space-y-3">
          {td.stopItems.length > 0 && (
            <DayMapView
              key={`${td.chosenDay}:${td.mapFocus ?? ""}`}
              focusId={td.mapFocus}
              groups={td.shownGroups}
              nesting={td.view.prefs.nesting}
              area={formatTripLocation(td.trip.city, td.trip.country)}
              todayKey={td.todayKey}
              ordinals={Object.fromEntries(td.chips.map((chip) => [chip.key, chip.ordinal]))}
              legFor={td.travelInto}
            />
          )}
          {/* The whole trip, city to city — only when looking at the whole
                trip. Under a single day it was a second, busier map repeating
                the first. The same stop list the directions are built from,
                so the map and the route can never describe different journeys. */}
          {!td.chosenCity && td.shownGroups.length > 1 && (
            <TripMap
              stops={td.routeStops}
              {...(td.directionArea ? { area: td.directionArea } : {})}
            />
          )}
        </div>
      )}

      {/* Day and Trip stay mounted and are hidden instead, so an edit in
            progress survives a tab switch and the action row's buttons can
            open their forms from any tab. */}
      <TripTimelinePane td={td} />

      {/* A sheet, opened by the "To do" button from any tab. */}
      <TripPrep
        tripId={td.trip.id}
        uid={td.me.id}
        international={td.tripWide.international}
        hasLodging={td.tripWide.hasLodging}
        hasFlights={td.tripWide.hasFlights}
        tripStart={td.trip.start_date}
        tripEnd={td.trip.end_date}
        openSignal={td.prepSignal}
        openTab={td.prepAsk}
      />
      <PinReviewSheet
        open={td.pinReviewOpen}
        onClose={() => td.setPinReviewOpen(false)}
        stops={td.toCheck}
        anchorsFor={(day) => td.withNear(day)}
        onApprove={(item) => {
          // Approved as it is: the traveller's vote for that spot, like a pick.
          void td.board
            .updateItem(item.id, { pin_check: null })
            .catch(() => toast.error("Couldn't save that — try again."));
          if (item.lat != null && item.lon != null) {
            rememberPick(item.title, {
              name: item.title,
              ...(item.address ? { address: item.address } : {}),
              lat: item.lat,
              lon: item.lon,
              source: "traveller",
              url: "",
            });
          }
        }}
        onChangePlace={(item, place) => {
          void td.board
            .updateItem(item.id, { ...placePatchForSavedRow(place), pin_check: null })
            .catch(() => toast.error("Couldn't save that place — try again."));
        }}
      />
      {td.currencyOpen && (
        <CurrencySheet
          key={td.trip.id}
          open
          onClose={() => td.setCurrencyOpen(false)}
          tripId={td.trip.id}
          countries={td.tripCountries}
        />
      )}
    </div>
  );
}
