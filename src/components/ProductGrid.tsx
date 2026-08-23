import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, ArrowUpDown, Check, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useCategories } from "../context/CategoriesContext";
import { useScroll } from "../context/ScrollContext";
import { useInfiniteProducts, SortOrder } from "../hooks/useInfiniteProducts";
import { useNewCategories } from "../hooks/useNewCategories";
import { useFestivals } from "../context/FestivalsContext";
import type { Festival } from "../context/FestivalsContext";
import { ProductCard } from "./ProductCard";


type ViewMode = "grid" | "list";

const NAVBAR_H = 56; // px — h-14

// ── Shimmer skeleton ──────────────────────────────────────────
function SkeletonCard({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div className="aspect-square bg-gray-200 shimmer" />
        <div className="p-4 flex flex-col gap-3">
          <div className="h-4 bg-gray-200 shimmer rounded-full w-3/4" />
          <div className="h-4 bg-gray-200 shimmer rounded-full w-1/3" />
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="h-9 bg-gray-200 shimmer rounded-full" />
            <div className="h-9 bg-gray-200 shimmer rounded-full" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="aspect-square bg-gray-200 shimmer" />
      <div className="p-2.5 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 shimmer rounded-full w-4/5" />
        <div className="h-3 bg-gray-200 shimmer rounded-full w-2/5" />
        <div className="h-8 bg-gray-200 shimmer rounded-xl mt-1" />
      </div>
    </div>
  );
}

// ── Spinner shown while loading the next page ─────────────────
function LoadMoreSpinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Festival store carousel ───────────────────────────────────
// Shows 1 card when there's only 1 festival, auto-slides when there are multiple.
const FEST_AUTO_PLAY_MS = 4500;

function FestivalCarousel({ festivals }: { festivals: Festival[] }) {
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDragging  = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const count = festivals.length;

  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  useEffect(() => { setIndex(0); }, [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setInterval(next, FEST_AUTO_PLAY_MS);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, paused, index]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current  = false;
    setDragOffset(0);
    setPaused(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isDragging.current) {
      if (Math.abs(dx) < Math.abs(dy)) return;
      isDragging.current = true;
    }
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0);
    setDragOffset(atEdge ? dx * 0.2 : dx);
  };
  const onTouchEnd = () => {
    if (isDragging.current) {
      if (dragOffset < -50) next();
      else if (dragOffset > 50) prev();
    }
    setDragOffset(0);
    isDragging.current = false;
    touchStartX.current = null;
    setPaused(false);
  };

  return (
    <div
      className="px-3 sm:px-4 py-1.5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-2xl shadow-md select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Sliding strip */}
        <div
          className="flex"
          style={{
            transform:  `translateX(calc(${-index * 100}% + ${dragOffset}px))`,
            transition: dragOffset !== 0 ? "none" : "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)",
            willChange: "transform",
          }}
        >
          {festivals.map((fest) => (
            <a
              key={fest.id}
              href={`/festival/${fest.slug}`}
              className="relative flex-shrink-0 w-full flex items-center justify-between overflow-hidden hover:opacity-95 transition-opacity min-h-[140px] sm:min-h-[220px]"
              style={{ background: fest.banner_bg }}
              aria-label={`Shop ${fest.name}`}
              onClick={(e) => { if (isDragging.current) e.preventDefault(); }}
            >
              {/* Background image — mobile uses banner_url_mobile, desktop uses banner_url */}
              {(fest.banner_url_mobile || fest.banner_url) && (
                <>
                  {/* Mobile image */}
                  <img
                    src={fest.banner_url_mobile || fest.banner_url}
                    alt="" aria-hidden="true" draggable={false}
                    className="absolute inset-0 w-full h-full object-cover opacity-50 sm:hidden"
                  />
                  {/* Desktop image */}
                  <img
                    src={fest.banner_url || fest.banner_url_mobile}
                    alt="" aria-hidden="true" draggable={false}
                    className="absolute inset-0 w-full h-full object-cover opacity-50 hidden sm:block"
                  />
                </>
              )}
              {/* Text */}
              <div className="relative z-10 px-5 py-4 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                    Festival Store
                  </span>
                </div>
                <p className="font-serif font-bold text-white text-lg leading-tight drop-shadow">
                  {fest.name}
                </p>
                {fest.tagline && (
                  <p className="text-white/80 text-xs mt-0.5 leading-snug">{fest.tagline}</p>
                )}
              </div>
              {/* CTA */}
              <div className="relative z-10 pr-4 shrink-0">
                <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-full border border-white/30 backdrop-blur-sm">
                  Shop Now →
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Desktop arrows — only when multiple */}
        {count > 1 && (
          <>
            <button
              onClick={prev}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20
                w-7 h-7 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
              aria-label="Previous festival"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20
                w-7 h-7 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
              aria-label="Next festival"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators — only when multiple */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {festivals.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setPaused(true); setTimeout(() => setPaused(false), FEST_AUTO_PLAY_MS); }}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-5 h-1.5 bg-[#9B6FD1]" : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to ${festivals[i].name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductGrid({ allCategoryImage }: { allCategoryImage?: string | null }) {
  const { categories } = useCategories();
  const { scrollingDown } = useScroll();
  const newCategories = useNewCategories();
  const { activeFestivals } = useFestivals();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [filterBarHeight, setFilterBarHeight] = useState(96);

  // ── Category hierarchy ────────────────────────────────────────
  const parentCats = categories.filter((c) => c.parent_id === null);
  const activeCat = categories.find((c) => c.name === activeCategory) ?? null;

  // The parent to show subcategory chips for:
  // - if active is a parent → show its children
  // - if active is a child → show siblings (parent's children)
  const activeParent = activeCat
    ? activeCat.parent_id === null
      ? activeCat                                                          // it's a parent
      : categories.find((c) => c.id === activeCat.parent_id) ?? null      // it's a child
    : null;

  const activeSubs = activeParent
    ? categories.filter((c) => c.parent_id === activeParent.id)
    : [];

  // The category slug(s) to filter products by.
  // When a parent is selected, include its own slug + all children slugs
  // so products tagged as parent OR any subcategory all show up.
  const filterSlug: string | string[] = (() => {
    if (activeCategory === "all") return "all";
    const cat = categories.find((c) => c.name === activeCategory);
    if (!cat) return activeCategory;
    // If it's a parent category, include children slugs too
    if (cat.parent_id === null) {
      const children = categories.filter((c) => c.parent_id === cat.id);
      if (children.length > 0) return [cat.name, ...children.map((c) => c.name)];
    }
    return activeCategory;
  })();

  // ── Infinite scroll data ──────────────────────────────────────
  const { products, loading, loadingMore, hasMore, error, loadMore } =
    useInfiniteProducts(filterSlug, sortOrder, "");

  // Keep a stable ref to loadMore so the observer callback never goes stale.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  // Callback ref — called by React whenever the sentinel div mounts/unmounts.
  // This avoids the race condition where the observer is set up before the
  // sentinel element exists in the DOM.
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: "0px 0px 300px 0px", threshold: 0 }
    );
    observer.observe(el);
    // Cleanup is handled by the element unmounting (React calls this with null).
  }, []); // empty deps — stable forever, loadMore accessed via ref

  // ── Sort dropdown — close on outside click ────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Measure filter bar height dynamically ─────────────────────
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const update = () => setFilterBarHeight(el.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);

  const gridClass =
    viewMode === "list"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5"
      : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4";

  return (
    <>
      {/* ── Fixed filter + view toggle bar ───────────────────────── */}
      <div
        ref={filterBarRef}
        className="fixed left-0 right-0 z-30 bg-white border-b border-gray-100 shadow-sm transition-transform duration-300 ease-in-out"
        style={{
          top: `${NAVBAR_H}px`,
          transform: scrollingDown
            ? `translateY(-${NAVBAR_H + filterBarHeight}px)`
            : "translateY(0)",
        }}
        data-testid="category-filter-bar"
      >
        <div className="px-3 sm:px-4 py-2">
          {/* Row 1 — Parent category image tiles */}
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-none pt-1 pb-2 pl-2 pr-1"
               style={{ WebkitOverflowScrolling: "touch" }}>
            {/* "All" tile */}
            <button
              data-testid="filter-tab-all"
              onClick={() => { setActiveCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden ${
                activeCategory === "all"
                  ? "shadow-md shadow-purple-200 outline outline-2 outline-[#9B6FD1] outline-offset-2"
                  : "ring-1 ring-gray-200"
              }`}>
                {allCategoryImage
                  ? <img src={allCategoryImage} alt="All" loading="lazy" className="w-10 h-10 object-contain" />
                  : <span className="text-xl">✨</span>
                }
              </div>
              <span className={`text-[11px] font-semibold leading-none ${activeCategory === "all" ? "text-[#9B6FD1]" : "text-gray-500"}`}>
                All
              </span>
            </button>

            {parentCats.map((cat) => {
              const isActive = activeCategory === cat.name || activeParent?.name === cat.name;
              const hasNew = newCategories.has(cat.name);
              return (
                <button
                  key={cat.id}
                  data-testid={`filter-tab-${cat.name}`}
                  onClick={() => { setActiveCategory(cat.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none relative"
                >
                  <div className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-200 flex items-center justify-center ${
                    isActive
                      ? "shadow-md shadow-purple-200 outline outline-2 outline-[#9B6FD1] outline-offset-2"
                      : "ring-1 ring-gray-200"
                  } ${cat.image_url ? "bg-white" : isActive ? "bg-[#9B6FD1]" : "bg-[#F3EEFB]"}`}>
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.label}
                        loading="lazy"
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <span className="text-xl">💎</span>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold leading-none w-16 text-center ${
                    isActive ? "text-[#9B6FD1]" : "text-gray-500"
                  }`} style={{ wordBreak: "break-word", whiteSpace: "normal", lineHeight: "1.2" }}>
                    {cat.label}
                  </span>
                  {hasNew && (
                    <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Row 1b — Subcategory chips (animated, only when parent selected) */}
          <AnimatePresence>
            {activeSubs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 pt-0.5 px-1">
                  {/* "All" sub-chip */}
                  <button
                    onClick={() => {
                      const parent = categories.find((c) => activeSubs[0] && c.id === activeSubs[0].parent_id);
                      if (parent) { setActiveCategory(parent.name); window.scrollTo({ top: 0, behavior: "smooth" }); }
                    }}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      activeSubs.every((s) => s.name !== activeCategory)
                        ? "bg-[#9B6FD1] text-white border-[#9B6FD1] shadow-sm"
                        : "bg-white text-gray-500 border-gray-200 hover:border-[#9B6FD1]/40 hover:text-[#9B6FD1]"
                    }`}
                  >
                    All
                  </button>
                  {activeSubs.map((sub) => {
                    const isSubActive = activeCategory === sub.name;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => { setActiveCategory(sub.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          isSubActive
                            ? "bg-[#9B6FD1] text-white border-[#9B6FD1] shadow-sm"
                            : "bg-white text-gray-500 border-gray-200 hover:border-[#9B6FD1]/40 hover:text-[#9B6FD1]"
                        }`}
                      >
                        {sub.label}
                        {newCategories.has(sub.name) && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Row 2 — Sort + product count + View toggle */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setSortOpen((o) => !o)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    sortOrder !== "default"
                      ? "bg-[#9B6FD1] text-white shadow-md"
                      : "bg-[#F3EEFB] text-gray-600 hover:text-[#9B6FD1]"
                  }`}
                  aria-label="Sort by price"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {sortOrder === "low-high"
                      ? "Low → High"
                      : sortOrder === "high-low"
                      ? "High → Low"
                      : "Sort"}
                  </span>
                </button>

                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                    >
                      {(["default", "low-high", "high-low"] as SortOrder[]).map((opt) => {
                        const labels = {
                          default: "Default",
                          "low-high": "Price: Low to High",
                          "high-low": "Price: High to Low",
                        };
                        return (
                          <button
                            key={opt}
                            onClick={() => { setSortOrder(opt); setSortOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              sortOrder === opt ? "text-[#9B6FD1] font-semibold bg-[#F3EEFB]" : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {labels[opt]}
                            {sortOrder === opt && <Check className="w-3.5 h-3.5 text-[#9B6FD1]" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Product count */}
              {!loading && products.length > 0 && (
                <span className="text-xs text-gray-400 font-medium hidden sm:block">
                  {products.length} products
                </span>
              )}
            </div>

            {/* View toggle — mobile only */}
            <div className="flex items-center gap-1 bg-[#F3EEFB] rounded-full p-1 shrink-0 sm:hidden">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === "grid" ? "bg-[#9B6FD1] text-white shadow" : "text-gray-400 hover:text-[#9B6FD1]"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === "list" ? "bg-[#9B6FD1] text-white shadow" : "text-gray-400 hover:text-[#9B6FD1]"}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main section ──────────────────────────────────────────── */}
      <section id="shop" className="bg-gray-50/50 pb-20" style={{ paddingTop: filterBarHeight + 8 }}>

        {/* ── Festival store carousel ───────────────────────────── */}
        {activeFestivals.length > 0 && (
          <FestivalCarousel festivals={activeFestivals} />
        )}

        <div className="px-3 sm:px-4 pt-1.5">
          {loading && (
            <div className={gridClass}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} view={viewMode} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-red-400 text-sm font-medium">
                Failed to load products
              </p>
              <p className="text-gray-400 text-xs mt-1">{error}</p>
              <p className="text-gray-400 text-xs mt-2">
                Make sure the <strong>products</strong> table exists in Supabase
                and RLS SELECT policy allows anon reads.
              </p>
            </div>
          )}

          {/* Products grid */}
          {!loading && !error && (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeCategory}-${viewMode}-${sortOrder}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className={gridClass}
                >
                  {products.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      index={index}
                      view={viewMode === "list" ? "list" : "grid"}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {products.length === 0 && (
                <p className="text-center text-gray-400 py-16">
                  No products in this category yet.
                </p>
              )}

              {/* Spinner while next page loads */}
              {loadingMore && <LoadMoreSpinner />}

              {/* End-of-list message */}
              {!hasMore && products.length > 0 && (
                <p className="text-center text-xs text-gray-300 py-6 tracking-wide">
                  You've seen all products
                </p>
              )}

              {/* Sentinel — callback ref so observer attaches the moment this mounts */}
              {hasMore && !loadingMore && (
                <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
