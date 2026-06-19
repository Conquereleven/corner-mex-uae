import { useEffect, useState, useCallback } from "react";

export type CookieCategory = "necessary" | "analytics" | "marketing" | "functional";

export interface CookiePreferences {
  necessary: true; // always on
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  updatedAt: string; // ISO
  version: number;
}

const STORAGE_KEY = "cm.cookie-consent.v1";
const VERSION = 1;
const EVENT = "cm:cookie-consent-changed";

export const DEFAULT_PREFS: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  functional: false,
  updatedAt: "",
  version: VERSION,
};

export function readPreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiePreferences;
    if (parsed.version !== VERSION) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function writePreferences(prefs: Partial<CookiePreferences>) {
  if (typeof window === "undefined") return;
  const next: CookiePreferences = {
    ...DEFAULT_PREFS,
    ...prefs,
    necessary: true,
    updatedAt: new Date().toISOString(),
    version: VERSION,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function acceptAll() {
  writePreferences({ analytics: true, marketing: true, functional: true });
}
export function rejectNonEssential() {
  writePreferences({ analytics: false, marketing: false, functional: false });
}

export function useCookiePreferences() {
  const [prefs, setPrefs] = useState<CookiePreferences | null>(() => readPreferences());
  useEffect(() => {
    setPrefs(readPreferences());
    const handler = (e: Event) => setPrefs((e as CustomEvent<CookiePreferences>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  const update = useCallback((patch: Partial<CookiePreferences>) => writePreferences({ ...(prefs ?? DEFAULT_PREFS), ...patch }), [prefs]);
  return { prefs, update };
}

/** Open the preference modal from anywhere (e.g. footer link). */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("cm:open-cookie-preferences"));
}