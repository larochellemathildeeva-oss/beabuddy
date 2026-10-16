import { createFileRoute, Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { browserHasStoredSession } from "@/lib/stored-session";
import { hasPendingOAuthResultInWindow } from "@/lib/auth-redirect";
import { SignedInHomeNext } from "@/components/next/HomeNextPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { ChevronRight, Sparkles, User, Users } from "@/components/icons";

export const Route = createFileRoute("/")({
  staticData: { plane: "tab" },
  head: () => ({
    meta: [
      { title: "Béa — Your travel life, all in one place" },
      {
        name: "description",
        content:
          "Béa turns the places you saved into a real trip: she drafts the days, orders them, gives directions and keeps your bookings — then remembers where you've been.",
      },
      { property: "og:title", content: "Béa — Your travel life, all in one place" },
      {
        property: "og:description",
        content:
          "Remember everywhere. Go anywhere. A travel memory, recommendation, and planning companion — not another AI trip generator.",
      },
    ],
  }),
  component: HomePage,
});

const noSubscribe = () => () => {};

function HomePage() {
  const { user, loading } = useAuth();
  // While sign-in is still being checked, a browser with no saved session is
  // a visitor: show them the welcome page now rather than "Loading…" first.
  // The server cannot know, so it paints the neutral opening screen.
  // Back from Google, the session is not saved yet but is about to be: that
  // counts as signed in too, or the welcome page flashes before Home.
  const maybeSignedIn = useSyncExternalStore(
    noSubscribe,
    () => browserHasStoredSession() || hasPendingOAuthResultInWindow(),
    () => true,
  );

  if (!user && (!loading || !maybeSignedIn)) {
    return <LandingPage />;
  }

  return <SignedInHomeNext />;
}

/** The welcome page, as the Figma "Welcome" frame draws it. */
function LandingPage() {
  const row = "lp-row";
  return (
    <AppShell publicPage>
      <div className="landing space-y-3">
        <section className="lp-hero">
          <h1 className="text-[32px] font-semibold leading-[1.15]">
            Turn your saved places into a trip that works.
          </h1>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.04em]">
            Plan. Keep. Remember.
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
            Kyoto day demo
          </p>
          <svg viewBox="0 0 320 170" className="mt-4 h-[170px] w-full" aria-hidden>
            <path
              d="M12 160 L72 118 L150 88 L230 52"
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 5"
              strokeWidth="1.4"
              opacity="0.55"
            />
            <g transform="translate(118 90) rotate(-25)">
              <path
                d="M0 -9 L3 -3 L12 2 L12 5 L3 3 L3 9 L6 11 L6 13 L0 12 L-6 13 L-6 11 L-3 9 L-3 3 L-12 5 L-12 2 L-3 -3 Z"
                fill="var(--card)"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </g>
          </svg>
          <div className="lp-pill" aria-hidden>
            <span className="lp-dot" />
            <span>
              <span className="block text-[13px] font-semibold">Kyoto</span>
              <span className="block text-[11px] text-muted-foreground">Japan</span>
            </span>
          </div>
        </section>

        <section className="lp-card">
          <h2 className="text-[15px] font-semibold">From saved places to a trip that works</h2>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Make a plan from saved places.
            <br />
            Keep directions and bookings together.
            <br />
            Remember places for next time.
          </p>
        </section>

        <Link to="/auth" search={{ mode: "signup" }} className={row}>
          <span className="lp-dot lp-icon" aria-hidden>
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Start free</span>
            <span className="block text-[12px] text-muted-foreground">
              Sign in or create an account
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        <Link to="/auth" className={row}>
          <span className="lp-dot lp-icon" aria-hidden>
            <Users className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Sign in</span>
            <span className="block text-[12px] text-muted-foreground">
              Continue with your existing account
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        <Link to="/how-it-works" className={row}>
          <span className="lp-dot lp-icon" aria-hidden>
            <User className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">How Béa works</span>
            <span className="block text-[12px] text-muted-foreground">
              Learn how trips, invites, and privacy work
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
        <Link to="/auth" search={{ mode: "signup", redirect: "/trips" }} className={row}>
          <span className="lp-dot lp-icon" aria-hidden>
            <Users className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Joining friends?</span>
            <span className="block text-[12px] text-muted-foreground">
              Enter an invite code after signup, then Trips
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>

        <nav aria-label="More about Béa" className="flex flex-col items-center gap-1 pt-2">
          <Link to="/terms" className="flex min-h-9 items-center text-[12px] text-muted-foreground">
            Terms
          </Link>
          <Link
            to="/privacy"
            className="flex min-h-9 items-center text-[12px] text-muted-foreground"
          >
            Privacy
          </Link>
        </nav>

        <ExampleTrip />
      </div>
    </AppShell>
  );
}

/** A day of an example trip, so a visitor sees what Béa makes before signing up. */
function ExampleTrip() {
  const stops = [
    { time: "09:30", name: "Nishiki Market", note: "Explore the market · 45 minutes" },
    { leg: "Walk · About 12 minutes" },
    { time: "10:30", name: "Coffee in Kyoto", note: "A break before the next stop" },
    { leg: "Travel estimate · About 25 minutes" },
    {
      time: "11:30",
      name: "Museum visit",
      note: "Ticket and booking details together",
      booking: "Example booking · Museum entry",
    },
  ];
  return (
    <section
      id="example-trip"
      aria-label="Example trip"
      className="scroll-mt-20 space-y-3 rounded-[var(--r-card)] border border-border bg-card p-4"
    >
      <p className="text-[12px] font-bold leading-[1.4] text-muted-foreground">Example trip</p>
      <p className="text-[20px] font-bold leading-[1.4]">A day in Kyoto</p>
      <p className="text-[14px] leading-[1.4] text-muted-foreground">
        Your places, in a useful order.
      </p>
      {stops.map((stop, i) =>
        "leg" in stop ? (
          <p key={i} className="text-[12px] leading-[1.4] text-muted-foreground">
            {stop.leg}
          </p>
        ) : (
          <div key={i} className="space-y-1">
            <p className="flex gap-3 font-bold leading-[1.4]">
              <span className="w-11 shrink-0 text-[12px] text-muted-foreground">{stop.time}</span>
              <span className="text-[14px]">{stop.name}</span>
            </p>
            <p className="text-[12px] leading-[1.4] text-muted-foreground">{stop.note}</p>
            {stop.booking ? <p className="text-[12px] leading-[1.4]">{stop.booking}</p> : null}
          </div>
        ),
      )}
    </section>
  );
}
