/**
 * Upload a File to Cloudflare R2 via the server-side API route.
 * Converts the file to base64 and POSTs to /api/upload-image.
 */
export async function uploadToR2(file: File, productName?: string): Promise<string> {
  const slug = productName
    ? productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "product";

  const fileName = `${slug}.webp`;

  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:image/webp;base64,")
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const res = await fetch("/api/upload-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      fileType: file.type || "image/webp",
      fileData: base64,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(body.error ?? "Upload failed");
  }

  const { url } = await res.json();
  return url as string;
}
