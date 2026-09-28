/**
 * Trip documents: bookings, confirmations, tickets and trip files in one
 * place. Pure — sorting, filtering, naming and labels — so it is tested.
 * The rows come from `public.trip_documents` (see its migration).
 */

export const DOCUMENT_KINDS = [
  "flight",
  "train",
  "car",
  "accommodation",
  "restaurant",
  "activity",
  "ticket",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABEL: Record<DocumentKind, string> = {
  flight: "Flight",
  train: "Train or bus",
  car: "Car rental",
  accommodation: "Accommodation",
  restaurant: "Restaurant",
  activity: "Activity",
  ticket: "Ticket",
  other: "Other",
};

/** The filter chips, in the master's order. */
export const DOCUMENT_GROUPS = [
  "all",
  "bookings",
  "transport",
  "accommodation",
  "activities",
  "other",
] as const;
export type DocumentGroup = (typeof DOCUMENT_GROUPS)[number];

export const GROUP_LABEL: Record<DocumentGroup, string> = {
  all: "All",
  bookings: "Bookings",
  transport: "Transport",
  accommodation: "Accommodation",
  activities: "Activities",
  other: "Other",
};

export function inGroup(kind: string, group: DocumentGroup): boolean {
  const k = asKind(kind);
  switch (group) {
    case "all":
      return true;
    case "bookings":
      return k !== "other";
    case "transport":
      return k === "flight" || k === "train" || k === "car";
    case "accommodation":
      return k === "accommodation";
    case "activities":
      return k === "restaurant" || k === "activity" || k === "ticket";
    case "other":
      return k === "other";
  }
}

export function asKind(kind: string | null | undefined): DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(kind ?? "")
    ? (kind as DocumentKind)
    : "other";
}

export type TripDocument = {
  id: string;
  owner_id: string;
  trip_id: string | null;
  itinerary_item_id: string | null;
  kind: string;
  title: string;
  lines: string[];
  reference: string | null;
  notes: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_COLUMNS =
  "id, owner_id, trip_id, itinerary_item_id, kind, title, lines, reference, notes, storage_path, file_name, mime_type, size_bytes, created_at, updated_at";

export const TITLE_MAX = 200;
export const LINE_MAX = 90;
export const LINES_MAX = 2;
export const REFERENCE_MAX = 200;
export const NOTES_MAX = 2000;
/** A booking PDF or a phone photo; a 40 MB scan is a mistake worth catching. */
export const FILE_MAX_BYTES = 20 * 1024 * 1024;

/** The migration ships separately from the deploy — say so rather than erroring. */
export function isMissingDocumentsTable(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const text = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (
    text.includes("trip_documents") &&
    (text.includes("does not exist") ||
      text.includes("schema cache") ||
      text.includes("could not find"))
  );
}

/** What the row's icon shows: a PDF page, the picture itself, or a document. */
export type FileLook = "pdf" | "image" | "doc" | "none";

export function fileLook(doc: {
  storage_path: string | null;
  mime_type: string | null;
  file_name: string | null;
}): FileLook {
  if (!doc.storage_path) return "none";
  const mime = (doc.mime_type ?? "").toLowerCase();
  const ext = extensionOf(doc.file_name ?? doc.storage_path);
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext))
    return "image";
  return "doc";
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/**
 * Where a file goes: the owner's folder of the private photo-memories bucket.
 * The migration requires the "<uid>/doc-" prefix; only a short, plain
 * extension survives from the traveller's own file name.
 */
export function storagePathFor(uid: string, id: string, fileName: string): string {
  const ext = extensionOf(fileName);
  return `${uid}/doc-${id}${ext ? `.${ext}` : ""}`;
}

/** "Flight_confirmation-AC872.pdf" → "Flight confirmation AC872". */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{1,8}$/i, "");
  const words = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words || /^(img|image|scan|photo|dsc|pxl)\s?\d*$/i.test(words.replace(/\s/g, ""))) {
    return "";
  }
  const text = words.slice(0, TITLE_MAX);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const KIND_HINTS: [DocumentKind, RegExp][] = [
  ["flight", /\b(flight|boarding|airline|e-?ticket|itinerary receipt|air)\b/i],
  ["train", /\b(train|rail|sncf|eurostar|amtrak|via rail|bus|coach|ferry)\b/i],
  ["car", /\b(car|rental|hertz|avis|europcar|enterprise|sixt)\b/i],
  ["accommodation", /\b(hotel|airbnb|hostel|stay|booking\.com|apartment|b&b|inn|lodge)\b/i],
  ["restaurant", /\b(restaurant|dinner|lunch|table|resy|opentable|reservation)\b/i],
  ["ticket", /\b(ticket|tickets|pass|admission|entry)\b/i],
  ["activity", /\b(tour|museum|excursion|class|activity|show|concert)\b/i],
];

/** A first guess from a file name or title; the traveller can change it. */
export function guessKind(text: string): DocumentKind {
  for (const [kind, rx] of KIND_HINTS) if (rx.test(text)) return kind;
  return "other";
}

/** Trimmed, capped, empties dropped, at most LINES_MAX. */
export function cleanLines(lines: readonly string[]): string[] {
  return lines
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, LINE_MAX))
    .filter(Boolean)
    .slice(0, LINES_MAX);
}

export function cleanText(value: string, max: number): string | null {
  const text = value.trim().slice(0, max);
  return text ? text : null;
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(
  doc: Pick<TripDocument, "title" | "lines" | "reference" | "notes" | "file_name">,
  query: string,
): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold(
    [doc.title, ...doc.lines, doc.reference ?? "", doc.notes ?? "", doc.file_name ?? ""].join(" "),
  );
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export type LibraryView = "all" | "trip" | "unassigned";
export type SortOrder = "newest" | "oldest" | "title";

export function filterDocuments<T extends TripDocument>(
  docs: readonly T[],
  opts: {
    view: LibraryView;
    tripId?: string | null;
    group: DocumentGroup;
    query: string;
    sort?: SortOrder;
  },
): T[] {
  const out = docs.filter((d) => {
    if (opts.view === "unassigned" && d.trip_id) return false;
    if (opts.view === "trip" && d.trip_id !== (opts.tripId ?? null)) return false;
    return inGroup(d.kind, opts.group) && matchesQuery(d, opts.query);
  });
  return sortDocuments(out, opts.sort ?? "newest");
}

export function sortDocuments<T extends Pick<TripDocument, "created_at" | "title">>(
  docs: T[],
  sort: SortOrder,
): T[] {
  const copy = [...docs];
  if (sort === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "oldest") copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
  else copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return copy;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function localDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

/** "Added today", "Added yesterday", "Added 3 days ago", "Added 14 Apr". */
export function addedLabel(createdAt: string, now: Date = new Date()): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  const days = localDay(now) - localDay(at);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 7) return `Added ${days} days ago`;
  const year = at.getFullYear() === now.getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `Added ${at.getDate()} ${MONTHS[at.getMonth()]}${year}`;
}

/** "Added 1 Apr 2026, 10:24", in the device's time zone. */
export function addedFull(createdAt: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `Added ${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}, ${hh}:${mm}`;
}

/** "12 – 19 Apr 2026", "30 Apr – 3 May 2026", or "" without dates. */
export function tripDatesLabel(start: string | null, end: string | null): string {
  const s = parseIso(start);
  const e = parseIso(end ?? start);
  if (!s) return "";
  if (!e || (s.y === e.y && s.m === e.m && s.d === e.d)) return `${s.d} ${MONTHS[s.m]} ${s.y}`;
  if (s.y === e.y && s.m === e.m) return `${s.d} – ${e.d} ${MONTHS[e.m]} ${e.y}`;
  if (s.y === e.y) return `${s.d} ${MONTHS[s.m]} – ${e.d} ${MONTHS[e.m]} ${e.y}`;
  return `${s.d} ${MONTHS[s.m]} ${s.y} – ${e.d} ${MONTHS[e.m]} ${e.y}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon, 14 Apr · 09:00" for a stop, from its day and time label. */
export function eventWhenLabel(day: string | null, time: string | null): string {
  const d = parseIso(day);
  const date = d
    ? `${WEEKDAYS[new Date(Date.UTC(d.y, d.m, d.d)).getUTCDay()]}, ${d.d} ${MONTHS[d.m]}`
    : "";
  return [date, (time ?? "").trim()].filter(Boolean).join(" · ");
}

function parseIso(v: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

/**
 * Which trip the By trip view opens on: the current one, else the next, else
 * the most recent, among trips that have documents when any do.
 */
export function defaultTripId(
  trips: readonly { id: string; start_date: string | null; end_date: string | null }[],
  docs: readonly { trip_id: string | null }[],
  today: string,
): string | null {
  if (trips.length === 0) return null;
  const withDocs = new Set(docs.map((d) => d.trip_id).filter(Boolean));
  const pool = trips.some((t) => withDocs.has(t.id))
    ? trips.filter((t) => withDocs.has(t.id))
    : trips;
  const current = pool.find(
    (t) => t.start_date && t.start_date <= today && (t.end_date ?? t.start_date) >= today,
  );
  if (current) return current.id;
  const upcoming = pool
    .filter((t) => t.start_date && t.start_date > today)
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!));
  if (upcoming[0]) return upcoming[0].id;
  const past = pool
    .filter((t) => t.start_date)
    .sort((a, b) => b.start_date!.localeCompare(a.start_date!));
  return (past[0] ?? pool[0])!.id;
}

/** Human file size: "240 KB", "3.2 MB". */
export function fileSizeLabel(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── The lock over the whole of Trip documents ─────────────────────────── */

/** Per account, on this device. Absent means on: the lock is on by default. */
export function lockSettingKey(uid: string): string {
  return `bea.docs.lock.${uid}`;
}

export function lockIsOn(stored: string | null | undefined): boolean {
  return stored !== "off";
}

/** How long the lock stays open after an unlock, while Béa is open. */
export const LOCK_GRACE_MS = 5 * 60 * 1000;

/**
 * Someone who has just signed in has proved who they are, so a forgotten
 * passcode never shuts them out of their own bookings: signing out and in
 * again opens Trip documents (never Protected, which is encrypted).
 */
export function freshSignIn(lastSignInAt: string | null | undefined, now: number): boolean {
  if (!lastSignInAt) return false;
  const at = Date.parse(lastSignInAt);
  return Number.isFinite(at) && now - at >= 0 && now - at < LOCK_GRACE_MS;
}

/** A trip's line under its name: its dates, or else where it goes. */
export function tripLine(trip: {
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
}): string {
  return (
    tripDatesLabel(trip.start_date, trip.end_date) ||
    [trip.city, trip.country].filter(Boolean).join(", ")
  );
}

/** An itinerary stop's kind read as a document kind, for its icon. */
export function eventKind(kind: string): DocumentKind {
  const k = kind.toLowerCase();
  if (/flight|plane|air/.test(k)) return "flight";
  if (/train|bus|transit|ferry|transport/.test(k)) return "train";
  if (/car|drive/.test(k)) return "car";
  if (/hotel|stay|lodging|accommodation|sleep/.test(k)) return "accommodation";
  if (/food|restaurant|meal|cafe|coffee|dinner|lunch|bar/.test(k)) return "restaurant";
  return "activity";
}
