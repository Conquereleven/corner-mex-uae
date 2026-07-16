import { execFileSync } from "node:child_process";
const projectId = "06d2ecdd-3c03-4480-8299-48c539595a94",
  expectedCommit =
    process.env.RAILWAY_EXPECTED_COMMIT || "06d1c71d56a4e343dfeda4eaff28b2a7dba828d1";
const services = JSON.parse(
  execFileSync("railway", ["service", "list", "--environment", "production", "--json"], {
    encoding: "utf8",
  }),
);
const service = services.find((x) => x.name === "corner-mex-uae");
if (!service) throw new Error("RAILWAY_PRODUCTION_SERVICE_NOT_FOUND");
if (service.source?.repo !== "Conquereleven/corner-mex-uae")
  throw new Error("RAILWAY_SOURCE_REPOSITORY_MISMATCH");
const deployments = JSON.parse(
  execFileSync(
    "railway",
    [
      "deployment",
      "list",
      "--environment",
      "production",
      "--service",
      service.id,
      "--limit",
      "1",
      "--json",
    ],
    { encoding: "utf8" },
  ),
);
const deployment = deployments[0];
if (!deployment) throw new Error("RAILWAY_PRODUCTION_DEPLOYMENT_NOT_FOUND");
if (deployment.meta?.branch !== "main") throw new Error("RAILWAY_SOURCE_BRANCH_MISMATCH");
if (deployment.meta?.commitHash !== expectedCommit)
  throw new Error("RAILWAY_SOURCE_COMMIT_MISMATCH");
console.log(
  JSON.stringify({
    status: "verified_production_source",
    projectId,
    environment: "production",
    serviceId: service.id,
    serviceName: service.name,
    sourceRepository: service.source.repo,
    sourceBranch: deployment.meta.branch,
    sourceCommit: deployment.meta.commitHash,
    deploymentId: deployment.id,
    deploymentStatus: deployment.status,
    observedAt: new Date().toISOString(),
    writes: false,
  }),
);
