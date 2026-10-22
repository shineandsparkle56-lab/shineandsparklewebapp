/**
 * ComboListingPage  — /combo
 * Shows all active combo box offers. Tapping "Build Your Box" navigates
 * to /combo/:id for the step-by-step picker.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Package2, ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { imgUrl } from "../lib/imgUrl";

interface ComboBox {
  id:            number;
  name:          string;
  description:   string;
  box_image_url: string | null;
  item_count:    number;
  box_price:     number;
  wholesale_min: number;
  wholesale_max: number;
  is_active:     boolean;
  shipping_credit: number;
}

export function ComboListingPage() {
  const [, navigate] = useLocation();
  const [boxes,   setBoxes]   = useState<ComboBox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("combo_boxes")
      .select("id, name, description, box_image_url, item_count, box_price, wholesale_min, wholesale_max, is_active, shipping_credit")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at",  { ascending: false })
      .then(({ data }) => {
        setBoxes((data ?? []) as ComboBox[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-2xl mx-auto h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Package2 className="w-4 h-4 text-[#9B6FD1]" />
            <h1 className="font-semibold text-gray-800">Build Your Own Box</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Intro */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500">
            Pick your favourite jewellery and build your own box at an amazing price!
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading boxes…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && boxes.length === 0 && (
          <div className="text-center py-20">
            <Package2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No combo boxes available right now.</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon!</p>
          </div>
        )}

        {/* Grid */}
        {!loading && boxes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {boxes.map((box, i) => (
              <motion.div
                key={box.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                {/* Banner image */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-[#F3EEFB] to-[#ede4f8] overflow-hidden">
                  {box.box_image_url ? (
                    <img
                      src={imgUrl(box.box_image_url, "full")}
                      alt={box.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      <Package2 className="w-12 h-12 text-[#9B6FD1]/40" />
                      <p className="text-[#9B6FD1]/60 text-sm font-medium">
                        Pick any {box.item_count}
                      </p>
                    </div>
                  )}
                  {/* Price badge */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                    <span className="text-sm font-bold text-[#9B6FD1]">₹{box.box_price}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-base leading-snug">{box.name}</h2>
                    {box.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{box.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-full">
                        Pick any {box.item_count} items
                      </span>
                      <span className="text-lg font-bold text-gray-900">₹{box.box_price}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/combo/${box.id}`)}
                    className="mt-auto w-full py-3 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-purple-100"
                  >
                    <Package2 className="w-4 h-4" />
                    Build Your Box
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
