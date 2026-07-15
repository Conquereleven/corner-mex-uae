# Storage Activation Strategy A3

Canonical Storage contains zero buckets and objects; there is no surviving source to copy.

## Strategy

- Define required product-media buckets only after an approved media contract.
- Classify every bucket public or private before creation.
- Use content SHA-256, byte length and media type for ingestion verification.
- Never migrate signed URLs; regenerate access at request time.
- Preserve object-to-product references in a reviewed manifest without private paths.
- Verify policy parity for upload, read, replace and delete behavior.
- Roll back by disabling new references and removing only unreferenced objects through an approved process.

No bucket, object or Storage policy is created in A3.1.
