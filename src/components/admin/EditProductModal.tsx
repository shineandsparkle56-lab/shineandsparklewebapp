import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, X, CheckCircle2, ChevronDown, Image } from "lucide-react";
import { Product } from "../../data/products";
import { useCategories } from "../../context/CategoriesContext";
import { useProducts } from "../../context/ProductsContext";
import { supabase } from "../../lib/supabase";
import { useImageItems } from "../../hooks/useImageItems";
import { DraggableImageGrid } from "../ui/DraggableImageGrid";
import { compressToWebP } from "../../utils/compressToWebP";

const BUCKET = "product-images";
const MAX_IMAGES = 6;

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

type FormKey = "name" | "category" | "price" | "originalPrice" | "description" | "stock" | "shipping_credit" | "wholesale_price";

async function uploadFile(file: File, productName?: string): Promise<string> {
  const compressed = await compressToWebP(file, { name: productName });
  const slug = productName
    ? productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "product";
  const path = `${Date.now()}-${slug}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function EditProductModal({ product, onClose, onSaved, onError }: Props) {
  const { categories } = useCategories();
  const { updateProduct } = useProducts();
  const img = useImageItems(MAX_IMAGES);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", category: "", price: "", originalPrice: "",
    description: "", stock: "", shipping_credit: "", wholesale_price: "",
  });
  const [saving, setSaving] = useState(false);

  // Sync state when product changes (modal opens)
  const prevId = useRef<number | null>(null);
  if (product && product.id !== prevId.current) {
    prevId.current = product.id;
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      originalPrice: String(product.originalPrice),
      description: product.description,
      stock: String(product.stock),
      shipping_credit: String(product.shipping_credit ?? 0),
      wholesale_price: String(product.wholesale_price ?? 0),
    });
    const urls = product.images?.length ? product.images : [product.image];
    img.seed(urls);
  }

  const set = (k: FormKey, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const price = Number(form.price);
    const originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;
    setSaving(true);
    img.setError("");

    let finalImages: string[];
    try {
      finalImages = await Promise.all(
        img.items.map((it) => it.file ? uploadFile(it.file, form.name.trim()) : Promise.resolve(it.preview))
      );
    } catch (err) {
      img.setError(err instanceof Error ? err.message : "Upload failed.");
      setSaving(false);
      return;
    }

    if (!finalImages.length) {
      finalImages = [`https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`];
    }

    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));

    try {
      await updateProduct(product.id, {
        name: form.name.trim(),
        category: form.category,
        price,
        originalPrice,
        discount,
        image: finalImages[0],
        images: finalImages,
        description: form.description.trim(),
        stock: Math.max(0, Number(form.stock) || 0),
        shipping_credit: Math.max(0, Number(form.shipping_credit) || 0),
        wholesale_price: Math.max(0, Number(form.wholesale_price) || 0),
      });
      onSaved("Product updated!");
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Edit Product</h2>
                <span className="text-xs text-gray-400 truncate max-w-[160px]">— {product.name}</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="label">Product Name</label>
                  <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <div className="relative">
                    <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input appearance-none pr-8 capitalize">
                      {categories.map((c) => <option key={c.name} value={c.name} className="capitalize">{c.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="label">Stock Quantity</label>
                  <input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Selling Price (₹)</label>
                  <input required type="number" min="1" value={form.price} onChange={(e) => set("price", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Original Price (₹)</label>
                  <input required type="number" min="1" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Shipping Credit (₹)</label>
                  <input type="number" min="0" value={form.shipping_credit} onChange={(e) => set("shipping_credit", e.target.value)} className="input" />
                  <p className="text-[11px] text-gray-400 mt-1">₹ off shipping per unit in cart</p>
                </div>
                <div>
                  <label className="label">Wholesale Price (₹)</label>
                  <input type="number" min="0" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} className="input" />
                  <p className="text-[11px] text-gray-400 mt-1">Your cost price — only visible in admin panel</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="label">
                    <Image className="w-3.5 h-3.5 inline mr-1" />
                    Product Images
                    <span className="text-gray-400 font-normal normal-case ml-1">(first is cover · max {MAX_IMAGES} · drag to reorder)</span>
                  </label>
                  <DraggableImageGrid
                    items={img.items}
                    onReorder={img.setItems}
                    onRemove={img.remove}
                    onAddMore={img.items.length < MAX_IMAGES ? () => fileRef.current?.click() : undefined}
                    maxImages={MAX_IMAGES}
                    newBadge={false}
                  />
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { if (e.target.files?.length) img.add(e.target.files); }} />
                  {img.error && <p className="text-red-500 text-xs mt-1">{img.error}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className="input resize-none" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                    : <><CheckCircle2 className="w-4 h-4" />Save Changes</>
                  }
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
