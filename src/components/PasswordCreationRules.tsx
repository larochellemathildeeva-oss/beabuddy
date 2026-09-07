import { MIN_NEW_PASSWORD_LENGTH } from "@/lib/pwned-password";

type PasswordCreationRulesProps = {
  /** Current password value — used for live length feedback. */
  password?: string;
};

/**
 * Clear password-creation rules shown on sign-up and reset.
 * Enforcement lives in `assertNewPasswordAllowed`; this is the user-facing copy.
 */
export function PasswordCreationRules({ password = "" }: PasswordCreationRulesProps) {
  const longEnough = password.length >= MIN_NEW_PASSWORD_LENGTH;

  return (
    <div className="rounded-xl border border-border bg-card/60 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">Password rules</p>
      <ul className="mt-1.5 space-y-1">
        <li className="flex items-start gap-2">
          <span
            aria-hidden
            className={
              longEnough
                ? "mt-0.5 text-[11px] text-nexttime"
                : "mt-0.5 text-[11px] text-muted-foreground/70"
            }
          >
            {longEnough ? "✓" : "○"}
          </span>
          <span className={longEnough ? "text-foreground" : undefined}>
            At least {MIN_NEW_PASSWORD_LENGTH} characters
            {password.length > 0 && !longEnough
              ? ` (${password.length} of ${MIN_NEW_PASSWORD_LENGTH})`
              : null}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-0.5 text-[11px] text-muted-foreground/70">
            ○
          </span>
          <span>Must not appear in known data breaches</span>
        </li>
      </ul>
      <p className="mt-2 text-[11px]">
        We check new passwords against a public breach list. Your password itself is never sent —
        only a short hash prefix.
      </p>
    </div>
  );
}
