import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONSENT_TYPES, LEGAL_VERSION } from "@/lib/legal";

/**
 * Ensures the signed-in member has an on-file acceptance of the current
 * Terms of Service, Privacy Policy and liability disclaimer. Email sign-ups
 * record consent at sign-up; this hook covers social sign-in and members who
 * accepted an older document version. Records are insert-once proof.
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
        await supabase.from("legal_consents").insert(
          missing.map((t) => ({
            user_id: user.id,
            consent_type: t,
            document_version: LEGAL_VERSION,
          })),
        );
      }
      if (!cancelled) setRecorded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return recorded;
}
