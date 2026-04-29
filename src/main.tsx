import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Quando detecta que tem código novo no servidor, recarrega a página sozinho
    updateSW(true);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
