import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * A 48px-tall touch target around a quiet 48x28 track. Off is edged in the
 * field-border colour (3:1) so the control reads without relying on the fill.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer relative inline-flex h-12 w-14 shrink-0 cursor-pointer items-center justify-center rounded-[var(--r-button)] bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <span
      aria-hidden
      className="absolute h-7 w-12 rounded-full border border-[var(--field-border)] bg-transparent transition-colors group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary"
    />
    <SwitchPrimitives.Thumb className="pointer-events-none absolute left-2 top-1/2 block h-5 w-5 -translate-y-1/2 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
