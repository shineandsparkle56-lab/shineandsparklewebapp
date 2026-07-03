import { Heart, ShoppingBag, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { useWishlist } from "../context/WishlistContext";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";

export function WishlistDrawer() {
  const { wishlist, isWishlistOpen, setIsWishlistOpen, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleBuyNow = (product: (typeof wishlist)[number]) => {
    const msg = `Hi Shine and Sparkle! I want to order:\n\n${product.name} x 1 - ₹${product.price}\n\nTotal: ₹${product.price}\n\nPlease confirm my purchase.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Sheet open={isWishlistOpen} onOpenChange={setIsWishlistOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0" data-testid="wishlist-drawer">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <SheetTitle className="font-serif text-2xl text-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 fill-[#9B6FD1] text-[#9B6FD1]" />
            Saved Pieces
            {wishlist.length > 0 && (
              <span className="ml-1 text-sm font-normal text-gray-400">
                ({wishlist.length})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Empty state */}
        {wishlist.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-full bg-[#F3EEFB] flex items-center justify-center">
              <Heart className="w-7 h-7 text-[#9B6FD1]" />
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              No saved pieces yet.<br />Tap the heart on any product to save it here.
            </p>
          </div>
        )}

        {/* Wishlist items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <AnimatePresence initial={false}>
            {wishlist.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="flex gap-4 bg-[#F3EEFB]/50 rounded-2xl p-3 relative"
                data-testid={`wishlist-item-${product.id}`}
              >
                {/* Product image */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-gray-900 text-base leading-snug mb-1 truncate pr-6">
                    {product.name}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bold text-gray-900 text-sm">₹{product.price}</span>
                    {product.originalPrice > product.price && (
                      <span className="text-xs text-gray-400 line-through">₹{product.originalPrice}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full h-7 gap-1"
                      onClick={() => addToCart(product)}
                      data-testid={`wishlist-add-to-cart-${product.id}`}
                    >
                      <ShoppingBag className="w-3 h-3" />
                      Add to Cart
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full h-7 gap-1"
                      onClick={() => handleBuyNow(product)}
                      data-testid={`wishlist-buy-now-${product.id}`}
                    >
                      <Zap className="w-3 h-3" />
                      Buy Now
                    </Button>
                  </div>
                </div>

                {/* Remove from wishlist */}
                <button
                  onClick={() => toggleWishlist(product)}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                  data-testid={`wishlist-remove-${product.id}`}
                  aria-label={`Remove ${product.name} from wishlist`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
