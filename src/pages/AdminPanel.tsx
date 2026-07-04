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
const MAX_IMAGES = 5;

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

  // Multi-image state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
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

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { imagePreviews.forEach((p) => URL.revokeObjectURL(p)); };
  }, []);

  // ── Image helpers ────────────────────────────────────────────
  const addFiles = (incoming: FileList | File[]) => {
    setUploadError("");
    const arr = Array.from(incoming);
    const slots = MAX_IMAGES - imageFiles.length;
    if (slots <= 0) { setUploadError(`Max ${MAX_IMAGES} images allowed.`); return; }
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (const file of arr.slice(0, slots)) {
      if (!file.type.startsWith("image/")) { setUploadError("Only image files are supported."); continue; }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearImages = () => {
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
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

  // ── Form submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    const originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;

    setSaving(true);
    setUploadError("");

    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      try {
        setUploading(true);
        imageUrls = await Promise.all(imageFiles.map((f) => uploadToStorage(f)));
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

    if (imageUrls.length === 0) {
      const placeholder = `https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`;
      imageUrls = [placeholder];
    }

    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    await addProduct({
      name: form.name.trim(),
      category: form.category,
      price,
      originalPrice,
      discount,
      image: imageUrls[0],
      images: imageUrls,
      description: form.description.trim(),
      sizes: SIZES_BY_CATEGORY[form.category],
    });

    setSaving(false);
    setForm(empty);
    clearImages();
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

  // ── Drag & drop ──────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
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
            <button
              onClick={() => { sessionStorage.removeItem("sns_admin"); navigate("/admin"); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
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

              {/* ── Multi-image upload ── */}
              <div className="sm:col-span-2">
                <label className="label">
                  <Image className="w-3.5 h-3.5 inline mr-1" /> Product Images
                  <span className="text-gray-400 font-normal normal-case ml-1">(up to {MAX_IMAGES} · first is the cover)</span>
                </label>

                {/* Thumbnail previews */}
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {imagePreviews.map((src, idx) => (
                      <div key={idx} className="relative group w-20 h-20 shrink-0">
                        <img src={src} alt={`Image ${idx + 1}`} className="w-full h-full rounded-xl object-cover border border-gray-100 bg-[#F3EEFB]" />
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-[#9B6FD1] text-white px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* Add-more tile */}
                    {imagePreviews.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#9B6FD1] hover:text-[#9B6FD1] transition-colors shrink-0"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px]">Add more</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Drop zone — only when no images selected yet */}
                {imagePreviews.length === 0 && (
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
                      <p className="text-sm font-medium text-gray-700">Drop images or <span className="text-[#9B6FD1]">browse</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP · up to {MAX_IMAGES} images</p>
                    </div>
                  </div>
                )}

                {/* Hidden multi-file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }}
                />

                {uploadError && <p className="text-red-500 text-xs mt-1.5">{uploadError}</p>}
                {uploading && (
                  <p className="text-[#9B6FD1] text-xs mt-1.5 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />
                    Uploading {imageFiles.length} image{imageFiles.length > 1 ? "s" : ""}…
                  </p>
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
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{uploading ? "Uploading images…" : "Saving…"}</>
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
                  <div className="flex -space-x-2 shrink-0">
                    {(p.images?.length ? p.images.slice(0, 3) : [p.image]).map((img, i) => (
                      <img key={i} src={img} alt={p.name} className="w-12 h-12 rounded-xl object-cover bg-[#F3EEFB] border-2 border-white" style={{ zIndex: 3 - i }} />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {p.category} · ₹{p.price}
                      {p.images?.length > 1 && <span className="ml-1 text-[#9B6FD1]">· {p.images.length} photos</span>}
                    </p>
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
