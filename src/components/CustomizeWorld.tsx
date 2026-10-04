import { CustomizeModules, type CustomizeVariant } from "@/components/CustomizeModules";
import { WORLD_SECTIONS, useWorldLayout } from "@/hooks/useWorldLayout";

export function CustomizeWorld({ variant = "icon" }: { variant?: CustomizeVariant }) {
  const { modules, toggle, move, reset } = useWorldLayout();
  return (
    <CustomizeModules
      name="world"
      what="under the globe on the Map view"
      guide="world-customize"
      modules={WORLD_SECTIONS}
      layout={modules}
      onToggle={toggle}
      onMove={move}
      onReset={reset}
      variant={variant}
    />
  );
}
