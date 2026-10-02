import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Sheet } from "@/components/Sheet";
import { Camera, ImageIcon, Trash2 } from "@/components/icons";
import { useSignedPhoto } from "@/hooks/useTripPhotos";
import { STOP_PHOTOS_PER_PICK, type StopPhoto, type StopPhotosAdded } from "@/hooks/useStopPhotos";
import { isNetworkFailure } from "@/lib/ai-errors";

export type StopPhotosProps = {
  /** The stop's name, to describe its photos. */
  title: string;
  photos: StopPhoto[];
  /** False while the stop_photos migration is not applied. */
  available: boolean;
  /** Who is looking: only their own photos can be deleted. */
  uid: string | null;
  onAdd: (files: File[]) => Promise<StopPhotosAdded>;
  onRemove: (photo: StopPhoto) => Promise<void>;
};

const plural = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

/** What to say after a pick: nothing when every photo went in. */
function addedMessage({ added, skipped, failed, error }: StopPhotosAdded): string | null {
  const parts: string[] = [];
  if (failed) {
    const why = isNetworkFailure(error) ? " Check your connection." : "";
    parts.push(
      added
        ? `Added ${plural(added)}; the other ${plural(failed)} didn't upload.${why} Pick just those to try again.`
        : `The ${failed === 1 ? "photo" : "photos"} didn't upload.${why} Try again.`,
    );
  }
  if (skipped)
    parts.push(
      `${plural(skipped)} left out: up to ${STOP_PHOTOS_PER_PICK} photos at a time, and other files go in Trip documents.`,
    );
  return parts.length ? parts.join(" ") : null;
}

/**
 * The traveller's own photos of a stop, in the stop's sheet. Everyone on the
 * trip sees them; each is also in its owner's Photo memories.
 */
export function StopPhotos({ title, photos, available, uid, onAdd, onRemove }: StopPhotosProps) {
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<StopPhoto | null>(null);
  const [confirming, setConfirming] = useState<StopPhoto | null>(null);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const message = addedMessage(await onAdd(files));
      if (message) toast.error(message);
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
      {!available ? (
        <p className="text-[12.5px] text-muted-foreground">Photos on stops aren't set up yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {photos.map((photo, i) => (
            <Thumb
              key={photo.id}
              photo={photo}
              label={`Open photo ${i + 1} of ${title}`}
              onOpen={() => setViewing(photo)}
            />
          ))}
          {uid && (
            <>
              <PickTile
                label={busy ? "Adding…" : "Take photo"}
                icon={<Camera className="size-4" aria-hidden />}
                ariaLabel={`Take a photo of ${title}`}
                busy={busy}
                camera
                onFiles={add}
              />
              <PickTile
                label={busy ? "Adding…" : "From photos"}
                icon={<ImageIcon className="size-4" aria-hidden />}
                ariaLabel={`Add photos of ${title} from your phone`}
                busy={busy}
                onFiles={add}
              />
            </>
          )}
        </div>
      )}

      {viewing && (
        <Sheet open onClose={() => setViewing(null)} title="Photo" hint={title} above>
          <FullPhoto photo={viewing} alt={`Photo of ${title}`} />
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

/**
 * One way in: the camera, or the phone's photos. A label around its input,
 * not a scripted click: iPhones do not always open the picker for one. The
 * ring shows keyboard focus, which lands on the hidden input inside.
 *
 * The camera is its own tile because a picker that takes several photos
 * leaves the camera out on many Android phones; `capture` opens it directly.
 */
function PickTile({
  label,
  icon,
  ariaLabel,
  busy,
  camera = false,
  onFiles,
}: {
  label: string;
  icon: ReactNode;
  ariaLabel: string;
  busy: boolean;
  camera?: boolean;
  onFiles: (files: File[]) => Promise<void>;
}) {
  return (
    <label
      aria-disabled={busy}
      className={`grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-card px-1 text-center text-[11px] font-semibold leading-tight text-muted-foreground focus-within:ring-2 focus-within:ring-primary ${
        busy ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <span className="flex flex-col items-center gap-0.5">
        {icon}
        {label}
      </span>
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: "environment" as const } : { multiple: true })}
        disabled={busy}
        aria-label={ariaLabel}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void onFiles(files);
        }}
      />
    </label>
  );
}

function Thumb({ photo, label, onOpen }: { photo: StopPhoto; label: string; onOpen: () => void }) {
  const url = useSignedPhoto(photo.storage_path);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="size-16 overflow-hidden rounded-xl bg-elevated"
    >
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" />}
    </button>
  );
}

/** One box whatever the photo's shape, so the sheet does not jump when it loads. */
function FullPhoto({ photo, alt }: { photo: StopPhoto; alt: string }) {
  const url = useSignedPhoto(photo.storage_path);
  return (
    <div className="aspect-[4/3] max-h-[70vh] w-full overflow-hidden rounded-xl bg-elevated">
      {url ? (
        <img src={url} alt={alt} className="size-full object-contain" />
      ) : (
        <div className="size-full animate-pulse" />
      )}
    </div>
  );
}
