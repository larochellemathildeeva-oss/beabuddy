import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  HELP_CLOSING,
  HELP_FAQ_GROUPS,
  HELP_WELCOME,
  type Faq,
} from "@/lib/help-faq";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Béa" },
      {
        name: "description",
        content:
          "Hi, I'm Béa. I remember travel things so you don't have to — recommendations, places, trips, and memories, explained like a conversation.",
      },
      { property: "og:title", content: "Help — Béa" },
      {
        property: "og:description",
        content: "A trusted travel companion's answers — informed, reassured, not overwhelmed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

function Answer({ text, padded = true }: { text: string; padded?: boolean }) {
  const parts = text.split(/\n\n+/);
  return (
    <div className={`space-y-2 ${padded ? "px-4 pb-3" : ""}`}>
      {parts.map((para, i) => (
        <p
          key={i}
          className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground"
        >
          {para}
        </p>
      ))}
    </div>
  );
}

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
      {open && <Answer text={a} />}
    </div>
  );
}

function HelpPage() {
  return (
    <AppShell publicPage eyebrow="Help" title="Welcome to Béa">
      <div className="space-y-5 pb-4">
        <section data-guide="help-faq" className="card-soft space-y-2 p-4">
          <p className="font-display text-[22px] leading-tight">{HELP_WELCOME.title}</p>
          <p className="text-[14px] font-medium text-foreground">{HELP_WELCOME.lead}</p>
          <Answer text={HELP_WELCOME.body} padded={false} />
        </section>

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

        <section className="card-soft space-y-2 p-4">
          <p className="font-display text-[19px] leading-snug">{HELP_CLOSING.title}</p>
          <Answer text={HELP_CLOSING.body} padded={false} />
        </section>

        <section className="card-soft p-4">
          <p className="text-[14px] font-medium">Still stuck?</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Tap Ask Béa (the sparkle) on any page for a walkthrough of that screen. Or read the{" "}
            <Link to="/privacy" className="text-primary underline">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-primary underline">
              terms
            </Link>{" "}
            for the fine print.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
