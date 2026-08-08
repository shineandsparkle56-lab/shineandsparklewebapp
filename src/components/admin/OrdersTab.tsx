import { useState, useEffect } from "react";
import {
  Plus, Trash2, ShoppingBag, Download, FileText, Loader2,
  Pencil, Truck, X, CheckCircle2, Zap,
} from "lucide-react";
import { useProducts } from "../../context/ProductsContext";
import { supabase } from "../../lib/supabase";
import { generateOrderPDF } from "../../utils/generateOrderPDF";
import type { OrderMeta } from "../../utils/generateOrderPDF";
import type { CartItem } from "../../context/CartContext";
import { Product } from "../../data/products";
import { useToast } from "../../hooks/useToast";
import { imgUrl } from "../../lib/imgUrl";
import { pushToShiprocket, saveSrIds, buildShiprocketItems, estimateWeight } from "../../lib/shiprocket";
import { EditOrderModal } from "./EditOrderModal";
import { AddOrderModal } from "./AddOrderModal";
import { QuickAddOrderModal } from "./QuickAddOrderModal";
import { ConfirmModal, Spinner, SrResult } from "./shared";
import type { OrderRow, OrderStatus } from "./EditOrderModal";
import { ORDER_STATUSES } from "./EditOrderModal";

export function OrdersTab() {
  const { products, updateStock } = useProducts();
  const toast = useToast();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [srResult, setSrResult] = useState<SrResult>(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    const { data, error: err } = await supabase
      .from("orders").select("*").order("created_at", { ascending: false });
    if (!err && data) setOrders(data as OrderRow[]);
    setOrdersLoading(false);
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
          description: "", stock: 99, shipping_credit: 0, wholesale_price: 0, variants: [],
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
      });
      await saveSrIds(order.id, result);
      setOrders((prev) => prev.map((o) =>
        o.id === order.id
          ? { ...o, status: "confirmed", sr_order_id: result.sr_order_id, sr_shipment_id: result.shipment_id }
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
            <span className="text-sm text-gray-400">{orders.length} total</span>
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
          <div className="divide-y divide-gray-100">
            {orders.map((order, idx) => {
              const sm = statusMeta(order.status);
              const isQuick = order.items?.length === 0;
              const isEven = idx % 2 === 0;
              return (
                <div key={order.id} className={`p-4 border-l-4 ${isEven ? "bg-white border-l-[#9B6FD1]/30" : "bg-slate-50 border-l-orange-200"}`}>

                  {/* Row 1: ID · Date · Badges · Total */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
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
                    </div>
                    <span className="text-sm font-bold text-gray-900 shrink-0">₹{order.grand_total}</span>
                  </div>

                  {/* Row 2: Customer */}
                  {order.customer_name && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700">{order.customer_name}{order.customer_mobile ? ` · ${order.customer_mobile}` : ""}</p>
                      {order.customer_address && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{order.customer_address}, {order.customer_city}, {order.customer_state} — {order.pincode}</p>
                      )}
                    </div>
                  )}

                  {/* Row 3: Items */}
                  {!isQuick && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2 py-1">
                          <img src={imgUrl(item.product.image, "tiny")} alt={item.product.name} className="w-6 h-6 rounded object-cover shrink-0" />
                          <span className="text-[11px] text-gray-700 font-medium max-w-[90px] truncate">{item.product.name}</span>
                          <span className="text-[11px] text-gray-400 shrink-0">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Row 4: Totals */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mb-3">
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

                  {/* Row 5: Profit — only for orders with actual Shiprocket rate recorded */}
                  {order.raw_shipping_charge != null && order.items.some((i) => (i.product.wholesale_price ?? 0) > 0) && (() => {
                    const wholesaleCost = order.items.reduce((s, i) => s + (i.product.wholesale_price ?? 0) * i.quantity, 0);
                    const rawShip = order.raw_shipping_charge;
                    const rawCod  = order.raw_cod_charge ?? (order.payment_mode === "cod" ? (order.cod_charge ?? 0) : 0);
                    const totalCost = wholesaleCost + rawShip + rawCod;
                    const profit  = order.grand_total - totalCost;
                    const pct     = order.grand_total > 0 ? Math.round((profit / order.grand_total) * 100) : 0;
                    return (
                      <div className={`px-3 py-2 rounded-lg text-[11px] mb-3 ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                        <div className="flex flex-wrap items-center gap-1 text-gray-500 mb-1">
                          <span className="font-medium">Grand ₹{order.grand_total}</span>
                          <span className="opacity-40">−</span>
                          <span>(</span>
                          <span>Wholesale ₹{wholesaleCost}</span>
                          <span className="opacity-40">+</span>
                          <span>Ship ₹{rawShip}</span>
                          <span className="opacity-40">+</span>
                          <span>COD ₹{rawCod}</span>
                          <span>)</span>
                          <span className="opacity-40">=</span>
                          <span className={`font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>₹{profit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {profit >= 0 ? "Profit" : "Loss"} ₹{Math.abs(profit)}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${profit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>{pct}%</span>
                          <span className="text-[10px] text-gray-400 ml-auto">
                            Cost: ₹{wholesaleCost} wholesale + ₹{rawShip} ship{rawCod > 0 ? ` + ₹${rawCod} COD` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Row 6: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => handleDownloadPDF(order)} disabled={downloadingId === order.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                      {downloadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                    </button>
                    <button onClick={() => handlePushToShiprocket(order)}
                      disabled={pushingId === order.id || !!order.sr_order_id}
                      className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${order.sr_order_id ? "bg-orange-300 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600"}`}>
                      {pushingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                      {order.sr_order_id ? "Shipped" : "Ship"}
                    </button>
                    <button onClick={() => setEditOrder(order)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors border border-gray-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteOrderId(order.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {order.items?.length > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Deduct stock</span>
                        <button onClick={() => handleToggleStockDeduction(order)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${order.stock_deducted ? "bg-emerald-500" : "bg-gray-300"}`}
                          role="switch" aria-checked={!!order.stock_deducted}>
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${order.stock_deducted ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Shiprocket result banner */}
                  {srResult?.orderId === order.id && (
                    <div className={`mt-3 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs ${srResult.error ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                      {srResult.error ? (
                        <><X className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Shiprocket push failed</p><p className="mt-0.5 opacity-80 break-all">{srResult.error}</p></div></>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Pushed to Shiprocket</p>{srResult.shipmentId && <p className="mt-0.5">Shipment ID: <strong>{srResult.shipmentId}</strong></p>}{srResult.awb && <p>AWB: <strong>{srResult.awb}</strong></p>}</div></>
                      )}
                      <button onClick={() => setSrResult(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
