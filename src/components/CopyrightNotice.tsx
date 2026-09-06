export const COPYRIGHT_LINE = "© 2026 Mathilde E. Larochelle. All rights reserved.";

export function CopyrightNotice({ className }: { className?: string }) {
  return (
    <p
      className={
        className ??
        "px-4 pb-3 pt-2 text-center text-[11px] leading-relaxed text-muted-foreground"
      }
    >
      {COPYRIGHT_LINE}
    </p>
  );
}
