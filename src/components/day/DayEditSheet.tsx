import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet } from "@/components/Sheet";
import { ArrowRight, Check, CloudRain, Lock, MapPin, RotateCcw, Sun, X } from "@/components/icons";
import { askDayEdit } from "@/lib/day-edit.functions";
import {
  DAY_EDIT_MAX_ASK,
  DAY_EDIT_MAX_DAYS,
  DAY_EDIT_MAX_STOPS,
  dayEditChanges,
  dayEditRows,
  dayEditSchedule,
  joinAsks,
  type DayEditPlan,
} from "@/lib/day-edit";
import { geocodePlanStops } from "@/lib/geocode-plan.functions";
import { labelAddress } from "@/lib/geocode-plan";
import { scoreMatch, type Confidence } from "@/lib/match-confidence";
import { pinCheckNote } from "@/lib/pin-check";
import { stopsOfDay, type ScheduleUpdate } from "@/lib/stop-move";
import type { TimelineKind } from "@/lib/timeline-kind";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { readableError } from "@/lib/optimistic";
import { lookupRain } from "@/lib/weather.functions";
import { rainDayMayBeAhead, rainNotice, WEATHER_ATTRIBUTION, type RainNotice } from "@/lib/weather";

/** Open-Meteo forecasts about 16 days ahead; later days are not asked about. */
const FORECAST_DAYS = 16;

type Stop = {
  id: string;
  title: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  kind?: string | null;
};

/** One-tap starting points for the ask; the box stays editable. */
const IDEAS = [
  "Rain is coming: swap outdoor stops for indoor places nearby",
  "Replace the ticked stops with something better nearby",
  "Slower start to the morning",
  "Less walking between stops",
  "Lunch around 12:30",
  "Finish by 6pm",
  "Put the busiest places first",
];

/** Where a suggested place was found on the map, and how sure Béa is. */
type Found = { lat: number; lon: number; label?: string; confidence: Confidence; reason: string };

/** Béa's version, ready to write: the rows that change and the places to add. */
export type DayEditSave = {
  updates: ScheduleUpdate[];
  added: Array<{
    day_date: string;
    time_label?: string;
    kind: TimelineKind;
    title: string;
    detail?: string;
    address?: string;
    lat?: number;
    lon?: number;
    pin_check?: string;
    position: number;
  }>;
  summary: string;
};

/** The day as Béa read it, to tell whether it changed before Apply. */
const dayKey = (stops: readonly Stop[]) =>
  stops
    .map((s) => `${s.id}|${s.time_label ?? ""}|${s.position}|${s.title}|${s.kind ?? ""}`)
    .join("\n");

/**
 * "Change a day": pick the day, tick the stops Béa may touch (all by
 * default), say what you'd like, then see the day as it is beside Béa's
 * version. Nothing is saved until "Use Béa's version"; "Change something"
 * asks again with the new words added to the first.
 */
export function DayEditSheet({
  open,
  onClose,
  tripId,
  stops: allStops,
  days,
  initialDay,
  initialAsk,
  area,
  center,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  stops: readonly Stop[];
  /** The trip's days in order, from `tripDays`. */
  days: readonly string[];
  /** The day to open on, when the sheet was opened from one. */
  initialDay?: string | null | undefined;
  /** Words to start with, when opened from a nudge ("rain from 14:00"). */
  initialAsk?: string | undefined;
  /** The town a day is in, so new places are looked for there. */
  area?: ((day: string) => string | undefined) | undefined;
  /** The middle of a day's stops or town, to look new places up beside. */
  center?: ((day: string) => { lat: number; lon: number } | null | undefined) | undefined;
  /** Save Béa's version, with its own Undo. */
  onApply: (save: DayEditSave) => Promise<void>;
}) {
  const ask = useServerFn(askDayEdit);
  const place = useServerFn(geocodePlanStops);
  const rainFor = useServerFn(lookupRain);
  /**
   * Each upcoming day's next spell of rain, null when it looks dry, or
   * "unknown" when there is no forecast for it (too far ahead, or no answer).
   */
  const [rain, setRain] = useState<Record<string, RainNotice | null | "unknown">>({});
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  /** What has been asked so far: the first ask, then each "Change something". */
  const [asks, setAsks] = useState<string[]>([]);
  const [refining, setRefining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [proposal, setProposal] = useState<{
    plan: DayEditPlan;
    basis: string;
    /** The stops Béa was allowed to change, as sent. */
    picked: Set<string>;
    /** Suggested places found on the map, by entry id; missing ones were not. */
    found: Record<string, Found>;
  } | null>(null);
  /** Suggested places the traveller turned down. */
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [placing, setPlacing] = useState(false);

  // The stops Béa can read: the server leaves out rows with no name.
  const stops = useMemo(() => allStops.filter((s) => s.title.trim()), [allStops]);
  const dayStops = useMemo(() => (day ? stopsOfDay(stops, day) : []), [stops, day]);
  /** Too much for one ask: the server would refuse it, so it is not offered. */
  const tooLong = days.length > DAY_EDIT_MAX_DAYS;
  const tooFull = dayStops.length > DAY_EDIT_MAX_STOPS;
  const filled = days.filter((d) => stops.some((s) => s.day_date === d));

  const chooseDay = (next: string | null) => {
    setDay(next);
    setPicked(new Set(next ? stopsOfDay(stops, next).map((s) => s.id) : []));
    setProposal(null);
    setAsks([]);
    setRefining(false);
    setProblem("");
  };

  // Opening starts on the day it was opened from, else the first with stops.
  useEffect(() => {
    if (!open) return;
    const start =
      initialDay && filled.includes(initialDay)
        ? initialDay
        : filled.length === 1
          ? filled[0]!
          : null;
    chooseDay(start);
    setText(initialAsk ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on opening only
  }, [open, initialDay, initialAsk]);

  // Béa checks the weather herself: every upcoming day with stops, at the
  // middle of its stops or town, so a rainy day is flagged before it is picked.
  const spots = open
    ? filled.flatMap((d) => {
        const now = new Date();
        const reach = new Date(now.getTime() + FORECAST_DAYS * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const at = d <= reach && rainDayMayBeAhead(d, now) ? center?.(d) : null;
        return at
          ? [{ day: d, lat: Math.round(at.lat * 100) / 100, lon: Math.round(at.lon * 100) / 100 }]
          : [];
      })
    : [];
  const spotsKey = JSON.stringify(spots);
  useEffect(() => {
    let active = true;
    for (const spot of JSON.parse(spotsKey) as typeof spots) {
      if (spot.day in rain) continue;
      rainFor({ data: spot })
        .then((forecast) => {
          if (!active) return;
          setRain((cur) => ({
            ...cur,
            [spot.day]: forecast ? rainNotice(forecast, spot.day, new Date()) : "unknown",
          }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per set of days
  }, [spotsKey]);
  const known = (d: string) => {
    const notice = rain[d];
    return notice === "unknown" ? undefined : notice;
  };
  const dayRain = day ? known(day) : undefined;
  const rainAsk = (notice: RainNotice) =>
    `Rain is forecast ${notice.until ? `from ${notice.from} to ${notice.until}` : `from ${notice.from}`}: swap the outdoor stops in that time for indoor places nearby.`;

  const dayName = (d: string | null) => {
    if (!d) return "No date";
    const index = days.indexOf(d);
    return index < 0 ? formatTimelineDayLabel(d) : `Day ${index + 1}`;
  };

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = dayStops.length > 0 && dayStops.every((s) => picked.has(s.id));

  /**
   * Look Béa's new places up on the map, in the day's town, beside its
   * stops. A place found under a doubtful name is still added, unpinned,
   * with a note to check it; one not found is added without a pin.
   */
  const findPlaces = async (plan: DayEditPlan, onDay: string): Promise<Record<string, Found>> => {
    const fresh = plan.order.filter((row) => row.fresh);
    const town = area?.(onDay);
    if (fresh.length === 0 || !town) return {};
    setPlacing(true);
    try {
      const result = await place({
        data: {
          stops: fresh.map((row) => ({
            title: row.fresh!.title,
            place: row.fresh!.title,
            address: row.fresh!.address,
            area: town,
          })),
          area: town,
          venues: true,
          near: center?.(onDay) ?? null,
        },
      });
      const found: Record<string, Found> = {};
      for (const hit of result.placed) {
        const row = fresh[hit.index];
        if (!row) continue;
        const { confidence, reason } = scoreMatch({
          title: hit.matchedAs ?? row.fresh!.title,
          label: hit.label ?? null,
          category: hit.category ?? null,
          kind: hit.kind ?? null,
          alsoNamed: hit.alsoNamed ?? null,
        });
        found[row.id] = {
          lat: hit.lat,
          lon: hit.lon,
          ...(hit.label ? { label: hit.label } : {}),
          confidence: hit.farKm ? "low" : confidence,
          reason: hit.farKm ? `${hit.farKm} km from the middle of town` : reason,
        };
      }
      return found;
    } catch {
      // The places are still worth showing: they go in without a pin.
      return {};
    } finally {
      setPlacing(false);
    }
  };

  const run = async (nextAsks: string[]) => {
    if (!day) return;
    const stopIds = dayStops.filter((s) => picked.has(s.id)).map((s) => s.id);
    if (tooLong || tooFull) return;
    if (stopIds.length === 0) {
      setProblem("Tick at least one stop Béa may change.");
      return;
    }
    setBusy(true);
    setProblem("");
    const basis = dayKey(dayStops);
    try {
      // The server reads the day itself; only which day, which stops, the
      // words, and the day's town and middle (for its places and weather) go.
      const near = center?.(day) ?? null;
      const plan = await ask({
        data: {
          tripId,
          day,
          stopIds,
          request: joinAsks(nextAsks),
          area: area?.(day) ?? null,
          near,
        },
      });
      if (!dayEditChanges(plan, dayStops)) {
        setProblem(plan.reply || "Béa didn't find anything to change for that.");
        return;
      }
      const found = await findPlaces(plan, day);
      setAsks(nextAsks);
      setSkipped(new Set());
      setProposal({ plan, basis, found, picked: new Set(stopIds) });
      setRefining(false);
      setText("");
    } catch (err) {
      setProblem(readableError(err) ?? "Béa couldn't answer just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal || !day) return;
    // Someone changed the day since Béa read it: ask again rather than apply
    // her version of the old day to the new.
    if (dayKey(dayStops) !== proposal.basis) {
      setProposal(null);
      setProblem("This day changed since Béa suggested this. Ask again.");
      return;
    }
    const plan = {
      ...proposal.plan,
      order: proposal.plan.order.filter((row) => !skipped.has(row.id)),
    };
    const { updates, added } = dayEditSchedule(plan, stops, day);
    setBusy(true);
    try {
      await onApply({
        updates,
        added: added.map((row) => {
          const hit = proposal.found[row.key];
          const pinned = hit && hit.confidence !== "low" ? hit : undefined;
          const note = pinCheckNote(hit, Boolean(pinned));
          const address = row.address || labelAddress(hit?.label);
          return {
            day_date: day,
            ...(row.time_label ? { time_label: row.time_label } : {}),
            kind: row.kind,
            title: row.title,
            ...(row.why ? { detail: row.why } : {}),
            ...(address ? { address } : {}),
            ...(pinned ? { lat: pinned.lat, lon: pinned.lon } : {}),
            ...(note ? { pin_check: note } : {}),
            position: row.position,
          };
        }),
        summary: proposal.plan.reply || `${dayName(day)} changed`,
      });
      onClose();
    } catch {
      setProblem("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground"
    }`;

  const askBox = (label: string, placeholder: string, onSend: () => void, send: string) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <label
        htmlFor="day-edit-ask"
        className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id="day-edit-ask"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={DAY_EDIT_MAX_ASK}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[16px]"
      />
      <button
        type="submit"
        disabled={busy || !text.trim() || picked.size === 0 || tooLong || tooFull}
        className="mt-2 min-h-11 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {placing ? "Finding the new places on the map…" : busy ? "Béa is reworking the day…" : send}
      </button>
    </form>
  );

  const rows = proposal ? dayEditRows(proposal.plan, dayStops) : [];
  const awayStops = proposal
    ? proposal.plan.away.flatMap((row) => {
        const stop = dayStops.find((s) => s.id === row.id);
        return stop ? [{ stop, to: row.day_date, why: row.why }] : [];
      })
    : [];

  const weatherCard = day && dayRain !== undefined && (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ${
        dayRain ? "bg-primary-soft" : "bg-card"
      }`}
    >
      {dayRain ? (
        <CloudRain className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <Sun className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      )}
      <span className="min-w-0">
        {dayRain
          ? `Rain likely on ${dayName(day)} ${
              dayRain.until ? `from ${dayRain.from} to ${dayRain.until}` : `from ${dayRain.from}`
            } (${dayRain.chance}%). Béa will plan around it.`
          : `No rain expected on ${dayName(day)}.`}{" "}
        <span className="text-[10px] text-muted-foreground">{WEATHER_ATTRIBUTION}</span>
        {dayRain && !proposal && (
          <button
            type="button"
            onClick={() => setText(rainAsk(dayRain))}
            className="mt-1 block min-h-8 text-[13px] font-semibold text-primary underline underline-offset-2"
          >
            Swap outdoor stops for indoor places
          </button>
        )}
      </span>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={proposal ? `${dayName(day)}: before and after` : "Change a day"}
      hint={
        proposal
          ? "Nothing is saved until you use Béa's version"
          : "Pick a day, the stops, and what you'd like"
      }
      {...(proposal ? { onBack: () => setProposal(null) } : {})}
      width="lg"
      tall
      page
      tone={1}
    >
      {!proposal ? (
        <div className="space-y-4">
          <div>
            <p className="label-caps mb-1.5">1 · Which day?</p>
            {filled.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                No day has stops yet. Add a few, then come back.
              </p>
            ) : (
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
                {days.map((d, i) => {
                  const count = stops.filter((s) => s.day_date === d).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={d === day}
                      disabled={busy}
                      onClick={() => chooseDay(d)}
                      className={chip(d === day)}
                    >
                      Day {i + 1} · {formatTimelineDayLabel(d)} · {count}
                      {known(d) && (
                        <CloudRain className="ml-1 inline size-3.5" aria-label="Rain likely" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {weatherCard}

          {(tooLong || (day && tooFull)) && (
            <p className="rounded-xl bg-card px-3 py-2 text-[13px] text-muted-foreground">
              {tooLong
                ? `This trip has more than ${DAY_EDIT_MAX_DAYS} days, too long for Béa to rework a day of it. Move stops one by one.`
                : `This day has more than ${DAY_EDIT_MAX_STOPS} stops, too many for Béa in one go. Move stops one by one.`}
            </p>
          )}

          {day && dayStops.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="label-caps">2 · Which stops may change?</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPicked(allPicked ? new Set() : new Set(dayStops.map((s) => s.id)))
                  }
                  className="text-[13px] font-semibold text-primary underline underline-offset-2"
                >
                  {allPicked ? "Clear" : "Select all"}
                </button>
              </div>
              <ul className="space-y-1">
                {dayStops.map((stop) => (
                  <li key={stop.id}>
                    <label
                      className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-[14px] ${
                        picked.has(stop.id)
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-card"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(stop.id)}
                        disabled={busy}
                        onChange={() => toggle(stop.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                        {stop.time_label ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{stop.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Unticked stops keep their time and stay on this day.
              </p>
            </div>
          )}

          {day && dayStops.length > 0 && (
            <div className="space-y-2">
              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setText((cur) => (cur.trim() ? `${cur.trim()}. ${idea}` : idea))}
                    className="min-h-8 shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3 text-[12.5px]"
                  >
                    {idea}
                  </button>
                ))}
              </div>
              {askBox(
                "3 · What would you like to change?",
                "e.g. it'll rain after 2pm, find a café for lunch, swap the park for a museum",
                () => void run([text]),
                "Show me Béa's version",
              )}
            </div>
          )}
          {problem && <p className="text-[13px] text-destructive">{problem}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {weatherCard}
          {proposal.plan.reply && (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-[13.5px] text-foreground">
              {proposal.plan.reply}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <section aria-label="Now" className="min-w-0">
              <p className="label-caps mb-1.5">Now</p>
              <ol className="space-y-1">
                {dayStops.map((stop) => {
                  const leaving = awayStops.some((a) => a.stop.id === stop.id);
                  return (
                    <li
                      key={stop.id}
                      className={`rounded-lg border border-border/70 bg-card px-2 py-1.5 ${
                        leaving ? "opacity-60" : ""
                      }`}
                    >
                      <p className="text-[11.5px] tabular-nums text-muted-foreground">
                        {stop.time_label ?? "No time"}
                      </p>
                      <p
                        className={`break-words text-[13.5px] font-medium ${leaving ? "line-through" : ""}`}
                      >
                        {stop.title}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section aria-label="Béa's version" className="min-w-0">
              <p className="label-caps mb-1.5 text-primary">Béa&apos;s version</p>
              <ol className="space-y-1">
                {rows.map((row) => {
                  if (row.fresh) {
                    const off = skipped.has(row.id);
                    const hit = proposal.found[row.id];
                    const pinned = hit && hit.confidence !== "low";
                    return (
                      <li
                        key={row.id}
                        className={`rounded-lg border border-primary bg-primary-soft px-2 py-1.5 ${
                          off ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[11.5px] tabular-nums text-muted-foreground">
                            {row.time_label ?? "No time"}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setSkipped((cur) => {
                                const next = new Set(cur);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              })
                            }
                            aria-label={off ? `Add ${row.title} back` : `Leave out ${row.title}`}
                            className="-m-1 rounded p-1 text-muted-foreground"
                          >
                            {off ? (
                              <span className="text-[11px] font-semibold text-primary">Undo</span>
                            ) : (
                              <X className="size-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                        <p
                          className={`break-words text-[13.5px] font-medium ${off ? "line-through" : ""}`}
                        >
                          {row.title}
                        </p>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                          New
                        </p>
                        {row.why && (
                          <p className="break-words text-[12px] text-muted-foreground">{row.why}</p>
                        )}
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          {pinned
                            ? "On the map"
                            : hit
                              ? "Check its pin later"
                              : "Not on the map yet"}
                        </p>
                      </li>
                    );
                  }
                  const changed = row.moved || row.retimed;
                  return (
                    <li
                      key={row.id}
                      className={`rounded-lg border px-2 py-1.5 ${
                        changed ? "border-primary/40 bg-primary-soft" : "border-border/70 bg-card"
                      }`}
                    >
                      <p className="flex items-center gap-1 text-[11.5px] tabular-nums text-muted-foreground">
                        <span className={row.retimed ? "font-semibold text-primary" : ""}>
                          {row.time_label ?? "No time"}
                        </span>
                        {!proposal.picked.has(row.id) && (
                          <Lock className="size-3" aria-label="Kept" />
                        )}
                      </p>
                      <p className="break-words text-[13.5px] font-medium">{row.title}</p>
                      {changed && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {[row.moved && "Moved", row.retimed && "New time"]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {changed && row.why && (
                        <p className="break-words text-[12px] text-muted-foreground">{row.why}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
              {awayStops.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {awayStops.map(({ stop, to, why }) => (
                    <li
                      key={stop.id}
                      className="rounded-lg border border-dashed border-border px-2 py-1.5 text-[12.5px]"
                    >
                      <span className="font-medium">{stop.title}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        <ArrowRight className="inline size-3" aria-hidden />{" "}
                        {to ? dayName(to) : "Set aside under No date"}
                      </span>
                      {why && (
                        <span className="block text-[12px] text-muted-foreground">{why}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {problem && <p className="text-[13px] text-destructive">{problem}</p>}

          {refining ? (
            askBox(
              "What should Béa change?",
              "e.g. keep the Louvre first, but lunch later",
              () => void run([...asks, text]),
              "Ask again",
            )
          ) : (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check className="size-4" aria-hidden />
                {busy ? "Saving…" : "Use Béa's version"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setText("");
                    setProblem("");
                    setRefining(true);
                  }}
                  className="min-h-11 rounded-xl border border-border bg-card text-[14px] font-semibold"
                >
                  Change something
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setProposal(null);
                    setAsks([]);
                    setProblem("");
                  }}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[14px] font-semibold text-muted-foreground"
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
