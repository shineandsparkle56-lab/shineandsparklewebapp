/**
 * Resolves an API path to an absolute URL when running inside Capacitor (Android/iOS),
 * where relative paths like /api/... would hit the local WebView server (localhost) instead
 * of the live Vercel backend.
 *
 * On the web (browser), relative paths work as-is and are returned unchanged.
 */
const PRODUCTION_BASE = "https://shineandsparkle.in";

function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    // Capacitor injects a global Capacitor object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window as any).Capacitor
  );
}

export function apiUrl(path: string): string {
  if (isCapacitor()) {
    // Ensure no double slashes
    return `${PRODUCTION_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return path;
}
