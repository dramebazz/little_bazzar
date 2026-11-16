import { randomBytes } from "node:crypto";
import { MongoClient, type Collection, type ClientSession, type Document } from "mongodb";
import { TRPCError } from "@trpc/server";
import type { CheckoutInput, OrderStatus, ProductInput } from "./shopTypes.js";

export type ProductRecord = {
  id: number; publicId?: string; name: string; description: string; category: string; imageUrl: string;
  price: number; stock: number; options: string[]; isActive: boolean; createdAt: Date; updatedAt: Date;
};
export type OrderItemRecord = {
  id: number; orderId: number; productId: number | null; productName: string; unitPrice: number;
  quantity: number; selectedOption: string | null;
};
export type CustomerOrderItem = OrderItemRecord & {
  imageUrl: string | null; publicId: string | null; isActive: boolean;
};
export type OrderRecord = {
  id: number; orderNumber: string; customerName: string; phone: string; email: string | null;
  address: string; city: string; pincode: string; notes: string | null; status: OrderStatus;
  total: number; createdAt: Date; updatedAt: Date; cancellationReason?: string | null;
};
export type CustomerAccountDoc = {
  _id?: unknown;
  email: string;
  name: string;
  passwordHash: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  createdAt: Date;
  updatedAt: Date;
};
export type ShopOrderStatus = OrderStatus;
type ProductDoc = Omit<ProductRecord, "options"> & { options: string[] };
type OrderDoc = OrderRecord & { items: OrderItemRecord[] };
const PUBLIC_ID_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function createPublicId() {
  const bytes = randomBytes(12);
  return Array.from(bytes, byte => PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length]).join("");
}

let clientPromise: Promise<MongoClient> | undefined;
let indexesPromise: Promise<void> | undefined;
function mongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The store database is unavailable." });
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect().catch((error: unknown) => { clientPromise = undefined; throw error; });
  }
  return clientPromise!;
}
async function collections() {
  const client = await mongoClient();
  const db = client.db();
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection("shop_products").createIndex({ id: 1 }, { unique: true }),
      db.collection("shop_orders").createIndex({ id: 1 }, { unique: true }),
      db.collection("shop_orders").createIndex({ orderNumber: 1 }, { unique: true }),
      db.collection("shop_products").createIndex({ isActive: 1, createdAt: -1 }),
      db.collection("shop_products").createIndex({ publicId: 1 }, { unique: true, sparse: true }),
      db.collection("shop_orders").createIndex({ createdAt: -1 }),
      db.collection("shop_order_items").createIndex({ orderId: 1 }),
      db.collection("customer_accounts").createIndex({ email: 1 }, { unique: true }),
    ]).then(() => undefined).catch(error => { indexesPromise = undefined; throw error; });
  }
  await indexesPromise;
  return {
    client,
    products: db.collection<ProductDoc>("shop_products"),
    orders: db.collection<OrderDoc>("shop_orders"),
    items: db.collection<OrderItemRecord & Document>("shop_order_items"),
    counters: db.collection<{ _id: string; value: number } & Document>("shop_counters"),
    customers: db.collection<CustomerAccountDoc & Document>("customer_accounts"),
  };
}
async function nextId(counters: Collection<{ _id: string; value: number } & Document>, key: string, session?: ClientSession) {
  const result = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", ...(session ? { session } : {}) },
  );
  if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not allocate a store record ID." });
  return result.value;
}
function productShape(doc: ProductDoc): ProductRecord { return { ...doc, options: Array.isArray(doc.options) ? doc.options.filter((x): x is string => typeof x === "string") : [] }; }
function cleanOptions(options: string[]) { return options.map(option => option.trim()).filter(Boolean); }
function unavailable() { return new TRPCError({ code: "BAD_REQUEST", message: "A product in your bag is no longer available. Please refresh your bag." }); }

export async function listCatalog(search?: string, category?: string) {
  const client = await mongoClient();
  const products = client.db().collection<ProductDoc>("shop_products");
  const filter: Document = { isActive: true };
  if (category && category !== "All") filter.category = category;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const rows = await products.find(filter).sort({ createdAt: -1 }).toArray();
  for (const row of rows) if (!row.publicId) {
    const publicId = createPublicId();
    await products.updateOne({ id: row.id, publicId: { $exists: false } }, { $set: { publicId } });
    row.publicId = publicId;
  }
  return rows.map(productShape);
}
export async function listCategories() {
  const client = await mongoClient();
  const products = client.db().collection<ProductDoc>("shop_products");
  const categories = await products.distinct("category", { isActive: true });
  return categories.filter((category): category is string => typeof category === "string" && category.length > 0).sort();
}
export async function findProductByPublicId(publicId: string) {
  const client = await mongoClient();
  const products = client.db().collection<ProductDoc>("shop_products");
  const product = await products.findOne({ publicId, isActive: true });
  return product ? productShape(product) : null;
}
export const findProduct = findProductByPublicId;
export async function listAdminProducts() {
  const { products } = await collections();
  const rows = await products.find({}).sort({ updatedAt: -1 }).toArray();
  for (const row of rows) if (!row.publicId) {
    const publicId = createPublicId();
    await products.updateOne({ id: row.id, publicId: { $exists: false } }, { $set: { publicId } });
    row.publicId = publicId;
  }
  return rows.map(productShape);
}
export async function findCustomer(email: string) {
  const { customers } = await collections();
  return customers.findOne({ email: email.trim().toLowerCase() });
}
export async function createCustomer(input: Omit<CustomerAccountDoc, "_id" | "createdAt" | "updatedAt">) {
  const { customers } = await collections();
  const now = new Date();
  const account = { ...input, createdAt: now, updatedAt: now };
  await customers.insertOne(account);
  return account;
}
export async function updateCustomerPassword(email: string, passwordHash: string) {
  const { customers } = await collections();
  await customers.updateOne({ email: email.trim().toLowerCase() }, { $set: { passwordHash, updatedAt: new Date() } });
}
export async function listCustomerOrders(email: string) {
  const { orders, items, products } = await collections();
  const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const allOrders = await orders.find({ email: { $regex: `^${escapedEmail}$`, $options: "i" } }).sort({ createdAt: -1 }).toArray();
  if (allOrders.length === 0) return [];
  const allItems = await items.find({ orderId: { $in: allOrders.map(order => order.id) } }).toArray();
  const productIds = allItems.flatMap(item => item.productId === null ? [] : [item.productId]);
  const productLinks = new Map((await products.find({ id: { $in: productIds } }).project({ id: 1, publicId: 1, imageUrl: 1, isActive: 1 }).toArray()).map(product => [product.id, product]));
  const grouped = new Map<number, CustomerOrderItem[]>();
  for (const item of allItems) {
    const product = item.productId === null ? undefined : productLinks.get(item.productId);
    grouped.set(item.orderId, [...(grouped.get(item.orderId) ?? []), {
      ...item,
      imageUrl: product?.imageUrl ?? null,
      publicId: product?.publicId ?? null,
      isActive: product?.isActive ?? false,
    }]);
  }
  return allOrders.map(({ _id: _orderId, items: _embeddedItems, ...order }) => ({ ...order, items: grouped.get(order.id) ?? [] }));
}
export async function saveProduct(input: ProductInput & { id?: number }) {
  const { products, counters } = await collections();
  const now = new Date();
  const values = { name: input.name.trim(), description: input.description.trim(), category: input.category.trim(), imageUrl: input.imageUrl.trim(), price: input.price, stock: input.stock, options: cleanOptions(input.options), updatedAt: now };
  if (input.id) {
    const result = await products.findOneAndUpdate({ id: input.id }, { $set: values }, { returnDocument: "after" });
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
    return productShape(result);
  }
  const id = await nextId(counters, "product");
  const inserted: ProductDoc = { id, publicId: createPublicId(), ...values, isActive: true, createdAt: now };
  await products.insertOne(inserted);
  return productShape(inserted);
}
export async function setProductVisibility(id: number, isActive: boolean) {
  const { products } = await collections();
  await products.updateOne({ id }, { $set: { isActive, updatedAt: new Date() } });
  return { success: true } as const;
}
export async function deleteProduct(id: number) {
  const { products } = await collections();
  const result = await products.deleteOne({ id });
  if (result.deletedCount !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
  return { success: true } as const;
}
export async function listOrders() {
  const { orders, items } = await collections();
  const [allOrders, allItems] = await Promise.all([orders.find({}).sort({ createdAt: -1 }).toArray(), items.find({}).toArray()]);
  const grouped = new Map<number, OrderItemRecord[]>();
  for (const item of allItems) grouped.set(item.orderId, [...(grouped.get(item.orderId) ?? []), item]);
  return allOrders.map(({ _id: _orderId, ...order }) => ({ ...order, cancellationReason: order.cancellationReason ?? null, items: grouped.get(order.id) ?? [] }));
}
export async function placeOrder(input: CheckoutInput) {
  const { client, products, orders, items, counters } = await collections();
  const quantities = new Map<number, number>();
  for (const line of input.items) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  const session = client.startSession();
  let result!: { orderNumber: string; total: number };
  try {
    await session.withTransaction(async () => {
      const found = await products.find({ id: { $in: [...quantities.keys()] } }, { session }).toArray();
      const byId = new Map<number, ProductDoc>(found.map(product => [product.id, product] as [number, ProductDoc]));
      const snapshots = input.items.map(line => {
        const product = byId.get(line.productId);
        if (!product || !product.isActive) throw unavailable();
        const quantity = quantities.get(line.productId) ?? 0;
        if (product.stock < quantity) throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} does not have enough stock for that quantity.` });
        if (product.options.length > 0 && (!line.option || !product.options.includes(line.option))) throw new TRPCError({ code: "BAD_REQUEST", message: `Please choose an available option for ${product.name}.` });
        if (product.options.length === 0 && line.option) throw new TRPCError({ code: "BAD_REQUEST", message: `Please refresh your bag and try ${product.name} again.` });
        return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: line.quantity, selectedOption: line.option ?? null };
      });
      // Conditional decrements prevent overselling; transaction aborts all stock changes if any line races.
      for (const [productId, quantity] of quantities) {
        const update = await products.updateOne({ id: productId, isActive: true, stock: { $gte: quantity } }, { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } }, { session });
        if (update.modifiedCount !== 1) {
          const latest = await products.findOne({ id: productId }, { session });
          if (!latest || !latest.isActive) throw unavailable();
          throw new TRPCError({ code: "BAD_REQUEST", message: `${latest.name} does not have enough stock for that quantity.` });
        }
      }
      const now = new Date();
      const orderId = await nextId(counters, "order", session);
      const orderNumber = `LB-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const total = snapshots.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const order: OrderDoc = { id: orderId, orderNumber, customerName: input.customerName.trim(), phone: input.phone.trim(), email: input.email?.trim().toLowerCase() || null, address: input.address.trim(), city: input.city.trim(), pincode: input.pincode.trim(), notes: input.notes?.trim() || null, status: "new", total, createdAt: now, updatedAt: now, items: [] };
      await orders.insertOne(order, { session });
      const itemRows = [];
      for (const line of snapshots) itemRows.push({ id: await nextId(counters, "orderItem", session), orderId, ...line });
      await items.insertMany(itemRows, { session });
      result = { orderNumber, total };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return result;
  } finally { await session.endSession(); }
}
export async function updateOrderStatus(id: number, status: OrderStatus, customerEmail?: string, cancellationReason?: string): Promise<OrderRecord> {
  const { client, products, orders, items } = await collections();
  const session = client.startSession();
  let updated: OrderRecord | null = null;
  try {
    await session.withTransaction(async () => {
      const current = await orders.findOne(customerEmail ? { id, email: customerEmail.trim().toLowerCase() } : { id }, { session });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      if (status === "cancelled" && !["new", "confirmed", "packed"].includes(current.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order can no longer be cancelled because it has already been shipped or completed." });
      }
      if (current.status !== status && (current.status === "cancelled" || status === "cancelled")) {
        const lines = await items.find({ orderId: id }, { session }).toArray();
        const quantities = new Map<number, number>();
        for (const line of lines) if (line.productId !== null) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
        for (const [productId, quantity] of quantities) {
          const product = await products.findOne({ id: productId }, { session });
          if (!product) continue;
          if (current.status === "cancelled" && status !== "cancelled") {
            const res = await products.updateOne({ id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } }, { session });
            if (res.modifiedCount !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: `Not enough ${product.name} in stock to reopen this order.` });
          } else if (current.status !== "cancelled" && status === "cancelled") {
            await products.updateOne({ id: productId }, { $inc: { stock: quantity }, $set: { updatedAt: new Date() } }, { session });
          }
        }
      }
      const update = { status, updatedAt: new Date(), ...(status === "cancelled" && cancellationReason ? { cancellationReason } : {}) };
      await orders.updateOne({ id }, { $set: update }, { session });
      const { _id: _mongoId, items: _embeddedItems, ...record } = current;
      updated = { ...record, ...update };
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not update order status." });
    return updated;
  } finally { await session.endSession(); }
}
