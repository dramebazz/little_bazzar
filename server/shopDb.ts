import * as mongo from "./shopMongoDb.js";
import type { CheckoutInput, ProductInput } from "./shopTypes.js";

export type { CheckoutInput, ProductInput } from "./shopTypes.js";

async function adapter() {
  return process.env.MONGODB_URI ? mongo : import("./shopMysqlDb.js");
}

export async function listCatalog(search?: string, category?: string) {
  return (await adapter()).listCatalog(search, category);
}

export async function findProductById(id: number) {
  return (await adapter()).findProduct(id);
}

export const findProduct = findProductById;

export async function listAdminProducts() {
  return (await adapter()).listAdminProducts();
}

export async function saveProduct(input: ProductInput & { id?: number }) {
  return (await adapter()).saveProduct(input);
}

export async function setProductVisibility(id: number, isActive: boolean) {
  return (await adapter()).setProductVisibility(id, isActive);
}

export async function listOrders() {
  return (await adapter()).listOrders();
}

export async function placeOrder(input: CheckoutInput) {
  return (await adapter()).placeOrder(input);
}

export async function updateOrderStatus(id: number, status: Parameters<typeof mongo.updateOrderStatus>[1]) {
  return (await adapter()).updateOrderStatus(id, status);
}
