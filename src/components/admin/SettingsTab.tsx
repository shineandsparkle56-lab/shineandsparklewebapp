import { useState, useEffect } from "react";
import { Settings, Warehouse, Loader2, RefreshCw, CheckSquare, Square } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";

interface PickupLoc {
  id: number;
  name: string;
  city: string;
  state: string;
  pin_code: string;
  is_primary: boolean;
}

export function SettingsTab() {
  const {
    codEnabled, setCodEnabled,
    minOrderValue, setMinOrderValue,
    defaultPickupPincodes, setDefaultPickupPincodes,
    setDefaultPickupLocation,
    loading,
  } = useSettings();

  // ── Min order value ──────────────────────────────────────────
  const [minOrderInput, setMinOrderInput] = useState("");
  const [savingMin, setSavingMin] = useState(false);
  const [minSaved, setMinSaved] = useState(false);

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

  // ── Pickup locations ─────────────────────────────────────────
  const [pickupLocations, setPickupLocations] = useState<PickupLoc[]>([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
  const [savingPickup, setSavingPickup] = useState(false);
  const [pickupSaved, setPickupSaved] = useState(false);

  // Sync checkboxes when settings load
  useEffect(() => {
    if (!loading) setSelectedPincodes(defaultPickupPincodes ?? []);
  }, [loading, defaultPickupPincodes]);

  const fetchPickupLocations = () => {
    setPickupLoading(true);
    setPickupError(null);
    fetch("/api/get-pickup-locations")
      .then((r) => r.json())
      .then((d: { locations?: PickupLoc[]; error?: string }) => {
        if (d.error) { setPickupError(d.error); return; }
        if (d.locations) setPickupLocations(d.locations);
      })
      .catch((e: Error) => setPickupError(e.message))
      .finally(() => setPickupLoading(false));
  };

  // Auto-fetch once settings are ready
  useEffect(() => {
    if (!loading) fetchPickupLocations();
  }, [loading]);

  const togglePincode = (pincode: string) => {
    setSelectedPincodes((prev) =>
      prev.includes(pincode) ? prev.filter((p) => p !== pincode) : [...prev, pincode]
    );
  };

  const handleSavePickup = async () => {
    setSavingPickup(true);
    // Also persist the primary location name for order-push (OrdersTab uses it)
    const primary = pickupLocations.find((l) => selectedPincodes.includes(l.pin_code) && l.is_primary)
      ?? pickupLocations.find((l) => selectedPincodes.includes(l.pin_code));
    await Promise.all([
      setDefaultPickupPincodes(selectedPincodes),
      setDefaultPickupLocation(primary?.name ?? ""),
    ]);
    setSavingPickup(false);
    setPickupSaved(true);
    setTimeout(() => setPickupSaved(false), 2000);
  };

  // ── Toggle component ─────────────────────────────────────────
  const Toggle = ({
    checked, onChange, disabled,
  }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-gray-300"}`}
      role="switch"
      aria-checked={checked}
    >
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

        {/* Shiprocket pickup locations — multi-select */}
        <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#9B6FD1]" />
                <p className="text-sm font-semibold text-gray-800">Pickup Locations</p>
                {pickupLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedPincodes.length > 0
                  ? `${selectedPincodes.length} location${selectedPincodes.length !== 1 ? "s" : ""} selected — cheapest rate across all will be shown to customers.`
                  : "Select one or more warehouses. The cheapest shipping rate across all selected locations will be shown."}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchPickupLocations}
              disabled={pickupLoading}
              title="Refresh pickup locations from Shiprocket"
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#9B6FD1] hover:bg-[#9B6FD1]/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pickupLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {pickupError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Could not load locations from Shiprocket: {pickupError}
            </p>
          )}

          {pickupLocations.length > 0 ? (
            <div className="space-y-2">
              {pickupLocations.map((loc) => {
                const isChecked = selectedPincodes.includes(loc.pin_code);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => togglePincode(loc.pin_code)}
                    disabled={loading || pickupLoading}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all disabled:opacity-50 ${
                      isChecked
                        ? "border-[#9B6FD1] bg-[#9B6FD1]/5"
                        : "border-gray-200 bg-white hover:border-[#9B6FD1]/40"
                    }`}
                  >
                    {isChecked
                      ? <CheckSquare className="w-4 h-4 text-[#9B6FD1] shrink-0" />
                      : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {loc.name}
                        {loc.is_primary && (
                          <span className="ml-1.5 text-[10px] font-semibold text-[#9B6FD1] bg-[#9B6FD1]/10 px-1.5 py-0.5 rounded-full">Primary</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{loc.city}, {loc.state} — {loc.pin_code}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            !pickupLoading && (
              <p className="text-xs text-gray-400 text-center py-2">
                No locations loaded. Click refresh to fetch from Shiprocket.
              </p>
            )
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {selectedPincodes.length > 0 && (
              <p className="text-[11px] text-gray-400 truncate">
                Pincodes: {selectedPincodes.join(", ")}
              </p>
            )}
            <button
              onClick={handleSavePickup}
              disabled={loading || savingPickup || selectedPincodes.length === 0}
              className={`ml-auto px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                pickupSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white disabled:opacity-50"
              }`}
            >
              {savingPickup ? "Saving…" : pickupSaved ? "Saved ✓" : "Save"}
            </button>
          </div>

          {pickupLocations.length > 0 && (
            <p className="text-[11px] text-gray-400">
              {pickupLocations.length} location{pickupLocations.length !== 1 ? "s" : ""} loaded from Shiprocket.
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400">Changes take effect immediately for all customers.</p>
      </div>
    </div>
  );
}
