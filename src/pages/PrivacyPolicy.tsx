import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export function PrivacyPolicy() {
  const [, navigate] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#9B6FD1] text-white py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Store
          </button>
          <h1 className="font-serif text-3xl font-bold">Privacy Policy</h1>
          <p className="text-white/60 text-xs mt-1">Last updated: July 2025</p>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-12 text-sm text-gray-600 leading-relaxed space-y-8">

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">What we collect</h2>
          <p>Only what you share when placing an order via WhatsApp — your name, phone number, and delivery address. Nothing else.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">How we use it</h2>
          <p>Solely to confirm your order, arrange delivery, and follow up if needed. We never sell or share your data with anyone.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">What we don't do</h2>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>No user accounts or passwords stored</li>
            <li>No payment card details collected</li>
            <li>No cookies or tracking tools on this website</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">WhatsApp</h2>
          <p>Orders go through WhatsApp. That conversation is also covered by <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#9B6FD1] underline">WhatsApp's own Privacy Policy</a>.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Your rights</h2>
          <p>You can ask us to show, correct, or delete your information at any time. Just message us on WhatsApp.</p>
        </section>

        <div className="p-5 bg-[#F3EEFB] rounded-2xl">
          <p className="font-medium text-gray-800 mb-1">Questions?</p>
          <p>Reach out on WhatsApp and we'll respond quickly.</p>
        </div>
      </div>
    </div>
  );
}
