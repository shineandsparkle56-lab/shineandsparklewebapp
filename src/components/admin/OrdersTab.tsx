import { useState, useEffect } from "react";
import {
  Plus, Trash2, ShoppingBag, Download, FileText, Loader2,
  Pencil, Truck, X, CheckCircle2, Zap, Link2, RefreshCw, ChevronDown,
  MapPin, Calendar, Clock,
} from "lucide-react";

// ── Tracking types ─────────────────────────────────────────────────────────
interface TrackingActivity {
  date: string;
  activity: string;
  location: string;
  "sr-status"?: string;
  "sr-status-label"?: string;
}
interface TrackingInfo {
  status: "idle" | "loading" | "done" | "error";
  currentStatus?: string;
  edd?: string | null;          // estimated delivery date
  lastActivity?: TrackingActivity | null;
  error?: string;
}

function fmtTrackDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return raw; }
}

function trackStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("delivered") && !s.includes("undeliver")) return "text-green-700 bg-green-50 border-green-200";
  if (s.includes("out for delivery")) return "text-blue-700 bg-blue-50 border-blue-200";
  if (s.includes("rto") || s.includes("return") || s.includes("undeliver") || s.includes("cancelled") || s.includes("lost"))
    return "text-red-700 bg-red-50 border-red-200";
  if (s.includes("transit") || s.includes("picked") || s.includes("hub") || s.includes("dispatch"))
    return "text-[#9B6FD1] bg-[#F3EEFB] border-[#9B6FD1]/30";
  return "text-amber-700 bg-amber-50 border-amber-200";
}
import { useProducts } from "../../context/ProductsContext";
import { supabase } from "../../lib/supabase";
import { generateOrderPDF } from "../../utils/generateOrderPDF";
import type { OrderMeta } from "../../utils/generateOrderPDF";
import type { CartItem } from "../../context/CartContext";
import { Product } from "../../data/products";
import { useToast } from "../../hooks/useToast";
import { imgUrl } from "../../lib/imgUrl";
import { pushToShiprocket, saveSrIds, buildShiprocketItems, estimateWeight } from "../../lib/shiprocket";
import { useSettings } from "../../hooks/useSettings";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { QuickAddOrderModal } from "./QuickAddOrderModal";
import { ConfirmModal, Spinner, SrResult } from "./shared";
import type { OrderRow, OrderStatus } from "./EditOrderModal";
import { ORDER_STATUSES } from "./EditOrderModal";

export function OrdersTab() {
  const { products, updateStock } = useProducts();
  const toast = useToast();
  const { defaultPickupLocation } = useSettings();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [srResult, setSrResult] = useState<SrResult>(null);
  const [syncingAwbId, setSyncingAwbId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedItemsIds, setExpandedItemsIds] = useState<Set<number>>(new Set());
  // tracking info keyed by order.id
  const [trackingMap, setTrackingMap] = useState<Record<number, TrackingInfo>>({});

  const toggleExpand = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /** Fetch live tracking data for an order that has an AWB code. */
  const fetchTracking = async (order: OrderRow) => {
    if (!order.awb_code) return;
    setTrackingMap((prev) => ({ ...prev, [order.id]: { status: "loading" } }));
    try {
      const res  = await fetch(`/api/track-shipment?awb=${encodeURIComponent(order.awb_code)}`);
      const text = await res.text();
      let tj: Record<string, unknown>;
      try { tj = JSON.parse(text); } catch { throw new Error("Unexpected tracking response."); }
      if (!res.ok) throw new Error((tj as { error?: string }).error ?? `Error ${res.status}`);

      const td     = (tj.tracking_data ?? tj) as Record<string, unknown>;
      const ships  = (td.shipment_track ?? []) as { current_status?: string; edd?: string | null; shipment_track_activities?: TrackingActivity[] }[];
      if (!ships.length) throw new Error("No tracking info found.");

      const ship        = ships[0];
      const activities: TrackingActivity[] = ship.shipment_track_activities
        ?? (td.shipment_track_activities as TrackingActivity[] | undefined)
        ?? [];
      const lastActivity = activities.length ? activities[0] : null;

      setTrackingMap((prev) => ({
        ...prev,
        [order.id]: {
          status:       "done",
          currentStatus: ship.current_status ?? "",
          edd:           ship.edd ?? null,
          lastActivity,
        },
      }));
    } catch (err) {
      setTrackingMap((prev) => ({
        ...prev,
        [order.id]: { status: "error", error: err instanceof Error ? err.message : "Failed to fetch tracking." },
      }));
    }
  };

  const toggleItems = (id: number) =>
    setExpandedItemsIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setPage(0);
    setHasMore(true);
    const { data, error: err } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (!err && data) {
      setOrders(data as OrderRow[]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setOrdersLoading(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: err } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (!err && data) {
      setOrders((prev) => [...prev, ...(data as OrderRow[])]);
      setPage(nextPage);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  const statusMeta = (status?: OrderStatus) =>
    ORDER_STATUSES.find((s) => s.value === (status ?? "pending")) ?? ORDER_STATUSES[0];

  const handleDeleteOrder = async () => {
    if (deleteOrderId === null) return;
    setDeletingOrder(true);
    const { error: err, count } = await supabase
      .from("orders").delete({ count: "exact" }).eq("id", deleteOrderId);
    if (err) toast.show(`Failed to delete order: ${err.message}`, "error");
    else if (count === 0) toast.show("Delete blocked by database policy.", "error");
    else { setOrders((prev) => prev.filter((o) => o.id !== deleteOrderId)); toast.show("Order deleted."); }
    setDeletingOrder(false);
    setDeleteOrderId(null);
  };

  const handleDownloadPDF = async (order: OrderRow) => {
    setDownloadingId(order.id);
    try {
      const cartItems: CartItem[] = order.items.map((i) => ({
        product: {
          id: i.product.id, name: i.product.name,
          category: i.product.category as Product["category"],
          price: i.product.price, originalPrice: i.product.price,
          discount: 0, image: i.product.image,
          images: i.product.images ?? [i.product.image],
          description: "", stock: 99, shipping_credit: 0, wholesale_price: 0, variants: [], tags: [], sizes: [],
        },
        quantity: i.quantity,
        variantId:    (i as typeof i & { variant_id?: string }).variant_id ?? undefined,
        variantLabel: (i as typeof i & { variant_label?: string }).variant_label ?? undefined,
        variantImage: i.product.image,
      }));
      const meta: OrderMeta = {
        customerName: order.customer_name, customerMobile: order.customer_mobile,
        customerAddress: order.customer_address, customerCity: order.customer_city,
        customerState: order.customer_state, pincode: order.pincode,
        paymentMode: order.payment_mode, shippingCharge: order.shipping_charge,
        codCharge: order.cod_charge, grandTotal: order.grand_total,
      };
      const blob = await generateOrderPDF(cartItems, order.subtotal, meta);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${order.customer_name ? order.customer_name.trim().replace(/\s+/g, "_") : `Order_${order.id}`}_${new Date(order.created_at).toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) { console.error("PDF download failed:", err); }
    finally { setDownloadingId(null); }
  };

  const handlePushToShiprocket = async (order: OrderRow) => {
    if (!order.customer_name || !order.pincode || !order.customer_address) {
      toast.show("Order is missing customer details. Edit it first.", "error"); return;
    }
    setPushingId(order.id); setSrResult(null);
    try {
      // Resolution order: per-order override → settings default → env var (server-side fallback)
      const resolvedPickup = order.pickup_location?.trim() || defaultPickupLocation || undefined;
      const result = await pushToShiprocket({
        order_id:         String(order.id),
        order_date:       new Date(order.created_at).toISOString().slice(0, 19),
        customer_name:    order.customer_name,
        customer_mobile:  order.customer_mobile ?? "",
        customer_address: order.customer_address,
        customer_city:    order.customer_city   ?? "",
        customer_state:   order.customer_state  ?? "",
        customer_pincode: order.pincode,
        payment_mode:     order.payment_mode as "prepaid" | "cod",
        subtotal:         order.subtotal,
        shipping_charge:  order.shipping_charge,
        cod_charge:       order.cod_charge,
        grand_total:      order.grand_total,
        weight:           order.weight_kg ?? estimateWeight(order.items.reduce((s, i) => s + i.quantity, 0)),
        length:           order.box_length  ?? 5,
        breadth:          order.box_breadth ?? 5,
        height:           order.box_height  ?? 3,
        items:            buildShiprocketItems(order.items),
        pickup_location:  resolvedPickup,
      });
      await saveSrIds(order.id, result);
      setOrders((prev) => prev.map((o) =>
        o.id === order.id
          ? { ...o, status: "confirmed", sr_order_id: result.sr_order_id, sr_shipment_id: result.shipment_id, awb_code: result.awb || undefined }
          : o
      ));
      setSrResult({ orderId: order.id, shipmentId: result.shipment_id, awb: result.awb });
      toast.show("Pushed to Shiprocket!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setSrResult({ orderId: order.id, error: msg });
      toast.show("Shiprocket push failed.", "error");
    } finally { setPushingId(null); }
  };

  const handleSyncAwb = async (order: OrderRow) => {
    if (!order.sr_order_id) return;
    setSyncingAwbId(order.id);
    try {
      const res = await fetch(`/api/get-shipment-awb?order_id=${order.sr_order_id}`);
      const data = await res.json() as { awb_code?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const awb = data.awb_code?.trim();
      if (!awb) {
        toast.show("No AWB yet — assign a courier in Shiprocket first.", "error");
        return;
      }
      await supabase.from("orders").update({ awb_code: awb }).eq("id", order.id);
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, awb_code: awb } : o));
      toast.show(`AWB synced: ${awb}`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to sync AWB.", "error");
    } finally {
      setSyncingAwbId(null);
    }
  };

  const handleToggleStockDeduction = async (order: OrderRow) => {
    const deducting = !order.stock_deducted;
    for (const item of order.items) {
      const delta = deducting ? -item.quantity : item.quantity;
      const product = products.find((p) => p.id === item.product.id);
      if (!product) continue;
      await updateStock(product.id, Math.max(0, product.stock + delta));
    }
    await supabase.from("orders").update({ stock_deducted: deducting }).eq("id", order.id);
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, stock_deducted: deducting } : o));
    toast.show(deducting ? "Stock deducted from products." : "Stock restored to products.");
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">Placed Orders</h2>
            <span className="text-sm text-gray-400">{orders.length}{hasMore ? "+" : ""} total</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={fetchOrders} className="text-xs text-[#9B6FD1] hover:underline px-2 py-1">Refresh</button>
            <button onClick={() => setQuickAddOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 text-[#9B6FD1] text-xs font-semibold rounded-xl border border-[#9B6FD1]/40 transition-colors">
              <Zap className="w-3 h-3" /> Quick Add
            </button>
            <button onClick={() => setAddOrderOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-xl transition-colors">
              <Plus className="w-3 h-3" /> Add Order
            </button>
          </div>
        </div>

        {/* Body */}
        {ordersLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2"><Spinner />Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F3EEFB] flex items-center justify-center"><FileText className="w-7 h-7 text-[#9B6FD1]" /></div>
            <p className="text-gray-500 font-medium">No orders yet</p>
            <p className="text-gray-400 text-sm">Orders appear here when customers checkout via WhatsApp.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
            {orders.map((order, idx) => {
              const sm = statusMeta(order.status);
              const isQuick = order.items?.length === 0;
              const isEven = idx % 2 === 0;
              const expanded = expandedIds.has(order.id);

              // Profit calc
              const wholesaleCost = order.items.reduce((s, i) => s + (i.product.wholesale_price ?? 0) * i.quantity, 0);
              const rawShip = order.raw_shipping_charge ?? 0;
              const rawCod  = order.raw_cod_charge ?? (order.payment_mode === "cod" ? (order.cod_charge ?? 0) : 0);
              const profit  = order.grand_total - (wholesaleCost + rawShip + rawCod);
              const pct     = order.grand_total > 0 ? Math.round((profit / order.grand_total) * 100) : 0;
              const showProfit = order.raw_shipping_charge != null && order.items.some((i) => (i.product.wholesale_price ?? 0) > 0);

              return (
                <div key={order.id} className={`border-l-4 ${isEven ? "bg-white border-l-[#9B6FD1]/30" : "bg-slate-50 border-l-orange-200"}`}>

                  {/* ── Collapsed header (always visible) ── */}
                  <div
                    className="px-4 pt-3 pb-3 cursor-pointer select-none"
                    onClick={() => {
                      toggleExpand(order.id);
                      // Auto-fetch tracking on first expand if order has AWB
                      if (!expandedIds.has(order.id) && order.awb_code && !trackingMap[order.id]) {
                        fetchTracking(order);
                      }
                    }}
                  >
                    {/* Row 1: ID · Date · Badges · Total · Chevron */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-[#9B6FD1]">#{order.id}</span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${order.payment_mode === "cod" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {order.payment_mode === "cod" ? "COD" : "Online"}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${sm.color}`}>{sm.label}</span>
                        {isQuick && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase">Quick</span>}
                        {order.sr_order_id && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600">SR #{order.sr_order_id}</span>}
                        {order.awb_code && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-600">AWB: {order.awb_code}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-gray-900">₹{order.grand_total}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {/* Row 2: Customer name · item count · profit badge */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {order.customer_name && (
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          {order.customer_name}
                          {order.customer_mobile ? <span className="font-normal text-gray-400"> · {order.customer_mobile}</span> : ""}
                        </p>
                      )}
                      {!isQuick && (
                        <span className="shrink-0 text-[10px] text-gray-400 ml-auto">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                      )}
                      {showProfit && (
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${profit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
                          {profit >= 0 ? "+" : ""}₹{profit} ({pct}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Expanded content ── */}
                  {expanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">

                      {/* Customer address */}
                      {order.customer_address && (
                        <p className="text-[11px] text-gray-400">{order.customer_address}, {order.customer_city}, {order.customer_state} — {order.pincode}</p>
                      )}

                      {/* ── Delivery Status Panel ── */}
                      {order.awb_code && (() => {
                        const ti = trackingMap[order.id];
                        return (
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Delivery Status</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); fetchTracking(order); }}
                                disabled={ti?.status === "loading"}
                                className="flex items-center gap-1 text-[10px] text-[#9B6FD1] hover:underline disabled:opacity-50"
                              >
                                {ti?.status === "loading"
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <RefreshCw className="w-3 h-3" />}
                                {ti?.status === "loading" ? "Fetching…" : "Refresh"}
                              </button>
                            </div>

                            {(!ti || ti.status === "idle") && (
                              <p className="text-[11px] text-gray-400">Click Refresh to load live status.</p>
                            )}

                            {ti?.status === "loading" && (
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tracking info…
                              </div>
                            )}

                            {ti?.status === "error" && (
                              <p className="text-[11px] text-red-500">{ti.error}</p>
                            )}

                            {ti?.status === "done" && ti.currentStatus && (
                              <div className="space-y-2">
                                {/* Current status badge */}
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${trackStatusColor(ti.currentStatus)}`}>
                                  <Truck className="w-3 h-3" />
                                  {ti.currentStatus}
                                </span>

                                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                  {/* EDD */}
                                  {ti.edd && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                      <Calendar className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0" />
                                      <span>Est. delivery: <strong className="text-gray-800">{fmtTrackDate(ti.edd)}</strong></span>
                                    </div>
                                  )}

                                  {/* Last activity */}
                                  {ti.lastActivity && (
                                    <div className="flex items-start gap-1 text-[11px] text-gray-600">
                                      <Clock className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-medium text-gray-800">
                                          {ti.lastActivity.activity && ti.lastActivity.activity !== "NA"
                                            ? ti.lastActivity.activity
                                            : ti.lastActivity["sr-status-label"] ?? "Update"}
                                        </span>
                                        {ti.lastActivity.location && ti.lastActivity.location !== "NA" && (
                                          <span className="flex items-center gap-0.5 text-gray-400 mt-0.5">
                                            <MapPin className="w-2.5 h-2.5 shrink-0" /> {ti.lastActivity.location}
                                          </span>
                                        )}
                                        {ti.lastActivity.date && (
                                          <span className="text-gray-400 block">{fmtTrackDate(ti.lastActivity.date)}</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Items */}
                      {!isQuick && (() => {
                        const ITEM_LIMIT = 6;
                        const allItemsExpanded = expandedItemsIds.has(order.id);
                        const visibleItems = allItemsExpanded ? order.items : order.items.slice(0, ITEM_LIMIT);
                        const hiddenCount = order.items.length - ITEM_LIMIT;
                        return (
                          <div>
                            <div className="flex flex-wrap gap-1.5">
                              {visibleItems.map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2 py-1">
                                  <img src={imgUrl(item.product.image, "tiny")} alt={item.product.name} className="w-6 h-6 rounded object-cover shrink-0" />
                                  <span className="text-[11px] text-gray-700 font-medium max-w-[90px] truncate">{item.product.name}</span>
                                  <span className="text-[11px] text-gray-400 shrink-0">×{item.quantity}</span>
                                </div>
                              ))}
                              {!allItemsExpanded && hiddenCount > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleItems(order.id); }}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-[11px] font-semibold rounded-lg transition-colors">
                                  +{hiddenCount} more
                                </button>
                              )}
                            </div>
                            {allItemsExpanded && hiddenCount > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleItems(order.id); }}
                                className="mt-1.5 text-[11px] text-[#9B6FD1] hover:underline">
                                Show less
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Totals */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        <span>Subtotal <strong className="text-gray-700">₹{order.subtotal}</strong></span>
                        {order.shipping_charge > 0 && (
                          <span>
                            + Shipping <strong className="text-gray-700">₹{order.shipping_charge}</strong>
                            {order.raw_shipping_charge != null && order.raw_shipping_charge !== order.shipping_charge && (
                              <span className="ml-1 text-gray-400 line-through text-[10px]">₹{order.raw_shipping_charge}</span>
                            )}
                          </span>
                        )}
                        {order.cod_charge > 0 && <span>+ COD <strong className="text-gray-700">₹{order.cod_charge}</strong></span>}
                        {order.courier_name && <span className="text-[10px] text-[#9B6FD1] font-medium">via {order.courier_name}</span>}
                      </div>

                      {/* Profit breakdown */}
                      {showProfit && (
                        <div className={`px-3 py-2 rounded-lg text-[11px] ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                          <div className="flex flex-wrap items-center gap-1 text-gray-500 mb-1">
                            <span className="font-medium">Grand ₹{order.grand_total}</span>
                            <span className="opacity-40">−</span>
                            <span>(Wholesale ₹{wholesaleCost} + Ship ₹{rawShip}{rawCod > 0 ? ` + COD ₹${rawCod}` : ""})</span>
                            <span className="opacity-40">=</span>
                            <span className={`font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>₹{profit}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {profit >= 0 ? "Profit" : "Loss"} ₹{Math.abs(profit)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${profit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>{pct}%</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(order); }} disabled={downloadingId === order.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                          {downloadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePushToShiprocket(order); }}
                          disabled={pushingId === order.id || !!order.sr_order_id}
                          className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${order.sr_order_id ? "bg-orange-300 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600"}`}>
                          {pushingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                          {order.sr_order_id ? "Shipped" : "Ship"}
                        </button>
                        {order.awb_code && (
                          <a
                            href={`/track?awb=${order.awb_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 text-xs font-semibold rounded-lg transition-colors border border-sky-200">
                            <Link2 className="w-3.5 h-3.5" /> Track
                          </a>
                        )}
                        {order.sr_order_id && !order.awb_code && (
                          <button onClick={(e) => { e.stopPropagation(); handleSyncAwb(order); }}
                            disabled={syncingAwbId === order.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-colors border border-amber-200 disabled:opacity-60">
                            {syncingAwbId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Sync AWB
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setEditOrder(order); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors border border-gray-200">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteOrderId(order.id); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {order.items?.length > 0 && (
                          <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] text-gray-400">Deduct stock</span>
                            <button onClick={() => handleToggleStockDeduction(order)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${order.stock_deducted ? "bg-emerald-500" : "bg-gray-300"}`}
                              role="switch" aria-checked={!!order.stock_deducted}>
                              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${order.stock_deducted ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* SR result banner */}
                      {srResult?.orderId === order.id && (
                        <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs ${srResult.error ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                          {srResult.error ? (
                            <><X className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Shiprocket push failed</p><p className="mt-0.5 opacity-80 break-all">{srResult.error}</p></div></>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Pushed to Shiprocket</p>{srResult.shipmentId && <p className="mt-0.5">Shipment ID: <strong>{srResult.shipmentId}</strong></p>}{srResult.awb && <p>AWB: <strong>{srResult.awb}</strong></p>}</div></>
                          )}
                          <button onClick={() => setSrResult(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Load More */}
          {hasMore && (
            <div className="px-4 py-3 border-t border-gray-100 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-[#9B6FD1] border border-[#9B6FD1]/40 rounded-xl hover:bg-[#F3EEFB] transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? "Loading…" : `Load more (${PAGE_SIZE})`}
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Modals */}
      <QuickAddOrderModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)}
        onCreated={(order) => { setOrders((prev) => [order, ...prev]); toast.show("Order created!"); }}
        onError={(msg) => toast.show(msg, "error")} />
      <AddOrderModal open={addOrderOpen} onClose={() => setAddOrderOpen(false)}
        onCreated={(order) => { setOrders((prev) => [order, ...prev]); toast.show("Order created!"); }}
        onError={(msg) => toast.show(msg, "error")} />
      <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)}
        onSaved={(patch) => { setOrders((prev) => prev.map((o) => o.id === editOrder?.id ? { ...o, ...patch } : o)); toast.show("Order updated!"); }}
        onError={(msg) => toast.show(msg, "error")} />
      <ConfirmModal open={deleteOrderId !== null} title={`Delete order #${deleteOrderId}?`}
        body="This will permanently remove the order from Supabase. This cannot be undone."
        onConfirm={handleDeleteOrder} onCancel={() => setDeleteOrderId(null)} loading={deletingOrder} />
    </>
  );
}
