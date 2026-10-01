import { useEffect, useState } from "react";
import { isAuthRetryableFetchError, type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { forgetScreens, screensBelongTo } from "@/lib/screen-cache";
import { browserStoredSessionUser } from "@/lib/stored-session";

/**
 * No live session, but one still saved on this phone: Supabase could not
 * refresh an expired token for want of a network (a refused or signed-out
 * session is removed from storage, so it never lands here). The traveller is
 * still signed in; kept trips should open, not the sign-in page.
 */
function offlineUser(): User | null {
  if (typeof window === "undefined") return null;
  return browserStoredSessionUser() as User | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") forgetScreens();
      else screensBelongTo(next?.user?.id ?? null);
      setSession(next);
      setUser(next?.user ?? (event === "INITIAL_SESSION" ? offlineUser() : null));
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      const noNetwork = (error && isAuthRetryableFetchError(error)) || navigator.onLine === false;
      setSession(data.session);
      setUser(data.session?.user ?? (noNetwork ? offlineUser() : null));
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}
