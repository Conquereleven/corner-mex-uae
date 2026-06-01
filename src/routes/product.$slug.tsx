import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Flame, MapPin, ShieldCheck, Star } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { ProductReviews } from "@/components/site/ProductReviews";
import { WishlistButton } from "@/components/site/WishlistButton";
import { getProduct } from "@/lib/catalog.functions";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$slug")({
  head: () => ({ meta: [{ title: "Product — Corner Mex" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "es" | "ar";
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const add = useCart((s) => s.add);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug, lang],
    queryFn: () => getProduct({ data: { slug, lang } }),
  });

  if (isLoading) {
    return <SiteLayout><div className="mx-auto max-w-7xl px-4 py-20"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div></SiteLayout>;
  }
  if (!product) {
    throw notFound();
  }
  const p = product;
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images,
    brand: p.brand ?? p.seller?.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "AED",
      price: p.price_aed,
      availability: (p.variants[0]?.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(p.rating_count > 0 && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating_avg, reviewCount: p.rating_count },
    }),
  };

  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  const hasDiscount = variant?.compare_at_price_aed && variant.compare_at_price_aed > variant.price_aed;

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav className="text-xs text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          {product.category && <> · <span>{product.category.name}</span></>}
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-muted">
              {product.image && <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(0, 4).map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-border bg-muted">
                    <img src={src} alt="" className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {product.seller && (
              <Link to="/sellers/$slug" params={{ slug: product.seller.slug }} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {product.seller.name}
              </Link>
            )}
            <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">{product.name}</h1>

            {product.rating_count > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-medium text-foreground">{product.rating_avg.toFixed(1)}</span>
                <span>· {product.rating_count} review{product.rating_count === 1 ? "" : "s"}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {product.origin_region && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {product.origin_region}</span>}
              {product.is_halal && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Halal-friendly</span>}
              {product.spice_level && product.spice_level > 0 && (
                <span className="inline-flex items-center gap-1 text-primary">
                  {Array.from({ length: Math.min(product.spice_level, 4) }).map((_, i) => <Flame key={i} className="h-3 w-3 fill-current" />)}
                </span>
              )}
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-3xl font-semibold">AED {variant?.price_aed.toFixed(0)}</span>
              {hasDiscount && <span className="text-base text-muted-foreground line-through">AED {variant!.compare_at_price_aed!.toFixed(0)}</span>}
            </div>
            {variant?.label && <p className="mt-1 text-sm text-muted-foreground">{variant.label} · SKU {variant.sku}</p>}

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">{product.description}</p>

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
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-muted-foreground hover:text-foreground">−</button>
                <span className="min-w-6 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty((q) => Math.min((variant?.stock ?? 99), q + 1))} className="text-muted-foreground hover:text-foreground">+</button>
              </div>
              <Button onClick={addToCart} size="lg" className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90">
                Add to cart · AED {((variant?.price_aed ?? 0) * qty).toFixed(0)}
              </Button>
              <WishlistButton productId={p.id} size="lg" />
            </div>
            {variant && variant.stock < 20 && variant.stock > 0 && (
              <p className="mt-3 text-xs text-primary">Only {variant.stock} left in stock.</p>
            )}
          </div>
        </div>

        <ProductReviews productId={p.id} />
      </section>
    </SiteLayout>
  );
}