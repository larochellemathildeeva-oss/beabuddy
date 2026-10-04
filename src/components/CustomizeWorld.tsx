import { useState } from "react";
import { Plus, Settings2 } from "@/components/icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { WORLD_SECTIONS, useWorldLayout } from "@/hooks/useWorldLayout";

export function CustomizeWorld({ variant = "icon" }: { variant?: "icon" | "row" | "add" }) {
  const { layout, toggle, reset } = useWorldLayout();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "add" ? (
          <button
            type="button"
            data-guide="world-customize"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-border text-[16px] font-semibold text-muted-foreground transition-colors hover:bg-elevated"
          >
            <Plus className="size-5" aria-hidden /> Customize world
          </button>
        ) : variant === "row" ? (
          <button
            type="button"
            data-guide="world-customize"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-elevated"
          >
            <span>
              <span className="block text-[14.5px] font-medium">Customize world</span>
              <span className="block text-[12.5px] text-muted-foreground">
                Choose what sits under the globe on the Map view.
              </span>
            </span>
            <span className="shrink-0 rounded-xl border border-border px-3 py-2 text-[14.5px] font-semibold">
              Open
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Customize world"
            data-guide="world-customize"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Settings2 className="size-4" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Customize world</SheetTitle>
          <SheetDescription>
            Choose what sits under the globe on the Map view. Your choice follows you to every
            device you sign in on.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-2 divide-y divide-border">
          {WORLD_SECTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-[15px] font-medium">{s.label}</p>
                <p className="text-[13px] text-muted-foreground">{s.hint}</p>
              </div>
              <Switch
                checked={layout[s.key]}
                onCheckedChange={() => toggle(s.key)}
                aria-label={`Show ${s.label}`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-4 w-full rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold transition-colors hover:bg-elevated"
        >
          Reset to default
        </button>
      </SheetContent>
    </Sheet>
  );
}
