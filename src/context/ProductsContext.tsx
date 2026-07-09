import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";
import { supabase } from "../lib/supabase";

interface ProductsContextValue {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: number, p: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: number, imageUrls?: string[]) => Promise<void>;
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
    stock: typeof row.stock === "number" ? row.stock : 99,
    shipping_credit: typeof row.shipping_credit === "number" ? row.shipping_credit : 0,
    wholesale_price: typeof row.wholesale_price === "number" ? row.wholesale_price : 0,
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
      .order("created_at", { ascending: false });

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
        stock: p.stock,
        shipping_credit: p.shipping_credit,
        wholesale_price: p.wholesale_price,
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
        stock: p.stock,
        shipping_credit: p.shipping_credit,
        wholesale_price: p.wholesale_price,
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

  const deleteProduct = async (id: number, imageUrls?: string[]) => {
    // Delete the DB row first
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.filter((p) => p.id !== id));

    // Delete images from storage (best-effort — don't block on failure)
    if (imageUrls && imageUrls.length > 0) {
      // Extract the storage path from each public URL.
      // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/product-images/<path>
      const BUCKET = "product-images";
      const paths = imageUrls
        .map((url) => {
          try {
            const u = new URL(url);
            // path after /public/product-images/
            const marker = `/public/${BUCKET}/`;
            const idx = u.pathname.indexOf(marker);
            return idx !== -1 ? decodeURIComponent(u.pathname.slice(idx + marker.length)) : null;
          } catch {
            return null;
          }
        })
        .filter((p): p is string => p !== null && p.length > 0);

      if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (storageErr) console.warn("Storage cleanup failed:", storageErr.message);
      }
    }
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
