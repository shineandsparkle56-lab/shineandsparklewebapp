import { heroImage } from "../data/products";
import { Button } from "./ui/button";

export function Hero() {
  return (
    <section className="bg-[#F3EEFB] pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden" data-testid="hero-banner">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 text-center md:text-left z-10">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-gray-900 leading-tight mb-6">
            Shine Bright, <br />
            <span className="text-primary italic">Sparkle Always</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-lg mx-auto md:mx-0 font-light">
            Trendy Indian jewelry at wholesale prices. Browse our latest collection and order directly on WhatsApp.
          </p>
          <Button 
            asChild
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            data-testid="hero-shop-btn"
          >
            <a href="#shop">Shop Now</a>
          </Button>
        </div>
        
        <div className="flex-1 w-full max-w-2xl mx-auto relative">
          <div className="absolute inset-0 bg-white/40 rounded-full blur-3xl scale-110 -z-10"></div>
          <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative">
            <img 
              src={heroImage} 
              alt="Indian jewelry collection on lavender background" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
