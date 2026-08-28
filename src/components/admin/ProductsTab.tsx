import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Package, ChevronDown, Upload, X, Image,
  Download, Loader2, Minus, Pencil, Search, SlidersHorizontal,
} from "lucide-react";
import { useProducts } from "../../context/ProductsContext";
import { useCategories } from "../../context/CategoriesContext";
import { Product } from "../../data/products";
import type { ProductVariant } from "../../data/products";
import { DraggableImageGrid } from "../ui/DraggableImageGrid";
import { useImageItems } from "../../hooks/useImageItems";
import { useToast } from "../../hooks/useToast";
import JSZip from "jszip";
import { imgUrl } from "../../lib/imgUrl";
import { EditProductModal } from "./EditProductModal";
import { ConfirmModal, Spinner, uploadToStorage } from "./shared";

const MAX_IMAGES = 6;
const EMPTY_FORM = {
  name: "", category: "", price: "", originalPrice: "", description: "",
  stock: "10", shipping_credit: "0", wholesale_price: "0",
  base_variant_label: "", base_variant_color: "",
};
const BATCH_SIZE = 10;

export function ProductsTab() {
  const { products, addProduct, deleteProduct, updateStock, loading, error } = useProducts();
  const { categories } = useCategories();
  const toast = useToast();
  const img = useImageItems(MAX_IMAGES);
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [addFormVariants, setAddFormVariants] = useState<ProductVariant[]>([]);
  const [variantUploading, setVariantUploading] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "sns-asc" | "sns-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc"
  >("newest");

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [downloadingProductId, setDownloadingProductId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Auto-select first category
  const firstCat = categories[0]?.name ?? "";
  const effectiveCategory = form.category || firstCat;

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `sns-${p.id}` === searchQuery.toLowerCase().trim() ||
        String(p.id) === searchQuery.trim();
      const matchCat = filterCategory === "all" || p.category === filterCategory;
      const totalStk = p.variants?.length
        ? p.stock + (p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0)
        : p.stock;
      const matchStock = filterStock === "all" ||
        (filterStock === "in" ? totalStk > 0 : totalStk === 0);
      return matchSearch && matchCat && matchStock;
    });
    const totalStk = (p: typeof products[number]) =>
      p.variants?.length ? p.stock + (p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0) : p.stock;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":     return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case "oldest":     return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        case "sns-desc":   return b.id - a.id;
        case "sns-asc":    return a.id - b.id;
        case "price-asc":  return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "stock-asc":  return totalStk(a) - totalStk(b);
        case "stock-desc": return totalStk(b) - totalStk(a);
        default: return 0;
      }
    });
  }, [products, searchQuery, filterCategory, filterStock, sortBy]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) img.add(e.dataTransfer.files);
  }, [img]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price), originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;
    setSaving(true); img.setError("");
    let imageUrls: string[] = [];
    if (img.items.length > 0) {
      try {
        img.setUploading(true);
        imageUrls = await Promise.all(img.items.map((it) => uploadToStorage(it.file!, form.name.trim())));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        img.setError(msg.toLowerCase().includes("bucket")
          ? 'Storage bucket missing. Go to Supabase → Storage → New bucket → name "product-images" → set Public.'
          : msg);
        img.setUploading(false); setSaving(false); return;
      } finally { img.setUploading(false); }
    }
    if (!imageUrls.length)
      imageUrls = [`https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`];
    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    const baseStock = Math.max(0, Number(form.stock) || 0);
    const cleanedVariants: ProductVariant[] = addFormVariants.map((v) => ({
      ...v,
      id: v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: v.label.trim() || "Variant",
    }));
    try {
      await addProduct({
        name: form.name.trim(), category: effectiveCategory, price, originalPrice, discount,
        image: imageUrls[0], images: imageUrls, description: form.description.trim(),
        stock: baseStock, shipping_credit: Math.max(0, Number(form.shipping_credit) || 0),
        wholesale_price: Math.max(0, Number(form.wholesale_price) || 0),
        variants: cleanedVariants,
        base_variant_label: form.base_variant_label.trim() || undefined,
        base_variant_color: form.base_variant_color.trim() || undefined,
        tags: [],
        sizes: [],
      });
      setForm({ ...EMPTY_FORM, category: firstCat });
      setAddFormVariants([]); img.clear();
      toast.show("Product saved!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save product.", "error");
    } finally { setSaving(false); }
  };

  const handleDeleteProduct = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    const product = products.find((p) => p.id === deleteId);
    const imageUrls = product?.images?.length ? product.images : product?.image ? [product.image] : [];
    await deleteProduct(deleteId, imageUrls);
    setDeleting(false); setDeleteId(null);
  };

  const handleDownloadProductImages = async (product: Product) => {
    const images = product.images?.length ? product.images : product.image ? [product.image] : [];
    if (!images.length) { toast.show("No images to download.", "error"); return; }
    setDownloadingProductId(product.id);
    try {
      const zip = new JSZip();
      const zipName = `SNS-${product.id}`;
      const folder = zip.folder(zipName)!;
      await Promise.all(images.map(async (url, idx) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image ${idx + 1}`);
        const blob = await res.blob();
        const ext = url.split(".").pop()?.split("?")[0] || "jpg";
        folder.file(`${zipName}-${idx + 1}.${ext}`, blob);
      }));
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${zipName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Download failed.", "error");
    } finally { setDownloadingProductId(null); }
  };

  return (
    <>
      {/* ── Add Product ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">Add New Product</h2>
        </div>
        <form onSubmit={handleAddProduct} className="p-6 space-y-5">
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
                <select value={effectiveCategory} onChange={(e) => set("category", e.target.value)} className="input appearance-none pr-8 capitalize">
                  {categories.filter(c => c.parent_id === null).map((parent) => {
                    const children = categories.filter(c => c.parent_id === parent.id);
                    return children.length > 0 ? (
                      <optgroup key={parent.id} label={parent.label}>
                        <option value={parent.name}>{parent.label} (All)</option>
                        {children.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                      </optgroup>
                    ) : (
                      <option key={parent.name} value={parent.name} className="capitalize">{parent.label}</option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            {/* Selling price */}
            <div>
              <label className="label">Selling Price (₹)</label>
              <input required type="number" min="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="799" className="input" />
            </div>
            {/* Original price */}
            <div>
              <label className="label">Original Price (₹)</label>
              <input required type="number" min="1" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="1199" className="input" />
            </div>

            {/* Images */}
            <div className="sm:col-span-2">
              <label className="label">
                <Image className="w-3.5 h-3.5 inline mr-1" />
                Product Images
                <span className="text-gray-400 font-normal normal-case ml-1">(up to {MAX_IMAGES} · first is cover · drag to reorder)</span>
              </label>
              {img.items.length > 0 ? (
                <DraggableImageGrid items={img.items} onReorder={img.setItems} onRemove={img.remove}
                  onAddMore={img.items.length < MAX_IMAGES ? () => img.inputRef.current?.click() : undefined} maxImages={MAX_IMAGES} />
              ) : (
                <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                  onClick={() => img.inputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"}`}>
                  <div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-[#9B6FD1]" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Drop images or <span className="text-[#9B6FD1]">browse</span></p>
                  <p className="text-xs text-gray-400">PNG, JPG, WEBP · up to {MAX_IMAGES} images</p>
                </div>
              )}
              <input ref={img.inputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) img.add(e.target.files); }} />
              {img.error && <p className="text-red-500 text-xs mt-1.5">{img.error}</p>}
              {img.uploading && (
                <p className="text-[#9B6FD1] text-xs mt-1.5 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />
                  Uploading {img.items.length} image{img.items.length > 1 ? "s" : ""}…
                </p>
              )}
            </div>
            {/* Description */}
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe this product…" className="input resize-none" />
            </div>
            {/* Stock — only when no variants */}
            {addFormVariants.length === 0 && (
              <div>
                <label className="label">Stock Quantity</label>
                <input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className="input" />
                <p className="text-[11px] text-gray-400 mt-1">Set to 0 to mark as Out of Stock</p>
              </div>
            )}
            <div>
              <label className="label">Shipping Credit (₹)</label>
              <input type="number" min="0" value={form.shipping_credit} onChange={(e) => set("shipping_credit", e.target.value)} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">₹ deducted from shipping per unit in cart</p>
            </div>
            <div>
              <label className="label">Wholesale Price (₹)</label>
              <input type="number" min="0" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">Your cost price — admin only</p>
            </div>

            {/* Variants */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="label mb-0">Variants <span className="text-gray-400 font-normal normal-case">(colour / design)</span></label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {addFormVariants.length === 0
                      ? "No variants — single product. Add variants for Gold/Silver etc."
                      : `${addFormVariants.length} variant${addFormVariants.length > 1 ? "s" : ""} · total stock ${addFormVariants.reduce((s, v) => s + v.stock, 0)}`}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setAddFormVariants((prev) => [...prev, { id: `var-${Date.now()}`, label: "", images: [], stock: 0 }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add Variant
                </button>
              </div>

              {addFormVariants.length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-[#F3EEFB]/60 border border-[#9B6FD1]/20 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Default option label</label>
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0" title="Pick swatch color for default option">
                        <div className="w-9 h-9 rounded-xl border-2 border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#9B6FD1] transition-colors"
                          style={{ backgroundColor: form.base_variant_color || "#e5e7eb" }}
                          onClick={() => (document.getElementById("base-variant-color-add") as HTMLInputElement)?.click()}>
                          {!form.base_variant_color && <span className="text-[9px] text-gray-400 text-center leading-tight">Color</span>}
                        </div>
                        <input id="base-variant-color-add" type="color" value={form.base_variant_color || "#9B6FD1"}
                          onChange={(e) => set("base_variant_color", e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <input value={form.base_variant_label} onChange={(e) => set("base_variant_label", e.target.value)}
                        placeholder="e.g. Gold, Default, Original" className="input text-sm flex-1" />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Names the option using the main product images. Leave blank to show "Default".</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Default option stock qty</label>
                    <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="0" className="input text-sm" />
                    <p className="text-[11px] text-gray-400 mt-1">Stock for the "{form.base_variant_label || "Default"}" option.</p>
                  </div>
                </div>
              )}

              {addFormVariants.length > 0 && (
                <div className="space-y-3">
                  {addFormVariants.map((v, idx) => (
                    <div key={v.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative shrink-0" title="Pick swatch color">
                          <div className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-[#9B6FD1] transition-colors flex items-center justify-center"
                            style={{ backgroundColor: v.color || "#e5e7eb" }}
                            onClick={() => (document.getElementById(`acolor-${v.id}`) as HTMLInputElement)?.click()}>
                            {!v.color && <span className="text-[9px] text-gray-400 text-center leading-tight">Color</span>}
                          </div>
                          <input id={`acolor-${v.id}`} type="color" value={v.color || "#9B6FD1"}
                            onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </div>
                        <input value={v.label}
                          onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                          placeholder="e.g. Gold, Silver"
                          className="flex-1 min-w-[100px] text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]" />
                        <div className="flex flex-col items-center shrink-0">
                          <span className="text-[10px] text-gray-400 mb-0.5">Stock</span>
                          <input type="number" min="0" value={v.stock}
                            onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, stock: Math.max(0, Number(e.target.value) || 0) } : x))}
                            className="w-16 text-sm px-2 py-2 rounded-xl border border-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]" />
                        </div>
                        <button type="button" onClick={() => setAddFormVariants((prev) => prev.filter((_, i) => i !== idx))}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <p className="text-[11px] text-gray-400 mb-1.5">Photos for this variant <span className="text-gray-300">(first = cover · max 4)</span></p>
                        {(v.images?.length ?? 0) > 0 ? (
                          <DraggableImageGrid
                            items={(v.images ?? []).map((url) => ({ id: url, preview: url, file: undefined }))}
                            onReorder={(items) => { const urls = items.map((it) => it.preview); setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, images: urls } : x)); }}
                            onRemove={(id) => { const urls = (v.images ?? []).filter((url) => url !== id); setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, images: urls } : x)); }}
                            onAddMore={(v.images?.length ?? 0) < 4 ? () => variantFileRefs.current[v.id]?.click() : undefined}
                            maxImages={4} newBadge={false} tileSize="w-28 h-28" />
                        ) : (
                          <button type="button" onClick={() => variantFileRefs.current[v.id]?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]/50 transition-colors text-xs text-gray-400 hover:text-[#9B6FD1]">
                            <Plus className="w-3.5 h-3.5" /> Add photos
                          </button>
                        )}
                        <input type="file" accept="image/*" multiple className="hidden"
                          ref={(el) => { variantFileRefs.current[v.id] = el; }}
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files?.length) return;
                            setVariantUploading((prev) => ({ ...prev, [v.id]: true }));
                            try {
                              const newUrls = await Promise.all(Array.from(files).map((f) => uploadToStorage(f, form.name.trim() || "variant")));
                              setAddFormVariants((prev) => prev.map((x) =>
                                x.id === v.id ? { ...x, images: [...(x.images ?? []), ...newUrls].slice(0, 4) } : x
                              ));
                            } catch { /* ignore */ }
                            finally { setVariantUploading((prev) => ({ ...prev, [v.id]: false })); }
                          }} />
                        {variantUploading[v.id] && (
                          <p className="text-[11px] text-[#9B6FD1] mt-1 flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />Uploading…
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
              {saving ? <><Spinner />{img.uploading ? "Uploading…" : "Saving…"}</> : <><Plus className="w-4 h-4" />Add Product</>}
            </button>
          </div>
        </form>
      </div>

      {/* ── Product List ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">All Products</h2>
          <span className="ml-auto text-sm text-gray-400">
            {filteredProducts.length !== products.length ? `${filteredProducts.length} of ${products.length}` : `${products.length} total`}
          </span>
        </div>

        {!loading && !error && products.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search products…" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(BATCH_SIZE); }}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] bg-gray-50" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
            </div>
            <div className="relative">
              <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setVisibleCount(BATCH_SIZE); }}
                className="appearance-none pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-gray-50 capitalize">
                <option value="all">All Categories</option>
                {categories.map((c) => <option key={c.name} value={c.name} className="capitalize">{c.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 text-xs">
              {([["all", "All"], ["in", "In Stock"], ["out", "Out"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => { setFilterStock(val); setVisibleCount(BATCH_SIZE); }}
                  className={`px-3 py-2 font-medium transition-colors ${filterStock === val ? "bg-[#9B6FD1] text-white" : "text-gray-500 hover:text-gray-700"}`}>{label}</button>
              ))}
            </div>
            {(searchQuery || filterCategory !== "all" || filterStock !== "all") && (
              <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStock("all"); setVisibleCount(BATCH_SIZE); }}
                className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:text-red-600 rounded-xl border border-red-200 hover:bg-red-50 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            <div className="relative ml-auto">
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setVisibleCount(BATCH_SIZE); }}
                className="appearance-none pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-gray-50 font-medium text-gray-600">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="sns-desc">SNS# High → Low</option>
                <option value="sns-asc">SNS# Low → High</option>
                <option value="price-desc">Price High → Low</option>
                <option value="price-asc">Price Low → High</option>
                <option value="stock-desc">Stock High → Low</option>
                <option value="stock-asc">Stock Low → High</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2"><Spinner />Loading…</div>
        ) : error ? (
          <div className="px-6 py-8 text-center"><p className="text-red-400 text-sm font-medium">Could not load products</p><p className="text-gray-400 text-xs mt-1">{error}</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <SlidersHorizontal className="w-8 h-8 text-gray-200" />
                <p className="text-gray-400 text-sm">{products.length === 0 ? "No products yet. Add one above." : "No products match your filters."}</p>
              </div>
            )}
            {visibleProducts.map((p) => (
              <div key={p.id} className="px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <img src={imgUrl(p.images?.[0] ?? p.image, "tiny")} alt={p.name}
                    onClick={() => setPreviewImg(imgUrl(p.images?.[0] ?? p.image, "full"))}
                    className="w-20 h-20 rounded-xl object-cover bg-[#F3EEFB] border border-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                      <span className="text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">SNS-{p.id}</span>
                    </div>
                    <p className="text-xs text-gray-400 capitalize">{p.category} · ₹{p.price}{p.images?.length > 1 && <span className="ml-1 text-[#9B6FD1]">· {p.images.length} photos</span>}</p>
                    {p.wholesale_price > 0 && (() => {
                      const margin = p.price - p.wholesale_price - (p.shipping_credit ?? 0);
                      const pct = Math.round((margin / p.price) * 100);
                      return (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">Cost ₹{p.wholesale_price}</span>
                          {p.shipping_credit > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500">Ship Credit ₹{p.shipping_credit}</span>}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${margin >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>Margin ₹{margin} ({pct}%)</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleDownloadProductImages(p)} disabled={downloadingProductId === p.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Download images">
                      {downloadingProductId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditProduct(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteId(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {/* Stock row */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const variantStock = (p.variants ?? []).reduce((s, v) => s + v.stock, 0);
                    const totalStk = p.variants?.length ? p.stock + variantStock : p.stock;
                    return (
                      <>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${totalStk === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                          {totalStk === 0 ? "OUT OF STOCK" : `${totalStk} in stock`}
                        </span>
                        {p.variants?.length ? (
                          <span className="text-[10px] text-gray-400">{p.stock} base + {variantStock} variants</span>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                            <button type="button" onClick={() => updateStock(p.id, p.stock - 1)} disabled={p.stock === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] disabled:opacity-30 transition-colors"><Minus className="w-3 h-3" /></button>
                            <span className="text-sm font-semibold text-gray-700 w-8 text-center">{p.stock}</span>
                            <button type="button" onClick={() => updateStock(p.id, p.stock + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] transition-colors"><Plus className="w-3 h-3" /></button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="px-4 py-4 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400">Showing {visibleProducts.length} of {filteredProducts.length}</span>
                <button onClick={() => setVisibleCount((c) => c + BATCH_SIZE)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors">
                  <Plus className="w-3.5 h-3.5" />Load {Math.min(BATCH_SIZE, filteredProducts.length - visibleCount)} more
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {previewImg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}>
            <motion.img initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              src={previewImg} alt="Product preview"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <EditProductModal product={editProduct} onClose={() => setEditProduct(null)}
        onSaved={(msg) => toast.show(msg)} onError={(msg) => toast.show(msg, "error")} />

      <ConfirmModal open={deleteId !== null} title="Delete product?"
        body="This will remove it from Supabase and the store."
        onConfirm={handleDeleteProduct} onCancel={() => setDeleteId(null)} loading={deleting} />
    </>
  );
}
