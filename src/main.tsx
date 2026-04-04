import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAutoSync } from "./services/syncService";

// Initialize auto-sync: pushes IndexedDB data to cloud when online
initAutoSync();

// PWA service worker
// In development, unregister any existing service worker to avoid caching Vite modules,
// which can cause "hooks dispatcher is null" / invalid hook call errors.
if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }

  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);

          // Check for updates every 60 seconds
          setInterval(() => registration.update(), 60 * 1000);

          // When a new SW is waiting, activate it and reload
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "activated" &&
                  navigator.serviceWorker.controller
                ) {
                  // New version activated – reload to get latest assets
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log("Service Worker registration failed:", error);
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
