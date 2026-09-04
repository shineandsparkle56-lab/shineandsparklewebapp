import { useState, useEffect } from "react";
import { getSetting, setSetting, LocalDeliveryZone } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
  allCategoryImage: string | null;
  minOrderValue: number;
  defaultPickupLocation: string;
  defaultPickupPincodes: string[];
  localDeliveryZones: LocalDeliveryZone[];
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
  setAllCategoryImage: (url: string | null) => Promise<void>;
  setMinOrderValue: (value: number) => Promise<void>;
  setDefaultPickupLocation: (name: string) => Promise<void>;
  setDefaultPickupPincodes: (pincodes: string[]) => Promise<void>;
  setLocalDeliveryZones: (zones: LocalDeliveryZone[]) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true);
  const [allCategoryImage, setAllCategoryImageState] = useState<string | null>(null);
  const [minOrderValue, setMinOrderValueState] = useState(0);
  const [defaultPickupLocation, setDefaultPickupLocationState] = useState("");
  const [defaultPickupPincodes, setDefaultPickupPincodesState] = useState<string[]>([]);
  const [localDeliveryZones, setLocalDeliveryZonesState] = useState<LocalDeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting("cod_enabled"),
      getSetting("all_category_image_url"),
      getSetting("min_order_value"),
      getSetting("default_pickup_location"),
      getSetting("default_pickup_pincodes"),
      getSetting("local_delivery_zones"),
    ]).then(([cod, allImg, minOrder, pickupLocation, pickupPins, localZones]) => {
      if (cod !== null) setCodEnabledState(cod === "true");
      if (allImg !== null && allImg !== "") setAllCategoryImageState(allImg);
      if (minOrder !== null) setMinOrderValueState(parseInt(minOrder, 10) || 0);
      if (pickupLocation !== null) setDefaultPickupLocationState(pickupLocation);
      if (pickupPins !== null) {
        try {
          const parsed = JSON.parse(pickupPins) as string[];
          setDefaultPickupPincodesState(Array.isArray(parsed) ? parsed : []);
        } catch {
          setDefaultPickupPincodesState([]);
        }
      }
      if (localZones !== null) {
        try {
          const parsed = JSON.parse(localZones) as LocalDeliveryZone[];
          setLocalDeliveryZonesState(Array.isArray(parsed) ? parsed : []);
        } catch {
          setLocalDeliveryZonesState([]);
        }
      }
      setLoading(false);
    });
  }, []);

  const setCodEnabled = async (enabled: boolean) => {
    setCodEnabledState(enabled);
    await setSetting("cod_enabled", String(enabled));
  };

  const setAllCategoryImage = async (url: string | null) => {
    setAllCategoryImageState(url);
    await setSetting("all_category_image_url", url ?? "");
  };

  const setMinOrderValue = async (value: number) => {
    setMinOrderValueState(value);
    await setSetting("min_order_value", String(value));
  };

  const setDefaultPickupLocation = async (name: string) => {
    setDefaultPickupLocationState(name);
    await setSetting("default_pickup_location", name);
  };

  const setDefaultPickupPincodes = async (pincodes: string[]) => {
    setDefaultPickupPincodesState(pincodes);
    await setSetting("default_pickup_pincodes", JSON.stringify(pincodes));
  };

  const setLocalDeliveryZones = async (zones: LocalDeliveryZone[]) => {
    setLocalDeliveryZonesState(zones);
    await setSetting("local_delivery_zones", JSON.stringify(zones));
  };

  return {
    codEnabled,
    allCategoryImage,
    minOrderValue,
    defaultPickupLocation,
    defaultPickupPincodes,
    localDeliveryZones,
    loading,
    setCodEnabled,
    setAllCategoryImage,
    setMinOrderValue,
    setDefaultPickupLocation,
    setDefaultPickupPincodes,
    setLocalDeliveryZones,
  };
}
