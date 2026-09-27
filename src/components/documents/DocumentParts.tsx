import type { ReactNode } from "react";
import {
  Bed,
  Car,
  ChevronRight,
  Compass,
  FilePdf,
  FileText,
  MoreHorizontal,
  Plane,
  Route,
  Ticket,
  Utensils,
} from "@/components/icons";
import { useSignedPhoto } from "@/hooks/useTripPhotos";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import {
  addedLabel,
  asKind,
  fileLook,
  type DocumentKind,
  type TripDocument,
} from "@/lib/trip-documents";

export type TripLite = {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
};

const KIND_ICON: Record<DocumentKind, typeof Plane> = {
  flight: Plane,
  train: Route,
  car: Car,
  accommodation: Bed,
  restaurant: Utensils,
  activity: Compass,
  ticket: Ticket,
  other: FileText,
};

/** A small pastel tile per kind in Colorful; plain in Calm and Dark. */
const KIND_FILL: Record<DocumentKind, string> = {
  flight: "tile-fill-2",
  train: "tile-fill-3",
  car: "tile-fill-4",
  accommodation: "tile-fill-1",
  restaurant: "tile-fill-5",
  activity: "tile-fill-3",
  ticket: "tile-fill-4",
  other: "tile-fill-2",
};

export function KindIcon({ kind, className = "size-5" }: { kind: string; className?: string }) {
  const Glyph = KIND_ICON[asKind(kind)];
  return <Glyph className={className} aria-hidden />;
}

/** The kind's icon on its small tile — for events and manual entries. */
export function KindTile({ kind, size = "md" }: { kind: string; size?: "sm" | "md" | "lg" }) {
  const box =
    size === "lg"
      ? "size-16 rounded-2xl"
      : size === "sm"
        ? "size-10 rounded-xl"
        : "size-12 rounded-2xl";
  return (
    <span
      className={`${KIND_FILL[asKind(kind)]} grid shrink-0 place-items-center border border-border/60 text-primary ${box}`}
    >
      <KindIcon kind={kind} className={size === "lg" ? "size-7" : "size-5"} />
    </span>
  );
}

/**
 * The row's file-type mark: a red PDF page, the image itself, a plain
 * document, or — for a booking entered without a file — its kind.
 */
export function DocumentIcon({
  doc,
  size = "md",
}: {
  doc: Pick<TripDocument, "storage_path" | "mime_type" | "file_name" | "kind">;
  size?: "md" | "lg";
}) {
  const look = fileLook(doc);
  const thumb = useSignedPhoto(look === "image" ? doc.storage_path : null);
  const box = size === "lg" ? "size-16 rounded-2xl" : "size-12 rounded-2xl";
  if (look === "image") {
    return thumb ? (
      <img src={thumb} alt="" className={`${box} shrink-0 border border-border/60 object-cover`} />
    ) : (
      <span className={`${box} tile-fill-3 block shrink-0 animate-pulse border border-border/60`} />
    );
  }
  if (look === "pdf") {
    return (
      <span
        className={`${box} tile-fill-5 grid shrink-0 place-items-center border border-border/60 text-destructive`}
        aria-label="PDF"
      >
        <FilePdf className={size === "lg" ? "size-9" : "size-7"} aria-hidden />
      </span>
    );
  }
  if (look === "doc") {
    return (
      <span
        className={`${box} tile-fill-2 grid shrink-0 place-items-center border border-border/60 text-primary`}
      >
        <FileText className={size === "lg" ? "size-9" : "size-7"} aria-hidden />
      </span>
    );
  }
  return <KindTile kind={doc.kind} size={size === "lg" ? "lg" : "md"} />;
}

/** One document in a list: icon, title, two short lines, when, and ⋯. */
export function DocumentRow({
  doc,
  onOpen,
  onMore,
  subtitle,
}: {
  doc: TripDocument;
  onOpen: () => void;
  onMore?: (() => void) | undefined;
  /** Replaces "Added …", e.g. the trip name in search results. */
  subtitle?: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <DocumentIcon doc={doc} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{doc.title}</span>
          {doc.lines.slice(0, 2).map((line, i) => (
            <span key={i} className="block truncate text-[13px] text-muted-foreground">
              {line}
            </span>
          ))}
          <span className="block text-[12px] text-muted-foreground/80">
            {subtitle ?? addedLabel(doc.created_at)}
          </span>
        </span>
      </button>
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          aria-label={`More options for ${doc.title}`}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A trip's painted picture, small. */
export function TripThumb({ trip, size = "md" }: { trip: TripLite; size?: "sm" | "md" }) {
  const scene = bannerSceneFor([trip.title, trip.city, trip.country], trip.id);
  const box = size === "sm" ? "size-10 rounded-xl" : "size-14 rounded-2xl";
  return (
    <img
      src={bannerArtUrl(scene)}
      alt=""
      className={`art-dim ${box} shrink-0 border border-border/60 object-cover`}
    />
  );
}

/** A tappable row inside a card: picture, eyebrow, title, one line, chevron. */
export function LinkRow({
  media,
  eyebrow,
  title,
  line,
  line2,
  onClick,
  trailing,
}: {
  media: ReactNode;
  eyebrow?: string | undefined;
  title: string;
  line?: string | undefined;
  line2?: string | undefined;
  onClick?: (() => void) | undefined;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {media}
      <span className="min-w-0 flex-1 text-left">
        {eyebrow && <span className="block text-[12.5px] text-muted-foreground">{eyebrow}</span>}
        <span className="block truncate text-[15px] font-semibold">{title}</span>
        {line && <span className="block truncate text-[13px] text-muted-foreground">{line}</span>}
        {line2 && <span className="block truncate text-[13px] text-muted-foreground">{line2}</span>}
      </span>
      {trailing ??
        (onClick ? (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null)}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-3">
      {body}
    </button>
  ) : (
    <div className="flex w-full items-center gap-3 p-3">{body}</div>
  );
}
