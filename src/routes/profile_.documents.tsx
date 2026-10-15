import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Sheet } from "@/components/Sheet";
import { ProtectedPanel, VaultUnlock } from "@/components/DocumentVault";
import {
  ChevronRight,
  Lock,
  LockOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "@/components/icons";
import { DocumentDetail } from "@/components/documents/DocumentDetail";
import {
  DocumentRow,
  LinkRow,
  TripThumb,
  type TripLite,
} from "@/components/documents/DocumentParts";
import {
  AddDocumentSheet,
  AssignSheet,
  BookingLinkedSheet,
  DeleteDocumentSheet,
  EditDetailsSheet,
  EventPicker,
  MoreOptionsSheet,
  TripPicker,
  type AssignDraft,
} from "@/components/documents/DocumentSheets";
import { LockSetting, LockedNotice } from "@/components/documents/DocumentsLock";
import { useDocumentsLock } from "@/hooks/useDocumentsLock";
import { useAuth } from "@/hooks/useAuth";
import { useBeaSettings } from "@/hooks/useBeaSettings";
import { useTripDocuments, useTripEvents } from "@/hooks/useTripDocuments";
import { useTrips } from "@/hooks/useTrips";
import { useVault } from "@/hooks/useVault";
import { emptyLine } from "@/lib/bea-personality";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  DOCUMENT_GROUPS,
  GROUP_LABEL,
  NOTES_MAX,
  REFERENCE_MAX,
  TITLE_MAX,
  cleanLines,
  cleanText,
  defaultTripId,
  filterDocuments,
  guessKind,
  titleFromFileName,
  type DocumentGroup,
  type LibraryView,
  type SortOrder,
  type TripDocument,
  tripLine,
} from "@/lib/trip-documents";

type Search = { doc?: string; event?: string };

export const Route = createFileRoute("/profile_/documents")({
  staticData: { plane: "detail" },
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["doc"] === "string" ? { doc: s["doc"] } : {}),
    ...(typeof s["event"] === "string" ? { event: s["event"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Trip documents — Béa" },
      {
        name: "description",
        content: "Your bookings, confirmations and trip files in one place.",
      },
    ],
  }),
  component: DocumentsPage,
});

/** Which sheet is up. One at a time, plus the detail underneath. */
type Panel =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "assign-new"; file: File | null; pasted?: boolean }
  | { kind: "reassign"; doc: TripDocument }
  | { kind: "more"; doc: TripDocument }
  | { kind: "edit"; doc: TripDocument }
  | { kind: "move"; doc: TripDocument }
  | { kind: "event"; doc: TripDocument }
  | { kind: "delete"; doc: TripDocument }
  | { kind: "linked"; tripId: string; eventId: string }
  | { kind: "protected" }
  | { kind: "sort" };

function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id ?? null;
  const search = Route.useSearch();
  const navigate = useNavigate();
  const v = useVault();
  const lock = useDocumentsLock(uid, user?.last_sign_in_at, v);
  const t = useTrips();
  const d = useTripDocuments(uid);
  const settings = useBeaSettings();

  const [seg, setSeg] = useState<"all" | "shared" | "protected">("all");
  const [tripFilter, setTripFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const view: LibraryView = tripFilter ? "trip" : "all";
  const [group, setGroup] = useState<DocumentGroup>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [tripId, setTripId] = useState<string | null>(null);
  const [pickViewTrip, setPickViewTrip] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(search.doc ?? null);
  const [eventFilter, setEventFilter] = useState<string | null>(search.event ?? null);
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const close = () => setPanel({ kind: "none" });

  const trips: TripLite[] = useMemo(
    () => [...t.trips].sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? "")),
    [t.trips],
  );
  const tripById = useMemo(() => new Map(trips.map((x) => [x.id, x])), [trips]);

  useEffect(() => {
    if (tripId || trips.length === 0) return;
    setTripId(defaultTripId(trips, d.docs, toLocalISODate(new Date())));
  }, [trips, d.docs, tripId]);

  // Opened from a stop: one document opens straight away.
  useEffect(() => {
    if (!eventFilter || d.loading) return;
    const forStop = d.docs.filter((x) => x.itinerary_item_id === eventFilter);
    if (forStop.length === 1) {
      setDetailId(forStop[0]!.id);
      setEventFilter(null);
    }
  }, [eventFilter, d.docs, d.loading]);

  const detail = d.docs.find((x) => x.id === detailId) ?? null;
  const detailEvents = useTripEvents(detail?.trip_id ?? null);
  const linkedPanel = panel.kind === "linked" ? panel : null;
  const linkedEvents = useTripEvents(linkedPanel?.tripId ?? null);
  const eventPanelDoc = panel.kind === "event" ? panel.doc : null;
  const eventPickerEvents = useTripEvents(eventPanelDoc?.trip_id ?? null);

  const list = useMemo(() => {
    const base = eventFilter ? d.docs.filter((x) => x.itinerary_item_id === eventFilter) : d.docs;
    return filterDocuments(base, { view, tripId: tripFilter, group, query, sort });
  }, [d.docs, eventFilter, view, tripFilter, group, query, sort]);

  const filtering = query.trim() !== "" || group !== "all" || !!eventFilter;
  const sharedDocs = list.filter((x) => x.trip_id);
  const looseDocs = list.filter((x) => !x.trip_id);
  const noResultsLine = useMemo(
    () => emptyLine({ kind: "noResults", settings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, group, seg],
  );

  const mine = (doc: TripDocument) => doc.owner_id === uid;

  const saveAssign = async (
    draft: AssignDraft,
    existing: TripDocument | null,
    file: File | null,
  ) => {
    const notes = cleanText(draft.notes, NOTES_MAX);
    if (existing) {
      await d.updateDocument(existing.id, {
        trip_id: draft.trip_id,
        itinerary_item_id: draft.itinerary_item_id,
        notes,
      });
    } else {
      const created = await d.addDocument({
        title: draft.title.slice(0, TITLE_MAX),
        kind: draft.kind,
        lines: cleanLines(draft.lines ?? []),
        reference: cleanText(draft.reference ?? "", REFERENCE_MAX),
        trip_id: draft.trip_id,
        itinerary_item_id: draft.itinerary_item_id,
        notes,
        file,
      });
      setDetailId(created.id);
    }
    const newlyLinked =
      draft.trip_id &&
      draft.itinerary_item_id &&
      draft.itinerary_item_id !== existing?.itinerary_item_id;
    if (newlyLinked) {
      setPanel({ kind: "linked", tripId: draft.trip_id!, eventId: draft.itinerary_item_id! });
    } else {
      close();
      toast.success(existing ? "Saved" : "Document added");
    }
  };

  const patch = async (
    doc: TripDocument,
    p: Parameters<typeof d.updateDocument>[1],
    done?: string,
  ) => {
    try {
      await d.updateDocument(doc.id, p);
      if (done) toast.success(done);
    } catch (e) {
      toast.error(friendlyError(e, "That change did not save."));
    }
  };

  // ── Signed out / loading / locked ────────────────────────────────────────
  const intro = (
    <section className="fd-head">
      <h1 className="text-[24px] font-semibold leading-tight">Trip documents</h1>
      <p className="mt-2 text-[13px] leading-snug">
        Bookings and tickets for your trips. Private identity documents stay in Protected.
      </p>
    </section>
  );

  // Signed out never reaches here: AppShell sends the traveller to sign in.
  if (authLoading || !uid || v.loading || !lock.ready) {
    return (
      <AppShell homeHeader>
        {/* The shape of the library, so nothing jumps when it arrives. */}
        <div className="space-y-4" aria-busy="true" aria-label="Opening Trip documents">
          {intro}
          <div className="h-11 animate-pulse rounded-full bg-muted" />
          <div className="plain-card divide-y divide-border overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!lock.open) {
    return (
      <AppShell homeHeader>
        <div className="space-y-4">
          {intro}
          <VaultUnlock
            v={v}
            title="Trip documents is locked"
            body={
              v.hasVault
                ? "Unlock to see your bookings and trip files. This also opens Protected."
                : "Set a passcode to lock Trip documents on this device. The same passcode protects your private files in Protected."
            }
          />
          <LockedNotice />
        </div>
      </AppShell>
    );
  }

  // ── The library ──────────────────────────────────────────────────────────
  const viewTrip = tripId ? (tripById.get(tripId) ?? null) : null;
  const detailTrip = detail?.trip_id ? (tripById.get(detail.trip_id) ?? null) : null;
  const detailEvent = detail?.itinerary_item_id
    ? (detailEvents.events.find((e) => e.id === detail.itinerary_item_id) ?? null)
    : null;

  return (
    <AppShell homeHeader>
      <div className="space-y-4 pb-2">
        {intro}

        <section className="fd-box space-y-2">
          <div className="flex gap-2">
            <label className="doc-search fd-pill min-w-0 flex-1">
              <Search className="size-4 shrink-0" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                  <X className="size-4 text-muted-foreground" aria-hidden />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setPickViewTrip(true)}
              className="fd-pill max-w-[40%] shrink-0 text-[13px] font-semibold"
            >
              <span className="truncate">
                {tripFilter ? (tripById.get(tripFilter)?.title ?? "Trip") : "All trips"}
              </span>
            </button>
          </div>
          <div role="tablist" aria-label="Which documents" className="fd-seg">
            {(
              [
                ["all", "All"],
                ["shared", "Trip shared"],
                ["protected", "Protected · Only you"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={seg === value}
                onClick={() => setSeg(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label="Sort documents"
              onClick={() => setPanel({ kind: "sort" })}
              className="fd-pill"
            >
              <Settings2 className="size-4" aria-hidden />
              <span className="text-[13px] font-semibold">Sort</span>
            </button>
            <button
              type="button"
              aria-pressed={showFilters}
              onClick={() => setShowFilters(!showFilters)}
              className="fd-pill"
            >
              <Search className="size-4" aria-hidden />
              <span className="text-[13px] font-semibold">Filter</span>
            </button>
          </div>
          {showFilters && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {DOCUMENT_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={`doc-chip shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
                    group === g
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {GROUP_LABEL[g]}
                </button>
              ))}
            </div>
          )}
        </section>

        {eventFilter && (
          <button
            type="button"
            onClick={() => setEventFilter(null)}
            className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-semibold"
          >
            Documents for one stop <X className="size-3.5" aria-hidden />
          </button>
        )}

        {seg !== "protected" &&
          (d.unavailable ? (
            <div className="plain-card space-y-1.5 p-4">
              <p className="font-semibold">Trip documents is not set up yet</p>
              <p className="text-[14px] text-muted-foreground">
                Béa needs one database update before it can keep bookings and files here. Nothing is
                lost in the meantime, and Protected below already works.
              </p>
            </div>
          ) : d.loadError ? (
            <div className="plain-card space-y-2 p-4">
              <p className="text-[14px]">Trip documents did not load. Check your connection.</p>
              <button
                type="button"
                onClick={() => void d.reload()}
                className="text-[14px] font-semibold text-primary underline"
              >
                Try again
              </button>
            </div>
          ) : d.loading ? (
            <div className="doc-card h-32 animate-pulse" />
          ) : list.length === 0 ? (
            <div className="plain-card flex items-center gap-3 p-4">
              <img
                src="/bea/bea-think-static.png"
                alt=""
                className="art-dim size-16 shrink-0 object-contain"
              />
              <p className="text-[14px] text-muted-foreground">
                {d.docs.length === 0
                  ? "Béa keeps bookings, confirmations and tickets here. Add the first one below."
                  : noResultsLine}
              </p>
            </div>
          ) : (
            <>
              {sharedDocs.length > 0 && (
                <section className="fd-box">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[13px] font-semibold">Trip shared</h2>
                    <span className="text-[11px] text-muted-foreground">
                      {sharedDocs.length} {sharedDocs.length === 1 ? "document" : "documents"}
                    </span>
                  </div>
                  <div className="doc-list">
                    {sharedDocs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onOpen={() => setDetailId(doc.id)}
                        onMore={mine(doc) ? () => setPanel({ kind: "more", doc }) : undefined}
                      />
                    ))}
                  </div>
                </section>
              )}
              {looseDocs.length > 0 && (
                <section className="fd-box">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[13px] font-semibold">Not on a trip yet</h2>
                    <span className="text-[11px] text-muted-foreground">
                      {looseDocs.length} {looseDocs.length === 1 ? "document" : "documents"}
                    </span>
                  </div>
                  <div className="doc-list">
                    {looseDocs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onOpen={() => setDetailId(doc.id)}
                        onMore={mine(doc) ? () => setPanel({ kind: "more", doc }) : undefined}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          ))}

        {seg !== "shared" && (
          <section className="fd-box space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold">Protected · Only you</h2>
            </div>
            <button
              type="button"
              onClick={() => setPanel({ kind: "protected" })}
              className="doc-card doc-link flex w-full items-center gap-3 p-3 text-left"
            >
              <span className="tile-fill-1 grid size-12 shrink-0 place-items-center rounded-2xl border border-border/60 text-primary">
                <ShieldCheck className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Passports, cards and private files
                </span>
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  {v.unlocked ? (
                    <LockOpen className="size-3.5" aria-hidden />
                  ) : (
                    <Lock className="size-3.5" aria-hidden />
                  )}
                  {v.unlocked
                    ? `Unlocked · ${v.rows.length} ${v.rows.length === 1 ? "item" : "items"}`
                    : v.hasVault
                      ? "Encrypted · locked"
                      : "Encrypted on your device · set a passcode"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <LockSetting lockOn={lock.lockOn} onChange={lock.setLockOn} />
          </section>
        )}

        {!d.unavailable && !d.loadError && (
          <section className="fd-box" aria-label="Add document">
            <button
              type="button"
              onClick={() => setPanel({ kind: "add" })}
              className="flex w-full items-center gap-3 text-left"
            >
              <span aria-hidden className="fd-round">
                <Plus className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">Add document</span>
                <span className="mt-0.5 flex justify-between gap-3 text-[12px] text-muted-foreground">
                  <span>File/photo</span>
                  <span>Paste confirmation text</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </section>
        )}

        <p className="px-1 text-[12px] text-muted-foreground">
          Trip documents is for bookings, confirmations and tickets, and is shared with the people
          on the trip it belongs to. It is not for passports, payment cards or passwords — those
          belong in Protected.
        </p>
      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────── */}

      <Sheet
        open={!!detail}
        onClose={() => {
          setDetailId(null);
          if (search.doc || search.event) void navigate({ to: "/profile/documents", search: {} });
        }}
        title="Trip document"
      >
        {detail && (
          <DocumentDetail
            doc={detail}
            trip={detailTrip}
            event={detailEvent}
            canEdit={mine(detail)}
            onMore={() => setPanel({ kind: "more", doc: detail })}
            onSaveNotes={(notes) =>
              d.updateDocument(detail.id, { notes: cleanText(notes, NOTES_MAX) })
            }
            onChangeEvent={() => setPanel({ kind: "event", doc: detail })}
          />
        )}
      </Sheet>

      <AddDocumentSheet
        open={panel.kind === "add"}
        onClose={close}
        onPick={(file) => setPanel({ kind: "assign-new", file })}
        onPaste={() => setPanel({ kind: "assign-new", file: null, pasted: true })}
      />

      {panel.kind === "assign-new" && (
        <AssignSheet
          open
          onClose={close}
          isNew
          file={panel.file}
          pasted={!!panel.pasted}
          trips={trips}
          initial={{
            title: panel.file ? titleFromFileName(panel.file.name) : "",
            kind: panel.file ? guessKind(panel.file.name) : "other",
            trip_id: tripFilter,
            itinerary_item_id: eventFilter,
            notes: "",
          }}
          onDone={(draft) => saveAssign(draft, null, panel.file)}
        />
      )}

      {panel.kind === "reassign" && (
        <AssignSheet
          open
          onClose={close}
          isNew={false}
          doc={panel.doc}
          trips={trips}
          initial={{
            title: panel.doc.title,
            kind: panel.doc.kind,
            trip_id: panel.doc.trip_id,
            itinerary_item_id: panel.doc.itinerary_item_id,
            notes: panel.doc.notes ?? "",
          }}
          onDone={(draft) => saveAssign(draft, panel.doc, null)}
        />
      )}

      {panel.kind === "more" && (
        <MoreOptionsSheet
          open
          onClose={close}
          hasTrip={!!panel.doc.trip_id}
          hasEvent={!!panel.doc.itinerary_item_id}
          onEdit={() => setPanel({ kind: "edit", doc: panel.doc })}
          onReassign={() => setPanel({ kind: "reassign", doc: panel.doc })}
          onChangeEvent={() => setPanel({ kind: "event", doc: panel.doc })}
          onRemoveEvent={() => {
            close();
            void patch(panel.doc, { itinerary_item_id: null }, "Event link removed");
          }}
          onMove={() => setPanel({ kind: "move", doc: panel.doc })}
          onDelete={() => setPanel({ kind: "delete", doc: panel.doc })}
        />
      )}

      {panel.kind === "edit" && (
        <EditDetailsSheet
          open
          onClose={close}
          doc={panel.doc}
          onSave={(draft) =>
            d.updateDocument(panel.doc.id, {
              title: draft.title.trim().slice(0, TITLE_MAX),
              kind: draft.kind,
              lines: cleanLines(draft.lines),
              reference: cleanText(draft.reference, REFERENCE_MAX),
              notes: cleanText(draft.notes, NOTES_MAX),
            })
          }
        />
      )}

      {panel.kind === "move" && (
        <TripPicker
          open
          onClose={close}
          trips={trips.filter((x) => x.id !== panel.doc.trip_id)}
          selected={null}
          allowNone={false}
          onPick={(id) => {
            close();
            void patch(panel.doc, { trip_id: id, itinerary_item_id: null }, "Moved");
          }}
        />
      )}

      {panel.kind === "event" && (
        <EventPicker
          open
          onClose={close}
          events={eventPickerEvents.events}
          loading={eventPickerEvents.loading}
          selected={panel.doc.itinerary_item_id}
          onPick={(e) => {
            const doc = panel.doc;
            void d
              .updateDocument(doc.id, { itinerary_item_id: e.id })
              .then(() => setPanel({ kind: "linked", tripId: doc.trip_id!, eventId: e.id }))
              .catch((err: unknown) => toast.error(friendlyError(err, "That link did not save.")));
          }}
        />
      )}

      {panel.kind === "delete" && (
        <DeleteDocumentSheet
          open
          onClose={close}
          title={panel.doc.title}
          shared={!!panel.doc.trip_id}
          onDelete={async () => {
            await d.removeDocument(panel.doc);
            if (detailId === panel.doc.id) setDetailId(null);
            close();
            toast.success("Document deleted");
          }}
        />
      )}

      {linkedPanel && (
        <BookingLinkedSheet
          open
          onClose={close}
          trip={tripById.get(linkedPanel.tripId) ?? null}
          event={linkedEvents.events.find((e) => e.id === linkedPanel.eventId) ?? null}
        />
      )}

      <Sheet
        open={panel.kind === "protected"}
        onClose={close}
        title="Protected"
        hint="Encrypted on your device with your passcode"
      >
        <ProtectedPanel v={v} />
      </Sheet>

      <Sheet open={panel.kind === "sort"} onClose={close} title="Sort documents" width="sm">
        <div className="plain-card divide-y divide-border overflow-hidden">
          {(
            [
              ["newest", "Newest first"],
              ["oldest", "Oldest first"],
              ["title", "By name"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => {
                setSort(value);
                close();
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-[16px]"
            >
              {label}
              {sort === value && (
                <span className="text-[13px] font-semibold text-primary">Selected</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>

      <TripPicker
        open={pickViewTrip}
        onClose={() => setPickViewTrip(false)}
        trips={trips}
        selected={tripFilter}
        allowNone
        onPick={(id) => {
          setTripFilter(id);
          if (id) setTripId(id);
          setPickViewTrip(false);
        }}
      />
    </AppShell>
  );
}
