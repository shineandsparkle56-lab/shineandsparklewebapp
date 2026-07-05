import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, ArrowUpDown, Check } from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { useCategories } from "../context/CategoriesContext";
import { useScroll } from "../context/ScrollContext";
import { ProductCard } from "./ProductCard";

type ViewMode = "grid" | "list";
type SortOrder = "default" | "low-high" | "high-low";

// Navbar is h-20 (80px). Filter bar is ~48px. Total reserved = 128px.
// We use CSS vars so the section padding always matches.
const NAVBAR_H = 56;   // px — matches h-14 in Navbar
const FILTER_H = 52;   // px — filter bar height including py
const TOTAL_OFFSET = NAVBAR_H + FILTER_H; // 132px

export function ProductGrid() {
  const { products, loading, error } = useProducts();
  const { categories } = useCategories();
  const { scrollingDown } = useScroll();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
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

  const filtered = activeCategory === "all"
    ? products
    : products.filter((p) => p.category === activeCategory);

  const sorted = sortOrder === "low-high"
    ? [...filtered].sort((a, b) => a.price - b.price)
    : sortOrder === "high-low"
    ? [...filtered].sort((a, b) => b.price - a.price)
    : filtered;

  return (
    <>
      {/* ── Fixed filter + view toggle bar ─────────────────────────────
          Sits directly below the fixed navbar (top-20 = 80px).
          Hides together with the navbar when scrollingDown.
          Uses -translate-y-[152px] = navbar(80) + filter(52) + border(~20)
          so it exits the screen completely as a unit with the navbar.
      ── */}
      <div
        className={`fixed left-0 right-0 z-30 bg-white border-b border-gray-100 shadow-sm transition-transform duration-300 ease-in-out ${
          scrollingDown ? "-translate-y-[128px]" : "translate-y-0"
        }`}
        style={{ top: `${NAVBAR_H}px` }}
        data-testid="category-filter-bar"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* ── Category chips — horizontal scroll, no wrap ── */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`filter-tab-${tab.id}`}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`relative flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 focus:outline-none ${
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
              ))}
            </div>

            {/* ── Sort dropdown ── */}
            <div className="relative shrink-0" ref={sortRef}>
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
                <span className="hidden sm:inline">
                  {sortOrder === "low-high" ? "Low to High" : sortOrder === "high-low" ? "High to Low" : "Sort"}
                </span>
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {(["default", "low-high", "high-low"] as SortOrder[]).map((opt) => {
                      const labels = { default: "Default", "low-high": "Price: Low to High", "high-low": "Price: High to Low" };
                      return (
                        <button
                          key={opt}
                          onClick={() => { setSortOrder(opt); setSortOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                            sortOrder === opt
                              ? "text-[#9B6FD1] font-semibold bg-[#F3EEFB]"
                              : "text-gray-600 hover:bg-gray-50"
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

            {/* ── View toggle — mobile only ── */}
            <div className="flex sm:hidden items-center gap-1 bg-[#F3EEFB] rounded-full p-1 shrink-0">
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

      {/* ── Main section ────────────────────────────────────────────────
          Top padding = navbar + filter bar height so content starts
          below both fixed bars even when they're visible.
      ── */}
      <section
        id="shop"
        className="bg-white pb-20"
        style={{ paddingTop: `${TOTAL_OFFSET + 16}px` }}
      >
        <div className="container mx-auto px-4">

          {/* Loading */}
          {loading && (
            <div className="flex justify-center items-center py-24">
              <div className="w-8 h-8 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-red-400 text-sm font-medium">Failed to load products</p>
              <p className="text-gray-400 text-xs mt-1">{error}</p>
              <p className="text-gray-400 text-xs mt-2">
                Make sure the <strong>products</strong> table exists in Supabase and RLS SELECT policy allows anon reads.
              </p>
            </div>
          )}

          {/* Products */}
          {!loading && !error && (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeCategory}-${viewMode}-${sortOrder}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className={
                    // On desktop (sm+) always grid — toggle only applies on mobile
                    viewMode === "list"
                      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4"
                      : "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4"
                  }
                >
                  {sorted.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      index={index}
                      view={viewMode === "list" ? "list" : "grid"}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {sorted.length === 0 && (
                <p className="text-center text-gray-400 py-16">
                  No products in this category yet.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
