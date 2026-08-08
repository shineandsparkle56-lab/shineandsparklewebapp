export interface ProductVariant {
  id: string;
  label: string;
  images: string[];
  stock: number;
  price?: number;
  color?: string;   // hex color for the swatch dot e.g. "#C9A96E" (Gold), "#C0C0C0" (Silver)
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
  base_variant_color?: string; // hex swatch color for the base option, e.g. "#C9A96E" (Gold)
  created_at?: string;     // ISO timestamp — used to show "New" badge
}
