import type { ReactNode, Ref } from "react";

/** Shared identity row; the shell keeps the Home link and header actions. */
export function BrandMark({ version, large = false }: { version?: string; large?: boolean }) {
  return (
    <span className="flex min-h-11 items-center gap-2.5">
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-[var(--r-card)] object-contain"
      />
      <span className="leading-none">
        <span className={`block font-bold ${large ? "text-[22px]" : "text-[20px]"} leading-[1.2]`}>
          Béa
        </span>
        {version && (
          <span className="mt-0.5 hidden text-[10px] text-muted-foreground min-[390px]:block">
            v{version}
          </span>
        )}
      </span>
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
  ref,
  eyebrow,
  title,
  action,
  actionBesideEyebrow = false,
  compressed = false,
}: {
  ref?: Ref<HTMLDivElement>;
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
      ref={ref}
      // The flag sits on the wrapper and the children read it through `group-`,
      // so there is one source of truth for the state rather than three.
      data-compressed={compressed ? "" : undefined}
      // Once compressed the title is a bar sitting directly above the content,
      // so it needs a hairline to sit behind — expanded, it is part of the page
      // and a rule there would only cut the screen in half.
      className="page-title-rule rise group mx-4 shrink-0 border-b border-border pb-2 pt-3 transition-[padding,border-color] duration-(--t-shift) ease-(--ease-standard) data-[compressed]:pb-2 data-[compressed]:pt-2.5"
    >
      {actionBesideEyebrow && action ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="label-caps min-w-0">{eyebrow}</p>
            <div className="shrink-0">{action}</div>
          </div>
          {title && (
            <h1 className="mt-1 break-words text-display leading-[1.1] transition-[font-size] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:truncate group-data-[compressed]:text-title">
              {title}
            </h1>
          )}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              // Height and opacity collapse together, so the title slides upward.
              <p className="label-caps max-h-[4lh] overflow-hidden transition-[max-height,opacity] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:max-h-0 group-data-[compressed]:opacity-0">
                {eyebrow}
              </p>
            )}
            {title && (
              <h1 className="mt-1.5 break-words text-display leading-[1.1] transition-[font-size,margin] duration-(--t-shift) ease-(--ease-standard) group-data-[compressed]:mt-0 group-data-[compressed]:truncate group-data-[compressed]:text-title group-data-[compressed]:leading-[1.35]">
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
