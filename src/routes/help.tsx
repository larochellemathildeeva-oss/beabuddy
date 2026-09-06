import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — Béa" },
      {
        name: "description",
        content:
          "Answers about trips, pins, photo imports, the document vault, receipts and offline use in Béa.",
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

type Faq = { q: string; a: string };

const groups: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Béa?",
        a: "Béa is one place for everything about your travels: the map of where you've been and where you want to go, your trips and their timelines, the places people recommend to you, your photos, your documents and your receipts.",
      },
      {
        q: "Do I need an account?",
        a: "Yes, to keep anything. An account means your pins, trips, recommendations and photos are saved to you and follow you onto any phone or laptop.",
      },
      {
        q: "How do I get a tour of a page?",
        a: "Tap 'Ask Béa' at the top of any page. Béa highlights each part of that page and explains what it does. You can also replay the full welcome tour from Profile settings.",
      },
    ],
  },
  {
    title: "Trips & planning",
    items: [
      {
        q: "Can one trip cover several countries?",
        a: "Yes. Inside a trip, 'Where you're going' holds every city with its arrival and leaving dates, in the order you'll travel. Stops can be marked as layovers too.",
      },
      {
        q: "Can someone else edit my trip?",
        a: "Yes. Share the trip's invite code and whoever joins can add to the timeline, the budget and the stops. You'll see their changes as they make them.",
      },
      {
        q: "How do I delete a trip?",
        a: "Open the trip and choose 'Delete trip'. Béa asks you to confirm first, because the timeline, stops, budget and invites go with it.",
      },
    ],
  },
  {
    title: "Map, pins & recommendations",
    items: [
      {
        q: "What do the pin colours mean?",
        a: "Visited is where you've been, Next time is somewhere you nearly made it, Wishlist is a dream, and Recommendation is a place someone told you about.",
      },
      {
        q: "Where do recommendations come from?",
        a: "You can type one in, paste a link, or save a place you found on the map. Béa keeps who recommended it so you remember why it's on the list.",
      },
    ],
  },
  {
    title: "Photos & memories",
    items: [
      {
        q: "Does importing photos use up space?",
        a: "Only if you want it to. When you import, choose 'Locations only' and Béa reads where each picture was taken to drop a pin, then keeps nothing at all.",
      },
      {
        q: "Who can see my photos?",
        a: "Only you. Photos live in your private storage and are served to you through short-lived private links.",
      },
    ],
  },
  {
    title: "Documents & privacy",
    items: [
      {
        q: "How safe is the document vault?",
        a: "Documents are scrambled on your own device with a passphrase only you know before they ever leave it. Without your passphrase nobody — including us — can read them.",
      },
      {
        q: "What if I forget my vault passphrase?",
        a: "It can't be recovered, by design. You'd need to reset the vault and add the documents again.",
      },
    ],
  },
  {
    title: "Receipts & expenses",
    items: [
      {
        q: "Is the expense report an official document?",
        a: "No. Béa helps you stay organised and nothing more. It is not tax advice and not an official record — always check figures with your accountant or tax authority.",
      },
      {
        q: "Can I send my expenses to accounting?",
        a: "Yes. Export a spreadsheet from the receipts page with every amount, date, category and its value in your home currency.",
      },
    ],
  },
  {
    title: "Offline",
    items: [
      {
        q: "Does Béa work without signal?",
        a: "Download maps, photos, recommendations, itineraries and documents ahead of time from Profile settings, and they stay readable while you're offline.",
      },
    ],
  },
];

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
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Everything people usually ask. If a page still feels unclear, tap “Ask Béa” at the top of
          it for a guided walkthrough.
        </p>

        {groups.map((g) => (
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
