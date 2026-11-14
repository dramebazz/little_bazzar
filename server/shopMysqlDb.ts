import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { orderItems, orders, products } from "../drizzle/schema";

export type ProductInput = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  price: number;
  stock: number;
  options: string[];
};

export type CheckoutInput = {
  customerName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  pincode: string;
  notes?: string;
  items: { productId: number; quantity: number; option?: string }[];
};

function database() {
  return getDb().then(db => {
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The store database is unavailable." });
    return db;
  });
}

function serializeOptions(options: string[]) {
  return JSON.stringify(options.map(option => option.trim()).filter(Boolean));
}

function parseOptions(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function shapeProduct(product: typeof products.$inferSelect) {
  return { ...product, publicId: undefined, options: parseOptions(product.options) };
}

export async function listCatalog(search?: string, category?: string) {
  const db = await database();
  const filters = [eq(products.isActive, true)];
  if (category && category !== "All") filters.push(eq(products.category, category));
  if (search) filters.push(like(products.name, `%${search}%`));
  const rows = await db.select().from(products).where(and(...filters)).orderBy(desc(products.createdAt));
  return rows.map(shapeProduct);
}

export async function findProduct(_publicId: string) {
  return null;
  /*
  const id = Number(_publicId);
  const db = await database();
  const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.isActive, true))).limit(1);
  return product ? shapeProduct(product) : null;
  */
}

export async function listAdminProducts() {
  const db = await database();
  const rows = await db.select().from(products).orderBy(desc(products.updatedAt));
  return rows.map(shapeProduct);
}

export async function saveProduct(input: ProductInput & { id?: number }) {
  const db = await database();
  const values = {
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    imageUrl: input.imageUrl.trim(),
    price: input.price,
    stock: input.stock,
    options: serializeOptions(input.options),
  };
  if (input.id) {
    await db.update(products).set(values).where(eq(products.id, input.id));
    const [saved] = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
    return shapeProduct(saved);
  }
  const [result] = await db.insert(products).values({ ...values, isActive: true });
  const [saved] = await db.select().from(products).where(eq(products.id, Number(result.insertId))).limit(1);
  if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save product." });
  return shapeProduct(saved);
}

export async function setProductVisibility(id: number, isActive: boolean) {
  const db = await database();
  await db.update(products).set({ isActive }).where(eq(products.id, id));
  return { success: true } as const;
}

export async function deleteProduct(id: number) {
  const db = await database();
  const result = await db.delete(products).where(eq(products.id, id));
  if (result[0].affectedRows !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
  return { success: true } as const;
}

export async function listOrders() {
  const db = await database();
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
  if (allOrders.length === 0) return [];
  const orderIds = allOrders.map(order => order.id);
  const allItems = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
  const grouped = new Map<number, typeof allItems>();
  for (const item of allItems) grouped.set(item.orderId, [...(grouped.get(item.orderId) ?? []), item]);
  return allOrders.map(order => ({ ...order, items: grouped.get(order.id) ?? [] }));
}

export async function placeOrder(input: CheckoutInput) {
  const db = await database();
  const quantities = new Map<number, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  const ids = [...quantities.keys()];
  return db.transaction(async tx => {
    const found = await tx.select().from(products).where(inArray(products.id, ids)).for("update");
    const byId = new Map(found.map(product => [product.id, product]));
    const lines = input.items.map(item => {
      const product = byId.get(item.productId);
      if (!product || !product.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "A product in your bag is no longer available. Please refresh your bag." });
      const quantity = quantities.get(item.productId) ?? 0;
      if (product.stock < quantity) throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} does not have enough stock for that quantity.` });
      const options = parseOptions(product.options);
      if (options.length > 0 && (!item.option || !options.includes(item.option))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Please choose an available option for ${product.name}.` });
      }
      if (options.length === 0 && item.option) throw new TRPCError({ code: "BAD_REQUEST", message: `Please refresh your bag and try ${product.name} again.` });
      return {
        orderId: 0,
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        selectedOption: item.option ?? null,
      };
    });
    const total = lines.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const orderNumber = `LB-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const [orderResult] = await tx.insert(orders).values({
      orderNumber,
      customerName: input.customerName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      address: input.address.trim(),
      city: input.city.trim(),
      pincode: input.pincode.trim(),
      notes: input.notes?.trim() || null,
      status: "new",
      total,
    });
    const orderId = Number(orderResult.insertId);
    await tx.insert(orderItems).values(lines.map(line => ({ ...line, orderId })));
    for (const [productId, quantity] of quantities) {
      await tx.update(products)
        .set({ stock: sql`${products.stock} - ${quantity}` })
        .where(and(eq(products.id, productId), sql`${products.stock} >= ${quantity}`));
    }
    return { orderNumber, total };
  });
}

export async function updateOrderStatus(id: number, status: "new" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled") {
  const db = await database();
  return db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, id)).for("update").limit(1);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    if (current.status === "delivered" && status === "cancelled") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A delivered order cannot be cancelled." });
    }
    if (current.status !== status && (current.status === "cancelled" || status === "cancelled")) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      const quantities = new Map<number, number>();
      for (const item of items) if (item.productId !== null) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      for (const [productId, quantity] of quantities) {
        const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update").limit(1);
        if (!product) continue;
        if (current.status === "cancelled" && status !== "cancelled") {
          if (product.stock < quantity) throw new TRPCError({ code: "BAD_REQUEST", message: `Not enough ${product.name} in stock to reopen this order.` });
          await tx.update(products).set({ stock: sql`${products.stock} - ${quantity}` }).where(eq(products.id, productId));
        } else if (current.status !== "cancelled" && status === "cancelled") {
          await tx.update(products).set({ stock: sql`${products.stock} + ${quantity}` }).where(eq(products.id, productId));
        }
      }
    }
    await tx.update(orders).set({ status }).where(eq(orders.id, id));
    const [updated] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    return updated;
  });
}
