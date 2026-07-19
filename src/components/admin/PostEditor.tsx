import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Download, ImageIcon, X, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import JSZip from "jszip";

// ── Canvas size ───────────────────────────────────────────────
const SIZE     = 1080;
const BANNER_H = Math.round(SIZE * 0.06);

// ── Hardcoded typography: Oswald Bold Uppercase ───────────────
const FONT_FAMILY = "Oswald";
const FONT_WEIGHT = "700";
const FONT_URL    = "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap";

// ── Colour helpers ────────────────────────────────────────────
function extractDominantColor(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const sampleY = Math.floor(img.naturalHeight * 0.75);
  const sampleH = Math.max(1, Math.floor(img.naturalHeight * 0.2));
  ctx.drawImage(img, 0, sampleY, img.naturalWidth, sampleH, 0, 0, SIZE, 1);
  const data = ctx.getImageData(0, 0, SIZE, 1).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}
function lighten(r: number, g: number, b: number, f = 0.72) {
  return { r: Math.round(r + (255 - r) * f), g: Math.round(g + (255 - g) * f), b: Math.round(b + (255 - b) * f) };
}
function darken(r: number, g: number, b: number, f = 0.5) {
  return { r: Math.round(r * (1 - f)), g: Math.round(g * (1 - f)), b: Math.round(b * (1 - f)) };
}
function rgb({ r, g, b }: { r: number; g: number; b: number }) { return `rgb(${r},${g},${b})`; }

// ── Font loader ───────────────────────────────────────────────
const loadedFonts = new Set<string>();
async function loadGoogleFont(family: string, url: string) {
  if (loadedFonts.has(family)) return;
  if (!document.querySelector(`link[data-font="${family}"]`)) {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = url;
    link.setAttribute("data-font", family);
    document.head.appendChild(link);
  }
  await document.fonts.ready;
  try { await Promise.all(["400","700"].map((w) => document.fonts.load(`${w} 40px "${family}"`).catch(() => null))); } catch { /**/ }
  loadedFonts.add(family);
}

// ── Draw a single image onto an off-screen canvas, return dataURL ──
async function renderImage(img: HTMLImageElement, price: string, sampleCanvas: HTMLCanvasElement): Promise<string> {
  await loadGoogleFont(FONT_FAMILY, FONT_URL);
  const canvas = document.createElement("canvas");
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(SIZE / iw, SIZE / ih);
  const sw = SIZE / scale, sh = SIZE / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, SIZE, SIZE);

  const dom     = extractDominantColor(img, sampleCanvas);
  const bgColor = lighten(dom.r, dom.g, dom.b, 0.72);
  const txtColor = darken(dom.r, dom.g, dom.b, 0.55);

  const bannerY = SIZE - BANNER_H;
  const rad = 32;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(rad, bannerY); ctx.lineTo(SIZE - rad, bannerY);
  ctx.quadraticCurveTo(SIZE, bannerY, SIZE, bannerY + rad);
  ctx.lineTo(SIZE, SIZE); ctx.lineTo(0, SIZE); ctx.lineTo(0, bannerY + rad);
  ctx.quadraticCurveTo(0, bannerY, rad, bannerY);
  ctx.closePath();
  ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = -6;
  ctx.fillStyle = rgb(bgColor);
  ctx.fill();
  ctx.restore();

  const family    = `"${FONT_FAMILY}", "Helvetica Neue", Arial, sans-serif`;
  const centerX   = SIZE / 2;
  const centerY   = bannerY + BANNER_H / 2 + 4;
  const priceText = `₹${price}`;
  const onlyText  = " ONLY";
  const priceSize = Math.round(BANNER_H * 0.70);
  const onlySize  = Math.round(BANNER_H * 0.40);

  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = `${FONT_WEIGHT} ${priceSize}px ${family}`;
  const priceW = ctx.measureText(priceText).width;
  ctx.font = `${FONT_WEIGHT} ${onlySize}px ${family}`;
  const onlyW = ctx.measureText(onlyText).width;
  const startX = centerX - (priceW + onlyW) / 2;

  ctx.font = `${FONT_WEIGHT} ${priceSize}px ${family}`; ctx.fillStyle = rgb(txtColor);
  ctx.fillText(priceText, startX, centerY);
  ctx.font = `${FONT_WEIGHT} ${onlySize}px ${family}`; ctx.fillStyle = rgb(txtColor);
  ctx.fillText(onlyText, startX + priceW, centerY + Math.round(priceSize * 0.14));

  return canvas.toDataURL("image/jpeg", 0.95);
}

// ── Per-image state ───────────────────────────────────────────
interface ImageEntry {
  id: string;
  src: string;           // original blob URL for thumbnail
  dataUrl: string | null; // composed result
  img: HTMLImageElement;
}

// ── Component ─────────────────────────────────────────────────
export function PostEditor() {
  const [price,    setPrice]    = useState("");
  const [entries,  setEntries]  = useState<ImageEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [composing, setComposing] = useState(false);

  const sampleRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const priceRef   = useRef(price);
  useEffect(() => { priceRef.current = price; }, [price]);

  const activeEntry = entries.find((e) => e.id === activeId) ?? null;
  const activeIndex = entries.findIndex((e) => e.id === activeId);

  // ── Compose all entries ───────────────────────────────────────
  const composeAll = useCallback(async (imgs: ImageEntry[], p: string) => {
    if (!sampleRef.current || !imgs.length) return;
    setComposing(true);
    const updated = await Promise.all(
      imgs.map(async (e) => ({
        ...e,
        dataUrl: await renderImage(e.img, p || "0", sampleRef.current!),
      }))
    );
    setEntries(updated);
    setComposing(false);
  }, []);

  // Recompose when price changes
  useEffect(() => {
    if (entries.length > 0) composeAll(entries, price);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  // ── Load new files ────────────────────────────────────────────
  const loadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;

    const newEntries: ImageEntry[] = await Promise.all(
      arr.map((file) => new Promise<ImageEntry>((resolve) => {
        const src = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ id: `${Date.now()}-${Math.random()}`, src, dataUrl: null, img });
        img.src = src;
      }))
    );

    const combined = [...entries, ...newEntries];
    setEntries(combined);
    if (!activeId) setActiveId(newEntries[0].id);

    // Compose all (including new ones) with current price
    if (sampleRef.current) {
      setComposing(true);
      const updated = await Promise.all(
        combined.map(async (e) => ({
          ...e,
          dataUrl: await renderImage(e.img, priceRef.current || "0", sampleRef.current!),
        }))
      );
      setEntries(updated);
      setComposing(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) loadFiles(e.target.files);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  // ── Download active ───────────────────────────────────────────
  const downloadOne = (entry: ImageEntry) => {
    if (!entry.dataUrl) return;
    const a = document.createElement("a"); a.href = entry.dataUrl;
    a.download = `sns-post-${price}-${entries.indexOf(entry) + 1}.jpg`; a.click();
  };

  // ── Download all as a zip ─────────────────────────────────────
  const downloadAll = async () => {
    const zip      = new JSZip();
    const folder   = zip.folder(`sns-posts-${price}`)!;
    entries.forEach((e, i) => {
      if (!e.dataUrl) return;
      // dataUrl = "data:image/jpeg;base64,..."  — strip the prefix
      const base64 = e.dataUrl.split(",")[1];
      folder.file(`photo-${i + 1}.jpg`, base64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `sns-posts-${price}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const prev = () => { if (activeIndex > 0) setActiveId(entries[activeIndex - 1].id); };
  const next = () => { if (activeIndex < entries.length - 1) setActiveId(entries[activeIndex + 1].id); };

  const reset = () => {
    entries.forEach((e) => URL.revokeObjectURL(e.src));
    setEntries([]);
    setActiveId(null);
    setPrice("");
    setComposing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const ready = entries.length > 0 && entries.every((e) => e.dataUrl) && !composing;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">Instagram Post Editor</h2>
          <span className="text-xs text-gray-400 ml-1">1080 × 1080 · price banner</span>
          <div className="ml-auto flex items-center gap-2">
            {entries.length > 0 && (
              <span className="text-xs font-medium text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-full">
                {entries.length} photo{entries.length > 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={reset}
              title="Clear all and start over"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Left: controls ── */}
          <div className="flex flex-col gap-5">

            {/* Upload zone */}
            <div>
              <label className="label">Product Photos</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#9B6FD1]" />
                </div>
                <p className="text-sm text-gray-500 text-center">
                  Drop photos or click to browse
                  <span className="block text-xs text-gray-400 mt-0.5">Multiple images supported</span>
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
            </div>

            {/* Thumbnail strip */}
            {entries.length > 0 && (
              <div>
                <label className="label">Added Photos ({entries.length})</label>
                <div className="flex flex-wrap gap-2">
                  {entries.map((e, i) => (
                    <div key={e.id} onClick={() => setActiveId(e.id)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        activeId === e.id ? "border-[#9B6FD1] shadow-md" : "border-transparent hover:border-[#9B6FD1]/40"
                      }`}>
                      <img src={e.src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div>
              <label className="label">Selling Price (₹)</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#9B6FD1] focus-within:ring-2 focus-within:ring-[#9B6FD1]/20 bg-white transition-all">
                <span className="pl-3 pr-1 text-gray-500 text-sm font-medium select-none">₹</span>
                <input
                  type="number" min="1" placeholder="159"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 py-2.5 pr-3 text-sm text-gray-800 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Download buttons */}
            <div className="flex flex-col gap-2">
              <button onClick={() => activeEntry && downloadOne(activeEntry)} disabled={!ready || !activeEntry}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" />
                Download This Photo
              </button>
              {entries.length > 1 && (
                <button onClick={downloadAll} disabled={!ready}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Download className="w-4 h-4" />
                  Download All ({entries.length})
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Banner colour is extracted from each photo automatically.
              Output is 1080×1080 JPEG ready for Instagram.
            </p>
          </div>

          {/* ── Right: preview ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</p>
              {entries.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <button onClick={prev} disabled={activeIndex <= 0}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#9B6FD1] hover:text-[#9B6FD1] disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>{activeIndex + 1} / {entries.length}</span>
                  <button onClick={next} disabled={activeIndex >= entries.length - 1}
                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:border-[#9B6FD1] hover:text-[#9B6FD1] disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
              {composing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                  <div className="w-6 h-6 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!entries.length && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-300 text-sm">Upload photos to preview</p>
                </div>
              )}
              {activeEntry?.dataUrl && (
                <img src={activeEntry.dataUrl} alt="composed preview" className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden 1-px sample canvas for colour extraction */}
      <canvas ref={sampleRef} width={SIZE} height={1} className="hidden" aria-hidden="true" />

      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
      `}</style>
    </div>
  );
}
