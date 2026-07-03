import { useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { Product } from "../data/products";
import { Button } from "./ui/button";
import { useCart, WHATSAPP_NUMBER } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { ProductDetailModal } from "./ProductDetailModal";

interface ProductCardProps {
  product: Product;
  index: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [modalOpen, setModalOpen] = useState(false);
  const wishlisted = isWishlisted(product.id);

  const handleBuyNow = () => {
    const msg = `Hi Shine and Sparkle! I want to order:\n\n${product.name} x 1 - ₹${product.price}\n\nTotal: ₹${product.price}\n\nPlease confirm my purchase.`;
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
        data-testid={`card-product-${product.id}`}
      >
        {/* Clickable image area opens the detail modal */}
        <button
          className="relative aspect-square overflow-hidden bg-gray-50 cursor-zoom-in w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6FD1]"
          onClick={() => setModalOpen(true)}
          data-testid={`btn-open-modal-${product.id}`}
          aria-label={`View details for ${product.name}`}
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          {product.discount > 0 && (
            <div className="absolute top-4 left-4 bg-[#9B6FD1] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md">
              {product.discount}% OFF
            </div>
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 tracking-wide">
              Quick View
            </span>
          </div>
        </button>

        {/* Wishlist heart — sits on top-right of image, outside the image button */}
        <div className="relative">
          <button
            onClick={() => toggleWishlist(product)}
            className="absolute top-0 right-4 -translate-y-full -mt-0 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-md hover:scale-110 transition-transform duration-200"
            data-testid={`btn-wishlist-${product.id}`}
            aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          >
            <Heart
              className={`w-4 h-4 transition-colors duration-200 ${
                wishlisted ? "fill-[#9B6FD1] text-[#9B6FD1]" : "text-gray-400"
              }`}
            />
          </button>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <h3 className="text-xl font-serif text-gray-900 mb-2">{product.name}</h3>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-xl font-bold text-gray-900">₹{product.price}</span>
            {product.originalPrice > product.price && (
              <span className="text-sm text-gray-400 line-through">
                ₹{product.originalPrice}
              </span>
            )}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="w-full border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full"
              onClick={() => addToCart(product)}
              data-testid={`btn-add-to-cart-${product.id}`}
            >
              Add to Cart
            </Button>
            <Button
              className="w-full bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full shadow-md hover:shadow-lg transition-all"
              onClick={handleBuyNow}
              data-testid={`btn-buy-now-${product.id}`}
            >
              Buy Now
            </Button>
          </div>
        </div>
      </motion.div>

      <ProductDetailModal
        product={modalOpen ? product : null}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
