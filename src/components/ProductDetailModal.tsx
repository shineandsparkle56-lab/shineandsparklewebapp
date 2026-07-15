import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag, Zap, ZoomIn, X, ZoomOut, RotateCcw } from "lucide-react";
import { Product } from "../data/products";
import { Button } from "./ui/button";
import { useCart } from "../context/CartContext";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

// ── Zoom lightbox ─────────────────────────────────────────────
interface ZoomLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

function ZoomLightbox({ src, alt, onClose }: ZoomLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom state
  const lastDist = useRef<number | null>(null);
  const lastScale = useRef(1);

  const MIN = 1;
  const MAX = 5;

  const clampPos = useCallback((x: number, y: number, s: number) => {
    // Allow panning proportional to how much the image is scaled
    const maxOffset = ((s - 1) / 2) * 100; // percent of image size
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, y)),
    };
  }, []);

  const zoom = (delta: number, cx?: number, cy?: number) => {
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, prev + delta));
      if (next === MIN) setPos({ x: 0, y: 0 });
      return next;
    });
    void cx; void cy; // future: zoom toward cursor
  };

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.4 : -0.4);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - lastPos.current.x, y: e.clientY - lastPos.current.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const raw = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    const clamped = clampPos(raw.x, raw.y, scale);
    lastPos.current = clamped;
    setPos(clamped);
  };
  const onMouseUp = () => { isDragging.current = false; };

  // Touch pinch-to-zoom + drag
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.hypot(dx, dy);
      lastScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true;
      dragStart.current = {
        x: e.touches[0].clientX - lastPos.current.x,
        y: e.touches[0].clientY - lastPos.current.y,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.min(MAX, Math.max(MIN, lastScale.current * (dist / lastDist.current)));
      if (next === MIN) setPos({ x: 0, y: 0 });
      setScale(next);
    } else if (e.touches.length === 1 && isDragging.current) {
      const raw = {
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y,
      };
      const clamped = clampPos(raw.x, raw.y, scale);
      lastPos.current = clamped;
      setPos(clamped);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) lastDist.current = null;
    if (e.touches.length === 0) isDragging.current = false;
  };

  // Double-tap to toggle 2× / 1×
  const lastTap = useRef(0);
  const onTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double tap
      if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); lastPos.current = { x: 0, y: 0 }; }
      else { setScale(2); }
    }
    lastTap.current = now;
    e.stopPropagation();
  };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => zoom(-0.5)}
          disabled={scale <= MIN}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-white text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => zoom(0.5)}
          disabled={scale >= MAX}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ml-1"
          aria-label="Close zoom"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hint */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none select-none">
        Scroll / pinch to zoom · drag to pan · double-tap to reset
      </p>

      {/* Image */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onTap}
      >
        <motion.img
          src={src}
          alt={alt}
          draggable={false}
          animate={{ scale, x: pos.x, y: pos.y }}
          transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.5 }}
          className="max-w-[92vw] max-h-[92vh] object-contain select-none"
          style={{ touchAction: "none" }}
        />
      </div>
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────
export function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const { addToCart, setIsCartOpen } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [stockMsg, setStockMsg] = useState(false);
  const stockMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const images = product?.images?.length ? product.images : product ? [product.image] : [];

  // ── Instagram swipe state ────────────────────────────────────
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  // ── Instagram pinch-zoom state ───────────────────────────────
  const [pinchZoom, setPinchZoom] = useState(1);
  const [pinchOriginScreen, setPinchOriginScreen] = useState({ x: 0, y: 0 });
  const [pinchPan, setPinchPan] = useState({ x: 0, y: 0 });
  const [pinchRect, setPinchRect] = useState<DOMRect | null>(null);
  const isPinching = pinchZoom > 1;
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartMid = useRef({ x: 0, y: 0 });
  const imgPanelRef = useRef<HTMLDivElement | null>(null);

  const getPinchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const getPinchMid = (t: React.TouchList) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  const onImgTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getPinchDist(e.touches);
      const mid = getPinchMid(e.touches);
      pinchStartDist.current = dist;
      pinchStartMid.current = mid;
      setPinchOriginScreen(mid);
      setPinchPan({ x: 0, y: 0 });
      if (imgPanelRef.current) setPinchRect(imgPanelRef.current.getBoundingClientRect());
      dragStartX.current = null;
      return;
    }
    // Single touch → swipe
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
    setDragOffset(0);
  };

  const onImgTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const dist = getPinchDist(e.touches);
      const mid = getPinchMid(e.touches);
      const scale = Math.max(1, Math.min(3, dist / pinchStartDist.current));
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
    const atStart = activeImg === 0 && dx > 0;
    const atEnd = activeImg === images.length - 1 && dx < 0;
    setDragOffset(atStart || atEnd ? dx * 0.25 : dx);
  };

  const onImgTouchEnd = () => {
    if (pinchStartDist.current !== null) {
      pinchStartDist.current = null;
      setPinchZoom(1);
      setPinchPan({ x: 0, y: 0 });
      setPinchRect(null);
      return;
    }
    if (!isDragging.current) { dragStartX.current = null; return; }
    const THRESHOLD = 50;
    if (dragOffset < -THRESHOLD && activeImg < images.length - 1) setActiveImg((p) => p + 1);
    else if (dragOffset > THRESHOLD && activeImg > 0) setActiveImg((p) => p - 1);
    setDragOffset(0);
    setTimeout(() => { isDragging.current = false; }, 0);
    dragStartX.current = null;
  };

  useEffect(() => { setActiveImg(0); setDragOffset(0); setPinchZoom(1); setPinchPan({ x: 0, y: 0 }); }, [product?.id]);

  useEffect(() => {
    if (product) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [product]);

  const handleClose = () => {
    if (zoomOpen) { setZoomOpen(false); return; }
    setAddedFeedback(false);
    setActiveImg(0);
    onClose();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (zoomOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") setActiveImg((p) => (p - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setActiveImg((p) => (p + 1) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const handleAddToCart = () => {
    if (!product) return;
    const added = addToCart(product);
    if (added) {
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 1800);
    } else {
      setStockMsg(true);
      if (stockMsgTimer.current) clearTimeout(stockMsgTimer.current);
      stockMsgTimer.current = setTimeout(() => setStockMsg(false), 2500);
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product);
    handleClose();
    setIsCartOpen(true);
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImg((p) => (p - 1 + images.length) % images.length);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImg((p) => (p + 1) % images.length);
  };

  // Strip translate: locked during pinch
  const stripStyle: React.CSSProperties = {
    transform: `translateX(calc(${-(activeImg * 100)}% + ${isPinching ? 0 : dragOffset}px))`,
    transition: (dragOffset !== 0 && !isPinching) ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
    willChange: "transform",
  };

  return (
    <>
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
              data-testid="modal-backdrop"
            />

            {/* Scroll container */}
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
                <motion.div
                  key="modal"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", stiffness: 340, damping: 30 }}
                  className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row pointer-events-auto md:h-[85vh]"
                  data-testid="product-detail-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* ── IMAGE PANEL ── */}
                  <div className="relative flex-shrink-0 w-full md:w-1/2 bg-[#F3EEFB] flex flex-col">

                    {/* Back button */}
                    <button
                      onClick={handleClose}
                      className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-700 hover:text-[#9B6FD1] text-sm font-medium px-3 py-2 rounded-full shadow-md transition-all hover:bg-white"
                      data-testid="modal-back-btn"
                      aria-label="Go back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Back</span>
                    </button>

                    {/* Discount badge */}
                    {product.discount > 0 && (
                      <div className="absolute top-4 right-4 z-20 bg-[#9B6FD1] text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                        {product.discount}% OFF
                      </div>
                    )}

                    {/* ── Main image: sliding strip + pinch zoom ── */}
                    <div
                      ref={imgPanelRef}
                      className="aspect-square md:aspect-auto md:flex-1 md:min-h-0 relative overflow-hidden select-none"
                      style={{ touchAction: "pan-y" }}
                      onTouchStart={onImgTouchStart}
                      onTouchMove={onImgTouchMove}
                      onTouchEnd={onImgTouchEnd}
                    >
                      {/* Sliding strip */}
                      <div
                        className="absolute inset-0 flex"
                        style={stripStyle}
                        onClick={() => !isDragging.current && setZoomOpen(true)}
                        role="button"
                        aria-label="Zoom image"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setZoomOpen(true)}
                      >
                        {images.map((src, i) => (
                          <div key={src} className="relative flex-shrink-0 w-full h-full">
                            <img
                              src={src}
                              alt={`${product.name} – view ${i + 1}`}
                              draggable={false}
                              className="absolute inset-0 w-full h-full object-contain object-center"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Zoom hint — desktop hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden md:flex">
                        <div className="bg-black/40 backdrop-blur-sm text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium">
                          <ZoomIn className="w-3.5 h-3.5" />
                          Zoom
                        </div>
                      </div>

                      {/* Prev / Next arrows — desktop only */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={goPrev}
                            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md transition-all"
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="w-5 h-5 text-gray-700" />
                          </button>
                          <button
                            onClick={goNext}
                            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md transition-all"
                            aria-label="Next image"
                          >
                            <ChevronRight className="w-5 h-5 text-gray-700" />
                          </button>
                          {/* Dots */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                            {images.map((_, i) => (
                              <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setActiveImg(i); }}
                                className={`rounded-full transition-all duration-200 ${i === activeImg ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`}
                                aria-label={`Image ${i + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                      <div className="flex gap-2 px-4 py-3 justify-center bg-[#F3EEFB] flex-shrink-0">
                        {images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImg(i)}
                            aria-label={`View image ${i + 1}`}
                            className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${i === activeImg
                              ? "border-[#9B6FD1] shadow-md scale-105"
                              : "border-transparent opacity-60 hover:opacity-90 hover:border-[#9B6FD1]/40"
                              }`}
                          >
                            <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover object-center" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Instagram pinch-zoom overlay (inside modal z-stack) ── */}
                  {isPinching && pinchRect && (
                    <div
                      className="fixed inset-0 z-[9999] pointer-events-none"
                      style={{ background: "rgba(0,0,0,0.45)" }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: pinchRect.left,
                          top: pinchRect.top,
                          width: pinchRect.width,
                          height: pinchRect.height,
                          transformOrigin: `${pinchOriginScreen.x - pinchRect.left}px ${pinchOriginScreen.y - pinchRect.top}px`,
                          transform: `translate(${pinchPan.x}px, ${pinchPan.y}px) scale(${pinchZoom})`,
                          overflow: "hidden",
                          willChange: "transform",
                        }}
                      >
                        <img
                          src={images[activeImg]}
                          alt={product.name}
                          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── DETAILS PANEL ── */}
                  <div className="flex flex-col p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto">
                    <span className="inline-block self-start text-xs font-semibold uppercase tracking-widest text-[#9B6FD1] bg-[#F3EEFB] px-3 py-1 rounded-full mb-4 capitalize">
                      {product.category}
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl text-gray-900 leading-tight mb-3">
                      {product.name}
                    </h2>
                    <div className="flex flex-wrap items-baseline gap-2 mb-5">
                      <span className="text-2xl font-bold text-gray-900">₹{product.price}</span>
                      {product.originalPrice > product.price && (
                        <>
                          <span className="text-base text-gray-400 line-through">₹{product.originalPrice}</span>
                          <span className="text-sm font-semibold text-emerald-600">
                            Save ₹{product.originalPrice - product.price}
                          </span>
                        </>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-gray-500 text-sm leading-relaxed mb-6">{product.description}</p>
                    )}




                    {/* Return Policy */}
                    <div className="rounded-2xl bg-[#F3EEFB] px-4 py-3 mb-4 space-y-1.5 text-xs text-gray-600">
                      <p className="font-semibold text-gray-800 mb-1">Return Policy</p>
                      <p className="flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0" />
                        Received a defective or wrong item? We'll give you a full refund or replacement.
                      </p>
                    </div>

                    {product.stock > 0 && product.stock <= 2 && (
                      <p className="text-xs font-semibold text-red-500 mb-3">
                        Only {product.stock} left in stock!
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 md:mt-auto pt-2">
                      {product.stock === 0 ? (
                        <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-gray-100 text-gray-400 font-semibold text-sm">
                          Out of Stock
                        </div>
                      ) : (
                        <>
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
                            Buy Now
                          </Button>
                        </>
                      )}
                    </div>
                    {stockMsg && (
                      <p className="text-xs text-amber-600 font-medium text-center mt-2">
                        Max {product.stock} in stock - can't add more
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Zoom lightbox — rendered above everything ── */}
      <AnimatePresence>
        {zoomOpen && product && (
          <ZoomLightbox
            src={images[activeImg]}
            alt={`${product.name} – zoom`}
            onClose={() => setZoomOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
