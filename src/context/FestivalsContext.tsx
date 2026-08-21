import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FestivalSponsor {
  name: string;
  logo_url: string;
}

export interface FestivalSection {
  title: string; // e.g. "Trendy Bangles"
  tag: string;   // matches a value in products.tags, e.g. "navratri-bangles"
}

export interface Festival {
  id: number;
  slug: string;        // URL slug  e.g. "navratri-2026"
  name: string;        // Display   e.g. "Navratri 2026"
  tagline: string;     // Sub-title e.g. "Celebrate with colours"
  banner_url: string;  // Hero image URL
  banner_bg: string;   // CSS colour / gradient  e.g. "#FF6B35"
  sponsors: FestivalSponsor[];
  sections: FestivalSection[];
  active_from: string | null;   // ISO date "YYYY-MM-DD"
  active_until: string | null;
  is_active: boolean;
  created_at: string;
}

export type FestivalInput = Omit<Festival, "id" | "created_at">;

interface FestivalsContextValue {
  festivals: Festival[];
  activeFestivals: Festival[]; // is_active === true (or within date window)
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addFestival: (f: FestivalInput) => Promise<Festival>;
  updateFestival: (id: number, f: Partial<FestivalInput>) => Promise<void>;
  deleteFestival: (id: number) => Promise<void>;
  toggleActive: (id: number, active: boolean) => Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Festival {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    tagline: (row.tagline as string) ?? "",
    banner_url: (row.banner_url as string) ?? "",
    banner_bg: (row.banner_bg as string) ?? "#9B6FD1",
    sponsors: Array.isArray(row.sponsors) ? (row.sponsors as FestivalSponsor[]) : [],
    sections: Array.isArray(row.sections) ? (row.sections as FestivalSection[]) : [],
    active_from: (row.active_from as string | null) ?? null,
    active_until: (row.active_until as string | null) ?? null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
  };
}

/** Returns true if festival should be shown to customers today */
export function isFestivalLive(f: Festival): boolean {
  if (!f.is_active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (f.active_from && today < f.active_from) return false;
  if (f.active_until && today > f.active_until) return false;
  return true;
}

// ── Context ──────────────────────────────────────────────────────────────────

const FestivalsContext = createContext<FestivalsContextValue | null>(null);

export function FestivalsProvider({ children }: { children: ReactNode }) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("festivals")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setFestivals((data ?? []).map(mapRow));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addFestival = async (f: FestivalInput): Promise<Festival> => {
    const { data, error: err } = await supabase
      .from("festivals")
      .insert([{
        slug:         f.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        name:         f.name.trim(),
        tagline:      f.tagline.trim(),
        banner_url:   f.banner_url.trim(),
        banner_bg:    f.banner_bg.trim() || "#9B6FD1",
        sponsors:     f.sponsors ?? [],
        sections:     f.sections ?? [],
        active_from:  f.active_from  || null,
        active_until: f.active_until || null,
        is_active:    f.is_active ?? false,
      }])
      .select()
      .single();
    if (err) throw new Error(err.message);
    const added = mapRow(data);
    setFestivals((prev) => [added, ...prev]);
    return added;
  };

  const updateFestival = async (id: number, f: Partial<FestivalInput>) => {
    const patch: Record<string, unknown> = {};
    if (f.slug        !== undefined) patch.slug         = f.slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (f.name        !== undefined) patch.name         = f.name.trim();
    if (f.tagline     !== undefined) patch.tagline      = f.tagline.trim();
    if (f.banner_url  !== undefined) patch.banner_url   = f.banner_url.trim();
    if (f.banner_bg   !== undefined) patch.banner_bg    = f.banner_bg.trim();
    if (f.sponsors    !== undefined) patch.sponsors     = f.sponsors;
    if (f.sections    !== undefined) patch.sections     = f.sections;
    if (f.active_from !== undefined) patch.active_from  = f.active_from  || null;
    if (f.active_until!== undefined) patch.active_until = f.active_until || null;
    if (f.is_active   !== undefined) patch.is_active    = f.is_active;

    const { error: err } = await supabase.from("festivals").update(patch).eq("id", id);
    if (err) throw new Error(err.message);
    setFestivals((prev) => prev.map((fest) => fest.id === id ? { ...fest, ...patch } as Festival : fest));
  };

  const deleteFestival = async (id: number) => {
    const { error: err } = await supabase.from("festivals").delete().eq("id", id);
    if (err) throw new Error(err.message);
    setFestivals((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleActive = async (id: number, active: boolean) => {
    const { error: err } = await supabase.from("festivals").update({ is_active: active }).eq("id", id);
    if (err) throw new Error(err.message);
    setFestivals((prev) => prev.map((f) => f.id === id ? { ...f, is_active: active } : f));
  };

  const activeFestivals = festivals.filter(isFestivalLive);

  return (
    <FestivalsContext.Provider value={{ festivals, activeFestivals, loading, error, refresh, addFestival, updateFestival, deleteFestival, toggleActive }}>
      {children}
    </FestivalsContext.Provider>
  );
}

export function useFestivals() {
  const ctx = useContext(FestivalsContext);
  if (!ctx) throw new Error("useFestivals must be used inside FestivalsProvider");
  return ctx;
}
