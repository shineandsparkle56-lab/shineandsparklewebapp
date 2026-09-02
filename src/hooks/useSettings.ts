import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
  allCategoryImage: string | null;
  minOrderValue: number;
  defaultPickupLocation: string;
  defaultPickupPincode: string;
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
  setAllCategoryImage: (url: string | null) => Promise<void>;
  setMinOrderValue: (value: number) => Promise<void>;
  setDefaultPickupLocation: (name: string) => Promise<void>;
  setDefaultPickupPincode: (pincode: string) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true);
  const [allCategoryImage, setAllCategoryImageState] = useState<string | null>(null);
  const [minOrderValue, setMinOrderValueState] = useState(0);
  const [defaultPickupLocation, setDefaultPickupLocationState] = useState("");
  const [defaultPickupPincode, setDefaultPickupPincodeState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting("cod_enabled"),
      getSetting("all_category_image_url"),
      getSetting("min_order_value"),
      getSetting("default_pickup_location"),
      getSetting("default_pickup_pincode"),
    ]).then(([cod, allImg, minOrder, pickup, pickupPin]) => {
      if (cod !== null) setCodEnabledState(cod === "true");
      if (allImg !== null && allImg !== "") setAllCategoryImageState(allImg);
      if (minOrder !== null) setMinOrderValueState(parseInt(minOrder, 10) || 0);
      if (pickup !== null) setDefaultPickupLocationState(pickup);
      if (pickupPin !== null) setDefaultPickupPincodeState(pickupPin);
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

  const setDefaultPickupPincode = async (pincode: string) => {
    setDefaultPickupPincodeState(pincode);
    await setSetting("default_pickup_pincode", pincode);
  };

  return {
    codEnabled,
    allCategoryImage,
    minOrderValue,
    defaultPickupLocation,
    defaultPickupPincode,
    loading,
    setCodEnabled,
    setAllCategoryImage,
    setMinOrderValue,
    setDefaultPickupLocation,
    setDefaultPickupPincode,
  };
}
