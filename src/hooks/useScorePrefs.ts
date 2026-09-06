import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ScorePrefs } from "@/lib/score-opportunity";

const empty: ScorePrefs = { tags: [], preferredCountries: [] };

export function useScorePrefs(): ScorePrefs {
  const [prefs, setPrefs] = useState<ScorePrefs>(empty);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (active) setPrefs(empty);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("preferences, preferred_countries")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (!active) return;
      setPrefs({
        tags: (data?.preferences ?? []).filter(Boolean).slice(0, 40),
        preferredCountries: (data?.preferred_countries ?? []).filter(Boolean).slice(0, 30),
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return prefs;
}
