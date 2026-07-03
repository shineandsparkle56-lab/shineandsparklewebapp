export function About() {
  return (
    <section id="about" className="py-24 bg-[#F3EEFB]">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-8">
            The Story Behind the Sparkle
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-16 font-light">
            Shine and Sparkle was born from a simple belief: every woman deserves to feel precious. 
            We create delicate, feminine jewelry that isn't just worn, but cherished. 
            Drawing inspiration from modern Indian aesthetics, our pieces blend traditional warmth with contemporary elegance. 
            Step into our world, where every detail is chosen with love.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary text-xl font-bold font-serif">1</div>
              <h3 className="text-xl font-serif text-gray-900 mb-3">Handcrafted with Love</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Each piece is meticulously crafted by skilled artisans, ensuring unique character and exceptional quality.
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
                Proudly designed and created in India, celebrating our rich heritage with a soft, modern touch.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
