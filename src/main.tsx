import "./css/index.css";

import react from "react-dom/client";

import { TryYarnSpinner } from "./pages/TryYarnSpinner";
import useBodyClass from "./utility/useBodyClass";
import isEmbed from "./utility/isEmbed";

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
