import type { HomeSectionKey } from "../hooks/useHomeLayout.ts";
import type { ModuleLayout, WidgetSize } from "./module-layout.ts";

/** Only sizes that leave room for the module's existing content and actions. */
export const HOME_WIDGET_SIZES: Record<HomeSectionKey, readonly [WidgetSize, ...WidgetSize[]]> = {
  trip: ["large"],
  stops: ["wide", "large"],
  suggested: ["wide", "large"],
  saved: ["small", "wide", "large"],
  now: ["wide", "large"],
  group: ["small", "wide", "large"],
  tools: ["large"],
  weatherThere: ["wide", "small", "large"],
  detour: ["wide", "large"],
  notes: ["wide", "large"],
  weather: ["wide", "small", "large"],
  waiting: ["wide", "large"],
  future: ["wide", "large"],
};

export function normalizeHomeWidgets(
  layout: ModuleLayout<HomeSectionKey>,
): ModuleLayout<HomeSectionKey> {
  const sizes: Partial<Record<HomeSectionKey, WidgetSize>> = {};
  for (const key of layout.order) {
    const allowed = HOME_WIDGET_SIZES[key];
    const saved = layout.sizes?.[key];
    sizes[key] = saved && allowed.includes(saved) ? saved : allowed[0];
  }
  return { ...layout, sizes };
}

export const widgetSpan = (size: WidgetSize) => ({
  columns: size === "small" ? 1 : 2,
  rows: size === "large" ? 2 : 1,
});

/** Row-major packing without backfilling holes: visual and keyboard order agree. */
export function homeWidgetCells(
  keys: readonly HomeSectionKey[],
  sizes: ModuleLayout<HomeSectionKey>["sizes"],
) {
  let row = 1;
  let column = 1;
  return keys.map((key) => {
    const size = sizes?.[key] ?? HOME_WIDGET_SIZES[key][0];
    const span = widgetSpan(size);
    if (column + span.columns > 3) {
      row++;
      column = 1;
    }
    const cell = { key, size, row, column, ...span };
    column += span.columns;
    if (column > 2) {
      row += span.rows;
      column = 1;
    }
    return cell;
  });
}
