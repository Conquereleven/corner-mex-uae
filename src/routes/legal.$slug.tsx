import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

const CURRENT_POLICIES = {
  "terms-and-conditions": "/terms",
  "privacy-policy": "/privacy",
  "returns-refunds": "/returns",
} as const;

export const Route = createFileRoute("/legal/$slug")({
  loader: ({ params }) => {
    const destination = CURRENT_POLICIES[params.slug as keyof typeof CURRENT_POLICIES];
    if (!destination) throw notFound();
    throw redirect({ to: destination });
  },
  component: () => null,
});
