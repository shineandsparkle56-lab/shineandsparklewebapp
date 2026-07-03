import { WHATSAPP_NUMBER } from "../context/CartContext";

export function Contact() {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="container mx-auto px-4 text-center max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-serif text-gray-900 mb-6">
          Get in Touch
        </h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Have a question about a piece? Need help with an order? We'd love to hear from you. 
          Reach out to us on WhatsApp or through our social channels.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3 rounded-full hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto"
          >
            Chat on WhatsApp
          </a>
          <a
            href="mailto:hello@shineandsparkle.com"
            className="inline-flex items-center justify-center bg-muted text-muted-foreground px-8 py-3 rounded-full hover:bg-muted/80 transition-colors shadow-sm w-full sm:w-auto"
          >
            Email Us
          </a>
        </div>
      </div>
    </section>
  );
}
