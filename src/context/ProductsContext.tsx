import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";
import { supabase } from "../lib/supabase";

interface ProductsContextValue {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: number, p: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  updateStock: (id: number, newStock: number) => Promise<void>;
  loading: boolean;
  error: string;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    name: row.name as string,
    category: row.category as Product["category"],
    price: row.price as number,
    originalPrice: row.original_price as number,
    discount: row.discount as number,
    image: row.image as string,
    images: Array.isArray(row.images) && (row.images as string[]).length
      ? (row.images as string[])
      : [row.image as string],
    description: row.description as string,
    sizes: row.sizes as string[],
    stock: typeof row.stock === "number" ? row.stock : 99,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true });

    if (err) { setError(err.message); setLoading(false); return; }
    setProducts((data ?? []).map(mapRow));
    setLoading(false);
  };

  const addProduct = async (p: Omit<Product, "id">) => {
    const { data, error: err } = await supabase
      .from("products")
      .insert([{
        name: p.name,
        category: p.category,
        price: p.price,
        original_price: p.originalPrice,
        discount: p.discount,
        image: p.image,
        images: p.images,
        description: p.description,
        sizes: p.sizes,
        stock: p.stock,
      }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    setProducts((prev) => [...prev, mapRow(data)]);
  };

  const updateProduct = async (id: number, p: Omit<Product, "id">) => {
    const { error: err } = await supabase
      .from("products")
      .update({
        name: p.name,
        category: p.category,
        price: p.price,
        original_price: p.originalPrice,
        discount: p.discount,
        image: p.image,
        images: p.images,
        description: p.description,
        sizes: p.sizes,
        stock: p.stock,
      })
      .eq("id", id);
    if (err) throw new Error(err.message);
    // Patch local state directly — no need to re-fetch
    setProducts((prev) =>
      prev.map((prod) =>
        prod.id === id ? { ...prod, ...p, id } : prod
      )
    );
  };

  const deleteProduct = async (id: number) => {
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const updateStock = async (id: number, newStock: number) => {
    const stock = Math.max(0, newStock);
    const { error: err } = await supabase
      .from("products")
      .update({ stock })
      .eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock } : p))
    );
  };

  return (
    <ProductsContext.Provider value={{ products, addProduct, updateProduct, deleteProduct, updateStock, loading, error }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductsProvider");
  return ctx;
}
