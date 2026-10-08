import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { useAccessibility } from "@/hooks/useAccessibility";
import type { ReadingFont, TextSize } from "@/lib/accessibility";

const SIZES: { id: TextSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "default", label: "Normal" },
  { id: "large", label: "Large" },
  { id: "larger", label: "Larger" },
  { id: "largest", label: "Largest" },
];

const FONTS: { id: ReadingFont; label: string; hint: string; family: string }[] = [
  { id: "bea", label: "Béa", hint: "DM Sans", family: '"DM Sans Variable", sans-serif' },
  {
    id: "easy",
    label: "Easy to read",
    hint: "Atkinson Hyperlegible",
    family: '"Atkinson Hyperlegible Next", sans-serif',
  },
  { id: "lexend", label: "Lexend", hint: "Wider letters", family: '"Lexend", sans-serif' },
  { id: "system", label: "Your device's", hint: "No download", family: "system-ui, sans-serif" },
];

const TOGGLES: { id: "reduceMotion" | "moreContrast" | "boldText"; label: string; hint: string }[] =
  [
    { id: "reduceMotion", label: "Reduce motion", hint: "No sliding or fading" },
    { id: "moreContrast", label: "More contrast", hint: "Darker grey text and lines" },
    { id: "boldText", label: "Bolder text", hint: "Heavier letters, underlined links" },
  ];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="block text-[12px] text-muted-foreground">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Text size, font, motion, contrast and weight, for the whole app
 * (accessibility.ts). Each choice shows at once and is kept with the account.
 */
export function AccessibilityPicker() {
  const [value, choose] = useAccessibility();

  return (
    <div className="plain-card p-4">
      <p className="text-[14.5px] font-semibold">Reading</p>
      <p className="text-[12.5px] text-muted-foreground">Text size, font and motion.</p>

      <p className="mt-3 text-[13px] font-semibold">Text size</p>
      <div role="radiogroup" aria-label="Text size" className="mt-1.5 grid grid-cols-5 gap-1.5">
        {SIZES.map((s, i) => {
          const on = value.textSize === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={s.label}
              onClick={() => choose({ textSize: s.id })}
              className={`flex h-12 items-end justify-center rounded-2xl border pb-2 font-semibold transition-colors ${
                on ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
            >
              {/* A fixed-size sample, so the row stays the same as it grows. */}
              <span aria-hidden style={{ fontSize: `${13 + i * 3}px`, lineHeight: 1 }}>
                A
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {SIZES.find((s) => s.id === value.textSize)?.label}
      </p>

      <p className="mt-3 text-[13px] font-semibold">Font</p>
      <div role="radiogroup" aria-label="Font" className="mt-1.5 grid grid-cols-2 gap-2">
        {FONTS.map((f) => {
          const on = value.font === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose({ font: f.id })}
              className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                on ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
            >
              <span className="block text-[14px] font-semibold" style={{ fontFamily: f.family }}>
                {f.label}
              </span>
              <span className="block text-[12px] text-muted-foreground">{f.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 divide-y divide-border">
        {TOGGLES.map((t) => (
          <Toggle
            key={t.id}
            label={t.label}
            hint={t.hint}
            checked={value[t.id]}
            onChange={(on) => choose({ [t.id]: on })}
          />
        ))}
      </div>
    </div>
  );
}
