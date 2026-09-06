import { createFileRoute, Link } from "@tanstack/react-router";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { LEGAL_VERSION } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Béa" },
      {
        name: "description",
        content:
          "The terms that govern your use of Béa: your account, your content, acceptable use, disclaimers and limits of liability.",
      },
      { property: "og:title", content: "Terms of Service — Béa" },
      {
        property: "og:description",
        content: "The rules of the road for using Béa, in plain language.",
      },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[20px] leading-snug">{title}</h2>
      <div className="mt-2 space-y-3 text-[13.5px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-[640px] border-x border-border/70 px-6 py-10 pb-24">
        <p className="label-caps">Béa</p>
        <h1 className="mt-2 text-[30px] leading-[1.08]">Terms of Service</h1>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Version {LEGAL_VERSION} — effective 6 September 2026
        </p>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
          These terms govern your use of Béa ("the app"). By creating an account you confirm that
          you have read, understood and agree to them, together with our{" "}
          <Link to="/privacy" className="text-primary underline underline-offset-4">
            Privacy Policy
          </Link>
          . If you do not agree, please do not create an account or use the app.
        </p>

        <Section title="1. What Béa is">
          <p>
            Béa is a personal travel memory vault and companion: it lets you save places, trips,
            photos, receipts, documents and notes, and helps you organise and revisit them. Béa is
            an organisational tool only — it is not a travel agency, carrier, insurer, financial or
            legal adviser, and it does not make bookings or reservations on your behalf.
          </p>
        </Section>

        <Section title="2. Acceptance and eligibility">
          <p>
            By creating an account, ticking the acceptance boxes, or otherwise using Béa, you enter
            into a binding agreement with us. If you are using Béa on behalf of an organisation, you
            confirm you are authorised to accept these terms for it. You must be at least 16 years
            old (or the age of digital consent where you live), and you must not be barred from
            using the app under any applicable law or sanctions list.
          </p>
        </Section>

        <Section title="3. Your account">
          <p>
            You are responsible for keeping your sign-in credentials and vault passcode
            confidential, and for everything that happens under your account. Tell us promptly if
            you suspect unauthorised access. If you lose your document-vault passcode, the encrypted
            contents cannot be recovered by anyone — including us — by design.
          </p>
        </Section>

        <Section title="4. Intellectual property and licence to use Béa">
          <p>
            Béa — the name, design, code, features, written copy and original ideas in the app — is
            owned by Mathilde E. Larochelle. All rights not expressly granted are reserved.
          </p>
          <p>
            We grant you a personal, limited, non-exclusive, non-transferable, revocable licence to
            use Béa for your own non-commercial travel organisation. You may not copy, resell,
            sublicense, reverse-engineer, decompile or create derivative works from the app, remove
            proprietary notices, or use automated systems to extract data from it, except where such
            restrictions are prohibited by law.
          </p>
        </Section>

        <Section title="5. Your content">
          <p>
            You keep full ownership of everything you save in Béa — photos, notes, receipts,
            documents, pins and trips. You grant us only the limited, worldwide, royalty-free right
            to host, store, transmit, back up and display that content, and to process it through
            the service providers described in the Privacy Policy, strictly so the app can function
            for you. This licence ends when you delete the content or your account, apart from
            copies retained briefly in routine backups.
          </p>
          <p>
            You promise that you have the right to upload what you upload, and that it does not
            break any law or anyone else's rights.
          </p>
        </Section>

        <Section title="6. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>upload unlawful, harmful, infringing or abusive content;</li>
            <li>share trip invite codes to harass, spam or mislead others;</li>
            <li>probe, attack, scrape or attempt to bypass the app's security or other members' privacy;</li>
            <li>use the app to store another person's sensitive documents without their permission;</li>
            <li>misuse location features to track anyone without their knowledge and consent;</li>
            <li>overload, disrupt or interfere with the app, its networks or other members' use of it;</li>
            <li>use the app to build a competing product or to train machine-learning models.</li>
          </ul>
          <p>We may suspend or remove accounts that break these rules.</p>
        </Section>

        <Section title="7. AI features">
          <p>
            Some features — itinerary building and import, place and trip comparisons, and written
            summaries — send the text or images you provide to an AI provider so it can be read and
            structured. AI output is generated automatically, can be inaccurate or invented, and is
            never a confirmation that anything is booked, open, priced as shown or safe. Do not
            include passwords, payment card numbers, health details or other sensitive information
            in what you send. See the Privacy Policy for how this processing works.
          </p>
        </Section>

        <Section title="8. Travel decisions are yours">
          <p>
            Anything Béa shows you — comparisons, suggestions, opportunity rankings, directions,
            exchange-rate conversions or AI-generated summaries — is informational only and may be
            incomplete, outdated or wrong. Always verify visas, entry rules, opening hours, prices,
            routes and safety information with official sources before you travel. You are solely
            responsible for your travel decisions, bookings, documents, expenses and safety.
          </p>
        </Section>

        <Section title="9. Location, camera and device permissions">
          <p>
            Location reminders, nearby opportunities and photo import work only if you grant the
            matching device permissions. You may withdraw any permission at any time in your device
            settings; the related features will then stop working. Battery use, background location
            behaviour and offline availability depend on your device and operating system.
          </p>
        </Section>

        <Section title="10. Third-party services">
          <p>
            Béa relies on independent third parties for maps, geocoding, directions, exchange rates,
            web search and AI processing, and on Google for optional sign-in. We are not responsible
            for the availability, accuracy or conduct of those services, and their own terms apply
            to your use of them.
          </p>
        </Section>

        <Section title="11. Fees and paid features">
          <p>
            Béa is currently offered free of charge. If we introduce paid plans or optional paid
            features, we will show the price, billing period and renewal terms before you buy, and
            no charge will be made without your explicit consent. Statutory rights of withdrawal or
            refund that apply where you live are unaffected.
          </p>
        </Section>

        <Section title="12. Feedback">
          <p>
            If you send us ideas, suggestions or bug reports, you allow us to use them freely to
            improve Béa, without obligation, compensation or confidentiality, while you keep any
            rights you already had in them.
          </p>
        </Section>

        <Section title="13. Copyright complaints">
          <p>
            If you believe content in Béa infringes your copyright, contact us with a description of
            the work, where the content sits in the app, your contact details, and a statement that
            you hold the rights in good faith. We will review and, where appropriate, remove the
            content and may terminate repeat infringers' accounts.
          </p>
        </Section>

        <Section title="14. Privacy">
          <p>
            Our{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            explains what we collect, why, who processes it and how long it is kept. It forms part
            of these terms.
          </p>
        </Section>

        <Section title="15. Availability, changes and beta features">
          <p>
            We may add, change, suspend or discontinue features at any time, and some features may
            be labelled beta or experimental and offered without any service commitment. We are not
            liable to you for modifying or discontinuing all or part of the app, though we will give
            reasonable notice of material changes where practical.
          </p>
        </Section>

        <Section title="16. No warranty">
          <p>
            Béa is provided "as is" and "as available", without warranties of any kind, express or
            implied — including merchantability, fitness for a particular purpose, accuracy,
            non-infringement and uninterrupted availability. Features may change, and data sync
            depends on networks and devices we do not control. Keep your own backups of anything
            irreplaceable.
          </p>
        </Section>

        <Section title="17. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Béa and its creators are not liable for any
            indirect, incidental, special, consequential or punitive damages, or for any loss of
            data, profits, trips, bookings, opportunities or goodwill, arising from or related to
            your use of the app — including reliance on AI suggestions, directions, exchange rates,
            or the unavailability of offline downloads.
          </p>
          <p>
            Where liability cannot be excluded, our total aggregate liability to you for any claim
            is limited to the amount you paid us for the app in the twelve months before the claim
            (or, if you paid nothing, to CAD $50). Nothing in these terms limits liability for
            fraud, death or personal injury caused by negligence, or anything else that cannot
            lawfully be limited — including your rights as a consumer.
          </p>
        </Section>

        <Section title="18. Indemnity">
          <p>
            You agree to indemnify and hold Béa and its creators harmless from claims, losses and
            expenses (including reasonable legal fees) arising out of content you upload, your
            misuse of the app, or your breach of these terms.
          </p>
        </Section>

        <Section title="19. Ending things">
          <p>
            You can stop using Béa and delete your account at any time; your data will be removed as
            described in the Privacy Policy. We may suspend or close accounts that breach these
            terms, or if we stop offering the app. The sections on content licences already granted,
            warranties, liability, indemnity and governing law survive termination.
          </p>
        </Section>

        <Section title="20. Governing law and disputes">
          <p>
            These terms are governed by the laws of the Province of Quebec and the applicable laws
            of Canada, without regard to conflict-of-law rules, and the courts of Quebec have
            jurisdiction. If you are a consumer resident elsewhere, you keep the protection of the
            mandatory laws of your country of residence and may bring proceedings there. Before
            starting a claim, please contact us so we can try to resolve it informally.
          </p>
        </Section>

        <Section title="21. General">
          <p>
            These terms, with the Privacy Policy, are the entire agreement between us. If a
            provision is found unenforceable, the rest stays in force. Our not enforcing a right is
            not a waiver of it. You may not transfer your rights under these terms; we may transfer
            ours to a successor of the app. Notices to you may be sent by email or shown in the app.
          </p>
        </Section>

        <Section title="22. Changes to these terms">
          <p>
            If we change these terms in a way that matters, we will ask you to accept the new
            version when you next open the app. The version you accepted, and when, is recorded with
            your account.
          </p>
        </Section>

        <p className="mt-10 border-t border-border pt-6 text-[12px] text-muted-foreground">
          This page is a starting point written in plain language — have a lawyer review it before
          you rely on it commercially. Questions about these terms? Reach us via the profile page.
        </p>
        <CopyrightNotice className="mt-3 px-0 text-left text-[12px] text-muted-foreground" />
        <Link to="/" className="mt-4 inline-block text-[13px] text-primary underline underline-offset-4">
          Back to Béa
        </Link>
      </div>
    </div>
  );
}
