import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";

export interface Category {
  id: number;
  name: string;       // slug e.g. "stud-earrings"
  label: string;      // display e.g. "Stud Earrings"
  sort_order: number;
  parent_id: number | null; // null = top-level; non-null = subcategory
}

interface CategoriesContextValue {
  categories: Category[];
  loading: boolean;
  error: string;
  addCategory: (name: string, label: string, parentId?: number | null) => Promise<void>;
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
    parent_id: typeof row.parent_id === "number" ? row.parent_id : null,
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

  const addCategory = async (name: string, label: string, parentId?: number | null) => {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    const sort_order = categories.length;
    const { data, error: err } = await supabase
      .from("categories")
      .insert([{ name: slug, label: label.trim(), sort_order, parent_id: parentId ?? null }])
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
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(updated);
    const results = await Promise.all(
      updated.map((c) =>
        supabase.from("categories").update({ sort_order: c.sort_order }).eq("id", c.id).select()
      )
    );
    results.forEach((res, i) => {
      if (res.error) console.error(`Failed sort_order update id=${updated[i].id}:`, res.error.message);
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

// ── Helpers ────────────────────────────────────────────────────

/** Returns only top-level categories (parent_id === null) */
export function useParentCategories() {
  const { categories } = useCategories();
  return categories.filter((c) => c.parent_id === null);
}

/** Returns subcategories for a given parent id */
export function useSubCategories(parentId: number | null) {
  const { categories } = useCategories();
  if (parentId === null) return [];
  return categories.filter((c) => c.parent_id === parentId);
}

/** Returns all categories grouped: { parent, children[] }[] */
export function useCategoryTree() {
  const { categories } = useCategories();
  const parents = categories.filter((c) => c.parent_id === null);
  return parents.map((p) => ({
    parent: p,
    children: categories.filter((c) => c.parent_id === p.id),
  }));
}
