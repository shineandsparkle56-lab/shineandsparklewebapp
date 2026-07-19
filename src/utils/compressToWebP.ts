/**
 * Compress any image file to WebP using the browser Canvas API.
 *
 * - Converts PNG / JPG / WEBP / HEIC-converted-by-browser → WebP
 * - Resizes if the longest edge exceeds `maxSizePx` (default 1200px)
 * - Quality 0.82 gives ~70-80% smaller files vs original JPEG/PNG
 * - Falls back to the original file if the browser doesn't support WebP export
 */
export async function compressToWebP(
  file: File,
  {
    maxSizePx = 2400,
    quality   = 0.82,
    name,
  }: { maxSizePx?: number; quality?: number; name?: string } = {}
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxSizePx || h > maxSizePx) {
        if (w >= h) { h = Math.round((h / w) * maxSizePx); w = maxSizePx; }
        else        { w = Math.round((w / h) * maxSizePx); h = maxSizePx; }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Build a safe filename from the provided name or original file name
      const baseName = name
        ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = url;
  });
}
