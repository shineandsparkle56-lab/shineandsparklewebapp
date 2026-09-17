import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, BarChart3, TrendingUp, TrendingDown, RefreshCw, IndianRupee, Package } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useProducts } from "../../context/ProductsContext";
import moment from "moment";

// ── Types ─────────────────────────────────────────────────────
interface SaleEntry {
  name:              string;
  amount:            number;  // what goes into totalSale (wholesale revenue for wholesale orders, grand_total otherwise)
  grand_total:       number;  // raw grand_total from DB (already has discount baked in)
  is_wholesale:      boolean;
  wholesale_revenue: number;  // computed wholesale revenue (0 for retail orders)
  estimated_profit:  number | null; // null when not enough data (no wholesale_price set or no raw_shipping)
  profit_pct:        number | null;
  discount_amount:   number; // ₹ discount applied on this order (0 = none)
}
interface ManualEntry { id: string; label: string; amount: string }

interface ReportData {
  charges:     ManualEntry[];
  investments: ManualEntry[];
  month:       string; // "YYYY-MM"
}

// ── Defaults ─────────────────────────────────────────────────
function defaultData(month: string): ReportData {
  return {
    month,
    charges: [
      { id: "shipping", label: "Shipping fees", amount: "" },
      { id: "ads",      label: "Ads",           amount: "" },
      { id: "other",    label: "Other",          amount: "" },
      { id: "box",      label: "Box",            amount: "" },
      { id: "tap",      label: "Tap",            amount: "" },
    ],
    investments: [
      { id: "ruchi",  label: "Ruchi creation",      amount: "" },
      { id: "sanjay", label: "Sanjay imitation",     amount: "" },
      { id: "shiv",   label: "Shiv sakti imitation", amount: "" },
      { id: "jay",    label: "Jay ambe",             amount: "" },
    ],
  };
}

function newEntry(): ManualEntry {
  return { id: `${Date.now()}`, label: "", amount: "" };
}

function toNum(v: string) { return parseFloat(v) || 0; }

// ── Month helpers ─────────────────────────────────────────────
function currentMonth() { return moment().format("YYYY-MM"); }
function formatMonth(m: string) { return moment(m, "YYYY-MM").format("MMMM YYYY"); }

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────
export function ReportTab() {
  const { products } = useProducts();
  const [allTime, setAllTime]       = useState(false);
  const [month, setMonth]           = useState(currentMonth());
  const [data, setData]             = useState<ReportData>(() => defaultData(currentMonth()));
  const [sales, setSales]           = useState<SaleEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Track whether the current data was loaded from DB (skip first-save until loaded)
  const isLoadedRef = useRef(false);
  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load report data from Supabase — all time or month ───────
  const fetchReportData = useCallback(async (m: string) => {
    setReportLoading(true);
    isLoadedRef.current = false;

    if (allTime) {
      // Fetch all months and aggregate
      const { data: rows, error } = await supabase
        .from("report_data")
        .select("charges, investments");

      if (!error && rows && rows.length > 0) {
        // Aggregate all charges and investments from all months
        const aggregatedCharges: Record<string, number> = {};
        const aggregatedInvestments: Record<string, number> = {};

        rows.forEach((row) => {
          ((row.charges as ManualEntry[]) ?? []).forEach((c) => {
            const amt = toNum(c.amount);
            if (amt > 0) {
              aggregatedCharges[c.label] = (aggregatedCharges[c.label] ?? 0) + amt;
            }
          });
          ((row.investments as ManualEntry[]) ?? []).forEach((inv) => {
            const amt = toNum(inv.amount);
            if (amt > 0) {
              aggregatedInvestments[inv.label] = (aggregatedInvestments[inv.label] ?? 0) + amt;
            }
          });
        });

        setData({
          month: "all-time",
          charges: Object.entries(aggregatedCharges).map(([label, amount]) => ({
            id: label,
            label,
            amount: String(amount),
          })),
          investments: Object.entries(aggregatedInvestments).map(([label, amount]) => ({
            id: label,
            label,
            amount: String(amount),
          })),
        });
      } else {
        // No data yet
        setData({ month: "all-time", charges: [], investments: [] });
      }
    } else {
      // Single month mode
      const { data: row, error } = await supabase
        .from("report_data")
        .select("charges, investments")
        .eq("month", m)
        .maybeSingle();

      if (!error && row) {
        setData({
          month:       m,
          charges:     (row.charges     as ManualEntry[]) ?? [],
          investments: (row.investments as ManualEntry[]) ?? [],
        });
      } else {
        // No row yet — use defaults so the UI isn't empty
        setData(defaultData(m));
      }
    }

    isLoadedRef.current = true;
    setReportLoading(false);
  }, [allTime]);

  useEffect(() => { fetchReportData(month); }, [month, fetchReportData]);

  // ── Fetch orders — all time or selected month ────────────────
  const fetchSales = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("customer_name, grand_total, created_at, is_wholesale, items, shipping_charge, payment_mode, cod_charge, raw_shipping_charge, raw_cod_charge, discount_amount")
      .order("created_at", { ascending: true });

    if (!allTime) {
      // Parse as local (IST) month boundaries, then convert to UTC for Supabase
      const from = moment(month, "YYYY-MM").startOf("month").toISOString();
      const to   = moment(month, "YYYY-MM").endOf("month").toISOString();
      query = query.gte("created_at", from).lte("created_at", to);
    }

    const { data: rows } = await query;
    if (rows) {
      setSales(rows.map((r) => {
        const isWholesale       = !!(r.is_wholesale as boolean);
        const items             = (r.items ?? []) as Array<{ product: { id: number; wholesale_price?: number }; quantity: number }>;
        const grandTotal        = r.grand_total as number;
        const rawShip           = (r.raw_shipping_charge as number | null) ?? null;
        const paymentMode       = r.payment_mode as string;
        const rawCod            = (r.raw_cod_charge as number | null)
          ?? (paymentMode === "cod" ? ((r.cod_charge as number) ?? 0) : 0);

        // ── Wholesale revenue (from live client_wholesale_price) ──
        let wholesaleRevenue = 0;
        if (isWholesale) {
          const itemsRevenue = items.reduce((s, i) => {
            const live = products.find((p) => p.id === i.product.id);
            const cwp  = live?.client_wholesale_price ?? 0;
            return s + cwp * i.quantity;
          }, 0);
          const ship = (r.shipping_charge as number) ?? 0;
          const cod  = paymentMode === "cod" ? ((r.cod_charge as number) ?? 0) : 0;
          wholesaleRevenue = itemsRevenue + ship + cod;
        }

        // ── Supplier cost (snapshotted wholesale_price in items) ──
        const supplierCost = items.reduce(
          (s, i) => s + ((i.product.wholesale_price ?? 0) * i.quantity), 0
        );
        const hasCostData = items.some((i) => (i.product.wholesale_price ?? 0) > 0);

        // ── Estimated profit ──
        // Retail:    grand_total − (supplierCost + raw_shipping + raw_cod + ₹10 packaging)
        // Wholesale: clientWholesaleRevenue − supplierCost − ₹10 packaging  (shipping paid separately)
        const PACKAGING_COST = 10;
        let estimatedProfit: number | null = null;
        let profitPct: number | null = null;

        if (isWholesale && hasCostData && wholesaleRevenue > 0) {
          // use items-only wholesale revenue (excl. shipping) so margin matches OrdersTab
          const itemsOnlyRevenue = items.reduce((s, i) => {
            const live = products.find((p) => p.id === i.product.id);
            const cwp  = live?.client_wholesale_price ?? 0;
            return s + cwp * i.quantity;
          }, 0);
          estimatedProfit = itemsOnlyRevenue - supplierCost - PACKAGING_COST;
          profitPct = itemsOnlyRevenue > 0
            ? Math.round((estimatedProfit / itemsOnlyRevenue) * 100)
            : null;
        } else if (!isWholesale && hasCostData && rawShip !== null) {
          estimatedProfit = grandTotal - (supplierCost + rawShip + rawCod + PACKAGING_COST);
          profitPct = grandTotal > 0
            ? Math.round((estimatedProfit / grandTotal) * 100)
            : null;
        }

        const amount = isWholesale ? wholesaleRevenue : grandTotal;
        return {
          name:              (r.customer_name as string) || "Unknown",
          amount,
          grand_total:       grandTotal,
          is_wholesale:      isWholesale,
          wholesale_revenue: wholesaleRevenue,
          estimated_profit:  estimatedProfit,
          profit_pct:        profitPct,
          discount_amount:   (r.discount_amount as number) ?? 0,
        };
      }));
    }
    setLoading(false);
  }, [month, allTime, products]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // ── Debounced upsert to Supabase whenever data changes ───────
  useEffect(() => {
    // Don't save in all-time mode (read-only aggregation) or before load
    if (allTime) return;
    if (!isLoadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      await supabase
        .from("report_data")
        .upsert(
          {
            month:       data.month,
            charges:     data.charges,
            investments: data.investments,
            updated_at:  new Date().toISOString(),
          },
          { onConflict: "month" }
        );
    }, 800); // 800 ms debounce

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data]);

  // ── Updaters ─────────────────────────────────────────────────
  const updateCharge = (id: string, field: "label" | "amount", val: string) =>
    setData((prev) => ({ ...prev, charges: prev.charges.map((c) => c.id === id ? { ...c, [field]: val } : c) }));

  const addCharge = () =>
    setData((prev) => ({ ...prev, charges: [...prev.charges, newEntry()] }));

  const removeCharge = (id: string) =>
    setData((prev) => ({ ...prev, charges: prev.charges.filter((c) => c.id !== id) }));

  const updateInvestment = (id: string, field: "label" | "amount", val: string) =>
    setData((prev) => ({ ...prev, investments: prev.investments.map((i) => i.id === id ? { ...i, [field]: val } : i) }));

  const addInvestment = () =>
    setData((prev) => ({ ...prev, investments: [...prev.investments, newEntry()] }));

  const removeInvestment = (id: string) =>
    setData((prev) => ({ ...prev, investments: prev.investments.filter((i) => i.id !== id) }));

  // ── Totals ───────────────────────────────────────────────────
  const totalSale       = sales.reduce((s, e) => s + e.amount, 0);
  const totalCharges    = data.charges.reduce((s, e) => s + toNum(e.amount), 0);
  const totalInvestment = data.investments.reduce((s, e) => s + toNum(e.amount), 0);
  const netProfit       = totalSale - totalCharges - totalInvestment;

  // Breakdown: retail vs wholesale
  const retailSaleTotal    = sales.filter((e) => !e.is_wholesale).reduce((s, e) => s + e.grand_total, 0);
  const wholesaleSaleTotal = sales.filter((e) =>  e.is_wholesale).reduce((s, e) => s + e.wholesale_revenue, 0);
  const wholesaleOrderCount = sales.filter((e) => e.is_wholesale).length;

  // Estimated profit across all orders that have enough data
  const ordersWithProfit   = sales.filter((e) => e.estimated_profit !== null);
  const totalEstProfit     = ordersWithProfit.reduce((s, e) => s + (e.estimated_profit ?? 0), 0);
  const estProfitBase      = ordersWithProfit.reduce((s, e) => s + e.amount, 0); // revenue from those orders only
  const estProfitPct       = estProfitBase > 0 ? Math.round((totalEstProfit / estProfitBase) * 100) : null;

  // ── Stock potential (live from products) ─────────────────────
  // Net revenue per unit = price - shipping_credit
  // (shipping_credit is absorbed by seller, reducing what customer pays for shipping)
  // Matches SQL: SUM((price - shipping_credit) * stock) — now includes variant stocks
  const stockPotentialRevenue = products
    .reduce((s, p) => {
      const totalUnits = p.stock + (p.variants ?? []).reduce((vs, v) => vs + v.stock, 0);
      return totalUnits > 0 ? s + (p.price - p.shipping_credit) * totalUnits : s;
    }, 0);

  // Total in-stock units across base + variants
  const totalStockUnits = products
    .reduce((s, p) => s + p.stock + (p.variants ?? []).reduce((vs, v) => vs + v.stock, 0), 0);

  // ── Final profit if all remaining stock sells ─────────────────
  // Your formula:
  //   Total revenue = already sold + remaining stock sell price
  //   Total cost    = stock investment (what you paid suppliers) + charges
  //   Final profit  = total revenue − total cost
  const totalRevenueIfAllSold = totalSale + stockPotentialRevenue;
  const totalCost             = totalInvestment + totalCharges;
  const finalIfAllSold        = totalRevenueIfAllSold - totalCost;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#9B6FD1]" />
            <h2 className="font-semibold text-gray-800">Sales &amp; Stock Report</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllTime((v) => !v)}
              className={`text-sm font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                allTime
                  ? "bg-[#9B6FD1] text-white border-[#9B6FD1]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[#9B6FD1] hover:text-[#9B6FD1]"
              }`}
            >
              All Time
            </button>
            <input
              type="month"
              value={month}
              disabled={allTime}
              onChange={(e) => setMonth(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button onClick={fetchSales} title="Refresh sales"
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-[#9B6FD1] hover:border-[#9B6FD1] transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total Sale"
            value={`₹${totalSale}`}
            sub={wholesaleOrderCount > 0 ? `${wholesaleOrderCount} wholesale order${wholesaleOrderCount > 1 ? "s" : ""}` : undefined}
            color="bg-[#F3EEFB] text-[#6B35C2]"
          />
          <StatCard label="Total Charges"    value={`₹${totalCharges}`}    color="bg-orange-50 text-orange-700" />
          <StatCard label="Stock Investment" value={`₹${totalInvestment}`} color="bg-blue-50 text-blue-700" />
          <StatCard
            label="Net Profit"
            value={`₹${netProfit}`}
            sub={totalSale > 0 ? `${Math.round((netProfit / totalSale) * 100)}% margin` : undefined}
            color={netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}
          />
          {ordersWithProfit.length > 0 && (
            <StatCard
              label="Est. Order Profit"
              value={`₹${totalEstProfit}`}
              sub={estProfitPct !== null ? `${estProfitPct}% margin · ${ordersWithProfit.length} orders` : `${ordersWithProfit.length} orders`}
              color={totalEstProfit >= 0 ? "bg-violet-50 text-violet-700" : "bg-red-50 text-red-600"}
            />
          )}
          <StatCard
            label="Final if All Sold"
            value={`₹${finalIfAllSold}`}
            sub={totalStockUnits > 0 ? `${totalStockUnits} units in stock` : "no stock left"}
            color={finalIfAllSold >= 0 ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}
          />
        </div>

        {/* ── Wholesale vs Retail breakdown (only when there are wholesale orders) ── */}
        {wholesaleOrderCount > 0 && (
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-amber-100 pt-3">
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Wholesale Revenue</p>
              <p className="text-xl font-bold text-amber-700">₹{wholesaleSaleTotal}</p>
              <p className="text-[11px] text-amber-600 opacity-70">{wholesaleOrderCount} order{wholesaleOrderCount > 1 ? "s" : ""} at W-rate</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Retail Revenue</p>
              <p className="text-xl font-bold text-gray-700">₹{retailSaleTotal}</p>
              <p className="text-[11px] text-gray-400">{sales.length - wholesaleOrderCount} retail order{(sales.length - wholesaleOrderCount) !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">Total (Retail + W)</p>
              <p className="text-xl font-bold text-emerald-700">₹{totalSale}</p>
              <p className="text-[11px] text-emerald-600 opacity-70">{sales.length} orders total</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Sales ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#9B6FD1]" />
              <h3 className="font-semibold text-gray-800 text-sm">
                Sales — {allTime ? "All Time" : formatMonth(month)}
              </h3>
            </div>
            <span className="text-xs text-gray-400">{sales.length} orders</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : sales.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">
              {allTime ? "No orders found" : "No orders this month"}
            </p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {sales.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 text-sm gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-700 truncate max-w-[110px]">{s.name}</span>
                    {s.is_wholesale && (
                      <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">W</span>
                    )}
                    {s.discount_amount > 0 && (
                      <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-rose-100 text-rose-600">−₹{s.discount_amount}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.estimated_profit !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.estimated_profit >= 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {s.estimated_profit >= 0 ? "+" : ""}₹{s.estimated_profit}
                        {s.profit_pct !== null ? ` (${s.profit_pct}%)` : ""}
                      </span>
                    )}
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">₹{s.amount}</span>
                      {s.is_wholesale && s.grand_total !== s.amount && (
                        <p className="text-[10px] text-gray-400 line-through">₹{s.grand_total}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-3 bg-[#F3EEFB] font-bold text-sm text-[#6B35C2]">
                <span>Total Sale</span>
                <span>₹{totalSale}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Right two sections ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Charges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Charges</h3>
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Total ₹{totalCharges}</span>
            </div>
            <div className="p-4 space-y-2">
              {reportLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : data.charges.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={c.label}
                    readOnly={allTime}
                    onChange={(e) => !allTime && updateCharge(c.id, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1] read-only:bg-gray-50 read-only:cursor-default"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#9B6FD1] focus-within:ring-2 focus-within:ring-[#9B6FD1]/20 w-28">
                      <span className="pl-2.5 text-gray-400 text-sm select-none">₹</span>
                      <input
                        type="number" min="0"
                        value={c.amount}
                        readOnly={allTime}
                        onChange={(e) => !allTime && updateCharge(c.id, "amount", e.target.value)}
                        placeholder="0"
                        className="flex-1 py-2 pr-2.5 text-sm text-gray-800 outline-none bg-transparent w-0 read-only:cursor-default"
                      />
                    </div>
                    {!allTime && (
                    <button onClick={() => removeCharge(c.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </div>
              ))}
              {!reportLoading && !allTime && (
              <button onClick={addCharge}
                className="flex items-center gap-1.5 text-xs text-[#9B6FD1] hover:text-[#8a5fc0] font-medium mt-1">
                <Plus className="w-3.5 h-3.5" /> Add charge
              </button>
              )}
            </div>
          </div>

          {/* Investment stocks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Investment Stocks</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Total ₹{totalInvestment}</span>
            </div>
            <div className="p-4 space-y-2">
              {reportLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : data.investments.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={inv.label}
                    readOnly={allTime}
                    onChange={(e) => !allTime && updateInvestment(inv.id, "label", e.target.value)}
                    placeholder="Supplier name"
                    className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1] read-only:bg-gray-50 read-only:cursor-default"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#9B6FD1] focus-within:ring-2 focus-within:ring-[#9B6FD1]/20 w-28">
                      <span className="pl-2.5 text-gray-400 text-sm select-none">₹</span>
                      <input
                        type="number" min="0"
                        value={inv.amount}
                        readOnly={allTime}
                        onChange={(e) => !allTime && updateInvestment(inv.id, "amount", e.target.value)}
                        placeholder="0"
                        className="flex-1 py-2 pr-2.5 text-sm text-gray-800 outline-none bg-transparent w-0 read-only:cursor-default"
                      />
                    </div>
                    {!allTime && (
                    <button onClick={() => removeInvestment(inv.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    )}
                  </div>
                </div>
              ))}
              {!reportLoading && !allTime && (
              <button onClick={addInvestment}
                className="flex items-center gap-1.5 text-xs text-[#9B6FD1] hover:text-[#8a5fc0] font-medium mt-1">
                <Plus className="w-3.5 h-3.5" /> Add supplier
              </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Full summary note ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">
          Summary — {allTime ? "All Time" : formatMonth(month)}
        </h3>
        <div className="space-y-1.5 text-sm">

          {/* Already sold */}
          <div className="flex justify-between text-gray-600">
            <span>Total Sale (so far)</span>
            <span className="font-semibold text-gray-900">₹{totalSale}</span>
          </div>
          {totalStockUnits > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>+ Remaining Stock Sell Value ({totalStockUnits} units)</span>
              <span className="font-semibold text-gray-900">₹{stockPotentialRevenue}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500 font-medium">
            <span>= Total Revenue if all sold</span>
            <span className="text-gray-800">₹{totalRevenueIfAllSold}</span>
          </div>

          <div className="h-px bg-gray-100 my-2" />

          <div className="flex justify-between text-gray-600">
            <span>− Stock Investment</span>
            <span className="font-semibold text-blue-600">₹{totalInvestment}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>− Charges</span>
            <span className="font-semibold text-orange-600">₹{totalCharges}</span>
          </div>
          <div className="flex justify-between text-gray-500 font-medium">
            <span>= Total Cost</span>
            <span className="text-gray-800">₹{totalCost}</span>
          </div>

          <div className="h-px bg-gray-100 my-2" />

          <div className="flex justify-between font-bold text-base">
            <span className="text-gray-800">Net Profit (so far)</span>
            <span className={netProfit >= 0 ? "text-emerald-600" : "text-red-500"}>₹{netProfit}</span>
          </div>
          {ordersWithProfit.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Est. Order-level Profit ({ordersWithProfit.length} orders)</span>
              <span className={`font-semibold text-sm px-2 py-0.5 rounded-full ${
                totalEstProfit >= 0 ? "bg-violet-50 text-violet-700" : "bg-red-50 text-red-600"
              }`}>
                {totalEstProfit >= 0 ? "+" : ""}₹{totalEstProfit}
                {estProfitPct !== null ? ` (${estProfitPct}%)` : ""}
              </span>
            </div>
          )}
          {totalStockUnits > 0 && (
            <div className="flex justify-between font-bold text-base">
              <span className="text-gray-800">Final Profit (if all stock sells)</span>
              <span className={finalIfAllSold >= 0 ? "text-teal-600" : "text-amber-600"}>₹{finalIfAllSold}</span>
            </div>
          )}
          {totalStockUnits > 0 && (
            <p className="text-[11px] text-gray-400 pt-0.5">
              ₹{totalRevenueIfAllSold} revenue − ₹{totalCost} cost = ₹{finalIfAllSold}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
