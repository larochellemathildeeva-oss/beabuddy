import { useState } from "react";
import { Settings2 } from "@/components/icons";
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
        aria-label="View options"
        title="View options"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all active:scale-95 sm:px-3"
      >
        <Settings2 className="size-3.5 text-primary" aria-hidden />
        <span className="hidden sm:inline">View options</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="View options"
        hint="Choose what the trip page shows. Your choice follows you to every device you sign in on."
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

/**
 * The same switches, laid out inline for the trip menu: one bordered row a
 * switch, as Figma "trip-customize" (116:1667) draws them.
 */
export function CustomizeOptions({
  prefs,
  onToggle,
}: {
  prefs: TripViewPrefs;
  onToggle: (key: TripViewKey) => void;
}) {
  return (
    <div className="dir-group">
      {TRIP_VIEW_OPTIONS.map((option) => (
        <div key={option.key} className="dir-check items-center">
          <div className="min-w-0 flex-1">
            <p className="dir-row-title">{option.label}</p>
            <p className="dir-row-note">
              {prefs[option.key] ? "On" : "Off"} / {option.hint}
            </p>
          </div>
          <Switch
            checked={prefs[option.key]}
            onCheckedChange={() => onToggle(option.key)}
            aria-label={`Show ${option.label}`}
          />
        </div>
      ))}
    </div>
  );
}
