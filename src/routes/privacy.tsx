import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Béa" },
      {
        name: "description",
        content:
          "How Béa stores your account, handles the photos you import, and protects trip documents you keep in the vault.",
      },
      { property: "og:title", content: "Privacy policy — Béa" },
      {
        property: "og:description",
        content: "Plain-English privacy: what Béa keeps, where it lives, and what only you can read.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-soft p-4">
      <h2 className="font-display text-[19px] leading-snug">{title}</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <AppShell publicPage eyebrow="Privacy" title="What Béa keeps, and what only you can read.">
      <div className="space-y-4 pb-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Béa is a private vault for your travels. This page explains, in plain words, what is
          stored, where it lives, who can see it and how to remove it. Last updated 5 September
          2026.
        </p>

        <Section title="Your account">
          <p>
            When you create an account Béa stores your email address, and anything you choose to add
            to your profile: your name, your home city and the interests you tick. Signing in with
            Google or Apple shares only your email address and name with Béa — never your password.
          </p>
          <p>
            Everything is stored in a private, encrypted-at-rest database. Each row is locked to
            your account, so no other user of Béa can read your data, and the app itself only ever
            queries as you.
          </p>
        </Section>

        <Section title="Your photos">
          <p>
            Your photos belong to you. If you choose to import them, Béa uses location information
            to help organize memories by city. You stay in control of what is kept and what is
            removed.
          </p>
          <p>
            Photos stay on your device until you pick them and confirm the upload. Béa asks for your
            agreement before every import unless you tell it to stop asking, and asks a second time
            before the selected photos are actually saved.
          </p>
          <p>
            From each photo Béa reads the date it was taken and, if the photo carries it, the
            location recorded by your camera. That is used to name the city, place your pins and
            build your statistics. Nothing else is read from the image.
          </p>
          <p>
            Photos are kept in private storage. They are shown to you through links that expire
            after an hour, so a copied link cannot be reused. Photos are never shared, never sold,
            never used to train anything, and never shown to another user. Delete a photo and both
            the file and its record are removed.
          </p>
        </Section>

        <Section title="Receipts and business expenses">
          <p>
            Receipt pictures and the amounts, shops, dates and notes you type alongside them are
            stored privately in your own account. Only you can see them, and the pictures are shown
            to you through links that expire after an hour.
          </p>
          <p>
            Béa does not send your receipts anywhere. The spreadsheet download is built on your own
            device from your own records — where you send it afterwards is entirely your choice.
            Delete a receipt and both the picture and its record are gone.
          </p>
        </Section>


        <Section title="The document vault">
          <p>
            The Vault is for trip-useful documents — reservations, tickets, booking confirmations,
            boarding passes, and similar items you may need while travelling. It is not intended for
            identity documents such as passports or visas.
          </p>
          <p>
            When you add a document it is encrypted on your own device, in your browser, before
            anything leaves it — AES-256-GCM, with the key derived from your passcode using PBKDF2
            at 210,000 iterations. Only the scrambled result is uploaded. Your passcode is never
            uploaded and never stored on our side. The Vault is designed so that Béa cannot view
            document contents without access to your Vault credentials. If you forget your
            passcode, recovery options may be limited or unavailable.
          </p>
          <p>
            One honest caveat: if you turn on Face ID or fingerprint unlock, a copy of the key is
            kept in that device's local browser storage so it can open without typing. That is a
            convenience trade-off. For maximum security, use the passcode only.
          </p>
        </Section>

        <Section title="Your location">
          <p>
            Béa only uses your location when you allow it. The purpose is simple: helping you
            discover places you've already saved nearby.
          </p>
          <p>
            Béa asks for your location only when you open Near or save a place with “I'm here now”.
            Before the first request you're told exactly what it's used for and you choose how long
            to share it for — just this once, an hour, the rest of the day, or until you turn it off.
            Your position is used on the spot to measure distances and is not stored as a history of
            where you have been. You can stop sharing at any time from the Near screen.
          </p>
        </Section>

        <Section title="Trips and collaboration">
          <p>
            When you invite someone to a trip with a code, that person can see and edit that trip's
            itinerary and see when you are viewing it. They cannot see your photos, your
            recommendations, your notes or your trip documents. Remove them and their access ends.
          </p>
        </Section>

        <Section title="AI processing">
          <p>
            When you use an AI feature — building a trip, importing a plan from a photo or pasted
            text, comparing two itineraries or places — the text or image you provide is sent to an
            AI provider (Google Gemini) purely to produce your answer.
            Your saved travel preferences (style, budget, interests, dietary rules) are included so
            suggestions fit you.
          </p>
          <p>
            This content is used only to generate your result; it is not sold, not used for
            advertising, and not kept by Béa beyond what you save to your account. Photos from your
            photo memories are never sent to the AI provider. Avoid pasting or photographing
            sensitive details such as passport or card numbers.
          </p>
        </Section>

        <Section title="Other services Béa uses">
          <p>
            To turn a saved link or an address into a point on the map, Béa sends just that text or
            those coordinates to public map services (OpenStreetMap's geocoder, OSRM for directions,
            BigDataCloud for city lookup). Your identity is not sent with those requests.
          </p>
        </Section>

        <Section title="Your control">
          <p>
            You can edit or delete any photo, recommendation, note, trip or document at any time,
            and deletion is permanent rather than hidden. Ask us to close your account and
            everything attached to it is removed.
          </p>
          <p>Béa does not sell data, does not run advertising and does not track you across the web.</p>
        </Section>

        <Link
          to="/profile"
          className="mt-4 block rounded-xl border border-border px-4 py-3 text-center text-[13px] font-semibold"
        >
          Back to profile
        </Link>
      </div>
    </AppShell>
  );
}
