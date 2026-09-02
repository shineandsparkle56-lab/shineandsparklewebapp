import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * Handles the Android hardware back button for the entire app.
 *
 * Priority order (highest → lowest):
 *  1. Cart drawer is open  → close it
 *  2. On a product overlay (/product/:id) → go back to previous page
 *  3. On a sub-page (not "/" and not a festival root)  → navigate to "/"
 *  4. On "/" (home / festival root)  → exit the app
 */
export function useAndroidBackButton(
  isCartOpen: boolean,
  setIsCartOpen: (open: boolean) => void,
) {
  const [path, setLocation] = useLocation();

  useEffect(() => {
    // Only register on actual Android/iOS native platform
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", () => {
      // 1. Cart drawer is open — close it first
      if (isCartOpen) {
        setIsCartOpen(false);
        return;
      }

      // 2. Product detail overlay — pop browser history (returns to store/festival)
      if (path.startsWith("/product/")) {
        window.history.back();
        return;
      }

      // 3. Any sub-page — go home
      const isHomePage =
        path === "/" ||
        path.startsWith("/festival/");

      if (!isHomePage) {
        setLocation("/");
        return;
      }

      // 4. Already on home / festival root — exit app
      App.exitApp();
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, [path, isCartOpen, setIsCartOpen, setLocation]);
}
