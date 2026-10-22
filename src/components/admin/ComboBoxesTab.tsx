import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package2, Plus, Pencil, Trash2, X, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, ImageIcon, ToggleLeft,
  ToggleRight, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useProducts } from "../../context/ProductsContext";
import { uploadToStorage, ConfirmModal } from "./shared";
import { imgUrl } from "../../lib/imgUrl";

// ─── Types ───────────────────────────────────────────────────
interface ComboBox {
  id:               number;
  name:             string;
  description:      string;
  box_image_url:    string | null;
  item_count:       number;
  box_price:        number;
  wholesale_min:    number;
  wholesale_max:    number;
  allow_duplicates: boolean;
  is_active:        boolean;
  sort_order:       number;
  shipping_credit:  number;
  created_at:       string;
}

const EMPTY_FORM = {
  name:             "",
  description:      "",
  item_count:       "3",
  box_price:        "",
  wholesale_min:    "",
  wholesale_max:    "",
  shipping_credit:  "0",
  allow_duplicates: true,
  is_active:        true,
};

// ─── Small helpers ────────────────────────────────────────────
const INP  = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] bg-white";
const LBL  = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1";

// ═══════════════════════════════════════════════════════════════
// BoxForm — shared between Add and Edit
// ═══════════════════════════════════════════════════════════════
interface BoxFormProps {
  initial:   typeof EMPTY_FORM;
  imageUrl:  string | null;
  saving:    boolean;
  onSave:    (form: typeof EMPTY_FORM, imageFile: File | null) => void;
  onCancel:  () => void;
}

function BoxForm({ initial, imageUrl: initialImageUrl, saving, onSave, onCancel }: BoxFormProps) {
  const [form,         setForm]         = useState(initial);
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form, imageFile); }}
      className="p-5 space-y-4 bg-[#F3EEFB]/30 border border-[#9B6FD1]/20 rounded-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Name */}
        <div className="sm:col-span-2">
          <label className={LBL}>Box Name</label>
          <input required value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder='e.g. "Any 3 for ₹299"'
            className={INP} />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={LBL}>Tagline <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Shown below the box name on the storefront"
            className={INP} />
        </div>

        {/* Item count */}
        <div>
          <label className={LBL}>Item Count</label>
          <input required type="number" min="1" max="20"
            value={form.item_count}
            onChange={(e) => set("item_count", e.target.value)}
            placeholder="3"
            className={INP} />
          <p className="text-[11px] text-gray-400 mt-1">How many items customer must pick</p>
        </div>

        {/* Box price */}
        <div>
          <label className={LBL}>Fixed Box Price (₹)</label>
          <input required type="number" min="1"
            value={form.box_price}
            onChange={(e) => set("box_price", e.target.value)}
            placeholder="299"
            className={INP} />
          <p className="text-[11px] text-gray-400 mt-1">Customer always pays this, regardless of items</p>
        </div>

        {/* Shipping credit */}
        <div>
          <label className={LBL}>Shipping Credit (₹)</label>
          <input type="number" min="0"
            value={form.shipping_credit}
            onChange={(e) => set("shipping_credit", e.target.value)}
            placeholder="0"
            className={INP} />
          <p className="text-[11px] text-gray-400 mt-1">Deducted from delivery charge — 0 = no discount</p>
        </div>

        {/* Wholesale range */}
        <div>
          <label className={LBL}>Wholesale Min (₹)</label>
          <input required type="number" min="0" step="0.01"
            value={form.wholesale_min}
            onChange={(e) => set("wholesale_min", e.target.value)}
            placeholder="15"
            className={INP} />
        </div>
        <div>
          <label className={LBL}>Wholesale Max (₹)</label>
          <input required type="number" min="0" step="0.01"
            value={form.wholesale_max}
            onChange={(e) => set("wholesale_max", e.target.value)}
            placeholder="20"
            className={INP} />
          <p className="text-[11px] text-gray-400 mt-1 sm:col-span-2">
            Products with wholesale_price in this range are shown in the box
          </p>
        </div>

        {/* Toggles row */}
        <div className="sm:col-span-2 flex items-center gap-6 flex-wrap">
          {/* Allow duplicates */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => set("allow_duplicates", !form.allow_duplicates)}
              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${form.allow_duplicates ? "bg-[#9B6FD1]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.allow_duplicates ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-xs text-gray-600">Allow same product twice</span>
          </label>

          {/* Active */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => set("is_active", !form.is_active)}
              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${form.is_active ? "bg-emerald-500" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-xs text-gray-600">{form.is_active ? "Active (visible on store)" : "Inactive (hidden)"}</span>
          </label>
        </div>

        {/* Banner image */}
        <div className="sm:col-span-2">
          <label className={LBL}>Banner Image <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Box banner"
                className="h-28 rounded-xl border border-[#9B6FD1]/20 shadow-sm object-cover"
              />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/90 text-[10px] text-gray-600 hover:bg-white shadow transition-colors"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#9B6FD1]/40 hover:border-[#9B6FD1] hover:bg-[#F3EEFB] text-[#9B6FD1] text-xs font-semibold transition-all"
            >
              <ImageIcon className="w-4 h-4" /> Upload Banner Image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Box"}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
// ComboBoxesTab
// ═══════════════════════════════════════════════════════════════
export function ComboBoxesTab() {
  const { products } = useProducts();

  const [boxes,       setBoxes]       = useState<ComboBox[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editBox,     setEditBox]     = useState<ComboBox | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<ComboBox | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // ── Toast ────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("combo_boxes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setBoxes((data ?? []) as ComboBox[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  // ── Eligible products for a box ──────────────────────────────
  const eligibleProducts = useCallback((box: ComboBox) =>
    products.filter((p) =>
      p.wholesale_price > 0 &&
      p.wholesale_price >= box.wholesale_min &&
      p.wholesale_price <= box.wholesale_max
    ),
  [products]);

  // ── Save (create or update) ──────────────────────────────────
  const handleSave = async (form: typeof EMPTY_FORM, imageFile: File | null, existingBox?: ComboBox) => {
    setSaving(true);
    let imageUrl = existingBox?.box_image_url ?? null;

    if (imageFile) {
      try {
        imageUrl = await uploadToStorage(imageFile, `combo-box-${form.name}`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Image upload failed.", "err");
        setSaving(false);
        return;
      }
    }

    const payload = {
      name:             form.name.trim(),
      description:      form.description.trim(),
      box_image_url:    imageUrl,
      item_count:       Math.max(1, parseInt(form.item_count) || 3),
      box_price:        Math.max(0, parseInt(form.box_price as string) || 0),
      wholesale_min:    Math.max(0, parseFloat(form.wholesale_min as string) || 0),
      wholesale_max:    Math.max(0, parseFloat(form.wholesale_max as string) || 9999),
      shipping_credit:  Math.max(0, parseInt(form.shipping_credit as string) || 0),
      allow_duplicates: form.allow_duplicates,
      is_active:        form.is_active,
    };

    if (existingBox) {
      const { error } = await supabase.from("combo_boxes").update(payload).eq("id", existingBox.id);
      if (error) { showToast(error.message, "err"); }
      else        { showToast("Box updated!"); setEditBox(null); fetchBoxes(); }
    } else {
      const { error } = await supabase.from("combo_boxes").insert(payload);
      if (error) { showToast(error.message, "err"); }
      else        { showToast("Box created!"); setShowAdd(false); fetchBoxes(); }
    }
    setSaving(false);
  };

  // ── Toggle active ────────────────────────────────────────────
  const toggleActive = async (box: ComboBox) => {
    const { error } = await supabase
      .from("combo_boxes")
      .update({ is_active: !box.is_active })
      .eq("id", box.id);
    if (!error) {
      setBoxes((prev) => prev.map((b) => b.id === box.id ? { ...b, is_active: !b.is_active } : b));
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("combo_boxes").delete().eq("id", deleteTarget.id);
    if (error) { showToast(error.message, "err"); }
    else        { showToast("Box deleted."); fetchBoxes(); }
    setDeleting(false);
    setDeleteTarget(null);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Top bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package2 className="w-4 h-4 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">Combo Build Boxes</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{boxes.length}</span>
          </div>
          <button
            onClick={() => { setShowAdd((v) => !v); setEditBox(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Box
          </button>
        </div>

        {/* Add form */}
        <AnimatePresence initial={false}>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <div className="p-5">
                <BoxForm
                  initial={{ ...EMPTY_FORM }}
                  imageUrl={null}
                  saving={saving}
                  onSave={(form, file) => handleSave(form, file)}
                  onCancel={() => setShowAdd(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : boxes.length === 0 ? (
          <div className="py-14 text-center">
            <Package2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">No combo boxes yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Box" to create your first offer.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {boxes.map((box) => {
              const eligible  = eligibleProducts(box);
              const expanded  = expandedId === box.id;
              const isEditing = editBox?.id === box.id;

              return (
                <div key={box.id} className="bg-white">

                  {/* Inline edit form */}
                  <AnimatePresence initial={false}>
                    {isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden border-b border-[#9B6FD1]/20"
                      >
                        <div className="p-5">
                          <BoxForm
                            initial={{
                              name:             box.name,
                              description:      box.description,
                              item_count:       String(box.item_count),
                              box_price:        String(box.box_price),
                              wholesale_min:    String(box.wholesale_min),
                              wholesale_max:    String(box.wholesale_max),
                              shipping_credit:  String(box.shipping_credit ?? 0),
                              allow_duplicates: box.allow_duplicates,
                              is_active:        box.is_active,
                            }}
                            imageUrl={box.box_image_url}
                            saving={saving}
                            onSave={(form, file) => handleSave(form, file, box)}
                            onCancel={() => setEditBox(null)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Box row */}
                  {!isEditing && (
                    <div className="px-4 py-4">
                      <div className="flex items-start gap-3">

                        {/* Banner thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F3EEFB] shrink-0 flex items-center justify-center border border-gray-100">
                          {box.box_image_url ? (
                            <img
                              src={imgUrl(box.box_image_url, "tiny")}
                              alt={box.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package2 className="w-6 h-6 text-[#9B6FD1]/40" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-800 text-sm">{box.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${box.is_active ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                              {box.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {box.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{box.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                            <span className="font-semibold text-[#9B6FD1]">Pick {box.item_count} items</span>
                            <span className="text-gray-300">·</span>
                            <span className="font-bold text-gray-800">₹{box.box_price}</span>
                            <span className="text-gray-300">·</span>
                            <span>W-price ₹{box.wholesale_min}–₹{box.wholesale_max}</span>
                            <span className="text-gray-300">·</span>
                            <span className={eligible.length > 0 ? "text-emerald-600 font-semibold" : "text-red-400 font-semibold"}>
                              {eligible.length} eligible product{eligible.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>

                        {/* Desktop stats */}
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
                          <span className="text-lg font-bold text-gray-800">₹{box.box_price}</span>
                          <span className="text-[10px] text-gray-400">{box.item_count} items</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleActive(box)}
                            title={box.is_active ? "Deactivate" : "Activate"}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors">
                            {box.is_active
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft  className="w-5 h-5 text-gray-300" />}
                          </button>
                          <button onClick={() => { setEditBox(box); setShowAdd(false); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(box)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setExpandedId(expanded ? null : box.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors">
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* ── Expanded: eligible products preview ── */}
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 space-y-2">
                              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                Eligible Products ({eligible.length}) — wholesale ₹{box.wholesale_min}–₹{box.wholesale_max}
                              </p>
                              {eligible.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2 bg-gray-50 rounded-xl px-3">
                                  No products match this wholesale price range. Adjust the range or update product wholesale prices.
                                </p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {eligible.map((p) => (
                                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2 border border-gray-100">
                                      <img
                                        src={imgUrl(p.image, "tiny")}
                                        alt={p.name}
                                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-medium text-gray-700 truncate">{p.name}</p>
                                        <p className="text-[10px] text-gray-400">W-₹{p.wholesale_price} · ₹{p.price}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Profit estimate */}
                              {eligible.length > 0 && (() => {
                                const avgCost = eligible.reduce((s, p) => s + p.wholesale_price, 0) / eligible.length;
                                const estProfit = box.box_price - (avgCost * box.item_count) - 10;
                                return (
                                  <div className={`rounded-xl px-3 py-2 text-[11px] ${estProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                    Est. profit (avg cost): ₹{box.box_price} − (avg ₹{avgCost.toFixed(0)} × {box.item_count} + Pkg ₹10) = <strong>₹{estProfit.toFixed(0)}</strong>
                                  </div>
                                );
                              })()}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirm delete ── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete combo box?"
        body={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${toast.type === "err" ? "bg-red-500" : "bg-green-600"}`}
          >
            {toast.type === "err" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
