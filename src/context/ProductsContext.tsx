import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "../data/products";
import { supabase } from "../lib/supabase";

interface ProductsContextValue {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  loading: boolean;
  error: string;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setProducts(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        price: row.price,
        originalPrice: row.original_price,
        discount: row.discount,
        image: row.image,
        images: Array.isArray(row.images) && row.images.length ? row.images : [row.image],
        description: row.description,
        sizes: row.sizes,
      }))
    );
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
      }])
      .select()
      .single();

    if (err) throw new Error(err.message);

    setProducts((prev) => [
      ...prev,
      {
        id: data.id,
        name: data.name,
        category: data.category,
        price: data.price,
        originalPrice: data.original_price,
        discount: data.discount,
        image: data.image,
        images: Array.isArray(data.images) && data.images.length ? data.images : [data.image],
        description: data.description,
        sizes: data.sizes,
      },
    ]);
  };

  const deleteProduct = async (id: number) => {
    const { error: err } = await supabase.from("products").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProductsContext.Provider value={{ products, addProduct, deleteProduct, loading, error }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductsProvider");
  return ctx;
}
