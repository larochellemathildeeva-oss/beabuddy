import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Check,
  Download,
  ExternalLink,
  MoreHorizontal,
  Share2,
  ChevronRight,
} from "@/components/icons";
import { BookingFacts } from "@/components/documents/BookingDetail";
import {
  DocumentIcon,
  KindTile,
  LinkRow,
  TripThumb,
  type TripLite,
} from "@/components/documents/DocumentParts";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { documentFileBlob, documentFileUrl, type EventOption } from "@/hooks/useTripDocuments";
import {
  KIND_LABEL,
  NOTES_MAX,
  addedFull,
  asKind,
  eventWhenLabel,
  fileSizeLabel,
  type TripDocument,
  eventKind,
  tripLine,
} from "@/lib/trip-documents";

/**
 * One document, the same record wherever it is opened: file, the booking's
 * facts, what it is linked to, and notes.
 */
export function DocumentDetail({
  doc,
  trip,
  event,
  canEdit,
  onMore,
  onSaveNotes,
  onChangeEvent,
}: {
  doc: TripDocument;
  trip: TripLite | null;
  event: EventOption | null;
  canEdit: boolean;
  onMore: () => void;
  onSaveNotes: (notes: string) => Promise<void>;
  onChangeEvent: () => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [busy, setBusy] = useState<"" | "view" | "download" | "share" | "notes">("");

  useEffect(() => {
    setNotes(doc.notes ?? "");
    setEditing(false);
  }, [doc.id, doc.notes]);

  const hasFile = !!doc.storage_path;
  const fileName = doc.file_name ?? `${doc.title}`;

  const run = async (what: "view" | "download" | "share", fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(friendlyError(e, "That did not work. Try again."));
    } finally {
      setBusy("");
    }
  };

  const view = () =>
    run("view", async () => {
      // Opened first, filled after, so a phone's pop-up blocker lets it through.
      const tab = window.open("", "_blank");
      const url = await documentFileUrl(doc.storage_path!);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });

  const download = () =>
    run("download", async () => {
      const blob = await documentFileBlob(doc.storage_path!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });

  // The file itself is shared, never a link to it: a link would open the
  // booking for anybody it was passed on to.
  const share = () =>
    run("share", async () => {
      const blob = await documentFileBlob(doc.storage_path!);
      const file = new File([blob], fileName, { type: doc.mime_type ?? blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: doc.title });
      } else {
        toast("This browser cannot share files. Use Download instead.");
      }
    });

  const actions = [
    hasFile && {
      key: "view",
      label: "View",
      icon: ExternalLink,
      onClick: view,
      fill: "tile-fill-1",
    },
    hasFile && {
      key: "download",
      label: "Download",
      icon: Download,
      onClick: download,
      fill: "tile-fill-2",
    },
    hasFile && { key: "share", label: "Share", icon: Share2, onClick: share, fill: "tile-fill-3" },
    canEdit && {
      key: "more",
      label: "More",
      icon: MoreHorizontal,
      onClick: onMore,
      fill: "tile-fill-4",
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    icon: typeof Share2;
    onClick: () => void;
    fill: string;
  }[];

  return (
    <div className="space-y-3">
      <section className="fd-head">
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">BÉA</span>
          <span>Trip documents</span>
        </div>
        <img
          src={
            asKind(doc.kind) === "accommodation"
              ? "/art/booking-hotel.webp"
              : bannerArtUrl(
                  bannerSceneFor([doc.title, trip?.title, trip?.city, trip?.country], doc.id),
                )
          }
          alt=""
          aria-hidden
          className="art-dim mt-3 h-[96px] w-full rounded-[6px] object-cover"
        />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.04em]">
          {KIND_LABEL[asKind(doc.kind)]}
        </p>
        <h2 className="mt-1 text-[28px] font-semibold leading-[1.1]">{doc.title}</h2>
        {doc.lines.map((l, i) => (
          <p key={i} className="mt-1 text-[13px]">
            {l}
          </p>
        ))}
        <p className="mt-2 text-[12px] text-muted-foreground">{addedFull(doc.created_at)}</p>
      </section>

      {doc.reference && (
        <div className="fd-box flex items-center gap-3">
          <Check className="size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Confirmed</p>
            <p className="text-[12px] tabular-nums text-muted-foreground [overflow-wrap:anywhere]">
              Reservation number {doc.reference}
            </p>
          </div>
        </div>
      )}

      <BookingFacts facts={[{ label: "Type", value: KIND_LABEL[asKind(doc.kind)] }]} />

      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          disabled={busy !== ""}
          className="fd-box flex w-full items-center gap-3 text-left disabled:opacity-60"
        >
          <a.icon className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 text-[14px] font-semibold">
            {busy === a.key ? "…" : a.label}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}

      {hasFile && (
        <>
          <p className="px-1 text-[12px] text-muted-foreground">Attached documents</p>
          <div className="fd-box doc-file flex items-center gap-3">
            <DocumentIcon doc={doc} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{doc.file_name ?? doc.title}</p>
              <p className="text-[12px] text-muted-foreground">
                {fileSizeLabel(doc.size_bytes) || "File attached"}
              </p>
            </div>
          </div>
        </>
      )}

      <section className="fd-box">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Notes</h3>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[13px] font-semibold"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={3}
              autoFocus
              aria-label="Notes"
              className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[15px]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy === "notes"}
                onClick={() => {
                  setBusy("notes");
                  onSaveNotes(notes)
                    .then(() => setEditing(false))
                    .catch(() => toast.error("Those notes did not save. Try again."))
                    .finally(() => setBusy(""));
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy === "notes" ? "Saving…" : "Save notes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotes(doc.notes ?? "");
                  setEditing(false);
                }}
                className="rounded-xl border border-border px-4 py-2 text-[15px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">
            {doc.notes || "No notes."}
          </p>
        )}
      </section>

      <section className="fd-box space-y-2">
        <p className="text-[12px] text-muted-foreground">Shared with trip</p>
        {trip || event ? (
          <>
            {trip && (
              <p className="text-[14px]">
                This document is attached to your {trip.title} trip and can be opened from Trip
                documents.
              </p>
            )}
            <div className="doc-list">
              {trip && (
                <LinkRow
                  media={<TripThumb trip={trip} />}
                  eyebrow="Trip"
                  title={trip.title}
                  line={tripLine(trip)}
                  onClick={() =>
                    void navigate({ to: "/trips/$tripId", params: { tripId: trip.id } })
                  }
                />
              )}
              {event && (
                <LinkRow
                  media={<KindTile kind={eventKind(event.kind)} />}
                  eyebrow="Event"
                  title={event.title}
                  line={eventWhenLabel(event.day_date, event.time_label)}
                  onClick={canEdit ? onChangeEvent : undefined}
                />
              )}
            </div>
          </>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            Not linked to a trip yet.{canEdit ? " Use More to assign it." : ""}
          </p>
        )}
      </section>

      {!canEdit && (
        <p className="text-[13px] text-muted-foreground">
          Added by someone on this trip. Only they can change or delete it.
        </p>
      )}
    </div>
  );
}
