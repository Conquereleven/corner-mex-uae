// Read-only Railway API client used only by the Live Drift Guard's CLI entrypoint
// (run-railway-live-governance.mjs). This file must never contain a write/mutation operation —
// scripts/program/assert-no-railway-writes.mjs statically scans it in CI.
//
// UNVERIFIED AGAINST A LIVE RAILWAY RESPONSE: this client is implemented against Railway's
// public GraphQL API shape as documented, but has not been exercised against a real Railway
// project in this session because no dedicated read-only credential (RAILWAY_VIEWER_TOKEN) is
// configured. Per governance policy, the live job that uses this client stays gated on that
// secret's presence until an operator provisions a dedicated Viewer-role token and confirms the
// query shape against a real response. Do not treat this file as verified evidence on its own.

const RAILWAY_GRAPHQL_ENDPOINT = "https://backboard.railway.com/graphql/v2";

const QUERY = `
  query LiveGovernanceProbe($serviceId: String!, $environmentId: String!) {
    service(id: $serviceId) {
      id
      name
      source { repo }
      serviceInstances(environmentId: $environmentId) {
        edges {
          node {
            environmentId
            branch
            source { repo branch }
          }
        }
      }
    }
    deployments(input: { serviceId: $serviceId, environmentId: $environmentId }, first: 1) {
      edges {
        node {
          id
          status
          meta
        }
      }
    }
  }
`;

async function graphqlRequest({ token, fetchImpl = fetch, timeoutMs = 15_000 }, variables) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(RAILWAY_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY, variables }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`RAILWAY_API_HTTP_${response.status}`);
    }
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(`RAILWAY_API_GRAPHQL_ERROR:${payload.errors[0]?.message || "unknown"}`);
    }
    return payload.data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("RAILWAY_API_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Builds a `fetchLiveContext` function bound to a specific read-only token, suitable for
 * injection into checkRailwayLiveGovernance(). Never requests, logs, or returns variable values.
 */
export function createRailwayLiveContextFetcher({ token, fetchImpl } = {}) {
  if (!token) throw new Error("RAILWAY_VIEWER_TOKEN_REQUIRED");
  return async function fetchLiveContext({ projectId, serviceId, environmentId, environment }) {
    const data = await graphqlRequest({ token, fetchImpl }, { serviceId, environmentId });
    const service = data?.service;
    const instanceEdge = service?.serviceInstances?.edges?.find(
      (edge) => edge.node?.environmentId === environmentId,
    );
    const instance = instanceEdge?.node;
    const deploymentEdge = data?.deployments?.edges?.[0];
    const deployment = deploymentEdge?.node;

    return {
      // Echoed from the request, not independently returned by this query shape: querying by a
      // specific serviceId is already scoped to one project, so this is a structural pass-through
      // rather than an independent live confirmation of the project identifier.
      projectId,
      environmentId,
      serviceId,
      environmentName: environment,
      connectedRepository: instance?.source?.repo ?? service?.source?.repo,
      watchedBranch: instance?.source?.branch ?? instance?.branch,
      autoDeploy: undefined, // Railway's public API does not expose auto-deploy as a plain boolean
      // in all schema versions; this field must be confirmed against a real response before this
      // client is trusted. Until confirmed, leave undefined so shape validation in
      // checkRailwayLiveGovernance() correctly reports live_governance_response_malformed rather
      // than silently asserting a value.
      waitForCi: undefined,
      currentDeploymentId: deployment?.id,
      currentSourceSha: deployment?.meta?.commitHash,
      deploymentStatus: deployment?.status,
      instanceStatus: deployment?.status,
    };
  };
}
