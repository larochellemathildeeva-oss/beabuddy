import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

const LEVEL = {
  page: { tag: "h1", className: "text-display font-bold tracking-(--tracking-tight)" },
  section: { tag: "h2", className: "text-title font-semibold" },
  card: { tag: "h3", className: "text-body font-semibold" },
} as const;

/*
 * The three heading sizes. `aside` holds a "See all"-style link, drawn in
 * the link colour.
 */
export function Heading({
  level,
  children,
  aside,
  className,
}: {
  level: keyof typeof LEVEL;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  const { tag: Tag, className: size } = LEVEL[level];
  const heading = <Tag className={cn(size, "text-ink", !aside && className)}>{children}</Tag>;
  if (!aside) return heading;
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      {heading}
      <div className="shrink-0 text-small font-semibold text-link">{aside}</div>
    </div>
  );
}
