import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Check, PackageOpen, Sparkles } from "lucide-react";
import { AddToCartPrompt, StoreFooter, StoreHeader } from "@/components/Storefront";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/shop";
import { trpc } from "@/lib/trpc";

export default function ProductDetail() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId ?? "";
  const productQuery = trpc.shop.product.useQuery({ publicId }, { enabled: /^[A-Za-z0-9]{12}$/.test(publicId) });
  const product = productQuery.data;
  const [selectedOption, setSelectedOption] = useState("");
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return <div className="shop-page"><StoreHeader /><main className="detail-main">
    <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to the shop</Link>
    {productQuery.isLoading ? <div className="detail-skeleton" /> : productQuery.isError || !product ? <div className="catalog-empty detail-not-found"><PackageOpen size={30} /><h2>This little find has moved on</h2><p>It may no longer be available. Browse the rest of the collection.</p><Link className="button button-primary" href="/">Explore the shop</Link></div> : <div className="product-detail">
      <div className="detail-image"><img src={product.imageUrl} alt={product.name} /><span className="image-flower">✿</span></div>
      <div className="detail-copy"><span className="eyebrow">{product.category} · A LITTLE BAZAAR FIND</span><h1>{product.name}</h1><div className="detail-price">{formatINR(product.price)}</div><div className="detail-rule" /><p className="detail-description">{product.description}</p>
        {product.options.length > 0 && <label className="option-select">Choose an option<select value={selectedOption} onChange={event => setSelectedOption(event.target.value)}><option value="">Select one</option>{product.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>}
        <div className="availability"><span className={product.stock > 0 ? "availability-dot" : "availability-dot unavailable"} />{product.stock > 0 ? `${product.stock} available` : "Currently unavailable"}</div>
        <button className="button button-primary detail-add" disabled={product.stock < 1 || (product.options.length > 0 && !selectedOption)} onClick={() => { add(product, selectedOption || undefined); setAdded(true); }}>{product.stock > 0 ? "Add to bag" : "Sold out"}<span>→</span></button>
        <div className="detail-assurances"><div><Check size={16} /><span>Clear prices<br /><small>No hidden extras</small></span></div><div><Sparkles size={16} /><span>A thoughtful pick<br /><small>From a small seller</small></span></div></div>
        <p className="detail-payment">Cash on delivery · Pay when your order arrives</p>
      </div>
    </div>}
    {added && <AddToCartPrompt onClose={() => setAdded(false)} />}
  </main><StoreFooter /></div>;
}
