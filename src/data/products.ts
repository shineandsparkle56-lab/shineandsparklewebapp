export interface ProductVariant {
  id: string;       // e.g. "gold", "silver", "rose-gold"
  label: string;    // e.g. "Gold", "Silver", "Rose Gold"
  images: string[]; // variant-specific photos — first is the cover/swatch
  stock: number;    // per-variant stock quantity
  price?: number;   // override base price (optional — omit to use base price)
}

/** Convenience getter — first image of the variant (used as swatch/cover) */
export function variantCover(v: ProductVariant): string {
  return v.images?.[0] ?? "";
}

export interface Product {
  id: number;
  name: string;
  category: string; // dynamic — stored in Supabase categories table
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  images: string[];
  description: string;
  stock: number;           // used when variants is empty; otherwise sum of variant stocks
  shipping_credit: number; // ₹ discount applied to shipping per unit in cart (0 = no credit)
  wholesale_price: number; // admin-only cost price — never shown to customers
  variants: ProductVariant[]; // [] means no variants — product works as before
  base_variant_label?: string; // label for the implicit "base" option when variants exist, e.g. "Gold"
  created_at?: string;     // ISO timestamp — used to show "New" badge
}
