import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDeviceType(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return "mobile";
  return "desktop";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua))        return "Edge";
  if (/opr\//i.test(ua))        return "Opera";
  if (/chrome/i.test(ua))       return "Chrome";
  if (/safari/i.test(ua))       return "Safari";
  if (/firefox/i.test(ua))      return "Firefox";
  if (/msie|trident/i.test(ua)) return "IE";
  return "Other";
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua))          return "Windows";
  if (/macintosh/i.test(ua))        return "macOS";
  if (/android/i.test(ua))          return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/linux/i.test(ua))            return "Linux";
  return "Other";
}

function getReferrerSource(referrer: string): string {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("google"))                        return "Google";
    if (host.includes("facebook"))                      return "Facebook";
    if (host.includes("instagram"))                     return "Instagram";
    if (host.includes("twitter") || host.includes("t.co")) return "Twitter/X";
    if (host.includes("whatsapp"))                      return "WhatsApp";
    if (host.includes("youtube"))                       return "YouTube";
    return host;
  } catch {
    return "unknown";
  }
}

// ── Persistent visitor ID ─────────────────────────────────────────────────────
// Stored in localStorage so the same browser is always the same visitor,
// even across multiple sessions / tabs / days.
function getVisitorId(): string {
  const KEY = "sns_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Session ID ────────────────────────────────────────────────────────────────
// Stored in sessionStorage — resets when the browser tab is closed.
function getSessionId(): string {
  const KEY = "sns_session_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// ── Visit count per visitor ───────────────────────────────────────────────────
// Increments every time a new page is tracked (across all sessions).
function bumpVisitCount(): number {
  const KEY = "sns_visit_count";
  const count = Number(localStorage.getItem(KEY) ?? 0) + 1;
  localStorage.setItem(KEY, String(count));
  return count;
}

// ── UTM parameters ────────────────────────────────────────────────────────────
// Reads utm_source / utm_medium / utm_campaign from the current URL.
// These are set when you share a link like:
//   https://yoursite.com?utm_source=instagram&utm_medium=story&utm_campaign=sale
function getUTM() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:   p.get("utm_source")   ?? null,
    utm_medium:   p.get("utm_medium")   ?? null,
    utm_campaign: p.get("utm_campaign") ?? null,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVisitorTracking(page: string) {
  const lastPage    = useRef<string | null>(null);
  // Records the timestamp when the user arrived on this page so we can
  // calculate time-on-page when they navigate away.
  const arrivedAt   = useRef<number>(Date.now());
  // Holds the log row ID returned by Supabase so we can PATCH time_on_page later.
  const logRowId    = useRef<number | null>(null);

  useEffect(() => {
    if (lastPage.current === page) return;

    // ── Patch time_on_page for the PREVIOUS page before tracking the new one ──
    const prevRowId = logRowId.current;
    if (prevRowId !== null) {
      const spent = Math.round((Date.now() - arrivedAt.current) / 1000);
      // Fire-and-forget — don't await so navigation isn't blocked
      supabase
        .from("visitor_logs")
        .update({ time_on_page: spent })
        .eq("id", prevRowId)
        .then(() => {/* ignore */});
    }

    lastPage.current = page;
    arrivedAt.current = Date.now();
    logRowId.current = null;

    const track = async () => {
      try {
        // ── Geo + IP lookup ───────────────────────────────────────────────────
        let country  = "Unknown";
        let city     = "Unknown";
        let region   = "Unknown";
        let ip       = "Unknown";
        let latitude: number | null  = null;
        let longitude: number | null = null;

        try {
          const res = await fetch("https://ipapi.co/json/", {
            signal: AbortSignal.timeout(4000),
          });
          if (res.ok) {
            const geo    = await res.json();
            country      = geo.country_name  ?? "Unknown";
            city         = geo.city          ?? "Unknown";
            region       = geo.region        ?? "Unknown";  // state/province
            ip           = geo.ip            ?? "Unknown";
            latitude     = typeof geo.latitude  === "number" ? geo.latitude  : null;
            longitude    = typeof geo.longitude === "number" ? geo.longitude : null;
          }
        } catch {
          // Geo lookup failed — still log the visit without location.
        }

        const visitCount = bumpVisitCount();
        const utm        = getUTM();

        const { data, error } = await supabase
          .from("visitor_logs")
          .insert([{
            // ── Identity ──────────────────────────────────────────────────────
            visitor_id:      getVisitorId(),   // persistent across sessions
            session_id:      getSessionId(),   // resets on tab close
            visit_count:     visitCount,       // how many pages this visitor has seen total
            is_returning:    visitCount > 1,   // true if they've been here before

            // ── Navigation ────────────────────────────────────────────────────
            page,
            referrer:        document.referrer || null,
            referrer_source: getReferrerSource(document.referrer),
            full_url:        window.location.href,  // full URL including query params

            // ── UTM campaign tracking ─────────────────────────────────────────
            utm_source:      utm.utm_source,
            utm_medium:      utm.utm_medium,
            utm_campaign:    utm.utm_campaign,

            // ── Device & browser ──────────────────────────────────────────────
            browser:         getBrowser(),
            os:              getOS(),
            device_type:     getDeviceType(),
            screen_width:    window.screen.width,
            screen_height:   window.screen.height,
            language:        navigator.language ?? null,          // e.g. "en-IN", "hi"
            timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone ?? null, // "Asia/Kolkata"

            // ── Location ──────────────────────────────────────────────────────
            ip,
            country,
            city,
            region,          // state / province
            latitude,
            longitude,

            // time_on_page starts as null; patched when the user leaves this page
            time_on_page:    null,
          }])
          .select("id")
          .single();

        if (!error && data) {
          logRowId.current = (data as { id: number }).id;
        }
      } catch {
        // Never crash the app for analytics.
      }
    };

    track();

    // ── Patch time_on_page when the tab is closed / refreshed ────────────────
    const handleUnload = () => {
      const rowId = logRowId.current;
      if (rowId === null) return;
      const spent = Math.round((Date.now() - arrivedAt.current) / 1000);
      // Use sendBeacon so the request survives page unload
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/visitor_logs?id=eq.${rowId}`;
      const payload = JSON.stringify({ time_on_page: spent });
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [page]);
}
