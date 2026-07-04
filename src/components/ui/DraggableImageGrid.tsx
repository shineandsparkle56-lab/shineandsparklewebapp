/**
 * DraggableImageGrid
 *
 * Renders a row of image thumbnails that can be reordered by dragging.
 * The first item is always marked as the cover image.
 *
 * Props:
 *   items        – array of { file: File; preview: string } in display order
 *   onReorder    – called with the full reordered array after a drag ends
 *   onRemove     – called with the index to remove
 *   onAddMore    – called when the "+ Add" tile is clicked (optional)
 *   maxImages    – maximum allowed images (default 5)
 *   newBadge     – show a "New" badge on every item (used in edit modal for new uploads)
 */

import { Reorder, useDragControls } from "framer-motion";
import { X, GripVertical, Plus } from "lucide-react";

export interface ImageItem {
  /** Unique stable key — use the object URL or a uuid */
  id: string;
  preview: string;
  file?: File;   // undefined for existing (already-uploaded) images
}

interface DraggableImageGridProps {
  items: ImageItem[];
  onReorder: (items: ImageItem[]) => void;
  onRemove: (id: string) => void;
  onAddMore?: () => void;
  maxImages?: number;
  newBadge?: boolean;
}

function DragHandle() {
  return (
    <div className="absolute top-1 left-1 z-10 w-5 h-5 flex items-center justify-center rounded bg-black/30 text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
      <GripVertical className="w-3 h-3" />
    </div>
  );
}

function ImageTile({
  item,
  index,
  onRemove,
  newBadge,
}: {
  item: ImageItem;
  index: number;
  onRemove: (id: string) => void;
  newBadge?: boolean;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="relative group w-20 h-20 shrink-0 rounded-xl overflow-hidden border-2 border-white shadow-sm select-none"
      whileDrag={{ scale: 1.06, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <img
        src={item.preview}
        alt={`Image ${index + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Cover badge */}
      {index === 0 && (
        <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#9B6FD1] text-white px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
          Cover
        </span>
      )}

      {/* New badge */}
      {newBadge && (
        <span className="absolute bottom-1 right-1 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none pointer-events-none">
          New
        </span>
      )}

      {/* Drag handle — tap/mouse-down to start drag */}
      <div
        className="absolute top-1 left-1 z-10 w-5 h-5 flex items-center justify-center rounded bg-black/30 text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 z-20"
      >
        <X className="w-3 h-3" />
      </button>
    </Reorder.Item>
  );
}

export function DraggableImageGrid({
  items,
  onReorder,
  onRemove,
  onAddMore,
  maxImages = 5,
  newBadge = false,
}: DraggableImageGridProps) {
  return (
    <Reorder.Group
      axis="x"
      values={items}
      onReorder={onReorder}
      className="flex flex-wrap gap-3"
      as="div"
    >
      {items.map((item, idx) => (
        <ImageTile
          key={item.id}
          item={item}
          index={idx}
          onRemove={onRemove}
          newBadge={newBadge}
        />
      ))}

      {/* Add-more tile */}
      {onAddMore && items.length < maxImages && (
        <button
          type="button"
          onClick={onAddMore}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#9B6FD1] hover:text-[#9B6FD1] transition-colors shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px]">Add more</span>
        </button>
      )}
    </Reorder.Group>
  );
}
