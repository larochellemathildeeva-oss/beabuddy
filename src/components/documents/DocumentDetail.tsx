import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, ExternalLink, MoreHorizontal, Share2 } from "@/components/icons";
import { BookingFacts } from "@/components/documents/BookingDetail";
import {
  DocumentIcon,
  KindTile,
  LinkRow,
  TripThumb,
  type TripLite,
} from "@/components/documents/DocumentParts";
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
      toast.error(e instanceof Error ? e.message : "That did not work. Try again.");
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
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <DocumentIcon doc={doc} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[26px] leading-[1.05]">{doc.title}</h2>
          {doc.lines.map((l, i) => (
            <p key={i} className="text-[14px] text-muted-foreground">
              {l}
            </p>
          ))}
          <p className="text-[13px] text-muted-foreground">{addedFull(doc.created_at)}</p>
        </div>
      </div>

      {actions.length > 0 && (
        <div
          className={`grid gap-2 ${
            ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][
              actions.length
            ]
          }`}
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={busy !== ""}
              className={`${a.fill} flex flex-col items-center gap-1 rounded-2xl border border-border/70 py-3 text-[13px] font-semibold disabled:opacity-60`}
            >
              <a.icon className="size-5 text-primary" aria-hidden />
              {busy === a.key ? "…" : a.label}
            </button>
          ))}
        </div>
      )}

      <BookingFacts
        facts={[
          { label: "Confirmation", value: doc.reference },
          { label: "Type", value: KIND_LABEL[asKind(doc.kind)] },
          {
            label: "File",
            value: hasFile
              ? [doc.file_name, fileSizeLabel(doc.size_bytes)].filter(Boolean).join(" · ")
              : null,
          },
        ]}
      />

      <section>
        <h3 className="mb-2 font-display text-[22px] leading-none">Linked to</h3>
        {trip || event ? (
          <div className="plain-card divide-y divide-border overflow-hidden">
            {trip && (
              <LinkRow
                media={<TripThumb trip={trip} />}
                eyebrow="Trip"
                title={trip.title}
                line={tripLine(trip)}
                onClick={() => void navigate({ to: "/trips/$tripId", params: { tripId: trip.id } })}
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
        ) : (
          <p className="plain-card p-3 text-[14px] text-muted-foreground">
            Not linked to a trip yet.{canEdit ? " Use More to assign it." : ""}
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[22px] leading-none">Notes</h3>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[14px] font-semibold text-primary"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={NOTES_MAX}
              rows={3}
              autoFocus
              aria-label="Notes"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
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
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy === "notes" ? "Saving…" : "Save notes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotes(doc.notes ?? "");
                  setEditing(false);
                }}
                className="rounded-xl border border-border px-4 py-2 text-[14.5px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="plain-card whitespace-pre-wrap p-3 text-[14.5px]">
            {doc.notes || <span className="text-muted-foreground">No notes.</span>}
          </p>
        )}
      </section>

      {!canEdit && (
        <p className="text-[12.5px] text-muted-foreground">
          Added by someone on this trip. Only they can change or delete it.
        </p>
      )}
    </div>
  );
}
