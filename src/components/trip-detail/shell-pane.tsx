import { Check, Coins, ListChecks, MoreHorizontal, Plus } from "@/components/icons";
import { pickTripPhoto } from "@/lib/trip-card";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { TripBanner } from "@/components/TripBanner";
import { BrandMark } from "@/components/PageHeader";
import logo from "@/assets/bea-logo.png";
import { JourneyTracker } from "@/components/day/JourneyTracker";
import { companionState, isDone } from "@/lib/companion";
import { routeCityOn } from "@/lib/import-stop";
import type { TripDetailCtx } from "./ctx";

export function TripShellPane({ td }: { td: TripDetailCtx }) {
  return (
    <>
      <TripBanner
        variant="page"
        pageArt={td.perspective === "overview" ? td.tripArt : td.companionArt}
        title={td.trip.title}
        city={td.trip.city}
        country={td.trip.country}
        cities={td.cityNames}
        startDate={td.trip.start_date}
        endDate={td.trip.end_date}
        tentative={td.trip.dates_status === "tentative"}
        companions={td.companionsLine}
        photo={pickTripPhoto(td.photos, {
          city: td.trip.city,
          country: td.trip.country,
          cities: td.cityNames,
        })}
        viewTransitionName={`trip-photo-${td.trip.id}`}
        footer={
          td.perspective !== "overview" && td.companionDay ? (
            <p className="mt-2 text-[14px] font-semibold">
              {[
                td.companionOrdinal && `${td.companionOrdinal} of ${td.datedDayCount}`,
                td.companionPlace,
                td.companionDateLine,
              ]
                .filter(Boolean)
                .join(" · ")}
              {td.nowStops.length > 0 && (
                <span className="mt-1 block text-[13px] font-normal text-muted-foreground">
                  {companionState(td.nowStops).reached}/{td.nowStops.length} stops reached ·{" "}
                  {Math.round((companionState(td.nowStops).reached / td.nowStops.length) * 100)}%
                  complete
                </span>
              )}
            </p>
          ) : null
        }
        header={
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card/95 px-3 py-2 text-foreground">
            <BrandMark />
            <div className="flex items-center gap-2">
              {td.view.prefs.pinChecks && td.toCheck.length > 0 && (
                <button
                  type="button"
                  onClick={() => td.setPinReviewOpen(true)}
                  title="Pins to check"
                  aria-label={`${td.toCheck.length} ${td.toCheck.length === 1 ? "pin" : "pins"} to check`}
                  className="relative grid size-11 place-items-center rounded-full border border-destructive/40 bg-destructive/10 text-[20px] font-bold text-destructive"
                >
                  !
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[13px] font-bold leading-5 text-white">
                    {td.toCheck.length}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => td.setPrepSignal((n) => n + 1)}
                aria-label="To do and packing"
                className="grid size-11 place-items-center rounded-full border border-border bg-card"
              >
                <ListChecks className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  td.setSettingsOpen(true);
                  td.setSheetSection(null);
                }}
                data-guide="trip-menu"
                title="Trip menu"
                aria-label="Trip menu"
                className="grid size-11 place-items-center rounded-full border border-border bg-card shadow-xs"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        }
      />
      <div className="px-3 py-2">
        {td.perspective === "overview" || !td.companionDay ? (
          <section aria-label="Your trip progress" className="plain-card p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[22px]">Your trip</h2>
              <p className="text-[14px] text-muted-foreground">
                {td.moveDays.length} days ·{" "}
                {
                  new Set(
                    (td.cityNames.length ? td.cityNames : [td.trip.city || ""]).filter(Boolean),
                  ).size
                }{" "}
                cities · {td.doneCount}/{td.stopItems.length} stops reached
              </p>
            </div>
            <ol className="no-scrollbar relative mt-3 flex gap-2 overflow-x-auto">
              {td.moveDays.map((day, i) => {
                const group = td.allDayGroups.find((g) => g.key === day);
                const reached = group?.items.filter(isDone).length ?? 0;
                const total = group?.items.length ?? 0;
                return (
                  <li key={day} className="min-w-[100px] flex-1">
                    <button
                      type="button"
                      aria-label={`Day ${i + 1}, ${routeCityOn(td.cities.stops, day) || td.trip.city || "Trip"}`}
                      onClick={() => {
                        td.setDayChoice(day);
                        td.setCityChoice("");
                        td.setPerspective("companion");
                      }}
                      className="relative flex min-h-11 w-full flex-col items-center gap-1 px-2 py-2 text-[14px]"
                    >
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="absolute right-1/2 top-6 w-[calc(100%+0.5rem)] border-t-2 border-dashed border-primary/30"
                        />
                      )}
                      <span
                        className={`relative grid size-8 place-items-center rounded-full border-2 border-primary ${total > 0 && reached === total ? "bg-primary text-primary-foreground" : "text-primary"}`}
                      >
                        {total > 0 && reached === total ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="font-semibold">
                        {routeCityOn(td.cities.stops, day)?.split(",")[0] || td.trip.city || "Trip"}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {formatTimelineDayLabel(day)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          td.view.prefs.journey && (
            <JourneyTracker
              stops={td.nowStops}
              selectedId={td.peekStop?.id ?? null}
              onSelect={td.setPeekId}
            />
          )
        )}
      </div>
      {/* Béa's line scrolls away with the page; only the bar above stays. */}
      {td.tripNote ? (
        <p className="px-3 pt-2.5 text-[13px] text-muted-foreground">{td.tripNote}</p>
      ) : null}
      {/* The prototype's labelled action pills, on one line: the row scrolls
            sideways rather than wrapping on a narrow phone. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
        <button
          data-guide="bea-plan"
          title="Let Béa plan this trip"
          onClick={() => {
            td.setPlannerTab("start");
            td.setPlannerOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-primary/30 bg-primary/10 py-1 pl-1 pr-2.5 min-h-11 text-[16px] font-semibold text-primary shadow-2xs transition-all active:scale-95"
        >
          <img src={logo} alt="" className="size-5 object-contain" />
          Plan with Béa
        </button>
        <button
          data-guide="trip-prep"
          title="To-dos and packing for this trip"
          onClick={() => td.setPrepSignal((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-border bg-elevated px-2.5 py-2.5 min-h-11 text-[16px] font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <ListChecks className="size-3.5 text-primary" aria-hidden />
          To do
        </button>
        <button
          title="Convert prices into your money"
          onClick={() => td.setCurrencyOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-border bg-elevated px-2.5 py-2.5 min-h-11 text-[16px] font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95"
        >
          <Coins className="size-3.5 text-primary" aria-hidden />
          Currency
        </button>
        <button
          data-guide="add-stop"
          title="Add a stop, a saved place or a city"
          onClick={() => td.setAddOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-primary px-3 py-2.5 min-h-11 text-[16px] font-bold text-primary-foreground shadow-2xs transition-all active:scale-95"
        >
          <Plus className="size-3.5" aria-hidden />
          Add stop
        </button>
        <span className="ml-auto shrink-0 pl-1 text-[13px] text-muted-foreground sm:inline">
          {[
            td.stopItems.length ? `${td.stopItems.length} entries` : "",
            td.cities.stops.length ? `${td.cities.stops.length} stops` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </>
  );
}
