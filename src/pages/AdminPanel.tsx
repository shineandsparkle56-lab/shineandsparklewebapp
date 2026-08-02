import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Plus, Trash2, LogOut, Package, Sparkles, ChevronDown, CheckCircle2,
  Upload, X, Image, ShoppingBag, Download, FileText, Loader2, Minus,
  Pencil, Tag, GripVertical, Search, SlidersHorizontal, Truck, ImageIcon, BarChart3, Printer, Zap, Settings,
} from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { useCategories } from "../context/CategoriesContext";
import { Product } from "../data/products";
import type { ProductVariant } from "../data/products";
import { variantCover } from "../data/products";
import { supabase } from "../lib/supabase";
import { generateOrderPDF } from "../utils/generateOrderPDF";
import type { OrderMeta } from "../utils/generateOrderPDF";
import type { CartItem } from "../context/CartContext";
import { DraggableImageGrid } from "../components/ui/DraggableImageGrid";
import { useImageItems } from "../hooks/useImageItems";
import { useToast } from "../hooks/useToast";
import { pushToShiprocket, saveSrIds, buildShiprocketItems, estimateWeight } from "../lib/shiprocket";
import JSZip from "jszip";
import { compressToWebP } from "../utils/compressToWebP";
import { uploadToR2 } from "../lib/r2Upload";
import { imgUrl } from "../lib/imgUrl";
import { EditProductModal } from "../components/admin/EditProductModal";
import { EditOrderModal } from "../components/admin/EditOrderModal";
import { AddOrderModal } from "../components/admin/AddOrderModal";
import { QuickAddOrderModal } from "../components/admin/QuickAddOrderModal";
import type { OrderRow, OrderStatus } from "../components/admin/EditOrderModal";
import { ORDER_STATUSES } from "../components/admin/EditOrderModal";
import { PostEditor } from "../components/admin/PostEditor";
import { ReportTab } from "../components/admin/ReportTab";
import { ShiprocketPDFPrinter } from "../components/admin/ShiprocketPDFPrinter";
import { useSettings } from "../hooks/useSettings";

const MAX_IMAGES = 6;
const EMPTY_FORM = { name: "", category: "", price: "", originalPrice: "", description: "", stock: "10", shipping_credit: "0", wholesale_price: "0", base_variant_label: "" };

// ── Reusable small components ────────────────────────────────
function Spinner({ cls = "w-4 h-4" }: { cls?: string }) {
  return <div className={`${cls} border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin`} />;
}

function ConfirmModal({ open, title, body, onConfirm, onCancel, loading, danger = true }: {
  open: boolean; title: string; body: string;
  onConfirm: () => void; onCancel: () => void;
  loading?: boolean; danger?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${danger ? "bg-red-100" : "bg-[#F3EEFB]"}`}>
              <Trash2 className={`w-5 h-5 ${danger ? "text-red-500" : "text-[#9B6FD1]"}`} />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-5">{body}</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button disabled={loading} onClick={onConfirm}
                className={`flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#9B6FD1] hover:bg-[#8a5fc0]"}`}>
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoryRow({ cat, onDelete }: { cat: import("../context/CategoriesContext").Category; onDelete: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={cat} dragListener={false} dragControls={controls}
      className="px-6 py-4 flex items-center gap-3 bg-white border-b border-gray-50 last:border-0">
      <button onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-[#9B6FD1] transition-colors shrink-0" aria-label="Drag to reorder">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded-xl bg-[#F3EEFB] flex items-center justify-center shrink-0">
        <Tag className="w-4 h-4 text-[#9B6FD1]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{cat.label}</p>
        <p className="text-xs text-gray-400">slug: <span className="font-mono">{cat.name}</span></p>
      </div>
      <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete category">
        <Trash2 className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
}

// ── Storage helper ───────────────────────────────────────────
async function uploadToStorage(file: File, productName?: string): Promise<string> {
  const compressed = await compressToWebP(file, { name: productName });
  return uploadToR2(compressed, productName);
}

// ── Shiprocket inline result type ────────────────────────────
type SrResult = { orderId: number; shipmentId?: number; awb?: string; error?: string } | null;

// ── Main component ───────────────────────────────────────────
export function AdminPanel() {
  const [, navigate] = useLocation();
  const { products, addProduct, deleteProduct, updateStock, loading, error } = useProducts();
  const { categories, addCategory, deleteCategory, reorderCategories } = useCategories();
  const toast = useToast();

  // Tab
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "categories" | "post" | "report" | "label" | "settings">("products");

  // Add-product form
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const img = useImageItems(MAX_IMAGES);
  const [addFormVariants, setAddFormVariants] = useState<ProductVariant[]>([]);
  const [variantUploading, setVariantUploading] = useState<Record<string, boolean>>({});
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Product filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "sns-asc" | "sns-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc">("newest");

  // Product delete / edit
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [downloadingProductId, setDownloadingProductId] = useState<number | null>(null);

  // Category management
  const [catName, setCatName] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catParentId, setCatParentId] = useState<number | "">("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Shiprocket
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [srResult, setSrResult] = useState<SrResult>(null);

  // Settings
  const { codEnabled, setCodEnabled, loading: settingsLoading } = useSettings();

  // ── Auth guard ───────────────────────────────────────────────
  useEffect(() => { if (!sessionStorage.getItem("sns_admin")) navigate("/admin"); }, [navigate]);
  useEffect(() => { return () => img.clear(); }, []); // revoke blob URLs on unmount

  // Auto-select first category for add form
  useEffect(() => {
    if (categories.length > 0 && !form.category)
      setForm((prev) => ({ ...prev, category: categories[0].name }));
  }, [categories]);

  useEffect(() => { if (activeTab === "orders") fetchOrders(); }, [activeTab]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  // ── Filtered products ────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `sns-${p.id}` === searchQuery.toLowerCase().trim() ||
        String(p.id) === searchQuery.trim();
      const matchCat    = filterCategory === "all" || p.category === filterCategory;
      const matchStock  = filterStock === "all" || (() => {
        const totalStk = p.variants?.length
          ? p.stock + (p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0)
          : p.stock;
        return filterStock === "in" ? totalStk > 0 : totalStk === 0;
      })();
      return matchSearch && matchCat && matchStock;
    });
    const totalStk = (p: typeof products[number]) =>
      p.variants?.length ? p.stock + (p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0) : p.stock;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case "oldest":    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        case "sns-desc":  return b.id - a.id;
        case "sns-asc":   return a.id - b.id;
        case "price-asc": return a.price - b.price;
        case "price-desc":return b.price - a.price;
        case "stock-asc": return totalStk(a) - totalStk(b);
        case "stock-desc":return totalStk(b) - totalStk(a);
        default: return 0;
      }
    });
  }, [products, searchQuery, filterCategory, filterStock, sortBy]);

  // ── Admin product list pagination (10 per batch) ─────────────
  const BATCH_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Reset to first page whenever filters or sort change
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [searchQuery, filterCategory, filterStock, sortBy]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const statusMeta = (status?: OrderStatus) =>
    ORDER_STATUSES.find((s) => s.value === (status ?? "pending")) ?? ORDER_STATUSES[0];

  // ── Orders ───────────────────────────────────────────────────
  const fetchOrders = async () => {
    setOrdersLoading(true);
    const { data, error: err } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (!err && data) setOrders(data as OrderRow[]);
    setOrdersLoading(false);
  };

  const handleDeleteOrder = async () => {
    if (deleteOrderId === null) return;
    setDeletingOrder(true);
    const { error: err, count } = await supabase.from("orders").delete({ count: "exact" }).eq("id", deleteOrderId);
    if (err) toast.show(`Failed to delete order: ${err.message}`, "error");
    else if (count === 0) toast.show("Delete blocked by database policy. Check Supabase RLS settings.", "error");
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
        variantImage: i.product.image, // image is already set to variant image at checkout time
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
      toast.show("Order is missing customer details. Edit it first.", "error");
      return;
    }
    setPushingId(order.id);
    setSrResult(null);
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

  // ── Products ─────────────────────────────────────────────────
  const handleToggleStockDeduction = async (order: OrderRow) => {
    const deducting = !order.stock_deducted;

    // Adjust each product's stock: subtract on enable, add back on disable
    for (const item of order.items) {
      const delta = deducting ? -item.quantity : item.quantity;
      const product = products.find((p) => p.id === item.product.id);
      if (!product) continue;
      await updateStock(product.id, Math.max(0, product.stock + delta));
    }

    // Persist flag to Supabase
    await supabase.from("orders").update({ stock_deducted: deducting }).eq("id", order.id);
    setOrders((prev) =>
      prev.map((o) => o.id === order.id ? { ...o, stock_deducted: deducting } : o)
    );
    toast.show(deducting ? "Stock deducted from products." : "Stock restored to products.");
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price), originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;
    setSaving(true);
    img.setError("");
    let imageUrls: string[] = [];
    if (img.items.length > 0) {
      try {
        img.setUploading(true);
        imageUrls = await Promise.all(img.items.map((it) => uploadToStorage(it.file!, form.name.trim())));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        img.setError(msg.toLowerCase().includes("bucket")
          ? 'Storage bucket missing. Go to Supabase → Storage → New bucket → name it "product-images" → set to Public.'
          : msg);
        img.setUploading(false);
        setSaving(false);
        return;
      } finally { img.setUploading(false); }
    }
    if (!imageUrls.length) imageUrls = [`https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`];
    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    // base stock stored in product.stock; variant stocks live inside variants[]
    // effectiveStock used only for display — save base stock separately
    const baseStock = Math.max(0, Number(form.stock) || 0);
    const effectiveStock = addFormVariants.length > 0
      ? baseStock + addFormVariants.reduce((s, v) => s + v.stock, 0)
      : baseStock;
    const cleanedVariants: ProductVariant[] = addFormVariants.map((v) => ({
      ...v,
      id: v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: v.label.trim() || "Variant",
    }));
    try {
      await addProduct({
        name: form.name.trim(), category: form.category, price, originalPrice, discount,
        image: imageUrls[0], images: imageUrls, description: form.description.trim(),
        stock: baseStock,  // base stock only — variant stocks live in variants[]
        shipping_credit: Math.max(0, Number(form.shipping_credit) || 0),
        wholesale_price: Math.max(0, Number(form.wholesale_price) || 0),
        variants: cleanedVariants,
        base_variant_label: form.base_variant_label.trim() || undefined,
      });
      setForm({ ...EMPTY_FORM, category: categories[0]?.name ?? "" });
      setAddFormVariants([]);
      img.clear();
      toast.show("Product saved!");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to save product.", "error");
    } finally { setSaving(false); }
  };

  const handleDeleteProduct = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    const product   = products.find((p) => p.id === deleteId);
    const imageUrls = product?.images?.length ? product.images : product?.image ? [product.image] : [];
    await deleteProduct(deleteId, imageUrls);
    setDeleting(false);
    setDeleteId(null);
  };

  const handleDownloadProductImages = async (product: Product) => {
    const images = product.images?.length ? product.images : product.image ? [product.image] : [];
    if (!images.length) { toast.show("No images to download.", "error"); return; }
    setDownloadingProductId(product.id);
    try {
      const zip = new JSZip();
      const zipName = `SNS-${product.id}`;
      const folder = zip.folder(zipName)!;
      await Promise.all(
        images.map(async (url, idx) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch image ${idx + 1}`);
          const blob = await res.blob();
          const ext = url.split(".").pop()?.split("?")[0] || "jpg";
          folder.file(`${zipName}-${idx + 1}.${ext}`, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${zipName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Download failed.", "error");
    } finally {
      setDownloadingProductId(null);
    }
  };

  // ── Categories ───────────────────────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catLabel.trim()) return;
    setCatSaving(true); setCatError("");
    try {
      await addCategory(catName, catLabel, catParentId === "" ? null : catParentId);
      setCatName(""); setCatLabel(""); setCatParentId("");
      toast.show("Category added!");
    }
    catch (err) { setCatError(err instanceof Error ? err.message : "Failed to add category."); }
    setCatSaving(false);
  };

  const handleDeleteCategory = async () => {
    if (deleteCatId === null) return;
    setDeletingCat(true);
    try { await deleteCategory(deleteCatId); toast.show("Category deleted."); }
    catch (err) { toast.show(err instanceof Error ? err.message : "Delete failed.", "error"); }
    setDeletingCat(false);
    setDeleteCatId(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) img.add(e.dataTransfer.files);
  }, [img]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#9B6FD1] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif text-gray-900 font-semibold">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-gray-500 hover:text-[#9B6FD1] transition-colors">View Store</a>
            <button onClick={() => { sessionStorage.removeItem("sns_admin"); navigate("/admin"); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto overflow-x-auto scrollbar-none border-t border-gray-100">
          <div className="flex gap-1 px-4 min-w-max">
            {([["products", Package, "Products"], ["orders", ShoppingBag, "Orders"], ["categories", Tag, "Categories"], ["post", ImageIcon, "Post"], ["report", BarChart3, "Report"], ["label", Printer, "Label Print"], ["settings", Settings, "Settings"]] as const).map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab ? "border-[#9B6FD1] text-[#9B6FD1]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8">

        {/* ══ PRODUCTS TAB ══════════════════════════════════════ */}
        {activeTab === "products" && (
          <>
            {/* Add Product */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Add New Product</h2>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2"><label className="label">Product Name</label><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Gold Lotus Ring" className="input" /></div>
                  <div><label className="label">Category</label><div className="relative"><select value={form.category} onChange={(e) => set("category", e.target.value)} className="input appearance-none pr-8 capitalize">
                    {categories.filter(c => c.parent_id === null).map((parent) => {
                      const children = categories.filter(c => c.parent_id === parent.id);
                      return children.length > 0 ? (
                        <optgroup key={parent.id} label={parent.label}>
                          <option value={parent.name}>{parent.label} (All)</option>
                          {children.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
                        </optgroup>
                      ) : (
                        <option key={parent.name} value={parent.name} className="capitalize">{parent.label}</option>
                      );
                    })}
                  </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /></div></div>
                  <div><label className="label">Selling Price (₹)</label><input required type="number" min="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="799" className="input" /></div>
                  <div><label className="label">Original Price (₹)</label><input required type="number" min="1" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="1199" className="input" /></div>
                  <div className="sm:col-span-2">
                    <label className="label"><Image className="w-3.5 h-3.5 inline mr-1" />Product Images <span className="text-gray-400 font-normal normal-case ml-1">(up to {MAX_IMAGES} · first is cover · drag to reorder)</span></label>
                    {img.items.length > 0 ? (
                      <DraggableImageGrid items={img.items} onReorder={img.setItems} onRemove={img.remove}
                        onAddMore={img.items.length < MAX_IMAGES ? () => img.inputRef.current?.click() : undefined} maxImages={MAX_IMAGES} />
                    ) : (
                      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop} onClick={() => img.inputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"}`}>
                        <div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center"><Upload className="w-5 h-5 text-[#9B6FD1]" /></div>
                        <div className="text-center"><p className="text-sm font-medium text-gray-700">Drop images or <span className="text-[#9B6FD1]">browse</span></p><p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP · up to {MAX_IMAGES} images</p></div>
                      </div>
                    )}
                    <input ref={img.inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) img.add(e.target.files); }} />
                    {img.error && <p className="text-red-500 text-xs mt-1.5">{img.error}</p>}
                    {img.uploading && <p className="text-[#9B6FD1] text-xs mt-1.5 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />Uploading {img.items.length} image{img.items.length > 1 ? "s" : ""}…</p>}
                  </div>
                  <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe this product…" className="input resize-none" /></div>
                  {addFormVariants.length === 0 && (
                    <div><label className="label">Stock Quantity</label><input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className="input" /><p className="text-[11px] text-gray-400 mt-1">Set to 0 to mark as Out of Stock</p></div>
                  )}
                  <div><label className="label">Shipping Credit (₹)</label><input type="number" min="0" value={form.shipping_credit} onChange={(e) => set("shipping_credit", e.target.value)} className="input" /><p className="text-[11px] text-gray-400 mt-1">₹ deducted from shipping per unit in cart</p></div>
                  <div><label className="label">Wholesale Price (₹)</label><input type="number" min="0" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} className="input" /><p className="text-[11px] text-gray-400 mt-1">Your cost price — only visible in admin panel</p></div>

                  {/* ── Variants manager ── */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="label mb-0">Variants <span className="text-gray-400 font-normal normal-case">(colour / design)</span></label>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {addFormVariants.length === 0
                            ? "No variants — single product. Add variants for Gold/Silver etc."
                            : `${addFormVariants.length} variant${addFormVariants.length > 1 ? "s" : ""} · total stock ${addFormVariants.reduce((s, v) => s + v.stock, 0)}`}
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => setAddFormVariants((prev) => [...prev, { id: `var-${Date.now()}`, label: "", images: [], stock: 0 }])}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors shrink-0">
                        <Plus className="w-3.5 h-3.5" /> Add Variant
                      </button>
                    </div>
                    {/* Base variant label — only when variants exist */}
                    {addFormVariants.length > 0 && (
                      <div className="mb-3 p-3 rounded-xl bg-[#F3EEFB]/60 border border-[#9B6FD1]/20 space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Default option label</label>
                          <input
                            value={form.base_variant_label}
                            onChange={(e) => set("base_variant_label", e.target.value)}
                            placeholder="e.g. Gold, Default, Original"
                            className="input text-sm"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Names the option using the main product images. Leave blank to show "Default".</p>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Default option stock qty</label>
                          <input
                            type="number"
                            min="0"
                            value={form.stock}
                            onChange={(e) => set("stock", e.target.value)}
                            placeholder="0"
                            className="input text-sm"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Stock for the "{form.base_variant_label || "Default"}" option.</p>
                        </div>
                      </div>
                    )}
                    {addFormVariants.length > 0 && (
                      <div className="space-y-3">
                        {addFormVariants.map((v, idx) => (
                          <div key={v.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                            {/* Top row */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Color picker swatch */}
                              <div className="relative shrink-0" title="Pick swatch color">
                                <div
                                  className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-[#9B6FD1] transition-colors flex items-center justify-center"
                                  style={{ backgroundColor: v.color || "#e5e7eb" }}
                                  onClick={() => (document.getElementById(`acolor-${v.id}`) as HTMLInputElement)?.click()}
                                >
                                  {!v.color && <span className="text-[9px] text-gray-400 text-center leading-tight">Color</span>}
                                </div>
                                <input
                                  id={`acolor-${v.id}`}
                                  type="color"
                                  value={v.color || "#9B6FD1"}
                                  onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, color: e.target.value } : x))}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                              </div>
                              <input value={v.label}
                                onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                                placeholder="e.g. Gold, Silver"
                                className="flex-1 min-w-[100px] text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]" />
                              <div className="flex flex-col items-center shrink-0">
                                <span className="text-[10px] text-gray-400 mb-0.5">Stock</span>
                                <input type="number" min="0" value={v.stock}
                                  onChange={(e) => setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, stock: Math.max(0, Number(e.target.value) || 0) } : x))}
                                  className="w-16 text-sm px-2 py-2 rounded-xl border border-gray-200 text-center focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/20 focus:border-[#9B6FD1]" />
                              </div>
                              <button type="button" onClick={() => setAddFormVariants((prev) => prev.filter((_, i) => i !== idx))}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Multi-image upload row */}
                            <div>
                              <p className="text-[11px] text-gray-400 mb-1.5">
                                Photos for this variant <span className="text-gray-300">(first = cover · max 4)</span>
                              </p>
                              {(v.images?.length ?? 0) > 0 ? (
                                <DraggableImageGrid
                                  items={(v.images ?? []).map((url) => ({ id: url, preview: url, file: undefined }))}
                                  onReorder={(items) => {
                                    const urls = items.map((it) => it.preview);
                                    setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, images: urls } : x));
                                  }}
                                  onRemove={(id) => {
                                    const urls = (v.images ?? []).filter((url) => url !== id);
                                    setAddFormVariants((prev) => prev.map((x, i) => i === idx ? { ...x, images: urls } : x));
                                  }}
                                  onAddMore={(v.images?.length ?? 0) < 4 ? () => variantFileRefs.current[v.id]?.click() : undefined}
                                  maxImages={4}
                                  newBadge={false}
                                />
                              ) : (
                                <button type="button" onClick={() => variantFileRefs.current[v.id]?.click()}
                                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]/50 transition-colors text-xs text-gray-400 hover:text-[#9B6FD1]">
                                  <Plus className="w-3.5 h-3.5" /> Add photos
                                </button>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                ref={(el) => { variantFileRefs.current[v.id] = el; }}
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (!files?.length) return;
                                  setVariantUploading((prev) => ({ ...prev, [v.id]: true }));
                                  try {
                                    const newUrls = await Promise.all(
                                      Array.from(files).map((f) => uploadToStorage(f, form.name.trim() || "variant"))
                                    );
                                    setAddFormVariants((prev) => prev.map((x) =>
                                      x.id === v.id
                                        ? { ...x, images: [...(x.images ?? []), ...newUrls].slice(0, 4) }
                                        : x
                                    ));
                                  } catch { /* ignore */ }
                                  finally { setVariantUploading((prev) => ({ ...prev, [v.id]: false })); }
                                }}
                              />
                              {variantUploading[v.id] && (
                                <p className="text-[11px] text-[#9B6FD1] mt-1 flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />
                                  Uploading…
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                    {saving ? <><Spinner />{ img.uploading ? "Uploading…" : "Saving…"}</> : <><Plus className="w-4 h-4" />Add Product</>}
                  </button>
                </div>
              </form>
            </div>
            {/* Product List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">All Products</h2>
                <span className="ml-auto text-sm text-gray-400">
                  {filteredProducts.length !== products.length ? `${filteredProducts.length} of ${products.length}` : `${products.length} total`}
                </span>
              </div>

              {/* Filters */}
              {!loading && !error && products.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" placeholder="Search products…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] bg-gray-50" />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
                  </div>
                  <div className="relative">
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-gray-50 capitalize">
                      <option value="all">All Categories</option>
                      {categories.map((c) => <option key={c.name} value={c.name} className="capitalize">{c.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 text-xs">
                    {([["all", "All"], ["in", "In Stock"], ["out", "Out of Stock"]] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setFilterStock(val)}
                        className={`px-3 py-2 font-medium transition-colors ${filterStock === val ? "bg-[#9B6FD1] text-white" : "text-gray-500 hover:text-gray-700"}`}>{label}</button>
                    ))}
                  </div>
                  {(searchQuery || filterCategory !== "all" || filterStock !== "all") && (
                    <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStock("all"); }}
                      className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:text-red-600 rounded-xl border border-red-200 hover:bg-red-50 transition-colors">
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                  {/* Sort */}
                  <div className="relative ml-auto">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 bg-gray-50 font-medium text-gray-600"
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="sns-desc">SNS# High → Low</option>
                      <option value="sns-asc">SNS# Low → High</option>
                      <option value="price-desc">Price High → Low</option>
                      <option value="price-asc">Price Low → High</option>
                      <option value="stock-desc">Stock High → Low</option>
                      <option value="stock-asc">Stock Low → High</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2"><Spinner />Loading from Supabase…</div>
              ) : error ? (
                <div className="px-6 py-8 text-center"><p className="text-red-400 text-sm font-medium">Could not load products</p><p className="text-gray-400 text-xs mt-1">{error}</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                      <SlidersHorizontal className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 text-sm">{products.length === 0 ? "No products yet. Add one above." : "No products match your filters."}</p>
                      {products.length > 0 && <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStock("all"); }} className="text-xs text-[#9B6FD1] hover:underline mt-1">Clear filters</button>}
                    </div>
                  )}
                  {visibleProducts.map((p) => (
                    <div key={p.id} className="px-4 py-4 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          <img
                            src={imgUrl(p.images?.[0] ?? p.image, "tiny")}
                            alt={p.name}
                            onClick={() => setPreviewImg(imgUrl(p.images?.[0] ?? p.image, "full"))}
                            className="w-20 h-20 rounded-xl object-cover bg-[#F3EEFB] border border-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                            <span className="text-[10px] font-mono font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">SNS-{p.id}</span>
                          </div>
                          <p className="text-xs text-gray-400 capitalize">{p.category} · ₹{p.price}{p.images?.length > 1 && <span className="ml-1 text-[#9B6FD1]">· {p.images.length} photos</span>}</p>
                          {p.wholesale_price > 0 && (() => {
                            const margin = p.price - p.wholesale_price - (p.shipping_credit ?? 0);
                            const pct = Math.round((margin / p.price) * 100);
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">Cost ₹{p.wholesale_price}</span>
                                {p.shipping_credit > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500">Ship Credit ₹{p.shipping_credit}</span>}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${margin >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>Margin ₹{margin} ({pct}%)</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleDownloadProductImages(p)} disabled={downloadingProductId === p.id} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Download images">
                            {downloadingProductId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditProduct(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const variantStock = (p.variants ?? []).reduce((s, v) => s + v.stock, 0);
                          const totalStk = p.variants?.length ? p.stock + variantStock : p.stock;
                          return (
                            <>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${totalStk === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                                {totalStk === 0 ? "OUT OF STOCK" : `${totalStk} in stock`}
                              </span>
                              {p.variants?.length ? (
                                <span className="text-[10px] text-gray-400">
                                  {p.stock} base + {variantStock} variants
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                                  <button type="button" onClick={() => updateStock(p.id, p.stock - 1)} disabled={p.stock === 0} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] disabled:opacity-30 transition-colors"><Minus className="w-3 h-3" /></button>
                                  <span className="text-sm font-semibold text-gray-700 w-8 text-center">{p.stock}</span>
                                  <button type="button" onClick={() => updateStock(p.id, p.stock + 1)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] transition-colors"><Plus className="w-3 h-3" /></button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                  {/* Load More — batch pagination */}
                  {hasMore && (
                    <div className="px-4 py-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-400">
                        Showing {visibleProducts.length} of {filteredProducts.length} products
                      </span>
                      <button
                        onClick={() => setVisibleCount((c) => c + BATCH_SIZE)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#9B6FD1] bg-[#F3EEFB] hover:bg-[#9B6FD1] hover:text-white rounded-xl transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Load {Math.min(BATCH_SIZE, filteredProducts.length - visibleCount)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ ORDERS TAB ════════════════════════════════════════ */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Placed Orders</h2>
                <span className="text-sm text-gray-400">{orders.length} total</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={fetchOrders} className="text-xs text-[#9B6FD1] hover:underline px-2 py-1">Refresh</button>
                <button
                  onClick={() => setQuickAddOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 text-[#9B6FD1] text-xs font-semibold rounded-xl border border-[#9B6FD1]/40 transition-colors"
                >
                  <Zap className="w-3 h-3" /> Quick Add
                </button>
                <button
                  onClick={() => setAddOrderOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Order
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2"><Spinner />Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-[#F3EEFB] flex items-center justify-center"><FileText className="w-7 h-7 text-[#9B6FD1]" /></div>
                <p className="text-gray-500 font-medium">No orders yet</p>
                <p className="text-gray-400 text-sm">Orders will appear here when customers checkout via WhatsApp.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const sm = statusMeta(order.status);
                  return (
                    <div key={order.id} className="px-4 py-4">
                      {/* Top row: order meta + grand total */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-full">#{order.id}</span>
                          <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${order.payment_mode === "cod" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                            {order.payment_mode === "cod" ? "COD" : "Online"}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${sm.color}`}>{sm.label}</span>
                        </div>
                        <p className="text-base font-bold font-serif text-gray-900 shrink-0">₹{order.grand_total}</p>
                      </div>

                      {/* Action buttons row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {order.sr_order_id && (
                          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                            SR #{order.sr_order_id}
                          </span>
                        )}
                        <button onClick={() => handleDownloadPDF(order)} disabled={downloadingId === order.id} title="Download PDF"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60">
                          {downloadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                        </button>
                        <button onClick={() => handlePushToShiprocket(order)}
                          disabled={pushingId === order.id || !!order.sr_order_id}
                          title={order.sr_order_id ? `Already pushed — SR #${order.sr_order_id}` : "Push to Shiprocket"}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${order.sr_order_id ? "bg-orange-300" : "bg-orange-500 hover:bg-orange-600"}`}>
                          {pushingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                          {order.sr_order_id ? "Shipped" : "Ship"}
                        </button>
                        <button onClick={() => setEditOrder(order)} title="Edit order"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors border border-gray-200">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteOrderId(order.id)} title="Delete order"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Items */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-2 py-1">
                            <img src={imgUrl(item.product.image, "tiny")} alt={item.product.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                            <span className="text-xs text-gray-700 font-medium max-w-[100px] truncate">{item.product.name}</span>
                            <span className="text-xs text-gray-400">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Customer + totals */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                        {order.customer_name && <span className="w-full text-gray-700 font-medium">{order.customer_name} · {order.customer_mobile}</span>}
                        {order.customer_address && <span className="w-full text-gray-500">{order.customer_address}, {order.customer_city}, {order.customer_state} — {order.pincode}</span>}
                        <span>Subtotal: <strong className="text-gray-700">₹{order.subtotal}</strong></span>
                        {order.shipping_charge > 0 && <span>Shipping: <strong className="text-gray-700">₹{order.shipping_charge}</strong></span>}
                        {order.cod_charge > 0 && <span>COD: <strong className="text-gray-700">₹{order.cod_charge}</strong></span>}
                      </div>

                      {/* Profit row */}
                      {order.items.some((i) => (i.product.wholesale_price ?? 0) > 0) && (() => {
                        const wholesaleCost  = order.items.reduce((s, i) => s + (i.product.wholesale_price ?? 0) * i.quantity, 0);
                        const shipCreditCost = order.items.reduce((s, i) => s + (i.product.shipping_credit ?? 0) * i.quantity, 0);
                        const itemsCost      = wholesaleCost + shipCreditCost;
                        const shippingCost   = order.shipping_charge ?? 0;
                        const codCost        = order.payment_mode === "cod" ? (order.cod_charge ?? 0) : 0;
                        const cost           = itemsCost + shippingCost + codCost;
                        const profit         = order.grand_total - cost;
                        const pct            = order.grand_total > 0 ? Math.round((profit / order.grand_total) * 100) : 0;
                        return (
                          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl text-xs font-semibold mb-2 ${profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                            <span>Est. Profit:</span>
                            <span className="font-bold">₹{profit}</span>
                            <span className="font-normal opacity-70">({pct}%)</span>
                            <span className="ml-auto font-normal opacity-60 text-[10px] flex flex-wrap gap-x-2">
                              <span>Wholesale ₹{wholesaleCost}</span>
                              {shipCreditCost > 0 && <span>+ Ship Credit ₹{shipCreditCost}</span>}
                              <span className="font-semibold">= ₹{itemsCost}</span>
                              <span>+ Courier ₹{shippingCost}</span>
                              {codCost > 0 && <span>+ COD ₹{codCost}</span>}
                              <span className="font-semibold">= Total Cost ₹{cost}</span>
                            </span>
                          </div>
                        );
                      })()}

                      {/* Stock deduction toggle */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                        <span className="text-gray-600 font-medium">Deduct stock from products</span>
                        <button
                          onClick={() => handleToggleStockDeduction(order)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${order.stock_deducted ? "bg-emerald-500" : "bg-gray-300"}`}
                          role="switch" aria-checked={!!order.stock_deducted}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${order.stock_deducted ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>

                      {/* Shiprocket result panel */}
                      {srResult?.orderId === order.id && (
                        <div className={`mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs ${srResult.error ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                          {srResult.error ? (
                            <><X className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Shiprocket push failed</p><p className="mt-0.5 opacity-80 break-all">{srResult.error}</p></div></>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><div><p className="font-semibold">Order pushed to Shiprocket!</p>{srResult.shipmentId && <p className="mt-0.5">Shipment ID: <strong>{srResult.shipmentId}</strong></p>}{srResult.awb && <p>AWB: <strong>{srResult.awb}</strong></p>}</div></>
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
        )}

        {/* ══ CATEGORIES TAB ════════════════════════════════════ */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9B6FD1]" /><h2 className="font-semibold text-gray-800">Add New Category</h2>
              </div>
              <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Parent selector — leave blank for top-level */}
                  <div className="sm:col-span-2">
                    <label className="label">Type</label>
                    <div className="relative">
                      <select
                        value={catParentId}
                        onChange={(e) => setCatParentId(e.target.value === "" ? "" : Number(e.target.value))}
                        className="input appearance-none pr-8"
                      >
                        <option value="">Top-level category (e.g. Earrings, Rings)</option>
                        {categories.filter((c) => c.parent_id === null).map((c) => (
                          <option key={c.id} value={c.id}>Subcategory under: {c.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {catParentId === "" ? "Creates a main filter tab on the storefront." : "Creates a sub-filter under the selected category."}
                    </p>
                  </div>
                  <div>
                    <label className="label">Slug (internal name)</label>
                    <input required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={catParentId === "" ? "e.g. earrings" : "e.g. stud-earrings"} className="input" />
                    <p className="text-[11px] text-gray-400 mt-1">Lowercase, no spaces — used for filtering</p>
                  </div>
                  <div>
                    <label className="label">Display Label</label>
                    <input required value={catLabel} onChange={(e) => setCatLabel(e.target.value)} placeholder={catParentId === "" ? "e.g. Earrings" : "e.g. Stud Earrings"} className="input" />
                    <p className="text-[11px] text-gray-400 mt-1">Shown to customers on the storefront</p>
                  </div>
                </div>
                {catError && <p className="text-red-500 text-xs">{catError}</p>}
                <div className="flex justify-end">
                  <button type="submit" disabled={catSaving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                    {catSaving ? <><Spinner />Saving…</> : <><Plus className="w-4 h-4" />{catParentId === "" ? "Add Category" : "Add Subcategory"}</>}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#9B6FD1]" /><h2 className="font-semibold text-gray-800">All Categories</h2>
                <span className="ml-auto text-sm text-gray-400">{categories.length} total</span>
              </div>
              {categories.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No categories yet. Add one above.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {/* Top-level categories with their subcategories nested */}
                  {categories.filter((c) => c.parent_id === null).map((parent) => {
                    const children = categories.filter((c) => c.parent_id === parent.id);
                    return (
                      <div key={parent.id}>
                        {/* Parent row */}
                        <div className="px-6 py-3.5 flex items-center gap-3 bg-white">
                          <div className="w-9 h-9 rounded-xl bg-[#F3EEFB] flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4 text-[#9B6FD1]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm">{parent.label}</p>
                            <p className="text-xs text-gray-400">slug: <span className="font-mono">{parent.name}</span>
                              {children.length > 0 && <span className="ml-2 text-[#9B6FD1]">· {children.length} sub</span>}
                            </p>
                          </div>
                          <button onClick={() => setDeleteCatId(parent.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Subcategory rows — indented */}
                        {children.map((child) => (
                          <div key={child.id} className="pl-10 pr-6 py-2.5 flex items-center gap-3 bg-gray-50/60 border-t border-gray-50">
                            <div className="w-1 h-1 rounded-full bg-[#9B6FD1]/40 shrink-0 ml-2 mr-1" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700">{child.label}</p>
                              <p className="text-xs text-gray-400 font-mono">{child.name}</p>
                            </div>
                            <button onClick={() => setDeleteCatId(child.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {/* Add subcategory shortcut */}
                        <div className="pl-12 pr-6 pb-2">
                          <button
                            onClick={() => { setCatParentId(parent.id); setCatName(""); setCatLabel(""); document.querySelector<HTMLElement>(".categories-form")?.scrollIntoView({ behavior: "smooth" }); }}
                            className="text-[11px] text-[#9B6FD1] hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add subcategory under {parent.label}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Orphaned subcategories (parent deleted) */}
                  {categories.filter((c) => c.parent_id !== null && !categories.find((p) => p.id === c.parent_id)).map((c) => (
                    <div key={c.id} className="px-6 py-3 flex items-center gap-3 bg-amber-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{c.label} <span className="text-[10px] text-amber-500 ml-1">orphaned</span></p>
                        <p className="text-xs text-gray-400 font-mono">{c.name}</p>
                      </div>
                      <button onClick={() => setDeleteCatId(c.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ POST EDITOR TAB ═══════════════════════════════════ */}
        {activeTab === "post" && <PostEditor />}

        {/* ══ REPORT TAB ════════════════════════════════════════ */}
        {activeTab === "report" && <ReportTab />}

        {/* ══ LABEL PRINT TAB ═══════════════════════════════════ */}
        {activeTab === "label" && <ShiprocketPDFPrinter />}

        {/* ══ SETTINGS TAB ══════════════════════════════════════ */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#9B6FD1]" />
              <h2 className="font-semibold text-gray-800">Store Settings</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* COD toggle */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Cash on Delivery (COD)</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {codEnabled
                      ? "COD is enabled — customers can choose Online or COD at checkout."
                      : "COD is disabled — customers can only pay online at checkout."}
                  </p>
                </div>
                <button
                  disabled={settingsLoading}
                  onClick={() => setCodEnabled(!codEnabled)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${codEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                  role="switch"
                  aria-checked={codEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${codEnabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Changes take effect immediately for all customers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODALS ════════════════════════════════════════════════ */}

      {/* Image Lightbox */}
      <AnimatePresence>
        {previewImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}
          >
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              src={previewImg}
              alt="Product preview"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Product */}
      <EditProductModal
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSaved={(msg) => toast.show(msg)}
        onError={(msg) => toast.show(msg, "error")}
      />

      {/* Quick Add Order */}
      <QuickAddOrderModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={(order) => {
          setOrders((prev) => [order, ...prev]);
          toast.show("Order created!");
        }}
        onError={(msg) => toast.show(msg, "error")}
      />

      {/* Add Order */}
      <AddOrderModal
        open={addOrderOpen}
        onClose={() => setAddOrderOpen(false)}
        onCreated={(order) => {
          setOrders((prev) => [order, ...prev]);
          toast.show("Order created!");
        }}
        onError={(msg) => toast.show(msg, "error")}
      />

      {/* Edit Order */}
      <EditOrderModal
        order={editOrder}
        onClose={() => setEditOrder(null)}
        onSaved={(patch) => {
          setOrders((prev) => prev.map((o) => o.id === editOrder?.id ? { ...o, ...patch } : o));
          toast.show("Order updated!");
        }}
        onError={(msg) => toast.show(msg, "error")}
      />

      {/* Delete Product */}
      <ConfirmModal
        open={deleteId !== null}
        title="Delete product?"
        body="This will remove it from Supabase and the store."
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />

      {/* Delete Order */}
      <ConfirmModal
        open={deleteOrderId !== null}
        title={`Delete order #${deleteOrderId}?`}
        body="This will permanently remove the order from Supabase. This cannot be undone."
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteOrderId(null)}
        loading={deletingOrder}
      />

      {/* Delete Category */}
      <ConfirmModal
        open={deleteCatId !== null}
        title="Delete category?"
        body="Existing products in this category won't be deleted, but they'll no longer appear under a filter tab."
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCatId(null)}
        loading={deletingCat}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast.message && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${toast.type === "error" ? "bg-red-500" : "bg-green-600"}`}>
            {toast.type === "error" ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
        .input { width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.875rem; color: #1f2937; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: white; }
        .input:focus { border-color: #9B6FD1; box-shadow: 0 0 0 3px rgba(155,111,209,0.15); }
      `}</style>
    </div>
  );
}
