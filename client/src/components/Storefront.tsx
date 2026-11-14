import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/shop";
import { getErrorMessage } from "@/lib/errorMessage";

export function StoreHeader() {
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  useEffect(() => {
    const openCheckout = () => { setCheckoutRequested(true); setCartOpen(true); };
    window.addEventListener("open-cart-checkout", openCheckout);
    return () => window.removeEventListener("open-cart-checkout", openCheckout);
  }, []);
  return <>
    <div className="announcement">Little finds, lovely prices <span>•</span> Thoughtfully picked for you</div>
    <header className="store-header">
      <div className="store-header-inner">
        <Link href="/" className="brand-lockup" aria-label="Little Bazaar home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brand-name">little bazaar<span>.</span></span>
        </Link>
        <nav className="store-nav" aria-label="Main navigation">
          <Link href="/#shop">Shop all</Link>
          <Link href="/#categories">Categories</Link>
        </nav>
        <div className="header-actions"><Link href="/account" className="account-link">Account</Link>
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${count} items`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
            <span>Bag</span><b>{count}</b>
          </button>
        </div>
      </div>
    </header>
    {cartOpen && <CartDrawer startCheckout={checkoutRequested} onClose={() => { setCartOpen(false); setCheckoutRequested(false); }} />}
  </>;
}

export function AddToCartPrompt({ productId, option, onClose }: { productId: number; option?: string; onClose: () => void }) {
  const cart = useCart();
  const line = cart.lines.find(item => item.id === productId && item.option === option);
  if (!line) return null;
  return <div className="add-cart-prompt"><div><strong>Added to your bag</strong><small>{line.name}</small></div><div className="prompt-quantity" aria-label={`Quantity for ${line.name}`}><button onClick={() => cart.setQuantity(line.id, line.option, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Decrease quantity">−</button><b>{line.quantity}</b><button onClick={() => cart.setQuantity(line.id, line.option, line.quantity + 1)} disabled={line.quantity >= line.stock} aria-label="Increase quantity">+</button></div><button className="button button-primary" onClick={() => window.dispatchEvent(new Event("open-cart-checkout"))}>Continue to checkout</button><button className="prompt-close" onClick={onClose} aria-label="Close">×</button></div>;
}

export function StoreFooter() {
  return <footer className="store-footer"><div className="footer-brand"><span className="brand-mark small"><i /><i /><i /><i /></span> little bazaar</div><p>Good finds, shared with care.</p><span>Cash on delivery · Your order details stay private</span></footer>;
}

function CartDrawer({ onClose, startCheckout }: { onClose: () => void; startCheckout?: boolean }) {
  const cart = useCart();
  const [checkout, setCheckout] = useState(Boolean(startCheckout));
  const [completeOrder, setCompleteOrder] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const placeOrder = trpc.shop.placeOrder.useMutation({
    onSuccess: result => {
      cart.clear();
      setCompleteOrder(result.orderNumber);
      setCheckout(false);
      void utils.shop.catalog.invalidate();
    },
    onError: error => toast.error(getErrorMessage(error, "We couldn't place that order. Please check your details and try again.")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    placeOrder.mutate({
      customerName: String(form.get("customerName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      address: String(form.get("address") ?? ""),
      city: String(form.get("city") ?? ""),
      pincode: String(form.get("pincode") ?? ""),
      notes: String(form.get("notes") ?? ""),
      items: cart.lines.map(line => ({ productId: line.id, quantity: line.quantity, option: line.option })),
    });
  }

  return <div className="drawer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <div className="drawer-heading"><div><span className="eyebrow">YOUR LITTLE FINDS</span><h2>{completeOrder ? "Order placed" : checkout ? "Delivery details" : "Your bag"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close bag">×</button></div>
      {completeOrder ? <div className="order-success"><div className="success-mark">✓</div><h3>Thank you for your order!</h3><p>Your order number is <strong>{completeOrder}</strong>. The seller will confirm it soon.</p><p className="muted">Payment is due on delivery.</p><button className="button button-primary full" onClick={onClose}>Continue shopping</button></div> : cart.lines.length === 0 ? <div className="empty-bag"><div className="empty-icon">♡</div><h3>Your bag is taking a little break</h3><p>When you find something you love, it’ll be right here.</p><button className="button button-primary" onClick={onClose}>Explore the shop</button></div> : checkout ? <form className="checkout-form" onSubmit={submit}>
        <div className="checkout-summary"><span>{cart.count} {cart.count === 1 ? "item" : "items"}</span><strong>{formatINR(cart.total)}</strong></div>
        <label>Full name<input name="customerName" required minLength={2} autoComplete="name" placeholder="Your name" /></label>
        <div className="form-row"><label>Phone number<input name="phone" required minLength={7} autoComplete="tel" placeholder="10-digit number" /></label><label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label></div>
        <label>Delivery address<textarea name="address" required minLength={5} autoComplete="street-address" rows={3} placeholder="House, street, area" /></label>
        <div className="form-row"><label>City<input name="city" required autoComplete="address-level2" placeholder="City" /></label><label>PIN code<input name="pincode" required minLength={4} autoComplete="postal-code" placeholder="PIN code" /></label></div>
        <label>Note for the seller <small>(optional)</small><textarea name="notes" rows={2} placeholder="Anything we should know?" /></label>
        <div className="payment-note"><span>◉</span><div><strong>Cash on delivery</strong><small>Pay when your order reaches you.</small></div></div>
        <button className="button button-primary full" type="submit" disabled={placeOrder.isPending}>{placeOrder.isPending ? "Placing your order…" : `Place order · ${formatINR(cart.total)}`}</button>
        <button type="button" className="text-button full" onClick={() => setCheckout(false)}>Back to bag</button>
      </form> : <>
        <div className="cart-lines">{cart.lines.map(line => <div className="cart-line" key={`${line.id}-${line.option ?? ""}`}>
          <img src={line.imageUrl} alt="" />
          <div className="cart-line-info"><Link href={`/product/${line.id}`} onClick={onClose}>{line.name}</Link>{line.option && <small>{line.option}</small>}<strong>{formatINR(line.price)}</strong>
            <div className="quantity-stepper"><button onClick={() => line.quantity === 1 ? cart.remove(line.id, line.option) : cart.setQuantity(line.id, line.option, line.quantity - 1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button disabled={line.quantity >= line.stock} onClick={() => cart.setQuantity(line.id, line.option, line.quantity + 1)} aria-label="Increase quantity">+</button></div>
          </div><button className="remove-line" onClick={() => cart.remove(line.id, line.option)} aria-label={`Remove ${line.name}`}>×</button>
        </div>)}</div>
        <div className="cart-bottom"><div className="subtotal"><span>Subtotal</span><strong>{formatINR(cart.total)}</strong></div><p>Delivery arrangements will be confirmed with you.</p><button className="button button-primary full" onClick={() => setCheckout(true)}>Continue to checkout <span>→</span></button><button className="text-button full" onClick={onClose}>Keep browsing</button></div>
      </>}
    </aside>
  </div>;
}
