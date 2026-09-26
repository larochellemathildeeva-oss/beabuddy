# Components — shared UI primitives

Framework: React 19 + TanStack Start (file routing), Tailwind CSS v4 (tokens in `src/styles.css`, no tailwind.config), shadcn-style primitives on Radix, icons from `lucide-react`, `cn()` from `src/lib/utils.ts`. Mobile-first: app lives in a single centered column (max 520px phone / 680px md / 780px xl).

Custom utilities used everywhere (defined in styles.css): `card-soft`, `card-raised`, `surface`, `hairline`, `label-caps`, `btn-primary`, `chip-on`, `tab-tint`, `tab-ink`, `tab-rule`, `rise`, `plane-enter`.

### `src/components/ui/button.tsx`

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### `src/components/ui/sheet.tsx`

```tsx
"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
```

### `src/components/ui/alert-dialog.tsx`

```tsx
import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
```

### `src/components/ui/switch.tsx`

```tsx
import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
```

### `src/components/ui/sonner.tsx`

```tsx
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

### `src/components/ui/calendar.tsx`

```tsx
"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers["selected"] &&
        !modifiers["range_start"] &&
        !modifiers["range_end"] &&
        !modifiers["range_middle"]
      }
      data-range-start={modifiers["range_start"]}
      data-range-end={modifiers["range_end"]}
      data-range-middle={modifiers["range_middle"]}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
```

### `src/components/Sheet.tsx`

```tsx
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * The fifth primitive: anything that opens over the page.
 *
 * Six screens hand-rolled this — a fixed-inset scrim, a panel, a close button
 * — and they disagreed about every part of it. Three max-heights (85vh, 88vh,
 * 92dvh), two radii, three paddings, a close button that was an ✕ glyph on one
 * screen and an icon on another, and Escape and body-scroll-lock present on
 * some and missing on others. The last of those is not cosmetic: a sheet you
 * cannot dismiss with a key, over a page that scrolls underneath you, is a
 * different component to the one next to it.
 *
 * Not to be confused with `components/ui/sheet`, which is the vendored
 * side-drawer from the component library. This is Béa's own, and it is the one
 * app code should reach for.
 */
export function Sheet({
  open,
  onClose,
  title,
  hint,
  icon,
  actions,
  width = "md",
  showClose = true,
  above = false,
  children,
}: {
  open: boolean;
  /** Runs on the scrim, the close button and Escape alike. */
  onClose: () => void;
  title: string;
  /** One line under the title. Never a paragraph — that belongs in the body. */
  hint?: ReactNode;
  /** A mark before the title, for the planner's logo and its like. */
  icon?: ReactNode;
  /** Header actions, right of the title and left of the close button. */
  actions?: ReactNode;
  width?: "sm" | "md";
  /** Off only where the panel's own body carries the single way out. */
  showClose?: boolean;
  /**
   * For a sheet that opens on top of another one — a confirmation over the
   * settings panel that raised it. Portals stack in mount order, so this is
   * belt and braces rather than the only thing holding it up.
   */
  above?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 ${
        above ? "z-[60]" : "z-50"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`rise card-raised flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl ${
          width === "sm" ? "max-w-sm" : "max-w-md"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <p className="font-display text-[19px] leading-tight text-foreground">{title}</p>
            {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
```

### `src/components/ConfirmSheet.tsx`

```tsx
import { Sheet } from "@/components/Sheet";

/**
 * Asking before something irreversible happens.
 *
 * Béa's rule is undo, not confirmation: removing a timeline row takes it away
 * and offers it back for a few seconds, which is faster and kinder than a
 * dialog. But some things have no undo — deleting a trip, taking away
 * someone's access, walking out of a trip that is not yours — and those were
 * asking with the browser's native `confirm()`. A grey system box, in the
 * system's own words, on top of a warm cream app, with no way to name what
 * actually happens next.
 *
 * So: one sheet, the app's voice, and the consequence written out. The
 * confirm button carries the verb rather than saying "OK", because "OK" to a
 * question you half-read is how people delete things.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What will actually happen, in plain words. */
  body: string;
  /** The verb, not "OK" — "Delete", "Remove", "Leave". */
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} width="sm" showClose={false} above>
      <div className="text-center">
        <p className="text-[14.5px] text-muted-foreground">{body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-destructive px-3 py-2 text-[14.5px] font-semibold text-destructive-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
```

### `src/components/Section.tsx`

```tsx
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A named block of content, optionally collapsible.
 *
 * This began life inside trips, where every section drew its own header and
 * they drifted — the title was `label-caps` (11px, grey, uppercase) sitting
 * above 14.5px near-black body text, so the smallest, faintest thing in each
 * section was its name. They also nested a cream panel inside a cream panel
 * inside a cream card, which read as one undifferentiated blob.
 *
 * So: one cream surface per section, a title that outranks its own contents,
 * and rows separated by hairlines rather than by another box. That is not a
 * trip-specific idea, which is why it is no longer called TripSection — every
 * tab should group content the same way, and the fastest route to that is
 * making the shared component less work than a bespoke one.
 */
export function Section({
  title,
  hint,
  open,
  onToggle,
  defaultOpen,
  actions,
  guide,
  children,
}: {
  title: string;
  hint?: ReactNode;
  /**
   * Omit `onToggle` and `defaultOpen` for a section that is always open — no
   * chevron is drawn.
   */
  open?: boolean;
  onToggle?: () => void;
  /**
   * Collapsible, but minding its own state. For a page with a run of these
   * where the parent has no reason to know which are open — profile drew its
   * own component for exactly this, which is how it ended up with a second
   * section shape.
   */
  defaultOpen?: boolean;
  /** Header actions, right-aligned. Keep these to one or two compact buttons. */
  actions?: ReactNode;
  guide?: string;
  children?: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(Boolean(defaultOpen));
  const controlled = typeof onToggle === "function";
  const collapsible = controlled || defaultOpen !== undefined;
  const expanded = controlled ? Boolean(open) : collapsible ? ownOpen : true;
  const toggle = controlled ? onToggle : () => setOwnOpen((v) => !v);

  const heading = (
    <div className="min-w-0">
      <p className="font-display text-[16.5px] leading-tight text-foreground">{title}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <section
      {...(guide ? { "data-guide": guide } : {})}
      className="surface mb-3 border border-border/50 p-3.5"
    >
      {/* Actions drop below the title on a phone: side by side they squeezed
          "Where you're going" onto two lines. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            <ChevronDown
              className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-(--t-shift) ease-(--ease-standard) ${
                expanded ? "" : "-rotate-90"
              }`}
              aria-hidden
            />
            {heading}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {expanded && children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

/** A quiet header action. Two of these side by side, never a stack of them. */
export function SectionAction({
  onClick,
  children,
  guide,
  label,
  pressed,
  icon,
}: {
  onClick: () => void;
  children: ReactNode;
  guide?: string;
  label?: string;
  /** For an action that turns a mode on and stays on, like editing a list. */
  pressed?: boolean;
  /** Square, for an action whose meaning is carried by a glyph. */
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(guide ? { "data-guide": guide } : {})}
      {...(label ? { "aria-label": label } : {})}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className={`rounded-xl border text-[13px] font-semibold ${
        icon ? "tap-44 grid size-8 place-items-center" : "px-3 py-1.5"
      } ${
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
```

### `src/components/ContentCard.tsx`

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * The one card shape.
 *
 * Trips, saved places, cities and memories are different content with an
 * identical skeleton: optional media first, a title, at most two lines of
 * meta, an optional badge, optional actions last. Béa drew four versions of
 * that skeleton and they disagreed about spacing, type scale and where the
 * date went — which is most of why the tabs felt like separate apps.
 *
 * The order of the slots is fixed on purpose. A card whose actions sit above
 * its title is not a variant, it is a different card, and it belongs in its
 * own component rather than in another prop here.
 */
export function ContentCard({
  media,
  eyebrow,
  title,
  meta,
  badge,
  actions,
  to,
  params,
  onClick,
  guide,
  className = "",
}: {
  /** A banner or thumbnail. Always the first thing, never inset. */
  media?: ReactNode;
  /** A short kicker above the title — a kind, a country, a status dot. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** At most two lines. A third is a sign the card is doing a page's job. */
  meta?: (string | null | undefined)[];
  /** One short status — "in 2 months", "3 saved". Never a sentence. */
  badge?: ReactNode;
  actions?: ReactNode;
  /** Make the whole card a link. Mutually exclusive with `onClick`. */
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
  guide?: string;
  className?: string;
}) {
  const lines = (meta ?? []).filter((m): m is string => !!m && m.trim().length > 0).slice(0, 2);

  const body = (
    <>
      {media && <div className="overflow-hidden rounded-t-[inherit]">{media}</div>}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1.5 flex items-center gap-1.5">{eyebrow}</div>}
          <h3 className="font-display text-[19px] leading-tight">{title}</h3>
          {lines.map((line) => (
            <p key={line} className="mt-0.5 text-[13px] text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-4 py-2.5">
          {actions}
        </div>
      )}
    </>
  );

  // `card-soft` already supplies the surface, radius and lift, so the card
  // inherits the app's depth rather than inventing a fifth one.
  const shell = `card-soft block overflow-hidden text-left transition-transform duration-(--t-tap) ease-(--ease-standard) ${className}`;
  const attrs = guide ? { "data-guide": guide } : {};

  if (to) {
    return (
      <Link to={to} {...(params ? { params } : {})} {...attrs} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} {...attrs} className={`${shell} w-full`}>
        {body}
      </button>
    );
  }
  return (
    <div {...attrs} className={shell}>
      {body}
    </div>
  );
}
```

### `src/components/Skeletons.tsx`

```tsx
/**
 * Placeholders shaped like the thing that replaces them.
 *
 * A skeleton exists to stop the page jumping, so the only property that
 * matters is its size. A generic grey box that is the wrong height is worse
 * than no skeleton at all: it reserves space, then gives it back, and the
 * reader loses their place at exactly the moment the content they were
 * waiting for arrives.
 *
 * So every one of these copies the real component's dimensions — the banner's
 * 136px, the card's padding, the section's row height — rather than
 * approximating them.
 */

/** One grey block. `aria-hidden` throughout: this is furniture, not content. */
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-foreground/10 ${className}`} />;
}

/** Matches ContentCard: optional media, title, up to two meta lines. */
export function ContentCardSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      {media && <Bar className="h-[136px] w-full rounded-none" />}
      <div className="p-4">
        <Bar className="h-6 w-2/5" />
        <Bar className="mt-0.5 h-5 w-3/5" />
        <Bar className="mt-0.5 h-5 w-1/3" />
      </div>
    </div>
  );
}

/**
 * Matches the trip card in the list: the banner, then one line of summary.
 *
 * Note it is *not* the trip page's action row — that is a different card, and
 * borrowing its shape here made the placeholder 17px taller than the thing it
 * stood in for, which is exactly the jump a skeleton exists to prevent.
 */
export function TripCardSkeleton() {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      <Bar className="h-[136px] w-full rounded-none" />
      <div className="flex items-center gap-2 p-3">
        <Bar className="h-[19px] w-28" />
        <Bar className="ml-auto h-[19px] w-12" />
      </div>
    </div>
  );
}

/** A list of trip cards, for the Trips tab's first paint. */
export function TripListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches the trip page: banner, action row, then two sections of rows. */
export function TripDetailSkeleton() {
  return (
    <div className="card-soft overflow-hidden" aria-hidden>
      <Bar className="h-[136px] w-full rounded-none" />
      <div className="flex items-center gap-1 p-3">
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
        <Bar className="size-9 shrink-0 rounded-full" />
      </div>
      <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
        {[0, 1].map((section) => (
          <div key={section} className="surface border border-border/50 p-3.5">
            <Bar className="h-[16.5px] w-1/3" />
            <div className="mt-3 space-y-2">
              <Bar className="h-[14.5px] w-full" />
              <Bar className="h-[14.5px] w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A row-shaped placeholder for lists of saved places and nearby pins. */
export function RowListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-soft p-3.5">
          <Bar className="h-[23px] w-1/2" />
          <Bar className="h-5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
```

### `src/components/TripCard.tsx`

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { TripBanner } from "@/components/TripBanner";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { pickTripPhoto } from "@/lib/trip-card";
import { beaTripNote } from "@/lib/trip-note";
import { timeForRail } from "@/lib/timeline-kind";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";
import { toLocalISODate } from "@/lib/trip-dates";
import { dueLine } from "@/lib/trip-glance";
import { currentLeg, isPastTrip } from "@/lib/home-trip";
import { liveSummary } from "@/lib/companion";

/** "Sep 7": the day a flight leaves, when it has one. */
function flightDay(day: string | null): string {
  if (!day) return "";
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** The trip's own description, first line only, or Béa's line about it. */
function quoteFor(trip: TripRow, stopCount: number, planned: number | null): string {
  const own = (trip.notes ?? "").split("\n")[0]?.trim();
  if (own) return own.length > 140 ? `${own.slice(0, 139)}…` : own;
  return (
    beaTripNote(
      { startDate: trip.start_date, endDate: trip.end_date, stopCount, plannedCount: planned },
      toLocalISODate(new Date()),
    ) ?? ""
  );
}

function Fact({
  label,
  aside,
  title,
  note,
  children,
}: {
  label: string;
  aside?: string;
  title?: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {aside ? (
          <span className="font-mono tracking-normal text-foreground/80">{aside}</span>
        ) : null}
      </p>
      {title ? (
        <p className="mt-1 truncate text-[14.5px] font-semibold leading-snug">{title}</p>
      ) : null}
      {children}
      {note ? <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/**
 * A trip in the list: its picture, then the three things you check before
 * you go — how you get there, where you sleep, how packed you are — and a
 * way into the itinerary.
 *
 * The banner carries the same `view-transition-name` as the one on the trip's
 * own page, so tapping it hands the picture to the destination rather than
 * cutting. On a browser without same-document transitions this degrades to
 * the ordinary navigation.
 */
export function TripCard({
  trip,
  photos,
  glance,
  peopleCount,
  detail = true,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  glance: TripGlance | undefined;
  peopleCount: number;
  /** False on Home's later trips: the banner and nothing under it. */
  detail?: boolean;
}) {
  const cities = useTripStops(trip.id, null);
  const cityNames = cities.stops.map((stop) => stop.city);
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cityNames,
  });
  const stopCount = glance?.stops ?? 0;

  const today = toLocalISODate(new Date());
  // Several cities: the one that matters today, with its own flight and stay.
  const leg = glance ? currentLeg(cities.stops, glance.items, today) : null;
  // On a day of the trip: the live tracker's progress, one tap from the card.
  const live = glance ? liveSummary(glance.items, today) : null;
  // Before the trip starts, a missing flight is worth a nudge; after, it is not.
  const notStarted = !isPastTrip(trip, today) && !(trip.start_date && trip.start_date <= today);
  const flight = leg ? leg.flight : glance?.flight;
  const lodging = leg ? leg.lodging : glance?.lodging;
  const packing = glance?.packing;
  const first = glance?.firstStop;
  const todo = glance?.todos.next;
  const openTodos = glance?.todos.open ?? 0;
  const quote = quoteFor(trip, cities.stops.length, glance ? glance.items.length : null);

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <TripBanner
        title={trip.title}
        city={trip.city}
        country={trip.country}
        cities={cityNames}
        startDate={trip.start_date}
        endDate={trip.end_date}
        tentative={trip.dates_status === "tentative"}
        photo={banner}
        stopCount={stopCount}
        peopleCount={peopleCount}
        viewTransitionName={`trip-photo-${trip.id}`}
      />
      {detail ? (
        <div className="px-4 pb-3.5 pt-3.5">
          {leg ? (
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
              {leg.label} · <span className="normal-case tracking-normal">{leg.city}</span>
            </p>
          ) : null}
          {live ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[13.5px]">
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              <span className="shrink-0 font-semibold text-primary">
                Live · Stop {live.step} of {live.total}
              </span>
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{live.label}: </span>
                {live.title}
              </span>
            </div>
          ) : null}
          {flight || lodging || packing || first || todo ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-x-5 gap-y-3.5">
              {flight ? (
                <Fact
                  label={notStarted ? "First flight" : "Next flight"}
                  title={[flight.title, timeForRail(flight.time_label)].filter(Boolean).join(" · ")}
                  note={
                    [flightDay(flight.day_date), stripEmbeddedMapsUrl(flight.detail)]
                      .filter(Boolean)
                      .join(" · ") ||
                    flight.address ||
                    ""
                  }
                />
              ) : notStarted && !leg ? (
                <Fact label="First flight" title="None saved yet" note="Add it to the itinerary" />
              ) : null}
              {lodging ? (
                <Fact
                  label="Stay"
                  title={lodging.title}
                  note={stripEmbeddedMapsUrl(lodging.detail) || lodging.address || ""}
                />
              ) : null}
              {packing ? (
                <Fact label="Packing" aside={`${packing.packed}/${packing.total}`}>
                  <div
                    role="progressbar"
                    aria-label="Packed"
                    aria-valuemin={0}
                    aria-valuemax={packing.total}
                    aria-valuenow={packing.packed}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated"
                  >
                    <div
                      className="h-full rounded-full bg-[#b89b78]"
                      style={{ width: `${Math.round(packing.ratio * 100)}%` }}
                    />
                  </div>
                </Fact>
              ) : first ? (
                <Fact label="First stop" title={first.title} note={first.day_date ?? ""} />
              ) : null}
              {todo ? (
                <Fact
                  label="To do"
                  aside={openTodos > 1 ? `${openTodos} open` : ""}
                  title={todo.title}
                  note={dueLine(todo.due_on) || (openTodos > 1 ? `and ${openTodos - 1} more` : "")}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">
              {cities.stops.length
                ? `${cities.stops.length} ${cities.stops.length === 1 ? "place" : "places"} so far. Nothing on the timeline yet.`
                : "Open it to start planning."}
            </p>
          )}

          <div className="mt-3.5 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:gap-3">
            {quote ? (
              <p className="line-clamp-2 min-w-0 flex-1 font-display text-[16px] italic leading-snug text-muted-foreground sm:line-clamp-1">
                “{quote}”
              </p>
            ) : null}
            <span className="flex shrink-0 items-center gap-1.5 self-end text-[14px] font-semibold sm:ml-auto sm:self-auto">
              View itinerary
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
```

### `src/components/HomeTripCard.tsx`

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, ChevronRight, Ticket } from "lucide-react";
import { TripBanner } from "@/components/TripBanner";
import { TripCard } from "@/components/TripCard";
import type { TripRow, MemberRow } from "@/hooks/useTrips";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { useTripTodos } from "@/hooks/useTripTodos";
import { laterHeading, peopleOnTrip } from "@/lib/home-trip";
import { pickTripPhoto } from "@/lib/trip-card";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { dueLine, nextOnPlan, nextTodo } from "@/lib/trip-glance";

function todayIso() {
  return toLocalISODate(new Date());
}

/** A serif heading with one quiet link beside it, as on Home. */
export function HomeSectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
      {aside ? <div className="shrink-0 text-[14px] text-primary">{aside}</div> : null}
    </div>
  );
}

/** What the hero says under the title: how booked, else how packed, else how planned. */
function readiness(glance: TripGlance | undefined): { label: string; line: string } {
  if (glance?.plans) {
    const { confirmed, total } = glance.plans;
    return {
      label: confirmed === total ? "Ready to go" : "Getting ready",
      line: `${confirmed} of ${total} ${total === 1 ? "plan" : "plans"} confirmed`,
    };
  }
  if (glance?.packing) {
    return {
      label: "Packing",
      line: `${glance.packing.packed} of ${glance.packing.total} packed`,
    };
  }
  const n = glance?.stops ?? 0;
  if (n > 0) return { label: "The plan", line: `${n} ${n === 1 ? "stop" : "stops"} planned` };
  return { label: "Just started", line: "Nothing planned yet" };
}

/**
 * Home's current trip, as a picture: your own photo of the place (or a
 * painted dusk), how soon, who is coming, and how ready it is.
 */
export function HomeTripHero({
  trip,
  glance,
  photos,
  peopleCount,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  photos: TripPhotoRow[];
  peopleCount: number;
}) {
  const stops = useTripStops(trip.id, null);
  const cities = stops.stops.map((s) => s.city);
  const photo = pickTripPhoto(photos, { city: trip.city, country: trip.country, cities });
  const ready = readiness(glance);

  return (
    <section data-guide="home-trip" className="rise">
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        className="group block rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <TripBanner
          variant="hero"
          title={trip.title}
          city={trip.city}
          country={trip.country}
          cities={cities}
          startDate={trip.start_date}
          endDate={trip.end_date}
          tentative={trip.dates_status === "tentative"}
          photo={photo}
          peopleCount={peopleCount}
          viewTransitionName={`trip-photo-${trip.id}`}
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-semibold leading-snug">
                <span className="sr-only">{ready.label}: </span>
                {ready.line}
              </p>
              <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold">
                View itinerary
                <ArrowUpRight
                  className="size-4.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </div>
          }
        />
      </Link>
    </section>
  );
}

/**
 * "Next up": the one to-do worth doing today, or, with none, the next thing
 * on the plan. Hidden when there is neither.
 */
export function HomeNextUp({
  trip,
  glance,
  uid,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  uid: string | null;
}) {
  const { todos } = useTripTodos(trip.id, uid);
  const open = todos.filter((t) => !t.done);
  const todo = nextTodo(todos);
  const planned = todo ? null : nextOnPlan(glance?.items ?? [], todayIso());

  if (!todo && !planned) return null;

  const eyebrow = todo ? "One thing for today" : "Next on the plan";
  const title = todo ? todo.title : planned!.title;
  const note = todo
    ? dueLine(todo.due_on) || todo.notes || trip.title
    : [
        planned!.day_date
          ? new Date(`${planned!.day_date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : "",
        timeForRail(planned!.time_label),
      ]
        .filter(Boolean)
        .join(" · ");
  const Icon = todo ? Ticket : CalendarClock;

  return (
    <section data-guide="home-next" className="rise">
      <HomeSectionTitle
        title="Next up"
        aside={
          open.length > 0 ? `${open.length} ${open.length === 1 ? "task" : "tasks"}` : undefined
        }
      />
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
      >
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-nexttime/15 text-nexttime"
        >
          <Icon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[17px] font-medium leading-snug">
            {title}
          </span>
          {note ? (
            <span className="block truncate text-[13.5px] text-muted-foreground">{note}</span>
          ) : null}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}

/**
 * Trips that ended in the last year, at the foot of Home: one thin bar each,
 * so they are there to revisit without taking the page from what is next.
 */
export function HomePastTrips({ trips, photos }: { trips: TripRow[]; photos: TripPhotoRow[] }) {
  if (trips.length === 0) return null;
  return (
    <section data-guide="home-past" className="rise">
      <HomeSectionTitle title="Past trips" aside={<Link to="/trips">All trips</Link>} />
      <div className="space-y-2">
        {trips.map((t) => (
          <Link
            key={t.id}
            to="/trips/$tripId"
            params={{ tripId: t.id }}
            viewTransition
            className="block overflow-hidden rounded-2xl shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TripBanner
              variant="compact"
              title={t.title}
              city={t.city}
              country={t.country}
              cities={[]}
              startDate={t.start_date}
              endDate={t.end_date}
              photo={pickTripPhoto(photos, { city: t.city, country: t.country, cities: [] })}
              viewTransitionName={`trip-photo-${t.id}`}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The trips after the current one, as banners, each one tap from its page. */
export function HomeLaterTrips({
  trips,
  photos,
  glances,
  members,
  uid,
}: {
  trips: TripRow[];
  photos: TripPhotoRow[];
  glances: Record<string, TripGlance>;
  members: MemberRow[];
  uid: string | null;
}) {
  if (trips.length === 0) return null;
  return (
    <section className="rise">
      <HomeSectionTitle
        title={laterHeading(trips.map((t) => t.start_date))}
        aside={<Link to="/trips">All trips</Link>}
      />
      <div className="space-y-3">
        {trips.map((t) => (
          <TripCard
            key={t.id}
            trip={t}
            photos={photos}
            glance={glances[t.id]}
            peopleCount={peopleOnTrip(members, t.id, uid)}
            detail={false}
          />
        ))}
      </div>
    </section>
  );
}
```

### `src/components/DaySelector.tsx`

```tsx
import { ALL_DAYS, type DayChip, type DayChoice } from "@/lib/trip-days";

/**
 * Which day of the trip is on screen.
 *
 * A horizontal strip rather than a dropdown: the days of a trip are few, and
 * seeing how many there are — and how loaded each one is — is half of what
 * this answers. A select box would hide both behind a tap.
 *
 * "All days" leads, because it is where the screen has always started and
 * where a plan still being written belongs. The numbered days follow in
 * order, and the undated pile sits last with no number, the same way the
 * timeline groups it.
 */
export function DaySelector({
  chips,
  value,
  onChange,
}: {
  chips: DayChip[];
  value: DayChoice;
  onChange: (next: DayChoice) => void;
}) {
  const total = chips.reduce((sum, chip) => sum + chip.count, 0);

  return (
    <div
      role="tablist"
      aria-label="Which day to show"
      // -mx-1/px-1 so the focus ring on the first and last chip is not
      // clipped by the scroll container.
      className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 sm:gap-2"
    >
      <DayTab
        selected={value === ALL_DAYS}
        onSelect={() => onChange(ALL_DAYS)}
        ordinal="Whole trip"
        label={`${chips.length} ${chips.length === 1 ? "day" : "days"}`}
        count={total}
      />
      {chips.map((chip) => (
        <DayTab
          key={chip.key || "undated"}
          selected={value === chip.key}
          onSelect={() => onChange(chip.key)}
          // The undated pile is no day in particular, so its label carries
          // the whole meaning and the eyebrow says so rather than sitting
          // empty.
          ordinal={chip.ordinal || "Undated"}
          label={chip.label}
          count={chip.count}
          isToday={chip.isToday}
        />
      ))}
    </div>
  );
}

function DayTab({
  selected,
  onSelect,
  ordinal,
  label,
  count,
  isToday = false,
}: {
  selected: boolean;
  onSelect: () => void;
  ordinal: string;
  label: string;
  count: number;
  isToday?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      // The prototype's day card: charcoal when chosen, white otherwise.
      // Sizes from the prototype's DaySelector: 40px tall on a phone, 46 wider.
      className={`flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-left shadow-2xs transition-all sm:min-h-[46px] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2 ${
        selected
          ? "scale-[1.01] border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground"
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${
            selected ? "text-[oklch(0.78_0.1_45)]" : "text-muted-foreground"
          }`}
        >
          {ordinal}
          {/* Spoken as part of the tab, so a screen reader reaching today
              hears it without needing the colour. */}
          {isToday && <span className="ml-1">· Today</span>}
        </span>
        <span className="block whitespace-nowrap text-xs font-semibold tracking-tight">
          {label}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold sm:rounded-lg sm:px-2 sm:text-[10px] ${
          selected ? "bg-background/15 text-background/85" : "bg-elevated text-muted-foreground"
        }`}
      >
        {count} {count === 1 ? "stop" : "stops"}
      </span>
    </button>
  );
}
```

### `src/components/DateRangeField.tsx`

```tsx
import { useEffect, useId, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  formatDateRangeLabel,
  parseLocalDate,
  toLocalISODate,
  type DatesStatus,
} from "@/lib/trip-dates";
import { rangeTap } from "@/lib/trip-cities";

export function DateRangeField({
  start,
  end,
  onChange,
  datesStatus,
  onDatesStatusChange,
  placeholder = "Dates",
  title = "Trip dates",
  month,
  className = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[15px]",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  datesStatus?: DatesStatus;
  onDatesStatusChange?: (status: DatesStatus) => void;
  placeholder?: string;
  /** The calendar's heading. */
  title?: string;
  /** The month to open on when nothing is picked yet, as YYYY-MM-DD. */
  month?: string | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /**
   * The start of a range still waiting for its end. The calendar stays open
   * until the second tap: react-day-picker reports the first tap as a whole
   * one-day range, which used to close it before the end could be picked.
   */
  const [pending, setPending] = useState<string | null>(null);
  const openPicker = () => {
    setPending(null);
    setOpen(true);
  };
  // Closed after one tap: a one-day range rather than a start with no end.
  const close = () => {
    if (pending) onChange(pending, pending);
    setPending(null);
    setOpen(false);
  };
  const titleId = useId();
  const label = formatDateRangeLabel(start, end);
  const selected: DateRange = {
    from: start ? parseLocalDate(start) : undefined,
    to: end ? parseLocalDate(end) : undefined,
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${className} flex items-center gap-2`}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={label ? "text-foreground" : "text-muted-foreground"}>
          {label || placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={close}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-4 sm:rounded-2xl"
          >
            <p id={titleId} className="px-1 font-display text-[19px] leading-snug">
              {title}
            </p>
            <p className="mb-2 px-1 text-[13px] text-muted-foreground">
              {pending ? "Now tap the last day." : "Tap the first day, then the last."}
            </p>
            <Calendar
              mode="range"
              selected={pending ? { from: parseLocalDate(pending), to: undefined } : selected}
              defaultMonth={
                selected.from ?? (month ? parseLocalDate(month) : undefined) ?? new Date()
              }
              numberOfMonths={1}
              onSelect={(_range, day) => {
                const tap = rangeTap(pending, toLocalISODate(day));
                onChange(tap.start, tap.end);
                if (tap.done) {
                  setPending(null);
                  setOpen(false);
                } else {
                  setPending(tap.start);
                }
              }}
              className="mx-auto rounded-xl"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange("", "");
                  setPending(null);
                  setOpen(false);
                }}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-xl bg-primary px-3 py-2 text-[14.5px] font-semibold text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {datesStatus && onDatesStatusChange && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["tentative", "Tentative dates"],
              ["confirmed", "Confirmed dates"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onDatesStatusChange(value)}
              className={`rounded-full border px-3 py-1.5 text-[13px] ${
                datesStatus === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

