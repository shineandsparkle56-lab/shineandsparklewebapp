import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag,
  Zap, ZoomIn, X, ZoomOut, RotateCcw, Share2, Check,
} from "lucide-react";
import type { Product, ProductVariant } from "../data/products";
import { supabase } from "../lib/supabase";
import { imgUrl } from "../lib/imgUrl";
import { useCart } from "../context/CartContext";
import { Button } from "../components/ui/button";

// ── helpers ───────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    name: row.name as string,
    category: row.category as string,
    price: row.price as number,
    originalPrice: row.original_price as number,
    discount: row.discount as number,
    image: row.image as string,
    images: Array.isArray(row.images) && (row.images as string[]).length
      ? (row.images as string[])
      : [row.image as string],
    description: row.description as string,
    stock: typeof row.stock === "number" ? row.stock : 99,
    shipping_credit: typeof row.shipping_credit === "number" ? row.shipping_credit : 0,
    wholesale_price: typeof row.wholesale_price === "number" ? row.wholesale_price : 0,
    variants: Array.isArray(row.variants) ? (row.variants as ProductVariant[]) : [],
    base_variant_label: typeof row.base_variant_label === "string" ? row.base_variant_label : undefined,
    base_variant_color: typeof row.base_variant_color === "string" ? row.base_variant_color : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at: row.created_at as string | undefined,
  };
}

// ── useShare hook ─────────────────────────────────────────────────────────────
// Uses native Web Share API on mobile; falls back to clipboard copy on desktop.

function useShare() {
  const [copied, setCopied] = useState(false);

  const share = async (product: Product) => {
    const url   = `${window.location.origin}/product/${product.id}`;
    const title = product.name;
    const text  = `${product.name} — ₹${product.price} | Shine and Sparkle`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard blocked — open in new tab as last resort
        window.open(url, "_blank");
      }
    }
  };

  return { share, copied };
}

// ── ZoomLightbox ──────────────────────────────────────────────────────────────

function ZoomLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos,   setPos]   = useState({ x: 0, y: 0 });
  const isDragging  = useRef(false);
  const dragStart   = useRef({ x: 0, y: 0 });
  const lastPos     = useRef({ x: 0, y: 0 });
  const lastDist    = useRef<number | null>(null);
  const lastScale   = useRef(1);
  const MIN = 1; const MAX = 5;

  const clamp = useCallback((x: number, y: number, s: number) => {
    const max = ((s - 1) / 2) * 100;
    return { x: Math.max(-max, Math.min(max, x)), y: Math.max(-max, Math.min(max, y)) };
  }, []);

  const zoom = (delta: number) =>
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, prev + delta));
      if (next === MIN) setPos({ x: 0, y: 0 });
      return next;
    });

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.4 : -0.4); };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - lastPos.current.x, y: e.clientY - lastPos.current.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const raw = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    const clamped = clamp(raw.x, raw.y, scale);
    lastPos.current = clamped;
    setPos(clamped);
  };
  const onMouseUp = () => { isDragging.current = false; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastScale.current = scale;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDist.current !== null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const next = Math.min(MAX, Math.max(MIN, lastScale.current * (dist / lastDist.current)));
      if (next === MIN) setPos({ x: 0, y: 0 });
      setScale(next);
      e.preventDefault();
    }
  };
  const onTouchEnd = () => { lastDist.current = null; lastScale.current = scale; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={src} alt={alt} draggable={false}
        className="max-w-full max-h-full object-contain pointer-events-none"
        style={{ transform: `scale(${scale}) translate(${pos.x / scale}px,${pos.y / scale}px)`, transition: isDragging.current ? "none" : "transform 0.15s ease", cursor: scale > 1 ? "grab" : "zoom-in" }}
      />
      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
        <button onClick={() => zoom(-0.5)} className="w-8 h-8 flex items-center justify-center text-white hover:text-gray-300 transition-colors" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-white text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoom(0.5)}  className="w-8 h-8 flex items-center justify-center text-white hover:text-gray-300 transition-colors" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }} className="w-8 h-8 flex items-center justify-center text-white hover:text-gray-300 transition-colors" aria-label="Reset"><RotateCcw className="w-4 h-4" /></button>
      </div>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-14 bg-gray-100 shimmer" />
      <div className="px-4 sm:px-6 lg:px-10 py-4 flex flex-col md:flex-row gap-6 lg:gap-10">
        <div className="w-full md:w-1/2 aspect-square bg-gray-200 shimmer rounded-2xl" />
        <div className="flex-1 space-y-4">
          <div className="h-5 w-1/4 bg-gray-200 shimmer rounded-full" />
          <div className="h-8 w-3/4 bg-gray-200 shimmer rounded-full" />
          <div className="h-6 w-1/3 bg-gray-200 shimmer rounded-full" />
          <div className="space-y-2 mt-4">
            <div className="h-3 bg-gray-200 shimmer rounded-full w-full" />
            <div className="h-3 bg-gray-200 shimmer rounded-full w-5/6" />
            <div className="h-3 bg-gray-200 shimmer rounded-full w-4/6" />
          </div>
          <div className="flex gap-3 mt-6">
            <div className="h-12 flex-1 bg-gray-200 shimmer rounded-full" />
            <div className="h-12 flex-1 bg-gray-200 shimmer rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProductDetailPage({ productId }: { productId: number }) {
  const [, navigate] = useLocation();
  const { addToCart, setIsCartOpen, cart } = useCart();

  const { share, copied } = useShare();

  const [product,  setProduct]  = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeImg,  setActiveImg]  = useState(0);
  const [zoomOpen,   setZoomOpen]   = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [stockMsg,   setStockMsg]   = useState(false);
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // swipe
  const dragStartX  = useRef<number | null>(null);
  const dragStartY  = useRef<number | null>(null);
  const isDragging  = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  // pinch
  const [pinchZoom,  setPinchZoom]  = useState(1);
  const [pinchPan,   setPinchPan]   = useState({ x: 0, y: 0 });
  const [pinchRect,  setPinchRect]  = useState<DOMRect | null>(null);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 });
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartMid  = useRef({ x: 0, y: 0 });
  const imgPanelRef    = useRef<HTMLDivElement | null>(null);
  const isPinching     = pinchZoom > 1;

  // thumbnail strip scroll
  const thumbRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch product ─────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    supabase.from("products").select("*").eq("id", productId).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setProduct(mapRow(data as Record<string, unknown>)); }
        setLoading(false);
      });
  }, [productId]);

  // Scroll product detail to top on open
  useEffect(() => {
    // Find our own scroll container (the fixed overlay div)
    const el = document.querySelector("[data-product-scroll]") as HTMLElement | null;
    if (el) {
      el.scrollTop = 0;
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [productId]);

  // ── Variants ──────────────────────────────────────────────────
  const hasVariants = (product?.variants?.length ?? 0) > 0;

  const allVariants = hasVariants && product ? [
    {
      id: "__base",
      label: product.base_variant_label || "Default",
      images: product.images?.length ? product.images : [product.image],
      stock: product.stock,
      color: product.base_variant_color,
      price: undefined as number | undefined,
    },
    ...(product.variants ?? []),
  ] : [];

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!product) return;
    setSelectedVariantId(product.variants?.length ? "__base" : undefined);
    setActiveImg(0);
    setDragOffset(0);
    setPinchZoom(1);
    setPinchPan({ x: 0, y: 0 });
  }, [product?.id]);

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);

  const displayPrice  = selectedVariant?.price ?? product?.price ?? 0;
  const displayStock  = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0);
  const outOfStock    = displayStock === 0;

  // Build image list
  const rawBaseImages    = product?.images?.length ? product.images : product ? [product.image] : [];
  const rawVariantImages = (selectedVariant && selectedVariant.id !== "__base" && selectedVariant.images?.length)
    ? selectedVariant.images : null;
  const rawImages = rawVariantImages ?? rawBaseImages;
  const images    = rawImages.map((u) => imgUrl(u, "full"));

  // Current cart quantity for this product/variant
  const cartKey = selectedVariantId && selectedVariantId !== "__base"
    ? `${productId}__${selectedVariantId}` : String(productId);
  const cartQty = cart.find((i) => {
    const k = i.variantId ? `${i.product.id}__${i.variantId}` : String(i.product.id);
    return k === cartKey;
  })?.quantity ?? 0;

  // Scroll active thumb into view
  useEffect(() => {
    const el = thumbRef.current?.children[activeImg] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeImg]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoomOpen) return;
      if (e.key === "ArrowLeft")  setActiveImg((p) => (p - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setActiveImg((p) => (p + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Touch handlers ────────────────────────────────────────────
  const getPDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const getPMid  = (t: React.TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

  const onImgTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDist.current = getPDist(e.touches);
      pinchStartMid.current  = getPMid(e.touches);
      setPinchOrigin(getPMid(e.touches));
      setPinchPan({ x: 0, y: 0 });
      if (imgPanelRef.current) setPinchRect(imgPanelRef.current.getBoundingClientRect());
      dragStartX.current = null; return;
    }
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
    isDragging.current = false;
    setDragOffset(0);
  };

  const onImgTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const scale = Math.max(1, Math.min(3, getPDist(e.touches) / pinchStartDist.current));
      const mid   = getPMid(e.touches);
      setPinchZoom(scale);
      setPinchPan({ x: mid.x - pinchStartMid.current.x, y: mid.y - pinchStartMid.current.y });
      e.preventDefault(); return;
    }
    if (isPinching || dragStartX.current === null || dragStartY.current === null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (!isDragging.current) { if (Math.abs(dx) < Math.abs(dy)) return; isDragging.current = true; }
    const atEdge = (activeImg === 0 && dx > 0) || (activeImg === images.length - 1 && dx < 0);
    setDragOffset(atEdge ? dx * 0.25 : dx);
  };

  const onImgTouchEnd = () => {
    if (pinchStartDist.current !== null) {
      pinchStartDist.current = null; setPinchZoom(1); setPinchPan({ x: 0, y: 0 }); setPinchRect(null); return;
    }
    if (isDragging.current) {
      if (dragOffset < -50 && activeImg < images.length - 1) setActiveImg((p) => p + 1);
      if (dragOffset >  50 && activeImg > 0)                 setActiveImg((p) => p - 1);
    }
    setDragOffset(0);
    setTimeout(() => { isDragging.current = false; }, 0);
    dragStartX.current = null;
  };

  const stripStyle: React.CSSProperties = {
    transform:  `translateX(calc(${-(activeImg * 100)}% + ${isPinching ? 0 : dragOffset}px))`,
    transition: (dragOffset !== 0 && !isPinching) ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
    willChange: "transform",
  };

  // ── Cart actions ──────────────────────────────────────────────
  const handleAddToCart = () => {
    if (!product || outOfStock) return;
    const varId = selectedVariantId === "__base" ? undefined : selectedVariantId;
    const added = addToCart(product, varId);
    if (added) {
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 1800);
    } else {
      setStockMsg(true);
      if (stockTimer.current) clearTimeout(stockTimer.current);
      stockTimer.current = setTimeout(() => setStockMsg(false), 2500);
    }
  };

  const handleBuyNow = () => {
    if (!product || outOfStock) return;
    const varId = selectedVariantId === "__base" ? undefined : selectedVariantId;
    addToCart(product, varId);
    setIsCartOpen(true);
  };

  const isNew = !!product?.created_at && (Date.now() - new Date(product.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000;

  // ── Render: loading ───────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  // ── Render: not found ─────────────────────────────────────────
  if (notFound || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-xl font-serif text-gray-700">Product not found</p>
        <button onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#9B6FD1] text-white rounded-full text-sm font-semibold hover:bg-[#8a5fc0] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </button>
      </div>
    );
  }

  // ── Render: page ──────────────────────────────────────────────
  return (
    <>
      {/* Back bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 h-11 flex items-center gap-3">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate("/");
            }
          }}
          className="flex items-center gap-1.5 text-gray-500 hover:text-[#9B6FD1] text-sm font-medium transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-gray-200">/</span>
        <span className="text-xs text-gray-400 capitalize truncate">{product.category}</span>
        <span className="text-gray-200">/</span>
        <span className="text-xs text-gray-600 truncate font-medium max-w-[160px] sm:max-w-xs">{product.name}</span>

        {/* Share button — right side */}
        <button
          onClick={() => share(product)}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#9B6FD1] transition-colors px-2.5 py-1 rounded-full hover:bg-[#F3EEFB]"
          aria-label="Share product"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-500">Copied!</span></>
            : <><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Share</span></>}
        </button>
      </div>

      {/* Main layout */}
      <div className="px-4 sm:px-6 lg:px-10 py-4 lg:py-8 pb-32 sm:pb-10">
        <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start">

          {/* ── LEFT: Image gallery ───────────────────────────── */}
          <div className="w-full md:w-[40%] md:sticky md:top-11 flex flex-col gap-3">

            {/* Main image */}
            <div
              ref={imgPanelRef}
              className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#F3EEFB] select-none"
              style={{ touchAction: "pan-y" }}
              onTouchStart={onImgTouchStart}
              onTouchMove={onImgTouchMove}
              onTouchEnd={onImgTouchEnd}
            >
              {/* Sliding strip */}
              <div className="absolute inset-0 flex" style={stripStyle}>
                {images.map((src, i) => (
                  <div key={src} className="relative flex-shrink-0 w-full h-full">
                    <img
                      src={src}
                      alt={`${product.name} – view ${i + 1}`}
                      draggable={false}
                      className={`absolute inset-0 w-full h-full object-contain object-center ${outOfStock ? "brightness-75" : ""}`}
                    />
                  </div>
                ))}
              </div>

              {/* Discount badge */}
              {product.discount > 0 && !outOfStock && (
                <div className="absolute top-3 left-3 z-10 bg-[#9B6FD1] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                  {product.discount}% OFF
                </div>
              )}
              {isNew && !outOfStock && (
                <div className="absolute top-3 right-3 z-10 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                  New
                </div>
              )}
              {outOfStock && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 rounded-2xl">
                  <span className="bg-gray-800/80 text-white text-sm font-semibold px-4 py-2 rounded-full">Out of Stock</span>
                </div>
              )}

              {/* Zoom hint */}
              <button
                onClick={() => setZoomOpen(true)}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded-full shadow transition-all"
                aria-label="Zoom image"
              >
                <ZoomIn className="w-3.5 h-3.5" /> Zoom
              </button>

              {/* Desktop arrows */}
              {images.length > 1 && (
                <>
                  <button onClick={() => setActiveImg((p) => (p - 1 + images.length) % images.length)}
                    className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow transition-all"
                    aria-label="Previous image">
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button onClick={() => setActiveImg((p) => (p + 1) % images.length)}
                    className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow transition-all"
                    aria-label="Next image">
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                  {/* Mobile dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1 sm:hidden">
                    {images.map((_, i) => (
                      <button key={i} onClick={() => setActiveImg(i)}
                        className={`rounded-full transition-all duration-200 ${i === activeImg ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`}
                        aria-label={`Image ${i + 1}`} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip — desktop */}
            {images.length > 1 && (
              <div
                ref={thumbRef}
                className="hidden sm:flex gap-2 overflow-x-auto scrollbar-none pb-1"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {images.map((src, i) => (
                  <button
                    key={src}
                    onClick={() => setActiveImg(i)}
                    className={`flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      i === activeImg ? "border-[#9B6FD1] shadow-md shadow-[#9B6FD1]/20" : "border-transparent hover:border-gray-200"
                    }`}
                    aria-label={`Thumbnail ${i + 1}`}
                  >
                    <img src={imgUrl(src, "tiny")} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Pinch overlay */}
            {isPinching && pinchRect && (
              <div className="fixed inset-0 z-[9998] pointer-events-none" style={{ background: "rgba(0,0,0,0.45)" }}>
                <div style={{
                  position: "absolute",
                  left: pinchRect.left, top: pinchRect.top,
                  width: pinchRect.width, height: pinchRect.height,
                  transformOrigin: `${pinchOrigin.x - pinchRect.left}px ${pinchOrigin.y - pinchRect.top}px`,
                  transform: `translate(${pinchPan.x}px,${pinchPan.y}px) scale(${pinchZoom})`,
                  overflow: "hidden", willChange: "transform",
                }}>
                  <img src={images[activeImg]} alt={product.name}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Details ────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">

            {/* Category */}
            <span className="inline-block self-start text-xs font-semibold uppercase tracking-widest text-[#9B6FD1] bg-[#F3EEFB] px-3 py-1 rounded-full capitalize">
              {product.category}
            </span>

            {/* Name + share */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-gray-900 leading-tight">
                {product.name}
              </h1>
              <button
                onClick={() => share(product)}
                className="shrink-0 mt-1 w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-[#9B6FD1] hover:border-[#9B6FD1] hover:bg-[#F3EEFB] transition-all"
                aria-label="Share product"
                title={copied ? "Link copied!" : "Share"}
              >
                {copied
                  ? <Check className="w-4 h-4 text-emerald-500" />
                  : <Share2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">₹{displayPrice}</span>
              {product.originalPrice > displayPrice && (
                <>
                  <span className="text-lg text-gray-400 line-through">₹{product.originalPrice}</span>
                  <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Save ₹{product.originalPrice - displayPrice}
                  </span>
                </>
              )}
            </div>

            {/* Variants */}
            {hasVariants && allVariants.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {selectedVariant
                    ? <>Style: <span className="text-[#9B6FD1] normal-case font-bold">{selectedVariant.label}</span></>
                    : "Select Style"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {allVariants.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    const isSoldOut  = v.stock === 0;
                    return (
                      <button
                        key={v.id}
                        onClick={() => !isSoldOut && setSelectedVariantId(v.id)}
                        disabled={isSoldOut}
                        className={`relative flex flex-col items-center gap-1.5 transition-all duration-200 ${isSoldOut ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div
                          style={{ backgroundColor: v.color || "#e5e7eb" }}
                          className={`w-11 h-11 rounded-full border-[3px] transition-all duration-200 ${
                            isSelected
                              ? "border-[#9B6FD1] shadow-lg shadow-[#9B6FD1]/30 scale-110"
                              : "border-white ring-1 ring-gray-200 hover:ring-[#9B6FD1] hover:scale-105"
                          }`}
                        />
                        <span className={`text-[11px] font-semibold ${isSelected ? "text-[#9B6FD1]" : "text-gray-500"}`}>
                          {v.label}
                        </span>
                        {isSelected && (
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#9B6FD1] rounded-full flex items-center justify-center shadow">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        {isSoldOut && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-full h-0.5 bg-gray-400 rotate-45 absolute" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-gray-500 text-sm leading-relaxed">{product.description}</p>
            )}

            {/* Return policy */}
            <div className="rounded-2xl bg-[#F3EEFB] px-4 py-3 space-y-1.5 text-xs text-gray-600">
              <p className="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-[#9B6FD1]" /> Return Policy
              </p>
              <p>Received a defective or wrong item? We'll give you a full refund or replacement.</p>
            </div>

            {/* Low stock warning */}
            {displayStock > 0 && displayStock <= 3 && (
              <p className="text-xs font-semibold text-red-500">
                Only {displayStock} left in stock!
              </p>
            )}

            {/* Cart quantity indicator */}
            {cartQty > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#9B6FD1] font-semibold">
                <ShoppingBag className="w-3.5 h-3.5" />
                {cartQty} in your cart
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 mt-1">
              {outOfStock ? (
                <div className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-gray-100 text-gray-400 font-semibold text-sm">
                  Out of Stock
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1]/5 rounded-full gap-2 h-12 text-sm font-semibold"
                    onClick={handleAddToCart}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {addedFeedback ? "Added to Cart ✓" : cartQty > 0 ? "Add More" : "Add to Cart"}
                  </Button>
                  <Button
                    className="flex-1 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white rounded-full gap-2 h-12 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                    onClick={handleBuyNow}
                  >
                    <Zap className="w-4 h-4" />
                    Buy Now
                  </Button>
                </>
              )}
            </div>

            {stockMsg && (
              <p className="text-xs text-amber-600 font-medium text-center">
                Max {displayStock} in stock — can't add more
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Zoom lightbox */}
      {zoomOpen && (
        <ZoomLightbox
          src={rawImages[activeImg] ?? images[activeImg]}
          alt={`${product.name} – zoom`}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </>
  );
}
