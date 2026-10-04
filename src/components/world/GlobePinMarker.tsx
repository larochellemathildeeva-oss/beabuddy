import { cn } from "@/lib/utils";

/**
 * A place's frosted tag on BeaGlobe — mockup.html's `.gtag` at 390px: a 26px
 * pill on a translucent card surface, the place's coloured drop inside on the
 * left, its tip on the place (the parent sits on the place). Selected adds an
 * accent ring and bold weight, so the state never rests on colour alone.
 */
export function PinTag({
  name,
  color,
  selected = false,
}: {
  name: string;
  color: string;
  selected?: boolean | undefined;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-[-9px] top-[-30px] flex h-[26px] items-center gap-[3px] whitespace-nowrap rounded-full pl-[2px] pr-[10px]",
        "text-[13px] leading-none text-(--foreground) backdrop-blur-[8px] [font-family:var(--font-sans)]",
        "bg-[color-mix(in_oklab,var(--card)_90%,transparent)] shadow-[0_3px_10px_rgb(20_40_60/0.18)]",
        selected ? "font-bold ring-2 ring-(--acc)" : "font-medium",
      )}
    >
      <svg width="16" height="19" viewBox="0 0 24 28" className="-mt-px shrink-0" aria-hidden>
        <path
          d="M12 27s9-8.5 9-15.5a9 9 0 0 0-18 0C3 18.5 12 27 12 27Z"
          fill={color}
          stroke="#fff"
          strokeWidth="2"
        />
        <circle cx="12" cy="11.5" r="3.4" fill="#fff" />
      </svg>
      {name}
    </span>
  );
}
