import { useStopPictures } from "@/hooks/useStopPictures";
import type { StopPictures } from "@/lib/stop-pictures";

const OPTIONS: { id: StopPictures; label: string; hint: string }[] = [
  { id: "illustrations", label: "Illustrations", hint: "Béa's painted pictures" },
  { id: "none", label: "No pictures", hint: "More compact lists" },
];

/**
 * How stops and places are pictured. One choice for the whole app, never
 * mixed. Real photos join the list once each stop keeps its own photo.
 */
export function StopPicturesPicker() {
  const [value, setValue] = useStopPictures();
  return (
    <div className="plain-card p-4">
      <p className="text-[14.5px] font-semibold">Stop pictures</p>
      <p className="text-[12.5px] text-muted-foreground">How stops and places are shown.</p>
      <div role="radiogroup" aria-label="Stop pictures" className="mt-3 grid grid-cols-2 gap-2">
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
