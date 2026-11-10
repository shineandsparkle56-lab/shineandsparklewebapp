import { supabase } from "./supabase";

export interface ShiprocketItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  hsn?: string;   // HSN code — e.g. "7117" for imitation jewellery
  tax?: number;   // GST amount in Rs per unit (GST-inclusive back-calculation)
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
  gift_wrap_charges?: number;
  grand_total: number;
  weight: number;
  length?: number;
  breadth?: number;
  height?: number;
  items: ShiprocketItem[];
  /** Shiprocket pickup location name. If omitted the API falls back to SHIPROCKET_PICKUP_LOCATION env var. */
  pickup_location?: string;
}

export interface ShiprocketResult {
  sr_order_id?: number;
  shipment_id?: number;
  awb?: string;
}

// Default HSN and GST rate fallbacks for imitation jewellery
const DEFAULT_HSN      = "7117";
const DEFAULT_GST_RATE = 3; // %

/** Calculate per-unit GST amount using GST-inclusive back-calculation.
 *  selling_price already includes GST, so:
 *  taxable = selling / (1 + rate/100)
 *  tax     = selling - taxable
 */
function calcTaxPerUnit(sellingPrice: number, gstRate: number): number {
  const taxable = sellingPrice / (1 + gstRate / 100);
  return parseFloat((sellingPrice - taxable).toFixed(2));
}

/** Build the item payload from order items.
 *
 * Shiprocket expects:
 *   selling_price = MRP (original price)
 *   discount      = MRP - actual selling price
 *   tax           = GST amount in Rs per unit (back-calculated from selling price)
 *   hsn           = HSN code from product snapshot, falls back to "7117"
 */
export function buildShiprocketItems(
  orderItems: { product: { id: number; name: string; price: number; original_price?: number } & { hsn_code?: string; gst_rate?: number }; quantity: number; variant_id?: string | null; variant_label?: string | null }[]
): ShiprocketItem[] {
  return orderItems.map((i) => {
    const mrp     = i.product.original_price ?? i.product.price;
    const selling = i.product.price;
    const sku = i.variant_id
      ? `SNS-${i.product.id}-${i.variant_id}`
      : `SNS-${i.product.id}`;
    const hsn     = (i.product.hsn_code?.trim()) || DEFAULT_HSN;
    const gstRate = i.product.gst_rate ?? DEFAULT_GST_RATE;
    return {
      name:          i.variant_label ? `${i.product.name} (${i.variant_label})` : i.product.name,
      sku,
      units:         i.quantity,
      selling_price: mrp,
      discount:      Math.max(0, mrp - selling),
      hsn,
      tax:           calcTaxPerUnit(selling, gstRate),
    };
  });
}

/**
 * Wholesale variant — uses wholesale_price as the selling_price so the
 * Shiprocket invoice reflects wholesale values rather than retail.
 * Falls back to the retail price if wholesale_price is 0 or missing.
 */
export function buildShiprocketItemsWholesale(
  orderItems: { product: { id: number; name: string; price: number; original_price?: number; wholesale_price?: number } & { hsn_code?: string; gst_rate?: number }; quantity: number; variant_id?: string | null; variant_label?: string | null }[]
): ShiprocketItem[] {
  return orderItems.map((i) => {
    const wholesale = i.product.wholesale_price && i.product.wholesale_price > 0
      ? i.product.wholesale_price
      : i.product.price;
    const sku = i.variant_id
      ? `SNS-${i.product.id}-${i.variant_id}`
      : `SNS-${i.product.id}`;
    const hsn     = (i.product.hsn_code?.trim()) || DEFAULT_HSN;
    const gstRate = i.product.gst_rate ?? DEFAULT_GST_RATE;
    return {
      name:          i.variant_label ? `${i.product.name} (${i.variant_label})` : i.product.name,
      sku,
      units:         i.quantity,
      selling_price: wholesale,
      discount:      0,
      hsn,
      tax:           calcTaxPerUnit(wholesale, gstRate),
    };
  });
}

/** Estimate package weight from total item count (min 0.5 kg) */
export function estimateWeight(totalUnits: number): number {
  return Math.max(0.1, parseFloat((totalUnits * 0.01).toFixed(2)));
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

/** Save sr_order_id + sr_shipment_id + awb_code back to Supabase after a successful push */
export async function saveSrIds(dbOrderId: number, result: ShiprocketResult) {
  const patch: Record<string, unknown> = { status: "confirmed" };
  if (result.sr_order_id) patch.sr_order_id = result.sr_order_id;
  if (result.shipment_id) patch.sr_shipment_id = result.shipment_id;
  if (result.awb)         patch.awb_code = result.awb;
  await supabase.from("orders").update(patch).eq("id", dbOrderId);
}
