import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";

createRoot(document.getElementById("root")!).render(<App />);

// Monitoramento de erros: só liga com VITE_SENTRY_DSN e carrega depois da primeira tela.
initMonitoring();
