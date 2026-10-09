import type { TripRow } from "@/hooks/useTrips";
import { CustomizeModules, type CustomizeVariant } from "@/components/CustomizeModules";
import { HOME_SECTIONS, useHomeLayout, useHomeTripMoment } from "@/hooks/useHomeLayout";

export function CustomizeHome({
  variant = "icon",
  onArrange,
  trips,
}: {
  variant?: CustomizeVariant;
  onArrange?: () => void;
  /** The screen's trips, so the switches show the same defaults as Home. */
  trips?: { uid: string | null; loading: boolean; trips: TripRow[] };
}) {
  useHomeTripMoment(trips);
  const { modules, fixed, toggle, move, reset } = useHomeLayout();
  return (
    <CustomizeModules
      {...(onArrange ? { onArrange } : {})}
      name="home"
      what="on Home"
      guide="home-customize"
      modules={HOME_SECTIONS}
      layout={modules}
      fixed={fixed}
      onToggle={toggle}
      onMove={move}
      onReset={reset}
      variant={variant}
    />
  );
}
