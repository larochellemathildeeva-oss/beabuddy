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
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences, preferred_countries")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (!active) return;
      // A failed read is not "no preferences". Falling through here quietly
      // dropped someone's travel tags and changed what Béa recommends, which
      // is worse than the visible version of this bug. A null row with no
      // error is a real answer — nobody has set preferences yet — and still
      // lands on the empty defaults below.
      if (error) return;
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
