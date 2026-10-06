import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Sheet } from "@/components/Sheet";
import { Camera, ImageIcon, Trash2 } from "@/components/icons";
import { useSignedPhoto } from "@/hooks/useTripPhotos";
import { STOP_PHOTOS_PER_PICK, type StopPhoto, type StopPhotosAdded } from "@/hooks/useStopPhotos";
import { isNetworkFailure } from "@/lib/ai-errors";

export type StopPhotosProps = {
  /** The stop's name (or the trip's), to describe its photos. */
  title: string;
  /** "trip" for the trip menu's photos of the whole trip; a stop's otherwise. */
  scope?: "stop" | "trip";
  photos: StopPhoto[];
  /** False while the stop_photos migration is not applied. */
  available: boolean;
  /** Who is looking: only their own photos can be deleted. */
  uid: string | null;
  onAdd: (files: File[]) => Promise<StopPhotosAdded>;
  onRemove: (photo: StopPhoto) => Promise<void>;
  /** Keep one of your photos off read-only links; absent until its migration is in. */
  onHide?: ((photo: StopPhoto, hidden: boolean) => Promise<void>) | undefined;
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

/** Adding photos, with what to say when some did not go in. */
function usePhotoAdd(onAdd: StopPhotosProps["onAdd"], confirmTo?: string) {
  const [busy, setBusy] = useState(false);
  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const result = await onAdd(files);
      const message = addedMessage(result);
      if (message) toast.error(message);
      else if (confirmTo && result.added)
        toast.success(`${plural(result.added)} added to ${confirmTo}`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, add };
}

/**
 * One tap to the camera, or to the phone's photos, for a stop, where the stop
 * is shown: on its card and on Now. Nothing to open first; the photo goes
 * straight onto the stop. Shown only where photos can be added (set up, and
 * signed in).
 */
export function QuickPhoto({
  photos,
  label,
  className,
}: {
  photos: StopPhotosProps;
  /** Words beside the camera; without them, round icon buttons. */
  label?: string;
  className?: string;
}) {
  const { busy, add } = usePhotoAdd(photos.onAdd, photos.title);
  if (!photos.available || !photos.uid) return null;
  return (
    <>
      <QuickPick
        camera
        icon={<Camera className="size-4" aria-hidden />}
        ariaLabel={`Take a photo of ${photos.title}`}
        label={label}
        busy={busy}
        className={className}
        onFiles={add}
      />
      <QuickPick
        icon={<ImageIcon className="size-4" aria-hidden />}
        ariaLabel={`Add photos of ${photos.title} from your phone`}
        label={label ? "Upload" : undefined}
        busy={busy}
        className={className}
        onFiles={add}
      />
    </>
  );
}

/** One round or labelled button around a hidden file input (see PickTile). */
function QuickPick({
  icon,
  ariaLabel,
  label,
  busy,
  camera = false,
  className,
  onFiles,
}: {
  icon: ReactNode;
  ariaLabel: string;
  label?: string | undefined;
  busy: boolean;
  camera?: boolean;
  className?: string | undefined;
  onFiles: (files: File[]) => Promise<void>;
}) {
  return (
    <label
      aria-disabled={busy}
      title={label ? undefined : ariaLabel}
      className={`cursor-pointer focus-within:ring-2 focus-within:ring-primary ${
        label
          ? "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[14px] font-semibold shadow-2xs"
          : "tap-44 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground shadow-2xs"
      } ${busy ? "pointer-events-none opacity-50" : ""} ${className ?? ""}`}
    >
      {icon}
      {label ? <span>{busy ? "Adding…" : label}</span> : null}
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

/** The first few of a stop's photos, small, on its card. Tapping opens the stop. */
export function PhotoStrip({
  photos,
  title,
  onOpen,
}: {
  photos: StopPhoto[];
  title: string;
  onOpen: () => void;
}) {
  if (!photos.length) return null;
  const shown = photos.slice(0, STRIP_MAX);
  const more = photos.length - shown.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${plural(photos.length)} of ${title}`}
      className="mt-2 flex items-center gap-1"
    >
      {shown.map((photo) => (
        <StripThumb key={photo.id} photo={photo} />
      ))}
      {more > 0 && (
        <span className="grid size-10 place-items-center rounded-lg bg-elevated text-[12px] font-semibold text-muted-foreground">
          +{more}
        </span>
      )}
    </button>
  );
}

const STRIP_MAX = 4;

function StripThumb({ photo }: { photo: StopPhoto }) {
  const url = useSignedPhoto(photo.storage_path);
  return (
    <span className="block size-10 overflow-hidden rounded-lg bg-elevated">
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" />}
    </span>
  );
}

/**
 * The traveller's own photos of a stop, in the stop's sheet. Everyone on the
 * trip sees them; each is also in its owner's Photo memories.
 */
export function StopPhotos({
  title,
  scope = "stop",
  photos,
  available,
  uid,
  onAdd,
  onRemove,
  onHide,
}: StopPhotosProps) {
  const { busy, add } = usePhotoAdd(onAdd);
  const [viewing, setViewing] = useState<StopPhoto | null>(null);
  const [confirming, setConfirming] = useState<StopPhoto | null>(null);
  // One change at a time, so an older save can never land after a newer one.
  const [hiding, setHiding] = useState(false);

  const remove = (photo: StopPhoto) => {
    setConfirming(null);
    setViewing(null);
    void onRemove(photo).catch(() => toast.error("That photo wasn't deleted. Try again."));
  };

  return (
    <div className={scope === "stop" ? "mt-2.5" : ""}>
      {scope === "stop" ? (
        <span className="mb-1 flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
          <Camera className="size-3.5" aria-hidden />
          Photos
        </span>
      ) : (
        <p className="mb-2.5 text-[13px] text-muted-foreground">
          Photos of the whole trip, and the ones added to its stops. Everyone on the trip sees them,
          and yours are in your Photo memories too.
        </p>
      )}
      {!available ? (
        <p className="text-[12.5px] text-muted-foreground">
          {scope === "stop"
            ? "Photos on stops aren't set up yet."
            : "Trip photos aren't set up yet."}
        </p>
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
                icon={<Camera className="size-5" aria-hidden />}
                ariaLabel={busy ? "Adding photos…" : `Take a photo of ${title}`}
                busy={busy}
                camera
                onFiles={add}
              />
              <PickTile
                icon={<ImageIcon className="size-5" aria-hidden />}
                ariaLabel={busy ? "Adding photos…" : `Add photos of ${title} from your phone`}
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
          {uid && viewing.user_id === uid && onHide && (
            <button
              type="button"
              disabled={hiding}
              onClick={() => {
                const photo = viewing;
                setHiding(true);
                const hidden = !photo.hidden_from_links;
                // The sheet shows the photo as it is after the change.
                setViewing({ ...photo, hidden_from_links: hidden });
                void onHide(photo, hidden)
                  .then(() =>
                    toast(
                      hidden ? "Kept off shared links" : "Shown on shared links when photos are on",
                    ),
                  )
                  .catch(() => {
                    setViewing(photo);
                    toast.error("That didn't save. Try again.");
                  })
                  .finally(() => setHiding(false));
              }}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-card text-[14px] font-semibold disabled:opacity-60"
            >
              {viewing.hidden_from_links ? "Allow on shared links" : "Keep off shared links"}
            </button>
          )}
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
        body={`It goes from this ${scope} and from your Photo memories, for everyone on the trip.`}
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
  icon,
  ariaLabel,
  busy,
  camera = false,
  onFiles,
}: {
  icon: ReactNode;
  ariaLabel: string;
  busy: boolean;
  camera?: boolean;
  onFiles: (files: File[]) => Promise<void>;
}) {
  return (
    <label
      aria-disabled={busy}
      title={ariaLabel}
      className={`grid size-16 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-card text-muted-foreground focus-within:ring-2 focus-within:ring-primary ${
        busy ? "pointer-events-none animate-pulse opacity-50" : ""
      }`}
    >
      {icon}
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
