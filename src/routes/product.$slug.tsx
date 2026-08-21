import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, MapPin, Mail, ShoppingBag } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { TrustBar } from "@/components/site/Trust";
import { Button } from "@/components/ui/button";
import { getProduct, type ProductDetail } from "@/lib/catalog.functions";
import { siteOrigin, siteUrl } from "@/lib/site-url";
import { mailto, PUBLIC_CONTACT } from "@/lib/public-contact";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { productCopyToPlainText } from "@/lib/product-copy";
import { publicProductBrand } from "@/lib/public-product-brand";

function productUrl(slug: string) {
  return siteUrl(`/product/${encodeURIComponent(slug)}`);
}

function hasPublicSellableVariant(product: ProductDetail | null | undefined): boolean {
  return Boolean(
    product?.variants.some(
      (variant) => Number.isFinite(variant.price_aed) && variant.price_aed > 0,
    ),
  );
}

function buildStructuredData(product: ProductDetail) {
  const url = productUrl(product.slug);
  const defaultVariant =
    product.variants.find(
      (variant) => Number.isFinite(variant.price_aed) && variant.price_aed > 0,
    ) ?? null;
  const brand = publicProductBrand(product.brand);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: productCopyToPlainText(product.seo?.long_description || product.description),
        url,
        image: product.images,
        ...(brand && { brand: { "@type": "Brand", name: brand } }),
        ...(defaultVariant?.sku && { sku: defaultVariant.sku }),
        ...(product.category?.name && { category: product.category.name }),
        additionalProperty: {
          "@type": "PropertyValue",
          name: "Commercial status",
          value: "Availability and price are verified at checkout",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteOrigin(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Shop",
            item: siteUrl("/shop"),
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
  loader: async ({ params }) => {
    const product = await getProduct({ data: { slug: params.slug, lang: "en" } });
    if (!product || !hasPublicSellableVariant(product)) throw notFound();
    return product;
  },
  head: ({ loaderData, params }) => {
    const product = loaderData;
    const canonical = productUrl(params.slug);
    const title =
      product?.seo?.title ||
      (product ? `${product.name} in UAE | Corner Mex` : "Product | Corner Mex");
    const description = productCopyToPlainText(
      product?.seo?.meta_description ||
        product?.description ||
        "Explore this Mexican pantry item through the CornerMex UAE catalogue.",
    );
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
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const addToCart = useCart((state) => state.add);

  const { data: product, isLoading } = useQuery<ProductDetail | null>({
    queryKey: ["product", slug, lang],
    queryFn: async () => {
      const localizedProduct = await getProduct({ data: { slug, lang } });
      return localizedProduct && hasPublicSellableVariant(localizedProduct)
        ? localizedProduct
        : null;
    },
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
  const publicBrand = publicProductBrand(p.brand);
  const sellableVariants = p.variants.filter(
    (candidate) => Number.isFinite(candidate.price_aed) && candidate.price_aed > 0,
  );
  const gallery = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [];
  const safeIndex = gallery.length > 0 ? Math.min(activeImg, gallery.length - 1) : 0;
  const currentImg = gallery[safeIndex];
  const goPrev = () =>
    gallery.length > 0 && setActiveImg((i) => (i - 1 + gallery.length) % gallery.length);
  const goNext = () => gallery.length > 0 && setActiveImg((i) => (i + 1) % gallery.length);
  const variant =
    sellableVariants.find((candidate) => candidate.id === variantId) ?? sellableVariants[0];

  function addSelectedVariant() {
    if (!variant || variant.price_aed <= 0 || !p.seller) return;
    addToCart(
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
      quantity,
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
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted">
              {currentImg && (
                <img
                  key={currentImg}
                  src={currentImg}
                  alt={product.image_alts[safeIndex] || product.name}
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
              )}
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-background"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">
                    {safeIndex + 1} / {gallery.length}
                  </div>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {gallery.map((src, i) => {
                  const active = i === safeIndex;
                  return (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => setActiveImg(i)}
                      aria-label={`Show image ${i + 1}`}
                      aria-current={active}
                      className={`overflow-hidden rounded-xl border bg-muted transition ${active ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/40"}`}
                    >
                      <img
                        src={src}
                        alt={product.image_alts[i] || `${product.name}, image ${i + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Sold by CornerMex
            </div>
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {product.origin_region && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {product.origin_region}
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
                AED {variant.price_aed.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              AED price shown for the selected variant; current price and availability are verified
              at checkout.
            </p>
            {variant.label && (
              <p className="mt-1 text-sm text-muted-foreground">
                {variant.label} · SKU {variant.sku}
              </p>
            )}

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {productCopyToPlainText(product.seo?.short_description || product.description)}
            </p>

            {sellableVariants.length > 1 && (
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Format</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sellableVariants.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => setVariantId(candidate.id)}
                      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${(variantId ?? sellableVariants[0].id) === candidate.id ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-border">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="min-h-11 px-4 text-muted-foreground hover:text-foreground"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="min-w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(500, value + 1))}
                  className="min-h-11 px-4 text-muted-foreground hover:text-foreground"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <Button
                type="button"
                size="lg"
                className="flex-1 rounded-full"
                disabled={!variant || variant.price_aed <= 0 || !p.seller}
                onClick={addSelectedVariant}
              >
                <ShoppingBag className="me-2 h-4 w-4" /> Add to cart
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                Signed-in customers can place cash-on-delivery orders. Current price, availability
                and shipping are verified before submission.
              </p>
              <a href={mailto(PUBLIC_CONTACT.b2b, `CornerMex quote enquiry: ${p.name}`)}>
                <Button size="lg" className="mt-4 rounded-full">
                  <Mail className="me-2 h-4 w-4" /> Request manual quote
                </Button>
              </a>
            </div>

            <TrustBar context="b2c" className="mt-6" />
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
            {productCopyToPlainText(product.seo?.long_description || product.description)}
          </p>
          <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
            {publicBrand && (
              <div>
                <dt className="text-muted-foreground">Brand</dt>
                <dd className="mt-1 font-medium">{publicBrand}</dd>
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
      </section>
    </SiteLayout>
  );
}
