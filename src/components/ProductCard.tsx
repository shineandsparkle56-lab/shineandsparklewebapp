import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "../data/products";
import { Button } from "./ui/button";
import { useCart } from "../context/CartContext";
import { ProductDetailModal } from "./ProductDetailModal";

interface ProductCardProps {
  product: Product;
  index: number;
  view?: "grid" | "list";
}

export function ProductCard({ product, index, view = "grid" }: ProductCardProps) {
  const { addToCart, setIsCartOpen } = useCart();
  const [modalOpen, setModalOpen] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const images = product.images?.length ? product.images : [product.image];
  const coverImage = images[0];
  const outOfStock = product.stock === 0;

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  };

  const handleBuyNow = () => {
    addToCart(product);
    setIsCartOpen(true);
  };

  // ── LIST VIEW ──────────────────────────────────────────────────
  if (view === "list") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          data-testid={`card-product-${product.id}`}
        >
          <div className="relative aspect-square overflow-hidden bg-gray-50">
            <button
              className="absolute inset-0 w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6FD1]"
              onClick={() => setModalOpen(true)}
              aria-label={`View details for ${product.name}`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={imgIndex}
                  src={images[imgIndex]}
                  alt={product.name}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute inset-0 w-full h-full object-contain object-center ${outOfStock ? "opacity-50" : ""}`}
                />
              </AnimatePresence>
            </button>

            {/* Left / Right arrows — only if more than 1 image */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImg}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={nextImg}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </button>

                {/* Dot indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                      className={`rounded-full transition-all duration-200 ${
                        i === imgIndex
                          ? "w-4 h-1.5 bg-[#9B6FD1]"
                          : "w-1.5 h-1.5 bg-white/70 hover:bg-white"
                      }`}
                      aria-label={`Image ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}

            {product.discount > 0 && !outOfStock && (
              <div className="absolute top-3 left-3 z-10 bg-[#9B6FD1] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow pointer-events-none">{product.discount}% OFF</div>
            )}
            {outOfStock && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <span className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Out of Stock</span>
              </div>
            )}
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-serif text-gray-900 text-base leading-snug">{product.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                {product.originalPrice > product.price && <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full text-sm disabled:opacity-40" onClick={() => addToCart(product)} disabled={outOfStock} data-testid={`btn-add-to-cart-${product.id}`}>Add to Cart</Button>
              <Button className="bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full text-sm shadow-md disabled:opacity-40" onClick={handleBuyNow} disabled={outOfStock} data-testid={`btn-buy-now-${product.id}`}>Buy Now</Button>
            </div>
          </div>
        </motion.div>
        <ProductDetailModal product={modalOpen ? product : null} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // ── GRID VIEW (default) ────────────────────────────────────────
  return (
    <>
      {/* Mobile grid card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: 0.35, delay: index * 0.04 }}
        className="block sm:hidden bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
        data-testid={`card-product-${product.id}`}
      >
        {/* Image */}
        <button
          className="relative w-full aspect-square overflow-hidden bg-gray-50 focus:outline-none"
          onClick={() => setModalOpen(true)}
          aria-label={`View details for ${product.name}`}
        >
          <img
            src={coverImage}
            alt={product.name}
            className={`absolute inset-0 w-full h-full object-cover object-center ${outOfStock ? "opacity-50" : ""}`}
          />
          {product.discount > 0 && !outOfStock && (
            <div className="absolute top-2 left-2 z-10 bg-[#9B6FD1] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider pointer-events-none">
              {product.discount}% OFF
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <span className="bg-black/70 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Out of Stock</span>
            </div>
          )}
        </button>

        {/* Info + button */}
        <div className="p-2.5 flex flex-col gap-2">
          <div>
            <p className="text-xs font-serif text-gray-900 leading-snug line-clamp-2">{product.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <span className="text-[10px] text-gray-400 line-through">₹{product.originalPrice}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => addToCart(product)}
            disabled={outOfStock}
            className="w-full py-1.5 rounded-xl text-xs font-semibold border-2 border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid={`btn-add-to-cart-${product.id}`}
          >
            {outOfStock ? "Out of Stock" : "+ Add to Cart"}
          </button>
        </div>
      </motion.div>

      {/* Desktop */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="hidden sm:flex group flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
        data-testid={`card-product-${product.id}`}
      >
        <button className="relative aspect-square overflow-hidden bg-gray-50 cursor-zoom-in w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6FD1]" onClick={() => setModalOpen(true)} aria-label={`View details for ${product.name}`}>
          <img src={coverImage} alt={product.name} className={`absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out ${outOfStock ? "opacity-50" : ""}`} />
          {product.discount > 0 && !outOfStock && (
            <div className="absolute top-4 left-4 z-10 bg-[#9B6FD1] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md">{product.discount}% OFF</div>
          )}
          {outOfStock ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="bg-black/70 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Out of Stock</span>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center z-10">
              <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 tracking-wide">Quick View</span>
            </div>
          )}
        </button>
        <div className="p-6 flex flex-col flex-1">
          <h3 className="text-xl font-serif text-gray-900 mb-2">{product.name}</h3>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xl font-bold text-gray-900">₹{product.price}</span>
            {product.originalPrice > product.price && <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>}
            {outOfStock && <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</span>}
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => addToCart(product)} disabled={outOfStock} data-testid={`btn-add-to-cart-${product.id}`}>Add to Cart</Button>
            <Button className="w-full bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed" onClick={handleBuyNow} disabled={outOfStock} data-testid={`btn-buy-now-${product.id}`}>Buy Now</Button>
          </div>
        </div>
      </motion.div>

      <ProductDetailModal product={modalOpen ? product : null} onClose={() => setModalOpen(false)} />
    </>
  );
}
