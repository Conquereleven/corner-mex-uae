#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run typecheck
npm run build
npm run build:railway
npm run test:alignment
npm run validate:a2-migration
npm run test:a2
npm run validate:a3:inventory
npm run validate:a3:mapping
npm run test:a3
npm run test:a3-2a
npm run validate:schema-authority
npm run validate:canonical-types
npm run validate:migration-ownership
npm run validate:application-schema-references
git diff --check "${MERGED_TREE_BASE:-origin/main}...HEAD"
