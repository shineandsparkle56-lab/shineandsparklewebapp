import { useState } from "react";
import { Plus, Trash2, Tag, ChevronDown } from "lucide-react";
import { useCategories } from "../../context/CategoriesContext";
import { useToast } from "../../hooks/useToast";
import { ConfirmModal, Spinner } from "./shared";

export function CategoriesTab() {
  const { categories, addCategory, deleteCategory } = useCategories();
  const toast = useToast();

  const [catName, setCatName] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catParentId, setCatParentId] = useState<number | "">("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

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
                  {categories.filter((c) => c.parent_id === null).map((c) => (
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
            {categories.filter((c) => c.parent_id === null).map((parent) => {
              const children = categories.filter((c) => c.parent_id === parent.id);
              return (
                <div key={parent.id}>
                  <div className="px-6 py-3.5 flex items-center gap-3 bg-white">
                    <div className="w-9 h-9 rounded-xl bg-[#F3EEFB] flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4 text-[#9B6FD1]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{parent.label}</p>
                      <p className="text-xs text-gray-400">slug: <span className="font-mono">{parent.name}</span>
                        {children.length > 0 && <span className="ml-2 text-[#9B6FD1]">· {children.length} sub</span>}
                      </p>
                    </div>
                    <button onClick={() => setDeleteCatId(parent.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
