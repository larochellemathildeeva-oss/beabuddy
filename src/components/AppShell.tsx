import { Link, useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLegalConsent } from "../hooks/useLegalConsent";
import {
  hasPendingOAuthResultInWindow,
  safeRedirectPath,
  takeReturnPath,
} from "../lib/auth-redirect";
import { useOnline } from "../hooks/useOnline";
import { activeTabIndex, indicatorOffset } from "../lib/tab-bar";
import { COMPRESS_AT, measureHeaderHeights, nextCompressed } from "../lib/page-header";
import { planeFromMatches, planeIsUndeclared, travelDirection } from "../lib/route-plane";
import { BrandMark, PageHeader } from "./PageHeader";

import { ArrowLeft, Globe2, Home, MapPinned, Bookmark, Search, User } from "@/components/icons";
import logo from "../assets/bea-logo.png";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";
import { PageGuide } from "./PageGuide";
import { useStopPictures } from "../hooks/useStopPictures";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { useRestoreKeptOffline } from "../hooks/useRestoreKeptOffline";
// Sample travel data can no longer be loaded. Do not mount useAutoSeed here.

// Five, not six: Near folded into Recs as a filter, because it was never a
// different set of places — it was the vault sorted by how close you are.
// /opportunities redirects into that filter, so old links still work.
const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/world", label: "World", icon: Globe2 },
  { to: "/trips", label: "Trips", icon: MapPinned },
  { to: "/recommendations", label: "Recs", icon: Bookmark },
  { to: "/profile", label: "You", icon: User },
] as const;

export function AppShell({
  children,
  eyebrow,
  title,
  headerAction,
  actionBesideEyebrow = false,
  publicPage = false,
  flush = false,
  homeHeader = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
  /** One action beside the title. More than one belongs in the content. */
  headerAction?: ReactNode;
  /** Put that action on the eyebrow's line, leaving the title the full width. */
  actionBesideEyebrow?: boolean;
  /**
   * Pages a signed-out visitor must be able to read. The sign-up form asks
   * people to agree to the Privacy Policy and links to it, so gating that link
   * behind an account makes the consent unreadable before it is given.
   */
  publicPage?: boolean;
  /**
   * Content runs to the edges of the frame with no top gap, for a page that
   * pins its own header (the trip page) and needs the width on a phone.
   */
  flush?: boolean;
  /**
   * Home's own header: the "Béa." wordmark in large serif with the mood's dot,
   * a round search and the round help button.
   */
  homeHeader?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  // The plane travels with the route, so the shell asks the router rather than
  // letting each screen decide how it should arrive.
  const matches = useRouterState({ select: (s) => s.matches });
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const showBack = pathname !== "/";
  const tabIndex = activeTabIndex(pathname, tabs);
  const scrollRef = useRef<HTMLElement | null>(null);
  const pageHeaderRef = useRef<HTMLDivElement | null>(null);
  const [compressed, setCompressed] = useState(false);
  const compressedRef = useRef(false);
  const plane = planeFromMatches(matches);

  // A tab move drifts the way you travelled along the bar; everything else
  // drifts nowhere. Held in a ref because the previous tab is a fact about the
  // last render, not state anything should re-render for.
  const lastTabIndex = useRef(tabIndex);
  const direction = travelDirection(lastTabIndex.current, tabIndex);
  useEffect(() => {
    lastTabIndex.current = tabIndex;
  }, [tabIndex]);

  // A route that forgot to declare its plane still works — it cross-fades —
  // but it should be noisy in development, never in front of a person.
  useEffect(() => {
    if (import.meta.env.DEV && planeIsUndeclared(matches)) {
      console.warn(`[plane] ${pathname} declares no plane; falling back to "tab".`);
    }
  }, [matches, pathname]);
  const { user, loading } = useAuth();
  // Applies the stop-pictures setting to every page.
  useStopPictures();
  useLegalConsent();
  useIdleLogout(!!user);
  useRestoreKeptOffline(user?.id);
  const online = useOnline();

  // The shell owns the only scroll container in the app, so header compression
  // is one listener here rather than one per screen. Passive, and it only sets
  // state when the answer actually changes — a scroll handler that re-renders
  // on every frame is how a phone loses its frame rate.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Measuring the compact header clones it, so keep the answer until the
    // header changes size (a new title, Reading size or width).
    let observed: HTMLElement | null = null;
    let heights: ReturnType<typeof measureHeaderHeights> | null = null;
    const resized =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => (heights = null));
    const headerHeights = (header: HTMLElement) => {
      if (header !== observed) {
        resized?.disconnect();
        resized?.observe(header);
        observed = header;
        heights = null;
      }
      return (heights ??= measureHeaderHeights(header));
    };
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      const current = compressedRef.current;
      let dimensions;
      if (!current && scrollTop >= COMPRESS_AT) {
        dimensions = {
          scrollRange: el.scrollHeight - el.clientHeight,
          ...(pageHeaderRef.current ? headerHeights(pageHeaderRef.current) : {}),
        };
      }
      const next = nextCompressed(scrollTop, current, dimensions);
      if (next !== current) {
        compressedRef.current = next;
        setCompressed(next);
      }
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      resized?.disconnect();
    };
  }, [pathname, loading, publicPage, user]);

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
    // Remember where they were going, so signing in brings them back here.
    // The router moves to /auth before this page unmounts, so this runs once
    // more with the sign-in address itself; that must not be sent again.
    const returnTo = safeRedirectPath(href);
    if (!returnTo) return;
    navigate({ to: "/auth", search: { redirect: returnTo }, replace: true });
  }, [publicPage, loading, user, navigate, href]);

  // Google and the confirmation email return to the site's origin, not to the
  // page that asked for sign-in; that page waits in this tab until now.
  useEffect(() => {
    if (loading || !user || hasPendingOAuthResultInWindow()) return;
    const to = takeReturnPath();
    if (to && to !== href) void navigate({ href: to, replace: true });
  }, [loading, user, navigate, href]);

  const settlingOAuth = !user && hasPendingOAuthResultInWindow();
  if (!publicPage && (loading || !user || settlingOAuth)) {
    return (
      // Béa's mark rather than a bare word, so the moment before the page reads
      // as the app opening, not as something stuck.
      <div className="grid min-h-[100dvh] place-items-center bg-background" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <img
            src={logo}
            alt=""
            className="size-14 animate-pulse object-contain motion-reduce:animate-none"
            width={56}
            height={56}
          />
          <p role="status" className="text-body text-muted-foreground">
            Opening Béa…
          </p>
        </div>
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
    <div className="page-lit h-dvh bg-background">
      {/* Every tab inherits the traveller's accent from the document. */}
      <div
        data-plane={plane}
        style={{ "--plane-dx": `${direction * 6}px` } as CSSProperties}
        className="relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden border-x border-border/70 bg-transparent md:max-w-[680px] xl:max-w-[780px]"
      >
        {homeHeader ? (
          <header className="z-20 flex shrink-0 items-center justify-between bg-background/35 px-5 pb-1 pt-3 backdrop-blur-xl">
            <Link to="/" aria-label={`Béa, version ${APP_VERSION}`} title={`v${APP_VERSION}`}>
              <BrandMark large />
            </Link>
            <div className="flex items-center gap-2.5">
              <Link
                to="/recommendations"
                aria-label="Search your places"
                className="grid size-11 place-items-center rounded-full bg-card text-foreground shadow-[0_3px_12px_rgb(0_0_0/0.07)]"
              >
                <Search className="size-[19px]" />
              </Link>
              {user && <PageGuide round />}
              {!online && (
                <span
                  role="img"
                  aria-label="Offline"
                  title="Offline — changes may not sync"
                  className="grid size-7 place-items-center rounded-full border border-border bg-card"
                >
                  <span className="size-1.5 rounded-full bg-muted-foreground" />
                </span>
              )}
            </div>
          </header>
        ) : (
          <header className="tab-rule z-20 flex shrink-0 flex-wrap items-center justify-between bg-background/35 px-4 py-2.5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {showBack &&
                (canGoBack ? (
                  <button
                    onClick={() => router.history.back()}
                    aria-label="Go back"
                    className="tap-target -ml-1.5 grid shrink-0 place-items-center rounded-full"
                  >
                    <span className="grid size-8 place-items-center rounded-full border border-border bg-card">
                      <ArrowLeft className="size-4" />
                    </span>
                  </button>
                ) : (
                  <Link
                    to="/"
                    aria-label="Go back home"
                    className="tap-target -ml-1.5 grid shrink-0 place-items-center rounded-full"
                  >
                    <span className="grid size-8 place-items-center rounded-full border border-border bg-card">
                      <ArrowLeft className="size-4" />
                    </span>
                  </Link>
                ))}
              <Link to="/" className="flex items-center gap-2">
                <BrandMark version={APP_VERSION} />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {user && <PageGuide round />}
              {!user && (
                <Link
                  to="/auth"
                  className="flex min-h-11 items-center rounded-xl bg-primary px-3 py-1.5 text-[16px] font-semibold text-primary-foreground"
                >
                  Sign in
                </Link>
              )}
              <span
                role="img"
                aria-label={online ? "Online" : "Offline"}
                title={online ? "Online" : "Offline — changes may not sync"}
                className="grid size-7 place-items-center rounded-full border border-border bg-card"
              >
                <span
                  className={`size-1.5 rounded-full ${online ? "bg-nexttime" : "bg-muted-foreground"}`}
                />
              </span>
            </div>
            {/* A page can put its own actions here (a trip: Plan with Béa, Add stop, To do). */}
            <div id="app-header-slot" className="mt-2 basis-full empty:hidden" />
          </header>
        )}

        {/* A dot alone is a tooltip a phone cannot show. Said once, in words,
            for as long as it is true. */}
        {!online && (
          <p
            role="status"
            className="z-10 shrink-0 bg-muted px-4 py-1.5 text-center text-[14px] font-semibold text-muted-foreground"
          >
            You're offline. Kept trips still open; changes sync when you're back.
          </p>
        )}

        <PageHeader
          ref={pageHeaderRef}
          eyebrow={eyebrow}
          title={title}
          action={headerAction}
          actionBesideEyebrow={actionBesideEyebrow}
          compressed={compressed}
        />

        <main
          ref={scrollRef}
          // The app scrolls inside this element, not the window, so the
          // router's scroll restoration has to be told where to look. Without
          // it, going back to the trips list from a trip lands at the top of
          // the list rather than on the card you left — the single thing that
          // makes a back button feel broken.
          data-scroll-restoration-id="app-main"
          className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-7 ${flush ? "px-0 pt-0" : "px-4 pt-3"}`}
        >
          {/* Keyed by path so each destination plays its plane's entrance once.
              Path, not the whole location: a filter change writes to the search
              string and must not replay the animation or lose the screen's
              state. */}
          <div key={pathname} className="plane-enter">
            {children}
          </div>
        </main>

        {showTabs && (
          <nav
            aria-label="Main"
            className="z-20 shrink-0 bg-background/80 px-3 pt-1.5 backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {/* A floating bar, as the "three moods" design draws it. The grid is
                its own box so the indicator can be `inset-y-0` against exactly
                the row of links. */}
            <div className="relative grid grid-cols-5 rounded-[24px] border border-white/70 bg-card/88 px-1 py-1.5 shadow-[0_1px_10px_rgb(80_60_40/0.07)] backdrop-blur-xl dark:border-border">
              {/* One soft bubble that travels, rather than a class jumping between
                  tabs. The tabs are equal columns, so the whole geometry is
                  index × 100% of the indicator's own width — nothing to measure
                  and nothing to go stale on resize.

                  It is decorative: `aria-current` on the link is what a screen
                  reader announces, so this is hidden from the tree entirely. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-1 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-[transform,opacity] duration-(--t-move) ease-(--ease-standard) ${
                  tabIndex === -1 ? "opacity-0" : "opacity-100"
                }`}
                style={{ transform: indicatorOffset(tabIndex) }}
              >
                <span className="h-full w-full rounded-[20px] bg-primary-soft" />
              </span>

              {tabs.map(({ to, label, icon: Icon }, i) => {
                const active = i === tabIndex;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-col items-center gap-1 rounded-full py-1.5 transition-colors duration-(--t-tap) ease-(--ease-standard) ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {/* Filled as well as darker, so the active tab survives a
                      glance without relying on colour alone. */}
                    <Icon className="size-6" weight={active ? "fill" : "regular"} />
                    <span className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
