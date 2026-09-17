import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoVideo } from "@/components/DemoVideo";
import { SceneFigureView } from "@/components/HowItWorksFigures";
import { configuredDemoVideo } from "@/lib/demo-video";
import { HOW_CLOSING, HOW_SCENES, WATCH_LABEL, type Scene } from "@/lib/how-it-works";

export const Route = createFileRoute("/how-it-works")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "How Béa works" },
      {
        name: "description",
        content:
          "Béa remembers your travel life so Future You doesn't miss what matters — how saving, planning and rediscovering actually work.",
      },
      { property: "og:title", content: "How Béa works" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HowItWorksPage,
});

/**
 * Reveal a panel once, when it first comes into view.
 *
 * Once, not every time: a section that re-animates on the way back up turns
 * scrolling into a slot machine. Anyone who has asked for less motion gets the
 * content immediately and never sees a transition.
 */
function useRevealed<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver !== "function") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

function ScenePanel({ scene, index }: { scene: Scene; index: number }) {
  const { ref, shown } = useRevealed<HTMLElement>();
  // Odd panels lead with the drawing on wide screens, so the page alternates
  // instead of marching down one column.
  const figureFirst = index % 2 === 1;

  return (
    <section
      ref={ref}
      className={`transition-all duration-(--t-arrive) ease-(--ease-standard) ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`flex flex-col gap-4 sm:items-center ${
          figureFirst ? "sm:flex-row-reverse" : "sm:flex-row"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="label-caps">{scene.eyebrow}</p>
          <h2 className="mt-1.5 font-display text-[25px] leading-tight">{scene.heading}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{scene.body}</p>
          <p className="mt-3 font-display text-[17px] leading-snug text-primary">
            {scene.signature}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="surface border border-border/50 p-3.5">
            <SceneFigureView figure={scene.figure} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksPage() {
  const video = configuredDemoVideo();
  const [watching, setWatching] = useState(false);

  return (
    <AppShell publicPage eyebrow="How it works" title={HOW_CLOSING.mission}>
      <div className="space-y-12 pb-4">
        <div className="space-y-3">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Béa is not a trip generator. It is the place your travel life lives — what you saved,
            who told you about it, and where you have already been. Here is the whole of it, in
            order.
          </p>
          {video ? (
            <button
              type="button"
              onClick={() => setWatching(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 text-[14.5px]"
            >
              <PlayCircle className="size-4" aria-hidden />
              {WATCH_LABEL}
            </button>
          ) : null}
        </div>

        {HOW_SCENES.map((scene, i) => (
          <ScenePanel key={scene.id} scene={scene} index={i} />
        ))}

        <section className="surface border border-border/50 p-5 text-center">
          <p className="font-display text-[24px] leading-tight">{HOW_CLOSING.tagline}</p>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] text-muted-foreground">
            {HOW_CLOSING.mission}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link to="/auth" className="btn-primary px-4 py-3 text-center text-[14.5px]">
              Create an account
            </Link>
            <Link
              to="/help"
              className="rounded-xl border border-border px-4 py-3 text-center text-[14.5px] font-semibold"
            >
              Questions and answers
            </Link>
          </div>
        </section>
      </div>

      {watching && video ? <DemoVideo source={video} onClose={() => setWatching(false)} /> : null}
    </AppShell>
  );
}
