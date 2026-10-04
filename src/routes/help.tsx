import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, PlayCircle, Search } from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { AiPromptCopy } from "@/components/AiPromptSheet";
import { startWalk } from "@/lib/tour-start";
import { WalkCards } from "@/components/WalkCards";
import { HELP_CLOSING, HELP_WELCOME, searchHelp, type Faq } from "@/lib/help-faq";

export const Route = createFileRoute("/help")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Help — Béa" },
      {
        name: "description",
        content:
          "How to plan a trip with Béa, bring in a plan you have, save places, use Béa on the trip and map where you've been — with walks on the real screens.",
      },
      { property: "og:title", content: "Help — Béa" },
      {
        property: "og:description",
        content:
          "Step-by-step help for planning, importing, saving places and travelling with Béa.",
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
          className="whitespace-pre-line text-[16px] leading-relaxed text-muted-foreground"
        >
          {para}
        </p>
      ))}
    </div>
  );
}

function Item({ q, a, walk, open: startOpen }: Faq & { open?: boolean }) {
  // Starts open when a search narrows to a few answers, and still closes on
  // a tap; it mounts afresh only when that auto-open state changes.
  const [shown, setOpen] = useState(Boolean(startOpen));
  return (
    <div className="border-b border-border/70 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[16px] font-medium">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${shown ? "rotate-180" : ""}`}
        />
      </button>
      {shown && (
        <>
          <Answer text={a} />
          {walk && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => startWalk(walk)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[14px] font-semibold text-primary"
              >
                <PlayCircle className="size-4" aria-hidden />
                Show me on the screen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** The prompt to copy into another assistant, so its plan imports cleanly. */
function PlanPrompt() {
  return (
    <section id="plan-prompt" data-guide="plan-prompt" className="card-soft space-y-3 p-4">
      <p className="font-display text-[19px] leading-snug">Planning with another assistant?</p>
      <AiPromptCopy />
    </section>
  );
}

/** Help is written in English; the count follows English's plural rules. */
const ANSWER_PLURALS = new Intl.PluralRules("en");
const ANSWER_WORD: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "answer",
  other: "answers",
};

function HelpPage() {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const groups = useMemo(() => searchHelp(query), [query]);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  // A search narrowed to a few answers opens them. The key follows only that,
  // not the text, so an answer opened by hand stays open as you type.
  const autoOpen = searching && count <= 3;

  return (
    <AppShell publicPage eyebrow="Help" title={HELP_WELCOME.title}>
      <div className="space-y-6 pb-4">
        <section data-guide="help-faq" className="space-y-3">
          <p className="text-[16px] font-medium leading-snug text-foreground">
            {HELP_WELCOME.lead}
          </p>
          <p className="text-[16px] leading-relaxed text-muted-foreground">{HELP_WELCOME.body}</p>
          <label htmlFor="help-search" className="label-caps block text-foreground">
            Search help
          </label>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="directions, import, offline…"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {!searching && (
          <section className="space-y-3">
            <h2 className="font-display text-[24px] leading-tight">Show me how to…</h2>
            <WalkCards />
          </section>
        )}

        {searching && (
          <p className="text-[14px] text-muted-foreground" aria-live="polite">
            {count === 0
              ? "Nothing matches that. Try another word, or ask through You → Feedback."
              : `${count} ${ANSWER_WORD[ANSWER_PLURALS.select(count)] ?? "answers"}`}
          </p>
        )}

        {groups
          .map((g) => (
            <section key={g.title}>
              <p className="label-caps mb-2 text-foreground">{g.title}</p>
              <div className="card-soft overflow-hidden">
                {g.items.map((it) => (
                  <Item key={`${autoOpen}\n${it.q}`} {...it} open={autoOpen} />
                ))}
              </div>
            </section>
          ))
          .flatMap((section, i) =>
            !searching && groups[i]!.title === "Planning a trip"
              ? [section, <PlanPrompt key="plan-prompt" />]
              : [section],
          )}

        {!searching && (
          <section className="card-soft space-y-2 p-4">
            <p className="font-display text-[19px] leading-snug">{HELP_CLOSING.title}</p>
            <Answer text={HELP_CLOSING.body} padded={false} />
          </section>
        )}

        <section className="card-soft p-4">
          <p className="text-[16px] font-medium">Still stuck?</p>
          <p className="mt-1 text-[16px] text-muted-foreground">
            Tap the ? at the top of any page to see what that page does, with a walk of its own.
            Tell Béa what went wrong through{" "}
            <Link to="/profile" className="text-primary underline">
              You → Feedback
            </Link>
            , or read the{" "}
            <Link to="/privacy" className="text-primary underline">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-primary underline">
              terms
            </Link>
            .
          </p>
        </section>
      </div>
    </AppShell>
  );
}
