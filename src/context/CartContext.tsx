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
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => boolean; // returns false if stock limit reached
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, delta: number) => void;
  totalItems: number;
  subtotal: number;
  shippingCredit: number; // total ₹ to subtract from shipping charge
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage errors (private browsing quota, etc.)
    }
  }, [cart]);

  const addToCart = (product: Product): boolean => {
    let hitLimit = false;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Don't exceed available stock
        if (existing.quantity >= product.stock) {
          hitLimit = true;
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    return !hitLimit;
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => {
      return prev.reduce<CartItem[]>((acc, item) => {
        if (item.product.id === id) {
          const newQuantity = Math.min(
            item.product.stock,
            item.quantity + delta
          );
          // Remove item if quantity drops to 0 or below
          if (newQuantity <= 0) return acc;
          return [...acc, { ...item, quantity: newQuantity }];
        }
        return [...acc, item];
      }, []);
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  // Sum of shipping_credit × quantity for every item in cart
  const shippingCredit = cart.reduce(
    (sum, item) => sum + (item.product.shipping_credit ?? 0) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        totalItems,
        subtotal,
        shippingCredit,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
