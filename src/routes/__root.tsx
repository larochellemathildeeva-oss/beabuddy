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
import { Welcome } from "../components/Welcome";
import {
  DEFAULT_THEME,
  readTheme,
  syncThemeColor,
  THEME_BOOT_SCRIPT,
  THEME_COLOR_BOOT_SCRIPT,
  THEME_COLORS,
} from "@/lib/theme";
import { startAccountSettingsSync } from "@/lib/account-settings-sync";
import { ACCESSIBILITY_BOOT_SCRIPT } from "@/lib/accessibility";
import { ACCENT_BOOT_SCRIPT, DEFAULT_ACCENT } from "@/lib/accent";

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.0.0";

const PAGE_BUTTON = "btn-primary inline-flex items-center justify-center px-6";
const PAGE_BUTTON_QUIET =
  "inline-flex min-h-[var(--h-button)] items-center justify-center rounded-[var(--r-button)] border border-border bg-card px-6 text-[16px] font-semibold text-foreground";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="label-caps">Page not found</p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.1]">Béa can't find that page.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">
          It may have moved, or the link may be mistyped.
        </p>
        <div className="mt-6">
          <Link to="/" className={PAGE_BUTTON}>
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // console.error dies in the user's browser. File it so a crash someone hit on
  // their phone is visible to us afterwards.
  useEffect(() => {
    reportError(error, "route error boundary");
    // A code file that would not load (a deploy replaced it, or a stale copy
    // was kept): one fresh load fetches the current ones. Once only, so a
    // real outage cannot loop.
    if (
      !/importing a module script failed|failed to fetch dynamically imported module/i.test(
        error.message,
      )
    )
      return;
    try {
      if (sessionStorage.getItem("bea-chunk-reload")) return;
      sessionStorage.setItem("bea-chunk-reload", "1");
    } catch {
      return;
    }
    void (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        await Promise.all((regs ?? []).map((r) => r.update()));
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("bea-pages-") || k.startsWith("bea-assets-"))
            .map((k) => caches.delete(k)),
        );
      } catch {
        // reload anyway
      }
      window.location.reload();
    })();
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="label-caps">Something slipped</p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.1]">This page didn't load.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">
          That one's on us. Try again, or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={PAGE_BUTTON}
          >
            Try again
          </button>
          <a href="/" className={PAGE_BUTTON_QUIET}>
            Back home
          </a>
        </div>
      </div>
    </main>
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
      { name: "theme-color", content: THEME_COLORS[DEFAULT_THEME] },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: `/favicon.ico?v=${APP_VERSION}`, sizes: "any" },
      { rel: "icon", href: `/favicon.png?v=${APP_VERSION}`, type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: `/apple-touch-icon.png?v=${APP_VERSION}` },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ACCESSIBILITY_BOOT_SCRIPT }} />
        <BeaFontLinks />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Béa's service worker (public/sw.js), so an installed Béa opens with no
 * signal. Production only: in development it would serve yesterday's build.
 */
function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not supported here, or blocked: Béa works as before, online.
    });
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { open, setOpen, intent, startMode } = useTourControl();
  // Stable close handler — a new inline fn every render restarted the tour's
  // "Finding that bit…" wait forever (effect cleanup cancelled every poll).
  const closeTour = useCallback(() => setOpen(false), [setOpen]);
  useServiceWorker();
  useEffect(() => startAccountSettingsSync(), []);
  // The server renders the light status-bar colour; match the saved theme.
  useEffect(() => syncThemeColor(readTheme()), []);

  return (
    <QueryClientProvider client={queryClient}>
      <BeaProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Tour open={open} onClose={closeTour} intent={intent} startMode={startMode} />
        <Welcome />
      </BeaProvider>
    </QueryClientProvider>
  );
}
