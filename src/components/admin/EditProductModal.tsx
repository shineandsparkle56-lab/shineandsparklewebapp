import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, X, CheckCircle2, ChevronDown, Image, Plus, Trash2, Tag } from "lucide-react";
import { Product, ProductVariant, variantCover } from "../../data/products";
import { useCategories } from "../../context/CategoriesContext";
import { useProducts } from "../../context/ProductsContext";
import { useFestivals } from "../../context/FestivalsContext";
import { useImageItems } from "../../hooks/useImageItems";
import { DraggableImageGrid } from "../ui/DraggableImageGrid";
import { compressToWebP } from "../../utils/compressToWebP";
import { uploadToR2 } from "../../lib/r2Upload";

const MAX_IMAGES = 6;
const MAX_VARIANT_IMAGES = 4;

interface Props {
  product: Product | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

type FormKey = "name" | "category" | "price" | "originalPrice" | "description" | "stock" | "shipping_credit" | "wholesale_price" | "base_variant_label" | "base_variant_color";

async function uploadFile(file: File, productName?: string): Promise<string> {
  const compressed = await compressToWebP(file, { name: productName });
  return uploadToR2(compressed, productName);
}

// ── Variant row editor ────────────────────────────────────────
interface VariantRowProps {
  variant: ProductVariant;
  productName: string;
  onChange: (updated: ProductVariant) => void;
  onRemove: () => void;
}

function VariantRow({ variant, productName, onChange, onRemove }: VariantRowProps) {
  const varImg = useImageItems(MAX_VARIANT_IMAGES);
  const addMoreRef = useRef<HTMLInputElement>(null);

  // Seed images once when variant first renders
  const seededRef = useRef(false);
  if (!seededRef.current && variant.images?.length) {
    seededRef.current = true;
    varImg.seed(variant.images);
  }

  // Upload any new files and propagate the full images array up
  const handleFiles = async (files: FileList) => {
    varImg.setUploading(true);
    try {
      const newUrls = await Promise.all(
        Array.from(files).map((f) => uploadFile(f, productName || "variant"))
      );
      // Merge existing previews (already-uploaded URLs) + new uploads
      const existingUrls = varImg.items
        .filter((it) => !it.file) // already uploaded — has only preview URL
        .map((it) => it.preview);
      const allUrls = [...existingUrls, ...newUrls];
      varImg.seed(allUrls); // refresh grid with final URLs
      onChange({ ...variant, images: allUrls });
    } catch { /* ignore */ }
    finally { varImg.setUploading(false); }
  };

  // When the grid is reordered or an image removed, sync back to variant
  const syncImages = (items: typeof varImg.items) => {
    const urls = items.filter((it) => !it.file).map((it) => it.preview);
    onChange({ ...variant, images: urls });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-3">
      {/* Top row: label, stock, price, color, delete */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Color swatch */}
        <div className="relative shrink-0" title="Pick swatch color">
          <div
            className="w-10 h-10 rounded-xl border-2 border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#9B6FD1] transition-colors"
            style={{ backgroundColor: variant.color || "#e5e7eb" }}
            onClick={() => (document.getElementById(`color-${variant.id}`) as HTMLInputElement)?.click()}
          >
            {!variant.color && <span className="text-[9px] text-gray-400 text-center leading-tight">Color</span>}
          </div>
          <input
            id={`color-${variant.id}`}
            type="color"
            value={variant.color || "#9B6FD1"}
            onChange={(e) => onChange({ ...variant, color: e.target.value })}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>

        <input
          value={variant.label}
          onChange={(e) => onChange({ ...variant, label: e.target.value })}
          placeholder="e.g. Gold, Silver"
          className="flex-1 min-w-[100px] text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
        />

        <div className="flex flex-col items-center shrink-0">
          <span className="text-[10px] text-gray-400 mb-0.5">Stock</span>
          <input
            type="number" min="0"
            value={variant.stock}
            onChange={(e) => onChange({ ...variant, stock: Math.max(0, Number(e.target.value) || 0) })}
            className="w-16 text-sm px-2 py-2 rounded-xl border border-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
          />
        </div>

        <div className="flex flex-col items-center shrink-0">
          <span className="text-[10px] text-gray-400 mb-0.5">Price (opt)</span>
          <input
            type="number" min="0"
            value={variant.price ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Math.max(0, Number(e.target.value));
              onChange({ ...variant, price: v });
            }}
            placeholder="—"
            className="w-20 text-sm px-2 py-2 rounded-xl border border-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
          />
        </div>

        <button onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Image grid */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5">
          Photos for this variant
          <span className="ml-1 text-gray-300">(first = cover · max {MAX_VARIANT_IMAGES})</span>
        </p>
        {varImg.items.length > 0 ? (
          <DraggableImageGrid
            items={varImg.items}
            onReorder={(items) => { varImg.setItems(items); syncImages(items); }}
            onRemove={(id) => {
              varImg.remove(id);
              // After removal, sync remaining uploaded URLs back to the variant
              const remaining = varImg.items
                .filter((it) => it.id !== id && !it.file)
                .map((it) => it.preview);
              onChange({ ...variant, images: remaining });
            }}
            onAddMore={varImg.items.length < MAX_VARIANT_IMAGES ? () => addMoreRef.current?.click() : undefined}
            maxImages={MAX_VARIANT_IMAGES}
            newBadge={false}
            tileSize="w-28 h-28"
          />
        ) : (
          <button
            type="button"
            onClick={() => addMoreRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]/50 transition-colors text-xs text-gray-400 hover:text-[#9B6FD1]"
          >
            <Plus className="w-3.5 h-3.5" /> Add photos
          </button>
        )}
        <input
          ref={addMoreRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
        />
        {varImg.uploading && (
          <p className="text-[11px] text-[#9B6FD1] mt-1 flex items-center gap-1">
            <span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />
            Uploading…
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────
export function EditProductModal({ product, onClose, onSaved, onError }: Props) {
  const { categories } = useCategories();
  const { updateProduct } = useProducts();
  const { festivals } = useFestivals();
  const img = useImageItems(MAX_IMAGES);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", category: "", price: "", originalPrice: "",
    description: "", stock: "", shipping_credit: "", wholesale_price: "",
    base_variant_label: "", base_variant_color: "",
  });
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
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
      base_variant_label: product.base_variant_label ?? "",
      base_variant_color: product.base_variant_color ?? "",
    });
    setVariants(product.variants ?? []);
    setTags(product.tags ?? []);
    setSizes(product.sizes ?? []);
    const urls = product.images?.length ? product.images : [product.image];
    img.seed(urls);
  }

  // Collect every section tag used across all festivals — deduped
  const allSectionTags = Array.from(
    new Set(festivals.flatMap((f) => f.sections.map((s) => s.tag)).filter(Boolean))
  ).sort();

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const set = (k: FormKey, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const addVariant = () => setVariants((prev) => [...prev, {
    id: `var-${Date.now()}`,
    label: "",
    images: [],
    stock: 0,
  }]);

  const updateVariant = (idx: number, updated: ProductVariant) =>
    setVariants((prev) => prev.map((v, i) => i === idx ? updated : v));

  const removeVariant = (idx: number) =>
    setVariants((prev) => prev.filter((_, i) => i !== idx));

  // base stock is stored in product.stock; variant stocks stored in variants[]
  // effectiveStock here is just for display in the header label
  const baseStock = Number(form.stock) || 0;
  const effectiveStock = variants.length > 0
    ? baseStock + variants.reduce((s, v) => s + v.stock, 0)
    : baseStock;

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

    const cleanedVariants: ProductVariant[] = variants.map((v) => ({
      ...v,
      id: v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: v.label.trim() || "Variant",
      images: v.images ?? [],
    }));

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
        stock: Number(form.stock) || 0,  // base stock only — variant stocks live in variants[]
        shipping_credit: Math.max(0, Number(form.shipping_credit) || 0),
        wholesale_price: Math.max(0, Number(form.wholesale_price) || 0),
        variants: cleanedVariants,
        base_variant_label: form.base_variant_label.trim() || undefined,
        base_variant_color: form.base_variant_color.trim() || undefined,
        tags,
        sizes,
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
                {variants.length === 0 && (
                  <div>
                    <label className="label">Stock Quantity</label>
                    <input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className="input" />
                  </div>
                )}
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
                  <p className="text-[11px] text-gray-400 mt-1">Your cost price — admin only</p>
                </div>

                {/* Product Images */}
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

                {/* ── Variants ── */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="label mb-0">Variants <span className="text-gray-400 font-normal normal-case">(colour / design)</span></label>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {variants.length === 0
                          ? "No variants — single product. Add variants for Gold/Silver etc."
                          : `${variants.length} variant${variants.length > 1 ? "s" : ""} · total stock ${effectiveStock}`}
                      </p>
                    </div>
                    <button type="button" onClick={addVariant}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors shrink-0">
                      <Plus className="w-3.5 h-3.5" /> Add Variant
                    </button>
                  </div>

                  {/* Base variant label + stock — only when variants exist */}
                  {variants.length > 0 && (
                    <div className="mb-3 p-3 rounded-xl bg-[#F3EEFB]/60 border border-[#9B6FD1]/20 space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                          Default option label
                        </label>
                        <div className="flex items-center gap-2">
                          {/* Color swatch for the default/base variant */}
                          <div className="relative shrink-0" title="Pick swatch color for default option">
                            <div
                              className="w-9 h-9 rounded-xl border-2 border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#9B6FD1] transition-colors"
                              style={{ backgroundColor: form.base_variant_color || "#e5e7eb" }}
                              onClick={() => (document.getElementById("base-variant-color-edit") as HTMLInputElement)?.click()}
                            >
                              {!form.base_variant_color && (
                                <span className="text-[9px] text-gray-400 text-center leading-tight">Color</span>
                              )}
                            </div>
                            <input
                              id="base-variant-color-edit"
                              type="color"
                              value={form.base_variant_color || "#9B6FD1"}
                              onChange={(e) => set("base_variant_color", e.target.value)}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                          </div>
                          <input
                            value={form.base_variant_label}
                            onChange={(e) => set("base_variant_label", e.target.value)}
                            placeholder="e.g. Gold, Default, Original"
                            className="input text-sm flex-1"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          This names the option that uses the main product images above. Leave blank to show "Default".
                        </p>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                          Default option stock qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.stock}
                          onChange={(e) => set("stock", e.target.value)}
                          placeholder="0"
                          className="input text-sm"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Stock for the "{form.base_variant_label || "Default"}" option (uses main product images).
                        </p>
                      </div>
                    </div>
                  )}

                  {variants.length > 0 && (
                    <div className="space-y-3">
                      {variants.map((v, idx) => (
                        <VariantRow
                          key={v.id}
                          variant={v}
                          productName={form.name}
                          onChange={(updated) => updateVariant(idx, updated)}
                          onRemove={() => removeVariant(idx)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className="input resize-none" />
                </div>

                {/* ── Festival Tags ── */}
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-[#9B6FD1]" />
                    <label className="label mb-0">Festival Tags</label>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Tag this product to include it in festival store sections.
                    Tags come from the sections you defined in each festival.
                  </p>

                  {allSectionTags.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">
                      No festival sections defined yet — create a festival first in the Festivals tab.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allSectionTags.map((tag) => {
                        const active = tags.includes(tag);
                        // Find which festival this tag belongs to for context
                        const festName = festivals.find((f) =>
                          f.sections.some((s) => s.tag === tag)
                        )?.name ?? "";
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                              active
                                ? "bg-[#9B6FD1] border-[#9B6FD1] text-white shadow-sm"
                                : "bg-white border-gray-200 text-gray-500 hover:border-[#9B6FD1]/50 hover:text-[#9B6FD1]"
                            }`}
                          >
                            <span className="font-mono">{tag}</span>
                            {festName && (
                              <span className={`text-[9px] ${active ? "text-white/70" : "text-gray-400"}`}>
                                · {festName}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual tag input for tags not in any festival section */}
                  <div className="mt-2">
                    <p className="text-[11px] text-gray-400 mb-1">Custom tags (type + press Enter):</p>
                    <input
                      type="text"
                      placeholder="e.g. navratri-bangles"
                      className="input text-sm font-mono"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                          if (val && !tags.includes(val)) setTags((prev) => [...prev, val]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>

                  {/* Current tags badge list */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map((tag) => (
                        <span key={tag}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#F3EEFB] text-[#9B6FD1]">
                          {tag}
                          <button type="button" onClick={() => toggleTag(tag)}
                            className="ml-0.5 hover:text-red-400 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Sizes ── */}
                <div className="sm:col-span-2">
                  <label className="label">Sizes <span className="font-normal text-gray-400 normal-case">(e.g. 2.4, 2.6, 2.8 for bangles)</span></label>
                  <p className="text-[11px] text-gray-400 mb-2">
                    Type a size and press Enter or click Add.
                  </p>
                  {/* Input + Add button */}
                  {(() => {
                    const addSize = (input: HTMLInputElement | null) => {
                      if (!input) return;
                      const val = input.value.trim();
                      if (val && !sizes.includes(val)) setSizes((prev) => [...prev, val]);
                      input.value = "";
                      input.focus();
                    };
                    return (
                      <div className="flex gap-2 mb-2">
                        <input
                          id="size-input"
                          type="text"
                          placeholder="e.g. 2.4"
                          className="input text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSize(e.target as HTMLInputElement);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addSize(document.getElementById("size-input") as HTMLInputElement)}
                          className="px-3 py-2 bg-[#9B6FD1] text-white text-xs font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                    );
                  })()}
                  {/* Size badges */}
                  {sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sizes.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                          {s}
                          <button type="button" onClick={() => setSizes((prev) => prev.filter((x) => x !== s))}
                            className="ml-0.5 hover:text-red-400 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
