// CRITICAL CORE: DO NOT ALTER MODULE ARRAY, VERTICAL LAYOUT OR USER CREATION FLOW.
// STATIC_UI_LOCK: MANDATORY MODULES
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown, LogOut, User } from "lucide-react";
import { Spotlight } from "@/components/Spotlight";

import logoCi from "@/assets/logo-workflux.png";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompanyModules } from "@/hooks/useCompanyModules";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { HUB_MODULES } from "@/config/navigation";

export default function Home() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { permissions, loading: loadingPerms, semPerfil } = usePermissions();
  const { hasModule, loading: loadingModules, isSuperAdmin, companyLogo } = useCompanyModules();
  const { requestPermission, isSupported, isSubscribed } = usePushNotifications();
  const [loggingOut, setLoggingOut] = useState(false);
  const [panelAccessAllowed, setPanelAccessAllowed] = useState(true);
  const [loadingPanelAccess, setLoadingPanelAccess] = useState(true);

  useEffect(() => {
    if (!isSupported || isSubscribed) return;

    const timeout = window.setTimeout(() => {
      requestPermission().catch(() => {});
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [isSupported, isSubscribed, requestPermission]);

  useEffect(() => {
    let mounted = true;

    const loadPanelAccess = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (mounted) setLoadingPanelAccess(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.company_id) {
          if (mounted) {
            setPanelAccessAllowed(true);
            setLoadingPanelAccess(false);
          }
          return;
        }

        const { data } = await (supabase as any)
          .from("user_admin_panel_access")
          .select("can_access_panel")
          .eq("company_id", profile.company_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (mounted) {
          setPanelAccessAllowed(data?.can_access_panel !== false);
          setLoadingPanelAccess(false);
        }
      } catch {
        if (mounted) {
          setPanelAccessAllowed(true);
          setLoadingPanelAccess(false);
        }
      }
    };

    loadPanelAccess();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); } catch {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-24 pb-12 bg-page relative">

      {/* Spotlight — Busca Global */}
      <div className="w-full max-w-2xl relative z-10 mb-6">
        <Spotlight />
      </div>

      {/* Brand */}
      <div className="mb-8 text-center space-y-3 relative z-10 flex flex-col items-center">
        {/* Marca preservada neste lote; sem efeitos decorativos */}
        <div className="relative inline-block">
          <img
            src={logoCi}
            alt="Workflux"
            className="h-14 w-14 mx-auto object-contain rounded-lg"
          />
        </div>

        {/* Se tiver logo do cliente, substitui o título pelo logo do cliente */}
        {companyLogo ? (
          <div className="flex flex-col items-center gap-1">
            <img src={companyLogo} alt="Cliente" className="h-28 object-contain" />
            <p className="text-sm text-muted-foreground">
              Powered by Workflux
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-foreground text-3xl font-display font-semibold tracking-tight">
              Workflux
            </h1>
            <p className="text-base text-muted-foreground">
              Plataforma de Gestão e Integração de Campo
            </p>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={() => navigate("/perfil")}
        className="absolute top-5 left-5 z-20 inline-flex items-center gap-2 min-h-12 px-4 py-2 rounded-lg border border-border text-foreground bg-background hover:bg-muted text-sm font-medium transition-colors"
      >
        <User className="w-4 h-4" /> Perfil
      </button>

      <button
        type="button"
        disabled={loggingOut}
        onClick={handleLogout}
        className="absolute top-5 right-5 z-20 inline-flex items-center gap-2 min-h-12 px-4 py-2 rounded-lg border border-border text-destructive bg-background hover:bg-destructive/10 text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors"
      >
        <LogOut className="w-4 h-4" /> {loggingOut ? "Saindo..." : "Sair"}
      </button>

      {/* @LOCK-UI: Single-column vertical layout — DO NOT change to grid-cols-2 */}
      <div className="flex flex-col gap-3 w-full max-w-2xl relative z-10">
        {/* Aviso: usuário logado mas sem perfil cadastrado no sistema */}
        {semPerfil && !loadingPerms && (
          <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-300 space-y-1">
            <p className="font-semibold">⚠️ Acesso pendente de configuração</p>
            <p className="text-yellow-300/80">Seu usuário ainda não foi configurado no sistema. Entre em contato com o administrador da sua empresa para liberar o acesso.</p>
          </div>
        )}
        {/* Loading skeleton enquanto permissões carregam */}
        {(loadingPerms || loadingModules || loadingPanelAccess) && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!loadingPerms && !loadingModules && !loadingPanelAccess && HUB_MODULES
          .filter(mod => {
            // adminOnly: acesso ao painel por 3 caminhos
            // 1) superadmin global
            // 2) admin legado (is_admin em user_permissions)
            // 3) admin por Admin Roles (useIsAdmin/has_role)
            const hasAdminAccess = isAdmin || isSuperAdmin || permissions?.is_admin === true;
            if (mod.adminOnly && !hasAdminAccess) return false;
            // Módulo admin: libera só quem tem permissão explícita
            if (mod.id === "admin") return hasAdminAccess && panelAccessAllowed;
            // Super-admin (dono do Workflux) vê tudo
            // Admin da empresa vê módulos contratados pela empresa
            if (!hasModule(mod.id)) return false;
            // Admin legado da empresa: não depende de flags individuais modulo_* no Home
            if (permissions?.is_admin === true) return true;
            // Usuário comum: filtrar por permissão individual
            const permMap: Record<string, keyof typeof permissions> = {
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
              dashboard: "modulo_dashboard",
              encarregado: "modulo_encarregado",
              sst: "modulo_sst",
              engenharia: "modulo_engenharia",
              "gestao-frotas": "modulo_gestao_frotas",
              "gestao-pessoas": "modulo_gestao_pessoas",
              suprimentos: "modulo_suprimentos",
              medicoes: "modulo_medicoes",
              orcamentos: "modulo_orcamentos",
              planejamento: "modulo_planejamento",
            };
            if (!permissions) return false;
            const permKey = permMap[mod.id];
            // Módulos novos podem iniciar com gate apenas por company_modules
            // (liberação por cliente no Super Admin), antes da permissão individual.
            if (!permKey) return true;
            return permissions[permKey] === true;
          })
          .map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.route)}
                className="group relative flex items-center gap-4 rounded-xl border border-border bg-card text-card-foreground p-4 min-h-20 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-accent shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <span className="block text-base leading-snug font-display font-semibold tracking-tight">{mod.label}</span>
                  <span className="block text-sm text-muted-foreground mt-1">{mod.subtitle}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto shrink-0" />
              </button>
            );
          })}

        {isSuperAdmin && (
          <button
            onClick={() => navigate("/super-admin")}
            className="group relative flex items-center gap-4 rounded-xl border border-border bg-card text-card-foreground p-4 min-h-20 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-accent shrink-0">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <span className="block text-base leading-snug font-display font-semibold tracking-tight">Super Admin</span>
              <span className="block text-sm text-muted-foreground mt-1">Gestão de Empresas Clientes</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
