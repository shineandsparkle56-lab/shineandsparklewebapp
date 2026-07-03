import { useState } from "react";
import { ShoppingBag, Menu, Heart, Home, Store, Circle, Gem, Link, Info, Phone, X, Sparkles } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";

const navLinks = [
  { name: "Home",      href: "#",          icon: Home },
  { name: "Shop",      href: "#shop",       icon: Store },
  { name: "Rings",     href: "#rings",      icon: Circle },
  { name: "Earrings",  href: "#earrings",   icon: Gem },
  { name: "Necklaces", href: "#necklaces",  icon: Link },
  { name: "Bracelets", href: "#bracelets",  icon: Sparkles },
  { name: "About",     href: "#about",      icon: Info },
  { name: "Contact",   href: "#contact",    icon: Phone },
];

export function Navbar() {
  const { totalItems, setIsCartOpen } = useCart();
  const { totalWishlisted, setIsWishlistOpen } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const close = () => setMobileMenuOpen(false);

  return (
    <header
      className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-40 border-b border-gray-100 shadow-sm"
      data-testid="navbar"
    >
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">

        {/* ── Mobile hamburger ── */}
        <div className="lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-700"
                data-testid="nav-menu-mobile"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-[280px] sm:w-[320px] p-0 flex flex-col border-0 shadow-2xl"
            >
              {/* Drawer header — brand block */}
              <div className="relative bg-gradient-to-br from-[#9B6FD1] to-[#7c4fc0] px-6 pt-10 pb-8">
                {/* Close button */}
                <button
                  onClick={close}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Logo in drawer */}
                <p className="font-serif text-2xl font-bold text-white leading-tight mb-1">
                  Shine and Sparkle
                </p>
                <p className="text-white/70 text-xs tracking-widest uppercase">
                  Handcrafted Jewelry
                </p>

                {/* Mini icon row */}
                <div className="flex gap-3 mt-5">
                  {/* Wishlist quick-link */}
                  <button
                    onClick={() => { close(); setIsWishlistOpen(true); }}
                    className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  >
                    <Heart className={`w-3.5 h-3.5 ${totalWishlisted > 0 ? "fill-white" : ""}`} />
                    Saved
                    {totalWishlisted > 0 && (
                      <span className="bg-white text-[#9B6FD1] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {totalWishlisted}
                      </span>
                    )}
                  </button>

                  {/* Cart quick-link */}
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

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                {navLinks.map((link, i) => {
                  const Icon = link.icon;
                  // Add a soft divider before "About"
                  const showDivider = link.name === "About";
                  return (
                    <div key={link.name}>
                      {showDivider && (
                        <div className="my-3 border-t border-gray-100" />
                      )}
                      <a
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
                    </div>
                  );
                })}
              </nav>

              {/* Drawer footer */}
              <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/60">
                <p className="text-[10px] text-gray-400 text-center tracking-wider uppercase">
                  © 2024 Shine and Sparkle
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Logo ── */}
        <a
          href="#"
          className="font-serif text-2xl md:text-3xl font-bold text-primary tracking-tight"
        >
          Shine and Sparkle
        </a>

        {/* ── Desktop Nav ── */}
        <nav className="hidden lg:flex items-center gap-8">
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

        {/* ── Right icons — Wishlist + Cart ── */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-700 hover:text-[#9B6FD1] transition-colors"
            onClick={() => setIsWishlistOpen(true)}
            data-testid="wishlist-icon-btn"
            aria-label="Open wishlist"
          >
            <Heart
              className={`h-6 w-6 transition-colors duration-200 ${
                totalWishlisted > 0 ? "fill-[#9B6FD1] text-[#9B6FD1]" : ""
              }`}
            />
            {totalWishlisted > 0 && (
              <span
                className="absolute top-1 right-1 bg-[#9B6FD1] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center transform translate-x-1/4 -translate-y-1/4"
                data-testid="wishlist-count-badge"
              >
                {totalWishlisted}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-700 hover:text-primary transition-colors"
            onClick={() => setIsCartOpen(true)}
            data-testid="cart-icon-btn"
          >
            <ShoppingBag className="h-6 w-6" />
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
