export type RouteAuthState = {
  authenticated: boolean;
  admin: boolean;
};

export type RouteAccess = "allow" | "login" | "account";

export function resolveRouteAccess(pathname: string, auth: RouteAuthState): RouteAccess {
  if (!auth.authenticated) return "login";
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !auth.admin) {
    return "account";
  }
  return "allow";
}
