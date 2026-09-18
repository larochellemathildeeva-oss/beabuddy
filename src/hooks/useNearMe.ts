import { useCallback, useEffect, useState } from "react";
import { DEFAULT_RADIUS } from "@/lib/near";
import type { LatLon } from "@/lib/geo";

/**
 * Where you are, and permission to know it.
 *
 * This lived inside the Near tab. Folding Near into the vault means two places
 * now need it — the filtered list and the nudge on Home — so it is a hook
 * rather than a screen's private state. Consent is deliberately separate from
 * the browser's own permission: the browser asks whether a site may read your
 * location, Béa asks how long she should keep acting on it.
 */

const CONSENT_KEY = "bea-location-consent";

export const SHARE_DURATIONS = [
  { id: "once", label: "Just this once", blurb: "Nothing is remembered" },
  { id: "hour", label: "For 1 hour", blurb: "Then you'll be asked again" },
  { id: "day", label: "For today", blurb: "Until midnight on this device" },
  { id: "always", label: "Until I turn it off", blurb: "You stay in control" },
] as const;

export type ShareDuration = (typeof SHARE_DURATIONS)[number]["id"];
export type LocState = "idle" | "locating" | "ok" | "error";

function readConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expiry: number | null };
    return parsed.expiry === null || parsed.expiry > Date.now();
  } catch {
    return false;
  }
}

function writeConsent(duration: ShareDuration) {
  let expiry: number | null = null;
  if (duration === "hour") expiry = Date.now() + 3_600_000;
  if (duration === "day") {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    expiry = end.getTime();
  }
  if (duration === "once") return; // nothing stored
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ expiry }));
  } catch {
    /* storage unavailable: consent lasts for this session only */
  }
}

export function useNearMe() {
  const [here, setHere] = useState<LatLon | null>(null);
  const [state, setState] = useState<LocState>("idle");
  const [error, setError] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  /**
   * Places you have waved away this session. It lives here rather than in the
   * list, because Home decides what to say about "near you" from the same
   * numbers the list renders — and when only the list knew about dismissals,
   * the two disagreed and Home kept a heading over an empty list.
   */
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  /** Consent is read after mount, so SSR and the first client render agree. */
  const [consentReady, setConsentReady] = useState(false);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("error");
      setError("This device can't share its location.");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setState("ok");
      },
      (err) => {
        setState("error");
        const framed = typeof window !== "undefined" && window.self !== window.top;
        if (err.code === 1 && framed) {
          setError(
            "This little preview window isn't allowed to use location. Open Béa in its own tab.",
          );
        } else if (err.code === 1) {
          setError(
            "Your browser is blocking location. Allow it in the address bar, then try again.",
          );
        } else {
          setError(err.message || "Location unavailable right now.");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    const ok = readConsent();
    setConsent(ok);
    setConsentReady(true);
    if (ok) locate();
  }, [locate]);

  const allow = useCallback(
    (duration: ShareDuration) => {
      writeConsent(duration);
      setConsent(true);
      locate();
    },
    [locate],
  );

  const dismiss = useCallback((id: string) => {
    setDismissed((cur) => (cur.includes(id) ? cur : [...cur, id]));
  }, []);

  const stop = useCallback(() => {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* nothing was stored to remove */
    }
    setConsent(false);
    setHere(null);
    setState("idle");
    setError("");
    setDismissed([]);
  }, []);

  return {
    here,
    state,
    error,
    radius,
    setRadius,
    consent,
    consentReady,
    dismissed,
    dismiss,
    allow,
    stop,
    locate,
  };
}
