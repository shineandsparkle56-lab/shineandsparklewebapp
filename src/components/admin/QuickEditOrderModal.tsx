import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { OrderRow, OrderStatus } from "./EditOrderModal";
import { ORDER_STATUSES } from "./EditOrderModal";

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
}

function toForm(order: OrderRow): FormState {
  return {
    customer_name:    order.customer_name    ?? "",
    customer_mobile:  order.customer_mobile  ?? "",
    customer_address: order.customer_address ?? "",
    customer_city:    order.customer_city    ?? "",
    customer_state:   order.customer_state   ?? "",
    pincode:          order.pincode          ?? "",
    payment_mode:     order.payment_mode     ?? "prepaid",
    status:           order.status           ?? "pending",
    subtotal:         String(order.subtotal  ?? 0),
    shipping_charge:  String(order.shipping_charge ?? 0),
    cod_charge:       String(order.cod_charge ?? 0),
  };
}

export function QuickEditOrderModal({ order, onClose, onSaved, onError }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    order ? toForm(order) : ({} as FormState),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) setForm(toForm(order));
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const subtotal      = Number(form.subtotal)        || 0;
  const shippingCharge = Number(form.shipping_charge) || 0;
  const codCharge     = Number(form.cod_charge)       || 0;
  const grandTotal    = subtotal + shippingCharge + (form.payment_mode === "cod" ? codCharge : 0);

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-white";
  const lbl = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    if (!form.customer_name.trim()) {
      onError("Customer name is required.");
      return;
    }
    if (subtotal <= 0) {
      onError("Subtotal must be greater than 0.");
      return;
    }

    setSaving(true);

    const patch: Partial<OrderRow> = {
      customer_name:    form.customer_name.trim(),
      customer_mobile:  form.customer_mobile.trim(),
      customer_address: form.customer_address.trim(),
      customer_city:    form.customer_city.trim(),
      customer_state:   form.customer_state.trim(),
      pincode:          form.pincode.trim(),
      payment_mode:     form.payment_mode,
      status:           form.status,
      subtotal,
      shipping_charge:  shippingCharge,
      cod_charge:       codCharge,
      grand_total:      grandTotal,
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

  return (
    <AnimatePresence>
      {order && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{   scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col"
            style={{ maxHeight: "92vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800 text-sm">Edit Quick Order</h2>
                <span className="text-xs text-gray-400">#{order.id}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Status */}
              <div>
                <label className={lbl}>Order Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
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
                      key={mode}
                      type="button"
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

              {/* Customer name */}
              <div>
                <label className={lbl}>Customer Name</label>
                <input
                  required
                  value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)}
                  className={inp}
                  placeholder="Full name"
                />
              </div>

              {/* Mobile + Pincode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Mobile</label>
                  <input
                    value={form.customer_mobile}
                    onChange={(e) => set("customer_mobile", e.target.value)}
                    className={inp}
                    placeholder="10-digit mobile"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className={lbl}>Pincode</label>
                  <input
                    value={form.pincode}
                    onChange={(e) => set("pincode", e.target.value)}
                    className={inp}
                    placeholder="6-digit"
                    maxLength={6}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={lbl}>Address</label>
                <textarea
                  rows={2}
                  value={form.customer_address}
                  onChange={(e) => set("customer_address", e.target.value)}
                  className={inp + " resize-none"}
                  placeholder="House No., Street, Area"
                />
              </div>

              {/* City + State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>City</label>
                  <input
                    value={form.customer_city}
                    onChange={(e) => set("customer_city", e.target.value)}
                    className={inp}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <input
                    value={form.customer_state}
                    onChange={(e) => set("customer_state", e.target.value)}
                    className={inp}
                    placeholder="State"
                  />
                </div>
              </div>

              {/* Subtotal + Shipping + COD + Grand Total */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Subtotal (₹)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.subtotal}
                    onChange={(e) => set("subtotal", e.target.value)}
                    className={inp}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={lbl}>Shipping (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.shipping_charge}
                    onChange={(e) => set("shipping_charge", e.target.value)}
                    className={inp}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={lbl}>COD (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.cod_charge}
                    onChange={(e) => set("cod_charge", e.target.value)}
                    className={inp}
                    placeholder="0"
                  />
                </div>
                <div className="bg-[#F3EEFB] rounded-lg px-3 py-2 flex flex-col justify-center">
                  <p className="text-[10px] text-[#9B6FD1] font-semibold uppercase tracking-wide">Grand Total</p>
                  <p className="text-base font-bold text-[#7b2ff7]">₹{grandTotal}</p>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
