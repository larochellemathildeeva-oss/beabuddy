import { CustomizeModules, type CustomizeVariant } from "@/components/CustomizeModules";
import { HOME_SECTIONS, useHomeLayout, useHomeTripMoment } from "@/hooks/useHomeLayout";

export function CustomizeHome({
  variant = "icon",
  onArrange,
}: {
  variant?: CustomizeVariant;
  onArrange?: () => void;
}) {
  // Opened from You as well as Home: the switches show the same defaults.
  useHomeTripMoment();
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
