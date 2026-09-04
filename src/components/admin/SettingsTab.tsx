import { useState, useEffect } from "react";
import { Settings, Warehouse, Loader2, RefreshCw, CheckSquare, Square, MapPin, Plus, Trash2 } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { LocalDeliveryZone } from "../../lib/settings";

interface PickupLoc {
  id: number;
  name: string;
  city: string;
  state: string;
  pin_code: string;
  is_primary: boolean;
}

const EMPTY_ZONE: Omit<LocalDeliveryZone, "pincode"> = { charge: 0, days: 1, label: "Local Delivery" };

const INPUT = "w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-300";
const LABEL = "block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1";
const SECTION = "py-3 border-b border-gray-100 last:border-b-0";

export function SettingsTab() {
  const {
    codEnabled, setCodEnabled,
    minOrderValue, setMinOrderValue,
    defaultPickupPincodes, setDefaultPickupPincodes,
    setDefaultPickupLocation,
    localDeliveryZones, setLocalDeliveryZones,
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

  // ── Local delivery zones ─────────────────────────────────────
  const [zones, setZones] = useState<LocalDeliveryZone[]>([]);
  const [savingZones, setSavingZones] = useState(false);
  const [zonesSaved, setZonesSaved] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) setZones(localDeliveryZones ?? []);
  }, [loading, localDeliveryZones]);

  const addZone = () => setZones((prev) => [...prev, { pincode: "", ...EMPTY_ZONE }]);
  const removeZone = (idx: number) => setZones((prev) => prev.filter((_, i) => i !== idx));

  const updateZone = <K extends keyof LocalDeliveryZone>(idx: number, field: K, value: LocalDeliveryZone[K]) => {
    setZones((prev) => prev.map((z, i) => (i === idx ? { ...z, [field]: value } : z)));
  };

  const handleSaveZones = async () => {
    for (const z of zones) {
      if (!/^\d{6}$/.test(z.pincode.trim())) {
        setZoneError(`"${z.pincode}" is not a valid 6-digit pincode.`);
        return;
      }
    }
    const pincodes = zones.map((z) => z.pincode.trim());
    if (pincodes.some((p, i) => pincodes.indexOf(p) !== i)) {
      setZoneError("Duplicate pincodes found.");
      return;
    }
    setZoneError(null);
    setSavingZones(true);
    await setLocalDeliveryZones(zones.map((z) => ({ ...z, pincode: z.pincode.trim() })));
    setSavingZones(false);
    setZonesSaved(true);
    setTimeout(() => setZonesSaved(false), 2000);
  };

  const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-gray-300"}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );

  const SaveBtn = ({ onClick, disabled, saving, saved, label = "Save" }: {
    onClick: () => void; disabled: boolean; saving: boolean; saved: boolean; label?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${saved ? "bg-emerald-500 text-white" : "bg-[#9B6FD1] hover:bg-[#8a5fc0] text-white disabled:opacity-40"}`}
    >
      {saving ? "Saving…" : saved ? "Saved ✓" : label}
    </button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#9B6FD1]" />
        <h2 className="text-sm font-semibold text-gray-800">Store Settings</h2>
      </div>

      <div className="px-4 divide-y divide-gray-100">

        {/* ── COD ── */}
        <div className={`${SECTION} flex items-center justify-between gap-3`}>
          <div>
            <p className="text-sm font-semibold text-gray-800">Cash on Delivery</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {codEnabled ? "Enabled — customers can choose COD at checkout." : "Disabled — online payment only."}
            </p>
          </div>
          <Toggle checked={codEnabled} onChange={() => setCodEnabled(!codEnabled)} disabled={loading} />
        </div>

        {/* ── Minimum order ── */}
        <div className={`${SECTION} space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">Minimum Order Value</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {minOrderValue > 0 ? `Min ₹${minOrderValue} required to checkout.` : "No minimum set."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">₹</span>
              <input
                type="number" min="0" step="1" placeholder="0"
                value={minOrderInput}
                onChange={(e) => setMinOrderInput(e.target.value)}
                disabled={loading}
                className={INPUT + " pl-6 disabled:opacity-50"}
              />
            </div>
            <SaveBtn onClick={handleSaveMinOrder} disabled={loading || savingMin} saving={savingMin} saved={minSaved} />
          </div>
        </div>

        {/* ── Pickup locations ── */}
        <div className={`${SECTION} space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0" />
              <p className="text-sm font-semibold text-gray-800">Pickup Locations</p>
              {pickupLoading && <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />}
            </div>
            <button
              type="button" onClick={fetchPickupLocations} disabled={pickupLoading}
              title="Refresh from Shiprocket"
              className="p-1 rounded text-gray-400 hover:text-[#9B6FD1] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pickupLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <p className="text-xs text-gray-400">
            {selectedPincodes.length > 0
              ? `${selectedPincodes.length} selected — cheapest rate shown to customers.`
              : "Select warehouses to use for shipping rate calculation."}
          </p>

          {pickupError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">{pickupError}</p>
          )}

          {pickupLocations.length > 0 ? (
            <div className="space-y-1">
              {pickupLocations.map((loc) => {
                const isChecked = selectedPincodes.includes(loc.pin_code);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => togglePincode(loc.pin_code)}
                    disabled={loading || pickupLoading}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all disabled:opacity-50 ${
                      isChecked ? "border-[#9B6FD1] bg-[#9B6FD1]/5" : "border-gray-200 bg-gray-50 hover:border-[#9B6FD1]/40"
                    }`}
                  >
                    {isChecked
                      ? <CheckSquare className="w-4 h-4 text-[#9B6FD1] shrink-0" />
                      : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {loc.name}
                        {loc.is_primary && (
                          <span className="ml-1.5 text-[9px] font-bold text-[#9B6FD1] bg-[#9B6FD1]/10 px-1 py-0.5 rounded-full">Primary</span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{loc.city}, {loc.state} · {loc.pin_code}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            !pickupLoading && (
              <p className="text-xs text-gray-400 py-1">No locations. Tap refresh to load from Shiprocket.</p>
            )
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            {selectedPincodes.length > 0 && (
              <p className="text-[11px] text-gray-400 truncate flex-1">
                {selectedPincodes.join(", ")}
              </p>
            )}
            <SaveBtn
              onClick={handleSavePickup}
              disabled={loading || savingPickup || selectedPincodes.length === 0}
              saving={savingPickup}
              saved={pickupSaved}
            />
          </div>

          {pickupLocations.length > 0 && (
            <p className="text-[11px] text-gray-400">{pickupLocations.length} location{pickupLocations.length !== 1 ? "s" : ""} from Shiprocket.</p>
          )}
        </div>

        {/* ── Local Delivery Zones ── */}
        <div className={`${SECTION} space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9B6FD1] shrink-0" />
              <p className="text-sm font-semibold text-gray-800">Local Delivery Zones</p>
            </div>
            <button
              type="button" onClick={addZone} disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-[#9B6FD1] border border-[#9B6FD1]/30 hover:bg-[#9B6FD1]/10 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Pincodes you self-deliver. Bypasses Shiprocket with fixed charge &amp; date.
          </p>

          {zones.length > 0 ? (
            <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_52px_40px_auto] gap-0 bg-gray-50 border-b border-gray-200 px-2.5 py-1.5">
                <p className={LABEL + " mb-0"}>Pincode</p>
                <p className={LABEL + " mb-0"}>₹</p>
                <p className={LABEL + " mb-0"}>Days</p>
                <span className="w-7" />
              </div>
              {zones.map((zone, idx) => (
                <div key={idx} className="border-b border-gray-100 last:border-b-0">
                  {/* Main row */}
                  <div className="grid grid-cols-[1fr_52px_40px_auto] gap-1.5 items-center px-2.5 py-2">
                    <input
                      type="tel" inputMode="numeric" maxLength={6} placeholder="123456"
                      value={zone.pincode}
                      onChange={(e) => updateZone(idx, "pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#9B6FD1]/40 bg-white font-mono placeholder:text-gray-300"
                    />
                    <input
                      type="number" min="0" step="1"
                      value={zone.charge}
                      onChange={(e) => updateZone(idx, "charge", Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full border border-gray-200 rounded px-1.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#9B6FD1]/40 bg-white"
                    />
                    <input
                      type="number" min="0" step="1"
                      value={zone.days}
                      onChange={(e) => updateZone(idx, "days", Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full border border-gray-200 rounded px-1.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#9B6FD1]/40 bg-white"
                    />
                    <button
                      type="button" onClick={() => removeZone(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Label sub-row */}
                  <div className="px-2.5 pb-2">
                    <input
                      type="text" placeholder="Label, e.g. Same-day Delivery"
                      value={zone.label}
                      onChange={(e) => updateZone(idx, "label", e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#9B6FD1]/40 bg-white placeholder:text-gray-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-xs text-gray-400 py-1">No local zones. Click Add to create one.</p>
            )
          )}

          {zoneError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">{zoneError}</p>
          )}

          {zones.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <p className="text-[11px] text-gray-400 flex-1">Days = exact, no buffer added.</p>
              <SaveBtn
                onClick={handleSaveZones}
                disabled={loading || savingZones}
                saving={savingZones}
                saved={zonesSaved}
                label="Save Zones"
              />
            </div>
          )}
        </div>

      </div>

      <p className="text-[11px] text-gray-400 text-center px-4 py-2.5">Changes apply immediately for all customers.</p>
    </div>
  );
}
