import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export function TermsOfService() {
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
          <h1 className="font-serif text-3xl font-bold">Terms of Service</h1>
          <p className="text-white/60 text-xs mt-1">Last updated: July 2025</p>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-12 text-sm text-gray-600 leading-relaxed space-y-8">

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Orders</h2>
          <p>An order is confirmed only after we acknowledge it on WhatsApp. Adding items to the cart is not a confirmed order. We may cancel an order before dispatch if an item is out of stock — you'll receive a full refund.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Pricing & Payment</h2>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>All prices are in INR and may change without notice</li>
            <li>Payment via UPI or bank transfer, confirmed over WhatsApp</li>
            <li>Orders dispatch only after payment is received</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Shipping</h2>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Delivery across India, typically 4–7 business days</li>
            <li>Free shipping on orders above ₹999</li>
            <li>We are not liable for courier delays</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Returns & Exchanges</h2>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>Exchange accepted within <strong>7 days</strong> for damaged/defective items only</li>
            <li>Send WhatsApp photos of the issue within 7 days of delivery</li>
            <li>No returns for change of mind or incorrect size selection</li>
            <li>Approved refunds processed within 5–7 business days</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Products</h2>
          <p>We are a reseller, not the manufacturer. Product images are representative — slight color variations may occur. Quality concerns must be raised within 7 days of delivery.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-gray-900 mb-2">Governing Law</h2>
          <p>These terms are governed by Indian law. Disputes fall under the jurisdiction of Indian courts.</p>
        </section>

        <div className="p-5 bg-[#F3EEFB] rounded-2xl">
          <p className="font-medium text-gray-800 mb-1">Questions about an order?</p>
          <p>Message us on WhatsApp — we'll get back to you quickly.</p>
        </div>
      </div>
    </div>
  );
}
