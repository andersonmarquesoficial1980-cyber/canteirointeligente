import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
