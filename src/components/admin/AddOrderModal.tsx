import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ShoppingBag, CheckCircle2, Search, Minus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useProducts } from "../../context/ProductsContext";
import type { OrderRow } from "./EditOrderModal";

// ── Types ─────────────────────────────────────────────────────
interface CartLine {
  product: OrderRow["items"][number]["product"];
  quantity: number;
}

interface FormState {
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  pincode: string;
  payment_mode: "prepaid" | "cod";
  shipping_charge: string;
  cod_charge: string;
}

const EMPTY_FORM: FormState = {
  customer_name: "",
  customer_mobile: "",
  customer_address: "",
  customer_city: "",
  customer_state: "",
  pincode: "",
  payment_mode: "prepaid",
  shipping_charge: "0",
  cod_charge: "0",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (order: OrderRow) => void;
  onError: (msg: string) => void;
}

// ── Component ─────────────────────────────────────────────────
export function AddOrderModal({ open, onClose, onCreated, onError }: Props) {
  const { products } = useProducts();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ── Product search ────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [products, search]);

  // ── Cart helpers ──────────────────────────────────────────────
  const addToCart = (p: (typeof products)[number]) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          product: {
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            original_price: p.originalPrice,
            discount: p.discount,
            wholesale_price: p.wholesale_price,
            shipping_credit: p.shipping_credit,
            image: p.images?.[0] ?? p.image,
            images: p.images ?? [p.image],
          },
          quantity: 1,
        },
      ];
    });
  };

  const setQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l))
      );
    }
  };

  // ── Totals ────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const shippingCharge = Number(form.shipping_charge) || 0;
  const codCharge = Number(form.cod_charge) || 0;
  const grandTotal =
    subtotal + shippingCharge + (form.payment_mode === "cod" ? codCharge : 0);

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      onError("Add at least one product to the order.");
      return;
    }

    setSaving(true);

    const payload = {
      items: cart.map((l) => ({ product: l.product, quantity: l.quantity })),
      subtotal,
      shipping_charge: shippingCharge,
      cod_charge: codCharge,
      grand_total: grandTotal,
      pincode: form.pincode.trim(),
      payment_mode: form.payment_mode,
      customer_name: form.customer_name.trim(),
      customer_mobile: form.customer_mobile.trim(),
      customer_address: form.customer_address.trim(),
      customer_city: form.customer_city.trim(),
      customer_state: form.customer_state.trim(),
      status: "pending",
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select()
      .single();

    if (error) {
      onError(`Failed to create order: ${error.message}`);
      setSaving(false);
      return;
    }

    onCreated(data as OrderRow);
    // Reset
    setForm(EMPTY_FORM);
    setCart([]);
    setSearch("");
    onClose();
    setSaving(false);
  };

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    setCart([]);
    setSearch("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">New Order</h2>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto flex-1 p-5 space-y-6"
            >
              {/* ── Section 1: Product picker ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Products
                </p>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1]"
                  />
                </div>

                {/* Product list */}
                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-gray-400 text-xs py-6">
                      No products found
                    </p>
                  ) : (
                    filteredProducts.map((p) => {
                      const inCart = cart.find((l) => l.product.id === p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <img
                            src={p.images?.[0] ?? p.image}
                            alt={p.name}
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {p.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              ₹{p.price}
                              {p.stock === 0 && (
                                <span className="ml-1 text-red-400">· Out of stock</span>
                              )}
                            </p>
                          </div>
                          {inCart ? (
                            /* Qty stepper */
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setQty(p.id, inCart.quantity - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-500 transition-colors text-gray-600"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold text-gray-800">
                                {inCart.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(p.id, inCart.quantity + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#F3EEFB] hover:text-[#9B6FD1] transition-colors text-gray-600"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(p)}
                              className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Cart summary */}
                {cart.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[#9B6FD1]/20 bg-[#F3EEFB]/40 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-[#9B6FD1] mb-2">
                      Selected ({cart.length} line{cart.length !== 1 ? "s" : ""})
                    </p>
                    {cart.map((l) => (
                      <div
                        key={l.product.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <img
                          src={l.product.image}
                          alt={l.product.name}
                          className="w-7 h-7 rounded-lg object-cover shrink-0"
                        />
                        <span className="flex-1 text-gray-700 truncate">
                          {l.product.name}
                        </span>
                        <span className="text-gray-400 text-xs">×{l.quantity}</span>
                        <span className="text-gray-800 font-semibold text-xs shrink-0">
                          ₹{l.product.price * l.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(l.product.id, 0)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 2: Customer details ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Customer Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Name</label>
                    <input
                      required
                      value={form.customer_name}
                      onChange={(e) => set("customer_name", e.target.value)}
                      placeholder="Full name"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <input
                      value={form.customer_mobile}
                      onChange={(e) => set("customer_mobile", e.target.value)}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Pincode</label>
                    <input
                      value={form.pincode}
                      onChange={(e) => set("pincode", e.target.value)}
                      placeholder="6-digit pincode"
                      maxLength={6}
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Address</label>
                    <textarea
                      rows={2}
                      value={form.customer_address}
                      onChange={(e) => set("customer_address", e.target.value)}
                      placeholder="House No., Street, Area"
                      className="input resize-none"
                    />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input
                      value={form.customer_city}
                      onChange={(e) => set("customer_city", e.target.value)}
                      placeholder="City"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input
                      value={form.customer_state}
                      onChange={(e) => set("customer_state", e.target.value)}
                      placeholder="State"
                      className="input"
                    />
                  </div>
                </div>
              </section>

              {/* ── Section 3: Payment & charges ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Payment & Charges
                </p>

                {/* Payment mode toggle */}
                <div className="grid grid-cols-2 gap-2 mb-3">
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
                      {mode === "prepaid" ? "Online / Prepaid" : "Cash on Delivery"}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Shipping (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.shipping_charge}
                      onChange={(e) => set("shipping_charge", e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">COD Charge (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.cod_charge}
                      onChange={(e) => set("cod_charge", e.target.value)}
                      disabled={form.payment_mode !== "cod"}
                      className="input disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>

              {/* ── Order total summary ── */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>
                    Subtotal ({cart.reduce((s, l) => s + l.quantity, 0)} item
                    {cart.reduce((s, l) => s + l.quantity, 0) !== 1 ? "s" : ""})
                  </span>
                  <span className="font-semibold text-gray-800">₹{subtotal}</span>
                </div>
                {shippingCharge > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-semibold text-gray-800">
                      ₹{shippingCharge}
                    </span>
                  </div>
                )}
                {form.payment_mode === "cod" && codCharge > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>COD Charge</span>
                    <span className="font-semibold text-gray-800">₹{codCharge}</span>
                  </div>
                )}
                <div className="h-px bg-gray-200 my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span className="text-gray-800">Grand Total</span>
                  <span className="text-[#9B6FD1]">₹{grandTotal}</span>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-3 justify-end pb-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || cart.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Create Order
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
