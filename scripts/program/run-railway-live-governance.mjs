import fs from "node:fs";
import {
  checkRailwayLiveGovernance,
  LIVE_GOVERNANCE_STATES,
} from "./check-railway-live-governance.mjs";
import { createRailwayLiveContextFetcher } from "./railway-live-client.mjs";
import { assertNoRailwayWrites } from "./assert-no-railway-writes.mjs";

// CLI entrypoint for the Railway Live Drift Guard. Intentionally fails closed:
// - missing RAILWAY_VIEWER_TOKEN -> live_governance_credentials_missing, non-zero exit
// - any non-VERIFIED result -> non-zero exit
// - VERIFIED -> zero exit
//
// This script never deploys, restarts, rolls back, or writes Railway variables. It statically
// self-checks that guarantee before doing anything else.

assertNoRailwayWrites();

const token = process.env.RAILWAY_VIEWER_TOKEN;

const summaryLines = [];
const writeSummary = (line) => summaryLines.push(line);

async function main() {
  if (!token) {
    const result = {
      status: LIVE_GOVERNANCE_STATES.CREDENTIALS_MISSING,
      reason: "dedicated_railway_viewer_credential_required",
      contexts: [],
    };
    writeSummary("# Railway Live Governance Drift Guard");
    writeSummary("");
    writeSummary(`Result: **${result.status}**`);
    writeSummary("");
    writeSummary(
      "No `RAILWAY_VIEWER_TOKEN` is configured. This job requires a dedicated read-only " +
        "(Viewer-role, no deploy, no variable access) Railway credential stored only as a GitHub " +
        "Actions secret. It has not been provisioned yet, so live verification is honestly blocked " +
        "rather than reported as passing.",
    );
    flushSummary();
    console.log(JSON.stringify(result));
    process.exitCode = 1;
    return;
  }

  const fetchLiveContext = createRailwayLiveContextFetcher({ token });
  const result = await checkRailwayLiveGovernance({ fetchLiveContext });

  writeSummary("# Railway Live Governance Drift Guard");
  writeSummary("");
  writeSummary(`Result: **${result.status}**`);
  writeSummary(`Timestamp: ${new Date().toISOString()}`);
  writeSummary("");
  if (result.contexts.length > 0) {
    writeSummary(
      "| Environment | Status | Project | Service | Environment ID | Branch | Auto-deploy | SHA |",
    );
    writeSummary("|---|---|---|---|---|---|---|---|");
    for (const context of result.contexts) {
      const live = context.live || {};
      writeSummary(
        `| ${context.environment} | ${context.status} | ${live.projectId ?? "-"} | ${live.serviceId ?? "-"} | ${live.environmentId ?? "-"} | ${live.watchedBranch ?? "-"} | ${live.autoDeploy ?? "-"} | ${live.currentSourceSha ?? "-"} |`,
      );
      if (context.drift?.length) {
        writeSummary(`  - drift: ${context.drift.join(", ")}`);
      }
      if (context.reason) {
        writeSummary(`  - reason: ${context.reason}`);
      }
    }
  }
  flushSummary();

  console.log(JSON.stringify(result));
  process.exitCode = result.status === LIVE_GOVERNANCE_STATES.VERIFIED ? 0 : 1;
}

function flushSummary() {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const text = `${summaryLines.join("\n")}\n`;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, text);
  } else {
    process.stderr.write(text);
  }
}

await main();
