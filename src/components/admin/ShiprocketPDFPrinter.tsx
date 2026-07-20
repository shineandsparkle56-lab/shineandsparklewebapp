import { useState, useCallback, useRef } from "react";
import { PDFDocument, ColorTypes } from "pdf-lib";
import { Upload, FileText, Download, X, Printer, Info, CheckCircle2, Loader2 } from "lucide-react";

// ── A4 dimensions in PDF points (72 pt = 1 inch, A4 = 210×297 mm) ──
const A4_W_PT = 595.28;
const A4_H_PT = 841.89;

// AWB label standard size: 4 × 6 inches
const LABEL_W_PT = 4 * 72; // 288 pt
const LABEL_H_PT = 6 * 72; // 432 pt

const PADDING = 8;    // pt padding from page edges
const GAP     = 8;    // pt gap between label row and invoice row
const COL_GAP = 6;    // pt horizontal gap between label and inv1 column
const INV_GAP = 6;    // pt gap between invoice slots
const DIVIDER = 0.75; // pt cut-line thickness

/**
 * Layout — Page 1:
 *
 *   ┌─────────────────────┬──────────────┐
 *   │  AWB Label (4×6 in) │  Invoice 1   │  ← same slot height as label
 *   │  top-left aligned   │              │
 *   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤  dashed cut line
 *   │  Invoice 2  │  Invoice 3           │  ← SAME slot size as Invoice 1
 *   └─────────────┴──────────────────────┘
 *
 * All invoice slots share the SAME dimensions (right-col width × label height).
 * Bottom invoices are scaled to fit that same slot.
 *
 * If there are more than 3 invoices, extra invoices flow onto page 2+:
 *   ┌──────────────┬──────────────┐
 *   │  Invoice 4   │  Invoice 5   │  ← 2 per row, same slot size
 *   ├──────────────┼──────────────┤
 *   │  Invoice 6   │  ...         │
 *   └──────────────┴──────────────┘
 */
async function buildPrintPDF(inputBytes: ArrayBuffer): Promise<Uint8Array> {
  const srcDoc    = await PDFDocument.load(inputBytes);
  const pageCount = srcDoc.getPageCount();

  const outDoc = await PDFDocument.create();

  const usableW = A4_W_PT - PADDING * 2;
  const usableH = A4_H_PT - PADDING * 2;

  // ── Embed all source pages ───────────────────────────────────────
  const [embeddedLabel] = await outDoc.embedPdf(srcDoc, [0]);

  const invoiceCount   = pageCount - 1;
  const invoiceIndices = Array.from({ length: invoiceCount }, (_, i) => i + 1);
  const embeddedInvoices = invoiceIndices.length > 0
    ? await outDoc.embedPdf(srcDoc, invoiceIndices)
    : [];

  // ── Label dimensions (fixed 4×6 in, never upscale) ──────────────
  const labelScale = Math.min(1, usableW / LABEL_W_PT);
  const labelW     = LABEL_W_PT * labelScale;
  const labelH     = LABEL_H_PT * labelScale;

  // ── Page 1 zone sizes ────────────────────────────────────────────
  // Total vertical space: PADDING (top) + labelH + GAP + bottomH + PADDING (bottom)
  // We want: labelH + GAP + bottomH = usableH  →  bottomH = usableH - labelH - GAP
  const topRowH    = labelH;                          // label row height
  const bottomH    = usableH - topRowH - GAP;         // remaining for invoice row

  // Horizontal: label takes labelW, right col takes the rest
  const rightColW  = usableW - labelW - COL_GAP;      // right column width

  // ── Uniform invoice scale ────────────────────────────────────────
  // We have 3 slots that must hold identical-sized invoices:
  //   Slot A (top-right):  rightColW × topRowH
  //   Slot B (bot-left):   rightColW × bottomH   (same width as A, half the bottom)
  //   Slot C (bot-right):  rightColW × bottomH
  // All 3 slots are the same width (rightColW).
  // The heights differ: topRowH vs bottomH.
  // The most-constrained slot is the one where a full-height invoice fits smallest.
  // We pick the tighter of topRowH vs bottomH as the constraining height.
  let uniformScale = 1;
  if (embeddedInvoices.length > 0) {
    const d    = embeddedInvoices[0].size();
    // Scale to fit the tightest slot (same width, smaller height wins)
    const constrainH = Math.min(topRowH, bottomH);
    uniformScale = Math.min(rightColW / d.width, constrainH / d.height);
  }

  // ── Helper: place invoice at uniform scale, centred in slot ─────
  type EmbeddedPage = (typeof embeddedInvoices)[0];
  function placeInvoice(
    page: ReturnType<typeof outDoc.addPage>,
    inv: EmbeddedPage,
    slotX: number,
    slotBaseY: number,  // pdf-lib: bottom-left Y of slot
    slotW: number,
    slotH: number,
  ) {
    const dims = inv.size();
    const iW   = dims.width  * uniformScale;
    const iH   = dims.height * uniformScale;
    page.drawPage(inv, {
      x:      slotX     + (slotW - iW) / 2,
      y:      slotBaseY + (slotH - iH) / 2,
      width:  iW,
      height: iH,
    });
  }

  // ── Helper: dashed separator line ───────────────────────────────
  function dashedLine(
    page: ReturnType<typeof outDoc.addPage>,
    x1: number, y1: number,
    x2: number, y2: number,
    thickness = 0.5,
  ) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end:   { x: x2, y: y2 },
      thickness,
      color: { type: ColorTypes.RGB, red: 0.72, green: 0.72, blue: 0.72 },
      dashArray: [4, 3],
      dashPhase: 0,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 1 — AWB label + invoices 1-3
  // ════════════════════════════════════════════════════════════════
  const page1 = outDoc.addPage([A4_W_PT, A4_H_PT]);

  // Y coordinates (pdf-lib: origin bottom-left)
  // Top row occupies:  from (A4_H_PT - PADDING - topRowH)  to  (A4_H_PT - PADDING)
  // Bottom row:        from  PADDING                        to  (PADDING + bottomH)
  const topRowBaseY    = A4_H_PT - PADDING - topRowH;   // bottom-left Y of top row
  const bottomBaseY    = PADDING;                        // bottom-left Y of bottom row
  const rightColX      = PADDING + labelW + COL_GAP;    // left edge of right column
  const botSlotW       = (usableW - INV_GAP) / 2;       // each bottom slot width

  // Label — top-left
  page1.drawPage(embeddedLabel, {
    x: PADDING, y: topRowBaseY, width: labelW, height: labelH,
  });

  // Dashed horizontal cut line between top row and bottom row
  const cutLineY = topRowBaseY - GAP / 2;
  page1.drawLine({
    start: { x: PADDING, y: cutLineY },
    end:   { x: A4_W_PT - PADDING, y: cutLineY },
    thickness: DIVIDER,
    color: { type: ColorTypes.RGB, red: 0.45, green: 0.45, blue: 0.45 },
    dashArray: [6, 4],
    dashPhase: 0,
  });

  // Invoice 1 — top-right beside label
  if (embeddedInvoices.length >= 1) {
    placeInvoice(page1, embeddedInvoices[0], rightColX, topRowBaseY, rightColW, topRowH);
    // vertical separator between label and invoice 1
    dashedLine(page1,
      rightColX - COL_GAP / 2, topRowBaseY,
      rightColX - COL_GAP / 2, topRowBaseY + topRowH,
    );
  }

  // Invoice 2 — bottom-left
  if (embeddedInvoices.length >= 2) {
    placeInvoice(page1, embeddedInvoices[1], PADDING, bottomBaseY, botSlotW, bottomH);
    // vertical separator between invoice 2 and 3
    dashedLine(page1,
      PADDING + botSlotW + INV_GAP / 2, bottomBaseY,
      PADDING + botSlotW + INV_GAP / 2, bottomBaseY + bottomH,
    );
  }

  // Invoice 3 — bottom-right
  if (embeddedInvoices.length >= 3) {
    placeInvoice(page1, embeddedInvoices[2], PADDING + botSlotW + INV_GAP, bottomBaseY, botSlotW, bottomH);
  }

  // ════════════════════════════════════════════════════════════════
  // OVERFLOW PAGES — invoice 4+ (2 per row, same uniform scale)
  // ════════════════════════════════════════════════════════════════
  const overflowInvoices = embeddedInvoices.slice(3);

  if (overflowInvoices.length > 0) {
    const rowH        = bottomH;                   // same slot height as bottom row
    const rowsPerPage = Math.max(1, Math.floor((usableH + INV_GAP) / (rowH + INV_GAP)));

    let overflowPage: ReturnType<typeof outDoc.addPage> | null = null;

    overflowInvoices.forEach((inv, idx) => {
      if (idx % (rowsPerPage * 2) === 0) {
        overflowPage = outDoc.addPage([A4_W_PT, A4_H_PT]);
      }
      const page = overflowPage!;
      const col  = idx % 2;
      const row  = Math.floor((idx % (rowsPerPage * 2)) / 2);

      const slotX     = PADDING + col * (botSlotW + INV_GAP);
      const slotBaseY = A4_H_PT - PADDING - (row + 1) * rowH - row * INV_GAP;

      placeInvoice(page, inv, slotX, slotBaseY, botSlotW, rowH);

      if (col === 0 && idx + 1 < overflowInvoices.length) {
        dashedLine(page,
          PADDING + botSlotW + INV_GAP / 2, slotBaseY,
          PADDING + botSlotW + INV_GAP / 2, slotBaseY + rowH,
        );
      }
    });
  }

  return outDoc.save();
}

// ── Component ────────────────────────────────────────────────────
export function ShiprocketPDFPrinter() {
  const [file, setFile]         = useState<File | null>(null);
  const [outputName, setOutputName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
    setError("");
    setDone(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setDone(false);
    try {
      const bytes = await file.arrayBuffer();
      const result = await buildPrintPDF(bytes);

      const blob = new Blob([result.buffer as ArrayBuffer], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      // Use custom name if provided, else fall back to input filename
      const baseName = outputName.trim()
        ? outputName.trim().replace(/\.pdf$/i, "")
        : file.name.replace(/\.pdf$/i, "");
      a.download = `${baseName}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Failed: ${err.message}`
          : "Failed to process PDF. Make sure it's a valid Shiprocket label+invoice PDF."
      );
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setOutputName("");
    setError("");
    setDone(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Printer className="w-5 h-5 text-[#9B6FD1]" />
          <h2 className="font-semibold text-gray-800">Shiprocket Label Printer</h2>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-5 flex gap-3 bg-[#F3EEFB] border border-[#D5BFEF] rounded-xl p-4">
          <Info className="w-4 h-4 text-[#9B6FD1] shrink-0 mt-0.5" />
          <div className="text-xs text-[#6b46c1] leading-relaxed space-y-1">
            <p className="font-semibold">No label printer needed — print on plain A4 paper</p>
            <p>Upload the combined label+invoice PDF from Shiprocket. All invoice slots are the same size:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 pl-1">
              <li><strong>Top-left</strong> — AWB label at 4×6 in</li>
              <li><strong>Top-right</strong> — Invoice 1 (same height as label)</li>
              <li><strong>Bottom row</strong> — Invoice 2 &amp; 3, same slot size</li>
              <li><strong>Page 2+</strong> — Remaining invoices, 2 per row, same size</li>
            </ul>
            <p className="mt-1">Cut along the dashed line — label on the package, invoices are your records.</p>
          </div>
        </div>

        {/* Upload zone */}
        <div className="p-6 space-y-4">
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${dragOver
                  ? "border-[#9B6FD1] bg-[#F3EEFB]"
                  : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"
                }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#9B6FD1]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Drop Shiprocket PDF or{" "}
                  <span className="text-[#9B6FD1]">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  combined-label-invoice-*.pdf · PDF files only
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-[#F3EEFB] border border-[#D5BFEF] rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/15 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#9B6FD1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB · PDF
                </p>
              </div>
              <button
                onClick={reset}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />

          {/* Output filename */}
          <div>
            <label className="label">Output File Name</label>
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder={file ? file.name.replace(/\.pdf$/i, "") : "e.g. order-12345-gaurav"}
                className="input rounded-r-none border-r-0 flex-1"
              />
              <span className="px-3 py-[0.625rem] text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-r-xl border-l-0 select-none">
                .pdf
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Leave blank to use the original filename</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {done && !error && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>A4 print PDF downloaded! Open it and print on plain A4 paper.</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleProcess}
              disabled={!file || processing}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><Download className="w-4 h-4" /> Generate A4 PDF</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Layout preview card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Output layout preview
        </p>

        <div className="flex gap-4 items-start justify-center flex-wrap">
          {/* Page 1 preview */}
          <div>
            <p className="text-[10px] text-gray-400 text-center mb-1.5">Page 1</p>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden"
              style={{ width: 160, height: 226, background: "#fafafa", display: "flex", flexDirection: "column" }}>
              {/* Top row */}
              <div className="flex border-b-2 border-dashed border-[#C4A8E8] flex-shrink-0" style={{ height: "51%" }}>
                {/* AWB label */}
                <div className="bg-[#F3EEFB] flex flex-col items-start justify-center px-2 py-1 border-r border-dashed border-[#C4A8E8]"
                  style={{ width: "58%" }}>
                  <div className="w-full h-[3px] bg-[#9B6FD1]/25 rounded mb-0.5" />
                  <div className="w-3/4 h-[1.5px] bg-[#9B6FD1]/15 rounded mb-0.5" />
                  <div className="w-5/6 h-[1.5px] bg-[#9B6FD1]/15 rounded mb-1" />
                  <p className="text-[6px] font-bold text-[#9B6FD1]">AWB 4×6 in</p>
                </div>
                {/* Invoice 1 — same height slot */}
                <div className="flex-1 flex items-center justify-center bg-white">
                  <div className="text-center">
                    <div className="mx-auto mb-0.5 w-5 h-[1px] bg-gray-300 rounded" />
                    <div className="mx-auto mb-0.5 w-4 h-[1px] bg-gray-300 rounded" />
                    <p className="text-[5px] text-gray-400 font-semibold mt-0.5">Inv 1</p>
                    <p className="text-[4px] text-gray-300">same size</p>
                  </div>
                </div>
              </div>
              {/* Bottom row — Invoice 2 & 3, same slot size */}
              <div className="flex flex-1 divide-x divide-dashed divide-gray-300">
                {["Inv 2", "Inv 3"].map((lbl) => (
                  <div key={lbl} className="flex-1 flex items-center justify-center bg-white">
                    <div className="text-center">
                      <div className="mx-auto mb-0.5 w-6 h-[1px] bg-gray-300 rounded" />
                      <div className="mx-auto mb-0.5 w-5 h-[1px] bg-gray-300 rounded" />
                      <p className="text-[5px] text-gray-400 font-semibold mt-0.5">{lbl}</p>
                      <p className="text-[4px] text-gray-300">same size</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Page 2 preview (overflow) */}
          <div>
            <p className="text-[10px] text-gray-400 text-center mb-1.5">Page 2 (if &gt;3 invoices)</p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg overflow-hidden"
              style={{ width: 160, height: 226, background: "#fafafa", display: "flex", flexDirection: "column", gap: 0 }}>
              {[["Inv 4", "Inv 5"], ["Inv 6", "Inv 7"]].map((row, ri) => (
                <div key={ri} className={`flex flex-1 divide-x divide-dashed divide-gray-200 ${ri === 0 ? "border-b border-dashed border-gray-200" : ""}`}>
                  {row.map((lbl) => (
                    <div key={lbl} className="flex-1 flex items-center justify-center bg-white">
                      <div className="text-center">
                        <div className="mx-auto mb-0.5 w-6 h-[1px] bg-gray-200 rounded" />
                        <div className="mx-auto mb-0.5 w-5 h-[1px] bg-gray-200 rounded" />
                        <p className="text-[5px] text-gray-300 font-semibold mt-0.5">{lbl}</p>
                        <p className="text-[4px] text-gray-200">same size</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-3">
          ✂ Cut along the dashed line · All invoice slots are the same size
        </p>
      </div>
    </div>
  );
}
