import { createFileRoute } from "@tanstack/react-router";
import { handlePoIntake } from "@/lib/po/intake-handler.server";
import { intakePo } from "@/lib/po/service.server";
export const Route = createFileRoute("/api/public/hooks/po-intake")({
  server: {
    handlers: {
      POST: ({ request }) => handlePoIntake(request, process.env, intakePo),
    },
  },
});
