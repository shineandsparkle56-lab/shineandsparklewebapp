/**
 * BillingTab.tsx
 * Shows only orders that have been assigned an invoice number via the
 * "Bill" button in the Orders tab. Each row is a confirmed GST invoice
 * that can be re-downloaded at any time.
 *
 * Invoice numbers are sequential (shine00084, shine00085…) and are
 * assigned permanently — they never change once set.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download, Loader2, Building2, Save, CheckCircle2,
  Receipt, Search, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
  FileText, IndianRupee, ImageIcon, X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getSetting, setSetting } from "../../lib/settings";
import { uploadToStorage } from "./shared";
import type { OrderRow } from "./EditOrderModal";
import {
  generateGSTInvoice,
  buildGSTInvoiceData,
  getOrderInvoiceNo,
  type BizProfile,
} from "../../utils/generateGSTInvoice";

// ── Style constants ───────────────────────────────────────────────
const INPUT = "w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-300";
const LABEL = "block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1";

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function statusColor(status?: string) {
  switch (status) {
    case "pending":   return "bg-yellow-100 text-yellow-700";
    case "confirmed": return "bg-blue-100 text-blue-700";
    case "shipped":   return "bg-purple-100 text-purple-700";
    case "delivered": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-600";
    default:          return "bg-gray-100 text-gray-500";
  }
}

// ── Default biz profile ───────────────────────────────────────────
const DEFAULT_BIZ: BizProfile = {
  legalName:      "AYUSHKUMAR BALVANTBHAI PRAJAPATI",
  addressLine1:   "Building No. 762, AT MADHI, PRABHUNAGAR",
  addressLine2:   "MADHI, Surat",
  city:           "Madhi",
  state:          "Gujarat",
  pincode:        "394340",
  phone:          "9574024419",
  gstin:          "24KNXPK8077B1ZC",
  pan:            "KNXPK8077B",
  stateCode:      "24",
  invoicePrefix:  "shine",
  defaultHsn:     "7117",
  defaultGstRate: 3,
  signatureUrl:   "",
};

// ── Component ─────────────────────────────────────────────────────
export function BillingTab() {
  // ── Business profile ───────────────────────────────────────────
  const [biz, setBiz] = useState<BizProfile>(DEFAULT_BIZ);
  const [bizLoading, setBizLoading] = useState(true);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // ── Invoiced orders ────────────────────────────────────────────
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const PAGE_SIZE = 20;
  // Signature upload state
  const [sigUploading, setSigUploading] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // ── Load biz profile ───────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getSetting("biz_legal_name"),
      getSetting("biz_address_line1"),
      getSetting("biz_address_line2"),
      getSetting("biz_city"),
      getSetting("biz_state"),
      getSetting("biz_pincode"),
      getSetting("biz_phone"),
      getSetting("biz_gstin"),
      getSetting("biz_pan"),
      getSetting("biz_state_code"),
      getSetting("biz_invoice_prefix"),
      getSetting("biz_default_hsn"),
      getSetting("biz_default_gst_rate"),
      getSetting("biz_signature_url"),
    ]).then(([name, addr1, addr2, city, state, pin, phone, gstin, pan, sc, prefix, hsn, gstRate, sigUrl]) => {
      setBiz({
        legalName:      name    ?? DEFAULT_BIZ.legalName,
        addressLine1:   addr1   ?? DEFAULT_BIZ.addressLine1,
        addressLine2:   addr2   ?? DEFAULT_BIZ.addressLine2,
        city:           city    ?? DEFAULT_BIZ.city,
        state:          state   ?? DEFAULT_BIZ.state,
        pincode:        pin     ?? DEFAULT_BIZ.pincode,
        phone:          phone   ?? DEFAULT_BIZ.phone,
        gstin:          gstin   ?? DEFAULT_BIZ.gstin,
        pan:            pan     ?? DEFAULT_BIZ.pan,
        stateCode:      sc      ?? DEFAULT_BIZ.stateCode,
        invoicePrefix:  prefix  ?? DEFAULT_BIZ.invoicePrefix,
        defaultHsn:     hsn     ?? DEFAULT_BIZ.defaultHsn,
        defaultGstRate: gstRate ? parseFloat(gstRate) : DEFAULT_BIZ.defaultGstRate,
        signatureUrl:   sigUrl  ?? "",
      });
      setBizLoading(false);
    });
  }, []);

  const saveBizProfile = async () => {
    setBizSaving(true);
    await Promise.all([
      setSetting("biz_legal_name",       biz.legalName),
      setSetting("biz_address_line1",    biz.addressLine1),
      setSetting("biz_address_line2",    biz.addressLine2),
      setSetting("biz_city",             biz.city),
      setSetting("biz_state",            biz.state),
      setSetting("biz_pincode",          biz.pincode),
      setSetting("biz_phone",            biz.phone),
      setSetting("biz_gstin",            biz.gstin),
      setSetting("biz_pan",              biz.pan),
      setSetting("biz_state_code",       biz.stateCode),
      setSetting("biz_invoice_prefix",   biz.invoicePrefix),
      setSetting("biz_default_hsn",      biz.defaultHsn),
      setSetting("biz_default_gst_rate", String(biz.defaultGstRate)),
      setSetting("biz_signature_url",    biz.signatureUrl ?? ""),
    ]);
    setBizSaving(false);
    setBizSaved(true);
    setTimeout(() => setBizSaved(false), 2500);
  };

  const handleSignatureUpload = async (file: File) => {
    setSigUploading(true);
    try {
      const url = await uploadToStorage(file, "signature");
      setBiz((p) => ({ ...p, signatureUrl: url }));
      await setSetting("biz_signature_url", url);
    } catch (err) {
      console.error("Signature upload failed:", err);
    } finally {
      setSigUploading(false);
    }
  };

  const handleRemoveSignature = async () => {
    setBiz((p) => ({ ...p, signatureUrl: "" }));
    await setSetting("biz_signature_url", "");
  };

  // ── Load ONLY invoiced orders ──────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setPage(0);
    setHasMore(true);

    // Count total for stats
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("invoice_number", "is", null);
    setTotalInvoiced(count ?? 0);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .not("invoice_number", "is", null)      // ← only invoiced orders
      .order("invoice_number", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (!error && data) {
      setOrders(data as OrderRow[]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setOrdersLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const loadMore = async () => {
    setLoadingMore(true);
    const from = (page + 1) * PAGE_SIZE;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .not("invoice_number", "is", null)
      .order("invoice_number", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!error && data) {
      setOrders((prev) => [...prev, ...(data as OrderRow[])]);
      setPage((p) => p + 1);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  // ── Re-download invoice PDF ────────────────────────────────────
  const handleDownload = async (order: OrderRow) => {
    if (!order.invoice_number) return;
    setDownloadingId(order.id);
    try {
      const invoiceNo  = getOrderInvoiceNo(order, biz.invoicePrefix);
      const invoiceData = buildGSTInvoiceData(order, biz, invoiceNo);
      const blob        = await generateGSTInvoice(invoiceData);

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `Invoice_${invoiceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Re-download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (o.invoice_number ?? "").toLowerCase().includes(q) ||
      String(o.id).includes(q) ||
      (o.customer_name  ?? "").toLowerCase().includes(q) ||
      (o.customer_mobile ?? "").includes(q)
    );
  });

  // ── Business profile field helper ──────────────────────────────
  const BizField = ({ label, field, type = "text", placeholder }: {
    label: string; field: keyof BizProfile; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        type={type}
        className={INPUT}
        value={String(biz[field])}
        placeholder={placeholder}
        onChange={(e) => setBiz((p) => ({
          ...p,
          [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
        }))}
      />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#9B6FD1]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">GST Tax Invoices</h2>
            <p className="text-xs text-gray-400">
              Only orders billed via the Orders tab appear here — sequential invoice numbers
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 bg-[#F3EEFB] rounded-xl px-4 py-2">
          <FileText className="w-4 h-4 text-[#9B6FD1]" />
          <span className="text-sm font-semibold text-[#9B6FD1]">{totalInvoiced} invoices</span>
          <span className="text-xs text-gray-400">
            · Next: <span className="font-mono font-semibold text-gray-600">
              {biz.invoicePrefix}{String(totalInvoiced + 1).padStart(5, "0")}
            </span>
          </span>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 space-y-0.5">
          <p className="font-semibold">How to generate a GST invoice:</p>
          <p>Go to <strong>Orders tab</strong> → expand any order → click the <strong className="font-mono bg-blue-100 px-1 rounded">Bill</strong> button. The invoice number is assigned automatically and the PDF downloads immediately. It will then appear here for re-download.</p>
        </div>
      </div>

      {/* ── Business Profile ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setProfileOpen((p) => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-[#9B6FD1]" />
            <span className="font-semibold text-gray-800 text-sm">Business Profile (Seller Details)</span>
            {biz.gstin ? (
              <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                GSTIN configured
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> GSTIN missing
              </span>
            )}
          </div>
          {profileOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {profileOpen && (
          <div className="px-5 pb-5 border-t border-gray-100">
            {bizLoading ? (
              <div className="flex items-center gap-2 py-6 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                <BizField label="Legal Business Name" field="legalName" placeholder="As per GST registration" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BizField label="Address Line 1" field="addressLine1" />
                  <BizField label="Address Line 2" field="addressLine2" />
                  <BizField label="City"    field="city" />
                  <BizField label="State"   field="state" />
                  <BizField label="Pincode" field="pincode" />
                  <BizField label="State Code (2-digit)" field="stateCode" placeholder="e.g. 24 for Gujarat" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BizField label="Phone" field="phone" />
                  <BizField label="GSTIN" field="gstin" placeholder="15-digit GSTIN" />
                  <BizField label="PAN"   field="pan"   placeholder="10-char PAN" />
                </div>
                <div className="bg-[#F3EEFB]/60 rounded-xl p-3 space-y-3">
                  <p className="text-[10px] font-bold text-[#9B6FD1] uppercase tracking-wider">Invoice Settings</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL}>Invoice Prefix</label>
                      <input type="text" className={INPUT} value={biz.invoicePrefix}
                        placeholder='e.g. "shine"'
                        onChange={(e) => setBiz((p) => ({ ...p, invoicePrefix: e.target.value.toLowerCase().trim() }))} />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Next: <span className="font-mono font-semibold text-gray-600">
                          {biz.invoicePrefix}{String(totalInvoiced + 1).padStart(5, "0")}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className={LABEL}>Default HSN Code</label>
                      <input type="text" className={INPUT} value={biz.defaultHsn}
                        placeholder="7117 for imitation jewellery"
                        onChange={(e) => setBiz((p) => ({ ...p, defaultHsn: e.target.value.trim() }))} />
                    </div>
                    <div>
                      <label className={LABEL}>Default GST Rate (%)</label>
                      <input type="number" className={INPUT} value={biz.defaultGstRate}
                        min={0} max={28} step={0.5}
                        onChange={(e) => setBiz((p) => ({ ...p, defaultGstRate: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  {/* Signature upload */}
                  <div>
                    <label className={LABEL}>Authorised Signature Image</label>
                    {biz.signatureUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={biz.signatureUrl}
                          alt="Signature"
                          className="h-14 max-w-[160px] object-contain border border-gray-200 rounded-lg bg-white p-1"
                        />
                        <button
                          onClick={handleRemoveSignature}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sigInputRef.current?.click()}
                        disabled={sigUploading}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-[#9B6FD1]/40 rounded-lg text-sm text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors disabled:opacity-60"
                      >
                        {sigUploading
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                          : <><ImageIcon className="w-4 h-4" /> Upload signature image</>}
                      </button>
                    )}
                    <input
                      ref={sigInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      PNG/JPG with transparent background works best · shown on every invoice
                    </p>
                  </div>
                </div>
                <button onClick={saveBizProfile} disabled={bizSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#9B6FD1] hover:bg-[#8558c5] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                  {bizSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : bizSaved  ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                  : <><Save className="w-4 h-4" /> Save Business Profile</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Invoiced orders list ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Search + refresh */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input type="text" className="flex-1 border-none outline-none text-sm text-gray-700 placeholder:text-gray-300 bg-transparent"
              placeholder="Search by invoice no., order ID, customer name…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={fetchOrders}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-50 border border-gray-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Receipt className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No invoices yet</p>
            <p className="text-xs text-gray-400 text-center max-w-xs">
              Go to <strong>Orders</strong> tab, expand an order, and click the <strong>Bill</strong> button to generate your first GST invoice.
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[120px_1fr_110px_90px_90px_80px_80px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50">
              {["Invoice No.", "Customer", "Date", "Amount", "Status", "Order", "Action"].map((h) => (
                <span key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((order) => {
                const isDownloading = downloadingId === order.id;
                return (
                  <div key={order.id}
                    className="grid grid-cols-1 sm:grid-cols-[120px_1fr_110px_90px_90px_80px_80px] gap-2 sm:gap-3 px-5 py-3 items-center hover:bg-gray-50/60 transition-colors">

                    {/* Invoice No. */}
                    <div>
                      <span className="text-xs font-mono font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-lg">
                        {order.invoice_number}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {order.customer_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {order.customer_mobile ?? ""}
                        {order.customer_state ? ` · ${order.customer_state}` : ""}
                      </p>
                    </div>

                    {/* Date */}
                    <span className="text-xs text-gray-500">
                      {fmtDate(new Date(order.created_at))}
                    </span>

                    {/* Amount */}
                    <div className="flex items-center gap-0.5">
                      <IndianRupee className="w-3 h-3 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-800">{order.grand_total}</span>
                    </div>

                    {/* Status */}
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full w-fit ${statusColor(order.status)}`}>
                      {order.status ?? "pending"}
                    </span>

                    {/* Order ID */}
                    <span className="text-xs font-mono text-gray-400">#{order.id}</span>

                    {/* Download */}
                    <button
                      onClick={() => handleDownload(order)}
                      disabled={isDownloading}
                      title="Re-download GST invoice PDF"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9B6FD1] hover:bg-[#8558c5] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {isDownloading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      PDF
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="px-5 py-4 border-t border-gray-100">
                <button onClick={loadMore} disabled={loadingMore}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-60">
                  {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── GST Notes ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> GST Compliance Notes
        </p>
        <ul className="space-y-0.5 text-amber-600 list-disc list-inside">
          <li>Invoice numbers are sequential and permanent — once assigned they never change.</li>
          <li>Series: <strong>{biz.invoicePrefix}00083</strong> already filed. Next will be <strong>{biz.invoicePrefix}{String(totalInvoiced + 1).padStart(5, "0")}</strong>.</li>
          <li>Only confirmed orders should be billed. Cancelled orders do not need an invoice.</li>
          <li>Always verify with your CA before filing GSTR-1 returns.</li>
        </ul>
      </div>

    </div>
  );
}
