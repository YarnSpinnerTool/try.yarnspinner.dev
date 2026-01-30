/**
 * Umami analytics event tracking
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, string | number>) => void;
    };
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, string | number>) {
  if (window.umami) {
    window.umami.track(eventName, eventData);
  }
}
