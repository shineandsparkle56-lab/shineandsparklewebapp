import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { ProductsProvider } from "./context/ProductsContext";

import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { ProductGrid } from "./components/ProductGrid";
import { About } from "./components/About";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";
import { WishlistDrawer } from "./components/WishlistDrawer";
import { FloatingCart } from "./components/FloatingCart";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminPanel } from "./pages/AdminPanel";

const queryClient = new QueryClient();

function Storefront() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ProductGrid />
        <About />
        <Contact />
      </main>
      <Footer />
      <CartDrawer />
      <WishlistDrawer />
      <FloatingCart />
    </div>
  );
}

function AppRouter() {
  const [path] = useLocation();
  if (path === "/admin") return <AdminLogin />;
  if (path === "/admin/dashboard") return <AdminPanel />;
  return <Storefront />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ProductsProvider>
          <CartProvider>
            <WishlistProvider>
              <AppRouter />
              <Toaster />
            </WishlistProvider>
          </CartProvider>
        </ProductsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
