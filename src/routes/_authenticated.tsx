import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getRouteAuthState } from "@/lib/route-auth.functions";
import { resolveRouteAccess } from "@/lib/route-auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const auth = await getRouteAuthState();
    if (resolveRouteAccess(location.pathname, auth) === "login") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
