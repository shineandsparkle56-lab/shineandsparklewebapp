import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCart } from "../context/CartContext";

export function FloatingCart() {
  const { cart, totalItems, subtotal, setIsCartOpen } = useCart();
  const prevCount = useRef(totalItems);
  const [pulse, setPulse] = useState(false);

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

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          key="floating-cart"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
          data-testid="floating-cart"
        >
          {/* Pulse ring — expands out on item add */}
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

          <button
            onClick={() => setIsCartOpen(true)}
            className={`relative w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-xl transition-transform active:scale-[0.97] ${
              pulse
                ? "bg-[#8a5fc0]"
                : "bg-[#9B6FD1]"
            }`}
            aria-label="View cart"
          >
            {/* Left — bag icon + count badge */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                {/* Item count badge */}
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
                <p className="text-white/70 text-xs">₹{subtotal} total</p>
              </div>
            </div>

            {/* Right — View Cart label */}
            <div className="flex items-center gap-1 text-white font-semibold text-sm bg-white/20 px-3 py-1.5 rounded-xl">
              View Cart
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
