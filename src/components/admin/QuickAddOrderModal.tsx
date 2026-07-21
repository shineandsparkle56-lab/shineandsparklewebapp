import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { OrderRow } from "./EditOrderModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (order: OrderRow) => void;
  onError: (msg: string) => void;
}

interface FormState {
  customer_name: string;
  subtotal: string;
  shipping_charge: string;
  cod_charge: string;
}

const EMPTY: FormState = {
  customer_name: "",
  subtotal: "",
  shipping_charge: "0",
  cod_charge: "0",
};

export function QuickAddOrderModal({ open, onClose, onCreated, onError }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const subtotal       = Number(form.subtotal)        || 0;
  const shippingCharge = Number(form.shipping_charge) || 0;
  const codCharge      = Number(form.cod_charge)      || 0;
  const grandTotal     = subtotal + shippingCharge + codCharge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      onError("Customer name is required.");
      return;
    }
    if (subtotal <= 0) {
      onError("Subtotal must be greater than 0.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("orders")
      .insert({
        items: [],
        subtotal,
        shipping_charge: shippingCharge,
        cod_charge: codCharge,
        grand_total: grandTotal,
        pincode: "",
        payment_mode: codCharge > 0 ? "cod" : "prepaid",
        customer_name: form.customer_name.trim(),
        customer_mobile: "",
        customer_address: "",
        customer_city: "",
        customer_state: "",
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      onError(`Failed to create order: ${error.message}`);
      setSaving(false);
      return;
    }

    onCreated(data as OrderRow);
    setForm(EMPTY);
    onClose();
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Quick Add Order</h2>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="label">Name</label>
                <input
                  required
                  autoFocus
                  value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)}
                  placeholder="Customer name"
                  className="input"
                />
              </div>

              {/* Subtotal, Shipping, COD in a 3-col grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Subtotal (₹)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.subtotal}
                    onChange={(e) => set("subtotal", e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Shipping (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.shipping_charge}
                    onChange={(e) => set("shipping_charge", e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">COD (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.cod_charge}
                    onChange={(e) => set("cod_charge", e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </div>
              </div>

              {/* Grand total pill */}
              <div className="flex items-center justify-between bg-[#F3EEFB] rounded-xl px-4 py-2.5">
                <span className="text-sm text-[#6B35C2] font-medium">Grand Total</span>
                <span className="text-base font-bold text-[#6B35C2]">₹{grandTotal}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Create
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
