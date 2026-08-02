import { supabase } from "./supabase";

export type AppSettingKey = "cod_enabled" | "search_bar_enabled";

/** Fetch a single setting value. Returns null if not found. */
export async function getSetting(key: AppSettingKey): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as string;
}

/** Upsert a setting value. */
export async function setSetting(key: AppSettingKey, value: string): Promise<void> {
  await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
