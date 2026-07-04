import { MessageCircle, Instagram, Facebook, Clock, Mail } from "lucide-react";
import { WHATSAPP_NUMBER } from "../context/CartContext";

const contactOptions = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    desc: "Chat with us directly for orders, questions, or anything at all.",
    label: "Chat Now",
    href: `https://wa.me/${WHATSAPP_NUMBER}`,
    primary: true,
  },
  {
    icon: Instagram,
    title: "Instagram",
    desc: "Follow us for new arrivals, behind-the-scenes, and more.",
    label: "@shine._and._sparkle",
    href: "https://www.instagram.com/shine._and._sparkle?igsh=MXVxeWRkcXdkaHd4OQ%3D%3D",
    primary: false,
  },
  {
    icon: Facebook,
    title: "Facebook",
    desc: "Like our page to stay updated on latest collections and offers.",
    label: "Shine and Sparkle",
    href: "https://www.facebook.com/share/18kA6Czxnn/",
    primary: false,
  },
  {
    icon: Mail,
    title: "Email",
    desc: "For formal inquiries, wholesale requests, or collaborations.",
    label: "hello@shineandsparkle.in",
    href: "mailto:hello@shineandsparkle.in",
    primary: false,
  },
];

export function Contact() {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9B6FD1] mb-3">Reach Out</p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-5">
            We'd Love to Hear from You
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
            Have a question about a piece? Need help with an order? We're just a message away — reach out on any platform that works for you.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-14">
          {contactOptions.map(({ icon: Icon, title, desc, label, href, primary }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-start gap-4 p-6 rounded-2xl border transition-all duration-200 hover:shadow-md ${
                primary
                  ? "border-[#9B6FD1]/30 bg-[#F3EEFB]/60 hover:border-[#9B6FD1]"
                  : "border-gray-100 bg-white hover:border-[#9B6FD1]/30"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                primary ? "bg-[#9B6FD1] text-white" : "bg-gray-50 text-[#9B6FD1] group-hover:bg-[#F3EEFB]"
              } transition-colors`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm mb-0.5">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{desc}</p>
                <span className={`text-xs font-semibold ${primary ? "text-[#9B6FD1]" : "text-gray-400 group-hover:text-[#9B6FD1]"} transition-colors`}>
                  {label} →
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Hours note */}
        <div className="flex items-center justify-center gap-3 text-sm text-gray-400 bg-gray-50 rounded-2xl px-6 py-4">
          <Clock className="w-4 h-4 shrink-0" />
          <span>We typically respond within a few hours, Mon–Sat · 10 AM to 8 PM IST</span>
        </div>

      </div>
    </section>
  );
}
