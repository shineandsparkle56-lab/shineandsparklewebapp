import { useState, useRef } from "react";
import { Plus, Trash2, Tag, ChevronDown, ImagePlus, Loader2, X } from "lucide-react";
import { useCategories } from "../../context/CategoriesContext";
import { useToast } from "../../hooks/useToast";
import { useSettings } from "../../hooks/useSettings";
import { ConfirmModal, Spinner } from "./shared";
import { imgUrl } from "../../lib/imgUrl";

/** Resize an image file to maxSize×maxSize and return base64 string (no data: prefix) */
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/webp", 0.85);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function CategoriesTab() {
  const { categories, addCategory, deleteCategory, updateCategoryImage } = useCategories();
  const { allCategoryImage, setAllCategoryImage } = useSettings();
  const toast = useToast();

  const [catName, setCatName] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catParentId, setCatParentId] = useState<number | "">("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadingAll, setUploadingAll] = useState(false);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const allFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAllImageUpload = async (file: File) => {
    setUploadingAll(true);
    try {
      const base64 = await resizeImage(file, 200);
      const res = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64,
          fileType: "image/webp",
          fileName: `category-all-${Date.now()}.webp`,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      await setAllCategoryImage(data.url);
      toast.show("'All' image updated!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploadingAll(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catLabel.trim()) return;
    setCatSaving(true); setCatError("");
    try {
      await addCategory(catName, catLabel, catParentId === "" ? null : catParentId);
      setCatName(""); setCatLabel(""); setCatParentId("");
      toast.show("Category added!");
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to add category.");
    }
    setCatSaving(false);
  };

  const handleDeleteCategory = async () => {
    if (deleteCatId === null) return;
    setDeletingCat(true);
    try { await deleteCategory(deleteCatId); toast.show("Category deleted."); }
    catch (err) { toast.show(err instanceof Error ? err.message : "Delete failed.", "error"); }
    setDeletingCat(false);
    setDeleteCatId(null);
  };

  const handleImageUpload = async (catId: number, file: File) => {
    setUploadingId(catId);
    try {
      // Resize to max 200×200 before uploading
      const base64 = await resizeImage(file, 200);

      const res = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64,
          fileType: "image/webp",
          fileName: `category-${catId}-${Date.now()}.webp`,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");

      await updateCategoryImage(catId, data.url);
      toast.show("Image updated!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveImage = async (catId: number) => {
    try {
      await updateCategoryImage(catId, null);
      toast.show("Image removed.");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to remove image.", "error");
    }
  };

  const parentCats = categories.filter((c) => c.parent_id === null);

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden categories-form">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">Add New Category</h2>
        </div>
        <form onSubmit={handleAddCategory} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Type</label>
              <div className="relative">
                <select value={catParentId}
                  onChange={(e) => setCatParentId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="input appearance-none pr-8">
                  <option value="">Top-level category (e.g. Earrings, Rings)</option>
                  {parentCats.map((c) => (
                    <option key={c.id} value={c.id}>Subcategory under: {c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {catParentId === "" ? "Creates a main filter tab on the storefront." : "Creates a sub-filter under the selected category."}
              </p>
            </div>
            <div>
              <label className="label">Slug (internal name)</label>
              <input required value={catName} onChange={(e) => setCatName(e.target.value)}
                placeholder={catParentId === "" ? "e.g. earrings" : "e.g. stud-earrings"} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">Lowercase, no spaces — used for filtering</p>
            </div>
            <div>
              <label className="label">Display Label</label>
              <input required value={catLabel} onChange={(e) => setCatLabel(e.target.value)}
                placeholder={catParentId === "" ? "e.g. Earrings" : "e.g. Stud Earrings"} className="input" />
              <p className="text-[11px] text-gray-400 mt-1">Shown to customers on the storefront</p>
            </div>
          </div>
          {catError && <p className="text-red-500 text-xs">{catError}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={catSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
              {catSaving ? <><Spinner />Saving…</> : <><Plus className="w-4 h-4" />{catParentId === "" ? "Add Category" : "Add Subcategory"}</>}
            </button>
          </div>
        </form>
      </div>

      {/* Category list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Tag className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">All Categories</h2>
          <span className="ml-auto text-sm text-gray-400">{categories.length} total</span>
        </div>
        {categories.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">No categories yet. Add one above.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* ── "All" special tile ── */}
            <div className="px-6 py-4 flex items-center gap-4 bg-white">
              <div className="relative shrink-0 group">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-[#F3EEFB] border border-gray-100 flex items-center justify-center">
                  {allCategoryImage ? (
                    <img src={allCategoryImage} alt="All" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-2xl">✨</span>
                  )}
                  {uploadingAll && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin text-[#9B6FD1]" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => allFileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Upload image for All tile"
                >
                  <ImagePlus className="w-4 h-4 text-white" />
                </button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={allFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAllImageUpload(file);
                    e.target.value = "";
                  }}
                />
                {allCategoryImage && (
                  <button
                    type="button"
                    onClick={() => setAllCategoryImage(null)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">All</p>
                <p className="text-xs text-gray-400">Shown on "All" tile in storefront</p>
                {!allCategoryImage && (
                  <button
                    type="button"
                    onClick={() => allFileInputRef.current?.click()}
                    className="mt-1 text-[11px] text-[#9B6FD1] hover:underline flex items-center gap-1"
                  >
                    <ImagePlus className="w-3 h-3" /> Add image
                  </button>
                )}
              </div>
            </div>
            {parentCats.map((parent) => {
              const children = categories.filter((c) => c.parent_id === parent.id);
              return (
                <div key={parent.id}>
                  {/* Parent row */}
                  <div className="px-6 py-4 flex items-center gap-4 bg-white">
                    {/* Image thumbnail + upload */}
                    <div className="relative shrink-0 group">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#F3EEFB] border border-gray-100 flex items-center justify-center">
                        {parent.image_url ? (
                          <img
                            src={imgUrl(parent.image_url, "tiny")}
                            alt={parent.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Tag className="w-5 h-5 text-[#9B6FD1]/40" />
                        )}
                        {uploadingId === parent.id && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
                            <Loader2 className="w-4 h-4 animate-spin text-[#9B6FD1]" />
                          </div>
                        )}
                      </div>
                      {/* Upload overlay on hover */}
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[parent.id]?.click()}
                        className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Upload image"
                      >
                        <ImagePlus className="w-4 h-4 text-white" />
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[parent.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(parent.id, file);
                          e.target.value = "";
                        }}
                      />
                      {/* Remove image button */}
                      {parent.image_url && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(parent.id)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{parent.label}</p>
                      <p className="text-xs text-gray-400">
                        slug: <span className="font-mono">{parent.name}</span>
                        {children.length > 0 && <span className="ml-2 text-[#9B6FD1]">· {children.length} sub</span>}
                      </p>
                      {!parent.image_url && (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[parent.id]?.click()}
                          className="mt-1 text-[11px] text-[#9B6FD1] hover:underline flex items-center gap-1"
                        >
                          <ImagePlus className="w-3 h-3" /> Add image
                        </button>
                      )}
                    </div>
                    <button onClick={() => setDeleteCatId(parent.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Children */}
                  {children.map((child) => (
                    <div key={child.id} className="pl-10 pr-6 py-2.5 flex items-center gap-3 bg-gray-50/60 border-t border-gray-50">
                      <div className="w-1 h-1 rounded-full bg-[#9B6FD1]/40 shrink-0 ml-2 mr-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{child.label}</p>
                        <p className="text-xs text-gray-400 font-mono">{child.name}</p>
                      </div>
                      <button onClick={() => setDeleteCatId(child.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <div className="pl-12 pr-6 pb-2">
                    <button onClick={() => { setCatParentId(parent.id); setCatName(""); setCatLabel(""); document.querySelector<HTMLElement>(".categories-form")?.scrollIntoView({ behavior: "smooth" }); }}
                      className="text-[11px] text-[#9B6FD1] hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add subcategory under {parent.label}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Orphaned subcategories */}
            {categories.filter((c) => c.parent_id !== null && !categories.find((p) => p.id === c.parent_id)).map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center gap-3 bg-amber-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{c.label} <span className="text-[10px] text-amber-500 ml-1">orphaned</span></p>
                  <p className="text-xs text-gray-400 font-mono">{c.name}</p>
                </div>
                <button onClick={() => setDeleteCatId(c.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal open={deleteCatId !== null} title="Delete category?"
        body="Existing products won't be deleted, but they'll no longer appear under a filter tab."
        onConfirm={handleDeleteCategory} onCancel={() => setDeleteCatId(null)} loading={deletingCat} />
    </div>
  );
}
