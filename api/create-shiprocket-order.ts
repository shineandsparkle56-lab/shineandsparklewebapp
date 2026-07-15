import type { VercelRequest, VercelResponse } from "@vercel/node";

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

// ── Token cache (shared across warm invocations) ──────────────
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
  tokenExpiry = now + 9 * 24 * 60 * 60 * 1000; // cache for 9 days
  return cachedToken;
}

// ── Types for the incoming request body ──────────────────────
export interface CreateOrderPayload {
  order_id: string;           // your internal DB order id (as string)
  order_date: string;         // ISO date string
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_pincode: string;
  payment_mode: "prepaid" | "cod";
  subtotal: number;
  shipping_charge: number;
  cod_charge: number;
  grand_total: number;
  items: {
    name: string;
    sku: string;
    units: number;
    selling_price: number;
    discount?: number;
  }[];
  weight?: number;            // kg — defaults to 0.5
  length?: number;            // cm
  breadth?: number;
  height?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    return res.status(500).json({ error: "SHIPROCKET_EMAIL / PASSWORD env vars not set" });
  }
  if (!process.env.SHIPROCKET_PICKUP_LOCATION) {
    return res.status(500).json({ error: "SHIPROCKET_PICKUP_LOCATION env var not set (e.g. 'Home' or your pickup location name in Shiprocket dashboard)" });
  }

  const body = req.body as CreateOrderPayload;

  if (!body?.order_id || !body?.customer_name || !body?.customer_pincode) {
    return res.status(400).json({ error: "Missing required fields: order_id, customer_name, customer_pincode" });
  }

  try {
    let token = await getToken();

    // Split customer name into first + last
    const nameParts = body.customer_name.trim().split(" ");
    const firstName = nameParts[0] ?? body.customer_name;
    const lastName = nameParts.slice(1).join(" ") || ".";

    const srPayload = {
      order_id: body.order_id,
      order_date: body.order_date ?? new Date().toISOString().slice(0, 19),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
      channel_id: "",
      comment: "",
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: body.customer_address,
      billing_address_2: "",
      billing_isd_code: "91",
      billing_city: body.customer_city,
      billing_pincode: body.customer_pincode,
      billing_state: body.customer_state,
      billing_country: "India",
      billing_email: "",
      billing_phone: body.customer_mobile,
      billing_alternate_phone: "",
      shipping_is_billing: true,
      shipping_customer_name: "",
      shipping_last_name: "",
      shipping_address: "",
      shipping_address_2: "",
      shipping_city: "",
      shipping_pincode: "",
      shipping_country: "",
      shipping_state: "",
      shipping_email: "",
      shipping_phone: "",
      order_items: body.items.map((item) => ({
        name: item.name,
        sku: item.sku || `SKU-${item.name.slice(0, 6).replace(/\s/g, "").toUpperCase()}`,
        units: item.units,
        selling_price: item.selling_price,
        discount: item.discount ?? 0,
        tax: 0,
        hsn: "",
      })),
      payment_method: body.payment_mode === "cod" ? "COD" : "Prepaid",
      // Combine shipping + COD charge into a single shipping_charges field.
      // Shiprocket prints transaction_charges as "Other Charges" on the invoice,
      // which is confusing — keeping it 0 and rolling everything into shipping_charges.
      shipping_charges: (body.shipping_charge ?? 0) + (body.cod_charge ?? 0),
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: body.subtotal,
      length: body.length ?? 5,
      breadth: body.breadth ?? 5,
      height: body.height ?? 3,
      weight: body.weight ?? 0.5,
    };

    const createRes = await fetchWithTimeout(
      `${SR_BASE}/orders/create/adhoc`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(srPayload),
      },
      12000
    );

    // Auto-refresh expired token and retry once
    if (createRes.status === 401) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      const retryRes = await fetchWithTimeout(
        `${SR_BASE}/orders/create/adhoc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(srPayload),
        },
        12000
      );
      const retryData = await retryRes.json();
      if (!retryRes.ok) {
        return res.status(retryRes.status).json({ error: JSON.stringify(retryData) });
      }
      return res.status(200).json(retryData);
    }

    const srData = await createRes.json();

    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: JSON.stringify(srData) });
    }

    return res.status(200).json(srData);
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      return res.status(504).json({ error: "Shiprocket request timed out. Try again." });
    }
    console.error("[create-shiprocket-order]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
