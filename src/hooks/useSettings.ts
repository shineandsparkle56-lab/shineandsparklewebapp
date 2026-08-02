import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
  showSearchBar: boolean;
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
  setShowSearchBar: (enabled: boolean) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true);       // default on
  const [showSearchBar, setShowSearchBarState] = useState(true);  // default on
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting("cod_enabled"),
      getSetting("search_bar_enabled"),
    ]).then(([cod, search]) => {
      if (cod !== null) setCodEnabledState(cod === "true");
      if (search !== null) setShowSearchBarState(search === "true");
      setLoading(false);
    });
  }, []);

  const setCodEnabled = async (enabled: boolean) => {
    setCodEnabledState(enabled); // optimistic
    await setSetting("cod_enabled", String(enabled));
  };

  const setShowSearchBar = async (enabled: boolean) => {
    setShowSearchBarState(enabled); // optimistic
    await setSetting("search_bar_enabled", String(enabled));
  };

  return { codEnabled, showSearchBar, loading, setCodEnabled, setShowSearchBar };
}
