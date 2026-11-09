import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Clock, TrendingUp, ArrowUpRight } from "lucide-react";
import { useInfiniteProducts } from "../hooks/useInfiniteProducts";
import { ProductCard } from "./ProductCard";

// ── Recent searches — persisted in localStorage ───────────────
const RECENT_KEY = "sns_recent_searches";
const MAX_RECENT = 6;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function saveRecent(query: string) {
  const prev = getRecent().filter((q) => q.toLowerCase() !== query.toLowerCase());
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
}
function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}

// ── Quick suggestion chips ────────────────────────────────────
const TRENDING = ["Earrings", "Necklace", "Bracelet", "Pendant", "Ring", "Gold"];

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState(""); // debounced value sent to hook
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recents on open
  useEffect(() => {
    if (open) {
      setRecents(getRecent());
      // Autofocus after animation frame so the keyboard appears
      requestAnimationFrame(() => { setTimeout(() => inputRef.current?.focus(), 80); });
    } else {
      // Reset when closed
      setQuery("");
      setCommitted("");
    }
  }, [open]);

  // Debounce search — 300ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setCommitted(query.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Live results via the existing hook — includes loadMore for pagination
  const { products, loading, loadingMore, hasMore, loadMore } = useInfiniteProducts("all", "default", committed);

  // IntersectionObserver sentinel — triggers loadMore when user scrolls near bottom
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: "0px 0px 200px 0px", threshold: 0 }
    );
    observer.observe(el);
  }, []);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    saveRecent(q);
    setRecents(getRecent());
    setCommitted(q);
  }, [query]);

  const applyQuery = useCallback((q: string) => {
    setQuery(q);
    setCommitted(q);
    saveRecent(q);
    setRecents(getRecent());
    inputRef.current?.focus();
  }, []);

  const handleClearRecents = () => {
    clearRecent();
    setRecents([]);
  };

  const showResults  = committed.length > 0;
  const showEmpty    = showResults && !loading && products.length === 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ───────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 z-[59] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* ── Panel ─────────────────────────────────────────── */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-[60] bg-white flex flex-col"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* ── Search bar ──────────────────────────────────── */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100"
            >
              <Search className="w-5 h-5 text-[#9B6FD1] shrink-0" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products or SNS-212…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 text-[15px] font-medium text-gray-800 placeholder:text-gray-400 bg-transparent outline-none min-w-0"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setCommitted(""); inputRef.current?.focus(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 shrink-0 transition-colors"
                  aria-label="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm font-semibold text-[#9B6FD1] shrink-0 px-1"
                >
                  Cancel
                </button>
              )}
            </form>

            {/* ── Scrollable content area ──────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">

              {/* ── Loading skeleton (initial) ────────────────── */}
              {showResults && loading && !loadingMore && (
                <div className="px-4 pt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="aspect-square rounded-2xl bg-gray-100 shimmer" />
                      <div className="h-3 rounded-full bg-gray-100 shimmer w-3/4" />
                      <div className="h-3 rounded-full bg-gray-100 shimmer w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {/* ── No results ────────────────────────────────── */}
              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F3EEFB] flex items-center justify-center">
                    <Search className="w-6 h-6 text-[#9B6FD1]/50" />
                  </div>
                  <p className="text-gray-700 font-semibold">No results for "{committed}"</p>
                  <p className="text-sm text-gray-400">Try a different name or SNS code</p>
                </div>
              )}

              {/* ── Results grid ──────────────────────────────── */}
              {showResults && !loading && products.length > 0 && (
                <div className="px-3 pt-3 pb-safe">
                  <div
                    className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
                    onClick={onClose}
                  >
                    {products.map((product, index) => (
                      <ProductCard key={product.id} product={product} index={index} view="grid" />
                    ))}
                  </div>

                  {/* Sentinel — triggers next page load when scrolled into view */}
                  {hasMore && (
                    <div ref={sentinelRef} className="py-6 flex justify-center">
                      {loadingMore && (
                        <div className="w-6 h-6 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  )}

                  {/* Bottom padding for safe area */}
                  {!hasMore && <div className="h-8" />}
                </div>
              )}

              {/* ── Empty state — show recents + trending ─────── */}
              {!showResults && (
                <div className="px-4 py-4 space-y-5">

                  {/* Recent searches */}
                  {recents.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</span>
                        </div>
                        <button
                          onClick={handleClearRecents}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recents.map((r) => (
                          <button
                            key={r}
                            onClick={() => applyQuery(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-[#F3EEFB] text-sm text-gray-700 hover:text-[#9B6FD1] transition-colors"
                          >
                            <Clock className="w-3 h-3 text-gray-400" />
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending / suggestions */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#9B6FD1]" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Popular</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING.map((t) => (
                        <button
                          key={t}
                          onClick={() => applyQuery(t)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#9B6FD1]/20 bg-[#F3EEFB] text-sm text-[#9B6FD1] font-medium hover:bg-[#9B6FD1] hover:text-white transition-colors"
                        >
                          {t}
                          <ArrowUpRight className="w-3 h-3 opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
