import "./css/index.css";

import react from "react-dom/client";

import { TryYarnSpinner } from "./pages/TryYarnSpinner";
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
          registration.update();
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
        console.log('Service Worker registration failed:', error);
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
    <>
      <TryYarnSpinner />
    </>
  );
}
