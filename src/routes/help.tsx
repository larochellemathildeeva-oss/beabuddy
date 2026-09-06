import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HELP_FAQ_GROUPS, type Faq } from "@/lib/help-faq";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — Béa" },
      {
        name: "description",
        content:
          "Answers about trips, Béa's planner, day trips, travel tags, packing, photo imports, the document vault, dark mode and offline use.",
      },
      { property: "og:title", content: "Help & FAQ — Béa" },
      {
        property: "og:description",
        content: "Common questions about using Béa, your travel buddy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

function Item({ q, a }: Faq) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/70 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[14px] font-medium">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="px-4 pb-3 text-[13px] leading-relaxed text-muted-foreground">{a}</p>
      )}
    </div>
  );
}

function HelpPage() {
  return (
    <AppShell publicPage eyebrow="Help" title="Questions, answered.">
      <div className="space-y-5 pb-4">
        <p data-guide="help-faq" className="text-[13px] leading-relaxed text-muted-foreground">
          Everything people usually ask — including day trips, travel tags, packing, Home layout and
          the two welcome walks. If a page still feels unclear, tap Ask Béa (the sparkle at the top)
          for a walkthrough of that screen — different from the sparkle on a trip, which plans the
          itinerary.
        </p>

        {HELP_FAQ_GROUPS.map((g) => (
          <section key={g.title}>
            <p className="label-caps mb-2 text-foreground">{g.title}</p>
            <div className="card-soft overflow-hidden">
              {g.items.map((it) => (
                <Item key={it.q} {...it} />
              ))}
            </div>
          </section>
        ))}

        <section className="card-soft p-4">
          <p className="text-[14px] font-medium">Still stuck?</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Read the{" "}
            <Link to="/privacy" className="text-primary underline">
              privacy policy
            </Link>{" "}
            or the{" "}
            <Link to="/terms" className="text-primary underline">
              terms of service
            </Link>{" "}
            for the fine print.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
