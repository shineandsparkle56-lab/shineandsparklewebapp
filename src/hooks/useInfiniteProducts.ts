import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Product } from "../data/products";

export type SortOrder = "default" | "low-high" | "high-low";

const PAGE_SIZE = 12;

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    name: row.name as string,
    category: row.category as Product["category"],
    price: row.price as number,
    originalPrice: row.original_price as number,
    discount: row.discount as number,
    image: row.image as string,
    images:
      Array.isArray(row.images) && (row.images as string[]).length
        ? (row.images as string[])
        : [row.image as string],
    description: row.description as string,
    stock: typeof row.stock === "number" ? row.stock : 99,
    shipping_credit: typeof row.shipping_credit === "number" ? row.shipping_credit : 0,
    wholesale_price: typeof row.wholesale_price === "number" ? row.wholesale_price : 0,
    variants: Array.isArray(row.variants) ? (row.variants as import("../data/products").ProductVariant[]) : [],
    base_variant_label: typeof row.base_variant_label === "string" ? row.base_variant_label : undefined,
    created_at: row.created_at as string | undefined,
  };
}

export function useInfiniteProducts(category: string | string[], sort: SortOrder) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);

  // Stable key for deps — avoids infinite re-render when category is an array
  const categoryKey = Array.isArray(category) ? category.slice().sort().join(",") : category;

  // Fetch a single page starting from `from`.
  // `reset` = true means we're starting over (filter/sort changed).
  const fetchPage = useCallback(
    async (from: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError("");

      let query = supabase
        .from("products")
        .select("*")
        .range(from, from + PAGE_SIZE - 1);

      // Hide out-of-stock items
      query = query.gt("stock", 0);

      // Server-side category filter
      const catFilter = category; // snapshot for this call
      if (catFilter !== "all" && !(Array.isArray(catFilter) && catFilter.includes("all"))) {
        if (Array.isArray(catFilter)) {
          query = query.in("category", catFilter);
        } else {
          query = query.eq("category", catFilter);
        }
      }

      // Server-side sort
      if (sort === "low-high") {
        query = query.order("price", { ascending: true }).order("id", { ascending: true });
      } else if (sort === "high-low") {
        query = query.order("price", { ascending: false }).order("id", { ascending: true });
      } else {
        // Default: newest first
        query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      }

      const { data, error: err } = await query;

      if (err) {
        setError(err.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const rows = (data ?? []).map(mapRow);

      setProducts((prev) => (reset ? rows : [...prev, ...rows]));
      // If we got fewer rows than PAGE_SIZE, there are no more pages.
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = from + rows.length;

      setLoading(false);
      setLoadingMore(false);
    },
    [categoryKey, sort]
  );

  // Reset and reload whenever filter or sort changes.
  useEffect(() => {
    offsetRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  // Called by the IntersectionObserver sentinel in ProductGrid.
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(offsetRef.current, false);
  }, [loadingMore, hasMore, fetchPage]);

  return { products, loading, loadingMore, hasMore, error, loadMore };
}
