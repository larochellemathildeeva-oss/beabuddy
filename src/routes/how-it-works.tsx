import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PlayCircle } from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { DemoVideo } from "@/components/DemoVideo";
import { configuredDemoVideo } from "@/lib/demo-video";
import { HOW_STEPS, WATCH_LABEL } from "@/lib/how-it-works";

export const Route = createFileRoute("/how-it-works")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "How Béa works" },
      {
        name: "description",
        content:
          "How Béa plans your trips from the places you saved, helps while you travel, and remembers where you've been.",
      },
      { property: "og:title", content: "How Béa works" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  const video = configuredDemoVideo();
  const [watching, setWatching] = useState(false);

  return (
    <AppShell publicPage title="From saved places to useful days.">
      <ol className="space-y-6 pt-2">
        {HOW_STEPS.map((step, i) => (
          <li key={step.title} className="rounded-[var(--r-card)] border border-border bg-card p-4">
            <h2 className="text-[16px] font-bold leading-[1.4]">
              {i + 1}. {step.title}
            </h2>
            <p className="mt-2 text-[14px] leading-[1.4] text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="btn-primary mt-6 flex w-full items-center justify-center px-4"
      >
        Start planning free
      </Link>
      <Link
        to="/"
        hash="example-trip"
        className="mt-3 flex min-h-11 items-center text-[14px] text-foreground"
      >
        See a sample trip
      </Link>
      {/* The film, when a deploy has one: the frame draws none, so it sits last. */}
      {video ? (
        <button
          type="button"
          onClick={() => setWatching(true)}
          className="flex min-h-11 items-center gap-2 text-[14px] text-foreground"
        >
          <PlayCircle className="size-4" aria-hidden />
          {WATCH_LABEL}
        </button>
      ) : null}

      {watching && video ? <DemoVideo source={video} onClose={() => setWatching(false)} /> : null}
    </AppShell>
  );
}
