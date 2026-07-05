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
  sizes: string[];
  stock: number; // 0 = out of stock
}
