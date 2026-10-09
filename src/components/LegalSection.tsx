import type { ReactNode } from "react";

/**
 * One part of the privacy policy or the terms, as the Figma legal frames
 * draw it: a small label, the part in a line, and a hairline. The full text
 * opens under it. A native <details>, so it opens without JavaScript and the
 * browser's find-in-page still reaches the words inside.
 */
export function LegalSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-[var(--rule)]">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="text-[12px] font-normal text-foreground">{title}</h2>
        <span className="mt-1.5 text-[18px] leading-[1.3] text-foreground">{summary}</span>
      </summary>
      <div className="space-y-3 pb-4 text-[14px] leading-[1.5] text-foreground">{children}</div>
    </details>
  );
}
