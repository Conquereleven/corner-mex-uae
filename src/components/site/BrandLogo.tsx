import { ACTIVE_BRAND, brandMark, type BrandConfig, type BrandSurface } from "@/config/brand";

/**
 * The CornerMex mark. The caller names the surface it is sitting on and the
 * brand module picks the prepared variant, so no call site ever has to reason
 * about contrast.
 */
export function BrandLogo({
  brand = ACTIVE_BRAND,
  surface = "onIvory",
  className = "h-12 w-auto",
}: {
  brand?: BrandConfig;
  /** The background the mark lands on. */
  surface?: BrandSurface;
  className?: string;
}) {
  const asset = brandMark(surface, brand);
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      width={110}
      height={56}
      className={`object-contain ${className}`}
    />
  );
}
