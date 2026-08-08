import type { VercelRequest, VercelResponse } from "@vercel/node";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: string | null = null;
let tokenExpiry = 0;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const res = await fetchWithTimeout(
    `${SR_BASE}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    },
    6000
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shiprocket auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) throw new Error(`No token in Shiprocket auth response`);

  cachedToken = data.token as string;
  tokenExpiry = now + 9 * 60 * 1000; // cache for 9 minutes
  return cachedToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const awb = typeof req.query.awb === "string" ? req.query.awb.trim() : "";
  if (!awb) {
    return res.status(400).json({ error: "AWB code is required" });
  }

  try {
    let token = await getToken();

    const trackRes = await fetchWithTimeout(
      `${SR_BASE}/courier/track/awb/${encodeURIComponent(awb)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      10000
    );

    // Auto-refresh expired token and retry once
    if (trackRes.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      const retryRes = await fetchWithTimeout(
        `${SR_BASE}/courier/track/awb/${encodeURIComponent(awb)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
        10000
      );
      const retryData = await retryRes.json();
      if (!retryRes.ok) {
        return res.status(retryRes.status).json({ error: JSON.stringify(retryData) });
      }
      return res.status(200).json(retryData);
    }

    const data = await trackRes.json();
    if (!trackRes.ok) {
      return res.status(trackRes.status).json({ error: JSON.stringify(data) });
    }

    return res.status(200).json(data);
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Shiprocket tracking request timed out. Try again." });
    }
    console.error("[track-shipment]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
