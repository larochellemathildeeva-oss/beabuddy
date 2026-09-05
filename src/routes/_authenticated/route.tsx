import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLegalConsent } from "@/hooks/useLegalConsent";

function AuthenticatedLayout() {
  // Records proof of acceptance of the current Terms/Privacy/disclaimer for
  // social sign-ins and members who joined before a document version bump.
  useLegalConsent();
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});
