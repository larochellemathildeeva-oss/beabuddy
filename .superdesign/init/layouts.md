# Layouts

- `src/routes/__root.tsx` — HTML document, fonts (Manrope + Instrument Serif), providers, tour, 404/error screens.
- `src/components/AppShell.tsx` — the app frame every page renders in: centered column, sticky top bar (back button, Béa logo `src/assets/bea-logo.png` + serif wordmark + version + "Travel Buddy" caps label, page-guide button, online dot), `PageHeader` (eyebrow + serif title + one action, compresses on scroll), scrolling `<main>`, bottom tab bar (Home, World, Trips, Recs, You; lucide icons; one sliding tinted pill; per-tab hue 39→79).
- `src/components/PageHeader.tsx` — screen title block.
- `src/routes/_authenticated/route.tsx` — auth gate, renders `<Outlet/>`.

### `src/routes/__root.tsx`

```tsx
import { BeaProvider, BeaFontLinks } from "../components/BeaProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useCallback, useEffect, type ReactNode } from "react";
import { reportError } from "@/lib/report";

import appCss from "../styles.css?url";
import { Tour, useTourControl } from "../components/Tour";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // console.error dies in the user's browser. File it so a crash someone hit on
  // their phone is visible to us afterwards.
  useEffect(() => {
    reportError(error, "route error boundary");
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Béa — Travel memory vault" },
      {
        name: "description",
        content:
          "Béa remembers everywhere you've been and surfaces saved recommendations when you're near them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Béa" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: `/favicon.ico?v=${APP_VERSION}`, sizes: "any" },
      { rel: "icon", href: `/favicon.png?v=${APP_VERSION}`, type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: `/apple-touch-icon.png?v=${APP_VERSION}` },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <BeaFontLinks />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { open, setOpen, intent } = useTourControl();
  // Stable close handler — a new inline fn every render restarted the tour's
  // "Finding that bit…" wait forever (effect cleanup cancelled every poll).
  const closeTour = useCallback(() => setOpen(false), [setOpen]);

  return (
    <QueryClientProvider client={queryClient}>
      <BeaProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Tour open={open} onClose={closeTour} intent={intent} />
      </BeaProvider>
    </QueryClientProvider>
  );
}
```

### `src/components/AppShell.tsx`

```tsx
import { Link, useCanGoBack, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLegalConsent } from "../hooks/useLegalConsent";
import { hasPendingOAuthResultInWindow } from "../lib/auth-redirect";
import { activeTabIndex, indicatorOffset } from "../lib/tab-bar";
import { nextCompressed, tabIdForPath } from "../lib/page-header";
import { planeFromMatches, planeIsUndeclared, travelDirection } from "../lib/route-plane";
import { PageHeader } from "./PageHeader";

import { ArrowLeft, Globe2, Home, MapPinned, Bookmark, User } from "lucide-react";
import logo from "../assets/bea-logo.png";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";
import { PageGuide } from "./PageGuide";
import { useIdleLogout } from "../hooks/useIdleLogout";
// Sample travel data is opt-in (Home / You). Do not mount useAutoSeed here.

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
  publicPage = false,
  flush = false,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
  /** One action beside the title. More than one belongs in the content. */
  headerAction?: ReactNode;
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
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The plane travels with the route, so the shell asks the router rather than
  // letting each screen decide how it should arrive.
  const matches = useRouterState({ select: (s) => s.matches });
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const showBack = pathname !== "/";
  const tabIndex = activeTabIndex(pathname, tabs);
  const tabId = tabIdForPath(pathname);
  const scrollRef = useRef<HTMLElement | null>(null);
  const [compressed, setCompressed] = useState(false);
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
  useLegalConsent();
  useIdleLogout(!!user);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  // The shell owns the only scroll container in the app, so header compression
  // is one listener here rather than one per screen. Passive, and it only sets
  // state when the answer actually changes — a scroll handler that re-renders
  // on every frame is how a phone loses its frame rate.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setCompressed((cur) => nextCompressed(el.scrollTop, cur));
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

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
        <p className="text-[14.5px] text-muted-foreground">Loading…</p>
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
      {/* One hue per tab, set once here. Everything that wants the current
          tab's accent reads `--tab-accent`; nothing re-derives it from the
          path. Lightness and chroma are fixed across the set, so contrast is
          identical wherever you are. */}
      <div
        data-tab={tabId ?? undefined}
        data-plane={plane}
        style={{ "--plane-dx": `${direction * 6}px` } as CSSProperties}
        className="relative mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden border-x border-border/70 bg-background md:max-w-[680px] xl:max-w-[780px]"
      >
        <header className="tab-rule z-20 flex shrink-0 items-center justify-between bg-background/75 px-4 py-2.5 backdrop-blur-xl">
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
              <img
                src={logo}
                alt="Béa logo"
                className="size-9 object-contain"
                width={36}
                height={36}
              />
              <span className="flex items-center gap-2">
                <span className="leading-none">
                  <span className="block font-display text-[23px]">Béa</span>
                  <span className="block text-[10.5px] font-semibold uppercase text-muted-foreground">
                    v{APP_VERSION}
                  </span>
                </span>
                <span className="label-caps">Travel Buddy</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {user && <PageGuide />}
            {!user && (
              <Link
                to="/auth"
                className="rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground"
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

        <PageHeader eyebrow={eyebrow} title={title} action={headerAction} compressed={compressed} />

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
            className="z-20 shrink-0 border-t border-border/40 bg-background/80 px-2 pt-2 backdrop-blur-xl pb-[max(0.375rem,env(safe-area-inset-bottom))]"
          >
            {/* The grid is its own box so the indicator can be `inset-0` against
                exactly the row of links — anchoring it to the padded <nav>
                instead would leave the pill hanging below them on a phone with
                a home-indicator inset. */}
            <div className="relative grid grid-cols-5">
              {/* One pill that travels, rather than a class jumping between six.
                  The tabs are equal columns, so the whole geometry is index ×
                  100% of the indicator's own width — nothing to measure and
                  nothing to go stale on resize.

                  It is decorative: `aria-current` on the link is what a screen
                  reader announces, so this is hidden from the tree entirely. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 w-1/5 rounded-2xl tab-tint transition-[transform,opacity] duration-(--t-move) ease-(--ease-standard) ${
                  tabIndex === -1 ? "opacity-0" : "opacity-100"
                }`}
                style={{ transform: indicatorOffset(tabIndex) }}
              />

              {tabs.map(({ to, label, icon: Icon }, i) => {
                const active = i === tabIndex;
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors duration-(--t-tap) ease-(--ease-standard) ${
                      active ? "tab-ink" : "text-muted-foreground"
                    }`}
                  >
                    {/* The stroke thickens as well as changing hue, so the active
                      tab survives a glance without relying on colour alone. */}
                    <Icon
                      className="size-[19px] transition-[stroke-width] duration-(--t-shift) ease-(--ease-standard)"
                      strokeWidth={active ? 2.3 : 1.7}
                    />
                    <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em]">
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
```

### `src/components/PageHeader.tsx`

```tsx
import type { ReactNode } from "react";

/**
 * The top of every screen.
 *
 * Béa's screens each opened with their own arrangement of an eyebrow, a serif
 * title and — sometimes — an action, and the three drifted apart. One
 * component makes the consistent version the easy version.
 *
 * Compression is the behaviour worth sharing: once the page has scrolled past
 * a threshold the serif title shrinks into a bar, so the name of the screen
 * stays visible without eating a quarter of a phone. The shell owns the single
 * scroll container, so it decides `compressed` and every screen gets the same
 * behaviour for free.
 */
export function PageHeader({
  eyebrow,
  title,
  action,
  compressed = false,
}: {
  eyebrow?: string | undefined;
  title?: ReactNode | undefined;
  /** One action, right-aligned. Two is a toolbar, and belongs in the content. */
  action?: ReactNode | undefined;
  compressed?: boolean | undefined;
}) {
  if (!eyebrow && !title && !action) return null;

  return (
    <div
      // The flag sits on the wrapper and the children read it through `group-`,
      // so there is one source of truth for the state rather than three.
      data-compressed={compressed ? "" : undefined}
      // Once compressed the title is a bar sitting directly above the content,
      // so it needs a hairline to sit behind — expanded, it is part of the page
      // and a rule there would only cut the screen in half.
      className="rise group shrink-0 border-b border-transparent px-4 pt-4 transition-[padding,border-color] duration-(--t-shift) ease-(--ease-standard) data-[compressed]:border-border/50 data-[compressed]:pb-2 data-[compressed]:pt-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            // Collapsed by height rather than hidden, so the title slides up
            // into its place instead of jumping.
            <p className="label-caps max-h-5 overflow-hidden transition-[max-height,opacity] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:max-h-0 group-data-[compressed]:opacity-0">
              {eyebrow}
            </p>
          )}
          {title && (
            <h1 className="mt-1.5 text-[27px] leading-[1.06] transition-[font-size,margin] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:mt-0 group-data-[compressed]:truncate group-data-[compressed]:text-[18px] group-data-[compressed]:leading-[1.35]">
              {title}
            </h1>
          )}
        </div>
        {action && <div className="shrink-0 pt-0.5">{action}</div>}
      </div>
    </div>
  );
}
```

### `src/components/BeaProvider.tsx`

```tsx
import type { ReactNode } from "react";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "./ui/sonner";

/**
 * Wraps an app with the providers Béa components need at runtime:
 * tooltips and toast notifications. Mount once near the root.
 */
export function BeaProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}

/**
 * The web-font <link> tags Béa's typography expects. Render inside the
 * document head (in TanStack Start, from a route `head()` links entry or the
 * root document) so Instrument Serif and Manrope load.
 */
export function BeaFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
```

### `src/routes/_authenticated/route.tsx`

```tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function AuthenticatedLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  staticData: { plane: "detail" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});
```

