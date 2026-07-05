import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus, Plus, X, ShoppingBag, MessageCircle,
  Sparkles, Loader2, MapPin, CheckCircle2, AlertCircle, Truck, User,
} from "lucide-react";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { supabase } from "../lib/supabase";
import { AutocompleteInput } from "./ui/AutocompleteInput";
import { INDIA_STATES, getCitiesForState } from "../data/indiaCitiesStates";

type PaymentMode = "prepaid" | "cod";

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
  return Math.max(0.5, parseFloat((totalItems * 0.1).toFixed(2)));
}

const INPUT_CLASS =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-400";

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, cart, removeFromCart, updateQuantity, subtotal, totalItems } = useCart();

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
  // Capture the Sheet content DOM node so AutocompleteInput portals render
  // inside the same Radix stacking context (avoids z-index conflicts).
  const [sheetContentEl, setSheetContentEl] = useState<HTMLElement | null>(null);
  const onSheetContent = useCallback((node: HTMLElement | null) => {
    setSheetContentEl(node);
  }, []);

  const shippingCharge = shipping?.serviceable ? (shipping.shippingCharge ?? 0) : 0;
  const codCharge = paymentMode === "cod" && shipping?.serviceable ? (shipping.codCharge ?? 0) : 0;
  const grandTotal = subtotal + shippingCharge + codCharge;

  const setC = (k: keyof CustomerInfo, v: string) =>
    setCustomer((prev) => ({ ...prev, [k]: v }));

  // All required fields filled + shipping checked
  const customerComplete =
    customer.name.trim() !== "" &&
    /^\d{10}$/.test(customer.mobile) &&
    customer.address.trim() !== "" &&
    customer.city.trim() !== "" &&
    customer.state.trim() !== "";

  const canCheckout = customerComplete && shipping?.serviceable === true;

  // ── Shipping API ────────────────────────────────────────────
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

  // ── WhatsApp checkout ───────────────────────────────────────
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

    // Save order to Supabase
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

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 max-h-screen" data-testid="cart-drawer" ref={onSheetContent}>

        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <SheetTitle className="font-serif text-xl text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 fill-[#9B6FD1] text-[#9B6FD1]" />
            Your Cart
            {totalItems > 0 && <span className="ml-1 text-sm font-normal text-gray-400">({totalItems} items)</span>}
          </SheetTitle>
        </SheetHeader>

        {/* Empty */}
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
            <div className="flex-1 overflow-y-auto">

              {/* Cart items */}
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
                          <p className="text-[11px] text-red-500 font-medium mt-1.5">
                            Only {item.product.stock} in stock
                          </p>
                        )}
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors" data-testid={`btn-remove-${item.product.id}`} aria-label={`Remove ${item.product.name}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* ── Delivery & Shipping ── */}
              <div className="mx-4 mt-3 bg-[#F3EEFB]/60 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#9B6FD1]" />
                  Delivery & Shipping
                </p>

                {/* Pincode */}
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
                    onKeyDown={(e) => e.key === "Enter" && checkShippingRate()}
                    placeholder="Enter 6-digit pincode"
                    className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white"
                  />
                  <button
                    onClick={checkShippingRate}
                    disabled={checkingRate || pincode.length !== 6}
                    className="shrink-0 w-20 py-2.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center"
                  >
                    {checkingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                  </button>
                </div>

                {/* Payment mode */}
                <div className="grid grid-cols-2 gap-2">
                  {(["prepaid", "cod"] as PaymentMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handlePaymentModeChange(mode)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                        paymentMode === mode
                          ? "bg-[#9B6FD1] border-[#9B6FD1] text-white shadow-sm"
                          : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]/50"
                      }`}
                    >
                      {mode === "prepaid" ? "Prepaid" : "Cash on Delivery"}
                    </button>
                  ))}
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
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`rounded-xl px-3 py-3 ${shipping.serviceable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                    >
                      {shipping.serviceable ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-green-800">Delivery available</p>
                              <p className="text-xs text-green-600">
                                In {shipping.estimatedDays} day{(shipping.estimatedDays ?? 0) > 1 ? "s" : ""}
                                {codCharge > 0 ? ` • COD: ₹${codCharge}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Shipping</p>
                            <p className="text-base font-bold text-[#9B6FD1]">₹{shipping.shippingCharge}</p>
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
              </div>

              {/* ── Your Details ── */}
              <div className="mx-4 my-3 bg-[#F3EEFB]/60 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#9B6FD1]" />
                  Your Details
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <input type="text" placeholder="Full Name *" value={customer.name} onChange={(e) => setC("name", e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div className="col-span-2">
                    <input type="tel" inputMode="numeric" maxLength={10} placeholder="Mobile Number (10 digits) *" value={customer.mobile} onChange={(e) => setC("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} className={INPUT_CLASS} />
                  </div>
                  <div className="col-span-2">
                    <textarea rows={2} placeholder="Full Address (House No., Street, Area) *" value={customer.address} onChange={(e) => setC("address", e.target.value)} className={INPUT_CLASS + " resize-none"} />
                  </div>
                  <AutocompleteInput
                    value={customer.state}
                    onChange={(val) => {
                      setC("state", val);
                      // Clear city when state changes
                      if (val !== customer.state) setC("city", "");
                    }}
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
                  />                </div>
              </div>
            </div>

            {/* Footer: summary + button */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-5 pt-4 pb-5 space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>₹{subtotal}</span>
                </div>
                {shipping?.serviceable ? (
                  <>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Shipping</span>
                      <span className={shippingCharge === 0 ? "text-green-600 font-medium" : ""}>
                        {shippingCharge === 0 ? "Free" : `₹${shippingCharge}`}
                      </span>
                    </div>
                    {codCharge > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>COD Charge</span><span>₹{codCharge}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Shipping</span><span>Enter pincode to check</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-900 text-base">Total</span>
                  <span className="text-2xl font-bold font-serif text-gray-900" data-testid="cart-subtotal">₹{grandTotal}</span>
                </div>
              </div>

              <button
                onClick={checkoutWhatsApp}
                disabled={checkingOut || !canCheckout}
                className={`w-full flex items-center justify-center gap-2.5 font-semibold text-base rounded-2xl py-4 transition-all duration-200 ${
                  canCheckout
                    ? "bg-[#25D366] hover:bg-[#1ebe5d] active:scale-[0.98] text-white shadow-lg shadow-green-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                data-testid="btn-checkout-whatsapp"
              >
                {checkingOut
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving order…</>
                  : <><MessageCircle className="w-5 h-5" /> Checkout on WhatsApp</>
                }
              </button>

              <p className="text-center text-[10px] text-gray-400 leading-relaxed">
                {!customerComplete
                  ? "Fill in your details above to continue"
                  : !shipping?.serviceable
                  ? "Enter pincode and check delivery charges to continue"
                  : checkingOut
                  ? "Saving your order…"
                  : "Order details will be sent to WhatsApp"}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
