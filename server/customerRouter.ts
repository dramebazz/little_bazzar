import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CUSTOMER_COOKIE_NAME, CUSTOMER_SESSION_MS } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { createCustomerSession, hashCustomerSecret, normalizeCustomerEmail, recoveryQuestions, validateCustomerPassword, verifyCustomerSecret } from "./_core/customerAuth.js";
import { publicProcedure, router } from "./_core/trpc.js";
import * as shopDb from "./shopDb.js";

const credentials = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) });
const recovery = z.object({ email: z.string().trim().email().max(320), answer: z.string().trim().min(1).max(255), newPassword: z.string().min(1).max(128) });

export const customerRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.customer) return null;
    const account = await shopDb.findCustomer(ctx.customer.email);
    return account ? { email: account.email, name: account.name } : null;
  }),
  securityQuestion: publicProcedure.query(() => recoveryQuestions[Math.floor(Math.random() * recoveryQuestions.length)]),
  recoveryQuestion: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).query(async ({ input }) => {
    const account = await shopDb.findCustomer(normalizeCustomerEmail(input.email));
    return account?.recoveryQuestion ?? null;
  }),
  register: publicProcedure.input(credentials.extend({
    name: z.string().trim().min(2).max(180),
    securityQuestion: z.enum(recoveryQuestions),
    securityAnswer: z.string().trim().min(1).max(255),
  })).mutation(async ({ input, ctx }) => {
    validateCustomerPassword(input.password);
    const email = normalizeCustomerEmail(input.email);
    if (await shopDb.findCustomer(email)) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
    await shopDb.createCustomer({ email, name: input.name.trim(), passwordHash: await hashCustomerSecret(input.password), recoveryQuestion: input.securityQuestion, recoveryAnswerHash: await hashCustomerSecret(input.securityAnswer.toLowerCase()) });
    ctx.res.cookie(CUSTOMER_COOKIE_NAME, await createCustomerSession(email), { ...getSessionCookieOptions(ctx.req), maxAge: CUSTOMER_SESSION_MS });
    return { success: true } as const;
  }),
  login: publicProcedure.input(credentials).mutation(async ({ input, ctx }) => {
    const account = await shopDb.findCustomer(normalizeCustomerEmail(input.email));
    if (!account || !(await verifyCustomerSecret(input.password, account.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    ctx.res.cookie(CUSTOMER_COOKIE_NAME, await createCustomerSession(account.email), { ...getSessionCookieOptions(ctx.req), maxAge: CUSTOMER_SESSION_MS });
    return { success: true } as const;
  }),
  resetPassword: publicProcedure.input(recovery).mutation(async ({ input }) => {
    validateCustomerPassword(input.newPassword);
    const email = normalizeCustomerEmail(input.email);
    const account = await shopDb.findCustomer(email);
    if (!account || !(await verifyCustomerSecret(input.answer.toLowerCase(), account.recoveryAnswerHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "The recovery answer is incorrect." });
    await shopDb.updateCustomerPassword(email, await hashCustomerSecret(input.newPassword));
    return { success: true } as const;
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(CUSTOMER_COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: 0 });
    return { success: true } as const;
  }),
  orders: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.customer) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in to view your orders." });
    return shopDb.listCustomerOrders(ctx.customer.email);
  }),
});
