import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONSENT_TYPES, LEGAL_VERSION } from "@/lib/legal";

/**
 * Ensures the signed-in member has an on-file acceptance of the current
 * Terms of Service, Privacy Policy and liability disclaimer. Confirm-email
 * sign-ups skip the auth-page insert (no session, RLS would refuse it).
 * Mounted in AppShell so home, trips, and the globe record it too. Also
 * covers social sign-in and older document versions.
 */
export function useLegalConsent() {
  const { user } = useAuth();
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("legal_consents")
        .select("consent_type")
        .eq("document_version", LEGAL_VERSION);
      if (cancelled) return;
      const have = new Set((data ?? []).map((r) => r.consent_type));
      const missing = CONSENT_TYPES.filter((t) => !have.has(t));
      if (missing.length) {
        const { error } = await supabase.from("legal_consents").insert(
          missing.map((t) => ({
            user_id: user.id,
            consent_type: t,
            document_version: LEGAL_VERSION,
          })),
        );
        if (error && error.code !== "23505") {
          console.error("[legal_consents]", error.message);
          return;
        }
      }
      if (!cancelled) setRecorded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return recorded;
}
