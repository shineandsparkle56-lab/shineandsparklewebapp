import { useEffect, useRef, useState } from "react";
import cardImage from "../assets/thank_you_card.webp";
import { jsPDF } from "jspdf";

interface ThankYouCardProps {
  customerName: string;
  hideDownload?: boolean;
}

/*
 * Position of the name inside the "Hey _____ ♡," pill.
 *
 * The pill in the webp sits roughly at 45.5% down the card.
 * "Hey" ends at ~30% of width, "," is at ~88% of width.
 * The name is left-aligned starting just after "Hey ".
 *
 * Tune NAME_X / NAME_Y if needed — they are in % of image dimensions.
 *
 *   NAME_X  : left edge where the name starts (after "Hey ")
 *   NAME_Y  : vertical centre of the pill
 *   MAX_W   : maximum pixel width the name can take before font shrinks
 */
const NAME_X_RATIO   = 0.370;   // start x (just after "Hey ")
const NAME_Y_RATIO   = 0.456;   // vertical centre of pill
const MAX_W_RATIO    = 0.555;   // max width available for the name
const BASE_FONT_SIZE = 0.065;   // starting font size as fraction of image width
const NAME_COLOR     = "#7b2ff7";
const FONT_FAMILY    = "Great Vibes";
const GOOGLE_FONT_URL =
  "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2";

/** Ensure Great Vibes is loaded into the document font set */
async function ensureFont(): Promise<void> {
  // Check if already loaded
  const already = [...document.fonts].some((f) => f.family === FONT_FAMILY);
  if (already) {
    await document.fonts.load(`48px '${FONT_FAMILY}'`);
    return;
  }
  const face = new FontFace(FONT_FAMILY, `url(${GOOGLE_FONT_URL})`);
  const loaded = await face.load();
  document.fonts.add(loaded);
}

async function renderCard(
  canvas: HTMLCanvasElement,
  customerName: string,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1 — load font first
  await ensureFont();

  // 2 — load base image
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = reject;
    img.src     = cardImage;
  });

  const W = canvas.width;
  const H = canvas.height;

  // 3 — find largest font size that fits
  const maxWidth = W * MAX_W_RATIO;
  let fontSize   = Math.round(W * BASE_FONT_SIZE);

  ctx.font = `${fontSize}px '${FONT_FAMILY}'`;
  while (ctx.measureText(customerName).width > maxWidth && fontSize > 8) {
    fontSize -= 1;
    ctx.font = `${fontSize}px '${FONT_FAMILY}'`;
  }

  // 4 — draw name
  ctx.save();
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = NAME_COLOR;
  ctx.font         = `${fontSize}px '${FONT_FAMILY}'`;
  ctx.fillText(customerName, W * NAME_X_RATIO, H * NAME_Y_RATIO, maxWidth);
  ctx.restore();
}

export default function ThankYouCard({ customerName, hideDownload = false }: ThankYouCardProps) {
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const [ready, setReady]     = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReady(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCard(canvas, customerName)
      .then(() => setReady(true))
      .catch((e) => console.error("ThankYouCard render failed:", e));
  }, [customerName]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setLoading(true);
    try {
      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF({
        unit:        "mm",
        format:      [101.6, 152.4],   // 4 × 6 inches
        orientation: "portrait",
      });
      doc.addImage(imgData, "PNG", 0, 0, 101.6, 152.4);
      doc.save(`thank-you-${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

      <canvas
        ref={canvasRef}
        style={{
          width:        300,
          height:       "auto",
          display:      "block",
          borderRadius: 8,
          border:       "1px solid #e9d5ff",
          boxShadow:    "0 2px 20px rgba(123,47,247,0.13)",
          opacity:      ready ? 1 : 0.15,
          transition:   "opacity 0.35s",
        }}
      />

      {!hideDownload && (
        <button
          onClick={handleDownload}
          disabled={!ready || loading}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            background:   !ready || loading ? "#a855f7" : "#7b2ff7",
            color:        "#fff",
            border:       "none",
            borderRadius: 10,
            padding:      "10px 28px",
            fontSize:     14,
            fontWeight:   600,
            fontFamily:   "Poppins, sans-serif",
            cursor:       !ready || loading ? "not-allowed" : "pointer",
            boxShadow:    "0 2px 14px rgba(123,47,247,0.25)",
          }}
        >
          {loading ? <>⏳&nbsp;Saving…</> : <>⬇️&nbsp;Download 4×6 PDF</>}
        </button>
      )}

    </div>
  );
}
