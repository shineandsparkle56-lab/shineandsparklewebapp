import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, LogOut, Package, Sparkles,
  ChevronDown, CheckCircle2, Upload, X, Image,
} from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { Product } from "../data/products";
import { supabase } from "../lib/supabase";

const BUCKET = "product-images";

const CATEGORIES: Product["category"][] = ["rings", "earrings", "necklaces", "bracelets"];

const SIZES_BY_CATEGORY: Record<Product["category"], string[]> = {
  rings: ["5", "6", "7", "8", "9"],
  earrings: ["One Size"],
  necklaces: ["16 inch", "18 inch", "20 inch"],
  bracelets: ['Small (6.5")', 'Medium (7")', 'Large (7.5")'],
};

const empty = {
  name: "",
  category: "rings" as Product["category"],
  price: "",
  originalPrice: "",
  description: "",
};

export function AdminPanel() {
  const [, navigate] = useLocation();
  const { products, addProduct, deleteProduct, loading, error } = useProducts();
  const [form, setForm] = useState(empty);

  // Image state — either a local File or a remote URL string
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("sns_admin")) navigate("/admin");
  }, [navigate]);

  // ── Image helpers ──────────────────────────────────────────────
  const pickFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are supported.");
      return;
    }
    setUploadError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  // ── Form submit ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    const originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;

    setSaving(true);
    setUploadError("");

    let imageUrl = "";
    if (imageFile) {
      try {
        setUploading(true);
        imageUrl = await uploadToStorage(imageFile);
        setUploading(false);
      } catch (err: unknown) {
        setUploading(false);
        setSaving(false);
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setUploadError(
          msg.toLowerCase().includes("bucket")
            ? 'Storage bucket missing. Go to Supabase → Storage → New bucket → name it "product-images" → set to Public.'
            : msg
        );
        return;
      }
    }

    if (!imageUrl) {
      imageUrl = `https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`;
    }

    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    await addProduct({
      name: form.name.trim(),
      category: form.category,
      price,
      originalPrice,
      discount,
      image: imageUrl,
      description: form.description.trim(),
      sizes: SIZES_BY_CATEGORY[form.category],
    });

    setSaving(false);
    setForm(empty);
    clearImage();
    setToast("Product saved to Supabase!");
    setTimeout(() => setToast(""), 3000);
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    await deleteProduct(deleteId);
    setDeleting(false);
    setDeleteId(null);
  };

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ── Drag & drop ────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  };

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
            <a href="/" className="text-sm text-gray-500 hover:text-[#9B6FD1] transition-colors">View Store</a>
            <button onClick={() => { sessionStorage.removeItem("sns_admin"); navigate("/admin"); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Add Product Form ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">Add New Product</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Name */}
              <div className="sm:col-span-2">
                <label className="label">Product Name</label>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Gold Lotus Ring" className="input" />
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <div className="relative">
                  <select value={form.category} onChange={(e) => set("category", e.target.value as Product["category"])} className="input appearance-none pr-8 capitalize">
                    {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="label">Selling Price (₹)</label>
                <input required type="number" min="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="799" className="input" />
              </div>

              {/* Original price */}
              <div>
                <label className="label">Original Price (₹) <span className="text-gray-400 font-normal normal-case">(for discount badge)</span></label>
                <input required type="number" min="1" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="1199" className="input" />
              </div>

              {/* ── Image upload ── */}
              <div className="sm:col-span-2">
                <label className="label"><Image className="w-3.5 h-3.5 inline mr-1" /> Product Image</label>

                {imagePreview ? (
                  /* Preview */
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <img src={imagePreview} alt="preview" className="w-28 h-28 rounded-xl object-cover border border-gray-100 bg-[#F3EEFB]" />
                      {uploading && (
                        <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 truncate max-w-xs">{imageFile?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs text-[#9B6FD1] hover:underline">
                        Change image
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Drop zone */
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      dragOver ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-[#9B6FD1]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Drop an image or <span className="text-[#9B6FD1]">browse</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP up to 5 MB</p>
                    </div>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                />

                {uploadError && (
                  <p className="text-red-500 text-xs mt-1.5">{uploadError}</p>
                )}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe this product…" className="input resize-none" />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{uploading ? "Uploading image…" : "Saving…"}</>
                ) : (
                  <><Plus className="w-4 h-4" />Add Product</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Product list ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">All Products</h2>
            <span className="ml-auto text-sm text-gray-400">{products.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
              Loading from Supabase…
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-center">
              <p className="text-red-400 text-sm font-medium">Could not load products</p>
              <p className="text-gray-400 text-xs mt-1">{error}</p>
              <p className="text-gray-400 text-xs mt-2">Check that the <strong>products</strong> table exists and the SELECT policy allows <strong>anon</strong> role.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {products.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-10">No products yet. Add one above.</p>
              )}
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4">
                  <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover bg-[#F3EEFB] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.category} · ₹{p.price}</p>
                  </div>
                  <button onClick={() => setDeleteId(p.id)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete modal ── */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Delete product?</h3>
              <p className="text-sm text-gray-500 mb-5">This will remove it from Supabase and the store.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button disabled={deleting} onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-green-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
        .input { width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.875rem; color: #1f2937; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: white; }
        .input:focus { border-color: #9B6FD1; box-shadow: 0 0 0 3px rgba(155,111,209,0.15); }
      `}</style>
    </div>
  );
}
