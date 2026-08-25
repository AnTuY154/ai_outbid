export const COOKIE_CONSENT_KEY = "kinh_mat_cookie_consent";
export const COOKIE_CONSENT_EVENT = "kinh-mat-cookie-consent";

export type CookieConsent = "accepted" | "rejected";

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  const consent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return consent === "accepted" || consent === "rejected" ? consent : null;
}

export function setCookieConsent(consent: CookieConsent) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}
