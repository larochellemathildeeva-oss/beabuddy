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
 * Béa's typefaces are served from her own build (`public/fonts`, DejaVu Serif
 * and DejaVu Sans, subset to Latin): no third-party font request. The two
 * faces every first screen shows are preloaded; the rest load on use.
 */
export function BeaFontLinks() {
  return (
    <>
      <link
        rel="preload"
        href="/fonts/DejaVuSerif-Bold.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/fonts/DejaVuSans.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
    </>
  );
}
