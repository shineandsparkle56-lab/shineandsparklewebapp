import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Plus, Trash2, LogOut, Package, Sparkles,
  ChevronDown, CheckCircle2, Upload, X, Image,
  ShoppingBag, Download, FileText, Loader2, Minus, Pencil, Tag, GripVertical,
  Search, SlidersHorizontal,
} from "lucide-react";
import { useProducts } from "../context/ProductsContext";
import { useCategories } from "../context/CategoriesContext";
import { Product } from "../data/products";
import { supabase } from "../lib/supabase";
import { generateOrderPDF } from "../utils/generateOrderPDF";
import type { OrderMeta } from "../utils/generateOrderPDF";
import type { CartItem } from "../context/CartContext";
import { DraggableImageGrid, ImageItem } from "../components/ui/DraggableImageGrid";

const BUCKET = "product-images";
const MAX_IMAGES = 6;
const empty = { name: "", category: "", price: "", originalPrice: "", description: "", stock: "10", shipping_credit: "0", wholesale_price: "0" };

type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending",   label: "Pending",   color: "bg-yellow-100 text-yellow-700" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { value: "shipped",   label: "Shipped",   color: "bg-purple-100 text-purple-700" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-600" },
];

// ── Order type ───────────────────────────────────────────────
interface OrderRow {
  id: number;
  items: { product: { id: number; name: string; category: string; price: number; image: string; images: string[] }; quantity: number }[];
  subtotal: number;
  shipping_charge: number;
  cod_charge: number;
  grand_total: number;
  pincode: string;
  payment_mode: string;
  status?: OrderStatus;
  customer_name?: string;
  customer_mobile?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  created_at: string;
}

interface EditOrderForm {
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  pincode: string;
  payment_mode: string;
  status: OrderStatus;
  subtotal: string;
  shipping_charge: string;
  cod_charge: string;
}

// ── Draggable category row ────────────────────────────────────
function CategoryRow({ cat, onDelete }: { cat: import("../context/CategoriesContext").Category; onDelete: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={controls}
      className="px-6 py-4 flex items-center gap-3 bg-white border-b border-gray-50 last:border-0"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-[#9B6FD1] transition-colors shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-9 h-9 rounded-xl bg-[#F3EEFB] flex items-center justify-center shrink-0">
        <Tag className="w-4 h-4 text-[#9B6FD1]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{cat.label}</p>
        <p className="text-xs text-gray-400">slug: <span className="font-mono">{cat.name}</span></p>
      </div>
      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        title="Delete category"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
}

export function AdminPanel() {
  const [, navigate] = useLocation();
  const { products, addProduct, updateProduct, deleteProduct, updateStock, loading, error } = useProducts();
  const { categories, addCategory, deleteCategory, reorderCategories } = useCategories();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "categories">("products");
  const [form, setForm] = useState(empty);

  // ── Product list filters ──────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === "all" || p.category === filterCategory;
      const matchStock = filterStock === "all" || (filterStock === "in" ? p.stock > 0 : p.stock === 0);
      return matchSearch && matchCat && matchStock;
    });
  }, [products, searchQuery, filterCategory, filterStock]);

  // Category management state
  const [catName, setCatName] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);

  // Multi-image state (Add form) — single array keeps files + previews in sync
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Order delete state
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  // Order edit state
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [editOrderForm, setEditOrderForm] = useState<EditOrderForm | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Product edit state
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState(empty);
  // Edit modal images: merged array of existing URLs + new File items
  const [editImageItems, setEditImageItems] = useState<ImageItem[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editUploadError, setEditUploadError] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!sessionStorage.getItem("sns_admin")) navigate("/admin"); }, [navigate]);
  useEffect(() => { return () => { imageItems.forEach((it) => URL.revokeObjectURL(it.preview)); }; }, []);

  // Auto-select first category when categories load
  useEffect(() => {
    if (categories.length > 0 && !form.category) {
      setForm((prev) => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  useEffect(() => {
    if (activeTab === "orders") fetchOrders();
  }, [activeTab]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(""), 3500);
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setOrders(data as OrderRow[]);
    setOrdersLoading(false);
  };

  // ── Order handlers ───────────────────────────────────────────
  const handleDeleteOrder = async () => {
    if (deleteOrderId === null) return;
    setDeletingOrder(true);

    const { error, count } = await supabase
      .from("orders")
      .delete({ count: "exact" })
      .eq("id", deleteOrderId);

    if (error) {
      console.error("Delete order error:", error);
      showToast(`Failed to delete order: ${error.message}`, "error");
    } else if (count === 0) {
      // RLS blocked the delete — row still exists in DB
      console.warn("Delete returned no rows affected. Check RLS policy on orders table.");
      showToast("Delete blocked by database policy. Check Supabase RLS settings.", "error");
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== deleteOrderId));
      showToast("Order deleted.");
    }
    setDeletingOrder(false);
    setDeleteOrderId(null);
  };

  const openEditOrder = (order: OrderRow) => {
    setEditOrder(order);
    setEditOrderForm({
      customer_name:    order.customer_name    ?? "",
      customer_mobile:  order.customer_mobile  ?? "",
      customer_address: order.customer_address ?? "",
      customer_city:    order.customer_city    ?? "",
      customer_state:   order.customer_state   ?? "",
      pincode:          order.pincode          ?? "",
      payment_mode:     order.payment_mode     ?? "prepaid",
      status:           order.status           ?? "pending",
      subtotal:         String(order.subtotal),
      shipping_charge:  String(order.shipping_charge),
      cod_charge:       String(order.cod_charge),
    });
  };

  const closeEditOrder = () => {
    setEditOrder(null);
    setEditOrderForm(null);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder || !editOrderForm) return;
    setSavingOrder(true);

    const subtotal       = Number(editOrderForm.subtotal)       || 0;
    const shipping_charge = Number(editOrderForm.shipping_charge) || 0;
    const cod_charge      = Number(editOrderForm.cod_charge)      || 0;
    const grand_total     = subtotal + shipping_charge + (editOrderForm.payment_mode === "cod" ? cod_charge : 0);

    const patch = {
      customer_name:    editOrderForm.customer_name.trim(),
      customer_mobile:  editOrderForm.customer_mobile.trim(),
      customer_address: editOrderForm.customer_address.trim(),
      customer_city:    editOrderForm.customer_city.trim(),
      customer_state:   editOrderForm.customer_state.trim(),
      pincode:          editOrderForm.pincode.trim(),
      payment_mode:     editOrderForm.payment_mode,
      subtotal,
      shipping_charge,
      cod_charge,
      grand_total,
    };

    // Try saving with status first; if the column doesn't exist yet, retry without it
    let { error, count } = await supabase.from("orders").update({ ...patch, status: editOrderForm.status }, { count: "exact" }).eq("id", editOrder.id);
    if (error?.message?.includes("status")) {
      console.warn("'status' column missing in orders table — saving without it. Run: ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';");
      ({ error, count } = await supabase.from("orders").update(patch, { count: "exact" }).eq("id", editOrder.id));
    }
    if (error) {
      console.error("Update order error:", error);
      showToast(`Failed to save order: ${error.message}`, "error");
    } else if (count === 0) {
      console.warn("Update matched 0 rows — RLS may be blocking UPDATE on orders table.");
      showToast("Update blocked by database policy. Add an UPDATE policy on the orders table in Supabase.", "error");
    } else {
      setOrders((prev) =>
        prev.map((o) => o.id === editOrder.id ? { ...o, ...patch, status: editOrderForm.status } : o)
      );
      showToast("Order updated!");
      closeEditOrder();
    }
    setSavingOrder(false);
  };

  const setOF = (k: keyof EditOrderForm, v: string) =>
    setEditOrderForm((prev) => prev ? { ...prev, [k]: v } : prev);

  const handleDownloadPDF = async (order: OrderRow) => {
    setDownloadingId(order.id);
    try {
      const cartItems: CartItem[] = order.items.map((i) => ({
        product: {
          id: i.product.id,
          name: i.product.name,
          category: i.product.category as Product["category"],
          price: i.product.price,
          originalPrice: i.product.price,
          discount: 0,
          image: i.product.image,
          images: i.product.images ?? [i.product.image],
          description: "",
          stock: 99,
          shipping_credit: 0,
          wholesale_price: 0,
        },
        quantity: i.quantity,
      }));
      const meta: OrderMeta = {
        customerName:    order.customer_name,
        customerMobile:  order.customer_mobile,
        customerAddress: order.customer_address,
        customerCity:    order.customer_city,
        customerState:   order.customer_state,
        pincode:         order.pincode,
        paymentMode:     order.payment_mode,
        shippingCharge:  order.shipping_charge,
        codCharge:       order.cod_charge,
        grandTotal:      order.grand_total,
      };
      const blob = await generateOrderPDF(cartItems, order.subtotal, meta);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Order_${order.id}_${new Date(order.created_at).toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Category handlers ────────────────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catLabel.trim()) return;
    setCatSaving(true); setCatError("");
    try {
      await addCategory(catName, catLabel);
      setCatName(""); setCatLabel("");
      showToast("Category added!");
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : "Failed to add category.");
    }
    setCatSaving(false);
  };

  const handleDeleteCategory = async () => {
    if (deleteCatId === null) return;
    setDeletingCat(true);
    try {
      await deleteCategory(deleteCatId);
      showToast("Category deleted.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed.", "error");
    }
    setDeletingCat(false);
    setDeleteCatId(null);
  };

  // ── Image helpers (Add form) ─────────────────────────────────
  const addFiles = useCallback((incoming: FileList | File[]) => {
    setUploadError("");
    const arr = Array.from(incoming);
    const slots = MAX_IMAGES - imageItems.length;
    if (slots <= 0) { setUploadError(`Max ${MAX_IMAGES} images allowed.`); return; }
    const newItems: ImageItem[] = [];
    for (const file of arr.slice(0, slots)) {
      if (!file.type.startsWith("image/")) { setUploadError("Only image files are supported."); continue; }
      const preview = URL.createObjectURL(file);
      newItems.push({ id: preview, preview, file });
    }
    setImageItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [imageItems.length]);

  const removeImage = useCallback((id: string) => {
    setImageItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const clearImages = useCallback(() => {
    setImageItems((prev) => { prev.forEach((it) => URL.revokeObjectURL(it.preview)); return []; });
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const uploadToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price); const originalPrice = Number(form.originalPrice);
    if (!price || !originalPrice) return;
    setSaving(true); setUploadError("");
    let imageUrls: string[] = [];
    if (imageItems.length > 0) {
      try {
        setUploading(true);
        // Upload in display order so sequence is preserved
        imageUrls = await Promise.all(imageItems.map((it) => uploadToStorage(it.file!)));
        setUploading(false);
      } catch (err: unknown) {
        setUploading(false); setSaving(false);
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setUploadError(msg.toLowerCase().includes("bucket") ? 'Storage bucket missing. Go to Supabase → Storage → New bucket → name it "product-images" → set to Public.' : msg);
        return;
      }
    }
    if (imageUrls.length === 0) imageUrls = [`https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(form.name)}`];
    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    try {
      await addProduct({ name: form.name.trim(), category: form.category, price, originalPrice, discount, image: imageUrls[0], images: imageUrls, description: form.description.trim(), stock: Math.max(0, Number(form.stock) || 0), shipping_credit: Math.max(0, Number(form.shipping_credit) || 0), wholesale_price: Math.max(0, Number(form.wholesale_price) || 0) });
      setSaving(false); setForm({ ...empty, category: categories[0]?.name ?? "" }); clearImages();
      showToast("Product saved!");
    } catch (err: unknown) {
      setSaving(false);
      showToast(err instanceof Error ? err.message : "Failed to save product.", "error");
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, category: p.category, price: String(p.price), originalPrice: String(p.originalPrice), description: p.description, stock: String(p.stock), shipping_credit: String(p.shipping_credit ?? 0), wholesale_price: String(p.wholesale_price ?? 0) });
    // Build unified ImageItem array from existing URLs (no File attached)
    const existingUrls = p.images?.length ? p.images : [p.image];
    setEditImageItems(existingUrls.map((url) => ({ id: url, preview: url, file: undefined })));
    setEditUploadError("");
  };

  const closeEdit = () => {
    setEditProduct(null);
    // Revoke only blob URLs (new uploads), not existing Supabase URLs
    setEditImageItems((prev) => { prev.filter((it) => it.file).forEach((it) => URL.revokeObjectURL(it.preview)); return []; });
  };

  const addEditFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const slots = MAX_IMAGES - editImageItems.length;
    if (slots <= 0) { setEditUploadError(`Max ${MAX_IMAGES} images.`); return; }
    const newItems: ImageItem[] = [];
    for (const file of arr.slice(0, slots)) {
      if (!file.type.startsWith("image/")) continue;
      const preview = URL.createObjectURL(file);
      newItems.push({ id: preview, preview, file });
    }
    setEditImageItems((prev) => [...prev, ...newItems]);
    if (editFileRef.current) editFileRef.current.value = "";
  };

  const removeEditImage = (id: string) => {
    setEditImageItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item?.file) URL.revokeObjectURL(item.preview); // only revoke blob URLs
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    const price = Number(editForm.price); const originalPrice = Number(editForm.originalPrice);
    if (!price || !originalPrice) return;
    setEditSaving(true); setEditUploadError("");

    // Upload new files (items that have a File attached), keep existing URLs as-is
    let finalImages: string[];
    try {
      finalImages = await Promise.all(
        editImageItems.map((it) => it.file ? uploadToStorage(it.file) : Promise.resolve(it.preview))
      );
    } catch (err: unknown) {
      setEditSaving(false);
      setEditUploadError(err instanceof Error ? err.message : "Upload failed.");
      return;
    }

    if (finalImages.length === 0) finalImages.push(`https://placehold.co/400x400/F3EEFB/9B6FD1?text=${encodeURIComponent(editForm.name)}`);
    const discount = Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
    try {
      await updateProduct(editProduct.id, { name: editForm.name.trim(), category: editForm.category, price, originalPrice, discount, image: finalImages[0], images: finalImages, description: editForm.description.trim(), stock: Math.max(0, Number(editForm.stock) || 0), shipping_credit: Math.max(0, Number(editForm.shipping_credit) || 0), wholesale_price: Math.max(0, Number(editForm.wholesale_price) || 0) });
      setEditSaving(false); closeEdit();
      showToast("Product updated!");
    } catch (err: unknown) {
      setEditSaving(false);
      showToast(err instanceof Error ? err.message : "Failed to save product.", "error");
    }
  };

  const setE = (k: keyof typeof empty, v: string) => setEditForm((prev) => ({ ...prev, [k]: v }));
  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    const product = products.find((p) => p.id === deleteId);
    const imageUrls = product?.images?.length ? product.images : product?.image ? [product.image] : [];
    await deleteProduct(deleteId, imageUrls);
    setDeleting(false);
    setDeleteId(null);
  };
  const set = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };

  const statusMeta = (status?: OrderStatus) =>
    ORDER_STATUSES.find((s) => s.value === (status ?? "pending")) ?? ORDER_STATUSES[0];

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
            <button onClick={() => { sessionStorage.removeItem("sns_admin"); navigate("/admin"); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 border-t border-gray-100">
          {([["products", Package, "Products"], ["orders", ShoppingBag, "Orders"], ["categories", Tag, "Categories"]] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-[#9B6FD1] text-[#9B6FD1]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {activeTab === "products" && (
          <>
            {/* Add Product Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Add New Product</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2"><label className="label">Product Name</label><input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Gold Lotus Ring" className="input" /></div>
                  <div><label className="label">Category</label><div className="relative"><select value={form.category} onChange={(e) => set("category", e.target.value)} className="input appearance-none pr-8 capitalize">{categories.map((c) => <option key={c.name} value={c.name} className="capitalize">{c.label}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /></div></div>
                  <div><label className="label">Selling Price (₹)</label><input required type="number" min="1" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="799" className="input" /></div>
                  <div><label className="label">Original Price (₹)</label><input required type="number" min="1" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="1199" className="input" /></div>
                  <div className="sm:col-span-2">
                    <label className="label"><Image className="w-3.5 h-3.5 inline mr-1" /> Product Images <span className="text-gray-400 font-normal normal-case ml-1">(up to {MAX_IMAGES} · first is cover · drag to reorder)</span></label>
                    {imageItems.length > 0 && (
                      <div className="mb-3">
                        <DraggableImageGrid
                          items={imageItems}
                          onReorder={setImageItems}
                          onRemove={removeImage}
                          onAddMore={imageItems.length < MAX_IMAGES ? () => fileInputRef.current?.click() : undefined}
                          maxImages={MAX_IMAGES}
                        />
                      </div>
                    )}
                    {imageItems.length === 0 && (<div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragOver ? "border-[#9B6FD1] bg-[#F3EEFB]" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1] hover:bg-[#F3EEFB]"}`}><div className="w-10 h-10 rounded-xl bg-[#9B6FD1]/10 flex items-center justify-center"><Upload className="w-5 h-5 text-[#9B6FD1]" /></div><div className="text-center"><p className="text-sm font-medium text-gray-700">Drop images or <span className="text-[#9B6FD1]">browse</span></p><p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP · up to {MAX_IMAGES} images</p></div></div>)}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
                    {uploadError && <p className="text-red-500 text-xs mt-1.5">{uploadError}</p>}
                    {uploading && <p className="text-[#9B6FD1] text-xs mt-1.5 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin inline-block" />Uploading {imageItems.length} image{imageItems.length > 1 ? "s" : ""}…</p>}
                  </div>
                  <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe this product…" className="input resize-none" /></div>
                  <div><label className="label">Stock Quantity</label><input required type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="10" className="input" /><p className="text-[11px] text-gray-400 mt-1">Set to 0 to mark as Out of Stock</p></div>
                  <div><label className="label">Shipping Credit (₹)</label><input type="number" min="0" value={form.shipping_credit} onChange={(e) => set("shipping_credit", e.target.value)} placeholder="0" className="input" /><p className="text-[11px] text-gray-400 mt-1">₹ deducted from shipping when this product is in cart</p></div>
                  <div><label className="label">Wholesale Price (₹)</label><input type="number" min="0" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} placeholder="0" className="input" /><p className="text-[11px] text-gray-400 mt-1">Your cost price — only visible in admin panel</p></div>
                </div>
                <div className="flex justify-end pt-1"><button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">{saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{uploading ? "Uploading…" : "Saving…"}</> : <><Plus className="w-4 h-4" />Add Product</>}</button></div>
              </form>
            </div>

            {/* Product list */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* List header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">All Products</h2>
                <span className="ml-auto text-sm text-gray-400">
                  {filteredProducts.length !== products.length
                    ? `${filteredProducts.length} of ${products.length}`
                    : `${products.length} total`}
                </span>
              </div>

              {!loading && !error && products.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] bg-gray-50"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category filter */}
                  <div className="relative">
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/30 focus:border-[#9B6FD1] bg-gray-50 capitalize"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.name} value={c.name} className="capitalize">{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Stock filter */}
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50 text-xs">
                    {([["all", "All"], ["in", "In Stock"], ["out", "Out of Stock"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setFilterStock(val)}
                        className={`px-3 py-2 font-medium transition-colors ${
                          filterStock === val
                            ? "bg-[#9B6FD1] text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Active filter count + clear */}
                  {(searchQuery || filterCategory !== "all" || filterStock !== "all") && (
                    <button
                      onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStock("all"); }}
                      className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:text-red-600 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                </div>
              )}

              {loading ? (<div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2"><div className="w-4 h-4 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />Loading from Supabase…</div>)
              : error ? (<div className="px-6 py-8 text-center"><p className="text-red-400 text-sm font-medium">Could not load products</p><p className="text-gray-400 text-xs mt-1">{error}</p></div>)
              : (
                <div className="divide-y divide-gray-50">
                  {filteredProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                      <SlidersHorizontal className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 text-sm">{products.length === 0 ? "No products yet. Add one above." : "No products match your filters."}</p>
                      {products.length > 0 && <button onClick={() => { setSearchQuery(""); setFilterCategory("all"); setFilterStock("all"); }} className="text-xs text-[#9B6FD1] hover:underline mt-1">Clear filters</button>}
                    </div>
                  )}
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="px-4 py-4 flex flex-col gap-3">
                      {/* Row 1: images + name + action buttons */}
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2 shrink-0">
                          {(p.images?.length ? p.images.slice(0, 3) : [p.image]).map((img, i) => (
                            <img key={i} src={img} alt={p.name} className="w-11 h-11 rounded-xl object-cover bg-[#F3EEFB] border-2 border-white" style={{ zIndex: 3 - i }} />
                          ))}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 capitalize">
                            {p.category} · ₹{p.price}
                            {p.images?.length > 1 && <span className="ml-1 text-[#9B6FD1]">· {p.images.length} photos</span>}
                            {p.wholesale_price > 0 && (() => {
                              const margin = p.price - p.wholesale_price - (p.shipping_credit ?? 0);
                              const marginPct = Math.round((margin / p.price) * 100);
                              return (
                                <span className={`ml-1 font-medium ${margin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  · Cost ₹{p.wholesale_price}
                                  {p.shipping_credit > 0 && ` · Ship Credit ₹${p.shipping_credit}`}
                                  {" · "}Margin ₹{margin} ({marginPct}%)
                                </span>
                              );
                            })()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors" title="Edit product"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteId(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Delete product"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {/* Row 2: stock badge + stepper */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.stock === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                          {p.stock === 0 ? "OUT OF STOCK" : `${p.stock} in stock`}
                        </span>
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                          <button type="button" onClick={() => updateStock(p.id, p.stock - 1)} disabled={p.stock === 0} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] disabled:opacity-30 transition-colors"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-semibold text-gray-700 w-8 text-center">{p.stock}</span>
                          <button type="button" onClick={() => updateStock(p.id, p.stock + 1)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#F3EEFB] text-gray-400 hover:text-[#9B6FD1] transition-colors"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Placed Orders</h2>
                <span className="text-sm text-gray-400">{orders.length} total</span>
              </div>
              <button onClick={fetchOrders} className="text-xs text-[#9B6FD1] hover:underline">Refresh</button>
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                <div className="w-4 h-4 border-2 border-[#9B6FD1] border-t-transparent rounded-full animate-spin" />
                Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-[#F3EEFB] flex items-center justify-center">
                  <FileText className="w-7 h-7 text-[#9B6FD1]" />
                </div>
                <p className="text-gray-500 font-medium">No orders yet</p>
                <p className="text-gray-400 text-sm">Orders will appear here when customers checkout via WhatsApp.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const sm = statusMeta(order.status);
                  return (
                    <div key={order.id} className="px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Order header */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-[#9B6FD1] bg-[#F3EEFB] px-2 py-0.5 rounded-full">#{order.id}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${order.payment_mode === "cod" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                              {order.payment_mode === "cod" ? "COD" : "Online"}
                            </span>
                            {/* Status badge */}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${sm.color}`}>
                              {sm.label}
                            </span>
                          </div>

                          {/* Items */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-2 py-1">
                                <img src={item.product.image} alt={item.product.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                                <span className="text-xs text-gray-700 font-medium max-w-[100px] truncate">{item.product.name}</span>
                                <span className="text-xs text-gray-400">×{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {/* Customer + totals */}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {order.customer_name && (
                              <span className="w-full text-gray-700 font-medium">{order.customer_name} · {order.customer_mobile}</span>
                            )}
                            {order.customer_address && (
                              <span className="w-full text-gray-500">{order.customer_address}, {order.customer_city}, {order.customer_state} — {order.pincode}</span>
                            )}
                            <span>Subtotal: <strong className="text-gray-700">₹{order.subtotal}</strong></span>
                            {order.shipping_charge > 0 && <span>Shipping: <strong className="text-gray-700">₹{order.shipping_charge}</strong></span>}
                            {order.cod_charge > 0 && <span>COD: <strong className="text-gray-700">₹{order.cod_charge}</strong></span>}
                          </div>
                        </div>

                        {/* Right column: total + actions */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <p className="text-lg font-bold font-serif text-gray-900">₹{order.grand_total}</p>
                          <div className="flex items-center gap-1.5">
                            {/* PDF */}
                            <button
                              onClick={() => handleDownloadPDF(order)}
                              disabled={downloadingId === order.id}
                              title="Download PDF"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-60"
                            >
                              {downloadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              PDF
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => openEditOrder(order)}
                              title="Edit order"
                              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-[#9B6FD1] hover:bg-[#F3EEFB] transition-colors border border-gray-200"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteOrderId(order.id)}
                              title="Delete order"
                              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Categories Tab ── */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            {/* Add Category */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">Add New Category</h2>
              </div>
              <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Slug (internal name)</label>
                    <input
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g. pendants"
                      className="input"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Lowercase, no spaces — used for filtering</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Display Label</label>
                    <input
                      required
                      value={catLabel}
                      onChange={(e) => setCatLabel(e.target.value)}
                      placeholder="e.g. Pendants"
                      className="input"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Shown to customers on the storefront</p>
                  </div>
                </div>
                {catError && <p className="text-red-500 text-xs">{catError}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={catSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60"
                  >
                    {catSaving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                      : <><Plus className="w-4 h-4" />Add Category</>
                    }
                  </button>
                </div>
              </form>
            </div>

            {/* Category List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#9B6FD1]" />
                <h2 className="font-semibold text-gray-800">All Categories</h2>
                <span className="ml-auto text-sm text-gray-400">{categories.length} total</span>
              </div>
              {categories.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No categories yet. Add one above.</p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={categories}
                  onReorder={reorderCategories}
                  className="divide-y divide-gray-50"
                >
                  {categories.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      onDelete={() => setDeleteCatId(cat.id)}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          DELETE CATEGORY MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteCatId !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteCatId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Delete category?</h3>
              <p className="text-sm text-gray-500 mb-5">Existing products in this category won't be deleted, but they'll no longer appear under a filter tab.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteCatId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button disabled={deletingCat} onClick={handleDeleteCategory} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                  {deletingCat ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          EDIT ORDER MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editOrder && editOrderForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={closeEditOrder}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                  <h2 className="font-semibold text-gray-800">Edit Order</h2>
                  <span className="text-xs text-gray-400">#{editOrder.id}</span>
                </div>
                <button onClick={closeEditOrder} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveOrder} className="p-6 space-y-5">
                {/* Status */}
                <div>
                  <label className="label">Order Status</label>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setOF("status", s.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                          editOrderForm.status === s.value
                            ? `${s.color} border-current`
                            : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment mode */}
                <div>
                  <label className="label">Payment Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["prepaid", "cod"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOF("payment_mode", mode)}
                        className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                          editOrderForm.payment_mode === mode
                            ? "bg-[#9B6FD1] border-[#9B6FD1] text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-[#9B6FD1]/50"
                        }`}
                      >
                        {mode === "prepaid" ? "Online Payment" : "Cash on Delivery"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">Customer Name</label>
                    <input value={editOrderForm.customer_name} onChange={(e) => setOF("customer_name", e.target.value)} className="input" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <input value={editOrderForm.customer_mobile} onChange={(e) => setOF("customer_mobile", e.target.value)} className="input" placeholder="10-digit mobile" maxLength={10} />
                  </div>
                  <div>
                    <label className="label">Pincode</label>
                    <input value={editOrderForm.pincode} onChange={(e) => setOF("pincode", e.target.value)} className="input" placeholder="6-digit pincode" maxLength={6} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Address</label>
                    <textarea rows={2} value={editOrderForm.customer_address} onChange={(e) => setOF("customer_address", e.target.value)} className="input resize-none" placeholder="House No., Street, Area" />
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input value={editOrderForm.customer_city} onChange={(e) => setOF("customer_city", e.target.value)} className="input" placeholder="City" />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input value={editOrderForm.customer_state} onChange={(e) => setOF("customer_state", e.target.value)} className="input" placeholder="State" />
                  </div>
                </div>

                {/* Charges */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Subtotal (₹)</label>
                    <input type="number" min="0" value={editOrderForm.subtotal} onChange={(e) => setOF("subtotal", e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">Shipping (₹)</label>
                    <input type="number" min="0" value={editOrderForm.shipping_charge} onChange={(e) => setOF("shipping_charge", e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">COD Charge (₹)</label>
                    <input type="number" min="0" value={editOrderForm.cod_charge} onChange={(e) => setOF("cod_charge", e.target.value)} className="input" />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={closeEditOrder} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={savingOrder} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                    {savingOrder
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                      : <><CheckCircle2 className="w-4 h-4" />Save Changes</>
                    }
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          DELETE ORDER MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteOrderId !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteOrderId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">Delete order #{deleteOrderId}?</h3>
              <p className="text-sm text-gray-500 mb-5">This will permanently remove the order from Supabase. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteOrderId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button disabled={deletingOrder} onClick={handleDeleteOrder} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                  {deletingOrder ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          EDIT PRODUCT MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={closeEdit}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-[#9B6FD1]" />
                  <h2 className="font-semibold text-gray-800">Edit Product</h2>
                  <span className="text-xs text-gray-400 truncate max-w-[160px]">— {editProduct.name}</span>
                </div>
                <button onClick={closeEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2"><label className="label">Product Name</label><input required value={editForm.name} onChange={(e) => setE("name", e.target.value)} className="input" /></div>
                  <div><label className="label">Category</label><div className="relative"><select value={editForm.category} onChange={(e) => setE("category", e.target.value)} className="input appearance-none pr-8 capitalize">{categories.map((c) => <option key={c.name} value={c.name} className="capitalize">{c.label}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /></div></div>
                  <div><label className="label">Stock Quantity</label><input required type="number" min="0" value={editForm.stock} onChange={(e) => setE("stock", e.target.value)} className="input" /></div>
                  <div><label className="label">Shipping Credit (₹)</label><input type="number" min="0" value={editForm.shipping_credit} onChange={(e) => setE("shipping_credit", e.target.value)} placeholder="0" className="input" /><p className="text-[11px] text-gray-400 mt-1">₹ off shipping per unit in cart</p></div>
                  <div><label className="label">Wholesale Price (₹)</label><input type="number" min="0" value={editForm.wholesale_price} onChange={(e) => setE("wholesale_price", e.target.value)} placeholder="0" className="input" /><p className="text-[11px] text-gray-400 mt-1">Your cost price — only visible in admin panel</p></div>
                  <div><label className="label">Selling Price (₹)</label><input required type="number" min="1" value={editForm.price} onChange={(e) => setE("price", e.target.value)} className="input" /></div>
                  <div><label className="label">Original Price (₹)</label><input required type="number" min="1" value={editForm.originalPrice} onChange={(e) => setE("originalPrice", e.target.value)} className="input" /></div>
                  <div className="sm:col-span-2">
                    <label className="label"><Image className="w-3.5 h-3.5 inline mr-1" /> Product Images<span className="text-gray-400 font-normal normal-case ml-1">(first is cover · max {MAX_IMAGES} · drag to reorder)</span></label>
                    <div className="mb-3">
                      <DraggableImageGrid
                        items={editImageItems}
                        onReorder={setEditImageItems}
                        onRemove={removeEditImage}
                        onAddMore={editImageItems.length < MAX_IMAGES ? () => editFileRef.current?.click() : undefined}
                        maxImages={MAX_IMAGES}
                        newBadge={false}
                      />
                    </div>
                    <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addEditFiles(e.target.files); }} />
                    {editUploadError && <p className="text-red-500 text-xs mt-1">{editUploadError}</p>}
                  </div>
                  <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={3} value={editForm.description} onChange={(e) => setE("description", e.target.value)} className="input resize-none" /></div>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button type="button" onClick={closeEdit} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={editSaving} className="flex items-center gap-2 px-6 py-2.5 bg-[#9B6FD1] text-white text-sm font-semibold rounded-xl hover:bg-[#8a5fc0] transition-colors disabled:opacity-60">
                    {editSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Changes</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          DELETE PRODUCT MODAL
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteId !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4"><Trash2 className="w-5 h-5 text-red-500" /></div>
              <h3 className="font-semibold text-gray-800 mb-1">Delete product?</h3>
              <p className="text-sm text-gray-500 mb-5">This will remove it from Supabase and the store.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button disabled={deleting} onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          TOAST
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white ${toastType === "error" ? "bg-red-500" : "bg-green-600"}`}
          >
            {toastType === "error"
              ? <X className="w-4 h-4" />
              : <CheckCircle2 className="w-4 h-4" />
            }
            {toast}
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
