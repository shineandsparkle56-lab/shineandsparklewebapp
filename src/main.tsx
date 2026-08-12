import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Configure status bar only when running inside a native Capacitor app
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });
  StatusBar.setStyle({ style: Style.Light }); // dark icons on light background
  StatusBar.setBackgroundColor({ color: "#ffffff" });
}

createRoot(document.getElementById("root")!).render(<App />);
