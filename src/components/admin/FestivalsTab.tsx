import { useState, useRef } from "react";
import {
  Plus, Trash2, Pencil, Sparkles, X, CheckCircle2, ExternalLink,
  ChevronDown, ChevronUp, GripVertical, Calendar, Upload, Loader2,
} from "lucide-react";
import {
  useFestivals, isFestivalLive,
  type Festival, type FestivalInput, type FestivalSection, type FestivalSponsor,
} from "../../context/FestivalsContext";
import { useToast } from "../../hooks/useToast";
import { ConfirmModal, Spinner } from "./shared";
import { compressToWebP } from "../../utils/compressToWebP";
import { uploadToR2 } from "../../lib/r2Upload";

// ── helpers ──────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#FF6B35", "#F7C59F", "#9B6FD1", "#E83F6F", "#2274A5",
  "#32936F", "#F9DC5C", "#E8553E", "#C14953", "#4B3B8C",
];

const EMPTY_FORM: Omit<FestivalInput, "sponsors" | "sections"> & {
  sponsors: FestivalSponsor[];
  sections: FestivalSection[];
} = {
  slug: "",
  name: "",
  tagline: "",
  banner_url: "",
  banner_bg: "#FF6B35",
  sponsors: [],
  sections: [],
  active_from: "",
  active_until: "",
  is_active: false,
};

// ── Section row editor ────────────────────────────────────────────────────────
function SectionRow({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: FestivalSection;
  index: number;
  total: number;
  onChange: (s: FestivalSection) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
      {/* Reorder */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={onMoveUp} disabled={index === 0}
          className="p-0.5 text-gray-300 hover:text-[#9B6FD1] disabled:opacity-20 transition-colors">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          className="p-0.5 text-gray-300 hover:text-[#9B6FD1] disabled:opacity-20 transition-colors">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <GripVertical className="w-3.5 h-3.5 text-gray-200 shrink-0" />

      {/* Title */}
      <input
        value={section.title}
        onChange={(e) => onChange({ ...section, title: e.target.value })}
        placeholder="Section title (e.g. Trendy Bangles)"
        className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200
          focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
      />

      {/* Tag */}
      <input
        value={section.tag}
        onChange={(e) => onChange({ ...section, tag: e.target.value.trim().toLowerCase() })}
        placeholder="tag (e.g. navratri-bangles)"
        className="w-40 shrink-0 text-sm font-mono px-2.5 py-1.5 rounded-lg border border-gray-200
          focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
      />

      <button onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300
          hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Sponsor row editor ────────────────────────────────────────────────────────
function SponsorRow({
  sponsor,
  onChange,
  onRemove,
}: {
  sponsor: FestivalSponsor;
  onChange: (s: FestivalSponsor) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
      <input
        value={sponsor.name}
        onChange={(e) => onChange({ ...sponsor, name: e.target.value })}
        placeholder="Brand name"
        className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200
          focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
      />
      <input
        value={sponsor.logo_url}
        onChange={(e) => onChange({ ...sponsor, logo_url: e.target.value })}
        placeholder="Logo image URL (optional)"
        className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200
          focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]"
      />
      <button onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300
          hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Festival form (shared for Add + Edit) ─────────────────────────────────────
interface FestivalFormProps {
  value: typeof EMPTY_FORM;
  onChange: (v: typeof EMPTY_FORM) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel: string;
  onCancel?: () => void;
}

function FestivalForm({ value, onChange, onSubmit, saving, submitLabel, onCancel }: FestivalFormProps) {
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    onChange({ ...value, [k]: v });

  // ── Banner image upload state ────────────────────────────
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const handleBannerFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setBannerUploading(true);
    try {
      const name = `festival-banner-${Date.now()}`;
      const compressed = await compressToWebP(file, { maxSizePx: 1600, quality: 0.88, name });
      const url = await uploadToR2(compressed, name);
      set("banner_url", url);
    } catch (err) {
      console.error("Banner upload failed:", err);
    } finally {
      setBannerUploading(false);
    }
  };

  const addSection = () =>
    set("sections", [...value.sections, { title: "", tag: "" }]);

  const updateSection = (i: number, s: FestivalSection) =>
    set("sections", value.sections.map((sec, idx) => idx === i ? s : sec));

  const removeSection = (i: number) =>
    set("sections", value.sections.filter((_, idx) => idx !== i));

  const moveSection = (i: number, dir: -1 | 1) => {
    const arr = [...value.sections];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("sections", arr);
  };

  const addSponsor = () =>
    set("sponsors", [...value.sponsors, { name: "", logo_url: "" }]);

  const updateSponsor = (i: number, s: FestivalSponsor) =>
    set("sponsors", value.sponsors.map((sp, idx) => idx === i ? s : sp));

  const removeSponsor = (i: number) =>
    set("sponsors", value.sponsors.filter((_, idx) => idx !== i));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Row 1 — Name + Slug */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Festival Name</label>
          <input required value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Navratri 2026"
            className="input" />
        </div>
        <div>
          <label className="label">URL Slug</label>
          <input required value={value.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="e.g. navratri-2026"
            className="input font-mono" />
          <p className="text-[11px] text-gray-400 mt-1">
            Accessible at <span className="font-mono">/festival/{value.slug || "…"}</span>
          </p>
        </div>
      </div>

      {/* Tagline */}
      <div>
        <label className="label">Tagline</label>
        <input value={value.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          placeholder="e.g. Celebrate with colours"
          className="input" />
      </div>

      {/* Banner image upload */}
      <div>
        <label className="label">Banner Image</label>
        {value.banner_url ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group">
            <img
              src={value.banner_url}
              alt="Banner preview"
              className="w-full max-h-36 object-cover"
            />
            {/* Change / Remove overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => bannerFileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Change
              </button>
              <button
                type="button"
                onClick={() => set("banner_url", "")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg shadow hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
            {bannerUploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#9B6FD1]" />
              </div>
            )}
            <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/90 text-white uppercase tracking-wide">
              WebP
            </span>
          </div>
        ) : (
          <div
            onClick={() => bannerFileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed
              border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB] cursor-pointer transition-all"
          >
            {bannerUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#9B6FD1]" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-[#9B6FD1]" />
                <p className="text-sm text-gray-500 text-center">
                  Click to upload banner image
                  <span className="block text-xs text-gray-400 mt-0.5">Compressed to WebP automatically</span>
                </p>
              </>
            )}
          </div>
        )}
        <input
          ref={bannerFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); e.target.value = ""; }}
        />
      </div>

      {/* Banner background colour */}
      <div>
        <label className="label">Banner Background Colour</label>
        <div className="flex items-center gap-3 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c} type="button"
              onClick={() => set("banner_bg", c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                value.banner_bg === c
                  ? "border-gray-800 scale-110 shadow-md"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          {/* Custom hex picker */}
          <div className="relative" title="Custom colour">
            <div
              className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer flex items-center justify-center text-[9px] text-gray-400"
              style={{ backgroundColor: PRESET_COLORS.includes(value.banner_bg) ? "#fff" : value.banner_bg }}
              onClick={() => (document.getElementById("fest-banner-bg") as HTMLInputElement)?.click()}
            >
              {PRESET_COLORS.includes(value.banner_bg) ? "+" : ""}
            </div>
            <input id="fest-banner-bg" type="color" value={value.banner_bg}
              onChange={(e) => set("banner_bg", e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
          </div>
          <span className="text-xs text-gray-400 font-mono">{value.banner_bg}</span>
        </div>
        {/* Live mini preview */}
        <div
          className="mt-2 rounded-xl h-10 flex items-center px-4 text-white text-sm font-bold"
          style={{ background: value.banner_bg }}
        >
          {value.name || "Festival Name"} — {value.tagline || "tagline"}
        </div>
      </div>

      {/* Active dates + toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Active From</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="date" value={value.active_from ?? ""}
              onChange={(e) => set("active_from", e.target.value)}
              className="input pl-9" />
          </div>
        </div>
        <div>
          <label className="label">Active Until</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="date" value={value.active_until ?? ""}
              onChange={(e) => set("active_until", e.target.value)}
              className="input pl-9" />
          </div>
        </div>
        <div className="flex flex-col justify-end">
          <label className="label">Active Now</label>
          <button type="button"
            onClick={() => set("is_active", !value.is_active)}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 focus:outline-none ${value.is_active ? "bg-emerald-500" : "bg-gray-300"}`}
            role="switch" aria-checked={value.is_active}>
            <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform
              transition-transform duration-200 ${value.is_active ? "translate-x-7" : "translate-x-0"}`} />
          </button>
          <p className="text-[11px] text-gray-400 mt-1">
            {value.is_active ? "Visible to customers" : "Hidden from store"}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="label mb-0">Product Sections</label>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Each section shows products tagged with its tag. Tag = value in <span className="font-mono">products.tags</span>.
            </p>
          </div>
          <button type="button" onClick={addSection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9B6FD1]
              bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Section
          </button>
        </div>
        {value.sections.length === 0 ? (
          <p className="text-[11px] text-gray-400 py-2">No sections yet — add at least one.</p>
        ) : (
          <div className="space-y-2">
            {value.sections.map((sec, i) => (
              <SectionRow
                key={i}
                section={sec}
                index={i}
                total={value.sections.length}
                onChange={(s) => updateSection(i, s)}
                onRemove={() => removeSection(i)}
                onMoveUp={() => moveSection(i, -1)}
                onMoveDown={() => moveSection(i, 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sponsors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="label mb-0">Sponsors <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Shown as a strip below the hero banner.
            </p>
          </div>
          <button type="button" onClick={addSponsor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9B6FD1]
              bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add Sponsor
          </button>
        </div>
        {value.sponsors.length > 0 && (
          <div className="space-y-2">
            {value.sponsors.map((sp, i) => (
              <SponsorRow
                key={i}
                sponsor={sp}
                onChange={(s) => updateSponsor(i, s)}
                onRemove={() => removeSponsor(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold
            rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
          {saving
            ? <><Spinner />Saving…</>
            : <><CheckCircle2 className="w-4 h-4" />{submitLabel}</>}
        </button>
      </div>
    </form>
  );
}

// ── Festival card (list view) ─────────────────────────────────────────────────
function FestivalCard({
  festival,
  onEdit,
  onDelete,
  onToggle,
}: {
  festival: Festival;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const live = isFestivalLive(festival);

  return (
    <div className={`border rounded-2xl overflow-hidden ${live ? "border-emerald-200" : "border-gray-100"}`}>
      {/* Colour band */}
      <div
        className="h-2 w-full"
        style={{ background: festival.banner_bg }}
      />

      <div className="bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-gray-900">{festival.name}</span>
              {live && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">
                  Live
                </span>
              )}
              {!festival.is_active && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">
                  Inactive
                </span>
              )}
              {festival.is_active && !live && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                  Scheduled
                </span>
              )}
            </div>
            {festival.tagline && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{festival.tagline}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-gray-400">
              <span className="font-mono text-[#9B6FD1]">/festival/{festival.slug}</span>
              {(festival.active_from || festival.active_until) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {festival.active_from ?? "—"} → {festival.active_until ?? "—"}
                </span>
              )}
              <span>{festival.sections.length} section{festival.sections.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Active toggle */}
            <button
              onClick={() => onToggle(!festival.is_active)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 focus:outline-none ${festival.is_active ? "bg-emerald-500" : "bg-gray-300"}`}
              role="switch" aria-checked={festival.is_active}
              title={festival.is_active ? "Deactivate" : "Activate"}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform
                transition-transform duration-200 ${festival.is_active ? "translate-x-4" : "translate-x-0"}`} />
            </button>

            <a href={`/festival/${festival.slug}`} target="_blank" rel="noopener noreferrer"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors"
              title="Preview">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={onEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors border border-gray-200"
              title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200"
              title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section pills */}
        {festival.sections.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {festival.sections.map((sec, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F3EEFB] text-[#9B6FD1]">
                {sec.title}
                <span className="text-[#9B6FD1]/50 font-mono">#{sec.tag}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function FestivalsTab() {
  const { festivals, loading, error, addFestival, updateFestival, deleteFestival, toggleActive } = useFestivals();
  const toast = useToast();

  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addSaving, setAddSaving] = useState(false);

  const [editFestival, setEditFestival] = useState<Festival | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Open edit modal ─────────────────────────────────────────
  const openEdit = (fest: Festival) => {
    setEditFestival(fest);
    setEditForm({
      slug: fest.slug,
      name: fest.name,
      tagline: fest.tagline,
      banner_url: fest.banner_url,
      banner_bg: fest.banner_bg,
      sponsors: fest.sponsors.map((s) => ({ ...s })),
      sections: fest.sections.map((s) => ({ ...s })),
      active_from: fest.active_from ?? "",
      active_until: fest.active_until ?? "",
      is_active: fest.is_active,
    });
  };

  // ── Add ─────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.slug.trim()) return;
    setAddSaving(true);
    try {
      await addFestival(addForm);
      setAddForm({ ...EMPTY_FORM });
      toast.show("Festival created!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to create festival.", "error");
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit save ───────────────────────────────────────────────
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFestival) return;
    setEditSaving(true);
    try {
      await updateFestival(editFestival.id, editForm);
      setEditFestival(null);
      toast.show("Festival updated!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to update festival.", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await deleteFestival(deleteId);
      toast.show("Festival deleted.");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Delete failed.", "error");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // ── Toggle active ───────────────────────────────────────────
  const handleToggle = async (id: number, active: boolean) => {
    try {
      await toggleActive(id, active);
      toast.show(active ? "Festival activated!" : "Festival deactivated.");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to toggle.", "error");
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Add form ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">Create New Festival Store</h2>
        </div>
        <div className="p-6">
          <FestivalForm
            value={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            saving={addSaving}
            submitLabel="Create Festival"
          />
        </div>
      </div>

      {/* ── Festival list ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">All Festivals</h2>
          <span className="ml-auto text-sm text-gray-400">{festivals.length} total</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
            <Spinner /> Loading…
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-red-400 text-sm py-8">{error}</p>
        )}

        {!loading && !error && festivals.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">
            No festivals yet. Create one above.
          </p>
        )}

        {!loading && !error && festivals.length > 0 && (
          <div className="p-4 space-y-3">
            {festivals.map((fest) => (
              <FestivalCard
                key={fest.id}
                festival={fest}
                onEdit={() => openEdit(fest)}
                onDelete={() => setDeleteId(fest.id)}
                onToggle={(active) => handleToggle(fest.id, active)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Edit modal ────────────────────────────────────────── */}
      {editFestival && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditFestival(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Edit Festival</h2>
                <span className="text-xs text-gray-400">— {editFestival.name}</span>
              </div>
              <button onClick={() => setEditFestival(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <FestivalForm
                value={editForm}
                onChange={setEditForm}
                onSubmit={handleEditSave}
                saving={editSaving}
                submitLabel="Save Changes"
                onCancel={() => setEditFestival(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────── */}
      <ConfirmModal
        open={deleteId !== null}
        title="Delete festival?"
        body="The festival store page will stop working immediately. Products keep their tags."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </div>
  );
}
