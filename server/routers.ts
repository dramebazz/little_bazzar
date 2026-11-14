import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ADMIN_SESSION_MS } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { createAdminSessionToken, isAdminLoginConfigured, verifyAdminCredentials } from "./_core/adminAuth.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import { shopRouter } from "./shopRouter.js";
import { customerRouter } from "./customerRouter.js";

export const appRouter = router({
  system: systemRouter,
  shop: shopRouter,
  customer: customerRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginAdmin: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!isAdminLoginConfigured()) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Owner sign-in is not configured yet." });
        }
        const valid = await verifyAdminCredentials(input.email, input.password);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
        }
        const token = await createAdminSessionToken(input.email);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: ADMIN_SESSION_MS,
        });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: 0 });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
