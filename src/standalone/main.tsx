import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StandaloneApp } from "./StandaloneApp";
import "../css/standalone.css";

// Apply dark mode from system preference
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.add("dark");
}

// Listen for changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    document.documentElement.classList.toggle("dark", e.matches);
  });

createRoot(document.getElementById("player")!).render(
  <StrictMode>
    <StandaloneApp />
  </StrictMode>,
);
