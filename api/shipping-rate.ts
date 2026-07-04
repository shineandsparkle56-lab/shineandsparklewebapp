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
  if (!data.token) throw new Error(`No token in response: ${JSON.stringify(data)}`);

  cachedToken = data.token as string;
  tokenExpiry = now + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function checkServiceability(
  token: string,
  pincode: string,
  cod: boolean,
  weight: number,
  orderValue: number
) {
  const params = new URLSearchParams({
    pickup_postcode: process.env.SHIPROCKET_PICKUP_PINCODE!,
    delivery_postcode: pincode,
    weight: String(weight),
    cod: cod ? "1" : "0",
    declared_value: String(orderValue),
    is_return: "0",
  });

  return fetchWithTimeout(
    `${SR_BASE}/courier/serviceability/?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
    8000
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    return res.status(500).json({ error: "SHIPROCKET_EMAIL / PASSWORD not set" });
  }
  if (!process.env.SHIPROCKET_PICKUP_PINCODE) {
    return res.status(500).json({ error: "SHIPROCKET_PICKUP_PINCODE not set" });
  }

  const { pincode, cod = false, weight = 0.5, orderValue = 0 } = (req.body as {
    pincode: string;
    cod: boolean;
    weight: number;
    orderValue: number;
  }) || {};

  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    return res.status(400).json({ error: "Enter a valid 6-digit pincode" });
  }

  try {
    let token = await getToken();
    let srRes = await checkServiceability(token, pincode, cod, weight, orderValue);

    // Auto-refresh if token expired
    if (srRes.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      srRes = await checkServiceability(token, pincode, cod, weight, orderValue);
    }

    const srData = await srRes.json();

    if (!srRes.ok) {
      return res.status(500).json({
        error: `Shiprocket error (${srRes.status}): ${JSON.stringify(srData)}`,
      });
    }

    const available: Array<{
      courier_name: string;
      estimated_delivery_days: number;
      freight_charge: number;
      cod_charges?: number;
    }> = srData?.data?.available_courier_companies ?? [];

    if (!available.length) {
      return res.status(200).json({
        serviceable: false,
        message: "Delivery not available to this pincode.",
      });
    }

    available.sort((a, b) => a.freight_charge - b.freight_charge);
    const best = available[0];

    return res.status(200).json({
      serviceable: true,
      courierName: best.courier_name,
      estimatedDays: best.estimated_delivery_days,
      shippingCharge: Math.round(best.freight_charge),
      codCharge: cod ? Math.round(best.cod_charges ?? 0) : 0,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Request timed out. Please try again." });
    }
    console.error("[shipping-rate]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
