import * as mysql from "./shopMysqlDb";
import * as mongo from "./shopMongoDb";
import type { CheckoutInput, ProductInput } from "./shopTypes";

export type { CheckoutInput, ProductInput } from "./shopTypes";
// Resolve dynamically so the same serverless bundle can select either backend without
// changing any router imports or introducing a separate routing layer.
const adapter = (): any => process.env.MONGODB_URI ? mongo : mysql;

export const listCatalog: typeof mysql.listCatalog = (...args) => adapter().listCatalog(...args);
export const findProductById: typeof mysql.findProduct = id => process.env.MONGODB_URI ? mongo.findProductById(id) : mysql.findProduct(id);
// The router's established name remains supported; the explicit ById API is also exported.
export const findProduct: typeof mysql.findProduct = id => findProductById(id);
export const listAdminProducts: typeof mysql.listAdminProducts = () => adapter().listAdminProducts();
export const saveProduct: typeof mysql.saveProduct = (input: ProductInput & { id?: number }) => adapter().saveProduct(input);
export const setProductVisibility: typeof mysql.setProductVisibility = (id, isActive) => adapter().setProductVisibility(id, isActive);
export const listOrders: typeof mysql.listOrders = () => adapter().listOrders();
export const placeOrder: typeof mysql.placeOrder = (input: CheckoutInput) => adapter().placeOrder(input);
export const updateOrderStatus: typeof mysql.updateOrderStatus = (id, status) => adapter().updateOrderStatus(id, status);
