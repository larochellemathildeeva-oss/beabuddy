import { ArrowLeft } from "@/components/icons";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { reportError } from "@/lib/report";
import { BrandMark } from "./PageHeader";

/**
 * A whole-page state outside the app shell: the error and not-found pages.
 * Brand row (its mark goes Home, by a full load), "back", a small label, the title over a
 * hairline, one line of text and the actions, as in the Figma system states.
 */
export function SystemState({
  label,
  title,
  children,
  actions,
}: {
  label: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center px-4">
        {/* A full load, not a router link: after a crash the router itself
            may be what is broken. */}
        <a href="/" aria-label="Béa, home" className="rounded-[var(--r-card)]">
          <BrandMark />
        </a>
      </header>
      <main className="mx-auto max-w-[480px] px-4 pb-10">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.assign("/");
          }}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-[12px] text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          back
        </button>
        <p className="mt-3 text-[12px] text-foreground">{label}</p>
        <h1 className="mt-1.5 border-b border-[var(--rule)] pb-3 text-[28px] font-bold leading-[1.2]">
          {title}
        </h1>
        <p className="mt-4 text-[14px] text-foreground">{children}</p>
        <div className="mt-4 grid gap-2">{actions}</div>
      </main>
    </div>
  );
}

const PAGE_BUTTON = "btn-primary inline-flex w-full items-center justify-center px-6";

export function NotFoundPage() {
  return (
    <SystemState
      label="Page not found"
      title="Béa can't find that page."
      actions={
        <Link to="/" className={PAGE_BUTTON}>
          Open home
        </Link>
      }
    >
      Your journeys are still waiting on Home.
    </SystemState>
  );
}

export function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  // console.error dies in the user's browser. File it so a crash someone hit on
  // their phone is visible to us afterwards.
  useEffect(() => {
    reportError(error, "route error boundary");
    // A code file that would not load (a deploy replaced it, or a stale copy
    // was kept): one fresh load fetches the current ones. Not while offline
    // (the kept copies are all there is then), and at most once in ten
    // minutes, so a real outage cannot loop but a later deploy still recovers.
    if (
      !/importing a module script failed|failed to fetch dynamically imported module/i.test(
        error.message,
      )
    )
      return;
    if (navigator.onLine === false) return;
    try {
      const last = Number(sessionStorage.getItem("bea-chunk-reload") ?? 0);
      if (Date.now() - last < 10 * 60_000) return;
      sessionStorage.setItem("bea-chunk-reload", String(Date.now()));
    } catch {
      return;
    }
    let live = true;
    void (async () => {
      try {
        const regs = await navigator.serviceWorker?.getRegistrations();
        await Promise.all((regs ?? []).map((r) => r.update().catch(() => {})));
      } catch {
        // clear the copies anyway
      }
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith("bea-pages-") || k.startsWith("bea-assets-"))
            .map((k) => caches.delete(k)),
        );
      } catch {
        // reload anyway
      }
      if (live) window.location.reload();
    })();
    return () => {
      live = false;
    };
  }, [error]);

  return (
    <SystemState
      label="Something went wrong"
      title="This page didn't load."
      actions={
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
      }
    >
      Try again, or return to Home.
    </SystemState>
  );
}
