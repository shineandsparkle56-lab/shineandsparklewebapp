import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Plus, Pencil, Trash2, X, CheckCircle2, Copy,
  ChevronDown, ChevronUp, Loader2, IndianRupee, Percent,
  ExternalLink, Phone, ToggleLeft, ToggleRight, Search, MessageCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

// ─── types ────────────────────────────────────────────────────
interface Referrer {
  id:               number;
  name:             string;
  mobile:           string;
  code:             string;
  commission_type:  "flat" | "percent";
  commission_value: number;
  is_active:        boolean;
  notes:            string;
  created_at:       string;
}

interface Payout {
  id:          number;
  referral_id: number;
  order_id:    number;
  amount:      number;
  paid:        boolean;
  paid_at:     string | null;
  note:        string;
  created_at:  string;
  // joined from orders
  order_grand_total?: number;
  order_subtotal?: number;
  order_customer_name?: string;
  order_created_at?: string;
}

const EMPTY_FORM = {
  name: "", mobile: "", code: "",
  commission_type: "flat" as "flat" | "percent",
  commission_value: "50",
  notes: "",
};

// ─── helpers ─────────────────────────────────────────────────
function calcCommission(grandTotal: number, subtotal: number, type: "flat" | "percent", value: number): number {
  if (type === "flat")    return value;
  // Percent is calculated on subtotal only (excludes shipping + COD charges)
  if (type === "percent") return Math.round((subtotal * value) / 100);
  return 0;
}

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

function copyToClipboard(text: string): Promise<boolean> {
  // Modern async clipboard API (requires HTTPS / localhost)
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  // Fallback: create a hidden textarea, select its content, and execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

// ─── ConfirmModal ──────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-4"
      >
        <p className="text-sm text-gray-700">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── ReferrerForm ──────────────────────────────────────────────
function ReferrerForm({
  initial, onSave, onCancel, saving,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (f: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="p-5 space-y-4 bg-[#F3EEFB]/40 border border-[#9B6FD1]/20 rounded-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="label">Referrer Name</label>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Ayush Prajapati" className="input" />
        </div>
        {/* Mobile */}
        <div>
          <label className="label">Mobile</label>
          <input value={form.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit number" maxLength={10} className="input" />
        </div>
        {/* Code */}
        <div>
          <label className="label">Referral Code</label>
          <input required value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 20))}
            placeholder="e.g. AYUSH50" className="input uppercase tracking-widest font-semibold" />
          <p className="text-[11px] text-gray-400 mt-1">Shared as: <span className="text-[#9B6FD1]">shineandsparke.in/?ref={form.code || "CODE"}</span></p>
        </div>
        {/* Commission */}
        <div>
          <label className="label">Commission</label>
          <div className="flex gap-2">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
              {(["flat", "percent"] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => set("commission_type", t)}
                  className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1 ${
                    form.commission_type === t
                      ? "bg-[#9B6FD1] text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {t === "flat" ? <><IndianRupee className="w-3 h-3" /> Flat</> : <><Percent className="w-3 h-3" /> %</>}
                </button>
              ))}
            </div>
            <input required type="number" min="0" max={form.commission_type === "percent" ? 100 : undefined}
              value={form.commission_value}
              onChange={(e) => set("commission_value", e.target.value)}
              placeholder={form.commission_type === "flat" ? "e.g. 50" : "e.g. 10"}
              className="input flex-1" />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {form.commission_type === "flat"
              ? `₹${form.commission_value || 0} fixed per order`
              : `${form.commission_value || 0}% of grand total`}
          </p>
        </div>
        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="label">Notes <span className="normal-case font-normal text-gray-400">(optional)</span></label>
          <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. Instagram influencer" className="input" />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Referrer"}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════
// ReferralsTab
// ═══════════════════════════════════════════════════════════════
export function ReferralsTab() {
  const [referrers,     setReferrers]     = useState<Referrer[]>([]);
  const [payouts,       setPayouts]       = useState<Payout[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editReferrer,  setEditReferrer]  = useState<Referrer | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Referrer | null>(null);
  const [expandedId,    setExpandedId]    = useState<number | null>(null);
  const [search,        setSearch]        = useState("");
  const [payingIds,     setPayingIds]     = useState<Set<number>>(new Set());
  const [copiedCode,    setCopiedCode]    = useState<string | null>(null);

  // ── Toast helper ───────────────────────────────────────────
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fetch everything ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: refs }, { data: pays }] = await Promise.all([
      supabase.from("referrals").select("*").order("created_at", { ascending: false }),
      supabase
        .from("referral_payouts")
        .select("*, orders(grand_total, subtotal, customer_name, created_at)")
        .order("created_at", { ascending: false }),
    ]);
    setReferrers((refs ?? []) as Referrer[]);
    // Flatten joined order data
    setPayouts(
      ((pays ?? []) as any[]).map((p) => ({
        ...p,
        order_grand_total:    p.orders?.grand_total,
        order_subtotal:       p.orders?.subtotal,
        order_customer_name:  p.orders?.customer_name,
        order_created_at:     p.orders?.created_at,
      })) as Payout[],
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Create payout rows for any orders that have a referral_code
  //    but don't yet have a payout entry (run after fetching) ──
  const syncPayouts = useCallback(async (refs: Referrer[]) => {
    if (!refs.length) return;
    // Fetch all orders that have a referral_code set
    const { data: orders } = await supabase
      .from("orders")
      .select("id, referral_code, grand_total, subtotal")
      .not("referral_code", "is", null);
    if (!orders?.length) return;

    // Get existing payout order_ids to avoid duplicates
    const { data: existing } = await supabase
      .from("referral_payouts")
      .select("order_id");
    const existingOrderIds = new Set((existing ?? []).map((e: any) => e.order_id));

    const toInsert = orders
      .filter((o: any) => !existingOrderIds.has(o.id))
      .map((o: any) => {
        const ref = refs.find((r) => r.code === o.referral_code && r.is_active);
        if (!ref) return null;
        return {
          referral_id: ref.id,
          order_id:    o.id,
          amount:      calcCommission(o.grand_total, o.subtotal, ref.commission_type, ref.commission_value),
          paid:        false,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (toInsert.length) {
      await supabase.from("referral_payouts").insert(toInsert);
      fetchAll();
    }
  }, [fetchAll]);

  useEffect(() => {
    if (referrers.length) syncPayouts(referrers);
  }, [referrers, syncPayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save (create or update) referrer ──────────────────────
  const handleSave = async (form: typeof EMPTY_FORM) => {
    setSaving(true);
    const payload = {
      name:             form.name.trim(),
      mobile:           form.mobile.trim(),
      code:             form.code.toUpperCase().trim(),
      commission_type:  form.commission_type,
      commission_value: Number(form.commission_value) || 0,
      notes:            form.notes.trim(),
    };

    if (editReferrer) {
      const { error } = await supabase
        .from("referrals").update(payload).eq("id", editReferrer.id);
      if (error) { showToast(error.message, "err"); }
      else       { showToast("Referrer updated!"); setEditReferrer(null); fetchAll(); }
    } else {
      const { error } = await supabase.from("referrals").insert(payload);
      if (error) {
        showToast(error.message.includes("unique") ? "Code already exists." : error.message, "err");
      } else {
        showToast("Referrer created!"); setShowForm(false); fetchAll();
      }
    }
    setSaving(false);
  };

  // ── Toggle active ──────────────────────────────────────────
  const toggleActive = async (ref: Referrer) => {
    await supabase.from("referrals").update({ is_active: !ref.is_active }).eq("id", ref.id);
    setReferrers((prev) => prev.map((r) => r.id === ref.id ? { ...r, is_active: !r.is_active } : r));
  };

  // ── Delete referrer ────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("referrals").delete().eq("id", deleteTarget.id);
    showToast("Referrer deleted.");
    setDeleteTarget(null);
    fetchAll();
  };

  // ── Mark payout paid / unpaid ──────────────────────────────
  const togglePaid = async (payout: Payout) => {
    setPayingIds((s) => new Set(s).add(payout.id));
    const nowPaid = !payout.paid;
    const { error } = await supabase
      .from("referral_payouts")
      .update({ paid: nowPaid, paid_at: nowPaid ? new Date().toISOString() : null })
      .eq("id", payout.id);
    if (!error) {
      setPayouts((prev) =>
        prev.map((p) => p.id === payout.id ? { ...p, paid: nowPaid, paid_at: nowPaid ? new Date().toISOString() : null } : p),
      );
    }
    setPayingIds((s) => { const n = new Set(s); n.delete(payout.id); return n; });
  };

  // ── Per-referrer aggregates ────────────────────────────────
  const aggByReferrer = useMemo(() => {
    const map: Record<number, { totalOrders: number; totalEarned: number; totalPaid: number; pending: number }> = {};
    for (const p of payouts) {
      if (!map[p.referral_id]) map[p.referral_id] = { totalOrders: 0, totalEarned: 0, totalPaid: 0, pending: 0 };
      map[p.referral_id].totalOrders++;
      map[p.referral_id].totalEarned += p.amount;
      if (p.paid) map[p.referral_id].totalPaid += p.amount;
      else        map[p.referral_id].pending    += p.amount;
    }
    return map;
  }, [payouts]);

  // ── Overall summary ────────────────────────────────────────
  const totalEarned  = payouts.reduce((s, p) => s + p.amount, 0);
  const totalPaid    = payouts.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const totalPending = totalEarned - totalPaid;

  // ── Filtered referrers ─────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return referrers;
    return referrers.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.mobile.includes(q),
    );
  }, [referrers, search]);

  // ── Copy link helper ───────────────────────────────────────
  const copyLink = (code: string) => {
    const link = `${window.location.origin}/?ref=${code}`;
    copyToClipboard(link).then((ok) => {
      if (ok) {
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Earned",   value: fmt(totalEarned),  color: "text-[#9B6FD1]",   bg: "bg-[#F3EEFB]" },
          { label: "Paid Out",       value: fmt(totalPaid),    color: "text-emerald-600",  bg: "bg-emerald-50" },
          { label: "Pending Payout", value: fmt(totalPending), color: "text-amber-600",    bg: "bg-amber-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl px-4 py-3`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold ${color} mt-0.5`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Referrers list card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">Referrers</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{referrers.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name / code"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1] w-full sm:w-44"
              />
            </div>
            <button
              onClick={() => { setShowForm((v) => !v); setEditReferrer(null); }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {/* Add form */}
        <AnimatePresence initial={false}>
          {showForm && !editReferrer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <div className="p-5">
                <ReferrerForm
                  initial={{ ...EMPTY_FORM }}
                  onSave={handleSave}
                  onCancel={() => setShowForm(false)}
                  saving={saving}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {referrers.length === 0 ? "No referrers yet — add one above." : "No results for your search."}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((ref) => {
              const agg      = aggByReferrer[ref.id] ?? { totalOrders: 0, totalEarned: 0, totalPaid: 0, pending: 0 };
              const expanded = expandedId === ref.id;
              const refPayouts = payouts.filter((p) => p.referral_id === ref.id);
              const isEditing  = editReferrer?.id === ref.id;

              return (
                <div key={ref.id} className="bg-white">

                  {/* ── Edit form inline ── */}
                  <AnimatePresence initial={false}>
                    {isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden border-b border-[#9B6FD1]/20"
                      >
                        <div className="p-5">
                          <ReferrerForm
                            initial={{
                              name: ref.name, mobile: ref.mobile, code: ref.code,
                              commission_type: ref.commission_type,
                              commission_value: String(ref.commission_value),
                              notes: ref.notes ?? "",
                            }}
                            onSave={handleSave}
                            onCancel={() => setEditReferrer(null)}
                            saving={saving}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Referrer row ── */}
                  {!isEditing && (
                    <div className="px-4 py-3">
                      {/* Top: avatar + info + actions */}
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center shrink-0 text-[#9B6FD1] font-bold text-sm">
                          {ref.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-gray-800 text-sm">{ref.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ref.is_active ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                              {ref.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>

                          {/* Code pill */}
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-md tracking-widest">
                              {ref.code}
                            </code>
                            {ref.notes && (
                              <span className="text-[10px] text-gray-400 italic truncate">{ref.notes}</span>
                            )}
                          </div>

                          {/* Links row */}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <button
                              onClick={() => copyLink(ref.code)}
                              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#9B6FD1] transition-colors"
                            >
                              {copiedCode === ref.code
                                ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Copied!</>
                                : <><Copy className="w-3 h-3" /> Copy link</>}
                            </button>
                            <a
                              href={`/ref/${ref.code}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#9B6FD1] transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Dashboard
                            </a>
                            {ref.mobile && (
                              <span className="flex items-center gap-1.5">
                                <a href={`tel:${ref.mobile}`} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#9B6FD1] transition-colors">
                                  <Phone className="w-3 h-3" /> {ref.mobile}
                                </a>
                                <a
                                  href={`https://wa.me/91${ref.mobile.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open WhatsApp chat"
                                  className="text-green-500 hover:text-green-600 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              </span>
                            )}
                          </div>

                          {/* Commission */}
                          <p className="text-[11px] text-gray-500 mt-1">
                            Commission:&nbsp;
                            <span className="font-semibold text-gray-700">
                              {ref.commission_type === "flat"
                                ? `₹${ref.commission_value} flat`
                                : `${ref.commission_value}% of order`}
                            </span>
                          </p>
                        </div>

                        {/* Stats — desktop only */}
                        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
                          <span className="text-sm font-bold text-gray-800">{fmt(agg.totalEarned)}</span>
                          <span className="text-[10px] text-gray-400">{agg.totalOrders} order{agg.totalOrders !== 1 ? "s" : ""}</span>
                          {agg.pending > 0 && (
                            <span className="text-[10px] font-semibold text-amber-600">{fmt(agg.pending)} pending</span>
                          )}
                        </div>
                      </div>

                      {/* Bottom row: mobile stats + actions */}
                      <div className="flex items-center justify-between mt-2.5 gap-2">
                        {/* Mobile stats */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 sm:hidden flex-wrap">
                          <span className="font-bold text-gray-800">{fmt(agg.totalEarned)}</span>
                          <span className="text-gray-300">·</span>
                          <span>{agg.totalOrders} order{agg.totalOrders !== 1 ? "s" : ""}</span>
                          {agg.pending > 0 && (
                            <><span className="text-gray-300">·</span><span className="text-amber-600 font-semibold">{fmt(agg.pending)} pending</span></>
                          )}
                        </div>
                        <div className="sm:hidden flex-1" />

                        {/* Actions — always visible */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleActive(ref)} title={ref.is_active ? "Deactivate" : "Activate"}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors">
                            {ref.is_active
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft  className="w-5 h-5 text-gray-300" />}
                          </button>
                          <button onClick={() => { setEditReferrer(ref); setShowForm(false); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(ref)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setExpandedId(expanded ? null : ref.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors"
                          >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Expanded payout list ── */}
                  <AnimatePresence initial={false}>
                    {expanded && !isEditing && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 space-y-2">
                          {/* Payout summary bar */}
                          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 text-[11px]">
                            <span className="text-gray-500">Paid: <strong className="text-emerald-600">{fmt(agg.totalPaid)}</strong></span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-500">Pending: <strong className="text-amber-600">{fmt(agg.pending)}</strong></span>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-500">Total: <strong className="text-gray-700">{fmt(agg.totalEarned)}</strong></span>
                          </div>

                          {refPayouts.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 text-center">No orders with this code yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {refPayouts.map((p) => (
                                <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs ${p.paid ? "bg-emerald-50/60" : "bg-amber-50/60"}`}>
                                  {/* Order info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-gray-700">Order #{p.order_id}</span>
                                      {p.order_customer_name && (
                                        <span className="text-gray-500">{p.order_customer_name}</span>
                                      )}
                                      {p.order_grand_total && (
                                        <span className="text-gray-400">{fmt(p.order_grand_total)}</span>
                                      )}
                                      {p.order_subtotal != null && p.order_grand_total !== p.order_subtotal && (
                                        <span className="text-gray-400 text-[10px]">(subtotal {fmt(p.order_subtotal)})</span>
                                      )}
                                    </div>
                                    {p.order_created_at && (
                                      <p className="text-gray-400 mt-0.5">
                                        {new Date(p.order_created_at).toLocaleDateString("en-IN", {
                                          day: "2-digit", month: "short", year: "numeric",
                                        })}
                                        {p.paid && p.paid_at && (
                                          <span className="ml-2 text-emerald-600">
                                            · Paid {new Date(p.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  {/* Commission amount */}
                                  <span className={`font-bold shrink-0 ${p.paid ? "text-emerald-600" : "text-amber-600"}`}>
                                    {fmt(p.amount)}
                                  </span>
                                  {/* Paid toggle */}
                                  <button
                                    onClick={() => togglePaid(p)}
                                    disabled={payingIds.has(p.id)}
                                    title={p.paid ? "Mark as unpaid" : "Mark as paid"}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                                      p.paid
                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    }`}
                                  >
                                    {payingIds.has(p.id)
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : p.paid
                                        ? <><CheckCircle2 className="w-3 h-3" /> Paid</>
                                        : "Mark Paid"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirm delete ── */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmModal
            message={`Delete referrer "${deleteTarget.name}" (${deleteTarget.code})? All their payout records will also be deleted.`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${
              toast.type === "err" ? "bg-red-500" : "bg-green-600"
            }`}
          >
            {toast.type === "err" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
