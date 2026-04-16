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
import FreightCalculator from "./pages/FreightCalculator";
import RhHome from "./pages/RhHome";
import TrajetoVT from "./pages/TrajetoVT";
import RegistrarPonto from "./pages/RegistrarPonto";
import EspelhoPonto from "./pages/EspelhoPonto";
import ProgramadorHome from "./pages/ProgramadorHome";
import DemandasHome from "./pages/DemandasHome";
import MinhasDemandas from "./pages/MinhasDemandas";
import ExportarProtheus from "./pages/ExportarProtheus";
import DocumentosHome from "./pages/DocumentosHome";
import DocumentosIntegracao from "./pages/DocumentosIntegracao";
import ManutencaoHome from "./pages/ManutencaoHome";
import ManutencaoOS from "./pages/ManutencaoOS";
import ManutencaoDocumentos from "./pages/ManutencaoDocumentos";
import AbastecimentoHome from "./pages/AbastecimentoHome";
import RelatoriosHome from "./pages/RelatoriosHome";
import RelatorioEquipamento from "./pages/RelatorioEquipamento";
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
        <Route path="/equipamentos/exportar-protheus" element={<ExportarProtheus />} />
        <Route path="/documentos" element={<DocumentosHome />} />
        <Route path="/documentos/:id" element={<DocumentosIntegracao />} />
        <Route path="/manutencao" element={<ManutencaoHome />} />
        <Route path="/manutencao/os/:id" element={<ManutencaoOS />} />
        <Route path="/manutencao/documentos" element={<ManutencaoDocumentos />} />
        <Route path="/abastecimento" element={<AbastecimentoHome />} />
        <Route path="/relatorios" element={<RelatoriosHome />} />
        <Route path="/relatorios/equipamento/:fleet" element={<RelatorioEquipamento />} />

        {/* CRITICAL: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL */}
        {/* Carreteiros module — standalone layout (NUNCA REMOVER) */}
        <Route path="/carreteiros" element={<TruckerHome />} />

        {/* Diretório — busca global */}
        <Route path="/diretorio" element={<AppLayout><Diretorio /></AppLayout>} />

        {/* WF RH module */}
        <Route path="/rh" element={<RhHome />} />
        <Route path="/rh/trajeto-vt" element={<TrajetoVT />} />
        <Route path="/rh/registrar-ponto" element={<RegistrarPonto />} />
        <Route path="/rh/espelho-ponto" element={<EspelhoPonto />} />

        {/* Vale Transporte */}
        <Route path="/vale-transporte" element={<ValeTransporte />} />
        <Route path="/calculadora-fretes" element={<FreightCalculator />} />

        {/* Admin — Painel de Controle centralizado (standalone, sem AppLayout) (NUNCA REMOVER) */}
        <Route path="/admin/configuracoes" element={
          <ErrorBoundary fallbackMessage="Erro ao carregar o Painel de Controle.">
            <AdminConfiguracoes />
          </ErrorBoundary>
        } />

        {/* WF Programador */}
        <Route path="/programador" element={<ProgramadorHome />} />

        {/* WF Demandas */}
        <Route path="/demandas" element={<AppLayout><DemandasHome /></AppLayout>} />
        <Route path="/minhas-demandas" element={<MinhasDemandas />} />

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
