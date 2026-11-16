import * as mongo from "./shopMongoDb.js";
import type { CheckoutInput, ProductInput } from "./shopTypes.js";

export type { CheckoutInput, ProductInput } from "./shopTypes.js";

async function adapter() {
  return process.env.MONGODB_URI ? mongo : import("./shopMysqlDb.js");
}

export async function listCatalog(search?: string, category?: string) {
  return (await adapter()).listCatalog(search, category);
}

export async function listCategories() {
  return (await adapter()).listCategories();
}

export async function findProductByPublicId(publicId: string) {
  return (await adapter()).findProduct(publicId);
}

export const findProduct = findProductByPublicId;

export async function listAdminProducts() {
  return (await adapter()).listAdminProducts();
}

export async function saveProduct(input: ProductInput & { id?: number }) {
  return (await adapter()).saveProduct(input);
}

export async function setProductVisibility(id: number, isActive: boolean) {
  return (await adapter()).setProductVisibility(id, isActive);
}

export async function deleteProduct(id: number) {
  return (await adapter()).deleteProduct(id);
}

export async function listOrders() {
  return (await adapter()).listOrders();
}

export async function placeOrder(input: CheckoutInput) {
  return (await adapter()).placeOrder(input);
}

export async function findCustomer(email: string) {
  if (process.env.MONGODB_URI) return mongo.findCustomer(email);
  return null;
}

export async function createCustomer(input: Parameters<typeof mongo.createCustomer>[0]) {
  return mongo.createCustomer(input);
}

export async function updateCustomerPassword(email: string, passwordHash: string) {
  return mongo.updateCustomerPassword(email, passwordHash);
}

export async function listCustomerOrders(email: string) {
  if (process.env.MONGODB_URI) return mongo.listCustomerOrders(email);
  return [];
}

export async function updateOrderStatus(id: number, status: Parameters<typeof mongo.updateOrderStatus>[1]) {
  return (await adapter()).updateOrderStatus(id, status);
}

export async function cancelCustomerOrder(id: number, email: string) {
  if (process.env.MONGODB_URI) return mongo.updateOrderStatus(id, "cancelled", email);
  throw new Error("Customer order cancellation requires the MongoDB shop adapter.");
}
