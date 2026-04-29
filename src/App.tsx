// CRITICAL CORE: DO NOT ALTER MODULE ARRAY, VERTICAL LAYOUT OR USER CREATION FLOW.
// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT REMOVE.
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import OfflineIndicator from "@/components/OfflineIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useCompanyModules } from "@/hooks/useCompanyModules";
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
import DetalhesDemanda from "./pages/DetalhesDemanda";
import FilaManutencao from "./pages/FilaManutencao";
import MeusLancamentos from "./pages/MeusLancamentos";
import ExportarProtheus from "./pages/ExportarProtheus";
import DocumentosHome from "./pages/DocumentosHome";
import DocumentosIntegracao from "./pages/DocumentosIntegracao";
import ManutencaoHome from "./pages/ManutencaoHome";
import ManutencaoOS from "./pages/ManutencaoOS";
import ManutencaoDocumentos from "./pages/ManutencaoDocumentos";
import AbastecimentoHome from "./pages/AbastecimentoHome";
import RelatoriosHome from "./pages/RelatoriosHome";
import RelatorioEquipamento from "./pages/RelatorioEquipamento";
import DashboardAdmin from "./pages/DashboardAdmin";
import SuperAdmin from "./pages/SuperAdmin";
import GestaoFrotasHome from "./pages/GestaoFrotasHome";
import GestaoFrotasVeiculo from "./pages/GestaoFrotasVeiculo";
import GestaoFrotasDashboard from "./pages/GestaoFrotasDashboard";
import GestaoPessoasDashboard from "./pages/GestaoPessoasDashboard";
import OperadoresHabilitados from "./pages/OperadoresHabilitados";
import Login from "./pages/Login";
import TrocarSenha from "./pages/TrocarSenha";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RequireAdminOrSuperAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin, loading: loadingAdmin } = useIsAdmin();
  const { isSuperAdmin, loading: loadingModules } = useCompanyModules();

  if (loadingAdmin || loadingModules) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { session, loading, signOut } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const location = useLocation();

  // Check if user is active after session loads
  useEffect(() => {
    if (!session?.user?.id) { setBlocked(false); setMustChangePassword(false); return; }
    setCheckingAccess(true);
    const check = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("status, senha_temporaria")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (data && data.status === "inativo") {
          setBlocked(true);
          setMustChangePassword(false);
          signOut();
        } else {
          setBlocked(false);
          setMustChangePassword(Boolean((data as any)?.senha_temporaria));
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

  if (mustChangePassword && location.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  return (
    <ErrorBoundary fallbackMessage="Erro ao carregar a página. Tente recarregar.">
      <Routes>
        <Route path="/trocar-senha" element={<TrocarSenha />} />

        {/* Hub — no sidebar/layout */}
        <Route path="/" element={<Home />} />

        {/* Obras module */}
        <Route path="/obras" element={<Index />} />
        <Route path="/obras/rdo" element={<RdoForm />} />

        {/* Equipamentos module — standalone layout */}
        <Route path="/equipamentos" element={<EquipmentHome />} />
        <Route path="/equipamentos/frota" element={<AppLayout><FrotaNovo /></AppLayout>} />
        <Route path="/equipamentos/diario" element={<EquipmentDiaryForm />} />
        <Route path="/meus-lancamentos" element={<MeusLancamentos />} />
        <Route path="/equipamentos/exportar-protheus" element={<ExportarProtheus />} />
        <Route path="/documentos" element={<DocumentosHome />} />
        <Route path="/documentos/:id" element={<DocumentosIntegracao />} />
        <Route path="/manutencao" element={<ManutencaoHome />} />
        <Route path="/manutencao/os/:id" element={<ManutencaoOS />} />
        <Route path="/manutencao/documentos" element={<ManutencaoDocumentos />} />
        <Route path="/abastecimento" element={<AbastecimentoHome />} />
        <Route path="/relatorios" element={<RelatoriosHome />} />
        <Route path="/relatorios/equipamento/:fleet" element={<RelatorioEquipamento />} />
        <Route path="/dashboard" element={<DashboardAdmin />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/gestao-frotas" element={<GestaoFrotasHome />} />
        <Route path="/gestao-frotas/veiculo/:id" element={<GestaoFrotasVeiculo />} />
        <Route path="/gestao-frotas/dashboard" element={<GestaoFrotasDashboard />} />
        <Route path="/gestao-pessoas" element={<GestaoPessoasDashboard />} />

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
        <Route
          path="/admin/operadores-habilitados"
          element={
            <RequireAdminOrSuperAdmin>
              <OperadoresHabilitados />
            </RequireAdminOrSuperAdmin>
          }
        />

        {/* WF Programador */}
        <Route path="/programador" element={<ProgramadorHome />} />

        {/* WF Demandas */}
        <Route path="/demandas" element={<DemandasHome />} />
        <Route path="/demandas/:id" element={<DetalhesDemanda />} />
        <Route path="/minhas-demandas" element={<MinhasDemandas />} />
        <Route path="/manutencao/fila" element={<FilaManutencao />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

const App = () => {
  const { isOnline, pendingCount, syncing, lastSync } = useOfflineSync();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <OfflineIndicator
            isOnline={isOnline}
            pendingCount={pendingCount}
            syncing={syncing}
            lastSync={lastSync}
          />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
