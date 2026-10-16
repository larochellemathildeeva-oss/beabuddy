import * as ToggleGroup from "@radix-ui/react-toggle-group";

import { cn } from "../../lib/utils";

/*
 * Switches between views of the same thing (Map / Now, Saved / Nearby).
 * Never for actions: a row of things to do is an ActionBar.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix clears the value when the chosen item is tapped again; a view switch always has one.
        if (next) onChange(next as T);
      }}
      aria-label={label}
      className={cn("inline-flex items-center rounded-full bg-surface-2 p-1", className)}
    >
      {options.map(([id, text]) => (
        <ToggleGroup.Item
          key={id}
          value={id}
          className="h-(--h-sm) cursor-pointer rounded-full px-3 text-small font-semibold text-ink-muted transition-colors data-[state=on]:bg-surface-1 data-[state=on]:text-ink data-[state=on]:shadow-sm"
        >
          {text}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
