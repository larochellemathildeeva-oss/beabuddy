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
 * The web-font <link> tags Béa's typography expects. Render inside the
 * document head (in TanStack Start, from a route `head()` links entry or the
 * root document) so Instrument Serif and Manrope load.
 */
export function BeaFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </>
  );
}
