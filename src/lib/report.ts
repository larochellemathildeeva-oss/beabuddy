import { supabase } from "@/integrations/supabase/client";

/**
 * Feedback and client-side crash reports both land in app_reports.
 *
 * Reporting must never itself throw: it runs inside error handlers, and an
 * error thrown while reporting an error is how you lose the original.
 */

const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown";

/** Match the CHECK constraints so a too-long field is trimmed, not rejected. */
const LIMITS = { message: 4000, detail: 8000, path: 300, userAgent: 400 } as const;

function clip(value: string | null | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Stacks and messages can carry whatever was on screen. Strip the two things
 * most likely to be in a URL or an error string and least acceptable in a log.
 */
function redact(text: string): string {
  return text
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, "[email]")
    .replace(/(access_token|refresh_token|apikey|api_key|code)=[^&\s"']+/gi, "$1=[redacted]");
}

type ReportInput = {
  kind: "feedback" | "error";
  message: string;
  detail?: string | null;
};

/** Resolves true when the report was stored. Never throws. */
export async function fileReport(input: ReportInput): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    // Reports are owned rows; without a session there is nothing to attach one
    // to, and an anonymous insert path would just be a spam target.
    if (!userId) return false;

    const message = clip(redact(input.message), LIMITS.message);
    if (!message) return false;

    const { error } = await supabase.from("app_reports").insert({
      user_id: userId,
      kind: input.kind,
      message,
      detail: clip(input.detail ? redact(input.detail) : null, LIMITS.detail),
      path: clip(typeof window === "undefined" ? null : window.location.pathname, LIMITS.path),
      app_version: APP_VERSION,
      user_agent: clip(typeof navigator === "undefined" ? null : navigator.userAgent, LIMITS.userAgent),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Fire-and-forget crash report from an error boundary or a global handler. */
export function reportError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  void fileReport({
    kind: "error",
    message: context ? `${context}: ${err.message}` : err.message,
    detail: err.stack ?? null,
  });
}
