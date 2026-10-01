import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { user };
  },
  component: AuthenticatedLayout,
});
