import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, ArrowUpDown, Check } from "lucide-react";
import { useCategories } from "../context/CategoriesContext";
import { useScroll } from "../context/ScrollContext";
import { useInfiniteProducts, SortOrder } from "../hooks/useInfiniteProducts";
import { useNewCategories } from "../hooks/useNewCategories";
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

export function ProductGrid() {
  const { categories } = useCategories();
  const { scrollingDown } = useScroll();
  const newCategories = useNewCategories();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // ── Infinite scroll data ──────────────────────────────────────
  const { products, loading, loadingMore, hasMore, error, loadMore } =
    useInfiniteProducts(activeCategory, sortOrder);

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

  const tabs = [
    { id: "all", label: "All" },
    ...categories.map((c) => ({ id: c.name, label: c.label })),
  ];

  const gridClass =
    viewMode === "list"
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4"
      : "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4";

  return (
    <>
      {/* ── Fixed filter + view toggle bar ───────────────────────── */}
      <div
        className="fixed left-0 right-0 z-30 bg-white border-b border-gray-100 shadow-sm transition-transform duration-300 ease-in-out"
        style={{
          top: `${NAVBAR_H}px`,
          transform: scrollingDown
            ? `translateY(-${NAVBAR_H + 96}px)`
            : "translateY(0)",
        }}
        data-testid="category-filter-bar"
      >
        <div className="container mx-auto px-4 py-2">
          {/* Row 1 — Category chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none mb-2">
            {tabs.map((tab) => (
              <div key={tab.id} className="relative flex-shrink-0 pt-1 pr-1">
                <button
                  data-testid={`filter-tab-${tab.id}`}
                  onClick={() => {
                    setActiveCategory(tab.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 focus:outline-none ${
                    activeCategory === tab.id
                      ? "text-white shadow-md"
                      : "text-gray-500 bg-[#F3EEFB] hover:text-[#9B6FD1]"
                  }`}
                >
                  {activeCategory === tab.id && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute inset-0 rounded-full bg-[#9B6FD1]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {tab.label}
                </button>
                {newCategories.has(tab.id) && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white pointer-events-none" />
                )}
              </div>
            ))}
          </div>

          {/* Row 2 — Sort + View toggle */}
          <div className="flex items-center justify-between gap-2">
            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  sortOrder !== "default"
                    ? "bg-[#9B6FD1] text-white shadow-md"
                    : "bg-[#F3EEFB] text-gray-600 hover:text-[#9B6FD1]"
                }`}
                aria-label="Sort by price"
              >
                <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {sortOrder === "low-high"
                    ? "Low to High"
                    : sortOrder === "high-low"
                    ? "High to Low"
                    : "Sort by Price"}
                </span>
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {(["default", "low-high", "high-low"] as SortOrder[]).map(
                      (opt) => {
                        const labels = {
                          default: "Default",
                          "low-high": "Price: Low to High",
                          "high-low": "Price: High to Low",
                        };
                        return (
                          <button
                            key={opt}
                            onClick={() => {
                              setSortOrder(opt);
                              setSortOpen(false);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              sortOrder === opt
                                ? "text-[#9B6FD1] font-semibold bg-[#F3EEFB]"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {labels[opt]}
                            {sortOrder === opt && (
                              <Check className="w-3.5 h-3.5 text-[#9B6FD1]" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View toggle — mobile only */}
            <div className="flex items-center gap-1 bg-[#F3EEFB] rounded-full p-1 shrink-0 sm:hidden">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-2 rounded-full transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-[#9B6FD1] text-white shadow"
                    : "text-gray-400 hover:text-[#9B6FD1]"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-2 rounded-full transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-[#9B6FD1] text-white shadow"
                    : "text-gray-400 hover:text-[#9B6FD1]"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main section ──────────────────────────────────────────── */}
      <section id="shop" className="bg-white pb-20 pt-[120px]">
        <div className="container mx-auto px-4">

          {/* First-page skeleton */}
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
