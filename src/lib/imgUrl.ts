/**
 * Append Supabase Storage image transformation parameters to reduce egress.
 * Only applies to URLs from our own Supabase project — external URLs pass through unchanged.
 *
 * Supabase docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Sizes:
 *   tiny → 200×200, cover crop, q85  — admin thumbnails & order icons
 *   full → 1080×1080, cover crop, q90 — all client-facing images (grid, modal, cart)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export type ImgSize = "tiny" | "full";

const SIZE_PARAMS: Record<ImgSize, string> = {
  tiny: "width=200&height=200&resize=cover&quality=85",
  full: "width=1080&height=1080&resize=cover&quality=90",
};

export function imgUrl(src: string | null | undefined, size: ImgSize = "full"): string {
  if (!src) return "";
  if (!SUPABASE_URL) return src;
  if (!src.startsWith(SUPABASE_URL)) return src;

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
export function coverImg(images: string[] | null | undefined, fallback = "", size: ImgSize = "full"): string {
  const src = images?.[0] ?? fallback;
  return imgUrl(src, size);
}
