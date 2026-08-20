import { createStart } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/start-client-core";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { assertSellerCapabilityServerFnAllowed } from "./lib/seller-capability-policy";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const requestAuthContext = createMiddleware().server(({ request, next }) =>
  next({
    context: {
      authorization: request.headers.get("authorization"),
    },
  }),
);

const sellerCapabilityGuard = createMiddleware({ type: "function" }).server(
  ({ serverFnMeta, next }) => {
    assertSellerCapabilityServerFnAllowed(serverFnMeta);
    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, requestAuthContext],
  // Capability authority must run before auth/database middleware. A dormant
  // Seller server function therefore cannot become active merely because a
  // seller table, RPC, storage bucket, or service-role-readable schema appears.
  functionMiddleware: [sellerCapabilityGuard, attachSupabaseAuth],
}));
