import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/PageHeader";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { AUTH_SUBMIT, AuthField } from "@/components/AuthField";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/forgot-password")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Reset your password — Béa" },
      {
        name: "description",
        content: "Send yourself a reset link and choose a new password for your Béa account.",
      },
      { property: "og:title", content: "Reset your password — Béa" },
      {
        property: "og:description",
        content: "Send yourself a reset link and choose a new password for your Béa account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(friendlyAuthError(err));
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col border-x border-border/70 px-6 py-10">
        <div className="flex flex-1 flex-col justify-center">
          <BrandMark large />
          <h1 className="mt-6 font-display text-[40px] leading-[1.1]">Forgot your password?</h1>
          <p className="mt-2 text-[16px] text-muted-foreground">
            Enter the email on your account and we'll send you a link to choose a new password.
          </p>

          {sent ? (
            <p className="mt-6 rounded-xl border border-border bg-card p-4 text-[16px]">
              If that email has a Béa account, a reset link is on its way. Check your inbox (and
              your spam folder) and tap the link within the hour.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <AuthField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                enterKeyHint="send"
              />
              {error && (
                <p role="alert" className="text-[14px] text-destructive">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className={AUTH_SUBMIT}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <Link
            to="/auth"
            className="mt-4 inline-flex min-h-11 items-center self-start text-[16px] text-muted-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
        <CopyrightNotice />
      </div>
    </div>
  );
}
