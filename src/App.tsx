import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
const queryClient = new QueryClient();

// ── Shared page shell — Navbar + Footer + CartDrawer on every page ──
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pt-14" style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}>{children}</main>
      <Footer />
      <CartDrawer />
      <FloatingCart />
    </div>
  );
}

function AppRouter() {
  const [path] = useLocation();
  const { showSearchBar, allCategoryImage, loading } = useSettings();

  // ── Branded splash screen while settings load ──────────────────
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

  if (path === "/admin")           return <AdminLogin />;
  if (path === "/admin/dashboard") return <AdminPanel />;
  if (path === "/privacy-policy")  return <PrivacyPolicy />;
  if (path === "/terms-of-service") return <TermsOfService />;
  if (path === "/track") return <PageShell><TrackOrder /></PageShell>;

  if (path === "/about")   return <PageShell><About /></PageShell>;
  if (path === "/contact") return <PageShell><Contact /></PageShell>;

  // Default: storefront
  return (
    <PageShell>
      <ProductGrid showSearchBar={showSearchBar} allCategoryImage={allCategoryImage} />
    </PageShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProductsProvider>
          <CategoriesProvider>
            <ScrollProvider>
              <CartProvider>
                <AppRouter />
                <Toaster />
              </CartProvider>
            </ScrollProvider>
          </CategoriesProvider>
        </ProductsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
