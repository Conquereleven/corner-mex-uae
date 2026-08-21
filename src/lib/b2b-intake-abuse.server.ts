import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

const ABUSE_KEY_NAMESPACE = "cornermex:b2b-intake:v1";

export function selectTrustedClientIp({
  realIp,
  directIp,
  railwayRuntime,
}: {
  realIp?: string;
  directIp?: string;
  railwayRuntime: boolean;
}): string | null {
  if (railwayRuntime) return normalizeIp(realIp);
  return normalizeIp(directIp);
}

export function hashB2bIntakeAbuseKey(ip: string, pepper: string): string {
  if (!pepper) throw new Error("CM_B2B_ABUSE_BACKEND_UNAVAILABLE");
  return createHmac("sha256", pepper).update(`${ABUSE_KEY_NAMESPACE}:${ip}`).digest("hex");
}

export function getB2bIntakeAbuseKey(): string {
  const railwayRuntime = Boolean(
    process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID,
  );
  const ip = selectTrustedClientIp({
    realIp: getRequestHeader("x-real-ip"),
    directIp: railwayRuntime ? undefined : getRequestIP(),
    railwayRuntime,
  });

  if (!ip) throw new Error("CM_B2B_ABUSE_IDENTITY_UNAVAILABLE");

  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("CM_B2B_ABUSE_BACKEND_UNAVAILABLE");
  return hashB2bIntakeAbuseKey(ip, pepper);
}

function normalizeIp(value?: string): string | null {
  const candidate = value?.trim();
  if (!candidate || isIP(candidate) === 0) return null;
  return candidate.toLowerCase();
}
