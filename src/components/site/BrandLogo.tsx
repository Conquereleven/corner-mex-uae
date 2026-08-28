import { INTERMEX_BRAND, type BrandConfig } from "@/config/brand";

export function BrandLogo({
  brand = INTERMEX_BRAND,
  className = "h-12 w-auto",
}: {
  brand?: BrandConfig;
  className?: string;
}) {
  return (
    <img
      src={brand.assets.logo.src}
      alt={brand.assets.logo.alt}
      width={110}
      height={56}
      className={`object-contain ${className}`}
    />
  );
}
