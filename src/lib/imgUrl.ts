/**
 * Returns the image URL for use in the app.
 * R2 serves images directly from the public CDN URL — no server-side transforms.
 * The "size" parameter is kept for API compatibility but is a no-op with R2.
 */

export type ImgSize = "tiny" | "full";

export function imgUrl(src: string | null | undefined, _size: ImgSize = "full"): string {
  if (!src) return "";
  return src;
}

/** Convenience: get first image from an array */
export function coverImg(images: string[] | null | undefined, fallback = "", size: ImgSize = "full"): string {
  const src = images?.[0] ?? fallback;
  return imgUrl(src, size);
}
