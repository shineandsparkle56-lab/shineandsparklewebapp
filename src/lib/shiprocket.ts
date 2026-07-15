import { supabase } from "./supabase";

export interface ShiprocketItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
}

export interface ShiprocketPayload {
  order_id: string;
  order_date: string;
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
  weight: number;
  items: ShiprocketItem[];
}

export interface ShiprocketResult {
  sr_order_id?: number;
  shipment_id?: number;
  awb?: string;
}

/** Build the item payload from order items.
 *
 * Shiprocket expects:
 *   selling_price = MRP (original price)
 *   discount      = MRP - actual selling price
 */
export function buildShiprocketItems(
  orderItems: { product: { id: number; name: string; price: number; original_price?: number }; quantity: number }[]
): ShiprocketItem[] {
  return orderItems.map((i) => {
    const mrp     = i.product.original_price ?? i.product.price;
    const selling = i.product.price;
    return {
      name:          i.product.name,
      sku:           `SNS-${i.product.id}`,
      units:         i.quantity,
      selling_price: mrp,
      discount:      Math.max(0, mrp - selling),
    };
  });
}

/** Estimate package weight from total item count (min 0.5 kg) */
export function estimateWeight(totalUnits: number): number {
  return Math.max(0.5, parseFloat((totalUnits * 0.01).toFixed(2)));
}

/** Push order to Shiprocket — always creates a new order. */
export async function pushToShiprocket(
  payload: ShiprocketPayload
): Promise<ShiprocketResult> {
  // Use stable order_id — Shiprocket will reject if already exists,
  // preventing accidental duplicate shipments for the same order.
  const body = { ...payload, order_id: `SNS-${payload.order_id}` };

  const res = await fetch("/api/create-shiprocket-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned non-JSON response (${res.status}). Is the API server running? (npm run dev:api)`
    );
  }

  if (!res.ok) {
    throw new Error(
      (data?.error as string) ?? `Shiprocket error (${res.status}): ${JSON.stringify(data)}`
    );
  }

  const d     = data as Record<string, Record<string, unknown> | unknown>;
  const order = d?.order as Record<string, unknown> | undefined;

  return {
    sr_order_id: (d?.order_id  ?? order?.id)          as number | undefined,
    shipment_id: (d?.shipment_id ?? order?.shipment_id) as number | undefined,
    awb:         ((d?.awb_code  ?? order?.awb_code) ?? "") as string,
  };
}

/** Save sr_order_id + sr_shipment_id back to Supabase after a successful push */
export async function saveSrIds(dbOrderId: number, result: ShiprocketResult) {
  const patch: Record<string, unknown> = { status: "confirmed" };
  if (result.sr_order_id) patch.sr_order_id = result.sr_order_id;
  if (result.shipment_id) patch.sr_shipment_id = result.shipment_id;
  await supabase.from("orders").update(patch).eq("id", dbOrderId);
}
