import type { VercelRequest, VercelResponse } from "@vercel/node";
import JSZip from "jszip";

/**
 * Server-side image zip builder — fetches product images from R2 (no CORS
 * restriction server-side) and returns a single .zip file.
 *
 * POST /api/download-images
 * Body: { urls: string[]; zipName: string }
 * Response: application/zip stream
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { urls, zipName } = req.body as { urls?: string[]; zipName?: string };

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls array is required" });
  }
  if (!zipName || typeof zipName !== "string") {
    return res.status(400).json({ error: "zipName is required" });
  }

  try {
    const zip = new JSZip();
    const folder = zip.folder(zipName)!;

    await Promise.all(
      urls.map(async (url, idx) => {
        const upstream = await fetch(url, {
          headers: { "User-Agent": "ShineSparkle-Admin/1.0" },
        });
        if (!upstream.ok) {
          throw new Error(`Failed to fetch image ${idx + 1}: HTTP ${upstream.status}`);
        }
        const buffer = Buffer.from(await upstream.arrayBuffer());
        // Derive extension from URL path, strip any query string, default to "jpg"
        const ext = url.split("?")[0].split(".").pop() || "jpg";
        folder.file(`${zipName}-${idx + 1}.${ext}`, buffer);
      })
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    return res.status(200).send(zipBuffer);
  } catch (err) {
    const e = err as Error;
    return res.status(500).json({ error: e.message });
  }
}
