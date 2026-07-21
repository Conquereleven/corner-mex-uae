// Route B: the official API documents auto-deploy status and active deployments, but this
// repository has no provisioned OAuth project:viewer credential and has not verified the complete
// watched-branch response live. The network client is deliberately disabled. The injected
// comparator remains testable but cannot authorize production activation.

export const RAILWAY_LIVE_CONTRACT_STATUS = "railway_live_autodeploy_observation_not_supported";
export const RAILWAY_REQUIRED_OAUTH_SCOPE = "project:viewer";

export function createRailwayLiveContextFetcher({ token } = {}) {
  if (!token) throw new Error("RAILWAY_OAUTH_PROJECT_VIEWER_TOKEN_REQUIRED");
  throw new Error("RAILWAY_LIVE_AUTODEPLOY_OBSERVATION_NOT_SUPPORTED");
}
