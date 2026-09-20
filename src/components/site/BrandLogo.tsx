import { ACTIVE_BRAND, type BrandConfig } from "@/config/brand";

export function BrandLogo({
  brand = ACTIVE_BRAND,
  reversed = false,
  className = "h-12 w-auto",
}: {
  brand?: BrandConfig;
  /** Use the light mark on dark surfaces such as the red header band. */
  reversed?: boolean;
  className?: string;
}) {
  return (
    <img
      src={reversed ? brand.assets.logoReversed.src : brand.assets.logo.src}
      alt={reversed ? brand.assets.logoReversed.alt : brand.assets.logo.alt}
      width={110}
      height={56}
      className={`object-contain ${className}`}
    />
  );
}
