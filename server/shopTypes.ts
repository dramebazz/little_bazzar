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

export type OrderStatus = "new" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
