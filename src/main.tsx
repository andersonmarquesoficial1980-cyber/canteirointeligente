import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMonitoring } from "./lib/monitoring";
import { reloadOnceForStaleChunk, isStaleChunkError } from "./components/ErrorBoundary";

// Falha ao carregar arquivo de uma versão antiga (deploy novo): recarrega sozinho.
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnceForStaleChunk(); });
window.addEventListener("unhandledrejection", (e) => { if (isStaleChunkError(e.reason)) { e.preventDefault(); reloadOnceForStaleChunk(); } });

createRoot(document.getElementById("root")!).render(<App />);

// Monitoramento de erros: só liga com VITE_SENTRY_DSN e carrega depois da primeira tela.
initMonitoring();
