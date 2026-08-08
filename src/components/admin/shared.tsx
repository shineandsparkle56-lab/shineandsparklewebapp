// ── Shared admin utilities ────────────────────────────────────
// Spinner, ConfirmModal, CategoryRow, uploadToStorage, SrResult

import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { GripVertical, Tag, Trash2 } from "lucide-react";
import { compressToWebP } from "../../utils/compressToWebP";
import { uploadToR2 } from "../../lib/r2Upload";

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ cls = "w-4 h-4" }: { cls?: string }) {
  return (
    <div className={`${cls} border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin`} />
  );
}

// ── ConfirmModal ──────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
}
export function ConfirmModal({
  open, title, body, onConfirm, onCancel, loading, danger = true,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${danger ? "bg-red-100" : "bg-[#F3EEFB]"}`}>
              <Trash2 className={`w-5 h-5 ${danger ? "text-red-500" : "text-[#9B6FD1]"}`} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-5">{body}</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={onConfirm}
                className={`flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#9B6FD1] hover:bg-[#8a5fc0]"}`}
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── CategoryRow ───────────────────────────────────────────────
export function CategoryRow({
  cat,
  onDelete,
}: {
  cat: import("../../context/CategoriesContext").Category;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={controls}
      className="px-6 py-4 flex items-center gap-3 bg-white border-b border-gray-50 last:border-0"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-[#9B6FD1] transition-colors shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded-xl bg-[#F3EEFB] flex items-center justify-center shrink-0">
        <Tag className="w-4 h-4 text-[#9B6FD1]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{cat.label}</p>
        <p className="text-xs text-gray-400">
          slug: <span className="font-mono">{cat.name}</span>
        </p>
      </div>
      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        title="Delete category"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
}

// ── Storage upload helper ─────────────────────────────────────
export async function uploadToStorage(file: File, productName?: string): Promise<string> {
  const compressed = await compressToWebP(file, { name: productName });
  return uploadToR2(compressed, productName);
}

// ── Shiprocket result type ────────────────────────────────────
export type SrResult = {
  orderId: number;
  shipmentId?: number;
  awb?: string;
  error?: string;
} | null;
