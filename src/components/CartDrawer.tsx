import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, X, ShoppingBag, MessageCircle, Sparkles } from "lucide-react";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

export function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateQuantity,
    subtotal,
    totalItems,
  } = useCart();

  const checkoutWhatsApp = () => {
    const lines = cart
      .map((item) => `${item.product.name} x ${item.quantity} - ₹${item.product.price * item.quantity}`)
      .join("\n");
    const msg = `Hi Shine and Sparkle! I want to order:\n\n${lines}\n\nTotal: ₹${subtotal}\n\nPlease confirm my purchase.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
        data-testid="cart-drawer"
      >
        {/* ── Header — identical to WishlistDrawer ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <SheetTitle className="font-serif text-2xl text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 fill-[#9B6FD1] text-[#9B6FD1]" />
            Your Cart
            {totalItems > 0 && (
              <span className="ml-1 text-sm font-normal text-gray-400">
                ({totalItems})
              </span>
            )}
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
            <button
              onClick={() => setIsCartOpen(false)}
              className="mt-2 text-sm text-[#9B6FD1] font-medium underline underline-offset-2"
            >
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
                  {/* Product image */}
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-gray-900 text-base leading-snug pr-4 truncate">
                        {item.product.name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Qty stepper */}
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors"
                          data-testid={`qty-decrease-${item.product.id}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-semibold text-gray-800 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F3EEFB] text-gray-500 hover:text-[#9B6FD1] transition-colors"
                          data-testid={`qty-increase-${item.product.id}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line price */}
                      <span className="font-bold text-gray-900 text-sm">
                        ₹{item.product.price * item.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                    data-testid={`btn-remove-${item.product.id}`}
                    aria-label={`Remove ${item.product.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer / checkout ── */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-5">
            {/* Order summary */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-500">Subtotal</span>
              <span
                className="text-xl font-bold font-serif text-gray-900"
                data-testid="cart-subtotal"
              >
                ₹{subtotal}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Free shipping on orders above ₹999
            </p>

            {/* WhatsApp checkout */}
            <button
              onClick={checkoutWhatsApp}
              className="w-full flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] active:scale-[0.98] text-white font-semibold text-base rounded-2xl py-4 shadow-lg shadow-green-200 transition-all duration-200"
              data-testid="btn-checkout-whatsapp"
            >
              <MessageCircle className="w-5 h-5" />
              Checkout on WhatsApp
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-3 tracking-wide">
              We'll confirm your order via WhatsApp
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
