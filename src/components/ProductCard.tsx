import { useState, useRef } from "react";
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
  const outOfStock = product.stock === 0;

  // ── Swipe state (list view) ──────────────────────────────────
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  // ── Pinch-zoom state (list view) — Instagram style ───────────
  const [pinchZoom, setPinchZoom] = useState(1);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 }); // initial midpoint (screen)
  const [pinchPan, setPinchPan] = useState({ x: 0, y: 0 });       // live translate (px)
  const [pinchRect, setPinchRect] = useState<DOMRect | null>(null);
  const isPinching = pinchZoom > 1;
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartMid = useRef({ x: 0, y: 0 });  // midpoint when pinch began
  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const getDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const getMid = (t: React.TouchList) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  // ── Arrow buttons ────────────────────────────────────────────
  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  };

  // ── Touch handlers ───────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent, containerRef?: React.RefObject<HTMLDivElement | null>) => {
    if (e.touches.length === 2) {
      const dist = getDist(e.touches);
      const mid = getMid(e.touches);
      pinchStartDist.current = dist;
      pinchStartMid.current = mid;
      setPinchOrigin(mid);
      setPinchPan({ x: 0, y: 0 });
      const ref = containerRef ?? imgContainerRef;
      if (ref.current) {
        setPinchRect(ref.current.getBoundingClientRect());
      }
      dragStartX.current = null;
      return;
    }
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dist = getDist(e.touches);
      const mid = getMid(e.touches);
      const scale = Math.max(1, Math.min(3, dist / pinchStartDist.current));
      // Pan = how far the midpoint has moved since pinch started
      const pan = {
        x: mid.x - pinchStartMid.current.x,
        y: mid.y - pinchStartMid.current.y,
      };
      setPinchZoom(scale);
      setPinchPan(pan);
      e.preventDefault();
      return;
    }
    if (pinchZoom > 1) return;
    if (dragStartX.current === null || dragStartY.current === null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (!isDragging.current) {
      if (Math.abs(dx) < Math.abs(dy)) return;
      isDragging.current = true;
    }
    const atStart = imgIndex === 0 && dx > 0;
    const atEnd = imgIndex === images.length - 1 && dx < 0;
    setDragOffset(atStart || atEnd ? dx * 0.25 : dx);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartDist.current !== null) {
      pinchStartDist.current = null;
      setPinchZoom(1);
      setPinchPan({ x: 0, y: 0 });
      setPinchRect(null);
      return;
    }

    // Swipe commit
    if (!isDragging.current) {
      dragStartX.current = null;
      return;
    }
    const THRESHOLD = 50;
    if (dragOffset < -THRESHOLD && imgIndex < images.length - 1) {
      setImgIndex((i) => i + 1);
    } else if (dragOffset > THRESHOLD && imgIndex > 0) {
      setImgIndex((i) => i - 1);
    }
    setDragOffset(0);
    setTimeout(() => { isDragging.current = false; }, 0);
    dragStartX.current = null;
  };

  const handleBuyNow = () => {
    addToCart(product);
    setIsCartOpen(true);
  };

  // Shared opacity-stack for grid view
  function ImageStack({ contain = false }: { contain?: boolean }) {
    return (
      <>
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${product.name} ${i + 1}`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              contain ? "object-contain object-center" : "object-cover object-center"
            } ${i === imgIndex ? "opacity-100" : "opacity-0"} ${outOfStock ? "brightness-75" : ""}`}
          />
        ))}
      </>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  if (view === "list") {
    const stripStyle: React.CSSProperties = {
      transform: `translateX(calc(${-(imgIndex * 100)}% + ${dragOffset}px))`,
      transition: dragOffset !== 0 ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
      willChange: "transform",
    };

    return (
      <>
        <div
          className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          data-testid={`card-product-${product.id}`}
        >
          {/* Image carousel */}
          <div
            ref={imgContainerRef}
            className="relative aspect-square overflow-hidden bg-gray-50 select-none"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Sliding strip */}
            <div
              className="absolute inset-0 flex"
              style={stripStyle}
              onClick={() => !isDragging.current && setModalOpen(true)}
              role="button"
              aria-label={`View details for ${product.name}`}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setModalOpen(true)}
            >
              {images.map((src, i) => (
                <div key={src} className="relative flex-shrink-0 w-full h-full">
                  <img
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    draggable={false}
                    className={`absolute inset-0 w-full h-full object-contain object-center ${outOfStock ? "brightness-75" : ""}`}
                  />
                </div>
              ))}
            </div>

            {/* Arrows — desktop only */}
            {images.length > 1 && (
              <>
                <button onClick={prevImg} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors" aria-label="Previous image">
                  <ChevronLeft className="w-4 h-4 text-gray-700" />
                </button>
                <button onClick={nextImg} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors" aria-label="Next image">
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                      className={`rounded-full transition-all duration-200 ${i === imgIndex ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`}
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
        </div>

        {/* ── Instagram-style pinch zoom overlay ──────────────────
            Renders as a fixed element above everything while pinching.
            Positioned and sized to match the card image exactly,
            then scaled from the pinch midpoint — same visual as Instagram.
        ── */}
        {isPinching && pinchRect && (
          <div
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div
              style={{
                position: "absolute",
                left: pinchRect.left,
                top: pinchRect.top,
                width: pinchRect.width,
                height: pinchRect.height,
                // Scale from the initial pinch midpoint, then translate by how
                // far the midpoint has moved — this makes the image follow fingers
                transformOrigin: `${pinchOrigin.x - pinchRect.left}px ${pinchOrigin.y - pinchRect.top}px`,
                transform: `translate(${pinchPan.x}px, ${pinchPan.y}px) scale(${pinchZoom})`,
                overflow: "hidden",
                willChange: "transform",
              }}
            >
              <img
                src={images[imgIndex]}
                alt={product.name}
                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }}
              />
            </div>
          </div>
        )}

        <ProductDetailModal product={modalOpen ? product : null} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // ── GRID VIEW ────────────────────────────────────────────────
  return (
    <>
      {/* Mobile */}
      <div className="flex flex-col sm:hidden bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100" data-testid={`card-product-${product.id}`}>
        <div
          ref={gridContainerRef}
          className="relative w-full aspect-square overflow-hidden bg-gray-50 select-none"
          style={{ touchAction: "pan-y" }}
          onTouchStart={(e) => onTouchStart(e, gridContainerRef)}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Sliding strip */}
          <div
            className="absolute inset-0 flex"
            style={{
              transform: `translateX(calc(${-(imgIndex * 100)}% + ${dragOffset}px))`,
              transition: dragOffset !== 0 ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
              willChange: "transform",
            }}
            onClick={() => !isDragging.current && setModalOpen(true)}
            role="button"
            aria-label={`View details for ${product.name}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setModalOpen(true)}
          >
            {images.map((src, i) => (
              <div key={src} className="relative flex-shrink-0 w-full h-full">
                <img
                  src={src}
                  alt={`${product.name} ${i + 1}`}
                  draggable={false}
                  className={`absolute inset-0 w-full h-full object-cover object-center ${outOfStock ? "brightness-75" : ""}`}
                />
              </div>
            ))}
          </div>

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex gap-1">
              {images.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                  className={`rounded-full transition-all duration-200 ${i === imgIndex ? "w-3 h-1 bg-[#9B6FD1]" : "w-1 h-1 bg-white/70"}`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {product.discount > 0 && !outOfStock && (
            <div className="absolute top-2 left-2 z-10 bg-[#9B6FD1] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider pointer-events-none">{product.discount}% OFF</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <span className="bg-black/70 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Out of Stock</span>
            </div>
          )}
        </div>

        <div className="p-2.5 flex flex-col flex-1 gap-2">
          <div className="flex-1">
            <p className="text-xs font-serif text-gray-900 leading-snug line-clamp-2">{product.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && <span className="text-[10px] text-gray-400 line-through">₹{product.originalPrice}</span>}
            </div>
          </div>
          <button onClick={() => addToCart(product)} disabled={outOfStock}
            className="w-full py-1.5 rounded-xl text-xs font-semibold border-2 border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid={`btn-add-to-cart-${product.id}`}>
            {outOfStock ? "Out of Stock" : "+ Add to Cart"}
          </button>
        </div>
      </div>

      {/* Pinch-zoom overlay for mobile grid */}
      {isPinching && pinchRect && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ background: "rgba(0,0,0,0.35)" }}
        >
          <div
            style={{
              position: "absolute",
              left: pinchRect.left,
              top: pinchRect.top,
              width: pinchRect.width,
              height: pinchRect.height,
              transformOrigin: `${pinchOrigin.x - pinchRect.left}px ${pinchOrigin.y - pinchRect.top}px`,
              transform: `translate(${pinchPan.x}px, ${pinchPan.y}px) scale(${pinchZoom})`,
              overflow: "hidden",
              willChange: "transform",
            }}
          >
            <img
              src={images[imgIndex]}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
            />
          </div>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden sm:flex flex-col h-full group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100" data-testid={`card-product-${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <button className="absolute inset-0 w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6FD1]" onClick={() => setModalOpen(true)} aria-label={`View details for ${product.name}`}>
            <ImageStack />
          </button>

          {images.length > 1 && (
            <>
              <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors" aria-label="Previous image">
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors" aria-label="Next image">
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                {images.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                    className={`rounded-full transition-all duration-200 ${i === imgIndex ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {product.discount > 0 && !outOfStock && (
            <div className="absolute top-4 left-4 z-10 bg-[#9B6FD1] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md pointer-events-none">{product.discount}% OFF</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="bg-black/70 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">Out of Stock</span>
            </div>
          )}
          {!outOfStock && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 tracking-wide">Quick View</span>
            </div>
          )}
        </div>

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
      </div>

      <ProductDetailModal product={modalOpen ? product : null} onClose={() => setModalOpen(false)} />
    </>
  );
}
