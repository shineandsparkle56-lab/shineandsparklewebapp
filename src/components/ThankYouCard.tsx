import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { getSetting } from "../lib/settings";

interface ThankYouCardProps {
  customerName: string;
  hideDownload?: boolean;
}

/* ─── name overlay position (fraction of image natural size) ─── */
const NAME_X_RATIO  = 0.370;   // left-edge of name, just after "Hey "
const NAME_Y_RATIO  = 0.456;   // vertical centre of the pill row
const MAX_W_RATIO   = 0.500;   // max width before font auto-shrinks
const BASE_FS_RATIO = 0.065;   // starting font-size as fraction of W
const NAME_COLOR    = "#7b2ff7";

/* ─── Great Vibes font (loaded once via FontFace API) ─────────── */
const FONT_NAME = "Great Vibes";
const FONT_URL  =
  "https://fonts.gstatic.com/s/greatvibes/v19/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2";

let fontLoadPromise: Promise<void> | null = null;
function ensureFont(): Promise<void> {
  if (fontLoadPromise) return fontLoadPromise;
  fontLoadPromise = (async () => {
    if (document.fonts.check(`12px '${FONT_NAME}'`)) return;
    try {
      const face = new FontFace(FONT_NAME, `url(${FONT_URL})`, {
        style: "normal", weight: "400",
      });
      document.fonts.add(await face.load());
      await document.fonts.load(`48px '${FONT_NAME}'`);
    } catch {
      /* fallback to system cursive — better than crashing */
    }
  })();
  return fontLoadPromise;
}

/* ─── fetch card image via server-side proxy (zero CORS issues) ─ */
async function fetchCardDataUrl(): Promise<string> {
  const r2Url = await getSetting("thank_you_card_url");
  if (!r2Url) throw new Error("NO_CARD");

  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(r2Url)}`);
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);

  const { base64, contentType } = (await res.json()) as {
    base64: string;
    contentType: string;
  };
  return `data:${contentType};base64,${base64}`;
}

/* ─── load HTMLImageElement from a data/blob URL ─────────────── */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img  = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/* ─── draw card + name onto an off-screen canvas ─────────────── */
async function buildCanvas(
  dataUrl: string,
  customerName: string,
): Promise<HTMLCanvasElement> {
  const [, img] = await Promise.all([ensureFont(), loadImg(dataUrl)]);

  const canvas  = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx     = canvas.getContext("2d")!;
  const W       = canvas.width;
  const H       = canvas.height;

  /* 1 — base card */
  ctx.drawImage(img, 0, 0);

  /* 2 — find largest font size that fits the gap */
  const maxPx = W * MAX_W_RATIO;
  let   fs    = Math.round(W * BASE_FS_RATIO);
  ctx.font    = `${fs}px '${FONT_NAME}', cursive`;
  while (ctx.measureText(customerName).width > maxPx && fs > 8) {
    fs      -= 1;
    ctx.font = `${fs}px '${FONT_NAME}', cursive`;
  }

  /* 3 — paint name */
  ctx.save();
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = NAME_COLOR;
  ctx.font         = `${fs}px '${FONT_NAME}', cursive`;
  ctx.fillText(customerName, W * NAME_X_RATIO, H * NAME_Y_RATIO, maxPx);
  ctx.restore();

  return canvas;
}

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
export default function ThankYouCard({
  customerName,
  hideDownload = false,
}: ThankYouCardProps) {
  /* dataUrl is the proxied base64 image — safe to use everywhere */
  const [dataUrl,  setDataUrl]  = useState<string | null>(null);
  const [status,   setStatus]   = useState<"loading" | "ready" | "no-card" | "error">("loading");
  const [loading,  setLoading]  = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setStatus("loading");
    setDataUrl(null);

    fetchCardDataUrl()
      .then((url) => { setDataUrl(url); setStatus("ready"); })
      .catch((err: Error) => {
        if (err.message === "NO_CARD") setStatus("no-card");
        else setStatus("error");
      });
  }, []);

  async function handleDownload() {
    if (!dataUrl) return;
    setLoading(true);
    try {
      const canvas  = await buildCanvas(dataUrl, customerName);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const doc = new jsPDF({
        unit: "mm", format: [101.6, 152.4], orientation: "portrait",
      });
      doc.addImage(imgData, "JPEG", 0, 0, 101.6, 152.4);
      doc.save(`thank-you-${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setLoading(false);
    }
  }

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column",
      alignItems: "center", gap: 14,
    }}>

      {/* ── preview area ── */}
      <div style={{ width: 300, minHeight: 80 }}>

        {status === "loading" && (
          <div style={{
            width: 300, height: 450,
            background: "linear-gradient(135deg,#f3e8ff,#ede9fe)",
            borderRadius: 8, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            color: "#9333ea", fontSize: 13, fontFamily: "Poppins,sans-serif",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="#9333ea" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Loading card…
          </div>
        )}

        {status === "no-card" && (
          <div style={{
            width: 300, height: 180,
            background: "#f3e8ff", borderRadius: 8,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            padding: 20, boxSizing: "border-box",
            border: "1.5px dashed #c084fc",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9l4-4 4 4 4-4 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <p style={{
              fontFamily: "Poppins,sans-serif", fontSize: 13,
              color: "#7e22ce", textAlign: "center", margin: 0,
            }}>
              No card image uploaded yet.
            </p>
            <p style={{
              fontFamily: "Poppins,sans-serif", fontSize: 11,
              color: "#a855f7", textAlign: "center", margin: 0,
            }}>
              Go to Admin → Settings → Thank You Card to upload one.
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{
            width: 300, height: 120,
            background: "#fff1f2", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#e11d48", fontSize: 13, fontFamily: "Poppins,sans-serif",
            border: "1px solid #fecdd3",
          }}>
            Failed to load card image.
          </div>
        )}

        {status === "ready" && dataUrl && (
          /* Composite preview: base image + CSS name overlay */
          <div style={{ position: "relative", width: 300 }}>
            <img
              ref={previewRef}
              src={dataUrl}
              alt="Thank You Card"
              style={{
                width: 300, height: "auto", display: "block",
                borderRadius: 8, border: "1px solid #e9d5ff",
                boxShadow: "0 2px 20px rgba(123,47,247,0.13)",
              }}
            />
            {/* CSS name overlay — visual only, PDF uses canvas */}
            <div style={{
              position:   "absolute",
              left:       `${NAME_X_RATIO * 100}%`,
              top:        `${NAME_Y_RATIO * 100}%`,
              transform:  "translateY(-50%)",
              fontFamily: `'Great Vibes', cursive`,
              fontSize:   "clamp(13px, 5vw, 20px)",
              color:      NAME_COLOR,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              lineHeight: 1,
            }}>
              {customerName}
            </div>
          </div>
        )}
      </div>

      {/* ── download button ── */}
      {!hideDownload && (
        <button
          onClick={handleDownload}
          disabled={status !== "ready" || loading}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: (status !== "ready" || loading) ? "#a855f7" : "#7b2ff7",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 28px", fontSize: 14, fontWeight: 600,
            fontFamily: "Poppins, sans-serif",
            cursor: (status !== "ready" || loading) ? "not-allowed" : "pointer",
            boxShadow: "0 2px 14px rgba(123,47,247,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          {loading
            ? <>⏳&nbsp;Generating PDF…</>
            : <>⬇️&nbsp;Download 4×6 PDF</>}
        </button>
      )}

    </div>
  );
}
