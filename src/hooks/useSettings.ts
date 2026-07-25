import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true); // default on
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting("cod_enabled").then((val) => {
      // null means row not yet in DB — treat as enabled (default)
      if (val !== null) setCodEnabledState(val === "true");
      setLoading(false);
    });
  }, []);

  const setCodEnabled = async (enabled: boolean) => {
    setCodEnabledState(enabled); // optimistic
    await setSetting("cod_enabled", String(enabled));
  };

  return { codEnabled, loading, setCodEnabled };
}
