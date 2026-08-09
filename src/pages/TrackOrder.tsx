import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Search, Package, Truck, CheckCircle2,
  AlertCircle, Loader2, MapPin, Clock, RefreshCw,
  ShoppingBag, User,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { imgUrl } from "../lib/imgUrl";

// ── Types ──────────────────────────────────────────────────────────────────

interface TrackingActivity {
  date: string;
  activity: string;
  location: string;
  "sr-status"?: string;
  "sr-status-label"?: string;
}

interface ShipmentTrack {
  awb_code: string;
  current_status: string;
  delivered_date: string | null;
  destination: string;
  edd: string | null;
  courier_name: string;
  origin: string;
  shipment_track_activities: TrackingActivity[];
}

interface TrackingResponse {
  tracking_data?: {
    shipment_track?: ShipmentTrack[];
    shipment_track_activities?: TrackingActivity[];
  };
  shipment_track?: ShipmentTrack[];
  shipment_track_activities?: TrackingActivity[];
}

interface OrderItem {
  product: { id: number; name: string; image: string; images?: string[]; price: number; category: string };
  quantity: number;
  variant_label?: string | null;
}

interface OrderRow {
  id: number;
  items: OrderItem[];
  subtotal: number;
  shipping_charge: number;
  cod_charge: number;
  grand_total: number;
  payment_mode: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  pincode?: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STEPS = ["Ordered", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

function isFailed(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("undeliver") ||
    s.includes("rto") ||
    s.includes("return to") ||
    s.includes("cancelled") ||
    s.includes("lost") ||
    s.includes("refused");
}

function deriveStep(status: string): number {
  const s = status.toLowerCase();
  // Failed — freeze at "Out for Delivery", never mark as Delivered
  if (isFailed(status)) return 3;
  if (s.includes("delivered")) return 4;
  if (s.includes("out for delivery")) return 3;
  if (
    s.includes("transit") ||
    s.includes("destination hub") ||
    s.includes("reached") ||
    s.includes("facility") ||
    s.includes("hub") ||
    s.includes("sort") ||
    s.includes("dispatch")
  ) return 2;
  if (
    s.includes("picked") ||
    s.includes("pick up") ||
    s.includes("manifested") ||
    s.includes("shipped") ||
    s.includes("pickup")
  ) return 1;
  return 0;
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return raw; }
}

function fmtShort(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return raw; }
}

type Tab = "status" | "items" | "details";

// ── Component ───────────────────────────────────────────────────────────────

export function TrackOrder() {
  const [, navigate] = useLocation();
  const params  = new URLSearchParams(window.location.search);
  const urlAwb  = params.get("awb") ?? "";

  const [awb,     setAwb]     = useState(urlAwb);
  const [input,   setInput]   = useState(urlAwb);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [track,   setTrack]   = useState<ShipmentTrack | null>(null);
  const [order,   setOrder]   = useState<OrderRow | null>(null);
  const [tab,     setTab]     = useState<Tab>("status");
  // show all timeline events or just top 3
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (urlAwb) fetchAll(urlAwb); }, []); // eslint-disable-line

  const fetchAll = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) { setError("Please enter an AWB / tracking number."); return; }
    setLoading(true); setError(""); setTrack(null); setOrder(null); setShowAll(false);
    try {
      const [trackRes, { data: orderData }] = await Promise.all([
        fetch(`/api/track-shipment?awb=${encodeURIComponent(trimmed)}`),
        supabase.from("orders").select("*").eq("awb_code", trimmed).maybeSingle(),
      ]);
      const text = await trackRes.text();
      let tj: TrackingResponse;
      try { tj = JSON.parse(text); } catch { throw new Error("Unexpected tracking response."); }
      if (!trackRes.ok) throw new Error((tj as { error?: string }).error ?? `Error ${trackRes.status}`);
      const td = tj.tracking_data ?? tj;
      const ships = (td.shipment_track ?? []) as ShipmentTrack[];
      if (!ships.length) throw new Error("No tracking information found for this AWB.");
      const s = ships[0];
      if (!s.shipment_track_activities?.length && td.shipment_track_activities)
        s.shipment_track_activities = td.shipment_track_activities as TrackingActivity[];
      setTrack(s);
      if (orderData) setOrder(orderData as OrderRow);
      setAwb(trimmed);
      setTab("status");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch tracking info. Try again.");
    } finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); fetchAll(input); };
  const activeStep  = track ? deriveStep(track.current_status) : -1;
  const failed      = track ? isFailed(track.current_status) : false;
  const activities  = track?.shipment_track_activities ?? [];
  const visibleActs = showAll ? activities : activities.slice(0, 3);

  // Status colour
  const statusColor = failed
    ? "text-red-600 bg-red-50 border-red-200"
    : activeStep === 4
    ? "text-green-600 bg-green-50 border-green-200"
    : activeStep >= 2
    ? "text-[#9B6FD1] bg-[#F3EEFB] border-[#9B6FD1]/30"
    : "text-amber-600 bg-amber-50 border-amber-200";

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Compact header ── */}
      <div className="bg-gradient-to-r from-[#9B6FD1] to-[#7c4fc0] text-white px-4 pt-5 pb-6">
        <div className="container mx-auto max-w-lg">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-xl font-bold">Track Order</h1>
              <p className="text-white/60 text-xs mt-0.5">Live shipment status</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          {/* Search bar — overlapping the header bottom */}
          <form onSubmit={handleSubmit} className="flex gap-2 mt-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Enter AWB"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-white/40 bg-white shadow-md"
                autoFocus={!urlAwb} />
            </div>
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 border border-white/30">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Track
            </button>
          </form>
        </div>
      </div>

      {/* ── Content — pulled up to overlap header ── */}
      <div className="container mx-auto max-w-lg px-4 pt-4 pb-10 space-y-3">

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><p className="font-semibold">Failed</p><p className="opacity-80 text-xs mt-0.5">{error}</p></div>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse pt-2">
            <div className="h-24 bg-white rounded-2xl shadow-sm" />
            <div className="h-14 bg-white rounded-2xl shadow-sm" />
            <div className="h-48 bg-white rounded-2xl shadow-sm" />
          </div>
        )}

        {!loading && track && (
          <>
            {/* ── Status hero card ── */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Top status bar */}
              <div className={`px-4 py-3 flex items-center justify-between border ${statusColor} rounded-t-2xl`}>
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">Current Status</p>
                  <p className="font-bold text-base mt-0.5">{track.current_status}</p>
                  {track.courier_name && <p className="text-xs opacity-60 mt-0.5">via {track.courier_name}</p>}
                </div>
                <button onClick={() => fetchAll(awb)} disabled={loading}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/60 hover:bg-white transition-colors" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress stepper */}
              <div className="px-4 py-4">
                <div className="flex items-center">
                  {STEPS.map((label, idx) => {
                    const done = idx <= activeStep;
                    const current = idx === activeStep;
                    return (
                      <div key={label} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all text-white ${
                            done
                              ? current
                                ? failed ? "bg-red-400 shadow-sm shadow-red-200 scale-110" : "bg-[#9B6FD1] shadow-sm shadow-purple-200 scale-110"
                                : "bg-green-500"
                              : "bg-gray-200"
                          }`}>
                            {done && !current
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : idx === 4 ? <MapPin className="w-3 h-3 text-gray-400" />
                              : idx === 0 ? <Package className="w-3 h-3 text-gray-400" />
                              : <Truck className="w-3 h-3 text-gray-400" />}
                          </div>
                          <span className={`text-[8px] font-semibold text-center w-12 leading-tight ${
                            current ? "text-[#9B6FD1]" : done ? "text-green-600" : "text-gray-300"
                          }`}>{label}</span>
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-0.5 mb-4 rounded ${idx < activeStep ? "bg-green-400" : "bg-gray-200"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* EDD / Delivered / Failed pill */}
              {(track.edd || track.delivered_date || failed) && (
                <div className={`mx-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                  failed
                    ? "bg-red-50 text-red-600"
                    : track.delivered_date
                    ? "bg-green-50 text-green-700"
                    : "bg-[#F3EEFB] text-[#9B6FD1]"
                }`}>
                  {failed
                    ? <><AlertCircle className="w-3.5 h-3.5" /> {track.current_status}</>
                    : track.delivered_date
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Delivered {fmtShort(track.delivered_date)}</>
                    : <><Clock className="w-3.5 h-3.5" /> Expected by {fmtShort(track.edd)}</>}
                  {track.origin && track.destination && (
                    <span className="ml-auto font-normal text-[10px] opacity-60">{track.origin} → {track.destination}</span>
                  )}
                </div>
              )}

              {/* AWB */}
              <div className="px-4 pb-3 flex items-center gap-1.5 text-[11px] text-gray-400">
                <Package className="w-3 h-3 shrink-0" />
                AWB: <strong className="text-gray-600 ml-0.5">{track.awb_code}</strong>
              </div>
            </div>

            {/* ── Tabs ── */}
            {order && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-gray-100">
                  {([
                    { id: "status", icon: Truck,       label: "Timeline" },
                    { id: "items",  icon: ShoppingBag, label: `Items${order.items?.length ? ` (${order.items.length})` : ""}` },
                    { id: "details",icon: User,         label: "Details" },
                  ] as { id: Tab; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
                    <button key={id} onClick={() => setTab(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${
                        tab === id
                          ? "border-[#9B6FD1] text-[#9B6FD1]"
                          : "border-transparent text-gray-400 hover:text-gray-600"
                      }`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>

                {/* ── Timeline tab ── */}
                {tab === "status" && (
                  <div className="p-4">
                    {activities.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No activity yet.</p>
                    ) : (
                      <>
                        <div className="space-y-0">
                          {visibleActs.map((act, idx) => (
                            <div key={idx} className="flex gap-3 pb-3 last:pb-0 relative">
                              {idx < visibleActs.length - 1 && (
                                <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-100" />
                              )}
                              <div className={`w-[18px] h-[18px] shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                                idx === 0 ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-white"
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? "bg-[#9B6FD1]" : "bg-gray-300"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold leading-tight ${idx === 0 ? "text-gray-900" : "text-gray-500"}`}>
                                  {(act.activity && act.activity !== "NA")
                                    ? act.activity
                                    : (act["sr-status-label"] && act["sr-status-label"] !== "NA")
                                      ? act["sr-status-label"]
                                      : "Update"}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                                  {act.location && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                      <MapPin className="w-2.5 h-2.5" />{act.location}
                                    </span>
                                  )}
                                  {act.date && <span className="text-[10px] text-gray-400">{fmtDate(act.date)}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {activities.length > 3 && (
                          <button onClick={() => setShowAll(!showAll)}
                            className="mt-3 w-full text-xs text-[#9B6FD1] font-semibold py-1.5 rounded-xl hover:bg-[#F3EEFB] transition-colors">
                            {showAll ? "Show less ↑" : `Show all ${activities.length} events ↓`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Items tab ── */}
                {tab === "items" && (
                  <div className="p-4 space-y-2">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <img src={imgUrl(item.product.images?.[0] ?? item.product.image, "tiny")}
                          alt={item.product.name}
                          className="w-11 h-11 rounded-lg object-cover shrink-0 border border-white shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.product.name}</p>
                          {item.variant_label && (
                            <span className="text-[9px] font-semibold text-[#9B6FD1] bg-[#F3EEFB] border border-[#9B6FD1]/20 px-1.5 py-0.5 rounded-full">
                              {item.variant_label}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-gray-900">₹{item.product.price * item.quantity}</p>
                          <p className="text-[10px] text-gray-400">× {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                    {/* Order total */}
                    <div className="border-t border-gray-100 pt-2 space-y-1 text-xs text-gray-500 mt-1">
                      <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
                      {order.shipping_charge > 0 && <div className="flex justify-between"><span>Shipping</span><span>₹{order.shipping_charge}</span></div>}
                      {order.cod_charge > 0 && <div className="flex justify-between"><span>COD Charge</span><span>₹{order.cod_charge}</span></div>}
                      <div className="flex justify-between font-bold text-gray-800 pt-1 border-t border-gray-100">
                        <span>Total</span><span>₹{order.grand_total}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Details tab ── */}
                {tab === "details" && (
                  <div className="p-4 space-y-3">
                    {/* Order meta */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <p className="text-gray-400 mb-0.5">Order ID</p>
                        <p className="font-semibold text-gray-700">#{order.id}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <p className="text-gray-400 mb-0.5">Date</p>
                        <p className="font-semibold text-gray-700">{fmtShort(order.created_at)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 col-span-2">
                        <p className="text-gray-400 mb-0.5">Payment</p>
                        <p className={`font-semibold ${order.payment_mode === "cod" ? "text-amber-600" : "text-blue-600"}`}>
                          {order.payment_mode === "cod" ? "Cash on Delivery" : "Online / Prepaid"}
                        </p>
                      </div>
                    </div>

                    {/* Delivery address */}
                    {(order.customer_name || order.customer_address) && (
                      <div className="bg-[#F3EEFB]/50 rounded-xl px-3 py-3 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delivering To</p>
                        {order.customer_name && (
                          <p className="text-sm font-semibold text-gray-800">
                            {order.customer_name}
                            {order.customer_mobile && <span className="text-xs font-normal text-gray-400 ml-2">· {order.customer_mobile}</span>}
                          </p>
                        )}
                        {order.customer_address && (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {order.customer_address}
                            {order.customer_city && `, ${order.customer_city}`}
                            {order.customer_state && `, ${order.customer_state}`}
                            {order.pincode && ` — ${order.pincode}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* If no order in DB, still show timeline */}
            {!order && activities.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Activity Timeline</p>
                <div className="space-y-0">
                  {visibleActs.map((act, idx) => (
                    <div key={idx} className="flex gap-3 pb-3 last:pb-0 relative">
                      {idx < visibleActs.length - 1 && (
                        <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-gray-100" />
                      )}
                      <div className={`w-[18px] h-[18px] shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                        idx === 0 ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-white"
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? "bg-[#9B6FD1]" : "bg-gray-300"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${idx === 0 ? "text-gray-900" : "text-gray-500"}`}>
                          {(act.activity && act.activity !== "NA")
                            ? act.activity
                            : (act["sr-status-label"] && act["sr-status-label"] !== "NA")
                              ? act["sr-status-label"]
                              : "Update"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                          {act.location && <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><MapPin className="w-2.5 h-2.5" />{act.location}</span>}
                          {act.date && <span className="text-[10px] text-gray-400">{fmtDate(act.date)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {activities.length > 3 && (
                  <button onClick={() => setShowAll(!showAll)}
                    className="mt-3 w-full text-xs text-[#9B6FD1] font-semibold py-1.5 rounded-xl hover:bg-[#F3EEFB] transition-colors">
                    {showAll ? "Show less ↑" : `Show all ${activities.length} events ↓`}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !track && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center bg-white rounded-2xl shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#F3EEFB] flex items-center justify-center">
              <Package className="w-7 h-7 text-[#9B6FD1]" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Enter your tracking number</p>
              <p className="text-xs text-gray-400 mt-1">You'll find it in your order confirmation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
