import type { ReactNode } from "react";
import logo from "@/assets/bea-logo.png";

/** Shared identity row; the shell keeps the Home link and header actions. */
export function BrandMark({ version, large = false }: { version?: string; large?: boolean }) {
  return (
    <span className="flex min-h-11 items-center gap-2">
      <img
        src={logo}
        alt="Béa logo"
        className="size-9 shrink-0 object-contain"
        width={36}
        height={36}
      />
      <span className="leading-none">
        <span
          className={`block font-display tracking-[-0.035em] ${large ? "text-[40px]" : "text-[30px]"}`}
        >
          Béa<span className="text-[var(--acc)]">.</span>
        </span>
        {version && (
          <span className="mt-1 block text-[13px] font-semibold text-muted-foreground">
            v{version}
          </span>
        )}
      </span>
      <span className="label-caps hidden sm:inline">Travel Buddy</span>
    </span>
  );
}

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
  actionBesideEyebrow = false,
  compressed = false,
}: {
  eyebrow?: string | undefined;
  title?: ReactNode | undefined;
  /** One action, right-aligned. Two is a toolbar, and belongs in the content. */
  action?: ReactNode | undefined;
  /** Put the action on the eyebrow's line, so the title has the full width. */
  actionBesideEyebrow?: boolean | undefined;
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
      {actionBesideEyebrow && action ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="label-caps min-w-0">{eyebrow}</p>
            <div className="shrink-0">{action}</div>
          </div>
          {title && (
            <h1 className="mt-1 break-words text-display leading-[1.1] transition-[font-size] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:text-title">
              {title}
            </h1>
          )}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              // The kicker yields its space when compressed; expanded text wraps.
              <p className="label-caps transition-[opacity] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:hidden">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="mt-1.5 break-words text-display leading-[1.1] transition-[font-size,margin] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:mt-0 group-data-[compressed]:text-title group-data-[compressed]:leading-[1.35]">
                {title}
              </h1>
            )}
          </div>
          {action && <div className="shrink-0 pt-0.5">{action}</div>}
        </div>
      )}
    </div>
  );
}
