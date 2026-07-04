export function About() {
  return (
    <section id="about" className="py-24 bg-[#F3EEFB]">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-8">
            The Story Behind the Sparkle
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-16 font-light">
            Shine and Sparkle brings you a carefully curated selection of Indian jewelry — 
            sourced directly from trusted wholesale suppliers so you get the best styles 
            at prices that make sense.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary text-xl font-bold font-serif">1</div>
              <h3 className="text-xl font-serif text-gray-900 mb-3">Curated Selection</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Every piece in our collection is hand-picked from reliable wholesale partners, so you always get quality you can count on.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary text-xl font-bold font-serif">2</div>
              <h3 className="text-xl font-serif text-gray-900 mb-3">Anti-Tarnish</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Premium materials and protective coatings mean your jewelry keeps its beautiful shine day after day.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary text-xl font-bold font-serif">3</div>
              <h3 className="text-xl font-serif text-gray-900 mb-3">Made in India</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                All our pieces are sourced from Indian manufacturers, celebrating local craftsmanship with a fresh, modern look.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
