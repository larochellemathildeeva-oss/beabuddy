import { Download, ChevronRight } from "@/components/icons";
import { TripBudget } from "@/components/TripBudget";
import { TripStops } from "@/components/TripStops";
import { TripPeople } from "@/components/TripPeople";
import { TripBudgetSwitch, TripDeleteButton, TripDetailsForm } from "@/components/TripSettings";
import { tripDateLine } from "@/lib/trip-card";
import { savedAgoLabel, savedIsStale } from "@/lib/offline-directions";
import { itineraryPrintHtml } from "@/lib/itinerary-print";
import { printHtml } from "@/lib/print-page";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";
import { formatTripLocation } from "@/lib/place-label";
import { TripBarOptions } from "@/components/day/TripViews";
import { TripMenuSheet } from "@/components/day/TripMenuSheet";
import { StopPhotos } from "@/components/day/StopPhotos";
import { TripAgain } from "@/components/day/TripAgain";
import { ShareLinkCard } from "@/components/day/ShareLinkCard";
import { TripPreferencesPanel } from "@/components/day/TripPreferencesPanel";
import { forgetOfflineTrip } from "@/lib/offline-trip";
import { calendarFileName, tripCalendar } from "@/lib/itinerary-ics-export";
import { pinCheckFor } from "@/lib/pin-check";
import { unroutedLegCopy } from "@/lib/timeline-directions";
import { modeWord } from "@/lib/travel-mode";
import { toast } from "sonner";
import { CustomizeOptions } from "@/components/day/CustomizeTrip";
import { TripCheckup } from "@/components/day/TripCheckup";
import { checkupPill } from "@/lib/trip-checkup";
import { prettyMegabytes } from "@/lib/vector-tiles";
import type { TripDetailCtx } from "./ctx";

export function TripMenuPane({ td }: { td: TripDetailCtx }) {
  return (
    <TripMenuSheet
      open={td.settingsOpen}
      onClose={() => td.setSettingsOpen(false)}
      title={td.trip.title}
      subtitle={[
        formatTripLocation(td.trip.city?.split(",")[0], td.trip.country),
        tripDateLine(td.trip.start_date, td.trip.end_date),
      ]
        .filter(Boolean)
        .join(" · ")}
      art={td.tripArt}
      section={td.sheetSection}
      onSection={td.setSheetSection}
      people={td.members.map((m) => m.display_name || "Traveller")}
      bookings={td.bookingCounts}
      onBookings={(kind) => {
        td.setSettingsOpen(false);
        td.openBookings(kind);
      }}
      citiesCount={td.cities.stops.length}
      offlineNote={
        td.dir.saved
          ? `${savedAgoLabel(td.dir.saved.savedAt)}${savedIsStale(td.dir.saved.signature, td.routeStops) ? " · out of date" : ""}`
          : ""
      }
      budgetOn={Boolean(td.trip.budget_enabled)}
      checkupNote={td.checkup ? checkupPill(td.checkup) : ""}
      preferencesCount={td.tripPrefs.list.length}
      photosCount={td.stopPhotos.photos.length}
      onCalendar={() => {
        td.setSettingsOpen(false);
        const blob = new Blob([tripCalendar(td.trip, td.stopItems)], {
          type: "text/calendar;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = calendarFileName(td.trip.title);
        a.click();
        URL.revokeObjectURL(url);
        toast("Calendar file saved", {
          description: "Open it to add the trip to your calendar. Times are the place's own.",
        });
      }}
      onPrint={() => {
        td.setSettingsOpen(false);
        printHtml(
          itineraryPrintHtml(
            {
              title: td.trip.title,
              subtitle: [
                formatTripLocation(td.trip.city?.split(",")[0], td.trip.country),
                tripDateLine(td.trip.start_date, td.trip.end_date),
              ]
                .filter(Boolean)
                .join(" · "),
              start_date: td.trip.start_date,
              end_date: td.trip.end_date,
              // The owner's membership carries no display name; this device knows its own.
              travellers: td.members.map(
                (m) => m.display_name || (m.user_id === td.me.id ? td.me.name : "") || "Traveller",
              ),
              link: `${window.location.origin}/trips/${td.trip.id}`,
              printedAt: new Date(),
            },
            // Pins to check go on paper too, when the traveller shows them.
            td.view.prefs.pinChecks
              ? td.stopItems.map((item) => ({
                  ...item,
                  pin_check: pinCheckFor(item, td.strayIds.has(item.id)),
                }))
              : td.stopItems.map((item) => ({ ...item, pin_check: null })),
          ),
        );
      }}
      footer={
        // Only the owner can delete (the "Owner deletes trips" policy). For
        // anyone else the delete matched no rows, said nothing, and sent
        // them to the trip list as if it had worked; they leave instead,
        // from Invite and people.
        td.me.id === td.trip.owner_id ? (
          <TripDeleteButton onDelete={td.onDelete} onConfirmed={() => td.setSettingsOpen(false)} />
        ) : null
      }
    >
      {td.sheetSection === "invite" && (
        <div className="mb-3">
          <ShareLinkCard tripId={td.trip.id} />
        </div>
      )}
      {td.sheetSection === "invite" && (
        <TripPeople
          trip={td.trip}
          meId={td.me.id}
          members={td.members}
          invites={td.board.invites}
          onInvite={td.onInvite}
          onRevokeInvite={td.onRevokeInvite}
          onRemoveMember={td.onRemoveMember}
          onLeave={td.onLeave}
          onChanged={td.board.reload}
          onLeft={() => td.setSettingsOpen(false)}
        />
      )}

      {td.sheetSection === "packing" && (
        <div className="plain-card p-3.5">
          {td.templates.packs.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">
              No saved lists yet — create one under Profile → Create packing lists.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                You get a copy — ticking things off only affects this trip.
              </p>
              <select
                value={td.packTemplateId}
                onChange={(e) => {
                  td.setPackTemplateId(e.target.value);
                  td.setPackMsg("");
                }}
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14.5px]"
              >
                <option value="">Choose a list…</option>
                {td.templates.packs.map((pk) => (
                  <option key={pk.id} value={pk.id}>
                    {pk.emoji} {pk.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!td.packTemplateId}
                onClick={async () => {
                  if (!td.packTemplateId) return;
                  await td.templates.attachToTrip(td.packTemplateId, td.trip.id);
                  td.setPackTemplateId("");
                  td.setPackMsg("List attached — open the trip to tick items off.");
                }}
                className="btn-primary mt-3 w-full disabled:opacity-50"
              >
                Attach a copy to this trip
              </button>
              {td.packMsg && <p className="mt-2 text-[13px] text-muted-foreground">{td.packMsg}</p>}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              td.setSettingsOpen(false);
              td.setPrepAsk((cur) => ({ tab: "packing", n: (cur?.n ?? 0) + 1 }));
            }}
            className="mt-3 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-primary"
          >
            Open this trip's packing
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {td.sheetSection === "offline" && (
        <div className="plain-card p-3.5">
          <p className="text-[13px] text-muted-foreground">
            Download the journeys between stops and Béa keeps the steps on this phone, so you never
            work them out twice. The trip's plan is kept on this phone too, so once Béa has been
            opened here with a connection, this trip opens with no signal. Adding directions to the
            timeline saves the summary only.
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {td.cities.stops.length >= 2
              ? `Covers your ${td.cities.stops.length} cities, in order.`
              : "Covers the timeline stops that have a place on the map."}{" "}
            You can also keep the legs from “Directions between stops” on the trip itself.
          </p>
          <button
            disabled={td.dir.busy || td.routeStops.length < 2}
            onClick={() => void td.dir.download(td.routeStops, td.directionArea, td.travel)}
            className="btn-primary mt-3 w-full disabled:opacity-50"
          >
            {td.dir.busy ? "Saving…" : td.dir.saved ? "Refresh directions" : "Download directions"}
          </button>
          {td.routeStops.length < 2 && (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Add at least two cities to this trip first (or two timeline entries with places).
            </p>
          )}
          {td.dir.saved && savedIsStale(td.dir.saved.signature, td.routeStops) && (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Your stops have changed since this was saved — refresh to bring it up to date.
            </p>
          )}
          {td.dir.error && <p className="mt-2 text-[12.5px] text-destructive">{td.dir.error}</p>}
          {td.dir.saved && (
            <div className="mt-3 space-y-2">
              {td.dir.saved.legs.map((l, i) => (
                <details key={i} className="rounded-xl bg-elevated px-3 py-2">
                  <summary className="cursor-pointer text-[14.5px] font-medium">
                    {l.from} → {l.to}
                    <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                      {l.distance > 0
                        ? `${modeWord(l.mode)} · ${prettyDistance(l.distance)} · ${prettyDuration(l.duration)}`
                        : unroutedLegCopy(l)}
                    </span>
                  </summary>
                  <ol className="mt-2 space-y-1">
                    {l.steps.map((s, k) => (
                      <li key={k} className="text-[13px] text-muted-foreground">
                        {s.instruction}
                        {s.distance > 0 ? ` — ${prettyDistance(s.distance)}` : ""}
                      </li>
                    ))}
                  </ol>
                  <a
                    href={l.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[13px] font-semibold text-primary"
                  >
                    Open in maps (needs service)
                  </a>
                </details>
              ))}
              {td.dir.saved.unresolved.length > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Couldn't find on the map: {td.dir.saved.unresolved.join(", ")}
                </p>
              )}
              {(td.dir.saved.deferred?.length || td.dir.saved.legs.some((l) => l.capped)) && (
                <p className="text-[12px] text-muted-foreground">
                  Later stretches open in maps — Béa stops looking after a long list.
                </p>
              )}
              {td.dayMaps.busy && (
                <p className="text-[12px] text-muted-foreground">Saving a map of each day…</p>
              )}
              {!td.dayMaps.busy && Object.keys(td.dayMaps.maps).length > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  {Object.keys(td.dayMaps.maps).length} day{" "}
                  {Object.keys(td.dayMaps.maps).length === 1 ? "map" : "maps"} saved too — open a
                  day in the Timeline to see it offline.
                </p>
              )}
              {td.dayMaps.error && (
                <p className="text-[12px] text-destructive">{td.dayMaps.error}</p>
              )}
              {td.offlineMap.progress && (
                <p className="text-[12px] text-muted-foreground">
                  Saving the trip's map
                  {td.offlineMap.progress.total > 0
                    ? ` (${Math.round((td.offlineMap.progress.done / td.offlineMap.progress.total) * 100)}%)`
                    : ""}
                  …
                </p>
              )}
              {!td.offlineMap.busy && td.offlineMap.saved && (
                <p className="text-[12px] text-muted-foreground">
                  The map around each day's stops is saved on this phone (
                  {prettyMegabytes(td.offlineMap.saved.bytes)}), so it still pans and zooms with no
                  signal.
                </p>
              )}
              {td.offlineMap.error && (
                <p className="text-[12px] text-destructive">{td.offlineMap.error}</p>
              )}
              <button
                onClick={() => {
                  td.dir.clear();
                  forgetOfflineTrip(localStorage, td.trip.id);
                  td.dayMaps.clear();
                  td.offlineMap.clear();
                }}
                className="text-[12.5px] text-muted-foreground underline"
              >
                Delete saved directions
              </button>
            </div>
          )}
        </div>
      )}

      {td.sheetSection === "photos" && (
        <StopPhotos
          scope="trip"
          title={td.trip.title}
          photos={td.stopPhotos.photos}
          available={td.stopPhotos.available}
          uid={td.me.id}
          onAdd={(files) => td.stopPhotos.add(null, files)}
          onRemove={td.stopPhotos.remove}
        />
      )}

      {td.sheetSection === "budget" && (
        <div className="space-y-2">
          <TripBudgetSwitch trip={td.trip} onUpdate={td.onUpdate} />
          {td.trip.budget_enabled && <TripBudget tripId={td.trip.id} />}
        </div>
      )}

      {/* The trip's cities, in order — the route the trip map draws. */}
      {td.sheetSection === "cities" && (
        <TripStops
          tripId={td.trip.id}
          uid={td.me.id}
          home={td.trip}
          {...(td.canFindCities
            ? { onFindCities: td.findCities, findingCities: td.findingCities }
            : {})}
        />
      )}

      {td.sheetSection === "checkup" && td.checkup && (
        <TripCheckup
          findings={td.checkup}
          onOpenStop={(id) => {
            td.setSettingsOpen(false);
            td.setSheetSection(null);
            td.jumpToStop(id);
          }}
        />
      )}

      {td.sheetSection === "preferences" && (
        <TripPreferencesPanel
          list={td.tripPrefs.list}
          onPhone={td.tripPrefs.onPhone}
          onSave={td.tripPrefs.save}
        />
      )}

      {td.sheetSection === "again" && (
        <TripAgain
          trip={td.trip}
          items={td.board.items}
          stops={td.cities.stops}
          onOpenTrip={(id) => {
            td.setSettingsOpen(false);
            void td.navigate({ to: "/trips/$tripId", params: { tripId: id } });
          }}
          onCopiedHere={() => void td.board.reload()}
        />
      )}

      {td.sheetSection === "customize" && (
        <div className="plain-card px-3.5 py-1">
          <TripBarOptions value={td.barPosition} onChange={td.setBarPosition} />
          <CustomizeOptions prefs={td.view.prefs} onToggle={td.view.toggle} />
        </div>
      )}

      {td.sheetSection === "edit" && (
        <TripDetailsForm
          trip={td.trip}
          onUpdate={td.onUpdate}
          onSaved={() => td.setSettingsOpen(false)}
        />
      )}
    </TripMenuSheet>
  );
}
