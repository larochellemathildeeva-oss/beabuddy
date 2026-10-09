import { Check } from "@/components/icons";
import { useStopPictures } from "@/hooks/useStopPictures";
import type { StopPictures } from "@/lib/stop-pictures";

const OPTIONS: { id: StopPictures; label: string; hint: string }[] = [
  { id: "illustrations", label: "Illustrations", hint: "Béa's painted pictures" },
  { id: "photos", label: "Real photos", hint: "From Pexels & Wikimedia" },
  { id: "none", label: "No pictures", hint: "More compact lists" },
];

/**
 * How stops and places are pictured. One choice for the whole app. With real
 * photos, a place neither Pexels nor Wikimedia Commons has a photo of keeps
 * its illustration.
 */
export function StopPicturesPicker({ variant = "cards" }: { variant?: "cards" | "rows" } = {}) {
  const [value, setValue] = useStopPictures();
  if (variant === "rows") {
    // The minimalist pages: one row a choice, a check on the one in use.
    return (
      <div role="radiogroup" aria-label="Stop pictures">
        {OPTIONS.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setValue(o.id)}
              className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-border py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[16px] leading-[22px]">{o.label}</span>
                <span className="mt-1 block text-[14px] leading-[20px] text-muted-foreground">
                  {o.hint}
                </span>
              </span>
              {on ? <Check className="size-5 shrink-0" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="plain-card p-4">
      <p className="text-[14.5px] font-semibold">Stop pictures</p>
      <p className="text-[12.5px] text-muted-foreground">How stops and places are shown.</p>
      <div role="radiogroup" aria-label="Stop pictures" className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setValue(o.id)}
              className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                on ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
            >
              <span className="block text-[14px] font-semibold">{o.label}</span>
              <span className="block text-[12px] text-muted-foreground">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {value === "photos" && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Photos are shared by their authors on Wikimedia Commons and shown with their credit.
          Places without one keep their illustration.
        </p>
      )}
    </div>
  );
}
