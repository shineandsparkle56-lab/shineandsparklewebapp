import { Settings } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";

export function SettingsTab() {
  const { codEnabled, setCodEnabled, showSearchBar, setShowSearchBar, loading } = useSettings();

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

        <p className="text-xs text-gray-400">Changes take effect immediately for all customers.</p>
      </div>
    </div>
  );
}
