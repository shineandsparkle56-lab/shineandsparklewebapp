import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";

const CART_STORAGE_KEY = "sns_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export const WHATSAPP_NUMBER = "919574024419";

export interface CartItem {
  product: Product;
  quantity: number;
  // variant fields — undefined when product has no variants
  variantId?: string;
  variantLabel?: string;
  variantImage?: string;
}

// Unique key for a cart item = product id + variant id (or just product id if no variant)
export function cartItemKey(item: Pick<CartItem, "product" | "variantId">) {
  return item.variantId ? `${item.product.id}__${item.variantId}` : String(item.product.id);
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, variantId?: string) => boolean;
  removeFromCart: (productId: number, variantId?: string) => void;
  updateQuantity: (productId: number, delta: number, variantId?: string) => void;
  totalItems: number;
  subtotal: number;
  shippingCredit: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { }
  }, [cart]);

  const addToCart = (product: Product, variantId?: string): boolean => {
    // Resolve the variant object if provided
    const variant = variantId
      ? product.variants?.find((v) => v.id === variantId)
      : undefined;

    // Stock limit:
    // - Named variant (Silver) → use variant.stock
    // - Base option (no variantId, but product has variants) → use product.stock (base stock only)
    // - No variants at all → use product.stock
    const availableStock = variant ? variant.stock : product.stock;

    let hitLimit = false;
    setCart((prev) => {
      const key = variantId ? `${product.id}__${variantId}` : String(product.id);
      const existing = prev.find((i) => cartItemKey(i) === key);
      if (existing) {
        if (existing.quantity >= availableStock) { hitLimit = true; return prev; }
        return prev.map((i) =>
          cartItemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const newItem: CartItem = {
        product,
        quantity: 1,
        variantId: variant?.id,
        variantLabel: variant?.label,
        variantImage: variant?.images?.[0],
      };
      return [...prev, newItem];
    });
    return !hitLimit;
  };

  const removeFromCart = (productId: number, variantId?: string) => {
    const key = variantId ? `${productId}__${variantId}` : String(productId);
    setCart((prev) => prev.filter((i) => cartItemKey(i) !== key));
  };

  const updateQuantity = (productId: number, delta: number, variantId?: string) => {
    const key = variantId ? `${productId}__${variantId}` : String(productId);
    setCart((prev) =>
      prev.reduce<CartItem[]>((acc, item) => {
        if (cartItemKey(item) !== key) return [...acc, item];
        const variant = item.variantId
          ? item.product.variants?.find((v) => v.id === item.variantId)
          : undefined;
        const maxStock = variant ? variant.stock : item.product.stock;
        const newQty = Math.min(maxStock, item.quantity + delta);
        if (newQty <= 0) return acc;
        return [...acc, { ...item, quantity: newQty }];
      }, [])
    );
  };

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => {
    // Use variant price if set, otherwise product base price
    const variant = i.variantId ? i.product.variants?.find((v) => v.id === i.variantId) : undefined;
    const price = variant?.price ?? i.product.price;
    return s + price * i.quantity;
  }, 0);
  const shippingCredit = cart.reduce(
    (s, i) => s + (i.product.shipping_credit ?? 0) * i.quantity, 0
  );

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity,
      totalItems, subtotal, shippingCredit, isCartOpen, setIsCartOpen,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
