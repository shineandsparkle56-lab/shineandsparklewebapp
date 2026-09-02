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
  if (!data.token) throw new Error(`No token in auth response: ${JSON.stringify(data)}`);

  cachedToken = data.token as string;
  tokenExpiry = now + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

export interface PickupLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  is_primary: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    return res.status(500).json({ error: "SHIPROCKET_EMAIL / PASSWORD env vars not set" });
  }

  try {
    let token = await getToken();

    const doFetch = (t: string) =>
      fetchWithTimeout(
        `${SR_BASE}/settings/company/pickup`,
        { headers: { Authorization: `Bearer ${t}` } },
        8000
      );

    let srRes = await doFetch(token);

    // Auto-refresh expired token once
    if (srRes.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      srRes = await doFetch(token);
    }

    const data = await srRes.json();

    if (!srRes.ok) {
      return res.status(srRes.status).json({ error: JSON.stringify(data) });
    }

    // Shiprocket returns: { data: { shipping_address: [...] } }
    const raw: Record<string, unknown>[] =
      (data?.data?.shipping_address as Record<string, unknown>[]) ?? [];

    const locations: PickupLocation[] = raw.map((loc) => ({
      id:         (loc.id ?? loc.pickup_location_id ?? 0) as number,
      name:       (loc.pickup_location ?? loc.name ?? "") as string,
      address:    (loc.address ?? loc.address_2 ?? "") as string,
      city:       (loc.city ?? "") as string,
      state:      (loc.state ?? "") as string,
      pin_code:   String(loc.pin_code ?? loc.pincode ?? ""),
      is_primary: Boolean(loc.is_primary_location ?? false),
    }));

    return res.status(200).json({ locations });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Request timed out. Please try again." });
    }
    console.error("[get-pickup-locations]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
