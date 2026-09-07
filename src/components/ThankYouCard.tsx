import { useRef, useState } from "react";
import { jsPDF } from "jspdf";
import cardImageUrl from "../assets/thank_you_card.webp";

interface ThankYouCardProps {
  customerName: string;
  hideDownload?: boolean;
}

/*
 * Coordinates as a fraction of the image's natural dimensions.
 * The pill already contains "Hey" (left) and "♡," (right).
 * We paint the name just after "Hey ".
 *
 * NAME_X  – left edge of name text  (after "Hey ")
 * NAME_Y  – vertical mid of pill row
 * MAX_W   – max width name may use before font shrinks
 */
const NAME_X_RATIO  = 0.370;
const NAME_Y_RATIO  = 0.460;
const MAX_W_RATIO   = 0.500;
const BASE_FS_RATIO = 0.065;
const NAME_COLOR    = "#7b2ff7";
const FONT_NAME     = "Great Vibes";
const FONT_URL      =
  "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2";

async function loadGreatVibes(): Promise<void> {
  if (document.fonts.check(`12px '${FONT_NAME}'`)) return;
  try {
    const face = new FontFace(FONT_NAME, `url(${FONT_URL})`, { style: "normal", weight: "400" });
    document.fonts.add(await face.load());
    await document.fonts.load(`48px '${FONT_NAME}'`);
  } catch {
    /* fall back to cursive — better than crashing */
  }
}

async function buildCanvas(customerName: string): Promise<HTMLCanvasElement> {
  await loadGreatVibes();

  /* fetch the image as a blob — avoids all CORS/taint issues */
  const blob    = await fetch(cardImageUrl).then((r) => r.blob());
  const blobUrl = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el  = new Image();
    el.onload  = () => resolve(el);
    el.onerror = reject;
    el.src     = blobUrl;
  });

  URL.revokeObjectURL(blobUrl);

  const canvas   = document.createElement("canvas");
  canvas.width   = img.naturalWidth;
  canvas.height  = img.naturalHeight;
  const ctx      = canvas.getContext("2d")!;
  const W        = canvas.width;
  const H        = canvas.height;

  ctx.drawImage(img, 0, 0);

  /* fit font size to available gap */
  const maxPx = W * MAX_W_RATIO;
  let   fs    = Math.round(W * BASE_FS_RATIO);
  ctx.font    = `${fs}px '${FONT_NAME}', cursive`;
  while (ctx.measureText(customerName).width > maxPx && fs > 8) {
    fs      -= 1;
    ctx.font = `${fs}px '${FONT_NAME}', cursive`;
  }

  ctx.save();
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = NAME_COLOR;
  ctx.font         = `${fs}px '${FONT_NAME}', cursive`;
  ctx.fillText(customerName, W * NAME_X_RATIO, H * NAME_Y_RATIO, maxPx);
  ctx.restore();

  return canvas;
}

export default function ThankYouCard({ customerName, hideDownload = false }: ThankYouCardProps) {
  const imgRef                = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const canvas  = await buildCanvas(customerName);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const doc     = new jsPDF({ unit: "mm", format: [101.6, 152.4], orientation: "portrait" });
      doc.addImage(imgData, "JPEG", 0, 0, 101.6, 152.4);
      doc.save(`thank-you-${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 14 }}>

      {/* ── preview: plain <img> tag — always works in production ── */}
      <div style={{ position: "relative", width: 300 }}>
        {imgError ? (
          <div style={{
            width: 300, height: 450,
            background: "linear-gradient(135deg,#f3e8ff,#ede9fe)",
            borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#9333ea", fontSize: 13, fontFamily: "Poppins,sans-serif",
          }}>
            Could not load card image
          </div>
        ) : (
          <>
            {/* base card image */}
            <img
              ref={imgRef}
              src={cardImageUrl}
              alt="Thank You Card"
              onError={() => setImgError(true)}
              style={{
                width: 300, height: "auto", display: "block",
                borderRadius: 8,
                border: "1px solid #e9d5ff",
                boxShadow: "0 2px 20px rgba(123,47,247,0.13)",
              }}
            />

            {/* name overlay using HTML on top of the img */}
            <div style={{
              position:   "absolute",
              /* these % values mirror NAME_X_RATIO / NAME_Y_RATIO */
              left:       `${NAME_X_RATIO * 100}%`,
              top:        `${NAME_Y_RATIO * 100}%`,
              transform:  "translateY(-50%)",
              fontFamily: `'Great Vibes', cursive`,
              fontSize:   "clamp(14px, 5.8vw, 22px)",
              color:      NAME_COLOR,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              lineHeight: 1,
            }}>
              {customerName}
            </div>
          </>
        )}
      </div>

      {!hideDownload && (
        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background:   loading ? "#a855f7" : "#7b2ff7",
            color:        "#fff", border: "none", borderRadius: 10,
            padding:      "10px 28px", fontSize: 14, fontWeight: 600,
            fontFamily:   "Poppins, sans-serif",
            cursor:       loading ? "not-allowed" : "pointer",
            boxShadow:    "0 2px 14px rgba(123,47,247,0.25)",
            whiteSpace:   "nowrap",
          }}
        >
          {loading ? <>⏳&nbsp;Saving…</> : <>⬇️&nbsp;Download 4×6 PDF</>}
        </button>
      )}

    </div>
  );
}
