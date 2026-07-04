import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus, Plus, X, ShoppingBag, MessageCircle,
  Sparkles, Loader2, MapPin, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { generateOrderPDF } from "../utils/generateOrderPDF";

type PaymentMode = "prepaid" | "cod";

interface ShippingResult {
  serviceable: boolean;
  courierName?: string;
  estimatedDays?: number;
  shippingCharge?: number;
  codCharge?: number;
  message?: string;
}

// Jewelry is light — 0.1 kg per item, minimum 0.5 kg for shipping
function estimateWeight(totalItems: number): number {
  const raw = totalItems * 0.1;
  return Math.max(0.5, parseFloat(raw.toFixed(2)));
}

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, cart, removeFromCart, updateQuantity, subtotal, totalItems } = useCart();

  // ── Shipping state ──────────────────────────────────────────
  const [pincode, setPincode] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("prepaid");
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [checkingRate, setCheckingRate] = useState(false);
  const [rateError, setRateError] = useState("");
  const pincodeRef = useRef<HTMLInputElement>(null);

  // ── Checkout state ──────────────────────────────────────────
  const [checkingOut, setCheckingOut] = useState(false);

  // Reset shipping when cart changes
  const shippingCharge = shipping?.serviceable ? (shipping.shippingCharge ?? 0) : 0;
  const codCharge = paymentMode === "cod" && shipping?.serviceable ? (shipping.codCharge ?? 0) : 0;
  const grandTotal = subtotal + shippingCharge + codCharge;

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
      if (!text) throw new Error("Empty response from server. Is the API running?");
      let data: ShippingResult & { error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned an unexpected response. Check API setup.");
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rate");
      setShipping(data);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Could not check rate. Try again.");
    } finally {
      setCheckingRate(false);
    }
  };

  // ── Check rate ──────────────────────────────────────────────
  const checkShippingRate = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setRateError("Enter a valid 6-digit pincode.");
      return;
    }
    await callShippingAPI(pincode, paymentMode);
  };

  // Re-check when payment mode changes and we already have a result
  const handlePaymentModeChange = async (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (pincode.length === 6 && shipping !== null) {
      await callShippingAPI(pincode, mode);
    }
  };

  // ── WhatsApp checkout ───────────────────────────────────────
  const checkoutWhatsApp = async () => {
    setCheckingOut(true);

    const lines = cart
      .map((item) => `${item.product.name} x${item.quantity} - Rs. ${item.product.price * item.quantity}`)
      .join("\n");

    const shippingLine = shipping?.serviceable
      ? `\nShipping (${shipping.courierName}): Rs. ${shippingCharge}${codCharge > 0 ? `\nCOD Charges: Rs. ${codCharge}` : ""}`
      : "";

    const waMsg =
      `Hi Shine and Sparkle! I want to order:\n\n${lines}` +
      `\n\nSubtotal: Rs. ${subtotal}${shippingLine}` +
      `\nGrand Total: Rs. ${grandTotal}` +
      `\n\nDelivery Pincode: ${pincode || "To be confirmed"}` +
      `\nPayment Mode: ${paymentMode === "cod" ? "Cash on Delivery" : "Prepaid"}` +
      `\n\nPlease confirm my purchase.`;

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    let pdfBlob: Blob | null = null;
    try {
      pdfBlob = await generateOrderPDF(cart, grandTotal);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setCheckingOut(false);
    }

    const filename = `ShineAndSparkle_Order_${Date.now()}.pdf`;

    if (pdfBlob && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
      const pdfFile = new File([pdfBlob], filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({ title: "My Shine and Sparkle Order", text: waMsg, files: [pdfFile] });
          window.open(waUrl, "_blank");
          return;
        } catch {
          // cancelled — fall through
        }
      }
    }

    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    window.open(waUrl, "_blank");
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0" data-testid="cart-drawer">

        {/* ── Header ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <SheetTitle className="font-serif text-2xl text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 fill-[#9B6FD1] text-[#9B6FD1]" />
            Your Cart
            {totalItems > 0 && <span className="ml-1 text-sm font-normal text-gray-400">({totalItems})</span>}
          </SheetTitle>
        </SheetHeader>

        {/* ── Empty state ── */}
        {cart.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-[#F3EEFB] flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-[#9B6FD1]" />
            </div>
            <div>
              <p className="text-gray-700 font-medium mb-1">Your cart is empty</p>
              <p className="text-gray-400 text-sm">Add something beautiful to get started.</p>
            </div>
            <button onClick={() => setIsCartOpen(false)} className="mt-2 text-sm text-[#9B6FD1] font-medium underline underline-offset-2">
              Browse Collection
            </button>
          </div>
        )}

        {/* ── Cart items ── */}
        {cart.length > 0 && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  key={item.product.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex gap-4 bg-[#F3EEFB]/50 rounded-2xl p-3 relative"
                  data-testid={`cart-item-${item.product.id}`}
                >
                  <img
                    src={item.product.images?.length ? item.product.images[0] : item.product.image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <p className="font-serif text-gray-900 text-base leading-snug pr-6 line-clamp-2">{item.product.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors" data-testid={`qty-decrease-${item.product.id}`}>
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold text-gray-800 w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors" data-testid={`qty-increase-${item.product.id}`}>
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-gray-900 text-sm">₹{item.product.price * item.quantity}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors" data-testid={`btn-remove-${item.product.id}`} aria-label={`Remove ${item.product.name}`}>
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer ── */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-5 space-y-4">

            {/* ── Pincode + Payment mode ───────────────────── */}
            <div className="bg-[#F3EEFB]/60 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9B6FD1]" />
                Delivery Details
              </p>

              {/* Pincode input */}
              <div className="flex gap-2">
                <input
                  ref={pincodeRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPincode(v);
                    if (v.length < 6) { setShipping(null); setRateError(""); }
                  }}
                  placeholder="Enter 6-digit pincode"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white"
                />
                <button
                  onClick={checkShippingRate}
                  disabled={checkingRate || pincode.length !== 6}
                  className="px-4 py-2 bg-[#9B6FD1] hover:bg-[#8a5fc0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5"
                >
                  {checkingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                </button>
              </div>

              {/* Payment mode toggle */}
              <div className="flex gap-2">
                {(["prepaid", "cod"] as PaymentMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handlePaymentModeChange(mode)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                      paymentMode === mode
                        ? "bg-[#9B6FD1] border-[#9B6FD1] text-white shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]"
                    }`}
                  >
                    {mode === "prepaid" ? "Prepaid" : "Cash on Delivery"}
                  </button>
                ))}
              </div>

              {/* Rate error */}
              {rateError && (
                <div className="flex items-center gap-2 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {rateError}
                </div>
              )}

              {/* Shipping result */}
              {shipping && !checkingRate && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl px-3 py-2.5 text-xs ${
                      shipping.serviceable
                        ? "bg-green-50 border border-green-100 text-green-700"
                        : "bg-red-50 border border-red-100 text-red-600"
                    }`}
                  >
                    {shipping.serviceable ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{shipping.courierName}</p>
                          <p>Delivery in {shipping.estimatedDays} day{(shipping.estimatedDays ?? 0) > 1 ? "s" : ""}</p>
                          {codCharge > 0 && <p className="text-gray-500 mt-0.5">Includes COD charge: ₹{codCharge}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {shipping.message ?? "Delivery not available to this pincode."}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* ── Order summary ────────────────────────────── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>

              {shipping?.serviceable && (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Shipping</span>
                    <span className={shippingCharge === 0 ? "text-green-600 font-medium" : ""}>
                      {shippingCharge === 0 ? "Free" : `₹${shippingCharge}`}
                    </span>
                  </div>
                  {codCharge > 0 && (
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>COD Charge</span>
                      <span>₹{codCharge}</span>
                    </div>
                  )}
                </>
              )}

              {!shipping?.serviceable && (
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Shipping</span>
                  <span>Enter pincode to check</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold font-serif text-gray-900" data-testid="cart-subtotal">
                  ₹{grandTotal}
                </span>
              </div>
            </div>

            {/* ── Checkout button ──────────────────────────── */}
            <button
              onClick={checkoutWhatsApp}
              disabled={checkingOut}
              className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold text-base rounded-2xl py-4 shadow-lg shadow-green-200 transition-all duration-200"
              data-testid="btn-checkout-whatsapp"
            >
              {checkingOut ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Preparing your order…</>
              ) : (
                <><MessageCircle className="w-5 h-5" /> Checkout on WhatsApp</>
              )}
            </button>

            <p className="text-center text-[10px] text-gray-400 tracking-wide leading-relaxed">
              {checkingOut ? "Generating order PDF — please wait" : "Order PDF will be shared, then WhatsApp will open"}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
