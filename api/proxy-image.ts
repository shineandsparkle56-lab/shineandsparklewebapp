import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Server-side image proxy — fetches any image URL and returns it as base64.
 * Used by the PDF generator to avoid browser CORS restrictions.
 *
 * GET /api/proxy-image?url=https://...
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url query param required" });
  }

  try {
    const response = await fetch(url, { headers: { "User-Agent": "ShineSparkle-PDF/1.0" } });
    if (!response.ok) return res.status(502).json({ error: `Upstream ${response.status}` });

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/webp";
    const base64 = buffer.toString("base64");

    return res.status(200).json({ base64, contentType });
  } catch (err) {
    const e = err as Error;
    return res.status(500).json({ error: e.message });
  }
}
