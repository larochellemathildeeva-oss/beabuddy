import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/PageHeader";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { PasswordCreationRules } from "@/components/PasswordCreationRules";
import { AUTH_SUBMIT, AuthField } from "@/components/AuthField";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { assertNewPasswordAllowed, MIN_NEW_PASSWORD_LENGTH } from "@/lib/pwned-password";

const PASSWORD_MISMATCH = "Those two passwords don't match.";

export const Route = createFileRoute("/reset-password")({
  staticData: { plane: "detail" },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Béa" },
      {
        name: "description",
        content: "Set a new password for your Béa travel vault and get back to your trips.",
      },
      { property: "og:title", content: "Choose a new password — Béa" },
      {
        property: "og:description",
        content: "Set a new password for your Béa travel vault and get back to your trips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The reset link drops a recovery session in place; wait for it before
    // letting anyone set a new password.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const mismatch = error === PASSWORD_MISMATCH;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(PASSWORD_MISMATCH);
      return;
    }
    setBusy(true);
    try {
      await assertNewPasswordAllowed(password);
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(friendlyAuthError(err));
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: "/", replace: true }), 1200);
    } catch (err) {
      setError(err ? friendlyAuthError(err) : "Could not save that password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col gap-6 p-5">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <BrandMark />
          <Link to="/auth" className="flex min-h-11 items-center px-1 text-[14px] text-foreground">
            Back
          </Link>
        </header>
        <div className="flex flex-1 flex-col gap-6">
          <h1 className="text-[28px] font-bold leading-[1.4]">Choose a new password.</h1>

          {done ? (
            <p className="rounded-[var(--r-card)] border border-border bg-card p-4 text-[14px] leading-[1.4]">
              Password updated — taking you back into Béa.
            </p>
          ) : !ready ? (
            <p className="text-[14px] leading-[1.4] text-muted-foreground">
              Open this page from the link in your reset email. If you got here another way, ask for
              a new link on the{" "}
              <Link to="/forgot-password" className="underline underline-offset-4">
                forgot password
              </Link>{" "}
              page.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <AuthField
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={MIN_NEW_PASSWORD_LENGTH}
                autoComplete="new-password"
                aria-describedby="password-rules"
                enterKeyHint="next"
              />
              <div id="password-rules">
                <PasswordCreationRules password={password} />
              </div>
              <AuthField
                label="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                minLength={MIN_NEW_PASSWORD_LENGTH}
                autoComplete="new-password"
                enterKeyHint="done"
                error={mismatch ? error : null}
              />
              {error && !mismatch && (
                <p role="alert" className="text-[14px] text-destructive">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className={AUTH_SUBMIT}>
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>
          )}
        </div>
        <CopyrightNotice />
      </div>
    </div>
  );
}
