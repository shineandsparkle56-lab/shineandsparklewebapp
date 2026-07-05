import { SiInstagram, SiFacebook, SiPinterest } from "react-icons/si";
import { RotateCcw } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <h3 className="font-serif text-2xl text-primary mb-4">Shine and Sparkle</h3>
            <p className="text-gray-500 max-w-sm leading-relaxed">
              Trendy Indian jewelry for every occasion — sourced from the best wholesale suppliers
              and brought straight to you at honest prices.
            </p>
          </div>


          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Returns</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#9B6FD1] shrink-0" />
                Defective or wrong item? We'll offer a full refund or replacement.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Follow Us</h4>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/shine._and._sparkle?igsh=MXVxeWRkcXdkaHd4OQ%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-primary hover:shadow-md transition-all border border-gray-100"
                aria-label="Instagram"
              >
                <SiInstagram size={18} />
              </a>
              <a
                href="https://www.facebook.com/share/18kA6Czxnn/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-primary hover:shadow-md transition-all border border-gray-100"
                aria-label="Facebook"
              >
                <SiFacebook size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © 2025 Shine and Sparkle. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="/privacy-policy" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" className="hover:text-gray-900 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
