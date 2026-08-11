import { useState } from "react";
import { ShoppingBag, Menu, Home, Info, Phone, Truck, Sparkles } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useScroll } from "../context/ScrollContext";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const navLinks = [
  { name: "Home",        href: "/",        icon: Home },
  { name: "About",       href: "/about",   icon: Info },
  { name: "Contact",     href: "/contact", icon: Phone },
  { name: "Track Order", href: "/track",   icon: Truck },
];

export function Navbar() {
  const { totalItems, setIsCartOpen } = useCart();
  const { scrollingDown } = useScroll();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const close = () => setMobileMenuOpen(false);

  return (
    <header
      className={`fixed top-0 w-full bg-white/90 backdrop-blur-md z-40 border-b border-gray-100 shadow-sm transition-transform duration-300 ${
        scrollingDown ? "-translate-y-full" : "translate-y-0"
      }`}
      data-testid="navbar"
    >
      <div className="container mx-auto px-4 h-14 flex items-center justify-between lg:grid lg:grid-cols-3">

        {/* ── Left: hamburger (mobile) + logo ── */}
        <div className="flex items-center gap-2">

          {/* Hamburger — mobile only */}
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="p-2 text-gray-700 hover:text-[#9B6FD1] transition-colors rounded-xl hover:bg-[#F3EEFB]" data-testid="nav-menu-mobile">
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>

              <SheetContent side="left" className="w-[270px] sm:w-[290px] p-0 flex flex-col border-0 shadow-2xl bg-white [&>button]:top-3.5 [&>button]:right-3.5 [&>button]:w-7 [&>button]:h-7 [&>button]:rounded-full [&>button]:bg-gray-100 [&>button]:hover:bg-gray-200 [&>button]:opacity-100 [&>button]:flex [&>button]:items-center [&>button]:justify-center">

                {/* Brand */}
                <div className="px-5 pt-7 pb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0">
                      <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                      <p className="font-serif text-[15px] font-bold text-gray-900 leading-tight">Shine and Sparkle</p>
                      <p className="text-[9px] text-[#9B6FD1] font-medium flex items-center gap-1 mt-0.5">
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        Trendy Indian Jewelry for Every Occasion
                      </p>
                    </div>
                  </div>

                  {/* Cart CTA */}
                  <button onClick={() => { close(); setIsCartOpen(true); }}
                    className="w-full flex items-center justify-between bg-[#F3EEFB] hover:bg-[#ece4f9] text-[#9B6FD1] px-4 py-2.5 rounded-2xl transition-colors">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShoppingBag className="w-4 h-4" /> View Cart
                    </div>
                    {totalItems > 0 && (
                      <span className="bg-[#9B6FD1] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </div>

                <div className="h-px bg-gray-100 mx-5" />

                {/* Nav links */}
                <nav className="flex-1 px-3 py-3 space-y-0.5">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const active = window.location.pathname === link.href;
                    return (
                      <a key={link.name} href={link.href} onClick={close}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                          active
                            ? "bg-[#9B6FD1] text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}>
                        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-gray-400"}`} />
                        {link.name}
                      </a>
                    );
                  })}
                </nav>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 text-center">© {new Date().getFullYear()} Shine and Sparkle</p>
                </div>

              </SheetContent>
            </Sheet>
          </div>

          {/* Logo */}
          <a href="/" className="flex items-center gap-2" aria-label="Shine and Sparkle - Home">
            <img
              src="/logo.png"
              alt="Shine and Sparkle"
              className="h-10 w-auto object-contain"
            />
            <span className="font-serif text-lg md:text-xl font-bold text-primary tracking-tight whitespace-nowrap">
              Shine and Sparkle
            </span>
          </a>
        </div>

        {/* ── Center: desktop nav (hidden on mobile) ── */}
        <nav className="hidden lg:flex items-center justify-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] rounded-xl transition-all"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* ── Right: cart icon ── */}
        <div className="flex items-center justify-end">
          <button
            className="relative p-2 text-gray-700 hover:text-[#9B6FD1] transition-colors rounded-xl hover:bg-[#F3EEFB]"
            onClick={() => setIsCartOpen(true)}
            data-testid="cart-icon-btn"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-6 w-6" />
            {totalItems > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#9B6FD1] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm"
                data-testid="cart-count-badge"
              >
                {totalItems}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
