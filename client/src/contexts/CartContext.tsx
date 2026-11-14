import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartProduct = {
  id: number;
  name: string;
  imageUrl: string;
  price: number;
  stock: number;
};
export type CartLine = CartProduct & { quantity: number; option?: string };

type CartValue = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (product: CartProduct, option?: string) => void;
  setQuantity: (id: number, option: string | undefined, quantity: number) => void;
  remove: (id: number, option?: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);
const KEY = "little-bazaar-cart-v1";

function readCart(): CartLine[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(line => line && typeof line.id === "number" && typeof line.quantity === "number") : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readCart);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(lines)), [lines]);

  const value = useMemo<CartValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    add(product, option) {
      setLines(current => {
        const existing = current.find(line => line.id === product.id && line.option === option);
        if (existing) return current.map(line => line === existing ? { ...line, quantity: Math.min(line.quantity + 1, product.stock) } : line);
        return [...current, { ...product, option, quantity: 1 }];
      });
    },
    setQuantity(id, option, quantity) {
      setLines(current => current.flatMap(line => {
        if (line.id !== id || line.option !== option) return [line];
        if (quantity <= 0) return [];
        return [{ ...line, quantity: Math.min(quantity, line.stock) }];
      }));
    },
    remove(id, option) {
      setLines(current => current.filter(line => !(line.id === id && line.option === option)));
    },
    clear() { setLines([]); },
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
