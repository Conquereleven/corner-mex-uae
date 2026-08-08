export const DEFAULT_APPLICATION_SERVICE = "corner-mex-uae";

// Health and readiness must report the same service identity. Railway injects
// RAILWAY_SERVICE_NAME per service (corner-mex-uae in production, cornermex-web
// in staging); outside Railway the canonical production identity is the fallback.
export function applicationServiceName(
  environment: Record<string, string | undefined> = process.env,
) {
  const name = environment.RAILWAY_SERVICE_NAME?.trim();
  return name && name.length > 0 ? name : DEFAULT_APPLICATION_SERVICE;
}
