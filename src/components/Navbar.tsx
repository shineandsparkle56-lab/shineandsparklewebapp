import { useState } from "react";
import { ShoppingBag, Menu, Home, Info, Phone, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useScroll } from "../context/ScrollContext";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";

const navLinks = [
  { name: "Home",    href: "/",        icon: Home },
  { name: "About",   href: "/about",   icon: Info },
  { name: "Contact", href: "/contact", icon: Phone },
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
                <Button variant="ghost" size="icon" className="text-gray-700" data-testid="nav-menu-mobile">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 flex flex-col border-0 shadow-2xl">
                {/* Drawer header */}
                <div className="relative bg-gradient-to-br from-[#9B6FD1] to-[#7c4fc0] px-6 pt-10 pb-8">
                  <button
                    onClick={close}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3 mb-1">
                    <img src="/logo.png" alt="Shine and Sparkle" className="h-12 w-auto object-contain rounded-xl bg-white/10 p-1" />
                    <p className="font-serif text-2xl font-bold text-white leading-tight">Shine and Sparkle</p>
                  </div>
                  <p className="text-white/70 text-xs tracking-widest uppercase">Premium Indian Jewelry</p>
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => { close(); setIsCartOpen(true); }}
                      className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Cart
                      {totalItems > 0 && (
                        <span className="bg-white text-[#9B6FD1] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {totalItems}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Drawer nav links */}
                <nav className="flex-1 overflow-y-auto px-4 py-4">
                  {navLinks.map((link, i) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.name}
                        href={link.href}
                        onClick={close}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-700 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-all duration-200 group"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 group-hover:bg-[#9B6FD1]/10 transition-colors">
                          <Icon className="w-4 h-4 text-gray-400 group-hover:text-[#9B6FD1] transition-colors" />
                        </span>
                        <span className="font-medium text-sm">{link.name}</span>
                      </a>
                    );
                  })}
                </nav>

                <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/60">
                  <p className="text-[10px] text-gray-400 text-center tracking-wider uppercase">© 2025 Shine and Sparkle</p>
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
        <nav className="hidden lg:flex items-center justify-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors uppercase tracking-wider"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* ── Right: cart icon ── */}
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-700 hover:text-primary transition-colors"
            onClick={() => setIsCartOpen(true)}
            data-testid="cart-icon-btn"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span
                className="absolute top-1 right-1 bg-primary text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center transform translate-x-1/4 -translate-y-1/4"
                data-testid="cart-count-badge"
              >
                {totalItems}
              </span>
            )}
          </Button>
        </div>

      </div>
    </header>
  );
}
