import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, PlayCircle, Search } from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import { AiPromptCopy } from "@/components/AiPromptSheet";
import { startWalk } from "@/lib/tour-start";
import { WalkCards } from "@/components/WalkCards";
import { HELP_CLOSING, HELP_FAQ_GROUPS, HELP_WELCOME, searchHelp, type Faq } from "@/lib/help-faq";
import { Sheet } from "@/components/Sheet";

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
    <div className={`space-y-2 ${padded ? "pb-3" : ""}`}>
      {parts.map((para, i) => (
        <p key={i} className="whitespace-pre-line text-[14px] leading-[1.4] text-foreground">
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
    <div className="border-b border-[var(--rule)]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[16px]">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${shown ? "rotate-180" : ""}`}
        />
      </button>
      {shown && (
        <>
          <Answer text={a} />
          {walk && (
            <div className="pb-3">
              <button
                type="button"
                onClick={() => startWalk(walk)}
                className="inline-flex min-h-11 items-center gap-1.5 text-[14px] text-foreground underline underline-offset-4"
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
    <section id="plan-prompt" className="space-y-3 border-t border-[var(--rule)] pt-4">
      <p className="text-[16px] font-bold">Planning with another assistant?</p>
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

/**
 * The page's five topics, as the Figma "Help & faq" frame draws them. Each
 * opens the answer groups it covers; every group is under one of them.
 */
const TOPICS: { name: string; note: string; groups: string[]; prompt?: boolean }[] = [
  {
    name: "Plan a trip",
    note: "Build or import a plan",
    groups: ["Getting started", "Planning a trip"],
    prompt: true,
  },
  {
    name: "Save a place",
    note: "Links, lists and nearby discoveries",
    groups: ["Saving places", "Your map & memories"],
  },
  { name: "Travel together", note: "Invite and share", groups: ["Travelling together"] },
  {
    name: "Use Béa offline",
    note: "Keep directions and maps",
    groups: ["On the trip", "Troubleshooting"],
  },
  {
    name: "Protect documents",
    note: "Passcodes and privacy",
    groups: ["Privacy & your data", "About Béa"],
  },
];

function Groups({
  groups,
  autoOpen = false,
}: {
  groups: { title: string; items: Faq[] }[];
  autoOpen?: boolean;
}) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className="mt-5 first:mt-0">
          <p className="mb-1 text-[12px] text-foreground">{g.title}</p>
          <div className="border-t border-[var(--rule)]">
            {g.items.map((it) => (
              <Item key={`${autoOpen}\n${it.q}`} {...it} open={autoOpen} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** Walks, a search through every answer, and the last word: behind "Show me how". */
function ShowMeHow() {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const groups = useMemo(() => searchHelp(query), [query]);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  // A search narrowed to a few answers opens them. The key follows only that,
  // not the text, so an answer opened by hand stays open as you type.
  const autoOpen = searching && count <= 3;
  return (
    <div className="space-y-6 pb-4">
      <WalkCards />
      <section className="space-y-2">
        <p className="text-[14px] leading-[1.4] text-foreground">{HELP_WELCOME.lead}</p>
        <label htmlFor="help-search" className="block text-[12px] text-foreground">
          Search help
        </label>
        <div className="flex min-h-[52px] items-center gap-2 rounded-[var(--r-card)] border border-[var(--field-border)] bg-card px-4">
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
      {searching && (
        <>
          <p className="text-[14px] text-muted-foreground" aria-live="polite">
            {count === 0
              ? "Nothing matches that. Try another word, or ask through You → Feedback."
              : `${count} ${ANSWER_WORD[ANSWER_PLURALS.select(count)] ?? "answers"}`}
          </p>
          <Groups groups={groups} autoOpen={autoOpen} />
        </>
      )}
      <section className="border-t border-[var(--rule)] pt-4">
        <p className="text-[16px] font-bold">{HELP_CLOSING.title}</p>
        <div className="mt-2">
          <Answer text={HELP_CLOSING.body} padded={false} />
        </div>
      </section>
      <StillStuck />
    </div>
  );
}

function StillStuck() {
  return (
    <section className="border-t border-[var(--rule)] pt-4">
      <p className="text-[16px] font-bold">Still stuck?</p>
      <p className="mt-1 text-[14px] leading-[1.4] text-foreground">
        Open Menu → Help for this page on any page to see what that page does, with a walk of its
        own. Tell Béa what went wrong through{" "}
        <Link to="/profile" className="underline underline-offset-4">
          You → Feedback
        </Link>
        , or read the{" "}
        <Link to="/privacy" className="underline underline-offset-4">
          privacy policy
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="underline underline-offset-4">
          terms
        </Link>
        .
      </p>
    </section>
  );
}

type Topic = (typeof TOPICS)[number];

function TopicRow({ topic, onOpen }: { topic: Topic; onOpen: (t: Topic) => void }) {
  return (
    <button type="button" onClick={() => onOpen(topic)} className="menu-row w-full">
      <span className="menu-row-title">{topic.name}</span>
      <span className="menu-row-note">{topic.note}</span>
    </button>
  );
}

function HelpPage() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  return (
    <AppShell publicPage eyebrow="Help & faq" title="A little guidance.">
      <section data-guide="help-faq">
        <ul>
          {/* The tour's "Planning somewhere else?" step points here: the
              prompt to copy is inside this topic. */}
          <li data-guide="plan-prompt">
            <TopicRow topic={TOPICS[0]!} onOpen={setTopic} />
          </li>
          {TOPICS.slice(1).map((t) => (
            <li key={t.name}>
              <TopicRow topic={t} onOpen={setTopic} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="btn-primary mt-3 flex w-full items-center justify-center px-4"
        >
          Show me how
        </button>
      </section>

      <Sheet
        open={topic !== null}
        onClose={() => setTopic(null)}
        page
        hint="Help & faq"
        title={topic?.name ?? ""}
        crumb="Help"
      >
        {topic && (
          <div className="space-y-6 pb-4">
            <Groups groups={HELP_FAQ_GROUPS.filter((g) => topic.groups.includes(g.title))} />
            {topic.prompt && <PlanPrompt />}
          </div>
        )}
      </Sheet>

      <Sheet
        open={howOpen}
        onClose={() => setHowOpen(false)}
        page
        hint="Help & faq"
        title="Show me how"
        crumb="Help"
      >
        <ShowMeHow />
      </Sheet>
    </AppShell>
  );
}
