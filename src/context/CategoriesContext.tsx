import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";

export interface Category {
  id: number;
  name: string;       // e.g. "rings"
  label: string;      // e.g. "Rings"
  sort_order: number;
}

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  error: string;
  addCategory: (name: string, label: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  reorderCategories: (reordered: Category[]) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

function mapRow(row: Record<string, unknown>): Category {
  return {
    id: row.id as number,
    name: row.name as string,
    label: row.label as string,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (err) { setError(err.message); setLoading(false); return; }
    setCategories((data ?? []).map(mapRow));
    setLoading(false);
  };

  const addCategory = async (name: string, label: string) => {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const sort_order = categories.length;
    const { data, error: err } = await supabase
      .from("categories")
      .insert([{ name: slug, label: label.trim(), sort_order }])
      .select()
      .single();
    if (err) throw new Error(err.message);
    setCategories((prev) => [...prev, mapRow(data)]);
  };

  const deleteCategory = async (id: number) => {
    const { error: err } = await supabase.from("categories").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const reorderCategories = async (reordered: Category[]) => {
    // Optimistically update local state immediately
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updated);

    // Persist to Supabase — runs after every reorder event
    const results = await Promise.all(
      updated.map((c) =>
        supabase
          .from("categories")
          .update({ sort_order: c.sort_order })
          .eq("id", c.id)
          .select()
      )
    );

    // Log any failures so they're visible in the browser console
    results.forEach((res, i) => {
      if (res.error) {
        console.error(`Failed to update sort_order for category id=${updated[i].id}:`, res.error.message);
      }
    });
  };

  return (
    <CategoriesContext.Provider value={{ categories, loading, error, addCategory, deleteCategory, reorderCategories }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside CategoriesProvider");
  return ctx;
}
