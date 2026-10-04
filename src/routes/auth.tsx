import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  type LucideProps,
} from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/PageHeader";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { PasswordCreationRules } from "@/components/PasswordCreationRules";
import { assertNewPasswordAllowed, MIN_NEW_PASSWORD_LENGTH } from "@/lib/pwned-password";
import { CONSENT_TYPES, LEGAL_VERSION } from "@/lib/legal";
import { rememberReturnPath, safeRedirectPath } from "@/lib/auth-redirect";
import { friendlyAuthError } from "@/lib/auth-errors";
import { safeStorage } from "@/lib/tour-state";

/** The longest name kept on a new account. */
const NAME_MAX = 80;

export const Route = createFileRoute("/auth")({
  staticData: { plane: "detail" },
  // Where to go once signed in: the page that sent the traveller here.
  // `mode=signup` opens on account creation: a "Start free" button should not
  // land a newcomer on "Welcome back".
  validateSearch: (search: Record<string, unknown>): { redirect?: string; mode?: "signup" } => {
    const to = safeRedirectPath(search["redirect"]);
    return {
      ...(to ? { redirect: to } : {}),
      ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
    };
  },
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
  const { redirect: returnTo, mode: startMode } = Route.useSearch();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(startMode ?? "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeDisclaimer, setAgreeDisclaimer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Google sign-in preference: "auto" continues silently with the current
  // Google account; "ask" always shows Google's account chooser first.
  const [googleMode, setGoogleModeState] = useState<"auto" | "ask">(() =>
    safeStorage().getItem("bea-google-signin") === "ask" ? "ask" : "auto",
  );
  const setGoogleMode = (mode: "auto" | "ask") => {
    setGoogleModeState(mode);
    safeStorage().setItem("bea-google-signin", mode);
  };

  const consented = agreeTerms && agreeDisclaimer;

  // Google and the confirmation email come back to the site's origin, not
  // here, so the return address waits in this tab for the shell to take.
  useEffect(() => {
    rememberReturnPath(returnTo ?? null);
  }, [returnTo]);

  useEffect(() => {
    if (loading || !user) return;
    rememberReturnPath(null);
    // A path checked by safeRedirectPath; the router takes it as typed.
    if (returnTo) void navigate({ href: returnTo, replace: true });
    else void navigate({ to: "/", replace: true });
  }, [loading, user, navigate, returnTo]);

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
        await assertNewPasswordAllowed(password);
        // A blank name is left out, so the account falls back to the email's
        // name rather than saving an empty one.
        const displayName = name.trim().slice(0, NAME_MAX);
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: displayName ? { display_name: displayName } : {},
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
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: "google") => {
    setError(null);
    setBusy(true);
    // "Ask me every time" forces Google's account chooser on each sign-in.
    const askEveryTime = safeStorage().getItem("bea-google-signin") === "ask";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // The same address the email link uses, so both land on Home.
        redirectTo: window.location.origin,
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

  const signup = mode === "signup";
  const switchMode = () => {
    setMode(signup ? "signin" : "signup");
    setError(null);
    setMessage(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col border-x border-border/70 px-6 pb-8 pt-10">
        <div className="rise flex items-center justify-between">
          <Link
            to="/"
            aria-label="Back to the welcome page"
            className="-ml-2 grid size-11 place-items-center rounded-full"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        </div>
        <div className="rise mt-2">
          <BrandMark large />
          <p className="mt-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Trips · Places · Memories
          </p>
        </div>

        <div className="rise mt-6">
          <h1 className="font-display text-[40px] leading-[1.1]">
            {signup ? "Start your vault" : "Welcome back"}
          </h1>
          <p className="mt-3 text-[16px] leading-snug text-muted-foreground">
            {signup
              ? "Free, no card. Your places, trips and photo memories follow you across devices."
              : "Your places, trips and photo memories are saved to your account and follow you across devices."}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => social("google")}
            disabled={busy}
            className="flex h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-card px-4 text-[17px] font-semibold shadow-[0_1px_10px_rgb(80_60_40/0.07)] disabled:opacity-60"
          >
            <GoogleG />
            Continue with Google
          </button>
          {/* A sign-in preference: a newcomer has nothing to choose yet. */}
          {!signup && (
            <div
              role="radiogroup"
              aria-label="Google sign-in"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1"
            >
              <RoundChoice
                name="google-signin-mode"
                checked={googleMode === "auto"}
                onChange={() => setGoogleMode("auto")}
                label="Sign me in automatically"
              />
              <RoundChoice
                name="google-signin-mode"
                checked={googleMode === "ask"}
                onChange={() => setGoogleMode("ask")}
                label="Ask me every time"
              />
            </div>
          )}
        </div>

        <Divider>{signup ? "Or sign up with email" : "Or sign in with email"}</Divider>

        <form onSubmit={submit} className="space-y-3">
          {signup && (
            <PillField icon={User}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                maxLength={NAME_MAX}
                autoComplete="name"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              />
            </PillField>
          )}
          <PillField icon={Mail}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
          </PillField>
          <PillField icon={Lock}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              required
              minLength={signup ? MIN_NEW_PASSWORD_LENGTH : 6}
              placeholder="Password"
              aria-label="Password"
              autoComplete={signup ? "new-password" : "current-password"}
              aria-describedby={signup ? "password-rules" : undefined}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              {showPassword ? (
                <Eye className="size-5" aria-hidden />
              ) : (
                <EyeOff className="size-5" aria-hidden />
              )}
            </button>
          </PillField>
          {signup && (
            <div id="password-rules">
              <PasswordCreationRules password={password} />
            </div>
          )}
          {signup && (
            <div className="space-y-2.5 rounded-[var(--r-card)] border border-border bg-card p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
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
              <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={agreeDisclaimer}
                  onChange={(e) => setAgreeDisclaimer(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  I understand Béa is a personal organiser, not a travel adviser — suggestions,
                  directions, exchange rates and AI picks may be wrong, my travel decisions are my
                  own, and Béa's liability is limited as the Terms describe.
                </span>
              </label>
            </div>
          )}
          {error && <p className="px-1 text-[13px] text-destructive">{error}</p>}
          {message && <p className="px-1 text-[13px] text-nexttime">{message}</p>}
          <button
            type="submit"
            disabled={busy || (signup && !consented)}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-4 text-[18px] disabled:opacity-60"
          >
            {signup ? "Agree & create account" : "Sign in"}
            {!signup && <ArrowRight className="size-5" aria-hidden />}
          </button>
        </form>

        {!signup && (
          <Link
            to="/forgot-password"
            className="mx-auto mt-4 block text-[15px] text-muted-foreground underline underline-offset-4"
          >
            Forgot your password?
          </Link>
        )}

        <Divider>{signup ? "Have an account?" : "New here?"}</Divider>

        <button
          type="button"
          onClick={switchMode}
          className="mx-auto flex h-[52px] w-full max-w-[340px] items-center justify-center rounded-full border border-primary/70 px-4 text-[17px] font-semibold text-primary"
        >
          {signup ? "I already have an account" : "Create a new account"}
        </button>

        <p className="mt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
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
        <CopyrightNotice />
      </div>
    </div>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** An input in a pill, with its icon in front. */
function PillField({
  icon: Glyph,
  children,
}: {
  icon: ComponentType<LucideProps>;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[56px] items-center gap-3 rounded-2xl border border-transparent bg-card pl-5 pr-2 shadow-[0_1px_10px_rgb(80_60_40/0.07)] focus-within:border-primary">
      <Glyph className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </div>
  );
}

/** A round radio: an empty ring, or a filled one with a check. */
function RoundChoice({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13.5px]">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`grid size-6 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        }`}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

/** Google's G, in Google's own colours, as its brand guidelines ask. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
