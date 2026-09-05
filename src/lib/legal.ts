// Legal document versioning. Bump LEGAL_VERSION whenever the Terms or Privacy
// text changes — members who accepted an older version will be asked again.
export const LEGAL_VERSION = "2026-09-05";

export const CONSENT_TYPES = ["terms", "privacy", "disclaimer"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
