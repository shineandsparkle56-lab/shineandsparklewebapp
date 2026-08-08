import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Package, ShoppingBag, Tag, ImageIcon, BarChart3, Printer, Settings, Sparkles, LogOut,
} from "lucide-react";
import { ProductsTab }   from "../components/admin/ProductsTab";
import { OrdersTab }     from "../components/admin/OrdersTab";
import { CategoriesTab } from "../components/admin/CategoriesTab";
import { SettingsTab }   from "../components/admin/SettingsTab";
import { PostEditor }         from "../components/admin/PostEditor";
import { ReportTab }          from "../components/admin/ReportTab";
import { ShiprocketPDFPrinter } from "../components/admin/ShiprocketPDFPrinter";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { useToast } from "../hooks/useToast";

type Tab = "products" | "orders" | "categories" | "post" | "report" | "label" | "settings";

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: "products",   icon: Package,    label: "Products"    },
  { id: "orders",     icon: ShoppingBag,label: "Orders"      },
  { id: "categories", icon: Tag,        label: "Categories"  },
  { id: "post",       icon: ImageIcon,  label: "Post"        },
  { id: "report",     icon: BarChart3,  label: "Report"      },
  { id: "label",      icon: Printer,    label: "Label Print" },
  { id: "settings",   icon: Settings,   label: "Settings"    },
];

export function AdminPanel() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const toast = useToast();

  // Auth guard
  useEffect(() => {
    if (!sessionStorage.getItem("sns_admin")) navigate("/admin");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#9B6FD1] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif text-gray-900 font-semibold">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-[#9B6FD1] transition-colors">
              View Store
            </a>
            <button
              onClick={() => { sessionStorage.removeItem("sns_admin"); navigate("/admin"); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto overflow-x-auto scrollbar-none border-t border-gray-100">
          <div className="flex gap-1 px-4 min-w-max">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === id
                    ? "border-[#9B6FD1] text-[#9B6FD1]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8">
        {activeTab === "products"   && <ProductsTab />}
        {activeTab === "orders"     && <OrdersTab />}
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "post"       && <PostEditor />}
        {activeTab === "report"     && <ReportTab />}
        {activeTab === "label"      && <ShiprocketPDFPrinter />}
        {activeTab === "settings"   && <SettingsTab />}
      </div>

      {/* Global toast */}
      <AnimatePresence>
        {toast.message && (
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${
              toast.type === "error" ? "bg-red-500" : "bg-green-600"
            }`}
          >
            {toast.type === "error" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
        .input  { width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.875rem; color: #1f2937; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: white; }
        .input:focus { border-color: #9B6FD1; box-shadow: 0 0 0 3px rgba(155,111,209,0.15); }
      `}</style>
    </div>
  );
}
