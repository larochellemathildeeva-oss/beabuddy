import type { ReactNode } from "react";
import { TooltipProvider } from "./ui/tooltip";
import { Toaster } from "./ui/sonner";

/**
 * Wraps an app with the providers Béa components need at runtime:
 * tooltips and toast notifications. Mount once near the root.
 */
export function BeaProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}

/**
 * Béa's typography is self-hosted now (DM Sans, imported by styles.css), so
 * there is nothing to link. Kept so existing imports and the library export
 * keep working.
 */
export function BeaFontLinks() {
  return null;
}
