import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { Switch } from "@/components/ui/switch";
import { TRIP_VIEW_OPTIONS, type TripViewKey, type TripViewPrefs } from "@/hooks/useTripViewPrefs";

/** The trip page's three display switches, behind one button beside the tabs. */
export function CustomizeTrip({
  prefs,
  onToggle,
}: {
  prefs: TripViewPrefs;
  onToggle: (key: TripViewKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Customize the trip page"
        title="Customize"
        onClick={() => setOpen(true)}
        className="grid min-h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground"
      >
        <Settings2 className="size-4" aria-hidden />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Customize"
        hint="Choose what the trip page shows. Your choice is saved on this device."
        width="sm"
      >
        <div className="divide-y divide-border">
          {TRIP_VIEW_OPTIONS.map((option) => (
            <div key={option.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-[15px] font-medium">{option.label}</p>
                <p className="text-[13px] text-muted-foreground">{option.hint}</p>
              </div>
              <Switch
                checked={prefs[option.key]}
                onCheckedChange={() => onToggle(option.key)}
                aria-label={`Show ${option.label}`}
              />
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
