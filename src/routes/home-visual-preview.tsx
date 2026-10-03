import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Heart,
  Home,
  Luggage,
  Map,
  Plane,
  Search,
  UserRound,
} from "lucide-react";

// The checked-in route tree is refreshed by Vite after a new file route is discovered.
// @ts-ignore -- lets pre-build `tsc --noEmit` see the new preview route on its first pass.
export const Route = createFileRoute("/home-visual-preview")({
  staticData: { plane: "tab" },
  head: () => ({ meta: [{ title: "Béa — Home visual foundation" }] }),
  component: HomeVisualPreview,
});

type Theme = "calm" | "colorful" | "dark";

const themeOptions: Array<{ id: Theme; label: string }> = [
  { id: "calm", label: "Calm" },
  { id: "colorful", label: "Colorful" },
  { id: "dark", label: "Dark" },
];

const suggestionCards = [
  { title: "Iconic landmarks", fill: "bg-tile-2" },
  { title: "Cafés & coffee", fill: "bg-tile-4" },
  { title: "Day trips", fill: "bg-tile-3" },
] as const;

function HomeVisualPreview() {
  const [theme, setTheme] = useState<Theme>("calm");
  const isDark = theme === "dark";

  return (
    <div
      data-theme={theme}
      className={isDark ? "dark min-h-dvh bg-background text-foreground" : "min-h-dvh bg-background text-foreground"}
    >
      <main className="mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="label-caps mb-2">Béa · home visual foundation</p>
            <h1 className="font-display text-[32px] leading-none sm:text-[40px]">Same experience. Three moods.</h1>
          </div>

          <div className="flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-xs)]" aria-label="Preview theme">
            {themeOptions.map((option) => {
              const selected = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  aria-pressed={selected}
                  className={`min-h-11 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </header>

        <section className="grid flex-1 items-start gap-7 lg:grid-cols-[minmax(320px,390px)_1fr]">
          <article className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[44px] border-[7px] border-[#141414] bg-background shadow-[var(--shadow-lg)]">
            <div className="flex h-[812px] flex-col overflow-hidden rounded-[36px] bg-background">
              <div className="flex items-center justify-between px-5 pb-2 pt-4 text-[12px] font-bold">
                <span>9:41</span>
                <span aria-hidden="true">● ● ▰</span>
              </div>

              <div className="flex items-center justify-between px-5 py-2">
                <div className="font-display text-[34px] leading-none">
                  Béa<span className="text-[#e88f79]">.</span>
                </div>
                <div className="flex gap-2">
                  <IconButton label="Search"><Search className="size-[18px]" /></IconButton>
                  <IconButton label="Notifications"><Bell className="size-[18px]" /></IconButton>
                </div>
              </div>

              <div className="px-5 pb-3 pt-1">
                <p className="label-caps text-[10px]">Upcoming trip</p>
                <div className="mt-1 flex items-start justify-between gap-4">
                  <h2 className="font-display text-[37px] leading-[0.9]">Berlin<br />in 2 days.</h2>
                  <button
                    type="button"
                    aria-label="Open upcoming trip"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-[var(--shadow-sm)]"
                  >
                    <ArrowRight className="size-5" />
                  </button>
                </div>
              </div>

              <div className="relative mx-3 min-h-0 flex-1 overflow-hidden rounded-[26px] bg-card">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,var(--tile-3),transparent_28%),radial-gradient(circle_at_22%_76%,var(--tile-2),transparent_34%),linear-gradient(160deg,var(--card),var(--elevated))]" />
                <svg className="absolute inset-0 size-full" viewBox="0 0 360 330" role="img" aria-label="Preview route from Paris to Prague to Berlin">
                  <path d="M50 255 C96 238 126 206 156 179 C188 152 221 134 248 112 C271 94 289 68 307 48" fill="none" stroke="currentColor" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" />
                  {[{x:50,y:255},{x:156,y:179},{x:248,y:112},{x:307,y:48}].map((point) => (
                    <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="6" fill="var(--background)" stroke="currentColor" strokeWidth="3" />
                  ))}
                </svg>
                <Plane className="absolute left-[43%] top-[31%] size-5 -rotate-12" />
                <RoutePill className="left-5 bottom-7" city="Paris" stay="3 days" />
                <RoutePill className="right-5 bottom-[108px]" city="Prague" stay="1 day" />
                <RoutePill className="right-5 top-5" city="Berlin" stay="2 days" />
              </div>

              <div className="mx-3 -mt-2 grid grid-cols-3 rounded-[24px] border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
                <Metric icon={<CheckCircle2 className="size-4" />} value="3" label="to-dos" />
                <Metric icon={<Plane className="size-4" />} value="BA932" label="LHR → BER" />
                <Metric icon={<Luggage className="size-4" />} value="70%" label="packed" />
              </div>

              <div className="mx-4 mt-3 flex min-h-[50px] items-center gap-3 rounded-full border border-border bg-card px-4">
                <Search className="size-[17px] shrink-0" />
                <span className="flex-1 text-[13px] text-muted-foreground">Where to next?</span>
                <span className="grid size-9 place-items-center rounded-full bg-foreground text-background"><ArrowRight className="size-4" /></span>
              </div>

              <section className="px-4 pb-2 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Suggested for your trip</h3>
                  <button type="button" className="min-h-11 text-[11px] font-semibold">See all →</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {suggestionCards.map((card) => (
                    <div key={card.title} className={`relative h-[94px] overflow-hidden rounded-[16px] ${card.fill}`}>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-[11px] font-semibold leading-tight text-white">
                        {card.title}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <nav className="mt-auto grid grid-cols-4 border-t border-border bg-card px-3 py-2" aria-label="Primary navigation">
                <NavItem active icon={<Home className="size-[18px]" />} label="Home" />
                <NavItem icon={<Map className="size-[18px]" />} label="Trips" />
                <NavItem icon={<Heart className="size-[18px]" />} label="Saved" />
                <NavItem icon={<UserRound className="size-[18px]" />} label="Profile" />
              </nav>
            </div>
          </article>

          <aside className="grid gap-4 sm:grid-cols-2 lg:pt-12">
            <ModuleCard title="Saved for this trip" meta="12 places" className="bg-tile-2" />
            <ModuleCard title="Trip tools" meta="Currency, eSIM, transport" className="bg-card" />
            <ModuleCard title="Before you go" meta="5 essentials left" className="bg-tile-5" />
            <ModuleCard title="Booked & ready" meta="3 items" className="bg-tile-2" />
            <ModuleCard title="Right now there" meta="Live from Berlin" className="bg-tile-1" />
            <ModuleCard title="Weather there" meta="14° · Partly cloudy" className="bg-card" />
            <ModuleCard title="Group plans" meta="3 people" className="bg-tile-3" />
            <ModuleCard title="Worth a detour" meta="Curated near Berlin" className="bg-tile-4" />
            <ModuleCard title="Docs & check-in" meta="All set" className="bg-card" />
            <ModuleCard title="Customize home" meta="Choose and reorder modules" className="bg-tile-5" />
          </aside>
        </section>
      </main>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} className="grid size-11 place-items-center rounded-full bg-card shadow-[var(--shadow-xs)]">
      {children}
    </button>
  );
}

function RoutePill({ className, city, stay }: { className: string; city: string; stay: string }) {
  return (
    <div className={`absolute flex items-center gap-2 rounded-full border border-white/30 bg-background/90 px-3 py-2 shadow-[var(--shadow-sm)] backdrop-blur-md ${className}`}>
      <span className="size-7 rounded-full bg-tile-2 ring-2 ring-background" />
      <span className="leading-tight">
        <strong className="block text-[11px]">{city}</strong>
        <span className="block text-[10px] text-muted-foreground">{stay}</span>
      </span>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-1 text-center [&+&]:border-l [&+&]:border-border">
      <span className="shrink-0">{icon}</span>
      <span className="leading-tight">
        <strong className="block text-[11px]">{value}</strong>
        <span className="block text-[9px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function NavItem({ active = false, icon, label }: { active?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="flex min-h-11 flex-col items-center justify-center gap-1 text-[9px]" aria-current={active ? "page" : undefined}>
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{icon}</span>
      <span className={active ? "font-semibold" : "text-muted-foreground"}>{label}</span>
    </button>
  );
}

function ModuleCard({ title, meta, className }: { title: string; meta: string; className: string }) {
  return (
    <section className={`min-h-[142px] rounded-[22px] border border-border/60 p-4 shadow-[var(--shadow-xs)] ${className}`}>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{meta}</p>
      <div className="mt-7 h-2 w-20 rounded-full bg-foreground/10" />
      <div className="mt-2 h-2 w-28 rounded-full bg-foreground/5" />
    </section>
  );
}