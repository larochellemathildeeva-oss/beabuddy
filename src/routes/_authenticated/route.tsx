import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { browserStoredSessionUser } from "@/lib/stored-session";

function AuthenticatedLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  staticData: { plane: "detail" },
  ssr: false,
  beforeLoad: async ({ location }) => {
    // The session saved on this phone, not getUser(): getUser() asks the
    // server, so with no signal it failed and sent a signed-in traveller to
    // the sign-in page. Supabase still checks the token on every query.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) return { user };
    // An expired token cannot be refreshed offline, and getSession() then
    // answers no session. The traveller saved on this phone is still the
    // one signed in: let them read what they kept rather than bounce them.
    const offline =
      (error && isAuthRetryableFetchError(error)) ||
      (typeof navigator !== "undefined" && navigator.onLine === false);
    const saved = offline ? browserStoredSessionUser() : null;
    if (saved) return { user: saved };
    throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  component: AuthenticatedLayout,
});
