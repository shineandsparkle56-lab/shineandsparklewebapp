import { SiInstagram, SiFacebook, SiPinterest } from "react-icons/si";

export function Footer() {
  return (
    <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <h3 className="font-serif text-2xl text-primary mb-4">Shine and Sparkle</h3>
            <p className="text-gray-500 max-w-sm leading-relaxed">
              Dreamy Indian jewelry for women who want to feel special every day. 
              Delicate pieces, soft colors, and a shopping experience as beautiful as the jewelry itself.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Shop</h4>
            <ul className="space-y-3 text-gray-500">
              <li><a href="#rings" className="hover:text-primary transition-colors">Rings</a></li>
              <li><a href="#earrings" className="hover:text-primary transition-colors">Earrings</a></li>
              <li><a href="#necklaces" className="hover:text-primary transition-colors">Necklaces</a></li>
              <li><a href="#bracelets" className="hover:text-primary transition-colors">Bracelets</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Follow Us</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-primary hover:shadow-md transition-all border border-gray-100">
                <SiInstagram size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-primary hover:shadow-md transition-all border border-gray-100">
                <SiFacebook size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-600 hover:text-primary hover:shadow-md transition-all border border-gray-100">
                <SiPinterest size={18} />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © 2024 Shine and Sparkle. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
