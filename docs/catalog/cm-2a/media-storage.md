# Media Storage

Approved logical buckets are `catalog-public`, `catalog-review-private` and `catalog-import-manifests-private`; none are created until the reviewed execution gate passes. Paths use product identity and SHA-256. Only JPEG, PNG and WebP up to 10 MiB are eligible. Traversal, MIME/extension mismatch, SVG/HTML/script/executable content and checksum mismatch fail closed. Public media is never created for a blocked or inactive product.

`npm run catalog:media:validate` validates the 189 references and records them as `deferred` until an explicit live pre-execution content fetch is authorized. The bounded content validator enforces HTTPS, timeout, redirect/private-host denial, MIME sniffing, size and checksum. Only evidence marked `validated` may be copied by a future execution adapter; `deferred` and `failed` are never copyable.
