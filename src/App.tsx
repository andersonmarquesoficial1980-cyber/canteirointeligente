// CRITICAL CORE: DO NOT ALTER MODULE ARRAY, VERTICAL LAYOUT OR USER CREATION FLOW.
// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT REMOVE.
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Home from "./pages/Home";
import Index from "./pages/Index";
import RdoForm from "./pages/RdoForm";
import FrotaNovo from "./pages/FrotaNovo";
import EquipmentHome from "./pages/EquipmentHome";
import EquipmentDiaryForm from "./pages/EquipmentDiaryForm";
import AdminConfiguracoes from "./pages/AdminConfiguracoes";
import TruckerHome from "./pages/TruckerHome";
import Diretorio from "./pages/Diretorio";
import ValeTransporte from "./pages/ValeTransporte";
import Login from "./pages/Login";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, loading, signOut } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Check if user is active after session loads
  useEffect(() => {
    if (!session?.user?.id) { setBlocked(false); return; }
    setCheckingAccess(true);
    const check = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("status")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (data && data.status === "inativo") {
          setBlocked(true);
          signOut();
        } else {
          setBlocked(false);
        }
      } catch {}
      setCheckingAccess(false);
    };
    check();
  }, [session?.user?.id]);

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <p className="text-lg font-bold text-destructive">Acesso bloqueado</p>
        <p className="text-sm text-muted-foreground">Sua conta foi desativada. Procure o Administrador.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
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

        {/* Diretório — busca global */}
        <Route path="/diretorio" element={<AppLayout><Diretorio /></AppLayout>} />

        {/* Vale Transporte */}
        <Route path="/vale-transporte" element={<ValeTransporte />} />

        {/* Admin — Painel de Controle centralizado (standalone, sem AppLayout) (NUNCA REMOVER) */}
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
