// Preservar módulos, regras de acesso e fluxo mobile. Desktop usa área de trabalho própria.
// STATIC_UI_LOCK: MANDATORY MODULES
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Crown, LogOut, User } from "lucide-react";
import { Spotlight } from "@/components/Spotlight";

import logoCi from "@/assets/logo-workflux.png";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useHubAccess } from "@/hooks/useHubAccess";
import { useDesktopWorkspace } from "@/hooks/useDesktopWorkspace";
import { DesktopHome } from "@/components/workspace/DesktopHome";

export default function Home() {
  const navigate = useNavigate();
  const access = useHubAccess();
  const { modules, loading, semPerfil, isSuperAdmin, companyLogo } = access;
  const isDesktop = useDesktopWorkspace();
  const { requestPermission, isSupported, isSubscribed } = usePushNotifications();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed) return;

    const timeout = window.setTimeout(() => {
      requestPermission().catch(() => {});
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [isSupported, isSubscribed, requestPermission]);



  const handleLogout = async () => {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); } catch {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/");
  };

  if (isDesktop) return <DesktopHome access={access} onLogout={handleLogout} loggingOut={loggingOut} />;

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

      {/* Mobile: manter cartões em coluna única. */}
      <div className="flex flex-col gap-3 w-full max-w-2xl relative z-10">
        {/* Aviso: usuário logado mas sem perfil cadastrado no sistema */}
        {semPerfil && !loading && (
          <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-300 space-y-1">
            <p className="font-semibold">⚠️ Acesso pendente de configuração</p>
            <p className="text-yellow-300/80">Seu usuário ainda não foi configurado no sistema. Entre em contato com o administrador da sua empresa para liberar o acesso.</p>
          </div>
        )}
        {/* Loading skeleton enquanto permissões carregam */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!loading && modules
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
