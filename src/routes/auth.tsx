import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONSENT_TYPES, LEGAL_VERSION } from "@/lib/legal";
import { startFirstRunTour } from "@/components/Tour";
import { CopyrightNotice } from "@/components/CopyrightNotice";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Béa" },
      {
        name: "description",
        content:
          "Create your Béa account with email or Google so your pins, trips and photo memories are saved to you.",
      },
      { property: "og:title", content: "Sign in — Béa" },
      {
        property: "og:description",
        content: "Save your travel memories to your own Béa account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Google sign-in preference: "auto" continues silently with the current
  // Google account; "ask" always shows Google's account chooser first.
  const [googleMode, setGoogleModeState] = useState<"auto" | "ask">(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("bea-google-signin") === "ask"
      ? "ask"
      : "auto",
  );
  const setGoogleMode = (mode: "auto" | "ask") => {
    setGoogleModeState(mode);
    window.localStorage.setItem("bea-google-signin", mode);
  };

  const consented = agreeTerms && agreeDisclaimer;

  useEffect(() => {
    if (!loading && user) navigate({ to: "/profile" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        if (!consented) {
          throw new Error("Please accept the terms and disclaimer to create your account.");
        }
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name },
          },
        });
        if (err) throw err;
        // Confirm-email leaves no session, so RLS would refuse this insert.
        // AppShell records consent on the first signed-in page instead.
        const newUser = data.user;
        if (data.session && newUser) {
          const { error: consentError } = await supabase.from("legal_consents").insert(
            CONSENT_TYPES.map((t) => ({
              user_id: newUser.id,
              consent_type: t,
              document_version: LEGAL_VERSION,
            })),
          );
          // Account already exists. A failed insert must not look like a failed
          // signup — AppShell writes the same rows on the next page.
          if (consentError) console.error("[legal_consents]", consentError.message);
        }
        if (!data.session) {
          setMessage("Check your email and tap the confirmation link to finish signing up.");
        } else {
          // Brand-new account: start the guided tour as soon as they land.
          // Tour's own auth listener may also fire for this session; both go
          // through the same gate, so a skip made a moment ago still holds.
          startFirstRunTour();
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: "google") => {
    setError(null);
    setBusy(true);
    // "Ask me every time" forces Google's account chooser on each sign-in.
    const askEveryTime =
      typeof window !== "undefined" &&
      window.localStorage.getItem("bea-google-signin") === "ask";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/profile`,
        // Spread rather than pass undefined: exactOptionalPropertyTypes rejects
        // an explicit undefined for an optional property.
        ...(askEveryTime ? { queryParams: { prompt: "select_account" } } : {}),
      },
    });
    setBusy(false);
    if (error) {
      setError("That sign-in didn't complete. Please try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col border-x border-border/70 px-6 py-10">
      <div className="flex flex-1 flex-col justify-center">
        <div className="rise">
          <p className="label-caps">Béa</p>
          <h1 className="mt-2 text-[34px] leading-[1.05]">
            {mode === "signup" ? "Start your vault" : "Welcome back"}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Your places, trips and photo memories are saved to your account and follow you across
            devices.
          </p>
        </div>

        <div className="mt-7 space-y-2.5">
          <button
            onClick={() => social("google")}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] font-medium disabled:opacity-60"
          >
            Continue with Google
          </button>
          <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="google-signin-mode"
                checked={googleMode === "auto"}
                onChange={() => setGoogleMode("auto")}
                className="h-3 w-3 accent-[hsl(var(--primary))]"
              />
              Sign me in automatically
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="google-signin-mode"
                checked={googleMode === "ask"}
                onChange={() => setGoogleMode("ask")}
                className="h-3 w-3 accent-[hsl(var(--primary))]"
              />
              Ask me every time
            </label>
          </div>
          <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="label-caps">or email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={6}
            placeholder="Password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
          />
          {mode === "signup" && (
            <div className="space-y-2.5 rounded-xl border border-border bg-card/60 p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>
                  I'm at least 16 and I agree to the{" "}
                  <Link to="/terms" className="text-primary underline underline-offset-4">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary underline underline-offset-4">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreeDisclaimer}
                  onChange={(e) => setAgreeDisclaimer(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>
                  I understand Béa is a personal organiser, not a travel adviser — suggestions,
                  directions, exchange rates and AI picks may be wrong, my travel decisions are my
                  own, and Béa's liability is limited as the Terms describe.
                </span>
              </label>
            </div>
          )}
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          {message && <p className="text-[12px] text-nexttime">{message}</p>}
          <button
            type="submit"
            disabled={busy || (mode === "signup" && !consented)}
            className="w-full rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {mode === "signup" ? "Agree & create account" : "Sign in"}
          </button>
        </form>

        {mode === "signin" && (
          <Link
            to="/forgot-password"
            className="mt-3 block text-[13px] text-muted-foreground underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        )}

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
            setMessage(null);
          }}
          className="mt-4 text-[13px] text-muted-foreground underline underline-offset-4"
        >
          {mode === "signup" ? "I already have an account" : "Create a new account"}
        </button>

      </div>
        <CopyrightNotice />
      </div>
    </div>
  );
}
