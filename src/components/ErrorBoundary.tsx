import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/monitoring";

export function isStaleChunkError(error: any): boolean {
  const msg = String(error?.message || error || "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /is not a valid JavaScript MIME type/i.test(msg) ||
    /Unable to preload CSS/i.test(msg) ||
    error?.name === "ChunkLoadError"
  );
}

/** Recarrega para pegar o index.html novo. No máximo 1x a cada 60s (evita loop se o erro for outro). */
export function reloadOnceForStaleChunk() {
  const key = "_chunk_reload_at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
}

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    // Deploy novo apaga os arquivos antigos: o servidor devolve index.html no lugar do .js.
    // Chrome/Edge: "Failed to fetch dynamically imported module"; Safari: "'text/html' is not a valid
    // JavaScript MIME type" / "Importing a module script failed"; Firefox: "error loading dynamically imported module".
    const isChunkError = isStaleChunkError(error);
    if (!isChunkError) {
      reportError(error, { origem: "ErrorBoundary", mensagem_tela: this.props.fallbackMessage || "" });
    } else {
      reloadOnceForStaleChunk();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 gap-4 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {this.props.fallbackMessage || "Ocorreu um erro ao carregar esta seção."}
          </p>
          <div className="bg-destructive/10 text-destructive p-3 rounded text-left text-xs overflow-auto max-w-full font-mono mt-2">
            {this.state.error?.message}
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReload}>
            Recarregar página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
