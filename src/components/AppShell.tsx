import { Link, useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLegalConsent } from "../hooks/useLegalConsent";
import { hasPendingOAuthResultInWindow } from "../lib/auth-redirect";

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
import { useIdleLogout } from "../hooks/useIdleLogout";
// Sample travel data is opt-in (Home / You). Do not mount useAutoSeed here.



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
  useIdleLogout(!!user);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // The app frame is for members, except on pages a visitor has to be able to
  // read before they have an account.
  //
  // Never bounce while an OAuth result is still in the URL: Google returns to a
  // gated page with `?code=` and Supabase redeems it a beat later, so a
  // redirect here rewrites the URL and destroys a single-use code — leaving
  // someone who just signed in with Google sitting on the sign-in form.
  useEffect(() => {
    if (publicPage || loading || user) return;
    if (hasPendingOAuthResultInWindow()) return;
    navigate({ to: "/auth", replace: true });
  }, [publicPage, loading, user, navigate]);

  const settlingOAuth = !user && hasPendingOAuthResultInWindow();
  if (!publicPage && (loading || !user || settlingOAuth)) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background">
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // A signed-out visitor gets the frame without the member tab bar, which would
  // only bounce them back to sign-in.
  const showTabs = !!user;

  // Shell is exactly one dynamic viewport tall. Main scrolls inside; the tab
  // bar is a normal flex sibling at the bottom. sticky bottom-0 looked pinned
  // until iOS scroll/visual-viewport churn left it floating mid-page.
  return (
    <div className="h-dvh bg-background">
      <div className="relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden border-x border-border/70 bg-background md:max-w-[720px] xl:max-w-[960px]">
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-xl">
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
                <span className="label-caps">Travel life</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {user && <PageGuide />}
            {!user && (
              <Link
                to="/auth"
                className="rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            )}
            <span
              aria-label={online ? "Online" : "Offline"}
              title={online ? "Online" : "Offline — changes may not sync"}
              className="grid size-7 place-items-center rounded-full border border-border bg-card"
            >
              <span
                className={`size-1.5 rounded-full ${online ? "bg-nexttime" : "bg-muted-foreground"}`}
              />
            </span>
          </div>
        </header>

        {(eyebrow || title) && (
          <div className="rise shrink-0 px-4 pt-3.5">
            {eyebrow && <p className="label-caps">{eyebrow}</p>}
            {title && <h1 className="mt-0.5 text-[26px] leading-[1.08]">{title}</h1>}
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6 pt-3.5">
          {children}
        </main>

        {showTabs && (
        <nav
          aria-label="Main"
          className="z-20 grid shrink-0 grid-cols-6 border-t border-border/70 bg-background/90 px-2 pt-1.5 backdrop-blur-xl pb-[max(0.375rem,env(safe-area-inset-bottom))]"
        >
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
