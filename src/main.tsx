import "./css/index.css";

import react from "react-dom/client";

import { TryYarnSpinner } from "./pages/TryYarnSpinner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import useBodyClass from "./utility/useBodyClass";
import isEmbed from "./utility/isEmbed";

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
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
