import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clearKeptOfflineOnSignOut } from "@/lib/directions-account";

/**
 * Sign out, from You or the Menu. Trips kept offline leave this phone with
 * the traveller, but only those the account holds a copy of, so signing in
 * brings them back. With no signal, or after a few seconds, everything stays
 * on the phone.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const signingOut = useRef(false);
  return async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    // After eight seconds sign-out goes on without it, and the clean-up
    // stops: nothing is removed from the phone once it has been left behind.
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const left = user
      ? await Promise.race([
          clearKeptOfflineOnSignOut(user.id, stop.signal),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              stop.abort();
              resolve(null);
            }, 8_000);
          }),
        ])
          .catch(() => null)
          .finally(() => clearTimeout(timer))
      : null;
    await supabase.auth.signOut();
    if (left?.kept) {
      toast(
        left.kept === 1
          ? "One trip kept offline stays on this phone: it couldn't be copied to your account just now."
          : `${left.kept} trips kept offline stay on this phone: they couldn't be copied to your account just now.`,
      );
    } else if (left?.cleared) {
      toast("Trips kept offline were removed from this phone. They come back when you sign in.");
    }
    navigate({ to: "/auth" });
  };
}
