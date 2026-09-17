import type { ReactNode } from "react";

/**
 * The top of every screen.
 *
 * Béa's screens each opened with their own arrangement of an eyebrow, a serif
 * title and — sometimes — an action, and the three drifted apart. One
 * component makes the consistent version the easy version.
 *
 * Compression is the behaviour worth sharing: once the page has scrolled past
 * a threshold the serif title shrinks into a bar, so the name of the screen
 * stays visible without eating a quarter of a phone. The shell owns the single
 * scroll container, so it decides `compressed` and every screen gets the same
 * behaviour for free.
 */
export function PageHeader({
  eyebrow,
  title,
  action,
  compressed = false,
}: {
  eyebrow?: string | undefined;
  title?: ReactNode | undefined;
  /** One action, right-aligned. Two is a toolbar, and belongs in the content. */
  action?: ReactNode | undefined;
  compressed?: boolean | undefined;
}) {
  if (!eyebrow && !title && !action) return null;

  return (
    <div
      // The flag sits on the wrapper and the children read it through `group-`,
      // so there is one source of truth for the state rather than three.
      data-compressed={compressed ? "" : undefined}
      // Once compressed the title is a bar sitting directly above the content,
      // so it needs a hairline to sit behind — expanded, it is part of the page
      // and a rule there would only cut the screen in half.
      className="rise group shrink-0 border-b border-transparent px-4 pt-4 transition-[padding,border-color] duration-(--t-shift) ease-(--ease-standard) data-[compressed]:border-border/50 data-[compressed]:pb-2 data-[compressed]:pt-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            // Collapsed by height rather than hidden, so the title slides up
            // into its place instead of jumping.
            <p className="label-caps max-h-5 overflow-hidden transition-[max-height,opacity] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:max-h-0 group-data-[compressed]:opacity-0">
              {eyebrow}
            </p>
          )}
          {title && (
            <h1 className="mt-1.5 text-[27px] leading-[1.06] transition-[font-size,margin] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:mt-0 group-data-[compressed]:truncate group-data-[compressed]:text-[18px] group-data-[compressed]:leading-[1.35]">
              {title}
            </h1>
          )}
        </div>
        {action && <div className="shrink-0 pt-0.5">{action}</div>}
      </div>
    </div>
  );
}
