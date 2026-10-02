import { Link } from "@tanstack/react-router";
import { ArrowRight, Play } from "@/components/icons";
import { BeaWordmark } from "@/components/BeaWordmark";
import { BEA_POSITION } from "@/lib/bea-voice";

/**
 * The first screen a visitor sees, painted edge to edge: the wordmark, the
 * promise, the way in. Its colours are fixed rather than themed, because the
 * words sit on the artwork's pale sky in every theme, dark included. Only
 * true lines here — no counts or ratings.
 */
export function LandingHero() {
  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#f6efe2] text-[#1d1a17]">
      <img
        src="/onboarding/landing.webp"
        alt=""
        aria-hidden
        width={768}
        height={1376}
        fetchPriority="high"
        className="absolute inset-0 -z-10 size-full object-cover object-bottom"
      />
      <div className="flex items-center justify-between px-6 pt-6">
        <BeaWordmark ink />
        <Link
          to="/auth"
          className="inline-flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-[#1d1a17]"
        >
          Sign in
        </Link>
      </div>
      <div className="rise px-6 pt-8">
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em]">
          {BEA_POSITION}
        </h1>
        <p className="mt-3 max-w-[22rem] text-[16.5px] leading-relaxed text-[#4a443e]">
          Save places. Plan real trips. Follow the day. Remember it all.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="mt-7 flex min-h-[58px] w-full max-w-[22rem] items-center justify-between gap-3 rounded-full bg-[#1d1a17] py-2 pl-6 pr-2 text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(29,26,23,0.25)]"
        >
          Create your free account
          <span className="grid size-10 place-items-center rounded-full border border-white/40">
            <ArrowRight className="size-5" aria-hidden />
          </span>
        </Link>
        <Link
          to="/how-it-works"
          className="mt-3 inline-flex min-h-11 items-center gap-3 text-[15.5px] font-semibold"
        >
          <span className="grid size-9 place-items-center rounded-full bg-[#1d1a17] text-white">
            <Play className="size-4" weight="fill" aria-hidden />
          </span>
          Watch how it works
        </Link>
      </div>
    </section>
  );
}
