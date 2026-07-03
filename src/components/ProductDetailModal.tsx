import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShoppingBag, Zap } from "lucide-react";
import { Product } from "../data/products";
import { Button } from "./ui/button";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (product) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  // Reset state on close
  const handleClose = () => {
    setSelectedSize(null);
    setAddedFeedback(false);
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleBuyNow = () => {
    if (!product) return;
    const sizeNote =
      selectedSize && selectedSize !== "One Size"
        ? ` (Size: ${selectedSize})`
        : "";
    const msg = `Hi Shine and Sparkle! I want to order:\n\n${product.name}${sizeNote} x 1 - ₹${product.price}\n\nTotal: ₹${product.price}\n\nPlease confirm my purchase.`;
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            data-testid="modal-backdrop"
          />

          {/*
            Outer scroll container — fills the screen and allows vertical
            scroll on short-viewport / mobile devices.
          */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row pointer-events-auto"
                data-testid="product-detail-modal"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Image panel ─────────────────────────────────────── */}
                <div className="relative w-full md:w-[45%] flex-shrink-0 bg-[#F3EEFB] rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none overflow-hidden">
                  {/* Back button — always visible, top-left of image */}
                  <button
                    onClick={handleClose}
                    className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-700 hover:text-[#9B6FD1] text-sm font-medium px-3 py-2 rounded-full shadow-md transition-all hover:bg-white"
                    data-testid="modal-back-btn"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>

                  {product.discount > 0 && (
                    <div className="absolute top-4 right-4 z-20 bg-[#9B6FD1] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                      {product.discount}% OFF
                    </div>
                  )}

                  {/* Fixed-ratio image — max 360 px tall on mobile so content shows */}
                  <div className="aspect-square md:aspect-auto md:h-full w-full max-h-72 sm:max-h-80 md:max-h-none">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                </div>

                {/* ── Details panel ────────────────────────────────────── */}
                <div className="flex flex-col p-6 sm:p-8 flex-1 min-h-0">
                  {/* Category pill */}
                  <span className="inline-block self-start text-xs font-semibold uppercase tracking-widest text-[#9B6FD1] bg-[#F3EEFB] px-3 py-1 rounded-full mb-4 capitalize">
                    {product.category}
                  </span>

                  {/* Name */}
                  <h2 className="font-serif text-2xl sm:text-3xl text-gray-900 leading-tight mb-3">
                    {product.name}
                  </h2>

                  {/* Price row */}
                  <div className="flex flex-wrap items-baseline gap-2 mb-5">
                    <span className="text-2xl font-bold text-gray-900">
                      ₹{product.price}
                    </span>
                    {product.originalPrice > product.price && (
                      <>
                        <span className="text-base text-gray-400 line-through">
                          ₹{product.originalPrice}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600">
                          Save ₹{product.originalPrice - product.price}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                    {product.description}
                  </p>

                  {/* Size / variant selector */}
                  {(product.sizes.length > 1 ||
                    product.sizes[0] !== "One Size") && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                        {product.category === "rings"
                          ? "Ring Size"
                          : product.category === "necklaces"
                          ? "Chain Length"
                          : product.category === "bracelets"
                          ? "Bracelet Size"
                          : "Size"}
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        data-testid="size-selector"
                      >
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() =>
                              setSelectedSize(
                                size === selectedSize ? null : size
                              )
                            }
                            data-testid={`size-option-${size}`}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                              selectedSize === size
                                ? "bg-[#9B6FD1] border-[#9B6FD1] text-white shadow-md"
                                : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1] hover:text-[#9B6FD1]"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feature highlights */}
                  <div className="flex flex-col gap-2 mb-8">
                    {[
                      "Anti-tarnish coating",
                      "Handcrafted in India",
                      "Free shipping above ₹999",
                    ].map((feat) => (
                      <p
                        key={feat}
                        className="flex items-center gap-2 text-xs text-gray-500"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9B6FD1] flex-shrink-0" />
                        {feat}
                      </p>
                    ))}
                  </div>

                  {/* CTA buttons — always visible at bottom of panel */}
                  <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full gap-2"
                      onClick={handleAddToCart}
                      data-testid="modal-add-to-cart-btn"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {addedFeedback ? "Added!" : "Add to Cart"}
                    </Button>
                    <Button
                      className="flex-1 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full gap-2 shadow-md hover:shadow-lg transition-all"
                      onClick={handleBuyNow}
                      data-testid="modal-buy-now-btn"
                    >
                      <Zap className="w-4 h-4" />
                      Buy Now on WhatsApp
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
