import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type ComponentType } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Drama,
  GraduationCap,
  Heart,
  Lightbulb,
  Minus,
  Mountain,
  RefreshCw,
  RotateCcw,
  Search,
  Smile,
  Sparkles,
  type LucideProps,
} from "@/components/icons";
import { AppShell } from "@/components/AppShell";
import {
  BALANCED,
  BEA_PRESETS,
  BEA_TRAITS,
  PRESET_INFO,
  TRAIT_INFO,
  credentialLine,
  mixPercents,
  modeName,
  normalizeMix,
  presetOf,
  seededRandom,
  type BeaMix,
  type BeaPreset,
  type BeaSettings,
  type BeaTrait,
} from "@/lib/bea-personality";
import { BEA_CHARACTER } from "@/lib/bea-character-data";
import { saveBeaSettings, useBeaSettings } from "@/hooks/useBeaSettings";

export const Route = createFileRoute("/profile_/bea")({
  head: () => ({ meta: [{ title: "Your Béa — Béa" }] }),
  component: BeaPage,
});

type Icon = ComponentType<LucideProps>;

const TRAIT_ICON: Record<BeaTrait, Icon> = {
  helpful: Lightbulb,
  funny: Smile,
  sassy: Sparkles,
  encouraging: Heart,
  curious: Search,
  adventurous: Mountain,
  dramatic: Drama,
  chill: Coffee,
};

const PRESET_ICON: Record<BeaPreset, Icon> = {
  balanced: BarChart3,
  helpful: Lightbulb,
  funny: Smile,
  sassy: Sparkles,
  minimal: Minus,
};

/** A big card or list: plain in every theme, Colorful included. */
const PLAIN = "plain-card rounded-[var(--r-card)] border border-border/55 bg-card shadow-sm";

/** Every line a trait says while Béa works, whatever the work. */
function traitLines(trait: BeaTrait): string[] {
  const bank = (BEA_CHARACTER.loading as Record<string, Record<string, readonly string[]>>)[trait];
  if (!bank) return [];
  // Ball and bone are rare surprises, not how she sounds.
  return Object.entries(bank)
    .filter(([action]) => action !== "ball" && action !== "bone")
    .flatMap(([, lines]) => lines);
}

/**
 * Four lines in the current mix, each tagged with the trait that said it.
 *
 * Traits are drawn by their share without repeats, so Balanced shows its
 * four; a mix with fewer traits lets the strongest speak twice. Seeded by the
 * round, so the same lines stay until "Generate new examples".
 */
function previewLines(mix: BeaMix, round: number): { trait: BeaTrait; line: string }[] {
  const rand = seededRandom(round * 9973 + 17);
  const shares = normalizeMix(mix);
  const pool = BEA_TRAITS.filter((t) => shares[t] > 0 && traitLines(t).length > 0);
  const picked: BeaTrait[] = [];
  const left = [...pool];
  while (picked.length < 4 && left.length) {
    const total = left.reduce((s, t) => s + shares[t], 0);
    let r = rand() * total;
    let idx = left.length - 1;
    for (let i = 0; i < left.length; i++) {
      r -= shares[left[i]!];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(left.splice(idx, 1)[0]!);
  }
  const ranked = [...pool].sort((a, b) => shares[b] - shares[a]);
  for (let i = 0; picked.length < 4 && ranked.length; i++) picked.push(ranked[i % ranked.length]!);
  const said: string[] = [];
  return picked.map((trait) => {
    const lines = traitLines(trait).filter((l) => !said.includes(l));
    const line = lines[Math.floor(rand() * lines.length)] ?? "";
    said.push(line);
    return { trait, line };
  });
}

/**
 * Your Béa: how she talks, in eight traits.
 *
 * Presets are starting points; moving any slider makes the mix Custom (or
 * whatever it now leans towards). The sliders are intensities — they need not
 * add to 100, and the share each one gets is shown beside it. Everything saves
 * as it changes, to the account.
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
  const [picked, setPicked] = useState<BeaPreset | null>(null);
  const choice = picked ?? preset;
  const lines = previewLines(settings.mix, round);
  const mode = modeName(settings.mix);
  const mixRef = useRef<HTMLElement | null>(null);
  const presetsRef = useRef<HTMLElement | null>(null);

  const update = (patch: Partial<BeaSettings>) => saveBeaSettings({ ...settings, ...patch });
  const setTrait = (trait: BeaTrait, value: number) =>
    update({ mix: { ...settings.mix, [trait]: value } });
  const total = BEA_TRAITS.reduce((s, t) => s + percents[t], 0);
  const scrollTo = (el: HTMLElement | null) =>
    el?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex items-center gap-2.5">
          <Link
            to="/profile"
            aria-label="Back to You"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <img
            src="/bea/bea-think-static.png"
            alt=""
            aria-hidden
            className="art-dim size-11 object-contain"
          />
          <span className="min-w-0 flex-1 leading-none">
            <span className="block font-display text-[26px] leading-none">Béa</span>
            <span className="label-caps mt-1 block">Your travel buddy</span>
          </span>
          <span className="shrink-0 rounded-full bg-primary-soft [[data-theme=colorful]_&]:bg-tile-5 px-3.5 py-1.5 text-[13px] font-semibold text-primary">
            {mode}
          </span>
        </header>

        <section className="space-y-4">
          <div>
            <h1 className="font-display text-[34px] leading-[1.1]">Personality & assistance.</h1>
            <p className="mt-2 text-[16px] text-muted-foreground">
              Choose how Béa sounds, from helpful and practical to funny and playful.
            </p>
          </div>
          <img
            src="/bea/bea-think-static.png"
            alt=""
            aria-hidden
            className="art-dim mx-auto size-48 object-contain"
          />
          <button
            type="button"
            onClick={() => scrollTo(presetsRef.current)}
            className={`${PLAIN} flex w-full items-center gap-3 p-3.5 text-left`}
          >
            <span className="tile-fill-1 grid size-12 shrink-0 place-items-center rounded-full border border-border/60">
              {(() => {
                const Glyph = preset ? PRESET_ICON[preset] : Sparkles;
                return <Glyph className="seq-text-4 size-6" aria-hidden />;
              })()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="label-caps block">Current mode</span>
              <span className="block font-display text-[22px] leading-tight">{mode}</span>
              <span className="block text-[13px] leading-snug text-muted-foreground">
                {preset
                  ? PRESET_INFO[preset].description
                  : "Your own mix. Béa sounds like the traits you turned up."}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(mixRef.current)}
            className="btn-primary w-full px-4"
          >
            Customize personality
          </button>
        </section>

        <section ref={mixRef} className="scroll-mt-4 space-y-3">
          <div>
            <h2 className="font-display text-[27px] leading-none">Set the mix</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Turn traits up or down. They don't need to add up — Béa works out the shares.
            </p>
          </div>
          <div className={`${PLAIN} space-y-3 p-4`}>
            {BEA_TRAITS.map((trait, i) => {
              const Glyph = TRAIT_ICON[trait];
              return (
                <label key={trait} className="block">
                  <span className="flex items-center gap-2.5">
                    <Glyph className={`seq-text-${(i % 5) + 1} size-5 shrink-0`} aria-hidden />
                    <span className="w-[5.9rem] shrink-0 text-[14px] font-semibold">
                      {TRAIT_INFO[trait].name}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={settings.mix[trait]}
                      onChange={(e) => setTrait(trait, Number(e.target.value))}
                      aria-label={`${TRAIT_INFO[trait].name}: ${TRAIT_INFO[trait].description}`}
                      className="h-5 min-w-0 flex-1 accent-primary"
                    />
                    <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">
                      {percents[trait]}%
                    </span>
                  </span>
                  <span className="mt-0.5 block pl-[1.875rem] text-[13px] leading-snug text-muted-foreground">
                    {TRAIT_INFO[trait].description}
                  </span>
                </label>
              );
            })}
            <p className="rounded-full bg-elevated py-2 text-center text-[14px] font-semibold tabular-nums">
              Total: {total}%
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  update({ mix: { ...BALANCED } });
                  setPicked(null);
                }}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
              >
                <RotateCcw className="size-4" aria-hidden />
                Reset to Balanced
              </button>
              <span className="text-[13px] text-muted-foreground">Saved as you go</span>
            </div>
          </div>
        </section>

        <section className="space-y-3" aria-live="polite">
          <div>
            <h2 className="font-display text-[27px] leading-none">Preview your Béa</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              How the mix sounds. Examples only.
            </p>
          </div>
          <div className={`${PLAIN} space-y-3.5 p-4`}>
            {lines.map(({ trait, line }, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <img
                  src="/bea/bea-think-static.png"
                  alt=""
                  aria-hidden
                  className="art-dim size-10 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="rounded-2xl rounded-tl-md border border-border/60 bg-elevated px-3.5 py-2.5 text-[14px] leading-snug">
                    {line}
                  </p>
                  <span
                    className={`tile-fill-${(i % 5) + 1} mt-1.5 inline-block rounded-full border border-border/60 px-2.5 py-0.5 text-[13px] font-semibold text-muted-foreground`}
                  >
                    {TRAIT_INFO[trait].name}
                  </span>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRound((r) => r + 1)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-[14px] font-semibold"
            >
              <RefreshCw className="size-4" aria-hidden />
              Generate new examples
            </button>
          </div>
        </section>

        <section ref={presetsRef} className="scroll-mt-4 space-y-3">
          <div>
            <h2 className="font-display text-[27px] leading-none">Choose a preset</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Start with a preset, then customize further if you'd like.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Presets"
            className={`${PLAIN} divide-y divide-border/60 px-3.5`}
          >
            {BEA_PRESETS.map((p, i) => {
              const on = choice === p;
              const Glyph = PRESET_ICON[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(p)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <Glyph className={`seq-text-${(i % 5) + 1} size-6 shrink-0`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">
                      {PRESET_INFO[p].name}
                      {preset === p && (
                        <span className="ml-2 text-[13px] font-semibold text-muted-foreground">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">
                      {PRESET_INFO[p].description}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                      on ? "border-primary" : "border-border"
                    }`}
                  >
                    {on && <span className="size-3 rounded-full bg-primary" />}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!choice || choice === preset}
            onClick={() => {
              if (!choice) return;
              update({ mix: { ...PRESET_INFO[choice].mix } });
              setPicked(null);
            }}
            className="btn-primary w-full px-4 disabled:opacity-50"
          >
            {choice && choice === preset ? `${PRESET_INFO[choice].name} is on` : "Apply preset"}
          </button>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-[27px] leading-none">Béa's quirks</h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground">Optional and occasional.</p>
          </div>
          <div className={`${PLAIN} divide-y divide-border/60 px-4`}>
            {(
              [
                [
                  "says",
                  "“Béa says” lines",
                  "Little asides on Companion, never facts or warnings.",
                ],
                ["surprises", "Rare surprises", "The ball, the bone, and her credentials."],
                [
                  "reactions",
                  "Reactions",
                  "A short line when something is done, or a find is notable.",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{label}</span>
                  <span className="block text-[13px] text-muted-foreground">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={settings[key]}
                  onChange={(e) => update({ [key]: e.target.checked })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative h-7 w-12 shrink-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-card after:shadow-sm after:transition-all peer-checked:after:left-6"
                />
              </label>
            ))}
          </div>
          <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
            Personality changes how Béa says things, never what is true: plans, recommendations,
            prices and directions are the same in every mix. Béa never uses emoji and never tailors
            jokes to a place or culture, and serious moments — payments, security, deleting and
            errors — are always said plainly.
          </p>
        </section>

        <section className="tile-card-4 flex items-start gap-3 p-4">
          <GraduationCap className="seq-text-5 mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-sans text-[16px] font-semibold">Béa's credentials</h2>
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
