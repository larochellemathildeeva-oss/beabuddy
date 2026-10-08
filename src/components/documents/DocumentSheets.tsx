import { useEffect, useRef, useState, type ReactNode } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { Sheet } from "@/components/Sheet";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FilePdf,
  FileText,
  FolderOpen,
  Link2,
  Pencil,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlink,
} from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { BookingFields } from "@/components/documents/BookingDetail";
import {
  KindIcon,
  KindTile,
  LinkRow,
  TripThumb,
  type TripLite,
} from "@/components/documents/DocumentParts";
import { useTripEvents, type EventOption } from "@/hooks/useTripDocuments";
import { aiFailure } from "@/lib/ai-errors";
import {
  PASTED_TEXT_MAX,
  cleanPastedText,
  readableAs,
  stopForRead,
  tripForDate,
  type DocumentRead,
} from "@/lib/document-read";
import { readDocumentFile } from "@/lib/document-read.functions";
import { downscaleImage } from "@/lib/image";
import { MAX_PDF_BYTES, pdfProblem, type PdfProblem } from "@/lib/itinerary-pdf";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  DOCUMENT_KINDS,
  KIND_LABEL,
  LINE_MAX,
  NOTES_MAX,
  REFERENCE_MAX,
  TITLE_MAX,
  eventWhenLabel,
  type TripDocument,
  eventKind,
  tripLine,
} from "@/lib/trip-documents";

/* ─── Add document ───────────────────────────────────────────────────────── */

function OptionRow({
  icon,
  title,
  subtitle,
  onClick,
  danger = false,
  fill = "tile-fill-2",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  danger?: boolean;
  fill?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left"
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl border border-border/60 ${
          danger ? "bg-destructive/10 text-destructive" : `${fill} text-primary`
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? "text-destructive" : ""}`}>
          {title}
        </span>
        {subtitle && <span className="block text-[13px] text-muted-foreground">{subtitle}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

/**
 * Paste a confirmation's text, take a photo, import a file from the device —
 * or enter the booking without a file. Forwarding by email is a separate
 * project and not offered.
 */
export function AddDocumentSheet({
  open,
  onClose,
  onPick,
  onPaste,
}: {
  open: boolean;
  onClose: () => void;
  /** A chosen file, or null for "Enter details only". */
  onPick: (file: File | null) => void;
  /** "Paste text": the form, with a box for the confirmation's text. */
  onPaste: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const device = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onPick(f);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add document" width="sm">
      <div className="doc-list">
        <OptionRow
          icon={<ClipboardList className="size-5" aria-hidden />}
          title="Paste text"
          subtitle="From a confirmation email or message"
          fill="tile-fill-2"
          onClick={onPaste}
        />
        <OptionRow
          icon={<Camera className="size-5" aria-hidden />}
          title="Take a photo"
          subtitle="Scan a confirmation or ticket"
          fill="tile-fill-3"
          onClick={() => camera.current?.click()}
        />
        <OptionRow
          icon={<FolderOpen className="size-5" aria-hidden />}
          title="Import from device"
          subtitle="Files, photos or downloads"
          fill="tile-fill-4"
          onClick={() => device.current?.click()}
        />
        <OptionRow
          icon={<Pencil className="size-5" aria-hidden />}
          title="Enter details only"
          subtitle="A booking reference without a file"
          fill="tile-fill-5"
          onClick={() => onPick(null)}
        />
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        For bookings, confirmations and tickets. Passports, payment cards and passwords belong in
        Protected.
      </p>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={take}
      />
      <input
        ref={device}
        type="file"
        accept="application/pdf,image/*,.pkpass,.doc,.docx,.txt,.rtf,.html,.eml"
        className="hidden"
        onChange={take}
      />
    </Sheet>
  );
}

/* ─── Pickers ────────────────────────────────────────────────────────────── */

export function TripPicker({
  open,
  onClose,
  trips,
  selected,
  onPick,
  allowNone = true,
}: {
  open: boolean;
  onClose: () => void;
  trips: TripLite[];
  selected: string | null;
  onPick: (tripId: string | null) => void;
  allowNone?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Choose a trip" width="sm" above>
      <div className="doc-list">
        {allowNone && (
          <LinkRow
            media={
              <span className="tile-fill-4 grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 text-primary">
                <FileText className="size-5" aria-hidden />
              </span>
            }
            title="No trip yet"
            line="Keep it unassigned"
            onClick={() => onPick(null)}
            trailing={
              selected === null ? <CheckCircle2 className="size-5 text-primary" /> : undefined
            }
          />
        )}
        {trips.map((t) => (
          <LinkRow
            key={t.id}
            media={<TripThumb trip={t} size="sm" />}
            title={t.title}
            line={tripLine(t)}
            onClick={() => onPick(t.id)}
            trailing={
              selected === t.id ? <CheckCircle2 className="size-5 text-primary" /> : undefined
            }
          />
        ))}
        {trips.length === 0 && (
          <p className="p-4 text-[13.5px] text-muted-foreground">
            No trips yet. Documents can stay unassigned until there is one.
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function EventPicker({
  open,
  onClose,
  events,
  loading,
  selected,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  events: EventOption[];
  loading: boolean;
  selected: string | null;
  onPick: (event: EventOption) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Select event" width="sm" above>
      <div className="doc-list">
        {events.map((e) => (
          <LinkRow
            key={e.id}
            media={<KindTile kind={eventKind(e.kind)} size="sm" />}
            title={e.title}
            line={eventWhenLabel(e.day_date, e.time_label) || "No day set"}
            onClick={() => onPick(e)}
            trailing={
              selected === e.id ? <CheckCircle2 className="size-5 text-primary" /> : undefined
            }
          />
        ))}
        {!loading && events.length === 0 && (
          <p className="p-4 text-[13.5px] text-muted-foreground">
            This trip has no stops yet. Add them on the trip&apos;s itinerary first.
          </p>
        )}
        {loading && <p className="p-4 text-[13.5px] text-muted-foreground">Loading stops…</p>}
      </div>
    </Sheet>
  );
}

/* ─── Assign to trip (and event) ─────────────────────────────────────────── */

export type AssignDraft = {
  title: string;
  kind: string;
  trip_id: string | null;
  itinerary_item_id: string | null;
  notes: string;
  /** New documents only: the two short lines and the booking reference. */
  lines?: string[];
  reference?: string;
};

/** Which fields "Fill in from this file" set, so each can say so until it is edited. */
type FilledField = "title" | "kind" | "lines" | "reference" | "trip" | "event" | "notes";

function FromFile({ show, text = false }: { show: boolean; text?: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 align-middle text-[13px] font-semibold text-primary">
      <Sparkles className="size-3" aria-hidden />
      {text ? "from text" : "from file"}
    </span>
  );
}

/** Why a PDF cannot be read. It can still be saved; only the reading is off. */
const PDF_UNREADABLE: Record<PdfProblem, string> = {
  "not-pdf": "That file isn't a PDF Béa can read. Fill it in by hand.",
  "too-big": `That PDF is over ${MAX_PDF_BYTES / 1024 / 1024} MB, too big for Béa to read. Fill it in by hand.`,
  locked: "That PDF is password-protected, so Béa can't read it. Fill it in by hand.",
  empty: "That PDF is empty. Try saving it again from where it came from.",
};

/** The picked file as the data URL the reader takes: a PDF as is, a photo made smaller. */
async function fileForReading(
  file: File,
  as: "pdf" | "image",
): Promise<{ pdfDataUrl: string | null; imageDataUrl: string | null }> {
  if (as === "image") return { pdfDataUrl: null, imageDataUrl: await downscaleImage(file, 1600) };
  const all = new Uint8Array(await file.arrayBuffer());
  const problem = pdfProblem({
    size: file.size,
    head: all.subarray(0, 4096),
    tail: all.subarray(Math.max(0, all.length - 4096)),
  });
  if (problem) throw new Error(PDF_UNREADABLE[problem]);
  const pdfDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that PDF."));
    reader.readAsDataURL(new Blob([all], { type: "application/pdf" }));
  });
  return { pdfDataUrl, imageDataUrl: null };
}

function FilePreview({ file, kind }: { file: File | null; kind: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (url)
    return (
      <img
        src={url}
        alt=""
        className="size-14 shrink-0 rounded-2xl border border-border/60 object-cover"
      />
    );
  if (file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name))) {
    return (
      <span className="tile-fill-5 grid size-14 shrink-0 place-items-center rounded-2xl border border-border/60 text-destructive">
        <FilePdf className="size-8" aria-hidden />
      </span>
    );
  }
  if (file) {
    return (
      <span className="tile-fill-2 grid size-14 shrink-0 place-items-center rounded-2xl border border-border/60 text-primary">
        <FileText className="size-8" aria-hidden />
      </span>
    );
  }
  return <KindTile kind={kind} />;
}

/**
 * Cancel / Assign to trip / Done: the trip, optionally one of its stops, and
 * a note. For a new document it also takes the title and kind.
 */
export function AssignSheet({
  open,
  onClose,
  isNew,
  file,
  pasted = false,
  doc,
  initial,
  trips,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  isNew: boolean;
  file?: File | null;
  /** Added with "Paste text": a box for the confirmation's text, read on request. */
  pasted?: boolean;
  /** The existing document, when reassigning. */
  doc?: TripDocument | null;
  initial: AssignDraft;
  trips: TripLite[];
  onDone: (draft: AssignDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AssignDraft>(initial);
  const [linkEvent, setLinkEvent] = useState(!!initial.itinerary_item_id);
  const [pickTrip, setPickTrip] = useState(false);
  const [pickEvent, setPickEvent] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const { events, loading, loadedFor } = useTripEvents(open ? draft.trip_id : null);
  const readAs = isNew && file ? readableAs(file) : null;
  const [text, setText] = useState("");
  const pasteMode = isNew && pasted && !file;
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [filled, setFilled] = useState<ReadonlySet<FilledField>>(new Set());
  /** A read waiting for its trip's stops to load, to pick the stop it is for. */
  const [stopFor, setStopFor] = useState<{ read: DocumentRead; tripId: string } | null>(null);
  /** Bumped each time the sheet opens, so a read that finishes after a close is dropped. */
  const session = useRef(0);
  /** Fields the traveller changed while a read was out: the read leaves them alone. */
  const touched = useRef(new Set<FilledField>());
  /** The draft as last rendered, for a read that finishes long after it began. */
  const latest = useRef(draft);
  /** Bumped on each edit of the pasted text, so a read of older text is dropped. */
  const textRev = useRef(0);
  latest.current = draft;

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setLinkEvent(!!initial.itinerary_item_id);
      setError("");
      setReadError("");
      setFilled(new Set());
      setStopFor(null);
      setReading(false);
      setText("");
    }
    session.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const edited = (field: FilledField) => {
    touched.current.add(field);
    if (field === "trip" || field === "event") setStopFor(null);
    setFilled((f) => {
      if (!f.has(field)) return f;
      const next = new Set(f);
      next.delete(field);
      return next;
    });
  };

  const readFile = async () => {
    if (reading) return;
    const clean = pasteMode ? cleanPastedText(text) : "";
    if (pasteMode && !clean) {
      setReadError("Paste the confirmation's text first.");
      return;
    }
    if (!pasteMode && (!file || !readAs)) return;
    const mine = session.current;
    const rev = textRev.current;
    touched.current = new Set();
    setReading(true);
    setReadError("");
    try {
      const sent = pasteMode
        ? { pdfDataUrl: null, imageDataUrl: null, text: clean }
        : await fileForReading(file!, readAs!);
      const read = await readDocumentFile({
        data: { ...sent, today: toLocalISODate(new Date()) },
      });
      if (mine !== session.current) return;
      if (rev !== textRev.current) {
        setReadError("The text changed while Béa was reading it. Tap Fill in again.");
        return;
      }
      const skip = touched.current;
      const set = new Set<FilledField>();
      // Applied to the draft as it is now, not as it was when the read began.
      const d = latest.current;
      const next = { ...d };
      if (read.title && !skip.has("title")) {
        next.title = read.title;
        set.add("title");
      }
      if (read.kind && !skip.has("kind")) {
        next.kind = read.kind;
        set.add("kind");
      }
      if (read.lines.length && !skip.has("lines")) {
        next.lines = [read.lines[0] ?? "", read.lines[1] ?? ""];
        set.add("lines");
      }
      if (read.reference && !skip.has("reference")) {
        next.reference = read.reference;
        set.add("reference");
      }
      if (read.notes && !d.notes.trim() && !skip.has("notes")) {
        next.notes = read.notes;
        set.add("notes");
      }
      const tripId = d.trip_id || skip.has("trip") ? null : tripForDate(read.date, trips);
      if (tripId) {
        next.trip_id = tripId;
        next.itinerary_item_id = null;
        set.add("trip");
      }
      const forTrip = tripId ?? d.trip_id;
      setDraft(next);
      setFilled(set);
      if (forTrip && !next.itinerary_item_id && !skip.has("event") && read.date) {
        setStopFor({ read, tripId: forTrip });
      }
    } catch (e) {
      if (mine === session.current) setReadError(aiFailure(e).message);
    } finally {
      if (mine === session.current) setReading(false);
    }
  };

  // Once that trip's own stops are in, link the one the file is for, if it is clear.
  useEffect(() => {
    if (!stopFor) return;
    if (draft.trip_id !== stopFor.tripId) {
      setStopFor(null);
      return;
    }
    if (loading || loadedFor !== stopFor.tripId) return;
    const id = stopForRead(stopFor.read, events);
    setStopFor(null);
    if (!id || draft.itinerary_item_id) return;
    setDraft((d) => (d.trip_id === stopFor.tripId ? { ...d, itinerary_item_id: id } : d));
    setLinkEvent(true);
    setFilled((f) => new Set(f).add("event"));
  }, [stopFor, loading, loadedFor, events, draft.trip_id, draft.itinerary_item_id]);

  const trip = trips.find((t) => t.id === draft.trip_id) ?? null;
  const event = events.find((e) => e.id === draft.itinerary_item_id) ?? null;

  const done = async () => {
    if (saving.current) return;
    if (!draft.title.trim()) {
      setError("Give it a name first.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await onDone({
        ...draft,
        title: draft.title.trim().slice(0, TITLE_MAX),
        itinerary_item_id: linkEvent && draft.trip_id ? draft.itinerary_item_id : null,
      });
    } catch (e) {
      setError(friendlyError(e, "That did not save. Try again."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!saving.current) onClose();
      }}
      title="Assign to trip"
      width="sm"
      showClose={false}
      icon={
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="min-h-12 rounded-full px-1 text-[15px] font-semibold text-foreground"
        >
          Cancel
        </button>
      }
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => void done()}
          className="min-h-12 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Done"}
        </button>
      }
    >
      <fieldset disabled={busy} aria-busy={busy} className="space-y-4">
        <div className="doc-card flex items-center gap-3 p-3">
          <FilePreview file={file ?? null} kind={draft.kind} />
          <div className="min-w-0 flex-1">
            {isNew ? (
              <input
                value={draft.title}
                onChange={(e) => {
                  setDraft({ ...draft, title: e.target.value });
                  edited("title");
                }}
                maxLength={TITLE_MAX}
                placeholder="Name, e.g. Flight confirmation"
                aria-label="Document name"
                className="w-full rounded-lg border border-[var(--field-border)] bg-card px-2 py-1.5 text-[15px] font-semibold"
              />
            ) : (
              <p className="truncate text-[15px] font-semibold">{draft.title}</p>
            )}
            {doc?.lines.slice(0, 2).map((l, i) => (
              <p key={i} className="truncate text-[13px] text-muted-foreground">
                {l}
              </p>
            ))}
            {isNew && (file || pasteMode) && (
              <p className="truncate text-[13px] text-muted-foreground">
                {file ? file.name : "Pasted text"}
                <FromFile show={filled.has("title")} text={pasteMode} />
              </p>
            )}
          </div>
        </div>

        {(readAs || pasteMode) && (
          <div className="doc-card space-y-2 p-3">
            {pasteMode && (
              <textarea
                value={text}
                onChange={(e) => {
                  textRev.current++;
                  setText(e.target.value);
                }}
                maxLength={PASTED_TEXT_MAX}
                rows={6}
                autoFocus
                placeholder="Paste the confirmation email or message here"
                aria-label="Confirmation text"
                className="w-full resize-y rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14px]"
              />
            )}
            <button
              type="button"
              disabled={reading || (pasteMode && !text.trim())}
              onClick={() => void readFile()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 text-[15px] font-semibold text-primary disabled:opacity-60"
            >
              <Sparkles className="size-4" aria-hidden />
              {reading
                ? "Reading…"
                : filled.size
                  ? "Read it again"
                  : pasteMode
                    ? "Fill in from this text"
                    : "Fill in from this file"}
            </button>
            {readError ? (
              <p role="alert" className="text-[14px] font-semibold text-destructive">
                {readError}
              </p>
            ) : filled.size ? (
              <p className="text-[13px] text-muted-foreground">
                Filled in from the {pasteMode ? "text" : "file"}. Check it before you press Done.
              </p>
            ) : pasteMode ? (
              <p className="text-[13px] text-muted-foreground">
                Béa sends this text to Google Gemini to read it, without anything that looks like a
                card number. The text itself is not kept, and nothing is saved until you press Done.
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Béa sends this file to Google Gemini to read it. Nothing is saved until you press
                Done.
              </p>
            )}
          </div>
        )}

        {isNew && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-muted-foreground">
              Type
              <FromFile show={filled.has("kind")} text={pasteMode} />
            </p>
            <KindChips
              value={draft.kind}
              onChange={(kind) => {
                setDraft({ ...draft, kind });
                edited("kind");
              }}
            />
          </div>
        )}

        {isNew && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-muted-foreground">
                Short lines (optional)
                <FromFile show={filled.has("lines")} text={pasteMode} />
              </span>
              <input
                value={draft.lines?.[0] ?? ""}
                maxLength={LINE_MAX}
                placeholder="Air Canada · AC872"
                onChange={(e) => {
                  setDraft({ ...draft, lines: [e.target.value, draft.lines?.[1] ?? ""] });
                  edited("lines");
                }}
                className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[15px]"
              />
              <input
                value={draft.lines?.[1] ?? ""}
                maxLength={LINE_MAX}
                placeholder="Montreal → Lisbon"
                aria-label="Second line"
                onChange={(e) => {
                  setDraft({ ...draft, lines: [draft.lines?.[0] ?? "", e.target.value] });
                  edited("lines");
                }}
                className="mt-1.5 w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[15px]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-muted-foreground">
                Booking reference (optional)
                <FromFile show={filled.has("reference")} text={pasteMode} />
              </span>
              <input
                value={draft.reference ?? ""}
                maxLength={REFERENCE_MAX}
                placeholder="ABC123"
                autoCapitalize="characters"
                onChange={(e) => {
                  setDraft({ ...draft, reference: e.target.value });
                  edited("reference");
                }}
                className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[15px]"
              />
            </label>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[15px] font-semibold">
            Assign to trip
            <FromFile show={filled.has("trip")} text={pasteMode} />
          </p>
          <div className="doc-card overflow-hidden">
            <LinkRow
              media={
                trip ? (
                  <TripThumb trip={trip} />
                ) : (
                  <span className="tile-fill-4 grid size-14 shrink-0 place-items-center rounded-2xl border border-border/60 text-primary">
                    <FileText className="size-6" aria-hidden />
                  </span>
                )
              }
              title={trip ? trip.title : "No trip yet"}
              line={trip ? tripLine(trip) : "Unassigned — choose a trip"}
              onClick={() => setPickTrip(true)}
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="text-[15px]">Link to specific event (optional)</span>
          <Switch
            checked={linkEvent && !!draft.trip_id}
            disabled={!draft.trip_id}
            onCheckedChange={(on) => {
              setLinkEvent(on);
              if (!on) {
                setDraft({ ...draft, itinerary_item_id: null });
                edited("event");
              } else if (!draft.itinerary_item_id) setPickEvent(true);
            }}
            aria-label="Link to specific event"
          />
        </label>

        {linkEvent && draft.trip_id && (
          <div>
            <p className="mb-1.5 text-[15px] font-semibold">
              Select event
              <FromFile show={filled.has("event")} text={pasteMode} />
            </p>
            <div className="doc-card overflow-hidden">
              <LinkRow
                media={<KindTile kind={eventKind(event?.kind ?? "")} size="sm" />}
                title={event ? event.title : "Choose a stop"}
                line={event ? eventWhenLabel(event.day_date, event.time_label) : undefined}
                onClick={() => setPickEvent(true)}
              />
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">
            Add notes (optional)
            <FromFile show={filled.has("notes")} text={pasteMode} />
          </span>
          <textarea
            value={draft.notes}
            onChange={(e) => {
              setDraft({ ...draft, notes: e.target.value });
              edited("notes");
            }}
            maxLength={NOTES_MAX}
            rows={3}
            placeholder="E-ticket and confirmation."
            className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[15px]"
          />
        </label>

        {error && (
          <p role="alert" className="text-[14px] font-semibold text-destructive">
            {error}
          </p>
        )}
      </fieldset>

      <TripPicker
        open={pickTrip}
        onClose={() => setPickTrip(false)}
        trips={trips}
        selected={draft.trip_id}
        onPick={(tripId) => {
          // A stop belongs to its trip, so a new trip drops the old link.
          setDraft({
            ...draft,
            trip_id: tripId,
            itinerary_item_id: tripId === draft.trip_id ? draft.itinerary_item_id : null,
          });
          if (!tripId) setLinkEvent(false);
          edited("trip");
          if (tripId !== draft.trip_id) edited("event");
          setPickTrip(false);
        }}
      />
      <EventPicker
        open={pickEvent}
        onClose={() => {
          setPickEvent(false);
          if (!draft.itinerary_item_id) setLinkEvent(false);
        }}
        events={events}
        loading={loading}
        selected={draft.itinerary_item_id}
        onPick={(e) => {
          setDraft({ ...draft, itinerary_item_id: e.id });
          setLinkEvent(true);
          edited("event");
          setPickEvent(false);
        }}
      />
    </Sheet>
  );
}

export function KindChips({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DOCUMENT_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
            value === k
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card"
          }`}
        >
          <KindIcon kind={k} className="size-4" />
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

/* ─── Edit details ───────────────────────────────────────────────────────── */

export type DetailsDraft = {
  title: string;
  kind: string;
  lines: [string, string];
  reference: string;
  notes: string;
};

export function EditDetailsSheet({
  open,
  onClose,
  doc,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  doc: TripDocument;
  onSave: (d: DetailsDraft) => Promise<void>;
}) {
  const fresh = (): DetailsDraft => ({
    title: doc.title,
    kind: doc.kind,
    lines: [doc.lines[0] ?? "", doc.lines[1] ?? ""],
    reference: doc.reference ?? "",
    notes: doc.notes ?? "",
  });
  const [d, setD] = useState<DetailsDraft>(fresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setD(fresh());
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc.id]);

  const save = async () => {
    if (!d.title.trim()) {
      setError("Give it a name first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(d);
      onClose();
    } catch (e) {
      setError(friendlyError(e, "That did not save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px]";
  return (
    <Sheet open={open} onClose={onClose} title="Edit details" width="sm" above>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[13px] font-semibold text-muted-foreground">Name</span>
          <input
            value={d.title}
            maxLength={TITLE_MAX}
            onChange={(e) => setD({ ...d, title: e.target.value })}
            className={input}
          />
        </label>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Type</p>
          <KindChips value={d.kind} onChange={(kind) => setD({ ...d, kind })} />
        </div>
        <label className="block space-y-1">
          <span className="text-[13px] font-semibold text-muted-foreground">Short lines</span>
          <input
            value={d.lines[0]}
            maxLength={LINE_MAX}
            placeholder="Air Canada · AC872"
            onChange={(e) => setD({ ...d, lines: [e.target.value, d.lines[1]] })}
            className={input}
          />
          <input
            value={d.lines[1]}
            maxLength={LINE_MAX}
            placeholder="Montreal → Lisbon"
            aria-label="Second line"
            onChange={(e) => setD({ ...d, lines: [d.lines[0], e.target.value] })}
            className={`${input} mt-1.5`}
          />
        </label>
        <BookingFields
          subject={d.title}
          reference={d.reference}
          onReferenceChange={(reference) => setD({ ...d, reference })}
          referenceMax={REFERENCE_MAX}
          details={d.notes}
          onDetailsChange={(notes) => setD({ ...d, notes })}
          detailsMax={NOTES_MAX}
          detailsLabel="Notes"
          detailsPlaceholder="Seat, check-in time, what to bring"
        />
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="btn-primary w-full px-4 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
    </Sheet>
  );
}

/* ─── More options ───────────────────────────────────────────────────────── */

export function MoreOptionsSheet({
  open,
  onClose,
  hasTrip,
  hasEvent,
  onEdit,
  onReassign,
  onChangeEvent,
  onRemoveEvent,
  onMove,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  hasTrip: boolean;
  hasEvent: boolean;
  onEdit: () => void;
  onReassign: () => void;
  onChangeEvent: () => void;
  onRemoveEvent: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="More options" width="sm" above>
      <div className="doc-list">
        <OptionRow
          icon={<Pencil className="size-5" aria-hidden />}
          title="Edit details"
          subtitle="Rename, update the lines, reference or notes"
          fill="tile-fill-1"
          onClick={onEdit}
        />
        <OptionRow
          icon={<RefreshCw className="size-5" aria-hidden />}
          title={hasTrip ? "Reassign to a different trip" : "Assign to a trip"}
          subtitle="Choose the trip, event and notes"
          fill="tile-fill-2"
          onClick={onReassign}
        />
        {hasTrip && (
          <OptionRow
            icon={<Route className="size-5" aria-hidden />}
            title={hasEvent ? "Change linked event" : "Link to an event"}
            subtitle="Link to a different itinerary event"
            fill="tile-fill-3"
            onClick={onChangeEvent}
          />
        )}
        {hasEvent && (
          <OptionRow
            icon={<Unlink className="size-5" aria-hidden />}
            title="Remove event link"
            subtitle="Keep in trip but unlink from event"
            fill="tile-fill-4"
            onClick={onRemoveEvent}
          />
        )}
        {hasTrip && (
          <OptionRow
            icon={<FolderOpen className="size-5" aria-hidden />}
            title="Move to another trip"
            subtitle="Moves it, without its event link"
            fill="tile-fill-5"
            onClick={onMove}
          />
        )}
        <OptionRow
          icon={<Trash2 className="size-5" aria-hidden />}
          title="Delete document"
          danger
          onClick={onDelete}
        />
      </div>
    </Sheet>
  );
}

/* ─── Confirmations ──────────────────────────────────────────────────────── */

/** After linking to an event: one record, seen from the trip and the stop. */
export function BookingLinkedSheet({
  open,
  onClose,
  trip,
  event,
}: {
  open: boolean;
  onClose: () => void;
  trip: TripLite | null;
  event: EventOption | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Booking linked" width="sm" above>
      <div className="space-y-3 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
          <Link2 className="size-8" aria-hidden />
        </span>
        <p className="font-display text-[26px] leading-none">Booking linked</p>
        <p className="text-[14px] text-muted-foreground">This document is linked to:</p>
        <div className="doc-list text-left">
          {trip && (
            <LinkRow
              media={<TripThumb trip={trip} />}
              eyebrow="Trip"
              title={trip.title}
              line={tripLine(trip)}
            />
          )}
          {event && (
            <LinkRow
              media={<KindTile kind={eventKind(event.kind)} />}
              eyebrow="Event"
              title={event.title}
              line={eventWhenLabel(event.day_date, event.time_label)}
            />
          )}
        </div>
        <div className="tile-fill-3 flex items-start gap-2 rounded-2xl border border-border/60 p-3 text-left text-[13.5px]">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            This is one record. Any changes you make will be reflected across your trip, bookings
            and itinerary.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-primary w-full px-4">
          Done
        </button>
      </div>
    </Sheet>
  );
}

export function DeleteDocumentSheet({
  open,
  onClose,
  title,
  shared,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  shared: boolean;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Delete document" hint={title} width="sm" above>
      <div className="space-y-3">
        <p className="text-[15px]">
          {shared
            ? "The file and its details are removed for you and everyone on the trip. This cannot be undone."
            : "The file and its details are removed. This cannot be undone."}
        </p>
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-[var(--r-button)] border border-border bg-card text-[15px] font-semibold"
          >
            Keep it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              onDelete()
                .catch((e: unknown) =>
                  setError(friendlyError(e, "That was not deleted. Try again.")),
                )
                .finally(() => setBusy(false));
            }}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[var(--r-button)] bg-destructive text-[15px] font-semibold text-destructive-foreground disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
