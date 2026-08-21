import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ShoppingBag, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useFestivals, isFestivalLive } from "../context/FestivalsContext";
import { useInfiniteProducts } from "../hooks/useInfiniteProducts";
import { ProductCard } from "../components/ProductCard";
import { CartDrawer } from "../components/CartDrawer";
import { FloatingCart } from "../components/FloatingCart";
import { useCart } from "../context/CartContext";
import type { FestivalSection } from "../context/FestivalsContext";

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm flex-shrink-0 w-40 sm:w-auto">
      <div className="aspect-square bg-gray-200 shimmer" />
      <div className="p-2.5 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 shimmer rounded-full w-4/5" />
        <div className="h-3 bg-gray-200 shimmer rounded-full w-2/5" />
        <div className="h-7 bg-gray-200 shimmer rounded-xl mt-1" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section panel — horizontal scroll on mobile, grid on desktop
// ─────────────────────────────────────────────────────────────
function SectionPanel({ tag, accentColor }: { tag: string; accentColor: string }) {
  const { products, loading, loadingMore, hasMore, loadMore } = useInfiniteProducts(
    "all", "default", "", tag,
  );

  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  // sentinel for infinite scroll (desktop grid)
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: "0px 0px 400px 0px" },
    );
    obs.observe(el);
  }, []);

  if (loading) {
    return (
      <>
        {/* Mobile: horizontal shimmer */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:hidden px-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        {/* Desktop: grid shimmer */}
        <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="aspect-square bg-gray-200 shimmer" />
              <div className="p-2.5 flex flex-col gap-2">
                <div className="h-3 bg-gray-200 shimmer rounded-full w-4/5" />
                <div className="h-3 bg-gray-200 shimmer rounded-full w-2/5" />
                <div className="h-8 bg-gray-200 shimmer rounded-xl mt-1" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${accentColor}20` }}>
          <Sparkles className="w-6 h-6" style={{ color: accentColor }} />
        </div>
        <p className="text-gray-500 font-medium text-sm">Products coming soon</p>
        <p className="text-gray-400 text-xs max-w-[200px]">
          Tag products with <span className="font-mono bg-gray-100 px-1 rounded">{tag}</span> to show them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Mobile: horizontal scroll strip ── */}
      <div className="sm:hidden">
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none px-4"
          style={{ WebkitOverflowScrolling: "touch" }}>
          {products.map((p, i) => (
            <div key={p.id} className="flex-shrink-0 w-[44vw] max-w-[180px]">
              <ProductCard product={p} index={i} view="grid" />
            </div>
          ))}
          {loadingMore && (
            <div className="flex-shrink-0 w-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: accentColor, borderTopColor: "transparent" }} />
            </div>
          )}
          {/* Sentinel for mobile infinite scroll */}
          {hasMore && !loadingMore && (
            <div ref={sentinelRef} className="flex-shrink-0 w-4" />
          )}
        </div>
      </div>

      {/* ── Desktop: 3-col / 4-col grid ── */}
      <div className="hidden sm:block px-4">
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} view="grid" />
          ))}
        </div>
        {loadingMore && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: accentColor, borderTopColor: "transparent" }} />
          </div>
        )}
        {hasMore && !loadingMore && <div ref={sentinelRef} className="h-2 w-full" />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section tab bar
// ─────────────────────────────────────────────────────────────
function SectionTabBar({
  sections,
  active,
  onChange,
  accentColor,
}: {
  sections: FestivalSection[];
  active: number;
  onChange: (i: number) => void;
  accentColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll active tab into view
  useEffect(() => {
    const btn = btnRefs.current[active];
    if (btn && scrollRef.current) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-3"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {sections.map((sec, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            ref={(el) => { btnRefs.current[i] = el; }}
            onClick={() => onChange(i)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold
              transition-all duration-200 border whitespace-nowrap"
            style={
              isActive
                ? { background: accentColor, color: "#fff", borderColor: accentColor, boxShadow: `0 2px 12px ${accentColor}40` }
                : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }
            }
          >
            {sec.title}
            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export function FestivalStorePage({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const { festivals, loading: festivalsLoading } = useFestivals();
  const { totalItems, setIsCartOpen } = useCart();
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [slug]);

  // Reset to first tab when festival changes
  useEffect(() => { setActiveSection(0); }, [slug]);

  const festival = festivals.find((f) => f.slug === slug);
  const isLive = festival ? isFestivalLive(festival) : false;

  // ── Loading ────────────────────────────────────────────────
  if (festivalsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#9B6FD1]" />
      </div>
    );
  }

  // ── Not found / ended ──────────────────────────────────────
  if (!festival || !isLive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-5 p-6">
        <div className="w-16 h-16 rounded-2xl bg-[#F3EEFB] flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-[#9B6FD1]" />
        </div>
        <div className="text-center">
          <p className="text-xl font-serif font-bold text-gray-800">
            {!festival ? "Festival not found" : "This festival has ended"}
          </p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs">
            {!festival
              ? "The link doesn't match any active festival store."
              : "Check back next time for more festive deals!"}
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white rounded-full text-sm font-semibold hover:bg-[#8a5fc0] transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Store
        </button>
      </div>
    );
  }

  const { name, tagline, banner_url, banner_bg, sponsors, sections } = festival;
  const currentSection = sections[activeSection];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 text-white" style={{ background: banner_bg }}>
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Store</span>
          </button>

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white/70 shrink-0" />
            <span className="font-serif font-bold text-base truncate max-w-[180px] sm:max-w-none">{name}</span>
          </div>

          <button
            className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
            onClick={() => setIsCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-white text-[#9B6FD1] text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Hero banner ───────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: banner_bg }}>
        {banner_url ? (
          <>
            <img
              src={banner_url}
              alt={name}
              className="w-full object-cover object-top"
              style={{ maxHeight: 280, minHeight: 160 }}
            />
            {/* Gradient overlay with text */}
            <div className="absolute inset-0 flex flex-col justify-end px-5 pb-5 sm:px-8 sm:pb-7"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.15) 70%, transparent 100%)",
              }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-[0.15em]"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                  Festival Store
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-4xl font-bold text-white leading-tight"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
                {name}
              </h1>
              {tagline && (
                <p className="text-white text-sm sm:text-base mt-1 leading-snug font-medium"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
                  {tagline}
                </p>
              )}
            </div>
          </>
        ) : (
          /* No image — pure colour hero */
          <div className="flex flex-col items-start justify-end px-5 pb-6 pt-12 sm:px-8">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em] mb-2">
              Festival Store
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white leading-tight">
              {name}
            </h1>
            {tagline && (
              <p className="text-white/75 text-base mt-2">{tagline}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Sponsor strip ─────────────────────────────────────── */}
      {sponsors.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest shrink-0">
            Partners
          </span>
          {sponsors.map((sp, i) => (
            <div key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-100 bg-gray-50 shrink-0">
              {sp.logo_url && (
                <img src={sp.logo_url} alt={sp.name} className="h-5 w-auto object-contain" />
              )}
              <span className="text-xs font-semibold text-gray-700">{sp.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Section tab bar + content ──────────────────────────── */}
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
          <Sparkles className="w-8 h-8 text-gray-300" />
          <p className="text-gray-400 text-sm">
            No sections yet — add them in the admin Festivals tab.
          </p>
        </div>
      ) : (
        <>
          {/* Sticky section tab bar */}
          <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
            {/* Section count hint */}
            <div className="flex items-center justify-between px-4 pt-2 pb-0">
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                {sections.length} {sections.length === 1 ? "Collection" : "Collections"}
              </span>
              <span className="text-[10px] text-gray-300">
                {activeSection + 1} / {sections.length}
              </span>
            </div>
            <SectionTabBar
              sections={sections}
              active={activeSection}
              onChange={(i) => {
                setActiveSection(i);
                // Scroll to content top smoothly
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              accentColor={banner_bg}
            />
          </div>

          {/* Active section content */}
          {currentSection && (
            <div key={currentSection.tag} className="pt-4 pb-24">
              {/* Section title */}
              <div className="px-4 mb-3 flex items-center gap-3">
                <div className="w-1 h-6 rounded-full shrink-0" style={{ background: banner_bg }} />
                <h2 className="font-serif text-xl font-bold text-gray-900">
                  {currentSection.title}
                </h2>
              </div>

              <SectionPanel tag={currentSection.tag} accentColor={banner_bg} />

              {/* Next section teaser */}
              {activeSection < sections.length - 1 && (
                <div className="mt-8 px-4">
                  <button
                    onClick={() => {
                      setActiveSection(activeSection + 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-2xl
                      border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-0.5">
                        Next Collection
                      </p>
                      <p className="text-base font-serif font-bold text-gray-800 group-hover:text-[#9B6FD1] transition-colors">
                        {sections[activeSection + 1].title}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0
                      transition-colors" style={{ background: `${banner_bg}20` }}>
                      <ChevronRight className="w-5 h-5" style={{ color: banner_bg }} />
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <CartDrawer />
      <FloatingCart />
    </div>
  );
}
