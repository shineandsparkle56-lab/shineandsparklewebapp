import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, X, CheckCircle2, Package, Warehouse, Loader2,
  Search, Plus, Minus, Trash2, ShoppingBag, ListOrdered,
} from "lucide-react";
import moment from "moment";
import { supabase } from "../../lib/supabase";
import { useProducts } from "../../context/ProductsContext";
import { imgUrl } from "../../lib/imgUrl";
import type { Product } from "../../data/products";

/* ─── order status ───────────────────────────────────────────── */
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending",   label: "Pending",   color: "bg-yellow-100 text-yellow-700" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700"    },
  { value: "shipped",   label: "Shipped",   color: "bg-purple-100 text-purple-700"},
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-700"  },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-600"      },
];

/* ─── OrderRow ───────────────────────────────────────────────── */
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
    variant_id?: string | null;
    variant_label?: string | null;
  }[];
  subtotal: number;
  shipping_charge: number;
  cod_charge: number;
  grand_total: number;
  raw_shipping_charge?: number;
  raw_cod_charge?: number;
  gift_wrap_charges?: number;
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
  box_length?: number;
  box_breadth?: number;
  box_height?: number;
  weight_kg?: number;
  pickup_location?: string;
  pickup_pincode?: string;
}

/* ─── CartLine (internal item state) ────────────────────────── */
type ItemProduct = OrderRow["items"][number]["product"];

interface CartLine {
  product:      ItemProduct;
  quantity:     number;
  variant_id?:  string | null;
  variant_label?: string | null;
}

/* ─── helpers ────────────────────────────────────────────────── */
function linePrice(line: CartLine): number {
  return line.product.price * line.quantity;
}

function calcSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + linePrice(l), 0);
}

function calcGrandTotal(
  subtotal: number,
  shipping: number,
  cod: number,
  giftWrap: number,
  paymentMode: string,
): number {
  return subtotal + shipping + giftWrap + (paymentMode === "cod" ? cod : 0);
}

/* ─── form state ─────────────────────────────────────────────── */
interface FormState {
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  pincode: string;
  payment_mode: string;
  status: OrderStatus;
  shipping_charge: string;
  cod_charge: string;
  raw_shipping_charge: string;
  raw_cod_charge: string;
  gift_wrap_charges: string;
  courier_name: string;
  sr_order_id: string;
  sr_shipment_id: string;
  awb_code: string;
  box_length: string;
  box_breadth: string;
  box_height: string;
  weight_kg: string;
  created_at: string;
  pickup_location: string;
}

function toForm(order: OrderRow): FormState {
  return {
    customer_name:       order.customer_name       ?? "",
    customer_mobile:     order.customer_mobile     ?? "",
    customer_address:    order.customer_address    ?? "",
    customer_city:       order.customer_city       ?? "",
    customer_state:      order.customer_state      ?? "",
    pincode:             order.pincode             ?? "",
    payment_mode:        order.payment_mode        ?? "prepaid",
    status:              order.status              ?? "pending",
    shipping_charge:     String(order.shipping_charge),
    cod_charge:          String(order.cod_charge),
    raw_shipping_charge: String(order.raw_shipping_charge ?? ""),
    raw_cod_charge:      String(order.raw_cod_charge      ?? ""),
    gift_wrap_charges:   String(order.gift_wrap_charges   ?? 0),
    courier_name:        order.courier_name        ?? "",
    sr_order_id:         String(order.sr_order_id  ?? ""),
    sr_shipment_id:      String(order.sr_shipment_id ?? ""),
    awb_code:            order.awb_code            ?? "",
    box_length:          String(order.box_length   ?? 5),
    box_breadth:         String(order.box_breadth  ?? 5),
    box_height:          String(order.box_height   ?? 3),
    weight_kg:           String(order.weight_kg    ?? 0.5),
    created_at:          order.created_at
      ? moment(order.created_at).format("YYYY-MM-DDTHH:mm")
      : "",
    pickup_location:     order.pickup_location     ?? "",
  };
}

/* ─── component props ────────────────────────────────────────── */
interface Props {
  order: OrderRow | null;
  onClose: () => void;
  onSaved: (updated: Partial<OrderRow>) => void;
  onError: (msg: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   EditOrderModal
═══════════════════════════════════════════════════════════════ */
export function EditOrderModal({ order, onClose, onSaved, onError }: Props) {

  /* ── tabs ── */
  const [tab, setTab] = useState<"details" | "items">("details");

  /* ── details form ── */
  const [form, setForm] = useState<FormState>(() =>
    order ? toForm(order) : ({} as FormState),
  );
  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  /* ── items state ── */
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const { products } = useProducts();

  /* ── pickup locations ── */
  interface PickupLoc {
    id: number; name: string; city: string;
    state: string; pin_code: string; is_primary: boolean;
  }
  const [pickupLocations, setPickupLocations] = useState<PickupLoc[]>([]);
  const [pickupLoading,   setPickupLoading]   = useState(false);
  const [saving,          setSaving]          = useState(false);

  /* ── sync when order changes ── */
  useEffect(() => {
    if (!order) return;
    setForm(toForm(order));
    setTab("details");
    setSearch("");
    setExpandedProductId(null);
    // seed cart from existing order items
    setCart(
      order.items.map((i) => ({
        product:       i.product,
        quantity:      i.quantity,
        variant_id:    i.variant_id    ?? null,
        variant_label: i.variant_label ?? null,
      })),
    );
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── fetch pickup locations once ── */
  useEffect(() => {
    if (!order) return;
    setPickupLoading(true);
    fetch("/api/get-pickup-locations")
      .then((r) => r.json())
      .then((d: { locations?: PickupLoc[] }) => {
        if (d.locations) setPickupLocations(d.locations);
      })
      .catch(() => {})
      .finally(() => setPickupLoading(false));
  }, [!!order]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── derived totals ── */
  const subtotal    = calcSubtotal(cart);
  const shipping    = Number(form.shipping_charge)     || 0;
  const cod         = Number(form.cod_charge)          || 0;
  const giftWrap    = Number(form.gift_wrap_charges)   || 0;
  const grandTotal  = calcGrandTotal(subtotal, shipping, cod, giftWrap, form.payment_mode);

  /* ── product search results ── */
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 24);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
      .slice(0, 24);
  }, [products, search]);

  /* ── cart helpers ── */
  function addLine(p: Product, variantId?: string, variantLabel?: string, variantPrice?: number) {
    setCart((prev) => {
      const key   = variantId ?? `base-${p.id}`;
      const match = prev.find(
        (l) => l.product.id === p.id && (l.variant_id ?? `base-${l.product.id}`) === key,
      );
      if (match) {
        return prev.map((l) =>
          l === match ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          product: {
            id:              p.id,
            name:            p.name,
            category:        p.category,
            price:           variantPrice ?? p.price,
            original_price:  p.originalPrice,
            discount:        p.discount,
            wholesale_price: p.wholesale_price,
            shipping_credit: p.shipping_credit,
            image:           p.images?.[0] ?? p.image,
            images:          p.images ?? [p.image],
          },
          quantity:      1,
          variant_id:    variantId    ?? null,
          variant_label: variantLabel ?? null,
        },
      ];
    });
    setExpandedProductId(null);
  }

  function setQty(idx: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCart((prev) => prev.map((l, i) => i === idx ? { ...l, quantity: qty } : l));
    }
  }

  function removeLine(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── save ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setSaving(true);

    const grand_total = calcGrandTotal(subtotal, shipping, cod, giftWrap, form.payment_mode);

    const patch: Partial<OrderRow> = {
      /* items */
      items: cart.map((l) => ({
        product:       l.product,
        quantity:      l.quantity,
        variant_id:    l.variant_id    ?? null,
        variant_label: l.variant_label ?? null,
      })),
      subtotal,
      /* charges */
      shipping_charge:     shipping,
      cod_charge:          cod,
      gift_wrap_charges:   giftWrap,
      grand_total,
      raw_shipping_charge: form.raw_shipping_charge !== "" ? Number(form.raw_shipping_charge) : undefined,
      raw_cod_charge:      form.raw_cod_charge      !== "" ? Number(form.raw_cod_charge)      : undefined,
      /* customer */
      customer_name:    form.customer_name.trim(),
      customer_mobile:  form.customer_mobile.trim(),
      customer_address: form.customer_address.trim(),
      customer_city:    form.customer_city.trim(),
      customer_state:   form.customer_state.trim(),
      pincode:          form.pincode.trim(),
      payment_mode:     form.payment_mode,
      status:           form.status,
      /* logistics */
      courier_name:    form.courier_name.trim()  || undefined,
      awb_code:        form.awb_code.trim()      || undefined,
      sr_order_id:     form.sr_order_id     !== "" ? Number(form.sr_order_id)     : undefined,
      sr_shipment_id:  form.sr_shipment_id  !== "" ? Number(form.sr_shipment_id)  : undefined,
      box_length:      parseFloat(form.box_length)  || 5,
      box_breadth:     parseFloat(form.box_breadth) || 5,
      box_height:      parseFloat(form.box_height)  || 3,
      weight_kg:       parseFloat(form.weight_kg)   || 0.5,
      pickup_location: form.pickup_location.trim()  || undefined,
      ...(form.created_at
        ? { created_at: moment(form.created_at, "YYYY-MM-DDTHH:mm").toISOString() }
        : {}),
    };

    const { error, count } = await supabase
      .from("orders")
      .update(patch, { count: "exact" })
      .eq("id", order.id);

    if (error) {
      onError(`Failed to save order: ${error.message}`);
    } else if (count === 0) {
      onError("Update blocked by database policy.");
    } else {
      onSaved(patch);
      onClose();
    }
    setSaving(false);
  }

  /* ── shared input styles ── */
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-white";
  const lbl = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1";

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <AnimatePresence>
      {order && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{   scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: "92vh" }}
          >
            {/* ── sticky header ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800 text-sm">Edit Order</h2>
                <span className="text-xs text-gray-400">#{order.id}</span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── tab bar ── */}
            <div className="flex border-b border-gray-100 shrink-0 px-5">
              {(["details", "items"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    tab === t
                      ? "border-[#9B6FD1] text-[#9B6FD1]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "details"
                    ? <><ListOrdered className="w-3.5 h-3.5" /> Details</>
                    : <><ShoppingBag className="w-3.5 h-3.5" /> Items
                        {cart.length > 0 && (
                          <span className="ml-1 bg-[#9B6FD1] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {cart.reduce((s, l) => s + l.quantity, 0)}
                          </span>
                        )}
                      </>
                  }
                </button>
              ))}
            </div>

            {/* ── scrollable body ── */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto"
              style={{ minHeight: 0 }}
            >

              {/* ════════ DETAILS TAB ════════ */}
              {tab === "details" && (
                <div className="p-5 space-y-4">

                  {/* Status */}
                  <div>
                    <label className={lbl}>Order Status</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDER_STATUSES.map((s) => (
                        <button
                          key={s.value} type="button"
                          onClick={() => set("status", s.value)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${
                            form.status === s.value
                              ? `${s.color} border-current`
                              : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment mode */}
                  <div>
                    <label className={lbl}>Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["prepaid", "cod"] as const).map((mode) => (
                        <button
                          key={mode} type="button"
                          onClick={() => set("payment_mode", mode)}
                          className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                            form.payment_mode === mode
                              ? "bg-[#9B6FD1] border-[#9B6FD1] text-white"
                              : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]/50"
                          }`}
                        >
                          {mode === "prepaid" ? "Online" : "Cash on Delivery"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className={lbl}>Customer Name</label>
                      <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className={inp} placeholder="Full name" />
                    </div>
                    <div>
                      <label className={lbl}>Mobile</label>
                      <input value={form.customer_mobile} onChange={(e) => set("customer_mobile", e.target.value)} className={inp} placeholder="10-digit mobile" maxLength={10} />
                    </div>
                    <div>
                      <label className={lbl}>Pincode</label>
                      <input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} className={inp} placeholder="6-digit pincode" maxLength={6} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Address</label>
                      <textarea rows={2} value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} className={inp + " resize-none"} placeholder="House No., Street, Area" />
                    </div>
                    <div>
                      <label className={lbl}>City</label>
                      <input value={form.customer_city} onChange={(e) => set("customer_city", e.target.value)} className={inp} placeholder="City" />
                    </div>
                    <div>
                      <label className={lbl}>State</label>
                      <input value={form.customer_state} onChange={(e) => set("customer_state", e.target.value)} className={inp} placeholder="State" />
                    </div>
                  </div>

                  {/* Charges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={lbl}>Shipping (₹)</label>
                      <input type="number" min="0" value={form.shipping_charge} onChange={(e) => set("shipping_charge", e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>COD (₹)</label>
                      <input type="number" min="0" value={form.cod_charge} onChange={(e) => set("cod_charge", e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Gift Wrap (₹)</label>
                      <input type="number" min="0" value={form.gift_wrap_charges} onChange={(e) => set("gift_wrap_charges", e.target.value)} className={inp} placeholder="0" />
                    </div>
                    <div className="bg-[#F3EEFB] rounded-lg px-3 py-2 flex flex-col justify-center">
                      <p className="text-[10px] text-[#9B6FD1] font-semibold uppercase tracking-wide">Grand Total</p>
                      <p className="text-base font-bold text-[#7b2ff7]">₹{grandTotal}</p>
                    </div>
                  </div>

                  {/* Actual costs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Actual Shipping Cost <span className="normal-case font-normal text-gray-400">admin</span></label>
                      <input type="number" min="0" value={form.raw_shipping_charge} onChange={(e) => set("raw_shipping_charge", e.target.value)} className={inp} placeholder="If different" />
                    </div>
                    <div>
                      <label className={lbl}>Actual COD Cost <span className="normal-case font-normal text-gray-400">admin</span></label>
                      <input type="number" min="0" value={form.raw_cod_charge} onChange={(e) => set("raw_cod_charge", e.target.value)} className={inp} placeholder="If different" />
                    </div>
                  </div>

                  {/* Courier & AWB */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Courier</label>
                      <input value={form.courier_name} onChange={(e) => set("courier_name", e.target.value)} className={inp} placeholder="e.g. Xpressbees" />
                    </div>
                    <div>
                      <label className={lbl}>AWB / Tracking</label>
                      <input value={form.awb_code} onChange={(e) => set("awb_code", e.target.value)} className={inp + " font-mono"} placeholder="e.g. 1234567890" />
                    </div>
                    <div>
                      <label className={lbl}>SR Order ID</label>
                      <input type="number" value={form.sr_order_id} onChange={(e) => set("sr_order_id", e.target.value)} className={inp + " font-mono"} placeholder="Shiprocket order" />
                    </div>
                    <div>
                      <label className={lbl}>SR Shipment ID</label>
                      <input type="number" value={form.sr_shipment_id} onChange={(e) => set("sr_shipment_id", e.target.value)} className={inp + " font-mono"} placeholder="Shiprocket shipment" />
                    </div>
                  </div>

                  {/* Order date */}
                  <div>
                    <label className={lbl}>Order Date &amp; Time</label>
                    <input type="datetime-local" value={form.created_at} onChange={(e) => set("created_at", e.target.value)} className={inp} />
                  </div>

                  {/* Pickup location */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-[#9B6FD1]" />
                      <label className={lbl + " mb-0"}>Pickup Location <span className="normal-case font-normal text-gray-400">— override default</span></label>
                      {pickupLoading && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
                    </div>
                    {pickupLocations.length > 0 ? (
                      <select value={form.pickup_location} onChange={(e) => set("pickup_location", e.target.value)} className={inp}>
                        {(() => {
                          const usedLoc = order?.pickup_pincode
                            ? pickupLocations.find((l) => l.pin_code === order.pickup_pincode)
                            : null;
                          return (
                            <option value="">
                              {usedLoc
                                ? `Default — ${usedLoc.name} (${usedLoc.pin_code})`
                                : "Use default (from Settings)"}
                            </option>
                          );
                        })()}
                        {pickupLocations.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name} — {loc.city}, {loc.state} {loc.pin_code}
                            {loc.is_primary ? " (Primary)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input value={form.pickup_location} onChange={(e) => set("pickup_location", e.target.value)} className={inp} placeholder="Leave blank to use default" />
                    )}
                  </div>

                  {/* Box & weight */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-3.5 h-3.5 text-[#9B6FD1]" />
                      <label className={lbl + " mb-0"}>Box &amp; Weight</label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Length (cm)</label>
                        <input type="number" min="0.1" step="0.1" value={form.box_length} onChange={(e) => set("box_length", e.target.value)} className={inp} placeholder="5" />
                      </div>
                      <div>
                        <label className={lbl}>Breadth (cm)</label>
                        <input type="number" min="0.1" step="0.1" value={form.box_breadth} onChange={(e) => set("box_breadth", e.target.value)} className={inp} placeholder="5" />
                      </div>
                      <div>
                        <label className={lbl}>Height (cm)</label>
                        <input type="number" min="0.1" step="0.1" value={form.box_height} onChange={(e) => set("box_height", e.target.value)} className={inp} placeholder="3" />
                      </div>
                      <div>
                        <label className={lbl}>Weight (kg)</label>
                        <input type="number" min="0.001" step="0.001" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} className={inp} placeholder="0.5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Volumetric: {((parseFloat(form.box_length)||5)*(parseFloat(form.box_breadth)||5)*(parseFloat(form.box_height)||3)/5000).toFixed(3)} kg ·
                      Charged: {Math.max((parseFloat(form.box_length)||5)*(parseFloat(form.box_breadth)||5)*(parseFloat(form.box_height)||3)/5000, parseFloat(form.weight_kg)||0.5).toFixed(3)} kg
                    </p>
                  </div>

                </div>
              )}

              {/* ════════ ITEMS TAB ════════ */}
              {tab === "items" && (
                <div className="flex flex-col h-full">

                  {/* ── current items list ── */}
                  <div className="px-4 pt-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">
                        Order Items
                        {cart.length > 0 && (
                          <span className="ml-2 text-gray-400 font-normal">
                            {cart.reduce((s, l) => s + l.quantity, 0)} pcs · Subtotal ₹{subtotal}
                          </span>
                        )}
                      </p>
                    </div>

                    {cart.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        No items — add products below.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cart.map((line, idx) => (
                          <div
                            key={`${line.product.id}-${line.variant_id ?? "base"}-${idx}`}
                            className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100"
                          >
                            {/* thumbnail */}
                            <img
                              src={imgUrl(line.product.image, "tiny")}
                              alt={line.product.name}
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            {/* name + variant */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">
                                {line.product.name}
                              </p>
                              {line.variant_label && (
                                <p className="text-[11px] text-[#9B6FD1] font-medium">
                                  {line.variant_label}
                                </p>
                              )}
                              <p className="text-[11px] text-gray-400">
                                ₹{line.product.price} × {line.quantity} = ₹{linePrice(line)}
                              </p>
                            </div>
                            {/* qty stepper */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setQty(idx, line.quantity - 1)}
                                className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-[#9B6FD1] hover:text-[#9B6FD1] transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center text-xs font-bold text-gray-700">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(idx, line.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-[#9B6FD1] hover:text-[#9B6FD1] transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {/* remove */}
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── divider ── */}
                  <div className="mx-4 border-t border-gray-100 mt-1 mb-2" />

                  {/* ── product search ── */}
                  <div className="px-4 pb-2">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Add Products</p>
                    <div className="relative mb-3">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setExpandedProductId(null); }}
                        placeholder="Search products…"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-white"
                      />
                    </div>

                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                      {searchResults.map((p) => {
                        const hasVariants = p.variants && p.variants.length > 0;
                        const isExpanded  = expandedProductId === p.id;

                        return (
                          <div key={p.id} className="rounded-xl border border-gray-100 overflow-hidden">
                            {/* product row */}
                            <div className="flex items-center gap-2 px-2.5 py-2 bg-white">
                              <img
                                src={imgUrl(p.images?.[0] ?? p.image, "tiny")}
                                alt={p.name}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                                <p className="text-[11px] text-gray-400">
                                  ₹{p.price}
                                  {hasVariants && (
                                    <span className="ml-1.5 text-[#9B6FD1]">{p.variants.length} variants</span>
                                  )}
                                </p>
                              </div>

                              {hasVariants ? (
                                /* toggle variant picker */
                                <button
                                  type="button"
                                  onClick={() => setExpandedProductId(isExpanded ? null : p.id)}
                                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                                    isExpanded
                                      ? "bg-[#9B6FD1] border-[#9B6FD1] text-white"
                                      : "border-[#9B6FD1]/40 text-[#9B6FD1] hover:bg-[#F3EEFB]"
                                  }`}
                                >
                                  {isExpanded ? "Close" : "Pick"}
                                </button>
                              ) : (
                                /* direct add */
                                <button
                                  type="button"
                                  onClick={() => addLine(p)}
                                  className="shrink-0 w-7 h-7 rounded-lg bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* variant picker (expanded) */}
                            {hasVariants && isExpanded && (
                              <div className="bg-[#F9F5FF] border-t border-[#E9D5FF] px-2.5 py-2 space-y-1">
                                {/* base option */}
                                {p.base_variant_label && (
                                  <button
                                    type="button"
                                    onClick={() => addLine(p, undefined, p.base_variant_label ?? undefined, p.price)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F3EEFB] border border-gray-100 text-left transition-colors"
                                  >
                                    {p.base_variant_color && (
                                      <span
                                        className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                                        style={{ background: p.base_variant_color }}
                                      />
                                    )}
                                    <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                                      {p.base_variant_label}
                                    </span>
                                    <span className="text-[11px] text-gray-400 shrink-0">₹{p.price}</span>
                                    <Plus className="w-3 h-3 text-[#9B6FD1] shrink-0" />
                                  </button>
                                )}
                                {/* named variants */}
                                {p.variants.map((v) => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => addLine(p, v.id, v.label, v.price ?? p.price)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F3EEFB] border border-gray-100 text-left transition-colors"
                                  >
                                    {v.color && (
                                      <span
                                        className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                                        style={{ background: v.color }}
                                      />
                                    )}
                                    {v.images?.[0] && !v.color && (
                                      <img
                                        src={imgUrl(v.images[0], "tiny")}
                                        alt={v.label}
                                        className="w-4 h-4 rounded object-cover shrink-0"
                                      />
                                    )}
                                    <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                                      {v.label}
                                    </span>
                                    <span className="text-[11px] text-gray-400 shrink-0">
                                      ₹{v.price ?? p.price}
                                    </span>
                                    <Plus className="w-3 h-3 text-[#9B6FD1] shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {searchResults.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-4">No products found.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── sticky save bar ── */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-500">
                  {cart.length > 0 && (
                    <span>
                      {cart.reduce((s, l) => s + l.quantity, 0)} items ·{" "}
                      <span className="font-semibold text-[#7b2ff7]">₹{grandTotal}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60"
                  >
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                      : <><CheckCircle2 className="w-4 h-4" />Save Changes</>
                    }
                  </button>
                </div>
              </div>

            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
