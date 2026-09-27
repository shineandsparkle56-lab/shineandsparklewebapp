/**
 * useReferral
 *
 * Captures a referral code from:
 *   1. ?ref=CODE  URL param  (highest priority — set on first visit)
 *   2. localStorage "sns_ref" (persists for 7 days so code survives page reloads)
 *
 * Also validates the code against the `referrals` Supabase table and exposes
 * the resolved referrer name + commission so the UI can show a confirmation banner.
 *
 * Flow:
 *   - On mount: read ?ref= from URL → save to localStorage with a 7-day expiry
 *   - If no URL param: load from localStorage (if not expired)
 *   - Query Supabase to confirm the code is active and get referrer details
 *   - Expose: code, referrerName, commissionLabel, isValid, clearReferral()
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const LS_KEY    = "sns_ref";
const LS_EXPIRY = "sns_ref_exp";
const TTL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ReferralInfo {
  code:            string;
  referrerName:    string;
  commissionType:  "flat" | "percent";
  commissionValue: number;
  /** Human-readable label, e.g. "₹50 per order" or "10% per order" */
  commissionLabel: string;
}

export interface UseReferralReturn {
  referralCode:  string;               // current code (empty string = none)
  referralInfo:  ReferralInfo | null;  // null until validated or if invalid
  isValidating:  boolean;
  isValid:       boolean;
  setManualCode: (code: string) => void;  // let user type a code in the UI
  clearReferral: () => void;
}

function readFromStorage(): string {
  try {
    const exp = localStorage.getItem(LS_EXPIRY);
    if (exp && Date.now() > Number(exp)) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_EXPIRY);
      return "";
    }
    return localStorage.getItem(LS_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToStorage(code: string) {
  try {
    localStorage.setItem(LS_KEY,    code);
    localStorage.setItem(LS_EXPIRY, String(Date.now() + TTL_MS));
  } catch { /* ignore quota errors */ }
}

function removeFromStorage() {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_EXPIRY);
  } catch { /* ignore */ }
}

export function useReferral(): UseReferralReturn {
  // Determine initial code: URL param → localStorage
  const [referralCode, setReferralCode] = useState<string>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get("ref");
      if (param) {
        const upper = param.toUpperCase().trim();
        saveToStorage(upper);
        return upper;
      }
    } catch { /* SSR guard */ }
    return readFromStorage();
  });

  const [referralInfo,  setReferralInfo]  = useState<ReferralInfo | null>(null);
  const [isValidating,  setIsValidating]  = useState(false);
  const [isValid,       setIsValid]       = useState(false);

  // Validate against DB whenever the code changes
  useEffect(() => {
    if (!referralCode) {
      setReferralInfo(null);
      setIsValid(false);
      return;
    }

    let cancelled = false;
    setIsValidating(true);
    setIsValid(false);
    setReferralInfo(null);

    supabase
      .from("referrals")
      .select("id, name, commission_type, commission_value")
      .eq("code",      referralCode)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const type  = (data.commission_type  as "flat" | "percent") ?? "flat";
          const value = Number(data.commission_value) ?? 0;
          const label = type === "flat"
            ? `₹${value} per order`
            : `${value}% per order`;
          setReferralInfo({
            code:            referralCode,
            referrerName:    data.name as string,
            commissionType:  type,
            commissionValue: value,
            commissionLabel: label,
          });
          setIsValid(true);
        } else {
          // Invalid / inactive code — wipe storage so it doesn't persist
          removeFromStorage();
          setIsValid(false);
        }
        setIsValidating(false);
      }, () => {
        // error handler as second argument to .then() — avoids the .catch() type issue
        if (!cancelled) setIsValidating(false);
      });

    return () => { cancelled = true; };
  }, [referralCode]);

  const setManualCode = useCallback((code: string) => {
    const upper = code.toUpperCase().trim();
    if (upper) {
      saveToStorage(upper);
    } else {
      removeFromStorage();
    }
    setReferralCode(upper);
  }, []);

  const clearReferral = useCallback(() => {
    removeFromStorage();
    setReferralCode("");
    setReferralInfo(null);
    setIsValid(false);
  }, []);

  return { referralCode, referralInfo, isValidating, isValid, setManualCode, clearReferral };
}
