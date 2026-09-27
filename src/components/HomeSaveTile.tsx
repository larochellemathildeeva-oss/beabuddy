import { Link } from "@tanstack/react-router";
import { Bookmark, MapPin } from "lucide-react";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";

/**
 * A saved place waiting for you, as the master's place card: its picture, its
 * name, where it is and who it came from. Shown on Home when Béa does not know
 * where you are, so there is no nearby list to show instead. Hidden when
 * nothing is saved.
 */
export function HomeSaveTile({
  waiting,
}: {
  waiting:
    | {
        name: string;
        city?: string | null;
        category?: string | null;
        recommended_by?: string | null;
      }
    | undefined;
}) {
  if (!waiting) return null;
  const where = waiting.city?.split(",")[0];
  const art = placeArtUrl(placeArtFor({ category: waiting.category, name: waiting.name }));
  return (
    <Link
      to="/recommendations"
      data-guide="home-waiting"
      className="rise tile-card-4 flex gap-3 p-2.5 transition-shadow hover:shadow-md"
    >
      <img
        src={art}
        alt=""
        decoding="async"
        className="art-dim h-[104px] w-[42%] shrink-0 rounded-[12px] object-cover"
      />
      <span className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 font-display text-[18px] font-bold leading-tight">
            {waiting.name}
          </span>
          <Bookmark className="mt-0.5 size-5 shrink-0 fill-current text-primary" aria-hidden />
        </span>
        {where ? (
          <span className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
            <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{where}</span>
          </span>
        ) : null}
        <span className="truncate text-[13px] text-muted-foreground">
          {[waiting.category, waiting.recommended_by && `from ${waiting.recommended_by}`]
            .filter(Boolean)
            .join(" · ") || "Waiting for you"}
        </span>
        <span className="mt-auto self-start rounded-full bg-primary-soft px-3 py-1 text-[12.5px] font-bold text-primary">
          Waiting for you
        </span>
      </span>
    </Link>
  );
}
