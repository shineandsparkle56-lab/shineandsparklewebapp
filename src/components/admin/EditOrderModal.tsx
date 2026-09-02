import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, X, CheckCircle2, Package, Warehouse, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending",   label: "Pending",   color: "bg-yellow-100 text-yellow-700" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { value: "shipped",   label: "Shipped",   color: "bg-purple-100 text-purple-700" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-600" },
];

export interface OrderRow {
  id: number;
  items: {
    product: {
      id: number;
      name: string;
      category: string;
      price: number;
      original_price?: number;
      discount?: number;
      wholesale_price: number;
      shipping_credit: number;
      image: string;
      images: string[];
    };
    quantity: number;
  }[];
  subtotal: number;
  shipping_charge: number;
  cod_charge: number;
  grand_total: number;
  raw_shipping_charge?: number;
  raw_cod_charge?: number;
  courier_name?: string;
  pincode: string;
  payment_mode: string;
  status?: OrderStatus;
  customer_name?: string;
  customer_mobile?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  created_at: string;
  sr_order_id?: number;
  sr_shipment_id?: number;
  awb_code?: string;
  stock_deducted?: boolean;
  // Shipping dimensions
  box_length?: number;
  box_breadth?: number;
  box_height?: number;
  weight_kg?: number;
  // Shiprocket pickup location name (overrides the default set in Settings)
  pickup_location?: string;
}

interface Props {
  order: OrderRow | null;
  onClose: () => void;
  onSaved: (updated: Partial<OrderRow>) => void;
  onError: (msg: string) => void;
}

interface FormState {
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  pincode: string;
  payment_mode: string;
  status: OrderStatus;
  subtotal: string;
  shipping_charge: string;
  cod_charge: string;
  raw_shipping_charge: string;
  raw_cod_charge: string;
  courier_name: string;
  // Shiprocket
  sr_order_id: string;
  sr_shipment_id: string;
  awb_code: string;
  // Shipping box
  box_length: string;
  box_breadth: string;
  box_height: string;
  weight_kg: string;
  // Order date
  created_at: string;
  // Pickup location override
  pickup_location: string;
}

function toForm(order: OrderRow): FormState {
  return {
    customer_name:      order.customer_name      ?? "",
    customer_mobile:    order.customer_mobile    ?? "",
    customer_address:   order.customer_address   ?? "",
    customer_city:      order.customer_city      ?? "",
    customer_state:     order.customer_state     ?? "",
    pincode:            order.pincode            ?? "",
    payment_mode:       order.payment_mode       ?? "prepaid",
    status:             order.status             ?? "pending",
    subtotal:           String(order.subtotal),
    shipping_charge:    String(order.shipping_charge),
    cod_charge:         String(order.cod_charge),
    raw_shipping_charge: String(order.raw_shipping_charge ?? ""),
    raw_cod_charge:     String(order.raw_cod_charge      ?? ""),
    courier_name:       order.courier_name       ?? "",
    sr_order_id:        String(order.sr_order_id  ?? ""),
    sr_shipment_id:     String(order.sr_shipment_id ?? ""),
    awb_code:           order.awb_code           ?? "",
    box_length:         String(order.box_length  ?? 5),
    box_breadth:        String(order.box_breadth ?? 5),
    box_height:         String(order.box_height  ?? 3),
    weight_kg:          String(order.weight_kg   ?? 0.5),
    created_at:         order.created_at
      ? new Date(order.created_at).toISOString().slice(0, 16)
      : "",
    pickup_location:    order.pickup_location    ?? "",
  };
}

export function EditOrderModal({ order, onClose, onSaved, onError }: Props) {
  const [form, setForm] = useState<FormState>(() => order ? toForm(order) : ({} as FormState));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) setForm(toForm(order));
  }, [order?.id]);

  // Pickup locations
  interface PickupLoc { id: number; name: string; city: string; state: string; pin_code: string; is_primary: boolean; }
  const [pickupLocations, setPickupLocations] = useState<PickupLoc[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);

  useEffect(() => {
    if (!order) return;
    setPickupLoading(true);
    fetch("/api/get-pickup-locations")
      .then((r) => r.json())
      .then((d: { locations?: PickupLoc[]; error?: string }) => {
        if (d.locations) setPickupLocations(d.locations);
      })
      .catch(() => { /* silent — the free-text input is still usable */ })
      .finally(() => setPickupLoading(false));
  }, [!!order]);
  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSaving(true);

    const subtotal        = Number(form.subtotal)        || 0;
    const shipping_charge = Number(form.shipping_charge) || 0;
    const cod_charge      = Number(form.cod_charge)      || 0;
    const grand_total     = subtotal + shipping_charge + (form.payment_mode === "cod" ? cod_charge : 0);

    const patch: Partial<OrderRow> = {
      customer_name:      form.customer_name.trim(),
      customer_mobile:    form.customer_mobile.trim(),
      customer_address:   form.customer_address.trim(),
      customer_city:      form.customer_city.trim(),
      customer_state:     form.customer_state.trim(),
      pincode:            form.pincode.trim(),
      payment_mode:       form.payment_mode,
      status:             form.status,
      subtotal,
      shipping_charge,
      cod_charge,
      grand_total,
      raw_shipping_charge: form.raw_shipping_charge !== "" ? Number(form.raw_shipping_charge) : undefined,
      raw_cod_charge:      form.raw_cod_charge      !== "" ? Number(form.raw_cod_charge)      : undefined,
      courier_name:        form.courier_name.trim()  || undefined,
      sr_order_id:         form.sr_order_id  !== "" ? Number(form.sr_order_id)  : undefined,
      sr_shipment_id:      form.sr_shipment_id !== "" ? Number(form.sr_shipment_id) : undefined,
      awb_code:            form.awb_code.trim() || undefined,
      box_length:  parseFloat(form.box_length)  || 5,
      box_breadth: parseFloat(form.box_breadth) || 5,
      box_height:  parseFloat(form.box_height)  || 3,
      weight_kg:   parseFloat(form.weight_kg)   || 0.5,
      pickup_location: form.pickup_location.trim() || undefined,
      ...(form.created_at ? { created_at: new Date(form.created_at).toISOString() } : {}),
    };

    const { error, count } = await supabase
      .from("orders")
      .update(patch, { count: "exact" })
      .eq("id", order.id);

    if (error) {
      onError(`Failed to save order: ${error.message}`);
    } else if (count === 0) {
      onError("Update blocked by database policy. Add an UPDATE policy on the orders table in Supabase.");
    } else {
      onSaved(patch);
      onClose();
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Edit Order</h2>
                <span className="text-xs text-gray-400">#{order.id}</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Status */}
              <div>
                <label className="label">Order Status</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((s) => (
                    <button key={s.value} type="button" onClick={() => set("status", s.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                        form.status === s.value ? `${s.color} border-current` : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment mode */}
              <div>
                <label className="label">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["prepaid", "cod"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => set("payment_mode", mode)}
                      className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.payment_mode === mode
                          ? "bg-[#9B6FD1] border-[#9B6FD1] text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]/50"
                      }`}>
                      {mode === "prepaid" ? "Online Payment" : "Cash on Delivery"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Customer Name</label>
                  <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className="input" placeholder="Full name" />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input value={form.customer_mobile} onChange={(e) => set("customer_mobile", e.target.value)} className="input" placeholder="10-digit mobile" maxLength={10} />
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} className="input" placeholder="6-digit pincode" maxLength={6} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Address</label>
                  <textarea rows={2} value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} className="input resize-none" placeholder="House No., Street, Area" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input value={form.customer_city} onChange={(e) => set("customer_city", e.target.value)} className="input" placeholder="City" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input value={form.customer_state} onChange={(e) => set("customer_state", e.target.value)} className="input" placeholder="State" />
                </div>
              </div>

              {/* Charges */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Subtotal (₹)</label>
                  <input type="number" min="0" value={form.subtotal} onChange={(e) => set("subtotal", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Shipping (₹)</label>
                  <input type="number" min="0" value={form.shipping_charge} onChange={(e) => set("shipping_charge", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">COD Charge (₹)</label>
                  <input type="number" min="0" value={form.cod_charge} onChange={(e) => set("cod_charge", e.target.value)} className="input" />
                </div>
              </div>

              {/* Raw/actual charges */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Actual Shipping Cost (₹) <span className="font-normal normal-case text-gray-400">— admin only</span></label>
                  <input type="number" min="0" value={form.raw_shipping_charge} onChange={(e) => set("raw_shipping_charge", e.target.value)} className="input" placeholder="Leave blank if same as above" />
                </div>
                <div>
                  <label className="label">Actual COD Cost (₹) <span className="font-normal normal-case text-gray-400">— admin only</span></label>
                  <input type="number" min="0" value={form.raw_cod_charge} onChange={(e) => set("raw_cod_charge", e.target.value)} className="input" placeholder="Leave blank if same as above" />
                </div>
              </div>

              {/* Courier & AWB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Courier Name</label>
                  <input value={form.courier_name} onChange={(e) => set("courier_name", e.target.value)} className="input" placeholder="e.g. Xpressbees" />
                </div>
                <div>
                  <label className="label">AWB / Tracking No.</label>
                  <input value={form.awb_code} onChange={(e) => set("awb_code", e.target.value)} className="input font-mono" placeholder="e.g. 1234567890" />
                </div>
                <div>
                  <label className="label">Shiprocket Order ID</label>
                  <input type="number" value={form.sr_order_id} onChange={(e) => set("sr_order_id", e.target.value)} className="input font-mono" placeholder="SR order ID" />
                </div>
                <div>
                  <label className="label">Shiprocket Shipment ID</label>
                  <input type="number" value={form.sr_shipment_id} onChange={(e) => set("sr_shipment_id", e.target.value)} className="input font-mono" placeholder="SR shipment ID" />
                </div>
              </div>

              {/* Order date */}
              <div>
                <label className="label">Order Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={form.created_at}
                  onChange={(e) => set("created_at", e.target.value)}
                  className="input"
                />
              </div>

              {/* Pickup location override */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="w-4 h-4 text-[#9B6FD1]" />
                  <label className="label mb-0">
                    Pickup Location
                    <span className="ml-1 font-normal normal-case text-gray-400">— overrides default for this order</span>
                  </label>
                  {pickupLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                </div>
                {pickupLocations.length > 0 ? (
                  <select
                    value={form.pickup_location}
                    onChange={(e) => set("pickup_location", e.target.value)}
                    className="input"
                  >
                    <option value="">Use default (from Settings)</option>
                    {pickupLocations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} — {loc.city}, {loc.state} {loc.pin_code}{loc.is_primary ? " (Primary)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.pickup_location}
                    onChange={(e) => set("pickup_location", e.target.value)}
                    className="input"
                    placeholder="Leave blank to use default (e.g. Home, Home-2)"
                  />
                )}
              </div>

              {/* Shipping dimensions & weight */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-[#9B6FD1]" />
                  <label className="label mb-0">Box Size &amp; Weight (for Shiprocket)</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Length (cm)</label>
                    <input type="number" min="0.1" step="0.1" value={form.box_length} onChange={(e) => set("box_length", e.target.value)} className="input" placeholder="5" />
                  </div>
                  <div>
                    <label className="label">Breadth (cm)</label>
                    <input type="number" min="0.1" step="0.1" value={form.box_breadth} onChange={(e) => set("box_breadth", e.target.value)} className="input" placeholder="5" />
                  </div>
                  <div>
                    <label className="label">Height (cm)</label>
                    <input type="number" min="0.1" step="0.1" value={form.box_height} onChange={(e) => set("box_height", e.target.value)} className="input" placeholder="3" />
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input type="number" min="0.1" step="0.001" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} className="input" placeholder="0.5" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Volumetric weight = {(
                    (parseFloat(form.box_length) || 5) *
                    (parseFloat(form.box_breadth) || 5) *
                    (parseFloat(form.box_height) || 3) / 5000
                  ).toFixed(3)} kg · Dead weight = {parseFloat(form.weight_kg) || 0.5} kg ·
                  Charged = {Math.max(
                    (parseFloat(form.box_length) || 5) * (parseFloat(form.box_breadth) || 5) * (parseFloat(form.box_height) || 3) / 5000,
                    parseFloat(form.weight_kg) || 0.5
                  ).toFixed(3)} kg
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                    : <><CheckCircle2 className="w-4 h-4" />Save Changes</>
                  }
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { ORDER_STATUSES };
export type { OrderStatus };
