# Import Runbook

1. Set local `CORNEROPS_REPO_PATH` and exact `CORNEROPS_SOURCE_SHA`.
2. Run `npm run validate:catalog-export`, `npm run validate:media-manifest`, and `npm run catalog:import:preview`.
3. Review counts and fingerprint. Current preview: 190 total; 148 ready; 41 review; 1 missing media.
4. Apply the reviewed migration only after CI and independent review.
5. Execute only with exact target `wlrfknmrhowldygmvtvn`, reviewed commit, fingerprint, idempotency key and founder authorization.
6. Run `catalog:import:verify`; require public count and inventory total to equal zero.

Never import source stock, publish products, enable checkout or reuse credentials across systems.
