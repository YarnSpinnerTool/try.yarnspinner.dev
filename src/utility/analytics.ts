/**
 * Umami analytics event tracking
 */

declare global {
  interface Window {
    umami?: {
      track: ((eventName: string, eventData?: Record<string, string | number>) => void)
        & ((callback: (props: Record<string, unknown>) => Record<string, unknown>) => void);
      identify: (data: Record<string, string | number | boolean>) => void;
    };
  }
}

export function trackEvent(eventName: string, eventData?: Record<string, string | number>) {
  if (window.umami) {
    window.umami.track(eventName, eventData);
  }
}

/**
 * Attach session-level properties so all subsequent events can be segmented
 * by these values in the Umami dashboard.
 */
export function identifySession(data: Record<string, string | number | boolean>) {
  if (window.umami) {
    window.umami.identify(data);
  }
}
