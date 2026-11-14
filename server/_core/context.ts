import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { authenticateAdminRequest } from "./adminAuth.js";
import { authenticateCustomerRequest } from "./customerAuth.js";
import type { HttpRequest, HttpResponse } from "./httpTypes.js";

export type TrpcContext = {
  req: HttpRequest;
  res: HttpResponse;
  user: User | null;
  customer: { email: string } | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let customer: { email: string } | null = null;
  try {
    user = await authenticateAdminRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }
  try {
    customer = await authenticateCustomerRequest(opts.req as HttpRequest);
  } catch {
    customer = null;
  }
  return {
    req: opts.req as HttpRequest,
    res: opts.res as HttpResponse,
    user,
    customer,
  };
}
