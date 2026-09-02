import { useState, useEffect } from "react";
import { Settings, Warehouse, Loader2, RefreshCw } from "lucide-react";
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
    defaultPickupLocation, setDefaultPickupLocation,
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
  const [selectedPickup, setSelectedPickup] = useState("");
  const [savingPickup, setSavingPickup] = useState(false);
  const [pickupSaved, setPickupSaved] = useState(false);

  // Sync selector when settings load
  useEffect(() => {
    if (!loading) setSelectedPickup(defaultPickupLocation ?? "");
  }, [loading, defaultPickupLocation]);

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

  const handleSavePickup = async () => {
    setSavingPickup(true);
    await setDefaultPickupLocation(selectedPickup);
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

        {/* Shiprocket default pickup location */}
        <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-[#9B6FD1]" />
                <p className="text-sm font-semibold text-gray-800">Default Pickup Location</p>
                {pickupLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {defaultPickupLocation
                  ? `Orders will be picked up from "${defaultPickupLocation}" unless overridden per order.`
                  : "Choose which warehouse Shiprocket should pick up from by default."}
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

          <div className="flex items-center gap-2">
            {pickupLocations.length > 0 ? (
              <select
                value={selectedPickup}
                onChange={(e) => setSelectedPickup(e.target.value)}
                disabled={loading || pickupLoading}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white disabled:opacity-50"
              >
                <option value="">— select a location —</option>
                {pickupLocations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} — {loc.city}, {loc.state} {loc.pin_code}
                    {loc.is_primary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={pickupLoading ? "Loading locations…" : "e.g. Home, Home-2, home-1"}
                value={selectedPickup}
                onChange={(e) => setSelectedPickup(e.target.value)}
                disabled={loading || pickupLoading}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-300 disabled:opacity-50"
              />
            )}
            <button
              onClick={handleSavePickup}
              disabled={loading || savingPickup || !selectedPickup}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
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
              Individual orders can override this in Edit Order.
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400">Changes take effect immediately for all customers.</p>
      </div>
    </div>
  );
}
