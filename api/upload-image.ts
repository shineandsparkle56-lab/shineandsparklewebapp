import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { fileName, fileType, fileData } = req.body as {
    fileName: string;
    fileType: string;
    fileData: string; // base64
  };

  if (!fileName || !fileType || !fileData) {
    return res.status(400).json({ error: "fileName, fileType, and fileData are required" });
  }

  if (!BUCKET || !PUBLIC_URL) {
    return res.status(500).json({ error: "R2 environment variables are not configured" });
  }

  try {
    const buffer = Buffer.from(fileData, "base64");
    const key = `${Date.now()}-${fileName}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: fileType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = `${PUBLIC_URL}/${key}`;
    return res.status(200).json({ url: publicUrl });
  } catch (err) {
    const e = err as Error;
    console.error("[upload-image]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
