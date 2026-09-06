import { haversine, isLatLon, type LatLon } from "./geo.ts";

export type Setting = "indoor" | "outdoor" | "mixed";

export type ItemLabel = {
  title: string;
  setting: Setting;
  durationHours: number;
};

export type MetricItem = {
  day_date: string | null;
  title: string;
  estimated_cost: number | null;
  lat?: number | null;
  lon?: number | null;
};

export type ComputedMetrics = {
  stopCount: number;
  estimatedCost: number;
  indoorShare: number | null;
  activeHoursPerDay: number | null;
  walkingKmPerDay: number | null;
  transitMinutesPerDay: number | null;
  longestTravelLegMinutes: number | null;
};

function dayCount(items: MetricItem[]): number {
  const days = new Set(items.map((item) => item.day_date).filter(Boolean));
  return Math.max(1, days.size || 1);
}

function settingScore(setting: Setting): number {
  if (setting === "indoor") return 1;
  if (setting === "mixed") return 0.5;
  return 0;
}

export function computeItineraryMetrics(
  items: MetricItem[],
  costLines: { amount: number }[],
  labels: ItemLabel[],
): ComputedMetrics {
  const days = dayCount(items);
  const labeled = labels.filter((label) => Number.isFinite(label.durationHours));
  const hours = labeled.reduce((sum, label) => sum + Math.max(0, label.durationHours), 0);
  const indoor =
    labeled.length > 0
      ? labeled.reduce((sum, label) => sum + settingScore(label.setting), 0) / labeled.length
      : null;

  const points: (LatLon | null)[] = items.map((item) =>
    isLatLon({ lat: item.lat ?? null, lon: item.lon ?? null })
      ? { lat: item.lat!, lon: item.lon! }
      : null,
  );
  const consecutive = points.length > 1 && points.every(Boolean);
  let walkingKmPerDay: number | null = null;
  if (consecutive) {
    let metres = 0;
    for (let i = 0; i < points.length - 1; i++) {
      metres += haversine(points[i]!, points[i + 1]!);
    }
    walkingKmPerDay = Math.round((metres / days / 1000) * 10) / 10;
  }

  return {
    stopCount: items.length,
    estimatedCost: Math.round(costLines.reduce((sum, line) => sum + line.amount, 0)),
    indoorShare: indoor == null ? null : Math.round(indoor * 100) / 100,
    activeHoursPerDay: labeled.length ? Math.round((hours / days) * 10) / 10 : null,
    walkingKmPerDay,
    // Transit and longest-leg need routed times. Do not invent them from a straight line.
    transitMinutesPerDay: null,
    longestTravelLegMinutes: null,
  };
}

export function formatPlanForCompare(
  label: string,
  items: { day_date: string | null; time_label: string | null; kind: string; title: string; detail: string | null }[],
): string {
  if (!items.length) return `${label}: (no stops parsed)`;
  return [
    `${label} — ${items.length} stops:`,
    ...items.map(
      (item, i) =>
        `${i + 1}. ${item.day_date ?? "no date"} ${item.time_label ?? ""} · ${item.kind} · ${item.title}${
          item.detail ? ` (${item.detail})` : ""
        }`,
    ),
  ].join("\n");
}
