// Lightweight responsive-image helper.
// When the source is a Supabase Storage public URL we rewrite it to the
// image-transform endpoint (`/render/image/public/`) which serves resized
// WebP. For any other URL we just return the original — no srcset.

const WIDTHS = [240, 360, 480, 720, 960] as const;

function toRender(url: string, width: number): string {
  if (!url.includes("/storage/v1/object/public/")) return url;
  const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${width}&quality=72&resize=cover`;
}

export function imageSrcSet(url: string | null): { src: string; srcSet?: string } {
  if (!url) return { src: "" };
  if (!url.includes("/storage/v1/object/public/")) return { src: url };
  return {
    src: toRender(url, 480),
    srcSet: WIDTHS.map((w) => `${toRender(url, w)} ${w}w`).join(", "),
  };
}

export const PRODUCT_CARD_SIZES =
  "(min-width: 1280px) 280px, (min-width: 640px) 33vw, 50vw";