import { jsPDF } from "jspdf";
import type { CartItem } from "../context/CartContext";

// ── Brand colours ───────────────────────────────────────────────
const PURPLE       = [155, 111, 209] as const;  // #9B6FD1
const PURPLE_LIGHT = [243, 238, 251] as const;  // #F3EEFB
const PURPLE_MID   = [220, 200, 245] as const;
const DARK         = [30,  30,  30 ] as const;
const GREY         = [120, 120, 120] as const;
const WHITE        = [255, 255, 255] as const;

// ── Layout constants (mm) ───────────────────────────────────────
const PAGE_W   = 210;
const PAGE_H   = 297;
const MARGIN   = 14;
const IMG_W    = 30;   // thumbnail width
const IMG_H    = 28;   // thumbnail height
const ROW_H    = 36;   // row height per item
const HEADER_H = 44;
const FOOTER_H = 22;

// Column X positions (all measured from left edge)
const COL_IMG   = MARGIN;                          //  14  — image
const COL_TEXT  = MARGIN + IMG_W + 5;              //  49  — name / details
const COL_QTY   = PAGE_W - MARGIN - 28;           // 168  — qty (right-aligned anchor)
const COL_PRICE = PAGE_W - MARGIN;                // 196  — price (right-aligned anchor)

// ── Helpers ──────────────────────────────────────────────────────

/** jsPDF helvetica can't render ₹ — use Rs. instead */
function rs(amount: number): string {
  return `Rs. ${amount}`;
}

/** Fetch any image URL → base64 data-URL */
async function toDataURL(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormat(dataUrl: string): string {
  const mime = dataUrl.split(";")[0].split(":")[1] ?? "";
  if (mime.includes("png"))  return "PNG";
  if (mime.includes("webp")) return "WEBP";
  return "JPEG";
}

// ── Main export ───────────────────────────────────────────────────
export async function generateOrderPDF(
  cart: CartItem[],
  subtotal: number
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Pre-fetch all images in parallel
  const imageDataUrls = await Promise.all(
    cart.map((item) => {
      const src = item.product.images?.length
        ? item.product.images[0]
        : item.product.image;
      return toDataURL(src);
    })
  );

  // ── HEADER ───────────────────────────────────────────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Brand name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text("Shine and Sparkle", MARGIN, 17);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 205, 245);
  doc.text("Premium Indian Jewelry", MARGIN, 25);

  // Date — right side
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`Order Summary`, PAGE_W - MARGIN, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(today, PAGE_W - MARGIN, 25, { align: "right" });

  // Thin accent bar at bottom of header
  doc.setFillColor(...PURPLE_MID);
  doc.rect(0, HEADER_H - 3, PAGE_W, 3, "F");

  // ── SECTION TITLE ────────────────────────────────────────────
  let y = HEADER_H + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Items Ordered", MARGIN, y);

  y += 5;
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  // ── COLUMN HEADERS ───────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text("PRODUCT",  COL_TEXT,   y);
  doc.text("QTY",      COL_QTY,    y, { align: "right" });
  doc.text("PRICE",    COL_PRICE,  y, { align: "right" });
  y += 4;

  // ── ITEM ROWS ────────────────────────────────────────────────
  cart.forEach((item, i) => {
    const rowY = y;

    // Alternating background
    if (i % 2 === 0) {
      doc.setFillColor(...PURPLE_LIGHT);
      doc.roundedRect(MARGIN - 2, rowY - 1, PAGE_W - MARGIN * 2 + 4, ROW_H, 2, 2, "F");
    }

    // ── Thumbnail ──
    const dataUrl = imageDataUrls[i];
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, imageFormat(dataUrl), COL_IMG, rowY + 1, IMG_W, IMG_H);
      } catch {
        drawImagePlaceholder(doc, COL_IMG, rowY + 1, IMG_W, IMG_H);
      }
    } else {
      drawImagePlaceholder(doc, COL_IMG, rowY + 1, IMG_W, IMG_H);
    }

    // ── Product name ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    const maxNameW = COL_QTY - COL_TEXT - 4;
    const nameLines = doc.splitTextToSize(item.product.name, maxNameW);
    doc.text(nameLines.slice(0, 2) as string[], COL_TEXT, rowY + 9);

    // ── Category ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(item.product.category.toUpperCase(), COL_TEXT, rowY + 17);

    // ── Unit price ──
    doc.setFontSize(8);
    doc.setTextColor(110, 80, 160);
    doc.text(rs(item.product.price) + " each", COL_TEXT, rowY + 24);

    // ── Quantity — vertically centred in row ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(`x${item.quantity}`, COL_QTY, rowY + 14, { align: "right" });

    // ── Line total ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.text(rs(item.product.price * item.quantity), COL_PRICE, rowY + 14, { align: "right" });

    y += ROW_H + 2;
  });

  // ── SUBTOTAL ────────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(...PURPLE_MID);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text("Subtotal", MARGIN, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(rs(subtotal), COL_PRICE, y, { align: "right" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text("Shipping charges will be confirmed via WhatsApp.", MARGIN, y);

  // ── FOOTER ──────────────────────────────────────────────────
  const footerY = PAGE_H - FOOTER_H;
  doc.setFillColor(...PURPLE_LIGHT);
  doc.rect(0, footerY, PAGE_W, FOOTER_H, "F");
  doc.setDrawColor(...PURPLE_MID);
  doc.setLineWidth(0.3);
  doc.line(0, footerY, PAGE_W, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PURPLE);
  doc.text(
    "Thank you for shopping with Shine and Sparkle!",
    PAGE_W / 2, footerY + 8,
    { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GREY);
  doc.text(
    "For queries, reach us on WhatsApp  |  www.shineandsparkle.in",
    PAGE_W / 2, footerY + 15,
    { align: "center" }
  );

  // Return as Blob so caller can choose to save or share
  return doc.output("blob");
}

function drawImagePlaceholder(
  doc: jsPDF,
  x: number, y: number, w: number, h: number
) {
  doc.setFillColor(230, 220, 248);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 130, 200);
  doc.text("No image", x + w / 2, y + h / 2 + 1, { align: "center" });
}
