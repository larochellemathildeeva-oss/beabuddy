import { useState, type ComponentType, type ReactNode } from "react";
import { ArrowUp, ChevronRight, Plus, Sparkles, Sun, Upload, Users } from "@/components/icons";
import logo from "@/assets/bea-logo.png";

/*
 * Plan with Béa, as the master draws it: Béa asks what you would like to do,
 * four cards answer (build, import, optimize, compare), a few examples start
 * a build, and a box takes anything else in your own words. The same pieces
 * make the page under Trips and the first screen of a trip's planner sheet.
 */

/** Béa in her circle, and her question in a speech bubble. */
export function PlanHero({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative flex items-center gap-3">
      <span
        aria-hidden
        className={`relative grid shrink-0 place-items-center rounded-full bg-elevated ${
          compact ? "size-20" : "size-24"
        }`}
      >
        {/* Multiply, so the picture's pale backdrop melts into the circle. */}
        <img
          src={logo}
          alt=""
          className="size-[86%] rounded-full object-contain mix-blend-multiply"
        />
        {/* Three little strokes by her ear, as in the master. */}
        <svg viewBox="0 0 20 20" className="absolute -left-1 top-1 size-5 text-primary">
          <path
            d="M4 4l3 3M2 10h4M4 16l3-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
      <div className="plain-card relative min-w-0 flex-1 rounded-[26px] px-4 py-3">
        <span
          aria-hidden
          className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rotate-45 border-b border-l border-[color-mix(in_oklch,var(--color-border)_55%,transparent)] bg-card"
        />
        {!compact && <p className="font-display text-[30px] leading-none">Plan with Béa</p>}
        <p className={`font-display leading-tight ${compact ? "text-[21px]" : "mt-1 text-[19px]"}`}>
          What would you like to do?
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
          Béa can build a new trip, import your plan, optimize it or compare options.
        </p>
      </div>
    </div>
  );
}

type Card = {
  key: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: number;
  art: ReactNode;
  note?: string;
  onClick: () => void;
};

/** The four cards, two by two, each with its little picture in the corner. */
export function PlanCards({
  onBuild,
  onImport,
  onOptimize,
  onCompare,
  optimizeNote = "",
}: {
  onBuild: () => void;
  onImport: () => void;
  onOptimize: () => void;
  onCompare: () => void;
  /** A line under Optimize, e.g. when there is nothing to optimize yet. */
  optimizeNote?: string;
}) {
  const cards: Card[] = [
    {
      key: "build",
      icon: Plus,
      title: "Build my trip",
      body: "Share your preferences and Béa drafts a personalized day-by-day itinerary.",
      tone: 5,
      art: <MapArt />,
      onClick: onBuild,
    },
    {
      key: "import",
      icon: Upload,
      title: "Import a plan",
      body: "Upload a photo, PDF, calendar or paste your plan, and Béa turns it into a trip.",
      tone: 3,
      art: <PhotoArt />,
      onClick: onImport,
    },
    {
      key: "optimize",
      icon: Sliders,
      title: "Optimize my trip",
      body: "Béa improves the order, cuts travel time and finds the best flow.",
      tone: 4,
      art: <SignpostArt />,
      ...(optimizeNote ? { note: optimizeNote } : {}),
      onClick: onOptimize,
    },
    {
      key: "compare",
      icon: Scales,
      title: "Compare options",
      body: "Show me the pros and cons of different plans based on what matters to you.",
      tone: 1,
      art: <CompareArt />,
      onClick: onCompare,
    },
  ];
  return (
    <div data-guide="plan-cards" className="grid grid-cols-2 gap-2.5">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={card.onClick}
          data-guide={card.key === "optimize" ? "bea-optimize" : undefined}
          className={`tile-card-${card.tone} relative flex min-h-[176px] flex-col overflow-hidden p-3 text-left`}
        >
          <span aria-hidden className="pointer-events-none absolute right-1.5 top-1.5 h-14 w-20">
            {card.art}
          </span>
          <span className="grid size-11 place-items-center rounded-full bg-card/80 text-primary">
            <card.icon className="size-5" aria-hidden />
          </span>
          <span className="mt-2 block font-display text-[21px] leading-tight">{card.title}</span>
          <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
            {card.body}
          </span>
          <span className="mt-auto flex w-full items-center justify-between gap-1 pt-2">
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {card.note ?? ""}
            </span>
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card">
              <ChevronRight className="size-4" aria-hidden />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

const PLAN_EXAMPLES: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  ask: string;
}[] = [
  {
    icon: Sparkles,
    label: "A cultural trip in 3 days",
    ask: "A cultural trip in 3 days: museums, history, architecture and local life.",
  },
  {
    icon: Sun,
    label: "A mix of nature and city",
    ask: "A mix of nature and city: some days outdoors, some days in town.",
  },
  {
    icon: Users,
    label: "A family-friendly itinerary",
    ask: "A family-friendly itinerary: kid-proof pacing, parks, and easy meals.",
  },
];

/** "Not sure? Try an example" — each one starts a build with its words. */
export function PlanExamples({ onPick }: { onPick: (ask: string) => void }) {
  return (
    <section data-guide="plan-examples">
      <p className="mb-2 font-display text-[22px] leading-none">Not sure? Try an example</p>
      <div className="grid grid-cols-3 gap-2">
        {PLAN_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onPick(ex.ask)}
            className="plain-card flex min-w-0 items-center gap-1.5 rounded-2xl px-2.5 py-2.5 text-left text-[12px] leading-snug"
          >
            <ex.icon className="size-5 shrink-0 text-primary" aria-hidden />
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** "Or just tell Béa what you need…" — anything else, in your own words. */
export function PlanAsk({ onSend }: { onSend: (ask: string) => void }) {
  const [ask, setAsk] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ask.trim()) onSend(ask.trim());
      }}
      data-guide="plan-ask"
      className="plain-card flex items-center gap-2 rounded-full p-1.5"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-elevated text-muted-foreground"
      >
        <Plus className="size-5" />
      </span>
      <input
        value={ask}
        onChange={(e) => setAsk(e.target.value)}
        maxLength={2000}
        placeholder="Or just tell Béa what you need…"
        aria-label="Tell Béa what you need"
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none"
      />
      <button
        type="submit"
        disabled={!ask.trim()}
        aria-label="Send to Béa"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
      >
        <ArrowUp className="size-5" aria-hidden />
      </button>
    </form>
  );
}

/* ─── The cards' icons and little pictures ─────────────────────────────── */

function Sliders({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor">
      <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2" fill="var(--color-card)" strokeWidth="1.8" />
      <circle cx="15" cy="12" r="2" fill="var(--color-card)" strokeWidth="1.8" />
      <circle cx="8" cy="17" r="2" fill="var(--color-card)" strokeWidth="1.8" />
    </svg>
  );
}

function Scales({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18M7 21h10M5 7h14M12 5l-7 2M12 5l7 2" />
      <path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />
    </svg>
  );
}

function MapArt() {
  return (
    <svg viewBox="0 0 80 56" className="size-full">
      <path d="M8 18l18-8 18 8 18-8v34l-18 8-18-8-18 8z" fill="#cfe4d3" opacity="0.9" />
      <path d="M26 10v34M44 18v34" stroke="#a9ccb2" strokeWidth="1.5" />
      <path d="M14 34c8-6 14 2 22-4s12 4 20-2" stroke="#e8b89d" strokeWidth="1.6" fill="none" />
      <path d="M58 4a7 7 0 0 1 7 7c0 5-7 12-7 12s-7-7-7-12a7 7 0 0 1 7-7z" fill="#d96b43" />
      <circle cx="58" cy="11" r="2.4" fill="#fff" />
    </svg>
  );
}

function PhotoArt() {
  return (
    <svg viewBox="0 0 80 56" className="size-full">
      <rect
        x="30"
        y="10"
        width="46"
        height="40"
        rx="5"
        fill="#f6d9c8"
        transform="rotate(8 53 30)"
      />
      <rect x="22" y="4" width="48" height="44" rx="5" fill="#fff" stroke="#e7dde2" />
      <rect x="27" y="9" width="17" height="13" rx="2" fill="#a9d3b4" />
      <path d="M27 22l6-6 5 4 6-5v7z" fill="#5e9c6f" />
      <path d="M48 12h17M48 17h12M27 28h38M27 33h30" stroke="#d8cfd5" strokeWidth="2" />
      <rect x="48" y="26" width="17" height="15" rx="1.5" fill="none" stroke="#d8cfd5" />
    </svg>
  );
}

function SignpostArt() {
  return (
    <svg viewBox="0 0 80 56" className="size-full">
      <rect x="42" y="4" width="4" height="52" rx="2" fill="#d8b98e" />
      <path d="M46 8h22l6 6-6 6H46z" fill="#e8b89d" />
      <path d="M42 22H22l-6 6 6 6h20z" fill="#e7d3b0" />
      <path d="M46 34h20l6 6-6 6H46z" fill="#7fb08a" />
    </svg>
  );
}

function CompareArt() {
  return (
    <svg viewBox="0 0 80 56" className="size-full">
      <rect
        x="16"
        y="6"
        width="28"
        height="40"
        rx="4"
        fill="#d6ead9"
        transform="rotate(-6 30 26)"
      />
      <rect
        x="44"
        y="10"
        width="28"
        height="40"
        rx="4"
        fill="#f6d9c8"
        transform="rotate(6 58 30)"
      />
      <text x="24" y="22" fontSize="12" fontWeight="700" fill="#4d8a5c">
        A
      </text>
      <text x="54" y="26" fontSize="12" fontWeight="700" fill="#d96b43">
        B
      </text>
      <path d="M22 30h14M22 35h12M52 34h14M52 39h11" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
