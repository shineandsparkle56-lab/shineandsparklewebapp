import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./context/CartContext";
import { ProductsProvider } from "./context/ProductsContext";
import { ScrollProvider } from "./context/ScrollContext";

import { Navbar } from "./components/Navbar";
import { ProductGrid } from "./components/ProductGrid";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";
import { FloatingCart } from "./components/FloatingCart";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminPanel } from "./pages/AdminPanel";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";

const queryClient = new QueryClient();

function Storefront() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <ProductGrid />
      </main>
      <Footer />
      <CartDrawer />
      <FloatingCart />
    </div>
  );
}

function AppRouter() {
  const [path] = useLocation();
  if (path === "/admin") return <AdminLogin />;
  if (path === "/admin/dashboard") return <AdminPanel />;
  if (path === "/privacy-policy") return <PrivacyPolicy />;
  if (path === "/terms-of-service") return <TermsOfService />;
  return <Storefront />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProductsProvider>
          <ScrollProvider>
            <CartProvider>
              <AppRouter />
              <Toaster />
            </CartProvider>
          </ScrollProvider>
        </ProductsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
