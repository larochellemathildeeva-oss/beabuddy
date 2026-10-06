import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  Plus,
  Settings2,
} from "@/components/icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ModuleInfo } from "@/hooks/moduleStore";
import type { ModuleLayout } from "@/lib/module-layout";
import { bannerArtUrl } from "@/lib/banner-art";

export type CustomizeVariant = "icon" | "row" | "list" | "add" | "card" | "chip";

/**
 * A screen's "Customize" sheet, as in the mockups: every module the screen
 * can show, each with a switch, and the ones on moved up or down to set the
 * order. "+ Add modules" and the "Customize home" card open the same sheet.
 */
export function CustomizeModules<K extends string>({
  name,
  what,
  guide,
  modules,
  layout,
  onToggle,
  onMove,
  onReset,
  variant,
  fixed,
}: {
  /** "home" or "world": the sheet is "Customize home". */
  name: string;
  /** Where the modules sit, for the sheet's description. */
  what: string;
  guide: string;
  modules: readonly ModuleInfo<K>[];
  layout: ModuleLayout<K>;
  onToggle: (key: K) => void;
  onMove: (key: K, step: -1 | 1) => void;
  onReset: () => void;
  variant: CustomizeVariant;
  /** Modules that keep their place: no arrows, and the others move past them. */
  fixed?: ReadonlySet<K>;
}) {
  const [open, setOpen] = useState(false);
  const title = `Customize ${name}`;
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const shown = layout.order.filter((k) => layout.on.has(k));
  const off = layout.order.filter((k) => !layout.on.has(k));
  const movable = shown.filter((k) => !fixed?.has(k));

  const trigger: ReactNode =
    variant === "add" ? (
      <button
        type="button"
        data-guide={guide}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-border text-[16px] font-semibold text-muted-foreground transition-colors hover:bg-elevated"
      >
        <Plus className="size-5" aria-hidden /> {title}
      </button>
    ) : variant === "chip" ? (
      <button
        type="button"
        data-guide={guide}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13.5px] font-semibold shadow-sm transition-colors hover:bg-elevated"
      >
        <Plus className="size-4" aria-hidden /> Add modules
      </button>
    ) : variant === "card" ? (
      // A quiet link at the foot of the page, not a banner.
      <button
        type="button"
        data-guide={guide}
        className="mx-auto flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <LayoutGrid className="size-4" aria-hidden /> {title}
      </button>
    ) : variant === "list" ? (
      // A row in You's grouped lists: pastel bubble, title, one line, chevron.
      <button
        type="button"
        data-guide={guide}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-tile-5">
          <LayoutGrid className="size-5 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] leading-tight">{title}</span>
          <span className="block text-[14px] leading-snug text-muted-foreground">
            Choose and reorder modules
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    ) : variant === "row" ? (
      <button
        type="button"
        data-guide={guide}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-elevated"
      >
        <span>
          <span className="block text-[14.5px] font-medium">{title}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            Choose and reorder what sits {what}.
          </span>
        </span>
        <span className="shrink-0 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold">
          Open
        </span>
      </button>
    ) : (
      <button
        type="button"
        aria-label={title}
        data-guide={guide}
        className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
      >
        <Settings2 className="size-4" />
      </button>
    );

  const row = (key: K) => {
    const info = byKey.get(key);
    if (!info) return null;
    const on = layout.on.has(key);
    const index = movable.indexOf(key);
    return (
      <li key={key} className="flex items-center gap-2 py-2">
        {on && index >= 0 && (
          <span className="flex shrink-0">
            <button
              type="button"
              aria-label={`Move ${info.label} up`}
              disabled={index === 0}
              onClick={() => onMove(key, -1)}
              className="grid size-11 place-items-center rounded-s-xl border border-border text-muted-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${info.label} down`}
              disabled={index === movable.length - 1}
              onClick={() => onMove(key, 1)}
              className="grid size-11 place-items-center rounded-e-xl border border-s-0 border-border text-muted-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{info.label}</p>
          <p className="text-[13px] leading-snug text-muted-foreground">{info.hint}</p>
        </div>
        <Switch
          // The switch is drawn small; its tap area reaches 44 px around it.
          className="relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']"
          checked={on}
          onCheckedChange={() => onToggle(key)}
          aria-label={`Show ${info.label}`}
        />
      </li>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Choose the modules {what} and put them in your order. Your choice follows you to every
            device you sign in on.
          </SheetDescription>
        </SheetHeader>
        <p className="label-caps mt-3">On {name}</p>
        {shown.length ? (
          <ul className="divide-y divide-border">{shown.map((k) => row(k))}</ul>
        ) : (
          <p className="py-3 text-[14px] text-muted-foreground">Nothing yet. Add a module below.</p>
        )}
        {off.length > 0 && (
          <>
            <p className="label-caps mt-4">More modules</p>
            <ul className="divide-y divide-border">{off.map((k) => row(k))}</ul>
          </>
        )}
        <button
          type="button"
          onClick={onReset}
          className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-elevated"
        >
          Reset to default
        </button>
      </SheetContent>
    </Sheet>
  );
}
