import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Flame, MapPin, ShieldCheck, Star } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { ProductReviews } from "@/components/site/ProductReviews";
import { WishlistButton } from "@/components/site/WishlistButton";
import { getProduct, type ProductDetail } from "@/lib/catalog.functions";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

const SITE_ORIGIN = "https://corner-mex-uae.lovable.app";

function productUrl(slug: string) {
  return `${SITE_ORIGIN}/product/${encodeURIComponent(slug)}`;
}

function buildStructuredData(product: ProductDetail) {
  const url = productUrl(product.slug);
  const defaultVariant = product.variants[0];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: product.seo?.long_description || product.description,
        url,
        image: product.images,
        ...(product.brand && { brand: { "@type": "Brand", name: product.brand } }),
        ...(defaultVariant?.sku && { sku: defaultVariant.sku }),
        ...(product.category?.name && { category: product.category.name }),
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "AED",
          price: defaultVariant?.price_aed ?? product.price_aed,
          availability:
            (defaultVariant?.stock ?? 0) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          ...(product.seller?.name && {
            seller: { "@type": "Organization", name: product.seller.name },
          }),
        },
        ...(product.rating_count > 0 && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating_avg,
            reviewCount: product.rating_count,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_ORIGIN,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Shop",
            item: `${SITE_ORIGIN}/shop`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: product.name,
            item: url,
          },
        ],
      },
    ],
  };
}

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => getProduct({ data: { slug: params.slug, lang: "en" } }),
  head: ({ loaderData, params }) => {
    const product = loaderData;
    const canonical = productUrl(params.slug);
    const title =
      product?.seo?.title ||
      (product ? `${product.name} in UAE | Corner Mex` : "Product | Corner Mex");
    const description =
      product?.seo?.meta_description ||
      product?.description ||
      "Shop Mexican groceries with delivery across the UAE.";
    const image = product?.image;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: product?.seo?.keywords.join(", ") || "Mexican groceries UAE, Mexican food Dubai",
        },
        {
          name: "robots",
          content: product ? "index,follow,max-image-preview:large" : "noindex,follow",
        },
        { property: "og:type", content: "product" },
        { property: "og:site_name", content: "Corner Mex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: product
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(buildStructuredData(product)),
            },
          ]
        : [],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const initialProduct = Route.useLoaderData();
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "es" | "ar";
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const add = useCart((s) => s.add);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug, lang],
    queryFn: () => getProduct({ data: { slug, lang } }),
    initialData: lang === "en" ? initialProduct : undefined,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        </div>
      </SiteLayout>
    );
  }
  if (!product) {
    throw notFound();
  }
  const p = product;
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  const hasDiscount =
    variant?.compare_at_price_aed && variant.compare_at_price_aed > variant.price_aed;

  function addToCart() {
    if (!variant || !p.seller) return;
    add(
      {
        productId: p.id,
        variantId: variant.id,
        slug: p.slug,
        name: p.name,
        variantLabel: variant.label,
        image: p.image,
        unitPrice: variant.price_aed,
        sellerId: p.seller.id,
        sellerSlug: p.seller.slug,
        sellerName: p.seller.name,
        stock: variant.stock,
      },
      qty,
    );
    toast.success(`${p.name} added to cart`);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          {product.category && (
            <>
              {" "}
              · <span>{product.category.name}</span>
            </>
          )}
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-muted">
              {product.image && (
                <img
                  src={product.image}
                  alt={product.image_alts[0] || product.name}
                  className="aspect-square w-full object-cover"
                />
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(0, 4).map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-border bg-muted">
                    <img
                      src={src}
                      alt={product.image_alts[i] || `${product.name}, product image ${i + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {product.seller && (
              <Link
                to="/sellers/$slug"
                params={{ slug: product.seller.slug }}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                {product.seller.name}
              </Link>
            )}
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
              {product.name}
            </h1>

            {product.rating_count > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-medium text-foreground">{product.rating_avg.toFixed(1)}</span>
                <span>
                  · {product.rating_count} review{product.rating_count === 1 ? "" : "s"}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {product.origin_region && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {product.origin_region}
                </span>
              )}
              {product.is_halal && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Halal-friendly
                </span>
              )}
              {product.spice_level && product.spice_level > 0 && (
                <span className="inline-flex items-center gap-1 text-primary">
                  {Array.from({ length: Math.min(product.spice_level, 4) }).map((_, i) => (
                    <Flame key={i} className="h-3 w-3 fill-current" />
                  ))}
                </span>
              )}
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-3xl font-semibold">
                AED {variant?.price_aed.toFixed(0)}
              </span>
              {hasDiscount && (
                <span className="text-base text-muted-foreground line-through">
                  AED {variant!.compare_at_price_aed!.toFixed(0)}
                </span>
              )}
            </div>
            {variant?.label && (
              <p className="mt-1 text-sm text-muted-foreground">
                {variant.label} · SKU {variant.sku}
              </p>
            )}

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {product.seo?.short_description || product.description}
            </p>

            {product.variants.length > 1 && (
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Format</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${(variantId ?? product.variants[0].id) === v.id ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              <div className="inline-flex items-center gap-3 rounded-full border border-border px-4 py-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(variant?.stock ?? 99, q + 1))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  +
                </button>
              </div>
              <Button
                onClick={addToCart}
                size="lg"
                className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                Add to cart · AED {((variant?.price_aed ?? 0) * qty).toFixed(0)}
              </Button>
              <WishlistButton productId={p.id} size="lg" />
            </div>
            {variant && variant.stock < 20 && variant.stock > 0 && (
              <p className="mt-3 text-xs text-primary">Only {variant.stock} left in stock.</p>
            )}
          </div>
        </div>

        <section
          aria-labelledby="about-product"
          className="mt-16 max-w-3xl border-t border-border pt-10"
        >
          <h2 id="about-product" className="font-display text-3xl tracking-tight">
            About this product
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {product.seo?.long_description || product.description}
          </p>
          <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
            {product.brand && (
              <div>
                <dt className="text-muted-foreground">Brand</dt>
                <dd className="mt-1 font-medium">{product.brand}</dd>
              </div>
            )}
            {product.category && (
              <div>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="mt-1 font-medium">{product.category.name}</dd>
              </div>
            )}
            {product.origin_region && (
              <div>
                <dt className="text-muted-foreground">Origin</dt>
                <dd className="mt-1 font-medium">{product.origin_region}</dd>
              </div>
            )}
          </dl>
        </section>

        <ProductReviews productId={p.id} />
      </section>
    </SiteLayout>
  );
}
