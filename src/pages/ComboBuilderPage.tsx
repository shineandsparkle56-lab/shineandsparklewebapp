/**
 * ComboBuilderPage — /combo/:id
 *
 * Full product grid (same as main store) with:
 *  - Grid / List view toggle
 *  - Sliding image carousel (touch swipe + arrows + dots)
 *  - Pinch-zoom overlay (identical to ProductCard)
 *  - Qty +/- per product/variant, capped at available stock
 *  - Total count badge vs box.item_count
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Package2, CheckCircle2, Loader2, X,
  ShoppingBag, Minus, Plus, LayoutGrid, List,
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
// Same image carousel / pinch zoom as ProductCard, with combo-specific footer
interface ComboProductCardProps {
  product:    Product;
  view:       ViewMode;
  selEntry?:  SelectionEntry;
  canAdd:     boolean;
  onAdd:      (product: Product, variant?: ProductVariant) => void;
  onMinus:    (product: Product, variant?: ProductVariant) => void;
  onPickColor:(productId: number) => void;
}

function ComboProductCard({ product, view, selEntry, canAdd, onAdd, onMinus, onPickColor }: ComboProductCardProps) {
  const [imgIndex,   setImgIndex]   = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
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

  const qty = selEntry?.qty ?? 0;
  const isNew = !!product.created_at &&
    (Date.now() - new Date(product.created_at).getTime()) < 3 * 24 * 60 * 60 * 1000;

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
        <div className={`flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border transition-all ${
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
            {qty > 0 && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-[#9B6FD1] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow whitespace-nowrap">{qty} in box</div>}
            {noStock && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full">Out of Stock</span></div>}
          </div>
          {/* Info + controls */}
          <div className="p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-serif text-gray-900 text-base leading-snug">{product.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-gray-900">₹{product.price}</span>
                {product.originalPrice > product.price && <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>}
              </div>
              {hasVariants && <p className="text-[10px] text-[#9B6FD1] font-semibold mt-0.5">{product.variants.length} colors available</p>}
            </div>
            <ComboCardControls product={product} qty={qty} canAdd={canAdd} noStock={noStock}
              hasVariants={hasVariants} onAdd={onAdd} onMinus={onMinus} onPickColor={onPickColor} />
          </div>
        </div>
        {/* Pinch zoom overlay */}
        {isPinching && pinchRect && <PinchOverlay src={images[imgIndex]} alt={product.name}
          pinchRect={pinchRect} pinchOrigin={pinchOrigin} pinchPan={pinchPan} pinchZoom={pinchZoom} contain />}
      </>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────
  return (
    <>
      <div className={`flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-200 ${
        qty > 0 ? "border-[#9B6FD1]/40 ring-1 ring-[#9B6FD1]/20" : noStock ? "border-gray-100 opacity-60" : "border-gray-100 hover:shadow-md hover:border-[#9B6FD1]/30"
      }`}>
        {/* Image */}
        <div ref={containerRef}
          className="relative w-full aspect-square overflow-hidden bg-gray-50 select-none"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {/* Sliding strip */}
          <div className="absolute inset-0 flex" style={stripStyle}>
            {images.map((src, i) => (
              <div key={src} className="relative flex-shrink-0 w-full h-full">
                <img src={src} alt={`${product.name} ${i + 1}`} draggable={false}
                  className="absolute inset-0 w-full h-full object-cover object-center" />
              </div>
            ))}
          </div>
          {/* Desktop arrows */}
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
          {/* Badges */}
          {product.discount > 0 && <div className="absolute top-2 left-2 z-10 bg-[#9B6FD1] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase pointer-events-none">{product.discount}% OFF</div>}
          {isNew && <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase pointer-events-none">New</div>}
          {qty > 0 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-[#9B6FD1] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow whitespace-nowrap">
              {qty} in box
            </div>
          )}
          {noStock && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="bg-black/70 text-white text-[9px] font-bold px-2.5 py-1 rounded-full">Out of Stock</span></div>}
        </div>
        {/* Info + controls */}
        <div className="p-2.5 flex flex-col gap-2 flex-1">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && <span className="text-[10px] text-gray-400 line-through">₹{product.originalPrice}</span>}
            </div>
            {hasVariants && <p className="text-[10px] text-[#9B6FD1] font-semibold mt-0.5">{product.variants.length} colors</p>}
          </div>
          <ComboCardControls product={product} qty={qty} canAdd={canAdd} noStock={noStock}
            hasVariants={hasVariants} onAdd={onAdd} onMinus={onMinus} onPickColor={onPickColor} />
        </div>
      </div>
      {/* Pinch zoom overlay */}
      {isPinching && pinchRect && <PinchOverlay src={images[imgIndex]} alt={product.name}
        pinchRect={pinchRect} pinchOrigin={pinchOrigin} pinchPan={pinchPan} pinchZoom={pinchZoom} />}
    </>
  );
}

// ─── ComboCardControls ────────────────────────────────────────
function ComboCardControls({ product, qty, canAdd, noStock, hasVariants, onAdd, onMinus, onPickColor }: {
  product: Product; qty: number; canAdd: boolean; noStock: boolean;
  hasVariants: boolean; onAdd: (p: Product, v?: ProductVariant) => void;
  onMinus: (p: Product, v?: ProductVariant) => void; onPickColor: (id: number) => void;
}) {
  if (hasVariants) {
    return (
      <button onClick={() => !noStock && onPickColor(product.id)}
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

  // selection: key → { product, variant?, qty }
  const [selection, setSelection] = useState<Record<SelectionKey, SelectionEntry>>({});

  // Variant picker bottom sheet
  const [variantPickFor, setVariantPickFor] = useState<number | null>(null);

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
  const totalSelected = Object.values(selection).reduce((s, e) => s + e.qty, 0);
  const allFilled     = box ? totalSelected === box.item_count : false;
  const overFilled    = box ? totalSelected > box.item_count : false;
  const remaining     = box ? box.item_count - totalSelected : 0;

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

  const variantPickProduct = variantPickFor !== null
    ? eligible.find((p) => p.id === variantPickFor) ?? null
    : null;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-36">

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
            <p className="text-[11px] text-gray-400">Pick any {box.item_count} items · ₹{box.box_price}</p>
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

      {/* ── Selected strip — sticky below header ── */}
      <AnimatePresence>
        {totalSelected > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="sticky top-[3.5rem] z-20 bg-white/95 backdrop-blur-sm border-b border-[#9B6FD1]/20 shadow-sm"
          >
            <div className="max-w-5xl mx-auto px-4 pt-1 pb-3 flex items-center gap-3">
              {/* Thumbnail row — py/px give room for badges that overflow the thumbnails */}
              <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none flex-1 min-w-0 py-2 px-1">
                {Array.from({ length: box!.item_count }).map((_, i) => {
                  const entries = Object.values(selection);
                  const entry   = entries[i];
                  return (
                    <div key={i} className="relative shrink-0 w-12 h-12">
                      {entry ? (
                        <>
                          <img
                            src={imgUrl(entry.variant?.images?.[0] ?? entry.product.image, "full")}
                            alt={entry.product.name}
                            className="w-12 h-12 rounded-xl object-cover border-2 border-[#9B6FD1] shadow-sm"
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
                        <div className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-gray-300">{i + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status label */}
              <span className={`shrink-0 text-xs font-bold pb-1 ${
                allFilled ? "text-emerald-600" : remaining > 0 ? "text-[#9B6FD1]" : "text-red-500"
              }`}>
                {allFilled ? "✓ All set!" : remaining > 0 ? `${remaining} left` : "Too many"}
              </span>
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
                    onAdd={handleAdd}
                    onMinus={handleMinus}
                    onPickColor={setVariantPickFor}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Variant picker bottom sheet ── */}
      <AnimatePresence>
        {variantPickProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40" onClick={() => setVariantPickFor(null)}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-800">{variantPickProduct.name}</p>
                  <p className="text-xs text-gray-400">Choose a color / style · {remaining > 0 ? `${remaining} slot${remaining !== 1 ? "s" : ""} left` : "Box full"}</p>
                </div>
                <button onClick={() => setVariantPickFor(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {variantPickProduct.variants.map((v) => {
                  const key        = makeKey(variantPickProduct.id, v.id);
                  const vQty       = selection[key]?.qty ?? 0;
                  const outOfStock = v.stock <= 0;
                  const atMax      = vQty >= v.stock || (!box.allow_duplicates && vQty > 0);
                  const cantAdd    = remaining === 0 && vQty === 0;
                  return (
                    <div key={v.id}
                      className={`relative rounded-2xl border overflow-hidden transition-all ${
                        outOfStock ? "border-gray-100 opacity-40"
                        : vQty > 0 ? "border-[#9B6FD1] ring-1 ring-[#9B6FD1]/20"
                        : "border-gray-100 hover:border-[#9B6FD1]/60"
                      }`}>
                      <div className="aspect-square bg-gray-50">
                        {v.images?.[0] ? (
                          <img src={imgUrl(v.images[0], "full")} alt={v.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="w-10 h-10 rounded-full border-2 border-white shadow"
                              style={{ backgroundColor: v.color ?? "#e5e7eb" }} />
                          </div>
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                            <span className="text-[10px] font-bold text-gray-500">Out of stock</span>
                          </div>
                        )}
                        {vQty > 0 && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#9B6FD1] rounded-full flex items-center justify-center shadow">
                            <span className="text-white text-[9px] font-black">{vQty}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-700 truncate">{v.label}</p>
                        {!outOfStock && (
                          vQty === 0 ? (
                            <button
                              onClick={() => !cantAdd && handleAdd(variantPickProduct, v)}
                              disabled={cantAdd}
                              className={`mt-1 w-full py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                cantAdd ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-[#F3EEFB] text-[#9B6FD1] hover:bg-[#9B6FD1] hover:text-white"
                              }`}>
                              + Add
                            </button>
                          ) : (
                            <div className="mt-1 flex items-center justify-between bg-[#F3EEFB] rounded-lg px-1.5 py-0.5">
                              <button onClick={() => handleMinus(variantPickProduct, v)}
                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1]">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold text-[#9B6FD1]">{vQty}</span>
                              <button onClick={() => !atMax && remaining > 0 && handleAdd(variantPickProduct, v)}
                                disabled={atMax || remaining === 0}
                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white text-[#9B6FD1] disabled:opacity-30 disabled:cursor-not-allowed">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setVariantPickFor(null)}
                className="mt-4 w-full py-3 bg-[#9B6FD1] text-white font-semibold rounded-2xl">
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                {allFilled ? "All items selected — ready to add!"
                  : overFilled ? `Remove ${totalSelected - box.item_count} item${totalSelected - box.item_count > 1 ? "s" : ""}`
                  : `${remaining} more item${remaining !== 1 ? "s" : ""} to go`}
              </span>
              <span className="text-sm font-bold text-[#9B6FD1] shrink-0 ml-2">₹{box.box_price}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${overFilled ? "bg-red-400" : "bg-[#9B6FD1]"}`}
                style={{ width: `${Math.min(100, (totalSelected / box.item_count) * 100)}%` }} />
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
  );
}
