import { useState, useEffect } from "react";
import { getSetting, setSetting } from "../lib/settings";

interface Settings {
  codEnabled: boolean;
  showSearchBar: boolean;
  allCategoryImage: string | null;
}

interface UseSettingsReturn extends Settings {
  loading: boolean;
  setCodEnabled: (enabled: boolean) => Promise<void>;
  setShowSearchBar: (enabled: boolean) => Promise<void>;
  setAllCategoryImage: (url: string | null) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [codEnabled, setCodEnabledState] = useState(true);
  const [showSearchBar, setShowSearchBarState] = useState(true);
  const [allCategoryImage, setAllCategoryImageState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSetting("cod_enabled"),
      getSetting("search_bar_enabled"),
      getSetting("all_category_image_url"),
    ]).then(([cod, search, allImg]) => {
      if (cod !== null) setCodEnabledState(cod === "true");
      if (search !== null) setShowSearchBarState(search === "true");
      if (allImg !== null && allImg !== "") setAllCategoryImageState(allImg);
      setLoading(false);
    });
  }, []);

  const setCodEnabled = async (enabled: boolean) => {
    setCodEnabledState(enabled);
    await setSetting("cod_enabled", String(enabled));
  };

  const setShowSearchBar = async (enabled: boolean) => {
    setShowSearchBarState(enabled);
    await setSetting("search_bar_enabled", String(enabled));
  };

  const setAllCategoryImage = async (url: string | null) => {
    setAllCategoryImageState(url);
    await setSetting("all_category_image_url", url ?? "");
  };

  return { codEnabled, showSearchBar, allCategoryImage, loading, setCodEnabled, setShowSearchBar, setAllCategoryImage };
}
