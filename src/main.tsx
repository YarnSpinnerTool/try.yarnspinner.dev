import "./css/index.css";

import react from "react-dom/client";

import { TryYarnSpinner } from "./pages/TryYarnSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import useBodyClass from "./utility/useBodyClass";
import isEmbed from "./utility/isEmbed";

// Register service worker for WASM caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update().catch((error) => {
            console.warn('Service Worker update check failed:', error);
            // Don't throw - this is non-critical
          });
        }, 60000); // Check every minute

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, will be used on next page load
                console.log('New Service Worker available. Refresh to use cached files.');
              }
            });
          }
        });
      })
      .catch((error) => {
        // Service worker registration failed - log but don't crash the app
        console.warn('Service Worker registration failed:', error);
        // This is non-critical, app will work without service worker
      });
  });
}

react.createRoot(document.getElementById("app")!).render(
  <>
    <App />
  </>,
);

export function App() {
  const bodyClassName = isEmbed() ? "embedded" : null;

  useBodyClass(bodyClassName);

  return (
    <ErrorBoundary>
      <TryYarnSpinner />
    </ErrorBoundary>
  );
}
