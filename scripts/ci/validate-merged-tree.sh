#!/usr/bin/env bash
set -euo pipefail

actual_sha="$(git rev-parse HEAD)"
expected_sha="${MERGED_TREE_EXPECTED_SHA:-}"
base_sha="${MERGED_TREE_BASE_SHA:-}"
head_sha="${MERGED_TREE_HEAD_SHA:-}"

if [[ -n "$expected_sha" ]]; then
  [[ "$actual_sha" == "$expected_sha" ]] || {
    echo "Expected proposed merge SHA $expected_sha, got $actual_sha" >&2
    exit 1
  }
  [[ "$(git rev-parse HEAD^1)" == "$base_sha" ]] || {
    echo "Proposed merge base parent mismatch" >&2
    exit 1
  }
  [[ "$(git rev-parse HEAD^2)" == "$head_sha" ]] || {
    echo "Proposed merge head parent mismatch" >&2
    exit 1
  }
else
  base_sha="$(git rev-parse HEAD^1)"
  head_sha="$(git rev-parse HEAD^2)"
fi

echo "verified proposed merge tree: merge=$actual_sha base=$base_sha head=$head_sha"
if [[ "${MERGED_TREE_VERIFY_ONLY:-false}" == "true" ]]; then
  exit 0
fi

npm ci
npm run typecheck
npm run build
npm run build:railway
npm run validate:browser-secrets
npm run test:alignment
npm run validate:a2-migration
npm run test:a2
npm run validate:a3:inventory
npm run validate:a3:mapping
npm run test:a3
npm run rehearse:a3
npm run reconcile:a3
npm run privacy:a3
npm run validate:a3:target-clean-evidence
npm run validate:a3-2a:readiness
npm run validate:a3-2a:callbacks
npm run validate:a3-2a:founder-decisions
npm run validate:db1-custody
npm run test:a3-2a
CORNEROPS_SOURCE_SHA=a8a751bdbaf2b12fef3f94c83769bac52fffbaad npm run test:a3-2b
npm run validate:a3-2b:decisions
npm run validate:a3-2b:readiness
npm run test:pr9-remediation
npm run verify:a3:activation-readiness -- --ci-static
npm run lint:changed
npm run validate:schema-authority
npm run validate:canonical-types
npm run validate:migration-ownership
npm run validate:application-schema-references
npm run test:canonical-migration-replay
git diff --check "$base_sha...HEAD"
