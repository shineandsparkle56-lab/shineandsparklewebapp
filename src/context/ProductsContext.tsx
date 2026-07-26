import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product, ProductVariant } from "../data/products";
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
    variants: Array.isArray(row.variants) ? (row.variants as ProductVariant[]) : [],
    base_variant_label: typeof row.base_variant_label === "string" ? row.base_variant_label : undefined,
    created_at: row.created_at as string | undefined,
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
        variants: p.variants ?? [],
        base_variant_label: p.base_variant_label ?? null,
      }])
      .select()
      .single();

    if (err) throw new Error(err.message);
    setProducts((prev) => [mapRow(data), ...prev]);
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
        variants: p.variants ?? [],
        base_variant_label: p.base_variant_label ?? null,
      })
      .eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) =>
      prev.map((prod) => prod.id === id ? { ...prod, ...p, id } : prod)
    );
  };

  const deleteProduct = async (id: number, imageUrls?: string[]) => {
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.filter((p) => p.id !== id));

    if (imageUrls && imageUrls.length > 0) {
      const BUCKET = "product-images";
      const paths = imageUrls
        .map((url) => {
          try {
            const u = new URL(url);
            const marker = `/public/${BUCKET}/`;
            const idx = u.pathname.indexOf(marker);
            return idx !== -1 ? decodeURIComponent(u.pathname.slice(idx + marker.length)) : null;
          } catch { return null; }
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
    const { error: err } = await supabase.from("products").update({ stock }).eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock } : p));
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
