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
  stock: number;          // 0 = out of stock
  shipping_credit: number; // ₹ discount applied to shipping per unit in cart (0 = no credit)
  wholesale_price: number; // admin-only cost price — never shown to customers
  created_at?: string;    // ISO timestamp — used to show "New" badge
}
