import { useId, type InputHTMLAttributes } from "react";

/**
 * A labelled field for the password pages. The label stays visible: a
 * placeholder alone disappears the moment typing starts, and a screen reader
 * may not read it at all. The ring shows where the keyboard is.
 */
export function AuthField({
  label,
  className = "",
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className={`h-[var(--h-input)] w-full rounded-[var(--r-input)] border border-[var(--field-border)] bg-card px-4 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      />
    </div>
  );
}

/** The one primary button the password pages share with sign-in. */
export const AUTH_SUBMIT =
  "btn-primary flex w-full items-center justify-center px-4 disabled:opacity-60";
