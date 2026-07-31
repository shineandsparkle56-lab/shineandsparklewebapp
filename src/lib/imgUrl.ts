/**
 * Append Supabase Storage image transformation parameters to reduce egress.
 * Only applies to URLs from our own Supabase project — external URLs pass through unchanged.
 *
 * Supabase docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Sizes:
 *   tiny   → 64×64,   cover crop, q70  — variant dots, order mini images, admin swatches
 *   thumb  → 400×400, cover crop, q75  — product grid cards, cart items, admin list
 *   medium → 800px wide,          q80  — product detail modal main image, PDF
 *   full   → original, no transform    — zoom lightbox, image editor
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export type ImgSize = "tiny" | "thumb" | "medium" | "full";

const SIZE_PARAMS: Record<ImgSize, string> = {
  tiny:   "width=64&height=64&resize=cover&quality=70",
  thumb:  "width=600&height=600&resize=cover&quality=75",
  medium: "width=1000&height=1000&resize=cover&quality=80",
  full:   "",
};

export function imgUrl(src: string | null | undefined, size: ImgSize = "thumb"): string {
  if (!src) return "";
  if (!SUPABASE_URL) return src;
  if (!src.startsWith(SUPABASE_URL)) return src;
  if (size === "full") return src;

  const params = SIZE_PARAMS[size];
  if (!params) return src;

  const transformed = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  const separator = transformed.includes("?") ? "&" : "?";
  return `${transformed}${separator}${params}`;
}

/** Convenience: get first image from an array, with size transform */
export function coverImg(images: string[] | null | undefined, fallback = "", size: ImgSize = "thumb"): string {
  const src = images?.[0] ?? fallback;
  return imgUrl(src, size);
}
