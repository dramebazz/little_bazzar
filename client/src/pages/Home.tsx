import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, ArrowUpRight, Sparkles, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/shop";
import { AddToCartPrompt, StoreFooter, StoreHeader } from "@/components/Storefront";

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const products = trpc.shop.catalog.useQuery({ search: search || undefined, category: category === "All" ? undefined : category });
  const { add } = useCart();
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const categories = useMemo(() => ["All", ...new Set((products.data ?? []).map(item => item.category))], [products.data]);

  return <div className="shop-page">
    <StoreHeader />
    <main>
      <section className="hero-wrap">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> YOUR HAPPY LITTLE FINDS</div>
          <h1>Good finds.<br /><em>Good feelings.</em></h1>
          <p>A little of everything, picked with care. Meet the small joys that make everyday a little brighter.</p>
          <a href="#shop" className="button button-primary hero-cta">Explore the collection <ArrowUpRight size={17} /></a>
          <div className="hero-note"><span>♡</span> Thoughtfully picked, always</div>
        </div>
        <div className="hero-art" aria-label="A cheerful illustrated shopping parcel">
          <div className="sun-disc" />
          <div className="hero-spark spark-one">✳</div><div className="hero-spark spark-two">✦</div><div className="hero-spark spark-three">✳</div>
          <div className="hero-box"><div className="box-flap" /><div className="box-ribbon" /><span className="box-stamp">a little<br />surprise</span></div>
          <div className="hero-orbit orbit-left" /><div className="hero-orbit orbit-right" />
          <div className="hero-caption"><span>THE EVERYDAY EDIT</span><b>little things, lovely things</b></div>
        </div>
      </section>

      <section className="benefit-strip" aria-label="Shop details">
        <div><span className="benefit-icon">♡</span><span><b>Picked with care</b><small>Thoughtful finds for every day</small></span></div>
        <div><span className="benefit-icon">₹</span><span><b>Clear, honest prices</b><small>No surprises at checkout</small></span></div>
        <div><span className="benefit-icon">↗</span><span><b>Easy ordering</b><small>Pay on delivery</small></span></div>
      </section>

      <section id="categories" className="category-intro"><div><span className="eyebrow">A LITTLE SOMETHING FOR EVERYONE</span><h2>Find your next <em>favourite.</em></h2></div><p>Browse at your own pace. Your next everyday essential might be right here.</p></section>

      <section id="shop" className="catalog-section">
        <div className="catalog-toolbar">
          <div className="category-chips">{categories.map(item => <button key={item} className={`category-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <label className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find something lovely" aria-label="Search products" /><kbd>⌕</kbd></label>
        </div>
        {products.isLoading ? <div className="product-grid">{Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={index} />)}</div> : products.isError ? <div className="catalog-empty"><PackageOpen size={28} /><h3>We couldn't load the collection</h3><p>Please try again in a moment.</p><button className="button button-outline" onClick={() => void products.refetch()}>Try again</button></div> : products.data?.length ? <div className="product-grid">{products.data.map((product, index) => <article className="product-card" key={product.id}>
          <Link href={`/product/${product.publicId}`} className="product-image-link">
            <div className={`product-image-frame tone-${index % 4}`}><img src={product.imageUrl} alt={product.name} loading="lazy" /><span className="product-image-heart">♡</span>{product.stock < 1 && <span className="sold-out">Sold out</span>}</div>
          </Link>
          <div className="product-card-body"><div className="product-category">{product.category}</div><Link href={`/product/${product.publicId}`} className="product-title">{product.name}</Link><div className="product-card-bottom"><strong>{formatINR(product.price)}</strong><button className="add-round" disabled={product.stock < 1} onClick={() => { if (product.options.length) { window.location.href = `/product/${product.publicId}`; return; } add(product); setAddedProductId(product.id); }} aria-label={`Add ${product.name} to bag`}>{product.options.length ? "↗" : "+"}</button></div><small className="stock-hint">{product.stock > 0 ? `${product.stock} available` : "Currently unavailable"}</small></div>
        </article>)}</div> : <div className="catalog-empty"><div className="empty-parcel"><span>✳</span><PackageOpen size={33} /></div><span className="eyebrow">A LITTLE SPACE FOR SOMETHING NEW</span><h3>{search ? "No finds just yet" : category !== "All" ? `Nothing in ${category} right now` : "We’re getting the shelves ready"}</h3><p>{search ? "Try another search and see what turns up." : "Our shop is being stocked with lovely finds. Check back soon."}</p>{search && <button className="text-button" onClick={() => setSearch("")}>Clear search</button>}</div>}
        {addedProductId !== null && <AddToCartPrompt productId={addedProductId} onClose={() => setAddedProductId(null)} />}
      </section>

      <section className="seller-note"><div className="note-icon">✿</div><div><span className="eyebrow">A NOTE FROM THE SELLER</span><h2>Small shop.<br /><em>Thoughtful picks.</em></h2><p>Every item here is chosen with a little extra care. Thanks for supporting a small business and making room for something lovely.</p></div><div className="note-doodle">♡<span>made with<br />a little love</span></div></section>
    </main>
    <StoreFooter />
  </div>;
}
