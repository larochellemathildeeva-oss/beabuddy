import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Sheet } from "@/components/Sheet";
import { Camera, Trash2 } from "@/components/icons";
import { useSignedPhoto } from "@/hooks/useTripPhotos";
import type { StopPhoto } from "@/hooks/useStopPhotos";
import { isNetworkFailure } from "@/lib/ai-errors";

export type StopPhotosProps = {
  photos: StopPhoto[];
  /** False until the stop_photos migration is applied. */
  ready: boolean;
  /** Who is looking: only their own photos can be deleted. */
  uid: string | null;
  onAdd: (files: File[]) => Promise<number>;
  onRemove: (photo: StopPhoto) => Promise<void>;
};

/**
 * The traveller's own photos of a stop, in the stop's sheet. Everyone on the
 * trip sees them; each is also in its owner's Photo memories.
 */
export function StopPhotos({ photos, ready, uid, onAdd, onRemove }: StopPhotosProps) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<StopPhoto | null>(null);
  const [confirming, setConfirming] = useState<StopPhoto | null>(null);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const added = await onAdd(files);
      if (!added) toast.error("Pick a photo — other files go in Trip documents.");
    } catch (e) {
      toast.error(
        isNetworkFailure(e)
          ? "The photo didn't upload. Check your connection and try again."
          : "That photo couldn't be added. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = (photo: StopPhoto) => {
    setConfirming(null);
    setViewing(null);
    void onRemove(photo).catch(() => toast.error("That photo wasn't deleted. Try again."));
  };

  return (
    <div className="mt-2.5">
      <span className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground">
        <Camera className="size-3.5" aria-hidden />
        Photos
      </span>
      {!ready || !uid ? (
        <p className="text-[12.5px] text-muted-foreground">Photos on stops aren't available right now.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {photos.map((photo) => (
            <Thumb key={photo.id} photo={photo} onOpen={() => setViewing(photo)} />
          ))}
          {/* A label, not a scripted click: iPhones do not always open the
              picker for one. */}
          <label
            htmlFor={inputId}
            aria-disabled={busy}
            className={`grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-card text-center text-[11.5px] font-semibold text-muted-foreground ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <span className="flex flex-col items-center gap-0.5">
              <Camera className="size-4" aria-hidden />
              {busy ? "Adding…" : "Add"}
            </span>
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void add(files);
            }}
          />
        </div>
      )}

      {viewing && (
        <Sheet open onClose={() => setViewing(null)} title="Photo" above>
          <FullPhoto photo={viewing} />
          {uid && viewing.user_id === uid && (
            <button
              type="button"
              onClick={() => setConfirming(viewing)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 text-[14px] font-semibold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete photo
            </button>
          )}
        </Sheet>
      )}
      <ConfirmSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Delete this photo?"
        body="It goes from this stop and from your Photo memories, for everyone on the trip."
        confirmLabel="Delete"
        onConfirm={() => confirming && remove(confirming)}
      />
    </div>
  );
}

function Thumb({ photo, onOpen }: { photo: StopPhoto; onOpen: () => void }) {
  const url = useSignedPhoto(photo.storage_path);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open photo"
      className="size-16 overflow-hidden rounded-xl bg-elevated"
    >
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" />}
    </button>
  );
}

function FullPhoto({ photo }: { photo: StopPhoto }) {
  const url = useSignedPhoto(photo.storage_path);
  return url ? (
    <img src={url} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />
  ) : (
    <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-elevated" />
  );
}
