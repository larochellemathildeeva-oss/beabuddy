import { useTripBanner } from "@/hooks/useTripBanner";
import type { TripBanner } from "@/lib/trip-banner";

const OPTIONS: { id: TripBanner; label: string; hint: string }[] = [
  { id: "mine", label: "My photos", hint: "Yours from the trip, one after another" },
  { id: "stock", label: "Stock photos", hint: "A photo of the place" },
  { id: "illustration", label: "Illustration", hint: "Béa's painted picture" },
  { id: "compact", label: "Compact", hint: "Small picture, buttons" },
];

/** How the banner at the top of a trip looks. On this device. */
export function TripBannerPicker() {
  const [value, setValue] = useTripBanner();
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
