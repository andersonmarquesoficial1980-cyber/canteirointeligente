import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force SW update: detect new version and reload
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("Nova versão detectada, recarregando...");
              window.location.reload();
            }
          });
        }
      });
      // Proactively check for updates
      reg.update().catch(() => {});
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
