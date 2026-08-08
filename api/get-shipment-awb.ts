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
  if (!res.ok) throw new Error(`Shiprocket auth failed (${res.status})`);
  const data = await res.json();
  if (!data.token) throw new Error("No token in auth response");
  cachedToken = data.token as string;
  tokenExpiry = now + 9 * 60 * 1000;
  return cachedToken;
}

/**
 * GET /api/get-shipment-awb?order_id=XXX
 *
 * Fetches order details from Shiprocket using sr_order_id.
 * The AWB is only present after a courier has been assigned
 * in the Shiprocket dashboard.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const orderId = typeof req.query.order_id === "string" ? req.query.order_id.trim() : "";
  if (!orderId) return res.status(400).json({ error: "order_id is required" });

  try {
    let token = await getToken();

    // GET /orders/show/{sr_order_id} — returns full order detail including awb_code
    const doFetch = (t: string) =>
      fetchWithTimeout(
        `${SR_BASE}/orders/show/${encodeURIComponent(orderId)}`,
        { method: "GET", headers: { Authorization: `Bearer ${t}` } },
        10000
      );

    let r = await doFetch(token);
    if (r.status === 401) {
      cachedToken = null; tokenExpiry = 0;
      token = await getToken();
      r = await doFetch(token);
    }

    const raw = await r.json() as Record<string, unknown>;

    if (!r.ok) {
      return res.status(r.status).json({ error: (raw?.message as string) ?? JSON.stringify(raw) });
    }

    // Response shape: { data: { shipments: { awb, ... }, awb_data: { awb, ... } } }
    const dataObj = (raw?.data ?? raw) as Record<string, unknown>;
    const shipments = dataObj?.shipments as Record<string, unknown> | undefined;
    const awbData   = dataObj?.awb_data  as Record<string, unknown> | undefined;

    const awb = (
      (shipments?.awb as string) ||
      (awbData?.awb   as string) ||
      (dataObj?.awb_code as string) ||
      ""
    ).trim();

    return res.status(200).json({ awb_code: awb });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") return res.status(504).json({ error: "Request timed out." });
    console.error("[get-shipment-awb]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
