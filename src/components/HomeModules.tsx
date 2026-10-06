import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, Coins, Download, Languages, Plus, Quote, Train } from "@/components/icons";
import { ModuleCard, NowThereCard, WeatherThereCard } from "@/components/ModuleCards";
import type { HomeTripContext } from "@/hooks/useHomeTripModules";
import type { TripRow } from "@/hooks/useTrips";
import type { HomeSectionKey } from "@/hooks/useHomeLayout";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";

type Context = HomeTripContext;

/** One trip module, as the traveller arranged them (Customize home). */
export function HomeTripModule({
  module: key,
  trip,
  ctx,
  me,
}: {
  module: HomeSectionKey;
  trip: TripRow;
  ctx: Context;
  /** The traveller, whose own member row may carry no name. */
  me: { id: string | null; name: string };
}): ReactNode {
  const tripLink = (search?: Record<string, string>) => ({
    to: "/trips/$tripId",
    params: { tripId: trip.id },
    ...(search ? { search } : {}),
  });
  switch (key) {
    case "saved":
      return (
        <ModuleCard
          guide="home-module-saved"
          title="Saved for this trip"
          sub={`${ctx.savedHere.length} ${ctx.savedHere.length === 1 ? "place" : "places"}`}
          art={ctx.art}
          action={{ label: "Open your saved places", icon: Bookmark, to: "/recommendations" }}
        />
      );
    case "now":
      return (
        <NowThereCard
          guide="home-module-now"
          place={ctx.here.city || trip.title}
          lat={ctx.here.lat}
          lon={ctx.here.lon}
          art={ctx.art}
        />
      );
    case "weatherThere":
      return (
        <WeatherThereCard
          guide="home-module-weather"
          place={ctx.here.city || trip.title}
          lat={ctx.here.lat}
          lon={ctx.here.lon}
          art={ctx.art}
        />
      );
    case "group":
      return (
        <ModuleCard
          guide="home-module-group"
          title="Group plans"
          sub={`${ctx.people.length} ${ctx.people.length === 1 ? "person" : "people"}`}
          tone={3}
          action={{ label: "Invite someone", icon: Plus, ...tripLink({ menu: "invite" }) }}
        >
          <span className="flex -space-x-2">
            {ctx.people.slice(0, 4).map((m) => (
              <span
                key={m.id}
                className="grid size-10 place-items-center rounded-full border-2 border-card bg-[var(--home-ink)] text-[14px] font-semibold text-[var(--home-ink-foreground)]"
                aria-hidden
              >
                {(m.display_name?.trim() || (m.user_id === me.id ? me.name : "") || "T")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>
            ))}
          </span>
        </ModuleCard>
      );
    case "tools":
      return <TripTools trip={trip} />;
    case "detour":
      return ctx.detour ? (
        <ModuleCard
          guide="home-module-detour"
          title="Worth a detour"
          sub={ctx.detour.name}
          art={placeArtUrl(placeArtFor(ctx.detour))}
          action={{ label: "Open your saved places", to: "/recommendations" }}
        />
      ) : (
        <ModuleCard
          guide="home-module-detour"
          title="Worth a detour"
          sub="Save a place in this trip's towns and Béa keeps it here until it's in the plan."
          tone={4}
          action={{ label: "Save a place", to: "/recommendations" }}
        />
      );
    case "notes":
      return (
        <ModuleCard guide="home-module-notes" title="Notes from Béa" tone={5}>
          <Quote className="seq-text-5 size-5" aria-hidden />
          <span className="mt-1.5 block text-[13.5px] leading-snug">{ctx.note}</span>
        </ModuleCard>
      );
    default:
      return null;
  }
}

/** "Trip tools": currency, transport, translate and offline, a tap away. */
function TripTools({ trip }: { trip: TripRow }) {
  const tools = [
    { label: "Currency", icon: Coins, search: { menu: "currency" } },
    { label: "Transport", icon: Train, search: { view: "bookings" } },
    { label: "Translate", icon: Languages, href: "https://translate.google.com/" },
    { label: "Offline", icon: Download, search: { menu: "offline" } },
  ];
  const cls = "flex min-h-11 flex-col items-center gap-1 text-[12px] text-muted-foreground";
  return (
    <ModuleCard guide="home-module-tools" title="Trip tools" tone={2}>
      <span className="grid grid-cols-2 gap-x-1 gap-y-2">
        {tools.map((tool, i) => {
          const body = (
            <>
              <span className="grid size-9 place-items-center rounded-full bg-card shadow-sm">
                <tool.icon className={`seq-text-${i + 1} size-[18px]`} aria-hidden />
              </span>
              {tool.label}
            </>
          );
          return tool.href ? (
            <a key={tool.label} href={tool.href} target="_blank" rel="noreferrer" className={cls}>
              {body}
            </a>
          ) : (
            <Link
              key={tool.label}
              to="/trips/$tripId"
              params={{ tripId: trip.id }}
              search={tool.search as never}
              className={cls}
            >
              {body}
            </Link>
          );
        })}
      </span>
    </ModuleCard>
  );
}
