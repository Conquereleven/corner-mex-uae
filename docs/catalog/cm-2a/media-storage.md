# Media Storage

Approved logical buckets are `catalog-public`, `catalog-review-private` and `catalog-import-manifests-private`; none are created until the reviewed execution gate passes. Paths use product identity and SHA-256. Only JPEG, PNG and WebP up to 10 MiB are eligible. Traversal, MIME/extension mismatch, SVG/HTML/script/executable content and checksum mismatch fail closed. Public media is never created for a blocked or inactive product.
