import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List } from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { ProductCard } from "./ProductCard";

type Category = "all" | "rings" | "earrings" | "necklaces" | "bracelets";
type ViewMode = "grid" | "list";

const TABS: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "rings", label: "Rings" },
  { id: "earrings", label: "Earrings" },
  { id: "necklaces", label: "Necklaces" },
  { id: "bracelets", label: "Bracelets" },
];

export function ProductGrid() {
  const { products, loading, error } = useProducts();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filtered =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <section id="shop" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-4">
            Our Collection
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Explore our handcrafted pieces, designed with love and intention to
            bring a touch of elegance to your everyday life.
          </p>
        </div>

        {/* Sticky filter + view toggle bar */}
        <div className="sticky top-[72px] z-30 bg-white/90 backdrop-blur-sm py-4 mb-10" data-testid="category-filter-bar">
          <div className="flex items-center justify-between gap-4">
            {/* Category tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`filter-tab-${tab.id}`}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`relative px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 focus:outline-none ${
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

            {/* View toggle — mobile only */}
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
            <p className="text-gray-400 text-xs mt-2">Make sure the <strong>products</strong> table exists in Supabase and RLS SELECT policy allows anon reads.</p>
          </div>
        )}

        {/* Products */}
        {!loading && !error && (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${viewMode}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className={
                  // Desktop: always 4-col card grid, ignore viewMode
                  // Mobile: grid = 2-col instagram, list = stacked list
                  viewMode === "list"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid grid-cols-2 gap-0.5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4"
                }
              >
                {filtered.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    view={viewMode}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {filtered.length === 0 && (
              <p className="text-center text-gray-400 py-16">
                No products in this category yet.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
