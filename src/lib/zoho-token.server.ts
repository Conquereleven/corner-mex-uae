import { AccountingIntegrationError } from "./accounting-integration.ts";
export type ZohoRefreshConfig = {
  accountsUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};
/** In-memory access-token cache only. Durable refresh credentials remain in server secret custody. */
export class ZohoTokenSource {
  private token: string;
  private refreshing: Promise<string> | null = null;
  private config: ZohoRefreshConfig | undefined;
  private transport: typeof fetch;
  constructor(
    token: string,
    config: ZohoRefreshConfig | undefined,
    transport: typeof fetch = fetch,
  ) {
    this.token = token;
    this.config = config;
    this.transport = transport;
  }
  current() {
    return this.token;
  }
  async refresh(rejectedToken: string) {
    if (this.token !== rejectedToken) return this.token;
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.performRefresh();
    try {
      this.token = await this.refreshing;
      return this.token;
    } finally {
      this.refreshing = null;
    }
  }
  private async performRefresh() {
    if (!this.config)
      throw new AccountingIntegrationError("auth", false, "ZOHO_REFRESH_NOT_CONFIGURED");
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
    });
    form.set("client_secret", this.config.clientSecret);
    let response: Response;
    try {
      response = await this.transport(`${this.config.accountsUrl}/oauth/v2/token`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      throw new AccountingIntegrationError(
        "provider_unavailable",
        true,
        "ZOHO_REFRESH_UNAVAILABLE",
      );
    }
    if (response.status === 429)
      throw new AccountingIntegrationError("rate_limit", true, "ZOHO_REFRESH_RATE_LIMITED");
    if (response.status >= 500)
      throw new AccountingIntegrationError(
        "provider_unavailable",
        true,
        "ZOHO_REFRESH_UNAVAILABLE",
      );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.access_token !== "string" || !body.access_token || body.error)
      throw new AccountingIntegrationError("auth", false, "ZOHO_REFRESH_REJECTED");
    return body.access_token;
  }
}
