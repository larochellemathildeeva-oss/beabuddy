import { Link, useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLegalConsent } from "../hooks/useLegalConsent";

import {
  ArrowLeft,
  Compass,
  Globe2,
  Home,
  MapPinned,
  Bookmark,
  User,
} from "lucide-react";
import logo from "../assets/bea-logo.png";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";
import { PageGuide } from "./PageGuide";



const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/world", label: "World", icon: Globe2 },
  { to: "/trips", label: "Trips", icon: MapPinned },
  { to: "/recommendations", label: "Recs", icon: Bookmark },
  { to: "/opportunities", label: "Near", icon: Compass },
  { to: "/profile", label: "You", icon: User },
] as const;

export function AppShell({
  children,
  eyebrow,
  title,
  publicPage = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  /**
   * Pages a signed-out visitor must be able to read. The sign-up form asks
   * people to agree to the Privacy Policy and links to it, so gating that link
   * behind an account makes the consent unreadable before it is given.
   */
  publicPage?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const showBack = pathname !== "/";
  const { user, loading } = useAuth();
  useLegalConsent();

  // The app frame is for members, except on pages a visitor has to be able to
  // read before they have an account.
  useEffect(() => {
    if (!publicPage && !loading && !user) navigate({ to: "/auth", replace: true });
  }, [publicPage, loading, user, navigate]);

  if (!publicPage && (loading || !user)) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background">
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // A signed-out visitor gets the frame without the member tab bar, which would
  // only bounce them back to sign-in.
  const showTabs = !!user;



  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col border-x border-border/70 bg-background">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {showBack &&
              (canGoBack ? (
                <button
                  onClick={() => router.history.back()}
                  aria-label="Go back"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card"
                >
                  <ArrowLeft className="size-4" />
                </button>
              ) : (
                <Link
                  to="/"
                  aria-label="Go back home"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card"
                >
                  <ArrowLeft className="size-4" />
                </Link>
              ))}
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Béa logo" className="size-9 object-contain" width={36} height={36} />
              <span className="flex items-center gap-2">
                <span className="leading-none">
                  <span className="block font-display text-[24px]">Béa</span>
<span className="block text-[8px] font-semibold uppercase text-muted-foreground">
                    v{APP_VERSION}
                  </span>
                </span>
                <span className="label-caps">Travel Buddy</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <PageGuide />
            <span aria-label="Live sync" title="Live sync" className="grid size-7 place-items-center rounded-full border border-border bg-card">
              <span className="size-1.5 rounded-full bg-nexttime" />
            </span>
          </div>

        </header>

        {(eyebrow || title) && (
          <div className="rise px-4 pt-3.5">
            {eyebrow && <p className="label-caps">{eyebrow}</p>}
            {title && <h1 className="mt-0.5 text-[26px] leading-[1.08]">{title}</h1>}
          </div>
        )}

        <main className="flex-1 px-4 pb-6 pt-3.5">{children}</main>

        {showTabs && (
        <nav className="sticky bottom-0 z-20 grid grid-cols-6 border-t border-border/70 bg-background/90 px-2 py-1.5 backdrop-blur-xl">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.7} />
                <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}
        </nav>
        )}
      </div>
    </div>
  );
}
