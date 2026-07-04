import { ShieldCheck, Sparkles, MapPin } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Curated Selection",
    desc: "Every piece is hand-picked from trusted wholesale partners across India — only the styles worth wearing make it to our store.",
  },
  {
    icon: ShieldCheck,
    title: "Anti-Tarnish Quality",
    desc: "Premium materials with protective coatings so your jewelry stays bright and beautiful day after day.",
  },
  {
    icon: MapPin,
    title: "Made in India",
    desc: "All pieces are sourced from Indian manufacturers, celebrating local craftsmanship with a fresh modern look.",
  },
];

export function About() {
  return (
    <section id="about" className="py-20 bg-[#F3EEFB]/40">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9B6FD1] mb-3">Who We Are</p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-5">
            The Story Behind the Sparkle
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Shine and Sparkle brings you a carefully curated selection of Indian jewelry —
            sourced directly from trusted wholesale suppliers so you get the best styles at prices that make sense.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-7 shadow-sm border border-[#E8DEFF] flex flex-col items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#9B6FD1]" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom banner */}
        <div className="bg-[#9B6FD1] rounded-3xl px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-white">
          <div>
            <h3 className="font-serif text-2xl font-bold mb-1">Shop with Confidence</h3>
            <p className="text-white/75 text-sm max-w-md">
              Every order is confirmed personally via WhatsApp. No bots, no automated checkout — just real conversations and real jewelry.
            </p>
          </div>
          <a
            href="#shop"
            className="shrink-0 bg-white text-[#9B6FD1] font-semibold text-sm px-6 py-3 rounded-full hover:bg-[#F3EEFB] transition-colors"
          >
            Browse Collection
          </a>
        </div>

      </div>
    </section>
  );
}
