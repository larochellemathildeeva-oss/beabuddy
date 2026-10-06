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
import { BrandMark } from "../components/PageHeader";
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

const LINK_PRIMARY = "btn-primary inline-flex items-center justify-center px-5";
const LINK_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--r-button)] border border-input bg-card px-5 text-[16px] font-semibold text-foreground";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="flex max-w-md flex-col items-center text-center">
        <BrandMark large />
        <h1 className="mt-6 font-display text-[38px] leading-[1.05] tracking-[-0.02em]">
          We couldn't find that page.
        </h1>
        <p className="mt-3 text-[16px] text-muted-foreground">
          The link may be old, or the page may have moved.
        </p>
        <div className="mt-6">
          <Link to="/" className={LINK_PRIMARY}>
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="flex max-w-md flex-col items-center text-center">
        <BrandMark large />
        <h1 className="mt-6 font-display text-[38px] leading-[1.05] tracking-[-0.02em]">
          This page didn't load.
        </h1>
        <p role="alert" className="mt-3 text-[16px] text-muted-foreground">
          That one's on us. Try again, or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className={LINK_PRIMARY}
          >
            Try again
          </button>
          <a href="/" className={LINK_SECONDARY}>
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
