// CRITICAL CORE: DO NOT ALTER MODULE ARRAY, VERTICAL LAYOUT OR USER CREATION FLOW.
// @UI-LOCK: MANDATORY MODULES AND VERTICAL LAYOUT. DO NOT REMOVE.
import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import OfflineIndicator from "@/components/OfflineIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import Home from "./pages/Home";
import Login from "./pages/Login";
import TrocarSenha from "./pages/TrocarSenha";
import Configurar2FA from "./pages/Configurar2FA";
import Verificar2FA from "./pages/Verificar2FA";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import Index from "./pages/Index";
import AbastecimentoHome from "./pages/AbastecimentoHome";
import AdminConfiguracoes from "./pages/AdminConfiguracoes";
import AdminLancamentos from "./pages/AdminLancamentos";
import BuscaEquipamentos from "./pages/BuscaEquipamentos";
import BuscaRdo from "./pages/BuscaRdo";
import DashboardAdmin from "./pages/DashboardAdmin";
import DemandasHome from "./pages/DemandasHome";
import DetalhesDemanda from "./pages/DetalhesDemanda";
import Diretorio from "./pages/Diretorio";
import DocumentosHome from "./pages/DocumentosHome";
import DocumentosIntegracao from "./pages/DocumentosIntegracao";
import EquipmentDiaryForm from "./pages/EquipmentDiaryForm";
import EquipmentHome from "./pages/EquipmentHome";
import EspelhoPonto from "./pages/EspelhoPonto";
import PontoSolicitacoes from "./pages/PontoSolicitacoes";
import PontoAprovacoes from "./pages/PontoAprovacoes";
import BancoHoras from "./pages/BancoHoras";
import ExportarProtheus from "./pages/ExportarProtheus";
import FichaFuncionario from "./pages/FichaFuncionario";
import FilaManutencao from "./pages/FilaManutencao";
import FrotaNovo from "./pages/FrotaNovo";
import GestaoFrotasDashboard from "./pages/GestaoFrotasDashboard";
import GestaoFrotasHome from "./pages/GestaoFrotasHome";
import GestaoFrotasVeiculo from "./pages/GestaoFrotasVeiculo";
import EquipamentoProntuario from "./pages/EquipamentoProntuario";
import EquipamentoOcorrencias from "./pages/EquipamentoOcorrencias";
import OcorrenciaDetalhe from "./pages/OcorrenciaDetalhe";
import MedicoesTerceiros from "./pages/MedicoesTerceiros";
import GestaoPessoasDashboard from "./pages/GestaoPessoasDashboard";
import ProgramacaoFerias from "./pages/ProgramacaoFerias";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import SSTHome from "./pages/SSTHome";
import SSTForm from "./pages/SSTForm";
import CarreteirosQRScan from "./pages/CarreteirosQRScan";
import CarreteirosQRPrint from "./pages/CarreteirosQRPrint";
import ManutencaoDocumentos from "./pages/ManutencaoDocumentos";
import ManutencaoHome from "./pages/ManutencaoHome";
import ManutencaoOS from "./pages/ManutencaoOS";
import MeusLancamentos from "./pages/MeusLancamentos";
import MinhasDemandas from "./pages/MinhasDemandas";
import OperadoresHabilitados from "./pages/OperadoresHabilitados";
import ProgramadorHome from "./pages/ProgramadorHome";
import TransporteEquipamentos from "./pages/TransporteEquipamentos";
import RdoForm from "./pages/RdoForm";
import RegistrarPonto from "./pages/RegistrarPonto";
import RelatorioAbastecimento from "./pages/RelatorioAbastecimento";
import RelatorioEquipamento from "./pages/RelatorioEquipamento";
import RelatorioManutencao from "./pages/RelatorioManutencao";
import RelatorioRdo from "./pages/RelatorioRdo";
import RelatorioTransportes from "./pages/RelatorioTransportes";
import RelatoriosHome from "./pages/RelatoriosHome";
import SuperAdmin from "./pages/SuperAdmin";
import SuprimentosHome from "./pages/SuprimentosHome";
import MedicoesHome from "./pages/MedicoesHome";
import RelatorioCarreteiros from "./pages/RelatorioCarreteiros";
import RelatorioFuncionario from "./pages/RelatorioFuncionario";
import RelatorioEquipamentosRdo from "./pages/RelatorioEquipamentosRdo";
import RelatorioNotasFiscais from "./pages/RelatorioNotasFiscais";
import TrajetoVT from "./pages/TrajetoVT";
import TruckerHome from "./pages/TruckerHome";
import ValeTransporte from "./pages/ValeTransporte";
import VisualizarLancamento from "./pages/VisualizarLancamento";
import VisualizarRdo from "./pages/VisualizarRdo";

const queryClient = new QueryClient();

// Redirect correto que preserva o parâmetro :fleet
function RedirectEquipamento() {
  const { fleet } = useParams<{ fleet: string }>();
  const [searchParams] = useSearchParams();
  const ini = searchParams.get("ini");
  const fim = searchParams.get("fim");
  const mes = searchParams.get("mes");
  const ano = searchParams.get("ano");
  let to = `/relatorios/equipamento/${encodeURIComponent(fleet || "")}`;
  const params = new URLSearchParams();
  if (ini) params.set("ini", ini);
  if (fim) params.set("fim", fim);
  if (mes) params.set("mes", mes);
  if (ano) params.set("ano", ano);
  if (params.toString()) to += `?${params.toString()}`;
  return <Navigate to={to} replace />;
}

// Mapa module_id → chave em user_permissions
const MODULE_PERM_MAP: Record<string, string> = {
  obras: "modulo_obras",
  equipamentos: "modulo_equipamentos",
  rh: "modulo_rh",
  carreteiros: "modulo_carreteiros",
  programador: "modulo_programador",
  demandas: "modulo_demandas",
  manutencao: "modulo_manutencao",
  abastecimento: "modulo_abastecimento",
  documentos: "modulo_documentos",
  relatorios: "modulo_relatorios",
  "gestao-frotas": "modulo_relatorios", // sem chave própria, admin only
  "gestao-pessoas": "modulo_relatorios",
  "medicoes": "modulo_relatorios",
  "suprimentos": "modulo_relatorios",
  "sst": "modulo_relatorios",
};

function RequireModule({ moduleId, children }: { moduleId: string; children: JSX.Element }) {
  const { hasModule, loading: loadingModules, isSuperAdmin } = useCompanyModules();
  const { permissions, loading: loadingPerms } = usePermissions();

  if (loadingModules || loadingPerms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Super-admin vê tudo
  if (isSuperAdmin) return children;

  // 1. Empresa precisa ter o módulo contratado
  if (!hasModule(moduleId)) return <Navigate to="/" replace />;

  // 2. Admin da empresa vê todos os módulos da empresa
  if (permissions?.is_admin) return children;

  // 3. Usuário comum: verificar permissão individual
  const permKey = MODULE_PERM_MAP[moduleId];
  if (permKey && permissions && !(permissions as any)[permKey]) {
    return <Navigate to="/" replace />;
  }

  return children;
}

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
  const [needs2FA, setNeeds2FA] = useState(false);
  const [mustSetup2FA, setMustSetup2FA] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  // Evita desmontar o app quando o token está sendo revalidado em background
  const [wasAuthenticated, setWasAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (session) setWasAuthenticated(true);
  }, [session]);

  // Check if user is active after session loads, and listen to MFA changes
  useEffect(() => {
    if (!session?.user?.id) { setBlocked(false); setMustChangePassword(false); setNeeds2FA(false); return; }
    
    const check = async () => {
      setCheckingAccess(true);
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
          
          try {
            const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
              // Tem 2FA configurado mas não validou ainda
              setNeeds2FA(true);
              setMustSetup2FA(false);
            } else if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1") {
              // 2FA opcional — não obriga nenhum perfil
              setNeeds2FA(false);
              setMustSetup2FA(false);
            } else {
              setNeeds2FA(false);
              setMustSetup2FA(false);
            }
          } catch { setNeeds2FA(false); setMustSetup2FA(false); }
        }
      } catch {}
      setCheckingAccess(false);
    };
    
    check();

    // Fica escutando mudanças na sessão (como quando o 2FA é validado e o token é atualizado)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'MFA_CHALLENGE_VERIFIED') {
        check();
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [session?.user?.id]);

  // Só mostra loading no primeiro carregamento — não quando revalidando token em background
  if ((loading || checkingAccess) && !wasAuthenticated) {
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

  if (mustSetup2FA && location.pathname !== "/configurar-2fa") {
    return <Navigate to="/configurar-2fa?obrigatorio=1" replace />;
  }

  if (needs2FA && location.pathname !== "/verificar-2fa") {
    return <Navigate to="/verificar-2fa" replace />;
  }

  return (
    <ErrorBoundary fallbackMessage="Erro ao carregar a página. Tente recarregar.">
      <Routes>
        <Route path="/trocar-senha" element={<TrocarSenha />} />
        <Route path="/verificar-2fa" element={<Verificar2FA />} />
        <Route path="/configurar-2fa" element={<Configurar2FA />} />

        {/* Hub — no sidebar/layout */}
        <Route path="/" element={<Home />} />
        <Route path="/perfil" element={<Perfil />} />

        {/* Obras module */}
        <Route path="/obras" element={<RequireModule moduleId="obras"><Index /></RequireModule>} />
        <Route path="/obras/rdo" element={<RequireModule moduleId="obras"><RdoForm /></RequireModule>} />

        {/* Equipamentos module */}
        <Route path="/equipamentos" element={<RequireModule moduleId="equipamentos"><EquipmentHome /></RequireModule>} />
        <Route path="/equipamentos/frota" element={<RequireModule moduleId="equipamentos"><AppLayout><FrotaNovo /></AppLayout></RequireModule>} />
        <Route path="/equipamentos/diario" element={<RequireModule moduleId="equipamentos"><EquipmentDiaryForm /></RequireModule>} />
        <Route path="/meus-lancamentos" element={<MeusLancamentos />} />
        <Route path="/visualizar-lancamento/:id" element={<VisualizarLancamento />} />
        <Route path="/visualizar-rdo/:id" element={<VisualizarRdo />} />
        <Route path="/equipamentos/exportar-protheus" element={<RequireModule moduleId="equipamentos"><ExportarProtheus /></RequireModule>} />
        <Route path="/documentos" element={<RequireModule moduleId="documentos"><DocumentosHome /></RequireModule>} />
        <Route path="/documentos/:id" element={<RequireModule moduleId="documentos"><DocumentosIntegracao /></RequireModule>} />
        <Route path="/manutencao" element={<RequireModule moduleId="manutencao"><ManutencaoHome /></RequireModule>} />
        <Route path="/manutencao/os/:id" element={<RequireModule moduleId="manutencao"><ManutencaoOS /></RequireModule>} />
        <Route path="/manutencao/documentos" element={<RequireModule moduleId="manutencao"><ManutencaoDocumentos /></RequireModule>} />
        <Route path="/abastecimento" element={<RequireModule moduleId="abastecimento"><AbastecimentoHome /></RequireModule>} />
        <Route path="/relatorios" element={<RequireModule moduleId="relatorios"><RelatoriosHome /></RequireModule>} />
        <Route path="/relatorios/rdo/:ogs" element={<RequireModule moduleId="relatorios"><RelatorioRdo /></RequireModule>} />
        <Route path="/relatorios/abastecimento/:fleet" element={<RequireModule moduleId="relatorios"><RelatorioAbastecimento /></RequireModule>} />
        <Route path="/relatorios/manutencao/:fleet" element={<RequireModule moduleId="relatorios"><RelatorioManutencao /></RequireModule>} />
        <Route path="/relatorios/transportes" element={<RequireModule moduleId="relatorios"><RelatorioTransportes /></RequireModule>} />
        <Route path="/relatorios/busca-rdo" element={<RequireModule moduleId="relatorios"><BuscaRdo /></RequireModule>} />
        <Route path="/relatorios/busca-equipamentos" element={<RequireModule moduleId="relatorios"><BuscaEquipamentos /></RequireModule>} />
        {/* Rota correta usada pelo RelatoriosHome */}
        <Route path="/relatorio-equipamento/:fleet" element={<RedirectEquipamento />} />
        {/* Alias para compatibilidade */}
        <Route path="/relatorios/equipamento/:fleet" element={<RelatorioEquipamento />} />
        <Route path="/dashboard" element={<RequireAdminOrSuperAdmin><DashboardAdmin /></RequireAdminOrSuperAdmin>} />
        <Route path="/super-admin" element={
          <RequireAdminOrSuperAdmin>
            <SuperAdmin />
          </RequireAdminOrSuperAdmin>
        } />
        <Route path="/gestao-frotas" element={<RequireModule moduleId="gestao-frotas"><GestaoFrotasHome /></RequireModule>} />
        <Route path="/gestao-frotas/veiculo/:id" element={<RequireModule moduleId="gestao-frotas"><GestaoFrotasVeiculo /></RequireModule>} />
        <Route path="/gestao-frotas/dashboard" element={<RequireModule moduleId="gestao-frotas"><GestaoFrotasDashboard /></RequireModule>} />
        <Route path="/equipamentos/prontuario/:id" element={<RequireModule moduleId="equipamentos"><EquipamentoProntuario /></RequireModule>} />
        <Route path="/manutencao/ocorrencias" element={<RequireModule moduleId="equipamentos"><EquipamentoOcorrencias /></RequireModule>} />
        <Route path="/manutencao/ocorrencia/:id" element={<RequireModule moduleId="equipamentos"><OcorrenciaDetalhe /></RequireModule>} />
        <Route path="/gestao-frotas/medicoes" element={<RequireModule moduleId="gestao-frotas"><MedicoesTerceiros /></RequireModule>} />
        <Route path="/gestao-pessoas" element={<RequireModule moduleId="gestao-pessoas"><GestaoPessoasDashboard /></RequireModule>} />
        <Route path="/gestao-pessoas/:id" element={<RequireModule moduleId="gestao-pessoas"><FichaFuncionario /></RequireModule>} />
        <Route path="/gestao-pessoas/ferias" element={<RequireModule moduleId="gestao-pessoas"><ProgramacaoFerias /></RequireModule>} />
        <Route path="/gestao-pessoas/whatsapp" element={<RequireModule moduleId="gestao-pessoas"><WhatsAppInbox /></RequireModule>} />
        <Route path="/sst" element={<RequireModule moduleId="sst"><SSTHome /></RequireModule>} />
        <Route path="/sst/nova" element={<RequireModule moduleId="sst"><SSTForm /></RequireModule>} />
        <Route path="/sst/:id" element={<RequireModule moduleId="sst"><SSTForm /></RequireModule>} />

        {/* CRITICAL: DO NOT REMOVE CARRETEIROS OR ADMIN PANEL */}
        {/* Carreteiros module — standalone layout (NUNCA REMOVER) */}
        <Route path="/carreteiros" element={<RequireModule moduleId="carreteiros"><TruckerHome /></RequireModule>} />
        <Route path="/carreteiros/scan/:truckId" element={<CarreteirosQRScan />} />
        <Route path="/carreteiros/qrcodes" element={<RequireModule moduleId="carreteiros"><CarreteirosQRPrint /></RequireModule>} />

        {/* Diretório — busca global */}
        <Route path="/diretorio" element={<AppLayout><Diretorio /></AppLayout>} />

        {/* WF RH — redirecionado para Gestão de Pessoas */}
        <Route path="/rh" element={<Navigate to="/gestao-pessoas" replace />} />
        <Route path="/rh/trajeto-vt" element={<RequireModule moduleId="rh"><TrajetoVT /></RequireModule>} />
        <Route path="/rh/registrar-ponto" element={<RequireModule moduleId="rh"><RegistrarPonto /></RequireModule>} />
        <Route path="/rh/espelho-ponto" element={<RequireModule moduleId="rh"><EspelhoPonto /></RequireModule>} />
        <Route path="/rh/solicitacoes" element={<RequireModule moduleId="rh"><PontoSolicitacoes /></RequireModule>} />
        <Route path="/rh/aprovacoes" element={<RequireModule moduleId="rh"><PontoAprovacoes /></RequireModule>} />
        <Route path="/rh/banco-horas" element={<RequireModule moduleId="rh"><BancoHoras /></RequireModule>} />

        {/* Vale Transporte */}
        <Route path="/vale-transporte" element={<RequireModule moduleId="rh"><ValeTransporte /></RequireModule>} />
        <Route path="/calculadora-fretes" element={<Navigate to="/suprimentos" replace />} />

        {/* Admin — Painel de Controle centralizado (standalone, sem AppLayout) (NUNCA REMOVER) */}
        <Route path="/admin/configuracoes" element={
          <RequireAdminOrSuperAdmin>
            <ErrorBoundary fallbackMessage="Erro ao carregar o Painel de Controle.">
              <AdminConfiguracoes />
            </ErrorBoundary>
          </RequireAdminOrSuperAdmin>
        } />
        <Route path="/admin/lancamentos" element={
          <RequireAdminOrSuperAdmin>
            <AdminLancamentos />
          </RequireAdminOrSuperAdmin>
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
        <Route path="/programador" element={<RequireModule moduleId="programador"><ProgramadorHome /></RequireModule>} />
        <Route path="/programador/transportes" element={<RequireModule moduleId="programador"><TransporteEquipamentos /></RequireModule>} />

        {/* WF Demandas */}
        <Route path="/demandas" element={<RequireModule moduleId="demandas"><DemandasHome /></RequireModule>} />
        <Route path="/demandas/:id" element={<DetalhesDemanda />} />
        <Route path="/minhas-demandas" element={<MinhasDemandas />} />
        <Route path="/manutencao/fila" element={<RequireModule moduleId="manutencao"><FilaManutencao /></RequireModule>} />

        {/* Suprimentos */}
        <Route path="/suprimentos" element={<RequireModule moduleId="suprimentos"><SuprimentosHome /></RequireModule>} />
        <Route path="/medicoes" element={<RequireModule moduleId="medicoes"><MedicoesHome /></RequireModule>} />
        <Route path="/relatorios/carreteiros" element={<RequireModule moduleId="carreteiros"><RelatorioCarreteiros /></RequireModule>} />
        <Route path="/relatorios/funcionario" element={<RequireModule moduleId="relatorios"><RelatorioFuncionario /></RequireModule>} />
        <Route path="/relatorios/equipamentos-rdo" element={<RequireModule moduleId="relatorios"><RelatorioEquipamentosRdo /></RequireModule>} />
        <Route path="/relatorios/notas-fiscais" element={<RequireModule moduleId="relatorios"><RelatorioNotasFiscais /></RequireModule>} />

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
