import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./context/CartContext";
import { ProductsProvider } from "./context/ProductsContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { ScrollProvider } from "./context/ScrollContext";

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
import { useVisitorTracking } from "./hooks/useVisitorTracking";

const queryClient = new QueryClient();

// ── Shared page shell — Navbar + Footer + CartDrawer on every page ──
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 pt-14">{children}</main>
      <Footer />
      <CartDrawer />
      <FloatingCart />
    </div>
  );
}

// Maps raw path strings to human-readable page names for the analytics log.
function resolvePageName(path: string): string {
  if (path === "/")               return "Home";
  if (path === "/about")          return "About";
  if (path === "/contact")        return "Contact";
  if (path === "/privacy-policy") return "Privacy Policy";
  if (path === "/terms-of-service") return "Terms of Service";
  if (path === "/admin")          return "Admin Login";
  if (path === "/admin/dashboard") return "Admin Dashboard";
  return path;
}

function AppRouter() {
  const [path] = useLocation();

  // Track every page view — admin routes are intentionally included so you
  // can see how often the login page is hit, but you can filter them out in
  // the Analytics tab if you prefer.
  useVisitorTracking(resolvePageName(path));

  if (path === "/admin")           return <AdminLogin />;
  if (path === "/admin/dashboard") return <AdminPanel />;
  if (path === "/privacy-policy")  return <PrivacyPolicy />;
  if (path === "/terms-of-service") return <TermsOfService />;

  if (path === "/about")   return <PageShell><About /></PageShell>;
  if (path === "/contact") return <PageShell><Contact /></PageShell>;

  // Default: storefront
  return (
    <PageShell>
      <ProductGrid />
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
