import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";

export function SettingsTab() {
  const { codEnabled, setCodEnabled, showSearchBar, setShowSearchBar, minOrderValue, setMinOrderValue, loading } = useSettings();

  // Local input state so the user can type freely before saving
  const [minOrderInput, setMinOrderInput] = useState("");
  const [savingMin, setSavingMin] = useState(false);
  const [minSaved, setMinSaved] = useState(false);

  // Sync input when the loaded value arrives from Supabase
  useEffect(() => {
    if (!loading) setMinOrderInput(minOrderValue === 0 ? "" : String(minOrderValue));
  }, [loading, minOrderValue]);

  const handleSaveMinOrder = async () => {
    const parsed = parseInt(minOrderInput, 10);
    const value = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setSavingMin(true);
    await setMinOrderValue(value);
    setSavingMin(false);
    setMinSaved(true);
    setTimeout(() => setMinSaved(false), 2000);
  };

  const Toggle = ({
    checked, onChange, disabled,
  }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button disabled={disabled} onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-gray-300"}`}
      role="switch" aria-checked={checked}>
      <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#9B6FD1]" />
        <h2 className="font-semibold text-gray-800">Store Settings</h2>
      </div>
      <div className="p-6 space-y-4">
        {/* COD */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
          <div>
            <p className="text-sm font-semibold text-gray-800">Cash on Delivery (COD)</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {codEnabled
                ? "COD is enabled — customers can choose Online or COD at checkout."
                : "COD is disabled — customers can only pay online at checkout."}
            </p>
          </div>
          <Toggle checked={codEnabled} onChange={() => setCodEnabled(!codEnabled)} disabled={loading} />
        </div>

        {/* Search bar */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
          <div>
            <p className="text-sm font-semibold text-gray-800">Product Search Bar</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {showSearchBar
                ? "Search bar is visible — customers can search products on the storefront."
                : "Search bar is hidden — the product search field won't appear on the storefront."}
            </p>
          </div>
          <Toggle checked={showSearchBar} onChange={() => setShowSearchBar(!showSearchBar)} disabled={loading} />
        </div>

        {/* Minimum order value */}
        <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Minimum Order Value</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {minOrderValue > 0
                ? `Customers must add at least ₹${minOrderValue} to their cart before checking out.`
                : "No minimum — customers can check out with any cart total."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0 (no minimum)"
                value={minOrderInput}
                onChange={(e) => setMinOrderInput(e.target.value)}
                disabled={loading}
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-300 disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSaveMinOrder}
              disabled={loading || savingMin}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                minSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white disabled:opacity-50"
              }`}
            >
              {savingMin ? "Saving…" : minSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400">Changes take effect immediately for all customers.</p>
      </div>
    </div>
  );
}
