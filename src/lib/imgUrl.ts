/**
 * Append Supabase Storage image transformation parameters to reduce egress.
 * Only applies to URLs from our own Supabase project — external URLs pass through unchanged.
 *
 * Supabase docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Usage:
 *   imgUrl(src)              → thumbnail (400px wide, quality 75) — product cards, admin list
 *   imgUrl(src, "medium")    → medium (800px wide, quality 80)    — product detail modal
 *   imgUrl(src, "full")      → original (no transform)            — zoom lightbox, PDF
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export type ImgSize = "thumb" | "medium" | "full";

const SIZE_PARAMS: Record<ImgSize, string> = {
  thumb:  "width=400&height=400&resize=cover&quality=75",
  medium: "width=800&quality=80",
  full:   "",                      // no transform — original quality
};

export function imgUrl(src: string | null | undefined, size: ImgSize = "thumb"): string {
  if (!src) return "";
  if (!SUPABASE_URL) return src;                     // env not loaded yet
  if (!src.startsWith(SUPABASE_URL)) return src;     // not our Supabase — CDN/placeholder
  if (size === "full") return src;                   // caller wants full res

  const params = SIZE_PARAMS[size];
  if (!params) return src;

  // Supabase transformation endpoint:
  // /storage/v1/object/public/<bucket>/<path>
  // → /storage/v1/render/image/public/<bucket>/<path>?<params>
  const transformed = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );

  // Avoid double query strings
  const separator = transformed.includes("?") ? "&" : "?";
  return `${transformed}${separator}${params}`;
}

/** Convenience: get first image from an array, with size transform */
export function coverImg(images: string[] | null | undefined, fallback = "", size: ImgSize = "thumb"): string {
  const src = images?.[0] ?? fallback;
  return imgUrl(src, size);
}
