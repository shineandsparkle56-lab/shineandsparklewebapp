import { useState, useCallback, useRef } from "react";
import type { ImageItem } from "../components/ui/DraggableImageGrid";

const MAX_IMAGES = 6;

export function useImageItems(max = MAX_IMAGES) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (incoming: FileList | File[]) => {
      setError("");
      const slots = max - items.length;
      if (slots <= 0) { setError(`Max ${max} images allowed.`); return; }
      const newItems: ImageItem[] = [];
      for (const file of Array.from(incoming).slice(0, slots)) {
        if (!file.type.startsWith("image/")) { setError("Only image files are supported."); continue; }
        newItems.push({ id: URL.createObjectURL(file), preview: URL.createObjectURL(file), file });
      }
      setItems((prev) => [...prev, ...newItems]);
      if (inputRef.current) inputRef.current.value = "";
    },
    [items.length, max]
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      // Only revoke blob URLs, not existing remote URLs
      if (item?.file) URL.revokeObjectURL(item.preview);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => { if (it.file) URL.revokeObjectURL(it.preview); });
      return [];
    });
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /** Seed with existing remote URLs (no File attached — used by edit modal) */
  const seed = useCallback((urls: string[]) => {
    setItems(urls.map((url) => ({ id: url, preview: url, file: undefined })));
    setError("");
  }, []);

  return { items, setItems, error, setError, uploading, setUploading, inputRef, add, remove, clear, seed };
}
