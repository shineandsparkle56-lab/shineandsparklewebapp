import { useState, useEffect } from "react";
import { getSetting, setSetting, LocalDeliveryZone, DEFAULT_WA_TEMPLATES } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
  allCategoryImage: string | null;
  minOrderValue: number;
  defaultPickupLocation: string;
  defaultPickupPincodes: string[];
  localDeliveryZones: LocalDeliveryZone[];
  thankYouCardUrl: string | null;
  waTplOutForDelivery: string;
  waTplDispatched: string;
  waTplDelayed: string;
  waTplFeedback: string;
  waTplThankYou: string;
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
  setAllCategoryImage: (url: string | null) => Promise<void>;
  setMinOrderValue: (value: number) => Promise<void>;
  setDefaultPickupLocation: (name: string) => Promise<void>;
  setDefaultPickupPincodes: (pincodes: string[]) => Promise<void>;
  setLocalDeliveryZones: (zones: LocalDeliveryZone[]) => Promise<void>;
  setThankYouCardUrl: (url: string | null) => Promise<void>;
  setWaTplOutForDelivery: (tpl: string) => Promise<void>;
  setWaTplDispatched: (tpl: string) => Promise<void>;
  setWaTplDelayed: (tpl: string) => Promise<void>;
  setWaTplFeedback: (tpl: string) => Promise<void>;
  setWaTplThankYou: (tpl: string) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true);
  const [allCategoryImage, setAllCategoryImageState] = useState<string | null>(null);
  const [minOrderValue, setMinOrderValueState] = useState(0);
  const [defaultPickupLocation, setDefaultPickupLocationState] = useState("");
  const [defaultPickupPincodes, setDefaultPickupPincodesState] = useState<string[]>([]);
  const [localDeliveryZones, setLocalDeliveryZonesState] = useState<LocalDeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [thankYouCardUrl, setThankYouCardUrlState] = useState<string | null>(null);
  const [waTplOutForDelivery, setWaTplOutForDeliveryState] = useState(DEFAULT_WA_TEMPLATES.out_for_delivery);
  const [waTplDispatched,     setWaTplDispatchedState]     = useState(DEFAULT_WA_TEMPLATES.dispatched);
  const [waTplDelayed,        setWaTplDelayedState]        = useState(DEFAULT_WA_TEMPLATES.delayed);
  const [waTplFeedback,       setWaTplFeedbackState]       = useState(DEFAULT_WA_TEMPLATES.feedback);
  const [waTplThankYou,       setWaTplThankYouState]       = useState(DEFAULT_WA_TEMPLATES.thank_you);

  useEffect(() => {
    Promise.all([
      getSetting("cod_enabled"),
      getSetting("all_category_image_url"),
      getSetting("min_order_value"),
      getSetting("default_pickup_location"),
      getSetting("default_pickup_pincodes"),
      getSetting("local_delivery_zones"),
      getSetting("thank_you_card_url"),
      getSetting("whatsapp_tpl_out_for_delivery"),
      getSetting("whatsapp_tpl_dispatched"),
      getSetting("whatsapp_tpl_delayed"),
      getSetting("whatsapp_tpl_feedback"),
      getSetting("whatsapp_tpl_thank_you"),
    ]).then(([cod, allImg, minOrder, pickupLocation, pickupPins, localZones, tyCard,
              waTpl1, waTpl2, waTpl3, waTpl4, waTpl5]) => {
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
      if (tyCard !== null && tyCard !== "") setThankYouCardUrlState(tyCard);
      if (waTpl1 !== null && waTpl1 !== "") setWaTplOutForDeliveryState(waTpl1);
      if (waTpl2 !== null && waTpl2 !== "") setWaTplDispatchedState(waTpl2);
      if (waTpl3 !== null && waTpl3 !== "") setWaTplDelayedState(waTpl3);
      if (waTpl4 !== null && waTpl4 !== "") setWaTplFeedbackState(waTpl4);
      if (waTpl5 !== null && waTpl5 !== "") setWaTplThankYouState(waTpl5);
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

  const setThankYouCardUrl = async (url: string | null) => {
    setThankYouCardUrlState(url);
    await setSetting("thank_you_card_url", url ?? "");
  };

  const setWaTplOutForDelivery = async (tpl: string) => {
    setWaTplOutForDeliveryState(tpl);
    await setSetting("whatsapp_tpl_out_for_delivery", tpl);
  };
  const setWaTplDispatched = async (tpl: string) => {
    setWaTplDispatchedState(tpl);
    await setSetting("whatsapp_tpl_dispatched", tpl);
  };
  const setWaTplDelayed = async (tpl: string) => {
    setWaTplDelayedState(tpl);
    await setSetting("whatsapp_tpl_delayed", tpl);
  };
  const setWaTplFeedback = async (tpl: string) => {
    setWaTplFeedbackState(tpl);
    await setSetting("whatsapp_tpl_feedback", tpl);
  };
  const setWaTplThankYou = async (tpl: string) => {
    setWaTplThankYouState(tpl);
    await setSetting("whatsapp_tpl_thank_you", tpl);
  };

  return {
    codEnabled,
    allCategoryImage,
    minOrderValue,
    defaultPickupLocation,
    defaultPickupPincodes,
    localDeliveryZones,
    thankYouCardUrl,
    waTplOutForDelivery,
    waTplDispatched,
    waTplDelayed,
    waTplFeedback,
    waTplThankYou,
    loading,
    setCodEnabled,
    setAllCategoryImage,
    setMinOrderValue,
    setDefaultPickupLocation,
    setDefaultPickupPincodes,
    setLocalDeliveryZones,
    setThankYouCardUrl,
    setWaTplOutForDelivery,
    setWaTplDispatched,
    setWaTplDelayed,
    setWaTplFeedback,
    setWaTplThankYou,
  };
}
