/**
 * Béa World — the Map tab's sections, restyled to the approved board
 * (docs/VISUAL_NORTH_STAR.md → mockup.html's World screen), with BeaGlobe.
 *
 * NEW file. Nothing here edits src/routes/world.tsx or src/components/Globe.tsx.
 * Each section is presentational and takes the page's REAL data and
 * callbacks as props — there is no fabricated content in src/ (sample data
 * for the previews lives in dev/sample-data.ts only).
 *
 * In the app, AppShell keeps the header (logo, "Béa.", kicker, title, search)
 * and the five-tab bar; render only the sections below inside it. The
 * `WorldHeaderPreview` / `WorldNavPreview` stand-ins at the bottom exist for
 * the standalone previews and must not be used in the app.
 *
 * Tokens: the app's own (--background, --card, --foreground, --border,
 * --muted-foreground, --acc*, --font-*) plus `--world-*` from
 * src/styles/world.css. Type: ≥13px everywhere, body 16, display 40.
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
// Flag and Bell are not in the app's icon wrapper; import them from Phosphor
// directly (already a dependency) rather than editing src/components/icons.tsx.
import { Bell, Flag } from "@phosphor-icons/react";
import {
  BarChart3,
  Bookmark,
  ChevronRight,
  CircleCheck,
  Compass,
  Globe2,
  Home,
  Luggage,
  MapIcon,
  MapPin,
  Plus,
  Search,
  User,
} from "@/components/icons";

type IconType = typeof Globe2 | typeof Flag;
const serif = "[font-family:var(--font-display)]";
const sans = "[font-family:var(--font-sans)]";
const float = "bg-(--card) border border-(--border) shadow-(--world-float-shadow)";

/* -------------------------------------------------------------------- tabs */

export type WorldTabId = "map" | "bucket" | "been" | "stats";
const WORLD_TABS: { id: WorldTabId; label: string; icon: IconType }[] = [
  { id: "map", label: "Map", icon: Globe2 },
  { id: "bucket", label: "Bucket list", icon: Bookmark },
  { id: "been", label: "Been there", icon: CircleCheck },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

/**
 * Map / Bucket list / Been there / Stats. Same ids as world.tsx's `?tab=`.
 * Selected = accent-soft tile + bold + aria-selected (never colour alone).
 */
export function WorldTabs({
  active,
  onChange,
  className,
}: {
  active: WorldTabId;
  onChange: (tab: WorldTabId) => void;
  className?: string | undefined;
}) {
  return (
    <div
      role="tablist"
      aria-label="World views"
      className={cn("mx-4 grid grid-cols-4 gap-1 rounded-[20px] p-1", float, className)}
    >
      {WORLD_TABS.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`world-tab-${t.id}`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = WORLD_TABS[(i + d + WORLD_TABS.length) % WORLD_TABS.length]!;
              onChange(next.id);
              document.getElementById(`world-tab-${next.id}`)?.focus();
            }}
            className={cn(
              sans,
              "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[13px] leading-[1.1] transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              on
                ? "bg-(--world-active) font-bold text-(--foreground)"
                : "font-medium text-(--muted-foreground)",
            )}
          >
            <t.icon
              className={cn("size-5", on ? "text-(--foreground)" : "text-(--muted-foreground)")}
              weight={on ? "bold" : "regular"}
              aria-hidden
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ globe stage */

/**
 * The globe, full-bleed on the page (no panel), with the round "Add places"
 * button over its lower right as on the board. Pass <BeaGlobe … /> as the child.
 */
export function WorldGlobeStage({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string | undefined;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative", className)} {...rest}>
      {children}
    </div>
  );
}

/** The round "Add places" button over the globe's lower right; render it inside the stage. */
export function WorldAddButton({
  onClick,
  ...rest
}: { onClick: () => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a city or country"
      className={cn(
        sans,
        "absolute bottom-1 right-3 z-30 flex flex-col items-center gap-1 text-[13px] font-semibold text-(--foreground)",
      )}
      {...rest}
    >
      <span className="grid size-12 place-items-center rounded-full bg-(--card) shadow-[0_4px_14px_rgb(0_0_0/0.16)] transition-transform active:scale-95">
        <Plus className="size-[22px]" weight="bold" aria-hidden />
      </span>
      <span className="rounded-full px-1 [text-shadow:0_0_8px_var(--background)]">Add places</span>
    </button>
  );
}

/* ---------------------------------------------------------------- filters */

export type WorldFilterId = "cities" | "provinces" | "countries" | "continents";
const WORLD_FILTERS: {
  id: WorldFilterId;
  label: ReactNode;
  text: string;
  one: string;
  icon: IconType;
}[] = [
  { id: "cities", label: "Cities", text: "Cities", one: "City", icon: MapPin },
  {
    id: "provinces",
    label: (
      <>
        Provinces
        <br />
        &amp; states
      </>
    ),
    text: "Provinces & states",
    one: "Province or state",
    icon: MapIcon,
  },
  { id: "countries", label: "Countries", text: "Countries", one: "Country", icon: Flag },
  { id: "continents", label: "Continents", text: "Continents", one: "Continent", icon: Compass },
];

/**
 * Cities / Provinces & states / Countries / Continents as four pastel tiles.
 * `active=null` is world.tsx's "all"; tapping the pressed tile clears it.
 */
export function WorldFilters({
  active,
  onChange,
  available,
  counts,
  className,
}: {
  active: WorldFilterId | null;
  onChange: (filter: WorldFilterId | null) => void;
  /** Filters that have something to show; the rest are left out. Default: all four. */
  available?: readonly WorldFilterId[] | undefined;
  /** Real counts, read by screen readers ("3 Cities"). */
  counts?: Partial<Record<WorldFilterId, number>> | undefined;
  className?: string | undefined;
}) {
  const shown = WORLD_FILTERS.filter((f) => !available || available.includes(f.id));
  return (
    <div
      role="group"
      aria-label="Show on the map"
      className={cn("mx-4 grid gap-1 rounded-[20px] p-1", float, className)}
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map((f) => {
        const on = f.id === active;
        const n = WORLD_FILTERS.findIndex((x) => x.id === f.id) + 1;
        const count = counts?.[f.id];
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            aria-label={count === undefined ? f.text : `${count} ${count === 1 ? f.one : f.text}`}
            onClick={() => onChange(on ? null : f.id)}
            className={cn(
              sans,
              "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-center text-[13px] leading-[1.1] text-(--foreground)",
              "outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              on ? "font-bold" : "font-medium",
            )}
            style={{
              background: `var(--world-chip-${n}-bg)`,
              boxShadow: on ? "inset 0 0 0 2px var(--world-chip-ring)" : undefined,
            }}
          >
            <f.icon
              className="size-5"
              weight={on ? "bold" : "regular"}
              style={{ color: `var(--world-chip-${n}-fg)` }}
              aria-hidden
            />
            <span>{f.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- place card */

export type WorldPlace = {
  id: string;
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2 for the flag; omit when unknown. */
  countryCode?: string | undefined;
  /** A real photo of the traveller's (usePhotoMemories) — omit for a quiet pin tile, never a stock image. */
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  /** Real counts only. */
  visits: number;
  /** Replaces the visit count line when the count is of something else ("3 places"). */
  detail?: string | undefined;
  /** Pre-formatted, e.g. "Apr 2024" (from the latest dateVisited). */
  lastVisit?: string | undefined;
};

function flagEmoji(code: string | undefined): string {
  const c = (code ?? "").toUpperCase();
  return /^[A-Z]{2}$/.test(c)
    ? String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
    : "";
}

/** The place you tapped on the globe (world.tsx's selected pin). The whole card opens it. */
export function WorldPlaceCard({
  place,
  onOpen,
  onClose,
  caption,
  className,
}: {
  place: WorldPlace;
  /** Opens the place; shows the round chevron. */
  onOpen?: ((place: WorldPlace) => void) | undefined;
  /** Dismisses the card; shows a "Close" button. */
  onClose?: (() => void) | undefined;
  /** A small line above the name ("You've been here"). */
  caption?: string | undefined;
  className?: string | undefined;
}) {
  const flag = flagEmoji(place.countryCode);
  return (
    <section
      aria-label={`${place.name}, ${place.country}`}
      className={cn(
        "relative mx-4 flex items-center gap-3 rounded-[20px] p-2 pr-3",
        float,
        className,
      )}
    >
      {place.imageSrc ? (
        <img
          src={place.imageSrc}
          alt={place.imageAlt ?? ""}
          className="h-[78px] w-[104px] shrink-0 rounded-[14px] object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-[78px] w-[104px] shrink-0 place-items-center rounded-[14px] bg-(--world-place-fallback)"
        >
          <MapPin className="size-7 text-(--muted-foreground)" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        {caption && (
          <span
            className={cn(
              sans,
              "block text-[13px] font-semibold uppercase tracking-[0.12em] text-(--muted-foreground)",
            )}
          >
            {caption}
          </span>
        )}
        <span className={cn(serif, "block truncate text-[22px] leading-[1.1] text-(--foreground)")}>
          {place.name}
        </span>
        <span
          className={cn(
            sans,
            "mt-1 flex items-center gap-1.5 text-[14px] text-(--muted-foreground)",
          )}
        >
          <span className="truncate">{place.country}</span>
          {flag && (
            <span aria-hidden className="text-[14px] leading-none">
              {flag}
            </span>
          )}
        </span>
        <span
          className={cn(
            sans,
            "mt-1.5 flex items-center gap-1 whitespace-nowrap text-[13px] text-(--muted-foreground)",
          )}
        >
          <MapPin className="size-[14px]" aria-hidden />
          {place.detail ?? `${place.visits} visit${place.visits === 1 ? "" : "s"}`}
          {place.lastVisit && <> · Last: {place.lastVisit}</>}
        </span>
      </span>
      {onOpen && (
        <button
          type="button"
          onClick={() => onOpen(place)}
          aria-label={`Open ${place.name}`}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-(--world-place-fallback) text-(--foreground) outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <ChevronRight className="size-[18px]" weight="bold" aria-hidden />
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            sans,
            "min-h-11 shrink-0 self-start rounded-full border border-(--border) px-3 text-[13px] text-(--muted-foreground) outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
          )}
        >
          Close
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ stats strip */

export type WorldStat = { key: string; label: string; value: number | string };

/**
 * The travel stats strip: up to four of the traveller's chosen stats
 * (useStatsLayout + STAT_OPTIONS), with real computed values from world.tsx.
 */
export function WorldStatsStrip({
  stats,
  onOpen,
  className,
}: {
  stats: readonly WorldStat[];
  onOpen?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const shown = stats.slice(0, 4);
  if (shown.length === 0) return null;
  const body = (
    <dl
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map((s, i) => (
        <div key={s.key} className="relative flex flex-col items-center px-1 py-2.5">
          <dd
            className={cn(
              serif,
              "order-1 text-[24px] leading-none tabular-nums text-(--foreground)",
            )}
          >
            {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
          </dd>
          <dt
            className={cn(
              sans,
              "order-2 mt-1 text-center text-[13px] leading-[1.15] text-(--muted-foreground)",
            )}
          >
            {s.label}
          </dt>
          {i > 0 && (
            <span
              aria-hidden
              className="absolute bottom-3 start-0 top-3 w-[1.5px] rounded-full"
              style={{ background: `var(--world-stat-${Math.min(i, 3)})` }}
            />
          )}
        </div>
      ))}
    </dl>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open your travel stats"
      className={cn(
        "mx-4 flex rounded-[20px] text-left outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
        float,
        className,
      )}
    >
      {body}
    </button>
  ) : (
    <section aria-label="Travel stats" className={cn("mx-4 flex rounded-[20px]", float, className)}>
      {body}
    </section>
  );
}

/* ------------------------------------------------------- customize button */

/** "Customize world" — opens world.tsx's existing <CustomizeWorld> sheet. */
export function CustomizeWorldButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        sans,
        "mx-4 flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-dashed border-(--border) text-[15px] font-semibold text-(--muted-foreground)",
        "outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
        className,
      )}
    >
      <Plus className="size-[18px]" aria-hidden />
      Customize world
    </button>
  );
}

/* ---------------------------------------------- preview-only stand-ins */

/**
 * PREVIEW ONLY. Mirrors AppShell's header for the standalone pages: dog logo
 * + "Béa" + coral dot, round search and bell, uppercase kicker, serif title
 * with its full stop. In the app AppShell renders this — do not use it.
 */
export function WorldHeaderPreview({
  logoSrc,
  onSearch,
}: {
  logoSrc: string;
  onSearch?: (() => void) | undefined;
}) {
  return (
    <header className="px-5 pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <img src={logoSrc} alt="" className="size-10 object-contain" />
          <span className={cn(serif, "text-[34px] leading-none text-(--foreground)")}>
            Béa<span className="text-[#F26B5B]">.</span>
          </span>
        </span>
        <span className="flex gap-2.5">
          <button
            type="button"
            aria-label="Search your world"
            onClick={onSearch}
            className="grid size-11 place-items-center rounded-full bg-(--card) text-(--foreground) shadow-[0_3px_12px_rgb(0_0_0/0.07)]"
          >
            <Search className="size-[19px]" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid size-11 place-items-center rounded-full bg-(--card) text-(--foreground) shadow-[0_3px_12px_rgb(0_0_0/0.07)]"
          >
            <Bell className="size-[19px]" aria-hidden />
            <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-(--acc)" />
          </button>
        </span>
      </div>
      <p
        className={cn(
          sans,
          "mt-4 text-[13px] font-semibold uppercase leading-[1.35] tracking-[0.16em] text-(--muted-foreground)",
        )}
      >
        Places you’ve been, and all that’s still ahead.
      </p>
      <h1
        className={cn(
          serif,
          "mt-1 text-[40px] leading-[1.1] tracking-[-0.01em] text-(--foreground)",
        )}
      >
        Your world.
      </h1>
    </header>
  );
}

/** PREVIEW ONLY. Mirrors AppShell's tab bar: Home · World · Trips · Recs · You. */
export function WorldNavPreview() {
  const items: { label: string; icon: IconType }[] = [
    { label: "Home", icon: Home },
    { label: "World", icon: Globe2 },
    { label: "Trips", icon: Luggage },
    { label: "Recs", icon: Bookmark },
    { label: "You", icon: User },
  ];
  return (
    <nav aria-label="Main" className={cn("mx-3 grid grid-cols-5 rounded-[28px] p-1.5", float)}>
      {items.map((n) => {
        const on = n.label === "World";
        return (
          <span
            key={n.label}
            aria-current={on ? "page" : undefined}
            className={cn(
              sans,
              "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[13px]",
              on
                ? "bg-(--world-active) font-bold text-(--foreground)"
                : "font-medium text-(--muted-foreground)",
            )}
          >
            <n.icon className="size-[22px]" weight={on ? "bold" : "regular"} aria-hidden />
            {n.label}
          </span>
        );
      })}
    </nav>
  );
}
