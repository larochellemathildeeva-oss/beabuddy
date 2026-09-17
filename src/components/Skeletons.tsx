/**
 * Placeholders shaped like the thing that replaces them.
 *
 * A skeleton exists to stop the page jumping, so the only property that
 * matters is its size. A generic grey box that is the wrong height is worse
 * than no skeleton at all: it reserves space, then gives it back, and the
 * reader loses their place at exactly the moment the content they were
 * waiting for arrives.
 *
 * So every one of these copies the real component's dimensions — the banner's
 * 136px, the card's padding, the section's row height — rather than
 * approximating them.
 */

/** One grey block. `aria-hidden` throughout: this is furniture, not content. */
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-foreground/10 ${className}`} />;
}

/** Matches ContentCard: optional media, title, up to two meta lines. */
export function ContentCardSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      {media && <Bar className="h-[136px] w-full rounded-none" />}
      <div className="p-4">
        <Bar className="h-[19px] w-2/5" />
        <Bar className="mt-2 h-[13px] w-3/5" />
        <Bar className="mt-1.5 h-[13px] w-1/3" />
      </div>
    </div>
  );
}

/** Matches the trip card in the list: banner, then the action row. */
export function TripCardSkeleton() {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      <Bar className="h-[136px] w-full rounded-none" />
      <div className="flex items-center gap-1 p-3">
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="ml-auto h-[13px] w-24" />
      </div>
    </div>
  );
}

/** A list of trip cards, for the Trips tab's first paint. */
export function TripListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches the trip page: banner, action row, then two sections of rows. */
export function TripDetailSkeleton() {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      <Bar className="h-[136px] w-full rounded-none" />
      <div className="flex items-center gap-1 p-3">
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
      </div>
      <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
        {[0, 1].map((section) => (
          <div key={section} className="surface border border-border/50 p-3.5">
            <Bar className="h-[16.5px] w-1/3" />
            <div className="mt-3 space-y-2">
              <Bar className="h-[14.5px] w-full" />
              <Bar className="h-[14.5px] w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A row-shaped placeholder for lists of saved places and nearby pins. */
export function RowListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-soft p-3.5">
          <Bar className="h-[18px] w-1/2" />
          <Bar className="mt-2 h-[13px] w-3/4" />
        </div>
      ))}
    </div>
  );
}
