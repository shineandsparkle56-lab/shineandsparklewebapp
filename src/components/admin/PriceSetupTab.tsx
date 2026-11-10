/**
 * PriceSetupTab.tsx
 * Products grouped by wholesale price.
 * Each group is collapsible. Each row is individually editable.
 * Saving updates price, original_price, shipping_credit, discount in Supabase.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Save, RefreshCw, Loader2, Search, AlertCircle,
  CheckCircle2, ChevronUp, ChevronDown, IndianRupee,
  SlidersHorizontal, Package,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../hooks/useToast";

// ── Types ─────────────────────────────────────────────────────────
interface PriceRow {
  id:             number;
  name:           string;
  category:       string;
  image:          string;
  wholesale:      number;
  price:          number;
  originalPrice:  number;
  shippingCredit: number;
  dirty:          boolean;
  saving:         boolean;
}

// ── Computed helpers ──────────────────────────────────────────────
const getMargin    = (r: PriceRow) => r.price - r.wholesale - r.shippingCredit;
const getDiscount  = (r: PriceRow) =>
  r.originalPrice > r.price && r.originalPrice > 0
    ? Math.round(((r.originalPrice - r.price) / r.originalPrice) * 100)
    : 0;
const getMarginPct = (r: PriceRow) => r.price > 0 ? Math.round((getMargin(r) / r.price) * 100) : 0;
const getNet       = (r: PriceRow) => r.price - r.shippingCredit;

const INPUT = "w-full text-right text-sm bg-transparent border-b border-transparent " +
  "focus:border-[#9B6FD1] focus:outline-none py-0.5 px-1 transition-colors " +
  "focus:bg-[#F3EEFB]/50 rounded";

// ── Component ─────────────────────────────────────────────────────
export function PriceSetupTab() {
  const toast = useToast();
  const [rows, setRows]           = useState<PriceRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [savingAll, setSavingAll] = useState(false);
  const [minMargin, setMinMargin] = useState(5);
  // All groups collapsed by default — populated after fetch
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Group-level edit state: { [wholesaleKey]: { price, originalPrice, shippingCredit, saving } }
  interface GroupEdit { price: string; originalPrice: string; shippingCredit: string; saving: boolean; }
  const [groupEdits, setGroupEdits] = useState<Record<string, GroupEdit>>({});

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,category,image,price,original_price,wholesale_price,shipping_credit")
      .order("wholesale_price", { ascending: true });

    if (error) { toast.show("Failed to load products.", "error"); setLoading(false); return; }

    const mapped = (data ?? []).map((p) => ({
      id:             p.id as number,
      name:           p.name as string,
      category:       p.category as string,
      image:          p.image as string,
      wholesale:      (p.wholesale_price as number) ?? 0,
      price:          (p.price as number) ?? 0,
      originalPrice:  (p.original_price as number) ?? 0,
      shippingCredit: (p.shipping_credit as number) ?? 0,
      dirty:          false,
      saving:         false,
    }));

    setRows(mapped);

    // Collapse all groups by default
    const uniqueKeys = new Set(mapped.map((r) => String(r.wholesale)));
    setCollapsed(uniqueKeys);

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Inline edit ───────────────────────────────────────────────
  const setField = (id: number, field: "price" | "originalPrice" | "shippingCredit", raw: string) => {
    const val = parseFloat(raw);
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, [field]: raw === "" ? 0 : isNaN(val) ? r[field] : val, dirty: true } : r
    ));
  };

  // ── Save one row ──────────────────────────────────────────────
  const saveRow = async (row: PriceRow) => {
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, saving: true } : r));
    const discount = row.originalPrice > row.price && row.originalPrice > 0
      ? Math.round(((row.originalPrice - row.price) / row.originalPrice) * 100)
      : 0;
    const { error } = await supabase
      .from("products")
      .update({ price: row.price, original_price: row.originalPrice, shipping_credit: row.shippingCredit, discount })
      .eq("id", row.id);
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, dirty: !!error, saving: false } : r));
    if (error) toast.show(`Failed to save ${row.name}: ${error.message}`, "error");
  };

  // ── Save all dirty ────────────────────────────────────────────
  const saveAll = async () => {
    const dirty = rows.filter((r) => r.dirty);
    if (!dirty.length) { toast.show("No changes to save."); return; }
    setSavingAll(true);
    await Promise.all(dirty.map(saveRow));
    setSavingAll(false);
    toast.show(`Saved ${dirty.length} product${dirty.length > 1 ? "s" : ""}!`);
  };

  // ── Group-level field change ───────────────────────────────────
  const setGroupField = (key: string, field: "price" | "originalPrice" | "shippingCredit", raw: string) => {
    setGroupEdits((prev) => {
      const existing = prev[key] ?? { price: "", originalPrice: "", shippingCredit: "", saving: false };
      return { ...prev, [key]: { ...existing, [field]: raw } };
    });
    // Apply to all rows in this group immediately (live preview)
    const val = parseFloat(raw);
    if (raw !== "" && !isNaN(val)) {
      const wholesale = parseFloat(key);
      setRows((prev) => prev.map((r) =>
        r.wholesale === wholesale ? { ...r, [field]: val, dirty: true } : r
      ));
    }
  };

  // ── Save entire group ─────────────────────────────────────────
  const saveGroup = async (key: string, groupRows: PriceRow[]) => {
    setGroupEdits((prev) => ({ ...prev, [key]: { ...prev[key], saving: true } as any }));
    await Promise.all(groupRows.filter((r) => r.dirty).map(saveRow));
    setGroupEdits((prev) => ({ ...prev, [key]: { price: "", originalPrice: "", shippingCredit: "", saving: false } }));
    toast.show(`Group ₹${key} saved!`);
  };

  // ── Toggle group collapse ─────────────────────────────────────
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const collapseAll = () =>
    setCollapsed(new Set(groups.map((g) => String(g.wholesale))));

  const expandAll = () => setCollapsed(new Set());

  // ── Filter + group ────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredRows = useMemo(() =>
    q ? rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      String(r.id).includes(q)
    ) : rows,
  [rows, q]);

  // Group by wholesale price, sorted ascending
  const groups = useMemo(() => {
    const map = new Map<number, PriceRow[]>();
    for (const r of filteredRows) {
      const key = r.wholesale;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([wholesale, items]) => ({
        wholesale,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
        avgMarginPct: Math.round(items.reduce((s, r) => s + getMarginPct(r), 0) / items.length),
        avgMargin:    Math.round(items.reduce((s, r) => s + getMargin(r), 0) / items.length),
        dirtyCount:   items.filter((r) => r.dirty).length,
        lowCount:     items.filter((r) => getMargin(r) < minMargin).length,
      }));
  }, [filteredRows, minMargin]);

  const dirtyCount = rows.filter((r) => r.dirty).length;

  // ── Margin badge ──────────────────────────────────────────────
  const MarginBadge = ({ pct }: { pct: number }) => (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      pct >= 25 ? "bg-emerald-100 text-emerald-700"
      : pct >= 15 ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-600"
    }`}>{pct}%</span>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-[#9B6FD1]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Price Setup</h2>
            <p className="text-xs text-gray-400">
              Grouped by wholesale cost · edit selling price, MRP, shipping credit inline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchRows} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-50 border border-gray-200 transition-colors disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {dirtyCount > 0 && (
            <button onClick={saveAll} disabled={savingAll}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#9B6FD1] hover:bg-[#8558c5] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
              {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save {dirtyCount} change{dirtyCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name, category, SKU…"
            className="flex-1 border-none outline-none text-sm text-gray-700 placeholder:text-gray-300 bg-transparent" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Warn below</span>
          <input type="number" value={minMargin} onChange={(e) => setMinMargin(Number(e.target.value) || 0)}
            className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40" />
          <span className="text-xs text-gray-400">₹ margin</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={expandAll} className="text-xs text-[#9B6FD1] hover:underline">Expand all</button>
          <span className="text-gray-200">·</span>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:underline">Collapse all</button>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {groups.length} groups · {filteredRows.length} products
          {dirtyCount > 0 && <span className="ml-2 text-amber-600 font-semibold">· {dirtyCount} unsaved</span>}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
          Margin below ₹{minMargin}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />
          Unsaved change
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          Click cell to edit · Enter to save row
        </span>
      </div>

      {/* Groups */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading products…</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
          <AlertCircle className="w-8 h-8 text-gray-200" />
          <p className="text-sm">No products match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const key      = String(group.wholesale);
            const isOpen   = !collapsed.has(key);

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* ── Group header + group-level edit in one row ── */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-wrap">

                  {/* Collapse toggle */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
                  >
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <span className="flex items-center gap-1 bg-[#9B6FD1] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <IndianRupee className="w-3 h-3" />{group.wholesale} cost
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Package className="w-3 h-3" />{group.items.length}
                    </span>
                    <MarginBadge pct={group.avgMarginPct} />
                    {group.lowCount > 0 && (
                      <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" />{group.lowCount} low
                      </span>
                    )}
                  </button>

                  {/* ── Group-level edit inputs ── */}
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Apply to all:</span>

                    {/* Selling price */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 mb-0.5">Selling ₹</span>
                      <input
                        type="number" min="0" step="1"
                        placeholder={String(Math.round(group.items.reduce((s,r) => s + r.price, 0) / group.items.length))}
                        value={groupEdits[key]?.price ?? ""}
                        onChange={(e) => setGroupField(key, "price", e.target.value)}
                        className="w-16 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 focus:border-[#9B6FD1]"
                      />
                    </div>

                    {/* MRP */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 mb-0.5">MRP ₹</span>
                      <input
                        type="number" min="0" step="1"
                        placeholder={String(Math.round(group.items.reduce((s,r) => s + r.originalPrice, 0) / group.items.length))}
                        value={groupEdits[key]?.originalPrice ?? ""}
                        onChange={(e) => setGroupField(key, "originalPrice", e.target.value)}
                        className="w-16 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 focus:border-[#9B6FD1]"
                      />
                    </div>

                    {/* Shipping credit */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-gray-400 mb-0.5">Ship Credit ₹</span>
                      <input
                        type="number" min="0" step="1"
                        placeholder={String(Math.round(group.items.reduce((s,r) => s + r.shippingCredit, 0) / group.items.length))}
                        value={groupEdits[key]?.shippingCredit ?? ""}
                        onChange={(e) => setGroupField(key, "shippingCredit", e.target.value)}
                        className="w-16 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 focus:border-[#9B6FD1]"
                      />
                    </div>

                    {/* Live margin preview for group edit */}
                    {(() => {
                      const ge = groupEdits[key];
                      const p  = ge?.price ? parseFloat(ge.price) : null;
                      const sc = ge?.shippingCredit ? parseFloat(ge.shippingCredit) : null;
                      if (p !== null && !isNaN(p)) {
                        const m   = p - group.wholesale - (sc ?? 0);
                        const mp  = p > 0 ? Math.round((m / p) * 100) : 0;
                        return (
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-gray-400 mb-0.5">Preview</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${m >= minMargin ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                              ₹{m} · {mp}%
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Save group button */}
                    {group.dirtyCount > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-amber-500 mb-0.5">{group.dirtyCount} changed</span>
                        <button
                          onClick={() => saveGroup(key, group.items)}
                          disabled={groupEdits[key]?.saving}
                          className="flex items-center gap-1 px-3 py-1 bg-[#9B6FD1] hover:bg-[#8558c5] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
                        >
                          {groupEdits[key]?.saving
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Save className="w-3 h-3" />}
                          Save group
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Product rows table */}
                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">Selling ₹</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">MRP ₹</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-24">Ship Credit ₹</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">Margin ₹</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-20">Margin %</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16">Disc %</th>
                          <th className="px-2 py-2 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16">Net ₹</th>
                          <th className="px-2 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider w-14">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.items.map((row, idx) => {
                          const m   = getMargin(row);
                          const mp  = getMarginPct(row);
                          const net = getNet(row);
                          const disc = getDiscount(row);
                          const low = m < minMargin && row.wholesale > 0;
                          const bg  = row.dirty
                            ? "bg-amber-50/70"
                            : low
                            ? "bg-red-50/60"
                            : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30";

                          return (
                            <tr key={row.id} className={`${bg} hover:bg-[#F3EEFB]/30 transition-colors`}>

                              {/* Product */}
                              <td className="px-3 py-2 max-w-[220px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img src={row.image} alt=""
                                    className="w-8 h-8 rounded-lg object-cover shrink-0 border border-gray-100" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-800 truncate leading-tight">{row.name}</p>
                                    <p className="text-[10px] text-gray-400">
                                      <span className="font-mono">SNS-{row.id}</span>
                                      {row.category ? ` · ${row.category}` : ""}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Selling price */}
                              <td className="px-2 py-2 w-20">
                                <input type="number" min="0" step="1"
                                  value={row.price || ""}
                                  onChange={(e) => setField(row.id, "price", e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveRow(row)}
                                  className={`${INPUT} w-16 font-semibold text-gray-800`} />
                              </td>

                              {/* MRP */}
                              <td className="px-2 py-2 w-20">
                                <input type="number" min="0" step="1"
                                  value={row.originalPrice || ""}
                                  onChange={(e) => setField(row.id, "originalPrice", e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveRow(row)}
                                  className={`${INPUT} w-16 text-gray-500`} />
                              </td>

                              {/* Shipping credit */}
                              <td className="px-2 py-2 w-24">
                                <input type="number" min="0" step="1"
                                  value={row.shippingCredit || ""}
                                  onChange={(e) => setField(row.id, "shippingCredit", e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveRow(row)}
                                  className={`${INPUT} w-14 text-gray-500`} />
                              </td>

                              {/* Margin ₹ */}
                              <td className="px-2 py-2 text-right w-20">
                                <span className={`text-sm font-semibold ${m >= minMargin ? "text-emerald-600" : "text-red-500"}`}>
                                  ₹{m}
                                </span>
                              </td>

                              {/* Margin % */}
                              <td className="px-2 py-2 text-right w-20">
                                <MarginBadge pct={mp} />
                              </td>

                              {/* Discount % (customer-facing) */}
                              <td className="px-2 py-2 text-right w-16">
                                {disc > 0 ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                    {disc}% off
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-300">—</span>
                                )}
                              </td>

                              {/* Net */}
                              <td className="px-2 py-2 text-right w-16">
                                <span className="text-xs text-gray-500">₹{net}</span>
                              </td>

                              {/* Save */}
                              <td className="px-2 py-2 text-center w-14">
                                {row.dirty ? (
                                  <button onClick={() => saveRow(row)} disabled={row.saving}
                                    className="flex items-center gap-1 px-2 py-1 bg-[#9B6FD1] hover:bg-[#8558c5] text-white text-[10px] font-semibold rounded-lg transition-colors disabled:opacity-60 mx-auto">
                                    {row.saving
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Save className="w-3 h-3" />}
                                    Save
                                  </button>
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-gray-200 mx-auto" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* Group footer — totals row */}
                      <tfoot>
                        <tr className="bg-[#F3EEFB]/40 border-t border-[#9B6FD1]/10">
                          <td className="px-3 py-1.5 text-[10px] font-semibold text-[#9B6FD1]">
                            Group avg ({group.items.length} products)
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-gray-500">
                            ₹{Math.round(group.items.reduce((s, r) => s + r.price, 0) / group.items.length)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-gray-500">
                            ₹{Math.round(group.items.reduce((s, r) => s + r.originalPrice, 0) / group.items.length)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-gray-500">
                            ₹{Math.round(group.items.reduce((s, r) => s + r.shippingCredit, 0) / group.items.length)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-700">
                            ₹{group.avgMargin}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <MarginBadge pct={group.avgMarginPct} />
                          </td>
                          {/* Avg discount % */}
                          <td className="px-2 py-1.5 text-right text-[10px] text-orange-500 font-semibold">
                            {Math.round(group.items.reduce((s, r) => s + getDiscount(r), 0) / group.items.length)}% off
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      {!loading && rows.length > 0 && (() => {
        const withW     = rows.filter((r) => r.wholesale > 0);
        const lowM      = withW.filter((r) => getMargin(r) < minMargin);
        const avgPct    = withW.length > 0
          ? Math.round(withW.reduce((s, r) => s + getMarginPct(r), 0) / withW.length) : 0;
        const minM      = withW.length > 0 ? Math.min(...withW.map(getMargin)) : 0;
        const maxM      = withW.length > 0 ? Math.max(...withW.map(getMargin)) : 0;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Products",  value: String(rows.length),       sub: `${groups.length} price groups`,       color: "text-gray-800"    },
              { label: "Avg Margin %",    value: `${avgPct}%`,              sub: "across priced products",              color: avgPct >= 20 ? "text-emerald-600" : "text-amber-600" },
              { label: "Margin Range",    value: `₹${minM} – ₹${maxM}`,    sub: "min to max",                          color: "text-gray-800"    },
              { label: "Below Threshold", value: String(lowM.length),       sub: `margin < ₹${minMargin}`,              color: lowM.length > 0 ? "text-red-500" : "text-emerald-600" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
