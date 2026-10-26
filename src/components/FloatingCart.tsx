import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";

export function FloatingCart() {
  const { cart, totalItems, subtotal, setIsCartOpen, shippingCredit, addMoreMode, setAddMoreMode } = useCart();
  const prevCount = useRef(totalItems);
  const [pulse, setPulse] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Watch for product detail modal open/close via body attribute
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setModalOpen(document.body.hasAttribute("data-modal-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-modal-open"] });
    return () => observer.disconnect();
  }, []);

  // Pulse animation whenever a new item is added
  useEffect(() => {
    if (totalItems > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      prevCount.current = totalItems;
      return () => clearTimeout(t);
    }
    prevCount.current = totalItems;
  }, [totalItems]);

  // In addMoreMode: recalculate live shipping charge based on updated shippingCredit
  const liveShippingCharge = addMoreMode
    ? Math.max(0, addMoreMode.rawTotal - shippingCredit)
    : null;
  const savedSoFar = addMoreMode
    ? Math.min(shippingCredit, addMoreMode.rawTotal)
    : 0;
  const progressPct = addMoreMode && addMoreMode.rawTotal > 0
    ? Math.min(100, Math.round((shippingCredit / addMoreMode.rawTotal) * 100))
    : 0;
  const deliveryFree = liveShippingCharge === 0;

  return (
    <AnimatePresence>
      {totalItems > 0 && !modalOpen && (
        <motion.div
          key="floating-cart"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
          data-testid="floating-cart"
        >
          {/* Pulse ring */}
          <AnimatePresence>
            {pulse && (
              <motion.div
                key="pulse-ring"
                initial={{ scale: 1, opacity: 0.55 }}
                animate={{ scale: 1.12, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute inset-0 rounded-2xl bg-[#9B6FD1] pointer-events-none"
              />
            )}
          </AnimatePresence>

          <div className={`relative w-full rounded-2xl shadow-xl overflow-hidden ${pulse ? "bg-[#8a5fc0]" : "bg-[#9B6FD1]"}`}>

            {/* ── Add-more delivery progress panel ── */}
            <AnimatePresence>
              {addMoreMode && (
                <motion.div
                  key="delivery-progress"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pt-3 pb-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-white/80 shrink-0" />
                        <span className="text-[11px] font-semibold text-white/90">
                          {deliveryFree
                            ? "🎉 Free delivery unlocked!"
                            : `Delivery charge: ₹${liveShippingCharge}`}
                        </span>
                      </div>
                      {savedSoFar > 0 && !deliveryFree && (
                        <span className="text-[10px] font-bold text-emerald-300">
                          ₹{savedSoFar} saved
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${deliveryFree ? "bg-emerald-400" : "bg-white"}`}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>

                    {!deliveryFree && (
                      <p className="text-[10px] text-white/70">
                        Add more items to reduce delivery to ₹0
                      </p>
                    )}
                  </div>
                  <div className="h-px bg-white/10 mx-4" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Main cart button ── */}
            <button
              onClick={() => {
                setAddMoreMode(null);
                setIsCartOpen(true);
              }}
              className="relative w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-transform active:scale-[0.97]"
              aria-label="View cart"
            >
              {/* Left — bag icon + count badge */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-[#9B6FD1] text-[10px] font-bold rounded-full flex items-center justify-center shadow"
                    data-testid="floating-cart-count"
                  >
                    {totalItems}
                  </motion.span>
                </div>

                <div className="text-left">
                  <p className="text-white font-semibold text-sm leading-tight">
                    {totalItems} {totalItems === 1 ? "item" : "items"} in cart
                  </p>
                  <p className="text-white/70 text-xs">₹{subtotal} subtotal</p>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-1 text-white font-semibold text-sm bg-white/20 px-3 py-1.5 rounded-xl shrink-0">
                {addMoreMode ? "View Cart" : "View Cart"}
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
