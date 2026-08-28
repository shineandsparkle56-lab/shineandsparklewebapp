import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./context/CartContext";
import { ProductsProvider } from "./context/ProductsContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { ScrollProvider } from "./context/ScrollContext";
import { useSettings } from "./hooks/useSettings";

import { Navbar } from "./components/Navbar";
import { ProductGrid } from "./components/ProductGrid";
import { About } from "./components/About";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";
import { FloatingCart } from "./components/FloatingCart";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminPanel } from "./pages/AdminPanel";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { TrackOrder } from "./pages/TrackOrder";
import { FestivalStorePage } from "./pages/FestivalStorePage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { FestivalsProvider } from "./context/FestivalsContext";

const queryClient = new QueryClient();

// ── Shared page shell ─────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <Navbar />
      <main
        className="flex-1"
        style={{ paddingTop: "3.5rem" }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

// ── Store shell — always mounted, hidden when not on store ────
function StoreShell({ allCategoryImage }: { allCategoryImage: string | null }) {
  const [path] = useLocation();
  const visible = path === "/" || path.startsWith("/product/");
  return (
    <div style={{ display: visible ? "block" : "none" }} aria-hidden={!visible}>
      <PageShell>
        <ProductGrid allCategoryImage={allCategoryImage} />
      </PageShell>
    </div>
  );
}

// ── Festival shell — always mounted when on /festival/:slug ──
function FestivalShell({ slug }: { slug: string }) {
  const [path] = useLocation();
  const visible = path === `/festival/${slug}` ||
    path.startsWith(`/festival/${slug}/`) ||
    path.startsWith("/product/");
  return (
    <div
      style={{
        display: visible ? "block" : "none",
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        // Pull content up behind the Android status bar
        // (counters body padding-top: env(safe-area-inset-top))
        marginTop: "calc(-1 * env(safe-area-inset-top))",
      }}
      aria-hidden={!visible}
    >
      <FestivalStorePage slug={slug} />
    </div>
  );
}

function AppRouter() {
  const [path] = useLocation();
  const { allCategoryImage, loading } = useSettings();

  // Remember the last festival slug so when we navigate to /product/:id
  // from a festival page, we keep the FestivalShell mounted underneath.
  const lastFestivalSlug = useRef<string | null>(null);
  if (path.startsWith("/festival/")) {
    lastFestivalSlug.current = path.replace("/festival/", "").split("/")[0];
  }
  // Clear it when going somewhere unrelated
  if (!path.startsWith("/festival/") && !path.startsWith("/product/")) {
    lastFestivalSlug.current = null;
  }

  // ── Splash screen while settings load ─────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50 gap-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <img src="/logo.png" alt="Shine and Sparkle" className="h-20 w-auto object-contain" />
          <span className="font-serif text-2xl font-bold text-[#9B6FD1] tracking-tight">
            Shine and Sparkle
          </span>
        </div>
        <div className="flex gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-[#9B6FD1] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-[#9B6FD1] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-[#9B6FD1] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  // ── Admin & static pages ───────────────────────────────────
  if (path === "/admin")            return <AdminLogin />;
  if (path === "/admin/dashboard")  return <AdminPanel />;
  if (path === "/privacy-policy")   return <PrivacyPolicy />;
  if (path === "/terms-of-service") return <TermsOfService />;
  if (path === "/track")            return <PageShell><TrackOrder /></PageShell>;
  if (path === "/about")            return <PageShell><About /></PageShell>;
  if (path === "/contact")          return <PageShell><Contact /></PageShell>;

  const productId = path.startsWith("/product/") ? Number(path.split("/")[2]) : null;
  const isValidProduct = productId !== null && !isNaN(productId) && productId > 0;

  // ── Festival store (+ product overlay when coming from festival) ──
  if (path.startsWith("/festival/") || (isValidProduct && lastFestivalSlug.current)) {
    return (
      <>
        {lastFestivalSlug.current && (
          <FestivalShell slug={lastFestivalSlug.current} />
        )}
        {isValidProduct && (
          <div data-product-scroll className="fixed inset-0 z-50 overflow-y-auto bg-white">
            <ProductDetailPage productId={productId!} />
          </div>
        )}
      </>
    );
  }

  // ── Main store (+ product overlay when coming from store) ─────────
  return (
    <>
      <StoreShell allCategoryImage={allCategoryImage} />
      {isValidProduct && (
        <div data-product-scroll className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <ProductDetailPage productId={productId!} />
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProductsProvider>
          <CategoriesProvider>
            <FestivalsProvider>
              <ScrollProvider>
                <CartProvider>
                  <AppRouter />
                  {/* Cart rendered at root — above all z-index layers including product overlay */}
                  <CartDrawer />
                  <FloatingCart />
                  <Toaster />
                </CartProvider>
              </ScrollProvider>
            </FestivalsProvider>
          </CategoriesProvider>
        </ProductsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
