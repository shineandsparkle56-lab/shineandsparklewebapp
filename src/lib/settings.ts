import { supabase } from "./supabase";

export type AppSettingKey =
  | "cod_enabled"
  | "all_category_image_url"
  | "min_order_value"
  | "default_pickup_location"
  | "default_pickup_pincodes"
  | "local_delivery_zones"
  | "thank_you_card_url"
  | "whatsapp_tpl_out_for_delivery"
  | "whatsapp_tpl_dispatched"
  | "whatsapp_tpl_delayed"
  | "whatsapp_tpl_feedback"
  | "whatsapp_tpl_thank_you";

export interface LocalDeliveryZone {
  pincode: string;
  charge: number;
  days: number;
  label: string;
}

/** Default WhatsApp message templates — placeholders: {name} {awb} {courier} {trackUrl} */
export const DEFAULT_WA_TEMPLATES = {
  out_for_delivery:
    `Hi {name}! 😊\n\nGreat news — your *Shine & Sparkle* order is out for delivery today! 🎉\n\n📦 AWB: {awb}\n🚚 Courier: {courier}\n🔗 Track your order: {trackUrl}\n\nPlease be available at the delivery address. See you soon! 💜`,
  dispatched:
    `Hi {name}! 😊\n\nYour *Shine & Sparkle* order has been dispatched! ✨\n\n📦 AWB: {awb}\n🚚 Courier: {courier}\n🔗 Track your order: {trackUrl}\n\nExpected delivery in 2–5 business days. Feel free to reach out if you have any questions! 💜`,
  delayed:
    `Hi {name},\n\nWe sincerely apologise — your *Shine & Sparkle* order is facing a slight delay in delivery. 🙏\n\n📦 AWB: {awb}\n🔗 Track your order: {trackUrl}\n\nWe are working to get it delivered to you as soon as possible. Thank you so much for your patience! 💜`,
  feedback:
    `Hi {name}! 😊\n\nWe hope you received your *Shine & Sparkle* order and are loving it! 💜✨\n\nWe'd love to hear your thoughts! Could you share a quick rating?\n\n⭐ 1 – Not satisfied\n⭐⭐⭐ 3 – It was okay\n⭐⭐⭐⭐⭐ 5 – Absolutely loved it!\n\nYour feedback helps us improve and serve you better. Thank you! 🙏💜`,
  thank_you:
    `Hi {name}! 😊\n\nYour *Shine & Sparkle* order has been successfully delivered! 🎉✨\n\nWe hope you love your new jewellery! 💍💜\n\nIf you face any issue with your order, please don't hesitate to reach out — your satisfaction is our priority! 🌟\n\nShop again: https://shineandsparkle.in\n\nThank you for choosing Shine & Sparkle! 💜`,
};

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
