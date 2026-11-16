import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "wouter";
import { TRPCClientError } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { Archive, ArrowLeft, ClipboardList, ImagePlus, LogIn, LogOut, Package, Plus, ShieldCheck, Sparkles, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatINR } from "@/lib/shop";
import { getErrorMessage } from "@/lib/errorMessage";

const statuses = ["new", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = typeof statuses[number];

function isForbidden(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === "FORBIDDEN";
}

async function readProductImage(file: File) {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
  if (original.length <= 3_500_000) return original;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not process the image."));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Admin() {
  const auth = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [section, setSection] = useState<"products" | "orders">("products");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const productsQuery = trpc.shop.admin.products.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const ordersQuery = trpc.shop.admin.orders.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const utils = trpc.useUtils();
  const loginAdmin = trpc.auth.loginAdmin.useMutation({
    onSuccess: async () => { setLoginPassword(""); toast.success("You’re signed in to your shop"); await utils.auth.me.invalidate(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const saveProduct = trpc.shop.admin.saveProduct.useMutation({
    onSuccess: async () => { toast.success(editingId ? "Product updated" : "Product added to your shop"); setEditorOpen(false); await Promise.all([utils.shop.admin.products.invalidate(), utils.shop.catalog.invalidate()]); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const setProductVisibility = trpc.shop.admin.setProductVisibility.useMutation({
    onSuccess: async (_result, variables) => { toast.success(variables.isActive ? "Product restored to your shop" : "Product hidden from your shop"); await Promise.all([utils.shop.admin.products.invalidate(), utils.shop.catalog.invalidate()]); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const deleteProduct = trpc.shop.admin.deleteProduct.useMutation({
    onSuccess: async () => { toast.success("Product deleted from your shop"); await Promise.all([utils.shop.admin.products.invalidate(), utils.shop.catalog.invalidate()]); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const updateStatus = trpc.shop.admin.updateOrderStatus.useMutation({
    onSuccess: async () => { toast.success("Order status updated"); await utils.shop.admin.orders.invalidate(); },
    onError: error => toast.error(getErrorMessage(error)),
  });
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const activeProducts = products.filter(product => product.isActive);
  const awaiting = orders.filter(order => order.status === "new" || order.status === "confirmed").length;
  const revenue = orders.filter(order => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0);
  const denied = isForbidden(productsQuery.error) || isForbidden(ordersQuery.error);
  const dataError = !denied && (productsQuery.error || ordersQuery.error);

  function openEditor(product?: NonNullable<typeof productsQuery.data>[number]) {
    setEditingId(product?.id ?? null);
    setEditorOpen(true);
  }

  function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginAdmin.mutate({ email: loginEmail, password: loginPassword });
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const image = form.get("image");
    let imageUrl = String(form.get("imageUrl") ?? "").trim();
    if (image instanceof File && image.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
        toast.error("Choose a JPG, PNG, WEBP or GIF image.");
        return;
      }
      if (image.size > 3 * 1024 * 1024) {
        toast.error("Image must be 3 MB or smaller.");
        return;
      }
      const originalData = await readProductImage(image).catch(() => "");
      if (!originalData) {
        toast.error("Could not read the image. Please try again.");
        return;
      }
      try {
        imageUrl = originalData;
      } catch (error) {
        toast.error(getErrorMessage(error, "Image upload failed."));
        return;
      }
    }
    if (!imageUrl) {
      toast.error("Please choose a product image.");
      return;
    }
    saveProduct.mutate({
      id: editingId ?? undefined,
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? ""),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      imageUrl,
      description: String(form.get("description") ?? ""),
      options: String(form.get("options") ?? "").split("\n").map(option => option.trim()).filter(Boolean),
    });
  }

  return <div className={`admin-page ${auth.isAuthenticated ? "" : "admin-page-gate"}`}>
    {auth.isAuthenticated && <aside className="admin-sidebar">
      <Link href="/" className="brand-lockup admin-brand"><span className="brand-mark"><i /><i /><i /><i /></span><span className="brand-name">little bazaar<span>.</span></span></Link>
      <div className="sidebar-label">SELLER DESK</div>
      <button className={`sidebar-item ${section === "products" ? "selected" : ""}`} onClick={() => setSection("products")}><Package size={18} /> Products <span>{activeProducts.length}</span></button>
      <button className={`sidebar-item ${section === "orders" ? "selected" : ""}`} onClick={() => setSection("orders")}><ClipboardList size={18} /> Orders {awaiting > 0 && <span className="new-order-count">{awaiting}</span>}</button>
      <div className="sidebar-spacer" />
      <div className="seller-profile"><div className="profile-avatar">{auth.user?.name?.slice(0, 1) || "S"}</div><div><b>{auth.user?.name || "Store owner"}</b><small>Shop owner</small></div><button aria-label="Sign out" title="Sign out" onClick={() => void auth.logout()}><LogOut size={16} /></button></div>
    </aside>}

    <main className="admin-main">
      <div className="admin-topline"><Link href="/" className="admin-back"><ArrowLeft size={15} /> View storefront</Link><div><span className="online-dot" /> Your seller desk</div></div>
      {!auth.isAuthenticated && !auth.loading ? <section className="admin-gate"><div className="gate-icon"><ShieldCheck size={28} /></div><span className="eyebrow">OWNER ACCESS</span><h1>Your shop, your way.</h1><p>Sign in with the shop owner email and password to add products and manage customer orders.</p><form className="admin-login-form" onSubmit={onLogin}><label>Email address<input type="email" required maxLength={320} autoComplete="username" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" required maxLength={128} autoComplete="current-password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="Enter your password" /></label>{loginAdmin.error && <p className="login-error" role="alert">{getErrorMessage(loginAdmin.error)}</p>}<button className="button button-primary full" type="submit" disabled={loginAdmin.isPending}><LogIn size={17} /> {loginAdmin.isPending ? "Signing in…" : "Sign in to manage your shop"}</button></form><Link href="/" className="gate-home">Back to the storefront</Link></section> : null}
      {auth.loading && <div className="admin-loading"><div className="spinner" /> Checking owner access…</div>}
      {auth.isAuthenticated && denied && <section className="admin-gate"><div className="gate-icon"><ShieldCheck size={28} /></div><span className="eyebrow">OWNER ACCESS</span><h1>Only the shop owner can open this desk.</h1><p>This account isn’t linked to the store owner email. If you have just configured the owner address, sign out and back in with that same account.</p><button className="button button-outline" onClick={() => void auth.logout()}><LogOut size={16} /> Sign out and switch account</button><Link href="/" className="gate-home">Back to the storefront</Link></section>}
      {auth.isAuthenticated && dataError && <section className="admin-gate"><div className="gate-icon"><Package size={28} /></div><span className="eyebrow">STORE DATA</span><h1>Store data could not load.</h1><p>{dataError.message || "Check the MongoDB connection and try again."}</p><button className="button button-primary" onClick={() => { void productsQuery.refetch(); void ordersQuery.refetch(); }}>Try again</button></section>}
      {auth.isAuthenticated && !denied && !dataError && <>
        <header className="admin-heading"><div><span className="eyebrow">YOUR STORE AT A GLANCE</span><h1>Good morning{auth.user?.name ? `, ${auth.user.name.split(" ")[0]}` : ""} <Sparkles size={18} aria-hidden="true" /></h1><p>A little care goes a long way. Here's how your shop is doing.</p></div>{section === "products" && <button className="button button-primary" onClick={() => openEditor()}><Plus size={17} /> Add a product</button>}</header>
        <div className="admin-stats">
          <div className="stat-card"><span className="stat-icon rose"><Package size={18} /></span><div><small>LIVE PRODUCTS</small><strong>{productsQuery.isLoading ? "—" : activeProducts.length}</strong><span>available in your shop</span></div></div>
          <div className="stat-card"><span className="stat-icon peach"><ClipboardList size={18} /></span><div><small>ORDERS TO CHECK</small><strong>{ordersQuery.isLoading ? "—" : awaiting}</strong><span>new or being confirmed</span></div></div>
          <div className="stat-card"><span className="stat-icon yellow">₹</span><div><small>ORDER TOTALS</small><strong>{ordersQuery.isLoading ? "—" : formatINR(revenue)}</strong><span>excludes cancelled orders</span></div></div>
        </div>
        <section className="admin-content-card">
          <div className="admin-content-head"><div><div className="admin-tabs"><button onClick={() => setSection("products")} className={section === "products" ? "active" : ""}>Products</button><button onClick={() => setSection("orders")} className={section === "orders" ? "active" : ""}>Orders{awaiting > 0 && <span className="tab-count">{awaiting}</span>}</button></div><p>{section === "products" ? "Keep your little collection up to date." : "Every order, all in one place."}</p></div>{section === "products" && <button className="button button-outline compact-add" onClick={() => openEditor()}><Plus size={16} /> Add product</button>}</div>
          {section === "products" ? <ProductList products={products} loading={productsQuery.isLoading} onEdit={openEditor} onVisibility={(id, isActive) => { if (isActive || window.confirm("Hide this product from the storefront? Existing order history will be kept.")) setProductVisibility.mutate({ id, isActive }); }} onDelete={id => { if (window.confirm("Delete this product permanently? Existing order history will be kept.")) deleteProduct.mutate({ id }); }} /> : <OrderList orders={orders} loading={ordersQuery.isLoading} onStatus={(id, status) => updateStatus.mutate({ id, status })} />}
        </section>
        <div className="admin-help"><Store size={16} /> Your store data is saved securely. Hidden products remain in the history of orders they were part of.</div>
      </>}
    </main>
    {editorOpen && <ProductEditor product={products.find(product => product.id === editingId)} pending={saveProduct.isPending} onClose={() => setEditorOpen(false)} onSave={onSave} />}
  </div>;
}

type Product = inferRouterOutputs<AppRouter>["shop"]["admin"]["products"][number];

function ProductList({ products, loading, onEdit, onVisibility, onDelete }: { products: Product[]; loading: boolean; onEdit: (product?: Product) => void; onVisibility: (id: number, isActive: boolean) => void; onDelete: (id: number) => void }) {
  if (loading) return <div className="admin-empty">Loading your products…</div>;
  if (products.length === 0) return <div className="admin-empty"><div className="empty-parcel small-parcel"><Package size={25} /></div><h3>Your shop is ready for its first find</h3><p>Add a product with a photo, price, and a few details. It will appear in the storefront right away.</p><button className="button button-primary" onClick={() => onEdit()}><Plus size={16} /> Add your first product</button></div>;
  return <div className="product-admin-list">{products.map(product => <article className={`product-admin-row ${!product.isActive ? "archived" : ""}`} key={product.id}>
    <img src={product.imageUrl} alt="" /><div className="admin-product-info"><strong>{product.name}</strong><span>{product.category} <i>·</i> {formatINR(product.price)}</span></div><div className="admin-stock"><b>{product.stock}</b><small>in stock</small></div><span className={`status-pill ${product.isActive ? "status-live" : "status-cancelled"}`}>{product.isActive ? "Live" : "Hidden"}</span><div className="row-actions"><button onClick={() => onEdit(product)}>Edit</button><button className={product.isActive ? "archive-action" : "restore-action"} onClick={() => onVisibility(product.id, !product.isActive)} title={product.isActive ? "Hide product" : "Restore product"}>{product.isActive ? <Archive size={15} /> : "Restore"}</button><button className="delete-action" onClick={() => onDelete(product.id)} title="Delete product" aria-label={`Delete ${product.name}`}><Trash2 size={15} /></button></div>
  </article>)}</div>;
}

type AdminOrder = inferRouterOutputs<AppRouter>["shop"]["admin"]["orders"][number];
function OrderList({ orders, loading, onStatus }: { orders: AdminOrder[]; loading: boolean; onStatus: (id: number, status: OrderStatus) => void }) {
  if (loading) return <div className="admin-empty">Loading your orders…</div>;
  if (orders.length === 0) return <div className="admin-empty"><div className="empty-parcel small-parcel"><ClipboardList size={25} /></div><h3>No orders to show just yet</h3><p>When a customer places an order, you’ll find their details and items here.</p></div>;
  return <div className="orders-list">{orders.map(order => <article className="order-card" key={order.id}>
    <div className="order-card-top"><div><span className="order-number">{order.orderNumber}</span><small>{new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small></div><label className="status-select"><span className={`status-dot status-${order.status}`} /><select value={order.status} aria-label={`Status for order ${order.orderNumber}`} onChange={event => onStatus(order.id, event.target.value as OrderStatus)}>{statuses.map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label></div>
    <div className="order-card-content"><div className="order-customer"><b>{order.customerName}</b><a href={`tel:${order.phone}`}>{order.phone}</a>{order.email && <span>{order.email}</span>}<p>{order.address}<br />{order.city}, {order.pincode}</p>{order.notes && <small className="order-note">Note: {order.notes}</small>}</div><div className="order-items">{order.items.map(item => <div key={item.id}><span>{item.quantity} × {item.productName}{item.selectedOption ? ` · ${item.selectedOption}` : ""}</span><b>{formatINR(item.unitPrice * item.quantity)}</b></div>)}<div className="order-total"><span>Cash on delivery</span><strong>{formatINR(order.total)}</strong></div></div></div>
  </article>)}</div>;
}

function ProductEditor({ product, pending, onClose, onSave }: { product?: Product; pending: boolean; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const [preview, setPreview] = useState(product?.imageUrl ?? "");

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <div className="editor-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2 id="editor-title">{product ? "A little update" : "Add a new find"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close editor"><X size={19} /></button></div>
    <form onSubmit={onSave} className="editor-form">
      <label>Product name<input name="name" required minLength={2} maxLength={255} defaultValue={product?.name ?? ""} placeholder="e.g. Everyday cotton kurta" /></label>
      <div className="form-row"><label><span>Category</span><input name="category" required defaultValue={product?.category ?? ""} placeholder="e.g. Clothing" /></label><label><span>Price <small>(₹)</small></span><input name="price" type="number" required min={1} step={1} defaultValue={product?.price ?? ""} placeholder="499" /></label></div>
      <div className="form-row"><label>Stock available<input name="stock" type="number" required min={0} step={1} defaultValue={product?.stock ?? 1} /></label><label>Product image<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!product} onChange={onImageChange} /><small>JPG, PNG, WEBP or GIF · max 3 MB{product ? " · leave empty to keep current image" : ""}</small></label></div>
      {preview && <div className="image-preview"><img src={preview} alt="Product preview" /><span>Preview</span></div>}
      <input name="imageUrl" type="hidden" defaultValue={product?.imageUrl ?? ""} />
      <label>Description<textarea name="description" rows={3} required minLength={5} defaultValue={product?.description ?? ""} placeholder="A few helpful details for shoppers" /></label>
      <label>Options <small>(optional, one per line)</small><textarea name="options" rows={3} defaultValue={product?.options.join("\n") ?? ""} placeholder={"Small\nMedium\nLarge"} /><span className="field-help">Add sizes, colours or other choices customers can select.</span></label>
      <div className="editor-footer"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Saving…" : product ? "Save changes" : "Add to storefront"}</button></div>
    </form>
  </section></div>;
}
