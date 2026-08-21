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
    base_variant_color: typeof row.base_variant_color === "string" ? row.base_variant_color : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at: row.created_at as string | undefined,
  };
}

export function useInfiniteProducts(
  category: string | string[],
  sort: SortOrder,
  search = "",
  /** When set, filters products where tags @> [festivalTag] instead of by category */
  festivalTag?: string,
) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);

  // Stable key for deps — avoids infinite re-render when category is an array
  const categoryKey = Array.isArray(category) ? category.slice().sort().join(",") : category;

  // Detect if search is a pure numeric product ID (e.g. "212" or "SNS-212")
  const searchTerm = search.trim();
  const idMatch = searchTerm.match(/^(?:SNS-?)?(\d+)$/i);
  const searchId = idMatch ? Number(idMatch[1]) : null;

  const fetchPage = useCallback(
    async (from: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError("");

      let query = supabase
        .from("products")
        .select("*")
        .range(from, from + PAGE_SIZE - 1);

      // Hide out-of-stock items (skip when searching by ID)
      if (!searchId) query = query.gt("stock", 0);

      // Search by product ID
      if (searchId) {
        query = query.eq("id", searchId);
      } else if (searchTerm) {
        // Name search — case-insensitive contains
        query = query.ilike("name", `%${searchTerm}%`);
      } else if (festivalTag) {
        // Festival tag filter — products where tags array contains the festival tag
        query = query.contains("tags", [festivalTag]);
      } else {
        // Category filter only when not searching
        const catFilter = category;
        if (catFilter !== "all" && !(Array.isArray(catFilter) && catFilter.includes("all"))) {
          if (Array.isArray(catFilter)) {
            query = query.in("category", catFilter);
          } else {
            query = query.eq("category", catFilter);
          }
        }
      }

      // Server-side sort
      if (sort === "low-high") {
        query = query.order("price", { ascending: true }).order("id", { ascending: true });
      } else if (sort === "high-low") {
        query = query.order("price", { ascending: false }).order("id", { ascending: true });
      } else {
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
      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = from + rows.length;

      setLoading(false);
      setLoadingMore(false);
    },
    [categoryKey, sort, searchTerm, searchId, festivalTag] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    offsetRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(offsetRef.current, false);
  }, [loadingMore, hasMore, fetchPage]);

  return { products, loading, loadingMore, hasMore, error, loadMore };
}
