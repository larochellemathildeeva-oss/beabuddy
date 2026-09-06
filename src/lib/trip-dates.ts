import { format } from "date-fns";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DatesStatus = "tentative" | "confirmed";

export function parseDatesStatus(value: string | null | undefined): DatesStatus | undefined {
  return value === "tentative" || value === "confirmed" ? value : undefined;
}

/** Existing trips without a stored value read as confirmed. */
export function datesStatusOrDefault(value: string | null | undefined): DatesStatus {
  return parseDatesStatus(value) ?? "confirmed";
}

export function isMissingDatesStatusColumn(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes("dates_status") && (text.includes("does not exist") || text.includes("schema cache"));
}

/** Parse a YYYY-MM-DD value as a local calendar day (not UTC midnight). */
export function parseLocalDate(value: string): Date | undefined {
  const match = ISO_DATE.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** One-field label, e.g. "Sep 12 – Sep 14, 2026". */
export function formatDateRangeLabel(start: string, end: string): string {
  const from = start ? parseLocalDate(start) : undefined;
  const to = end ? parseLocalDate(end) : undefined;
  if (from && to) {
    if (from.getTime() === to.getTime()) return format(from, "MMM d, yyyy");
    if (from.getFullYear() === to.getFullYear()) {
      return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
    }
    return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  }
  if (from) return format(from, "MMM d, yyyy");
  if (to) return format(to, "MMM d, yyyy");
  return "";
}
