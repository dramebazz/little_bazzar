import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import * as shopDb from "./shopDb";

const productInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(5).max(5000),
  category: z.string().trim().min(2).max(120),
  imageUrl: z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value), "Use an http or https image URL."),
  price: z.number().int().positive().max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  options: z.array(z.string().trim().min(1).max(255)).max(50),
});

const statusInput = z.enum(["new", "confirmed", "packed", "shipped", "delivered", "cancelled"]);

export const shopRouter = router({
  catalog: publicProcedure.input(z.object({ search: z.string().trim().max(120).optional(), category: z.string().trim().max(120).optional() }).optional())
    .query(({ input }) => shopDb.listCatalog(input?.search || undefined, input?.category || undefined)),
  product: publicProcedure.input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => shopDb.findProduct(input.id)),
  placeOrder: publicProcedure.input(z.object({
    customerName: z.string().trim().min(2).max(180),
    phone: z.string().trim().min(7).max(32).regex(/^[+\d() .-]+$/, "Enter a valid phone number."),
    email: z.union([z.literal(""), z.string().trim().email().max(320)]).optional(),
    address: z.string().trim().min(5).max(2000),
    city: z.string().trim().min(2).max(120),
    pincode: z.string().trim().min(4).max(20),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99), option: z.string().max(255).optional() })).min(1).max(50),
  })).mutation(({ input }) => shopDb.placeOrder(input)),
  admin: router({
    products: adminProcedure.query(() => shopDb.listAdminProducts()),
    saveProduct: adminProcedure.input(productInput).mutation(({ input }) => shopDb.saveProduct(input)),
    setProductVisibility: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(({ input }) => shopDb.setProductVisibility(input.id, input.isActive)),
    orders: adminProcedure.query(() => shopDb.listOrders()),
    updateOrderStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: statusInput }))
      .mutation(({ input }) => shopDb.updateOrderStatus(input.id, input.status)),
  }),
});
