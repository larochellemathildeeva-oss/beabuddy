import { Check } from "@/components/icons";
import { useTripBanner } from "@/hooks/useTripBanner";
import type { TripBanner } from "@/lib/trip-banner";

const OPTIONS: { id: TripBanner; label: string; hint: string }[] = [
  { id: "mine", label: "My photos", hint: "Yours from the trip, one after another" },
  { id: "stock", label: "Stock photos", hint: "A photo of the place" },
  { id: "illustration", label: "Illustration", hint: "Béa's painted picture" },
  { id: "compact", label: "Compact", hint: "Small picture, buttons" },
];

/** How the banner at the top of a trip looks. On this device. */
export function TripBannerPicker({ variant = "cards" }: { variant?: "cards" | "rows" } = {}) {
  const [value, setValue] = useTripBanner();
  if (variant === "rows") {
    // The minimalist pages: one row a choice, a check on the one in use.
    return (
      <div role="radiogroup" aria-label="Trip banner">
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
      <p className="text-[14.5px] font-semibold">Trip banner</p>
      <p className="text-[12.5px] text-muted-foreground">
        The picture at the top of a trip. A trip with no photos of yours shows stock photos.
      </p>
      <div role="radiogroup" aria-label="Trip banner" className="mt-3 grid grid-cols-2 gap-2">
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
    </div>
  );
}
