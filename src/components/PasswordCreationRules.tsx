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
  const typed = password.length > 0;
  const longEnough = password.length >= MIN_NEW_PASSWORD_LENGTH;

  return (
    <div className="rounded-xl border border-border bg-card/60 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">Password rules</p>
      <ul className="mt-1.5 list-none space-y-1">
        <li className={longEnough ? "text-foreground" : undefined}>
          {typed ? (longEnough ? "✓ " : "· ") : "· "}
          At least {MIN_NEW_PASSWORD_LENGTH} characters
          {typed && !longEnough ? ` (${password.length} of ${MIN_NEW_PASSWORD_LENGTH})` : null}
        </li>
        <li>· Must not appear in known data breaches</li>
      </ul>
      <p className="mt-2 text-[11px]">
        We check new passwords against a public breach list when you submit. Your password itself is
        never sent — only a short hash prefix.
      </p>
    </div>
  );
}
