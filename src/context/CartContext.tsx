import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";
import { useProducts } from "./ProductsContext";

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

// ─── ComboBoxSlot — one chosen product slot inside a combo ────
export interface ComboBoxSlot {
  product:     Product;
  variantId?:  string | null;
  variantLabel?: string | null;
  variantImage?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  // variant fields — undefined when product has no variants
  variantId?: string;
  variantLabel?: string;
  variantImage?: string;
  // ── Combo box fields — only set when itemType === "combo" ──
  itemType?:      "regular" | "combo";
  comboBoxId?:    number;
  comboBoxName?:  string;
  comboBoxPrice?: number;  // the fixed box price
  comboSlots?:    ComboBoxSlot[];  // the N chosen products
}

// Unique key for a cart item
export function cartItemKey(item: Pick<CartItem, "product" | "variantId" | "itemType" | "comboBoxId">) {
  if (item.itemType === "combo" && item.comboBoxId !== undefined) {
    return `combo__${item.comboBoxId}__${Date.now()}`;
  }
  return item.variantId ? `${item.product.id}__${item.variantId}` : String(item.product.id);
}

// Stable key for removing a combo item (uses comboCartKey stored on the item)
export function comboItemRemoveKey(item: CartItem): string {
  return item.comboCartKey ?? cartItemKey(item);
}

// We store a stable key on the combo item at creation time
declare module "../context/CartContext" {
  interface CartItem {
    comboCartKey?: string;
  }
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, variantId?: string) => boolean;
  addComboToCart: (opts: {
    comboBoxId:    number;
    comboBoxName:  string;
    comboBoxPrice: number;
    shippingCredit: number;
    slots:         ComboBoxSlot[];
    coverImage:    string;
  }) => void;
  removeFromCart: (productId: number, variantId?: string) => void;
  removeComboFromCart: (comboCartKey: string) => void;
  updateQuantity: (productId: number, delta: number, variantId?: string) => void;
  patchCartItem: (productId: number, variantId: string | undefined, liveProduct: Product, clampedQty: number) => void;
  totalItems: number;
  subtotal: number;
  shippingCredit: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  // "Add more" mode — set when user taps the delivery nudge button
  addMoreMode: { shippingCharge: number; rawTotal: number } | null;
  setAddMoreMode: (v: { shippingCharge: number; rawTotal: number } | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [addMoreMode, setAddMoreMode] = useState<{ shippingCharge: number; rawTotal: number } | null>(null);

  // Persist cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch { }
  }, [cart]);

  // ── Live price / stock reconciliation ────────────────────────────────────
  // Whenever the live products list changes (admin edited price/stock/variants),
  // patch every regular cart item so the cart always reflects current data.
  const { products } = useProducts();
  useEffect(() => {
    if (!products.length) return;
    setCart((prev) => {
      let changed = false;
      const next = prev.reduce<CartItem[]>((acc, item) => {
        // Leave combo phantom products alone — they have a fixed price set at box level
        if (item.itemType === "combo") { acc.push(item); return acc; }

        const live = products.find((p) => p.id === item.product.id);
        if (!live) {
          // Product was deleted — silently drop it from cart
          changed = true;
          return acc;
        }

        // Find the live variant (if any)
        const liveVariant = item.variantId
          ? live.variants?.find((v) => v.id === item.variantId)
          : undefined;

        const liveStock = liveVariant ? liveVariant.stock : live.stock;

        // If stock dropped to 0, remove the item
        if (liveStock <= 0) { changed = true; return acc; }

        // Clamp quantity to current available stock
        const clampedQty = Math.min(item.quantity, liveStock);
        if (clampedQty !== item.quantity) changed = true;

        // Check whether price or stock actually changed to avoid spurious re-renders
        const priceChanged =
          live.price !== item.product.price ||
          live.originalPrice !== item.product.originalPrice ||
          (liveVariant && liveVariant.price !== item.product.variants?.find((v) => v.id === item.variantId)?.price);

        const stockChanged =
          live.stock !== item.product.stock ||
          JSON.stringify(live.variants?.map((v) => ({ id: v.id, stock: v.stock }))) !==
          JSON.stringify(item.product.variants?.map((v) => ({ id: v.id, stock: v.stock })));

        if (priceChanged || stockChanged || clampedQty !== item.quantity) {
          changed = true;
          acc.push({ ...item, product: live, quantity: clampedQty });
        } else {
          acc.push(item);
        }
        return acc;
      }, []);

      // Only trigger a state update if something actually changed
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const addToCart = (product: Product, variantId?: string): boolean => {
    const variant = variantId
      ? product.variants?.find((v) => v.id === variantId)
      : undefined;
    const availableStock = variant ? variant.stock : product.stock;

    let hitLimit = false;
    setCart((prev) => {
      const key = variantId ? `${product.id}__${variantId}` : String(product.id);
      const existing = prev.find((i) => i.itemType !== "combo" && cartItemKey(i) === key);
      if (existing) {
        if (existing.quantity >= availableStock) { hitLimit = true; return prev; }
        return prev.map((i) =>
          (i.itemType !== "combo" && cartItemKey(i) === key)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      const newItem: CartItem = {
        product,
        quantity: 1,
        itemType: "regular",
        variantId: variant?.id,
        variantLabel: variant?.label,
        variantImage: variant?.images?.[0],
      };
      return [...prev, newItem];
    });
    return !hitLimit;
  };

  const addComboToCart = ({
    comboBoxId, comboBoxName, comboBoxPrice, shippingCredit: boxShippingCredit, slots, coverImage,
  }: {
    comboBoxId:     number;
    comboBoxName:   string;
    comboBoxPrice:  number;
    shippingCredit: number;
    slots:          ComboBoxSlot[];
    coverImage:     string;
  }) => {
    const key = `combo__${comboBoxId}__${Date.now()}`;
    const phantomProduct: Product = {
      id:                   -(comboBoxId),
      name:                 comboBoxName,
      category:             "combo-box" as Product["category"],
      price:                comboBoxPrice,
      originalPrice:        comboBoxPrice,
      discount:             0,
      image:                coverImage,
      images:               [coverImage],
      description:          `Combo box of ${slots.length} items`,
      stock:                99,
      shipping_credit:      Math.max(0, boxShippingCredit),
      wholesale_price:      0,
      client_wholesale_price: 0,
      variants:             [],
      tags:                 [],
      sizes:                [],
    };

    const newItem: CartItem = {
      product:        phantomProduct,
      quantity:       1,
      itemType:       "combo",
      comboBoxId,
      comboBoxName,
      comboBoxPrice,
      comboSlots:     slots,
      comboCartKey:   key,
    };
    setCart((prev) => [...prev, newItem]);
  };

  const removeFromCart = (productId: number, variantId?: string) => {
    const key = variantId ? `${productId}__${variantId}` : String(productId);
    setCart((prev) => prev.filter((i) => i.itemType === "combo" || cartItemKey(i) !== key));
  };

  const removeComboFromCart = (comboCartKey: string) => {
    setCart((prev) => prev.filter((i) => i.comboCartKey !== comboCartKey));
  };

  const updateQuantity = (productId: number, delta: number, variantId?: string) => {
    const key = variantId ? `${productId}__${variantId}` : String(productId);
    setCart((prev) =>
      prev.reduce<CartItem[]>((acc, item) => {
        if (item.itemType === "combo" || cartItemKey(item) !== key) return [...acc, item];
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

  /** Replace a cart item's product snapshot with the live version and clamp qty.
   *  Used by CartDrawer's pre-checkout validation to update price/stock inline
   *  so the customer sees the new total immediately without being stuck. */
  const patchCartItem = (productId: number, variantId: string | undefined, liveProduct: Product, clampedQty: number) => {
    const key = variantId ? `${productId}__${variantId}` : String(productId);
    setCart((prev) =>
      prev.map((item) => {
        if (item.itemType === "combo" || cartItemKey(item) !== key) return item;
        return { ...item, product: liveProduct, quantity: clampedQty };
      })
    );
  };

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const subtotal = cart.reduce((s, i) => {
    if (i.itemType === "combo") return s + (i.comboBoxPrice ?? 0);
    const variant = i.variantId ? i.product.variants?.find((v) => v.id === i.variantId) : undefined;
    const price = variant?.price ?? i.product.price;
    return s + price * i.quantity;
  }, 0);

  const shippingCredit = cart.reduce((s, i) => {
    // combo items use their phantom product's shipping_credit (set from box.shipping_credit)
    return s + (i.product.shipping_credit ?? 0) * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{
      cart, addToCart, addComboToCart,
      removeFromCart, removeComboFromCart,
      updateQuantity, patchCartItem,
      totalItems, subtotal, shippingCredit, isCartOpen, setIsCartOpen,
      addMoreMode, setAddMoreMode,
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
