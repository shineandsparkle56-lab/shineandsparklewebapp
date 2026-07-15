import { jsPDF } from "jspdf";
import type { CartItem } from "../context/CartContext";

// ── Brand colours ───────────────────────────────────────────────
const PURPLE       = [155, 111, 209] as const;
const PURPLE_LIGHT = [243, 238, 251] as const;
const PURPLE_MID   = [220, 200, 245] as const;
const DARK         = [30,  30,  30 ] as const;
const GREY         = [120, 120, 120] as const;
const WHITE        = [255, 255, 255] as const;

// ── Layout constants (mm) ───────────────────────────────────────
const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 14;
const IMG_W     = 30;
const IMG_H     = 28;
const ROW_H     = 36;
const HEADER_H  = 32;   // repeated header on new pages
const FOOTER_H  = 22;
const SAFE_BOTTOM = FOOTER_H + 10;  // reserve space at bottom for footer

const COL_IMG   = MARGIN;
const COL_TEXT  = MARGIN + IMG_W + 5;
const COL_QTY   = PAGE_W - MARGIN - 28;
const COL_PRICE = PAGE_W - MARGIN;

// ── Types ────────────────────────────────────────────────────────
export interface OrderMeta {
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  pincode?: string;
  paymentMode?: string;
  shippingCharge?: number;
  codCharge?: number;
  grandTotal?: number;
}

// ── Helpers ──────────────────────────────────────────────────────
function rs(amount: number): string { return `Rs. ${amount}`; }

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
  } catch { return null; }
}

function imageFormat(dataUrl: string): string {
  const mime = dataUrl.split(";")[0].split(":")[1] ?? "";
  if (mime.includes("png"))  return "PNG";
  if (mime.includes("webp")) return "WEBP";
  return "JPEG";
}

/**
 * Draw an image clipped to a rounded rectangle.
 * jsPDF stores pages in PDF units (points). We use saveGraphicsState /
 * restoreGraphicsState + a raw clip path so the image gets rounded corners.
 */
function addRoundedImage(
  doc: jsPDF,
  dataUrl: string,
  fmt: string,
  x: number, y: number, w: number, h: number,
  r: number
) {
  // jsPDF "mm" unit: 1 mm = 72/25.4 pt ≈ 2.8346 pt
  const sf = 72 / 25.4;
  // PDF coordinate origin is bottom-left; jsPDF page height in pt
  const pageH = (doc.internal.pageSize.getHeight() as number) * sf;
  const toX = (v: number) => ((v) * sf).toFixed(3);
  const toY = (v: number) => (pageH - v * sf).toFixed(3); // flip y

  const x1 = x, y1 = y, x2 = x + w, y2 = y + h;

  doc.saveGraphicsState();

  // Rounded-rect clip path in raw PDF syntax (Bézier approximation k≈0.5523)
  const k = 0.5523 * r;
  const path = [
    `${toX(x1 + r)} ${toY(y1)} m`,                                           // top-left start
    `${toX(x2 - r)} ${toY(y1)} l`,                                           // top edge
    `${toX(x2 - r + k)} ${toY(y1)} ${toX(x2)} ${toY(y1 + r - k)} ${toX(x2)} ${toY(y1 + r)} c`, // top-right curve
    `${toX(x2)} ${toY(y2 - r)} l`,                                           // right edge
    `${toX(x2)} ${toY(y2 - r + k)} ${toX(x2 - r + k)} ${toY(y2)} ${toX(x2 - r)} ${toY(y2)} c`, // bottom-right curve
    `${toX(x1 + r)} ${toY(y2)} l`,                                           // bottom edge
    `${toX(x1 + r - k)} ${toY(y2)} ${toX(x1)} ${toY(y2 - r + k)} ${toX(x1)} ${toY(y2 - r)} c`, // bottom-left curve
    `${toX(x1)} ${toY(y1 + r)} l`,                                           // left edge
    `${toX(x1)} ${toY(y1 + r - k)} ${toX(x1 + r - k)} ${toY(y1)} ${toX(x1 + r)} ${toY(y1)} c`, // top-left curve
    `W n`,                                                                     // clip + end path
  ].join(" ");

  (doc as jsPDF & { internal: { write: (s: string) => void } }).internal.write(path);

  doc.addImage(dataUrl, fmt, x, y, w, h);
  doc.restoreGraphicsState();
}

function drawImagePlaceholder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(230, 220, 248);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 130, 200);
  doc.text("No image", x + w / 2, y + h / 2 + 1, { align: "center" });
}

/** Draw the compact page-top header (used on page 2+) */
function drawPageHeader(doc: jsPDF): number {
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text("Shine and Sparkle", MARGIN, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 205, 245);
  doc.text("Premium Indian Jewelry", MARGIN, 22);
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("Order Summary (continued)", PAGE_W - MARGIN, 14, { align: "right" });
  doc.setFillColor(...PURPLE_MID);
  doc.rect(0, HEADER_H - 2, PAGE_W, 2, "F");
  return HEADER_H + 8;
}

/** Draw the footer on the current last page */
function drawFooter(doc: jsPDF) {
  const totalPages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = PAGE_H - FOOTER_H;
    doc.setFillColor(...PURPLE_LIGHT);
    doc.rect(0, footerY, PAGE_W, FOOTER_H, "F");
    doc.setDrawColor(...PURPLE_MID);
    doc.setLineWidth(0.3);
    doc.line(0, footerY, PAGE_W, footerY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PURPLE);
    doc.text("Thank you for shopping with Shine and Sparkle!", PAGE_W / 2, footerY + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(
      `For queries, reach us on WhatsApp  |  www.shineandsparkle.in${totalPages > 1 ? `  |  Page ${p} of ${totalPages}` : ""}`,
      PAGE_W / 2, footerY + 15, { align: "center" }
    );
  }
}

// ── Main export ───────────────────────────────────────────────────
export async function generateOrderPDF(
  cart: CartItem[],
  subtotal: number,
  meta: OrderMeta = {}
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Pre-fetch all images
  const imageDataUrls = await Promise.all(
    cart.map((item) => toDataURL(
      item.product.images?.length ? item.product.images[0] : item.product.image
    ))
  );

  // Returns current y, adds new page + header if content would overflow
  const checkBreak = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight > PAGE_H - SAFE_BOTTOM) {
      doc.addPage();
      return drawPageHeader(doc);
    }
    return currentY;
  };

  // ── PAGE 1 HEADER ─────────────────────────────────────────────
  const FIRST_HEADER_H = 44;
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, PAGE_W, FIRST_HEADER_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text("Shine and Sparkle", MARGIN, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 205, 245);
  doc.text("Premium Indian Jewelry", MARGIN, 25);

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("Order Summary", PAGE_W - MARGIN, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(today, PAGE_W - MARGIN, 25, { align: "right" });
  doc.setFillColor(...PURPLE_MID);
  doc.rect(0, FIRST_HEADER_H - 3, PAGE_W, 3, "F");

  let y = FIRST_HEADER_H + 8;

  // ── DELIVERY DETAILS ──────────────────────────────────────────
  const hasCustomer = meta.customerName || meta.customerAddress;
  if (hasCustomer) {
    const leftLines: [string, string][] = [];
    if (meta.customerName)   leftLines.push(["Name",    meta.customerName!]);
    if (meta.customerMobile) leftLines.push(["Mobile",  meta.customerMobile!]);
    if (meta.paymentMode)    leftLines.push(["Payment", meta.paymentMode === "cod" ? "Cash on Delivery" : "Online / Prepaid"]);

    const rightLines: [string, string][] = [];
    if (meta.customerAddress) rightLines.push(["Address", meta.customerAddress!]);
    if (meta.customerCity)    rightLines.push(["City",    meta.customerCity!]);
    if (meta.customerState)   rightLines.push(["State",   meta.customerState!]);
    if (meta.pincode)         rightLines.push(["PIN",     meta.pincode!]);

    const maxRows = Math.max(leftLines.length, rightLines.length);
    const blockH  = 4 + 5 + maxRows * 7 + 6 + 6; // title + divider + rows + gap + divider
    y = checkBreak(y, blockH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Delivery Details", MARGIN, y);
    y += 4;

    doc.setDrawColor(...PURPLE_MID);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;

    const leftX  = MARGIN;
    const rightX = PAGE_W / 2 + 2;
    const rowH   = 7;

    for (let i = 0; i < maxRows; i++) {
      const ly = y + i * rowH;
      if (leftLines[i]) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text(leftLines[i][0] + ":", leftX, ly);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(leftLines[i][1], leftX + 22, ly);
      }
      if (rightLines[i]) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY);
        doc.text(rightLines[i][0] + ":", rightX, ly);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        const maxW   = PAGE_W - MARGIN - rightX - 18;
        const wrapped = doc.splitTextToSize(rightLines[i][1], maxW);
        doc.text(wrapped[0] as string, rightX + 18, ly);
      }
    }

    y += maxRows * rowH + 6;
    doc.setDrawColor(...PURPLE_MID);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  }

  // ── ITEMS SECTION TITLE ───────────────────────────────────────
  y = checkBreak(y, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Items Ordered", MARGIN, y);
  y += 4;

  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  // Column headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text("PRODUCT", COL_TEXT,  y);
  doc.text("QTY",     COL_QTY,   y, { align: "right" });
  doc.text("PRICE",   COL_PRICE, y, { align: "right" });
  y += 4;

  // ── ITEM ROWS ─────────────────────────────────────────────────
  cart.forEach((item, i) => {
    y = checkBreak(y, ROW_H + 4);
    const rowY = y;

    if (i % 2 === 0) {
      doc.setFillColor(...PURPLE_LIGHT);
      doc.roundedRect(MARGIN - 2, rowY - 1, PAGE_W - MARGIN * 2 + 4, ROW_H, 2, 2, "F");
    }

    const dataUrl = imageDataUrls[i];
    if (dataUrl) {
      try {
        addRoundedImage(doc, dataUrl, imageFormat(dataUrl), COL_IMG, rowY + 1, IMG_W, IMG_H, 3);
      } catch { drawImagePlaceholder(doc, COL_IMG, rowY + 1, IMG_W, IMG_H); }
    } else {
      drawImagePlaceholder(doc, COL_IMG, rowY + 1, IMG_W, IMG_H);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    const nameLines = doc.splitTextToSize(item.product.name, COL_QTY - COL_TEXT - 4);
    doc.text(nameLines.slice(0, 2) as string[], COL_TEXT, rowY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(item.product.category.toUpperCase(), COL_TEXT, rowY + 17);

    doc.setFontSize(8);
    doc.setTextColor(110, 80, 160);
    doc.text(rs(item.product.price) + " each", COL_TEXT, rowY + 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(`x${item.quantity}`, COL_QTY, rowY + 14, { align: "right" });

    doc.setFontSize(11);
    doc.setTextColor(...PURPLE);
    doc.text(rs(item.product.price * item.quantity), COL_PRICE, rowY + 14, { align: "right" });

    y += ROW_H + 2;
  });

  // ── ORDER TOTALS ──────────────────────────────────────────────
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalRows: [string, string, boolean][] = [
    ["Total Items", `${totalQty} item${totalQty !== 1 ? "s" : ""}`, false],
    ["Subtotal", rs(subtotal), false],
  ];
  if (meta.shippingCharge && meta.shippingCharge > 0)
    totalRows.push(["Shipping Charge", rs(meta.shippingCharge), false]);
  if (meta.codCharge && meta.codCharge > 0)
    totalRows.push(["COD Charge", rs(meta.codCharge), false]);
  totalRows.push(["Grand Total", rs(meta.grandTotal ?? subtotal), true]);

  // Height needed: divider + gap + rows
  const totalsH = 4 + 7 + totalRows.reduce((acc, [,, bold]) => acc + (bold ? 9 : 7), 0);
  y = checkBreak(y, totalsH + FOOTER_H + 4);

  y += 4;
  doc.setDrawColor(...PURPLE_MID);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;

  totalRows.forEach(([label, value, isBold]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? 13 : 10);
    if (isBold) {
      doc.setTextColor(...DARK);
      doc.text(label, MARGIN, y);
      doc.setTextColor(...PURPLE);
      doc.text(value, COL_PRICE, y, { align: "right" });
    } else {
      doc.setTextColor(...GREY);
      doc.text(label, MARGIN, y);
      doc.text(value, COL_PRICE, y, { align: "right" });
    }
    y += isBold ? 9 : 7;
  });

  // ── FOOTER on every page ──────────────────────────────────────
  drawFooter(doc);

  return doc.output("blob");
}
