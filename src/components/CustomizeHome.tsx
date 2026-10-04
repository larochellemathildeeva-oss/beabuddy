import { CustomizeModules, type CustomizeVariant } from "@/components/CustomizeModules";
import { HOME_SECTIONS, useHomeLayout } from "@/hooks/useHomeLayout";

export function CustomizeHome({ variant = "icon" }: { variant?: CustomizeVariant }) {
  const { modules, fixed, toggle, move, reset } = useHomeLayout();
  return (
    <CustomizeModules
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
