/** Short heading Béa (or a fallback prefix) uses to group packing items. */
export const SECTION_MAX_LEN = 40;

export type PackDraftItem = {
  label: string;
  section?: string | null;
  quantity?: number;
};

export function normalizeSection(section: string | null | undefined): string | null {
  const trimmed = section?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, SECTION_MAX_LEN);
}

export function encodeSectionLabel(section: string | null | undefined, label: string): string {
  const heading = normalizeSection(section);
  const clean = label.trim();
  return heading ? `${heading}: ${clean}` : clean;
}

/**
 * Recover a section that was folded into the label because `packing_items.section`
 * was not on the live database yet. Ignores time-like prefixes ("9:00 ferry").
 */
export function decodeSectionLabel(label: string): { section: string | null; label: string } {
  const match = label.match(/^([^:]{1,40}):\s+(.+)$/);
  if (!match?.[1] || !match[2]) return { section: null, label };
  const heading = match[1].trim();
  if (!heading || /^\d/.test(heading)) return { section: null, label };
  return { section: heading.slice(0, SECTION_MAX_LEN), label: match[2].trim() };
}

export function hydratePackItem<T extends { label: string; section?: string | null }>(
  item: T,
): T & { section: string | null } {
  const fromColumn = normalizeSection(item.section);
  if (fromColumn) return { ...item, section: fromColumn };
  const decoded = decodeSectionLabel(item.label);
  return decoded.section
    ? { ...item, section: decoded.section, label: decoded.label }
    : { ...item, section: null };
}

export function asDraftItems(starter: Array<string | PackDraftItem>): PackDraftItem[] {
  return starter.map((row) => (typeof row === "string" ? { label: row } : row));
}

export function groupPackItems<T extends { section?: string | null; position: number }>(
  items: T[],
): Array<{ section: string | null; items: T[] }> {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const order: string[] = [];
  const bySection = new Map<string, T[]>();
  const unsectioned: T[] = [];

  for (const item of sorted) {
    const heading = normalizeSection(item.section);
    if (!heading) {
      unsectioned.push(item);
      continue;
    }
    const existing = bySection.get(heading);
    if (existing) {
      existing.push(item);
    } else {
      bySection.set(heading, [item]);
      order.push(heading);
    }
  }

  const groups: Array<{ section: string | null; items: T[] }> = order.map((section) => ({
    section,
    items: bySection.get(section) ?? [],
  }));
  if (unsectioned.length) groups.push({ section: null, items: unsectioned });
  return groups;
}

export function isMissingSectionColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes("section") && (text.includes("does not exist") || text.includes("schema cache"));
}
