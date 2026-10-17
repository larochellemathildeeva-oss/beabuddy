import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/*
 * Béa's one button (docs/DESIGN_TOKENS.md). `primary` is the single filled
 * action on a screen; everything else is `secondary`, `ghost` or a ListRow.
 * `default`, `destructive`, `outline` and `link` are the older names, kept
 * for the screens that still use them.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-button)] text-[16px] font-semibold cursor-pointer transition-[background-color,border-color,color,opacity,box-shadow,scale] duration-(--t-shift) ease-(--ease-standard) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus) disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-action text-action-foreground hover:opacity-90 active:opacity-80",
        // Flat (buttons carry no shadow): a 3:1 edge on the card fill, which
        // steps to the raised fill on hover and press.
        secondary:
          "border border-[var(--field-border)] bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-2",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        danger: "bg-danger text-white hover:opacity-90",
        // Google's own sign-in button colours (its branding rules): the only
        // literal colours a variant may carry.
        google:
          "border border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f8f8f8] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3]",
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-[var(--field-border)] bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-[var(--link)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-4 py-2",
        lg: "h-(--h-lg) w-full px-5",
        md: "h-(--h-md) px-4",
        sm: "h-(--h-sm) px-3 text-small",
        icon: "size-(--tap) rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Why the button cannot be used yet. The button stays focusable and reads
   * as unavailable (`aria-disabled`); a tap calls `onBlocked` with the reason
   * instead of `onClick`, so the screen can say what is missing.
   */
  blockedReason?: string;
  onBlocked?: (reason: string) => void;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, blockedReason, onBlocked, onClick, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const blocked = Boolean(blockedReason);
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        aria-disabled={blocked || undefined}
        title={blocked ? blockedReason : props.title}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          if (blockedReason) {
            event.preventDefault();
            onBlocked?.(blockedReason);
            return;
          }
          onClick?.(event);
        }}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
