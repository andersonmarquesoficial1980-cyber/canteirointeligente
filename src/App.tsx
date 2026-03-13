import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import Home from "./pages/Home";
import Index from "./pages/Index";
import RdoForm from "./pages/RdoForm";
import FrotaNovo from "./pages/FrotaNovo";
import AdminConfiguracoes from "./pages/AdminConfiguracoes";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <ErrorBoundary fallbackMessage="Erro ao carregar a página. Tente recarregar.">
      <Routes>
        {/* Hub — no sidebar/layout */}
        <Route path="/" element={<Home />} />

        {/* Obras module */}
        <Route path="/obras" element={<AppLayout><Index /></AppLayout>} />
        <Route path="/obras/rdo" element={<AppLayout><RdoForm /></AppLayout>} />

        {/* Equipamentos module */}
        <Route path="/equipamentos" element={<AppLayout><FrotaNovo /></AppLayout>} />

        {/* Admin */}
        <Route path="/admin/configuracoes" element={
          <AppLayout>
            <ErrorBoundary fallbackMessage="Erro ao carregar Configurações.">
              <AdminConfiguracoes />
            </ErrorBoundary>
          </AppLayout>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
