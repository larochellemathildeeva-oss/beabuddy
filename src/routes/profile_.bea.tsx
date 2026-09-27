import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, GraduationCap, RefreshCw, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  BALANCED,
  BEA_PRESETS,
  BEA_TRAITS,
  PRESET_INFO,
  TRAIT_INFO,
  credentialLine,
  emptyLine,
  loadingLine,
  mixPercents,
  modeName,
  presetOf,
  type BeaSettings,
  type BeaTrait,
} from "@/lib/bea-personality";
import { saveBeaSettings, useBeaSettings } from "@/hooks/useBeaSettings";

export const Route = createFileRoute("/profile_/bea")({
  head: () => ({ meta: [{ title: "Your Béa — Béa" }] }),
  component: BeaPage,
});

/** Three lines in the current mix, the same ones until "Try another". */
function previewLines(settings: BeaSettings, round: number): string[] {
  let seed = round * 9973 + 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const quiet = { ...settings, surprises: false };
  const seen: string[] = [];
  const say = (line: string) => {
    seen.push(line);
    return line;
  };
  return [
    say(loadingLine({ action: "dig", settings: quiet, recent: seen, rand })),
    say(loadingLine({ action: "run", settings: quiet, recent: seen, rand })),
    say(emptyLine({ kind: "noResults", settings: quiet, recent: seen, rand })),
  ];
}

/**
 * Your Béa: how she talks, in eight traits.
 *
 * Presets are starting points; moving any slider makes the mix Custom (or
 * whatever it now leans towards). The sliders are intensities — they need not
 * add to 100, and the share each one gets is shown beside it. Everything saves
 * as it changes, on this device.
 *
 * What the mix never touches is said on the page: facts, plans and
 * recommendations are the same whatever Béa sounds like, and serious moments
 * are always plain.
 */
function BeaPage() {
  const settings = useBeaSettings();
  const [round, setRound] = useState(0);
  const [credential, setCredential] = useState(() => credentialLine());
  const percents = mixPercents(settings.mix);
  const preset = presetOf(settings.mix);
  const lines = previewLines(settings, round);

  const update = (patch: Partial<BeaSettings>) => saveBeaSettings({ ...settings, ...patch });
  const setTrait = (trait: BeaTrait, value: number) =>
    update({ mix: { ...settings.mix, [trait]: value } });

  return (
    <AppShell eyebrow="Your Béa" title="Personality & assistance">
      <div className="space-y-5">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          You
        </Link>

        <section className="tile-card-1 flex items-center gap-4 p-4">
          <img
            src="/bea/bea-think-static.png"
            alt=""
            aria-hidden
            className="size-24 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="label-caps">Current mode</p>
            <p className="font-display text-[28px] leading-tight">{modeName(settings.mix)}</p>
            <p className="text-[13px] text-muted-foreground">
              {preset
                ? PRESET_INFO[preset].description
                : "Your own mix. Béa sounds like the traits you turned up."}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="label-caps text-foreground">Start from a preset</h2>
          <div role="radiogroup" aria-label="Presets" className="grid gap-2">
            {BEA_PRESETS.map((p) => {
              const on = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ mix: { ...PRESET_INFO[p].mix } })}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    on ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{PRESET_INFO[p].name}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {PRESET_INFO[p].description}
                    </span>
                  </span>
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {on && <Check className="size-3.5" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="tile-card-2 space-y-3 p-4">
          <div>
            <h2 className="font-display text-[22px] leading-tight">Set the mix</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Turn traits up or down. They don't need to add up — Béa works out the shares.
            </p>
          </div>
          {BEA_TRAITS.map((trait) => (
            <label key={trait} className="block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{TRAIT_INFO[trait].name}</span>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {percents[trait]}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.mix[trait]}
                onChange={(e) => setTrait(trait, Number(e.target.value))}
                aria-label={`${TRAIT_INFO[trait].name}: ${TRAIT_INFO[trait].description}`}
                className="mt-1 w-full accent-primary"
              />
              <span className="block text-[12px] text-muted-foreground">
                {TRAIT_INFO[trait].description}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => update({ mix: { ...BALANCED } })}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset to Balanced
          </button>
        </section>

        <section className="tile-card-3 space-y-2.5 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-[22px] leading-tight">Meet your Béa</h2>
            <button
              type="button"
              onClick={() => setRound((r) => r + 1)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Try another
            </button>
          </div>
          {lines.map((line, i) => (
            <p key={i} className="flex items-start gap-2.5 text-[14px] leading-snug">
              <img
                src="/bea/bea-think-static.png"
                alt=""
                aria-hidden
                className="size-8 shrink-0 object-contain"
              />
              <span className="rounded-2xl rounded-tl-md bg-card px-3 py-2">{line}</span>
            </p>
          ))}
          <p className="text-[12px] text-muted-foreground">Examples only.</p>
        </section>

        <section className="tile-card-4 space-y-1 p-4">
          <h2 className="font-display text-[22px] leading-tight">Béa's extras</h2>
          {(
            [
              ["says", "“Béa says” lines", "Little asides on Companion, never facts or warnings."],
              [
                "reactions",
                "Reactions",
                "A short line when something is done, or a find is notable.",
              ],
              ["surprises", "Rare surprises", "The ball, the bone, and her credentials."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{label}</span>
                <span className="block text-[12.5px] text-muted-foreground">{hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={settings[key]}
                onChange={(e) => update({ [key]: e.target.checked })}
                className="size-5 shrink-0 accent-primary"
              />
            </label>
          ))}
        </section>

        <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Personality changes how Béa says things, never what is true: plans, recommendations,
          prices and directions are the same in every mix. Payments, security, deleting and errors
          are always said plainly.
        </p>

        <section className="tile-card-5 flex items-start gap-3 p-4">
          <GraduationCap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14.5px] font-semibold">Béa's credentials</h2>
            <p className="text-[13px] text-muted-foreground">{credential}</p>
          </div>
          <button
            type="button"
            onClick={() => setCredential(credentialLine())}
            aria-label="Another credential"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card"
          >
            <RefreshCw className="size-3.5" aria-hidden />
          </button>
        </section>
      </div>
    </AppShell>
  );
}
