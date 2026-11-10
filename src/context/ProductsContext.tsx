import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product, ProductVariant } from "../data/products";
import { supabase } from "../lib/supabase";

interface ProductsContextValue {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: number, p: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: number, imageUrls?: string[]) => Promise<void>;
  updateStock: (id: number, newStock: number) => Promise<void>;
  updateVariantStock: (productId: number, variantId: string, newStock: number) => Promise<void>;
  updateHidden: (id: number, is_hidden: boolean) => Promise<void>;
  patchLocalProduct: (id: number, patch: Partial<Product>) => void;
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
    client_wholesale_price: typeof row.client_wholesale_price === "number" ? row.client_wholesale_price : 0,
    variants: Array.isArray(row.variants) ? (row.variants as ProductVariant[]) : [],
    base_variant_label: typeof row.base_variant_label === "string" ? row.base_variant_label : undefined,
    base_variant_color: typeof row.base_variant_color === "string" ? row.base_variant_color : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : [],
    created_at: row.created_at as string | undefined,
    is_hidden: row.is_hidden === true,
    hsn_code: typeof row.hsn_code === "string" ? row.hsn_code : undefined,
    gst_rate: typeof row.gst_rate === "number" ? row.gst_rate : undefined,
  };
}

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();

    // ── Supabase Realtime ───────────────────────────────────────────────────
    // Subscribe to any INSERT / UPDATE / DELETE on the products table so every
    // open browser session (customer + admin) sees price/stock changes
    // immediately without a page reload.
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProducts((prev) => [mapRow(payload.new as Record<string, unknown>), ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setProducts((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Record<string, unknown>).id
                  ? mapRow(payload.new as Record<string, unknown>)
                  : p
              )
            );
          } else if (payload.eventType === "DELETE") {
            setProducts((prev) =>
              prev.filter((p) => p.id !== (payload.old as Record<string, unknown>).id)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        client_wholesale_price: p.client_wholesale_price,
        variants: p.variants ?? [],
        base_variant_label: p.base_variant_label ?? null,
        base_variant_color: p.base_variant_color ?? null,
        tags: p.tags ?? [],
        sizes: p.sizes ?? [],
        is_hidden: p.is_hidden ?? false,
        hsn_code: p.hsn_code ?? null,
        gst_rate: p.gst_rate ?? null,
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
        client_wholesale_price: p.client_wholesale_price,
        variants: p.variants ?? [],
        base_variant_label: p.base_variant_label ?? null,
        base_variant_color: p.base_variant_color ?? null,
        tags: p.tags ?? [],
        sizes: p.sizes ?? [],
        is_hidden: p.is_hidden ?? false,
        hsn_code: p.hsn_code ?? null,
        gst_rate: p.gst_rate ?? null,
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
      try {
        await fetch("/api/delete-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: imageUrls }),
        });
      } catch (e) {
        console.warn("Storage cleanup failed:", e);
      }
    }
  };

  const updateStock = async (id: number, newStock: number) => {
    const stock = Math.max(0, newStock);
    const { error: err } = await supabase.from("products").update({ stock }).eq("id", id);
    if (err) throw new Error(err.message);
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock } : p));
  };

  const updateVariantStock = async (productId: number, variantId: string, newStock: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const updatedVariants = product.variants.map((v) =>
      v.id === variantId ? { ...v, stock: Math.max(0, newStock) } : v,
    );
    const { error: err } = await supabase
      .from("products")
      .update({ variants: updatedVariants })
      .eq("id", productId);
    if (err) throw new Error(err.message);
    setProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, variants: updatedVariants } : p),
    );
  };

  /** Patch local React state only — use when Supabase write already done elsewhere */
  const patchLocalProduct = (id: number, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  /** Toggle a product's is_hidden flag — instantly reflected in all open sessions via Realtime */
  const updateHidden = async (id: number, is_hidden: boolean) => {
    // Optimistic local update first so the toggle feels instant
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_hidden } : p));
    const { error: err } = await supabase.from("products").update({ is_hidden }).eq("id", id);
    if (err) {
      // Roll back on failure
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_hidden: !is_hidden } : p));
      throw new Error(err.message);
    }
  };

  return (
    <ProductsContext.Provider value={{ products, addProduct, updateProduct, deleteProduct, updateStock, updateVariantStock, updateHidden, patchLocalProduct, loading, error }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductsProvider");
  return ctx;
}
