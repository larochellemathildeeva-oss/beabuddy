/** Short heading Béa (or a fallback prefix) uses to group packing items. */
export const SECTION_MAX_LEN = 40;

export type PackDraftItem = {
  label: string;
  section?: string | null;
  quantity?: number;
  packed?: boolean;
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

export function isMissingSectionColumn(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return (
    text.includes("section") && (text.includes("does not exist") || text.includes("schema cache"))
  );
}

/** What kind of heading a section is, so the list can give it a matching icon. */
export type SectionKind =
  | "clothes"
  | "toiletries"
  | "electronics"
  | "documents"
  | "medication"
  | "beach"
  | "cold"
  | "work"
  | "travel"
  | "other";

/** Headings offered when adding an item to a list that has none of its own yet. */
export const DEFAULT_SECTIONS = [
  "Clothes",
  "Toiletries",
  "Electronics",
  "Documents",
  "Medication",
  "Other",
] as const;

const CANONICAL: Record<Exclude<SectionKind, "other">, string> = {
  clothes: "Clothes",
  toiletries: "Toiletries",
  electronics: "Electronics",
  documents: "Documents",
  medication: "Medication",
  beach: "Beach",
  cold: "Cold weather",
  work: "Work",
  travel: "Travel",
};

/** Words in a section heading that say what kind it is. Checked in order. */
const HEADING_WORDS: Array<[Exclude<SectionKind, "other">, RegExp]> = [
  ["clothes", /\b(cloth|wear|outfit|shoe|footwear|wardrobe|vêtement)/],
  ["toiletries", /\b(toilet|personal care|hygiene|beauty|bathroom|wash|care)/],
  ["electronics", /\b(electr|tech|gadget|charg|device)/],
  ["documents", /\b(doc|ids?\b|papers|passport|money|essential|wallet)/],
  ["medication", /\b(medic|health|pharma|first aid|pill)/],
  ["beach", /\b(beach|swim|sun|pool)/],
  ["cold", /\b(cold|ski|snow|winter)/],
  ["work", /\b(work|business|office)/],
  ["travel", /\b(travel|airplane|plane|flight|bus|train|car|transit|journey|hotel)/],
];

/** Words in an item that say which section it belongs in. Checked in order. */
const ITEM_WORDS: Array<[Exclude<SectionKind, "other">, RegExp]> = [
  [
    "documents",
    /\b(passport|visa|id\b|licen[cs]e|ticket|boarding|insurance|cash|card|wallet|booking|itinerary)/,
  ],
  [
    "medication",
    /\b(medic|pill|paracetamol|ibuprofen|plaster|bandage|first aid|inhaler|prescription|vitamin)/,
  ],
  [
    "electronics",
    /\b(phone|charger|cable|adapter|adaptor|laptop|tablet|headphone|earbud|earphone|camera|power ?bank|kindle|e-?reader|plug|battery|batteries|usb)/,
  ],
  ["cold", /\b(ski|goggle|thermal|glove|mitten|scarf|beanie|hand ?warmer|snow)/],
  ["beach", /\b(swim|bikini|sunscreen|sun ?cream|after-?sun|beach|flip ?flop|snorkel|sunglasses)/],
  [
    "toiletries",
    /\b(tooth|brush|paste|deodorant|shampoo|conditioner|soap|razor|shav|makeup|make-up|moisturi[sz]er|lip ?balm|floss|comb|perfume|cologne|contact lens|towel|skincare|cream)/,
  ],
  [
    "clothes",
    /\b(shirt|t-?shirt|tshirt|top|trouser|pant|jean|short|dress|skirt|sock|underwear|bra|pyjama|pajama|jacket|coat|sweater|jumper|hoodie|hat|cap|shoe|boot|sneaker|trainer|sandal|belt|blazer|legging|clothes|outfit)/,
  ],
  ["work", /\b(notebook|pen\b|business card|badge|lanyard|folder)/],
  ["travel", /\b(neck pillow|eye mask|ear ?plug|luggage|suitcase|backpack|bottle|snack)/],
];

export function sectionKind(section: string | null | undefined): SectionKind {
  const text = normalizeSection(section)?.toLowerCase();
  if (!text) return "other";
  for (const [kind, words] of HEADING_WORDS) if (words.test(text)) return kind;
  return "other";
}

/**
 * The section an item most likely belongs in: one the list already has when
 * it is the same kind, otherwise a default heading. Null when nothing fits.
 */
export function guessSection(label: string, existing: Array<string | null> = []): string | null {
  const text = label.trim().toLowerCase();
  if (!text) return null;
  const hit = ITEM_WORDS.find(([, words]) => words.test(text));
  if (!hit) return null;
  const [kind] = hit;
  const own = existing.find((s) => s && sectionKind(s) === kind);
  return own ?? CANONICAL[kind];
}

/** The headings to offer when adding an item: the list's own, then defaults it lacks. */
export function sectionChoices(existing: Array<string | null>): string[] {
  const own = uniqueSections(existing);
  const kinds = new Set(own.map((s) => sectionKind(s)));
  const lower = new Set(own.map((s) => s.toLowerCase()));
  const extra = DEFAULT_SECTIONS.filter((s) => {
    if (lower.has(s.toLowerCase())) return false;
    const kind = sectionKind(s);
    return kind === "other" || !kinds.has(kind);
  });
  return [...own, ...extra];
}

export function uniqueSections(sections: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sections) {
    const s = normalizeSection(raw);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

/** An item as it stands in an unsaved edit of a list. `id` is absent for new ones. */
export type PackEditItem = {
  key: string;
  id?: string;
  label: string;
  section: string | null;
  quantity: number;
  packed: boolean;
};

type SavedItem = {
  id: string;
  label: string;
  section: string | null;
  quantity: number;
  packed: boolean;
  position: number;
};

export type PackEditDiff = {
  removed: string[];
  added: Array<Omit<PackEditItem, "key" | "id"> & { position: number }>;
  updated: Array<{
    id: string;
    patch: Partial<Pick<SavedItem, "label" | "section" | "quantity" | "packed" | "position">>;
  }>;
};

/** What to write so the saved list matches the edited one. Order is the edit's order. */
export function diffPackEdit(saved: SavedItem[], edited: PackEditItem[]): PackEditDiff {
  const byId = new Map(saved.map((item) => [item.id, item]));
  const kept = new Set<string>();
  const added: PackEditDiff["added"] = [];
  const updated: PackEditDiff["updated"] = [];

  edited.forEach((item, position) => {
    const section = normalizeSection(item.section);
    const label = item.label.trim();
    const quantity = item.quantity > 1 ? item.quantity : 1;
    const before = item.id ? byId.get(item.id) : undefined;
    if (!before) {
      if (label) added.push({ label, section, quantity, packed: item.packed, position });
      return;
    }
    kept.add(before.id);
    const patch: PackEditDiff["updated"][number]["patch"] = {};
    if (label && label !== before.label) patch.label = label;
    if (section !== normalizeSection(before.section)) patch.section = section;
    if (quantity !== before.quantity) patch.quantity = quantity;
    if (item.packed !== before.packed) patch.packed = item.packed;
    if (position !== before.position) patch.position = position;
    if (Object.keys(patch).length) updated.push({ id: before.id, patch });
  });

  const removed = saved.filter((item) => !kept.has(item.id)).map((item) => item.id);
  return { removed, added, updated };
}

export function hasPackEdits(diff: PackEditDiff): boolean {
  return diff.removed.length > 0 || diff.added.length > 0 || diff.updated.length > 0;
}
