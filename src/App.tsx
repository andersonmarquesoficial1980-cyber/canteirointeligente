// @LOCK-UI: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL.
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
import EquipmentHome from "./pages/EquipmentHome";
import EquipmentDiaryForm from "./pages/EquipmentDiaryForm";
import AdminConfiguracoes from "./pages/AdminConfiguracoes";
import TruckerHome from "./pages/TruckerHome";
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

        {/* Equipamentos module — standalone layout */}
        <Route path="/equipamentos" element={<EquipmentHome />} />
        <Route path="/equipamentos/frota" element={<AppLayout><FrotaNovo /></AppLayout>} />
        <Route path="/equipamentos/diario" element={<EquipmentDiaryForm />} />

        {/* CRITICAL: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL */}
        {/* Carreteiros module — standalone layout (NUNCA REMOVER) */}
        <Route path="/carreteiros" element={<TruckerHome />} />

        {/* Admin — Painel de Controle centralizado (standalone, sem AppLayout) (NUNCA REMOVER) */}
        <Route path="/admin" element={
          <ErrorBoundary fallbackMessage="Erro ao carregar o Painel de Controle.">
            <AdminConfiguracoes />
          </ErrorBoundary>
        } />
        <Route path="/admin/configuracoes" element={
          <ErrorBoundary fallbackMessage="Erro ao carregar o Painel de Controle.">
            <AdminConfiguracoes />
          </ErrorBoundary>
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
