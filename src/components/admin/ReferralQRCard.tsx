/**
 * ReferralQRCard
 *
 * Fetches the uploaded referral card template from storage (via proxy),
 * overlays the QR code into the dashed box area and the referral URL
 * into the link bar — then downloads as a PNG.
 *
 * Template overlay positions (fraction of image natural size):
 *   QR box centre: ~(0.50, 0.415)  — white dashed box in the middle
 *   URL bar:       ~(0.50, 0.595)  — the blank pill below QR section
 *
 * Adjust QR_CX_RATIO, QR_CY_RATIO, QR_SIZE_RATIO, URL_Y_RATIO to
 * match the exact template you upload.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Download, Loader2, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import { getSetting } from "../../lib/settings";
import { jsPDF } from "jspdf";

// ── Overlay position ratios (fraction of template natural size) ──
// Tweak these if your template changes
const QR_CX_RATIO   = 0.500;  // QR horizontal center
const QR_CY_RATIO   = 0.395;  // QR vertical center
const QR_SIZE_RATIO = 0.250;  // QR width = height as fraction of image width
const URL_CX_RATIO  = 0.500;  // URL bar horizontal center
const URL_CY_RATIO  = 0.625;  // URL bar vertical center
const URL_FS_RATIO  = 0.030;  // URL font-size as fraction of image width
const URL_COLOR     = "#5b21b6";

interface Props {
  referrerName: string;
  code:         string;
  onClose:      () => void;
}

// ── Fetch the referral card template via proxy (same as ThankYouCard) ──
async function fetchTemplateDataUrl(): Promise<string> {
  const r2Url = await getSetting("referral_card_url");
  if (!r2Url) throw new Error("NO_CARD");
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(r2Url)}`);
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  const { base64, contentType } = (await res.json()) as { base64: string; contentType: string };
  return `data:${contentType};base64,${base64}`;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

async function buildCard(
  templateDataUrl: string,
  dashboardUrl: string,
): Promise<string> {
  const templateImg = await loadImg(templateDataUrl);
  const W = templateImg.naturalWidth;
  const H = templateImg.naturalHeight;

  // ── Generate QR onto its own canvas ──────────────────────────
  const qrSize    = Math.round(W * QR_SIZE_RATIO);
  const qrCanvas  = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, dashboardUrl, {
    width: qrSize,
    margin: 1,
    color: { dark: "#1a0a2e", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  // ── Composite onto main canvas ────────────────────────────────
  const canvas    = document.createElement("canvas");
  canvas.width    = W;
  canvas.height   = H;
  const ctx       = canvas.getContext("2d")!;

  // 1. Base template
  ctx.drawImage(templateImg, 0, 0);

  // 2. QR code centred on (QR_CX, QR_CY)
  const qrX = Math.round(W * QR_CX_RATIO - qrSize / 2);
  const qrY = Math.round(H * QR_CY_RATIO - qrSize / 2);
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // 3. Referral URL in the link bar
  const fontSize = Math.round(W * URL_FS_RATIO);
  ctx.save();
  ctx.font         = `600 ${fontSize}px 'Arial', sans-serif`;
  ctx.fillStyle    = URL_COLOR;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  // Clip to ~80% of template width so it never overflows
  const maxUrlW    = Math.round(W * 0.78);
  ctx.fillText(dashboardUrl, Math.round(W * URL_CX_RATIO), Math.round(H * URL_CY_RATIO), maxUrlW);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

// ═══════════════════════════════════════════════════════════════
export function ReferralQRCard({ referrerName, code, onClose }: Props) {
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [status,      setStatus]      = useState<"loading" | "ready" | "no-card" | "error">("loading");
  const [downloading, setDownloading] = useState(false);

  const dashboardUrl = `${window.location.origin}/ref/${code}`;

  useEffect(() => {
    fetchTemplateDataUrl()
      .then((tpl) => buildCard(tpl, dashboardUrl))
      .then((url) => { setPreviewUrl(url); setStatus("ready"); })
      .catch((err: Error) => {
        if (err.message === "NO_CARD") setStatus("no-card");
        else setStatus("error");
      });
  }, [dashboardUrl]);

  const handleDownload = () => {
    if (!previewUrl) return;
    setDownloading(true);
    try {
      // Match ThankYouCard: 4×6 inch portrait PDF
      const doc = new jsPDF({
        unit: "mm", format: [101.6, 152.4], orientation: "portrait",
      });
      doc.addImage(previewUrl, "PNG", 0, 0, 101.6, 152.4);
      doc.save(`referral-card-${code.toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.95, opacity: 0, y: 12  }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl p-5 flex flex-col items-center gap-4 max-h-[92vh] overflow-y-auto w-full max-w-sm"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 self-start">
          <QrCode className="w-4 h-4 text-[#9B6FD1]" />
          <p className="text-sm font-semibold text-gray-700">
            Referral Card — {referrerName}
          </p>
        </div>

        {/* Preview / states */}
        {status === "loading" && (
          <div className="w-full aspect-[2/3] bg-[#F3EEFB] rounded-xl flex flex-col items-center justify-center gap-2 text-[#9B6FD1] text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Generating card…</span>
          </div>
        )}

        {status === "no-card" && (
          <div className="w-full aspect-[2/3] bg-[#F3EEFB] rounded-xl flex flex-col items-center justify-center gap-3 px-6 text-center border-2 border-dashed border-[#9B6FD1]/30">
            <QrCode className="w-10 h-10 text-[#9B6FD1]/40" />
            <p className="text-sm font-semibold text-[#9B6FD1]">No template uploaded yet.</p>
            <p className="text-xs text-gray-500">
              Go to <strong>Settings → Referral Card Template</strong> to upload your card image.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="w-full aspect-[2/3] bg-red-50 rounded-xl flex items-center justify-center text-red-400 text-sm">
            Failed to generate card.
          </div>
        )}

        {status === "ready" && previewUrl && (
          <img
            src={previewUrl}
            alt={`Referral card for ${referrerName}`}
            className="w-full rounded-xl border border-[#e9d5ff] shadow-sm"
          />
        )}

        {/* URL label */}
        <p className="text-[11px] text-gray-400 text-center break-all">
          QR links to: <span className="text-[#9B6FD1] font-medium">{dashboardUrl}</span>
        </p>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={status !== "ready" || downloading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
            : <><Download className="w-4 h-4" /> Download 4×6 PDF</>}
        </button>
      </motion.div>
    </div>
  );
}
