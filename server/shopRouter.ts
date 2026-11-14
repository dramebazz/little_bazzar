import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "./_core/trpc.js";
import { normalizeCustomerEmail } from "./_core/customerAuth.js";
import * as shopDb from "./shopDb.js";

const productInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().min(5).max(5000),
  category: z.string().trim().min(2).max(120),
  imageUrl: z.string().trim().max(4_000_000).refine(value => /^https?:\/\//i.test(value) || /^data:image\/(?:jpeg|png|webp|gif);base64,/.test(value), "Upload an image or use an http/https image URL."),
  price: z.number().int().positive().max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  options: z.array(z.string().trim().min(1).max(255)).max(50),
});

const statusInput = z.enum(["new", "confirmed", "packed", "shipped", "delivered", "cancelled"]);

export const shopRouter = router({
  catalog: publicProcedure.input(z.object({ search: z.string().trim().max(120).optional(), category: z.string().trim().max(120).optional() }).optional())
    .query(({ input }) => shopDb.listCatalog(input?.search || undefined, input?.category || undefined)),
  product: publicProcedure.input(z.object({ publicId: z.string().regex(/^[A-Za-z0-9]{12}$/) }))
    .query(({ input }) => shopDb.findProduct(input.publicId)),
  placeOrder: publicProcedure.input(z.object({
    customerName: z.string().trim().min(2).max(180),
    phone: z.string().trim().min(7).max(32).regex(/^[+\d() .-]+$/, "Enter a valid phone number."),
    email: z.string().trim().email().max(320),
    address: z.string().trim().min(5).max(2000),
    city: z.string().trim().min(2).max(120),
    pincode: z.string().trim().min(4).max(20),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99), option: z.string().max(255).optional() })).min(1).max(50),
  })).mutation(({ input, ctx }) => {
    if (!ctx.customer) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in before placing an order." });
    if (normalizeCustomerEmail(input.email) !== ctx.customer.email) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Order email must match your signed-in account." });
    }
    return shopDb.placeOrder(input);
  }),
  admin: router({
    uploadImage: adminProcedure.input(z.object({
      fileName: z.string().trim().min(1).max(255),
      contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      data: z.string().regex(/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/, "Invalid image data."),
    })).mutation(async ({ input }) => {
      const base64 = input.data.slice(input.data.indexOf(",") + 1);
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image must be 5 MB or smaller." });
      }
      return { key: input.fileName, url: input.data };
    }),
    products: adminProcedure.query(() => shopDb.listAdminProducts()),
    saveProduct: adminProcedure.input(productInput).mutation(({ input }) => shopDb.saveProduct(input)),
    setProductVisibility: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(({ input }) => shopDb.setProductVisibility(input.id, input.isActive)),
    deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => shopDb.deleteProduct(input.id)),
    orders: adminProcedure.query(() => shopDb.listOrders()),
    updateOrderStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: statusInput }))
      .mutation(({ input }) => shopDb.updateOrderStatus(input.id, input.status)),
  }),
});
