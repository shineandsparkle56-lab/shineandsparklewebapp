/**
 * ReferrerDashboard  — /ref/:code
 * Public referrer dashboard. No login required.
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, IndianRupee, ShoppingBag, CheckCircle2,
  Clock, Sparkles, ExternalLink, ChevronRight, MessageCircle, Share2,
  Truck, XCircle, Receipt, Wallet, BadgeCheck, ClipboardList,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSetting } from "../lib/settings";

// ─── types ────────────────────────────────────────────────────
interface Referrer {
  id:               number;
  name:             string;
  code:             string;
  commission_type:  "flat" | "percent";
  commission_value: number;
  is_active:        boolean;
}

interface Payout {
  id:                   number;
  order_id:             number;
  amount:               number;
  paid:                 boolean;
  paid_at:              string | null;
  created_at:           string;
  order_subtotal?:      number;
  order_grand_total?:   number;
  order_customer_name?: string;
  order_created_at?:    string;
}

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

// ─── Stat card ────────────────────────────────────────────────
function StatCard({
  label, value, sub,
  iconColor, iconBg, cardBg,
  icon: Icon,
}: {
  label: string; value: string; sub?: string;
  iconColor: string; iconBg: string; cardBg: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`${cardBg} rounded-2xl px-4 py-4 flex items-start gap-3`}>
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide leading-none">{label}</p>
        <p className={`text-xl font-bold ${iconColor} mt-1 leading-none`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export function ReferrerDashboard({ code }: { code: string }) {
  const [, navigate] = useLocation();
  const [referrer,      setReferrer]      = useState<Referrer | null>(null);
  const [payouts,       setPayouts]       = useState<Payout[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [minWithdrawal, setMinWithdrawal] = useState(100);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }
    const upperCode = code.toUpperCase();

    async function load() {
      setLoading(true);
      const minWd = await getSetting("min_withdrawal");
      if (minWd !== null) setMinWithdrawal(parseInt(minWd, 10) || 100);

      const { data: ref } = await supabase
        .from("referrals")
        .select("id, name, code, commission_type, commission_value, is_active")
        .eq("code", upperCode)
        .maybeSingle();

      if (!ref) { setNotFound(true); setLoading(false); return; }
      setReferrer(ref as Referrer);

      const { data: pays } = await supabase
        .from("referral_payouts")
        .select("id, order_id, amount, paid, paid_at, created_at, orders(grand_total, subtotal, customer_name, created_at)")
        .eq("referral_id", ref.id)
        .order("created_at", { ascending: false });

      setPayouts(
        ((pays ?? []) as any[]).map((p) => ({
          id:                   p.id,
          order_id:             p.order_id,
          amount:               p.amount,
          paid:                 p.paid,
          paid_at:              p.paid_at,
          created_at:           p.created_at,
          order_subtotal:       p.orders?.subtotal,
          order_grand_total:    p.orders?.grand_total,
          order_customer_name:  p.orders?.customer_name,
          order_created_at:     p.orders?.created_at,
        })),
      );
      setLoading(false);
    }
    load();
  }, [code]);

  const totalOrders  = payouts.length;
  const totalEarned  = payouts.reduce((s, p) => s + p.amount, 0);
  const totalPaid    = payouts.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const totalPending = totalEarned - totalPaid;

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F3EEFB] to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#9B6FD1] flex items-center justify-center shadow-lg shadow-purple-200">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="flex gap-1.5">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full bg-[#9B6FD1] animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────
  if (notFound || !referrer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F3EEFB] to-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-gray-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Code not found</h2>
          <p className="text-sm text-gray-500 mb-6">
            This referral link is invalid or has been deactivated. Please check with the store.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Visit Store
          </button>
        </div>
      </div>
    );
  }

  const commissionLabel = referrer.commission_type === "flat"
    ? `₹${referrer.commission_value} flat per order`
    : `${referrer.commission_value}% of product subtotal`;

  const canRequestPayout = totalPending >= minWithdrawal;

  // Rich pre-filled WhatsApp message with all payout details
  const waPayoutMsg = encodeURIComponent(
    `Hi Shine and Sparkle! 👋\n\n` +
    `I'd like to request my referral commission payout.\n\n` +
    `*My Details:*\n` +
    `Name: ${referrer.name}\n` +
    `Referral Code: ${referrer.code}\n\n` +
    `*Payout Summary:*\n` +
    `Total Orders: ${totalOrders}\n` +
    `Total Earned: ₹${totalEarned}\n` +
    `Already Paid: ₹${totalPaid}\n` +
    `Pending Amount: ₹${totalPending}\n\n` +
    `*Order Breakdown:*\n` +
    payouts.filter((p) => !p.paid).map((p) =>
      `• Order #${p.order_id} — ₹${p.amount}${p.order_created_at ? ` (${new Date(p.order_created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })})` : ""}`
    ).join("\n") +
    `\n\nPlease process the payout of *₹${totalPending}* to my UPI/bank account. Thank you!`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3EEFB]/60 to-white">

      {/* ── Sticky header ── */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-13 flex items-center justify-between" style={{ height: "3.25rem" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#9B6FD1] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif font-semibold text-gray-900 text-sm">Shine and Sparkle</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-[#9B6FD1] font-medium"
          >
            Shop Now <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5 space-y-4">

        {/* ── Hero card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
        >
          {/* Top: avatar + name + badges */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#9B6FD1] to-[#c084fc] flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md shadow-purple-200 shrink-0">
              {referrer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{referrer.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <code className="text-xs font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-lg tracking-widest">
                  {referrer.code}
                </code>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${referrer.is_active ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                  {referrer.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Commission row */}
          <div className="flex items-center gap-1.5 mt-3 bg-[#F3EEFB]/50 rounded-xl px-3 py-2">
            <Gift className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0" />
            <span className="text-xs text-gray-500">Commission:</span>
            <span className="text-xs font-semibold text-gray-800">{commissionLabel}</span>
          </div>

          {/* Referral link */}
          <div className="mt-3 p-3 bg-[#F3EEFB]/60 rounded-xl border border-[#9B6FD1]/20">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Your referral link</p>
            <code className="block text-xs text-[#9B6FD1] font-medium break-all mb-2">
              {window.location.origin}/?ref={referrer.code}
            </code>
            <div className="flex items-center gap-2">
              <CopyButton text={`${window.location.origin}/?ref=${referrer.code}`} />
              <ShareButton
                url={`${window.location.origin}/?ref=${referrer.code}`}
                title="Shop at Shine and Sparkle"
                text={`Use my referral code ${referrer.code} to shop at Shine and Sparkle!`}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Stats grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          <StatCard
            label="Total Orders" value={String(totalOrders)}
            icon={ShoppingBag}
            iconColor="text-[#9B6FD1]" iconBg="bg-[#F3EEFB]"
            cardBg="bg-white border border-gray-100 shadow-sm"
          />
          <StatCard
            label="Total Earned" value={fmt(totalEarned)}
            icon={IndianRupee}
            iconColor="text-[#9B6FD1]" iconBg="bg-[#F3EEFB]"
            cardBg="bg-white border border-gray-100 shadow-sm"
          />
          <StatCard
            label="Paid Out" value={fmt(totalPaid)}
            icon={CheckCircle2}
            iconColor="text-emerald-600" iconBg="bg-emerald-100"
            cardBg="bg-emerald-50"
          />
          <StatCard
            label="Pending Payout" value={fmt(totalPending)}
            icon={Clock}
            iconColor="text-amber-600" iconBg="bg-amber-100"
            cardBg="bg-amber-50"
            sub={totalPending > 0 ? "Will be paid soon" : undefined}
          />
        </motion.div>

        {/* ── Payout eligibility banner ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          {totalPending >= minWithdrawal ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-700">You're eligible for a payout!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  <span className="font-bold">{fmt(totalPending)}</span> pending — tap the button below to request.
                </p>
              </div>
            </div>
          ) : totalPending > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-700">Keep referring to unlock payout</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    You have <span className="font-bold">{fmt(totalPending)}</span> pending. Earn{" "}
                    <span className="font-bold">{fmt(minWithdrawal - totalPending)}</span> more to reach the minimum of{" "}
                    <span className="font-bold">{fmt(minWithdrawal)}</span>.
                  </p>
                  <div className="mt-2.5 h-2 rounded-full bg-amber-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((totalPending / minWithdrawal) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-500 mt-1 font-medium">
                    {Math.round((totalPending / minWithdrawal) * 100)}% of {fmt(minWithdrawal)} minimum
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* ── Order history ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Order History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Every order placed using your referral code</p>
          </div>

          {payouts.length === 0 ? (
            <div className="py-12 text-center px-4">
              <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">No orders yet</p>
              <p className="text-xs text-gray-400 mt-1">Share your link and start earning!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <AnimatePresence initial={false}>
                {payouts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${p.paid ? "bg-emerald-400" : "bg-amber-400"}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">Order #{p.order_id}</span>
                        {p.order_customer_name && (
                          <span className="text-[11px] text-gray-400 truncate">{p.order_customer_name}</span>
                        )}
                      </div>
                      {p.order_grand_total != null && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {fmt(p.order_grand_total)}
                          {p.order_subtotal != null && p.order_subtotal !== p.order_grand_total && (
                            <span className="ml-1 text-gray-300">(items {fmt(p.order_subtotal)})</span>
                          )}
                        </p>
                      )}
                      {p.order_created_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(p.order_created_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </p>
                      )}
                    </div>

                    {/* Amount + status */}
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${p.paid ? "text-emerald-600" : "text-amber-600"}`}>
                        {fmt(p.amount)}
                      </p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${p.paid ? "text-emerald-500" : "text-amber-500"}`}>
                        {p.paid
                          ? `Paid${p.paid_at ? " · " + new Date(p.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}`
                          : "Pending"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* ── Footer note ── */}
        <p className="text-center text-xs text-gray-400 px-4 leading-relaxed">
          Contact us on WhatsApp for payout requests.
        </p>

        {/* ── Commission Rules ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-700 shrink-0" />
            <p className="text-sm font-bold text-amber-800">Commission Rules</p>
          </div>
          <ul className="space-y-2.5">
            {[
              { icon: <Truck       className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: "Commission is credited only after successful delivery" },
              { icon: <Clock       className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: "Paid after 24h return period is over — to protect against returns" },
              { icon: <XCircle     className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: "Cancelled or returned orders do not earn commission" },
              { icon: <Receipt     className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: "Commission is on product subtotal only — not on shipping or COD charges" },
              { icon: <Wallet      className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: `Minimum ₹${minWithdrawal} pending balance required to request payout` },
              { icon: <BadgeCheck  className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />, text: "Only one referral code counts per order" },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-xs text-amber-700">
                {icon}
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="pb-24" />
      </div>

      {/* ── Sticky payout button ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto space-y-1.5">
          {/* Progress bar when below minimum */}
          {totalPending > 0 && !canRequestPayout && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((totalPending / minWithdrawal) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">
                {fmt(totalPending)} / {fmt(minWithdrawal)} min
              </span>
            </div>
          )}
          {canRequestPayout ? (
            <a
              href={`https://wa.me/919574024419?text=${waPayoutMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-bold rounded-2xl transition-colors shadow-md shadow-green-200"
            >
              <MessageCircle className="w-4 h-4" />
              Request Payout of {fmt(totalPending)} on WhatsApp
            </a>
          ) : (
            <button
              disabled
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-gray-100 text-gray-400 text-sm font-bold rounded-2xl cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              {totalPending === 0
                ? "No pending balance"
                : `Need ${fmt(minWithdrawal - totalPending)} more to unlock payout`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Copy button with feedback ────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const doCopy = (t: string): Promise<boolean> => {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(t).then(() => true, () => false);
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return Promise.resolve(ok);
      } catch { return Promise.resolve(false); }
    };
    doCopy(text).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
        copied ? "bg-emerald-500 text-white" : "bg-[#9B6FD1] text-white hover:bg-[#8a5fc0]"
      }`}
    >
      {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : "Copy Link"}
    </button>
  );
}

// ─── Share button — native share sheet on mobile, clipboard fallback ──
function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    // Use Web Share API if available (opens native share sheet on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    // Fallback: copy to clipboard
    const doCopy = (t: string): Promise<boolean> => {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(t).then(() => true, () => false);
      }
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return Promise.resolve(ok);
      } catch { return Promise.resolve(false); }
    };
    const ok = await doCopy(url);
    if (ok) { setShared(true); setTimeout(() => setShared(false), 2000); }
  };

  return (
    <button
      onClick={handleShare}
      title="Share referral link"
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all border ${
        shared
          ? "bg-emerald-500 text-white border-emerald-500"
          : "bg-white text-[#9B6FD1] border-[#9B6FD1]/40 hover:bg-[#F3EEFB]"
      }`}
    >
      {shared ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
    </button>
  );
}
