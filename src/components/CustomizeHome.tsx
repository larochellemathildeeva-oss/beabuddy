import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { HOME_SECTIONS, useHomeLayout } from "@/hooks/useHomeLayout";

export function CustomizeHome({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const { layout, toggle, reset } = useHomeLayout();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "row" ? (
          <button
            type="button"
            data-guide="home-customize"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-elevated"
          >
            <span>
              <span className="block text-[13px] font-medium">Customize home</span>
              <span className="block text-[11.5px] text-muted-foreground">
                Choose which sections appear on your Home screen.
              </span>
            </span>
            <span className="shrink-0 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold">
              Open
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Customize home"
            data-guide="home-customize"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Settings2 className="size-4" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Customize home</SheetTitle>
          <SheetDescription>
            Choose which sections appear on your Home screen. Your choice is saved on this
            device.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-2 divide-y divide-border">
          {HOME_SECTIONS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-[14px] font-medium">{s.label}</p>
                <p className="text-[12px] text-muted-foreground">{s.hint}</p>
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
          className="mt-4 w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold transition-colors hover:bg-elevated"
        >
          Reset to default
        </button>
      </SheetContent>
    </Sheet>
  );
}
