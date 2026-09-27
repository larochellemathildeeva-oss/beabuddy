import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/icons";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";

/** A place as the Recs screens pass it around: a search hit, a nearby find or a save. */
export type RecsPlace = {
  name: string;
  category?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  address?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  url?: string | undefined;
  source?: string | undefined;
  /** The saved row this is, when it is already in the vault. */
  savedId?: string | undefined;
};

/** The painted picture for a place, dimmed in Dark like every painting. */
export function PlaceArt({
  place,
  className = "",
}: {
  place: { name?: string | null | undefined; category?: string | null | undefined };
  className?: string;
}) {
  return (
    <img
      src={placeArtUrl(placeArtFor({ category: place.category, name: place.name }))}
      alt=""
      loading="lazy"
      draggable={false}
      className={`art-dim object-cover ${className}`}
    />
  );
}

/** A section heading in the master's size, with an optional "See all". */
export function RecsSectionHead({
  title,
  onSeeAll,
  seeAllLabel = "See all",
}: {
  title: string;
  onSeeAll?: (() => void) | undefined;
  seeAllLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
      {onSeeAll && (
        <button type="button" onClick={onSeeAll} className="text-[14px] font-semibold text-primary">
          {seeAllLabel}
        </button>
      )}
    </div>
  );
}

/**
 * A sheet rising from the bottom of the screen, over the tab bar. Escape and
 * the backdrop close it.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // On the body: the page slides in with a transform, and a fixed element
  // inside a transformed one is fixed to it, not to the screen.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="rise card-raised relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-b-none px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-border bg-card"
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
