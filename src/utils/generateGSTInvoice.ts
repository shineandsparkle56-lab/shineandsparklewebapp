/**
 * generateGSTInvoice.ts
 * Branded GST Tax Invoice — Shine & Sparkle purple theme.
 *
 * Page layout:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ [Purple header bar]  Logo + "Shine and Sparkle"  TAX INVOICE │
 *  ├──────────────────┬───────────────────────────────────────┤
 *  │  Sold By         │  Delivered To                         │
 *  ├──────────────────┴───────────────────────────────────────┤
 *  │  Invoice No / Date / Order / AWB  (two-column info grid) │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Items table                                             │
 *  │  Intra-state  : Desc|HSN|Qty|Unit Price|Unit Disc|       │
 *  │                 Taxable|CGST%|CGST₹|SGST%|SGST₹|Total  │
 *  │  Inter-state  : Desc|HSN|Qty|Unit Price|Unit Disc|       │
 *  │                 Taxable|IGST%|IGST₹|Total               │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Shipping row  │  Net Total row                          │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Disclaimer (left)  │  Authorised Signature (right)      │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Net Amount Payable (In Words):  …                       │
 *  └──────────────────────────────────────────────────────────┘
 */

import { jsPDF } from "jspdf";
import type { OrderRow } from "../components/admin/EditOrderModal";

// ── Indian state name → GST state code ───────────────────────────
const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01", "jammu & kashmir": "01",
  "himachal pradesh": "02",
  "punjab": "03",
  "chandigarh": "04",
  "uttarakhand": "05", "uttaranchal": "05",
  "haryana": "06",
  "delhi": "07",
  "rajasthan": "08",
  "uttar pradesh": "09",
  "bihar": "10",
  "sikkim": "11",
  "arunachal pradesh": "12",
  "nagaland": "13",
  "manipur": "14",
  "mizoram": "15",
  "tripura": "16",
  "meghalaya": "17",
  "assam": "18",
  "west bengal": "19",
  "jharkhand": "20",
  "odisha": "21", "orissa": "21",
  "chhattisgarh": "22",
  "madhya pradesh": "23",
  "gujarat": "24",
  "daman and diu": "25", "daman & diu": "25",
  "dadra and nagar haveli": "26", "dadra & nagar haveli": "26",
  "maharashtra": "27",
  "andhra pradesh": "28",
  "karnataka": "29",
  "goa": "30",
  "lakshadweep": "31",
  "kerala": "32",
  "tamil nadu": "33",
  "puducherry": "34", "pondicherry": "34",
  "andaman and nicobar islands": "35", "andaman & nicobar": "35",
  "telangana": "36",
  "andhra pradesh (new)": "37",
  "ladakh": "38",
};

export function getStateCode(stateName: string): string {
  return STATE_CODES[stateName.trim().toLowerCase()] ?? "";
}

// ── Fetch logo ────────────────────────────────────────────────────
async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Fetch any image URL as a base64 data URL (used for signature) */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Brand colours ─────────────────────────────────────────────────
const PURPLE       = [106, 76, 147]  as const;  // #6A4C93 — deeper purple
const PURPLE_LIGHT = [237, 229, 252] as const;  // #EDE5FC — very light purple
const PURPLE_MID   = [195, 174, 232] as const;  // #C3AEE8 — medium purple
const WHITE        = [255, 255, 255] as const;
const BLACK        = [15,  15,  15 ] as const;
const DARK         = [40,  40,  40 ] as const;
const GREY         = [100, 100, 100] as const;
const LGREY        = [200, 200, 200] as const;
const BGLIGHT      = [250, 248, 255] as const;  // off-white purple tint

// ── Layout (A4 mm) ────────────────────────────────────────────────
const PW = 210;
const PH = 297;
const M  = 12;          // margin
const CW = PW - M * 2;  // 186mm

// ── Helpers ───────────────────────────────────────────────────────
function n2(v: number) { return v.toFixed(2); }

function toIndianWords(amount: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function conv(n: number): string {
    if (n < 20)  return ones[n];
    if (n < 100) return tens[Math.floor(n/10)]+(n%10?" "+ones[n%10]:"");
    if (n < 1000) return ones[Math.floor(n/100)]+" Hundred"+(n%100?" "+conv(n%100):"");
    if (n < 100000) return conv(Math.floor(n/1000))+" Thousand"+(n%1000?" "+conv(n%1000):"");
    if (n < 10000000) return conv(Math.floor(n/100000))+" Lakh"+(n%100000?" "+conv(n%100000):"");
    return conv(Math.floor(n/10000000))+" Crore"+(n%10000000?" "+conv(n%10000000):"");
  }
  const r = Math.round(amount);
  return r === 0 ? "Zero Rupees Only" : conv(r)+" Rupees Only";
}

// ── Types (public) ────────────────────────────────────────────────
export interface BizProfile {
  legalName:      string;
  addressLine1:   string;
  addressLine2:   string;
  city:           string;
  state:          string;
  pincode:        string;
  phone:          string;
  gstin:          string;
  pan:            string;
  stateCode:      string;
  invoicePrefix:  string;
  defaultHsn:     string;
  defaultGstRate: number;
  signatureUrl:   string;  // uploaded signature image URL (empty = text only)
}

export interface GSTInvoiceItem {
  description:  string;
  sku:          string;
  hsn:          string;
  qty:          number;
  unitPrice:    number;  // MRP
  unitDisc:     number;  // MRP - selling (per unit)
  taxableValue: number;  // selling*qty / (1+rate/100)
  taxRate:      number;  // GST %
  cgst:         number;
  sgst:         number;
  igst:         number;
  total:        number;  // selling * qty
}

export interface GSTInvoiceData {
  invoiceNo:        string;
  invoiceDate:      string;
  orderNo:          string;
  orderDate:        string;
  paymentMode:      string;
  courierName:      string;
  awbCode:          string;
  eWaybillNo:       string;
  isShiprocket:     boolean;  // true when order has sr_order_id — shows "Shipped By" row
  isIntraState:     boolean;
  items:            GSTInvoiceItem[];
  shippingCharge:   number;   // total shipping (GST-inclusive)
  shippingTaxable:  number;   // shippingCharge / (1 + gstRate/100)
  shippingTax:      number;   // GST amount on shipping (composite supply at biz default rate)
  shippingGstRate:  number;   // GST rate % on shipping
  discountAmount:   number;   // order-level discount (flat ₹ off subtotal)
  discountLabel:    string;   // e.g. "Flat Discount" or "10% Discount"
  packagingCharge:  number;   // packaging charge added to order
  grandTotal:       number;   // source of truth — what customer actually pays
  biz:              BizProfile;
  customer: {
    name:      string;
    address:   string;
    city:      string;
    state:     string;
    pincode:   string;
    phone:     string;
    gstin:     string;
    stateCode: string;
  };
}

// ── Build from OrderRow ───────────────────────────────────────────
export function buildGSTInvoiceData(
  order: OrderRow,
  biz: BizProfile,
  invoiceNo: string,
): GSTInvoiceData {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  const isIntraState =
    (order.customer_state ?? "").trim().toLowerCase() === biz.state.trim().toLowerCase();

  const items: GSTInvoiceItem[] = order.items.map((i) => {
    const snap     = i.product as typeof i.product & { hsn_code?: string; gst_rate?: number };
    const hsn      = snap.hsn_code?.trim() || biz.defaultHsn;
    const gstRate  = snap.gst_rate ?? biz.defaultGstRate;
    const mrp      = i.product.original_price ?? i.product.price;
    const selling  = i.product.price;
    const unitDisc = Math.max(0, mrp - selling);
    const divisor  = 1 + gstRate / 100;
    const taxable  = parseFloat((selling * i.quantity / divisor).toFixed(2));
    const taxTotal = parseFloat((selling * i.quantity - taxable).toFixed(2));
    const half     = parseFloat((taxTotal / 2).toFixed(2));

    return {
      description:  i.variant_label ? `${i.product.name} (${i.variant_label})` : i.product.name,
      sku:          `SNS-${i.product.id}${i.variant_id ? `-${i.variant_id}` : ""}`,
      hsn, qty: i.quantity, unitPrice: mrp, unitDisc,
      taxableValue: taxable, taxRate: gstRate,
      cgst: isIntraState ? half : 0,
      sgst: isIntraState ? half : 0,
      igst: isIntraState ? 0    : taxTotal,
      total: selling * i.quantity,
    };
  });

  const shippingCharge =
    (order.shipping_charge ?? 0) + (order.payment_mode === "cod" ? (order.cod_charge ?? 0) : 0);

  // Shipping is composite supply — same GST rate as products (biz default)
  // GST is inclusive in the shipping charge (back-calculation)
  const shippingGstRate  = biz.defaultGstRate;
  const shippingTaxable  = shippingCharge > 0
    ? parseFloat((shippingCharge / (1 + shippingGstRate / 100)).toFixed(2))
    : 0;
  const shippingTax      = shippingCharge > 0
    ? parseFloat((shippingCharge - shippingTaxable).toFixed(2))
    : 0;

  const discountAmount = order.discount_amount ?? 0;
  const discountLabel  = order.discount_type === "percent"
    ? `${order.discount_value ?? 0}% Discount`
    : "Discount";
  const packagingCharge = order.packaging_charge ?? 0;

  return {
    invoiceNo,
    invoiceDate:  fmt(new Date(order.created_at)),
    orderNo:      `SNS-${order.id}`,
    orderDate:    fmt(new Date(order.created_at)),
    paymentMode:  order.payment_mode === "cod" ? "Cash on Delivery" : "Prepaid / Online",
    courierName:  order.courier_name ?? "",
    awbCode:      order.awb_code ?? "",
    eWaybillNo:   "",
    isShiprocket: !!order.sr_order_id,
    isIntraState,
    items, shippingCharge, shippingTax, shippingTaxable, shippingGstRate,
    discountAmount,
    discountLabel,
    packagingCharge,
    grandTotal:   order.grand_total,
    biz,
    customer: {
      name:      order.customer_name    ?? "",
      address:   order.customer_address ?? "",
      city:      order.customer_city    ?? "",
      state:     order.customer_state   ?? "",
      pincode:   order.pincode          ?? "",
      phone:     order.customer_mobile  ?? "",
      gstin:     "",
      stateCode: getStateCode(order.customer_state ?? ""),
    },
  };
}

export function formatInvoiceNo(prefix: string, srOrderId: number | undefined | null): string {
  if (!srOrderId) return `${prefix}DRAFT`;
  return `${prefix}${String(srOrderId).padStart(5, "0")}`;
}

/**
 * Get the invoice number for an order — prefers the stored invoice_number,
 * falls back to prefix+DRAFT if not yet assigned.
 */
export function getOrderInvoiceNo(order: { invoice_number?: string | null }, prefix: string): string {
  return order.invoice_number?.trim() || `${prefix}DRAFT`;
}

// ════════════════════════════════════════════════════════════════
//  MAIN PDF GENERATOR
// ════════════════════════════════════════════════════════════════
export async function generateGSTInvoice(data: GSTInvoiceData): Promise<Blob> {
  const doc      = new jsPDF({ unit: "mm", format: "a4" });
  const logoData = await fetchLogoDataUrl();
  // Fetch signature image if URL provided
  const sigData  = data.biz.signatureUrl ? await fetchImageAsDataUrl(data.biz.signatureUrl) : null;

  // ── Column layout ─────────────────────────────────────────────
  // Intra-state:  Desc | HSN | Qty | UnitPr | UnitDisc | Taxable | CGST% | CGST₹ | SGST% | SGST₹ | Total
  // Inter-state:  Desc | HSN | Qty | UnitPr | UnitDisc | Taxable | IGST% | IGST₹ | Total
  //
  // We compute columns dynamically based on intra/inter state
  const IS = data.isIntraState;

  // Column widths (mm) — both sets must sum exactly to CW=186
  // Intra: 42+13+8+16+16+20+11+15+11+15+19 = 186 ✓
  // Inter: 48+13+8+17+17+22+20+22+19       = 186 ✓
  const W = IS ? {
    desc: 42, hsn: 13, qty: 8, unitPr: 16, unitDisc: 16, taxable: 20,
    cgstPct: 11, cgstAmt: 15, sgstPct: 11, sgstAmt: 15, total: 19,
  } : {
    desc: 48, hsn: 13, qty: 8, unitPr: 17, unitDisc: 17, taxable: 22,
    igstPct: 20, igstAmt: 22, total: 19,
  };

  // Build column x-positions from widths
  type ColKey = keyof typeof W;
  const COL: Record<string, number> = {};
  let cx = M;
  for (const [k, w] of Object.entries(W)) {
    COL[k] = cx;
    cx += w as number;
  }
  COL["right"] = M + CW;

  // ── Heights ───────────────────────────────────────────────────
  const HDR_H1   = 95; // full header page 1 (measured from actual content)
  const HDR_H2   = 20;  // compact header continuation
  const TBL_HDR  = 10;  // table column header row
  const ROW_BASE = 13;  // min item row height
  const FOOT_H   = 48;  // disclaimer + words + net total

  // ── Utility draw functions ────────────────────────────────────
  const setFill  = (...rgb: readonly [number,number,number]) => doc.setFillColor(...rgb);
  const setDraw  = (...rgb: readonly [number,number,number]) => doc.setDrawColor(...rgb);
  const setColor = (...rgb: readonly [number,number,number]) => doc.setTextColor(...rgb);
  const lw       = (w: number) => doc.setLineWidth(w);

  function filledRect(x: number, y: number, w: number, h: number, ...rgb: readonly [number,number,number]) {
    setFill(...rgb);
    doc.rect(x, y, w, h, "F");
  }

  function outlineRect(x: number, y: number, w: number, h: number, strokeW = 0.25) {
    setDraw(...PURPLE_MID);
    lw(strokeW);
    doc.rect(x, y, w, h, "S");
  }

  function vline(x: number, y1: number, y2: number) {
    setDraw(...PURPLE_MID);
    lw(0.2);
    doc.line(x, y1, x, y2);
  }

  function hline(y: number, x1 = M, x2 = M + CW) {
    setDraw(...PURPLE_MID);
    lw(0.2);
    doc.line(x1, y, x2, y);
  }

  function txt(
    text: string, x: number, y: number,
    opts: {
      size?: number; bold?: boolean; color?: readonly [number,number,number];
      align?: "left"|"center"|"right"; maxW?: number;
    } = {}
  ) {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 7);
    setColor(...(opts.color ?? DARK));
    if (opts.maxW) {
      const lines = doc.splitTextToSize(text, opts.maxW) as string[];
      doc.text(lines, x, y, { align: opts.align ?? "left" });
    } else {
      doc.text(text, x, y, { align: opts.align ?? "left" });
    }
  }

  // ── PAGE 1 HEADER ─────────────────────────────────────────────
  function drawHeader1(): number {
    let y = M;

    // ── Purple top bar (26mm) ─────────────────────────────────
    const BAR_H = 26;
    filledRect(M, y, CW, BAR_H, ...PURPLE);

    // Logo — white circle + image
    if (logoData) {
      setFill(...WHITE);
      doc.circle(M + 14, y + BAR_H / 2, 10, "F");
      doc.addImage(logoData, "PNG", M + 5, y + 3, 18, 18);
    }

    // Brand name + tagline
    txt("Shine and Sparkle", M + 30, y + 11, { size: 14, bold: true, color: WHITE });
    txt("Trendy Indian Jewellery", M + 30, y + 18, { size: 7.5, color: [220, 205, 245] });

    // TAX INVOICE — right side, vertically centred
    txt("TAX INVOICE", M + CW - 2, y + BAR_H / 2 + 3, { size: 16, bold: true, color: WHITE, align: "right" });

    y += BAR_H + 4;

    // ── Sold By | Delivered To ────────────────────────────────
    const col1W = CW * 0.48;
    const col2X = M + col1W + 4;
    const col2W = CW - col1W - 4;

    // Section header bars (7mm)
    const SEC_H = 7;
    filledRect(M,     y, col1W, SEC_H, ...PURPLE);
    filledRect(col2X, y, col2W, SEC_H, ...PURPLE);
    txt("SOLD BY",      M + col1W / 2,      y + SEC_H / 2 + 1.2, { size: 7, bold: true, color: WHITE, align: "center" });
    txt("DELIVERED TO", col2X + col2W / 2,  y + SEC_H / 2 + 1.2, { size: 7, bold: true, color: WHITE, align: "center" });

    y += SEC_H + 5;  // 5mm gap below bar before text starts

    // Seller lines
    const sellerInfo: [string, boolean][] = [
      [data.biz.legalName,                                           true ],
      [data.biz.addressLine1,                                        false],
      [data.biz.addressLine2,                                        false],
      [`${data.biz.city} - ${data.biz.pincode}`,                    false],
      [data.biz.state + ", India",                                   false],
      [`State Code: ${data.biz.stateCode}  |  Ph: ${data.biz.phone}`, false],
      [`GSTIN: ${data.biz.gstin}`,                                   true ],
    ];

    const custInfo: [string, boolean][] = [
      [data.customer.name,                                                    true ],
      [data.customer.address,                                                 false],
      [`${data.customer.city} - ${data.customer.pincode}`,                   false],
      [data.customer.state + ", India",                                       false],
      [`State Code: ${data.customer.stateCode || "—"}  |  Ph: ${data.customer.phone}`, false],
    ];

    const lineH = 4.5;
    let sy = y, cy = y;

    for (const [line, bold] of sellerInfo) {
      if (!line.trim()) continue;
      const wrapped = doc.splitTextToSize(line, col1W - 4) as string[];
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(7);
      setColor(...DARK);
      doc.text(wrapped, M + 2, sy);
      sy += wrapped.length * lineH;
    }

    for (const [line, bold] of custInfo) {
      if (!line.trim()) continue;
      const wrapped = doc.splitTextToSize(line, col2W - 4) as string[];
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(7);
      setColor(...DARK);
      doc.text(wrapped, col2X + 2, cy);
      cy += wrapped.length * lineH;
    }

    const blockEnd = Math.max(sy, cy) + 4;

    // Column separator + bottom rule
    vline(col2X - 2, y - 3, blockEnd);
    hline(blockEnd);
    y = blockEnd + 4;

    // ── Invoice/Order details 2-col info grid ─────────────────
    const grid: [string, string, string, string][] = [
      ["Invoice No.:",  data.invoiceNo,   "Payment:",    data.paymentMode ],
      ["Invoice Date:", data.invoiceDate, "",            ""               ],
    ];
    // Show Shipped By only if pushed to Shiprocket
    if (data.isShiprocket) {
      grid[1][2] = "Shipped By:";
      grid[1][3] = data.courierName || "—";
    }
    // Only show AWB row if AWB exists
    if (data.awbCode) {
      grid.push(["AWB No.:", data.awbCode, "", ""]);
    }
    for (const [l1, v1, l2, v2] of grid) {
      txt(l1, M + 2,           y, { size: 6.5, bold: true, color: GREY });
      txt(v1, M + 28,          y, { size: 6.5, color: DARK });
      txt(l2, M + CW / 2 + 2,  y, { size: 6.5, bold: true, color: GREY });
      txt(v2, M + CW / 2 + 28, y, { size: 6.5, color: DARK });
      y += 5;
    }

    hline(y + 1);
    return y + 5;
  }

  // ── COMPACT HEADER (continuation pages) ──────────────────────
  function drawHeader2(): number {
    let y = M;
    filledRect(M, y, CW, 14, ...PURPLE);
    if (logoData) {
      setFill(...WHITE);
      doc.circle(M + 9, y + 7, 5.5, "F");
      doc.addImage(logoData, "PNG", M + 4, y + 2, 10, 10);
    }
    txt("Shine and Sparkle", M + 21, y + 7, { size: 10, bold: true, color: WHITE });
    txt("TAX INVOICE", M + CW - 1, y + 9, { size: 12, bold: true, color: WHITE, align: "right" });
    y += 16;
    return y;
  }

  // ── TABLE HEADER ──────────────────────────────────────────────
  function drawTableHeader(y: number): number {
    filledRect(M, y, CW, TBL_HDR, ...PURPLE);
    outlineRect(M, y, CW, TBL_HDR, 0.3);

    // Draw all column headers
    function th(label: string, colKey: string, w: number) {
      const x = COL[colKey];
      // vertical separator
      if (x > M) vline(x, y, y + TBL_HDR);
      const cx2 = x + w / 2;
      if (label.includes("\n")) {
        const [a, b] = label.split("\n");
        txt(a, cx2, y + 3.5, { size: 6, bold: true, color: WHITE, align: "center" });
        txt(b, cx2, y + 7.5, { size: 6, bold: true, color: WHITE, align: "center" });
      } else {
        txt(label, cx2, y + TBL_HDR / 2 + 1.2, { size: 6.5, bold: true, color: WHITE, align: "center" });
      }
    }

    th("Description",    "desc",     W.desc);
    th("HSN",            "hsn",      W.hsn);
    th("Qty",            "qty",      W.qty);
    th("Unit\nPrice",    "unitPr",   W.unitPr);
    th("Unit\nDisc.",    "unitDisc", W.unitDisc);
    th("Taxable\nValue", "taxable",  W.taxable);

    if (IS) {
      th("CGST\n%",   "cgstPct", W.cgstPct!);
      th("CGST\nAmt", "cgstAmt", W.cgstAmt!);
      th("SGST\n%",   "sgstPct", W.sgstPct!);
      th("SGST\nAmt", "sgstAmt", W.sgstAmt!);
    } else {
      th("IGST\n%",   "igstPct", (W as any).igstPct);
      th("IGST\nAmt", "igstAmt", (W as any).igstAmt);
    }
    th("Total", "total", W.total);

    return y + TBL_HDR;
  }

  // ── ITEM ROW ──────────────────────────────────────────────────
  function drawItemRow(item: GSTInvoiceItem, y: number, shade: boolean): number {
    const nameW   = doc.splitTextToSize(item.description, W.desc - 3) as string[];
    const rowH    = Math.max(ROW_BASE, nameW.length * 3.8 + 7);
    const midY    = y + rowH / 2 + 1;

    // Background
    if (shade) filledRect(M, y, CW, rowH, ...PURPLE_LIGHT);
    else       filledRect(M, y, CW, rowH, ...BGLIGHT);

    outlineRect(M, y, CW, rowH, 0.2);

    // Column separators
    const sepCols = IS
      ? ["hsn","qty","unitPr","unitDisc","taxable","cgstPct","cgstAmt","sgstPct","sgstAmt","total"]
      : ["hsn","qty","unitPr","unitDisc","taxable","igstPct","igstAmt","total"];
    for (const k of sepCols) vline(COL[k], y, y + rowH);

    // Description + SKU
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setColor(...DARK);
    doc.text(nameW, COL.desc + 1.5, y + 5);
    txt(`SKU: ${item.sku}`, COL.desc + 1.5, y + 5 + nameW.length * 3.8, { size: 6, color: GREY });

    // Numeric cells
    const r = (val: string, col: string, colW: number) => {
      txt(val, COL[col] + colW - 1.5, midY, { size: 7, align: "right" });
    };
    const c = (val: string, col: string, colW: number) => {
      txt(val, COL[col] + colW / 2, midY, { size: 7, align: "center" });
    };

    c(item.hsn,              "hsn",      W.hsn);
    c(String(item.qty),      "qty",      W.qty);
    r(n2(item.unitPrice),    "unitPr",   W.unitPr);
    r(n2(item.unitDisc),     "unitDisc", W.unitDisc);
    r(n2(item.taxableValue), "taxable",  W.taxable);

    if (IS) {
      r(`${(item.taxRate/2).toFixed(2)}%`, "cgstPct", W.cgstPct!);
      r(n2(item.cgst),                     "cgstAmt", W.cgstAmt!);
      r(`${(item.taxRate/2).toFixed(2)}%`, "sgstPct", W.sgstPct!);
      r(n2(item.sgst),                     "sgstAmt", W.sgstAmt!);
    } else {
      r(`${item.taxRate.toFixed(2)}%`,     "igstPct", (W as any).igstPct);
      r(n2(item.igst),                     "igstAmt", (W as any).igstAmt);
    }
    r(n2(item.total), "total", W.total);

    return y + rowH;
  }

  // ── EXTRA ROW (shipping / discount) ──────────────────────────
  function drawExtraRow(
    y: number,
    label: string,
    amount: number,
    isDeduction = false,
    shade = false,
    taxableOverride?: number,  // used for shipping to show back-calculated taxable
    taxAmtOverride?: number,   // actual GST amount on this row
    taxRateOverride?: number,  // GST rate % for this row
  ): number {
    const rowH = 8;
    if (shade) filledRect(M, y, CW, rowH, ...PURPLE_LIGHT);
    else       filledRect(M, y, CW, rowH, ...BGLIGHT);
    outlineRect(M, y, CW, rowH, 0.2);
    const sepCols = IS
      ? ["hsn","qty","unitPr","unitDisc","taxable","cgstPct","cgstAmt","sgstPct","sgstAmt","total"]
      : ["hsn","qty","unitPr","unitDisc","taxable","igstPct","igstAmt","total"];
    for (const k of sepCols) vline(COL[k], y, y + rowH);

    const my = y + rowH / 2 + 1;
    txt(label, COL.desc + 1.5, my, { size: 7, color: DARK });

    if (!isDeduction) {
      // Taxable value — use override (back-calculated) if provided, else full amount
      const taxable = taxableOverride ?? amount;
      txt(n2(taxable), COL.taxable + W.taxable - 1.5, my, { size: 7, align: "right", color: DARK });

      if (taxAmtOverride !== undefined && taxAmtOverride > 0) {
        // Show actual GST on shipping
        const halfTax = parseFloat((taxAmtOverride / 2).toFixed(2));
        const rate    = taxRateOverride ?? 0;
        if (IS) {
          txt(`${(rate / 2).toFixed(2)}%`, COL.cgstPct + W.cgstPct! - 1.5, my, { size: 7, align: "right", color: DARK });
          txt(n2(halfTax),                  COL.cgstAmt + W.cgstAmt! - 1.5, my, { size: 7, align: "right", color: DARK });
          txt(`${(rate / 2).toFixed(2)}%`, COL.sgstPct + W.sgstPct! - 1.5, my, { size: 7, align: "right", color: DARK });
          txt(n2(halfTax),                  COL.sgstAmt + W.sgstAmt! - 1.5, my, { size: 7, align: "right", color: DARK });
        } else {
          txt(`${rate.toFixed(2)}%`, COL.igstPct + (W as any).igstPct - 1.5, my, { size: 7, align: "right", color: DARK });
          txt(n2(taxAmtOverride),    COL.igstAmt + (W as any).igstAmt - 1.5, my, { size: 7, align: "right", color: DARK });
        }
      } else {
        // Zero tax row
        if (IS) {
          txt("0.00", COL.cgstAmt + W.cgstAmt! - 1.5, my, { size: 7, align: "right", color: GREY });
          txt("0.00", COL.sgstAmt + W.sgstAmt! - 1.5, my, { size: 7, align: "right", color: GREY });
        } else {
          txt("0.00", COL.igstAmt + (W as any).igstAmt - 1.5, my, { size: 7, align: "right", color: GREY });
        }
      }
      txt(n2(amount), COL.total + W.total - 1.5, my, { size: 7, bold: true, align: "right", color: DARK });
    } else {
      // Discount — negative in Total column only, purple
      txt(`- ${n2(amount)}`, COL.total + W.total - 1.5, my, { size: 7, bold: true, align: "right", color: PURPLE });
    }
    return y + rowH;
  }

  // ── NET TOTAL ROW ─────────────────────────────────────────────
  function drawNetTotalRow(y: number, totalQty: number): number {
    const rowH = 10;
    const netTotal = data.grandTotal;

    // ── Tax summary row (above Net Total) ─────────────────────
    // Total taxable value across all items + shipping
    const totalTaxable = parseFloat((
      data.items.reduce((s, i) => s + i.taxableValue, 0) + data.shippingTaxable
    ).toFixed(2));

    // Total tax amounts
    const totalCgst = parseFloat((
      data.items.reduce((s, i) => s + i.cgst, 0) +
      (data.isIntraState ? data.shippingTax / 2 : 0)
    ).toFixed(2));
    const totalSgst = totalCgst; // always equal to CGST
    const totalIgst = parseFloat((
      data.items.reduce((s, i) => s + i.igst, 0) +
      (!data.isIntraState ? data.shippingTax : 0)
    ).toFixed(2));

    const summH = 8;
    filledRect(M, y, CW, summH, ...PURPLE_LIGHT);
    outlineRect(M, y, CW, summH, 0.2);
    const sepCols = IS
      ? ["hsn","qty","unitPr","unitDisc","taxable","cgstPct","cgstAmt","sgstPct","sgstAmt","total"]
      : ["hsn","qty","unitPr","unitDisc","taxable","igstPct","igstAmt","total"];
    for (const k of sepCols) vline(COL[k], y, y + summH);

    const sy = y + summH / 2 + 1;
    txt("Total", COL.desc + 1.5, sy, { size: 7, bold: true, color: PURPLE });
    txt(n2(totalTaxable), COL.taxable + W.taxable - 1.5, sy, { size: 7, bold: true, align: "right", color: PURPLE });
    if (IS) {
      txt(n2(totalCgst), COL.cgstAmt + W.cgstAmt! - 1.5, sy, { size: 7, bold: true, align: "right", color: PURPLE });
      txt(n2(totalSgst), COL.sgstAmt + W.sgstAmt! - 1.5, sy, { size: 7, bold: true, align: "right", color: PURPLE });
    } else {
      txt(n2(totalIgst), COL.igstAmt + (W as any).igstAmt - 1.5, sy, { size: 7, bold: true, align: "right", color: PURPLE });
    }
    // Total column = sum of item totals + shipping (before discount deduction shown separately)
    const itemsAndShipping = parseFloat((data.items.reduce((s,i) => s + i.total, 0) + data.shippingCharge).toFixed(2));
    txt(n2(itemsAndShipping), COL.total + W.total - 1.5, sy, { size: 7, bold: true, align: "right", color: PURPLE });
    y += summH;
    // ── Purple Net Total bar ───────────────────────────────────
    filledRect(M, y, CW, rowH, ...PURPLE);
    outlineRect(M, y, CW, rowH, 0.3);
    txt("Net Total", COL.desc + 2, y + rowH / 2 + 1.5, { size: 8, bold: true, color: WHITE });
    txt(String(totalQty), COL.qty + W.qty / 2, y + rowH / 2 + 1.5, { size: 8, bold: true, color: WHITE, align: "center" });
    txt(`Rs. ${n2(netTotal)}`, COL.total + W.total - 1.5, y + rowH / 2 + 1.5, { size: 8, bold: true, color: WHITE, align: "right" });
    return y + rowH;
  }

  // ── FOOTER ────────────────────────────────────────────────────
  function drawFooter(y: number, isLast: boolean, pageNum: number, totalPages: number) {
    // Page number always at bottom-right corner of the page
    txt(`${pageNum} / ${totalPages}`, M + CW, PH - M + 2, { size: 7, color: GREY, align: "right" });
    if (!isLast) return;

    // Disclaimer + Signature box
    const discH = 28;
    outlineRect(M, y, CW, discH, 0.3);
    const midX = M + CW / 2;
    vline(midX, y, y + discH);

    // Purple accent bar top of disclaimer section
    filledRect(M, y, CW / 2, 5, ...PURPLE_LIGHT);
    txt("Terms & Conditions", M + 2, y + 3.5, { size: 6.5, bold: true, color: PURPLE });

    const disc = [
      "All disputes are subject to Gujarat jurisdiction only.",
      "Goods once sold will only be taken back or exchanged",
      "as per the store's exchange/return policy.",
    ];
    let dy = y + 9;
    for (const l of disc) {
      txt(l, M + 2, dy, { size: 6.5, color: GREY });
      dy += 4;
    }

    // Purple accent bar top of signature section
    filledRect(midX, y, CW / 2, 5, ...PURPLE_LIGHT);
    txt("Authorised Signatory", midX + CW / 4, y + 3.5, { size: 6.5, bold: true, color: PURPLE, align: "center" });

    txt("For", midX + CW / 4, y + 13, { size: 7, color: GREY, align: "center" });

    // Signature image if uploaded, else just show name
    if (sigData) {
      // Centre the signature image (max 40mm wide, 14mm tall)
      const sigW = 40, sigH = 14;
      const sigX = midX + (CW / 2 - sigW) / 2;
      doc.addImage(sigData, "PNG", sigX, y + 8, sigW, sigH);
      txt(data.biz.legalName.toUpperCase(), midX + CW / 4, y + discH - 5, { size: 7.5, bold: true, color: DARK, align: "center" });
    } else {
      txt(data.biz.legalName.toUpperCase(), midX + CW / 4, y + 20, { size: 7.5, bold: true, color: DARK, align: "center" });
    }
    txt("(Authorised Signatory)", midX + CW / 4, y + discH - 2, { size: 6, color: GREY, align: "center" });

    y += discH + 2;

    // Amount in words — use grand_total (source of truth)
    const netTotal = data.grandTotal;
    const wordsH   = 12;
    filledRect(M, y, CW, wordsH, ...PURPLE_LIGHT);
    outlineRect(M, y, CW, wordsH, 0.3);
    txt("Net Amount Payable (In Words):", M + 3, y + wordsH / 2 + 1.2, { size: 7, bold: true, color: PURPLE });
    txt(toIndianWords(Math.round(netTotal)), M + 60, y + wordsH / 2 + 1.2, { size: 7, color: DARK, maxW: CW - 62 });
  }

  // ── PAGINATION PLAN ───────────────────────────────────────────
  interface PagePlan {
    items:       GSTInvoiceItem[];
    hasShipping: boolean;
    hasTotal:    boolean;
    hasFooter:   boolean;
    hdrH:        number;
  }

  const pages: PagePlan[] = [];
  let remaining = [...data.items];
  let first = true;

  while (remaining.length > 0 || pages.length === 0) {
    const hdrH   = first ? HDR_H1 : HDR_H2;
    let   avail  = PH - M - hdrH - TBL_HDR - FOOT_H - 4;
    const batch: GSTInvoiceItem[] = [];

    for (const item of remaining) {
      const lns = doc.splitTextToSize(item.description, W.desc - 3) as string[];
      const rh  = Math.max(ROW_BASE, lns.length * 3.8 + 7);
      if (avail >= rh) { batch.push(item); avail -= rh; remaining = remaining.slice(1); }
      else break;
    }

    const isLast     = remaining.length === 0;
    // Account for: shipping + discount rows (each 8mm) + tax summary (8mm) + net total (10mm)
    const extraRowCount = (data.shippingCharge > 0 ? 1 : 0)
      + (data.discountAmount > 0  ? 1 : 0);
    const shippingFits = isLast && avail >= (extraRowCount * 8) + 8 + 10; // +8 for summary row

    pages.push({ items: batch, hasShipping: shippingFits, hasTotal: shippingFits, hasFooter: isLast, hdrH });
    first = false;
    if (isLast) break;
  }

  // If no room for shipping on last page, add overflow page
  if (!pages[pages.length - 1].hasShipping && data.items.length > 0) {
    pages[pages.length - 1].hasFooter = false;
    pages.push({ items: [], hasShipping: true, hasTotal: true, hasFooter: true, hdrH: HDR_H2 });
  }

  const totalPages = pages.length;
  const totalQty   = data.items.reduce((s,i) => s + i.qty, 0);

  // ── RENDER ────────────────────────────────────────────────────
  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) doc.addPage();
    const pg = pages[pi];

    let y = pg.hdrH === HDR_H1 ? drawHeader1() : drawHeader2();
    y = drawTableHeader(y);

    for (let ii = 0; ii < pg.items.length; ii++) {
      y = drawItemRow(pg.items[ii], y, ii % 2 === 0);
    }

    if (pg.hasShipping) {
      // Shipping charges row (only if > 0) — GST at composite supply rate (same as products)
      if (data.shippingCharge > 0)
        y = drawExtraRow(y, "Shipping Charges", data.shippingCharge, false, false,
          data.shippingTaxable, data.shippingTax, data.shippingGstRate);
      // Discount row (only if > 0) — shown as deduction
      if (data.discountAmount > 0)
        y = drawExtraRow(y, `${data.discountLabel} (- Rs. ${n2(data.discountAmount)})`, data.discountAmount, true, false);
    }
    if (pg.hasTotal)    y = drawNetTotalRow(y, totalQty);

    drawFooter(y + 3, pg.hasFooter, pi + 1, totalPages);
  }

  return doc.output("blob");
}
