import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";

// Import as URL so Vite inlines it as a hashed static asset path
import cardImageUrl from "../assets/thank_you_card.webp";

interface ThankYouCardProps {
  customerName: string;
  hideDownload?: boolean;
}

/*
 * Name overlay coordinates (as % of image natural dimensions).
 * Tune these if the position drifts on a different screen / zoom level.
 *
 *  NAME_X_RATIO  – left edge of name text (just after "Hey " in the pill)
 *  NAME_Y_RATIO  – vertical centre of the pill row
 *  MAX_W_RATIO   – max width the name may occupy before font shrinks
 */
const NAME_X_RATIO   = 0.370;
const NAME_Y_RATIO   = 0.460;
const MAX_W_RATIO    = 0.500;
const BASE_FS_RATIO  = 0.065;   // starting font-size as fraction of image width
const NAME_COLOR     = "#7b2ff7";

const FONT_NAME = "Great Vibes";
// Direct woff2 URL — bypasses Google Fonts redirect, avoids CSP issues
const FONT_URL  =
  "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2";

/* ── load Great Vibes into the browser font set ──────────────── */
async function loadFont(): Promise<void> {
  // already present?
  if (document.fonts.check(`12px '${FONT_NAME}'`)) return;
  try {
    const face = new FontFace(FONT_NAME, `url(${FONT_URL})`, {
      style:  "normal",
      weight: "400",
    });
    const loaded = await face.load();
    document.fonts.add(loaded);
    // warm up — ensures canvas picks it up on first use
    await document.fonts.load(`48px '${FONT_NAME}'`);
  } catch (err) {
    console.warn("Great Vibes font load failed, falling back:", err);
  }
}

/* ── load an image with crossOrigin set BEFORE src ───────────── */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.crossOrigin = "anonymous";   // must be set before .src
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/* ── main render ─────────────────────────────────────────────── */
async function renderCard(
  canvas: HTMLCanvasElement,
  customerName: string,
): Promise<void> {
  // load font and image in parallel
  const [, img] = await Promise.all([
    loadFont(),
    loadImage(cardImageUrl),
  ]);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  // size canvas to the image's natural pixel dimensions
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const W = canvas.width;
  const H = canvas.height;

  // draw base card
  ctx.drawImage(img, 0, 0);

  // find largest font that fits the available gap width
  const maxPx  = W * MAX_W_RATIO;
  let   fs     = Math.round(W * BASE_FS_RATIO);
  ctx.font     = `${fs}px '${FONT_NAME}'`;

  while (ctx.measureText(customerName).width > maxPx && fs > 8) {
    fs      -= 1;
    ctx.font = `${fs}px '${FONT_NAME}'`;
  }

  // paint name
  ctx.save();
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = NAME_COLOR;
  ctx.font         = `${fs}px '${FONT_NAME}'`;
  ctx.fillText(customerName, W * NAME_X_RATIO, H * NAME_Y_RATIO, maxPx);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
export default function ThankYouCard({ customerName, hideDownload = false }: ThankYouCardProps) {
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReady(false);
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCard(canvas, customerName)
      .then(()  => setReady(true))
      .catch((e) => {
        console.error("ThankYouCard render failed:", e);
        setError("Could not load card image.");
      });
  }, [customerName]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setLoading(true);
    try {
      // toDataURL works because crossOrigin="anonymous" was set on the image
      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      const doc     = new jsPDF({
        unit:        "mm",
        format:      [101.6, 152.4],   // 4 × 6 in
        orientation: "portrait",
      });
      doc.addImage(imgData, "JPEG", 0, 0, 101.6, 152.4);
      doc.save(`thank-you-${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setLoading(false);
    }
  }

  /* preview display dimensions: 300 px wide, aspect preserved */
  const PREVIEW_W = 300;

  return (
    <div style={{
      display:       "inline-flex",
      flexDirection: "column",
      alignItems:    "center",
      gap:           14,
    }}>

      {error ? (
        <div style={{
          width: PREVIEW_W, padding: "40px 20px",
          textAlign: "center", color: "#9333ea",
          fontSize: 13, fontFamily: "Poppins, sans-serif",
          border: "1px solid #e9d5ff", borderRadius: 8,
        }}>
          {error}
        </div>
      ) : (
        <div style={{ position: "relative", width: PREVIEW_W }}>
          {/* skeleton shown while loading */}
          {!ready && (
            <div style={{
              position:        "absolute", inset: 0,
              background:      "linear-gradient(135deg,#f3e8ff 0%,#ede9fe 100%)",
              borderRadius:    8,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              color:           "#9333ea",
              fontSize:        13,
              fontFamily:      "Poppins, sans-serif",
            }}>
              Loading card…
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{
              width:        PREVIEW_W,
              height:       "auto",          // browser scales height from canvas intrinsic ratio
              display:      "block",
              borderRadius: 8,
              border:       "1px solid #e9d5ff",
              boxShadow:    "0 2px 20px rgba(123,47,247,0.13)",
              opacity:      ready ? 1 : 0,
              transition:   "opacity 0.35s",
            }}
          />
        </div>
      )}

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
            whiteSpace:   "nowrap",
          }}
        >
          {loading
            ? <>⏳&nbsp;Saving…</>
            : <>⬇️&nbsp;Download 4×6 PDF</>}
        </button>
      )}

    </div>
  );
}
