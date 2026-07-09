import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus, Plus, X, ShoppingBag, MessageCircle,
  Sparkles, Loader2, MapPin, CheckCircle2, AlertCircle, Truck, User, ChevronRight, ChevronLeft,
} from "lucide-react";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { supabase } from "../lib/supabase";
import { AutocompleteInput } from "./ui/AutocompleteInput";
import { INDIA_STATES, getCitiesForState } from "../data/indiaCitiesStates";

type PaymentMode = "prepaid" | "cod";
type Step = 1 | 2 | 3;

interface ShippingResult {
  serviceable: boolean;
  courierName?: string;
  estimatedDays?: number;
  shippingCharge?: number;
  codCharge?: number;
  message?: string;
}

interface CustomerInfo {
  name: string;
  mobile: string;
  address: string;
  city: string;
  state: string;
}

function estimateWeight(totalItems: number): number {
  // Each product weighs 10 g (0.01 kg); Shiprocket minimum is 0.5 kg
  return Math.max(0.5, parseFloat((totalItems * 0.01).toFixed(2)));
}

const INPUT_CLASS =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-400";

const STEP_LABELS: Record<Step, string> = {
  1: "Cart",
  2: "Delivery",
  3: "Details",
};

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, cart, removeFromCart, updateQuantity, subtotal, totalItems, shippingCredit } = useCart();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Customer info
  const [customer, setCustomer] = useState<CustomerInfo>({ name: "", mobile: "", address: "", city: "", state: "" });

  // Delivery / shipping
  const [pincode, setPincode] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("prepaid");
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [checkingRate, setCheckingRate] = useState(false);
  const [rateError, setRateError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const pincodeRef = useRef<HTMLInputElement>(null);

  const [sheetContentEl, setSheetContentEl] = useState<HTMLElement | null>(null);
  const onSheetContent = useCallback((node: HTMLElement | null) => {
    setSheetContentEl(node);
  }, []);

  const rawShippingCharge = shipping?.serviceable ? (shipping.shippingCharge ?? 0) : 0;
  const rawCodCharge = paymentMode === "cod" && shipping?.serviceable ? (shipping.codCharge ?? 0) : 0;
  // Apply per-product shipping credits — first reduce shipping, then COD, never go below ₹0
  const shippingCharge = Math.max(0, rawShippingCharge - shippingCredit);
  const creditRemainingAfterShipping = Math.max(0, shippingCredit - rawShippingCharge);
  const codCharge = Math.max(0, rawCodCharge - creditRemainingAfterShipping);
  const shippingSaved = rawShippingCharge > 0 ? Math.min(shippingCredit, rawShippingCharge) : 0;
  const codSaved = rawCodCharge > 0 ? Math.min(creditRemainingAfterShipping, rawCodCharge) : 0;
  const grandTotal = subtotal + shippingCharge + codCharge;

  const setC = (k: keyof CustomerInfo, v: string) =>
    setCustomer((prev) => ({ ...prev, [k]: v }));

  const customerComplete =
    customer.name.trim() !== "" &&
    /^\d{10}$/.test(customer.mobile) &&
    customer.address.trim() !== "" &&
    customer.city.trim() !== "" &&
    customer.state.trim() !== "";

  const canCheckout = customerComplete && shipping?.serviceable === true;

  // Reset step when drawer closes
  const handleOpenChange = (open: boolean) => {
    setIsCartOpen(open);
    if (!open) setStep(1);
  };

  // ── Shipping API ─────────────────────────────────────────────
  const callShippingAPI = async (pc: string, mode: PaymentMode) => {
    setCheckingRate(true);
    setShipping(null);
    setRateError("");
    try {
      const res = await fetch("/api/shipping-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: pc,
          cod: mode === "cod",
          weight: estimateWeight(totalItems),
          orderValue: subtotal,
        }),
      });
      const text = await res.text();
      if (!text) throw new Error("No response from server.");
      let data: ShippingResult & { error?: string };
      try { data = JSON.parse(text); } catch { throw new Error("Unexpected server response."); }
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rate");
      setShipping(data);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Could not check rate. Try again.");
    } finally {
      setCheckingRate(false);
    }
  };

  const checkShippingRate = async () => {
    if (!/^\d{6}$/.test(pincode)) { setRateError("Enter a valid 6-digit pincode."); return; }
    await callShippingAPI(pincode, paymentMode);
  };

  const handlePaymentModeChange = async (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (pincode.length === 6 && shipping !== null) await callShippingAPI(pincode, mode);
  };

  // Auto-fetch state & city from India Post API when pincode is 6 digits
  const fetchPincodeDetails = async (pc: string) => {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pc}`);
      const data = await res.json();
      if (
        Array.isArray(data) &&
        data[0]?.Status === "Success" &&
        data[0]?.PostOffice?.length
      ) {
        const po = data[0].PostOffice[0];
        const state = po.State ?? "";
        const city = po.District ?? po.Division ?? "";
        // Only prefill if fields are still empty (don't overwrite user input)
        setCustomer((prev) => ({
          ...prev,
          state: prev.state || state,
          city: prev.city || city,
        }));
      }
    } catch {
      // Silently ignore — pincode lookup is best-effort
    }
  };

  // Auto-check when 6 digits entered
  const handlePincodeChange = (v: string) => {
    const cleaned = v.replace(/\D/g, "").slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length < 6) { setShipping(null); setRateError(""); }
    if (cleaned.length === 6) {
      callShippingAPI(cleaned, paymentMode);
      fetchPincodeDetails(cleaned);
    }
  };

  // ── WhatsApp checkout ─────────────────────────────────────────
  const checkoutWhatsApp = async () => {
    setCheckingOut(true);
    const lines = cart
      .map((i) => `${i.product.name} x${i.quantity} - Rs. ${i.product.price * i.quantity}`)
      .join("\n");
    const shippingLine = shipping?.serviceable
      ? `\nShipping: Rs. ${shippingCharge}${codCharge > 0 ? `\nCOD Charge: Rs. ${codCharge}` : ""}`
      : "";
    const waMsg =
      `Hi Shine and Sparkle! I want to place an order:\n\n` +
      `*Customer Details*\n` +
      `Name: ${customer.name}\n` +
      `Mobile: ${customer.mobile}\n` +
      `Address: ${customer.address}\n` +
      `City: ${customer.city}\n` +
      `State: ${customer.state}\n` +
      `PIN Code: ${pincode}\n` +
      `Payment: ${paymentMode === "cod" ? "Cash on Delivery" : "Online / Prepaid"}\n\n` +
      `*Items Ordered*\n${lines}\n\n` +
      `Subtotal: Rs. ${subtotal}${shippingLine}\n` +
      `*Grand Total: Rs. ${grandTotal}*\n\n` +
      `Please confirm my order.`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    try {
      await supabase.from("orders").insert({
        items: cart.map((item) => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            category: item.product.category,
            price: item.product.price,
            image: item.product.images?.length ? item.product.images[0] : item.product.image,
            images: item.product.images ?? [item.product.image],
          },
          quantity: item.quantity,
        })),
        subtotal,
        shipping_charge: shippingCharge,
        cod_charge: codCharge,
        grand_total: grandTotal,
        pincode: pincode || "",
        payment_mode: paymentMode,
        customer_name: customer.name,
        customer_mobile: customer.mobile,
        customer_address: customer.address,
        customer_city: customer.city,
        customer_state: customer.state,
      });
    } catch (err) {
      console.error("Failed to save order:", err);
    }
    setCheckingOut(false);
    window.open(waUrl, "_blank");
  };

  // ── Step indicator ────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 px-5 py-3 border-b border-gray-100">
      {([1, 2, 3] as Step[]).map((s, idx) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
              step === s
                ? "bg-[#9B6FD1] text-white shadow-md shadow-purple-200"
                : step > s
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-400"
            }`}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={`text-[10px] font-semibold transition-colors ${step === s ? "text-[#9B6FD1]" : step > s ? "text-green-500" : "text-gray-400"}`}>
              {STEP_LABELS[s]}
            </span>
          </div>
          {idx < 2 && (
            <div className={`w-12 h-0.5 mx-1 mb-4 rounded transition-colors duration-300 ${step > s ? "bg-green-400" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Mini order summary bar (Steps 2 & 3) ─────────────────────
  const MiniSummary = () => (
    <div className="mx-4 mt-3 flex items-center justify-between bg-[#F3EEFB]/80 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <ShoppingBag className="w-3.5 h-3.5 text-[#9B6FD1]" />
        <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">₹{subtotal}</span>
    </div>
  );

  return (
    <Sheet open={isCartOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 max-h-screen" data-testid="cart-drawer" ref={onSheetContent}>

        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <SheetTitle className="font-serif text-xl text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 fill-[#9B6FD1] text-[#9B6FD1]" />
            Your Cart
            {totalItems > 0 && <span className="ml-1 text-sm font-normal text-gray-400">({totalItems} items)</span>}
          </SheetTitle>
        </SheetHeader>

        {/* Empty state */}
        {cart.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-[#F3EEFB] flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-[#9B6FD1]" />
            </div>
            <p className="text-gray-700 font-medium">Your cart is empty</p>
            <button onClick={() => setIsCartOpen(false)} className="text-sm text-[#9B6FD1] font-medium underline underline-offset-2">Browse Collection</button>
          </div>
        )}

        {cart.length > 0 && (
          <>
            <StepIndicator />

            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">

                {/* ═══════════════════════════════════════════
                    STEP 1 — Cart Review
                ═══════════════════════════════════════════ */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.2 }}>
                    <div className="px-4 pt-4 pb-2 space-y-3">
                      <AnimatePresence initial={false}>
                        {cart.map((item) => (
                          <motion.div
                            key={item.product.id}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24, height: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="flex gap-3 bg-[#F3EEFB]/50 rounded-2xl p-3 relative"
                            data-testid={`cart-item-${item.product.id}`}
                          >
                            <img
                              src={item.product.images?.length ? item.product.images[0] : item.product.image}
                              alt={item.product.name}
                              className="w-24 h-24 object-cover rounded-xl flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div className="pr-6">
                                <p className="font-serif text-gray-900 text-base leading-snug line-clamp-2">{item.product.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5 capitalize">{item.product.category}</p>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm">
                                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors" data-testid={`qty-decrease-${item.product.id}`}>
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="text-sm font-bold text-gray-800 w-6 text-center">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.product.id, 1)} disabled={item.quantity >= item.product.stock} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-testid={`qty-increase-${item.product.id}`}>
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <span className="font-bold text-gray-900 text-base">₹{item.product.price * item.quantity}</span>
                              </div>
                              {item.quantity >= item.product.stock && (
                                <p className="text-[11px] text-red-500 font-medium mt-1.5">Only {item.product.stock} in stock</p>
                              )}
                            </div>
                            <button onClick={() => removeFromCart(item.product.id)} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors" aria-label={`Remove ${item.product.name}`}>
                              <X className="w-4 h-4" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* ── Shipping savings banner ── */}
                    {(() => {
                      const FREE_THRESHOLD = 100;
                      const pct = Math.min(100, Math.round((shippingCredit / FREE_THRESHOLD) * 100));
                      const remaining = Math.max(0, FREE_THRESHOLD - shippingCredit);
                      const isMaxed = pct >= 100;
                      return (
                        <div className="mx-4 mb-3 rounded-2xl overflow-hidden border border-[#9B6FD1]/20 bg-gradient-to-br from-[#F3EEFB] to-white">
                          <div className="px-4 pt-3 pb-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Truck className="w-4 h-4 text-[#9B6FD1]" />
                                <span className="text-xs font-bold text-gray-700">
                                  {shippingCredit > 0 ? "Shipping Savings" : "Earn Free Shipping"}
                                </span>
                              </div>
                              {shippingCredit > 0 && (
                                <span className="text-xs font-bold text-[#9B6FD1]">
                                  ₹{shippingCredit} saved
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 rounded-full bg-[#9B6FD1]/15 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-[#9B6FD1] to-[#c084fc]"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                              />
                            </div>

                            {/* Status message */}
                            <p className="text-[11px] text-gray-500 mt-1.5">
                              {isMaxed
                                ? "🎉 Your cart is fully covered — shipping & COD charges will be waived!"
                                : shippingCredit > 0
                                ? `₹${shippingCredit} of your shipping is already covered. Add more products to save even more!`
                                : "Some products include free shipping credits. Add them to your cart to save on delivery!"}
                            </p>

                            {/* Browse more CTA — only when not maxed */}
                            {!isMaxed && (
                              <button
                                onClick={() => {
                                  setIsCartOpen(false);
                                  // Small delay lets the drawer close before scrolling
                                  setTimeout(() => {
                                    const el = document.getElementById("products") ?? document.getElementById("shop");
                                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }, 300);
                                }}
                                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#9B6FD1]/10 hover:bg-[#9B6FD1]/20 text-[#9B6FD1] text-xs font-semibold transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                {shippingCredit > 0
                                  ? `Browse more — save ₹${remaining} more on shipping`
                                  : "Browse products with free shipping"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {/* ═══════════════════════════════════════════
                    STEP 2 — Delivery
                ═══════════════════════════════════════════ */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.2 }}>
                    <MiniSummary />
                    <div className="mx-4 mt-3 bg-[#F3EEFB]/60 rounded-2xl p-4 space-y-4">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#9B6FD1]" />
                        Delivery & Shipping
                      </p>

                      {/* Pincode — auto-checks on 6 digits */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">PIN Code</label>
                        <div className="relative">
                          <input
                            ref={pincodeRef}
                            type="tel"
                            inputMode="numeric"
                            maxLength={6}
                            value={pincode}
                            onChange={(e) => handlePincodeChange(e.target.value)}
                            placeholder="Enter 6-digit pincode"
                            className={INPUT_CLASS + " pr-10"}
                          />
                          {checkingRate && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#9B6FD1]" />
                          )}
                          {shipping?.serviceable && !checkingRate && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>

                      {/* Error */}
                      {rateError && (
                        <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {rateError}
                        </div>
                      )}

                      {/* Shipping result */}
                      <AnimatePresence>
                        {shipping && !checkingRate && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`rounded-xl px-3 py-3 ${shipping.serviceable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                            {shipping.serviceable ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-semibold text-green-800">Delivery available</p>
                                    <p className="text-xs text-green-600">
                                      By {new Date(Date.now() + (shipping.estimatedDays ?? 0) * 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                                      {rawCodCharge > 0 ? ` • COD: ₹${codCharge}${codSaved > 0 ? ` (₹${codSaved} saved)` : ""}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Shipping</p>
                                  {shippingSaved > 0 && (
                                    <p className="text-xs line-through text-gray-400">₹{rawShippingCharge}</p>
                                  )}
                                  <p className={`text-base font-bold ${shippingCharge === 0 ? "text-green-600" : "text-[#9B6FD1]"}`}>
                                    {shippingCharge === 0 ? "FREE" : `₹${shippingCharge}`}
                                  </p>
                                  {shippingSaved > 0 && shippingCharge > 0 && (
                                    <p className="text-[10px] text-green-600 font-semibold">you save ₹{shippingSaved}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <p className="text-sm">{shipping.message ?? "Delivery not available to this pincode."}</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!shipping && !checkingRate && !rateError && (
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <Truck className="w-4 h-4 flex-shrink-0" />
                          Enter pincode to check delivery charges
                        </div>
                      )}

                      {/* Payment mode */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["prepaid", "cod"] as PaymentMode[]).map((mode) => (
                            <button key={mode} onClick={() => handlePaymentModeChange(mode)}
                              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                                paymentMode === mode
                                  ? "bg-[#9B6FD1] border-[#9B6FD1] text-white shadow-sm"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]/50"
                              }`}>
                              {mode === "prepaid" ? "Online Payment" : "Cash on Delivery"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ═══════════════════════════════════════════
                    STEP 3 — Your Details
                ═══════════════════════════════════════════ */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.2 }}>
                    <MiniSummary />

                    {/* Delivery summary pill */}
                    <div className="mx-4 mt-2 flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-green-700 space-y-0.5">
                        <p className="font-semibold">Delivering to PIN {pincode}</p>
                        <p>
                          Arrives by {new Date(Date.now() + (shipping?.estimatedDays ?? 0) * 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          {" "}· {paymentMode === "cod" ? "Cash on Delivery" : "Online Payment"}
                        </p>
                        <p>
                          {shippingCharge === 0 ? "🎉 Free shipping applied" : `Shipping ₹${shippingCharge}${shippingSaved > 0 ? ` (₹${shippingSaved} saved)` : ""}`}
                          {(codCharge > 0 || codSaved > 0) && ` · COD ${codCharge === 0 ? "free" : `₹${codCharge}`}${codSaved > 0 ? ` (₹${codSaved} saved)` : ""}`}
                        </p>
                      </div>
                    </div>

                    <div className="mx-4 mt-3 bg-[#F3EEFB]/60 rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#9B6FD1]" />
                        Your Details
                      </p>
                      <div className="space-y-2.5">
                        <input type="text" placeholder="Full Name *" value={customer.name} onChange={(e) => setC("name", e.target.value)} className={INPUT_CLASS} />
                        <input type="tel" inputMode="numeric" maxLength={10} placeholder="Mobile Number (10 digits) *" value={customer.mobile} onChange={(e) => setC("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} className={INPUT_CLASS} />
                        <textarea rows={2} placeholder="House No., Street, Area *" value={customer.address} onChange={(e) => setC("address", e.target.value)} className={INPUT_CLASS + " resize-none"} />
                        <div className="grid grid-cols-2 gap-2">
                          <AutocompleteInput
                              value={customer.state}
                              onChange={(val) => { setC("state", val); if (val !== customer.state) setC("city", ""); }}
                              options={INDIA_STATES}
                              placeholder="State *"
                              className={INPUT_CLASS}
                              portalContainer={sheetContentEl}
                            />
                          <AutocompleteInput
                              value={customer.city}
                              onChange={(val) => setC("city", val)}
                              options={getCitiesForState(customer.state)}
                              placeholder={customer.state ? "City *" : "Select state first"}
                              className={INPUT_CLASS}
                              disabled={!customer.state}
                              portalContainer={sheetContentEl}
                            />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* ── Sticky Footer ── */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-5 space-y-2.5">

              {/* Price summary — only on step 2 & 3 */}
              {step >= 2 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span><span>₹{subtotal}</span>
                  </div>
                  {shipping?.serviceable ? (
                    <>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Shipping</span>
                        <div className="text-right">
                          {shippingSaved > 0 && (
                            <span className="line-through text-gray-300 text-xs mr-1">₹{rawShippingCharge}</span>
                          )}
                          <span className={shippingCharge === 0 ? "text-green-600 font-semibold" : ""}>
                            {shippingCharge === 0 ? "FREE" : `₹${shippingCharge}`}
                          </span>
                          {shippingSaved > 0 && (
                            <span className="ml-1 text-[10px] text-green-600 font-semibold">-₹{shippingSaved}</span>
                          )}
                        </div>
                      </div>
                      {(codCharge > 0 || codSaved > 0) && (
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>COD Charge</span>
                          <div className="text-right">
                            {codSaved > 0 && (
                              <span className="line-through text-gray-300 text-xs mr-1">₹{rawCodCharge}</span>
                            )}
                            <span className={codCharge === 0 ? "text-green-600 font-semibold" : ""}>
                              {codCharge === 0 ? "FREE" : `₹${codCharge}`}
                            </span>
                            {codSaved > 0 && (
                              <span className="ml-1 text-[10px] text-green-600 font-semibold">-₹{codSaved}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Shipping</span><span>Enter pincode to check</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold font-serif text-gray-900" data-testid="cart-subtotal">₹{grandTotal}</span>
                  </div>
                </div>
              )}

              {/* Step 1 footer */}
              {step === 1 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-gray-900">Subtotal</span>
                    <span className="text-2xl font-bold font-serif text-gray-900" data-testid="cart-subtotal">₹{subtotal}</span>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full flex items-center justify-center gap-2 bg-[#9B6FD1] hover:bg-[#8a5fc0] active:scale-[0.98] text-white font-semibold text-base rounded-2xl py-4 transition-all shadow-md shadow-purple-200"
                  >
                    Continue to Delivery
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Step 2 footer */}
              {step === 2 && (
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex items-center justify-center gap-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-[#9B6FD1]/40 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!shipping?.serviceable}
                    className={`flex-1 flex items-center justify-center gap-2 font-semibold text-base rounded-2xl py-3 transition-all ${
                      shipping?.serviceable
                        ? "bg-[#9B6FD1] hover:bg-[#8a5fc0] active:scale-[0.98] text-white shadow-md shadow-purple-200"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Continue to Details
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Step 3 footer */}
              {step === 3 && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => setStep(2)} className="flex items-center justify-center gap-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-[#9B6FD1]/40 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      onClick={checkoutWhatsApp}
                      disabled={checkingOut || !canCheckout}
                      className={`flex-1 flex items-center justify-center gap-2 font-semibold text-base rounded-2xl py-3 transition-all duration-200 ${
                        canCheckout
                          ? "bg-[#25D366] hover:bg-[#1ebe5d] active:scale-[0.98] text-white shadow-lg shadow-green-200"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                      data-testid="btn-checkout-whatsapp"
                    >
                      {checkingOut
                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</>
                        : <><MessageCircle className="w-5 h-5" /> Order on WhatsApp</>
                      }
                    </button>
                  </div>
                  {!canCheckout && !checkingOut && (
                    <p className="text-center text-[11px] text-gray-400">
                      {!customerComplete ? "Fill in all your details to continue" : "Check delivery availability first"}
                    </p>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
