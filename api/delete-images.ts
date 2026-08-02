import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { urls } = req.body as { urls: string[] };

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls array is required" });
  }

  if (!BUCKET || !PUBLIC_URL) {
    return res.status(500).json({ error: "R2 environment variables are not configured" });
  }

  try {
    // Extract the object key from each public URL
    const keys = urls
      .map((url) => {
        try {
          const u = new URL(url);
          // Strip leading slash to get the key
          return u.pathname.replace(/^\//, "");
        } catch {
          return null;
        }
      })
      .filter((k): k is string => k !== null && k.length > 0);

    if (keys.length === 0) {
      return res.status(200).json({ deleted: 0 });
    }

    await r2.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );

    return res.status(200).json({ deleted: keys.length });
  } catch (err) {
    const e = err as Error;
    console.error("[delete-images]", e.message);
    // Log but don't fail — deletion is best-effort cleanup
    return res.status(200).json({ deleted: 0, warning: e.message });
  }
}
