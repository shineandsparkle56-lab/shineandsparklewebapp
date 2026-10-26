/**
 * ComboBuilderPage — /combo/:id
 *
 * Full product grid (same as main store) with:
 *  - Grid / List view toggle
 *  - Sliding image carousel (touch swipe + arrows + dots)
 *  - Pinch-zoom overlay (identical to ProductCard)
 *  - Qty +/- per product/variant, capped at available stock
 *  - Total count badge vs box.item_count
 *  - Smart pricing footer: live retail value, savings, per-item avg
 *  - Shipping nudge banner when box has shipping_credit
 *  - Retail price shown on each product card
 *  - Animated pulse on add, savings grow as selection fills
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Package2, CheckCircle2, Loader2, X,
  ShoppingBag, Minus, Plus, LayoutGrid, List, RotateCcw,
  Sparkles, Tag, TrendingDown,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useProducts } from "../context/ProductsContext";
import { useCart, ComboBoxSlot } from "../context/CartContext";
import { imgUrl } from "../lib/imgUrl";
import type { Product, ProductVariant } from "../data/products";

// ─── Types ────────────────────────────────────────────────────
interface ComboBox {
  id: number; name: string; description: string;
  box_image_url: string | null; item_count: number; box_price: number;
  wholesale_min: number; wholesale_max: number;
  allow_duplicates: boolean; is_active: boolean; shipping_credit: number;
}

type SelectionKey = string;
interface SelectionEntry { product: Product; variant?: ProductVariant; qty: number; }

function makeKey(productId: number, variantId?: string | null): SelectionKey {
  return variantId ? `${productId}__${variantId}` : String(productId);
}

type ViewMode = "grid" | "list";

// ─── ComboProductCard ─────────────────────────────────────────
interface ComboProductCardProps {
  product:     Product;
  view:        ViewMode;
  selEntry?:   SelectionEntry;
  canAdd:      boolean;
  boxPrice:    number;   // total box price for per-item context
  itemCount:   number;   // total slots
  onAdd:       (product: Product, variant?: ProductVariant) => void;
  onMinus:     (product: Product, variant?: ProductVariant) => void;
  onViewDetail:(product: Product) => void;
}

function ComboProductCard({ product, view, selEntry, canAdd, boxPrice, itemCount, onAdd, onMinus, onViewDetail }: ComboProductCardProps) {
  const [imgIndex,   setImgIndex]   = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [justAdded,  setJustAdded]  = useState(false);
  const isDragging   = useRef(false);
  const dragStartX   = useRef<number | null>(null);
  const dragStartY   = useRef<number | null>(null);

  // Pinch zoom
  const [pinchZoom,   setPinchZoom]   = useState(1);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 });
  const [pinchPan,    setPinchPan]    = useState({ x: 0, y: 0 });
  const [pinchRect,   setPinchRect]   = useState<DOMRect | null>(null);
  const isPinching = pinchZoom > 1;
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartMid  = useRef({ x: 0, y: 0 });
  const containerRef   = useRef<HTMLDivElement | null>(null);

  const images = (product.images?.length ? product.images : [product.image]).map((u) => imgUrl(u, "full"));
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const noStock = hasVariants
    ? product.variants.every((v) => v.stock <= 0)
    : product.stock <= 0;

  const qty    = selEntry?.qty ?? 0;
  const isNew  = !!product.created_at &&
    (Date.now() - new Date(product.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000;

  // Per-item average price of the box
  const perItemBoxPrice = Math.round(boxPrice / itemCount);
  // How much cheaper is this product vs box avg (positive = cheaper in box)
  const saving = product.price - perItemBoxPrice;

  // Pulse on add
  const handleAdd = (p: Product, v?: ProductVariant) => {
    onAdd(p, v);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 600);
  };

  // ── Arrow nav ────────────────────────────────────────────────
  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  };

  // ── Touch handlers ───────────────────────────────────────────
  const getDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const getMid = (t: React.TouchList) => ({
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  });

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDist(e.touches);
      const mid  = getMid(e.touches);
      pinchStartDist.current = dist;
      pinchStartMid.current  = mid;
      setPinchOrigin(mid);
      setPinchPan({ x: 0, y: 0 });
      if (containerRef.current) setPinchRect(containerRef.current.getBoundingClientRect());
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
      const dist  = getDist(e.touches);
      const mid   = getMid(e.touches);
      const scale = Math.max(1, Math.min(3, dist / pinchStartDist.current));
      setPinchZoom(scale);
      setPinchPan({ x: mid.x - pinchStartMid.current.x, y: mid.y - pinchStartMid.current.y });
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
    const atEnd   = imgIndex === images.length - 1 && dx < 0;
    setDragOffset(atStart || atEnd ? dx * 0.25 : dx);
  };

  const onTouchEnd = () => {
    if (pinchStartDist.current !== null) {
      pinchStartDist.current = null;
      setPinchZoom(1); setPinchPan({ x: 0, y: 0 }); setPinchRect(null);
      return;
    }
    if (isDragging.current) {
      const THRESHOLD = 50;
      if (dragOffset < -THRESHOLD && imgIndex < images.length - 1) setImgIndex((i) => i + 1);
      else if (dragOffset > THRESHOLD && imgIndex > 0)              setImgIndex((i) => i - 1);
    }
    setDragOffset(0);
    setTimeout(() => { isDragging.current = false; }, 0);
    dragStartX.current = null;
  };

  const stripStyle: React.CSSProperties = {
    transform:  `translateX(calc(${-(imgIndex * 100)}% + ${dragOffset}px))`,
    transition: dragOffset !== 0 ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
    willChange: "transform",
  };

  // ── List view ─────────────────────────────────────────────────
  if (view === "list") {
    return (
      <>
        <motion.div
          animate={justAdded ? { scale: [1, 1.03, 1] } : {}}
          transition={{ duration: 0.35 }}
          className={`flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border transition-all ${
            qty > 0 ? "border-[#9B6FD1]/40 ring-1 ring-[#9B6FD1]/20" : noStock ? "border-gray-100 opacity-60" : "border-gray-100 hover:shadow-md"
          }`}>
          {/* Image */}
          <div ref={containerRef}
            className="relative aspect-square overflow-hidden bg-gray-50 select-none"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="absolute inset-0 flex" style={stripStyle}>
              {images.map((src, i) => (
                <div key={src} className="relative flex-shrink-0 w-full h-full">
                  <img src={src} alt={`${product.name} ${i + 1}`} draggable={false}
                    className="absolute inset-0 w-full h-full object-contain object-center" />
                </div>
              ))}
            </div>
            {images.length > 1 && <>
              <button onClick={prevImg} className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button onClick={nextImg} className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                {images.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                    className={`rounded-full transition-all duration-200 ${i === imgIndex ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`} />
                ))}
              </div>
            </>}
            {product.discount > 0 && <div className="absolute top-3 left-3 z-10 bg-[#9B6FD1] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase pointer-events-none">{product.discount}% OFF</div>}
            {isNew && <div className="absolute top-3 right-3 z-10 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase pointer-events-none">New</div>}
            {noStock && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full">Out of Stock</span></div>}
          </div>
          {/* Info + controls */}
          <div className="p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-serif text-gray-900 text-base leading-snug">{product.name}</h3>
              {/* Retail price row */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                {product.originalPrice > product.price && (
                  <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>
                )}
                {/* In-box saving badge */}
                {saving > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingDown className="w-2.5 h-2.5" />
                    Save ₹{saving} in box
                  </span>
                )}
              </div>
              {hasVariants && <p className="text-[10px] text-[#9B6FD1] font-semibold mt-0.5">{product.variants.length} colors available</p>}
            </div>
            <ComboCardControls product={product} qty={qty} canAdd={canAdd} noStock={noStock}
              hasVariants={hasVariants}
              onAdd={(p, v) => handleAdd(p, v)}
              onMinus={onMinus} onViewDetail={onViewDetail} />
          </div>
        </motion.div>
        {isPinching && pinchRect && <PinchOverlay src={images[imgIndex]} alt={product.name}
          pinchRect={pinchRect} pinchOrigin={pinchOrigin} pinchPan={pinchPan} pinchZoom={pinchZoom} contain />}
      </>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────
  return (
    <>
      <motion.div
        animate={justAdded ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.35 }}
        className={`flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-200 ${
          qty > 0 ? "border-[#9B6FD1]/40 ring-1 ring-[#9B6FD1]/20" : noStock ? "border-gray-100 opacity-60" : "border-gray-100 hover:shadow-md hover:border-[#9B6FD1]/30"
        }`}>
        {/* Image */}
        <div ref={containerRef}
          className="relative w-full aspect-square overflow-hidden bg-gray-50 select-none"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="absolute inset-0 flex" style={stripStyle}
            onClick={() => !isDragging.current && onViewDetail(product)}>
            {images.map((src, i) => (
              <div key={src} className="relative flex-shrink-0 w-full h-full">
                <img src={src} alt={`${product.name} ${i + 1}`} draggable={false}
                  className="absolute inset-0 w-full h-full object-cover object-center" />
              </div>
            ))}
          </div>
          {images.length > 1 && <>
            <button onClick={prevImg} className="hidden sm:flex absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
            <button onClick={nextImg} className="hidden sm:flex absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 items-center justify-center rounded-full bg-white/80 shadow hover:bg-white transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex gap-1">
              {images.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                  className={`rounded-full transition-all duration-200 ${i === imgIndex ? "w-3 h-1 bg-[#9B6FD1]" : "w-1 h-1 bg-white/70"}`} />
              ))}
            </div>
          </>}
          {product.discount > 0 && <div className="absolute top-2 left-2 z-10 bg-[#9B6FD1] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase pointer-events-none">{product.discount}% OFF</div>}
          {isNew && <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase pointer-events-none">New</div>}
          {noStock && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="bg-black/70 text-white text-[9px] font-bold px-2.5 py-1 rounded-full">Out of Stock</span></div>}
        </div>
        {/* Info + controls */}
        <div className="p-2.5 flex flex-col gap-2 flex-1">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
            {/* Retail price row */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <span className="text-[10px] text-gray-400 line-through">₹{product.originalPrice}</span>
              )}
            </div>
            {/* In-box saving */}
            {saving > 0 && (
              <p className="text-[9px] font-bold text-emerald-600 mt-0.5 flex items-center gap-0.5">
                <TrendingDown className="w-2.5 h-2.5 inline" /> ₹{saving} cheaper in box
              </p>
            )}
            {hasVariants && <p className="text-[10px] text-[#9B6FD1] font-semibold mt-0.5">{product.variants.length} colors</p>}
          </div>
          <ComboCardControls product={product} qty={qty} canAdd={canAdd} noStock={noStock}
            hasVariants={hasVariants}
            onAdd={(p, v) => handleAdd(p, v)}
            onMinus={onMinus} onViewDetail={onViewDetail} />
        </div>
      </motion.div>
      {isPinching && pinchRect && <PinchOverlay src={images[imgIndex]} alt={product.name}
        pinchRect={pinchRect} pinchOrigin={pinchOrigin} pinchPan={pinchPan} pinchZoom={pinchZoom} />}
    </>
  );
}

// ─── ComboCardControls ────────────────────────────────────────
function ComboCardControls({ product, qty, canAdd, noStock, hasVariants, onAdd, onMinus, onViewDetail }: {
  product: Product; qty: number; canAdd: boolean; noStock: boolean;
  hasVariants: boolean; onAdd: (p: Product, v?: ProductVariant) => void;
  onMinus: (p: Product, v?: ProductVariant) => void; onViewDetail: (p: Product) => void;
}) {
  if (hasVariants) {
    return (
      <button onClick={() => !noStock && onViewDetail(product)}
        disabled={noStock}
        className={`w-full py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all ${
          qty > 0 ? "border-[#9B6FD1] bg-[#9B6FD1] text-white"
          : noStock ? "border-gray-200 text-gray-400 cursor-not-allowed"
          : "border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1] hover:text-white"
        }`}>
        {qty > 0 ? `✓ ${qty} added · Change` : "Pick Color"}
      </button>
    );
  }
  if (qty === 0) {
    return (
      <button onClick={() => !noStock && canAdd && onAdd(product)}
        disabled={noStock || !canAdd}
        className={`w-full py-1.5 rounded-xl text-[11px] font-bold border-2 transition-all ${
          noStock || !canAdd
            ? "border-gray-200 text-gray-400 cursor-not-allowed bg-white"
            : "border-[#9B6FD1] text-[#9B6FD1] hover:bg-[#9B6FD1] hover:text-white"
        }`}>
        + Add to Box
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between bg-[#F3EEFB] rounded-xl px-2 py-1">
      <button onClick={() => onMinus(product)}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1] transition-colors">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-sm font-bold text-[#9B6FD1] min-w-[20px] text-center">{qty}</span>
      <button onClick={() => canAdd && onAdd(product)}
        disabled={!canAdd}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── ComboProductDetailOverlay ────────────────────────────────
interface ComboDetailProps {
  product:       Product;
  selection:     Record<SelectionKey, SelectionEntry>;
  remaining:     number;
  allowDuplicates: boolean;
  onAdd:   (p: Product, v?: ProductVariant) => void;
  onMinus: (p: Product, v?: ProductVariant) => void;
  onClose: () => void;
}

function ComboProductDetailOverlay({
  product, selection, remaining, allowDuplicates, onAdd, onMinus, onClose,
}: ComboDetailProps) {
  const hasVariants = (product.variants?.length ?? 0) > 0;

  const allVariants = hasVariants ? [
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

  const firstInStockId = allVariants.find((v) => v.stock > 0)?.id ?? "__base";
  const [selectedVId, setSelectedVId] = useState<string>(firstInStockId);
  const selectedVariant = allVariants.find((v) => v.id === selectedVId);

  const baseImages = (product.images?.length ? product.images : [product.image]).map((u) => imgUrl(u, "full"));
  const images = (selectedVariant && selectedVariant.id !== "__base" && (selectedVariant as ProductVariant & { images: string[] }).images?.length)
    ? (selectedVariant as ProductVariant & { images: string[] }).images.map((u: string) => imgUrl(u, "full"))
    : baseImages;

  const [activeImg, setActiveImg] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging  = useRef(false);
  const dragStartX  = useRef<number | null>(null);
  const dragStartY  = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const stock        = (selectedVariant as ProductVariant)?.stock ?? product.stock;
  const outOfStock   = stock <= 0;
  const displayPrice = (selectedVariant as ProductVariant)?.price ?? product.price;

  const realVariantId = selectedVId === "__base" ? undefined : selectedVId;
  const selKey = makeKey(product.id, realVariantId);
  const qty    = selection[selKey]?.qty ?? 0;

  const atStockMax  = qty >= stock;
  const atSlotMax   = remaining === 0 && qty === 0;
  const atDupMax    = !allowDuplicates && qty > 0;
  const canAdd      = !outOfStock && !atStockMax && !atSlotMax && !atDupMax;

  const getDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const getMid  = (t: React.TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
  const [pinchZoom, setPinchZoom] = useState(1);
  const [pinchPan,  setPinchPan]  = useState({ x: 0, y: 0 });
  const [pinchRect, setPinchRect] = useState<DOMRect | null>(null);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 });
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartMid  = useRef({ x: 0, y: 0 });
  const isPinching = pinchZoom > 1;

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDist.current = getDist(e.touches);
      const mid = getMid(e.touches);
      pinchStartMid.current = mid; setPinchOrigin(mid); setPinchPan({ x: 0, y: 0 });
      if (containerRef.current) setPinchRect(containerRef.current.getBoundingClientRect());
      dragStartX.current = null; return;
    }
    dragStartX.current = e.touches[0].clientX; dragStartY.current = e.touches[0].clientY;
    isDragging.current = false; setDragOffset(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const scale = Math.max(1, Math.min(3, getDist(e.touches) / pinchStartDist.current));
      const mid   = getMid(e.touches);
      setPinchZoom(scale); setPinchPan({ x: mid.x - pinchStartMid.current.x, y: mid.y - pinchStartMid.current.y });
      e.preventDefault(); return;
    }
    if (pinchZoom > 1 || dragStartX.current === null || dragStartY.current === null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (!isDragging.current) { if (Math.abs(dx) < Math.abs(dy)) return; isDragging.current = true; }
    const atStart = activeImg === 0 && dx > 0; const atEnd = activeImg === images.length - 1 && dx < 0;
    setDragOffset(atStart || atEnd ? dx * 0.25 : dx);
  };
  const onTouchEnd = () => {
    if (pinchStartDist.current !== null) { pinchStartDist.current = null; setPinchZoom(1); setPinchPan({ x: 0, y: 0 }); setPinchRect(null); return; }
    if (isDragging.current) {
      if (dragOffset < -50 && activeImg < images.length - 1) setActiveImg((i) => i + 1);
      else if (dragOffset > 50 && activeImg > 0)             setActiveImg((i) => i - 1);
    }
    setDragOffset(0); setTimeout(() => { isDragging.current = false; }, 0); dragStartX.current = null;
  };

  const stripStyle: React.CSSProperties = {
    transform:  `translateX(calc(${-(activeImg * 100)}% + ${dragOffset}px))`,
    transition: dragOffset !== 0 ? "none" : "transform 0.3s cubic-bezier(0.25,1,0.5,1)",
    willChange: "transform",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 truncate text-sm">{product.name}</p>
            <p className="text-[11px] text-gray-400 capitalize">{product.category}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image carousel */}
          <div ref={containerRef}
            className="relative w-full aspect-square bg-gray-50 overflow-hidden select-none"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="absolute inset-0 flex" style={stripStyle}>
              {images.map((src, i) => (
                <div key={src} className="relative flex-shrink-0 w-full h-full">
                  <img src={src} alt={`${product.name} ${i + 1}`} draggable={false}
                    className="absolute inset-0 w-full h-full object-contain object-center" />
                </div>
              ))}
            </div>
            {images.length > 1 && <>
              <button onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i + 1) % images.length); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 shadow hover:bg-white">
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                {images.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setActiveImg(i); }}
                    className={`rounded-full transition-all duration-200 ${i === activeImg ? "w-4 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-white/70 hover:bg-white"}`} />
                ))}
              </div>
            </>}
            {product.discount > 0 && <div className="absolute top-3 left-3 z-10 bg-[#9B6FD1] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase pointer-events-none">{product.discount}% OFF</div>}
          </div>

          {/* Detail */}
          <div className="p-4 space-y-4">
            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">₹{displayPrice}</span>
              {product.originalPrice > displayPrice && <>
                <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Save ₹{product.originalPrice - displayPrice}
                </span>
              </>}
            </div>

            {/* Variant swatches */}
            {hasVariants && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                  Style: <span className="text-[#9B6FD1] normal-case font-bold">{selectedVariant?.label}</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-3">
                  {allVariants.filter((v) => v.stock > 0).map((v) => {
                    const isSelected = v.id === selectedVId;
                    const vKey = makeKey(product.id, v.id === "__base" ? undefined : v.id);
                    const vQty = selection[vKey]?.qty ?? 0;
                    return (
                      <button key={v.id}
                        onClick={() => { setSelectedVId(v.id); setActiveImg(0); setDragOffset(0); }}
                        className="relative flex flex-col items-center gap-1.5 w-14 transition-all duration-200">
                        <div
                          style={{ backgroundColor: v.color || "#e5e7eb" }}
                          className={`w-11 h-11 rounded-full border-[3px] transition-all duration-200 ${
                            isSelected ? "border-[#9B6FD1] shadow-lg shadow-[#9B6FD1]/30 scale-110" : "border-white ring-1 ring-gray-200 hover:ring-[#9B6FD1] hover:scale-105"
                          }`}
                        />
                        <span className={`text-[10px] font-semibold text-center leading-tight break-words w-full ${isSelected ? "text-[#9B6FD1]" : "text-gray-500"}`}>
                          {v.label}
                        </span>
                        {vQty > 0 && (
                          <span className="absolute top-0 right-1 w-4 h-4 bg-[#9B6FD1] rounded-full flex items-center justify-center shadow text-white text-[9px] font-black">
                            {vQty}
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
              <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
            )}

            {/* Return policy */}
            <div className="rounded-2xl bg-[#F3EEFB] px-4 py-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-[#9B6FD1]" /> Return Policy
              </p>
              <p>Received a defective or wrong item? We'll give you a full refund or replacement.</p>
            </div>

            <div className="h-4" />
          </div>
        </div>

        {/* Sticky footer: combo qty controls */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
          {outOfStock ? (
            <div className="w-full py-3 rounded-2xl bg-gray-100 text-gray-400 text-sm font-semibold text-center">
              Out of Stock
            </div>
          ) : qty === 0 ? (
            <button
              onClick={() => { onAdd(product, realVariantId ? product.variants.find((v) => v.id === realVariantId) : undefined); }}
              disabled={!canAdd}
              className={`w-full py-3 rounded-2xl text-sm font-bold transition-all ${
                canAdd
                  ? "bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white shadow-md shadow-purple-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}>
              {atSlotMax ? "Box is full" : atDupMax ? "Already added (duplicates off)" : "+ Add to Box"}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-[#F3EEFB] rounded-2xl px-4 py-2.5 flex-1 justify-between">
                <button onClick={() => onMinus(product, realVariantId ? product.variants.find((v) => v.id === realVariantId) : undefined)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1] transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-base font-bold text-[#9B6FD1] min-w-[24px] text-center">{qty}</span>
                <button onClick={() => canAdd && onAdd(product, realVariantId ? product.variants.find((v) => v.id === realVariantId) : undefined)}
                  disabled={!canAdd}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button onClick={onClose}
                className="shrink-0 px-5 py-2.5 bg-[#9B6FD1] text-white text-sm font-bold rounded-2xl hover:bg-[#8a5fc0] transition-colors">
                Done
              </button>
            </div>
          )}
          {remaining === 0 && qty === 0 && (
            <p className="text-center text-xs text-amber-600 font-medium mt-2">Box is full — remove an item first</p>
          )}
        </div>
      </motion.div>

      {/* Pinch zoom overlay */}
      {isPinching && pinchRect && (
        <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div style={{
            position: "absolute", left: pinchRect.left, top: pinchRect.top,
            width: pinchRect.width, height: pinchRect.height,
            transformOrigin: `${pinchOrigin.x - pinchRect.left}px ${pinchOrigin.y - pinchRect.top}px`,
            transform: `translate(${pinchPan.x}px, ${pinchPan.y}px) scale(${pinchZoom})`,
            overflow: "hidden", willChange: "transform",
          }}>
            <img src={images[activeImg]} alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }} />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── PinchOverlay ─────────────────────────────────────────────
function PinchOverlay({ src, alt, pinchRect, pinchOrigin, pinchPan, pinchZoom, contain }: {
  src: string; alt: string; pinchRect: DOMRect;
  pinchOrigin: { x: number; y: number }; pinchPan: { x: number; y: number };
  pinchZoom: number; contain?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div style={{
        position: "absolute",
        left: pinchRect.left, top: pinchRect.top,
        width: pinchRect.width, height: pinchRect.height,
        transformOrigin: `${pinchOrigin.x - pinchRect.left}px ${pinchOrigin.y - pinchRect.top}px`,
        transform: `translate(${pinchPan.x}px, ${pinchPan.y}px) scale(${pinchZoom})`,
        overflow: "hidden", willChange: "transform",
      }}>
        <img src={src} alt={alt}
          style={{ width: "100%", height: "100%", objectFit: contain ? "contain" : "cover", objectPosition: "center", display: "block" }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ComboBuilderPage
// ═══════════════════════════════════════════════════════════════
export function ComboBuilderPage({ comboId }: { comboId: string }) {
  const [, navigate]                      = useLocation();
  const { products }                      = useProducts();
  const { addComboToCart, setIsCartOpen } = useCart();

  const [box,      setBox]      = useState<ComboBox | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [added,    setAdded]    = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [selection, setSelection] = useState<Record<SelectionKey, SelectionEntry>>({});
  const [variantPickFor, setVariantPickFor] = useState<number | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // ── Load box ──────────────────────────────────────────────
  useEffect(() => {
    const id = parseInt(comboId, 10);
    if (isNaN(id)) { setNotFound(true); setLoading(false); return; }
    supabase.from("combo_boxes").select("*").eq("id", id).eq("is_active", true).maybeSingle()
      .then(({ data }) => {
        if (!data) { setNotFound(true); setLoading(false); return; }
        setBox(data as ComboBox); setLoading(false);
      });
  }, [comboId]);

  // ── Eligible products ──────────────────────────────────────
  const eligible = useMemo(() => {
    if (!box) return [];
    return products.filter(
      (p) => p.wholesale_price > 0 &&
             p.wholesale_price >= box.wholesale_min &&
             p.wholesale_price <= box.wholesale_max,
    );
  }, [products, box]);

  // ── Derived ─────────────────────────────────────────────────
  const totalSelected   = Object.values(selection).reduce((s, e) => s + e.qty, 0);
  const allFilled       = box ? totalSelected === box.item_count : false;
  const overFilled      = box ? totalSelected > box.item_count : false;
  const remaining       = box ? box.item_count - totalSelected : 0;

  // Live retail value of selected items
  const selectedRetailValue = Object.values(selection).reduce((s, e) => {
    const price = e.variant?.price ?? e.product.price;
    return s + price * e.qty;
  }, 0);
  const boxPrice = box?.box_price ?? 0;
  // Saving = retail of chosen items vs box price (only meaningful when filled)
  const currentSaving     = selectedRetailValue > boxPrice ? selectedRetailValue - boxPrice : 0;
  const currentSavingPct  = selectedRetailValue > 0
    ? Math.round((currentSaving / selectedRetailValue) * 100) : 0;
  // Per-item avg in box
  const perItemBoxPrice = box ? Math.round(boxPrice / box.item_count) : 0;

  // ── Adjust qty ─────────────────────────────────────────────
  const adjustQty = (product: Product, variant: ProductVariant | undefined, delta: number) => {
    if (!box) return;
    const key   = makeKey(product.id, variant?.id);
    const cur   = selection[key]?.qty ?? 0;
    const next  = cur + delta;
    const stock = variant ? variant.stock : product.stock;
    if (next <= 0) {
      setSelection((prev) => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    if (next > stock) return;
    if (totalSelected + delta > box.item_count) return;
    setSelection((prev) => ({ ...prev, [key]: { product, variant, qty: next } }));
  };

  const handleAdd   = (product: Product, variant?: ProductVariant) => adjustQty(product, variant, 1);
  const handleMinus = (product: Product, variant?: ProductVariant) => adjustQty(product, variant, -1);

  // ── Add to cart ───────────────────────────────────────────
  const handleAddToCart = () => {
    if (!box || !allFilled) return;
    const comboSlots: ComboBoxSlot[] = Object.values(selection).flatMap((entry) =>
      Array.from({ length: entry.qty }, () => ({
        product:      entry.product,
        variantId:    entry.variant?.id    ?? null,
        variantLabel: entry.variant?.label ?? null,
        variantImage: entry.variant?.images?.[0] ?? entry.product.image,
      }))
    );
    addComboToCart({
      comboBoxId:     box.id,
      comboBoxName:   box.name,
      comboBoxPrice:  box.box_price,
      shippingCredit: box.shipping_credit ?? 0,
      slots:          comboSlots,
      coverImage:     box.box_image_url ?? comboSlots[0]?.product.image ?? "",
    });
    setAdded(true);
    setTimeout(() => { setIsCartOpen(true); navigate("/"); }, 800);
  };

  // ── Loading / not found ───────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading box…</span>
      </div>
    </div>
  );
  if (notFound || !box) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-50">
      <Package2 className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 font-medium">Box not found or no longer available.</p>
      <button onClick={() => navigate("/combo")}
        className="px-4 py-2 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl">
        Back to All Boxes
      </button>
    </div>
  );

  const gridClass = viewMode === "list"
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5"
    : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4";

  // Shipping nudge: internal flag only — not shown to user
  const hasShippingCredit = (box.shipping_credit ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-44">

      {/* ── Sticky header ── */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30 px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto h-14 flex items-center gap-3">
          <button onClick={() => navigate("/combo")}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-800 truncate">{box.name}</h1>
            <p className="text-[11px] text-gray-400">
              Pick any {box.item_count} · ₹{perItemBoxPrice}/item · ₹{box.box_price} total
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-[#F3EEFB] rounded-full p-1 shrink-0">
            <button onClick={() => setViewMode("grid")} aria-label="Grid view"
              className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === "grid" ? "bg-[#9B6FD1] text-white shadow" : "text-gray-400 hover:text-[#9B6FD1]"}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode("list")} aria-label="List view"
              className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === "list" ? "bg-[#9B6FD1] text-white shadow" : "text-gray-400 hover:text-[#9B6FD1]"}`}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Count badge */}
          <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
            allFilled ? "bg-[#9B6FD1] text-white" : overFilled ? "bg-red-100 text-red-600" : "bg-[#F3EEFB] text-[#9B6FD1]"
          }`}>
            <ShoppingBag className="w-3.5 h-3.5" />
            {totalSelected}/{box.item_count}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className={`h-full transition-all duration-300 ${overFilled ? "bg-red-400" : "bg-[#9B6FD1]"}`}
          style={{ width: `${Math.min(100, (totalSelected / box.item_count) * 100)}%` }} />
      </div>

      {/* ── Shipping nudge banner removed — credit applies silently ── */}

      {/* ── Selected strip — sticky below header ── */}
      <AnimatePresence>
        {totalSelected > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="sticky top-[3.5rem] z-20 bg-white/95 backdrop-blur-sm border-b border-[#9B6FD1]/20 shadow-sm"
          >
            <div className="max-w-5xl mx-auto px-4 pt-1 pb-2 flex items-center gap-3">
              {/* Thumbnail row */}
              <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none flex-1 min-w-0 py-2 px-1">
                {Array.from({ length: box!.item_count }).map((_, i) => {
                  const entries = Object.values(selection);
                  const entry   = entries[i];
                  return (
                    <div key={i} className="relative shrink-0 w-11 h-11">
                      {entry ? (
                        <>
                          <motion.img
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 22 }}
                            src={imgUrl(entry.variant?.images?.[0] ?? entry.product.image, "full")}
                            alt={entry.product.name}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-[#9B6FD1] shadow-sm"
                          />
                          {entry.qty > 1 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#9B6FD1] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow z-10 leading-none">
                              {entry.qty}
                            </span>
                          )}
                          <button
                            onClick={() => adjustQty(entry.product, entry.variant, -entry.qty)}
                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-red-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow z-10 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-11 h-11 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-gray-300">{i + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live savings pill — animates as user selects */}
              <AnimatePresence mode="wait">
                {currentSaving > 0 ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                    className="shrink-0 flex flex-col items-end gap-0.5"
                  >
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />
                      Save ₹{currentSaving}
                    </span>
                    <span className="text-[9px] text-gray-400">{currentSavingPct}% off retail</span>
                  </motion.div>
                ) : (
                  <motion.span
                    key="status"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`shrink-0 text-xs font-bold pb-1 ${
                      allFilled ? "text-emerald-600" : remaining > 0 ? "text-[#9B6FD1]" : "text-red-500"
                    }`}>
                    {allFilled ? "✓ All set!" : remaining > 0 ? `${remaining} left` : "Too many"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product grid ── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4">
        {eligible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Package2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No products available for this box yet.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={viewMode}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className={gridClass}>
              {eligible.map((product) => {
                const productQtyTotal = Object.entries(selection)
                  .filter(([k]) => k === String(product.id) || k.startsWith(`${product.id}__`))
                  .reduce((s, [, e]) => s + e.qty, 0);
                const simpleKey = makeKey(product.id);
                const selEntry  = selection[simpleKey];
                const canAdd    = remaining > 0 && (box.allow_duplicates || productQtyTotal === 0);

                return (
                  <ComboProductCard
                    key={product.id}
                    product={product}
                    view={viewMode}
                    selEntry={selEntry}
                    canAdd={canAdd}
                    boxPrice={box.box_price}
                    itemCount={box.item_count}
                    onAdd={handleAdd}
                    onMinus={handleMinus}
                    onViewDetail={setDetailProduct}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Product detail overlay ── */}
      <AnimatePresence>
        {detailProduct && (
          <ComboProductDetailOverlay
            product={detailProduct}
            selection={selection}
            remaining={remaining}
            allowDuplicates={box.allow_duplicates}
            onAdd={handleAdd}
            onMinus={handleMinus}
            onClose={() => setDetailProduct(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-100 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-4">

          {/* ── Smart pricing panel ── */}
          <AnimatePresence>
            {totalSelected > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-3"
              >
                <div className="grid grid-cols-3 gap-2 text-center">
                  {/* Box price */}
                  <div className="bg-[#F3EEFB] rounded-xl px-2 py-2">
                    <p className="text-[10px] text-[#9B6FD1] font-semibold leading-none">Box Price</p>
                    <p className="text-sm font-bold text-[#9B6FD1] mt-0.5">₹{box.box_price}</p>
                  </div>
                  {/* Retail value of chosen items */}
                  <div className={`rounded-xl px-2 py-2 ${selectedRetailValue > 0 ? "bg-gray-50" : "bg-gray-50 opacity-50"}`}>
                    <p className="text-[10px] text-gray-500 font-semibold leading-none">Retail Value</p>
                    <p className="text-sm font-bold text-gray-700 mt-0.5">
                      {selectedRetailValue > 0 ? `₹${selectedRetailValue}` : "—"}
                    </p>
                  </div>
                  {/* Savings */}
                  <div className={`rounded-xl px-2 py-2 transition-colors ${currentSaving > 0 ? "bg-emerald-50" : "bg-gray-50 opacity-50"}`}>
                    <p className={`text-[10px] font-semibold leading-none ${currentSaving > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                      You Save
                    </p>
                    <motion.p
                      key={currentSaving}
                      initial={{ scale: 0.85 }} animate={{ scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`text-sm font-bold mt-0.5 ${currentSaving > 0 ? "text-emerald-600" : "text-gray-400"}`}
                    >
                      {currentSaving > 0 ? `₹${currentSaving}` : "—"}
                    </motion.p>
                  </div>
                </div>

                {/* Shipping credit applies silently — no user-facing nudge */}

                {/* Completed: show savings summary */}
                {allFilled && currentSaving > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Great pick! You're saving <span className="font-bold">₹{currentSaving} ({currentSavingPct}% off)</span> vs buying individually.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main footer row ── */}
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  {allFilled ? "Ready to add to cart!"
                    : overFilled ? `Remove ${totalSelected - box.item_count} item${totalSelected - box.item_count > 1 ? "s" : ""}`
                    : totalSelected === 0 ? `Pick ${box.item_count} items · ₹${perItemBoxPrice}/item`
                    : `${remaining} more item${remaining !== 1 ? "s" : ""} to go`}
                </span>
                <span className="text-sm font-bold text-[#9B6FD1] shrink-0 ml-2">₹{box.box_price}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${overFilled ? "bg-red-400" : "bg-[#9B6FD1]"}`}
                  animate={{ width: `${Math.min(100, (totalSelected / box.item_count) * 100)}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>
            <button onClick={handleAddToCart} disabled={!allFilled || added}
              className={`shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-md ${
                allFilled && !added ? "bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white shadow-purple-200"
                : added ? "bg-emerald-500 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}>
              {added ? <><CheckCircle2 className="w-4 h-4" /> Added!</> : <><ShoppingBag className="w-4 h-4" /> Add to Cart</>}
            </button>
          </div>
        </div>
      </div>

      {/* suppress unused var warning for variantPickFor */}
      {variantPickFor !== null && null}
    </div>
  );
}
