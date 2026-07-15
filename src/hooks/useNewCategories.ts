import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Returns a Set of category slugs that have at least one product
 * added in the last 3 days. Also includes "all" if any category qualifies.
 */
export function useNewCategories() {
  const [newCategories, setNewCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const since = new Date(Date.now() - THREE_DAYS_MS).toISOString();

    supabase
      .from("products")
      .select("category")
      .gt("created_at", since)
      .gt("stock", 0)
      .then(({ data }) => {
        if (!data?.length) return;
        const cats = new Set(data.map((r) => r.category as string));
        cats.add("all"); // "All" tab also gets the dot if any category has new
        setNewCategories(cats);
      });
  }, []);

  return newCategories;
}
