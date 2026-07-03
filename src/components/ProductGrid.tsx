import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProducts } from "../context/ProductsContext";
import { ProductCard } from "./ProductCard";

type Category = "all" | "rings" | "earrings" | "necklaces" | "bracelets";

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
            Our Collection,s ayush
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Explore our handcrafted pieces, designed with love and intention to
            bring a touch of elegance to your everyday life.
          </p>
        </div>

        {/* Sticky filter tab bar */}
        <div className="sticky top-[72px] z-30 bg-white/90 backdrop-blur-sm py-4 mb-10" data-testid="category-filter-bar">
          <div className="flex items-center justify-center gap-2 flex-wrap">
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

        {/* Grid */}
        {!loading && !error && (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              >
                {filtered.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
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
