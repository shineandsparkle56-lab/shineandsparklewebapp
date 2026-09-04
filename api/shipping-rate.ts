import type { VercelRequest, VercelResponse } from "@vercel/node";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: string | null = null;
let tokenExpiry = 0;

interface CourierCompany {
  courier_name: string;
  estimated_delivery_days: number;
  freight_charge: number;
  cod_charges?: number;
  whatsapp_charges?: number;
}

interface BestOption {
  pickupPincode: string;
  courier: CourierCompany;
  totalCharge: number;
}

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

// Returns available couriers for a single pickup → delivery route. Returns []
// on non-OK responses so a bad pickup pincode doesn't kill the whole request.
async function getCouriers(
  token: string,
  pickupPincode: string,
  deliveryPincode: string,
  cod: boolean,
  weight: number,
  orderValue: number
): Promise<CourierCompany[]> {
  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: String(weight),
    cod: cod ? "1" : "0",
    declared_value: String(orderValue),
    is_return: "0",
  });

  const res = await fetchWithTimeout(
    `${SR_BASE}/courier/serviceability/?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
    8000
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.available_courier_companies ?? []) as CourierCompany[];
}

// Query all pickup pincodes in parallel and return a flat list of options.
async function getAllOptions(
  token: string,
  pickupPincodes: string[],
  deliveryPincode: string,
  cod: boolean,
  weight: number,
  orderValue: number
): Promise<BestOption[]> {
  const results = await Promise.all(
    pickupPincodes.map(async (pickup) => {
      const couriers = await getCouriers(token, pickup, deliveryPincode, cod, weight, orderValue);
      return couriers.map((courier): BestOption => ({
        pickupPincode: pickup,
        courier,
        totalCharge: courier.freight_charge + (courier.whatsapp_charges ?? 0),
      }));
    })
  );
  return results.flat();
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

  const {
    pincode,
    cod = false,
    weight = 0.5,
    orderValue = 0,
    pickupPincodes,   // array — preferred
    pickupPincode,    // single string — legacy fallback
  } = (req.body as {
    pincode: string;
    cod: boolean;
    weight: number;
    orderValue: number;
    pickupPincodes?: string[];
    pickupPincode?: string;
  }) || {};

  if (!pincode || !/^\d{6}$/.test(String(pincode))) {
    return res.status(400).json({ error: "Enter a valid 6-digit pincode" });
  }

  // Resolve pickup pincodes: body array → single body param → env var
  const resolvedPincodes: string[] = (() => {
    if (pickupPincodes?.length) return pickupPincodes.map((p) => p.trim()).filter(Boolean);
    if (pickupPincode?.trim()) return [pickupPincode.trim()];
    const env = process.env.SHIPROCKET_PICKUP_PINCODES || process.env.SHIPROCKET_PICKUP_PINCODE || "";
    return env.split(",").map((p) => p.trim()).filter(Boolean);
  })();

  if (!resolvedPincodes.length) {
    return res.status(500).json({ error: "No pickup pincodes configured" });
  }

  try {
    let token = await getToken();
    let options = await getAllOptions(token, resolvedPincodes, pincode, cod, weight, orderValue);

    // If everything came back empty, try a one-time token refresh and retry
    if (!options.length) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      options = await getAllOptions(token, resolvedPincodes, pincode, cod, weight, orderValue);
    }

    if (!options.length) {
      return res.status(200).json({
        serviceable: false,
        message: "Delivery not available to this pincode.",
      });
    }

    // Pick the globally cheapest option across all pickup locations and couriers
    options.sort((a, b) => a.totalCharge - b.totalCharge);
    const best = options[0];

    return res.status(200).json({
      serviceable: true,
      courierName: best.courier.courier_name,
      estimatedDays: best.courier.estimated_delivery_days,
      shippingCharge: Math.round(best.totalCharge),
      codCharge: cod ? Math.round(best.courier.cod_charges ?? 0) : 0,
      pickupPincode: best.pickupPincode,
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
